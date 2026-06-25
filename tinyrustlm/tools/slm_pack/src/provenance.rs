//! Provenance sidecar generation and validation for `.slm` artifacts.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::slm_validate::{self, ValidationReport};

const MANIFEST_VERSION: &str = "1";
const EVAL_MANIFEST_VERSION: &str = "1";
const GATE_RUNTIME_SMOKE: &str = "runtime-smoke";
const GATE_ASSISTANT_QUALITY: &str = "assistant-quality";

struct SourcePolicy {
    quality_claim: &'static str,
    trained_quality_claim: &'static str,
    admission_status: &'static str,
    required_next_gate: &'static str,
}

/// Writes a line-based provenance manifest for a validated `.slm` file.
pub fn write_manifest_for_path(input: &Path, output: &Path, source_kind: &str) -> io::Result<()> {
    let bytes = fs::read(input)?;
    let report = slm_validate::validate_bytes(&bytes, &input.display().to_string())?;
    let manifest = build_manifest_text(&report, source_kind)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, manifest)?;
    println!("SLM manifest written: {}", output.display());
    Ok(())
}

/// Validates a provenance manifest against a local `.slm` file.
pub fn validate_manifest_path(input: &Path, manifest: &Path) -> io::Result<()> {
    let bytes = fs::read(input)?;
    let report = slm_validate::validate_bytes(&bytes, &input.display().to_string())?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_manifest_text(&report, &manifest_text)?;
    println!("SLM manifest validation: PASS");
    println!("model: {}", report.path());
    println!("manifest: {}", manifest.display());
    println!(
        "source_kind: {}",
        require_key(&parse_manifest(&manifest_text)?, "source_kind")?
    );
    Ok(())
}

/// Writes a pending evaluation sidecar template bound to a validated model and manifest.
pub fn write_eval_template_for_path(
    input: &Path,
    manifest: &Path,
    output: &Path,
    gate: &str,
) -> io::Result<()> {
    let bytes = fs::read(input)?;
    let report = slm_validate::validate_bytes(&bytes, &input.display().to_string())?;
    let manifest_text = fs::read_to_string(manifest)?;
    let fields = validate_manifest_text(&report, &manifest_text)?;
    let eval_text = build_eval_template_text(&report, &manifest_text, &fields, gate)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, eval_text)?;
    println!("SLM evaluation template written: {}", output.display());
    Ok(())
}

/// Validates a requested quality gate against model, provenance, and optional evaluation evidence.
pub fn quality_gate_path(
    input: &Path,
    manifest: &Path,
    gate: &str,
    eval_manifest: Option<&Path>,
) -> io::Result<()> {
    let bytes = fs::read(input)?;
    let report = slm_validate::validate_bytes(&bytes, &input.display().to_string())?;
    let manifest_text = fs::read_to_string(manifest)?;
    let eval_text = match eval_manifest {
        Some(path) => Some(fs::read_to_string(path)?),
        None => None,
    };
    validate_quality_gate(&report, &manifest_text, gate, eval_text.as_deref())?;
    println!("SLM quality gate: PASS");
    println!("model: {}", report.path());
    println!("manifest: {}", manifest.display());
    println!("gate: {gate}");
    if let Some(path) = eval_manifest {
        println!("evaluation_manifest: {}", path.display());
    }
    Ok(())
}

fn build_manifest_text(report: &ValidationReport, source_kind: &str) -> io::Result<String> {
    let policy = policy_for_source_kind(source_kind)?;
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_slm_manifest_version",
        MANIFEST_VERSION,
    );
    push_line(&mut text, "model_path", report.path());
    push_line(&mut text, "model_bytes", &report.file_bytes().to_string());
    push_line(&mut text, "slm_version", &report.slm_version().to_string());
    push_line(
        &mut text,
        "slm_checksum",
        &format!("0x{:016x}", report.checksum()),
    );
    push_line(&mut text, "model_shape", &report.shape_summary());
    push_line(
        &mut text,
        "tensor_count",
        &report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "parameter_count",
        &report.parameter_count().to_string(),
    );
    push_line(&mut text, "quantization", report.quantization_label());
    push_line(&mut text, "source_kind", source_kind);
    push_line(&mut text, "quality_claim", policy.quality_claim);
    push_line(
        &mut text,
        "trained_quality_claim",
        policy.trained_quality_claim,
    );
    push_line(&mut text, "admission_status", policy.admission_status);
    push_line(&mut text, "required_next_gate", policy.required_next_gate);
    Ok(text)
}

