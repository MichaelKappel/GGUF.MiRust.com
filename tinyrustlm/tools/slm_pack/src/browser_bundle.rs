//! Browser-served model-breeding smoke bundles.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use tinyrustlm_runtime::eval_runner;

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
use crate::soup;
use crate::tensor_writer::{
    tiny_fixture_tensors_with_dtype, ModelShape, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::tokenizer_writer::ByteTokenizerSection;
use crate::trained_adapter_source;
use crate::trained_source;

const ASSEMBLY_RECEIPT_KIND: &str = "browser-local-assembly-evidence";
const ASSEMBLY_RECEIPT_STATUS: &str = "validated";
const ASSEMBLY_REGISTRY_STATUS: &str = "receipt-validated";
const MODULE_PLAN_KIND: &str = "browser-local-module-plan";
const MODULE_PLAN_STATUS: &str = "validated";
const MODULE_PLAN_REGISTRY_STATUS: &str = "receipt-validated";
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
const MODULE_PLAN_SAMPLER_CANDIDATE_CAP: u64 = 1024;
const MODULE_PLAN_PROMPT_BYTE_LIMIT: u64 = 4 * 1024;
const MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET: u64 = 64 * 1024;
const MODULE_PLAN_OUTPUT_BYTE_LIMIT: u64 = 64 * 1024;
const MODULE_PLAN_KV_CACHE_BYTE_BUDGET_LIMIT: u64 = 8 * 1024 * 1024;
const MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT: u64 = 32 * 1024 * 1024
    + 1024 * 1024
    + MODULE_PLAN_KV_CACHE_BYTE_BUDGET_LIMIT
    + 64 * 1024
    + 128 * 1024
    + 128 * 1024
    + MODULE_PLAN_PROMPT_BYTE_LIMIT
    + MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET
    + MODULE_PLAN_OUTPUT_BYTE_LIMIT;
const SOURCE_KIND: &str = "converted-trained";
const SOURCE_MANIFEST_KIND: &str = "trained-source-manifest";
const SOURCE_MANIFEST_STATUS: &str = "reviewed-source-snapshot";
const SOURCE_VALIDATION_VERSION: &str = "1";
const SOURCE_VALIDATION_GATE: &str = "validate-source";
const SOURCE_VALIDATION_STATUS: &str = "pass";
const SOURCE_VALIDATION_DECISION: &str = "accepted-for-conversion";
const SOURCE_VALIDATION_NEXT_GATE: &str = "convert-raw-f32-source-to-slm";
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
    SourceLowRankAlr1,
}

#[derive(Clone, Copy)]
enum BundleOperator {
    SignMerge,
    Soup,
}

impl BundleOperator {
    // Parses the optional bundle operator flag while keeping the old sign-merge default explicit.
    fn from_name(name: &str) -> io::Result<Self> {
        match name {
            "sign-merge" => Ok(Self::SignMerge),
            "soup" => Ok(Self::Soup),
            _ => Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "browser-multi-parent-bundle operator must be sign-merge, soup, or mixed",
            )),
        }
    }

    // Supplies the generated model id stem used by selector registries and browser smoke keys.
    fn id_prefix(self) -> &'static str {
        match self {
            Self::SignMerge => "multi-parent-sign-merge",
            Self::Soup => "multi-parent-soup",
        }
    }

    // Supplies the human-readable label stem for generated browser selector entries.
    fn label_prefix(self) -> &'static str {
        match self {
            Self::SignMerge => "Multi-parent sign-merge",
            Self::Soup => "Multi-parent weighted soup",
        }
    }

    // Supplies the evidence filename prefix so receipts can route sign-merge and soup separately.
    fn evidence_prefix(self) -> &'static str {
        match self {
            Self::SignMerge => "sign-merge",
            Self::Soup => "soup",
        }
    }

    // Records the assembly strategy string that the browser validates against receipt evidence.
    fn assembly_strategy(self) -> &'static str {
        match self {
            Self::SignMerge => "multi-parent-sign-merge",
            Self::Soup => "multi-parent-weighted-soup",
        }
    }

    // Builds the operator-scoped evidence filename for receipts that share the same suffixes.
    fn evidence_file(self, suffix: &str) -> String {
        format!("{}.{}", self.evidence_prefix(), suffix)
    }

    // Lists the evidence files whose relative routes participate in module-plan route checksums.
    fn evidence_files(self) -> Vec<String> {
        vec![
            "population.ledger".to_string(),
            "population.review".to_string(),
            "parent-pool.recipe".to_string(),
            self.evidence_file("operator"),
            self.evidence_file("candidate"),
            self.evidence_file("promotion"),
            self.evidence_file("runtime"),
            self.evidence_file("eval"),
            self.evidence_file("multi.admission"),
        ]
    }

    // Dispatches bundle candidate generation to the selected parent-pool operator implementation.
    fn write_candidate_path(
        self,
        ledger_path: &Path,
        review_path: &Path,
        recipe_path: &Path,
        candidate_path: &Path,
        receipt_path: &Path,
        parent_paths: &[String],
        admission_paths: &[String],
    ) -> io::Result<()> {
        match self {
            Self::SignMerge => sign_merge::write_candidate_path(
                ledger_path,
                review_path,
                recipe_path,
                candidate_path,
                receipt_path,
                parent_paths,
                admission_paths,
            ),
            Self::Soup => soup::write_candidate_path(
                ledger_path,
                review_path,
                recipe_path,
                candidate_path,
                receipt_path,
                parent_paths,
                admission_paths,
            ),
        }
    }
}

