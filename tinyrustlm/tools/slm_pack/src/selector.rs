//! Browser selector registries built from admitted model-breeding records.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::Path;

use crate::admission;
use crate::multi_admission;
use crate::provenance;

const REGISTRY_VERSION: &str = "1";
const REGISTRY_SCOPE: &str = "browser-local-model-selector";
const REGISTRY_STATUS: &str = "admitted-records-only";
const ENTRY_STATUS: &str = "admitted";
const PUBLIC_CLAIM_STATUS: &str = "bound-to-eval-scope";
const REQUIRED_NEXT_GATE: &str = "browser-loads-selector-registry-entry-models";
const SELECTOR_DEFAULT_STRATEGY: &str = "browser-frugal-quantized";
const SELECTOR_MODEL_BYTE_BUDGET: u64 = 32 * 1024 * 1024;
const SELECTOR_REGISTRY_TEXT_BYTE_BUDGET: u64 = 256 * 1024;
const MANIFEST_TEXT_BYTE_BUDGET: u64 = 64 * 1024;
const RECEIPT_TEXT_BYTE_BUDGET: u64 = 128 * 1024;
const EVIDENCE_TEXT_BYTE_BUDGET: u64 = 128 * 1024;
const ADAPTER_APPLY_STATUS_F32: &str = "runtime-f32-compatible-or-fuse-to-slm";
const ADAPTER_APPLY_STATUS_QUANTIZED: &str = "runtime-q8-q4-compatible-or-fuse-to-slm";
const LOW_RANK_APPLY_STATUS_F32: &str = "runtime-f32-compatible-low-rank";
const LOW_RANK_APPLY_STATUS_QUANTIZED: &str = "runtime-q8-q4-compatible-low-rank";
const ADAPTER_FAMILY_STATUS: &str = "receipt-validated";
const ADAPTER_FAMILY_STRATEGY: &str = "single-adapter-selection";
const ADAPTER_AUTO_APPLY_STATUS: &str = "enabled";
const ADAPTER_AUTO_APPLY_STRATEGY: &str = "receipt-preferred-compatible";
const ADAPTER_AUTO_APPLY_STACK_STATUS: &str = "enabled";
const ADAPTER_AUTO_APPLY_STACK_STRATEGY: &str = "receipt-declared-compatible-stack";
const ADAPTER_AUTO_APPLY_BYTE_BUDGET: u64 = 1024 * 1024;
const ASSEMBLY_RECEIPT_STATUS: &str = "receipt-validated";
const ASSEMBLY_RECEIPT_KIND: &str = "browser-local-assembly-evidence";
const MODULE_PLAN_STATUS: &str = "receipt-validated";
const MODULE_PLAN_KIND: &str = "browser-local-module-plan";
const MODULE_PLAN_STRATEGY: &str = "selector-entry-self-assembly";
const MODULE_PLAN_RESOURCE_CLASS: &str = "browser-constrained-local-assembly";
const MODULE_PLAN_PROFILE: &str = "browser-constrained-v1";
const MODULE_PLAN_EXECUTION_PROFILE: &str = "single-threaded-wasm-local-v1";
const MODULE_PLAN_FETCH_POLICY: &str = "local-no-store-v1";
const MODULE_PLAN_ORIGIN_POLICY: &str = "same-origin-loopback-local-v1";
const MODULE_PLAN_FETCH_COUNT_LIMIT: u64 = 32;
const MODULE_PLAN_ROUTE_SET_VERSION: &str = "1";
const MODULE_PLAN_ROUTE_SET_CHECKSUM_ALGORITHM: &str = "tinyrustlm-text-checksum-v1";
const MODULE_PLAN_ASSEMBLY_EVIDENCE_FILE_COUNT: u64 = 9;
const MODULE_PLAN_WASM_MEMORY_INITIAL_PAGES: u64 = 17;
const MODULE_PLAN_WASM_EXPORT_SET: &str = "tinyrustlm-generate-v1";
const MODULE_PLAN_WASM_TRANSFER_STRATEGY: &str = "copy-then-release-v1";
const MODULE_PLAN_MODEL_RELEASE_STRATEGY: &str = "free-before-reassembly-v1";
const MODULE_PLAN_RUNTIME_RESET_STRATEGY: &str = "reset-context-before-assembly-v1";
const MODULE_PLAN_ADAPTER_VALIDATION_STRATEGY: &str = "rust-validate-before-apply-v1";
const MODULE_PLAN_WASM_HEAP_MIN_BYTES: u64 = 64 * 1024;
const MODULE_PLAN_CONTEXT_TOKEN_LIMIT_LIMIT: u64 = 4096;
const MODULE_PLAN_SAMPLER_CANDIDATE_CAP: u64 = 1024;
const MODULE_PLAN_PROMPT_BYTE_LIMIT: u64 = 4 * 1024;
const MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET: u64 = 64 * 1024;
const MODULE_PLAN_OUTPUT_BYTE_LIMIT: u64 = 64 * 1024;
const MODULE_PLAN_KV_CACHE_BYTE_BUDGET_LIMIT: u64 = 8 * 1024 * 1024;
const MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT: u64 = SELECTOR_MODEL_BYTE_BUDGET
    + ADAPTER_AUTO_APPLY_BYTE_BUDGET
    + MODULE_PLAN_KV_CACHE_BYTE_BUDGET_LIMIT
    + MANIFEST_TEXT_BYTE_BUDGET
    + RECEIPT_TEXT_BYTE_BUDGET
    + RECEIPT_TEXT_BYTE_BUDGET
    + MODULE_PLAN_PROMPT_BYTE_LIMIT
    + MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET
    + MODULE_PLAN_OUTPUT_BYTE_LIMIT;
const GENOME_STRATEGY: &str = "selector-admission-genome-v1";
const GENOME_LINEAGE_STATUS: &str = "admission-bound";
const SPECIES_STRATEGY: &str = "selector-speciation-fit-v1";
const SPECIES_FIT_STATUS: &str = "browser-fit-bound";
const NOVELTY_STRATEGY: &str = "selector-novelty-sketch-v1";
const NOVELTY_STATUS: &str = "behavior-sketch-bound";
const POPULATION_STRATEGY: &str = "selector-population-review-route-v1";
const POPULATION_STATUS: &str = "population-review-bound";
const MATE_SELECTION_STRATEGY: &str = "selector-mate-selection-route-v1";
const MATE_SELECTION_PARENT_POOL_STATUS: &str = "parent-pool-bound";
const MATE_SELECTION_ADMISSION_STATUS: &str = "admission-only";
const EVOLUTION_RECIPE_VERSION: &str = "1";
const EVOLUTION_RECIPE_STRATEGY: &str = "population-based-parent-pool-replay-v1";
const EVOLUTION_RECIPE_STATUS: &str = "operator-family-planned";
const EVOLUTION_SELECTION_SOURCE: &str = "population-fitness-normalized-seed-weights";
const EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM: &str = "tinyrustlm-text-checksum-v1";
const PHENOTYPE_EVIDENCE_STRATEGY: &str = "selector-phenotype-evidence-v1";
const PHENOTYPE_EVIDENCE_STATUS: &str = "runtime-eval-bound";
const HERITABLE_ARTIFACT_STRATEGY: &str = "selector-heritable-artifact-v1";
const HERITABLE_ARTIFACT_STATUS: &str = "served-artifact-bound";
const FITNESS_VECTOR_STATUS: &str = "eval-bound";
const SOURCE_MANIFEST_KIND: &str = "trained-source-manifest";
const SOURCE_MANIFEST_STATUS: &str = "reviewed-source-snapshot";
const SOURCE_REVIEW_KIND: &str = "safetensors-candidate-review";
const SOURCE_REVIEW_STATUS: &str = "validated-before-extraction";
const SOURCE_REVIEW_REQUIRED_NEXT_GATE: &str = "extract-raw-f32-tensors";
const EVOLUTION_SCHEDULE_KEYS: &[&str] = &[
    "evolution_recipe_version",
    "evolution_recipe_strategy",
    "evolution_recipe_status",
    "evolution_selection_source",
    "evolution_relatedness_contract_checksum",
    "evolution_schedule_checksum_algorithm",
    "evolution_schedule_checksum",
    "scheduled_operator_family_index",
    "scheduled_operator_family_kind",
    "scheduled_operator_family_command",
    "scheduled_operator_family_selection_rule",
    "scheduled_operator_family_output_gate",
];
const ADAPTER_KEY_SUFFIXES: &[&str] = &[
    "adapter_path",
    "adapter_manifest_path",
    "adapter_label",
    "adapter_apply_status",
    "adapter_artifact_checksum",
    "adapter_manifest_checksum",
    "adapter_count",
];
const ADAPTER_FAMILY_KEY_SUFFIXES: &[&str] = &[
    "adapter_family_receipt_path",
    "adapter_family_receipt_checksum",
    "adapter_family_label",
    "adapter_family_status",
    "adapter_family_strategy",
    "adapter_family_adapter_count",
    "adapter_auto_apply_status",
    "adapter_auto_apply_strategy",
    "adapter_auto_apply_stack_status",
    "adapter_auto_apply_stack_strategy",
    "adapter_auto_apply_stack_count",
    "adapter_auto_apply_byte_budget",
];
const ASSEMBLY_RECEIPT_KEY_SUFFIXES: &[&str] = &[
    "assembly_receipt_path",
    "assembly_receipt_checksum",
    "assembly_label",
    "assembly_status",
    "assembly_kind",
];
const MODULE_PLAN_KEY_SUFFIXES: &[&str] = &[
    "module_plan_path",
    "module_plan_checksum",
    "module_plan_label",
    "module_plan_status",
    "module_plan_kind",
    "module_plan_strategy",
    "module_plan_resource_class",
    "module_plan_profile",
    "module_plan_execution_profile",
    "module_plan_fetch_policy",
    "module_plan_origin_policy",
    "module_plan_fetch_count_limit",
    "module_plan_planned_fetch_count",
    "module_plan_route_set_version",
    "module_plan_route_set_checksum_algorithm",
    "module_plan_route_set_checksum",
    "module_plan_operator_receipt_path",
    "module_plan_operator_receipt_checksum",
    "module_plan_wasm_memory_initial_pages",
    "module_plan_wasm_export_set",
    "module_plan_wasm_transfer_strategy",
    "module_plan_model_release_strategy",
    "module_plan_runtime_reset_strategy",
    "module_plan_adapter_validation_strategy",
    "module_plan_adapter_validation_count",
    "module_plan_adapter_apply_count",
    "module_plan_wasm_heap_min_bytes",
    "module_plan_context_token_limit",
    "module_plan_sampler_candidate_cap",
    "module_plan_tokenizer_checksum",
    "module_plan_prompt_byte_limit",
    "module_plan_model_byte_budget",
    "module_plan_adapter_byte_budget",
    "module_plan_adapter_stack_byte_budget",
    "module_plan_runtime_scratch_byte_budget",
    "module_plan_output_byte_limit",
    "module_plan_kv_cache_byte_budget",
    "module_plan_kv_cache_page_count",
    "module_plan_total_byte_budget",
    "module_plan_total_byte_budget_limit",
    "module_plan_module_count",
];

struct RegistryEntry {
    candidate_id: String,
    display_name: String,
    artifact_path: String,
    model_path: String,
    manifest_path: String,
    source_manifest: Option<RegistrySourceManifestRoute>,
    source_validation: Option<RegistrySourceValidationRoute>,
    max_tokens: String,
    model_bytes: String,
    slm_checksum: String,
    tokenizer_checksum: String,
    model_shape: String,
    quantization: String,
    output_contract: String,
    admission_path: Option<String>,
    admission_checksum: String,
    promotion_manifest_checksum: String,
    provenance_manifest_checksum: String,
    runtime_smoke_path: Option<String>,
    runtime_smoke_manifest_checksum: String,
    eval_path: Option<String>,
    eval_manifest_checksum: String,
    eval_case_evidence_checksum: String,
    quality_scope: String,
    quality_boundary: String,
    eval_dataset: String,
    cases_passed: String,
    admission_kind: String,
    operator_receipt: Option<RegistryOperatorReceipt>,
    operator_receipt_checksum: Option<String>,
    parent_pool_recipe_checksum: Option<String>,
    population_review_checksum: Option<String>,
    promotion_ledger_checksum: Option<String>,
    admission_set_checksum: Option<String>,
    parent_count: usize,
    evolution_schedule: Option<RegistryEvolutionSchedule>,
    adapters: Vec<RegistryAdapterRoute>,
    adapter_family: Option<RegistryAdapterFamilyRoute>,
    assembly: Option<RegistryAssemblyRoute>,
    module_plan: Option<RegistryModulePlanRoute>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrySourceManifestRoute {
    path: String,
    checksum: String,
    kind: String,
    status: String,
    source_kind: String,
    source_id: String,
    model_shape: String,
    source_review: Option<RegistrySourceReviewRoute>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrySourceReviewRoute {
    kind: String,
    path: String,
    status: String,
    checksum: String,
    required_next_gate: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistrySourceValidationRoute {
    path: String,
    checksum: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistryOperatorReceipt {
    status: String,
    path: String,
    checksum: String,
    operator_id: String,
    operator_kind: String,
    candidate_slm_checksum: String,
    candidate_artifact_bytes: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RegistryEvolutionSchedule {
    recipe_version: String,
    recipe_strategy: String,
    recipe_status: String,
    selection_source: String,
    relatedness_contract_checksum: String,
    schedule_checksum_algorithm: String,
    schedule_checksum: String,
    family_index: String,
    family_kind: String,
    family_command: String,
    family_selection_rule: String,
    family_output_gate: String,
}

/// Optional browser-local adapter sidecar metadata for a selector registry entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RegistryAdapterRoute {
    pub(crate) candidate_id: String,
    pub(crate) adapter_path: String,
    pub(crate) manifest_path: String,
    pub(crate) label: String,
    pub(crate) apply_status: String,
    pub(crate) artifact_checksum: String,
    pub(crate) manifest_checksum: String,
}

/// Optional browser-local adapter family receipt metadata for a selector entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RegistryAdapterFamilyRoute {
    pub(crate) candidate_id: String,
    pub(crate) receipt_path: String,
    pub(crate) label: String,
    pub(crate) status: String,
    pub(crate) strategy: String,
    pub(crate) receipt_checksum: String,
    pub(crate) adapter_count: usize,
    pub(crate) auto_apply_status: String,
    pub(crate) auto_apply_strategy: String,
    pub(crate) auto_apply_stack_status: String,
    pub(crate) auto_apply_stack_strategy: String,
    pub(crate) auto_apply_stack_count: usize,
    pub(crate) auto_apply_byte_budget: u64,
}

/// Optional browser-local assembly evidence receipt metadata for a selector entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RegistryAssemblyRoute {
    pub(crate) candidate_id: String,
    pub(crate) receipt_path: String,
    pub(crate) label: String,
    pub(crate) status: String,
    pub(crate) kind: String,
    pub(crate) receipt_checksum: String,
}

/// Optional browser-local self-assembly module-plan receipt metadata for a selector entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RegistryModulePlanRoute {
    pub(crate) candidate_id: String,
    pub(crate) receipt_path: String,
    pub(crate) label: String,
    pub(crate) status: String,
    pub(crate) kind: String,
    pub(crate) strategy: String,
    pub(crate) resource_class: String,
    pub(crate) profile: String,
    pub(crate) execution_profile: String,
    pub(crate) fetch_policy: String,
    pub(crate) origin_policy: String,
    pub(crate) fetch_count_limit: u64,
    pub(crate) planned_fetch_count: u64,
    pub(crate) route_set_version: String,
    pub(crate) route_set_checksum_algorithm: String,
    pub(crate) route_set_checksum: String,
    pub(crate) operator_receipt_path: String,
    pub(crate) operator_receipt_checksum: String,
    pub(crate) wasm_memory_initial_pages: u64,
    pub(crate) wasm_export_set: String,
    pub(crate) wasm_transfer_strategy: String,
    pub(crate) model_release_strategy: String,
    pub(crate) runtime_reset_strategy: String,
    pub(crate) adapter_validation_strategy: String,
    pub(crate) adapter_validation_count: u64,
    pub(crate) adapter_apply_count: u64,
    pub(crate) wasm_heap_min_bytes: u64,
    pub(crate) context_token_limit: u64,
    pub(crate) sampler_candidate_cap: u64,
    pub(crate) tokenizer_checksum: String,
    pub(crate) prompt_byte_limit: u64,
    pub(crate) model_byte_budget: u64,
    pub(crate) adapter_byte_budget: u64,
    pub(crate) adapter_stack_byte_budget: u64,
    pub(crate) runtime_scratch_byte_budget: u64,
    pub(crate) output_byte_limit: u64,
    pub(crate) kv_cache_byte_budget: u64,
    pub(crate) kv_cache_page_count: u64,
    pub(crate) total_byte_budget: u64,
    pub(crate) total_byte_budget_limit: u64,
    pub(crate) receipt_checksum: String,
    pub(crate) module_count: usize,
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

/// Writes a browser selector registry with adapter, assembly, and module-plan receipts.
pub(crate) fn write_registry_with_module_plan_routes_path(
    output: &Path,
    admission_paths: &[String],
    adapter_routes: &[RegistryAdapterRoute],
    family_routes: &[RegistryAdapterFamilyRoute],
    assembly_routes: &[RegistryAssemblyRoute],
    module_plan_routes: &[RegistryModulePlanRoute],
) -> io::Result<()> {
    let admission_texts = read_admissions(admission_paths)?;
    let registry = build_registry_text_with_module_plan_routes(
        &admission_texts,
        adapter_routes,
        family_routes,
        assembly_routes,
        module_plan_routes,
    )?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output, registry)?;
    println!("SLM selector registry written: {}", output.display());
    println!("adapter_routes: {}", adapter_routes.len());
    println!("adapter_family_routes: {}", family_routes.len());
    println!("assembly_routes: {}", assembly_routes.len());
    println!("module_plan_routes: {}", module_plan_routes.len());
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

pub(crate) fn build_registry_text(admission_texts: &[String]) -> io::Result<String> {
    build_registry_text_with_adapters(admission_texts, &[])
}

pub(crate) fn build_registry_text_with_adapters(
    admission_texts: &[String],
    adapter_routes: &[RegistryAdapterRoute],
) -> io::Result<String> {
    build_registry_text_with_adapter_families(admission_texts, adapter_routes, &[])
}

pub(crate) fn build_registry_text_with_adapter_families(
    admission_texts: &[String],
    adapter_routes: &[RegistryAdapterRoute],
    family_routes: &[RegistryAdapterFamilyRoute],
) -> io::Result<String> {
    build_registry_text_with_adapter_family_and_assembly_routes(
        admission_texts,
        adapter_routes,
        family_routes,
        &[],
    )
}

pub(crate) fn build_registry_text_with_adapter_family_and_assembly_routes(
    admission_texts: &[String],
    adapter_routes: &[RegistryAdapterRoute],
    family_routes: &[RegistryAdapterFamilyRoute],
    assembly_routes: &[RegistryAssemblyRoute],
) -> io::Result<String> {
    build_registry_text_with_module_plan_routes(
        admission_texts,
        adapter_routes,
        family_routes,
        assembly_routes,
        &[],
    )
}

pub(crate) fn build_registry_text_with_module_plan_routes(
    admission_texts: &[String],
    adapter_routes: &[RegistryAdapterRoute],
    family_routes: &[RegistryAdapterFamilyRoute],
    assembly_routes: &[RegistryAssemblyRoute],
    module_plan_routes: &[RegistryModulePlanRoute],
) -> io::Result<String> {
    let mut entries = entries_from_admissions(admission_texts)?;
    attach_adapter_routes(&mut entries, adapter_routes)?;
    attach_adapter_family_routes(&mut entries, family_routes)?;
    attach_assembly_routes(&mut entries, assembly_routes)?;
    attach_module_plan_routes(&mut entries, module_plan_routes)?;
    let selector_id = selector_id(admission_texts)?;
    let default_entry = default_selector_entry(&entries)?;
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_selector_registry_version",
        REGISTRY_VERSION,
    );
    push_line(&mut text, "selector_id", &selector_id);
    push_line(&mut text, "registry_scope", REGISTRY_SCOPE);
    push_line(&mut text, "registry_status", REGISTRY_STATUS);
    push_line(
        &mut text,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "selector_registry_text_byte_budget",
        &SELECTOR_REGISTRY_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "manifest_text_byte_budget",
        &MANIFEST_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "receipt_text_byte_budget",
        &RECEIPT_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "evidence_text_byte_budget",
        &EVIDENCE_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(&mut text, "entry_count", &entries.len().to_string());
    push_line(
        &mut text,
        "selector_default_strategy",
        SELECTOR_DEFAULT_STRATEGY,
    );
    push_line(
        &mut text,
        "selector_default_candidate_id",
        &default_entry.candidate_id,
    );
    push_line(
        &mut text,
        "selector_default_quantization",
        &default_entry.quantization,
    );
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
        if let Some(source_manifest) = &entry.source_manifest {
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_path"),
                &source_manifest.path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_checksum"),
                &source_manifest.checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_kind"),
                &source_manifest.kind,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_status"),
                &source_manifest.status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_source_kind"),
                &source_manifest.source_kind,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_source_id"),
                &source_manifest.source_id,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_manifest_model_shape"),
                &source_manifest.model_shape,
            );
            if let Some(source_review) = &source_manifest.source_review {
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_kind"),
                    &source_review.kind,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_path"),
                    &source_review.path,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_status"),
                    &source_review.status,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_checksum"),
                    &source_review.checksum,
                );
                push_line(
                    &mut text,
                    &format!("{prefix}.source_review_required_next_gate"),
                    &source_review.required_next_gate,
                );
            }
        }
        if let Some(source_validation) = &entry.source_validation {
            push_line(
                &mut text,
                &format!("{prefix}.source_validation_path"),
                &source_validation.path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.source_validation_checksum"),
                &source_validation.checksum,
            );
        }
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
            &format!("{prefix}.tokenizer_checksum"),
            &entry.tokenizer_checksum,
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
            &format!("{prefix}.genome_id"),
            &registry_entry_genome_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_strategy"),
            GENOME_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_lineage_status"),
            GENOME_LINEAGE_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.genome_lineage_checksum"),
            &registry_entry_genome_lineage_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_id"),
            &registry_entry_species_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_strategy"),
            SPECIES_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_fit_status"),
            SPECIES_FIT_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.species_fit_checksum"),
            &registry_entry_species_fit_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_id"),
            &registry_entry_novelty_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_strategy"),
            NOVELTY_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_status"),
            NOVELTY_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.novelty_checksum"),
            &registry_entry_novelty_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_id"),
            &registry_entry_population_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_strategy"),
            POPULATION_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_status"),
            POPULATION_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.population_checksum"),
            &registry_entry_population_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_id"),
            &registry_entry_mate_selection_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_strategy"),
            MATE_SELECTION_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_status"),
            registry_entry_mate_selection_status(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_parent_count"),
            &entry.parent_count.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.mate_selection_checksum"),
            &registry_entry_mate_selection_checksum(entry),
        );
        push_registry_operator_receipt_lines(&mut text, &prefix, entry);
        push_registry_evolution_schedule_lines(&mut text, &prefix, entry);
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_id"),
            &registry_entry_phenotype_evidence_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_strategy"),
            PHENOTYPE_EVIDENCE_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_status"),
            PHENOTYPE_EVIDENCE_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.phenotype_evidence_checksum"),
            &registry_entry_phenotype_evidence_checksum(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_id"),
            &registry_entry_heritable_artifact_id(entry),
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_strategy"),
            HERITABLE_ARTIFACT_STRATEGY,
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_status"),
            HERITABLE_ARTIFACT_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.heritable_artifact_checksum"),
            &registry_entry_heritable_artifact_checksum(entry),
        );
        if let Some(admission_path) = &entry.admission_path {
            push_line(
                &mut text,
                &format!("{prefix}.admission_path"),
                admission_path,
            );
        }
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
            &format!("{prefix}.provenance_manifest_checksum"),
            &entry.provenance_manifest_checksum,
        );
        if let Some(runtime_smoke_path) = &entry.runtime_smoke_path {
            push_line(
                &mut text,
                &format!("{prefix}.runtime_smoke_path"),
                runtime_smoke_path,
            );
        }
        push_line(
            &mut text,
            &format!("{prefix}.runtime_smoke_manifest_checksum"),
            &entry.runtime_smoke_manifest_checksum,
        );
        if let Some(eval_path) = &entry.eval_path {
            push_line(&mut text, &format!("{prefix}.eval_path"), eval_path);
        }
        push_line(
            &mut text,
            &format!("{prefix}.eval_manifest_checksum"),
            &entry.eval_manifest_checksum,
        );
        push_line(
            &mut text,
            &format!("{prefix}.eval_case_evidence_checksum"),
            &entry.eval_case_evidence_checksum,
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
            &format!("{prefix}.fitness_vector_status"),
            FITNESS_VECTOR_STATUS,
        );
        push_line(
            &mut text,
            &format!("{prefix}.fitness_vector_checksum"),
            &registry_entry_fitness_vector_checksum(entry),
        );
        if let Some(adapter) = entry.adapters.first() {
            push_line(
                &mut text,
                &format!("{prefix}.adapter_path"),
                &adapter.adapter_path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_manifest_path"),
                &adapter.manifest_path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_label"),
                &adapter.label,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_apply_status"),
                &adapter.apply_status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_artifact_checksum"),
                &adapter.artifact_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_manifest_checksum"),
                &adapter.manifest_checksum,
            );
        }
        if entry.adapters.len() > 1 {
            push_line(
                &mut text,
                &format!("{prefix}.adapter_count"),
                &entry.adapters.len().to_string(),
            );
            for (adapter_index, adapter) in entry.adapters.iter().enumerate() {
                let adapter_prefix = format!("{prefix}.adapter.{adapter_index}");
                push_line(
                    &mut text,
                    &format!("{adapter_prefix}.path"),
                    &adapter.adapter_path,
                );
                push_line(
                    &mut text,
                    &format!("{adapter_prefix}.manifest_path"),
                    &adapter.manifest_path,
                );
                push_line(
                    &mut text,
                    &format!("{adapter_prefix}.label"),
                    &adapter.label,
                );
                push_line(
                    &mut text,
                    &format!("{adapter_prefix}.apply_status"),
                    &adapter.apply_status,
                );
                push_line(
                    &mut text,
                    &format!("{adapter_prefix}.artifact_checksum"),
                    &adapter.artifact_checksum,
                );
                push_line(
                    &mut text,
                    &format!("{adapter_prefix}.manifest_checksum"),
                    &adapter.manifest_checksum,
                );
            }
        }
        if let Some(family) = &entry.adapter_family {
            push_line(
                &mut text,
                &format!("{prefix}.adapter_family_receipt_path"),
                &family.receipt_path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_family_receipt_checksum"),
                &family.receipt_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_family_label"),
                &family.label,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_family_status"),
                &family.status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_family_strategy"),
                &family.strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_family_adapter_count"),
                &family.adapter_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_auto_apply_status"),
                &family.auto_apply_status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_auto_apply_strategy"),
                &family.auto_apply_strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_auto_apply_stack_status"),
                &family.auto_apply_stack_status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_auto_apply_stack_strategy"),
                &family.auto_apply_stack_strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_auto_apply_stack_count"),
                &family.auto_apply_stack_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.adapter_auto_apply_byte_budget"),
                &family.auto_apply_byte_budget.to_string(),
            );
        }
        if let Some(assembly) = &entry.assembly {
            push_line(
                &mut text,
                &format!("{prefix}.assembly_receipt_path"),
                &assembly.receipt_path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.assembly_receipt_checksum"),
                &assembly.receipt_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.assembly_label"),
                &assembly.label,
            );
            push_line(
                &mut text,
                &format!("{prefix}.assembly_status"),
                &assembly.status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.assembly_kind"),
                &assembly.kind,
            );
        }
        if let Some(module_plan) = &entry.module_plan {
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_path"),
                &module_plan.receipt_path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_checksum"),
                &module_plan.receipt_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_label"),
                &module_plan.label,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_status"),
                &module_plan.status,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_kind"),
                &module_plan.kind,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_strategy"),
                &module_plan.strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_resource_class"),
                &module_plan.resource_class,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_profile"),
                &module_plan.profile,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_execution_profile"),
                &module_plan.execution_profile,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_fetch_policy"),
                &module_plan.fetch_policy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_origin_policy"),
                &module_plan.origin_policy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_fetch_count_limit"),
                &module_plan.fetch_count_limit.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_planned_fetch_count"),
                &module_plan.planned_fetch_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_route_set_version"),
                &module_plan.route_set_version,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_route_set_checksum_algorithm"),
                &module_plan.route_set_checksum_algorithm,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_route_set_checksum"),
                &module_plan.route_set_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_operator_receipt_path"),
                &module_plan.operator_receipt_path,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_operator_receipt_checksum"),
                &module_plan.operator_receipt_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_wasm_memory_initial_pages"),
                &module_plan.wasm_memory_initial_pages.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_wasm_export_set"),
                &module_plan.wasm_export_set,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_wasm_transfer_strategy"),
                &module_plan.wasm_transfer_strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_model_release_strategy"),
                &module_plan.model_release_strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_runtime_reset_strategy"),
                &module_plan.runtime_reset_strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_adapter_validation_strategy"),
                &module_plan.adapter_validation_strategy,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_adapter_validation_count"),
                &module_plan.adapter_validation_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_adapter_apply_count"),
                &module_plan.adapter_apply_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_wasm_heap_min_bytes"),
                &module_plan.wasm_heap_min_bytes.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_context_token_limit"),
                &module_plan.context_token_limit.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_sampler_candidate_cap"),
                &module_plan.sampler_candidate_cap.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_tokenizer_checksum"),
                &module_plan.tokenizer_checksum,
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_prompt_byte_limit"),
                &module_plan.prompt_byte_limit.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_model_byte_budget"),
                &module_plan.model_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_adapter_byte_budget"),
                &module_plan.adapter_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_adapter_stack_byte_budget"),
                &module_plan.adapter_stack_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_runtime_scratch_byte_budget"),
                &module_plan.runtime_scratch_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_output_byte_limit"),
                &module_plan.output_byte_limit.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_kv_cache_byte_budget"),
                &module_plan.kv_cache_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_kv_cache_page_count"),
                &module_plan.kv_cache_page_count.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_total_byte_budget"),
                &module_plan.total_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_total_byte_budget_limit"),
                &module_plan.total_byte_budget_limit.to_string(),
            );
            push_line(
                &mut text,
                &format!("{prefix}.module_plan_module_count"),
                &module_plan.module_count.to_string(),
            );
        }
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
    let actual = parse_manifest(registry_text, "selector registry")?;
    let adapter_routes = adapter_routes_from_registry(&actual)?;
    let family_routes = adapter_family_routes_from_registry(&actual)?;
    let assembly_routes = assembly_routes_from_registry(&actual)?;
    let module_plan_routes = module_plan_routes_from_registry(&actual)?;
    let expected_text = build_registry_text_with_module_plan_routes(
        admission_texts,
        &adapter_routes,
        &family_routes,
        &assembly_routes,
        &module_plan_routes,
    )?;
    let expected = parse_manifest(&expected_text, "expected selector registry")?;
    require_equal(
        &actual,
        "tinyrustlm_selector_registry_version",
        REGISTRY_VERSION,
    )?;
    require_equal(&actual, "registry_scope", REGISTRY_SCOPE)?;
    require_equal(&actual, "registry_status", REGISTRY_STATUS)?;
    require_equal(
        &actual,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "selector_registry_text_byte_budget",
        &SELECTOR_REGISTRY_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "manifest_text_byte_budget",
        &MANIFEST_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "receipt_text_byte_budget",
        &RECEIPT_TEXT_BYTE_BUDGET.to_string(),
    )?;
    require_equal(
        &actual,
        "evidence_text_byte_budget",
        &EVIDENCE_TEXT_BYTE_BUDGET.to_string(),
    )?;
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

