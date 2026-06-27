//! Browser-served model-breeding smoke bundles.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::adapter;
use crate::adapter_family;
use crate::admission;
use crate::blend::{hex64, push_line};
use crate::build_model_file_from_values_with_flags;
use crate::candidate;
use crate::compatibility;
use crate::fixture_value;
use crate::ledger;
use crate::lineage;
use crate::multi_admission;
use crate::multi_candidate;
use crate::multi_promotion;
use crate::parent_pool;
use crate::population;
use crate::promotion;
use crate::provenance;
use crate::selector;
use crate::sign_merge;
use crate::slm_validate::{self, ValidationReport};
use crate::tensor_writer::{
    tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::tokenizer_writer::ByteTokenizerSection;

const ASSEMBLY_RECEIPT_KIND: &str = "browser-local-assembly-evidence";
const ASSEMBLY_RECEIPT_STATUS: &str = "validated";
const ASSEMBLY_REGISTRY_STATUS: &str = "receipt-validated";
const SOURCE_KIND: &str = "converted-trained";
const APP_FILES: [&str; 3] = ["index.html", "app.css", "app.js"];
const RUNTIME_WASM_FILE: &str = "tinyrustlm.wasm";

struct ParentRecord {
    model_path: PathBuf,
    admission_path: PathBuf,
}

struct BundleAdapterRoute {
    route: selector::RegistryAdapterRoute,
    manifest_path: PathBuf,
}

struct BundleSpec {
    id: String,
    quantization: String,
    dtype: u32,
    model_file: String,
    self_adapter_file: String,
    self_adapter_label: String,
    family_adapter_file: String,
    family_adapter_label: String,
    adapter_family_receipt_file: String,
    adapter_family_label: String,
    assembly_receipt_file: String,
    assembly_label: String,
}

impl BundleSpec {
    fn from_quantization(quantization: &str) -> io::Result<Self> {
        let dtype = match quantization {
            "f32" => DTYPE_F32,
            "q8_0" => DTYPE_Q8_0,
            "q4_0" => DTYPE_Q4_0,
            _ => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "browser-multi-parent-bundle quantization must be f32, q8_0, or q4_0",
                ))
            }
        };
        let suffix = match quantization {
            "f32" => "f32",
            "q8_0" => "q8",
            "q4_0" => "q4",
            _ => unreachable!(),
        };
        let id = format!("multi-parent-sign-merge-{suffix}");
        Ok(Self {
            model_file: format!("{id}.slm"),
            self_adapter_file: format!("{id}-self.adp1"),
            self_adapter_label: format!("Multi-parent sign-merge {quantization} self ADP1"),
            family_adapter_file: format!("{id}-family.adp1"),
            family_adapter_label: format!("Multi-parent sign-merge {quantization} family ADP1"),
            adapter_family_receipt_file: format!("{id}.adapter-family.receipt"),
            adapter_family_label: format!("Multi-parent sign-merge {quantization} ADP1 family"),
            assembly_receipt_file: format!("{id}.assembly.receipt"),
            assembly_label: format!("Multi-parent sign-merge {quantization} assembly evidence"),
            id,
            quantization: quantization.to_string(),
            dtype,
        })
    }
}

