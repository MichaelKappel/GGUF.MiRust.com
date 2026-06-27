//! Candidate artifact manifests for offline model-breeding output gates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::lineage;
use crate::slm_validate::{self, ValidationReport};

const CANDIDATE_ARTIFACT_VERSION: &str = "1";
const ARTIFACT_KIND_SLM: &str = "slm";
const CANDIDATE_STATUS_ARTIFACT_WRITTEN: &str = "artifact-written";
const CANDIDATE_ARTIFACT_STATUS: &str = "written";
const CANDIDATE_ADMISSION_STATUS: &str = "slm-validated";
const CANDIDATE_PARENT_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const CANDIDATE_EVAL_STATUS: &str = "pending";
const REQUIRED_NEXT_GATE: &str = "candidate-runtime-smoke-plus-eval-plus-provenance-promotion";

const PARENT_KEYS: [&str; 9] = [
    "path",
    "slm_checksum",
    "model_shape",
    "tensor_count",
    "parameter_count",
    "quantization",
    "output_contract",
    "tokenizer_checksum",
    "tensor_layout_checksum",
];

/// Writes a candidate artifact manifest bound to compatibility, lineage, and a validated `.slm`.
pub(crate) fn write_manifest_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    output: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let manifest = build_manifest_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, manifest)?;
    println!(
        "SLM candidate artifact manifest written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a candidate artifact manifest against compatibility, lineage, and a `.slm`.
pub(crate) fn validate_manifest_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_manifest_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &manifest_text,
    )?;
    println!("SLM candidate artifact validation: PASS");
    println!("lineage: {}", lineage_manifest.display());
    println!("candidate: {}", candidate_slm.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

/// Builds a candidate artifact manifest bound to compatibility, lineage, and `.slm` bytes.
pub(crate) fn build_manifest_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
) -> io::Result<String> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    validate_candidate_contract(&lineage_fields, &report)?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_candidate_artifact_version",
        CANDIDATE_ARTIFACT_VERSION,
    );
    push_line(
        &mut text,
        "candidate_id",
        require_key(&lineage_fields, "candidate_id")?,
    );
    push_line(
        &mut text,
        "candidate_status",
        CANDIDATE_STATUS_ARTIFACT_WRITTEN,
    );
    push_line(&mut text, "artifact_kind", ARTIFACT_KIND_SLM);
    push_line(
        &mut text,
        "operator_id",
        require_key(&lineage_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(&lineage_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(&lineage_fields, "resource_budget")?,
    );
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(&lineage_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    );
    push_line(
        &mut text,
        "compatibility_scope",
        require_key(&lineage_fields, "compatibility_scope")?,
    );
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, &lineage_fields, 0)?;
    push_parent_lines(&mut text, &lineage_fields, 1)?;
    push_candidate_lines(&mut text, &report);
    push_line(
        &mut text,
        "candidate_artifact_status",
        CANDIDATE_ARTIFACT_STATUS,
    );
    push_line(
        &mut text,
        "candidate_admission_status",
        CANDIDATE_ADMISSION_STATUS,
    );
    push_line(
        &mut text,
        "candidate_parent_contract",
        CANDIDATE_PARENT_CONTRACT,
    );
    push_line(&mut text, "candidate_eval_status", CANDIDATE_EVAL_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

/// Validates candidate artifact manifest text against compatibility, lineage, and `.slm` bytes.
pub(crate) fn validate_manifest_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    manifest_text: &str,
) -> io::Result<()> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let manifest = parse_manifest(manifest_text, "candidate artifact manifest")?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    validate_candidate_contract(&lineage_fields, &report)?;

    require_equal(
        &manifest,
        "tinyrustlm_candidate_artifact_version",
        CANDIDATE_ARTIFACT_VERSION,
    )?;
    require_equal(
        &manifest,
        "candidate_id",
        require_key(&lineage_fields, "candidate_id")?,
    )?;
    require_equal(
        &manifest,
        "candidate_status",
        CANDIDATE_STATUS_ARTIFACT_WRITTEN,
    )?;
    require_equal(&manifest, "artifact_kind", ARTIFACT_KIND_SLM)?;
    require_equal(
        &manifest,
        "operator_id",
        require_key(&lineage_fields, "operator_id")?,
    )?;
    require_equal(
        &manifest,
        "operator_lane",
        require_key(&lineage_fields, "operator_lane")?,
    )?;
    require_equal(
        &manifest,
        "resource_budget",
        require_key(&lineage_fields, "resource_budget")?,
    )?;
    require_equal(
        &manifest,
        "compatibility_report_checksum",
        require_key(&lineage_fields, "compatibility_report_checksum")?,
    )?;
    require_equal(
        &manifest,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    )?;
    require_equal(
        &manifest,
        "compatibility_scope",
        require_key(&lineage_fields, "compatibility_scope")?,
    )?;
    require_equal(&manifest, "parent_count", "2")?;
    require_parent_lines(&lineage_fields, &manifest, 0)?;
    require_parent_lines(&lineage_fields, &manifest, 1)?;
    require_candidate_lines(&manifest, &report)?;
    require_equal(
        &manifest,
        "candidate_artifact_status",
        CANDIDATE_ARTIFACT_STATUS,
    )?;
    require_equal(
        &manifest,
        "candidate_admission_status",
        CANDIDATE_ADMISSION_STATUS,
    )?;
    require_equal(
        &manifest,
        "candidate_parent_contract",
        CANDIDATE_PARENT_CONTRACT,
    )?;
    require_equal(&manifest, "candidate_eval_status", CANDIDATE_EVAL_STATUS)?;
    require_equal(&manifest, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

fn validate_candidate_contract(
    lineage_fields: &HashMap<String, String>,
    report: &ValidationReport,
) -> io::Result<()> {
    require_report_equal(
        lineage_fields,
        "parent.0.model_shape",
        &report.shape_summary(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.tensor_count",
        &report.tensor_count().to_string(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.parameter_count",
        &report.parameter_count().to_string(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.quantization",
        report.quantization_label(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.output_contract",
        report.output_contract_label(),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    )?;
    require_report_equal(
        lineage_fields,
        "parent.0.tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    )?;
    Ok(())
}

fn push_parent_lines(
    text: &mut String,
    lineage_fields: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let full_key = format!("parent.{index}.{key}");
        push_line(text, &full_key, require_key(lineage_fields, &full_key)?);
    }
    Ok(())
}

fn require_parent_lines(
    lineage_fields: &HashMap<String, String>,
    manifest: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let full_key = format!("parent.{index}.{key}");
        require_equal(manifest, &full_key, require_key(lineage_fields, &full_key)?)?;
    }
    Ok(())
}

fn push_candidate_lines(text: &mut String, report: &ValidationReport) {
    push_line(text, "candidate_artifact_path", report.path());
    push_line(
        text,
        "candidate_artifact_bytes",
        &report.file_bytes().to_string(),
    );
    push_line(
        text,
        "candidate_slm_version",
        &report.slm_version().to_string(),
    );
    push_line(text, "candidate_slm_checksum", &hex64(report.checksum()));
    push_line(text, "candidate_model_shape", &report.shape_summary());
    push_line(
        text,
        "candidate_tensor_count",
        &report.tensor_count().to_string(),
    );
    push_line(
        text,
        "candidate_parameter_count",
        &report.parameter_count().to_string(),
    );
    push_line(text, "candidate_quantization", report.quantization_label());
    push_line(
        text,
        "candidate_output_contract",
        report.output_contract_label(),
    );
    push_line(
        text,
        "candidate_tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    );
    push_line(
        text,
        "candidate_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    );
}

fn require_candidate_lines(
    manifest: &HashMap<String, String>,
    report: &ValidationReport,
) -> io::Result<()> {
    require_equal(manifest, "candidate_artifact_path", report.path())?;
    require_equal(
        manifest,
        "candidate_artifact_bytes",
        &report.file_bytes().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_slm_version",
        &report.slm_version().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_slm_checksum",
        &hex64(report.checksum()),
    )?;
    require_equal(manifest, "candidate_model_shape", &report.shape_summary())?;
    require_equal(
        manifest,
        "candidate_tensor_count",
        &report.tensor_count().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_parameter_count",
        &report.parameter_count().to_string(),
    )?;
    require_equal(
        manifest,
        "candidate_quantization",
        report.quantization_label(),
    )?;
    require_equal(
        manifest,
        "candidate_output_contract",
        report.output_contract_label(),
    )?;
    require_equal(
        manifest,
        "candidate_tokenizer_checksum",
        &hex64(report.tokenizer_checksum()),
    )?;
    require_equal(
        manifest,
        "candidate_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    )?;
    Ok(())
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
        validate_value(value, key)?;
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

fn validate_value(value: &str, key: &str) -> io::Result<()> {
    if value.is_empty() || value.contains('\n') || value.contains('\r') {
        return Err(invalid(&format!("{key} has an invalid value")));
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

fn require_report_equal(
    fields: &HashMap<String, String>,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "candidate artifact contract expected {key} {actual}, candidate had {expected}"
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
    use crate::compatibility;
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_candidate_artifact_manifest() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();

        let manifest =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap();

        validate_manifest_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap();
        assert!(manifest.contains("candidate_status=artifact-written"));
        assert!(manifest.contains("candidate_admission_status=slm-validated"));
        assert!(
            manifest.contains("candidate_parent_contract=matches-parent-direct-parameter-contract")
        );
        assert!(manifest.contains(
            "required_next_gate=candidate-runtime-smoke-plus-eval-plus-provenance-promotion"
        ));
    }

    #[test]
    fn rejects_candidate_artifact_that_breaks_parent_contract() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_f32_bytes();

        let error =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate artifact contract"));
    }

    #[test]
    fn validation_rejects_lineage_checksum_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let manifest =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap();
        let changed_lineage = format!("{lineage}# checksum-affecting note\n");

        let error = validate_manifest_text(
            &compatibility,
            &changed_lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("lineage_manifest_checksum"));
    }

    #[test]
    fn validation_rejects_candidate_artifact_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let manifest =
            build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm").unwrap();
        let changed_candidate = tiny_fixture_f32_bytes();

        let error = validate_manifest_text(
            &compatibility,
            &lineage,
            &changed_candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate artifact contract"));
    }

    #[test]
    fn validation_rejects_manifest_field_drift() {
        let compatibility = passing_compatibility_text();
        let lineage = lineage_text(&compatibility);
        let candidate = tiny_fixture_q8_bytes();
        let manifest = build_manifest_text(&compatibility, &lineage, &candidate, "candidate.slm")
            .unwrap()
            .replace(
                "candidate_eval_status=pending",
                "candidate_eval_status=pass",
            );

        let error = validate_manifest_text(
            &compatibility,
            &lineage,
            &candidate,
            "candidate.slm",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_eval_status"));
    }

    fn passing_compatibility_text() -> String {
        let left = tiny_fixture_q8_bytes();
        let right = tiny_fixture_q8_bytes();
        compatibility::compatibility_text_for_bytes(&left, "left.slm", &right, "right.slm").unwrap()
    }

    fn lineage_text(compatibility: &str) -> String {
        lineage::build_template_text(compatibility, "tiny-q8-candidate", "operator-a", "fit")
            .unwrap()
    }

    fn tiny_fixture_q8_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }

    fn tiny_fixture_f32_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_F32),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
