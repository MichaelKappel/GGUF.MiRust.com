//! Candidate promotion sidecars for runtime-smoke and eval handoff.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::candidate;
use crate::lineage;

const PROMOTION_VERSION: &str = "1";
const PROMOTION_STATUS: &str = "pending-runtime-smoke-and-eval";
/// Default promotion scope recorded by promotion templates when the CLI caller omits one.
pub(crate) const DEFAULT_PROMOTION_SCOPE: &str = "browser-local-runtime-smoke-and-eval";
const RUNTIME_SMOKE_STATUS: &str = "pending";
const EVAL_STATUS: &str = "pending";
const PROMOTION_DECISION: &str = "pending";
const BROWSER_SELECTOR_STATUS: &str = "not-admitted";
const PUBLIC_CLAIM_STATUS: &str = "not-admitted";
const REQUIRED_NEXT_GATE: &str = "run-runtime-smoke-and-eval-sidecars-before-browser-selector";

const CANDIDATE_KEYS: [&str; 11] = [
    "candidate_artifact_path",
    "candidate_artifact_bytes",
    "candidate_slm_version",
    "candidate_slm_checksum",
    "candidate_model_shape",
    "candidate_tensor_count",
    "candidate_parameter_count",
    "candidate_quantization",
    "candidate_output_contract",
    "candidate_tokenizer_checksum",
    "candidate_tensor_layout_checksum",
];

/// Writes a candidate promotion template from validated candidate artifact inputs.
pub(crate) fn write_template_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    output: &Path,
    promoter_id: &str,
    promotion_scope: &str,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = build_template_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        promoter_id,
        promotion_scope,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, promotion_text)?;
    println!(
        "SLM candidate promotion template written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a candidate promotion sidecar against compatibility, lineage, candidate, and manifest.
pub(crate) fn validate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    promotion: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion)?;
    validate_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        &promotion_text,
    )?;
    println!("SLM candidate promotion validation: PASS");
    println!("candidate_manifest: {}", candidate_manifest.display());
    println!("promotion: {}", promotion.display());
    Ok(())
}