fn default_selector_entry(entries: &[RegistryEntry]) -> io::Result<&RegistryEntry> {
    entries
        .iter()
        .min_by_key(|entry| {
            (
                quantization_default_rank(&entry.quantization),
                &entry.candidate_id,
            )
        })
        .ok_or_else(|| invalid("selector registry requires at least one admission record"))
}

fn quantization_default_rank(quantization: &str) -> u8 {
    match quantization {
        "q4_0" => 0,
        "q8_0" => 1,
        "f32" => 2,
        _ => 3,
    }
}

// Pulls each reviewed admission into the browser selector entry shape.
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
        let fields = validate_admission_summary_text(admission_text)?;
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
        let model_bytes = selector_model_bytes(require_key(&fields, "candidate_artifact_bytes")?)?;
        let tokenizer_checksum = require_key(&fields, "candidate_tokenizer_checksum")?.to_string();
        let source_manifest = registry_source_manifest_from_fields(&fields, &candidate_id)?;
        let source_validation = registry_source_validation_from_fields(&fields, &candidate_id)?;
        let runtime_smoke_path = registry_runtime_smoke_path_from_fields(&fields, &candidate_id)?;
        let eval_path = registry_eval_path_from_fields(&fields, &candidate_id)?;
        let operator_receipt = registry_operator_receipt_from_fields(&fields)?;
        let evolution_schedule =
            registry_evolution_schedule_from_fields(&fields, operator_receipt.as_ref())?;
        entries.push(RegistryEntry {
            candidate_id: candidate_id.clone(),
            display_name: display_name(
                &candidate_id,
                require_key(&fields, "candidate_quantization")?,
            ),
            artifact_path,
            model_path,
            manifest_path,
            source_manifest,
            source_validation,
            max_tokens: default_max_tokens(&model_shape).to_string(),
            model_bytes: model_bytes.to_string(),
            slm_checksum,
            tokenizer_checksum,
            model_shape,
            quantization: require_key(&fields, "candidate_quantization")?.to_string(),
            output_contract: require_key(&fields, "candidate_output_contract")?.to_string(),
            admission_path: registry_admission_path_from_fields(&fields, &candidate_id)?,
            admission_checksum: hex64(provenance::text_checksum(admission_text.as_bytes())),
            promotion_manifest_checksum: require_key(&fields, "promotion_manifest_checksum")?
                .to_string(),
            provenance_manifest_checksum: require_key(&fields, "provenance_manifest_checksum")?
                .to_string(),
            runtime_smoke_path,
            runtime_smoke_manifest_checksum: require_key(
                &fields,
                "runtime_smoke_manifest_checksum",
            )?
            .to_string(),
            eval_path,
            eval_manifest_checksum: require_key(&fields, "eval_manifest_checksum")?.to_string(),
            eval_case_evidence_checksum: require_key(&fields, "eval_case_evidence_checksum")?
                .to_string(),
            quality_scope: require_key(&fields, "quality_scope")?.to_string(),
            quality_boundary: require_key(&fields, "quality_boundary")?.to_string(),
            eval_dataset: require_key(&fields, "eval_dataset")?.to_string(),
            cases_passed: require_key(&fields, "cases_passed")?.to_string(),
            admission_kind: fields
                .get("admission_kind")
                .cloned()
                .unwrap_or_else(|| "selector-admission".to_string()),
            operator_receipt,
            operator_receipt_checksum: fields.get("operator_receipt_checksum").cloned(),
            parent_pool_recipe_checksum: fields.get("parent_pool_recipe_checksum").cloned(),
            population_review_checksum: fields.get("population_review_checksum").cloned(),
            promotion_ledger_checksum: fields.get("promotion_ledger_checksum").cloned(),
            admission_set_checksum: fields.get("admission_set_checksum").cloned(),
            parent_count: match fields.get("parent_count") {
                Some(value) => {
                    let count = value.parse::<usize>().map_err(|_| {
                        invalid("selector registry admission parent_count is invalid")
                    })?;
                    if count == 0 {
                        return Err(invalid(
                            "selector registry admission parent_count is invalid",
                        ));
                    }
                    count
                }
                None => 1,
            },
            evolution_schedule,
            adapters: Vec::new(),
            adapter_family: None,
            assembly: None,
            module_plan: None,
        });
    }
    Ok(entries)
}