struct BundleSpec {
    id: String,
    operator: BundleOperator,
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
    // Derives all generated filenames and labels from the quantization lane and operator family.
    fn from_quantization(quantization: &str, operator: BundleOperator) -> io::Result<Self> {
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
        let id = format!("{}-{suffix}", operator.id_prefix());
        let label_prefix = operator.label_prefix();
        Ok(Self {
            model_file: format!("{id}.slm"),
            self_adapter_file: format!("{id}-self.adp1"),
            self_adapter_label: format!("{label_prefix} {quantization} self ADP1"),
            family_adapter_file: format!("{id}-family.adp1"),
            family_adapter_label: format!("{label_prefix} {quantization} family ADP1"),
            sparse_adapter_file: format!("{id}-sparse.asp1"),
            sparse_adapter_label: format!("{label_prefix} {quantization} sparse ASP1"),
            low_rank_adapter_file: format!("{id}-low-rank.alr1"),
            low_rank_adapter_label: format!("{label_prefix} {quantization} source-backed ALR1"),
            adapter_family_receipt_file: format!("{id}.adapter-family.receipt"),
            adapter_family_label: format!("{label_prefix} {quantization} adapter family"),
            assembly_receipt_file: format!("{id}.assembly.receipt"),
            assembly_label: format!("{label_prefix} {quantization} assembly evidence"),
            module_plan_receipt_file: format!("{id}.module-plan.receipt"),
            module_plan_label: format!("{label_prefix} {quantization} module plan"),
            id,
            operator,
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
#[cfg(test)]
pub(crate) fn write_bundle_path_with_quantization(
    root: &Path,
    quantization: &str,
) -> io::Result<()> {
    write_bundle_path_with_quantization_and_operator(root, quantization, "sign-merge")
}

/// Writes a browser-loadable multi-parent selector bundle for the selected parent-pool operator.
pub(crate) fn write_bundle_path_with_quantization_and_operator(
    root: &Path,
    quantization: &str,
    operator: &str,
) -> io::Result<()> {
    let operators = bundle_operators(operator)?;
    let quantizations = bundle_quantizations(quantization)?;
    let models = root.join("models");
    fs::create_dir_all(&models)?;
    copy_browser_surface(root)?;

    let mut modules = Vec::with_capacity(quantizations.len() * operators.len());
    for operator in operators {
        for quantization in &quantizations {
            let spec = BundleSpec::from_quantization(quantization, operator)?;
            modules.push(write_bundle_module(root, &models, &spec)?);
        }
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

/// Writes a browser-loadable converted-trained selector bundle from a reviewed source directory.
pub(crate) fn write_converted_trained_bundle_path(
    root: &Path,
    source_dir: &Path,
    quantization: &str,
) -> io::Result<()> {
    let eval_cases_path = default_converted_trained_eval_cases_path();
    write_converted_trained_bundle_path_with_eval_cases(
        root,
        source_dir,
        quantization,
        &eval_cases_path,
    )
}

pub(crate) fn write_converted_trained_bundle_path_with_eval_cases(
    root: &Path,
    source_dir: &Path,
    quantization: &str,
    eval_cases_path: &Path,
) -> io::Result<()> {
    write_converted_trained_bundle_path_with_eval_cases_and_source_review(
        root,
        source_dir,
        quantization,
        eval_cases_path,
        None,
    )
}

pub(crate) fn write_converted_trained_bundle_path_with_eval_cases_and_source_review(
    root: &Path,
    source_dir: &Path,
    quantization: &str,
    eval_cases_path: &Path,
    source_review_path: Option<&Path>,
) -> io::Result<()> {
    let quantizations = converted_trained_quantizations(quantization)?;
    let models = root.join("models");
    let evidence_root = root.join("evidence");
    fs::create_dir_all(&models)?;
    fs::create_dir_all(&evidence_root)?;
    copy_browser_surface(root)?;

    let mut admission_paths = Vec::with_capacity(quantizations.len());
    let mut candidate_paths = Vec::with_capacity(quantizations.len());
    for entry_quantization in quantizations {
        let (admission_path, candidate_path) = write_converted_trained_bundle_entry(
            &models,
            &evidence_root,
            source_dir,
            entry_quantization,
            eval_cases_path,
            source_review_path,
        )?;
        admission_paths.push(admission_path);
        candidate_paths.push(candidate_path);
    }

    let registry_path = models.join("selector.registry");
    selector::write_registry_path(&registry_path, &admission_paths)?;
    selector::validate_registry_path(&registry_path, &admission_paths)?;

    println!(
        "SLM browser converted-trained bundle root: {}",
        root.display()
    );
    println!(
        "SLM browser converted-trained registry: {}",
        registry_path.display()
    );
    for candidate_path in candidate_paths {
        println!(
            "SLM browser converted-trained model: {}",
            candidate_path.display()
        );
    }
    Ok(())
}

fn write_converted_trained_bundle_entry(
    models: &Path,
    evidence_root: &Path,
    source_dir: &Path,
    quantization: &str,
    eval_cases_path: &Path,
    source_review_path: Option<&Path>,
) -> io::Result<(String, PathBuf)> {
    // Stages one converted source artifact and the evidence chain consumed by selector.registry.
    let candidate_id = converted_trained_candidate_id(quantization)?;
    let evidence = evidence_root.join(candidate_id);
    fs::create_dir_all(&evidence)?;
    let model_file = format!("{candidate_id}.slm");
    let candidate_path = models.join(&model_file);
    let provenance_path = models.join(format!("{model_file}.manifest"));
    let compatibility_path = evidence.join("converted-trained.compat");
    let lineage_path = evidence.join("converted-trained.lineage");
    let candidate_manifest_path = evidence.join("converted-trained.candidate");
    let promotion_path = evidence.join("converted-trained.promotion");
    let runtime_path = evidence.join("converted-trained.runtime");
    let eval_path = evidence.join("converted-trained.eval");
    let admission_path = evidence.join("converted-trained.admission");

    trained_source::convert_trained_path(source_dir, &candidate_path, quantization)?;
    let mut source_manifest =
        write_converted_trained_source_manifest_snapshot(source_dir, &evidence)?;
    write_converted_trained_source_review_snapshot(
        &evidence,
        candidate_id,
        source_review_path,
        &mut source_manifest,
    )?;
    let source_validation = write_converted_trained_source_validation_snapshot(
        &evidence,
        candidate_id,
        &source_manifest,
    )?;
    provenance::validate_manifest_path(&candidate_path, &provenance_path)?;
    compatibility::report_path(&candidate_path, &candidate_path, Some(&compatibility_path))?;
    lineage::write_template_path(
        &compatibility_path,
        &lineage_path,
        candidate_id,
        "trained-source-conversion",
        "browser-file-backed-converted-trained",
    )?;
    candidate::write_manifest_path(
        &compatibility_path,
        &lineage_path,
        &candidate_path,
        &candidate_manifest_path,
        None,
    )?;
    promotion::write_template_path(
        &compatibility_path,
        &lineage_path,
        &candidate_path,
        &candidate_manifest_path,
        &promotion_path,
        "local-smoke-runner",
        promotion::DEFAULT_PROMOTION_SCOPE,
        None,
    )?;
    provenance::write_runtime_smoke_for_path(&candidate_path, &provenance_path, &runtime_path)?;
    let eval_outcome = eval_runner::run_eval_to_sidecar(
        &candidate_path,
        &provenance_path,
        eval_cases_path,
        &eval_path,
    )?;
    append_reviewed_eval_cases_route(&eval_path, source_review_path)?;
    if !eval_outcome.passed {
        return Err(invalid(&format!(
            "converted-trained browser bundle eval failed: {} passed, {} failed",
            eval_outcome.cases_passed, eval_outcome.cases_failed
        )));
    }
    provenance::quality_gate_path(
        &candidate_path,
        &provenance_path,
        "assistant-quality",
        Some(&eval_path),
    )?;
    admission::write_record_path(
        &compatibility_path,
        &lineage_path,
        &candidate_path,
        &candidate_manifest_path,
        &promotion_path,
        &provenance_path,
        &runtime_path,
        &eval_path,
        &admission_path,
        admission::DEFAULT_ADMISSION_SELECTOR_ID,
        None,
    )?;
    append_converted_trained_admission_route(&admission_path, candidate_id)?;
    append_converted_trained_source_manifest_route(
        &admission_path,
        candidate_id,
        &source_manifest,
    )?;
    append_converted_trained_source_validation_route(
        &admission_path,
        candidate_id,
        &source_validation,
    )?;
    append_converted_trained_runtime_smoke_route(&admission_path, candidate_id)?;
    append_converted_trained_eval_route(&admission_path, candidate_id)?;

    Ok((display_path(&admission_path), candidate_path))
}

fn default_converted_trained_eval_cases_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/assistant-quality-eval-cases.txt")
}

struct ConvertedTrainedSourceManifestSnapshot {
    checksum: String,
    source_kind: String,
    source_id: String,
    model_shape: String,
    source_dtype: String,
    tied_output: String,
    tensor_count: String,
    source_review: Option<ConvertedTrainedSourceReviewSnapshot>,
}

struct ConvertedTrainedSourceReviewSnapshot {
    kind: String,
    path: Option<String>,
    status: String,
    checksum: String,
    required_next_gate: String,
}

struct ConvertedTrainedSourceValidationSnapshot {
    checksum: String,
}

fn append_converted_trained_admission_route(
    admission_path: &Path,
    candidate_id: &str,
) -> io::Result<()> {
    // Carries the selector admission sidecar as a browser-verifiable route on the record itself.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "admission_path",
        &converted_trained_admission_registry_path(candidate_id),
    );
    fs::write(admission_path, admission)
}

fn write_converted_trained_source_manifest_snapshot(
    source_dir: &Path,
    evidence_dir: &Path,
) -> io::Result<ConvertedTrainedSourceManifestSnapshot> {
    // Carries the reviewed trained-source manifest into the browser evidence folder for audits.
    let target = evidence_dir.join("converted-trained.source.manifest");
    fs::copy(source_dir.join("source.manifest"), &target)?;
    let text = fs::read_to_string(target)?;
    let fields = provenance::parse_manifest(&text)?;
    Ok(ConvertedTrainedSourceManifestSnapshot {
        checksum: hex64(provenance::text_checksum(text.as_bytes())),
        source_kind: manifest_field(&fields, "source_kind")?.to_string(),
        source_id: manifest_field(&fields, "source_id")?.to_string(),
        model_shape: manifest_field(&fields, "model_shape")?.to_string(),
        source_dtype: manifest_field(&fields, "source_dtype")?.to_string(),
        tied_output: manifest_field(&fields, "tied_output")?.to_string(),
        tensor_count: manifest_field(&fields, "tensor_count")?.to_string(),
        source_review: converted_trained_source_review_snapshot(&fields)?,
    })
}

fn write_converted_trained_source_validation_snapshot(
    evidence_dir: &Path,
    candidate_id: &str,
    source_manifest: &ConvertedTrainedSourceManifestSnapshot,
) -> io::Result<ConvertedTrainedSourceValidationSnapshot> {
    // Records the validate-source gate as browser-routed evidence before conversion is admitted.
    let target = evidence_dir.join("converted-trained.source.validation");
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_source_validation_version",
        SOURCE_VALIDATION_VERSION,
    );
    push_line(&mut text, "source_validation_gate", SOURCE_VALIDATION_GATE);
    push_line(
        &mut text,
        "source_validation_status",
        SOURCE_VALIDATION_STATUS,
    );
    push_line(
        &mut text,
        "source_validation_decision",
        SOURCE_VALIDATION_DECISION,
    );
    push_line(
        &mut text,
        "source_manifest_path",
        &converted_trained_source_manifest_registry_path(candidate_id),
    );
    push_line(
        &mut text,
        "source_manifest_checksum",
        &source_manifest.checksum,
    );
    push_line(&mut text, "source_kind", &source_manifest.source_kind);
    push_line(&mut text, "source_id", &source_manifest.source_id);
    push_line(&mut text, "model_shape", &source_manifest.model_shape);
    push_line(&mut text, "source_dtype", &source_manifest.source_dtype);
    push_line(&mut text, "tied_output", &source_manifest.tied_output);
    push_line(&mut text, "tensor_count", &source_manifest.tensor_count);
    if let Some(source_review) = &source_manifest.source_review {
        push_line(&mut text, "source_review_checksum", &source_review.checksum);
    }
    push_line(&mut text, "required_next_gate", SOURCE_VALIDATION_NEXT_GATE);
    fs::write(&target, &text)?;
    Ok(ConvertedTrainedSourceValidationSnapshot {
        checksum: hex64(provenance::text_checksum(text.as_bytes())),
    })
}

fn append_converted_trained_source_manifest_route(
    admission_path: &Path,
    candidate_id: &str,
    source_manifest: &ConvertedTrainedSourceManifestSnapshot,
) -> io::Result<()> {
    // Extends the reviewed admission with the browser-verifiable source evidence route.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "source_manifest_path",
        &converted_trained_source_manifest_registry_path(candidate_id),
    );
    push_line(
        &mut admission,
        "source_manifest_checksum",
        &source_manifest.checksum,
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
        &source_manifest.source_kind,
    );
    push_line(
        &mut admission,
        "source_manifest_source_id",
        &source_manifest.source_id,
    );
    push_line(
        &mut admission,
        "source_manifest_model_shape",
        &source_manifest.model_shape,
    );
    if let Some(source_review) = &source_manifest.source_review {
        push_line(&mut admission, "source_review_kind", &source_review.kind);
        if let Some(path) = &source_review.path {
            push_line(&mut admission, "source_review_path", path);
        }
        push_line(
            &mut admission,
            "source_review_status",
            &source_review.status,
        );
        push_line(
            &mut admission,
            "source_review_checksum",
            &source_review.checksum,
        );
        push_line(
            &mut admission,
            "source_review_required_next_gate",
            &source_review.required_next_gate,
        );
    }
    fs::write(admission_path, admission)
}

fn append_converted_trained_source_validation_route(
    admission_path: &Path,
    candidate_id: &str,
    source_validation: &ConvertedTrainedSourceValidationSnapshot,
) -> io::Result<()> {
    // Extends the reviewed admission with the browser-verifiable source validation sidecar.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "source_validation_path",
        &converted_trained_source_validation_registry_path(candidate_id),
    );
    push_line(
        &mut admission,
        "source_validation_checksum",
        &source_validation.checksum,
    );
    fs::write(admission_path, admission)
}

fn converted_trained_source_review_snapshot(
    fields: &std::collections::HashMap<String, String>,
) -> io::Result<Option<ConvertedTrainedSourceReviewSnapshot>> {
    // Carries safetensors review evidence forward only when the copied source manifest has it.
    let keys = [
        "source_review_kind",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(None);
    }
    let kind = manifest_field(fields, "source_review_kind")?.to_string();
    let status = manifest_field(fields, "source_review_status")?.to_string();
    let checksum = manifest_field(fields, "source_review_checksum")?.to_string();
    let required_next_gate =
        manifest_field(fields, "source_review_required_next_gate")?.to_string();
    if kind != trained_source::SOURCE_REVIEW_KIND {
        return Err(invalid("converted-trained source review kind is invalid"));
    }
    if status != trained_source::SOURCE_REVIEW_STATUS {
        return Err(invalid("converted-trained source review status is invalid"));
    }
    validate_hex64_text(&checksum, "source_review_checksum")?;
    if required_next_gate != trained_source::SOURCE_REVIEW_REQUIRED_NEXT_GATE {
        return Err(invalid(
            "converted-trained source review required_next_gate is invalid",
        ));
    }
    Ok(Some(ConvertedTrainedSourceReviewSnapshot {
        kind,
        path: None,
        status,
        checksum,
        required_next_gate,
    }))
}

fn write_converted_trained_source_review_snapshot(
    evidence_dir: &Path,
    candidate_id: &str,
    source_review_path: Option<&Path>,
    source_manifest: &mut ConvertedTrainedSourceManifestSnapshot,
) -> io::Result<()> {
    // Copies a supplied safetensors review report into the served evidence route.
    let Some(source_review) = &mut source_manifest.source_review else {
        return Ok(());
    };
    let Some(source_review_path) = source_review_path else {
        return Ok(());
    };
    let target = evidence_dir.join("converted-trained.source.review");
    fs::copy(source_review_path, &target)?;
    let text = fs::read_to_string(&target)?;
    let checksum = hex64(provenance::text_checksum(text.as_bytes()));
    if checksum != source_review.checksum {
        return Err(invalid(
            "converted-trained source review sidecar checksum did not match source manifest",
        ));
    }
    source_review.path = Some(converted_trained_source_review_registry_path(candidate_id));
    Ok(())
}

fn append_converted_trained_eval_route(
    admission_path: &Path,
    candidate_id: &str,
) -> io::Result<()> {
    // Extends the reviewed admission with the browser-verifiable eval sidecar route.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "eval_path",
        &format!("../evidence/{candidate_id}/converted-trained.eval"),
    );
    fs::write(admission_path, admission)
}