pub(crate) fn build_template_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promoter_id: &str,
    promotion_scope: &str,
) -> io::Result<String> {
    candidate::validate_manifest_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
    )?;
    validate_slug(promoter_id, "promoter_id")?;
    validate_value(promotion_scope, "promotion_scope")?;
    let candidate_fields = parse_manifest(candidate_manifest_text, "candidate artifact manifest")?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_candidate_promotion_version",
        PROMOTION_VERSION,
    );
    push_line(
        &mut text,
        "candidate_id",
        require_key(&candidate_fields, "candidate_id")?,
    );
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    push_line(&mut text, "promoter_id", promoter_id);
    push_line(&mut text, "promotion_scope", promotion_scope);
    push_line(
        &mut text,
        "operator_id",
        require_key(&candidate_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(&candidate_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(&candidate_fields, "resource_budget")?,
    );
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(&candidate_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        require_key(&candidate_fields, "lineage_manifest_checksum")?,
    );
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        &hex64(lineage::text_checksum(candidate_manifest_text.as_bytes())),
    );
    push_candidate_lines(&mut text, &candidate_fields)?;
    push_line(
        &mut text,
        "candidate_admission_status",
        require_key(&candidate_fields, "candidate_admission_status")?,
    );
    push_line(
        &mut text,
        "candidate_parent_contract",
        require_key(&candidate_fields, "candidate_parent_contract")?,
    );
    push_line(&mut text, "runtime_smoke_status", RUNTIME_SMOKE_STATUS);
    push_line(&mut text, "eval_status", EVAL_STATUS);
    push_line(&mut text, "promotion_decision", PROMOTION_DECISION);
    push_line(
        &mut text,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    );
    push_line(&mut text, "public_claim_status", PUBLIC_CLAIM_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

pub(crate) fn validate_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
) -> io::Result<()> {
    candidate::validate_manifest_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
    )?;
    let candidate_fields = parse_manifest(candidate_manifest_text, "candidate artifact manifest")?;
    let promotion = parse_manifest(promotion_text, "promotion")?;
    require_equal(
        &promotion,
        "tinyrustlm_candidate_promotion_version",
        PROMOTION_VERSION,
    )?;
    require_equal(
        &promotion,
        "candidate_id",
        require_key(&candidate_fields, "candidate_id")?,
    )?;
    require_equal(&promotion, "promotion_status", PROMOTION_STATUS)?;
    validate_slug(require_key(&promotion, "promoter_id")?, "promoter_id")?;
    validate_value(
        require_key(&promotion, "promotion_scope")?,
        "promotion_scope",
    )?;
    require_equal(
        &promotion,
        "operator_id",
        require_key(&candidate_fields, "operator_id")?,
    )?;
    require_equal(
        &promotion,
        "operator_lane",
        require_key(&candidate_fields, "operator_lane")?,
    )?;
    require_equal(
        &promotion,
        "resource_budget",
        require_key(&candidate_fields, "resource_budget")?,
    )?;
    require_equal(
        &promotion,
        "compatibility_report_checksum",
        require_key(&candidate_fields, "compatibility_report_checksum")?,
    )?;
    require_equal(
        &promotion,
        "lineage_manifest_checksum",
        require_key(&candidate_fields, "lineage_manifest_checksum")?,
    )?;
    require_equal(
        &promotion,
        "candidate_manifest_checksum",
        &hex64(lineage::text_checksum(candidate_manifest_text.as_bytes())),
    )?;
    require_candidate_lines(&candidate_fields, &promotion)?;
    require_equal(
        &promotion,
        "candidate_admission_status",
        require_key(&candidate_fields, "candidate_admission_status")?,
    )?;
    require_equal(
        &promotion,
        "candidate_parent_contract",
        require_key(&candidate_fields, "candidate_parent_contract")?,
    )?;
    require_equal(&promotion, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&promotion, "eval_status", EVAL_STATUS)?;
    require_equal(&promotion, "promotion_decision", PROMOTION_DECISION)?;
    require_equal(
        &promotion,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    )?;
    require_equal(&promotion, "public_claim_status", PUBLIC_CLAIM_STATUS)?;
    require_equal(&promotion, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

fn push_candidate_lines(
    text: &mut String,
    candidate_fields: &HashMap<String, String>,
) -> io::Result<()> {
    for key in CANDIDATE_KEYS {
        push_line(text, key, require_key(candidate_fields, key)?);
    }
    Ok(())
}

fn require_candidate_lines(
    candidate_fields: &HashMap<String, String>,
    promotion: &HashMap<String, String>,
) -> io::Result<()> {
    for key in CANDIDATE_KEYS {
        require_equal(promotion, key, require_key(candidate_fields, key)?)?;
    }
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

fn validate_slug(value: &str, key: &str) -> io::Result<()> {
    validate_value(value, key)?;
    if value.len() > 96
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(invalid(&format!("{key} must be an ASCII slug")));
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
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_promotion_template() {
        let fixture = PromotionFixture::new();

        let promotion = build_template_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            "local-smoke-runner",
            DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();

        validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &promotion,
        )
        .unwrap();
        assert!(promotion.contains("promotion_status=pending-runtime-smoke-and-eval"));
        assert!(promotion.contains("runtime_smoke_status=pending"));
        assert!(promotion.contains("browser_selector_status=not-admitted"));
    }

    #[test]
    fn validation_rejects_candidate_manifest_checksum_drift() {
        let fixture = PromotionFixture::new();
        let promotion = fixture.promotion();
        let changed_manifest = format!("{}# checksum-affecting note\n", fixture.candidate_manifest);

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &changed_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate_manifest_checksum"));
    }

    #[test]
    fn validation_rejects_candidate_artifact_drift() {
        let fixture = PromotionFixture::new();
        let promotion = fixture.promotion();
        let changed_candidate = tiny_fixture_f32_bytes();

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &changed_candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate artifact contract"));
    }

    #[test]
    fn validation_rejects_promotion_overclaim() {
        let fixture = PromotionFixture::new();
        let promotion = fixture
            .promotion()
            .replace("promotion_decision=pending", "promotion_decision=accepted");

        let error = validate_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &promotion,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("promotion_decision"));
    }

    #[test]
    fn rejects_invalid_promoter_id() {
        let fixture = PromotionFixture::new();

        let error = build_template_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            "bad promoter",
            DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("promoter_id"));
    }

    struct PromotionFixture {
        compatibility: String,
        lineage: String,
        candidate: Vec<u8>,
        candidate_manifest: String,
    }

    impl PromotionFixture {
        fn new() -> Self {
            let candidate = tiny_fixture_q8_bytes();
            let compatibility = compatibility::compatibility_text_for_bytes(
                &candidate,
                "left.slm",
                &candidate,
                "right.slm",
            )
            .unwrap();
            let lineage = lineage::build_template_text(
                &compatibility,
                "tiny-q8-candidate",
                "operator-a",
                "fit",
            )
            .unwrap();
            let candidate_manifest = candidate::build_manifest_text(
                &compatibility,
                &lineage,
                &candidate,
                "candidate.slm",
            )
            .unwrap();
            Self {
                compatibility,
                lineage,
                candidate,
                candidate_manifest,
            }
        }

        fn promotion(&self) -> String {
            build_template_text(
                &self.compatibility,
                &self.lineage,
                &self.candidate,
                "candidate.slm",
                &self.candidate_manifest,
                "local-smoke-runner",
                DEFAULT_PROMOTION_SCOPE,
            )
            .unwrap()
        }
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
