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
const MODULE_PLAN_KIND: &str = "browser-local-module-plan";
const MODULE_PLAN_STATUS: &str = "validated";
const MODULE_PLAN_REGISTRY_STATUS: &str = "receipt-validated";
const MODULE_PLAN_STRATEGY: &str = "selector-entry-self-assembly";
const MODULE_PLAN_RESOURCE_CLASS: &str = "browser-constrained-local-assembly";
const SOURCE_KIND: &str = "converted-trained";
const APP_FILES: [&str; 3] = ["index.html", "app.css", "app.js"];
const RUNTIME_WASM_FILE: &str = "tinyrustlm.wasm";
const RUNTIME_WASM_MANIFEST_FILE: &str = "tinyrustlm.wasm.manifest";
const RUNTIME_WASM_KIND: &str = "tinyrustlm-rust-wasm";
const RUNTIME_WASM_STATUS: &str = "validated-local-runtime";
const RUNTIME_WASM_NEXT_GATE: &str = "instantiate-wasm-runtime";

struct ParentRecord {
    model_path: PathBuf,
    admission_path: PathBuf,
}

struct BundleAdapterRoute {
    route: selector::RegistryAdapterRoute,
    artifact_path: PathBuf,
    manifest_path: PathBuf,
}

#[derive(Clone, Copy)]
enum BundleAdapterKind {
    RawAdp1,
    SparseAsp1,
    LowRankAlr1,
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
    sparse_adapter_file: String,
    sparse_adapter_label: String,
    low_rank_adapter_file: String,
    low_rank_adapter_label: String,
    adapter_family_receipt_file: String,
    adapter_family_label: String,
    assembly_receipt_file: String,
    assembly_label: String,
    module_plan_receipt_file: String,
    module_plan_label: String,
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
            sparse_adapter_file: format!("{id}-sparse.asp1"),
            sparse_adapter_label: format!("Multi-parent sign-merge {quantization} sparse ASP1"),
            low_rank_adapter_file: format!("{id}-low-rank.alr1"),
            low_rank_adapter_label: format!("Multi-parent sign-merge {quantization} low-rank ALR1"),
            adapter_family_receipt_file: format!("{id}.adapter-family.receipt"),
            adapter_family_label: format!("Multi-parent sign-merge {quantization} adapter family"),
            assembly_receipt_file: format!("{id}.assembly.receipt"),
            assembly_label: format!("Multi-parent sign-merge {quantization} assembly evidence"),
            module_plan_receipt_file: format!("{id}.module-plan.receipt"),
            module_plan_label: format!("Multi-parent sign-merge {quantization} module plan"),
            id,
            quantization: quantization.to_string(),
            dtype,
        })
    }
}

struct StagedBundleModule {
    admission_path: PathBuf,
    adapter_routes: Vec<selector::RegistryAdapterRoute>,
    adapter_family_route: selector::RegistryAdapterFamilyRoute,
    assembly_route: selector::RegistryAssemblyRoute,
    module_plan_route: selector::RegistryModulePlanRoute,
    candidate_path: PathBuf,
    quantization: String,
}

/// Writes a browser-loadable multi-parent selector registry bundle for one or all quantization modes.
pub(crate) fn write_bundle_path_with_quantization(
    root: &Path,
    quantization: &str,
) -> io::Result<()> {
    let quantizations = bundle_quantizations(quantization)?;
    let models = root.join("models");
    fs::create_dir_all(&models)?;
    copy_browser_surface(root)?;

    let mut modules = Vec::with_capacity(quantizations.len());
    for quantization in quantizations {
        let spec = BundleSpec::from_quantization(quantization)?;
        modules.push(write_bundle_module(root, &models, &spec)?);
    }

    let registry_path = models.join("selector.registry");
    let admission_paths = modules
        .iter()
        .map(|module| display_path(&module.admission_path))
        .collect::<Vec<_>>();
    let adapter_routes = modules
        .iter()
        .flat_map(|module| module.adapter_routes.iter().cloned())
        .collect::<Vec<_>>();
    let adapter_family_routes = modules
        .iter()
        .map(|module| module.adapter_family_route.clone())
        .collect::<Vec<_>>();
    let assembly_routes = modules
        .iter()
        .map(|module| module.assembly_route.clone())
        .collect::<Vec<_>>();
    let module_plan_routes = modules
        .iter()
        .map(|module| module.module_plan_route.clone())
        .collect::<Vec<_>>();
    selector::write_registry_with_module_plan_routes_path(
        &registry_path,
        &admission_paths,
        &adapter_routes,
        &adapter_family_routes,
        &assembly_routes,
        &module_plan_routes,
    )?;
    selector::validate_registry_path(&registry_path, &admission_paths)?;

    let quantization_labels = modules
        .iter()
        .map(|module| module.quantization.as_str())
        .collect::<Vec<_>>()
        .join(",");
    println!("SLM browser multi-parent bundle root: {}", root.display());
    println!(
        "SLM browser multi-parent registry: {}",
        registry_path.display()
    );
    println!("SLM browser multi-parent model count: {}", modules.len());
    for module in &modules {
        println!(
            "SLM browser multi-parent model: {}",
            module.candidate_path.display()
        );
    }
    println!("SLM browser multi-parent quantizations: {quantization_labels}");
    Ok(())
}

fn bundle_quantizations(quantization: &str) -> io::Result<Vec<&'static str>> {
    match quantization {
        "f32" => Ok(vec!["f32"]),
        "q8_0" => Ok(vec!["q8_0"]),
        "q4_0" => Ok(vec!["q4_0"]),
        "all" => Ok(vec!["f32", "q8_0", "q4_0"]),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "browser-multi-parent-bundle quantization must be f32, q8_0, q4_0, or all",
        )),
    }
}