fn append_converted_trained_runtime_smoke_route(
    admission_path: &Path,
    candidate_id: &str,
) -> io::Result<()> {
    // Extends the admission with the browser-verifiable runtime-smoke sidecar route.
    let mut admission = fs::read_to_string(admission_path)?;
    if !admission.ends_with('\n') {
        admission.push('\n');
    }
    push_line(
        &mut admission,
        "runtime_smoke_path",
        &format!("../evidence/{candidate_id}/converted-trained.runtime"),
    );
    fs::write(admission_path, admission)
}

fn converted_trained_source_manifest_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the copied source manifest evidence.
    format!("../evidence/{candidate_id}/converted-trained.source.manifest")
}

fn converted_trained_source_review_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the copied candidate-review evidence.
    format!("../evidence/{candidate_id}/converted-trained.source.review")
}

fn converted_trained_source_validation_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the source-validation evidence.
    format!("../evidence/{candidate_id}/converted-trained.source.validation")
}

fn converted_trained_admission_registry_path(candidate_id: &str) -> String {
    // Matches the browser route from app/ to the selector admission evidence.
    format!("../evidence/{candidate_id}/converted-trained.admission")
}

fn append_reviewed_eval_cases_route(
    eval_path: &Path,
    source_review_path: Option<&Path>,
) -> io::Result<()> {
    // Binds the browser-fetched eval sidecar back to the reviewed eval case route.
    let Some(source_review_path) = source_review_path else {
        return Ok(());
    };
    let review_text = fs::read_to_string(source_review_path)?;
    let review_fields = provenance::parse_manifest(&review_text)?;
    let eval_cases_route = manifest_field(&review_fields, "eval_cases_route")?;
    if eval_cases_route == "pending-eval-cases" {
        return Err(invalid(
            "converted-trained source review eval_cases_route is pending",
        ));
    }
    let mut eval_text = fs::read_to_string(eval_path)?;
    let eval_fields = provenance::parse_manifest(&eval_text)?;
    if let Some(existing) = eval_fields.get("eval_cases_route") {
        if existing != eval_cases_route {
            return Err(invalid(
                "converted-trained eval sidecar eval_cases_route does not match source review",
            ));
        }
        return Ok(());
    }
    if !eval_text.ends_with('\n') {
        eval_text.push('\n');
    }
    push_line(&mut eval_text, "eval_cases_route", eval_cases_route);
    fs::write(eval_path, eval_text)
}

fn converted_trained_quantizations(quantization: &str) -> io::Result<Vec<&'static str>> {
    // Expands the converted-trained CLI selector into one or all browser model entries.
    match quantization {
        "f32" => Ok(vec!["f32"]),
        "q8_0" => Ok(vec!["q8_0"]),
        "q4_0" => Ok(vec!["q4_0"]),
        "all" => Ok(vec!["f32", "q8_0", "q4_0"]),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "browser-converted-trained-bundle quantization must be f32, q8_0, q4_0, or all",
        )),
    }
}

pub(crate) fn validate_converted_trained_bundle_quantization(quantization: &str) -> io::Result<()> {
    // Lets source-intake bridges reject unsupported browser bundle selectors before writing files.
    converted_trained_quantizations(quantization).map(|_| ())
}

fn converted_trained_candidate_id(quantization: &str) -> io::Result<&'static str> {
    // Keeps generated browser model ids aligned with the quantization lane they stage.
    match quantization {
        "f32" => Ok("converted-trained-f32"),
        "q8_0" => Ok("converted-trained-q8"),
        "q4_0" => Ok("converted-trained-q4"),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "converted-trained candidate quantization must be f32, q8_0, or q4_0",
        )),
    }
}