// Copies optional reviewed source-manifest evidence into selector-owned route metadata.
fn registry_source_manifest_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<RegistrySourceManifestRoute>> {
    let keys = [
        "source_manifest_path",
        "source_manifest_checksum",
        "source_manifest_kind",
        "source_manifest_status",
        "source_manifest_source_kind",
        "source_manifest_source_id",
        "source_manifest_model_shape",
        "source_review_kind",
        "source_review_path",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    let has_source_manifest = keys.iter().any(|key| fields.contains_key(*key));
    if !has_source_manifest {
        return Ok(None);
    }
    let path = require_key(fields, "source_manifest_path")?.to_string();
    let checksum = require_key(fields, "source_manifest_checksum")?.to_string();
    let kind = require_key(fields, "source_manifest_kind")?.to_string();
    let status = require_key(fields, "source_manifest_status")?.to_string();
    let source_kind = require_key(fields, "source_manifest_source_kind")?.to_string();
    let source_id = require_key(fields, "source_manifest_source_id")?.to_string();
    let model_shape = require_key(fields, "source_manifest_model_shape")?.to_string();
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.source.manifest");
    if path != expected_path {
        return Err(invalid("selector registry source manifest path is invalid"));
    }
    validate_hex64(&checksum, "source_manifest_checksum")?;
    if kind != SOURCE_MANIFEST_KIND {
        return Err(invalid("selector registry source manifest kind is invalid"));
    }
    if status != SOURCE_MANIFEST_STATUS {
        return Err(invalid(
            "selector registry source manifest status is invalid",
        ));
    }
    match source_kind.as_str() {
        "trained-source-fixture" | "trained-export" => {}
        _ => {
            return Err(invalid(
                "selector registry source manifest source_kind is invalid",
            ))
        }
    }
    validate_registry_slug(&source_id, "source_manifest_source_id")?;
    validate_registry_slug(&model_shape, "source_manifest_model_shape")?;
    let source_review = registry_source_review_from_fields(fields, candidate_id)?;
    Ok(Some(RegistrySourceManifestRoute {
        path,
        checksum,
        kind,
        status,
        source_kind,
        source_id,
        model_shape,
        source_review,
    }))
}

fn registry_source_review_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<RegistrySourceReviewRoute>> {
    // Copies the pre-extraction safetensors review identity into the browser registry when present.
    let keys = [
        "source_review_kind",
        "source_review_path",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(None);
    }
    let kind = require_key(fields, "source_review_kind")?.to_string();
    let path = require_key(fields, "source_review_path")?.to_string();
    let status = require_key(fields, "source_review_status")?.to_string();
    let checksum = require_key(fields, "source_review_checksum")?.to_string();
    let required_next_gate = require_key(fields, "source_review_required_next_gate")?.to_string();
    if kind != SOURCE_REVIEW_KIND {
        return Err(invalid("selector registry source_review_kind is invalid"));
    }
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.source.review");
    if path != expected_path {
        return Err(invalid("selector registry source_review_path is invalid"));
    }
    validate_registry_evidence_path(&path, "source_review_path")?;
    if status != SOURCE_REVIEW_STATUS {
        return Err(invalid("selector registry source_review_status is invalid"));
    }
    validate_hex64(&checksum, "source_review_checksum")?;
    if required_next_gate != SOURCE_REVIEW_REQUIRED_NEXT_GATE {
        return Err(invalid(
            "selector registry source_review_required_next_gate is invalid",
        ));
    }
    Ok(Some(RegistrySourceReviewRoute {
        kind,
        path,
        status,
        checksum,
        required_next_gate,
    }))
}

fn registry_source_validation_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<RegistrySourceValidationRoute>> {
    // Preserves the validate-source sidecar only when it is scoped to the candidate evidence folder.
    let keys = ["source_validation_path", "source_validation_checksum"];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(None);
    }
    let path = require_key(fields, "source_validation_path")?.to_string();
    let checksum = require_key(fields, "source_validation_checksum")?.to_string();
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.source.validation");
    if path != expected_path {
        return Err(invalid(
            "selector registry source_validation_path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(&path, "source_validation_path")?;
    validate_hex64(&checksum, "source_validation_checksum")?;
    Ok(Some(RegistrySourceValidationRoute { path, checksum }))
}

fn registry_admission_path_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<String>> {
    // Preserves the selector admission sidecar only when it is scoped to this candidate.
    let Some(path) = fields.get("admission_path") else {
        return Ok(None);
    };
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.admission");
    if path != &expected_path {
        return Err(invalid(
            "selector registry admission_path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(path, "admission_path")?;
    Ok(Some(path.clone()))
}

fn registry_eval_path_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<String>> {
    // Preserves a converted-trained eval sidecar route only when it is scoped to the candidate.
    let Some(path) = fields.get("eval_path") else {
        return Ok(None);
    };
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.eval");
    if path != &expected_path {
        return Err(invalid(
            "selector registry eval path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(path, "eval_path")?;
    Ok(Some(path.clone()))
}

fn registry_runtime_smoke_path_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
) -> io::Result<Option<String>> {
    // Preserves a converted-trained runtime-smoke sidecar route only inside candidate evidence.
    let Some(path) = fields.get("runtime_smoke_path") else {
        return Ok(None);
    };
    validate_registry_slug(candidate_id, "candidate_id")?;
    let expected_path = format!("../evidence/{candidate_id}/converted-trained.runtime");
    if path != &expected_path {
        return Err(invalid(
            "selector registry runtime_smoke_path must stay inside candidate evidence",
        ));
    }
    validate_registry_evidence_path(path, "runtime_smoke_path")?;
    Ok(Some(path.clone()))
}

// Copies the full two-parent operator receipt family when an admission exposes it.
fn registry_operator_receipt_from_fields(
    fields: &HashMap<String, String>,
) -> io::Result<Option<RegistryOperatorReceipt>> {
    if !fields.contains_key("operator_receipt_status") {
        return Ok(None);
    }
    require_equal(fields, "operator_receipt_status", "receipt-bound")?;
    let checksum = require_key(fields, "operator_receipt_checksum")?.to_string();
    let candidate_slm_checksum =
        require_key(fields, "operator_receipt_candidate_slm_checksum")?.to_string();
    validate_hex64(&checksum, "operator_receipt_checksum")?;
    validate_hex64(
        &candidate_slm_checksum,
        "operator_receipt_candidate_slm_checksum",
    )?;
    require_equal(
        fields,
        "operator_receipt_candidate_slm_checksum",
        require_key(fields, "candidate_slm_checksum")?,
    )?;
    require_equal(
        fields,
        "operator_receipt_candidate_artifact_bytes",
        require_key(fields, "candidate_artifact_bytes")?,
    )?;
    let candidate_artifact_bytes =
        require_key(fields, "operator_receipt_candidate_artifact_bytes")?.to_string();
    if candidate_artifact_bytes.parse::<usize>().is_err() || candidate_artifact_bytes == "0" {
        return Err(invalid(
            "selector registry operator_receipt_candidate_artifact_bytes is invalid",
        ));
    }
    Ok(Some(RegistryOperatorReceipt {
        status: "receipt-bound".to_string(),
        path: require_key(fields, "operator_receipt_path")?.to_string(),
        checksum,
        operator_id: require_key(fields, "operator_receipt_operator_id")?.to_string(),
        operator_kind: require_key(fields, "operator_receipt_operator_kind")?.to_string(),
        candidate_slm_checksum,
        candidate_artifact_bytes,
    }))
}

// Copies parent-pool evolution schedule fields once an admission binds an operator receipt.
fn registry_evolution_schedule_from_fields(
    fields: &HashMap<String, String>,
    operator_receipt: Option<&RegistryOperatorReceipt>,
) -> io::Result<Option<RegistryEvolutionSchedule>> {
    if !EVOLUTION_SCHEDULE_KEYS
        .iter()
        .any(|key| fields.contains_key(*key))
    {
        return Ok(None);
    }
    let Some(receipt) = operator_receipt else {
        return Err(invalid(
            "selector registry evolution schedule requires an operator receipt",
        ));
    };
    require_equal(fields, "evolution_recipe_version", EVOLUTION_RECIPE_VERSION)?;
    require_equal(
        fields,
        "evolution_recipe_strategy",
        EVOLUTION_RECIPE_STRATEGY,
    )?;
    require_equal(fields, "evolution_recipe_status", EVOLUTION_RECIPE_STATUS)?;
    require_equal(
        fields,
        "evolution_selection_source",
        EVOLUTION_SELECTION_SOURCE,
    )?;
    require_equal(
        fields,
        "evolution_schedule_checksum_algorithm",
        EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM,
    )?;
    let relatedness_contract_checksum =
        require_key(fields, "evolution_relatedness_contract_checksum")?.to_string();
    let schedule_checksum = require_key(fields, "evolution_schedule_checksum")?.to_string();
    validate_hex64(
        &relatedness_contract_checksum,
        "evolution_relatedness_contract_checksum",
    )?;
    validate_hex64(&schedule_checksum, "evolution_schedule_checksum")?;
    let family_index = require_key(fields, "scheduled_operator_family_index")?.to_string();
    if family_index.parse::<usize>().is_err() {
        return Err(invalid(
            "selector registry scheduled_operator_family_index is invalid",
        ));
    }
    for key in [
        "scheduled_operator_family_kind",
        "scheduled_operator_family_command",
        "scheduled_operator_family_selection_rule",
        "scheduled_operator_family_output_gate",
    ] {
        validate_registry_slug(require_key(fields, key)?, key)?;
    }
    require_equal(
        fields,
        "scheduled_operator_family_kind",
        &receipt.operator_kind,
    )?;
    Ok(Some(RegistryEvolutionSchedule {
        recipe_version: EVOLUTION_RECIPE_VERSION.to_string(),
        recipe_strategy: EVOLUTION_RECIPE_STRATEGY.to_string(),
        recipe_status: EVOLUTION_RECIPE_STATUS.to_string(),
        selection_source: EVOLUTION_SELECTION_SOURCE.to_string(),
        relatedness_contract_checksum,
        schedule_checksum_algorithm: EVOLUTION_SCHEDULE_CHECKSUM_ALGORITHM.to_string(),
        schedule_checksum,
        family_index,
        family_kind: require_key(fields, "scheduled_operator_family_kind")?.to_string(),
        family_command: require_key(fields, "scheduled_operator_family_command")?.to_string(),
        family_selection_rule: require_key(fields, "scheduled_operator_family_selection_rule")?
            .to_string(),
        family_output_gate: require_key(fields, "scheduled_operator_family_output_gate")?
            .to_string(),
    }))
}

fn attach_adapter_routes(
    entries: &mut [RegistryEntry],
    adapter_routes: &[RegistryAdapterRoute],
) -> io::Result<()> {
    let mut entry_index = HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        entry_index.insert(entry.candidate_id.clone(), index);
    }
    let mut seen = HashSet::new();
    for route in adapter_routes {
        validate_registry_adapter_route(route)?;
        if !seen.insert(format!("{}\n{}", route.candidate_id, route.adapter_path)) {
            return Err(invalid(&format!(
                "duplicate selector registry adapter route for {}",
                route.candidate_id
            )));
        }
        let Some(index) = entry_index.get(&route.candidate_id).copied() else {
            return Err(invalid(&format!(
                "adapter route candidate_id {} has no selector registry entry",
                route.candidate_id
            )));
        };
        validate_adapter_apply_status_for_quantization(route, &entries[index].quantization)?;
        entries[index].adapters.push(route.clone());
    }
    Ok(())
}

fn attach_adapter_family_routes(
    entries: &mut [RegistryEntry],
    family_routes: &[RegistryAdapterFamilyRoute],
) -> io::Result<()> {
    let mut entry_index = HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        entry_index.insert(entry.candidate_id.clone(), index);
    }
    let mut seen = HashSet::new();
    for route in family_routes {
        validate_registry_adapter_family_route(route)?;
        if !seen.insert(route.candidate_id.as_str()) {
            return Err(invalid(&format!(
                "duplicate selector registry adapter family route for {}",
                route.candidate_id
            )));
        }
        let Some(index) = entry_index.get(&route.candidate_id).copied() else {
            return Err(invalid(&format!(
                "adapter family route candidate_id {} has no selector registry entry",
                route.candidate_id
            )));
        };
        if entries[index].adapters.len() != route.adapter_count {
            return Err(invalid(
                "selector registry adapter family count must match indexed adapter routes",
            ));
        }
        entries[index].adapter_family = Some(route.clone());
    }
    Ok(())
}

fn attach_assembly_routes(
    entries: &mut [RegistryEntry],
    assembly_routes: &[RegistryAssemblyRoute],
) -> io::Result<()> {
    let mut entry_index = HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        entry_index.insert(entry.candidate_id.clone(), index);
    }
    let mut seen = HashSet::new();
    for route in assembly_routes {
        validate_registry_assembly_route(route)?;
        if !seen.insert(route.candidate_id.as_str()) {
            return Err(invalid(&format!(
                "duplicate selector registry assembly route for {}",
                route.candidate_id
            )));
        }
        let Some(index) = entry_index.get(&route.candidate_id).copied() else {
            return Err(invalid(&format!(
                "assembly route candidate_id {} has no selector registry entry",
                route.candidate_id
            )));
        };
        entries[index].assembly = Some(route.clone());
    }
    Ok(())
}

fn attach_module_plan_routes(
    entries: &mut [RegistryEntry],
    module_plan_routes: &[RegistryModulePlanRoute],
) -> io::Result<()> {
    let mut entry_index = HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        entry_index.insert(entry.candidate_id.clone(), index);
    }
    let mut seen = HashSet::new();
    for route in module_plan_routes {
        validate_registry_module_plan_route(route)?;
        if !seen.insert(route.candidate_id.as_str()) {
            return Err(invalid(&format!(
                "duplicate selector registry module plan route for {}",
                route.candidate_id
            )));
        }
        let Some(index) = entry_index.get(&route.candidate_id).copied() else {
            return Err(invalid(&format!(
                "module plan route candidate_id {} has no selector registry entry",
                route.candidate_id
            )));
        };
        let entry = &entries[index];
        let Some(family) = &entry.adapter_family else {
            return Err(invalid(
                "selector registry module plan requires an adapter family route",
            ));
        };
        if entry.assembly.is_none() {
            return Err(invalid(
                "selector registry module plan requires an assembly route",
            ));
        }
        let assembly = entry.assembly.as_ref().expect("checked assembly route");
        let expected_module_count = 4usize
            .checked_add(family.auto_apply_stack_count)
            .ok_or_else(|| invalid("selector registry module plan count overflow"))?;
        if route.module_count != expected_module_count {
            return Err(invalid(
                "selector registry module plan count must match model, manifest, receipts, and adapter stack",
            ));
        }
        let model_bytes = entry
            .model_bytes
            .parse::<u64>()
            .map_err(|_| invalid("selector registry module plan model budget is invalid"))?;
        if route.model_byte_budget != model_bytes {
            return Err(invalid(
                "selector registry module plan model byte budget must match the admitted model bytes",
            ));
        }
        if route.adapter_byte_budget != family.auto_apply_byte_budget {
            return Err(invalid(
                "selector registry module plan adapter byte budget must match the adapter family budget",
            ));
        }
        if route.adapter_stack_byte_budget > family.auto_apply_byte_budget {
            return Err(invalid(
                "selector registry module plan adapter stack byte budget must fit the adapter family budget",
            ));
        }
        let expected_context_token_limit = model_shape_context_token_limit(&entry.model_shape)?;
        if route.context_token_limit != expected_context_token_limit {
            return Err(invalid(
                "selector registry module plan context token limit must match admitted model shape",
            ));
        }
        if route.tokenizer_checksum != entry.tokenizer_checksum {
            return Err(invalid(
                "selector registry module plan tokenizer checksum must match admitted tokenizer",
            ));
        }
        if route.route_set_checksum
            != module_plan_route_set_checksum(entry, route, family, assembly)?
        {
            return Err(invalid(
                "selector registry module plan route set checksum must match generated assembly routes",
            ));
        }
        if let Some(operator_receipt_checksum) = &entry.operator_receipt_checksum {
            if route.operator_receipt_checksum != *operator_receipt_checksum {
                return Err(invalid(
                    "selector registry module plan operator receipt checksum must match admitted operator receipt",
                ));
            }
        }
        entries[index].module_plan = Some(route.clone());
    }
    Ok(())
}

fn adapter_routes_from_registry(
    fields: &HashMap<String, String>,
) -> io::Result<Vec<RegistryAdapterRoute>> {
    let entry_count = require_key(fields, "entry_count")?
        .parse::<usize>()
        .map_err(|_| invalid("selector registry entry_count is invalid"))?;
    let mut routes = Vec::new();
    for index in 0..entry_count {
        let prefix = format!("entry.{index}");
        let has_adapter_key = ADAPTER_KEY_SUFFIXES.iter().any(|suffix| {
            let key = format!("{prefix}.{suffix}");
            fields.contains_key(&key)
        });
        if !has_adapter_key {
            continue;
        }
        let candidate_id_key = format!("{prefix}.candidate_id");
        let candidate_id = require_key(fields, &candidate_id_key)?.to_string();
        let adapter_count_key = format!("{prefix}.adapter_count");
        if fields.contains_key(&adapter_count_key) {
            let adapter_count = require_key(fields, &adapter_count_key)?
                .parse::<usize>()
                .map_err(|_| invalid("selector registry adapter_count is invalid"))?;
            if adapter_count == 0 || adapter_count > 16 {
                return Err(invalid("selector registry adapter_count is invalid"));
            }
            let mut entry_routes = Vec::with_capacity(adapter_count);
            for adapter_index in 0..adapter_count {
                let adapter_prefix = format!("{prefix}.adapter.{adapter_index}");
                let route = registry_adapter_route_from_fields(
                    fields,
                    &candidate_id,
                    &format!("{adapter_prefix}.path"),
                    &format!("{adapter_prefix}.manifest_path"),
                    &format!("{adapter_prefix}.label"),
                    &format!("{adapter_prefix}.apply_status"),
                    &format!("{adapter_prefix}.artifact_checksum"),
                    &format!("{adapter_prefix}.manifest_checksum"),
                )?;
                entry_routes.push(route);
            }
            if fields.contains_key(&format!("{prefix}.adapter_path")) {
                let legacy_route =
                    legacy_adapter_route_from_fields(fields, &prefix, &candidate_id)?;
                if Some(&legacy_route) != entry_routes.first() {
                    return Err(invalid(
                        "selector registry legacy adapter fields must mirror the first indexed adapter route",
                    ));
                }
            }
            routes.extend(entry_routes);
            continue;
        }
        let route = legacy_adapter_route_from_fields(fields, &prefix, &candidate_id)?;
        routes.push(route);
    }
    Ok(routes)
}

fn adapter_family_routes_from_registry(
    fields: &HashMap<String, String>,
) -> io::Result<Vec<RegistryAdapterFamilyRoute>> {
    let entry_count = require_key(fields, "entry_count")?
        .parse::<usize>()
        .map_err(|_| invalid("selector registry entry_count is invalid"))?;
    let mut routes = Vec::new();
    for index in 0..entry_count {
        let prefix = format!("entry.{index}");
        let has_family_key = ADAPTER_FAMILY_KEY_SUFFIXES.iter().any(|suffix| {
            let key = format!("{prefix}.{suffix}");
            fields.contains_key(&key)
        });
        if !has_family_key {
            continue;
        }
        let candidate_id_key = format!("{prefix}.candidate_id");
        let route = RegistryAdapterFamilyRoute {
            candidate_id: require_key(fields, &candidate_id_key)?.to_string(),
            receipt_path: require_key(fields, &format!("{prefix}.adapter_family_receipt_path"))?
                .to_string(),
            receipt_checksum: require_key(
                fields,
                &format!("{prefix}.adapter_family_receipt_checksum"),
            )?
            .to_string(),
            label: require_key(fields, &format!("{prefix}.adapter_family_label"))?.to_string(),
            status: require_key(fields, &format!("{prefix}.adapter_family_status"))?.to_string(),
            strategy: require_key(fields, &format!("{prefix}.adapter_family_strategy"))?
                .to_string(),
            adapter_count: require_key(fields, &format!("{prefix}.adapter_family_adapter_count"))?
                .parse::<usize>()
                .map_err(|_| invalid("selector registry adapter family count is invalid"))?,
            auto_apply_status: require_key(fields, &format!("{prefix}.adapter_auto_apply_status"))?
                .to_string(),
            auto_apply_strategy: require_key(
                fields,
                &format!("{prefix}.adapter_auto_apply_strategy"),
            )?
            .to_string(),
            auto_apply_stack_status: require_key(
                fields,
                &format!("{prefix}.adapter_auto_apply_stack_status"),
            )?
            .to_string(),
            auto_apply_stack_strategy: require_key(
                fields,
                &format!("{prefix}.adapter_auto_apply_stack_strategy"),
            )?
            .to_string(),
            auto_apply_stack_count: require_key(
                fields,
                &format!("{prefix}.adapter_auto_apply_stack_count"),
            )?
            .parse::<usize>()
            .map_err(|_| invalid("selector registry adapter auto apply stack count is invalid"))?,
            auto_apply_byte_budget: require_key(
                fields,
                &format!("{prefix}.adapter_auto_apply_byte_budget"),
            )?
            .parse::<u64>()
            .map_err(|_| invalid("selector registry adapter auto apply byte budget is invalid"))?,
        };
        validate_registry_adapter_family_route(&route)?;
        routes.push(route);
    }
    Ok(routes)
}

fn assembly_routes_from_registry(
    fields: &HashMap<String, String>,
) -> io::Result<Vec<RegistryAssemblyRoute>> {
    let entry_count = require_key(fields, "entry_count")?
        .parse::<usize>()
        .map_err(|_| invalid("selector registry entry_count is invalid"))?;
    let mut routes = Vec::new();
    for index in 0..entry_count {
        let prefix = format!("entry.{index}");
        let has_assembly_key = ASSEMBLY_RECEIPT_KEY_SUFFIXES.iter().any(|suffix| {
            let key = format!("{prefix}.{suffix}");
            fields.contains_key(&key)
        });
        if !has_assembly_key {
            continue;
        }
        let candidate_id_key = format!("{prefix}.candidate_id");
        let route = RegistryAssemblyRoute {
            candidate_id: require_key(fields, &candidate_id_key)?.to_string(),
            receipt_path: require_key(fields, &format!("{prefix}.assembly_receipt_path"))?
                .to_string(),
            receipt_checksum: require_key(fields, &format!("{prefix}.assembly_receipt_checksum"))?
                .to_string(),
            label: require_key(fields, &format!("{prefix}.assembly_label"))?.to_string(),
            status: require_key(fields, &format!("{prefix}.assembly_status"))?.to_string(),
            kind: require_key(fields, &format!("{prefix}.assembly_kind"))?.to_string(),
        };
        validate_registry_assembly_route(&route)?;
        routes.push(route);
    }
    Ok(routes)
}

fn module_plan_routes_from_registry(
    fields: &HashMap<String, String>,
) -> io::Result<Vec<RegistryModulePlanRoute>> {
    let entry_count = require_key(fields, "entry_count")?
        .parse::<usize>()
        .map_err(|_| invalid("selector registry entry_count is invalid"))?;
    let mut routes = Vec::new();
    for index in 0..entry_count {
        let prefix = format!("entry.{index}");
        let has_module_plan_key = MODULE_PLAN_KEY_SUFFIXES.iter().any(|suffix| {
            let key = format!("{prefix}.{suffix}");
            fields.contains_key(&key)
        });
        if !has_module_plan_key {
            continue;
        }
        let candidate_id_key = format!("{prefix}.candidate_id");
        let route = RegistryModulePlanRoute {
            candidate_id: require_key(fields, &candidate_id_key)?.to_string(),
            receipt_path: require_key(fields, &format!("{prefix}.module_plan_path"))?.to_string(),
            receipt_checksum: require_key(fields, &format!("{prefix}.module_plan_checksum"))?
                .to_string(),
            label: require_key(fields, &format!("{prefix}.module_plan_label"))?.to_string(),
            status: require_key(fields, &format!("{prefix}.module_plan_status"))?.to_string(),
            kind: require_key(fields, &format!("{prefix}.module_plan_kind"))?.to_string(),
            strategy: require_key(fields, &format!("{prefix}.module_plan_strategy"))?.to_string(),
            resource_class: require_key(fields, &format!("{prefix}.module_plan_resource_class"))?
                .to_string(),
            profile: require_key(fields, &format!("{prefix}.module_plan_profile"))?.to_string(),
            execution_profile: require_key(
                fields,
                &format!("{prefix}.module_plan_execution_profile"),
            )?
            .to_string(),
            fetch_policy: require_key(fields, &format!("{prefix}.module_plan_fetch_policy"))?
                .to_string(),
            origin_policy: require_key(fields, &format!("{prefix}.module_plan_origin_policy"))?
                .to_string(),
            fetch_count_limit: parse_module_plan_count(
                fields,
                &format!("{prefix}.module_plan_fetch_count_limit"),
                "fetch count limit",
            )?,
            planned_fetch_count: parse_module_plan_count(
                fields,
                &format!("{prefix}.module_plan_planned_fetch_count"),
                "planned fetch count",
            )?,
            route_set_version: require_key(
                fields,
                &format!("{prefix}.module_plan_route_set_version"),
            )?
            .to_string(),
            route_set_checksum_algorithm: require_key(
                fields,
                &format!("{prefix}.module_plan_route_set_checksum_algorithm"),
            )?
            .to_string(),
            route_set_checksum: require_key(
                fields,
                &format!("{prefix}.module_plan_route_set_checksum"),
            )?
            .to_string(),
            operator_receipt_path: require_key(
                fields,
                &format!("{prefix}.module_plan_operator_receipt_path"),
            )?
            .to_string(),
            operator_receipt_checksum: require_key(
                fields,
                &format!("{prefix}.module_plan_operator_receipt_checksum"),
            )?
            .to_string(),
            wasm_memory_initial_pages: {
                let value = require_key(
                    fields,
                    &format!("{prefix}.module_plan_wasm_memory_initial_pages"),
                )?;
                let pages = value.parse::<u64>().map_err(|_| {
                    invalid("selector registry module plan wasm memory initial pages is invalid")
                })?;
                if pages == 0 || pages.to_string() != value {
                    return Err(invalid(
                        "selector registry module plan wasm memory initial pages is invalid",
                    ));
                }
                pages
            },
            wasm_export_set: require_key(fields, &format!("{prefix}.module_plan_wasm_export_set"))?
                .to_string(),
            wasm_transfer_strategy: require_key(
                fields,
                &format!("{prefix}.module_plan_wasm_transfer_strategy"),
            )?
            .to_string(),
            model_release_strategy: require_key(
                fields,
                &format!("{prefix}.module_plan_model_release_strategy"),
            )?
            .to_string(),
            runtime_reset_strategy: require_key(
                fields,
                &format!("{prefix}.module_plan_runtime_reset_strategy"),
            )?
            .to_string(),
            adapter_validation_strategy: require_key(
                fields,
                &format!("{prefix}.module_plan_adapter_validation_strategy"),
            )?
            .to_string(),
            adapter_validation_count: parse_module_plan_count(
                fields,
                &format!("{prefix}.module_plan_adapter_validation_count"),
                "adapter validation count",
            )?,
            adapter_apply_count: parse_module_plan_count(
                fields,
                &format!("{prefix}.module_plan_adapter_apply_count"),
                "adapter apply count",
            )?,
            wasm_heap_min_bytes: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_wasm_heap_min_bytes"),
                "wasm heap",
            )?,
            context_token_limit: parse_module_plan_count(
                fields,
                &format!("{prefix}.module_plan_context_token_limit"),
                "context token limit",
            )?,
            sampler_candidate_cap: parse_module_plan_count(
                fields,
                &format!("{prefix}.module_plan_sampler_candidate_cap"),
                "sampler candidate cap",
            )?,
            tokenizer_checksum: require_key(
                fields,
                &format!("{prefix}.module_plan_tokenizer_checksum"),
            )?
            .to_string(),
            prompt_byte_limit: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_prompt_byte_limit"),
                "prompt",
            )?,
            model_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_model_byte_budget"),
                "model",
            )?,
            adapter_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_adapter_byte_budget"),
                "adapter",
            )?,
            adapter_stack_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_adapter_stack_byte_budget"),
                "adapter stack",
            )?,
            runtime_scratch_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_runtime_scratch_byte_budget"),
                "runtime scratch",
            )?,
            output_byte_limit: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_output_byte_limit"),
                "output",
            )?,
            kv_cache_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_kv_cache_byte_budget"),
                "kv cache",
            )?,
            kv_cache_page_count: parse_module_plan_page_count(
                fields,
                &format!("{prefix}.module_plan_kv_cache_page_count"),
            )?,
            total_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_total_byte_budget"),
                "total",
            )?,
            total_byte_budget_limit: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_total_byte_budget_limit"),
                "total limit",
            )?,
            module_count: require_key(fields, &format!("{prefix}.module_plan_module_count"))?
                .parse::<usize>()
                .map_err(|_| invalid("selector registry module plan count is invalid"))?,
        };
        validate_registry_module_plan_route(&route)?;
        routes.push(route);
    }
    Ok(routes)
}

fn legacy_adapter_route_from_fields(
    fields: &HashMap<String, String>,
    prefix: &str,
    candidate_id: &str,
) -> io::Result<RegistryAdapterRoute> {
    registry_adapter_route_from_fields(
        fields,
        candidate_id,
        &format!("{prefix}.adapter_path"),
        &format!("{prefix}.adapter_manifest_path"),
        &format!("{prefix}.adapter_label"),
        &format!("{prefix}.adapter_apply_status"),
        &format!("{prefix}.adapter_artifact_checksum"),
        &format!("{prefix}.adapter_manifest_checksum"),
    )
}

fn registry_adapter_route_from_fields(
    fields: &HashMap<String, String>,
    candidate_id: &str,
    adapter_path_key: &str,
    manifest_path_key: &str,
    label_key: &str,
    apply_status_key: &str,
    artifact_checksum_key: &str,
    manifest_checksum_key: &str,
) -> io::Result<RegistryAdapterRoute> {
    let route = RegistryAdapterRoute {
        candidate_id: candidate_id.to_string(),
        adapter_path: require_key(fields, adapter_path_key)?.to_string(),
        manifest_path: require_key(fields, manifest_path_key)?.to_string(),
        label: require_key(fields, label_key)?.to_string(),
        apply_status: require_key(fields, apply_status_key)?.to_string(),
        artifact_checksum: require_key(fields, artifact_checksum_key)?.to_string(),
        manifest_checksum: require_key(fields, manifest_checksum_key)?.to_string(),
    };
    validate_registry_adapter_route(&route)?;
    Ok(route)
}

pub(crate) fn validate_registry_adapter_route(route: &RegistryAdapterRoute) -> io::Result<()> {
    if route.candidate_id.trim().is_empty() {
        return Err(invalid("selector registry adapter candidate_id is empty"));
    }
    validate_adapter_route_path(&route.adapter_path)?;
    let expected_manifest_path = format!("{}.manifest", route.adapter_path);
    if route.manifest_path != expected_manifest_path {
        return Err(invalid(
            "selector registry adapter manifest path must match adapter path sidecar",
        ));
    }
    if route.label.trim().is_empty()
        || route.label.contains('\r')
        || route.label.contains('\n')
        || route.label.len() > 160
    {
        return Err(invalid("selector registry adapter label is invalid"));
    }
    if !is_supported_adapter_apply_status(&route.apply_status) {
        return Err(invalid(
            "selector registry adapter apply status is not runtime compatible",
        ));
    }
    validate_hex64(&route.artifact_checksum, "adapter artifact checksum")?;
    validate_hex64(&route.manifest_checksum, "adapter manifest checksum")?;
    Ok(())
}

fn is_supported_adapter_apply_status(status: &str) -> bool {
    status == ADAPTER_APPLY_STATUS_F32
        || status == ADAPTER_APPLY_STATUS_QUANTIZED
        || status == LOW_RANK_APPLY_STATUS_F32
        || status == LOW_RANK_APPLY_STATUS_QUANTIZED
}