fn write_bundle_module(
    root: &Path,
    models: &Path,
    spec: &BundleSpec,
) -> io::Result<StagedBundleModule> {
    let evidence = root.join("evidence").join(&spec.id);
    let parents = evidence.join("parents");
    let admissions = evidence.join("admissions");
    fs::create_dir_all(&parents)?;
    fs::create_dir_all(&admissions)?;

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
    let module_plan_receipt_path = models.join(&spec.module_plan_receipt_file);
    let module_plan_route = write_bundle_module_plan_receipt(
        &spec,
        &module_plan_receipt_path,
        &report,
        &provenance_path,
        &assembly_receipt_path,
        &adapter_family_receipt_path,
        &bundle_adapter_routes,
        &adapter_family_route,
        &assembly_route,
    )?;
    Ok(StagedBundleModule {
        admission_path: multi_admission_path,
        adapter_routes,
        adapter_family_route,
        assembly_route,
        module_plan_route,
        candidate_path,
        quantization: spec.quantization.clone(),
    })
}

fn write_bundle_module_plan_receipt(
    spec: &BundleSpec,
    receipt_path: &Path,
    report: &ValidationReport,
    provenance_manifest_path: &Path,
    assembly_receipt_path: &Path,
    adapter_family_receipt_path: &Path,
    bundle_adapter_routes: &[BundleAdapterRoute],
    adapter_family_route: &selector::RegistryAdapterFamilyRoute,
    assembly_route: &selector::RegistryAssemblyRoute,
) -> io::Result<selector::RegistryModulePlanRoute> {
    let route = format!("../models/{}", spec.module_plan_receipt_file);
    let model_path = format!("../models/{}", spec.model_file);
    let manifest_path = format!("../models/{}.manifest", spec.model_file);
    let model_checksum = hex64(report.checksum());
    let model_byte_budget = u64::try_from(report.file_bytes())
        .map_err(|_| invalid("module plan model byte budget overflow"))?;
    let adapter_byte_budget = adapter_family_route.auto_apply_byte_budget;
    let manifest_byte_count = file_byte_count(provenance_manifest_path)?;
    let assembly_receipt_byte_count = file_byte_count(assembly_receipt_path)?;
    let adapter_family_receipt_byte_count = file_byte_count(adapter_family_receipt_path)?;
    let manifest_checksum = text_file_checksum(provenance_manifest_path)?;
    let stack_indexes = bundle_auto_apply_stack_indexes(bundle_adapter_routes.len());
    let module_count = 4usize
        .checked_add(stack_indexes.len())
        .ok_or_else(|| invalid("module plan count overflow"))?;
    if module_count != 4 + adapter_family_route.auto_apply_stack_count {
        return Err(invalid(
            "module plan adapter stack count must match adapter family route",
        ));
    }

    let mut text = String::new();
    push_line(&mut text, "tinyrustlm_module_plan_version", "1");
    push_line(&mut text, "module_plan_kind", MODULE_PLAN_KIND);
    push_line(&mut text, "module_plan_status", MODULE_PLAN_STATUS);
    push_line(&mut text, "module_plan_strategy", MODULE_PLAN_STRATEGY);
    push_line(&mut text, "candidate_id", &spec.id);
    push_line(&mut text, "module_plan_label", &spec.module_plan_label);
    push_line(&mut text, "module_plan_path", &route);
    push_line(
        &mut text,
        "module_plan_resource_class",
        MODULE_PLAN_RESOURCE_CLASS,
    );
    push_line(
        &mut text,
        "module_plan_model_byte_budget",
        &model_byte_budget.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_adapter_byte_budget",
        &adapter_byte_budget.to_string(),
    );
    push_line(&mut text, "model_path", &model_path);
    push_line(&mut text, "manifest_path", &manifest_path);
    push_line(&mut text, "quantization", &spec.quantization);
    push_line(&mut text, "model_checksum", &model_checksum);
    push_line(&mut text, "manifest_checksum", &manifest_checksum);
    push_line(
        &mut text,
        "assembly_receipt_path",
        &assembly_route.receipt_path,
    );
    push_line(
        &mut text,
        "assembly_receipt_checksum",
        &assembly_route.receipt_checksum,
    );
    push_line(
        &mut text,
        "adapter_family_receipt_path",
        &adapter_family_route.receipt_path,
    );
    push_line(
        &mut text,
        "adapter_family_receipt_checksum",
        &adapter_family_route.receipt_checksum,
    );
    push_line(
        &mut text,
        "adapter_auto_apply_stack_count",
        &stack_indexes.len().to_string(),
    );
    push_line(&mut text, "module_count", &module_count.to_string());
    push_module_plan_line(
        &mut text,
        0,
        "model",
        "runtime-model",
        "runtime-model",
        "load-model-bytes",
        "runtime-wasm",
        &model_path,
        &model_checksum,
        model_byte_budget,
    );
    push_module_plan_line(
        &mut text,
        1,
        "model-manifest",
        "model-manifest",
        "model-provenance-manifest",
        "verify-model-manifest",
        "module.0",
        &manifest_path,
        &manifest_checksum,
        manifest_byte_count,
    );
    push_module_plan_line(
        &mut text,
        2,
        "assembly-receipt",
        "assembly-receipt",
        "assembly-evidence",
        "verify-assembly-evidence",
        "module.1",
        &assembly_route.receipt_path,
        &assembly_route.receipt_checksum,
        assembly_receipt_byte_count,
    );
    push_module_plan_line(
        &mut text,
        3,
        "adapter-family-receipt",
        "adapter-family-receipt",
        "adapter-family",
        "verify-adapter-family",
        "module.2",
        &adapter_family_route.receipt_path,
        &adapter_family_route.receipt_checksum,
        adapter_family_receipt_byte_count,
    );
    for (stack_position, adapter_index) in stack_indexes.iter().enumerate() {
        let module_index = stack_position + 4;
        let bundle_route = &bundle_adapter_routes[*adapter_index];
        let route = &bundle_route.route;
        let prefix = format!("module.{module_index}");
        let depends_on = if stack_position == 0 {
            "module.3".to_string()
        } else {
            format!("module.{}", module_index - 1)
        };
        let artifact_byte_count = file_byte_count(&bundle_route.artifact_path)?;
        push_line(&mut text, &format!("{prefix}.kind"), "adapter-stack-member");
        push_line(
            &mut text,
            &format!("{prefix}.assembly_slot"),
            &format!("adapter-stack-{stack_position}"),
        );
        push_line(
            &mut text,
            &format!("{prefix}.role"),
            module_plan_adapter_role(&route.adapter_path),
        );
        push_line(
            &mut text,
            &format!("{prefix}.phase"),
            &format!("apply-adapter-stack-{stack_position}"),
        );
        push_line(&mut text, &format!("{prefix}.depends_on"), &depends_on);
        push_line(
            &mut text,
            &format!("{prefix}.byte_count"),
            &artifact_byte_count.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.checksum"),
            &route.artifact_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.adapter_index"),
            &adapter_index.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.adapter_path"),
            &route.adapter_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.manifest_path"),
            &route.manifest_path,
        );
        push_line(
            &mut text,
            &format!("{prefix}.artifact_checksum"),
            &route.artifact_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.manifest_checksum"),
            &route.manifest_checksum,
        );
    }
    fs::write(receipt_path, &text)?;
    Ok(selector::RegistryModulePlanRoute {
        candidate_id: spec.id.clone(),
        receipt_path: route,
        label: spec.module_plan_label.clone(),
        status: MODULE_PLAN_REGISTRY_STATUS.to_string(),
        kind: MODULE_PLAN_KIND.to_string(),
        strategy: MODULE_PLAN_STRATEGY.to_string(),
        resource_class: MODULE_PLAN_RESOURCE_CLASS.to_string(),
        model_byte_budget,
        adapter_byte_budget,
        receipt_checksum: hex64(provenance::text_checksum(text.as_bytes())),
        module_count,
    })
}

