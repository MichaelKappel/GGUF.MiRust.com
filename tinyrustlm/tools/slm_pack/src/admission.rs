//! Browser-selector admission records for evaluated model-breeding candidates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::candidate;
use crate::lineage;
use crate::promotion;
use crate::provenance;
use crate::slm_validate;

const ADMISSION_VERSION: &str = "1";
const DEFAULT_SELECTOR_ID: &str = "browser-local-selector";
const ADMISSION_STATUS: &str = "admitted-for-browser-selector";
const PROMOTION_STATUS: &str = "runtime-smoke-and-eval-passed";
const RUNTIME_SMOKE_STATUS: &str = "pass";
const EVAL_STATUS: &str = "pass";
const QUALITY_GATE: &str = "assistant-quality";
const PROMOTION_DECISION: &str = "accepted-for-browser-selector";
const BROWSER_SELECTOR_STATUS: &str = "admitted";
const PUBLIC_CLAIM_STATUS: &str = "bound-to-eval-scope";
const REQUIRED_NEXT_GATE: &str = "browser-selector-loads-only-admission-record-artifacts";

const PROMOTION_KEYS: [&str; 8] = [
    "candidate_id",
    "promotion_scope",
    "promoter_id",
    "operator_id",
    "operator_lane",
    "resource_budget",
    "compatibility_report_checksum",
    "lineage_manifest_checksum",
];

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

/// Default selector id used when the admission CLI caller omits one.
pub(crate) const DEFAULT_ADMISSION_SELECTOR_ID: &str = DEFAULT_SELECTOR_ID;

struct Evidence {
    promotion: HashMap<String, String>,
    eval: HashMap<String, String>,
}

/// Writes a browser-selector admission record after runtime-smoke and eval evidence pass.
pub(crate) fn write_record_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    promotion_manifest: &Path,
    provenance_manifest: &Path,
    runtime_smoke: &Path,
    eval_manifest: &Path,
    output: &Path,
    selector_id: &str,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion_manifest)?;
    let provenance_text = fs::read_to_string(provenance_manifest)?;
    let runtime_smoke_text = fs::read_to_string(runtime_smoke)?;
    let eval_text = fs::read_to_string(eval_manifest)?;
    let admission = build_record_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        &promotion_text,
        &provenance_text,
        &runtime_smoke_text,
        &eval_text,
        selector_id,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, admission)?;
    println!(
        "SLM selector admission record written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a browser-selector admission record against all model-breeding evidence.
pub(crate) fn validate_record_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    candidate_slm: &Path,
    candidate_manifest: &Path,
    promotion_manifest: &Path,
    provenance_manifest: &Path,
    runtime_smoke: &Path,
    eval_manifest: &Path,
    admission: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion_manifest)?;
    let provenance_text = fs::read_to_string(provenance_manifest)?;
    let runtime_smoke_text = fs::read_to_string(runtime_smoke)?;
    let eval_text = fs::read_to_string(eval_manifest)?;
    let admission_text = fs::read_to_string(admission)?;
    validate_record_text(
        &compatibility_text,
        &lineage_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &candidate_manifest_text,
        &promotion_text,
        &provenance_text,
        &runtime_smoke_text,
        &eval_text,
        &admission_text,
    )?;
    println!("SLM selector admission validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("admission: {}", admission.display());
    Ok(())
}

