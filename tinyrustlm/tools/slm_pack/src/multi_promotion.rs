//! Promotion templates for validated multi-parent sign-merge candidates.

use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{hex64, invalid, parse_manifest, push_line, require_equal, require_key};
use crate::multi_candidate;
use crate::promotion;
use crate::provenance;

const PROMOTION_VERSION: &str = "1";
const PROMOTION_KIND: &str = "multi-parent-sign-merge";
const PROMOTION_STATUS: &str = "pending-runtime-smoke-and-eval";
const PROMOTER_ID: &str = "local-smoke-runner";
const RUNTIME_SMOKE_STATUS: &str = "pending";
const EVAL_STATUS: &str = "pending";
const PROMOTION_DECISION: &str = "pending";
const BROWSER_SELECTOR_STATUS: &str = "not-admitted";
const PUBLIC_CLAIM_STATUS: &str = "not-admitted";
const REQUIRED_NEXT_GATE: &str = "run-runtime-smoke-and-eval-before-multi-parent-admission";

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

/// Writes a promotion template for a validated multi-parent candidate manifest.
pub(crate) fn write_template_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    candidate_manifest: &Path,
    output: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(admission_paths, "multi-parent-promotion admissions")?;
    let parent_bytes = read_bytes(parent_paths, "multi-parent-promotion parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = build_template_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
        &candidate_manifest_text,
        &admission_texts,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, promotion_text)?;
    println!(
        "SLM multi-parent promotion template written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a multi-parent promotion template against its complete evidence chain.
pub(crate) fn validate_template_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    candidate_manifest: &Path,
    promotion: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(
        admission_paths,
        "validate-multi-parent-promotion admissions",
    )?;
    let parent_bytes = read_bytes(parent_paths, "validate-multi-parent-promotion parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    let candidate_manifest_text = fs::read_to_string(candidate_manifest)?;
    let promotion_text = fs::read_to_string(promotion)?;
    validate_template_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
        &candidate_manifest_text,
        &promotion_text,
        &admission_texts,
    )?;
    println!("SLM multi-parent promotion validation: PASS");
    println!("candidate_manifest: {}", candidate_manifest.display());
    println!("promotion: {}", promotion.display());
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

pub(crate) fn build_template_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    candidate_manifest_text: &str,
    admission_texts: &[String],
) -> io::Result<String> {
    multi_candidate::validate_manifest_text(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        candidate_manifest_text,
        admission_texts,
    )?;
    let candidate_fields =
        parse_manifest(candidate_manifest_text, "multi-parent candidate manifest")?;
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_multi_parent_promotion_version",
        PROMOTION_VERSION,
    );
    push_line(&mut text, "promotion_kind", PROMOTION_KIND);
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    push_line(&mut text, "promoter_id", PROMOTER_ID);
    push_line(
        &mut text,
        "promotion_scope",
        promotion::DEFAULT_PROMOTION_SCOPE,
    );
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        &hex64(provenance::text_checksum(
            candidate_manifest_text.as_bytes(),
        )),
    );
    push_line(
        &mut text,
        "operator_receipt_checksum",
        require_key(&candidate_fields, "operator_receipt_checksum")?,
    );
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        require_key(&candidate_fields, "parent_pool_recipe_checksum")?,
    );
    push_line(
        &mut text,
        "population_review_checksum",
        require_key(&candidate_fields, "population_review_checksum")?,
    );
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        require_key(&candidate_fields, "promotion_ledger_checksum")?,
    );
    push_line(
        &mut text,
        "admission_set_checksum",
        require_key(&candidate_fields, "admission_set_checksum")?,
    );
    push_line(
        &mut text,
        "frontier_candidate_id",
        require_key(&candidate_fields, "frontier_candidate_id")?,
    );
    push_line(
        &mut text,
        "frontier_candidate_slm_checksum",
        require_key(&candidate_fields, "frontier_candidate_slm_checksum")?,
    );
    push_line(
        &mut text,
        "parent_count",
        require_key(&candidate_fields, "parent_count")?,
    );
    push_line(
        &mut text,
        "operator_kind",
        require_key(&candidate_fields, "operator_kind")?,
    );
    push_line(
        &mut text,
        "operator_output_status",
        require_key(&candidate_fields, "operator_output_status")?,
    );
    for key in CANDIDATE_KEYS {
        push_line(&mut text, key, require_key(&candidate_fields, key)?);
    }
    push_line(
        &mut text,
        "candidate_parent_contract",
        require_key(&candidate_fields, "candidate_parent_contract")?,
    );
    push_line(
        &mut text,
        "candidate_admission_status",
        require_key(&candidate_fields, "candidate_admission_status")?,
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

pub(crate) fn validate_template_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    candidate_manifest_text: &str,
    promotion_text: &str,
    admission_texts: &[String],
) -> io::Result<()> {
    let promotion = parse_manifest(promotion_text, "multi-parent promotion")?;
    require_equal(
        &promotion,
        "tinyrustlm_multi_parent_promotion_version",
        PROMOTION_VERSION,
    )?;
    require_equal(&promotion, "promotion_kind", PROMOTION_KIND)?;
    require_equal(&promotion, "promotion_status", PROMOTION_STATUS)?;
    let expected = build_template_text(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        candidate_manifest_text,
        admission_texts,
    )?;
    if promotion_text != expected {
        return Err(invalid(
            "multi-parent promotion fields do not match recomputed output",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::admission;
    use crate::build_model_file_from_values_with_flags;
    use crate::candidate;
    use crate::compatibility;
    use crate::fixture_value;
    use crate::ledger;
    use crate::lineage;
    use crate::parent_pool;
    use crate::population;
    use crate::promotion;
    use crate::sign_merge;
    use crate::slm_validate;
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
    }

    #[test]
    fn writes_and_validates_multi_parent_promotion_template_text() {
        let fixture = fixture();
        let promotion = build_template_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &fixture.admissions,
        )
        .unwrap();

        validate_template_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &promotion,
            &fixture.admissions,
        )
        .unwrap();

        assert!(promotion.contains("promotion_kind=multi-parent-sign-merge"));
        assert!(promotion.contains("candidate_manifest_checksum=0x"));
        assert!(promotion.contains("runtime_smoke_status=pending"));
        assert!(promotion.contains(
            "required_next_gate=run-runtime-smoke-and-eval-before-multi-parent-admission"
        ));
    }

    #[test]
    fn validation_rejects_candidate_manifest_drift() {
        let fixture = fixture();
        let promotion = fixture.promotion();
        let manifest = fixture.manifest.replace(
            "candidate_eval_status=pending",
            "candidate_eval_status=pass",
        );

        let error = validate_template_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &manifest,
            &promotion,
            &fixture.admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest fields"));
    }

    #[test]
    fn validation_rejects_promotion_drift() {
        let fixture = fixture();
        let promotion = fixture
            .promotion()
            .replace("promotion_decision=pending", "promotion_decision=accepted");

        let error = validate_template_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &promotion,
            &fixture.admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("promotion fields"));
    }

    #[test]
    fn rejects_candidate_drift() {
        let fixture = fixture();
        let mut candidate = fixture.candidate.clone();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = build_template_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.manifest,
            &fixture.admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    #[test]
    fn writes_and_validates_multi_parent_promotion_template_paths() {
        let dir = unique_dir("paths");
        std::fs::create_dir_all(&dir).unwrap();
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.005);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.002);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/multi-promotion/path-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/multi-promotion/path-beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/multi-promotion/path-gamma.slm",
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
        write_template_path(
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
        validate_template_path(
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

        let promotion = std::fs::read_to_string(promotion_path).unwrap();
        assert!(promotion.contains("parent_count=3"));
        assert!(promotion.contains("browser_selector_status=not-admitted"));
    }

    impl Fixture {
        fn promotion(&self) -> String {
            build_template_text(
                &self.ledger,
                &self.review,
                &self.recipe,
                &self.parents,
                &self.candidate,
                "candidate.slm",
                &self.receipt,
                &self.manifest,
                &self.admissions,
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
            "target/multi-promotion/alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/multi-promotion/beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/multi-promotion/gamma.slm",
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
        Fixture {
            ledger,
            review,
            recipe,
            parents,
            admissions,
            candidate,
            receipt,
            manifest,
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
        std::env::temp_dir().join(format!("tinyrustlm-multi-promotion-{label}-{nanos}"))
    }
}
