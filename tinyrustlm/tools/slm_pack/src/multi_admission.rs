//! Selector-admission records for evaluated multi-parent sign-merge candidates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::admission;
use crate::blend::{hex64, invalid, parse_manifest, push_line, require_equal, require_key};
use crate::multi_promotion;
use crate::provenance;
use crate::slm_validate;

const ADMISSION_VERSION: &str = "1";
const ADMISSION_KIND: &str = "multi-parent-sign-merge";
const ADMISSION_STATUS: &str = "admitted-for-browser-selector";
const PROMOTION_STATUS: &str = "runtime-smoke-and-eval-passed";
const RUNTIME_SMOKE_STATUS: &str = "pass";
const EVAL_STATUS: &str = "pass";
const QUALITY_GATE: &str = "assistant-quality";
const PROMOTION_DECISION: &str = "accepted-for-browser-selector";
const BROWSER_SELECTOR_STATUS: &str = "admitted";
const PUBLIC_CLAIM_STATUS: &str = "bound-to-eval-scope";
const REQUIRED_NEXT_GATE: &str = "multi-parent-selector-registry-route-binding";

const PROMOTION_KEYS: [&str; 11] = [
    "promotion_kind",
    "promoter_id",
    "promotion_scope",
    "operator_receipt_checksum",
    "parent_pool_recipe_checksum",
    "population_review_checksum",
    "promotion_ledger_checksum",
    "admission_set_checksum",
    "frontier_candidate_id",
    "frontier_candidate_slm_checksum",
    "parent_count",
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

struct Evidence {
    promotion: HashMap<String, String>,
    eval: HashMap<String, String>,
}

/// Writes a selector-admission record for a validated multi-parent candidate.
pub(crate) fn write_record_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    candidate_manifest: &Path,
    promotion_manifest: &Path,
    provenance_manifest: &Path,
    runtime_smoke: &Path,
    eval_manifest: &Path,
    output: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(admission_paths, "multi-parent-admission admissions")?;
    let parent_bytes = read_bytes(parent_paths, "multi-parent-admission parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion_manifest)?;
    let provenance_text = fs::read_to_string(provenance_manifest)?;
    let runtime_smoke_text = fs::read_to_string(runtime_smoke)?;
    let eval_text = fs::read_to_string(eval_manifest)?;
    let admission = build_record_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
        &candidate_manifest_text,
        &promotion_text,
        &provenance_text,
        &runtime_smoke_text,
        &eval_text,
        &admission_texts,
        admission::DEFAULT_ADMISSION_SELECTOR_ID,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, admission)?;
    println!(
        "SLM multi-parent selector admission record written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a multi-parent selector-admission record against its evidence chain.
pub(crate) fn validate_record_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    candidate_manifest: &Path,
    promotion_manifest: &Path,
    provenance_manifest: &Path,
    runtime_smoke: &Path,
    eval_manifest: &Path,
    admission: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(
        admission_paths,
        "validate-multi-parent-admission admissions",
    )?;
    let parent_bytes = read_bytes(parent_paths, "validate-multi-parent-admission parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion_manifest)?;
    let provenance_text = fs::read_to_string(provenance_manifest)?;
    let runtime_smoke_text = fs::read_to_string(runtime_smoke)?;
    let eval_text = fs::read_to_string(eval_manifest)?;
    let admission_text = fs::read_to_string(admission)?;
    validate_record_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
        &candidate_manifest_text,
        &promotion_text,
        &provenance_text,
        &runtime_smoke_text,
        &eval_text,
        &admission_texts,
        &admission_text,
    )?;
    println!("SLM multi-parent selector admission validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("admission: {}", admission.display());
    Ok(())
}

fn read_texts(paths: &[String], label: &str) -> io::Result<Vec<String>> {
    if paths.is_empty() {
        return Err(invalid(&format!("{label} require at least one input")));
    }
    paths
        .iter()
        .map(|path| fs::read_to_string(Path::new(path)))
        .collect()
}

fn read_bytes(paths: &[String], label: &str) -> io::Result<Vec<(String, Vec<u8>)>> {
    if paths.len() < 2 {
        return Err(invalid(&format!(
            "{label} require at least two parent models"
        )));
    }
    paths
        .iter()
        .map(|path| Ok((path.clone(), fs::read(Path::new(path))?)))
        .collect()
}

pub(crate) fn build_record_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    admission_texts: &[String],
    selector_id: &str,
) -> io::Result<String> {
    validate_slug(selector_id, "selector_id")?;
    let evidence = validate_evidence(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        admission_texts,
    )?;
    render_record_text(
        &evidence,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        selector_id,
    )
}

fn validate_record_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    admission_texts: &[String],
    admission_text: &str,
) -> io::Result<()> {
    let evidence = validate_evidence(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        candidate_manifest_text,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        admission_texts,
    )?;
    let admission = validate_record_summary_text(admission_text)?;
    let selector_id = require_key(&admission, "selector_id")?;
    let expected = render_record_text(
        &evidence,
        promotion_text,
        provenance_text,
        runtime_smoke_text,
        eval_text,
        selector_id,
    )?;
    if admission_text != expected {
        return Err(invalid(
            "multi-parent admission fields do not match recomputed output",
        ));
    }
    Ok(())
}