/// Writes a browser-loadable multi-parent selector registry bundle for one quantization mode.
pub(crate) fn write_bundle_path_with_quantization(
    root: &Path,
    quantization: &str,
) -> io::Result<()> {
    let spec = BundleSpec::from_quantization(quantization)?;
    let models = root.join("models");
    let evidence = root.join("evidence").join(&spec.id);
    let parents = evidence.join("parents");
    let admissions = evidence.join("admissions");
    fs::create_dir_all(&models)?;
    fs::create_dir_all(&parents)?;
    fs::create_dir_all(&admissions)?;
    copy_browser_surface(root)?;

    let parent_specs = [
        (spec.id.as_str(), 0.0f32),
        ("multi-parent-synthetic-beta", 0.000_001f32),
        ("multi-parent-synthetic-gamma", 0.000_002f32),
    ];
    let mut parent_records = Vec::with_capacity(parent_specs.len());
    for (candidate_id, offset) in parent_specs {
        let model_path = parents.join(format!("{candidate_id}.slm"));
        let bytes = tiny_fixture_bytes_with_offset(spec.dtype, offset)?;
        fs::write(&model_path, &bytes)?;
        let admission_text =
            parent_admission_text(candidate_id, &display_path(&model_path), &bytes)?;
        let admission_path = admissions.join(format!("{candidate_id}.admission"));
        fs::write(&admission_path, admission_text)?;
        parent_records.push(ParentRecord {
            model_path,
            admission_path,
        });
    }

    let admission_paths =
        paths_as_strings(parent_records.iter().map(|record| &record.admission_path));
    let parent_paths = paths_as_strings(parent_records.iter().map(|record| &record.model_path));
    let ledger_path = evidence.join("population.ledger");
    let review_path = evidence.join("population.review");
    let recipe_path = evidence.join("parent-pool.recipe");
    let candidate_path = models.join(&spec.model_file);
    let receipt_path = evidence.join("sign-merge.operator");
    let multi_candidate_path = evidence.join("sign-merge.candidate");
    let promotion_path = evidence.join("sign-merge.promotion");
    let provenance_path = models.join(format!("{}.manifest", spec.model_file));
    let runtime_path = evidence.join("sign-merge.runtime");
    let eval_path = evidence.join("sign-merge.eval");
    let multi_admission_path = evidence.join("sign-merge.multi.admission");
    let registry_path = models.join("selector.registry");

    ledger::write_ledger_path(&ledger_path, &admission_paths)?;
    population::write_review_path(&ledger_path, &review_path, &admission_paths)?;
    parent_pool::write_recipe_path(&ledger_path, &review_path, &recipe_path, &admission_paths)?;
    sign_merge::write_candidate_path(
        &ledger_path,
        &review_path,
        &recipe_path,
        &candidate_path,
        &receipt_path,
        &parent_paths,
        &admission_paths,
    )?;
    multi_candidate::write_manifest_path(
        &ledger_path,
        &review_path,
        &recipe_path,
        &candidate_path,
        &receipt_path,
        &multi_candidate_path,
        &parent_paths,
        &admission_paths,
    )?;
    multi_promotion::write_template_path(
        &ledger_path,
        &review_path,
        &recipe_path,
        &candidate_path,
        &receipt_path,
        &multi_candidate_path,
        &promotion_path,
        &parent_paths,
        &admission_paths,
    )?;
    provenance::write_manifest_for_path(&candidate_path, &provenance_path, SOURCE_KIND)?;
    provenance::write_runtime_smoke_for_path(&candidate_path, &provenance_path, &runtime_path)?;

    let candidate_bytes = fs::read(&candidate_path)?;
    let report = slm_validate::validate_bytes(&candidate_bytes, &display_path(&candidate_path))?;
    let provenance_text = fs::read_to_string(&provenance_path)?;
    let eval_text = passing_eval_text(&report, &provenance_text);
    fs::write(&eval_path, eval_text)?;
    provenance::quality_gate_path(
        &candidate_path,
        &provenance_path,
        "assistant-quality",
        Some(&eval_path),
    )?;
    multi_admission::write_record_path(
        &ledger_path,
        &review_path,
        &recipe_path,
        &candidate_path,
        &receipt_path,
        &multi_candidate_path,
        &promotion_path,
        &provenance_path,
        &runtime_path,
        &eval_path,
        &multi_admission_path,
        &parent_paths,
        &admission_paths,
    )?;
    let bundle_adapter_routes =
        write_bundle_adapter_routes(&spec, &candidate_path, &models, &evidence)?;
    let adapter_routes = bundle_adapter_routes
        .iter()
        .map(|route| route.route.clone())
        .collect::<Vec<_>>();
    let adapter_family_inputs = bundle_adapter_routes
        .iter()
        .map(|route| adapter_family::AdapterFamilyInput {
            route: &route.route,
            manifest_path: &route.manifest_path,
        })
        .collect::<Vec<_>>();
    let adapter_family_receipt_path = models.join(&spec.adapter_family_receipt_file);
    let adapter_family_route = adapter_family::write_receipt_path(
        &spec.id,
        &spec.adapter_family_label,
        &format!("../models/{}", spec.adapter_family_receipt_file),
        &adapter_family_receipt_path,
        &adapter_family_inputs,
    )?;
    adapter_family::validate_receipt_path(&adapter_family_receipt_path, &adapter_family_inputs)?;
    let assembly_receipt_path = models.join(&spec.assembly_receipt_file);
    let assembly_route = write_bundle_assembly_receipt(
        &spec,
        &assembly_receipt_path,
        &report,
        &ledger_path,
        &review_path,
        &recipe_path,
        &receipt_path,
        &multi_candidate_path,
        &promotion_path,
        &provenance_path,
        &runtime_path,
        &eval_path,
        &multi_admission_path,
        &adapter_family_route,
    )?;
    selector::write_registry_with_adapter_family_and_assembly_routes_path(
        &registry_path,
        &[display_path(&multi_admission_path)],
        &adapter_routes,
        &[adapter_family_route],
        &[assembly_route],
    )?;
    selector::validate_registry_path(&registry_path, &[display_path(&multi_admission_path)])?;

    println!("SLM browser multi-parent bundle root: {}", root.display());
    println!(
        "SLM browser multi-parent registry: {}",
        registry_path.display()
    );
    println!(
        "SLM browser multi-parent model: {}",
        candidate_path.display()
    );
    println!(
        "SLM browser multi-parent quantization: {}",
        spec.quantization
    );
    Ok(())
}