fn validate_adapter_apply_status_for_quantization(
    route: &RegistryAdapterRoute,
    quantization: &str,
) -> io::Result<()> {
    let (expected_f32, expected_quantized) =
        adapter_apply_status_pair_for_path(&route.adapter_path)?;
    let expected = match quantization {
        "f32" => expected_f32,
        "q8_0" | "q4_0" => expected_quantized,
        _ => {
            return Err(invalid(
                "selector registry adapter routes require f32, q8_0, or q4_0 entries",
            ));
        }
    };
    if route.apply_status != expected {
        return Err(invalid(
            "selector registry adapter apply status does not match entry quantization",
        ));
    }
    Ok(())
}

fn adapter_apply_status_pair_for_path(path: &str) -> io::Result<(&'static str, &'static str)> {
    if path.ends_with(".alr1") {
        return Ok((LOW_RANK_APPLY_STATUS_F32, LOW_RANK_APPLY_STATUS_QUANTIZED));
    }
    if path.ends_with(".adp1") || path.ends_with(".asp1") {
        return Ok((ADAPTER_APPLY_STATUS_F32, ADAPTER_APPLY_STATUS_QUANTIZED));
    }
    Err(invalid("selector registry adapter route is invalid"))
}

pub(crate) fn validate_registry_adapter_family_route(
    route: &RegistryAdapterFamilyRoute,
) -> io::Result<()> {
    if route.candidate_id.trim().is_empty() {
        return Err(invalid(
            "selector registry adapter family candidate_id is empty",
        ));
    }
    validate_adapter_family_receipt_path(&route.receipt_path)?;
    if route.label.trim().is_empty()
        || route.label.contains('\r')
        || route.label.contains('\n')
        || route.label.len() > 160
    {
        return Err(invalid("selector registry adapter family label is invalid"));
    }
    if route.status != ADAPTER_FAMILY_STATUS {
        return Err(invalid(
            "selector registry adapter family status is invalid",
        ));
    }
    if route.strategy != ADAPTER_FAMILY_STRATEGY {
        return Err(invalid(
            "selector registry adapter family strategy is invalid",
        ));
    }
    if route.adapter_count < 2 || route.adapter_count > 16 {
        return Err(invalid("selector registry adapter family count is invalid"));
    }
    if route.auto_apply_status != ADAPTER_AUTO_APPLY_STATUS {
        return Err(invalid(
            "selector registry adapter auto apply status is invalid",
        ));
    }
    if route.auto_apply_strategy != ADAPTER_AUTO_APPLY_STRATEGY {
        return Err(invalid(
            "selector registry adapter auto apply strategy is invalid",
        ));
    }
    if route.auto_apply_stack_status != ADAPTER_AUTO_APPLY_STACK_STATUS {
        return Err(invalid(
            "selector registry adapter auto apply stack status is invalid",
        ));
    }
    if route.auto_apply_stack_strategy != ADAPTER_AUTO_APPLY_STACK_STRATEGY {
        return Err(invalid(
            "selector registry adapter auto apply stack strategy is invalid",
        ));
    }
    if route.auto_apply_stack_count == 0 || route.auto_apply_stack_count > route.adapter_count {
        return Err(invalid(
            "selector registry adapter auto apply stack count is invalid",
        ));
    }
    if route.auto_apply_byte_budget == 0
        || route.auto_apply_byte_budget > ADAPTER_AUTO_APPLY_BYTE_BUDGET
    {
        return Err(invalid(
            "selector registry adapter auto apply byte budget is invalid",
        ));
    }
    validate_hex64(&route.receipt_checksum, "adapter family receipt checksum")?;
    Ok(())
}

pub(crate) fn validate_registry_assembly_route(route: &RegistryAssemblyRoute) -> io::Result<()> {
    if route.candidate_id.trim().is_empty() {
        return Err(invalid("selector registry assembly candidate_id is empty"));
    }
    validate_assembly_receipt_path(&route.receipt_path)?;
    if route.label.trim().is_empty()
        || route.label.contains('\r')
        || route.label.contains('\n')
        || route.label.len() > 160
    {
        return Err(invalid("selector registry assembly label is invalid"));
    }
    if route.status != ASSEMBLY_RECEIPT_STATUS {
        return Err(invalid("selector registry assembly status is invalid"));
    }
    if route.kind != ASSEMBLY_RECEIPT_KIND {
        return Err(invalid("selector registry assembly kind is invalid"));
    }
    validate_hex64(&route.receipt_checksum, "assembly receipt checksum")?;
    Ok(())
}

/// Validates the selector-side module-plan envelope before it is mirrored into browser intake.
pub(crate) fn validate_registry_module_plan_route(
    route: &RegistryModulePlanRoute,
) -> io::Result<()> {
    if route.candidate_id.trim().is_empty() {
        return Err(invalid(
            "selector registry module plan candidate_id is empty",
        ));
    }
    validate_module_plan_receipt_path(&route.receipt_path)?;
    if route.label.trim().is_empty()
        || route.label.contains('\r')
        || route.label.contains('\n')
        || route.label.len() > 160
    {
        return Err(invalid("selector registry module plan label is invalid"));
    }
    if route.status != MODULE_PLAN_STATUS {
        return Err(invalid("selector registry module plan status is invalid"));
    }
    if route.kind != MODULE_PLAN_KIND {
        return Err(invalid("selector registry module plan kind is invalid"));
    }
    if route.strategy != MODULE_PLAN_STRATEGY {
        return Err(invalid("selector registry module plan strategy is invalid"));
    }
    if route.resource_class != MODULE_PLAN_RESOURCE_CLASS {
        return Err(invalid(
            "selector registry module plan resource class is invalid",
        ));
    }
    if route.profile != MODULE_PLAN_PROFILE {
        return Err(invalid("selector registry module plan profile is invalid"));
    }
    if route.execution_profile != MODULE_PLAN_EXECUTION_PROFILE {
        return Err(invalid(
            "selector registry module plan execution profile is invalid",
        ));
    }
    if route.fetch_policy != MODULE_PLAN_FETCH_POLICY {
        return Err(invalid(
            "selector registry module plan fetch policy is invalid",
        ));
    }
    if route.origin_policy != MODULE_PLAN_ORIGIN_POLICY {
        return Err(invalid(
            "selector registry module plan origin policy is invalid",
        ));
    }
    let module_count = u64::try_from(route.module_count)
        .map_err(|_| invalid("selector registry module plan count is invalid"))?;
    if route.fetch_count_limit != MODULE_PLAN_FETCH_COUNT_LIMIT
        || module_count + 1 > route.fetch_count_limit
    {
        return Err(invalid(
            "selector registry module plan fetch count limit is invalid",
        ));
    }
    if route.planned_fetch_count
        != module_plan_planned_fetch_count(route.module_count, route.adapter_apply_count)?
        || route.planned_fetch_count > route.fetch_count_limit
    {
        return Err(invalid(
            "selector registry module plan planned fetch count is invalid",
        ));
    }
    if route.route_set_version != MODULE_PLAN_ROUTE_SET_VERSION {
        return Err(invalid(
            "selector registry module plan route set version is invalid",
        ));
    }
    if route.route_set_checksum_algorithm != MODULE_PLAN_ROUTE_SET_CHECKSUM_ALGORITHM {
        return Err(invalid(
            "selector registry module plan route set checksum algorithm is invalid",
        ));
    }
    validate_hex64(&route.route_set_checksum, "module plan route set checksum")?;
    module_plan_operator_evidence_prefix(&route.candidate_id, &route.operator_receipt_path)?;
    validate_hex64(
        &route.operator_receipt_checksum,
        "module plan operator receipt checksum",
    )?;
    if route.wasm_memory_initial_pages != MODULE_PLAN_WASM_MEMORY_INITIAL_PAGES {
        return Err(invalid(
            "selector registry module plan wasm memory initial pages is invalid",
        ));
    }
    if route.wasm_export_set != MODULE_PLAN_WASM_EXPORT_SET {
        return Err(invalid(
            "selector registry module plan wasm export set is invalid",
        ));
    }
    if route.wasm_transfer_strategy != MODULE_PLAN_WASM_TRANSFER_STRATEGY {
        return Err(invalid(
            "selector registry module plan wasm transfer strategy is invalid",
        ));
    }
    if route.model_release_strategy != MODULE_PLAN_MODEL_RELEASE_STRATEGY {
        return Err(invalid(
            "selector registry module plan model release strategy is invalid",
        ));
    }
    if route.runtime_reset_strategy != MODULE_PLAN_RUNTIME_RESET_STRATEGY {
        return Err(invalid(
            "selector registry module plan runtime reset strategy is invalid",
        ));
    }
    if route.adapter_validation_strategy != MODULE_PLAN_ADAPTER_VALIDATION_STRATEGY {
        return Err(invalid(
            "selector registry module plan adapter validation strategy is invalid",
        ));
    }
    if route.adapter_apply_count == 0 || route.adapter_apply_count > module_count {
        return Err(invalid(
            "selector registry module plan adapter apply count is invalid",
        ));
    }
    if route.adapter_validation_count == 0
        || route.adapter_validation_count > module_count
        || route.adapter_validation_count != route.adapter_apply_count
    {
        return Err(invalid(
            "selector registry module plan adapter validation count is invalid",
        ));
    }
    if route.wasm_heap_min_bytes
        != module_plan_wasm_heap_min_bytes(
            route.model_byte_budget,
            route.adapter_stack_byte_budget,
            route.prompt_byte_limit,
        )?
    {
        return Err(invalid(
            "selector registry module plan wasm heap min bytes is invalid",
        ));
    }
    if route.context_token_limit == 0
        || route.context_token_limit > MODULE_PLAN_CONTEXT_TOKEN_LIMIT_LIMIT
    {
        return Err(invalid(
            "selector registry module plan context token limit is invalid",
        ));
    }
    if route.sampler_candidate_cap != MODULE_PLAN_SAMPLER_CANDIDATE_CAP {
        return Err(invalid(
            "selector registry module plan sampler candidate cap is invalid",
        ));
    }
    validate_hex64(&route.tokenizer_checksum, "module plan tokenizer checksum")?;
    if route.prompt_byte_limit != MODULE_PLAN_PROMPT_BYTE_LIMIT {
        return Err(invalid(
            "selector registry module plan prompt byte limit is invalid",
        ));
    }
    if route.model_byte_budget == 0 || route.model_byte_budget > SELECTOR_MODEL_BYTE_BUDGET {
        return Err(invalid(
            "selector registry module plan model byte budget is invalid",
        ));
    }
    if route.adapter_byte_budget == 0 || route.adapter_byte_budget > ADAPTER_AUTO_APPLY_BYTE_BUDGET
    {
        return Err(invalid(
            "selector registry module plan adapter byte budget is invalid",
        ));
    }
    if route.adapter_stack_byte_budget == 0
        || route.adapter_stack_byte_budget > route.adapter_byte_budget
    {
        return Err(invalid(
            "selector registry module plan adapter stack byte budget is invalid",
        ));
    }
    if route.runtime_scratch_byte_budget != MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET {
        return Err(invalid(
            "selector registry module plan runtime scratch byte budget is invalid",
        ));
    }
    if route.output_byte_limit != MODULE_PLAN_OUTPUT_BYTE_LIMIT {
        return Err(invalid(
            "selector registry module plan output byte limit is invalid",
        ));
    }
    if route.kv_cache_byte_budget == 0
        || route.kv_cache_byte_budget > MODULE_PLAN_KV_CACHE_BYTE_BUDGET_LIMIT
    {
        return Err(invalid(
            "selector registry module plan kv cache byte budget is invalid",
        ));
    }
    if route.kv_cache_page_count != module_plan_page_count_for_bytes(route.kv_cache_byte_budget)? {
        return Err(invalid(
            "selector registry module plan kv cache page count is invalid",
        ));
    }
    let minimum_total_budget = route
        .model_byte_budget
        .checked_add(route.prompt_byte_limit)
        .and_then(|value| value.checked_add(route.runtime_scratch_byte_budget))
        .and_then(|value| value.checked_add(route.output_byte_limit))
        .and_then(|value| value.checked_add(route.adapter_stack_byte_budget))
        .and_then(|value| value.checked_add(route.kv_cache_byte_budget))
        .ok_or_else(|| invalid("selector registry module plan total byte budget is invalid"))?;
    if route.total_byte_budget_limit != MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT {
        return Err(invalid(
            "selector registry module plan total byte budget limit is invalid",
        ));
    }
    if route.total_byte_budget == 0
        || route.total_byte_budget < minimum_total_budget
        || route.total_byte_budget > route.total_byte_budget_limit
    {
        return Err(invalid(
            "selector registry module plan total byte budget is invalid",
        ));
    }
    if !(5..=32).contains(&route.module_count) {
        return Err(invalid("selector registry module plan count is invalid"));
    }
    validate_hex64(&route.receipt_checksum, "module plan checksum")?;
    Ok(())
}

fn parse_module_plan_byte_budget(
    fields: &HashMap<String, String>,
    key: &str,
    label: &str,
) -> io::Result<u64> {
    // Parses exact decimal byte budgets so selector receipts cannot hide rounded values.
    let value = require_key(fields, key)?;
    let bytes = value.parse::<u64>().map_err(|_| {
        invalid(&format!(
            "selector registry module plan {label} byte budget is invalid"
        ))
    })?;
    if bytes == 0 || bytes.to_string() != value {
        return Err(invalid(&format!(
            "selector registry module plan {label} byte budget is invalid"
        )));
    }
    Ok(bytes)
}

fn module_plan_wasm_heap_min_bytes(
    model_byte_budget: u64,
    adapter_stack_byte_budget: u64,
    prompt_byte_limit: u64,
) -> io::Result<u64> {
    // Keeps the browser allocation probe large enough for each generated transfer path.
    Ok(MODULE_PLAN_WASM_HEAP_MIN_BYTES
        .max(model_byte_budget)
        .max(adapter_stack_byte_budget)
        .max(prompt_byte_limit))
}

fn module_plan_planned_fetch_count(
    module_count: usize,
    adapter_apply_count: u64,
) -> io::Result<u64> {
    // Counts model-owned generated assembly fetches across the receipt, modules,
    // evidence files, adapter manifests, and self-adapter manifest.
    let module_count = u64::try_from(module_count)
        .map_err(|_| invalid("selector registry module plan planned fetch count is invalid"))?;
    module_count
        .checked_add(1)
        .and_then(|value| value.checked_add(MODULE_PLAN_ASSEMBLY_EVIDENCE_FILE_COUNT))
        .and_then(|value| value.checked_add(adapter_apply_count))
        .and_then(|value| value.checked_add(1))
        .ok_or_else(|| invalid("selector registry module plan planned fetch count is invalid"))
}

fn module_plan_route_set_checksum(
    entry: &RegistryEntry,
    route: &RegistryModulePlanRoute,
    family: &RegistryAdapterFamilyRoute,
    assembly: &RegistryAssemblyRoute,
) -> io::Result<String> {
    // Recomputes the generated browser route envelope before selector metadata is accepted.
    module_plan_route_set_checksum_from_parts(
        &entry.candidate_id,
        &route.receipt_path,
        &entry.model_path,
        &entry.manifest_path,
        &assembly.receipt_path,
        &family.receipt_path,
        &entry.adapters,
        family.auto_apply_stack_count,
        &route.operator_receipt_path,
    )
}

fn module_plan_route_set_checksum_from_parts(
    candidate_id: &str,
    module_plan_path: &str,
    model_path: &str,
    manifest_path: &str,
    assembly_path: &str,
    adapter_family_path: &str,
    adapters: &[RegistryAdapterRoute],
    stack_count: usize,
    operator_receipt_path: &str,
) -> io::Result<String> {
    // Builds the same route classes the browser fetches during generated self-assembly.
    let evidence_files = module_plan_assembly_evidence_files(
        &module_plan_operator_evidence_prefix(candidate_id, operator_receipt_path)?,
    );
    let evidence_count = u64::try_from(evidence_files.len())
        .map_err(|_| invalid("selector registry module plan route set is invalid"))?;
    if evidence_count != MODULE_PLAN_ASSEMBLY_EVIDENCE_FILE_COUNT {
        return Err(invalid(
            "selector registry module plan route set evidence count is invalid",
        ));
    }
    let stack_indexes = module_plan_route_set_stack_indexes(adapters.len(), stack_count)?;
    let mut routes = Vec::new();
    module_plan_push_route(&mut routes, "module-plan-receipt", module_plan_path);
    module_plan_push_route(&mut routes, "model", model_path);
    module_plan_push_route(&mut routes, "model-manifest", manifest_path);
    module_plan_push_route(&mut routes, "assembly-receipt", assembly_path);
    for file_name in evidence_files {
        module_plan_push_route(
            &mut routes,
            "assembly-evidence",
            &module_plan_evidence_route(candidate_id, &file_name),
        );
    }
    module_plan_push_route(&mut routes, "adapter-family-receipt", adapter_family_path);
    for adapter in adapters {
        module_plan_push_route(&mut routes, "adapter-manifest", &adapter.manifest_path);
    }
    for adapter_index in stack_indexes {
        module_plan_push_route(
            &mut routes,
            "adapter-stack-artifact",
            &adapters[adapter_index].adapter_path,
        );
    }
    Ok(module_plan_checksum_for_routes(&routes))
}

fn module_plan_route_set_stack_indexes(
    adapter_count: usize,
    stack_count: usize,
) -> io::Result<Vec<usize>> {
    // Mirrors the generated adapter-family policy: self first, then the remaining stack members.
    if adapter_count == 0 || stack_count == 0 || stack_count > adapter_count {
        return Err(invalid(
            "selector registry module plan route set adapter stack is invalid",
        ));
    }
    let expected_stack_count = if adapter_count >= 3 {
        adapter_count - 1
    } else {
        adapter_count
    };
    if stack_count != expected_stack_count {
        return Err(invalid(
            "selector registry module plan route set adapter stack is invalid",
        ));
    }
    Ok((adapter_count - stack_count..adapter_count).collect())
}

fn module_plan_push_route(routes: &mut Vec<(String, String)>, kind: &str, path: &str) {
    // Stores route metadata without borrowing temporary evidence path strings.
    routes.push((kind.to_string(), path.to_string()));
}

fn module_plan_evidence_route(candidate_id: &str, file_name: &str) -> String {
    // Canonicalizes generated evidence routes from the admitted selector candidate id.
    format!("../evidence/{candidate_id}/{file_name}")
}

fn module_plan_operator_evidence_prefix(
    candidate_id: &str,
    operator_receipt_path: &str,
) -> io::Result<String> {
    // Extracts the operator-specific evidence lane from the bound operator receipt path.
    let route_prefix = format!("../evidence/{candidate_id}/");
    let Some(file_name) = operator_receipt_path.strip_prefix(&route_prefix) else {
        return Err(invalid(
            "selector registry module plan operator receipt path is invalid",
        ));
    };
    let Some(operator_prefix) = file_name.strip_suffix(".operator") else {
        return Err(invalid(
            "selector registry module plan operator receipt path is invalid",
        ));
    };
    if operator_prefix.is_empty()
        || operator_prefix.len() > 64
        || !operator_prefix
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        || operator_prefix.starts_with('-')
        || operator_prefix.ends_with('-')
        || !matches!(operator_prefix, "sign-merge" | "soup")
    {
        return Err(invalid(
            "selector registry module plan operator receipt path is invalid",
        ));
    }
    Ok(operator_prefix.to_string())
}

fn module_plan_assembly_evidence_files(operator_prefix: &str) -> Vec<String> {
    // Builds the fixed evidence route family for whichever parent-pool operator made the candidate.
    vec![
        "population.ledger".to_string(),
        "population.review".to_string(),
        "parent-pool.recipe".to_string(),
        format!("{operator_prefix}.operator"),
        format!("{operator_prefix}.candidate"),
        format!("{operator_prefix}.promotion"),
        format!("{operator_prefix}.runtime"),
        format!("{operator_prefix}.eval"),
        format!("{operator_prefix}.multi.admission"),
    ]
}

fn module_plan_checksum_for_routes(routes: &[(String, String)]) -> String {
    // Hashes the ordered route-kind and route-path list with the project text checksum.
    let mut text = String::new();
    push_line(
        &mut text,
        "route_set_version",
        MODULE_PLAN_ROUTE_SET_VERSION,
    );
    push_line(
        &mut text,
        "route_set_checksum_algorithm",
        MODULE_PLAN_ROUTE_SET_CHECKSUM_ALGORITHM,
    );
    push_line(&mut text, "route_count", &routes.len().to_string());
    for (index, (kind, path)) in routes.iter().enumerate() {
        push_line(&mut text, &format!("route.{index}.kind"), kind);
        push_line(&mut text, &format!("route.{index}.path"), path);
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

fn parse_module_plan_page_count(fields: &HashMap<String, String>, key: &str) -> io::Result<u64> {
    // Parses the KV-cache page count as an exact selector-owned decimal field.
    let value = require_key(fields, key)?;
    let pages = value
        .parse::<u64>()
        .map_err(|_| invalid("selector registry module plan kv cache page count is invalid"))?;
    if pages == 0 || pages.to_string() != value {
        return Err(invalid(
            "selector registry module plan kv cache page count is invalid",
        ));
    }
    Ok(pages)
}

fn parse_module_plan_count(
    fields: &HashMap<String, String>,
    key: &str,
    label: &str,
) -> io::Result<u64> {
    // Parses exact decimal count fields so resource limits stay selector-owned.
    let value = require_key(fields, key)?;
    let count = value
        .parse::<u64>()
        .map_err(|_| invalid(&format!("selector registry module plan {label} is invalid")))?;
    if count == 0 || count.to_string() != value {
        return Err(invalid(&format!(
            "selector registry module plan {label} is invalid"
        )));
    }
    Ok(count)
}

fn model_shape_context_token_limit(model_shape: &str) -> io::Result<u64> {
    // Reads either compact fixture `ctx=` or validated manifest `context=` shape fields.
    for part in model_shape.split(',') {
        let part = part.trim();
        let Some(value) = part
            .strip_prefix("context=")
            .or_else(|| part.strip_prefix("ctx="))
        else {
            continue;
        };
        let tokens = value
            .parse::<u64>()
            .map_err(|_| invalid("selector registry model shape context token limit is invalid"))?;
        if tokens == 0
            || tokens.to_string() != value
            || tokens > MODULE_PLAN_CONTEXT_TOKEN_LIMIT_LIMIT
        {
            return Err(invalid(
                "selector registry model shape context token limit is invalid",
            ));
        }
        return Ok(tokens);
    }
    Err(invalid(
        "selector registry model shape context token limit is missing",
    ))
}

fn module_plan_page_count_for_bytes(bytes: u64) -> io::Result<u64> {
    // Recomputes the expected WebAssembly page count from the selector byte budget.
    let page_bytes = 64 * 1024u64;
    bytes
        .checked_add(page_bytes - 1)
        .map(|value| value / page_bytes)
        .ok_or_else(|| invalid("selector registry module plan kv cache page count is invalid"))
}

fn selector_id(admission_texts: &[String]) -> io::Result<String> {
    let Some(first) = admission_texts.first() else {
        return Err(invalid(
            "selector registry requires at least one admission record",
        ));
    };
    let fields = validate_admission_summary_text(first)?;
    Ok(require_key(&fields, "selector_id")?.to_string())
}

fn validate_admission_summary_text(admission_text: &str) -> io::Result<HashMap<String, String>> {
    let fields = parse_manifest(admission_text, "selector registry admission")?;
    if fields.contains_key("tinyrustlm_selector_admission_version") {
        return admission::validate_record_summary_text(admission_text);
    }
    if fields.contains_key("tinyrustlm_multi_parent_selector_admission_version") {
        return multi_admission::validate_record_summary_text(admission_text);
    }
    Err(invalid(
        "selector registry admission record must use a supported admission version",
    ))
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

fn selector_model_bytes(value: &str) -> io::Result<u64> {
    let bytes = value
        .parse::<u64>()
        .map_err(|_| invalid("selector registry model bytes are invalid"))?;
    if bytes == 0 || bytes > SELECTOR_MODEL_BYTE_BUDGET || bytes.to_string() != value {
        return Err(invalid(
            "selector registry model bytes exceed the browser selector budget",
        ));
    }
    Ok(bytes)
}

fn validate_adapter_route_path(path: &str) -> io::Result<()> {
    let normalized = path.replace('\\', "/");
    let Some(rest) = normalized.strip_prefix("../models/") else {
        return Err(invalid(
            "selector registry adapter route must point at served ../models adapter artifacts",
        ));
    };
    if rest.is_empty()
        || !is_supported_adapter_artifact_name(rest)
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid("selector registry adapter route is invalid"));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid("selector registry adapter route is invalid"));
        }
    }
    Ok(())
}

