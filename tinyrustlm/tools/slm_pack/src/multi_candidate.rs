//! Candidate manifests for validated sign-aware parent-pool outputs.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{hex64, invalid, parse_manifest, push_line, require_equal, require_key};
use crate::provenance;
use crate::sign_merge;
use crate::slm_validate::{self, ValidationReport};

const MANIFEST_VERSION: &str = "1";
const MANIFEST_SCOPE: &str = "offline-model-breeding-multi-parent-candidate";
const MANIFEST_STATUS: &str = "validated-sign-merge-output";
const ARTIFACT_KIND: &str = "slm";
const CANDIDATE_STATUS: &str = "artifact-written";
const CANDIDATE_ARTIFACT_STATUS: &str = "written";
const CANDIDATE_ADMISSION_STATUS: &str = "slm-validated";
const CANDIDATE_EVAL_STATUS: &str = "pending";
const PROMOTION_STATUS: &str = "pending";
const REQUIRED_NEXT_GATE: &str = "multi-parent-promotion-template-plus-runtime-smoke-plus-eval";

const RECEIPT_KEYS: [&str; 21] = [
    "operator_kind",
    "operator_status",
    "operator_output_status",
    "recipe_kind",
    "parent_pool_recipe_checksum",
    "population_review_checksum",
    "promotion_ledger_checksum",
    "admission_set_checksum",
    "frontier_candidate_id",
    "frontier_candidate_slm_checksum",
    "parent_contract_status",
    "contract_model_shape",
    "contract_quantization",
    "contract_output_contract",
    "contract_tokenizer_checksum",
    "contract_tensor_layout_checksum",
    "relatedness_metric",
    "relatedness_scope",
    "relatedness_pair_count",
    "relatedness_all_pairs_status",
    "relatedness_contract_checksum",
];

const PARENT_KEYS: [&str; 26] = [
    "rank",
    "role",
    "selection_status",
    "source_review_entry",
    "source_ledger_entry",
    "candidate_id",
    "selector_id",
    "operator_id",
    "resource_budget",
    "recipe_candidate_artifact_path",
    "actual_path",
    "model_bytes",
    "slm_version",
    "slm_checksum",
    "model_shape",
    "tensor_count",
    "parameter_count",
    "quantization",
    "output_contract",
    "tokenizer_checksum",
    "tensor_layout_checksum",
    "relatedness_group",
    "relatedness_contract_checksum",
    "population_fitness_ppm",
    "seed_weight_ppm",
    "next_route",
];

const SIGN_KEYS: [&str; 12] = [
    "base_parent_index",
    "sign_selection_rule",
    "delta_merge_rule",
    "sign_total_parameter_count",
    "sign_participating_parent_count",
    "sign_delta_observation_count",
    "sign_nonzero_delta_observation_count",
    "sign_zero_delta_observation_count",
    "sign_positive_parameter_count",
    "sign_negative_parameter_count",
    "sign_neutral_parameter_count",
    "sign_selected_delta_observation_count",
];

/// Writes a manifest for a sign-merge candidate after recomputing its full input chain.
pub(crate) fn write_manifest_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    output: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(admission_paths, "multi-parent-candidate admissions")?;
    let parent_bytes = read_bytes(parent_paths, "multi-parent-candidate parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    let manifest = build_manifest_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
        &admission_texts,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, manifest)?;
    println!(
        "SLM multi-parent candidate manifest written: {}",
        output.display()
    );
    Ok(())
}