fn push_module_plan_line(
    text: &mut String,
    module_index: usize,
    kind: &str,
    assembly_slot: &str,
    role: &str,
    phase: &str,
    depends_on: &str,
    path: &str,
    checksum: &str,
    byte_count: u64,
) {
    let prefix = format!("module.{module_index}");
    push_line(text, &format!("{prefix}.kind"), kind);
    push_line(text, &format!("{prefix}.assembly_slot"), assembly_slot);
    push_line(text, &format!("{prefix}.role"), role);
    push_line(text, &format!("{prefix}.phase"), phase);
    push_line(text, &format!("{prefix}.depends_on"), depends_on);
    push_line(
        text,
        &format!("{prefix}.byte_count"),
        &byte_count.to_string(),
    );
    push_line(text, &format!("{prefix}.path"), path);
    push_line(text, &format!("{prefix}.checksum"), checksum);
}

fn module_plan_adapter_role(adapter_path: &str) -> &'static str {
    if adapter_path.ends_with("-sparse.asp1") {
        "adapter-stack-sparse-delta"
    } else if adapter_path.ends_with("-low-rank.alr1") {
        "adapter-stack-low-rank-delta"
    } else if adapter_path.ends_with("-family.adp1") {
        "adapter-stack-family-delta"
    } else if adapter_path.ends_with("-self.adp1") {
        "adapter-stack-self-delta"
    } else {
        "adapter-stack-delta"
    }
}