/// Validates the self-contained fields in a multi-parent admission record.
pub(crate) fn validate_record_summary_text(
    admission_text: &str,
) -> io::Result<HashMap<String, String>> {
    let admission = parse_manifest(admission_text, "multi-parent admission")?;
    require_equal(
        &admission,
        "tinyrustlm_multi_parent_selector_admission_version",
        ADMISSION_VERSION,
    )?;
    require_equal(&admission, "admission_kind", ADMISSION_KIND)?;
    validate_slug(require_key(&admission, "selector_id")?, "selector_id")?;
    require_equal(&admission, "admission_status", ADMISSION_STATUS)?;
    require_equal(&admission, "promotion_status", PROMOTION_STATUS)?;
    for key in PROMOTION_KEYS {
        require_key(&admission, key)?;
    }
    require_key(&admission, "candidate_id")?;
    require_hex64(&admission, "candidate_manifest_checksum")?;
    require_hex64(&admission, "promotion_manifest_checksum")?;
    require_hex64(&admission, "provenance_manifest_checksum")?;
    require_hex64(&admission, "runtime_smoke_manifest_checksum")?;
    require_hex64(&admission, "eval_manifest_checksum")?;
    require_hex64(&admission, "eval_case_evidence_checksum")?;
    require_hex64(&admission, "operator_receipt_checksum")?;
    require_hex64(&admission, "parent_pool_recipe_checksum")?;
    require_hex64(&admission, "population_review_checksum")?;
    require_hex64(&admission, "promotion_ledger_checksum")?;
    require_hex64(&admission, "admission_set_checksum")?;
    require_hex64(&admission, "frontier_candidate_slm_checksum")?;
    require_positive_usize(&admission, "parent_count")?;
    for key in CANDIDATE_KEYS {
        require_key(&admission, key)?;
    }
    require_key(&admission, "candidate_parent_contract")?;
    require_key(&admission, "candidate_admission_status")?;
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
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    admission_texts: &[String],
) -> io::Result<Evidence> {
    multi_promotion::validate_template_text(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        candidate_manifest_text,
        promotion_text,
        admission_texts,
    )?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    let runtime_smoke =
        provenance::validate_runtime_smoke_text(&report, provenance_text, runtime_smoke_text)?;
    provenance::validate_quality_gate(&report, provenance_text, QUALITY_GATE, Some(eval_text))?;
    let promotion = parse_manifest(promotion_text, "multi-parent promotion")?;
    let eval = provenance::parse_manifest(eval_text)?;
    require_equal(&runtime_smoke, "runtime_smoke_status", RUNTIME_SMOKE_STATUS)?;
    require_equal(&eval, "eval_status", EVAL_STATUS)?;
    require_equal(&eval, "task_eval_status", EVAL_STATUS)?;
    require_equal(&eval, "cases_failed", "0")?;
    Ok(Evidence { promotion, eval })
}