fn write_bundle_assembly_receipt(
    spec: &BundleSpec,
    receipt_path: &Path,
    report: &ValidationReport,
    ledger_path: &Path,
    review_path: &Path,
    recipe_path: &Path,
    operator_receipt_path: &Path,
    candidate_manifest_path: &Path,
    promotion_manifest_path: &Path,
    provenance_manifest_path: &Path,
    runtime_smoke_path: &Path,
    eval_path: &Path,
    admission_path: &Path,
    adapter_family_route: &selector::RegistryAdapterFamilyRoute,
) -> io::Result<selector::RegistryAssemblyRoute> {
    let route = format!("../models/{}", spec.assembly_receipt_file);
    let mut text = String::new();
    push_line(&mut text, "tinyrustlm_assembly_receipt_version", "1");
    push_line(&mut text, "assembly_kind", ASSEMBLY_RECEIPT_KIND);
    push_line(&mut text, "assembly_status", ASSEMBLY_RECEIPT_STATUS);
    push_line(&mut text, "assembly_strategy", "multi-parent-sign-merge");
    push_line(&mut text, "candidate_id", &spec.id);
    push_line(&mut text, "assembly_label", &spec.assembly_label);
    push_line(&mut text, "assembly_receipt_path", &route);
    push_line(
        &mut text,
        "model_path",
        &format!("../models/{}", spec.model_file),
    );
    push_line(
        &mut text,
        "manifest_path",
        &format!("../models/{}.manifest", spec.model_file),
    );
    push_line(&mut text, "slm_checksum", &hex64(report.checksum()));
    push_line(
        &mut text,
        "manifest_checksum",
        &text_file_checksum(provenance_manifest_path)?,
    );
    push_line(&mut text, "parent_count", "3");
    push_line(
        &mut text,
        "promotion_ledger_path",
        &evidence_route(spec, "population.ledger"),
    );
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        &text_file_checksum(ledger_path)?,
    );
    push_line(
        &mut text,
        "population_review_path",
        &evidence_route(spec, "population.review"),
    );
    push_line(
        &mut text,
        "population_review_checksum",
        &text_file_checksum(review_path)?,
    );
    push_line(
        &mut text,
        "parent_pool_recipe_path",
        &evidence_route(spec, "parent-pool.recipe"),
    );
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        &text_file_checksum(recipe_path)?,
    );
    push_line(
        &mut text,
        "operator_receipt_path",
        &evidence_route(spec, "sign-merge.operator"),
    );
    push_line(
        &mut text,
        "operator_receipt_checksum",
        &text_file_checksum(operator_receipt_path)?,
    );
    push_line(
        &mut text,
        "candidate_manifest_path",
        &evidence_route(spec, "sign-merge.candidate"),
    );
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        &text_file_checksum(candidate_manifest_path)?,
    );
    push_line(
        &mut text,
        "promotion_manifest_path",
        &evidence_route(spec, "sign-merge.promotion"),
    );
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &text_file_checksum(promotion_manifest_path)?,
    );
    push_line(
        &mut text,
        "runtime_smoke_path",
        &evidence_route(spec, "sign-merge.runtime"),
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &text_file_checksum(runtime_smoke_path)?,
    );
    push_line(
        &mut text,
        "eval_path",
        &evidence_route(spec, "sign-merge.eval"),
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &text_file_checksum(eval_path)?,
    );
    push_line(
        &mut text,
        "admission_path",
        &evidence_route(spec, "sign-merge.multi.admission"),
    );
    push_line(
        &mut text,
        "admission_checksum",
        &text_file_checksum(admission_path)?,
    );
    push_line(
        &mut text,
        "adapter_family_receipt_path",
        &format!("../models/{}", spec.adapter_family_receipt_file),
    );
    push_line(
        &mut text,
        "adapter_family_receipt_checksum",
        &adapter_family_route.receipt_checksum,
    );
    push_line(
        &mut text,
        "required_next_gate",
        "browser-selector-registry-route-binding",
    );
    fs::write(receipt_path, &text)?;
    Ok(selector::RegistryAssemblyRoute {
        candidate_id: spec.id.clone(),
        receipt_path: route,
        label: spec.assembly_label.clone(),
        status: ASSEMBLY_REGISTRY_STATUS.to_string(),
        kind: ASSEMBLY_RECEIPT_KIND.to_string(),
        receipt_checksum: hex64(provenance::text_checksum(text.as_bytes())),
    })
}