fn bundle_auto_apply_stack_indexes(member_count: usize) -> Vec<usize> {
    if member_count >= 3 {
        (1..member_count).collect()
    } else {
        (0..member_count).collect()
    }
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
    let eval_text = fs::read_to_string(eval_path)?;
    let eval_fields = provenance::parse_manifest(&eval_text)?;
    let eval_case_evidence_checksum = provenance::eval_case_evidence_checksum(&eval_fields)?;
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
        "eval_case_evidence_checksum",
        &eval_case_evidence_checksum,
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
    adapter_kind: BundleAdapterKind,
) -> io::Result<BundleAdapterRoute> {
    let compatibility_path = evidence.join(format!("{route_id}.compat"));
    let lineage_path = evidence.join(format!("{route_id}.lineage"));
    let adapter_path = models.join(adapter_file);
    let adapter_manifest_path = models.join(format!("{adapter_file}.manifest"));
    let lineage_operator = match adapter_kind {
        BundleAdapterKind::RawAdp1 => "adapter-delta-v1",
        BundleAdapterKind::SparseAsp1 => "sparse-adapter-delta-v1",
        BundleAdapterKind::LowRankAlr1 => "low-rank-adapter-delta-v1",
    };

    compatibility::report_path(candidate_path, candidate_path, Some(&compatibility_path))?;
    lineage::write_template_path(
        &compatibility_path,
        &lineage_path,
        &format!("{}-{route_id}", spec.id),
        lineage_operator,
        "browser-registry-sidecar",
    )?;
    match adapter_kind {
        BundleAdapterKind::RawAdp1 => {
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
        }
        BundleAdapterKind::SparseAsp1 => {
            adapter::write_sparse_artifact_path(
                &compatibility_path,
                &lineage_path,
                candidate_path,
                candidate_path,
                &adapter_path,
                &adapter_manifest_path,
                Some("1000000"),
                Some("250000"),
            )?;
            adapter::validate_sparse_artifact_path(
                &compatibility_path,
                &lineage_path,
                candidate_path,
                candidate_path,
                &adapter_path,
                &adapter_manifest_path,
            )?;
        }
        BundleAdapterKind::LowRankAlr1 => {
            adapter::write_low_rank_artifact_path(
                &compatibility_path,
                &lineage_path,
                candidate_path,
                candidate_path,
                &adapter_path,
                &adapter_manifest_path,
                Some("1"),
            )?;
            adapter::validate_low_rank_artifact_path(
                &compatibility_path,
                &lineage_path,
                candidate_path,
                candidate_path,
                &adapter_path,
                &adapter_manifest_path,
            )?;
        }
    }

    let manifest_text = fs::read_to_string(&adapter_manifest_path)?;
    let fields = provenance::parse_manifest(&manifest_text)?;
    let apply_status = manifest_field(&fields, "adapter_apply_status")?.to_string();
    let artifact_checksum = manifest_field(&fields, "adapter_artifact_checksum")?.to_string();
    Ok(BundleAdapterRoute {
        route: selector::RegistryAdapterRoute {
            candidate_id: spec.id.clone(),
            adapter_path: format!("../models/{adapter_file}"),
            manifest_path: format!("../models/{adapter_file}.manifest"),
            label: adapter_label.to_string(),
            apply_status,
            artifact_checksum,
            manifest_checksum: hex64(provenance::text_checksum(manifest_text.as_bytes())),
        },
        artifact_path: adapter_path,
        manifest_path: adapter_manifest_path,
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
            BundleAdapterKind::RawAdp1,
        ),
        (
            "family-adapter",
            spec.family_adapter_file.as_str(),
            spec.family_adapter_label.as_str(),
            BundleAdapterKind::RawAdp1,
        ),
        (
            "sparse-adapter",
            spec.sparse_adapter_file.as_str(),
            spec.sparse_adapter_label.as_str(),
            BundleAdapterKind::SparseAsp1,
        ),
        (
            "low-rank-adapter",
            spec.low_rank_adapter_file.as_str(),
            spec.low_rank_adapter_label.as_str(),
            BundleAdapterKind::LowRankAlr1,
        ),
    ];
    let mut routes = Vec::with_capacity(route_specs.len());
    for (route_id, adapter_file, adapter_label, adapter_kind) in route_specs {
        let route = write_bundle_adapter_route(
            spec,
            candidate_path,
            models,
            evidence,
            route_id,
            adapter_file,
            adapter_label,
            adapter_kind,
        )?;
        routes.push(route);
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

fn file_byte_count(path: &Path) -> io::Result<u64> {
    Ok(fs::metadata(path)?.len())
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
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
    let runtime_bytes = fs::read(runtime_source.join(RUNTIME_WASM_FILE))?;
    fs::write(runtime_target.join(RUNTIME_WASM_FILE), &runtime_bytes)?;
    fs::write(
        runtime_target.join(RUNTIME_WASM_MANIFEST_FILE),
        runtime_wasm_manifest_text(&runtime_bytes),
    )?;
    Ok(())
}

pub(crate) fn write_runtime_wasm_manifest_path(
    wasm_path: &Path,
    manifest_path: &Path,
) -> io::Result<()> {
    let runtime_bytes = fs::read(wasm_path)?;
    fs::write(manifest_path, runtime_wasm_manifest_text(&runtime_bytes))
}

fn runtime_wasm_manifest_text(runtime_bytes: &[u8]) -> String {
    let mut text = String::new();
    push_line(&mut text, "tinyrustlm_wasm_manifest_version", "1");
    push_line(&mut text, "runtime_kind", RUNTIME_WASM_KIND);
    push_line(&mut text, "runtime_status", RUNTIME_WASM_STATUS);
    push_line(&mut text, "runtime_wasm_path", "../runtime/tinyrustlm.wasm");
    push_line(
        &mut text,
        "runtime_wasm_bytes",
        &runtime_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "runtime_wasm_checksum",
        &hex64(provenance::text_checksum(runtime_bytes)),
    );
    push_line(&mut text, "required_next_gate", RUNTIME_WASM_NEXT_GATE);
    text
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

    fn assert_module_plan(root: &std::path::Path, id: &str, quantization: &str, registry: &str) {
        let file_name = format!("{id}.module-plan.receipt");
        let module_plan = fs::read_to_string(root.join("models").join(&file_name)).unwrap();
        let checksum = hex64(provenance::text_checksum(module_plan.as_bytes()));
        let model_bytes = fs::metadata(root.join("models").join(format!("{id}.slm")))
            .unwrap()
            .len();
        let manifest_bytes = fs::metadata(root.join("models").join(format!("{id}.slm.manifest")))
            .unwrap()
            .len();
        let assembly_receipt_bytes =
            fs::metadata(root.join("models").join(format!("{id}.assembly.receipt")))
                .unwrap()
                .len();
        let adapter_family_receipt_bytes = fs::metadata(
            root.join("models")
                .join(format!("{id}.adapter-family.receipt")),
        )
        .unwrap()
        .len();
        let family_adapter_bytes =
            fs::metadata(root.join("models").join(format!("{id}-family.adp1")))
                .unwrap()
                .len();
        let sparse_adapter_bytes =
            fs::metadata(root.join("models").join(format!("{id}-sparse.asp1")))
                .unwrap()
                .len();
        let low_rank_adapter_bytes =
            fs::metadata(root.join("models").join(format!("{id}-low-rank.alr1")))
                .unwrap()
                .len();
        assert!(registry.contains(&format!("module_plan_path=../models/{file_name}")));
        assert!(registry.contains(&format!("module_plan_checksum={checksum}")));
        assert!(registry.contains("module_plan_status=receipt-validated"));
        assert!(registry.contains("module_plan_kind=browser-local-module-plan"));
        assert!(registry.contains("module_plan_strategy=selector-entry-self-assembly"));
        assert!(registry.contains("module_plan_resource_class=browser-constrained-local-assembly"));
        assert!(registry.contains(&format!("module_plan_model_byte_budget={model_bytes}")));
        assert!(registry.contains("module_plan_adapter_byte_budget=1048576"));
        assert!(registry.contains("module_plan_module_count=7"));
        assert!(module_plan.contains("tinyrustlm_module_plan_version=1"));
        assert!(module_plan.contains("module_plan_kind=browser-local-module-plan"));
        assert!(module_plan.contains("module_plan_status=validated"));
        assert!(module_plan.contains("module_plan_strategy=selector-entry-self-assembly"));
        assert!(module_plan.contains(&format!("candidate_id={id}")));
        assert!(module_plan.contains(&format!("module_plan_path=../models/{file_name}")));
        assert!(
            module_plan.contains("module_plan_resource_class=browser-constrained-local-assembly")
        );
        assert!(module_plan.contains(&format!("module_plan_model_byte_budget={model_bytes}")));
        assert!(module_plan.contains("module_plan_adapter_byte_budget=1048576"));
        assert!(module_plan.contains(&format!("model_path=../models/{id}.slm")));
        assert!(module_plan.contains(&format!("manifest_path=../models/{id}.slm.manifest")));
        assert!(module_plan.contains(&format!("quantization={quantization}")));
        assert!(module_plan.contains("adapter_auto_apply_stack_count=3"));
        assert!(module_plan.contains("module_count=7"));
        assert!(module_plan.contains("module.0.kind=model"));
        assert!(module_plan.contains("module.0.assembly_slot=runtime-model"));
        assert!(module_plan.contains("module.0.role=runtime-model"));
        assert!(module_plan.contains("module.0.phase=load-model-bytes"));
        assert!(module_plan.contains("module.0.depends_on=runtime-wasm"));
        assert!(module_plan.contains(&format!("module.0.byte_count={model_bytes}")));
        assert!(module_plan.contains("module.1.kind=model-manifest"));
        assert!(module_plan.contains("module.1.assembly_slot=model-manifest"));
        assert!(module_plan.contains("module.1.role=model-provenance-manifest"));
        assert!(module_plan.contains("module.1.phase=verify-model-manifest"));
        assert!(module_plan.contains("module.1.depends_on=module.0"));
        assert!(module_plan.contains(&format!("module.1.byte_count={manifest_bytes}")));
        assert!(module_plan.contains("module.2.kind=assembly-receipt"));
        assert!(module_plan.contains("module.2.assembly_slot=assembly-receipt"));
        assert!(module_plan.contains("module.2.role=assembly-evidence"));
        assert!(module_plan.contains("module.2.phase=verify-assembly-evidence"));
        assert!(module_plan.contains("module.2.depends_on=module.1"));
        assert!(module_plan.contains(&format!("module.2.byte_count={assembly_receipt_bytes}")));
        assert!(module_plan.contains("module.3.kind=adapter-family-receipt"));
        assert!(module_plan.contains("module.3.assembly_slot=adapter-family-receipt"));
        assert!(module_plan.contains("module.3.role=adapter-family"));
        assert!(module_plan.contains("module.3.phase=verify-adapter-family"));
        assert!(module_plan.contains("module.3.depends_on=module.2"));
        assert!(module_plan.contains(&format!(
            "module.3.byte_count={adapter_family_receipt_bytes}"
        )));
        assert!(module_plan.contains("module.4.kind=adapter-stack-member"));
        assert!(module_plan.contains("module.4.assembly_slot=adapter-stack-0"));
        assert!(module_plan.contains("module.4.role=adapter-stack-family-delta"));
        assert!(module_plan.contains("module.4.phase=apply-adapter-stack-0"));
        assert!(module_plan.contains("module.4.depends_on=module.3"));
        assert!(module_plan.contains(&format!("module.4.byte_count={family_adapter_bytes}")));
        assert!(module_plan.contains("module.4.checksum=0x"));
        assert!(module_plan.contains("module.4.adapter_index=1"));
        assert!(module_plan.contains(&format!("module.4.adapter_path=../models/{id}-family.adp1")));
        assert!(module_plan.contains("module.5.kind=adapter-stack-member"));
        assert!(module_plan.contains("module.5.assembly_slot=adapter-stack-1"));
        assert!(module_plan.contains("module.5.role=adapter-stack-sparse-delta"));
        assert!(module_plan.contains("module.5.phase=apply-adapter-stack-1"));
        assert!(module_plan.contains("module.5.depends_on=module.4"));
        assert!(module_plan.contains(&format!("module.5.byte_count={sparse_adapter_bytes}")));
        assert!(module_plan.contains("module.5.checksum=0x"));
        assert!(module_plan.contains("module.5.adapter_index=2"));
        assert!(module_plan.contains(&format!("module.5.adapter_path=../models/{id}-sparse.asp1")));
        assert!(module_plan.contains("module.6.kind=adapter-stack-member"));
        assert!(module_plan.contains("module.6.assembly_slot=adapter-stack-2"));
        assert!(module_plan.contains("module.6.role=adapter-stack-low-rank-delta"));
        assert!(module_plan.contains("module.6.phase=apply-adapter-stack-2"));
        assert!(module_plan.contains("module.6.depends_on=module.5"));
        assert!(module_plan.contains(&format!("module.6.byte_count={low_rank_adapter_bytes}")));
        assert!(module_plan.contains("module.6.checksum=0x"));
        assert!(module_plan.contains("module.6.adapter_index=3"));
        assert!(module_plan.contains(&format!(
            "module.6.adapter_path=../models/{id}-low-rank.alr1"
        )));
    }

    #[test]
    fn writes_browser_multi_parent_bundle() {
        let root = unique_dir("bundle").join("tinyrustlm");
        write_bundle_path_with_quantization(&root, "f32").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry.0.candidate_id=multi-parent-sign-merge-f32"));
        assert!(registry.contains("selector_model_byte_budget=33554432"));
        assert!(registry.contains("selector_registry_text_byte_budget=262144"));
        assert!(registry.contains("manifest_text_byte_budget=65536"));
        assert!(registry.contains("receipt_text_byte_budget=131072"));
        assert!(registry.contains("evidence_text_byte_budget=131072"));
        assert!(registry.contains("entry.0.model_path=../models/multi-parent-sign-merge-f32.slm"));
        assert!(registry.contains("entry.0.eval_case_evidence_checksum=0x"));
        assert!(registry
            .contains("entry.0.adapter_path=../models/multi-parent-sign-merge-f32-self.adp1"));
        assert!(registry.contains("entry.0.adapter_label=Multi-parent sign-merge f32 self ADP1"));
        assert!(registry.contains("entry.0.adapter_count=4"));
        assert!(registry
            .contains("entry.0.adapter.1.path=../models/multi-parent-sign-merge-f32-family.adp1"));
        assert!(
            registry.contains("entry.0.adapter.1.label=Multi-parent sign-merge f32 family ADP1")
        );
        assert!(registry
            .contains("entry.0.adapter.2.path=../models/multi-parent-sign-merge-f32-sparse.asp1"));
        assert!(
            registry.contains("entry.0.adapter.2.label=Multi-parent sign-merge f32 sparse ASP1")
        );
        assert!(registry.contains(
            "entry.0.adapter.3.path=../models/multi-parent-sign-merge-f32-low-rank.alr1"
        ));
        assert!(
            registry.contains("entry.0.adapter.3.label=Multi-parent sign-merge f32 low-rank ALR1")
        );
        assert!(registry.contains(
            "entry.0.adapter_family_receipt_path=../models/multi-parent-sign-merge-f32.adapter-family.receipt"
        ));
        assert!(registry.contains("entry.0.adapter_family_status=receipt-validated"));
        assert!(registry.contains("entry.0.adapter_family_adapter_count=4"));
        assert!(registry.contains("entry.0.adapter_auto_apply_status=enabled"));
        assert!(
            registry.contains("entry.0.adapter_auto_apply_strategy=receipt-preferred-compatible")
        );
        assert!(registry.contains("entry.0.adapter_auto_apply_stack_status=enabled"));
        assert!(registry.contains(
            "entry.0.adapter_auto_apply_stack_strategy=receipt-declared-compatible-stack"
        ));
        assert!(registry.contains("entry.0.adapter_auto_apply_stack_count=3"));
        assert!(registry.contains("entry.0.adapter_auto_apply_byte_budget=1048576"));
        let family_receipt = fs::read_to_string(
            root.join("models")
                .join("multi-parent-sign-merge-f32.adapter-family.receipt"),
        )
        .unwrap();
        assert!(family_receipt.contains("adapter_family_preferred_adapter_index=2"));
        assert!(family_receipt.contains(
            "adapter_family_preferred_adapter_path=../models/multi-parent-sign-merge-f32-sparse.asp1"
        ));
        assert!(family_receipt.contains("adapter_family_auto_apply_stack_count=3"));
        assert!(family_receipt.contains("adapter_family_auto_apply_stack.0.adapter_index=1"));
        assert!(family_receipt.contains(
            "adapter_family_auto_apply_stack.0.adapter_path=../models/multi-parent-sign-merge-f32-family.adp1"
        ));
        assert!(family_receipt.contains("adapter_family_auto_apply_stack.1.adapter_index=2"));
        assert!(family_receipt.contains(
            "adapter_family_auto_apply_stack.1.adapter_path=../models/multi-parent-sign-merge-f32-sparse.asp1"
        ));
        assert!(family_receipt.contains("adapter_family_auto_apply_stack.2.adapter_index=3"));
        assert!(family_receipt.contains(
            "adapter_family_auto_apply_stack.2.adapter_path=../models/multi-parent-sign-merge-f32-low-rank.alr1"
        ));
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
        assert!(assembly_receipt.contains("eval_case_evidence_checksum=0x"));
        assert!(assembly_receipt.contains("operator_receipt_checksum=0x"));
        assert!(
            assembly_receipt.contains("required_next_gate=browser-selector-registry-route-binding")
        );
        assert_module_plan(&root, "multi-parent-sign-merge-f32", "f32", &registry);
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
            .join("multi-parent-sign-merge-f32-sparse.asp1")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-sparse.asp1.manifest")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-low-rank.alr1")
            .exists());
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32-low-rank.alr1.manifest")
            .exists());
        let sparse_manifest = fs::read_to_string(
            root.join("models")
                .join("multi-parent-sign-merge-f32-sparse.asp1.manifest"),
        )
        .unwrap();
        assert!(sparse_manifest.contains("adapter_artifact_kind=sparse-f32-task-delta-v1"));
        let low_rank_manifest = fs::read_to_string(
            root.join("models")
                .join("multi-parent-sign-merge-f32-low-rank.alr1.manifest"),
        )
        .unwrap();
        assert!(low_rank_manifest.contains("adapter_artifact_kind=low-rank-f32-task-delta-v1"));
        assert!(low_rank_manifest.contains("adapter_dtype=low-rank-f32-delta"));
        assert!(root
            .join("models")
            .join("multi-parent-sign-merge-f32.adapter-family.receipt")
            .exists());
        assert!(root.join("app").join("index.html").exists());
        assert!(root.join("app").join("app.css").exists());
        assert!(root.join("app").join("app.js").exists());
        assert!(root.join("runtime").join("tinyrustlm.wasm").exists());
        assert_runtime_manifest(&root);

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
            assert!(registry.contains("selector_model_byte_budget=33554432"));
            assert!(registry.contains("selector_registry_text_byte_budget=262144"));
            assert!(registry.contains("manifest_text_byte_budget=65536"));
            assert!(registry.contains("receipt_text_byte_budget=131072"));
            assert!(registry.contains("evidence_text_byte_budget=131072"));
            assert!(registry.contains(&format!("entry.0.quantization={quantization}")));
            assert!(registry.contains(&format!("entry.0.model_path=../models/{id}.slm")));
            assert!(registry.contains("entry.0.eval_case_evidence_checksum=0x"));
            assert!(registry.contains(&format!("entry.0.adapter_path=../models/{id}-self.adp1")));
            assert!(registry
                .contains("entry.0.adapter_apply_status=runtime-q8-q4-compatible-or-fuse-to-slm"));
            assert!(registry.contains(&format!(
                "entry.0.adapter.1.path=../models/{id}-family.adp1"
            )));
            assert!(registry.contains(&format!(
                "entry.0.adapter.2.path=../models/{id}-sparse.asp1"
            )));
            assert!(registry.contains(&format!(
                "entry.0.adapter_family_receipt_path=../models/{id}.adapter-family.receipt"
            )));
            assert!(registry.contains("entry.0.adapter_family_adapter_count=4"));
            assert!(registry.contains("entry.0.adapter_auto_apply_status=enabled"));
            assert!(registry
                .contains("entry.0.adapter_auto_apply_strategy=receipt-preferred-compatible"));
            assert!(registry.contains("entry.0.adapter_auto_apply_stack_status=enabled"));
            assert!(registry.contains(
                "entry.0.adapter_auto_apply_stack_strategy=receipt-declared-compatible-stack"
            ));
            assert!(registry.contains("entry.0.adapter_auto_apply_stack_count=3"));
            assert!(registry.contains("entry.0.adapter_auto_apply_byte_budget=1048576"));
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
            assert!(family_receipt.contains("adapter_family_preferred_adapter_index=2"));
            assert!(family_receipt.contains(&format!(
                "adapter_family_preferred_adapter_path=../models/{id}-sparse.asp1"
            )));
            assert!(family_receipt.contains("adapter_family_auto_apply_stack_count=3"));
            assert!(family_receipt.contains("adapter_family_auto_apply_stack.0.adapter_index=1"));
            assert!(family_receipt.contains(&format!(
                "adapter_family_auto_apply_stack.0.adapter_path=../models/{id}-family.adp1"
            )));
            assert!(family_receipt.contains("adapter_family_auto_apply_stack.1.adapter_index=2"));
            assert!(family_receipt.contains(&format!(
                "adapter_family_auto_apply_stack.1.adapter_path=../models/{id}-sparse.asp1"
            )));
            assert!(family_receipt.contains("adapter_family_auto_apply_stack.2.adapter_index=3"));
            assert!(family_receipt.contains(&format!(
                "adapter_family_auto_apply_stack.2.adapter_path=../models/{id}-low-rank.alr1"
            )));
            assert_module_plan(&root, &id, quantization, &registry);
            let assembly_receipt =
                fs::read_to_string(root.join("models").join(format!("{id}.assembly.receipt")))
                    .unwrap();
            assert!(assembly_receipt.contains(&format!(
                "promotion_ledger_path=../evidence/{id}/population.ledger"
            )));
            assert!(assembly_receipt.contains("eval_case_evidence_checksum=0x"));
            assert!(root.join("models").join(format!("{id}.slm")).exists());
            assert!(root
                .join("models")
                .join(format!("{id}-family.adp1.manifest"))
                .exists());
            assert!(root
                .join("models")
                .join(format!("{id}-sparse.asp1.manifest"))
                .exists());
            assert!(root
                .join("models")
                .join(format!("{id}-low-rank.alr1.manifest"))
                .exists());
            assert_runtime_manifest(&root);
            fs::remove_dir_all(root.parent().unwrap()).unwrap();
        }
    }

    #[test]
    fn writes_combined_browser_multi_parent_bundle() {
        let root = unique_dir("combined").join("tinyrustlm");
        write_bundle_path_with_quantization(&root, "all").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry_count=3"));
        assert!(registry.contains("selector_model_byte_budget=33554432"));
        assert!(registry.contains("selector_registry_text_byte_budget=262144"));
        assert!(registry.contains("manifest_text_byte_budget=65536"));
        assert!(registry.contains("receipt_text_byte_budget=131072"));
        assert!(registry.contains("evidence_text_byte_budget=131072"));
        assert!(registry.contains("selector_default_strategy=browser-frugal-quantized"));
        assert!(registry.contains("selector_default_candidate_id=multi-parent-sign-merge-q4"));
        assert!(registry.contains("selector_default_quantization=q4_0"));
        for (index, quantization, suffix) in
            [(0, "f32", "f32"), (1, "q8_0", "q8"), (2, "q4_0", "q4")]
        {
            let id = format!("multi-parent-sign-merge-{suffix}");
            assert!(registry.contains(&format!("entry.{index}.candidate_id={id}")));
            assert!(registry.contains(&format!("entry.{index}.quantization={quantization}")));
            assert!(registry.contains(&format!("entry.{index}.model_path=../models/{id}.slm")));
            assert!(registry.contains(&format!("entry.{index}.adapter_count=4")));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter.2.path=../models/{id}-sparse.asp1"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter.3.path=../models/{id}-low-rank.alr1"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter_family_receipt_path=../models/{id}.adapter-family.receipt"
            )));
            assert!(registry.contains(&format!("entry.{index}.adapter_auto_apply_status=enabled")));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter_auto_apply_strategy=receipt-preferred-compatible"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter_auto_apply_stack_status=enabled"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter_auto_apply_stack_strategy=receipt-declared-compatible-stack"
            )));
            assert!(registry.contains(&format!("entry.{index}.adapter_auto_apply_stack_count=3")));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter_auto_apply_byte_budget=1048576"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.assembly_receipt_path=../models/{id}.assembly.receipt"
            )));
            let family_receipt = fs::read_to_string(
                root.join("models")
                    .join(format!("{id}.adapter-family.receipt")),
            )
            .unwrap();
            assert!(family_receipt.contains("adapter_family_preferred_adapter_index=2"));
            assert!(family_receipt.contains(&format!(
                "adapter_family_preferred_adapter_path=../models/{id}-sparse.asp1"
            )));
            assert!(family_receipt.contains("adapter_family_auto_apply_stack_count=3"));
            assert!(family_receipt.contains(&format!(
                "adapter_family_auto_apply_stack.0.adapter_path=../models/{id}-family.adp1"
            )));
            assert!(family_receipt.contains(&format!(
                "adapter_family_auto_apply_stack.1.adapter_path=../models/{id}-sparse.asp1"
            )));
            assert!(family_receipt.contains(&format!(
                "adapter_family_auto_apply_stack.2.adapter_path=../models/{id}-low-rank.alr1"
            )));
            assert_module_plan(&root, &id, quantization, &registry);
            assert!(root.join("models").join(format!("{id}.slm")).exists());
            assert!(root
                .join("evidence")
                .join(&id)
                .join("sign-merge.multi.admission")
                .exists());
        }
        assert!(root.join("app").join("app.js").exists());
        assert!(root.join("runtime").join("tinyrustlm.wasm").exists());
        assert_runtime_manifest(&root);

        fs::remove_dir_all(root.parent().unwrap()).unwrap();
    }

    #[test]
    fn writes_standalone_runtime_manifest() {
        let root = unique_dir("runtime-manifest");
        fs::create_dir_all(&root).unwrap();
        let wasm_path = root.join("tinyrustlm.wasm");
        let manifest_path = root.join("tinyrustlm.wasm.manifest");
        fs::write(&wasm_path, [0x00, 0x61, 0x73, 0x6d]).unwrap();

        write_runtime_wasm_manifest_path(&wasm_path, &manifest_path).unwrap();

        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("tinyrustlm_wasm_manifest_version=1"));
        assert!(manifest.contains("runtime_kind=tinyrustlm-rust-wasm"));
        assert!(manifest.contains("runtime_status=validated-local-runtime"));
        assert!(manifest.contains("runtime_wasm_path=../runtime/tinyrustlm.wasm"));
        assert!(manifest.contains("runtime_wasm_bytes=4"));
        assert!(manifest.contains(&format!(
            "runtime_wasm_checksum={}",
            hex64(provenance::text_checksum(&[0x00, 0x61, 0x73, 0x6d]))
        )));
        assert!(manifest.contains("required_next_gate=instantiate-wasm-runtime"));

        fs::remove_dir_all(root).unwrap();
    }

    fn assert_runtime_manifest(root: &Path) {
        let wasm_path = root.join("runtime").join("tinyrustlm.wasm");
        let manifest_path = root.join("runtime").join("tinyrustlm.wasm.manifest");
        let wasm_bytes = fs::read(&wasm_path).unwrap();
        let manifest = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest.contains("tinyrustlm_wasm_manifest_version=1"));
        assert!(manifest.contains("runtime_kind=tinyrustlm-rust-wasm"));
        assert!(manifest.contains("runtime_status=validated-local-runtime"));
        assert!(manifest.contains("runtime_wasm_path=../runtime/tinyrustlm.wasm"));
        assert!(manifest.contains(&format!("runtime_wasm_bytes={}", wasm_bytes.len())));
        assert!(manifest.contains(&format!(
            "runtime_wasm_checksum={}",
            hex64(provenance::text_checksum(&wasm_bytes))
        )));
        assert!(manifest.contains("required_next_gate=instantiate-wasm-runtime"));
    }

    fn unique_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-browser-bundle-{label}-{nanos}"))
    }
}
