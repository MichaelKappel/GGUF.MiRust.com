//! Browser selector registries built from admitted model-breeding records.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::Path;

use crate::admission;
use crate::provenance;

const REGISTRY_VERSION: &str = "1";
const REGISTRY_SCOPE: &str = "browser-local-model-selector";
const REGISTRY_STATUS: &str = "admitted-records-only";
const ENTRY_STATUS: &str = "admitted";
const PUBLIC_CLAIM_STATUS: &str = "bound-to-eval-scope";
const REQUIRED_NEXT_GATE: &str = "browser-loads-selector-registry-entry-models";

struct RegistryEntry {
    candidate_id: String,
    display_name: String,
    artifact_path: String,
    model_path: String,
    manifest_path: String,
    max_tokens: String,
    model_bytes: String,
    slm_checksum: String,
    model_shape: String,
    quantization: String,
    output_contract: String,
    admission_checksum: String,
    promotion_manifest_checksum: String,
    runtime_smoke_manifest_checksum: String,
    eval_manifest_checksum: String,
    quality_scope: String,
    quality_boundary: String,
    eval_dataset: String,
    cases_passed: String,
}

/// Writes a browser selector registry from one or more selector admission records.
pub(crate) fn write_registry_path(output: &Path, admission_paths: &[String]) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths)?;
    let registry = build_registry_text(&admission_texts)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, registry)?;
    println!("SLM selector registry written: {}", output.display());
    Ok(())
}

/// Validates a browser selector registry against its selector admission records.
pub(crate) fn validate_registry_path(
    registry: &Path,
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths)?;
    let registry_text = fs::read_to_string(registry)?;
    validate_registry_text(&registry_text, &admission_texts)?;
    println!("SLM selector registry validation: PASS");
    println!("registry: {}", registry.display());
    println!("admissions: {}", admission_paths.len());
    Ok(())
}

fn read_admissions(admission_paths: &[String]) -> io::Result<Vec<String>> {
    if admission_paths.is_empty() {
        return Err(invalid(
            "selector-registry requires at least one admission record",
        ));
    }
    admission_paths
        .iter()
        .map(|path| fs::read_to_string(Path::new(path)))
        .collect()
}

fn build_registry_text(admission_texts: &[String]) -> io::Result<String> {
    let entries = entries_from_admissions(admission_texts)?;
    let selector_id = selector_id(admission_texts)?;
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_selector_registry_version",
        REGISTRY_VERSION,
    );
    push_line(&mut text, "selector_id", &selector_id);
    push_line(&mut text, "registry_scope", REGISTRY_SCOPE);
    push_line(&mut text, "registry_status", REGISTRY_STATUS);
    push_line(&mut text, "entry_count", &entries.len().to_string());
    push_line(
        &mut text,
        "admission_set_checksum",
        &admission_set_checksum(admission_texts),
    );
    for (index, entry) in entries.iter().enumerate() {
        let prefix = format!("entry.{index}");
        push_line(
            &mut text,
            &format!("{prefix}.candidate_id"),
            &entry.candidate_id,
        );
        push_line(
            &mut text,
            &format!("{prefix}.display_name"),
            &entry.display_name,
        );
        push_line(
            &mut text,
            &format!("{prefix}.model_path"),
            &entry.model_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.manifest_path"),
            &entry.manifest_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.artifact_path"),
            &entry.artifact_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.max_tokens"),
            &entry.max_tokens,
        );
        push_line(
            &mut text,
            &format!("{prefix}.model_bytes"),
            &entry.model_bytes,
        );
        push_line(
            &mut text,
            &format!("{prefix}.slm_checksum"),
            &entry.slm_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.model_shape"),
            &entry.model_shape,
        );
        push_line(
            &mut text,
            &format!("{prefix}.quantization"),
            &entry.quantization,
        );
        push_line(
            &mut text,
            &format!("{prefix}.output_contract"),
            &entry.output_contract,
        );
        push_line(
            &mut text,
            &format!("{prefix}.admission_checksum"),
            &entry.admission_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.promotion_manifest_checksum"),
            &entry.promotion_manifest_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.runtime_smoke_manifest_checksum"),
            &entry.runtime_smoke_manifest_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.eval_manifest_checksum"),
            &entry.eval_manifest_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.quality_scope"),
            &entry.quality_scope,
        );
        push_line(
            &mut text,
            &format!("{prefix}.quality_boundary"),
            &entry.quality_boundary,
        );
        push_line(
            &mut text,
            &format!("{prefix}.eval_dataset"),
            &entry.eval_dataset,
        );
        push_line(
            &mut text,
            &format!("{prefix}.cases_passed"),
            &entry.cases_passed,
        );
        push_line(
            &mut text,
            &format!("{prefix}.selector_status"),
            ENTRY_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.public_claim_status"),
            PUBLIC_CLAIM_STATUS,
        );
    }
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