fn write_bundle_adapter_route(
    spec: &BundleSpec,
    candidate_path: &Path,
    models: &Path,
    evidence: &Path,
    route_id: &str,
    adapter_file: &str,
    adapter_label: &str,
) -> io::Result<selector::RegistryAdapterRoute> {
    let compatibility_path = evidence.join(format!("{route_id}.compat"));
    let lineage_path = evidence.join(format!("{route_id}.lineage"));
    let adapter_path = models.join(adapter_file);
    let adapter_manifest_path = models.join(format!("{adapter_file}.manifest"));

    compatibility::report_path(candidate_path, candidate_path, Some(&compatibility_path))?;
    lineage::write_template_path(
        &compatibility_path,
        &lineage_path,
        &format!("{}-{route_id}", spec.id),
        "adapter-delta-v1",
        "browser-registry-sidecar",
    )?;
    adapter::write_artifact_path(
        &compatibility_path,
        &lineage_path,
        candidate_path,
        candidate_path,
        &adapter_path,
        &adapter_manifest_path,
    )?;
    adapter::validate_artifact_path(
        &compatibility_path,
        &lineage_path,
        candidate_path,
        candidate_path,
        &adapter_path,
        &adapter_manifest_path,
    )?;

    let manifest_text = fs::read_to_string(&adapter_manifest_path)?;
    let fields = provenance::parse_manifest(&manifest_text)?;
    let apply_status = manifest_field(&fields, "adapter_apply_status")?.to_string();
    let artifact_checksum = manifest_field(&fields, "adapter_artifact_checksum")?.to_string();
    Ok(selector::RegistryAdapterRoute {
        candidate_id: spec.id.clone(),
        adapter_path: format!("../models/{adapter_file}"),
        manifest_path: format!("../models/{adapter_file}.manifest"),
        label: adapter_label.to_string(),
        apply_status,
        artifact_checksum,
        manifest_checksum: hex64(provenance::text_checksum(manifest_text.as_bytes())),
    })
}

fn write_bundle_adapter_routes(
    spec: &BundleSpec,
    candidate_path: &Path,
    models: &Path,
    evidence: &Path,
) -> io::Result<Vec<BundleAdapterRoute>> {
    let route_specs = [
        (
            "self-adapter",
            spec.self_adapter_file.as_str(),
            spec.self_adapter_label.as_str(),
        ),
        (
            "family-adapter",
            spec.family_adapter_file.as_str(),
            spec.family_adapter_label.as_str(),
        ),
    ];
    let mut routes = Vec::with_capacity(route_specs.len());
    for (route_id, adapter_file, adapter_label) in route_specs {
        let route = write_bundle_adapter_route(
            spec,
            candidate_path,
            models,
            evidence,
            route_id,
            adapter_file,
            adapter_label,
        )?;
        routes.push(BundleAdapterRoute {
            route,
            manifest_path: models.join(format!("{adapter_file}.manifest")),
        });
    }
    Ok(routes)
}