fn render_record_text(
    evidence: &Evidence,
    promotion_text: &str,
    provenance_text: &str,
    runtime_smoke_text: &str,
    eval_text: &str,
    selector_id: &str,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_multi_parent_selector_admission_version",
        ADMISSION_VERSION,
    );
    push_line(&mut text, "admission_kind", ADMISSION_KIND);
    push_line(&mut text, "selector_id", selector_id);
    push_line(&mut text, "admission_status", ADMISSION_STATUS);
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    for key in PROMOTION_KEYS {
        push_line(&mut text, key, require_key(&evidence.promotion, key)?);
    }
    push_line(
        &mut text,
        "candidate_id",
        require_key(&evidence.promotion, "frontier_candidate_id")?,
    );
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        require_key(&evidence.promotion, "candidate_manifest_checksum")?,
    );
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &hex64(provenance::text_checksum(promotion_text.as_bytes())),
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
    push_line(
        &mut text,
        "candidate_parent_contract",
        require_key(&evidence.promotion, "candidate_parent_contract")?,
    );
    push_line(
        &mut text,
        "candidate_admission_status",
        require_key(&evidence.promotion, "candidate_admission_status")?,
    );
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

fn validate_slug(value: &str, key: &str) -> io::Result<()> {
    if value.is_empty()
        || value.len() > 96
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(invalid(&format!("{key} must be an ASCII slug")));
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::build_model_file_from_values_with_flags;
    use crate::candidate;
    use crate::compatibility;
    use crate::fixture_value;
    use crate::ledger;
    use crate::lineage;
    use crate::multi_candidate;
    use crate::parent_pool;
    use crate::population;
    use crate::promotion;
    use crate::sign_merge;
    use crate::tensor_writer::{tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct Fixture {
        ledger: String,
        review: String,
        recipe: String,
        parents: Vec<(String, Vec<u8>)>,
        admissions: Vec<String>,
        candidate: Vec<u8>,
        receipt: String,
        manifest: String,
        promotion: String,
        provenance_manifest: String,
        runtime_smoke: String,
        eval: String,
    }

    #[test]
    fn writes_and_validates_multi_parent_selector_admission_record() {
        let fixture = fixture();
        let admission = fixture.admission();

        validate_record_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &fixture.admissions,
            &admission,
        )
        .unwrap();

        assert!(admission.contains("admission_kind=multi-parent-sign-merge"));
        assert!(admission.contains("candidate_id=tiny-alpha-candidate"));
        assert!(admission.contains("parent_count=3"));
        assert!(admission.contains("eval_case_evidence_checksum=0x"));
        assert!(admission.contains("browser_selector_status=admitted"));
        assert!(
            admission.contains("required_next_gate=multi-parent-selector-registry-route-binding")
        );
    }

    #[test]
    fn rejects_runtime_smoke_drift() {
        let fixture = fixture();
        let admission = fixture.admission();
        let changed_smoke = fixture.runtime_smoke.replace(
            "runtime_smoke_decision=accepted-for-runtime-smoke",
            "runtime_smoke_decision=pending",
        );

        let error = validate_record_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &changed_smoke,
            &fixture.eval,
            &fixture.admissions,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("runtime_smoke_decision"));
    }

    #[test]
    fn rejects_eval_manifest_drift() {
        let fixture = fixture();
        let admission = fixture.admission();
        let changed_eval = fixture
            .eval
            .replace("case.0.actual=e\n", "case.0.actual=x\n");

        let error = validate_record_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &changed_eval,
            &fixture.admissions,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("actual text did not match"));
    }

    #[test]
    fn rejects_admission_overclaim() {
        let fixture = fixture();
        let admission = fixture.admission().replace(
            "required_next_gate=multi-parent-selector-registry-route-binding",
            "required_next_gate=browser-loads-selector-registry-entry-models",
        );

        let error = validate_record_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &fixture.promotion,
            &fixture.provenance_manifest,
            &fixture.runtime_smoke,
            &fixture.eval,
            &fixture.admissions,
            &admission,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("required_next_gate"));
    }

    #[test]
    fn summary_rejects_incomplete_case_totals() {
        let fixture = fixture();
        let admission = fixture
            .admission()
            .replace("cases_passed=1\n", "cases_passed=0\n");

        let error = validate_record_summary_text(&admission).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("case totals"));
    }

    #[test]
    fn writes_and_validates_multi_parent_selector_admission_paths() {
        let dir = unique_dir("paths");
        std::fs::create_dir_all(&dir).unwrap();
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.005);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.002);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/multi-admission/path-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/multi-admission/path-beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/multi-admission/path-gamma.slm",
            &gamma_bytes,
        );
        let alpha_slm = dir.join("alpha.slm");
        let beta_slm = dir.join("beta.slm");
        let gamma_slm = dir.join("gamma.slm");
        let alpha_admission = dir.join("alpha.admission");
        let beta_admission = dir.join("beta.admission");
        let gamma_admission = dir.join("gamma.admission");
        let ledger_path = dir.join("pool.ledger");
        let review_path = dir.join("pool.review");
        let recipe_path = dir.join("pool.recipe");
        let candidate_path = dir.join("candidate.slm");
        let receipt_path = dir.join("candidate.operator");
        let manifest_path = dir.join("candidate.multi");
        let promotion_path = dir.join("candidate.multi.promotion");
        let provenance_path = dir.join("candidate.manifest");
        let runtime_path = dir.join("candidate.runtime");
        let eval_path = dir.join("candidate.eval");
        let admission_path = dir.join("candidate.multi.admission");
        std::fs::write(&alpha_slm, alpha_bytes).unwrap();
        std::fs::write(&beta_slm, beta_bytes).unwrap();
        std::fs::write(&gamma_slm, gamma_bytes).unwrap();
        std::fs::write(&alpha_admission, alpha).unwrap();
        std::fs::write(&beta_admission, beta).unwrap();
        std::fs::write(&gamma_admission, gamma).unwrap();
        let admissions = vec![
            alpha_admission.to_string_lossy().to_string(),
            beta_admission.to_string_lossy().to_string(),
            gamma_admission.to_string_lossy().to_string(),
        ];
        let parents = vec![
            alpha_slm.to_string_lossy().to_string(),
            beta_slm.to_string_lossy().to_string(),
            gamma_slm.to_string_lossy().to_string(),
        ];

        ledger::write_ledger_path(&ledger_path, &admissions).unwrap();
        population::write_review_path(&ledger_path, &review_path, &admissions).unwrap();
        parent_pool::write_recipe_path(&ledger_path, &review_path, &recipe_path, &admissions)
            .unwrap();
        sign_merge::write_candidate_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &parents,
            &admissions,
        )
        .unwrap();
        multi_candidate::write_manifest_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &manifest_path,
            &parents,
            &admissions,
        )
        .unwrap();
        multi_promotion::write_template_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &manifest_path,
            &promotion_path,
            &parents,
            &admissions,
        )
        .unwrap();
        provenance::write_manifest_for_path(&candidate_path, &provenance_path, "converted-trained")
            .unwrap();
        provenance::write_runtime_smoke_for_path(&candidate_path, &provenance_path, &runtime_path)
            .unwrap();
        let report = slm_validate::validate_bytes(
            &std::fs::read(&candidate_path).unwrap(),
            &candidate_path.display().to_string(),
        )
        .unwrap();
        let provenance_manifest = std::fs::read_to_string(&provenance_path).unwrap();
        std::fs::write(&eval_path, passing_eval_text(&report, &provenance_manifest)).unwrap();

        write_record_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &manifest_path,
            &promotion_path,
            &provenance_path,
            &runtime_path,
            &eval_path,
            &admission_path,
            &parents,
            &admissions,
        )
        .unwrap();
        validate_record_path(
            &ledger_path,
            &review_path,
            &recipe_path,
            &candidate_path,
            &receipt_path,
            &manifest_path,
            &promotion_path,
            &provenance_path,
            &runtime_path,
            &eval_path,
            &admission_path,
            &parents,
            &admissions,
        )
        .unwrap();

        let admission = std::fs::read_to_string(admission_path).unwrap();
        assert!(admission.contains("selector_id=browser-local-selector"));
        assert!(admission.contains("admission_status=admitted-for-browser-selector"));
    }

    impl Fixture {
        fn admission(&self) -> String {
            build_record_text(
                &self.ledger,
                &self.review,
                &self.recipe,
                &self.parents,
                &self.candidate,
                "candidate.slm",
                &self.receipt,
                &self.manifest,
                &self.promotion,
                &self.provenance_manifest,
                &self.runtime_smoke,
                &self.eval,
                &self.admissions,
                admission::DEFAULT_ADMISSION_SELECTOR_ID,
            )
            .unwrap()
        }
    }

    fn fixture() -> Fixture {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.003);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.006);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/multi-admission/alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/multi-admission/beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/multi-admission/gamma.slm",
            &gamma_bytes,
        );
        let admissions = vec![alpha, beta, gamma];
        let ledger = ledger::build_ledger_text(&admissions).unwrap();
        let review = population::build_review_text(&ledger, &admissions).unwrap();
        let recipe = parent_pool::build_recipe_text(&ledger, &review, &admissions).unwrap();
        let parents = vec![
            ("alpha.slm".to_string(), alpha_bytes),
            ("beta.slm".to_string(), beta_bytes),
            ("gamma.slm".to_string(), gamma_bytes),
        ];
        let (candidate, receipt) = sign_merge::build_candidate_bytes_and_receipt(
            &ledger,
            &review,
            &recipe,
            &parents,
            "candidate.slm",
            &admissions,
        )
        .unwrap();
        let manifest = multi_candidate::build_manifest_text(
            &ledger,
            &review,
            &recipe,
            &parents,
            &candidate,
            "candidate.slm",
            &receipt,
            &admissions,
        )
        .unwrap();
        let promotion = multi_promotion::build_template_text(
            &ledger,
            &review,
            &recipe,
            &parents,
            &candidate,
            "candidate.slm",
            &receipt,
            &manifest,
            &admissions,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        let provenance_manifest =
            provenance::build_manifest_text(&report, "converted-trained").unwrap();
        let manifest_fields = provenance::parse_manifest(&provenance_manifest).unwrap();
        let runtime_smoke =
            provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)
                .unwrap();
        let eval = passing_eval_text(&report, &provenance_manifest);
        Fixture {
            ledger,
            review,
            recipe,
            parents,
            admissions,
            candidate,
            receipt,
            manifest,
            promotion,
            provenance_manifest,
            runtime_smoke,
            eval,
        }
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str, candidate: &[u8]) -> String {
        let compatibility = compatibility::compatibility_text_for_bytes(
            candidate,
            "left.slm",
            candidate,
            "right.slm",
        )
        .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, candidate_id, "operator-a", "fit")
                .unwrap();
        let candidate_manifest =
            candidate::build_manifest_text(&compatibility, &lineage, candidate, candidate_path)
                .unwrap();
        let promotion = promotion::build_template_text(
            &compatibility,
            &lineage,
            candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
        )
        .unwrap();
        let report = slm_validate::validate_bytes(candidate, candidate_path).unwrap();
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
            candidate,
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

    fn tiny_fixture_f32_bytes_with_offset(offset: f32) -> Vec<u8> {
        let tensors = tiny_fixture_tensors_with_dtype(DTYPE_F32);
        let values: Vec<Vec<f32>> = tensors
            .iter()
            .map(|tensor| {
                (0..tensor.element_count())
                    .map(|elem| fixture_value(tensor, elem) + offset)
                    .collect()
            })
            .collect();
        build_model_file_from_values_with_flags(
            &ModelShape::tiny_fixture(),
            &tensors,
            &ByteTokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap()
    }

    fn unique_dir(label: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-multi-admission-{label}-{nanos}"))
    }
}