fn is_supported_adapter_artifact_name(path: &str) -> bool {
    path.ends_with(".adp1") || path.ends_with(".asp1") || path.ends_with(".alr1")
}

fn validate_adapter_family_receipt_path(path: &str) -> io::Result<()> {
    let normalized = path.replace('\\', "/");
    let Some(rest) = normalized.strip_prefix("../models/") else {
        return Err(invalid(
            "selector registry adapter family receipt route must point at served ../models receipt artifacts",
        ));
    };
    if rest.is_empty()
        || !rest.ends_with(".adapter-family.receipt")
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid(
            "selector registry adapter family receipt route is invalid",
        ));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid(
                "selector registry adapter family receipt route is invalid",
            ));
        }
    }
    Ok(())
}

fn validate_assembly_receipt_path(path: &str) -> io::Result<()> {
    let normalized = path.replace('\\', "/");
    let Some(rest) = normalized.strip_prefix("../models/") else {
        return Err(invalid(
            "selector registry assembly receipt route must point at served ../models receipt artifacts",
        ));
    };
    if rest.is_empty()
        || !rest.ends_with(".assembly.receipt")
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid(
            "selector registry assembly receipt route is invalid",
        ));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid(
                "selector registry assembly receipt route is invalid",
            ));
        }
    }
    Ok(())
}

fn validate_module_plan_receipt_path(path: &str) -> io::Result<()> {
    let normalized = path.replace('\\', "/");
    let Some(rest) = normalized.strip_prefix("../models/") else {
        return Err(invalid(
            "selector registry module plan route must point at served ../models receipt artifacts",
        ));
    };
    if rest.is_empty()
        || !rest.ends_with(".module-plan.receipt")
        || rest.contains(':')
        || rest.contains('\\')
        || rest.contains("//")
    {
        return Err(invalid("selector registry module plan route is invalid"));
    }
    for part in rest.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid("selector registry module plan route is invalid"));
        }
    }
    Ok(())
}

fn validate_hex64(value: &str, label: &str) -> io::Result<()> {
    let Some(rest) = value.strip_prefix("0x") else {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    };
    if rest.len() != 16 || !rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    }
    Ok(())
}

fn validate_registry_slug(value: &str, label: &str) -> io::Result<()> {
    // Keeps copied schedule commands and family names browser-safe without path semantics.
    if value.is_empty()
        || value.len() > 96
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    }
    Ok(())
}

fn validate_registry_evidence_path(value: &str, label: &str) -> io::Result<()> {
    // Keeps selector-carried evidence routes relative to the served local evidence tree.
    if !value.starts_with("../evidence/")
        || value.contains('\\')
        || value.contains("://")
        || value.contains("//")
    {
        return Err(invalid(&format!("selector registry {label} is invalid")));
    }
    for part in value["../evidence/".len()..].split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid(&format!("selector registry {label} is invalid")));
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
    // Gives converted source artifacts a stable browser label while leaving operator ids literal.
    if candidate_id.starts_with("converted-trained-") {
        return format!("Converted trained-source {quantization}");
    }
    format!("{candidate_id} {quantization}")
}

// Builds a stable browser-local genome id from the candidate's runtime-visible shape.
fn registry_entry_genome_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "tokenizer_checksum", &entry.tokenizer_checksum);
    push_line(&mut text, "slm_checksum", &entry.slm_checksum);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Summarizes the admission/eval chain used as the selector entry's lineage route.
fn registry_entry_genome_lineage_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "admission_checksum", &entry.admission_checksum);
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &entry.promotion_manifest_checksum,
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &entry.runtime_smoke_manifest_checksum,
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &entry.eval_manifest_checksum,
    );
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Groups candidates by the model family traits that matter to browser-local selection.
fn registry_entry_species_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "tokenizer_checksum", &entry.tokenizer_checksum);
    push_line(&mut text, "max_tokens", &entry.max_tokens);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds a candidate species to the browser resource envelope it is expected to fit.
fn registry_entry_species_fit_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "selector_registry_text_byte_budget",
        &SELECTOR_REGISTRY_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "manifest_text_byte_budget",
        &MANIFEST_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "receipt_text_byte_budget",
        &RECEIPT_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "evidence_text_byte_budget",
        &EVIDENCE_TEXT_BYTE_BUDGET.to_string(),
    );
    push_line(&mut text, "model_bytes", &entry.model_bytes);
    push_line(&mut text, "max_tokens", &entry.max_tokens);
    push_line(&mut text, "quantization", &entry.quantization);
    match &entry.module_plan {
        Some(module_plan) => {
            push_line(&mut text, "module_plan_status", "present");
            push_line(
                &mut text,
                "module_plan_resource_class",
                &module_plan.resource_class,
            );
            push_line(&mut text, "module_plan_profile", &module_plan.profile);
            push_line(
                &mut text,
                "module_plan_execution_profile",
                &module_plan.execution_profile,
            );
            push_line(
                &mut text,
                "module_plan_fetch_policy",
                &module_plan.fetch_policy,
            );
            push_line(
                &mut text,
                "module_plan_origin_policy",
                &module_plan.origin_policy,
            );
            push_line(
                &mut text,
                "module_plan_fetch_count_limit",
                &module_plan.fetch_count_limit.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_planned_fetch_count",
                &module_plan.planned_fetch_count.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_route_set_version",
                &module_plan.route_set_version,
            );
            push_line(
                &mut text,
                "module_plan_route_set_checksum_algorithm",
                &module_plan.route_set_checksum_algorithm,
            );
            push_line(
                &mut text,
                "module_plan_route_set_checksum",
                &module_plan.route_set_checksum,
            );
            push_line(
                &mut text,
                "module_plan_wasm_memory_initial_pages",
                &module_plan.wasm_memory_initial_pages.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_wasm_export_set",
                &module_plan.wasm_export_set,
            );
            push_line(
                &mut text,
                "module_plan_wasm_transfer_strategy",
                &module_plan.wasm_transfer_strategy,
            );
            push_line(
                &mut text,
                "module_plan_model_release_strategy",
                &module_plan.model_release_strategy,
            );
            push_line(
                &mut text,
                "module_plan_runtime_reset_strategy",
                &module_plan.runtime_reset_strategy,
            );
            push_line(
                &mut text,
                "module_plan_adapter_validation_strategy",
                &module_plan.adapter_validation_strategy,
            );
            push_line(
                &mut text,
                "module_plan_adapter_validation_count",
                &module_plan.adapter_validation_count.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_adapter_apply_count",
                &module_plan.adapter_apply_count.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_wasm_heap_min_bytes",
                &module_plan.wasm_heap_min_bytes.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_context_token_limit",
                &module_plan.context_token_limit.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_sampler_candidate_cap",
                &module_plan.sampler_candidate_cap.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_tokenizer_checksum",
                &module_plan.tokenizer_checksum,
            );
            push_line(
                &mut text,
                "module_plan_prompt_byte_limit",
                &module_plan.prompt_byte_limit.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_model_byte_budget",
                &module_plan.model_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_adapter_byte_budget",
                &module_plan.adapter_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_adapter_stack_byte_budget",
                &module_plan.adapter_stack_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_runtime_scratch_byte_budget",
                &module_plan.runtime_scratch_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_output_byte_limit",
                &module_plan.output_byte_limit.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_kv_cache_byte_budget",
                &module_plan.kv_cache_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_kv_cache_page_count",
                &module_plan.kv_cache_page_count.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_total_byte_budget",
                &module_plan.total_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_total_byte_budget_limit",
                &module_plan.total_byte_budget_limit.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_module_count",
                &module_plan.module_count.to_string(),
            );
        }
        None => push_line(&mut text, "module_plan_status", "absent"),
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Sketches behavior-relevant traits so selector populations can keep useful variety.
fn registry_entry_novelty_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "species_id", &registry_entry_species_id(entry));
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "max_tokens", &entry.max_tokens);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds the novelty sketch to the concrete eval and assembly evidence behind it.
fn registry_entry_novelty_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    push_line(&mut text, "species_id", &registry_entry_species_id(entry));
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    match &entry.assembly {
        Some(assembly) => {
            push_line(&mut text, "assembly_status", "present");
            push_line(
                &mut text,
                "assembly_receipt_checksum",
                &assembly.receipt_checksum,
            );
        }
        None => push_line(&mut text, "assembly_status", "absent"),
    }
    match &entry.adapter_family {
        Some(adapter_family) => {
            push_line(&mut text, "adapter_family_status", "present");
            push_line(
                &mut text,
                "adapter_family_receipt_checksum",
                &adapter_family.receipt_checksum,
            );
            push_line(
                &mut text,
                "adapter_family_stack_count",
                &adapter_family.auto_apply_stack_count.to_string(),
            );
        }
        None => push_line(&mut text, "adapter_family_status", "absent"),
    }
    match &entry.module_plan {
        Some(module_plan) => {
            push_line(&mut text, "module_plan_status", "present");
            push_line(
                &mut text,
                "module_plan_checksum",
                &module_plan.receipt_checksum,
            );
            push_line(
                &mut text,
                "module_plan_resource_class",
                &module_plan.resource_class,
            );
            push_line(
                &mut text,
                "module_plan_wasm_export_set",
                &module_plan.wasm_export_set,
            );
            push_line(
                &mut text,
                "module_plan_wasm_transfer_strategy",
                &module_plan.wasm_transfer_strategy,
            );
            push_line(
                &mut text,
                "module_plan_model_release_strategy",
                &module_plan.model_release_strategy,
            );
            push_line(
                &mut text,
                "module_plan_runtime_reset_strategy",
                &module_plan.runtime_reset_strategy,
            );
            push_line(
                &mut text,
                "module_plan_adapter_validation_strategy",
                &module_plan.adapter_validation_strategy,
            );
            push_line(
                &mut text,
                "module_plan_adapter_validation_count",
                &module_plan.adapter_validation_count.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_adapter_apply_count",
                &module_plan.adapter_apply_count.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_module_count",
                &module_plan.module_count.to_string(),
            );
        }
        None => push_line(&mut text, "module_plan_status", "absent"),
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Names the selector population lane from species, novelty, and scoped fitness traits.
fn registry_entry_population_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "species_id", &registry_entry_species_id(entry));
    push_line(&mut text, "novelty_id", &registry_entry_novelty_id(entry));
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "quantization", &entry.quantization);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds population provenance to the reviewed assembly and browser route context.
fn registry_entry_population_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "population_id",
        &registry_entry_population_id(entry),
    );
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    push_line(
        &mut text,
        "genome_lineage_checksum",
        &registry_entry_genome_lineage_checksum(entry),
    );
    push_line(
        &mut text,
        "species_fit_checksum",
        &registry_entry_species_fit_checksum(entry),
    );
    push_line(
        &mut text,
        "novelty_checksum",
        &registry_entry_novelty_checksum(entry),
    );
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    match &entry.assembly {
        Some(assembly) => {
            push_line(&mut text, "population_review_route", "assembly-bound");
            push_line(
                &mut text,
                "assembly_receipt_checksum",
                &assembly.receipt_checksum,
            );
        }
        None => push_line(&mut text, "population_review_route", "admission-only"),
    }
    match &entry.module_plan {
        Some(module_plan) => {
            push_line(&mut text, "module_plan_status", "present");
            push_line(
                &mut text,
                "module_plan_checksum",
                &module_plan.receipt_checksum,
            );
            push_line(
                &mut text,
                "module_plan_module_count",
                &module_plan.module_count.to_string(),
            );
        }
        None => push_line(&mut text, "module_plan_status", "absent"),
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Names the mate-selection lane from the parent-pool route when the admission has one.
fn registry_entry_mate_selection_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(&mut text, "admission_kind", &entry.admission_kind);
    push_line(
        &mut text,
        "population_id",
        &registry_entry_population_id(entry),
    );
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        option_or_marker(&entry.parent_pool_recipe_checksum, "admission-only"),
    );
    push_line(&mut text, "parent_count", &entry.parent_count.to_string());
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Marks whether a selector entry is backed by reviewed parent-pool mate selection.
fn registry_entry_mate_selection_status(entry: &RegistryEntry) -> &'static str {
    if entry.parent_pool_recipe_checksum.is_some() {
        MATE_SELECTION_PARENT_POOL_STATUS
    } else {
        MATE_SELECTION_ADMISSION_STATUS
    }
}

// Binds the parent-pool recipe and sign-merge route into browser-visible provenance.
fn registry_entry_mate_selection_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "mate_selection_id",
        &registry_entry_mate_selection_id(entry),
    );
    push_line(
        &mut text,
        "mate_selection_status",
        registry_entry_mate_selection_status(entry),
    );
    push_line(
        &mut text,
        "population_checksum",
        &registry_entry_population_checksum(entry),
    );
    push_line(&mut text, "parent_count", &entry.parent_count.to_string());
    push_line(
        &mut text,
        "parent_pool_recipe_checksum",
        option_or_marker(&entry.parent_pool_recipe_checksum, "admission-only"),
    );
    push_line(
        &mut text,
        "operator_receipt_checksum",
        option_or_marker(&entry.operator_receipt_checksum, "admission-only"),
    );
    push_operator_receipt_checksum_inputs(&mut text, entry);
    push_line(
        &mut text,
        "population_review_checksum",
        option_or_marker(&entry.population_review_checksum, "admission-only"),
    );
    push_line(
        &mut text,
        "promotion_ledger_checksum",
        option_or_marker(&entry.promotion_ledger_checksum, "admission-only"),
    );
    push_line(
        &mut text,
        "admission_set_checksum",
        option_or_marker(&entry.admission_set_checksum, "admission-only"),
    );
    push_line(&mut text, "admission_checksum", &entry.admission_checksum);
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Emits selector entry fields for the optional two-parent operator receipt route.
fn push_registry_operator_receipt_lines(text: &mut String, prefix: &str, entry: &RegistryEntry) {
    if let Some(receipt) = &entry.operator_receipt {
        push_line(
            text,
            &format!("{prefix}.operator_receipt_status"),
            &receipt.status,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_path"),
            &receipt.path,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_checksum"),
            &receipt.checksum,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_operator_id"),
            &receipt.operator_id,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_operator_kind"),
            &receipt.operator_kind,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_candidate_slm_checksum"),
            &receipt.candidate_slm_checksum,
        );
        push_line(
            text,
            &format!("{prefix}.operator_receipt_candidate_artifact_bytes"),
            &receipt.candidate_artifact_bytes,
        );
    }
}

// Emits parent-pool evolution schedule fields for browser provenance and validation.
fn push_registry_evolution_schedule_lines(text: &mut String, prefix: &str, entry: &RegistryEntry) {
    if let Some(schedule) = &entry.evolution_schedule {
        push_line(
            text,
            &format!("{prefix}.evolution_recipe_version"),
            &schedule.recipe_version,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_recipe_strategy"),
            &schedule.recipe_strategy,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_recipe_status"),
            &schedule.recipe_status,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_selection_source"),
            &schedule.selection_source,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_relatedness_contract_checksum"),
            &schedule.relatedness_contract_checksum,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_schedule_checksum_algorithm"),
            &schedule.schedule_checksum_algorithm,
        );
        push_line(
            text,
            &format!("{prefix}.evolution_schedule_checksum"),
            &schedule.schedule_checksum,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_index"),
            &schedule.family_index,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_kind"),
            &schedule.family_kind,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_command"),
            &schedule.family_command,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_selection_rule"),
            &schedule.family_selection_rule,
        );
        push_line(
            text,
            &format!("{prefix}.scheduled_operator_family_output_gate"),
            &schedule.family_output_gate,
        );
    }
}

// Includes copied operator and schedule fields in the mate-selection proof digest.
fn push_operator_receipt_checksum_inputs(text: &mut String, entry: &RegistryEntry) {
    if let Some(receipt) = &entry.operator_receipt {
        push_line(text, "operator_receipt_status", &receipt.status);
        push_line(text, "operator_receipt_path", &receipt.path);
        push_line(text, "operator_receipt_operator_id", &receipt.operator_id);
        push_line(
            text,
            "operator_receipt_operator_kind",
            &receipt.operator_kind,
        );
        push_line(
            text,
            "operator_receipt_candidate_slm_checksum",
            &receipt.candidate_slm_checksum,
        );
        push_line(
            text,
            "operator_receipt_candidate_artifact_bytes",
            &receipt.candidate_artifact_bytes,
        );
    } else {
        push_line(text, "operator_receipt_status", "admission-only");
        push_line(text, "operator_receipt_path", "admission-only");
        push_line(text, "operator_receipt_operator_id", "admission-only");
        push_line(text, "operator_receipt_operator_kind", "admission-only");
        push_line(
            text,
            "operator_receipt_candidate_slm_checksum",
            "admission-only",
        );
        push_line(
            text,
            "operator_receipt_candidate_artifact_bytes",
            "admission-only",
        );
    }
    push_evolution_schedule_checksum_inputs(text, entry);
}

// Includes copied schedule metadata in the selector proof digest when a parent pool is scheduled.
fn push_evolution_schedule_checksum_inputs(text: &mut String, entry: &RegistryEntry) {
    if let Some(schedule) = &entry.evolution_schedule {
        push_line(text, "evolution_recipe_version", &schedule.recipe_version);
        push_line(text, "evolution_recipe_strategy", &schedule.recipe_strategy);
        push_line(text, "evolution_recipe_status", &schedule.recipe_status);
        push_line(
            text,
            "evolution_selection_source",
            &schedule.selection_source,
        );
        push_line(
            text,
            "evolution_relatedness_contract_checksum",
            &schedule.relatedness_contract_checksum,
        );
        push_line(
            text,
            "evolution_schedule_checksum_algorithm",
            &schedule.schedule_checksum_algorithm,
        );
        push_line(
            text,
            "evolution_schedule_checksum",
            &schedule.schedule_checksum,
        );
        push_line(
            text,
            "scheduled_operator_family_index",
            &schedule.family_index,
        );
        push_line(
            text,
            "scheduled_operator_family_kind",
            &schedule.family_kind,
        );
        push_line(
            text,
            "scheduled_operator_family_command",
            &schedule.family_command,
        );
        push_line(
            text,
            "scheduled_operator_family_selection_rule",
            &schedule.family_selection_rule,
        );
        push_line(
            text,
            "scheduled_operator_family_output_gate",
            &schedule.family_output_gate,
        );
    } else {
        for key in EVOLUTION_SCHEDULE_KEYS {
            push_line(text, key, "admission-only");
        }
    }
}

// Names the observed behavior lane from runtime, eval, and selected-parent context.
fn registry_entry_phenotype_evidence_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(
        &mut text,
        "mate_selection_id",
        &registry_entry_mate_selection_id(entry),
    );
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "cases_passed", &entry.cases_passed);
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds phenotype evidence to the manifests and assembly receipt that produced it.
fn registry_entry_phenotype_evidence_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "phenotype_evidence_id",
        &registry_entry_phenotype_evidence_id(entry),
    );
    push_line(
        &mut text,
        "phenotype_evidence_status",
        PHENOTYPE_EVIDENCE_STATUS,
    );
    push_line(
        &mut text,
        "provenance_manifest_checksum",
        &entry.provenance_manifest_checksum,
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &entry.runtime_smoke_manifest_checksum,
    );
    push_line(
        &mut text,
        "eval_manifest_checksum",
        &entry.eval_manifest_checksum,
    );
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    push_line(&mut text, "quality_boundary", &entry.quality_boundary);
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "mate_selection_checksum",
        &registry_entry_mate_selection_checksum(entry),
    );
    match &entry.assembly {
        Some(assembly) => {
            push_line(&mut text, "assembly_status", "present");
            push_line(
                &mut text,
                "assembly_receipt_checksum",
                &assembly.receipt_checksum,
            );
        }
        None => push_line(&mut text, "assembly_status", "admission-only"),
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Names the served artifact identity that later selector work can inherit or compare.
fn registry_entry_heritable_artifact_id(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "candidate_id", &entry.candidate_id);
    push_line(&mut text, "artifact_path", &entry.artifact_path);
    push_line(&mut text, "model_path", &entry.model_path);
    push_line(&mut text, "manifest_path", &entry.manifest_path);
    match &entry.source_manifest {
        Some(source_manifest) => {
            push_line(&mut text, "source_manifest_path", &source_manifest.path);
            push_line(
                &mut text,
                "source_manifest_checksum",
                &source_manifest.checksum,
            );
            push_line(
                &mut text,
                "source_manifest_source_kind",
                &source_manifest.source_kind,
            );
            push_line(
                &mut text,
                "source_manifest_source_id",
                &source_manifest.source_id,
            );
            push_line(
                &mut text,
                "source_manifest_model_shape",
                &source_manifest.model_shape,
            );
            if let Some(source_review) = &source_manifest.source_review {
                push_line(&mut text, "source_review_kind", &source_review.kind);
                push_line(&mut text, "source_review_path", &source_review.path);
                push_line(&mut text, "source_review_status", &source_review.status);
                push_line(&mut text, "source_review_checksum", &source_review.checksum);
                push_line(
                    &mut text,
                    "source_review_required_next_gate",
                    &source_review.required_next_gate,
                );
            } else {
                push_line(&mut text, "source_review_status", "absent");
            }
        }
        None => push_line(&mut text, "source_manifest_status", "absent"),
    }
    push_line(&mut text, "model_bytes", &entry.model_bytes);
    push_line(&mut text, "slm_checksum", &entry.slm_checksum);
    push_line(&mut text, "model_shape", &entry.model_shape);
    push_line(&mut text, "quantization", &entry.quantization);
    push_line(&mut text, "output_contract", &entry.output_contract);
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Binds the heritable artifact id to lineage, eval evidence, and browser route receipts.
fn registry_entry_heritable_artifact_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "heritable_artifact_id",
        &registry_entry_heritable_artifact_id(entry),
    );
    push_line(
        &mut text,
        "heritable_artifact_status",
        HERITABLE_ARTIFACT_STATUS,
    );
    push_line(&mut text, "genome_id", &registry_entry_genome_id(entry));
    push_line(
        &mut text,
        "genome_lineage_checksum",
        &registry_entry_genome_lineage_checksum(entry),
    );
    push_line(
        &mut text,
        "phenotype_evidence_checksum",
        &registry_entry_phenotype_evidence_checksum(entry),
    );
    push_line(
        &mut text,
        "fitness_vector_checksum",
        &registry_entry_fitness_vector_checksum(entry),
    );
    push_line(
        &mut text,
        "provenance_manifest_checksum",
        &entry.provenance_manifest_checksum,
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &entry.runtime_smoke_manifest_checksum,
    );
    match &entry.adapter_family {
        Some(adapter_family) => {
            push_line(&mut text, "adapter_family_status", "present");
            push_line(
                &mut text,
                "adapter_family_receipt_checksum",
                &adapter_family.receipt_checksum,
            );
            push_line(
                &mut text,
                "adapter_family_stack_count",
                &adapter_family.auto_apply_stack_count.to_string(),
            );
        }
        None => push_line(&mut text, "adapter_family_status", "absent"),
    }
    match &entry.assembly {
        Some(assembly) => {
            push_line(&mut text, "assembly_status", "present");
            push_line(
                &mut text,
                "assembly_receipt_checksum",
                &assembly.receipt_checksum,
            );
        }
        None => push_line(&mut text, "assembly_status", "admission-only"),
    }
    match &entry.module_plan {
        Some(module_plan) => {
            push_line(&mut text, "module_plan_status", "present");
            push_line(
                &mut text,
                "module_plan_checksum",
                &module_plan.receipt_checksum,
            );
            push_line(
                &mut text,
                "module_plan_total_byte_budget",
                &module_plan.total_byte_budget.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_total_byte_budget_limit",
                &module_plan.total_byte_budget_limit.to_string(),
            );
            push_line(
                &mut text,
                "module_plan_output_byte_limit",
                &module_plan.output_byte_limit.to_string(),
            );
        }
        None => push_line(&mut text, "module_plan_status", "absent"),
    }
    hex64(provenance::text_checksum(text.as_bytes()))
}