fn validate_manifest_text(
    report: &ValidationReport,
    text: &str,
) -> io::Result<HashMap<String, String>> {
    let fields = parse_manifest(text)?;
    require_equal(&fields, "tinyrustlm_slm_manifest_version", MANIFEST_VERSION)?;
    require_equal(&fields, "model_bytes", &report.file_bytes().to_string())?;
    require_equal(&fields, "slm_version", &report.slm_version().to_string())?;
    require_equal(
        &fields,
        "slm_checksum",
        &format!("0x{:016x}", report.checksum()),
    )?;
    require_equal(&fields, "model_shape", &report.shape_summary())?;
    require_equal(&fields, "tensor_count", &report.tensor_count().to_string())?;
    require_equal(
        &fields,
        "parameter_count",
        &report.parameter_count().to_string(),
    )?;
    require_equal(&fields, "quantization", report.quantization_label())?;

    let source_kind = require_key(&fields, "source_kind")?;
    let policy = policy_for_source_kind(source_kind)?;
    require_equal(&fields, "quality_claim", policy.quality_claim)?;
    require_equal(
        &fields,
        "trained_quality_claim",
        policy.trained_quality_claim,
    )?;
    require_equal(&fields, "admission_status", policy.admission_status)?;
    require_equal(&fields, "required_next_gate", policy.required_next_gate)?;
    require_key(&fields, "model_path")?;
    Ok(fields)
}

fn build_eval_template_text(
    report: &ValidationReport,
    manifest_text: &str,
    manifest_fields: &HashMap<String, String>,
    gate: &str,
) -> io::Result<String> {
    if gate != GATE_ASSISTANT_QUALITY {
        return Err(invalid(
            "eval-template currently supports assistant-quality",
        ));
    }
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_eval_manifest_version",
        EVAL_MANIFEST_VERSION,
    );
    push_line(&mut text, "gate", gate);
    push_line(
        &mut text,
        "source_kind",
        require_key(manifest_fields, "source_kind")?,
    );
    push_line(
        &mut text,
        "manifest_checksum",
        &format!("0x{:016x}", text_checksum(manifest_text.as_bytes())),
    );
    push_line(
        &mut text,
        "slm_checksum",
        &format!("0x{:016x}", report.checksum()),
    );
    push_line(&mut text, "model_shape", &report.shape_summary());
    push_line(&mut text, "eval_status", "pending");
    push_line(&mut text, "task_eval_status", "pending");
    push_line(&mut text, "safety_review_status", "pending");
    push_line(&mut text, "quality_decision", "pending");
    push_line(&mut text, "quality_scope", "pending");
    push_line(&mut text, "evaluator", "not-reviewed");
    push_line(&mut text, "eval_dataset", "not-provided");
    push_line(&mut text, "eval_summary", "not-reviewed");
    Ok(text)
}

fn validate_quality_gate(
    report: &ValidationReport,
    manifest_text: &str,
    gate: &str,
    eval_text: Option<&str>,
) -> io::Result<()> {
    let manifest_fields = validate_manifest_text(report, manifest_text)?;
    let source_kind = require_key(&manifest_fields, "source_kind")?;
    match gate {
        GATE_RUNTIME_SMOKE => validate_runtime_smoke_gate(source_kind),
        GATE_ASSISTANT_QUALITY => {
            let eval_text = eval_text
                .ok_or_else(|| invalid("assistant-quality gate requires an evaluation manifest"))?;
            validate_assistant_quality_gate(report, manifest_text, source_kind, eval_text)
        }
        _ => Err(invalid(
            "quality gate must be runtime-smoke or assistant-quality",
        )),
    }
}