fn validate_registry_text(registry_text: &str, admission_texts: &[String]) -> io::Result<()> {
    let expected_text = build_registry_text(admission_texts)?;
    let expected = parse_manifest(&expected_text, "expected selector registry")?;
    let actual = parse_manifest(registry_text, "selector registry")?;
    require_equal(
        &actual,
        "tinyrustlm_selector_registry_version",
        REGISTRY_VERSION,
    )?;
    require_equal(&actual, "registry_scope", REGISTRY_SCOPE)?;
    require_equal(&actual, "registry_status", REGISTRY_STATUS)?;
    require_equal(&actual, "required_next_gate", REQUIRED_NEXT_GATE)?;
    for (key, expected_value) in &expected {
        require_equal(&actual, key, expected_value)?;
    }
    for key in actual.keys() {
        if !expected.contains_key(key) {
            return Err(invalid(&format!("unexpected selector registry key {key}")));
        }
    }
    Ok(())
}

fn entries_from_admissions(admission_texts: &[String]) -> io::Result<Vec<RegistryEntry>> {
    if admission_texts.is_empty() {
        return Err(invalid(
            "selector registry requires at least one admission record",
        ));
    }
    let selector_id = selector_id(admission_texts)?;
    let mut candidate_ids = HashSet::new();
    let mut slm_checksums = HashSet::new();
    let mut entries = Vec::with_capacity(admission_texts.len());
    for admission_text in admission_texts {
        let fields = admission::validate_record_summary_text(admission_text)?;
        let actual_selector = require_key(&fields, "selector_id")?;
        if actual_selector != selector_id {
            return Err(invalid(
                "selector registry admissions must share one selector_id",
            ));
        }
        let candidate_id = require_key(&fields, "candidate_id")?.to_string();
        if !candidate_ids.insert(candidate_id.clone()) {
            return Err(invalid(&format!(
                "duplicate selector registry candidate_id {candidate_id}"
            )));
        }
        let slm_checksum = require_key(&fields, "candidate_slm_checksum")?.to_string();
        if !slm_checksums.insert(slm_checksum.clone()) {
            return Err(invalid(&format!(
                "duplicate selector registry candidate checksum {slm_checksum}"
            )));
        }
        let artifact_path = require_key(&fields, "candidate_artifact_path")?.to_string();
        let model_path = browser_model_path(&artifact_path)?;
        let manifest_path = format!("{model_path}.manifest");
        let model_shape = require_key(&fields, "candidate_model_shape")?.to_string();
        entries.push(RegistryEntry {
            candidate_id: candidate_id.clone(),
            display_name: display_name(
                &candidate_id,
                require_key(&fields, "candidate_quantization")?,
            ),
            artifact_path,
            model_path,
            manifest_path,
            max_tokens: default_max_tokens(&model_shape).to_string(),
            model_bytes: require_key(&fields, "candidate_artifact_bytes")?.to_string(),
            slm_checksum,
            model_shape,
            quantization: require_key(&fields, "candidate_quantization")?.to_string(),
            output_contract: require_key(&fields, "candidate_output_contract")?.to_string(),
            admission_checksum: hex64(provenance::text_checksum(admission_text.as_bytes())),
            promotion_manifest_checksum: require_key(&fields, "promotion_manifest_checksum")?
                .to_string(),
            runtime_smoke_manifest_checksum: require_key(
                &fields,
                "runtime_smoke_manifest_checksum",
            )?
            .to_string(),
            eval_manifest_checksum: require_key(&fields, "eval_manifest_checksum")?.to_string(),
            quality_scope: require_key(&fields, "quality_scope")?.to_string(),
            quality_boundary: require_key(&fields, "quality_boundary")?.to_string(),
            eval_dataset: require_key(&fields, "eval_dataset")?.to_string(),
            cases_passed: require_key(&fields, "cases_passed")?.to_string(),
        });
    }
    Ok(entries)
}

fn selector_id(admission_texts: &[String]) -> io::Result<String> {
    let Some(first) = admission_texts.first() else {
        return Err(invalid(
            "selector registry requires at least one admission record",
        ));
    };
    let fields = admission::validate_record_summary_text(first)?;
    Ok(require_key(&fields, "selector_id")?.to_string())
}