// Keeps checksum text deterministic for admission-only entries without parent-pool fields.
fn option_or_marker<'a>(value: &'a Option<String>, marker: &'a str) -> &'a str {
    value.as_deref().unwrap_or(marker)
}

// Condenses the scoped eval facts into a selector fitness vector checksum.
fn registry_entry_fitness_vector_checksum(entry: &RegistryEntry) -> String {
    let mut text = String::new();
    push_line(&mut text, "quality_scope", &entry.quality_scope);
    push_line(&mut text, "quality_boundary", &entry.quality_boundary);
    push_line(&mut text, "eval_dataset", &entry.eval_dataset);
    push_line(&mut text, "cases_passed", &entry.cases_passed);
    push_line(
        &mut text,
        "eval_case_evidence_checksum",
        &entry.eval_case_evidence_checksum,
    );
    hex64(provenance::text_checksum(text.as_bytes()))
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
    use crate::tensor_writer::{
        tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
    };
    use crate::tokenizer_writer::ByteTokenizerSection;

    #[test]
    fn writes_and_validates_selector_registry_from_admission_record() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("registry_status=admitted-records-only"));
        assert!(registry.contains("selector_model_byte_budget=33554432"));
        assert!(registry.contains("selector_registry_text_byte_budget=262144"));
        assert!(registry.contains("manifest_text_byte_budget=65536"));
        assert!(registry.contains("receipt_text_byte_budget=131072"));
        assert!(registry.contains("evidence_text_byte_budget=131072"));
        assert!(registry.contains("selector_default_strategy=browser-frugal-quantized"));
        assert!(registry.contains("selector_default_candidate_id=tiny-q8-candidate"));
        assert!(registry.contains("selector_default_quantization=q8_0"));
        assert!(registry.contains("entry.0.model_path=../models/tiny-q8.slm"));
        assert!(registry.contains("entry.0.selector_status=admitted"));
    }

    #[test]
    fn writes_and_validates_selector_registry_source_manifest_route() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap();

        assert!(registry.contains(
            "entry.0.source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest"
        ));
        assert!(registry.contains("entry.0.source_manifest_checksum=0x00000000000000f1"));
        assert!(registry.contains("entry.0.source_manifest_kind=trained-source-manifest"));
        assert!(registry.contains("entry.0.source_manifest_status=reviewed-source-snapshot"));
        assert!(registry.contains("entry.0.source_manifest_source_kind=trained-source-fixture"));
        assert!(
            registry.contains("entry.0.source_manifest_source_id=tinyrustlm-local-source-fixture")
        );
        assert!(registry.contains("entry.0.source_manifest_model_shape=tiny-fixture"));
        assert!(registry.contains(
            "entry.0.source_validation_path=../evidence/converted-trained-q8/converted-trained.source.validation"
        ));
        assert!(registry.contains("entry.0.source_validation_checksum=0x00000000000000f5"));
        assert!(registry.contains(
            "entry.0.runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime"
        ));
        assert!(registry
            .contains("entry.0.eval_path=../evidence/converted-trained-q8/converted-trained.eval"));
        assert!(registry.contains(
            "entry.0.admission_path=../evidence/converted-trained-q8/converted-trained.admission"
        ));
        validate_registry_text(&registry, &[admission]).unwrap();
    }

    #[test]
    fn rejects_selector_registry_source_manifest_checksum_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.source_manifest_checksum=0x00000000000000f1",
            "entry.0.source_manifest_checksum=0x00000000000000f2",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_manifest_checksum"));
    }

    #[test]
    fn rejects_selector_registry_source_validation_checksum_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.source_validation_checksum=0x00000000000000f5",
            "entry.0.source_validation_checksum=0x00000000000000f6",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_validation_checksum"));
    }

    #[test]
    fn writes_and_validates_selector_registry_source_review_route() {
        let admission = fixture_admission_with_source_review_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap();

        assert!(registry.contains("entry.0.source_review_kind=safetensors-candidate-review"));
        assert!(registry.contains(
            "entry.0.source_review_path=../evidence/converted-trained-q8/converted-trained.source.review"
        ));
        assert!(registry.contains("entry.0.source_review_status=validated-before-extraction"));
        assert!(registry.contains("entry.0.source_review_checksum=0x00000000000000f3"));
        assert!(
            registry.contains("entry.0.source_review_required_next_gate=extract-raw-f32-tensors")
        );
        validate_registry_text(&registry, &[admission]).unwrap();
    }

    #[test]
    fn rejects_selector_registry_source_review_checksum_drift() {
        let admission = fixture_admission_with_source_review_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.source_review_checksum=0x00000000000000f3",
            "entry.0.source_review_checksum=0x00000000000000f4",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_review_checksum"));
    }

    #[test]
    fn rejects_selector_registry_source_review_path_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_review_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "source_review_path=../evidence/converted-trained-q8/converted-trained.source.review",
            "source_review_path=../evidence/converted-trained-f32/converted-trained.source.review",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("source_review_path"));
    }

    #[test]
    fn rejects_selector_registry_source_validation_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "source_validation_path=../evidence/converted-trained-q8/converted-trained.source.validation",
            "source_validation_path=../evidence/converted-trained-f32/converted-trained.source.validation",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("source_validation_path"));
    }

    #[test]
    fn rejects_selector_registry_admission_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "admission_path=../evidence/converted-trained-q8/converted-trained.admission",
            "admission_path=../evidence/converted-trained-f32/converted-trained.admission",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("admission_path"));
    }

    #[test]
    fn rejects_selector_registry_admission_path_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.admission_path=../evidence/converted-trained-q8/converted-trained.admission",
            "entry.0.admission_path=../evidence/converted-trained-f32/converted-trained.admission",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("admission_path"));
    }

    #[test]
    fn rejects_selector_registry_source_manifest_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest",
            "source_manifest_path=../evidence/converted-trained-f32/converted-trained.source.manifest",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("source manifest path"));
    }

    #[test]
    fn rejects_selector_registry_source_manifest_identity_drift() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.source_manifest_source_id=tinyrustlm-local-source-fixture",
            "entry.0.source_manifest_source_id=tinyrustlm-local-source-drift",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert!(error.to_string().contains("source_manifest_source_id"));
    }

    #[test]
    fn rejects_selector_registry_eval_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "eval_path=../evidence/converted-trained-q8/converted-trained.eval",
            "eval_path=../evidence/converted-trained-f32/converted-trained.eval",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("eval path"));
    }

    #[test]
    fn rejects_selector_registry_runtime_smoke_route_outside_candidate_evidence() {
        let admission = fixture_admission_with_source_manifest_route(
            "converted-trained-q8",
            "tinyrustlm/models/converted-trained-q8.slm",
        )
        .replace(
            "runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime",
            "runtime_smoke_path=../evidence/converted-trained-f32/converted-trained.runtime",
        );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert!(error.to_string().contains("runtime_smoke_path"));
    }

    #[test]
    fn display_name_labels_converted_trained_source_entries() {
        assert_eq!(
            display_name("converted-trained-q8", "q8_0"),
            "Converted trained-source q8_0"
        );
        assert_eq!(
            display_name("tiny-q8-candidate", "q8_0"),
            "tiny-q8-candidate q8_0"
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_operator_receipt_bound_admission() {
        let admission = fixture_operator_receipt_bound_admission(
            "tiny-q8-candidate",
            "tinyrustlm/models/tiny-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "deterministic-bounded-parameter-mutation"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_federated_receipt_bound_admission() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-federated",
            "tinyrustlm/models/tiny-q8-federated.slm",
            "federated-local-update-average",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "federated-local-update-average"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_prune_receipt_bound_admission() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-prune",
            "tinyrustlm/models/tiny-q8-prune.slm",
            "deterministic-magnitude-parameter-pruning",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "deterministic-magnitude-parameter-pruning"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_from_dare_receipt_bound_admission() {
        // Confirms DARE operator receipts keep their kind and byte echo through selector routing.
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-dare",
            "tinyrustlm/models/tiny-q8-dare.slm",
            "dropout-rescaled-task-delta",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let registry_fields = parse_manifest(&registry, "selector registry").unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            registry_fields["entry.0.operator_receipt_status"],
            "receipt-bound"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_operator_kind"],
            "dropout-rescaled-task-delta"
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_checksum"],
            admission_fields["operator_receipt_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_slm_checksum"],
            registry_fields["entry.0.slm_checksum"]
        );
        assert_eq!(
            registry_fields["entry.0.operator_receipt_candidate_artifact_bytes"],
            registry_fields["entry.0.model_bytes"]
        );
    }

    #[test]
    fn rejects_selector_registry_federated_operator_receipt_kind_drift() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-federated",
            "tinyrustlm/models/tiny-q8-federated.slm",
            "federated-local-update-average",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.operator_receipt_operator_kind=federated-local-update-average",
            "entry.0.operator_receipt_operator_kind=deterministic-bounded-parameter-mutation",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_selector_registry_prune_operator_receipt_kind_drift() {
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-prune",
            "tinyrustlm/models/tiny-q8-prune.slm",
            "deterministic-magnitude-parameter-pruning",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.operator_receipt_operator_kind=deterministic-magnitude-parameter-pruning",
            "entry.0.operator_receipt_operator_kind=deterministic-bounded-parameter-mutation",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_selector_registry_dare_operator_receipt_kind_drift() {
        // Keeps DARE selector entries bound to the exact operator kind copied from admission.
        let admission = fixture_operator_receipt_bound_admission_with_kind(
            "tiny-q8-dare",
            "tinyrustlm/models/tiny-q8-dare.slm",
            "dropout-rescaled-task-delta",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.operator_receipt_operator_kind=dropout-rescaled-task-delta",
            "entry.0.operator_receipt_operator_kind=direct-parameter-task-delta",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn writes_and_validates_selector_registry_from_multi_parent_admission_record() {
        let admission =
            fixture_multi_parent_admission("tiny-sign-merge", "tinyrustlm/models/sign-merge.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let fields = parse_manifest(&registry, "selector registry").unwrap();
        let entries = entries_from_admissions(&[admission.clone()]).unwrap();
        let entry = &entries[0];

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.candidate_id=tiny-sign-merge"));
        assert!(registry.contains("entry.0.model_path=../models/sign-merge.slm"));
        assert!(registry.contains("entry.0.operator_receipt_status=receipt-bound"));
        assert!(registry
            .contains("entry.0.operator_receipt_operator_kind=sign-aware-parent-pool-merge"));
        assert!(
            registry.contains("entry.0.operator_receipt_candidate_slm_checksum=0x000000000000000c")
        );
        assert!(registry.contains("entry.0.operator_receipt_candidate_artifact_bytes=1024"));
        assert!(registry.contains("entry.0.evolution_recipe_version=1"));
        assert!(registry
            .contains("entry.0.evolution_recipe_strategy=population-based-parent-pool-replay-v1"));
        assert!(registry.contains("entry.0.evolution_recipe_status=operator-family-planned"));
        assert!(registry.contains(
            "entry.0.evolution_selection_source=population-fitness-normalized-seed-weights"
        ));
        assert!(
            registry.contains("entry.0.evolution_relatedness_contract_checksum=0x0000000000000016")
        );
        assert!(registry
            .contains("entry.0.evolution_schedule_checksum_algorithm=tinyrustlm-text-checksum-v1"));
        assert!(registry.contains("entry.0.evolution_schedule_checksum=0x0000000000000017"));
        assert!(registry.contains("entry.0.scheduled_operator_family_index=0"));
        assert!(registry
            .contains("entry.0.scheduled_operator_family_kind=sign-aware-parent-pool-merge"));
        assert!(registry.contains("entry.0.scheduled_operator_family_command=sign-merge-candidate"));
        assert!(registry.contains(
            "entry.0.scheduled_operator_family_selection_rule=seed-weighted-delta-sign-consensus"
        ));
        assert!(registry.contains(
            "entry.0.scheduled_operator_family_output_gate=multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval"
        ));
        assert!(registry.contains("entry.0.selector_status=admitted"));
        assert_eq!(
            fields["entry.0.mate_selection_id"],
            registry_entry_mate_selection_id(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_status"],
            MATE_SELECTION_PARENT_POOL_STATUS
        );
        assert_eq!(fields["entry.0.mate_selection_parent_count"], "3");
        assert_eq!(
            fields["entry.0.mate_selection_checksum"],
            registry_entry_mate_selection_checksum(entry)
        );
    }

    #[test]
    fn rejects_selector_registry_scheduled_operator_family_kind_drift() {
        let admission =
            fixture_multi_parent_admission("tiny-sign-merge", "tinyrustlm/models/sign-merge.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.scheduled_operator_family_kind=sign-aware-parent-pool-merge",
            "entry.0.scheduled_operator_family_kind=seed-weighted-parent-pool-soup",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("scheduled_operator_family_kind"));
    }

    #[test]
    fn rejects_selector_registry_evolution_schedule_metadata_drift() {
        let admission =
            fixture_multi_parent_admission("tiny-sign-merge", "tinyrustlm/models/sign-merge.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let drift_cases = [
            (
                "evolution_recipe_status",
                "entry.0.evolution_recipe_status=operator-family-planned",
                "entry.0.evolution_recipe_status=operator-family-replayed",
            ),
            (
                "evolution_selection_source",
                "entry.0.evolution_selection_source=population-fitness-normalized-seed-weights",
                "entry.0.evolution_selection_source=population-review-frontier-v1",
            ),
            (
                "evolution_relatedness_contract_checksum",
                "entry.0.evolution_relatedness_contract_checksum=0x0000000000000016",
                "entry.0.evolution_relatedness_contract_checksum=0x0000000000000018",
            ),
            (
                "evolution_schedule_checksum_algorithm",
                "entry.0.evolution_schedule_checksum_algorithm=tinyrustlm-text-checksum-v1",
                "entry.0.evolution_schedule_checksum_algorithm=tinyrustlm-text-checksum-v2",
            ),
            (
                "evolution_schedule_checksum",
                "entry.0.evolution_schedule_checksum=0x0000000000000017",
                "entry.0.evolution_schedule_checksum=0x0000000000000019",
            ),
            (
                "scheduled_operator_family_index",
                "entry.0.scheduled_operator_family_index=0",
                "entry.0.scheduled_operator_family_index=1",
            ),
            (
                "scheduled_operator_family_command",
                "entry.0.scheduled_operator_family_command=sign-merge-candidate",
                "entry.0.scheduled_operator_family_command=soup-candidate",
            ),
            (
                "scheduled_operator_family_selection_rule",
                "entry.0.scheduled_operator_family_selection_rule=seed-weighted-delta-sign-consensus",
                "entry.0.scheduled_operator_family_selection_rule=seed-weighted-direct-parameter-average",
            ),
            (
                "scheduled_operator_family_output_gate",
                "entry.0.scheduled_operator_family_output_gate=multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval",
                "entry.0.scheduled_operator_family_output_gate=selector-registry-only",
            ),
        ];

        for (field, original, replacement) in drift_cases {
            let drifted = registry.replace(original, replacement);
            assert_ne!(
                registry, drifted,
                "{field} drift fixture must replace an existing selector registry line"
            );

            let error = validate_registry_text(&drifted, &[admission.clone()]).unwrap_err();

            assert_eq!(error.kind(), io::ErrorKind::InvalidData);
            assert!(
                error.to_string().contains(field),
                "{field} drift error was {error}"
            );
        }
    }

    #[test]
    fn writes_and_validates_mixed_selector_registry_admission_versions() {
        let first = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let second =
            fixture_multi_parent_admission("tiny-sign-merge", "tinyrustlm/models/sign-merge.slm");
        let registry = build_registry_text(&[first.clone(), second.clone()]).unwrap();

        validate_registry_text(&registry, &[first, second]).unwrap();
        assert!(registry.contains("entry_count=2"));
        assert!(registry.contains("entry.1.candidate_id=tiny-sign-merge"));
    }

    #[test]
    fn writes_frugal_selector_default_for_mixed_quantizations() {
        let f32_admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let q8_admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let q4_admission =
            fixture_q4_admission("tiny-q4-candidate", "tinyrustlm/models/tiny-q4.slm");

        let registry = build_registry_text(&[
            f32_admission.clone(),
            q8_admission.clone(),
            q4_admission.clone(),
        ])
        .unwrap();

        validate_registry_text(&registry, &[f32_admission, q8_admission, q4_admission]).unwrap();
        assert!(registry.contains("entry_count=3"));
        assert!(registry.contains("selector_model_byte_budget=33554432"));
        assert!(registry.contains("selector_default_candidate_id=tiny-q4-candidate"));
        assert!(registry.contains("selector_default_quantization=q4_0"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_adapter_route() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let route = fixture_adapter_route("tiny-f32-candidate");

        let registry =
            build_registry_text_with_adapters(&[admission.clone()], &[route.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.adapter_path=../models/tiny-f32-self.adp1"));
        assert!(registry.contains("entry.0.adapter_label=Tiny f32 self ADP1"));
        assert!(
            registry.contains("entry.0.adapter_apply_status=runtime-f32-compatible-or-fuse-to-slm")
        );
    }

    #[test]
    fn writes_and_validates_selector_registry_with_sparse_adapter_route() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let route = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-sparse.asp1".to_string(),
            manifest_path: "../models/tiny-f32-sparse.asp1.manifest".to_string(),
            label: "Tiny f32 sparse ASP1".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };

        let registry =
            build_registry_text_with_adapters(&[admission.clone()], &[route.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.adapter_path=../models/tiny-f32-sparse.asp1"));
        assert!(registry.contains("entry.0.adapter_label=Tiny f32 sparse ASP1"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_low_rank_adapter_route() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let route = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-low-rank.alr1".to_string(),
            manifest_path: "../models/tiny-f32-low-rank.alr1.manifest".to_string(),
            label: "Tiny f32 low-rank ALR1".to_string(),
            apply_status: LOW_RANK_APPLY_STATUS_F32.to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };

        let registry =
            build_registry_text_with_adapters(&[admission.clone()], &[route.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.adapter_path=../models/tiny-f32-low-rank.alr1"));
        assert!(registry.contains("entry.0.adapter_label=Tiny f32 low-rank ALR1"));
        assert!(registry.contains("entry.0.adapter_apply_status=runtime-f32-compatible-low-rank"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_adapter_family_routes() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };

        let registry = build_registry_text_with_adapters(
            &[admission.clone()],
            &[first.clone(), second.clone()],
        )
        .unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.adapter_path=../models/tiny-f32-self.adp1"));
        assert!(registry.contains("entry.0.adapter_count=2"));
        assert!(registry.contains("entry.0.adapter.0.path=../models/tiny-f32-self.adp1"));
        assert!(registry.contains("entry.0.adapter.1.path=../models/tiny-f32-family.adp1"));
        assert!(registry.contains("entry.0.adapter.1.label=Tiny f32 family ADP1"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_adapter_family_receipt() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);

        let registry = build_registry_text_with_adapter_families(
            &[admission.clone()],
            &[first, second],
            &[family],
        )
        .unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains(
            "entry.0.adapter_family_receipt_path=../models/tiny-f32.adapter-family.receipt"
        ));
        assert!(registry.contains("entry.0.adapter_family_status=receipt-validated"));
        assert!(registry.contains("entry.0.adapter_family_adapter_count=2"));
        assert!(registry.contains("entry.0.adapter_auto_apply_status=enabled"));
        assert!(
            registry.contains("entry.0.adapter_auto_apply_strategy=receipt-preferred-compatible")
        );
        assert!(registry.contains("entry.0.adapter_auto_apply_stack_status=enabled"));
        assert!(registry.contains(
            "entry.0.adapter_auto_apply_stack_strategy=receipt-declared-compatible-stack"
        ));
        assert!(registry.contains("entry.0.adapter_auto_apply_stack_count=2"));
        assert!(registry.contains("entry.0.adapter_auto_apply_byte_budget=1048576"));
    }

    #[test]
    fn rejects_adapter_auto_apply_strategy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let registry = build_registry_text_with_adapter_families(
            &[admission.clone()],
            &[first, second],
            &[family],
        )
        .unwrap()
        .replace(
            "entry.0.adapter_auto_apply_strategy=receipt-preferred-compatible",
            "entry.0.adapter_auto_apply_strategy=manual-only",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("adapter auto apply strategy"));
    }

    #[test]
    fn rejects_adapter_auto_apply_byte_budget_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let registry = build_registry_text_with_adapter_families(
            &[admission.clone()],
            &[first, second],
            &[family],
        )
        .unwrap()
        .replace(
            "entry.0.adapter_auto_apply_byte_budget=1048576",
            "entry.0.adapter_auto_apply_byte_budget=1048577",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("adapter auto apply byte budget"));
    }

    #[test]
    fn rejects_adapter_auto_apply_stack_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let registry = build_registry_text_with_adapter_families(
            &[admission.clone()],
            &[first, second],
            &[family],
        )
        .unwrap()
        .replace(
            "entry.0.adapter_auto_apply_stack_count=2",
            "entry.0.adapter_auto_apply_stack_count=3",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("adapter auto apply stack count"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_assembly_receipt() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let assembly = fixture_assembly_route("tiny-f32-candidate");

        let registry = build_registry_text_with_adapter_family_and_assembly_routes(
            &[admission.clone()],
            &[],
            &[],
            &[assembly],
        )
        .unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(
            registry.contains("entry.0.assembly_receipt_path=../models/tiny-f32.assembly.receipt")
        );
        assert!(registry.contains("entry.0.assembly_status=receipt-validated"));
        assert!(registry.contains("entry.0.assembly_kind=browser-local-assembly-evidence"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_module_plan_receipt() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let tokenizer_checksum = module_plan.tokenizer_checksum.clone();

        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(
            registry.contains("entry.0.module_plan_path=../models/tiny-f32.module-plan.receipt")
        );
        assert!(registry.contains("entry.0.module_plan_status=receipt-validated"));
        assert!(registry.contains("entry.0.module_plan_kind=browser-local-module-plan"));
        assert!(registry.contains("entry.0.module_plan_strategy=selector-entry-self-assembly"));
        assert!(registry
            .contains("entry.0.module_plan_resource_class=browser-constrained-local-assembly"));
        assert!(registry.contains("entry.0.module_plan_profile=browser-constrained-v1"));
        assert!(registry
            .contains("entry.0.module_plan_execution_profile=single-threaded-wasm-local-v1"));
        assert!(registry.contains("entry.0.module_plan_fetch_policy=local-no-store-v1"));
        assert!(
            registry.contains("entry.0.module_plan_origin_policy=same-origin-loopback-local-v1")
        );
        assert!(registry.contains("entry.0.module_plan_fetch_count_limit=32"));
        assert!(registry.contains("entry.0.module_plan_planned_fetch_count=19"));
        assert!(registry.contains("entry.0.module_plan_route_set_version=1"));
        assert!(registry.contains(
            "entry.0.module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1"
        ));
        assert!(registry.contains("entry.0.module_plan_route_set_checksum=0x"));
        assert!(registry.contains("entry.0.module_plan_wasm_memory_initial_pages=17"));
        assert!(registry.contains("entry.0.module_plan_wasm_export_set=tinyrustlm-generate-v1"));
        assert!(
            registry.contains("entry.0.module_plan_wasm_transfer_strategy=copy-then-release-v1")
        );
        assert!(registry
            .contains("entry.0.module_plan_model_release_strategy=free-before-reassembly-v1"));
        assert!(registry.contains(
            "entry.0.module_plan_runtime_reset_strategy=reset-context-before-assembly-v1"
        ));
        assert!(registry.contains(
            "entry.0.module_plan_adapter_validation_strategy=rust-validate-before-apply-v1"
        ));
        assert!(registry.contains("entry.0.module_plan_adapter_validation_count=2"));
        assert!(registry.contains("entry.0.module_plan_adapter_apply_count=2"));
        assert!(registry.contains("entry.0.module_plan_wasm_heap_min_bytes=65536"));
        assert!(registry.contains("entry.0.module_plan_context_token_limit=16"));
        assert!(registry.contains("entry.0.module_plan_sampler_candidate_cap=1024"));
        assert!(registry.contains(&format!(
            "entry.0.module_plan_tokenizer_checksum={tokenizer_checksum}"
        )));
        assert!(registry.contains("entry.0.module_plan_prompt_byte_limit=4096"));
        assert!(registry.contains(&format!(
            "entry.0.module_plan_model_byte_budget={}",
            tiny_fixture_f32_bytes().len()
        )));
        assert!(registry.contains("entry.0.module_plan_adapter_byte_budget=1048576"));
        assert!(registry.contains("entry.0.module_plan_adapter_stack_byte_budget=2048"));
        assert!(registry.contains("entry.0.module_plan_runtime_scratch_byte_budget=65536"));
        assert!(registry.contains("entry.0.module_plan_output_byte_limit=65536"));
        assert!(registry.contains("entry.0.module_plan_kv_cache_byte_budget=1024"));
        assert!(registry.contains("entry.0.module_plan_kv_cache_page_count=1"));
        assert!(registry.contains(&format!(
            "entry.0.module_plan_total_byte_budget={}",
            tiny_fixture_f32_bytes().len() as u64
                + 2048
                + 1024
                + MODULE_PLAN_PROMPT_BYTE_LIMIT
                + MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET
                + MODULE_PLAN_OUTPUT_BYTE_LIMIT
        )));
        assert!(registry.contains(&format!(
            "entry.0.module_plan_total_byte_budget_limit={MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT}"
        )));
        assert!(registry.contains("entry.0.module_plan_module_count=6"));
    }

    #[test]
    fn rejects_module_plan_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_module_count=6",
            "entry.0.module_plan_module_count=5",
        )
        .replace(
            "entry.0.module_plan_planned_fetch_count=19",
            "entry.0.module_plan_planned_fetch_count=18",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("module plan count"));
    }

    #[test]
    fn rejects_module_plan_resource_envelope_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_adapter_byte_budget=1048576",
            "entry.0.module_plan_adapter_byte_budget=1048577",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("adapter byte budget"));
    }

    #[test]
    fn rejects_module_plan_adapter_stack_byte_budget_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_adapter_stack_byte_budget=2048",
            "entry.0.module_plan_adapter_stack_byte_budget=0",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("adapter stack byte budget"));
    }

    #[test]
    fn rejects_module_plan_context_token_limit_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_context_token_limit=16",
            "entry.0.module_plan_context_token_limit=15",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("context token limit"));
    }

    #[test]
    fn rejects_module_plan_sampler_candidate_cap_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_sampler_candidate_cap=1024",
            "entry.0.module_plan_sampler_candidate_cap=1025",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("sampler candidate cap"));
    }

    #[test]
    fn rejects_module_plan_tokenizer_checksum_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let tokenizer_checksum = module_plan.tokenizer_checksum.clone();
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            &format!("entry.0.module_plan_tokenizer_checksum={tokenizer_checksum}"),
            "entry.0.module_plan_tokenizer_checksum=0x000000000000001d",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("tokenizer checksum"));
    }

    #[test]
    fn rejects_module_plan_profile_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_profile=browser-constrained-v1",
            "entry.0.module_plan_profile=desktop-expanded-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("profile"));
    }

    #[test]
    fn rejects_module_plan_execution_profile_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_execution_profile=single-threaded-wasm-local-v1",
            "entry.0.module_plan_execution_profile=worker-pooled-wasm-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("execution profile"));
    }

    #[test]
    fn rejects_module_plan_fetch_policy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_fetch_policy=local-no-store-v1",
            "entry.0.module_plan_fetch_policy=cache-default-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("fetch policy"));
    }

    #[test]
    fn rejects_module_plan_origin_policy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_origin_policy=same-origin-loopback-local-v1",
            "entry.0.module_plan_origin_policy=cross-origin-network-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("origin policy"));
    }

    #[test]
    fn rejects_module_plan_runtime_scratch_budget_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_runtime_scratch_byte_budget=65536",
            "entry.0.module_plan_runtime_scratch_byte_budget=65535",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("runtime scratch byte budget"));
    }

    #[test]
    fn rejects_module_plan_kv_cache_byte_budget_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_kv_cache_byte_budget=1024",
            "entry.0.module_plan_kv_cache_byte_budget=0",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("kv cache byte budget"));
    }

    #[test]
    fn rejects_module_plan_output_byte_limit_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_output_byte_limit=65536",
            "entry.0.module_plan_output_byte_limit=65535",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("output byte limit"));
    }

    #[test]
    fn rejects_module_plan_prompt_byte_limit_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_prompt_byte_limit=4096",
            "entry.0.module_plan_prompt_byte_limit=4095",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("prompt byte limit"));
    }

    #[test]
    fn rejects_module_plan_fetch_count_limit_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_fetch_count_limit=32",
            "entry.0.module_plan_fetch_count_limit=31",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("fetch count limit"));
    }

    #[test]
    fn rejects_module_plan_planned_fetch_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_planned_fetch_count=19",
            "entry.0.module_plan_planned_fetch_count=18",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("planned fetch count"));
    }

    #[test]
    fn rejects_module_plan_route_set_checksum_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let route_set_checksum = module_plan.route_set_checksum.clone();
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            &format!("entry.0.module_plan_route_set_checksum={route_set_checksum}"),
            "entry.0.module_plan_route_set_checksum=0x000000000000001d",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("route set checksum"));
    }

    #[test]
    fn rejects_module_plan_operator_receipt_path_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_operator_receipt_path=../evidence/tiny-f32-candidate/sign-merge.operator",
            "entry.0.module_plan_operator_receipt_path=../evidence/tiny-f32-candidate/other.operator",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator receipt path"));
    }

    #[test]
    fn rejects_module_plan_operator_receipt_checksum_drift() {
        let admission = fixture_operator_receipt_bound_f32_admission(
            "tiny-f32-candidate",
            "tinyrustlm/models/tiny-f32.slm",
        );
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let admission_fields = parse_manifest(&admission, "admission").unwrap();
        let mut module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        module_plan.operator_receipt_checksum =
            admission_fields["operator_receipt_checksum"].clone();
        let operator_receipt_checksum = module_plan.operator_receipt_checksum.clone();
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            &format!("entry.0.module_plan_operator_receipt_checksum={operator_receipt_checksum}"),
            "entry.0.module_plan_operator_receipt_checksum=0x0000000000000002",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator receipt checksum"));
    }

    #[test]
    fn rejects_module_plan_route_set_version_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_route_set_version=1",
            "entry.0.module_plan_route_set_version=2",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("route set version"));
    }

    #[test]
    fn rejects_module_plan_route_set_checksum_algorithm_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1",
            "entry.0.module_plan_route_set_checksum_algorithm=legacy-text-checksum-v0",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("route set checksum algorithm"));
    }

    #[test]
    fn rejects_module_plan_missing_prompt_byte_limit() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace("entry.0.module_plan_prompt_byte_limit=4096\n", "");

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("module_plan_prompt_byte_limit"));
    }

    #[test]
    fn rejects_module_plan_missing_fetch_count_limit() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace("entry.0.module_plan_fetch_count_limit=32\n", "");

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("module_plan_fetch_count_limit"));
    }

    #[test]
    fn rejects_module_plan_missing_planned_fetch_count() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace("entry.0.module_plan_planned_fetch_count=19\n", "");

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("module_plan_planned_fetch_count"));
    }

    #[test]
    fn rejects_module_plan_missing_route_set_checksum() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let route_set_checksum = module_plan.route_set_checksum.clone();
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            &format!("entry.0.module_plan_route_set_checksum={route_set_checksum}\n"),
            "",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("module_plan_route_set_checksum"));
    }

    #[test]
    fn rejects_module_plan_missing_route_set_version() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace("entry.0.module_plan_route_set_version=1\n", "");

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("module_plan_route_set_version"));
    }

    #[test]
    fn rejects_module_plan_missing_route_set_checksum_algorithm() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1\n",
            "",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("module_plan_route_set_checksum_algorithm"));
    }

    #[test]
    fn rejects_module_plan_missing_output_byte_limit() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace("entry.0.module_plan_output_byte_limit=65536\n", "");

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("module_plan_output_byte_limit"));
    }

    #[test]
    fn rejects_module_plan_kv_cache_page_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_kv_cache_page_count=1",
            "entry.0.module_plan_kv_cache_page_count=2",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("kv cache page count"));
    }

    #[test]
    fn rejects_module_plan_wasm_memory_initial_pages_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_wasm_memory_initial_pages=17",
            "entry.0.module_plan_wasm_memory_initial_pages=18",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error
            .to_string()
            .contains("module plan wasm memory initial pages"));
    }

    #[test]
    fn rejects_module_plan_wasm_export_set_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_wasm_export_set=tinyrustlm-generate-v1",
            "entry.0.module_plan_wasm_export_set=tinyrustlm-extra-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("module plan wasm export set"));
    }

    #[test]
    fn rejects_module_plan_wasm_transfer_strategy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_wasm_transfer_strategy=copy-then-release-v1",
            "entry.0.module_plan_wasm_transfer_strategy=copy-keep-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("wasm transfer strategy"));
    }

    #[test]
    fn rejects_module_plan_model_release_strategy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_model_release_strategy=free-before-reassembly-v1",
            "entry.0.module_plan_model_release_strategy=keep-resident-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("model release strategy"));
    }

    #[test]
    fn rejects_module_plan_runtime_reset_strategy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_runtime_reset_strategy=reset-context-before-assembly-v1",
            "entry.0.module_plan_runtime_reset_strategy=skip-reset-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("runtime reset strategy"));
    }

    #[test]
    fn rejects_module_plan_adapter_validation_strategy_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_adapter_validation_strategy=rust-validate-before-apply-v1",
            "entry.0.module_plan_adapter_validation_strategy=apply-without-rust-validate-v1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("adapter validation strategy"));
    }

    #[test]
    fn rejects_module_plan_adapter_validation_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_adapter_validation_count=2",
            "entry.0.module_plan_adapter_validation_count=1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("adapter validation count"));
    }

    #[test]
    fn rejects_module_plan_adapter_apply_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_adapter_apply_count=2",
            "entry.0.module_plan_adapter_apply_count=0",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();
        assert!(error.to_string().contains("adapter apply count"));
    }

    #[test]
    fn rejects_module_plan_wasm_heap_min_bytes_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_wasm_heap_min_bytes=65536",
            "entry.0.module_plan_wasm_heap_min_bytes=65535",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("wasm heap min bytes"));
    }

    #[test]
    fn rejects_module_plan_total_budget_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            &format!(
                "entry.0.module_plan_total_byte_budget={}",
                tiny_fixture_f32_bytes().len() as u64
                    + 2048
                    + 1024
                    + MODULE_PLAN_PROMPT_BYTE_LIMIT
                    + MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET
                    + MODULE_PLAN_OUTPUT_BYTE_LIMIT
            ),
            "entry.0.module_plan_total_byte_budget=1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("total byte budget"));
    }

    #[test]
    fn rejects_module_plan_total_budget_limit_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            &format!(
                "entry.0.module_plan_total_byte_budget_limit={MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT}"
            ),
            "entry.0.module_plan_total_byte_budget_limit=1",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("total byte budget limit"));
    }

    #[test]
    fn rejects_module_plan_missing_runtime_scratch_budget() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_runtime_scratch_byte_budget=65536\n",
            "",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("module_plan_runtime_scratch_byte_budget"));
    }

    #[test]
    fn rejects_module_plan_missing_wasm_heap_min_bytes() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace("entry.0.module_plan_wasm_heap_min_bytes=65536\n", "");

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("module_plan_wasm_heap_min_bytes"));
    }

    #[test]
    fn rejects_module_plan_malformed_runtime_scratch_budget() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_runtime_scratch_byte_budget=65536",
            "entry.0.module_plan_runtime_scratch_byte_budget=065536",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("runtime scratch byte budget"));
    }

    #[test]
    fn rejects_module_plan_malformed_wasm_heap_min_bytes() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap()
        .replace(
            "entry.0.module_plan_wasm_heap_min_bytes=65536",
            "entry.0.module_plan_wasm_heap_min_bytes=065536",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("wasm heap byte budget"));
    }

    #[test]
    fn writes_selector_registry_genome_species_novelty_population_phenotype_and_fitness_metadata() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap();
        let fields = parse_manifest(&registry, "selector registry").unwrap();
        let entries = entries_from_admissions(&[admission.clone()]).unwrap();
        let entry = &entries[0];

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(fields["entry.0.genome_id"], registry_entry_genome_id(entry));
        assert_eq!(fields["entry.0.genome_strategy"], GENOME_STRATEGY);
        assert_eq!(
            fields["entry.0.genome_lineage_status"],
            GENOME_LINEAGE_STATUS
        );
        assert_eq!(
            fields["entry.0.genome_lineage_checksum"],
            registry_entry_genome_lineage_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.species_id"],
            registry_entry_species_id(entry)
        );
        assert_eq!(fields["entry.0.species_strategy"], SPECIES_STRATEGY);
        assert_eq!(fields["entry.0.species_fit_status"], SPECIES_FIT_STATUS);
        assert_eq!(
            fields["entry.0.species_fit_checksum"],
            registry_entry_species_fit_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.novelty_id"],
            registry_entry_novelty_id(entry)
        );
        assert_eq!(fields["entry.0.novelty_strategy"], NOVELTY_STRATEGY);
        assert_eq!(fields["entry.0.novelty_status"], NOVELTY_STATUS);
        assert_eq!(
            fields["entry.0.novelty_checksum"],
            registry_entry_novelty_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.population_id"],
            registry_entry_population_id(entry)
        );
        assert_eq!(fields["entry.0.population_strategy"], POPULATION_STRATEGY);
        assert_eq!(fields["entry.0.population_status"], POPULATION_STATUS);
        assert_eq!(
            fields["entry.0.population_checksum"],
            registry_entry_population_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_id"],
            registry_entry_mate_selection_id(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_strategy"],
            MATE_SELECTION_STRATEGY
        );
        assert_eq!(
            fields["entry.0.mate_selection_status"],
            MATE_SELECTION_ADMISSION_STATUS
        );
        assert_eq!(fields["entry.0.mate_selection_parent_count"], "1");
        assert_eq!(
            fields["entry.0.mate_selection_checksum"],
            registry_entry_mate_selection_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_id"],
            registry_entry_phenotype_evidence_id(entry)
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_strategy"],
            PHENOTYPE_EVIDENCE_STRATEGY
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_status"],
            PHENOTYPE_EVIDENCE_STATUS
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_checksum"],
            registry_entry_phenotype_evidence_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_id"],
            registry_entry_heritable_artifact_id(entry)
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_strategy"],
            HERITABLE_ARTIFACT_STRATEGY
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_status"],
            HERITABLE_ARTIFACT_STATUS
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_checksum"],
            registry_entry_heritable_artifact_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.provenance_manifest_checksum"],
            entry.provenance_manifest_checksum
        );
        assert_eq!(
            fields["entry.0.fitness_vector_status"],
            FITNESS_VECTOR_STATUS
        );
        assert_eq!(
            fields["entry.0.fitness_vector_checksum"],
            registry_entry_fitness_vector_checksum(entry)
        );
    }

    #[test]
    fn writes_selector_registry_module_plan_species_fit_novelty_and_population_metadata() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let first = fixture_adapter_route("tiny-f32-candidate");
        let second = RegistryAdapterRoute {
            adapter_path: "../models/tiny-f32-family.adp1".to_string(),
            manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
            label: "Tiny f32 family ADP1".to_string(),
            artifact_checksum: "0x00000000000000cc".to_string(),
            manifest_checksum: "0x00000000000000dd".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);
        let assembly = fixture_assembly_route("tiny-f32-candidate");
        let module_plan = fixture_module_plan_route("tiny-f32-candidate", 6);
        let registry = build_registry_text_with_module_plan_routes(
            &[admission.clone()],
            &[first, second],
            &[family],
            &[assembly],
            &[module_plan],
        )
        .unwrap();
        let fields = parse_manifest(&registry, "selector registry").unwrap();
        let actual_adapter_routes = adapter_routes_from_registry(&fields).unwrap();
        let actual_family_routes = adapter_family_routes_from_registry(&fields).unwrap();
        let actual_assembly_routes = assembly_routes_from_registry(&fields).unwrap();
        let actual_module_plan_routes = module_plan_routes_from_registry(&fields).unwrap();
        let mut entries = entries_from_admissions(&[admission.clone()]).unwrap();
        attach_adapter_routes(&mut entries, &actual_adapter_routes).unwrap();
        attach_adapter_family_routes(&mut entries, &actual_family_routes).unwrap();
        attach_assembly_routes(&mut entries, &actual_assembly_routes).unwrap();
        attach_module_plan_routes(&mut entries, &actual_module_plan_routes).unwrap();
        let entry = &entries[0];

        validate_registry_text(&registry, &[admission]).unwrap();
        assert_eq!(
            fields["entry.0.species_id"],
            registry_entry_species_id(entry)
        );
        assert_eq!(
            fields["entry.0.species_fit_checksum"],
            registry_entry_species_fit_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.novelty_id"],
            registry_entry_novelty_id(entry)
        );
        assert_eq!(
            fields["entry.0.novelty_checksum"],
            registry_entry_novelty_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.population_id"],
            registry_entry_population_id(entry)
        );
        assert_eq!(
            fields["entry.0.population_checksum"],
            registry_entry_population_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_id"],
            registry_entry_mate_selection_id(entry)
        );
        assert_eq!(
            fields["entry.0.mate_selection_checksum"],
            registry_entry_mate_selection_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_id"],
            registry_entry_phenotype_evidence_id(entry)
        );
        assert_eq!(
            fields["entry.0.phenotype_evidence_checksum"],
            registry_entry_phenotype_evidence_checksum(entry)
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_id"],
            registry_entry_heritable_artifact_id(entry)
        );
        assert_eq!(
            fields["entry.0.heritable_artifact_checksum"],
            registry_entry_heritable_artifact_checksum(entry)
        );
    }

    #[test]
    fn rejects_selector_registry_genome_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.genome_strategy=selector-admission-genome-v1",
            "entry.0.genome_strategy=selector-admission-genome-v2",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("genome_strategy"));
    }

    #[test]
    fn rejects_selector_registry_species_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.species_fit_status=browser-fit-bound",
            "entry.0.species_fit_status=desktop-fit-bound",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("species_fit_status"));
    }

    #[test]
    fn rejects_selector_registry_novelty_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.novelty_status=behavior-sketch-bound",
            "entry.0.novelty_status=unreviewed",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("novelty_status"));
    }

    #[test]
    fn rejects_selector_registry_population_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.population_status=population-review-bound",
            "entry.0.population_status=unreviewed",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("population_status"));
    }

    #[test]
    fn rejects_selector_registry_mate_selection_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.mate_selection_status=admission-only",
            "entry.0.mate_selection_status=unbound",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("mate_selection_status"));
    }

    #[test]
    fn rejects_selector_registry_mate_selection_parent_count_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.mate_selection_parent_count=1",
            "entry.0.mate_selection_parent_count=2",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("mate_selection_parent_count"));
    }

    #[test]
    fn rejects_selector_registry_operator_receipt_field_drift() {
        let admission = fixture_operator_receipt_bound_admission(
            "tiny-q8-candidate",
            "tinyrustlm/models/tiny-q8.slm",
        );
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.operator_receipt_operator_kind=deterministic-bounded-parameter-mutation",
            "entry.0.operator_receipt_operator_kind=unbound",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("operator_receipt_operator_kind"));
    }

    #[test]
    fn rejects_selector_registry_phenotype_evidence_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.phenotype_evidence_status=runtime-eval-bound",
            "entry.0.phenotype_evidence_status=unbound",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("phenotype_evidence_status"));
    }

    #[test]
    fn rejects_selector_registry_heritable_artifact_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.heritable_artifact_status=served-artifact-bound",
            "entry.0.heritable_artifact_status=detached",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("heritable_artifact_status"));
    }

    #[test]
    fn rejects_selector_registry_fitness_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "entry.0.fitness_vector_status=eval-bound",
            "entry.0.fitness_vector_status=unreviewed",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("fitness_vector_status"));
    }

    #[test]
    fn writes_and_validates_selector_registry_with_q8_adapter_route() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let route = RegistryAdapterRoute {
            candidate_id: "tiny-q8-candidate".to_string(),
            adapter_path: "../models/tiny-q8-self.adp1".to_string(),
            manifest_path: "../models/tiny-q8-self.adp1.manifest".to_string(),
            label: "Tiny q8_0 self ADP1".to_string(),
            apply_status: ADAPTER_APPLY_STATUS_QUANTIZED.to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };

        let registry =
            build_registry_text_with_adapters(&[admission.clone()], &[route.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.quantization=q8_0"));
        assert!(registry.contains("entry.0.adapter_path=../models/tiny-q8-self.adp1"));
        assert!(registry
            .contains("entry.0.adapter_apply_status=runtime-q8-q4-compatible-or-fuse-to-slm"));
    }

    #[test]
    fn rejects_adapter_route_apply_status_quantization_mismatch() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let route = RegistryAdapterRoute {
            candidate_id: "tiny-q8-candidate".to_string(),
            ..fixture_adapter_route("tiny-f32-candidate")
        };

        let error = build_registry_text_with_adapters(&[admission], &[route]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("entry quantization"));
    }

    #[test]
    fn rejects_duplicate_adapter_route_for_same_candidate() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let route = fixture_adapter_route("tiny-f32-candidate");

        let error =
            build_registry_text_with_adapters(&[admission], &[route.clone(), route]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("duplicate selector registry adapter route"));
    }

    #[test]
    fn rejects_adapter_family_receipt_count_drift() {
        let admission =
            fixture_f32_admission("tiny-f32-candidate", "tinyrustlm/models/tiny-f32.slm");
        let route = fixture_adapter_route("tiny-f32-candidate");
        let family = fixture_adapter_family_route("tiny-f32-candidate", 2);

        let error = build_registry_text_with_adapter_families(&[admission], &[route], &[family])
            .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("family count"));
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
    fn rejects_selector_registry_model_bytes_over_budget() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm")
            .replace(
                "candidate_artifact_bytes=8832",
                "candidate_artifact_bytes=33554433",
            );

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("browser selector budget"));
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

    #[test]
    fn rejects_selector_registry_budget_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "selector_model_byte_budget=33554432",
            "selector_model_byte_budget=33554431",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("selector_model_byte_budget"));
    }

    #[test]
    fn rejects_selector_registry_text_budget_drift() {
        let admission = fixture_admission("tiny-q8-candidate", "tinyrustlm/models/tiny-q8.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap().replace(
            "manifest_text_byte_budget=65536",
            "manifest_text_byte_budget=65537",
        );

        let error = validate_registry_text(&registry, &[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest_text_byte_budget"));
    }

    #[test]
    fn rejects_unsupported_admission_version() {
        let admission = "selector_id=browser-local-selector\ncandidate_id=oops\n".to_string();

        let error = build_registry_text(&[admission]).unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("supported admission version"));
    }

    fn fixture_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_q8_bytes())
    }

    fn fixture_admission_with_source_manifest_route(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        // Adds the converted-trained source evidence route extension consumed by selector entries.
        let mut admission = fixture_admission(candidate_id, candidate_path);
        push_line(
            &mut admission,
            "admission_path",
            &format!("../evidence/{candidate_id}/converted-trained.admission"),
        );
        push_line(
            &mut admission,
            "source_manifest_path",
            &format!("../evidence/{candidate_id}/converted-trained.source.manifest"),
        );
        push_line(
            &mut admission,
            "source_manifest_checksum",
            "0x00000000000000f1",
        );
        push_line(&mut admission, "source_manifest_kind", SOURCE_MANIFEST_KIND);
        push_line(
            &mut admission,
            "source_manifest_status",
            SOURCE_MANIFEST_STATUS,
        );
        push_line(
            &mut admission,
            "source_manifest_source_kind",
            "trained-source-fixture",
        );
        push_line(
            &mut admission,
            "source_manifest_source_id",
            "tinyrustlm-local-source-fixture",
        );
        push_line(
            &mut admission,
            "source_manifest_model_shape",
            "tiny-fixture",
        );
        push_line(
            &mut admission,
            "source_validation_path",
            &format!("../evidence/{candidate_id}/converted-trained.source.validation"),
        );
        push_line(
            &mut admission,
            "source_validation_checksum",
            "0x00000000000000f5",
        );
        push_line(
            &mut admission,
            "runtime_smoke_path",
            &format!("../evidence/{candidate_id}/converted-trained.runtime"),
        );
        push_line(
            &mut admission,
            "eval_path",
            &format!("../evidence/{candidate_id}/converted-trained.eval"),
        );
        admission
    }

    fn fixture_admission_with_source_review_route(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        // Adds pre-extraction safetensors review evidence to the converted-trained source route.
        let mut admission =
            fixture_admission_with_source_manifest_route(candidate_id, candidate_path);
        push_line(&mut admission, "source_review_kind", SOURCE_REVIEW_KIND);
        push_line(
            &mut admission,
            "source_review_path",
            &format!("../evidence/{candidate_id}/converted-trained.source.review"),
        );
        push_line(&mut admission, "source_review_status", SOURCE_REVIEW_STATUS);
        push_line(
            &mut admission,
            "source_review_checksum",
            "0x00000000000000f3",
        );
        push_line(
            &mut admission,
            "source_review_required_next_gate",
            SOURCE_REVIEW_REQUIRED_NEXT_GATE,
        );
        admission
    }

    fn fixture_f32_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_f32_bytes())
    }

    fn fixture_q4_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_q4_bytes())
    }

    fn fixture_operator_receipt_bound_admission(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes(
            candidate_id,
            candidate_path,
            tiny_fixture_q8_bytes(),
        )
    }

    fn fixture_operator_receipt_bound_f32_admission(
        candidate_id: &str,
        candidate_path: &str,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes(
            candidate_id,
            candidate_path,
            tiny_fixture_f32_bytes(),
        )
    }

    fn fixture_operator_receipt_bound_admission_for_bytes(
        candidate_id: &str,
        candidate_path: &str,
        candidate: Vec<u8>,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes_with_kind(
            candidate_id,
            candidate_path,
            candidate,
            "deterministic-bounded-parameter-mutation",
        )
    }

    fn fixture_operator_receipt_bound_admission_with_kind(
        candidate_id: &str,
        candidate_path: &str,
        operator_kind: &str,
    ) -> String {
        fixture_operator_receipt_bound_admission_for_bytes_with_kind(
            candidate_id,
            candidate_path,
            tiny_fixture_q8_bytes(),
            operator_kind,
        )
    }

    // Builds a full two-parent admission chain with the requested operator kind in the bound receipt.
    fn fixture_operator_receipt_bound_admission_for_bytes_with_kind(
        candidate_id: &str,
        candidate_path: &str,
        candidate: Vec<u8>,
        operator_kind: &str,
    ) -> String {
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
        let receipt =
            operator_receipt_text_with_kind(&lineage, &candidate, candidate_path, operator_kind);
        let candidate_manifest = candidate::build_manifest_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            Some(("candidate.operator", &receipt)),
        )
        .unwrap();
        let promotion = promotion::build_template_text_with_operator_receipt_text(
            &compatibility,
            &lineage,
            &candidate,
            candidate_path,
            &candidate_manifest,
            "local-smoke-runner",
            promotion::DEFAULT_PROMOTION_SCOPE,
            Some(("candidate.operator", &receipt)),
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
        admission::build_record_text_with_operator_receipt_text(
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
            Some(("candidate.operator", &receipt)),
        )
        .unwrap()
    }

    fn fixture_admission_for_bytes(
        candidate_id: &str,
        candidate_path: &str,
        candidate: Vec<u8>,
    ) -> String {
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

    // Keeps the synthetic receipt minimal while letting tests prove non-mutation operator routing.
    fn operator_receipt_text_with_kind(
        lineage_text: &str,
        candidate: &[u8],
        candidate_path: &str,
        operator_kind: &str,
    ) -> String {
        let lineage_fields = parse_manifest(lineage_text, "lineage").unwrap();
        let report = slm_validate::validate_bytes(candidate, candidate_path).unwrap();
        let mut text = String::new();
        push_line(&mut text, "operator_kind", operator_kind);
        push_line(
            &mut text,
            "candidate_id",
            require_key(&lineage_fields, "candidate_id").unwrap(),
        );
        push_line(
            &mut text,
            "operator_id",
            require_key(&lineage_fields, "operator_id").unwrap(),
        );
        push_line(&mut text, "candidate_artifact_path", report.path());
        push_line(
            &mut text,
            "candidate_artifact_bytes",
            &report.file_bytes().to_string(),
        );
        push_line(
            &mut text,
            "candidate_slm_checksum",
            &hex64(report.checksum()),
        );
        push_line(
            &mut text,
            "required_next_gate",
            "candidate-manifest-plus-runtime-smoke-plus-eval",
        );
        text
    }

    fn fixture_adapter_route(candidate_id: &str) -> RegistryAdapterRoute {
        RegistryAdapterRoute {
            candidate_id: candidate_id.to_string(),
            adapter_path: "../models/tiny-f32-self.adp1".to_string(),
            manifest_path: "../models/tiny-f32-self.adp1.manifest".to_string(),
            label: "Tiny f32 self ADP1".to_string(),
            apply_status: ADAPTER_APPLY_STATUS_F32.to_string(),
            artifact_checksum: "0x00000000000000aa".to_string(),
            manifest_checksum: "0x00000000000000bb".to_string(),
        }
    }

    fn fixture_adapter_family_route(
        candidate_id: &str,
        adapter_count: usize,
    ) -> RegistryAdapterFamilyRoute {
        RegistryAdapterFamilyRoute {
            candidate_id: candidate_id.to_string(),
            receipt_path: "../models/tiny-f32.adapter-family.receipt".to_string(),
            label: "Tiny f32 adapter family".to_string(),
            status: ADAPTER_FAMILY_STATUS.to_string(),
            strategy: ADAPTER_FAMILY_STRATEGY.to_string(),
            receipt_checksum: "0x00000000000000ee".to_string(),
            adapter_count,
            auto_apply_status: ADAPTER_AUTO_APPLY_STATUS.to_string(),
            auto_apply_strategy: ADAPTER_AUTO_APPLY_STRATEGY.to_string(),
            auto_apply_stack_status: ADAPTER_AUTO_APPLY_STACK_STATUS.to_string(),
            auto_apply_stack_strategy: ADAPTER_AUTO_APPLY_STACK_STRATEGY.to_string(),
            auto_apply_stack_count: adapter_count,
            auto_apply_byte_budget: ADAPTER_AUTO_APPLY_BYTE_BUDGET,
        }
    }

    fn fixture_assembly_route(candidate_id: &str) -> RegistryAssemblyRoute {
        RegistryAssemblyRoute {
            candidate_id: candidate_id.to_string(),
            receipt_path: "../models/tiny-f32.assembly.receipt".to_string(),
            label: "Tiny f32 assembly evidence".to_string(),
            status: ASSEMBLY_RECEIPT_STATUS.to_string(),
            kind: ASSEMBLY_RECEIPT_KIND.to_string(),
            receipt_checksum: "0x00000000000000ef".to_string(),
        }
    }

    fn fixture_module_plan_route(
        candidate_id: &str,
        module_count: usize,
    ) -> RegistryModulePlanRoute {
        let tokenizer_report =
            slm_validate::validate_bytes(&tiny_fixture_f32_bytes(), "tiny-f32.slm").unwrap();
        let adapters = vec![
            fixture_adapter_route(candidate_id),
            RegistryAdapterRoute {
                adapter_path: "../models/tiny-f32-family.adp1".to_string(),
                manifest_path: "../models/tiny-f32-family.adp1.manifest".to_string(),
                label: "Tiny f32 family ADP1".to_string(),
                artifact_checksum: "0x00000000000000cc".to_string(),
                manifest_checksum: "0x00000000000000dd".to_string(),
                ..fixture_adapter_route(candidate_id)
            },
        ];
        let route_set_checksum = module_plan_route_set_checksum_from_parts(
            candidate_id,
            "../models/tiny-f32.module-plan.receipt",
            "../models/tiny-f32.slm",
            "../models/tiny-f32.slm.manifest",
            "../models/tiny-f32.assembly.receipt",
            "../models/tiny-f32.adapter-family.receipt",
            &adapters,
            2,
            &format!("../evidence/{candidate_id}/sign-merge.operator"),
        )
        .unwrap();
        RegistryModulePlanRoute {
            candidate_id: candidate_id.to_string(),
            receipt_path: "../models/tiny-f32.module-plan.receipt".to_string(),
            label: "Tiny f32 module plan".to_string(),
            status: MODULE_PLAN_STATUS.to_string(),
            kind: MODULE_PLAN_KIND.to_string(),
            strategy: MODULE_PLAN_STRATEGY.to_string(),
            resource_class: MODULE_PLAN_RESOURCE_CLASS.to_string(),
            profile: MODULE_PLAN_PROFILE.to_string(),
            execution_profile: MODULE_PLAN_EXECUTION_PROFILE.to_string(),
            fetch_policy: MODULE_PLAN_FETCH_POLICY.to_string(),
            origin_policy: MODULE_PLAN_ORIGIN_POLICY.to_string(),
            fetch_count_limit: MODULE_PLAN_FETCH_COUNT_LIMIT,
            planned_fetch_count: module_plan_planned_fetch_count(module_count, 2).unwrap(),
            route_set_version: MODULE_PLAN_ROUTE_SET_VERSION.to_string(),
            route_set_checksum_algorithm: MODULE_PLAN_ROUTE_SET_CHECKSUM_ALGORITHM.to_string(),
            route_set_checksum,
            operator_receipt_path: format!("../evidence/{candidate_id}/sign-merge.operator"),
            operator_receipt_checksum: "0x0000000000000001".to_string(),
            wasm_memory_initial_pages: MODULE_PLAN_WASM_MEMORY_INITIAL_PAGES,
            wasm_export_set: MODULE_PLAN_WASM_EXPORT_SET.to_string(),
            wasm_transfer_strategy: MODULE_PLAN_WASM_TRANSFER_STRATEGY.to_string(),
            model_release_strategy: MODULE_PLAN_MODEL_RELEASE_STRATEGY.to_string(),
            runtime_reset_strategy: MODULE_PLAN_RUNTIME_RESET_STRATEGY.to_string(),
            adapter_validation_strategy: MODULE_PLAN_ADAPTER_VALIDATION_STRATEGY.to_string(),
            adapter_validation_count: 2,
            adapter_apply_count: 2,
            wasm_heap_min_bytes: MODULE_PLAN_WASM_HEAP_MIN_BYTES,
            context_token_limit: 16,
            sampler_candidate_cap: MODULE_PLAN_SAMPLER_CANDIDATE_CAP,
            tokenizer_checksum: hex64(tokenizer_report.tokenizer_checksum()),
            prompt_byte_limit: MODULE_PLAN_PROMPT_BYTE_LIMIT,
            model_byte_budget: tiny_fixture_f32_bytes().len() as u64,
            adapter_byte_budget: ADAPTER_AUTO_APPLY_BYTE_BUDGET,
            adapter_stack_byte_budget: 2048,
            runtime_scratch_byte_budget: MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET,
            output_byte_limit: MODULE_PLAN_OUTPUT_BYTE_LIMIT,
            kv_cache_byte_budget: 1024,
            kv_cache_page_count: 1,
            total_byte_budget: tiny_fixture_f32_bytes().len() as u64
                + 2048
                + 1024
                + MODULE_PLAN_PROMPT_BYTE_LIMIT
                + MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET
                + MODULE_PLAN_OUTPUT_BYTE_LIMIT,
            total_byte_budget_limit: MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT,
            receipt_checksum: "0x00000000000000f0".to_string(),
            module_count,
        }
    }

    fn fixture_multi_parent_admission(candidate_id: &str, candidate_path: &str) -> String {
        let mut text = String::new();
        push_line(
            &mut text,
            "tinyrustlm_multi_parent_selector_admission_version",
            "1",
        );
        push_line(&mut text, "admission_kind", "multi-parent-sign-merge");
        push_line(&mut text, "selector_id", "browser-local-selector");
        push_line(
            &mut text,
            "admission_status",
            "admitted-for-browser-selector",
        );
        push_line(
            &mut text,
            "promotion_status",
            "runtime-smoke-and-eval-passed",
        );
        push_line(&mut text, "promotion_kind", "multi-parent-sign-merge");
        push_line(&mut text, "promoter_id", "local-smoke-runner");
        push_line(
            &mut text,
            "promotion_scope",
            promotion::DEFAULT_PROMOTION_SCOPE,
        );
        push_line(&mut text, "operator_receipt_checksum", "0x0000000000000001");
        push_line(&mut text, "operator_receipt_status", "receipt-bound");
        push_line(
            &mut text,
            "operator_receipt_path",
            "tinyrustlm/models/sign-merge.operator",
        );
        push_line(&mut text, "operator_receipt_operator_id", candidate_id);
        push_line(
            &mut text,
            "operator_receipt_operator_kind",
            "sign-aware-parent-pool-merge",
        );
        push_line(
            &mut text,
            "operator_receipt_candidate_slm_checksum",
            "0x000000000000000c",
        );
        push_line(
            &mut text,
            "operator_receipt_candidate_artifact_bytes",
            "1024",
        );
        push_line(
            &mut text,
            "parent_pool_recipe_checksum",
            "0x0000000000000002",
        );
        push_line(
            &mut text,
            "population_review_checksum",
            "0x0000000000000003",
        );
        push_line(&mut text, "promotion_ledger_checksum", "0x0000000000000004");
        push_line(&mut text, "admission_set_checksum", "0x0000000000000005");
        push_line(&mut text, "frontier_candidate_id", candidate_id);
        push_line(
            &mut text,
            "frontier_candidate_slm_checksum",
            "0x0000000000000006",
        );
        push_line(&mut text, "parent_count", "3");
        push_line(&mut text, "evolution_recipe_version", "1");
        push_line(
            &mut text,
            "evolution_recipe_strategy",
            "population-based-parent-pool-replay-v1",
        );
        push_line(
            &mut text,
            "evolution_recipe_status",
            "operator-family-planned",
        );
        push_line(
            &mut text,
            "evolution_selection_source",
            "population-fitness-normalized-seed-weights",
        );
        push_line(
            &mut text,
            "evolution_relatedness_contract_checksum",
            "0x0000000000000016",
        );
        push_line(
            &mut text,
            "evolution_schedule_checksum_algorithm",
            "tinyrustlm-text-checksum-v1",
        );
        push_line(
            &mut text,
            "evolution_schedule_checksum",
            "0x0000000000000017",
        );
        push_line(&mut text, "scheduled_operator_family_index", "0");
        push_line(
            &mut text,
            "scheduled_operator_family_kind",
            "sign-aware-parent-pool-merge",
        );
        push_line(
            &mut text,
            "scheduled_operator_family_command",
            "sign-merge-candidate",
        );
        push_line(
            &mut text,
            "scheduled_operator_family_selection_rule",
            "seed-weighted-delta-sign-consensus",
        );
        push_line(
            &mut text,
            "scheduled_operator_family_output_gate",
            "multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval",
        );
        push_line(&mut text, "candidate_id", candidate_id);
        push_line(
            &mut text,
            "candidate_manifest_checksum",
            "0x0000000000000007",
        );
        push_line(
            &mut text,
            "promotion_manifest_checksum",
            "0x0000000000000008",
        );
        push_line(
            &mut text,
            "provenance_manifest_checksum",
            "0x0000000000000009",
        );
        push_line(
            &mut text,
            "runtime_smoke_manifest_checksum",
            "0x000000000000000a",
        );
        push_line(&mut text, "eval_manifest_checksum", "0x000000000000000b");
        push_line(
            &mut text,
            "eval_case_evidence_checksum",
            "0x0000000000000015",
        );
        push_line(&mut text, "candidate_artifact_path", candidate_path);
        push_line(&mut text, "candidate_artifact_bytes", "1024");
        push_line(&mut text, "candidate_slm_version", "1");
        push_line(&mut text, "candidate_slm_checksum", "0x000000000000000c");
        push_line(
            &mut text,
            "candidate_model_shape",
            "vocab=260,hidden=16,layers=1,heads=2,kv_heads=2,ctx=16,ffn=32",
        );
        push_line(&mut text, "candidate_tensor_count", "12");
        push_line(&mut text, "candidate_parameter_count", "4096");
        push_line(&mut text, "candidate_quantization", "q8_0");
        push_line(
            &mut text,
            "candidate_output_contract",
            "separate-output-weight",
        );
        push_line(
            &mut text,
            "candidate_tokenizer_checksum",
            "0x000000000000000d",
        );
        push_line(
            &mut text,
            "candidate_tensor_layout_checksum",
            "0x000000000000000e",
        );
        push_line(
            &mut text,
            "candidate_parent_contract",
            "matches-parent-direct-parameter-contract",
        );
        push_line(&mut text, "candidate_admission_status", "slm-validated");
        push_line(&mut text, "runtime_smoke_status", "pass");
        push_line(&mut text, "eval_status", "pass");
        push_line(&mut text, "quality_gate", "assistant-quality");
        push_line(&mut text, "quality_scope", "tiny-fixture-runtime-eval-only");
        push_line(
            &mut text,
            "quality_boundary",
            "fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        );
        push_line(
            &mut text,
            "eval_dataset",
            "tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        );
        push_line(&mut text, "case_count", "1");
        push_line(&mut text, "cases_passed", "1");
        push_line(&mut text, "cases_failed", "0");
        push_line(
            &mut text,
            "promotion_decision",
            "accepted-for-browser-selector",
        );
        push_line(&mut text, "browser_selector_status", "admitted");
        push_line(&mut text, "public_claim_status", "bound-to-eval-scope");
        push_line(
            &mut text,
            "required_next_gate",
            "multi-parent-selector-registry-route-binding",
        );
        text
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

    fn tiny_fixture_f32_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_F32),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }

    fn tiny_fixture_q4_bytes() -> Vec<u8> {
        build_model_file(
            &ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q4_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