fn validate_runtime_smoke_gate(source_kind: &str) -> io::Result<()> {
    match source_kind {
        "deterministic-smoke" | "converted-trained" => Ok(()),
        _ => Err(invalid("runtime-smoke gate requires a known source_kind")),
    }
}

fn validate_assistant_quality_gate(
    report: &ValidationReport,
    manifest_text: &str,
    source_kind: &str,
    eval_text: &str,
) -> io::Result<()> {
    if source_kind != "converted-trained" {
        return Err(invalid(
            "assistant-quality gate requires source_kind=converted-trained",
        ));
    }
    let fields = parse_manifest(eval_text)?;
    require_equal(
        &fields,
        "tinyrustlm_eval_manifest_version",
        EVAL_MANIFEST_VERSION,
    )?;
    require_equal(&fields, "gate", GATE_ASSISTANT_QUALITY)?;
    require_equal(&fields, "source_kind", "converted-trained")?;
    require_equal(
        &fields,
        "manifest_checksum",
        &format!("0x{:016x}", text_checksum(manifest_text.as_bytes())),
    )?;
    require_equal(
        &fields,
        "slm_checksum",
        &format!("0x{:016x}", report.checksum()),
    )?;
    require_equal(&fields, "model_shape", &report.shape_summary())?;
    require_equal(&fields, "eval_status", "pass")?;
    require_equal(&fields, "task_eval_status", "pass")?;
    require_equal(&fields, "safety_review_status", "pass")?;
    require_equal(
        &fields,
        "quality_decision",
        "accepted-for-assistant-quality",
    )?;
    require_evidence_field(&fields, "quality_scope")?;
    require_evidence_field(&fields, "evaluator")?;
    require_evidence_field(&fields, "eval_dataset")?;
    require_evidence_field(&fields, "eval_summary")?;
    require_evidence_field(&fields, "quality_boundary")?;
    validate_eval_case_evidence(&fields)?;
    Ok(())
}

fn parse_manifest(text: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "manifest line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            return Err(invalid(&format!(
                "manifest line {} has an empty key or value",
                line_index + 1
            )));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate manifest key {key}")));
        }
    }
    Ok(fields)
}

fn validate_eval_case_evidence(fields: &HashMap<String, String>) -> io::Result<()> {
    let case_count = require_positive_usize(fields, "case_count")?;
    let cases_passed = require_usize(fields, "cases_passed")?;
    let cases_failed = require_usize(fields, "cases_failed")?;
    if cases_passed != case_count || cases_failed != 0 {
        return Err(invalid(
            "evaluation case totals must show every declared case passed and zero failed cases",
        ));
    }
    for index in 0..case_count {
        let prefix = format!("case.{index}");
        require_equal(fields, &format!("{prefix}.status"), "pass")?;
        let expected = require_nonempty_field(fields, &format!("{prefix}.expected"))?;
        let actual = require_nonempty_field(fields, &format!("{prefix}.actual"))?;
        if actual != expected {
            return Err(invalid(&format!(
                "evaluation case {index} actual text did not match expected text"
            )));
        }
        require_equal(fields, &format!("{prefix}.error"), "ok")?;
    }
    reject_extra_eval_case_keys(fields, case_count)?;
    Ok(())
}

fn reject_extra_eval_case_keys(
    fields: &HashMap<String, String>,
    case_count: usize,
) -> io::Result<()> {
    for key in fields.keys() {
        if let Some(rest) = key.strip_prefix("case.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("evaluation case key {key} is malformed")));
            };
            let index = parse_usize(index_text, key)?;
            if index >= case_count {
                return Err(invalid(&format!(
                    "evaluation case key {key} is outside declared case_count"
                )));
            }
            match field_name {
                "status" | "expected" | "actual" | "error" => {}
                _ => {
                    return Err(invalid(&format!(
                        "evaluation case key {key} has unknown field"
                    )))
                }
            }
        }
    }
    Ok(())
}