fn evidence_route(spec: &BundleSpec, file_name: &str) -> String {
    format!("../evidence/{}/{file_name}", spec.id)
}

fn text_file_checksum(path: &Path) -> io::Result<String> {
    let text = fs::read_to_string(path)?;
    Ok(hex64(provenance::text_checksum(text.as_bytes())))
}

fn copy_browser_surface(root: &Path) -> io::Result<()> {
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..");
    let app_source = source_root.join("app");
    let runtime_source = source_root.join("runtime");
    let app_target = root.join("app");
    let runtime_target = root.join("runtime");
    fs::create_dir_all(&app_target)?;
    fs::create_dir_all(&runtime_target)?;
    for file_name in APP_FILES {
        fs::copy(app_source.join(file_name), app_target.join(file_name))?;
    }
    fs::copy(
        runtime_source.join(RUNTIME_WASM_FILE),
        runtime_target.join(RUNTIME_WASM_FILE),
    )?;
    Ok(())
}

fn parent_admission_text(
    candidate_id: &str,
    candidate_path: &str,
    bytes: &[u8],
) -> io::Result<String> {
    let compatibility =
        compatibility::compatibility_text_for_bytes(bytes, candidate_path, bytes, candidate_path)?;
    let lineage = lineage::build_template_text(
        &compatibility,
        candidate_id,
        "seed-parent",
        "browser-bundle",
    )?;
    let candidate_manifest =
        candidate::build_manifest_text(&compatibility, &lineage, bytes, candidate_path)?;
    let promotion = promotion::build_template_text(
        &compatibility,
        &lineage,
        bytes,
        candidate_path,
        &candidate_manifest,
        "local-smoke-runner",
        promotion::DEFAULT_PROMOTION_SCOPE,
    )?;
    let report = slm_validate::validate_bytes(bytes, candidate_path)?;
    let provenance_manifest = provenance::build_manifest_text(&report, SOURCE_KIND)?;
    let manifest_fields = provenance::parse_manifest(&provenance_manifest)?;
    let runtime_smoke =
        provenance::build_runtime_smoke_text(&report, &provenance_manifest, &manifest_fields)?;
    let eval = passing_eval_text(&report, &provenance_manifest);
    admission::build_record_text(
        &compatibility,
        &lineage,
        bytes,
        candidate_path,
        &candidate_manifest,
        &promotion,
        &provenance_manifest,
        &runtime_smoke,
        &eval,
        admission::DEFAULT_ADMISSION_SELECTOR_ID,
    )
}

fn tiny_fixture_bytes_with_offset(dtype: u32, offset: f32) -> io::Result<Vec<u8>> {
    let tensors = tiny_fixture_tensors_with_dtype(dtype);
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
}

fn passing_eval_text(report: &ValidationReport, manifest: &str) -> String {
    let mut text = String::new();
    push_line(&mut text, "tinyrustlm_eval_manifest_version", "1");
    push_line(&mut text, "gate", "assistant-quality");
    push_line(&mut text, "source_kind", SOURCE_KIND);
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

fn paths_as_strings<'a>(paths: impl Iterator<Item = &'a PathBuf>) -> Vec<String> {
    paths.map(|path| display_path(path)).collect()
}

fn display_path(path: &Path) -> String {
    path.display().to_string()
}

