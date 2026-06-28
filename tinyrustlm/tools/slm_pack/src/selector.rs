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
const MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET: u64 = 64 * 1024;
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
    "module_plan_model_byte_budget",
    "module_plan_adapter_byte_budget",
    "module_plan_runtime_scratch_byte_budget",
    "module_plan_module_count",
];

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
    eval_case_evidence_checksum: String,
    quality_scope: String,
    quality_boundary: String,
    eval_dataset: String,
    cases_passed: String,
    adapters: Vec<RegistryAdapterRoute>,
    adapter_family: Option<RegistryAdapterFamilyRoute>,
    assembly: Option<RegistryAssemblyRoute>,
    module_plan: Option<RegistryModulePlanRoute>,
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
    pub(crate) model_byte_budget: u64,
    pub(crate) adapter_byte_budget: u64,
    pub(crate) runtime_scratch_byte_budget: u64,
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
                &format!("{prefix}.module_plan_runtime_scratch_byte_budget"),
                &module_plan.runtime_scratch_byte_budget.to_string(),
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
            model_bytes: model_bytes.to_string(),
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
            eval_case_evidence_checksum: require_key(&fields, "eval_case_evidence_checksum")?
                .to_string(),
            quality_scope: require_key(&fields, "quality_scope")?.to_string(),
            quality_boundary: require_key(&fields, "quality_boundary")?.to_string(),
            eval_dataset: require_key(&fields, "eval_dataset")?.to_string(),
            cases_passed: require_key(&fields, "cases_passed")?.to_string(),
            adapters: Vec::new(),
            adapter_family: None,
            assembly: None,
            module_plan: None,
        });
    }
    Ok(entries)
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
            runtime_scratch_byte_budget: parse_module_plan_byte_budget(
                fields,
                &format!("{prefix}.module_plan_runtime_scratch_byte_budget"),
                "runtime scratch",
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
    if route.runtime_scratch_byte_budget != MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET {
        return Err(invalid(
            "selector registry module plan runtime scratch byte budget is invalid",
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
    fn writes_and_validates_selector_registry_from_multi_parent_admission_record() {
        let admission =
            fixture_multi_parent_admission("tiny-sign-merge", "tinyrustlm/models/sign-merge.slm");
        let registry = build_registry_text(&[admission.clone()]).unwrap();

        validate_registry_text(&registry, &[admission]).unwrap();
        assert!(registry.contains("entry.0.candidate_id=tiny-sign-merge"));
        assert!(registry.contains("entry.0.model_path=../models/sign-merge.slm"));
        assert!(registry.contains("entry.0.selector_status=admitted"));
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
        assert!(registry.contains(&format!(
            "entry.0.module_plan_model_byte_budget={}",
            tiny_fixture_f32_bytes().len()
        )));
        assert!(registry.contains("entry.0.module_plan_adapter_byte_budget=1048576"));
        assert!(registry.contains("entry.0.module_plan_runtime_scratch_byte_budget=65536"));
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

    fn fixture_f32_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_f32_bytes())
    }

    fn fixture_q4_admission(candidate_id: &str, candidate_path: &str) -> String {
        fixture_admission_for_bytes(candidate_id, candidate_path, tiny_fixture_q4_bytes())
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
            model_byte_budget: tiny_fixture_f32_bytes().len() as u64,
            adapter_byte_budget: ADAPTER_AUTO_APPLY_BYTE_BUDGET,
            runtime_scratch_byte_budget: MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET,
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