fn require_positive_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    let value = require_usize(fields, key)?;
    if value == 0 {
        return Err(invalid(&format!(
            "evaluation field {key} must be greater than zero"
        )));
    }
    Ok(value)
}

fn require_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    let value = require_key(fields, key)?;
    parse_usize(value, key)
}

fn parse_usize(value: &str, key: &str) -> io::Result<usize> {
    value
        .parse::<usize>()
        .map_err(|_| invalid(&format!("evaluation field {key} must be a usize")))
}

fn require_nonempty_field<'a>(
    fields: &'a HashMap<String, String>,
    key: &str,
) -> io::Result<&'a str> {
    let value = require_key(fields, key)?;
    if value.is_empty() {
        return Err(invalid(&format!(
            "evaluation field {key} must not be empty"
        )));
    }
    Ok(value)
}

fn require_evidence_field(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    if value == "pending" || value == "not-reviewed" || value == "not-provided" || value.len() < 8 {
        return Err(invalid(&format!(
            "evaluation field {key} must contain reviewed evidence"
        )));
    }
    Ok(())
}

fn require_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("manifest missing required key {key}")))
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "manifest key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn policy_for_source_kind(source_kind: &str) -> io::Result<SourcePolicy> {
    match source_kind {
        "deterministic-smoke" => Ok(SourcePolicy {
            quality_claim: "runtime-execution-smoke-only",
            trained_quality_claim: "not-claimed",
            admission_status: "accepted-for-runtime-smoke",
            required_next_gate:
                "replace-with-trained-or-evaluated-model-before-product-quality-claim",
        }),
        "converted-trained" => Ok(SourcePolicy {
            quality_claim: "runtime-compatible-not-quality-verified",
            trained_quality_claim: "pending-evaluation",
            admission_status: "structure-accepted-quality-pending",
            required_next_gate: "task-eval-and-safety-review-before-assistant-quality-claim",
        }),
        _ => Err(invalid(
            "source_kind must be deterministic-smoke or converted-trained",
        )),
    }
}

fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