pub(crate) fn build_record_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    selector_id: &str,
) -> io::Result<String> {
    validate_slug(selector_id, "selector_id")?;
    let evidence = validate_evidence(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
    )?;

    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_selector_admission_version",
        ADMISSION_VERSION,
    );
    for key in PROMOTION_KEYS {
        push_line(&mut text, key, require_key(&evidence.promotion, key)?);
    }
    push_line(&mut text, "selector_id", selector_id);
    push_line(&mut text, "admission_status", ADMISSION_STATUS);
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        require_key(&evidence.promotion, "candidate_manifest_checksum")?,
    );
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &hex64(lineage::text_checksum(promotion_text.as_bytes())),
    );
    push_line(
        &mut text,
        "provenance_manifest_checksum",
        &hex64(provenance::text_checksum(provenance_text.as_bytes())),
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &hex64(provenance::text_checksum(runtime_smoke_text.as_bytes())),
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &hex64(provenance::text_checksum(eval_text.as_bytes())),
    );
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &provenance::eval_case_evidence_checksum(&evidence.eval)?,
    );
    for key in CANDIDATE_KEYS {
        push_line(&mut text, key, require_key(&evidence.promotion, key)?);
    }
    push_line(&mut text, "runtime_smoke_status", RUNTIME_SMOKE_STATUS);
    push_line(&mut text, "eval_status", EVAL_STATUS);
    push_line(&mut text, "quality_gate", QUALITY_GATE);
    push_line(
        &mut text,
        "quality_scope",
        require_key(&evidence.eval, "quality_scope")?,
    );
    push_line(
        &mut text,
        "quality_boundary",
        require_key(&evidence.eval, "quality_boundary")?,
    );
    push_line(
        &mut text,
        "eval_dataset",
        require_key(&evidence.eval, "eval_dataset")?,
    );
    push_line(
        &mut text,
        "case_count",
        require_key(&evidence.eval, "case_count")?,
    );
    push_line(
        &mut text,
        "cases_passed",
        require_key(&evidence.eval, "cases_passed")?,
    );
    push_line(
        &mut text,
        "cases_failed",
        require_key(&evidence.eval, "cases_failed")?,
    );
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