/// Validates a multi-parent candidate manifest against the sign-merge evidence chain.
pub(crate) fn validate_manifest_path(
    ledger: &Path,
    review: &Path,
    recipe: &Path,
    candidate_slm: &Path,
    receipt: &Path,
    manifest: &Path,
    parent_paths: &[String],
    admission_paths: &[String],
) -> io::Result<()> {
    let admission_texts = read_texts(
        admission_paths,
        "validate-multi-parent-candidate admissions",
    )?;
    let parent_bytes = read_bytes(parent_paths, "validate-multi-parent-candidate parents")?;
    let ledger_text = fs::read_to_string(ledger)?;
    let review_text = fs::read_to_string(review)?;
    let recipe_text = fs::read_to_string(recipe)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_manifest_text(
        &ledger_text,
        &review_text,
        &recipe_text,
        &parent_bytes,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
        &manifest_text,
        &admission_texts,
    )?;
    println!("SLM multi-parent candidate manifest validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    println!("manifest: {}", manifest.display());
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

pub(crate) fn build_manifest_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    admission_texts: &[String],
) -> io::Result<String> {
    sign_merge::validate_candidate_text(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        admission_texts,
    )?;
    let receipt = parse_manifest(receipt_text, "sign-merge operator receipt")?;
    let recipe = parse_manifest(recipe_text, "parent-pool recipe")?;
    let report = slm_validate::validate_bytes(candidate_bytes, candidate_path)?;
    validate_receipt_and_recipe(&receipt, &recipe, &report, receipt_text, recipe_text)?;

    let parent_count = parse_parent_count(&receipt)?;
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_multi_parent_candidate_manifest_version",
        MANIFEST_VERSION,
    );
    push_line(&mut text, "candidate_manifest_scope", MANIFEST_SCOPE);
    push_line(&mut text, "candidate_manifest_status", MANIFEST_STATUS);
    push_line(&mut text, "candidate_status", CANDIDATE_STATUS);
    push_line(&mut text, "artifact_kind", ARTIFACT_KIND);
    for key in RECEIPT_KEYS {
        push_line(&mut text, key, require_key(&receipt, key)?);
    }
    push_line(
        &mut text,
        "operator_receipt_checksum",
        &hex64(provenance::text_checksum(receipt_text.as_bytes())),
    );
    push_line(&mut text, "parent_count", &parent_count.to_string());
    for index in 0..parent_count {
        push_parent_lines(&mut text, &receipt, index)?;
    }
    for key in SIGN_KEYS {
        push_line(&mut text, key, require_key(&receipt, key)?);
    }
    push_line(
        &mut text,
        "sign_rejected_delta_observation_count",
        require_key(&receipt, "sign_rejected_delta_observation_count")?,
    );
    push_candidate_lines(&mut text, &report);
    push_line(
        &mut text,
        "candidate_parent_contract",
        require_key(&receipt, "candidate_parent_contract")?,
    );
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
    push_line(&mut text, "candidate_eval_status", CANDIDATE_EVAL_STATUS);
    push_line(&mut text, "promotion_status", PROMOTION_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

pub(crate) fn validate_manifest_text(
    ledger_text: &str,
    review_text: &str,
    recipe_text: &str,
    parent_bytes: &[(String, Vec<u8>)],
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
    manifest_text: &str,
    admission_texts: &[String],
) -> io::Result<()> {
    let manifest = parse_manifest(manifest_text, "multi-parent candidate manifest")?;
    require_equal(
        &manifest,
        "tinyrustlm_multi_parent_candidate_manifest_version",
        MANIFEST_VERSION,
    )?;
    require_equal(&manifest, "candidate_manifest_status", MANIFEST_STATUS)?;
    let expected = build_manifest_text(
        ledger_text,
        review_text,
        recipe_text,
        parent_bytes,
        candidate_bytes,
        candidate_path,
        receipt_text,
        admission_texts,
    )?;
    if manifest_text != expected {
        return Err(invalid(
            "multi-parent candidate manifest fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn validate_receipt_and_recipe(
    receipt: &HashMap<String, String>,
    recipe: &HashMap<String, String>,
    report: &ValidationReport,
    receipt_text: &str,
    recipe_text: &str,
) -> io::Result<()> {
    require_equal(receipt, "tinyrustlm_sign_merge_operator_version", "1")?;
    require_equal(receipt, "operator_kind", "sign-aware-parent-pool-merge")?;
    require_equal(receipt, "operator_status", "candidate-written")?;
    require_equal(receipt, "operator_output_status", "slm-validated")?;
    require_equal(
        receipt,
        "candidate_parent_contract",
        "matches-parent-pool-direct-parameter-contract",
    )?;
    require_equal(
        receipt,
        "required_next_gate",
        "multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval",
    )?;
    require_equal(recipe, "tinyrustlm_parent_pool_recipe_version", "1")?;
    require_equal(recipe, "recipe_kind", "sign-aware-parent-pool-v1")?;
    for key in [
        "relatedness_metric",
        "relatedness_scope",
        "relatedness_pair_count",
        "relatedness_all_pairs_status",
        "relatedness_contract_checksum",
    ] {
        require_equal(receipt, key, require_key(recipe, key)?)?;
    }
    require_equal(
        receipt,
        "parent_pool_recipe_checksum",
        &hex64(provenance::text_checksum(recipe_text.as_bytes())),
    )?;
    require_equal(receipt, "candidate_artifact_path", report.path())?;
    require_equal(receipt, "candidate_slm_checksum", &hex64(report.checksum()))?;
    require_equal(
        receipt,
        "candidate_tensor_layout_checksum",
        &hex64(report.tensor_layout_checksum()),
    )?;
    require_key(receipt, "candidate_artifact_bytes")?;
    require_key(receipt, "candidate_model_shape")?;
    require_key(receipt, "candidate_quantization")?;
    require_key(receipt, "candidate_output_contract")?;
    require_key(receipt, "candidate_tokenizer_checksum")?;
    require_key(receipt, "sign_rejected_delta_observation_count")?;
    require_key(receipt, "parent_count")?;
    require_key(receipt, "operator_kind")?;
    require_key(receipt, "operator_status")?;
    require_key(receipt, "operator_output_status")?;
    if receipt_text.is_empty() {
        return Err(invalid("sign-merge operator receipt is empty"));
    }
    Ok(())
}

fn parse_parent_count(receipt: &HashMap<String, String>) -> io::Result<usize> {
    let parent_count = require_key(receipt, "parent_count")?
        .parse::<usize>()
        .map_err(|_| invalid("multi-parent candidate parent_count must be an integer"))?;
    if parent_count < 2 {
        return Err(invalid(
            "multi-parent candidate manifest requires at least two parents",
        ));
    }
    Ok(parent_count)
}

fn push_parent_lines(
    text: &mut String,
    receipt: &HashMap<String, String>,
    index: usize,
) -> io::Result<()> {
    for key in PARENT_KEYS {
        let full_key = format!("parent.{index}.{key}");
        push_line(text, &full_key, require_key(receipt, &full_key)?);
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
    }

    #[test]
    fn writes_and_validates_multi_parent_candidate_manifest_text() {
        let fixture = fixture();
        let manifest = build_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.admissions,
        )
        .unwrap();

        validate_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &manifest,
            &fixture.admissions,
        )
        .unwrap();

        assert!(manifest.contains("candidate_manifest_status=validated-sign-merge-output"));
        assert!(manifest.contains("operator_receipt_checksum=0x"));
        assert!(manifest.contains("candidate_eval_status=pending"));
        assert!(manifest.contains("promotion_status=pending"));
        assert!(manifest.contains(
            "required_next_gate=multi-parent-promotion-template-plus-runtime-smoke-plus-eval"
        ));
    }

    #[test]
    fn validation_rejects_manifest_drift() {
        let fixture = fixture();
        let manifest = build_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.admissions,
        )
        .unwrap()
        .replace(
            "candidate_eval_status=pending",
            "candidate_eval_status=pass",
        );

        let error = validate_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &manifest,
            &fixture.admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest fields"));
    }

    #[test]
    fn validation_rejects_receipt_drift() {
        let fixture = fixture();
        let manifest = build_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.admissions,
        )
        .unwrap();
        let receipt = fixture.receipt.replace(
            "operator_status=candidate-written",
            "operator_status=manual",
        );

        let error = validate_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &fixture.candidate,
            "candidate.slm",
            &receipt,
            &manifest,
            &fixture.admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("receipt fields"));
    }

    #[test]
    fn rejects_candidate_that_breaks_receipt_contract() {
        let fixture = fixture();
        let mut candidate = fixture.candidate.clone();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = build_manifest_text(
            &fixture.ledger,
            &fixture.review,
            &fixture.recipe,
            &fixture.parents,
            &candidate,
            "candidate.slm",
            &fixture.receipt,
            &fixture.admissions,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    #[test]
    fn writes_and_validates_multi_parent_candidate_manifest_paths() {
        let dir = unique_dir("paths");
        std::fs::create_dir_all(&dir).unwrap();
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.005);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.002);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/multi-candidate/path-alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/multi-candidate/path-beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/multi-candidate/path-gamma.slm",
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
        write_manifest_path(
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
        validate_manifest_path(
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

        let manifest = std::fs::read_to_string(manifest_path).unwrap();
        assert!(manifest.contains("parent_count=3"));
        slm_validate::validate_path(&candidate_path).unwrap();
    }

    fn fixture() -> Fixture {
        let alpha_bytes = tiny_fixture_f32_bytes_with_offset(0.0);
        let beta_bytes = tiny_fixture_f32_bytes_with_offset(0.003);
        let gamma_bytes = tiny_fixture_f32_bytes_with_offset(0.006);
        let alpha = fixture_admission(
            "tiny-alpha-candidate",
            "target/multi-candidate/alpha.slm",
            &alpha_bytes,
        );
        let beta = fixture_admission(
            "tiny-beta-candidate",
            "target/multi-candidate/beta.slm",
            &beta_bytes,
        );
        let gamma = fixture_admission(
            "tiny-gamma-candidate",
            "target/multi-candidate/gamma.slm",
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
        Fixture {
            ledger,
            review,
            recipe,
            parents,
            admissions,
            candidate,
            receipt,
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
        std::env::temp_dir().join(format!("tinyrustlm-multi-candidate-{label}-{nanos}"))
    }
}