fn text_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x4d595df4d0f33173u64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 2);
        acc = acc.rotate_left(9).wrapping_mul(0x100000001b3);
    }
    acc
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_model_file;
    use crate::tensor_writer::{tiny_fixture_tensors, ModelShape};
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn manifest_round_trip_matches_generated_fixture() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "deterministic-smoke").unwrap();

        validate_manifest_text(&report, &manifest).unwrap();
        assert!(manifest.contains("source_kind=deterministic-smoke"));
        assert!(manifest.contains("trained_quality_claim=not-claimed"));
    }

    #[test]
    fn manifest_rejects_checksum_mismatch() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "deterministic-smoke")
            .unwrap()
            .replace(
                &format!("slm_checksum=0x{:016x}", report.checksum()),
                "slm_checksum=0x0000000000000001",
            );

        let error = validate_manifest_text(&report, &manifest).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn manifest_rejects_trained_quality_overclaim() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "converted-trained")
            .unwrap()
            .replace(
                "trained_quality_claim=pending-evaluation",
                "trained_quality_claim=claimed",
            );

        let error = validate_manifest_text(&report, &manifest).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn quality_gate_allows_runtime_smoke_manifest() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "deterministic-smoke").unwrap();

        validate_quality_gate(&report, &manifest, GATE_RUNTIME_SMOKE, None).unwrap();
    }

    #[test]
    fn quality_gate_rejects_smoke_assistant_quality_claim() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "deterministic-smoke").unwrap();
        let eval = passing_eval_text(&report, &manifest, "converted-trained");

        let error = validate_quality_gate(&report, &manifest, GATE_ASSISTANT_QUALITY, Some(&eval))
            .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn quality_gate_rejects_converted_trained_without_eval() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "converted-trained").unwrap();

        let error =
            validate_quality_gate(&report, &manifest, GATE_ASSISTANT_QUALITY, None).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn quality_gate_rejects_pending_eval_template() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = validate_manifest_text(&report, &manifest).unwrap();
        let eval =
            build_eval_template_text(&report, &manifest, &manifest_fields, GATE_ASSISTANT_QUALITY)
                .unwrap();

        let error = validate_quality_gate(&report, &manifest, GATE_ASSISTANT_QUALITY, Some(&eval))
            .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn quality_gate_allows_converted_trained_with_passed_eval() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "converted-trained").unwrap();
        let eval = passing_eval_text(&report, &manifest, "converted-trained");

        validate_quality_gate(&report, &manifest, GATE_ASSISTANT_QUALITY, Some(&eval)).unwrap();
    }

    #[test]
    fn quality_gate_rejects_passed_eval_without_case_evidence() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "converted-trained").unwrap();
        let eval = passing_eval_text(&report, &manifest, "converted-trained")
            .lines()
            .filter(|line| {
                !line.starts_with("case_count=")
                    && !line.starts_with("cases_passed=")
                    && !line.starts_with("cases_failed=")
                    && !line.starts_with("case.0.")
            })
            .collect::<Vec<_>>()
            .join("\n");

        let error = validate_quality_gate(&report, &manifest, GATE_ASSISTANT_QUALITY, Some(&eval))
            .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn quality_gate_rejects_passed_eval_with_mismatched_case_text() {
        let report = fixture_report();
        let manifest = build_manifest_text(&report, "converted-trained").unwrap();
        let eval = passing_eval_text(&report, &manifest, "converted-trained")
            .replace("case.0.actual=e\n", "case.0.actual=x\n");

        let error = validate_quality_gate(&report, &manifest, GATE_ASSISTANT_QUALITY, Some(&eval))
            .unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    fn fixture_report() -> ValidationReport {
        let bytes = build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors(),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap();
        slm_validate::validate_bytes(&bytes, "memory.slm").unwrap()
    }

    fn passing_eval_text(report: &ValidationReport, manifest: &str, source_kind: &str) -> String {
        let mut text = String::new();
        push_line(
            &mut text,
            "tinyrustlm_eval_manifest_version",
            EVAL_MANIFEST_VERSION,
        );
        push_line(&mut text, "gate", GATE_ASSISTANT_QUALITY);
        push_line(&mut text, "source_kind", source_kind);
        push_line(
            &mut text,
            "manifest_checksum",
            &format!("0x{:016x}", text_checksum(manifest.as_bytes())),
        );
        push_line(
            &mut text,
            "slm_checksum",
            &format!("0x{:016x}", report.checksum()),
        );
        push_line(&mut text, "model_shape", &report.shape_summary());
        push_line(&mut text, "eval_status", "pass");
        push_line(&mut text, "task_eval_status", "pass");
        push_line(&mut text, "safety_review_status", "pass");
        push_line(
            &mut text,
            "quality_decision",
            "accepted-for-assistant-quality",
        );
        push_line(&mut text, "quality_scope", "tiny-fixture-runtime-eval-only");
        push_line(&mut text, "evaluator", "local-reviewed-eval");
        push_line(
            &mut text,
            "eval_dataset",
            "tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        );
        push_line(
            &mut text,
            "eval_summary",
            "Reviewed task and safety evidence passed for declared scope",
        );
        push_line(
            &mut text,
            "quality_boundary",
            "fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        );
        push_line(&mut text, "case_count", "1");
        push_line(&mut text, "cases_passed", "1");
        push_line(&mut text, "cases_failed", "0");
        push_line(&mut text, "case.0.status", "pass");
        push_line(&mut text, "case.0.expected", "e");
        push_line(&mut text, "case.0.actual", "e");
        push_line(&mut text, "case.0.error", "ok");
        text
    }
}