fn validate_record_text(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    admission_text: &str,
) -> io::Result<()> {
    let evidence = validate_evidence(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
    )?;
    let admission = parse_manifest(admission_text, "admission")?;
    require_equal(
        &admission,
        "tinyrustlm_selector_admission_version",
        ADMISSION_VERSION,
    )?;
    for key in PROMOTION_KEYS {
        require_equal(&admission, key, require_key(&evidence.promotion, key)?)?;
    }
    validate_slug(require_key(&admission, "selector_id")?, "selector_id")?;
    require_equal(&admission, "admission_status", ADMISSION_STATUS)?;
    require_equal(&admission, "promotion_status", PROMOTION_STATUS)?;
    require_equal(
        &admission,
        "candidate_manifest_checksum",
        require_key(&evidence.promotion, "candidate_manifest_checksum")?,
    )?;
    require_equal(
        &admission,
        "promotion_manifest_checksum",
        &hex64(lineage::text_checksum(promotion_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "provenance_manifest_checksum",
        &hex64(provenance::text_checksum(provenance_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "runtime_smoke_manifest_checksum",
        &hex64(provenance::text_checksum(runtime_smoke_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "eval_manifest_checksum",
        &hex64(provenance::text_checksum(eval_text.as_bytes())),
    )?;
    require_equal(
        &admission,
        "eval_case_evidence_checksum",
        &provenance::eval_case_evidence_checksum(&evidence.eval)?,
    )?;
    for key in CANDIDATE_KEYS {
        require_equal(&admission, key, require_key(&evidence.promotion, key)?)?;
    }
    require_equal(&admission, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&admission, "eval_status", EVAL_STATUS)?;
    require_equal(&admission, "quality_gate", QUALITY_GATE)?;
    require_equal(
        &admission,
        "quality_scope",
        require_key(&evidence.eval, "quality_scope")?,
    )?;
    require_equal(
        &admission,
        "quality_boundary",
        require_key(&evidence.eval, "quality_boundary")?,
    )?;
    require_equal(
        &admission,
        "eval_dataset",
        require_key(&evidence.eval, "eval_dataset")?,
    )?;
    require_equal(
        &admission,
        "case_count",
        require_key(&evidence.eval, "case_count")?,
    )?;
    require_equal(
        &admission,
        "cases_passed",
        require_key(&evidence.eval, "cases_passed")?,
    )?;
    require_equal(
        &admission,
        "cases_failed",
        require_key(&evidence.eval, "cases_failed")?,
    )?;
    require_equal(&admission, "promotion_decision", PROMOTION_DECISION)?;
    require_equal(
        &admission,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    )?;
    require_equal(&admission, "public_claim_status", PUBLIC_CLAIM_STATUS)?;
    require_equal(&admission, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(())
}

/// Validates the self-contained selector-facing fields in an admission record.
pub(crate) fn validate_record_summary_text(
    admission_text: &str,
) -> io::Result<HashMap<String, String>> {
    let admission = parse_manifest(admission_text, "admission")?;
    require_equal(
        &admission,
        "tinyrustlm_selector_admission_version",
        ADMISSION_VERSION,
    )?;
    for key in PROMOTION_KEYS {
        require_key(&admission, key)?;
    }
    validate_slug(require_key(&admission, "selector_id")?, "selector_id")?;
    require_equal(&admission, "admission_status", ADMISSION_STATUS)?;
    require_equal(&admission, "promotion_status", PROMOTION_STATUS)?;
    for key in [
        "candidate_manifest_checksum",
        "promotion_manifest_checksum",
        "provenance_manifest_checksum",
        "runtime_smoke_manifest_checksum",
        "eval_manifest_checksum",
        "eval_case_evidence_checksum",
    ] {
        require_hex64(&admission, key)?;
    }
    for key in CANDIDATE_KEYS {
        require_key(&admission, key)?;
    }
    require_positive_usize(&admission, "candidate_artifact_bytes")?;
    require_positive_usize(&admission, "candidate_slm_version")?;
    require_hex64(&admission, "candidate_slm_checksum")?;
    require_positive_usize(&admission, "candidate_tensor_count")?;
    require_positive_usize(&admission, "candidate_parameter_count")?;
    require_hex64(&admission, "candidate_tokenizer_checksum")?;
    require_hex64(&admission, "candidate_tensor_layout_checksum")?;
    require_equal(&admission, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&admission, "eval_status", EVAL_STATUS)?;
    require_equal(&admission, "quality_gate", QUALITY_GATE)?;
    for key in ["quality_scope", "quality_boundary", "eval_dataset"] {
        require_key(&admission, key)?;
    }
    let case_count = require_positive_usize(&admission, "case_count")?;
    let cases_passed = require_usize(&admission, "cases_passed")?;
    let cases_failed = require_usize(&admission, "cases_failed")?;
    if cases_passed != case_count || cases_failed != 0 {
        return Err(invalid(
            "admission case totals must show every declared case passed and zero failed cases",
        ));
    }
    require_equal(&admission, "promotion_decision", PROMOTION_DECISION)?;
    require_equal(
        &admission,
        "browser_selector_status",
        BROWSER_SELECTOR_STATUS,
    )?;
    require_equal(&admission, "public_claim_status", PUBLIC_CLAIM_STATUS)?;
    require_equal(&admission, "required_next_gate", REQUIRED_NEXT_GATE)?;
    Ok(admission)
}

fn validate_evidence(
    compatibility_text: &str,
    lineage_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
) -> io::Result<Evidence> {
    candidate::validate_manifest_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
    )?;
    promotion::validate_text(
        compatibility_text,
        lineage_text,
        candidate_bytes,
        candidate_path,
        candidate_manifest_text,
        promotion_text,
    )?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    let runtime_smoke =
        provenance::validate_runtime_smoke_text(&report, provenance_text, runtime_smoke_text)?;
    provenance::validate_quality_gate(&report, provenance_text, QUALITY_GATE, Some(eval_text))?;
    let promotion = parse_manifest(promotion_text, "promotion")?;
    let eval = provenance::parse_manifest(eval_text)?;
    require_equal(&runtime_smoke, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&eval, "eval_status", EVAL_STATUS)?;
    require_equal(&eval, "task_eval_status", EVAL_STATUS)?;
    require_equal(&eval, "cases_failed", "0")?;
    Ok(Evidence { promotion, eval })
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

fn require_hex64(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    let Some(hex) = value.strip_prefix("0x") else {
        return Err(invalid(&format!(
            "manifest key {key} must be a hex checksum"
        )));
    };
    if hex.len() != 16 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!(
            "manifest key {key} must be a hex checksum"
        )));
    }
    Ok(())
}

fn require_positive_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    let value = require_usize(fields, key)?;
    if value == 0 {
        return Err(invalid(&format!(
            "manifest key {key} must be greater than zero"
        )));
    }
    Ok(value)
}

fn require_usize(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    let value = require_key(fields, key)?;
    value
        .parse::<usize>()
        .map_err(|_| invalid(&format!("manifest key {key} must be a usize")))
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
    use crate::tensor_writer::{tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_selector_admission_record() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission();

        validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap();
        assert!(admission.contains("admission_status=admitted-for-browser-selector"));
        assert!(admission.contains("eval_case_evidence_checksum=0x"));
        assert!(admission.contains("browser_selector_status=admitted"));
        assert!(admission.contains("public_claim_status=bound-to-eval-scope"));
    }

    #[test]
    fn rejects_runtime_smoke_drift() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission();
        let changed_smoke = fixture.runtime_smoke.replace(
            "runtime_smoke_decision=accepted-for-runtime-smoke",
            "runtime_smoke_decision=pending",
        );

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &changed_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("runtime_smoke_decision"));
    }

    #[test]
    fn rejects_eval_manifest_drift() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission();
        let changed_eval = fixture
            .eval
            .replace("case.0.actual=e\n", "case.0.actual=x\n");

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &changed_eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("actual text did not match"));
    }

    #[test]
    fn rejects_admission_overclaim() {
        let fixture = AdmissionFixture::new();
        let admission = fixture.admission().replace(
            "public_claim_status=bound-to-eval-scope",
            "public_claim_status=unbounded",
        );

        let error = validate_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("public_claim_status"));
    }

    #[test]
    fn rejects_invalid_selector_id() {
        let fixture = AdmissionFixture::new();

        let error = build_record_text(
            &fixture.compatibility,
            &fixture.lineage,
            &fixture.candidate,
            "candidate.slm",
            &fixture.candidate_manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            "bad selector",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_id"));
    }

    #[test]
    fn summary_rejects_incomplete_case_totals() {
        let fixture = AdmissionFixture::new();
        let admission = fixture
            .admission()
            .replace("cases_passed=1", "cases_passed=0");

        let error = validate_record_summary_text(&admission).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("case totals"));
    }

    struct AdmissionFixture {
        compatibility: String,
        lineage: String,
        candidate: Vec<u8>,
        candidate_manifest: String,
        promotion: String,
        provenance_manifest: String,
        runtime_smoke: String,
        eval: String,
    }

    impl AdmissionFixture {
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
            let promotion = promotion::build_template_text(
                &compatibility,
                &lineage,
                &candidate,
                "candidate.slm",
                &candidate_manifest,
                "local-smoke-runner",
                promotion::DEFAULT_PROMOTION_SCOPE,
            )
            .unwrap();
            let report = slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
            let provenance_manifest =
                provenance::build_manifest_text(&report, "converted-trained").unwrap();
            let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
            let runtime_smoke = provenance::build_runtime_smoke_text(
                &report,
                &provenance_manifest,
                &manifest_fields,
            )
            .unwrap();
            let eval = passing_eval_text(&report, &provenance_manifest);
            Self {
                compatibility,
                lineage,
                candidate,
                candidate_manifest,
                promotion,
                provenance_manifest,
                runtime_smoke,
                eval,
            }
        }

        fn admission(&self) -> String {
            build_record_text(
                &self.compatibility,
                &self.lineage,
                &self.candidate,
                "candidate.slm",
                &self.candidate_manifest,
                &self.promotion,
                &self.provenance_manifest,
                &self.runtime_smoke,
                &self.eval,
                DEFAULT_SELECTOR_ID,
            )
            .unwrap()
        }
    }

    fn passing_eval_text(report: &slm_validate::ValidationReport, manifest: &str) -> String {
        let mut text = String::new();
        push_line(&mut text, "tinyrustlm_eval_manifest_version", "1");
        push_line(&mut text, "gate", QUALITY_GATE);
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