fn browser_model_path(artifact_path: &str) -> io::Result<String> {
    let normalized = artifact_path.replace('\\', "/");
    if let Some(rest) = normalized.strip_prefix("../models/") {
        validate_model_route_rest(rest)?;
        return Ok(format!("../models/{rest}"));
    }
    if let Some(index) = normalized.find("tinyrustlm/models/") {
        let rest = &normalized[index + "tinyrustlm/models/".len()..];
        validate_model_route_rest(rest)?;
        return Ok(format!("../models/{rest}"));
    }
    Err(invalid(
        "selector registry entries must point at served tinyrustlm/models .slm artifacts",
    ))
}

fn validate_model_route_rest(rest: &str) -> io::Result<()> {
    if rest.is_empty()
        || !rest.ends_with(".slm")
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid("selector registry model route is invalid"));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid("selector registry model route is invalid"));
        }
    }
    Ok(())
}

fn default_max_tokens(model_shape: &str) -> usize {
    if model_shape.contains("hidden=16") {
        16
    } else {
        8
    }
}

fn display_name(candidate_id: &str, quantization: &str) -> String {
    format!("{candidate_id} {quantization}")
}

fn admission_set_checksum(admission_texts: &[String]) -> String {
    let mut source = String::new();
    for admission_text in admission_texts {
        push_line(
            &mut source,
            "admission_checksum",
            &hex64(provenance::text_checksum(admission_text.as_bytes())),
        );
    }
    hex64(provenance::text_checksum(source.as_bytes()))
}

fn parse_manifest(text: &str, label: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "{label} line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        validate_key(key, label, line_index + 1)?;
        if value.is_empty() || value.contains('\r') || value.contains('\n') {
            return Err(invalid(&format!("{label} key {key} has an invalid value")));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate {label} key {key}")));
        }
    }
    Ok(fields)
}

fn validate_key(key: &str, label: &str, line_number: usize) -> io::Result<()> {
    if key.is_empty()
        || !key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
    {
        return Err(invalid(&format!(
            "{label} line {line_number} has an invalid key"
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
            "selector registry key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_model_file;
    use crate::candidate;
    use crate::compatibility;
    use crate::lineage;
    use crate::promotion;
    use crate::slm_validate;
    use crate::tensor_writer::{tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_selector_registry_from_admission_record() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("registry_status=admitted-records-only"));
        assert!(registry.contains("entry.0.model_path=../models/tiny-q8.slm"));
        assert!(registry.contains("entry.0.selector_status=admitted"));
    }

    #[test]
    fn rejects_empty_registry_input() {
        let error = build_registry_text(&[]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("at least one admission"));
    }

    #[test]
    fn rejects_selector_id_mismatch() {
        let left = fixture_admission("candidate-a", "tinyrustlm/models/a.slm");
        let right = fixture_admission("candidate-b", "tinyrustlm/models/b.slm").replace(
            "selector_id=browser-local-selector",
            "selector_id=other-selector",
        );

        let error = build_registry_text(&[left, right]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_id"));
    }

    #[test]
    fn rejects_duplicate_candidate_id() {
        let left = fixture_admission("candidate-a", "tinyrustlm/models/a.slm");
        let right = fixture_admission("candidate-a", "tinyrustlm/models/b.slm");

        let error = build_registry_text(&[left, right]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("duplicate selector registry candidate_id"));
    }

    #[test]
    fn rejects_unserved_candidate_path() {
        let admission = fixture_admission("candidate-a", "target/admission-smoke/a.slm");

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("served tinyrustlm/models"));
    }

    #[test]
    fn rejects_registry_entry_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.selector_status=admitted",
            "entry.0.selector_status=pending",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_status"));
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str) -> String {
        let candidate = tiny_fixture_q8_bytes();
        let compatibility = compatibility::compatibility_text_for_bytes(
            &candidate,
            "left.slm",
            &candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, candidate_id, "operator-a", "fit")
                .unwrap();
        let candidate_manifest =
            candidate::build_manifest_text(&compatibility, &lineage, &candidate, candidate_path)
                .unwrap();
        let promotion = promotion::build_template_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(&candidate, candidate_path).unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest);
        admission::build_record_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            &promotion,
            &provenance_manifest,
            &runtime_smoke,
            &eval,
            admission::DEFAULT_ADMISSION_SELECTOR_ID,
        )
        .unwrap()
    }

    fn passing_eval_text(report: &slm_validate::ValidationReport, manifest: &str) -> String {
        let mut text = String::new();
        push_line(&mut text, "tinyrustlm_eval_manifest_version", "1");
        push_line(&mut text, "gate", "assistant-quality");
        push_line(&mut text, "source_kind", "converted-trained");
        push_line(
            &mut text,
            "manifest_checksum",
            &hex64(provenance::text_checksum(manifest.as_bytes())),
        );
        push_line(&mut text, "slm_checksum", &hex64(report.checksum()));
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

    fn tiny_fixture_q8_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