fn bundle_operators(operator: &str) -> io::Result<Vec<BundleOperator>> {
    // Expands the CLI operator selector into one or more browser-visible families.
    if operator == "mixed" {
        return Ok(vec![BundleOperator::SignMerge, BundleOperator::Soup]);
    }
    Ok(vec![BundleOperator::from_name(operator)?])
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
    let receipt_path = evidence.join(spec.operator.evidence_file("operator"));
    let multi_candidate_path = evidence.join(spec.operator.evidence_file("candidate"));
    let promotion_path = evidence.join(spec.operator.evidence_file("promotion"));
    let provenance_path = models.join(format!("{}.manifest", spec.model_file));
    let runtime_path = evidence.join(spec.operator.evidence_file("runtime"));
    let eval_path = evidence.join(spec.operator.evidence_file("eval"));
    let multi_admission_path = evidence.join(spec.operator.evidence_file("multi.admission"));

    ledger::write_ledger_path(&ledger_path, &admission_paths)?;
    population::write_review_path(&ledger_path, &review_path, &admission_paths)?;
    parent_pool::write_recipe_path(&ledger_path, &review_path, &recipe_path, &admission_paths)?;
    spec.operator.write_candidate_path(
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
        &receipt_path,
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
    operator_receipt_path: &Path,
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
    let tokenizer_checksum = hex64(report.tokenizer_checksum());
    let model_byte_budget = u64::try_from(report.file_bytes())
        .map_err(|_| invalid("module plan model byte budget overflow"))?;
    let adapter_byte_budget = adapter_family_route.auto_apply_byte_budget;
    let context_token_limit = u64::from(report.context_token_limit());
    let kv_cache_byte_budget = report.kv_cache_byte_budget()?;
    let kv_cache_page_count = report.kv_cache_page_count()?;
    if kv_cache_byte_budget > MODULE_PLAN_KV_CACHE_BYTE_BUDGET_LIMIT {
        return Err(invalid("module plan kv cache byte budget exceeds limit"));
    }
    let manifest_byte_count = file_byte_count(provenance_manifest_path)?;
    let assembly_receipt_byte_count = file_byte_count(assembly_receipt_path)?;
    let adapter_family_receipt_byte_count = file_byte_count(adapter_family_receipt_path)?;
    let manifest_checksum = text_file_checksum(provenance_manifest_path)?;
    let operator_receipt_file = spec.operator.evidence_file("operator");
    let operator_receipt_route = evidence_route(spec, &operator_receipt_file);
    let operator_receipt_checksum = text_file_checksum(operator_receipt_path)?;
    let stack_indexes = bundle_auto_apply_stack_indexes(bundle_adapter_routes.len());
    let adapter_validation_count = u64::try_from(stack_indexes.len())
        .map_err(|_| invalid("module plan adapter validation count overflow"))?;
    let adapter_apply_count = adapter_validation_count;
    let adapter_manifest_fetch_count = u64::try_from(adapter_family_route.adapter_count)
        .map_err(|_| invalid("module plan planned fetch count overflow"))?;
    let module_count = 4usize
        .checked_add(stack_indexes.len())
        .ok_or_else(|| invalid("module plan count overflow"))?;
    if module_count != 4 + adapter_family_route.auto_apply_stack_count {
        return Err(invalid(
            "module plan adapter stack count must match adapter family route",
        ));
    }
    let stack_byte_counts = module_plan_stack_byte_counts(&stack_indexes, bundle_adapter_routes)?;
    let adapter_stack_byte_budget =
        stack_byte_counts
            .iter()
            .try_fold(0u64, |total, byte_count| {
                total
                    .checked_add(*byte_count)
                    .ok_or_else(|| invalid("module plan adapter stack byte budget overflow"))
            })?;
    let wasm_heap_min_bytes = module_plan_wasm_heap_min_bytes(
        model_byte_budget,
        adapter_stack_byte_budget,
        MODULE_PLAN_PROMPT_BYTE_LIMIT,
    );
    let total_byte_budget = module_plan_total_byte_budget(
        model_byte_budget,
        kv_cache_byte_budget,
        manifest_byte_count,
        assembly_receipt_byte_count,
        adapter_family_receipt_byte_count,
        &stack_byte_counts,
    )?;
    let planned_fetch_count =
        module_plan_planned_fetch_count(module_count, adapter_manifest_fetch_count)?;
    let route_set_checksum = module_plan_route_set_checksum(
        spec,
        &route,
        &model_path,
        &manifest_path,
        &assembly_route.receipt_path,
        &adapter_family_route.receipt_path,
        bundle_adapter_routes,
        &stack_indexes,
    )?;

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
    push_line(&mut text, "module_plan_profile", MODULE_PLAN_PROFILE);
    push_line(
        &mut text,
        "module_plan_execution_profile",
        MODULE_PLAN_EXECUTION_PROFILE,
    );
    push_line(
        &mut text,
        "module_plan_fetch_policy",
        MODULE_PLAN_FETCH_POLICY,
    );
    push_line(
        &mut text,
        "module_plan_origin_policy",
        MODULE_PLAN_ORIGIN_POLICY,
    );
    push_line(
        &mut text,
        "module_plan_fetch_count_limit",
        &MODULE_PLAN_FETCH_COUNT_LIMIT.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_planned_fetch_count",
        &planned_fetch_count.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_route_set_version",
        MODULE_PLAN_ROUTE_SET_VERSION,
    );
    push_line(
        &mut text,
        "module_plan_route_set_checksum_algorithm",
        MODULE_PLAN_ROUTE_SET_CHECKSUM_ALGORITHM,
    );
    push_line(
        &mut text,
        "module_plan_route_set_checksum",
        &route_set_checksum,
    );
    push_line(&mut text, "operator_receipt_path", &operator_receipt_route);
    push_line(
        &mut text,
        "operator_receipt_checksum",
        &operator_receipt_checksum,
    );
    // The page count mirrors the runtime's exported linear-memory size before init.
    push_line(
        &mut text,
        "module_plan_wasm_memory_initial_pages",
        &MODULE_PLAN_WASM_MEMORY_INITIAL_PAGES.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_wasm_export_set",
        MODULE_PLAN_WASM_EXPORT_SET,
    );
    push_line(
        &mut text,
        "module_plan_wasm_transfer_strategy",
        MODULE_PLAN_WASM_TRANSFER_STRATEGY,
    );
    push_line(
        &mut text,
        "module_plan_model_release_strategy",
        MODULE_PLAN_MODEL_RELEASE_STRATEGY,
    );
    push_line(
        &mut text,
        "module_plan_runtime_reset_strategy",
        MODULE_PLAN_RUNTIME_RESET_STRATEGY,
    );
    push_line(
        &mut text,
        "module_plan_adapter_validation_strategy",
        MODULE_PLAN_ADAPTER_VALIDATION_STRATEGY,
    );
    push_line(
        &mut text,
        "module_plan_adapter_validation_count",
        &adapter_validation_count.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_adapter_apply_count",
        &adapter_apply_count.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_wasm_heap_min_bytes",
        &wasm_heap_min_bytes.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_context_token_limit",
        &context_token_limit.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_sampler_candidate_cap",
        &MODULE_PLAN_SAMPLER_CANDIDATE_CAP.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_tokenizer_checksum",
        &tokenizer_checksum,
    );
    push_line(
        &mut text,
        "module_plan_prompt_byte_limit",
        &MODULE_PLAN_PROMPT_BYTE_LIMIT.to_string(),
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
    push_line(
        &mut text,
        "module_plan_adapter_stack_byte_budget",
        &adapter_stack_byte_budget.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_runtime_scratch_byte_budget",
        &MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_output_byte_limit",
        &MODULE_PLAN_OUTPUT_BYTE_LIMIT.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_kv_cache_byte_budget",
        &kv_cache_byte_budget.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_kv_cache_page_count",
        &kv_cache_page_count.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_total_byte_budget",
        &total_byte_budget.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_total_byte_budget_limit",
        &MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT.to_string(),
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
        let artifact_byte_count = stack_byte_counts[stack_position];
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
        profile: MODULE_PLAN_PROFILE.to_string(),
        execution_profile: MODULE_PLAN_EXECUTION_PROFILE.to_string(),
        fetch_policy: MODULE_PLAN_FETCH_POLICY.to_string(),
        origin_policy: MODULE_PLAN_ORIGIN_POLICY.to_string(),
        fetch_count_limit: MODULE_PLAN_FETCH_COUNT_LIMIT,
        planned_fetch_count,
        route_set_version: MODULE_PLAN_ROUTE_SET_VERSION.to_string(),
        route_set_checksum_algorithm: MODULE_PLAN_ROUTE_SET_CHECKSUM_ALGORITHM.to_string(),
        route_set_checksum,
        operator_receipt_path: operator_receipt_route,
        operator_receipt_checksum,
        wasm_memory_initial_pages: MODULE_PLAN_WASM_MEMORY_INITIAL_PAGES,
        wasm_export_set: MODULE_PLAN_WASM_EXPORT_SET.to_string(),
        wasm_transfer_strategy: MODULE_PLAN_WASM_TRANSFER_STRATEGY.to_string(),
        model_release_strategy: MODULE_PLAN_MODEL_RELEASE_STRATEGY.to_string(),
        runtime_reset_strategy: MODULE_PLAN_RUNTIME_RESET_STRATEGY.to_string(),
        adapter_validation_strategy: MODULE_PLAN_ADAPTER_VALIDATION_STRATEGY.to_string(),
        adapter_validation_count,
        adapter_apply_count,
        wasm_heap_min_bytes,
        context_token_limit,
        sampler_candidate_cap: MODULE_PLAN_SAMPLER_CANDIDATE_CAP,
        tokenizer_checksum,
        prompt_byte_limit: MODULE_PLAN_PROMPT_BYTE_LIMIT,
        model_byte_budget,
        adapter_byte_budget,
        adapter_stack_byte_budget,
        runtime_scratch_byte_budget: MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET,
        output_byte_limit: MODULE_PLAN_OUTPUT_BYTE_LIMIT,
        kv_cache_byte_budget,
        kv_cache_page_count,
        total_byte_budget,
        total_byte_budget_limit: MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT,
        receipt_checksum: hex64(provenance::text_checksum(text.as_bytes())),
        module_count,
    })
}

// Computes the exact staged adapter artifact bytes used by module-plan totals.
fn module_plan_stack_byte_counts(
    stack_indexes: &[usize],
    bundle_adapter_routes: &[BundleAdapterRoute],
) -> io::Result<Vec<u64>> {
    let mut byte_counts = Vec::with_capacity(stack_indexes.len());
    for adapter_index in stack_indexes {
        byte_counts.push(file_byte_count(
            &bundle_adapter_routes[*adapter_index].artifact_path,
        )?);
    }
    Ok(byte_counts)
}

fn module_plan_wasm_heap_min_bytes(
    model_byte_budget: u64,
    adapter_stack_byte_budget: u64,
    prompt_byte_limit: u64,
) -> u64 {
    // Mirrors the browser allocation probe floor before generated bytes enter WASM.
    MODULE_PLAN_WASM_HEAP_MIN_BYTES
        .max(model_byte_budget)
        .max(adapter_stack_byte_budget)
        .max(prompt_byte_limit)
}

fn module_plan_planned_fetch_count(
    module_count: usize,
    adapter_manifest_fetch_count: u64,
) -> io::Result<u64> {
    // Counts generated self-assembly fetches across the receipt, modules,
    // evidence files, and adapter manifests.
    let module_count = u64::try_from(module_count)
        .map_err(|_| invalid("module plan planned fetch count overflow"))?;
    module_count
        .checked_add(1)
        .and_then(|value| value.checked_add(MODULE_PLAN_ASSEMBLY_EVIDENCE_FILE_COUNT))
        .and_then(|value| value.checked_add(adapter_manifest_fetch_count))
        .ok_or_else(|| invalid("module plan planned fetch count overflow"))
}

fn module_plan_route_set_checksum(
    spec: &BundleSpec,
    module_plan_path: &str,
    model_path: &str,
    manifest_path: &str,
    assembly_path: &str,
    adapter_family_path: &str,
    bundle_adapter_routes: &[BundleAdapterRoute],
    stack_indexes: &[usize],
) -> io::Result<String> {
    // Mirrors the browser's generated self-assembly fetch classes in route order.
    let evidence_files = spec.operator.evidence_files();
    let evidence_count = u64::try_from(evidence_files.len())
        .map_err(|_| invalid("module plan route set evidence count overflow"))?;
    if evidence_count != MODULE_PLAN_ASSEMBLY_EVIDENCE_FILE_COUNT {
        return Err(invalid("module plan route set evidence count mismatch"));
    }
    let mut routes = Vec::new();
    module_plan_push_route(&mut routes, "module-plan-receipt", module_plan_path);
    module_plan_push_route(&mut routes, "model", model_path);
    module_plan_push_route(&mut routes, "model-manifest", manifest_path);
    module_plan_push_route(&mut routes, "assembly-receipt", assembly_path);
    for file_name in evidence_files {
        module_plan_push_route(
            &mut routes,
            "assembly-evidence",
            &evidence_route(spec, &file_name),
        );
    }
    module_plan_push_route(&mut routes, "adapter-family-receipt", adapter_family_path);
    for bundle_route in bundle_adapter_routes {
        module_plan_push_route(
            &mut routes,
            "adapter-manifest",
            &bundle_route.route.manifest_path,
        );
    }
    for adapter_index in stack_indexes {
        let Some(bundle_route) = bundle_adapter_routes.get(*adapter_index) else {
            return Err(invalid("module plan route set adapter index is invalid"));
        };
        module_plan_push_route(
            &mut routes,
            "adapter-stack-artifact",
            &bundle_route.route.adapter_path,
        );
    }
    Ok(module_plan_checksum_for_routes(&routes))
}

fn module_plan_push_route(routes: &mut Vec<(String, String)>, kind: &str, path: &str) {
    // Stores route metadata as owned text so generated evidence paths remain stable.
    routes.push((kind.to_string(), path.to_string()));
}

fn module_plan_checksum_for_routes(routes: &[(String, String)]) -> String {
    // Hashes the canonical route-list text used by selector and browser validation.
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

// Builds the browser-local assembly envelope from exact staged modules plus runtime scratch.
fn module_plan_total_byte_budget(
    model_byte_budget: u64,
    kv_cache_byte_budget: u64,
    manifest_byte_count: u64,
    assembly_receipt_byte_count: u64,
    adapter_family_receipt_byte_count: u64,
    stack_byte_counts: &[u64],
) -> io::Result<u64> {
    let mut total = model_byte_budget;
    for byte_count in [
        manifest_byte_count,
        assembly_receipt_byte_count,
        adapter_family_receipt_byte_count,
        kv_cache_byte_budget,
        MODULE_PLAN_PROMPT_BYTE_LIMIT,
        MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET,
        MODULE_PLAN_OUTPUT_BYTE_LIMIT,
    ] {
        total = total
            .checked_add(byte_count)
            .ok_or_else(|| invalid("module plan total byte budget overflow"))?;
    }
    for byte_count in stack_byte_counts {
        total = total
            .checked_add(*byte_count)
            .ok_or_else(|| invalid("module plan total byte budget overflow"))?;
    }
    Ok(total)
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
    push_line(
        &mut text,
        "assembly_strategy",
        spec.operator.assembly_strategy(),
    );
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
        &evidence_route(spec, &spec.operator.evidence_file("operator")),
    );
    push_line(
        &mut text,
        "operator_receipt_checksum",
        &text_file_checksum(operator_receipt_path)?,
    );
    push_line(
        &mut text,
        "candidate_manifest_path",
        &evidence_route(spec, &spec.operator.evidence_file("candidate")),
    );
    push_line(
        &mut text,
        "candidate_manifest_checksum",
        &text_file_checksum(candidate_manifest_path)?,
    );
    push_line(
        &mut text,
        "promotion_manifest_path",
        &evidence_route(spec, &spec.operator.evidence_file("promotion")),
    );
    push_line(
        &mut text,
        "promotion_manifest_checksum",
        &text_file_checksum(promotion_manifest_path)?,
    );
    push_line(
        &mut text,
        "runtime_smoke_path",
        &evidence_route(spec, &spec.operator.evidence_file("runtime")),
    );
    push_line(
        &mut text,
        "runtime_smoke_manifest_checksum",
        &text_file_checksum(runtime_smoke_path)?,
    );
    push_line(
        &mut text,
        "eval_path",
        &evidence_route(spec, &spec.operator.evidence_file("eval")),
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
        &evidence_route(spec, &spec.operator.evidence_file("multi.admission")),
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
    let adapter_path = models.join(adapter_file);
    let adapter_manifest_path = models.join(format!("{adapter_file}.manifest"));
    match adapter_kind {
        BundleAdapterKind::RawAdp1 => {
            let (compatibility_path, lineage_path) = write_bundle_adapter_lineage(
                spec,
                candidate_path,
                evidence,
                route_id,
                "adapter-delta-v1",
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
        }
        BundleAdapterKind::SparseAsp1 => {
            let (compatibility_path, lineage_path) = write_bundle_adapter_lineage(
                spec,
                candidate_path,
                evidence,
                route_id,
                "sparse-adapter-delta-v1",
            )?;
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
        BundleAdapterKind::SourceLowRankAlr1 => {
            let source_dir = evidence.join(format!("{route_id}.source"));
            trained_adapter_source::write_adapter_source_template_path(
                &source_dir,
                "tiny-fixture",
            )?;
            trained_adapter_source::convert_adapter_source_path(
                &source_dir,
                candidate_path,
                &adapter_path,
                &adapter_manifest_path,
            )?;
            trained_adapter_source::validate_converted_adapter_source_path(
                &source_dir,
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

fn write_bundle_adapter_lineage(
    spec: &BundleSpec,
    candidate_path: &Path,
    evidence: &Path,
    route_id: &str,
    lineage_operator: &str,
) -> io::Result<(PathBuf, PathBuf)> {
    let compatibility_path = evidence.join(format!("{route_id}.compat"));
    let lineage_path = evidence.join(format!("{route_id}.lineage"));
    compatibility::report_path(candidate_path, candidate_path, Some(&compatibility_path))?;
    lineage::write_template_path(
        &compatibility_path,
        &lineage_path,
        &format!("{}-{route_id}", spec.id),
        lineage_operator,
        "browser-registry-sidecar",
    )?;
    Ok((compatibility_path, lineage_path))
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
            BundleAdapterKind::SourceLowRankAlr1,
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

fn validate_hex64_text(value: &str, label: &str) -> io::Result<()> {
    let Some(rest) = value.strip_prefix("0x") else {
        return Err(invalid(&format!("{label} is not a hex64 checksum")));
    };
    if rest.len() != 16 || !rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!("{label} is not a hex64 checksum")));
    }
    Ok(())
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
        assert_module_plan_with_operator(root, id, quantization, registry, "sign-merge");
    }

    fn assert_module_plan_with_operator(
        root: &std::path::Path,
        id: &str,
        quantization: &str,
        registry: &str,
        evidence_prefix: &str,
    ) {
        let file_name = format!("{id}.module-plan.receipt");
        let module_plan = fs::read_to_string(root.join("models").join(&file_name)).unwrap();
        let checksum = hex64(provenance::text_checksum(module_plan.as_bytes()));
        let model_path = root.join("models").join(format!("{id}.slm"));
        let model_bytes_body = fs::read(&model_path).unwrap();
        let report =
            slm_validate::validate_bytes(&model_bytes_body, &display_path(&model_path)).unwrap();
        let tokenizer_checksum = hex64(report.tokenizer_checksum());
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
        let operator_receipt_checksum = text_file_checksum(
            &root
                .join("evidence")
                .join(id)
                .join(format!("{evidence_prefix}.operator")),
        )
        .unwrap();
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
        let kv_cache_bytes = 1024u64;
        let adapter_stack_byte_budget =
            family_adapter_bytes + sparse_adapter_bytes + low_rank_adapter_bytes;
        let total_byte_budget = model_bytes
            + manifest_bytes
            + assembly_receipt_bytes
            + adapter_family_receipt_bytes
            + adapter_stack_byte_budget
            + kv_cache_bytes
            + MODULE_PLAN_PROMPT_BYTE_LIMIT
            + MODULE_PLAN_RUNTIME_SCRATCH_BYTE_BUDGET
            + MODULE_PLAN_OUTPUT_BYTE_LIMIT;
        assert!(registry.contains(&format!("module_plan_path=../models/{file_name}")));
        assert!(registry.contains(&format!("module_plan_checksum={checksum}")));
        assert!(registry.contains("module_plan_status=receipt-validated"));
        assert!(registry.contains("module_plan_kind=browser-local-module-plan"));
        assert!(registry.contains("module_plan_strategy=selector-entry-self-assembly"));
        assert!(registry.contains("module_plan_resource_class=browser-constrained-local-assembly"));
        assert!(registry.contains("module_plan_profile=browser-constrained-v1"));
        assert!(registry.contains("module_plan_execution_profile=single-threaded-wasm-local-v1"));
        assert!(registry.contains("module_plan_fetch_policy=local-no-store-v1"));
        assert!(registry.contains("module_plan_origin_policy=same-origin-loopback-local-v1"));
        assert!(registry.contains("module_plan_fetch_count_limit=32"));
        assert!(registry.contains("module_plan_planned_fetch_count=21"));
        assert!(registry.contains("module_plan_route_set_version=1"));
        assert!(registry
            .contains("module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1"));
        assert!(registry.contains("module_plan_route_set_checksum=0x"));
        assert!(registry.contains(&format!(
            "module_plan_operator_receipt_path=../evidence/{id}/{evidence_prefix}.operator"
        )));
        assert!(registry.contains(&format!(
            "module_plan_operator_receipt_checksum={operator_receipt_checksum}"
        )));
        assert!(registry.contains("module_plan_wasm_memory_initial_pages=17"));
        assert!(registry.contains("module_plan_wasm_export_set=tinyrustlm-generate-v1"));
        assert!(registry.contains("module_plan_wasm_transfer_strategy=copy-then-release-v1"));
        assert!(registry.contains("module_plan_model_release_strategy=free-before-reassembly-v1"));
        assert!(registry
            .contains("module_plan_runtime_reset_strategy=reset-context-before-assembly-v1"));
        assert!(registry
            .contains("module_plan_adapter_validation_strategy=rust-validate-before-apply-v1"));
        assert!(registry.contains("module_plan_adapter_validation_count=3"));
        assert!(registry.contains("module_plan_adapter_apply_count=3"));
        assert!(registry.contains("module_plan_wasm_heap_min_bytes=65536"));
        assert!(registry.contains("module_plan_context_token_limit=16"));
        assert!(registry.contains("module_plan_sampler_candidate_cap=1024"));
        assert!(registry.contains(&format!(
            "module_plan_tokenizer_checksum={tokenizer_checksum}"
        )));
        assert!(registry.contains("module_plan_prompt_byte_limit=4096"));
        assert!(registry.contains(&format!("module_plan_model_byte_budget={model_bytes}")));
        assert!(registry.contains("module_plan_adapter_byte_budget=1048576"));
        assert!(registry.contains(&format!(
            "module_plan_adapter_stack_byte_budget={adapter_stack_byte_budget}"
        )));
        assert!(registry.contains("module_plan_runtime_scratch_byte_budget=65536"));
        assert!(registry.contains("module_plan_output_byte_limit=65536"));
        assert!(registry.contains("module_plan_kv_cache_byte_budget=1024"));
        assert!(registry.contains("module_plan_kv_cache_page_count=1"));
        assert!(registry.contains(&format!(
            "module_plan_total_byte_budget={total_byte_budget}"
        )));
        assert!(registry.contains(&format!(
            "module_plan_total_byte_budget_limit={MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT}"
        )));
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
        assert!(module_plan.contains("module_plan_profile=browser-constrained-v1"));
        assert!(module_plan.contains("module_plan_execution_profile=single-threaded-wasm-local-v1"));
        assert!(module_plan.contains("module_plan_fetch_policy=local-no-store-v1"));
        assert!(module_plan.contains("module_plan_origin_policy=same-origin-loopback-local-v1"));
        assert!(module_plan.contains("module_plan_fetch_count_limit=32"));
        assert!(module_plan.contains("module_plan_planned_fetch_count=21"));
        assert!(module_plan.contains("module_plan_route_set_version=1"));
        assert!(module_plan
            .contains("module_plan_route_set_checksum_algorithm=tinyrustlm-text-checksum-v1"));
        assert!(module_plan.contains("module_plan_route_set_checksum=0x"));
        assert!(module_plan.contains(&format!(
            "operator_receipt_path=../evidence/{id}/{evidence_prefix}.operator"
        )));
        assert!(module_plan.contains(&format!(
            "operator_receipt_checksum={operator_receipt_checksum}"
        )));
        assert!(module_plan.contains("module_plan_wasm_memory_initial_pages=17"));
        assert!(module_plan.contains("module_plan_wasm_export_set=tinyrustlm-generate-v1"));
        assert!(module_plan.contains("module_plan_wasm_transfer_strategy=copy-then-release-v1"));
        assert!(
            module_plan.contains("module_plan_model_release_strategy=free-before-reassembly-v1")
        );
        assert!(module_plan
            .contains("module_plan_runtime_reset_strategy=reset-context-before-assembly-v1"));
        assert!(module_plan
            .contains("module_plan_adapter_validation_strategy=rust-validate-before-apply-v1"));
        assert!(module_plan.contains("module_plan_adapter_validation_count=3"));
        assert!(module_plan.contains("module_plan_adapter_apply_count=3"));
        assert!(module_plan.contains("module_plan_wasm_heap_min_bytes=65536"));
        assert!(module_plan.contains("module_plan_context_token_limit=16"));
        assert!(module_plan.contains("module_plan_sampler_candidate_cap=1024"));
        assert!(module_plan.contains(&format!(
            "module_plan_tokenizer_checksum={tokenizer_checksum}"
        )));
        assert!(module_plan.contains("module_plan_prompt_byte_limit=4096"));
        assert!(module_plan.contains(&format!("module_plan_model_byte_budget={model_bytes}")));
        assert!(module_plan.contains("module_plan_adapter_byte_budget=1048576"));
        assert!(module_plan.contains(&format!(
            "module_plan_adapter_stack_byte_budget={adapter_stack_byte_budget}"
        )));
        assert!(module_plan.contains("module_plan_runtime_scratch_byte_budget=65536"));
        assert!(module_plan.contains("module_plan_output_byte_limit=65536"));
        assert!(module_plan.contains("module_plan_kv_cache_byte_budget=1024"));
        assert!(module_plan.contains("module_plan_kv_cache_page_count=1"));
        assert!(module_plan.contains(&format!(
            "module_plan_total_byte_budget={total_byte_budget}"
        )));
        assert!(module_plan.contains(&format!(
            "module_plan_total_byte_budget_limit={MODULE_PLAN_TOTAL_BYTE_BUDGET_LIMIT}"
        )));
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

    fn assert_source_backed_alr1_receipt_fields(family_receipt: &str, id: &str) {
        // Confirms the source-backed low-rank adapter member carries source provenance echoes.
        assert!(family_receipt.contains(&format!("adapter.3.path=../models/{id}-low-rank.alr1")));
        assert!(family_receipt.contains("adapter.3.kind=trained-source-low-rank-f32-v1"));
        assert!(family_receipt.contains("adapter.3.dtype=low-rank-f32-source-delta"));
        assert!(family_receipt.contains("adapter.3.source_manifest=adapter-source.manifest"));
        assert!(family_receipt.contains("adapter.3.source_manifest_checksum=0x"));
        assert!(family_receipt.contains("adapter.3.source_layout=low-rank-f32-factor-files-v1"));
        assert!(family_receipt.contains("adapter.3.source_format=trained-low-rank-factors-v1"));
        assert!(family_receipt.contains(
            "adapter.3.source_base_contract=matches-reviewed-adapter-source-base-contract"
        ));
    }

    fn assert_registry_breeding_fields(registry: &str, prefix: &str) {
        // Checks the ModelBreeder-inspired registry fields that route genome, species, population, mate-selection, phenotype, artifact, and fitness evidence.
        assert!(registry.contains(&format!("{prefix}.genome_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.genome_strategy=selector-admission-genome-v1"
        )));
        assert!(registry.contains(&format!("{prefix}.genome_lineage_status=admission-bound")));
        assert!(registry.contains(&format!("{prefix}.genome_lineage_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.species_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.species_strategy=selector-speciation-fit-v1"
        )));
        assert!(registry.contains(&format!("{prefix}.species_fit_status=browser-fit-bound")));
        assert!(registry.contains(&format!("{prefix}.species_fit_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.novelty_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.novelty_strategy=selector-novelty-sketch-v1"
        )));
        assert!(registry.contains(&format!("{prefix}.novelty_status=behavior-sketch-bound")));
        assert!(registry.contains(&format!("{prefix}.novelty_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.population_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.population_strategy=selector-population-review-route-v1"
        )));
        assert!(registry.contains(&format!(
            "{prefix}.population_status=population-review-bound"
        )));
        assert!(registry.contains(&format!("{prefix}.population_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.mate_selection_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.mate_selection_strategy=selector-mate-selection-route-v1"
        )));
        assert!(registry.contains(&format!("{prefix}.mate_selection_status=parent-pool-bound")));
        assert!(registry.contains(&format!("{prefix}.mate_selection_parent_count=3")));
        assert!(registry.contains(&format!("{prefix}.mate_selection_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.phenotype_evidence_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.phenotype_evidence_strategy=selector-phenotype-evidence-v1"
        )));
        assert!(registry.contains(&format!(
            "{prefix}.phenotype_evidence_status=runtime-eval-bound"
        )));
        assert!(registry.contains(&format!("{prefix}.phenotype_evidence_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.heritable_artifact_id=0x")));
        assert!(registry.contains(&format!(
            "{prefix}.heritable_artifact_strategy=selector-heritable-artifact-v1"
        )));
        assert!(registry.contains(&format!(
            "{prefix}.heritable_artifact_status=served-artifact-bound"
        )));
        assert!(registry.contains(&format!("{prefix}.heritable_artifact_checksum=0x")));
        assert!(registry.contains(&format!("{prefix}.fitness_vector_status=eval-bound")));
        assert!(registry.contains(&format!("{prefix}.fitness_vector_checksum=0x")));
    }

    #[test]
    fn writes_browser_converted_trained_bundle_from_source() {
        let temp = unique_dir("converted-trained");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();

        write_converted_trained_bundle_path(&root, &source, "q8_0").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry.0.candidate_id=converted-trained-q8"));
        assert!(registry.contains("entry.0.display_name=Converted trained-source q8_0"));
        assert!(registry.contains("entry.0.model_path=../models/converted-trained-q8.slm"));
        assert!(
            registry.contains("entry.0.manifest_path=../models/converted-trained-q8.slm.manifest")
        );
        assert!(
            registry.contains("entry.0.source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest")
        );
        assert!(registry.contains("entry.0.source_manifest_kind=trained-source-manifest"));
        assert!(registry.contains("entry.0.source_manifest_status=reviewed-source-snapshot"));
        assert!(registry.contains("entry.0.source_manifest_source_kind=trained-source-fixture"));
        assert!(
            registry.contains("entry.0.source_manifest_source_id=tinyrustlm-local-source-fixture")
        );
        assert!(registry.contains("entry.0.source_manifest_model_shape=tiny-fixture"));
        assert!(registry.contains(
            "entry.0.runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime"
        ));
        assert!(registry
            .contains("entry.0.eval_path=../evidence/converted-trained-q8/converted-trained.eval"));
        assert!(registry.contains(
            "entry.0.admission_path=../evidence/converted-trained-q8/converted-trained.admission"
        ));
        assert!(registry.contains("entry.0.quantization=q8_0"));
        assert!(registry.contains("entry.0.mate_selection_status=admission-only"));
        assert!(registry.contains("entry.0.mate_selection_parent_count=1"));
        assert!(registry.contains("entry.0.quality_scope=tiny-converted-source-fixture-only"));
        assert!(registry.contains("entry.0.public_claim_status=bound-to-eval-scope"));
        assert!(registry.contains("entry.0.genome_strategy=selector-admission-genome-v1"));
        assert!(registry.contains("entry.0.species_strategy=selector-speciation-fit-v1"));
        assert!(registry.contains("entry.0.novelty_strategy=selector-novelty-sketch-v1"));
        assert!(
            registry.contains("entry.0.population_strategy=selector-population-review-route-v1")
        );
        assert!(
            registry.contains("entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1")
        );
        assert!(
            registry.contains("entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1")
        );
        assert!(registry.contains("entry.0.fitness_vector_status=eval-bound"));
        let manifest = fs::read_to_string(
            root.join("models")
                .join("converted-trained-q8.slm.manifest"),
        )
        .unwrap();
        assert!(manifest.contains("source_kind=converted-trained"));
        assert!(manifest.contains("quality_claim=runtime-compatible-not-quality-verified"));
        assert!(manifest.contains("trained_quality_claim=pending-evaluation"));
        assert!(root
            .join("models")
            .join("converted-trained-q8.slm")
            .exists());
        assert!(root
            .join("evidence")
            .join("converted-trained-q8")
            .join("converted-trained.admission")
            .exists());
        let admission = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.admission"),
        )
        .unwrap();
        assert!(admission.contains(
            "admission_path=../evidence/converted-trained-q8/converted-trained.admission"
        ));
        let admission_checksum = hex64(provenance::text_checksum(admission.as_bytes()));
        assert!(registry.contains(&format!("entry.0.admission_checksum={admission_checksum}")));
        let eval = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.eval"),
        )
        .unwrap();
        assert!(eval.contains("case_count=2"));
        assert!(eval.contains("cases_passed=2"));
        assert!(eval.contains("cases_failed=0"));
        assert!(eval.contains("case.1.expected=eeee"));
        assert!(eval.contains("case.1.actual=eeee"));
        let eval_checksum = hex64(provenance::text_checksum(eval.as_bytes()));
        assert!(registry.contains(&format!("entry.0.eval_manifest_checksum={eval_checksum}")));
        let runtime = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.runtime"),
        )
        .unwrap();
        assert!(runtime.contains("gate=runtime-smoke"));
        assert!(runtime.contains("runtime_smoke_status=pass"));
        let runtime_checksum = hex64(provenance::text_checksum(runtime.as_bytes()));
        assert!(registry.contains(&format!(
            "entry.0.runtime_smoke_manifest_checksum={runtime_checksum}"
        )));
        let source_manifest_checksum =
            assert_converted_trained_source_manifest_snapshot(&root, "converted-trained-q8");
        assert!(registry.contains(&format!(
            "entry.0.source_manifest_checksum={source_manifest_checksum}"
        )));
        assert!(root.join("app").join("app.js").exists());
        assert_runtime_manifest(&root);

        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn rejects_browser_converted_trained_bundle_when_runtime_eval_fails() {
        let temp = unique_dir("converted-trained-eval-fail");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        let eval_cases = temp.join("mismatched-eval-cases.txt");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();
        fs::write(
            &eval_cases,
            "tinyrustlm_eval_cases_version=1\nscope=tiny-fixture-runtime-eval-only\nquality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=Intentional mismatch for bundle admission test\ncase_count=1\ncase.0.prompt=hi\ncase.0.max_new_tokens=1\ncase.0.expected_text=not-e\ncase.0.required_result=exact\n",
        )
        .unwrap();

        let error = write_converted_trained_bundle_path_with_eval_cases(
            &root,
            &source,
            "q8_0",
            &eval_cases,
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("converted-trained browser bundle eval failed"));
        let eval = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.eval"),
        )
        .unwrap();
        assert!(eval.contains("eval_status=fail"));
        assert!(eval.contains("task_eval_status=fail"));
        assert!(eval.contains("case.0.status=fail"));
        assert!(!root
            .join("evidence")
            .join("converted-trained-q8")
            .join("converted-trained.admission")
            .exists());
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn rejects_browser_converted_trained_bundle_unknown_quantization() {
        let temp = unique_dir("converted-trained-quantization");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();

        let error = write_converted_trained_bundle_path(&root, &source, "bf16").unwrap_err();

        assert!(error.to_string().contains(
            "browser-converted-trained-bundle quantization must be f32, q8_0, q4_0, or all"
        ));
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn writes_all_browser_converted_trained_bundle_from_source() {
        let temp = unique_dir("converted-trained-all");
        let source = temp.join("source");
        let root = temp.join("tinyrustlm");
        trained_source::write_source_template_path(&source, "tiny-fixture").unwrap();

        write_converted_trained_bundle_path(&root, &source, "all").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry_count=3"));
        assert!(registry.contains("selector_default_candidate_id=converted-trained-q4"));
        assert!(registry.contains("selector_default_quantization=q4_0"));
        for (candidate_id, quantization) in [
            ("converted-trained-f32", "f32"),
            ("converted-trained-q8", "q8_0"),
            ("converted-trained-q4", "q4_0"),
        ] {
            assert!(registry.contains(&format!("candidate_id={candidate_id}")));
            assert!(registry.contains(&format!("model_path=../models/{candidate_id}.slm")));
            assert!(registry.contains(&format!(
                "manifest_path=../models/{candidate_id}.slm.manifest"
            )));
            assert!(registry.contains(&format!(
                "source_manifest_path=../evidence/{candidate_id}/converted-trained.source.manifest"
            )));
            assert!(registry.contains("source_manifest_kind=trained-source-manifest"));
            assert!(registry.contains("source_manifest_status=reviewed-source-snapshot"));
            assert!(registry.contains("source_manifest_source_kind=trained-source-fixture"));
            assert!(registry.contains("source_manifest_source_id=tinyrustlm-local-source-fixture"));
            assert!(registry.contains("source_manifest_model_shape=tiny-fixture"));
            assert!(registry.contains(&format!(
                "eval_path=../evidence/{candidate_id}/converted-trained.eval"
            )));
            assert!(registry.contains(&format!(
                "runtime_smoke_path=../evidence/{candidate_id}/converted-trained.runtime"
            )));
            assert!(registry.contains(&format!(
                "admission_path=../evidence/{candidate_id}/converted-trained.admission"
            )));
            assert!(registry.contains(&format!("quantization={quantization}")));
            let manifest = fs::read_to_string(
                root.join("models")
                    .join(format!("{candidate_id}.slm.manifest")),
            )
            .unwrap();
            assert!(manifest.contains("source_kind=converted-trained"));
            assert!(manifest.contains(&format!("quantization={quantization}")));
            assert!(root
                .join("models")
                .join(format!("{candidate_id}.slm"))
                .exists());
            assert!(root
                .join("evidence")
                .join(candidate_id)
                .join("converted-trained.admission")
                .exists());
            let admission = fs::read_to_string(
                root.join("evidence")
                    .join(candidate_id)
                    .join("converted-trained.admission"),
            )
            .unwrap();
            assert!(admission.contains(&format!(
                "admission_path=../evidence/{candidate_id}/converted-trained.admission"
            )));
            let admission_checksum = hex64(provenance::text_checksum(admission.as_bytes()));
            assert!(registry.contains(&format!("admission_checksum={admission_checksum}")));
            let source_manifest_checksum =
                assert_converted_trained_source_manifest_snapshot(&root, candidate_id);
            assert!(registry.contains(&format!(
                "source_manifest_checksum={source_manifest_checksum}"
            )));
            let eval = fs::read_to_string(
                root.join("evidence")
                    .join(candidate_id)
                    .join("converted-trained.eval"),
            )
            .unwrap();
            let eval_checksum = hex64(provenance::text_checksum(eval.as_bytes()));
            assert!(registry.contains(&format!("eval_manifest_checksum={eval_checksum}")));
            let runtime = fs::read_to_string(
                root.join("evidence")
                    .join(candidate_id)
                    .join("converted-trained.runtime"),
            )
            .unwrap();
            assert!(runtime.contains("gate=runtime-smoke"));
            assert!(runtime.contains("runtime_smoke_status=pass"));
            let runtime_checksum = hex64(provenance::text_checksum(runtime.as_bytes()));
            assert!(registry.contains(&format!(
                "runtime_smoke_manifest_checksum={runtime_checksum}"
            )));
        }
        assert!(root.join("app").join("app.js").exists());
        assert_runtime_manifest(&root);

        fs::remove_dir_all(temp).unwrap();
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
        assert_registry_breeding_fields(&registry, "entry.0");
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
        assert!(registry
            .contains("entry.0.adapter.3.label=Multi-parent sign-merge f32 source-backed ALR1"));
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
        assert_source_backed_alr1_receipt_fields(&family_receipt, "multi-parent-sign-merge-f32");
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
        assert!(low_rank_manifest.contains("adapter_artifact_kind=trained-source-low-rank-f32-v1"));
        assert!(low_rank_manifest.contains("adapter_dtype=low-rank-f32-source-delta"));
        assert!(low_rank_manifest.contains("adapter_source_manifest_checksum=0x"));
        assert!(low_rank_manifest.contains(
            "adapter_source_base_contract=matches-reviewed-adapter-source-base-contract"
        ));
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
            assert_registry_breeding_fields(&registry, "entry.0");
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
            assert_source_backed_alr1_receipt_fields(&family_receipt, &id);
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
    fn writes_browser_multi_parent_soup_bundle() {
        let root = unique_dir("soup-bundle").join("tinyrustlm");
        write_bundle_path_with_quantization_and_operator(&root, "q8_0", "soup").unwrap();
        let id = "multi-parent-soup-q8";

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains(&format!("entry.0.candidate_id={id}")));
        assert!(registry.contains(&format!("entry.0.model_path=../models/{id}.slm")));
        assert!(registry.contains(&format!(
            "entry.0.adapter_label=Multi-parent weighted soup q8_0 self ADP1"
        )));
        assert!(registry.contains(&format!(
            "entry.0.module_plan_operator_receipt_path=../evidence/{id}/soup.operator"
        )));
        assert!(registry.contains("entry.0.operator_receipt_status=receipt-bound"));
        assert!(registry.contains(&format!(
            "entry.0.operator_receipt_path={}",
            display_path(&root.join("evidence").join(id).join("soup.operator"))
        )));
        assert!(registry.contains(&format!("entry.0.operator_receipt_operator_id={id}")));
        assert!(registry
            .contains("entry.0.operator_receipt_operator_kind=seed-weighted-parent-pool-soup"));
        assert!(registry.contains("entry.0.operator_receipt_candidate_slm_checksum=0x"));
        assert!(registry.contains("entry.0.operator_receipt_candidate_artifact_bytes="));
        assert_module_plan_with_operator(&root, id, "q8_0", &registry, "soup");

        let operator_receipt =
            fs::read_to_string(root.join("evidence").join(id).join("soup.operator")).unwrap();
        assert!(operator_receipt.contains("operator_kind=seed-weighted-parent-pool-soup"));
        assert!(operator_receipt.contains("soup_merge_rule=seed-weighted-direct-parameter-average"));
        assert!(operator_receipt.contains("soup_parent_weight_checksum=0x"));

        let candidate_manifest =
            fs::read_to_string(root.join("evidence").join(id).join("soup.candidate")).unwrap();
        assert!(candidate_manifest.contains("operator_kind=seed-weighted-parent-pool-soup"));
        assert!(candidate_manifest.contains("soup_weighted_value_checksum=0x"));
        assert!(!candidate_manifest.contains("sign_selection_rule="));

        let assembly_receipt =
            fs::read_to_string(root.join("models").join(format!("{id}.assembly.receipt"))).unwrap();
        assert!(assembly_receipt.contains("assembly_strategy=multi-parent-weighted-soup"));
        for file_name in [
            "soup.operator",
            "soup.candidate",
            "soup.promotion",
            "soup.runtime",
            "soup.eval",
            "soup.multi.admission",
        ] {
            assert!(assembly_receipt.contains(&format!("../evidence/{id}/{file_name}")));
        }
        assert!(root
            .join("evidence")
            .join(id)
            .join("soup.multi.admission")
            .exists());
        assert!(root.join("app").join("app.js").exists());
        assert_runtime_manifest(&root);

        fs::remove_dir_all(root.parent().unwrap()).unwrap();
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
            assert_registry_breeding_fields(&registry, &format!("entry.{index}"));
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
            assert_source_backed_alr1_receipt_fields(&family_receipt, &id);
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
    fn writes_combined_browser_multi_parent_soup_bundle() {
        // Exercises the soup operator across the all-quantization bundle path.
        let root = unique_dir("combined-soup").join("tinyrustlm");
        write_bundle_path_with_quantization_and_operator(&root, "all", "soup").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry_count=3"));
        assert!(registry.contains("selector_default_strategy=browser-frugal-quantized"));
        assert!(registry.contains("selector_default_candidate_id=multi-parent-soup-q4"));
        assert!(registry.contains("selector_default_quantization=q4_0"));
        for (index, quantization, suffix) in
            [(0, "f32", "f32"), (1, "q8_0", "q8"), (2, "q4_0", "q4")]
        {
            let id = format!("multi-parent-soup-{suffix}");
            assert!(registry.contains(&format!("entry.{index}.candidate_id={id}")));
            assert!(registry.contains(&format!("entry.{index}.quantization={quantization}")));
            assert!(registry.contains(&format!("entry.{index}.model_path=../models/{id}.slm")));
            assert!(registry.contains(&format!(
                "entry.{index}.adapter_label=Multi-parent weighted soup {quantization} self ADP1"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.module_plan_operator_receipt_path=../evidence/{id}/soup.operator"
            )));
            assert!(registry.contains(&format!("entry.{index}.operator_receipt_operator_id={id}")));
            assert!(registry.contains(&format!(
                "entry.{index}.operator_receipt_operator_kind=seed-weighted-parent-pool-soup"
            )));
            assert_module_plan_with_operator(&root, &id, quantization, &registry, "soup");

            let operator_receipt =
                fs::read_to_string(root.join("evidence").join(&id).join("soup.operator")).unwrap();
            assert!(operator_receipt.contains("operator_kind=seed-weighted-parent-pool-soup"));
            assert!(
                operator_receipt.contains("soup_merge_rule=seed-weighted-direct-parameter-average")
            );

            let assembly_receipt =
                fs::read_to_string(root.join("models").join(format!("{id}.assembly.receipt")))
                    .unwrap();
            assert!(assembly_receipt.contains("assembly_strategy=multi-parent-weighted-soup"));
            assert!(assembly_receipt.contains(&format!("../evidence/{id}/soup.operator")));
            assert!(assembly_receipt.contains(&format!("../evidence/{id}/soup.multi.admission")));
            assert!(root
                .join("evidence")
                .join(&id)
                .join("soup.multi.admission")
                .exists());
            assert!(!root
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
    fn writes_combined_browser_multi_parent_mixed_operator_bundle() {
        // Exercises the mixed operator selector path across both generated parent-pool families.
        let root = unique_dir("combined-mixed").join("tinyrustlm");
        write_bundle_path_with_quantization_and_operator(&root, "all", "mixed").unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry_count=6"));
        assert!(registry.contains("selector_default_strategy=browser-frugal-quantized"));
        assert!(registry.contains("selector_default_candidate_id=multi-parent-sign-merge-q4"));
        assert!(registry.contains("selector_default_quantization=q4_0"));
        for (
            index,
            quantization,
            suffix,
            family,
            evidence_prefix,
            operator_kind,
            assembly_strategy,
        ) in [
            (
                0,
                "f32",
                "f32",
                "multi-parent-sign-merge",
                "sign-merge",
                "sign-aware-parent-pool-merge",
                "multi-parent-sign-merge",
            ),
            (
                1,
                "q8_0",
                "q8",
                "multi-parent-sign-merge",
                "sign-merge",
                "sign-aware-parent-pool-merge",
                "multi-parent-sign-merge",
            ),
            (
                2,
                "q4_0",
                "q4",
                "multi-parent-sign-merge",
                "sign-merge",
                "sign-aware-parent-pool-merge",
                "multi-parent-sign-merge",
            ),
            (
                3,
                "f32",
                "f32",
                "multi-parent-soup",
                "soup",
                "seed-weighted-parent-pool-soup",
                "multi-parent-weighted-soup",
            ),
            (
                4,
                "q8_0",
                "q8",
                "multi-parent-soup",
                "soup",
                "seed-weighted-parent-pool-soup",
                "multi-parent-weighted-soup",
            ),
            (
                5,
                "q4_0",
                "q4",
                "multi-parent-soup",
                "soup",
                "seed-weighted-parent-pool-soup",
                "multi-parent-weighted-soup",
            ),
        ] {
            let id = format!("{family}-{suffix}");
            assert!(registry.contains(&format!("entry.{index}.candidate_id={id}")));
            assert!(registry.contains(&format!("entry.{index}.quantization={quantization}")));
            assert!(registry.contains(&format!(
                "entry.{index}.module_plan_operator_receipt_path=../evidence/{id}/{evidence_prefix}.operator"
            )));
            assert!(registry.contains(&format!(
                "entry.{index}.operator_receipt_operator_kind={operator_kind}"
            )));
            assert_module_plan_with_operator(&root, &id, quantization, &registry, evidence_prefix);

            let assembly_receipt =
                fs::read_to_string(root.join("models").join(format!("{id}.assembly.receipt")))
                    .unwrap();
            assert!(assembly_receipt.contains(&format!("assembly_strategy={assembly_strategy}")));
            assert!(assembly_receipt.contains(&format!(
                "../evidence/{id}/{evidence_prefix}.multi.admission"
            )));
            assert!(root
                .join("evidence")
                .join(&id)
                .join(format!("{evidence_prefix}.multi.admission"))
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

    fn assert_converted_trained_source_manifest_snapshot(
        root: &Path,
        candidate_id: &str,
    ) -> String {
        // Confirms each browser evidence lane preserves the reviewed source manifest route.
        let source_manifest = fs::read_to_string(
            root.join("evidence")
                .join(candidate_id)
                .join("converted-trained.source.manifest"),
        )
        .unwrap();
        assert!(source_manifest.contains("tinyrustlm_trained_source_version=1"));
        assert!(source_manifest.contains("source_kind=trained-source-fixture"));
        assert!(source_manifest.contains("source_id=tinyrustlm-local-source-fixture"));
        assert!(source_manifest.contains("model_shape=tiny-fixture"));
        hex64(provenance::text_checksum(source_manifest.as_bytes()))
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