fn manifest_field<'a>(
    fields: &'a std::collections::HashMap<String, String>,
    key: &str,
) -> io::Result<&'a str> {
    fields.get(key).map(String::as_str).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("manifest missing {key}"),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn writes_browser_multi_parent_bundle() {
        let root = unique_dir("bundle").join("tinyrustlm");
        write_bundle_path_with_quantization(&root, "f32").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry.0.candidate_id=multi-parent-sign-merge-f32"));
        assert!(registry.contains("entry.0.model_path=../models/multi-parent-sign-merge-f32.slm"));
        assert!(registry
            .contains("entry.0.adapter_path=../models/multi-parent-sign-merge-f32-self.adp1"));
        assert!(registry.contains("entry.0.adapter_label=Multi-parent sign-merge f32 self ADP1"));
        assert!(registry.contains("entry.0.adapter_count=2"));
        assert!(registry
            .contains("entry.0.adapter.1.path=../models/multi-parent-sign-merge-f32-family.adp1"));
        assert!(
            registry.contains("entry.0.adapter.1.label=Multi-parent sign-merge f32 family ADP1")
        );
        assert!(registry.contains(
            "entry.0.adapter_family_receipt_path=../models/multi-parent-sign-merge-f32.adapter-family.receipt"
        ));
        assert!(registry.contains("entry.0.adapter_family_status=receipt-validated"));
        assert!(registry.contains("entry.0.adapter_family_adapter_count=2"));
        assert!(registry.contains(
            "entry.0.assembly_receipt_path=../models/multi-parent-sign-merge-f32.assembly.receipt"
        ));
        assert!(registry.contains("entry.0.assembly_status=receipt-validated"));
        assert!(registry.contains("entry.0.assembly_kind=browser-local-assembly-evidence"));
        let assembly_receipt = fs::read_to_string(
            root.join("models")
                .join("multi-parent-sign-merge-f32.assembly.receipt"),
        )
        .unwrap();
        let assembly_checksum = hex64(provenance::text_checksum(assembly_receipt.as_bytes()));
        assert!(registry.contains(&format!(
            "entry.0.assembly_receipt_checksum={assembly_checksum}"
        )));
        assert!(assembly_receipt.contains("parent_count=3"));
        assert!(assembly_receipt.contains("operator_receipt_checksum=0x"));
        assert!(
            assembly_receipt.contains("required_next_gate=browser-selector-registry-route-binding")
        );
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32.slm.manifest")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-self.adp1")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-self.adp1.manifest")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-family.adp1")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-family.adp1.manifest")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32.adapter-family.receipt")
            .exists());
        assert!(root.join("app").join("index.html").exists());
        assert!(root.join("app").join("app.css").exists());
        assert!(root.join("app").join("app.js").exists());
        assert!(root.join("runtime").join("tinyrustlm.wasm").exists());

        fs::remove_dir_all(root.parent().unwrap()).unwrap();
    }

    #[test]
    fn writes_quantized_browser_multi_parent_bundles() {
        for (quantization, suffix) in [("q8_0", "q8"), ("q4_0", "q4")] {
            let root = unique_dir(suffix).join("tinyrustlm");
            write_bundle_path_with_quantization(&root, quantization).unwrap();
            let id = format!("multi-parent-sign-merge-{suffix}");
            let registry =
                fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
            assert!(registry.contains(&format!("entry.0.candidate_id={id}")));
            assert!(registry.contains(&format!("entry.0.quantization={quantization}")));
            assert!(registry.contains(&format!("entry.0.model_path=../models/{id}.slm")));
            assert!(registry.contains(&format!("entry.0.adapter_path=../models/{id}-self.adp1")));
            assert!(registry
                .contains("entry.0.adapter_apply_status=runtime-q8-q4-compatible-or-fuse-to-slm"));
            assert!(registry.contains(&format!(
                "entry.0.adapter.1.path=../models/{id}-family.adp1"
            )));
            assert!(registry.contains(&format!(
                "entry.0.adapter_family_receipt_path=../models/{id}.adapter-family.receipt"
            )));
            assert!(registry.contains(&format!(
                "entry.0.assembly_receipt_path=../models/{id}.assembly.receipt"
            )));
            let family_receipt = fs::read_to_string(
                root.join("models")
                    .join(format!("{id}.adapter-family.receipt")),
            )
            .unwrap();
            assert!(family_receipt
                .contains(&format!("family.adapter_base_quantization={quantization}")));
            let assembly_receipt =
                fs::read_to_string(root.join("models").join(format!("{id}.assembly.receipt")))
                    .unwrap();
            assert!(assembly_receipt.contains(&format!(
                "promotion_ledger_path=../evidence/{id}/population.ledger"
            )));
            assert!(root.join("models").join(format!("{id}.slm")).exists());
            assert!(root
                .join("models")
                .join(format!("{id}-family.adp1.manifest"))
                .exists());
            fs::remove_dir_all(root.parent().unwrap()).unwrap();
        }
    }

    fn unique_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-browser-bundle-{label}-{nanos}"))
    }
}
