//! Safetensors metadata intake for future real trained-source conversion.

use std::collections::{BTreeMap, HashMap};
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use crate::tensor_writer::{
    tensors_for_shape, tensors_for_shape_with_tied_output, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::tokenizer_writer::{BpeMergeSpec, BpeTokenSpec, ByteTokenizerSection, TokenizerSection};
use crate::writer::align_to_64;
use crate::{browser_bundle, provenance, trained_source};

const SAFETENSORS_REPORT_VERSION: &str = "1";
const SAFETENSORS_SOURCE_PLAN_VERSION: &str = "1";
const SAFETENSORS_CANDIDATE_REVIEW_VERSION: &str = "1";
const SAFETENSORS_LAYOUT: &str = "safetensors-v1";
const SAFETENSORS_SOURCE_PLAN_LAYOUT: &str = "safetensors-to-raw-f32-source-plan-v1";
const SAFETENSORS_CANDIDATE_REVIEW_LAYOUT: &str = "safetensors-real-trained-candidate-review-v1";
const RAW_SOURCE_LAYOUT: &str = "raw-f32-tensor-files-v1";
const MAX_HEADER_BYTES: u64 = 16 * 1024 * 1024;
const SELECTOR_MODEL_BYTE_BUDGET: u64 = 33_554_432;
const SELECTOR_DEFAULT_STRATEGY: &str = "browser-frugal-quantized";
const SLM_HEADER_LEN: usize = 108;
const SLM_TENSOR_ENTRY_LEN: usize = 64;

#[derive(Clone)]
struct TensorInfo {
    name: String,
    dtype: String,
    dtype_size: u64,
    shape: Vec<u64>,
    element_count: u64,
    start: u64,
    end: u64,
}

#[derive(Default)]
struct DtypeStats {
    tensor_count: u64,
    parameter_count: u64,
    data_bytes: u64,
}

struct SafetensorsInspection {
    source_path: String,
    file_bytes: u64,
    header_bytes: u64,
    data_bytes: u64,
    header_checksum: u64,
    tensor_directory_checksum: u64,
    tensors: Vec<TensorInfo>,
    dtype_stats: BTreeMap<String, DtypeStats>,
}

struct SourceTensorPlan {
    name: String,
    source_name: String,
    dtype: String,
    shape: Vec<u64>,
    start: u64,
    end: u64,
    raw_source_file: String,
    raw_source_bytes: u64,
    conversion_action: &'static str,
}

struct SourcePlan {
    inspection: SafetensorsInspection,
    target_model_shape: String,
    conversion_status: &'static str,
    raw_source_bytes: u64,
    tensors: Vec<SourceTensorPlan>,
}

struct CandidateReviewMetadata<'a> {
    source_model_id: &'a str,
    source_model_sha: &'a str,
    source_config_checksum: &'a str,
    source_tokenizer_checksum: &'a str,
    source_license_route: &'a str,
    reference_prompt_route: Option<&'a str>,
    reference_output_checksum: Option<&'a str>,
    eval_cases_route: Option<&'a str>,
    source_config_route: Option<&'a str>,
    source_tokenizer_route: Option<&'a str>,
}

struct CandidateReview<'a> {
    plan: SourcePlan,
    metadata: CandidateReviewMetadata<'a>,
    source_config_artifact: ReviewArtifactEvidence,
    source_tokenizer_artifact: ReviewArtifactEvidence,
    output_quantization: String,
    quantization_budgets: Vec<QuantizationBudgetReview>,
    browser_admission_preferred_quantization: &'static str,
    browser_admission_preference_reason: &'static str,
    browser_admission_fallback_quantization: &'static str,
    architecture_family: &'static str,
    tensor_layout_strategy: &'static str,
    tokenizer_strategy: &'static str,
    parameter_count: u64,
    estimated_slm_bytes: u64,
    selector_budget_status: &'static str,
    context_token_limit: u64,
    kv_cache_byte_budget: u64,
    kv_cache_page_count: u64,
    converter_gap_status: &'static str,
}

struct ReviewArtifactEvidence {
    status: &'static str,
    kind: &'static str,
    checksum: Option<String>,
    byte_count: Option<u64>,
    detail: Option<String>,
    tokenizer_override: Option<trained_source::SourceTokenizerOverride>,
}

/// Validated review-gate material that extraction can carry into source output.
struct ValidatedCandidateReviewGate {
    source_tokenizer_override: Option<trained_source::SourceTokenizerOverride>,
}

#[derive(Clone, Copy)]
enum ReviewArtifactRole {
    Config,
    Tokenizer,
}

impl ReviewArtifactRole {
    /// Returns the report-field prefix used for this review artifact.
    fn artifact_prefix(self) -> &'static str {
        match self {
            ReviewArtifactRole::Config => "source_config",
            ReviewArtifactRole::Tokenizer => "source_tokenizer",
        }
    }

    /// Returns the route field that identifies this review artifact.
    fn route_field(self) -> &'static str {
        match self {
            ReviewArtifactRole::Config => "source_config_route",
            ReviewArtifactRole::Tokenizer => "source_tokenizer_route",
        }
    }

    /// Returns the caller-supplied checksum field for this review artifact.
    fn checksum_field(self) -> &'static str {
        match self {
            ReviewArtifactRole::Config => "source_config_checksum",
            ReviewArtifactRole::Tokenizer => "source_tokenizer_checksum",
        }
    }
}

struct QuantizationBudgetReview {
    quantization: &'static str,
    estimated_slm_bytes: u64,
    selector_budget_status: &'static str,
}

enum JsonValue {
    Object(Vec<(String, JsonValue)>),
    Array(Vec<JsonValue>),
    String(String),
    Number(String),
    Bool,
    Null,
}

struct JsonParser<'a> {
    bytes: &'a [u8],
    index: usize,
}

/// Reads a local `.safetensors` file header, validates tensor ranges, and optionally writes a report.
pub fn inspect_path(input: &Path, output_report: Option<&Path>) -> io::Result<()> {
    let inspection = inspect_file(input)?;
    let report = render_report(&inspection);
    if let Some(output) = output_report {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output, &report)?;
    }
    println!("Safetensors inspection: PASS");
    println!("source_path: {}", inspection.source_path);
    println!("tensor_count: {}", inspection.tensors.len());
    println!("parameter_count: {}", total_parameter_count(&inspection));
    println!("data_bytes: {}", inspection.data_bytes);
    println!(
        "tensor_directory_checksum: 0x{:016x}",
        inspection.tensor_directory_checksum
    );
    Ok(())
}

/// Plans how a local `.safetensors` tensor directory maps into raw f32 source files.
pub fn plan_source_path(
    input: &Path,
    shape_name: &str,
    output_plan: Option<&Path>,
) -> io::Result<()> {
    let plan = build_source_plan(input, shape_name)?;
    let report = render_source_plan(&plan);
    if let Some(output) = output_plan {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output, &report)?;
    }
    println!("Safetensors source plan: PASS");
    println!("source_path: {}", plan.inspection.source_path);
    println!("target_model_shape: {}", plan.target_model_shape);
    println!("matched_tensor_count: {}", plan.tensors.len());
    println!("raw_source_bytes: {}", plan.raw_source_bytes);
    println!("conversion_status: {}", plan.conversion_status);
    Ok(())
}

/// Writes a reviewed candidate handoff before a real safetensors checkpoint is converted.
pub fn review_candidate_path(
    input: &Path,
    shape_name: &str,
    output_quantization: &str,
    source_model_id: &str,
    source_model_sha: &str,
    source_config_checksum: &str,
    source_tokenizer_checksum: &str,
    source_license_route: &str,
    output_review: &Path,
    reference_prompt_route: Option<&str>,
    reference_output_checksum: Option<&str>,
    eval_cases_route: Option<&str>,
    source_config_route: Option<&str>,
    source_tokenizer_route: Option<&str>,
) -> io::Result<()> {
    let metadata = CandidateReviewMetadata {
        source_model_id,
        source_model_sha,
        source_config_checksum,
        source_tokenizer_checksum,
        source_license_route,
        reference_prompt_route,
        reference_output_checksum,
        eval_cases_route,
        source_config_route,
        source_tokenizer_route,
    };
    let review = build_candidate_review(input, shape_name, output_quantization, metadata)?;
    let report = render_candidate_review(&review);
    if let Some(parent) = output_review.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_review, &report)?;
    println!("Safetensors candidate review: PASS");
    println!("source_path: {}", review.plan.inspection.source_path);
    println!("target_model_shape: {}", review.plan.target_model_shape);
    println!("output_quantization: {}", review.output_quantization);
    println!("estimated_slm_bytes: {}", review.estimated_slm_bytes);
    println!("selector_budget_status: {}", review.selector_budget_status);
    println!("converter_gap_status: {}", review.converter_gap_status);
    Ok(())
}

/// Extracts a checked `.safetensors` file into the raw f32 trained-source layout.
pub fn extract_source_path(input: &Path, shape_name: &str, output_dir: &Path) -> io::Result<()> {
    extract_source_path_with_review(input, shape_name, output_dir, None)
}

/// Extracts source tensors after optionally validating the pre-extraction review artifact.
pub fn extract_source_path_with_review(
    input: &Path,
    shape_name: &str,
    output_dir: &Path,
    candidate_review: Option<&Path>,
) -> io::Result<()> {
    extract_source_path_checked(input, shape_name, output_dir, candidate_review, None, false)
}

/// Shared extraction path that binds an optional candidate review before payload bytes are copied.
fn extract_source_path_checked(
    input: &Path,
    shape_name: &str,
    output_dir: &Path,
    candidate_review: Option<&Path>,
    output_quantization: Option<&str>,
    enforce_browser_preference: bool,
) -> io::Result<()> {
    let plan = build_source_plan(input, shape_name)?;
    let source_tokenizer_override = if let Some(candidate_review) = candidate_review {
        let gate = validate_candidate_review_path_for_plan(
            candidate_review,
            &plan,
            output_quantization,
            enforce_browser_preference,
        )?;
        gate.source_tokenizer_override
    } else {
        None
    };
    let source_review_checksum = match candidate_review {
        Some(candidate_review) => Some(candidate_review_checksum(candidate_review)?),
        None => None,
    };
    let payloads = extract_source_payloads(input, &plan)?;
    let source_id = format!(
        "safetensors-tensor-directory-{}",
        hex64(plan.inspection.tensor_directory_checksum)
    );
    let source_training_summary = format!(
        "Extracted {} checked safetensors tensors into TinyRustLM raw f32 source layout",
        plan.tensors.len()
    );
    let metadata = trained_source::SourceExportMetadata {
        source_id: &source_id,
        source_license: "local-safetensors-source-review",
        source_dataset: "local-safetensors-source-export",
        source_training_summary: &source_training_summary,
        source_review_kind: source_review_checksum
            .as_ref()
            .map(|_| trained_source::SOURCE_REVIEW_KIND),
        source_review_status: source_review_checksum
            .as_ref()
            .map(|_| trained_source::SOURCE_REVIEW_STATUS),
        source_review_checksum: source_review_checksum.as_deref(),
        source_review_required_next_gate: source_review_checksum
            .as_ref()
            .map(|_| trained_source::SOURCE_REVIEW_REQUIRED_NEXT_GATE),
        source_tokenizer_override: source_tokenizer_override.as_ref(),
    };
    trained_source::write_source_export_path(output_dir, shape_name, &metadata, &payloads)?;
    println!("Safetensors source extraction: PASS");
    println!("source_path: {}", plan.inspection.source_path);
    println!("target_model_shape: {}", plan.target_model_shape);
    println!("output_source_dir: {}", output_dir.display());
    println!("extracted_tensor_count: {}", payloads.len());
    println!("raw_source_bytes: {}", plan.raw_source_bytes);
    println!(
        "source_plan_mapping_checksum: {}",
        hex64(source_plan_mapping_checksum(&plan.tensors))
    );
    Ok(())
}

/// Converts a checked `.safetensors` file into an `.slm` through the reviewed raw source layout.
pub fn convert_source_path(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_slm: &Path,
    output_quantization: &str,
) -> io::Result<()> {
    convert_source_path_with_review(
        input,
        shape_name,
        output_source_dir,
        output_slm,
        output_quantization,
        None,
    )
}

/// Converts a safetensors source after optionally consuming its candidate-review gate.
pub fn convert_source_path_with_review(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_slm: &Path,
    output_quantization: &str,
    candidate_review: Option<&Path>,
) -> io::Result<()> {
    trained_source::validate_output_quantization(output_quantization)?;
    extract_source_path_checked(
        input,
        shape_name,
        output_source_dir,
        candidate_review,
        Some(output_quantization),
        false,
    )?;
    trained_source::validate_source_path(output_source_dir)?;
    trained_source::convert_trained_path(output_source_dir, output_slm, output_quantization)?;
    println!("Safetensors trained conversion: PASS");
    println!("source_path: {}", input.display());
    println!("target_model_shape: {shape_name}");
    println!("output_source_dir: {}", output_source_dir.display());
    println!("output_slm: {}", output_slm.display());
    println!("output_quantization: {output_quantization}");
    Ok(())
}

/// Writes a browser-loadable converted-trained bundle from a checked local `.safetensors` file.
pub fn browser_bundle_path(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_root: &Path,
    output_quantization: &str,
) -> io::Result<()> {
    browser_bundle_path_with_eval_cases(
        input,
        shape_name,
        output_source_dir,
        output_root,
        output_quantization,
        None,
    )
}

/// Writes a browser bundle after evaluating the converted model with caller-selected cases.
pub fn browser_bundle_path_with_eval_cases(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_root: &Path,
    output_quantization: &str,
    eval_cases_path: Option<&Path>,
) -> io::Result<()> {
    browser_bundle_path_with_eval_cases_and_review(
        input,
        shape_name,
        output_source_dir,
        output_root,
        output_quantization,
        eval_cases_path,
        None,
    )
}

/// Writes a browser bundle after validating optional eval cases and candidate review evidence.
pub fn browser_bundle_path_with_eval_cases_and_review(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_root: &Path,
    output_quantization: &str,
    eval_cases_path: Option<&Path>,
    candidate_review: Option<&Path>,
) -> io::Result<()> {
    browser_bundle::validate_converted_trained_bundle_quantization(output_quantization)?;
    extract_source_path_checked(
        input,
        shape_name,
        output_source_dir,
        candidate_review,
        Some(output_quantization),
        true,
    )?;
    trained_source::validate_source_path(output_source_dir)?;
    if let Some(eval_cases_path) = eval_cases_path {
        browser_bundle::write_converted_trained_bundle_path_with_eval_cases(
            output_root,
            output_source_dir,
            output_quantization,
            eval_cases_path,
        )?;
    } else {
        browser_bundle::write_converted_trained_bundle_path(
            output_root,
            output_source_dir,
            output_quantization,
        )?;
    }
    println!("Safetensors browser trained bundle: PASS");
    println!("source_path: {}", input.display());
    println!("target_model_shape: {shape_name}");
    println!("output_source_dir: {}", output_source_dir.display());
    println!("output_root: {}", output_root.display());
    println!("output_quantization: {output_quantization}");
    Ok(())
}

/// Reads only the safetensors prefix and header before validating offsets against file length.
fn inspect_file(input: &Path) -> io::Result<SafetensorsInspection> {
    let file_bytes = fs::metadata(input)?.len();
    if file_bytes < 8 {
        return Err(invalid(
            "safetensors file is shorter than the 8 byte header length",
        ));
    }

    let mut file = File::open(input)?;
    let mut length_bytes = [0u8; 8];
    file.read_exact(&mut length_bytes)?;
    let header_bytes = u64::from_le_bytes(length_bytes);
    if header_bytes == 0 || header_bytes > MAX_HEADER_BYTES {
        return Err(invalid(
            "safetensors header length is outside the local intake envelope",
        ));
    }
    let data_start = 8u64
        .checked_add(header_bytes)
        .ok_or_else(|| invalid("safetensors header length overflow"))?;
    if data_start > file_bytes {
        return Err(invalid("safetensors header extends beyond file length"));
    }

    let mut header = vec![0u8; header_bytes as usize];
    file.read_exact(&mut header)?;
    let data_bytes = file_bytes - data_start;
    inspect_header(
        &input.display().to_string(),
        file_bytes,
        &header,
        data_bytes,
    )
}

/// Parses and validates the JSON header against the byte buffer described by safetensors.
fn inspect_header(
    source_path: &str,
    file_bytes: u64,
    header: &[u8],
    data_bytes: u64,
) -> io::Result<SafetensorsInspection> {
    let header_text = std::str::from_utf8(header)
        .map_err(|_| invalid("safetensors header must be valid UTF-8 JSON"))?;
    let root = parse_json_object(header_text)?;
    let mut tensors = Vec::new();
    for (name, value) in root {
        if name == "__metadata__" {
            continue;
        }
        tensors.push(tensor_from_json(name, value)?);
    }
    if tensors.is_empty() {
        return Err(invalid("safetensors header did not contain tensor entries"));
    }
    validate_tensor_ranges(&tensors, data_bytes)?;
    let dtype_stats = dtype_stats(&tensors)?;
    Ok(SafetensorsInspection {
        source_path: source_path.to_string(),
        file_bytes,
        header_bytes: header.len() as u64,
        data_bytes,
        header_checksum: local_checksum(header),
        tensor_directory_checksum: tensor_directory_checksum(&tensors),
        tensors,
        dtype_stats,
    })
}

/// Converts one top-level safetensors tensor object into a checked tensor summary.
fn tensor_from_json(name: String, value: JsonValue) -> io::Result<TensorInfo> {
    let object = as_object(&value, "safetensors tensor entry")?;
    let dtype = require_string_field(object, "dtype")?.to_string();
    let dtype_size = dtype_byte_size(&dtype)?;
    let shape = require_number_array(object, "shape")?;
    let offsets = require_number_array(object, "data_offsets")?;
    if offsets.len() != 2 {
        return Err(invalid(
            "safetensors tensor data_offsets must contain exactly two numbers",
        ));
    }
    let start = offsets[0];
    let end = offsets[1];
    if start > end {
        return Err(invalid("safetensors tensor data_offsets must be ordered"));
    }
    let element_count = shape_element_count(&shape)?;
    let expected_bytes = element_count
        .checked_mul(dtype_size)
        .ok_or_else(|| invalid("safetensors tensor byte count overflow"))?;
    let actual_bytes = end - start;
    if actual_bytes != expected_bytes {
        return Err(invalid(&format!(
            "safetensors tensor {name} byte range was {actual_bytes}, expected {expected_bytes}"
        )));
    }
    Ok(TensorInfo {
        name,
        dtype,
        dtype_size,
        shape,
        element_count,
        start,
        end,
    })
}

/// Proves tensor data slices cover the safetensors data buffer once, in order, with no holes.
fn validate_tensor_ranges(tensors: &[TensorInfo], data_bytes: u64) -> io::Result<()> {
    let mut ranges = tensors.to_vec();
    ranges.sort_by_key(|tensor| (tensor.start, tensor.end, tensor.name.clone()));
    let mut cursor = 0u64;
    for tensor in ranges {
        if tensor.start != cursor {
            return Err(invalid(&format!(
                "safetensors tensor {} data range is not contiguous",
                tensor.name
            )));
        }
        cursor = tensor.end;
    }
    if cursor != data_bytes {
        return Err(invalid(
            "safetensors tensor ranges do not cover the data buffer",
        ));
    }
    Ok(())
}

/// Aggregates dtype counts so converter planning can compare byte pressure by source dtype.
fn dtype_stats(tensors: &[TensorInfo]) -> io::Result<BTreeMap<String, DtypeStats>> {
    let mut stats = BTreeMap::new();
    for tensor in tensors {
        let data_bytes = tensor
            .end
            .checked_sub(tensor.start)
            .ok_or_else(|| invalid("safetensors tensor offset underflow"))?;
        let entry = stats
            .entry(tensor.dtype.clone())
            .or_insert_with(DtypeStats::default);
        entry.tensor_count += 1;
        entry.parameter_count = entry
            .parameter_count
            .checked_add(tensor.element_count)
            .ok_or_else(|| invalid("safetensors dtype parameter count overflow"))?;
        entry.data_bytes = entry
            .data_bytes
            .checked_add(data_bytes)
            .ok_or_else(|| invalid("safetensors dtype byte count overflow"))?;
    }
    Ok(stats)
}

/// Renders the inspection as line-based evidence for later converter planning.
fn render_report(inspection: &SafetensorsInspection) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_safetensors_inspection_version",
        SAFETENSORS_REPORT_VERSION,
    );
    push_line(&mut text, "source_layout", SAFETENSORS_LAYOUT);
    push_line(&mut text, "source_path", &inspection.source_path);
    push_line(
        &mut text,
        "source_file_bytes",
        &inspection.file_bytes.to_string(),
    );
    push_line(
        &mut text,
        "header_bytes",
        &inspection.header_bytes.to_string(),
    );
    push_line(&mut text, "data_bytes", &inspection.data_bytes.to_string());
    push_line(
        &mut text,
        "header_checksum",
        &hex64(inspection.header_checksum),
    );
    push_line(
        &mut text,
        "tensor_directory_checksum",
        &hex64(inspection.tensor_directory_checksum),
    );
    push_line(
        &mut text,
        "tensor_count",
        &inspection.tensors.len().to_string(),
    );
    push_line(
        &mut text,
        "parameter_count",
        &total_parameter_count(inspection).to_string(),
    );
    push_line(&mut text, "data_offsets_status", "contiguous");
    push_line(
        &mut text,
        "dtype_count",
        &inspection.dtype_stats.len().to_string(),
    );
    for (index, (dtype, stats)) in inspection.dtype_stats.iter().enumerate() {
        let prefix = format!("dtype.{index}");
        push_line(&mut text, &format!("{prefix}.name"), dtype);
        push_line(
            &mut text,
            &format!("{prefix}.tensor_count"),
            &stats.tensor_count.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.parameter_count"),
            &stats.parameter_count.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.data_bytes"),
            &stats.data_bytes.to_string(),
        );
    }
    for (index, tensor) in inspection.tensors.iter().enumerate() {
        let prefix = format!("tensor.{index}");
        push_line(&mut text, &format!("{prefix}.name"), &tensor.name);
        push_line(&mut text, &format!("{prefix}.dtype"), &tensor.dtype);
        push_line(
            &mut text,
            &format!("{prefix}.dtype_size"),
            &tensor.dtype_size.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.shape"),
            &shape_text(&tensor.shape),
        );
        push_line(
            &mut text,
            &format!("{prefix}.parameter_count"),
            &tensor.element_count.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.data_start"),
            &tensor.start.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.data_end"),
            &tensor.end.to_string(),
        );
    }
    text
}

/// Builds an ordered extraction plan from safetensors metadata into raw f32 source files.
fn build_source_plan(input: &Path, shape_name: &str) -> io::Result<SourcePlan> {
    let inspection = inspect_file(input)?;
    let expectations = trained_source::source_tensor_expectations(shape_name)?;
    let mut by_name = BTreeMap::new();
    for tensor in &inspection.tensors {
        if by_name.insert(tensor.name.clone(), tensor).is_some() {
            return Err(invalid(
                "safetensors source plan found duplicate tensor names",
            ));
        }
    }

    let mut tensors = Vec::with_capacity(expectations.len());
    let mut raw_source_bytes = 0u64;
    let mut requires_decode = false;
    for expectation in expectations {
        let (source_name, tensor) = take_source_tensor(&mut by_name, &expectation.name)?;
        if tensor.shape != expectation.dims {
            return Err(invalid(&format!(
                "safetensors tensor {} shape was {}, expected {}",
                tensor.name,
                shape_text(&tensor.shape),
                shape_text(&expectation.dims)
            )));
        }
        let conversion_action = source_conversion_action(&tensor.dtype)?;
        requires_decode |= conversion_action != "copy-f32";
        raw_source_bytes = raw_source_bytes
            .checked_add(expectation.f32_bytes)
            .ok_or_else(|| invalid("safetensors source plan raw byte count overflow"))?;
        tensors.push(SourceTensorPlan {
            name: expectation.name,
            source_name,
            dtype: tensor.dtype.clone(),
            shape: tensor.shape.clone(),
            start: tensor.start,
            end: tensor.end,
            raw_source_file: expectation.relative_file,
            raw_source_bytes: expectation.f32_bytes,
            conversion_action,
        });
    }
    if let Some(extra_name) = by_name.keys().next() {
        return Err(invalid(&format!(
            "safetensors source plan found unsupported tensor {extra_name}"
        )));
    }
    Ok(SourcePlan {
        inspection,
        target_model_shape: shape_name.to_string(),
        conversion_status: if requires_decode {
            "decode-required"
        } else {
            "copy-ready"
        },
        raw_source_bytes,
        tensors,
    })
}

/// Removes the matching source tensor, accepting local names and known Llama safetensors aliases.
fn take_source_tensor<'a>(
    by_name: &mut BTreeMap<String, &'a TensorInfo>,
    local_name: &str,
) -> io::Result<(String, &'a TensorInfo)> {
    let aliases = source_tensor_aliases(local_name);
    let mut matches = Vec::new();
    for alias in &aliases {
        if by_name.contains_key(alias) {
            matches.push(alias.clone());
        }
    }
    if matches.len() > 1 {
        return Err(invalid(&format!(
            "safetensors source plan matched multiple source names for {local_name}: {}",
            matches.join(", ")
        )));
    }
    let Some(source_name) = matches.pop() else {
        return Err(invalid(&format!(
            "safetensors source plan missing tensor {local_name} (accepted source names: {})",
            aliases.join(", ")
        )));
    };
    let tensor = by_name
        .remove(&source_name)
        .ok_or_else(|| invalid("safetensors source plan alias lookup drifted"))?;
    Ok((source_name, tensor))
}

/// Returns the local tensor name plus well-known Hugging Face Llama source aliases.
fn source_tensor_aliases(local_name: &str) -> Vec<String> {
    let mut names = vec![local_name.to_string()];
    match local_name {
        "tok_embeddings.weight" => names.push("model.embed_tokens.weight".to_string()),
        "norm.weight" => names.push("model.norm.weight".to_string()),
        "output.weight" => names.push("lm_head.weight".to_string()),
        _ => {
            if let Some((layer, suffix)) = local_layer_suffix(local_name) {
                if let Some(alias_suffix) = llama_layer_alias_suffix(suffix) {
                    names.push(format!("model.layers.{layer}.{alias_suffix}"));
                }
            }
        }
    }
    names
}

/// Splits a local `layers.N.*` source tensor name into its layer index and suffix.
fn local_layer_suffix(local_name: &str) -> Option<(&str, &str)> {
    let rest = local_name.strip_prefix("layers.")?;
    rest.split_once('.')
}

/// Maps local TinyRustLM per-layer tensor suffixes to Hugging Face Llama suffixes.
fn llama_layer_alias_suffix(local_suffix: &str) -> Option<&'static str> {
    match local_suffix {
        "attention_norm.weight" => Some("input_layernorm.weight"),
        "ffn_norm.weight" => Some("post_attention_layernorm.weight"),
        "wq.weight" => Some("self_attn.q_proj.weight"),
        "wk.weight" => Some("self_attn.k_proj.weight"),
        "wv.weight" => Some("self_attn.v_proj.weight"),
        "wo.weight" => Some("self_attn.o_proj.weight"),
        "w1.weight" => Some("mlp.gate_proj.weight"),
        "w2.weight" => Some("mlp.down_proj.weight"),
        "w3.weight" => Some("mlp.up_proj.weight"),
        _ => None,
    }
}

/// Reads planned safetensors data slices and converts each payload to raw f32 bytes.
fn extract_source_payloads(
    input: &Path,
    plan: &SourcePlan,
) -> io::Result<Vec<trained_source::SourceTensorPayload>> {
    let data_start = 8u64
        .checked_add(plan.inspection.header_bytes)
        .ok_or_else(|| invalid("safetensors source extraction data offset overflow"))?;
    let mut file = File::open(input)?;
    let mut payloads = Vec::with_capacity(plan.tensors.len());
    for tensor in &plan.tensors {
        let file_offset = data_start
            .checked_add(tensor.start)
            .ok_or_else(|| invalid("safetensors tensor file offset overflow"))?;
        let raw_len = tensor
            .end
            .checked_sub(tensor.start)
            .ok_or_else(|| invalid("safetensors tensor source offset underflow"))?;
        let raw_len = usize::try_from(raw_len)
            .map_err(|_| invalid("safetensors tensor slice is too large for this host"))?;
        let mut raw = vec![0u8; raw_len];
        file.seek(SeekFrom::Start(file_offset))?;
        file.read_exact(&mut raw)?;
        let bytes = decode_source_tensor_to_f32(&tensor.dtype, &raw)?;
        if bytes.len() as u64 != tensor.raw_source_bytes {
            return Err(invalid(&format!(
                "safetensors tensor {} decoded to {} bytes, expected {}",
                tensor.name,
                bytes.len(),
                tensor.raw_source_bytes
            )));
        }
        payloads.push(trained_source::SourceTensorPayload {
            name: tensor.name.clone(),
            bytes,
        });
    }
    Ok(payloads)
}

/// Converts one supported safetensors dtype payload into raw little-endian f32 bytes.
fn decode_source_tensor_to_f32(dtype: &str, raw: &[u8]) -> io::Result<Vec<u8>> {
    match dtype {
        "F32" => {
            if raw.len() % 4 != 0 {
                return Err(invalid(
                    "F32 safetensors payload length must divide by four",
                ));
            }
            Ok(raw.to_vec())
        }
        "F16" => decode_f16_payload_to_f32(raw),
        "BF16" => decode_bf16_payload_to_f32(raw),
        _ => Err(invalid(&format!(
            "safetensors source extraction only supports F32, F16, or BF16 tensors, not {dtype}"
        ))),
    }
}

/// Decodes little-endian IEEE f16 values into raw little-endian f32 bytes.
fn decode_f16_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if raw.len() % 2 != 0 {
        return Err(invalid("F16 safetensors payload length must divide by two"));
    }
    let mut bytes = Vec::with_capacity(raw.len() * 2);
    for chunk in raw.chunks_exact(2) {
        let bits = u16::from_le_bytes([chunk[0], chunk[1]]);
        bytes.extend_from_slice(&f16_bits_to_f32(bits).to_le_bytes());
    }
    Ok(bytes)
}

/// Decodes little-endian bfloat16 values into raw little-endian f32 bytes.
fn decode_bf16_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if raw.len() % 2 != 0 {
        return Err(invalid(
            "BF16 safetensors payload length must divide by two",
        ));
    }
    let mut bytes = Vec::with_capacity(raw.len() * 2);
    for chunk in raw.chunks_exact(2) {
        let high = u16::from_le_bytes([chunk[0], chunk[1]]);
        bytes.extend_from_slice(&f32::from_bits(u32::from(high) << 16).to_le_bytes());
    }
    Ok(bytes)
}

/// Converts IEEE f16 bit patterns into f32, preserving non-finite values for later validation.
fn f16_bits_to_f32(bits: u16) -> f32 {
    let sign = (u32::from(bits & 0x8000)) << 16;
    let exponent = (bits >> 10) & 0x001f;
    let fraction = bits & 0x03ff;
    let f32_bits = match exponent {
        0 => {
            if fraction == 0 {
                sign
            } else {
                let mut mantissa = fraction;
                let mut exponent_value = -14i32;
                while (mantissa & 0x0400) == 0 {
                    mantissa <<= 1;
                    exponent_value -= 1;
                }
                mantissa &= 0x03ff;
                sign | (((exponent_value + 127) as u32) << 23) | (u32::from(mantissa) << 13)
            }
        }
        0x001f => sign | 0x7f80_0000 | (u32::from(fraction) << 13),
        _ => sign | ((u32::from(exponent) + 112) << 23) | (u32::from(fraction) << 13),
    };
    f32::from_bits(f32_bits)
}

/// Renders the safetensors-to-source plan as durable line-based routing evidence.
fn render_source_plan(plan: &SourcePlan) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_safetensors_source_plan_version",
        SAFETENSORS_SOURCE_PLAN_VERSION,
    );
    push_line(&mut text, "plan_layout", SAFETENSORS_SOURCE_PLAN_LAYOUT);
    push_line(&mut text, "source_layout", SAFETENSORS_LAYOUT);
    push_line(&mut text, "target_source_layout", RAW_SOURCE_LAYOUT);
    push_line(&mut text, "source_path", &plan.inspection.source_path);
    push_line(&mut text, "target_model_shape", &plan.target_model_shape);
    push_line(
        &mut text,
        "safetensors_tensor_count",
        &plan.inspection.tensors.len().to_string(),
    );
    push_line(
        &mut text,
        "matched_tensor_count",
        &plan.tensors.len().to_string(),
    );
    push_line(
        &mut text,
        "safetensors_data_bytes",
        &plan.inspection.data_bytes.to_string(),
    );
    push_line(
        &mut text,
        "raw_source_bytes",
        &plan.raw_source_bytes.to_string(),
    );
    push_line(
        &mut text,
        "tensor_directory_checksum",
        &hex64(plan.inspection.tensor_directory_checksum),
    );
    push_line(
        &mut text,
        "source_plan_mapping_checksum",
        &hex64(source_plan_mapping_checksum(&plan.tensors)),
    );
    push_line(&mut text, "conversion_status", plan.conversion_status);
    push_line(&mut text, "required_next_gate", "extract-raw-f32-tensors");
    for (index, tensor) in plan.tensors.iter().enumerate() {
        let prefix = format!("tensor.{index}");
        push_line(&mut text, &format!("{prefix}.name"), &tensor.name);
        push_line(
            &mut text,
            &format!("{prefix}.safetensors_name"),
            &tensor.source_name,
        );
        push_line(
            &mut text,
            &format!("{prefix}.safetensors_dtype"),
            &tensor.dtype,
        );
        push_line(
            &mut text,
            &format!("{prefix}.safetensors_shape"),
            &shape_text(&tensor.shape),
        );
        push_line(
            &mut text,
            &format!("{prefix}.safetensors_data_start"),
            &tensor.start.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.safetensors_data_end"),
            &tensor.end.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.raw_source_file"),
            &tensor.raw_source_file,
        );
        push_line(
            &mut text,
            &format!("{prefix}.raw_source_bytes"),
            &tensor.raw_source_bytes.to_string(),
        );
        push_line(
            &mut text,
            &format!("{prefix}.conversion_action"),
            tensor.conversion_action,
        );
    }
    text
}

/// Builds a reviewed safetensors candidate handoff from tensor metadata and review inputs.
fn build_candidate_review<'a>(
    input: &Path,
    shape_name: &str,
    output_quantization: &str,
    metadata: CandidateReviewMetadata<'a>,
) -> io::Result<CandidateReview<'a>> {
    validate_candidate_review_metadata(&metadata)?;
    trained_source::validate_output_quantization(output_quantization)?;
    let plan = build_source_plan(input, shape_name)?;
    let contract = trained_source::source_shape_contract(shape_name)?;
    let source_config_artifact = review_artifact_evidence(
        input,
        metadata.source_config_route,
        metadata.source_config_checksum,
        ReviewArtifactRole::Config,
        &contract,
    )?;
    let source_tokenizer_artifact = review_artifact_evidence(
        input,
        metadata.source_tokenizer_route,
        metadata.source_tokenizer_checksum,
        ReviewArtifactRole::Tokenizer,
        &contract,
    )?;
    require_exact_bpe_tokenizer_artifact(
        &contract,
        source_tokenizer_artifact.tokenizer_override.as_ref(),
    )?;
    let quantization_budgets = quantization_budget_reviews(
        &contract,
        source_tokenizer_artifact.tokenizer_override.as_ref(),
    )?;
    let target_budget = quantization_budgets
        .iter()
        .find(|budget| budget.quantization == output_quantization)
        .ok_or_else(|| invalid("safetensors candidate review target quantization missing"))?;
    let (browser_admission_preferred_quantization, browser_admission_preference_reason) =
        browser_admission_preference(output_quantization, &quantization_budgets)?;
    let browser_admission_fallback_quantization =
        browser_admission_fallback_quantization(&quantization_budgets);
    let tensors =
        tensors_for_contract_and_dtype(&contract, review_dtype_for_output(output_quantization)?);
    let parameter_count = tensors.iter().try_fold(0u64, |acc, tensor| {
        acc.checked_add(tensor.element_count() as u64)
            .ok_or_else(|| invalid("safetensors candidate review parameter count overflow"))
    })?;
    let estimated_slm_bytes = target_budget.estimated_slm_bytes;
    let selector_budget_status = target_budget.selector_budget_status;
    let kv_cache_byte_budget = kv_cache_byte_budget_for_shape(&contract.shape)?;
    let converter_gap_status = if selector_budget_status == "exceeds" {
        "selector-budget-exceeded"
    } else if metadata.reference_output_checksum.is_some() {
        "ready-for-reviewed-extraction"
    } else {
        "reference-output-pending"
    };
    Ok(CandidateReview {
        plan,
        metadata,
        source_config_artifact,
        source_tokenizer_artifact,
        output_quantization: output_quantization.to_string(),
        quantization_budgets,
        browser_admission_preferred_quantization,
        browser_admission_preference_reason,
        browser_admission_fallback_quantization,
        architecture_family: "tinyrustlm-llama-style-v1",
        tensor_layout_strategy: "local-or-huggingface-llama-aliases-v1",
        tokenizer_strategy: contract.tokenizer_strategy,
        parameter_count,
        estimated_slm_bytes,
        selector_budget_status,
        context_token_limit: u64::from(contract.shape.max_context),
        kv_cache_byte_budget,
        kv_cache_page_count: page_count_for_bytes(kv_cache_byte_budget),
        converter_gap_status,
    })
}

/// Builds checksum-bound evidence for a local review artifact when its route is file-backed.
fn review_artifact_evidence(
    input: &Path,
    route: Option<&str>,
    expected_checksum: &str,
    role: ReviewArtifactRole,
    contract: &trained_source::SourceShapeContract,
) -> io::Result<ReviewArtifactEvidence> {
    let Some(route) = route else {
        return Ok(ReviewArtifactEvidence {
            status: "pending-route",
            kind: "not-local-artifact",
            checksum: None,
            byte_count: None,
            detail: None,
            tokenizer_override: None,
        });
    };
    let Some(path) = local_review_artifact_path(input, route) else {
        return Ok(ReviewArtifactEvidence {
            status: "route-only",
            kind: "not-local-artifact",
            checksum: None,
            byte_count: None,
            detail: None,
            tokenizer_override: None,
        });
    };
    validated_local_review_artifact(&path, expected_checksum, role, contract)
}

/// Revalidates a review artifact that a candidate review recorded as local JSON evidence.
fn validate_review_artifact_for_fields(
    fields: &HashMap<String, String>,
    input: &Path,
    role: ReviewArtifactRole,
    contract: &trained_source::SourceShapeContract,
) -> io::Result<Option<trained_source::SourceTokenizerOverride>> {
    let prefix = role.artifact_prefix();
    let status = require_review_key(fields, &format!("{prefix}_artifact_status"))?;
    if status != "local-json-validated" {
        return Ok(None);
    }
    let route = require_review_key(fields, role.route_field())?;
    let expected_checksum = require_review_key(fields, role.checksum_field())?;
    let expected_artifact_checksum =
        require_review_key(fields, &format!("{prefix}_artifact_checksum"))?;
    let expected_artifact_bytes = require_review_key(fields, &format!("{prefix}_artifact_bytes"))?;
    let expected_artifact_detail =
        require_review_key(fields, &format!("{prefix}_artifact_detail"))?;
    let Some(path) = local_review_artifact_path(input, route) else {
        return Err(invalid(&format!(
            "safetensors candidate review {prefix}_artifact_status was local-json-validated but route could not be opened"
        )));
    };
    let evidence = validated_local_review_artifact(&path, expected_checksum, role, contract)?;
    require_review_equal(
        fields,
        &format!("{prefix}_artifact_checksum"),
        evidence.checksum.as_deref().unwrap_or("not-local"),
    )?;
    require_review_equal(
        fields,
        &format!("{prefix}_artifact_bytes"),
        &evidence.byte_count.unwrap_or(0).to_string(),
    )?;
    require_review_equal(fields, &format!("{prefix}_artifact_kind"), evidence.kind)?;
    require_review_equal(
        fields,
        &format!("{prefix}_artifact_detail"),
        evidence.detail.as_deref().unwrap_or("not-local"),
    )?;
    if expected_artifact_checksum != evidence.checksum.as_deref().unwrap_or("not-local") {
        return Err(invalid(&format!(
            "safetensors candidate review {prefix}_artifact_checksum drifted"
        )));
    }
    if expected_artifact_bytes != evidence.byte_count.unwrap_or(0).to_string() {
        return Err(invalid(&format!(
            "safetensors candidate review {prefix}_artifact_bytes drifted"
        )));
    }
    if expected_artifact_detail != evidence.detail.as_deref().unwrap_or("not-local") {
        return Err(invalid(&format!(
            "safetensors candidate review {prefix}_artifact_detail drifted"
        )));
    }
    Ok(evidence.tokenizer_override)
}

/// Opens, parses, and checksum-checks a local config or tokenizer review artifact.
fn validated_local_review_artifact(
    path: &Path,
    expected_checksum: &str,
    role: ReviewArtifactRole,
    contract: &trained_source::SourceShapeContract,
) -> io::Result<ReviewArtifactEvidence> {
    let bytes = fs::read(path)?;
    let actual_checksum = hex64(provenance::text_checksum(&bytes));
    if actual_checksum != expected_checksum {
        return Err(invalid(&format!(
            "safetensors candidate review {} did not match local {} checksum {actual_checksum}",
            role.checksum_field(),
            role.route_field()
        )));
    }
    let text = std::str::from_utf8(&bytes).map_err(|_| {
        invalid(&format!(
            "safetensors candidate review {} must be UTF-8 JSON",
            role.route_field()
        ))
    })?;
    let root = parse_json_object(text).map_err(|error| {
        invalid(&format!(
            "safetensors candidate review {} JSON invalid: {error}",
            role.route_field()
        ))
    })?;
    let (kind, detail, tokenizer_override) = match role {
        ReviewArtifactRole::Config => {
            let (kind, detail) = validate_config_artifact(&root, contract)?;
            (kind, detail, None)
        }
        ReviewArtifactRole::Tokenizer => validate_tokenizer_artifact(&root, contract)?,
    };
    Ok(ReviewArtifactEvidence {
        status: "local-json-validated",
        kind,
        checksum: Some(actual_checksum),
        byte_count: Some(bytes.len() as u64),
        detail: Some(detail),
        tokenizer_override,
    })
}

/// Resolves a review route to a local file when it is absolute, cwd-relative, or input-relative.
fn local_review_artifact_path(input: &Path, route: &str) -> Option<PathBuf> {
    if route.contains("://") {
        return None;
    }
    let route_path = Path::new(route);
    if route_path.is_absolute() {
        return route_path.is_file().then(|| route_path.to_path_buf());
    }
    if route_path.is_file() {
        return Some(route_path.to_path_buf());
    }
    input.parent().and_then(|parent| {
        let candidate = parent.join(route_path);
        candidate.is_file().then_some(candidate)
    })
}

/// Checks a local source config JSON for model-shape fields that agree with the target contract.
fn validate_config_artifact(
    object: &[(String, JsonValue)],
    contract: &trained_source::SourceShapeContract,
) -> io::Result<(&'static str, String)> {
    require_any_object_field(
        object,
        &[
            "model_type",
            "architectures",
            "vocab_size",
            "hidden_size",
            "num_hidden_layers",
        ],
        "source_config_route",
    )?;
    require_optional_number_match(
        object,
        &["vocab_size"],
        u64::from(contract.shape.vocab_size),
        "source_config_route vocab_size",
    )?;
    require_optional_number_match(
        object,
        &["hidden_size", "n_embd", "d_model"],
        u64::from(contract.shape.hidden_size),
        "source_config_route hidden_size",
    )?;
    require_optional_number_match(
        object,
        &["num_hidden_layers", "n_layer", "num_layers"],
        u64::from(contract.shape.layer_count),
        "source_config_route layer_count",
    )?;
    require_optional_number_match(
        object,
        &["num_attention_heads", "n_head", "num_heads"],
        u64::from(contract.shape.head_count),
        "source_config_route head_count",
    )?;
    require_optional_number_match(
        object,
        &["num_key_value_heads"],
        u64::from(contract.shape.kv_head_count),
        "source_config_route kv_head_count",
    )?;
    require_optional_number_match(
        object,
        &["intermediate_size", "ffn_dim", "n_inner"],
        u64::from(contract.shape.ffn_size),
        "source_config_route ffn_size",
    )?;
    require_optional_number_match(
        object,
        &["max_position_embeddings", "n_positions", "block_size"],
        u64::from(contract.shape.max_context),
        "source_config_route max_context",
    )?;
    let kind = match optional_string_field(object, "model_type") {
        Some("llama") | Some("mistral") => "llama-config-json",
        Some("gpt_neox") | Some("gpt-neox") => "gpt-neox-config-json",
        Some(_) => "model-config-json",
        None => "model-config-json",
    };
    Ok((kind, config_artifact_detail(object)?))
}

/// Checks a local tokenizer JSON for a recognized tokenizer model and BPE evidence when required.
fn validate_tokenizer_artifact(
    object: &[(String, JsonValue)],
    contract: &trained_source::SourceShapeContract,
) -> io::Result<(
    &'static str,
    String,
    Option<trained_source::SourceTokenizerOverride>,
)> {
    let model = optional_object_field(object, "model").ok_or_else(|| {
        invalid("safetensors candidate review source_tokenizer_route must contain model")
    })?;
    let model_type = optional_string_field(model, "type").ok_or_else(|| {
        invalid("safetensors candidate review source_tokenizer_route model.type must be a string")
    })?;
    let model_type_lower = model_type.to_ascii_lowercase();
    let is_bpe = model_type_lower.contains("bpe");
    if contract.tokenizer_strategy == "manifest-bpe-v1" && !is_bpe {
        return Err(invalid(
            "safetensors candidate review BPE tokenizer route requires tokenizer JSON model.type=BPE",
        ));
    }
    if is_bpe {
        let vocab = require_object_field(model, "vocab", "source_tokenizer_route model.vocab")?;
        let merges = require_array_field(model, "merges", "source_tokenizer_route model.merges")?;
        let (vocab_entries, max_token_id) = tokenizer_vocab_stats(vocab)?;
        let tokenizer_override = if contract.tokenizer_strategy == "manifest-bpe-v1" {
            Some(bpe_tokenizer_override_from_json(
                vocab,
                merges,
                contract.shape.vocab_size,
            )?)
        } else {
            None
        };
        return Ok((
            "bpe-tokenizer-json",
            tokenizer_artifact_detail(
                model_type,
                Some(vocab_entries),
                max_token_id,
                Some(merges.len()),
            ),
            tokenizer_override,
        ));
    }
    let detail = tokenizer_artifact_detail(model_type, None, None, None);
    if model_type_lower.contains("unigram") {
        return Ok(("unigram-tokenizer-json", detail, None));
    }
    if model_type_lower.contains("wordpiece") {
        return Ok(("wordpiece-tokenizer-json", detail, None));
    }
    Ok(("tokenizer-json", detail, None))
}

/// Converts project-compatible BPE tokenizer JSON into source-manifest rows.
fn bpe_tokenizer_override_from_json(
    vocab: &[(String, JsonValue)],
    merges: &[JsonValue],
    vocab_size: u32,
) -> io::Result<trained_source::SourceTokenizerOverride> {
    if merges.is_empty() {
        return Err(invalid(
            "safetensors candidate review BPE tokenizer route requires at least one merge",
        ));
    }
    let mut vocab_ids = HashMap::with_capacity(vocab.len());
    let mut seen_ids = Vec::with_capacity(vocab.len());
    let mut tokens = Vec::new();
    for (token, value) in vocab {
        let token_id = tokenizer_vocab_id(value)?;
        if token_id >= vocab_size {
            return Err(invalid(
                "safetensors candidate review BPE tokenizer id exceeds target vocab_size",
            ));
        }
        if (256..260).contains(&token_id) {
            return Err(invalid(
                "safetensors candidate review BPE tokenizer must leave TinyRustLM special ids reserved",
            ));
        }
        if seen_ids.contains(&token_id) {
            return Err(invalid(
                "safetensors candidate review BPE tokenizer vocab ids must be unique",
            ));
        }
        if vocab_ids.insert(token.clone(), token_id).is_some() {
            return Err(invalid(
                "safetensors candidate review BPE tokenizer vocab tokens must be unique",
            ));
        }
        seen_ids.push(token_id);
        if token_id >= 260 {
            let bytes = token.as_bytes().to_vec();
            if bytes.is_empty() {
                return Err(invalid(
                    "safetensors candidate review BPE tokenizer custom token must not be empty",
                ));
            }
            tokens.push(BpeTokenSpec {
                id: token_id,
                bytes,
            });
        }
    }

    let mut merge_specs = Vec::with_capacity(merges.len());
    for (rank, merge) in merges.iter().enumerate() {
        let (left_text, right_text) = bpe_merge_pair(merge)?;
        let left = bpe_vocab_id_for_token(&vocab_ids, &left_text)?;
        let right = bpe_vocab_id_for_token(&vocab_ids, &right_text)?;
        validate_bpe_fallback_token(&left_text, left)?;
        validate_bpe_fallback_token(&right_text, right)?;
        let output_text = format!("{left_text}{right_text}");
        let output = bpe_vocab_id_for_token(&vocab_ids, &output_text)?;
        if output < 260 {
            return Err(invalid(
                "safetensors candidate review BPE tokenizer merge output must be a custom token id",
            ));
        }
        let rank = u32::try_from(rank).map_err(|_| {
            invalid("safetensors candidate review BPE tokenizer merge rank overflow")
        })?;
        merge_specs.push(BpeMergeSpec {
            left,
            right,
            output,
            rank,
        });
    }
    tokens.sort_by_key(|token| token.id);
    if tokens.is_empty() {
        return Err(invalid(
            "safetensors candidate review BPE tokenizer requires at least one custom token",
        ));
    }
    Ok(trained_source::SourceTokenizerOverride {
        tokens,
        merges: merge_specs,
    })
}

/// Parses one tokenizer JSON merge entry into left and right token strings.
fn bpe_merge_pair(merge: &JsonValue) -> io::Result<(String, String)> {
    match merge {
        JsonValue::String(value) => {
            let parts = value.split_whitespace().collect::<Vec<_>>();
            if parts.len() != 2 {
                return Err(invalid(
                    "safetensors candidate review BPE tokenizer merge must contain two tokens",
                ));
            }
            Ok((parts[0].to_string(), parts[1].to_string()))
        }
        JsonValue::Array(items) if items.len() == 2 => {
            let JsonValue::String(left) = &items[0] else {
                return Err(invalid(
                    "safetensors candidate review BPE tokenizer merge array must contain strings",
                ));
            };
            let JsonValue::String(right) = &items[1] else {
                return Err(invalid(
                    "safetensors candidate review BPE tokenizer merge array must contain strings",
                ));
            };
            Ok((left.clone(), right.clone()))
        }
        _ => Err(invalid(
            "safetensors candidate review BPE tokenizer merges must be strings or string pairs",
        )),
    }
}

/// Extracts one unsigned tokenizer id from a vocab JSON value.
fn tokenizer_vocab_id(value: &JsonValue) -> io::Result<u32> {
    let JsonValue::Number(text) = value else {
        return Err(invalid(
            "safetensors candidate review source_tokenizer_route model.vocab ids must be numbers",
        ));
    };
    text.parse::<u32>().map_err(|_| {
        invalid(
            "safetensors candidate review source_tokenizer_route model.vocab ids must be unsigned integers",
        )
    })
}

/// Looks up a BPE merge token in the tokenizer vocab.
fn bpe_vocab_id_for_token(vocab_ids: &HashMap<String, u32>, token: &str) -> io::Result<u32> {
    vocab_ids.get(token).copied().ok_or_else(|| {
        invalid("safetensors candidate review BPE tokenizer merge token is missing from vocab")
    })
}

/// Verifies byte-fallback merge inputs use TinyRustLM's raw byte ids.
fn validate_bpe_fallback_token(token: &str, token_id: u32) -> io::Result<()> {
    if token_id >= 260 {
        return Ok(());
    }
    let bytes = token.as_bytes();
    if token_id < 256 && bytes.len() == 1 && bytes[0] == token_id as u8 {
        return Ok(());
    }
    Err(invalid(
        "safetensors candidate review BPE tokenizer merge uses a non-byte-fallback token id",
    ))
}

/// Summarizes local source config fields into a stable review detail row.
fn config_artifact_detail(object: &[(String, JsonValue)]) -> io::Result<String> {
    let pairs = vec![
        (
            "model_type",
            optional_string_field(object, "model_type")
                .map(artifact_detail_atom)
                .unwrap_or_else(|| "missing".to_string()),
        ),
        (
            "vocab_size",
            artifact_detail_u64(optional_u64_field_for_keys(object, &["vocab_size"])?),
        ),
        (
            "hidden_size",
            artifact_detail_u64(optional_u64_field_for_keys(
                object,
                &["hidden_size", "n_embd", "d_model"],
            )?),
        ),
        (
            "layer_count",
            artifact_detail_u64(optional_u64_field_for_keys(
                object,
                &["num_hidden_layers", "n_layer", "num_layers"],
            )?),
        ),
        (
            "attention_heads",
            artifact_detail_u64(optional_u64_field_for_keys(
                object,
                &["num_attention_heads", "n_head", "num_heads"],
            )?),
        ),
        (
            "kv_heads",
            artifact_detail_u64(optional_u64_field_for_keys(
                object,
                &["num_key_value_heads"],
            )?),
        ),
        (
            "ffn_size",
            artifact_detail_u64(optional_u64_field_for_keys(
                object,
                &["intermediate_size", "ffn_dim", "n_inner"],
            )?),
        ),
        (
            "max_context",
            artifact_detail_u64(optional_u64_field_for_keys(
                object,
                &["max_position_embeddings", "n_positions", "block_size"],
            )?),
        ),
    ];
    Ok(join_artifact_detail_pairs(&pairs))
}

/// Counts tokenizer vocab ids and records the largest id present.
fn tokenizer_vocab_stats(vocab: &[(String, JsonValue)]) -> io::Result<(usize, Option<u64>)> {
    if vocab.is_empty() {
        return Err(invalid(
            "safetensors candidate review source_tokenizer_route model.vocab must not be empty",
        ));
    }
    let mut max_token_id: Option<u64> = None;
    for (_, value) in vocab {
        let JsonValue::Number(text) = value else {
            return Err(invalid(
                "safetensors candidate review source_tokenizer_route model.vocab ids must be numbers",
            ));
        };
        let token_id = text.parse::<u64>().map_err(|_| {
            invalid(
                "safetensors candidate review source_tokenizer_route model.vocab ids must be unsigned integers",
            )
        })?;
        max_token_id = Some(max_token_id.map_or(token_id, |current| current.max(token_id)));
    }
    Ok((vocab.len(), max_token_id))
}

/// Summarizes tokenizer JSON fields into a stable review detail row.
fn tokenizer_artifact_detail(
    model_type: &str,
    vocab_entries: Option<usize>,
    max_token_id: Option<u64>,
    merge_count: Option<usize>,
) -> String {
    let pairs = vec![
        ("model_type", artifact_detail_atom(model_type)),
        (
            "vocab_entries",
            artifact_detail_usize(vocab_entries, "not-bpe"),
        ),
        (
            "max_token_id",
            max_token_id
                .map(|value| value.to_string())
                .unwrap_or_else(|| "not-bpe".to_string()),
        ),
        ("merge_count", artifact_detail_usize(merge_count, "not-bpe")),
    ];
    join_artifact_detail_pairs(&pairs)
}

/// Extracts the first present unsigned integer from a list of alias keys.
fn optional_u64_field_for_keys(
    object: &[(String, JsonValue)],
    keys: &[&str],
) -> io::Result<Option<u64>> {
    for key in keys {
        if let Some(value) = optional_u64_field(object, key)? {
            return Ok(Some(value));
        }
    }
    Ok(None)
}

/// Formats an optional integer for the artifact detail row.
fn artifact_detail_u64(value: Option<u64>) -> String {
    value
        .map(|value| value.to_string())
        .unwrap_or_else(|| "missing".to_string())
}

/// Formats an optional count for the artifact detail row.
fn artifact_detail_usize(value: Option<usize>, missing: &str) -> String {
    value
        .map(|value| value.to_string())
        .unwrap_or_else(|| missing.to_string())
}

/// Normalizes JSON strings so detail rows remain one-line manifest atoms.
fn artifact_detail_atom(value: &str) -> String {
    let mut atom = String::with_capacity(value.len().max(1));
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.' | '/') {
            atom.push(ch);
        } else {
            atom.push('_');
        }
    }
    if atom.is_empty() {
        "empty".to_string()
    } else {
        atom
    }
}

/// Joins review detail key/value pairs without introducing new manifest keys.
fn join_artifact_detail_pairs(pairs: &[(&str, String)]) -> String {
    pairs
        .iter()
        .map(|(key, value)| format!("{key}:{value}"))
        .collect::<Vec<_>>()
        .join(";")
}

/// Builds comparable selector-budget rows for each browser-admissible quantization.
fn quantization_budget_reviews(
    contract: &trained_source::SourceShapeContract,
    tokenizer_override: Option<&trained_source::SourceTokenizerOverride>,
) -> io::Result<Vec<QuantizationBudgetReview>> {
    let tokenizer = tokenizer_for_review(contract, tokenizer_override)?;
    let mut reviews = Vec::with_capacity(3);
    for (quantization, dtype) in [
        ("f32", DTYPE_F32),
        ("q8_0", DTYPE_Q8_0),
        ("q4_0", DTYPE_Q4_0),
    ] {
        let tensors = tensors_for_contract_and_dtype(contract, dtype);
        let estimated_slm_bytes = estimate_slm_byte_count(&tensors, &tokenizer)?;
        reviews.push(QuantizationBudgetReview {
            quantization,
            estimated_slm_bytes,
            selector_budget_status: selector_budget_status(estimated_slm_bytes),
        });
    }
    Ok(reviews)
}

/// Selects tensor specs for a source contract and output dtype.
fn tensors_for_contract_and_dtype(
    contract: &trained_source::SourceShapeContract,
    dtype: u32,
) -> Vec<crate::tensor_writer::TensorSpec> {
    if contract.tied_output {
        tensors_for_shape_with_tied_output(&contract.shape, dtype)
    } else {
        tensors_for_shape(&contract.shape, dtype)
    }
}

/// Classifies whether a serialized `.slm` estimate fits the browser selector budget.
fn selector_budget_status(estimated_slm_bytes: u64) -> &'static str {
    if estimated_slm_bytes <= SELECTOR_MODEL_BYTE_BUDGET {
        "fits"
    } else {
        "exceeds"
    }
}

/// Picks the reviewed target when it fits, otherwise the frugal browser fallback.
fn browser_admission_preference(
    output_quantization: &str,
    budgets: &[QuantizationBudgetReview],
) -> io::Result<(&'static str, &'static str)> {
    let target = budget_review_for_quantization(budgets, output_quantization)?;
    if target.selector_budget_status == "fits" {
        return Ok((target.quantization, "target-fits-selector-budget"));
    }
    let fallback = browser_admission_fallback_quantization(budgets);
    if fallback == "none" {
        Ok(("none", "no-browser-fit-quantization"))
    } else {
        Ok((fallback, "target-exceeds-selector-budget-frugal-fit"))
    }
}

/// Finds the first fitting quantization in the browser's frugal selector order.
fn browser_admission_fallback_quantization(budgets: &[QuantizationBudgetReview]) -> &'static str {
    for quantization in ["q4_0", "q8_0", "f32"] {
        if let Some(budget) = budgets
            .iter()
            .find(|entry| entry.quantization == quantization)
        {
            if budget.selector_budget_status == "fits" {
                return budget.quantization;
            }
        }
    }
    "none"
}

/// Looks up a computed budget review by quantization label.
fn budget_review_for_quantization<'a>(
    budgets: &'a [QuantizationBudgetReview],
    quantization: &str,
) -> io::Result<&'a QuantizationBudgetReview> {
    budgets
        .iter()
        .find(|entry| entry.quantization == quantization)
        .ok_or_else(|| invalid("safetensors candidate review quantization budget missing"))
}

/// Validates that a candidate review still matches the safetensors plan being extracted.
fn validate_candidate_review_path_for_plan(
    review_path: &Path,
    plan: &SourcePlan,
    output_quantization: Option<&str>,
    enforce_browser_preference: bool,
) -> io::Result<ValidatedCandidateReviewGate> {
    let text = fs::read_to_string(review_path)?;
    let fields = provenance::parse_manifest(&text)?;
    require_review_equal(
        &fields,
        "tinyrustlm_safetensors_candidate_review_version",
        SAFETENSORS_CANDIDATE_REVIEW_VERSION,
    )?;
    require_review_equal(
        &fields,
        "review_layout",
        SAFETENSORS_CANDIDATE_REVIEW_LAYOUT,
    )?;
    require_review_equal(&fields, "source_layout", SAFETENSORS_LAYOUT)?;
    require_review_equal(&fields, "target_source_layout", RAW_SOURCE_LAYOUT)?;
    require_review_equal(&fields, "source_path", &plan.inspection.source_path)?;
    require_review_equal(&fields, "target_model_shape", &plan.target_model_shape)?;
    require_review_equal(
        &fields,
        "source_file_bytes",
        &plan.inspection.file_bytes.to_string(),
    )?;
    require_review_equal(
        &fields,
        "header_checksum",
        &hex64(plan.inspection.header_checksum),
    )?;
    require_review_equal(
        &fields,
        "tensor_directory_checksum",
        &hex64(plan.inspection.tensor_directory_checksum),
    )?;
    require_review_equal(
        &fields,
        "source_plan_mapping_checksum",
        &hex64(source_plan_mapping_checksum(&plan.tensors)),
    )?;
    require_review_equal(
        &fields,
        "matched_tensor_count",
        &plan.tensors.len().to_string(),
    )?;
    require_review_equal(
        &fields,
        "raw_source_bytes",
        &plan.raw_source_bytes.to_string(),
    )?;
    require_review_equal(&fields, "conversion_status", plan.conversion_status)?;
    require_review_equal(&fields, "required_next_gate", "extract-raw-f32-tensors")?;
    let contract = trained_source::source_shape_contract(&plan.target_model_shape)?;
    let gate = require_reviewed_source_routes(
        &fields,
        Path::new(&plan.inspection.source_path),
        &contract,
    )?;
    validate_review_budget_fields(
        &fields,
        &plan.target_model_shape,
        gate.source_tokenizer_override.as_ref(),
    )?;
    if let Some(output_quantization) = output_quantization {
        validate_review_output_quantization(
            &fields,
            output_quantization,
            enforce_browser_preference,
        )?;
    }
    Ok(gate)
}

/// Requires the source and eval routes that make an extraction review actionable.
fn require_reviewed_source_routes(
    fields: &HashMap<String, String>,
    input: &Path,
    contract: &trained_source::SourceShapeContract,
) -> io::Result<ValidatedCandidateReviewGate> {
    for key in [
        "source_model_id",
        "source_model_sha",
        "source_config_checksum",
        "source_tokenizer_checksum",
        "source_license_route",
    ] {
        require_review_key(fields, key)?;
    }
    require_review_not_value(fields, "source_config_route", "checksum-only-source-config")?;
    require_review_not_value(
        fields,
        "source_tokenizer_route",
        "checksum-only-source-tokenizer",
    )?;
    validate_review_artifact_for_fields(fields, input, ReviewArtifactRole::Config, contract)?;
    let source_tokenizer_override = validate_review_artifact_for_fields(
        fields,
        input,
        ReviewArtifactRole::Tokenizer,
        contract,
    )?;
    require_exact_bpe_tokenizer_artifact(contract, source_tokenizer_override.as_ref())?;
    require_review_not_value(fields, "reference_prompt_route", "pending-reference-prompt")?;
    require_review_not_value(
        fields,
        "reference_output_checksum",
        "pending-reference-output",
    )?;
    require_review_not_value(fields, "eval_cases_route", "pending-eval-cases")?;
    Ok(ValidatedCandidateReviewGate {
        source_tokenizer_override,
    })
}

/// Requires BPE reviews to carry importable tokenizer rows before exact byte claims are made.
fn require_exact_bpe_tokenizer_artifact(
    contract: &trained_source::SourceShapeContract,
    tokenizer_override: Option<&trained_source::SourceTokenizerOverride>,
) -> io::Result<()> {
    if contract.tokenizer_strategy == "manifest-bpe-v1" && tokenizer_override.is_none() {
        return Err(invalid(
            "safetensors candidate review manifest-bpe-v1 requires a local compatible BPE tokenizer artifact for exact byte estimates",
        ));
    }
    Ok(())
}

/// Recomputes the comparative f32/q8/q4 byte and selector-fit rows from the source shape.
fn validate_review_budget_fields(
    fields: &HashMap<String, String>,
    shape_name: &str,
    tokenizer_override: Option<&trained_source::SourceTokenizerOverride>,
) -> io::Result<()> {
    let contract = trained_source::source_shape_contract(shape_name)?;
    let budgets = quantization_budget_reviews(&contract, tokenizer_override)?;
    require_review_equal(
        fields,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    )?;
    require_review_equal(
        fields,
        "browser_admission_default_strategy",
        SELECTOR_DEFAULT_STRATEGY,
    )?;
    let fallback = browser_admission_fallback_quantization(&budgets);
    require_review_equal(fields, "browser_admission_fallback_quantization", fallback)?;
    for budget in &budgets {
        require_review_equal(
            fields,
            &format!("{}_estimated_slm_bytes", budget.quantization),
            &budget.estimated_slm_bytes.to_string(),
        )?;
        require_review_equal(
            fields,
            &format!("{}_selector_budget_status", budget.quantization),
            budget.selector_budget_status,
        )?;
    }
    let target = require_review_key(fields, "quantization_target")?;
    let (preferred, reason) = browser_admission_preference(target, &budgets)?;
    require_review_equal(
        fields,
        "browser_admission_preferred_quantization",
        preferred,
    )?;
    require_review_equal(fields, "browser_admission_preference_reason", reason)?;
    Ok(())
}

/// Checks that downstream conversion or browser admission follows the reviewed quantization route.
fn validate_review_output_quantization(
    fields: &HashMap<String, String>,
    output_quantization: &str,
    enforce_browser_preference: bool,
) -> io::Result<()> {
    if output_quantization == "all" {
        let preferred = require_review_key(fields, "browser_admission_preferred_quantization")?;
        if preferred == "none" {
            return Err(invalid(
                "safetensors candidate review has no browser-fit quantization for all bundle",
            ));
        }
        return Ok(());
    }
    let target = require_review_key(fields, "quantization_target")?;
    let preferred = require_review_key(fields, "browser_admission_preferred_quantization")?;
    if enforce_browser_preference {
        if output_quantization != preferred {
            return Err(invalid(&format!(
                "browser bundle quantization {output_quantization} must match candidate review browser_admission_preferred_quantization {preferred} or use all"
            )));
        }
        return Ok(());
    }
    if output_quantization != target {
        return Err(invalid(&format!(
            "converted output quantization {output_quantization} must match candidate review quantization_target {target}"
        )));
    }
    Ok(())
}

/// Reads a required candidate-review field.
fn require_review_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields.get(key).map(String::as_str).ok_or_else(|| {
        invalid(&format!(
            "safetensors candidate review missing required key {key}"
        ))
    })
}

/// Requires one candidate-review field to match recomputed evidence.
fn require_review_equal(
    fields: &HashMap<String, String>,
    key: &str,
    expected: &str,
) -> io::Result<()> {
    let actual = require_review_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "safetensors candidate review key {key} was {actual}, expected {expected}"
        )));
    }
    Ok(())
}

/// Requires a candidate-review field to be present and not a pending placeholder.
fn require_review_not_value(
    fields: &HashMap<String, String>,
    key: &str,
    disallowed: &str,
) -> io::Result<()> {
    let actual = require_review_key(fields, key)?;
    if actual == disallowed {
        return Err(invalid(&format!(
            "safetensors candidate review key {key} must be reviewed before extraction"
        )));
    }
    Ok(())
}

/// Renders the candidate review as line-based evidence for real-checkpoint handoff.
fn render_candidate_review(review: &CandidateReview<'_>) -> String {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_safetensors_candidate_review_version",
        SAFETENSORS_CANDIDATE_REVIEW_VERSION,
    );
    push_line(
        &mut text,
        "review_layout",
        SAFETENSORS_CANDIDATE_REVIEW_LAYOUT,
    );
    push_line(&mut text, "source_layout", SAFETENSORS_LAYOUT);
    push_line(&mut text, "target_source_layout", RAW_SOURCE_LAYOUT);
    push_line(
        &mut text,
        "source_path",
        &review.plan.inspection.source_path,
    );
    push_line(
        &mut text,
        "source_model_id",
        review.metadata.source_model_id,
    );
    push_line(
        &mut text,
        "source_model_sha",
        review.metadata.source_model_sha,
    );
    push_line(
        &mut text,
        "source_config_checksum",
        review.metadata.source_config_checksum,
    );
    push_line(
        &mut text,
        "source_config_route",
        review
            .metadata
            .source_config_route
            .unwrap_or("checksum-only-source-config"),
    );
    push_review_artifact_lines(&mut text, "source_config", &review.source_config_artifact);
    push_line(
        &mut text,
        "source_tokenizer_checksum",
        review.metadata.source_tokenizer_checksum,
    );
    push_line(
        &mut text,
        "source_tokenizer_route",
        review
            .metadata
            .source_tokenizer_route
            .unwrap_or("checksum-only-source-tokenizer"),
    );
    push_review_artifact_lines(
        &mut text,
        "source_tokenizer",
        &review.source_tokenizer_artifact,
    );
    push_line(
        &mut text,
        "source_license_route",
        review.metadata.source_license_route,
    );
    push_line(
        &mut text,
        "source_file_bytes",
        &review.plan.inspection.file_bytes.to_string(),
    );
    push_line(
        &mut text,
        "header_checksum",
        &hex64(review.plan.inspection.header_checksum),
    );
    push_line(
        &mut text,
        "tensor_directory_checksum",
        &hex64(review.plan.inspection.tensor_directory_checksum),
    );
    push_line(
        &mut text,
        "source_plan_mapping_checksum",
        &hex64(source_plan_mapping_checksum(&review.plan.tensors)),
    );
    push_line(
        &mut text,
        "target_model_shape",
        &review.plan.target_model_shape,
    );
    push_line(&mut text, "architecture_family", review.architecture_family);
    push_line(
        &mut text,
        "tensor_layout_strategy",
        review.tensor_layout_strategy,
    );
    push_line(&mut text, "tokenizer_strategy", review.tokenizer_strategy);
    push_line(
        &mut text,
        "quantization_target",
        &review.output_quantization,
    );
    push_line(
        &mut text,
        "parameter_count",
        &review.parameter_count.to_string(),
    );
    push_line(
        &mut text,
        "safetensors_tensor_count",
        &review.plan.inspection.tensors.len().to_string(),
    );
    push_line(
        &mut text,
        "matched_tensor_count",
        &review.plan.tensors.len().to_string(),
    );
    push_line(
        &mut text,
        "raw_source_bytes",
        &review.plan.raw_source_bytes.to_string(),
    );
    push_line(
        &mut text,
        "estimated_slm_bytes",
        &review.estimated_slm_bytes.to_string(),
    );
    push_line(
        &mut text,
        "selector_model_byte_budget",
        &SELECTOR_MODEL_BYTE_BUDGET.to_string(),
    );
    push_line(
        &mut text,
        "selector_budget_status",
        review.selector_budget_status,
    );
    for budget in &review.quantization_budgets {
        push_line(
            &mut text,
            &format!("{}_estimated_slm_bytes", budget.quantization),
            &budget.estimated_slm_bytes.to_string(),
        );
        push_line(
            &mut text,
            &format!("{}_selector_budget_status", budget.quantization),
            budget.selector_budget_status,
        );
    }
    push_line(
        &mut text,
        "browser_admission_default_strategy",
        SELECTOR_DEFAULT_STRATEGY,
    );
    push_line(
        &mut text,
        "browser_admission_preferred_quantization",
        review.browser_admission_preferred_quantization,
    );
    push_line(
        &mut text,
        "browser_admission_preference_reason",
        review.browser_admission_preference_reason,
    );
    push_line(
        &mut text,
        "browser_admission_fallback_quantization",
        review.browser_admission_fallback_quantization,
    );
    push_line(
        &mut text,
        "module_plan_context_token_limit",
        &review.context_token_limit.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_kv_cache_byte_budget",
        &review.kv_cache_byte_budget.to_string(),
    );
    push_line(
        &mut text,
        "module_plan_kv_cache_page_count",
        &review.kv_cache_page_count.to_string(),
    );
    push_line(
        &mut text,
        "conversion_status",
        review.plan.conversion_status,
    );
    push_line(
        &mut text,
        "converter_gap_status",
        review.converter_gap_status,
    );
    push_line(
        &mut text,
        "reference_prompt_route",
        review
            .metadata
            .reference_prompt_route
            .unwrap_or("pending-reference-prompt"),
    );
    push_line(
        &mut text,
        "reference_output_checksum",
        review
            .metadata
            .reference_output_checksum
            .unwrap_or("pending-reference-output"),
    );
    push_line(&mut text, "runtime_smoke_route", "pending-runtime-smoke");
    push_line(
        &mut text,
        "eval_cases_route",
        review
            .metadata
            .eval_cases_route
            .unwrap_or("pending-eval-cases"),
    );
    push_line(&mut text, "eval_sidecar_route", "pending-eval-sidecar");
    push_line(&mut text, "required_next_gate", "extract-raw-f32-tensors");
    text
}

/// Validates line-based review metadata before rendering the handoff artifact.
fn validate_candidate_review_metadata(metadata: &CandidateReviewMetadata<'_>) -> io::Result<()> {
    validate_review_value("source_model_id", metadata.source_model_id)?;
    validate_review_value("source_model_sha", metadata.source_model_sha)?;
    validate_review_checksum_value("source_config_checksum", metadata.source_config_checksum)?;
    validate_review_checksum_value(
        "source_tokenizer_checksum",
        metadata.source_tokenizer_checksum,
    )?;
    validate_review_value("source_license_route", metadata.source_license_route)?;
    if let Some(value) = metadata.reference_prompt_route {
        validate_review_value("reference_prompt_route", value)?;
    }
    if let Some(value) = metadata.reference_output_checksum {
        validate_review_checksum_value("reference_output_checksum", value)?;
    }
    if let Some(value) = metadata.eval_cases_route {
        validate_review_value("eval_cases_route", value)?;
    }
    if let Some(value) = metadata.source_config_route {
        validate_review_value("source_config_route", value)?;
    }
    if let Some(value) = metadata.source_tokenizer_route {
        validate_review_value("source_tokenizer_route", value)?;
    }
    Ok(())
}

/// Confirms a review checksum uses the TinyRustLM report hex64 format.
fn validate_review_checksum_value(field: &str, value: &str) -> io::Result<()> {
    validate_review_value(field, value)?;
    let bytes = value.as_bytes();
    if bytes.len() != 18
        || bytes[0] != b'0'
        || bytes[1] != b'x'
        || !bytes[2..].iter().all(u8::is_ascii_hexdigit)
    {
        return Err(invalid(&format!(
            "safetensors candidate review {field} must be 0x followed by 16 hex digits"
        )));
    }
    Ok(())
}

/// Confirms one review value fits the line-oriented report format.
fn validate_review_value(field: &str, value: &str) -> io::Result<()> {
    if value.trim().is_empty() || value.contains('\n') || value.contains('\r') {
        return Err(invalid(&format!(
            "safetensors candidate review {field} must be a nonempty single line"
        )));
    }
    Ok(())
}

/// Maps the reviewed output quantization into the tensor writer dtype.
fn review_dtype_for_output(output_quantization: &str) -> io::Result<u32> {
    match output_quantization {
        "f32" => Ok(DTYPE_F32),
        "q8_0" => Ok(DTYPE_Q8_0),
        "q4_0" => Ok(DTYPE_Q4_0),
        _ => Err(invalid(
            "converted output quantization must be f32, q8_0, or q4_0",
        )),
    }
}

/// Estimates serialized `.slm` bytes using the writer alignment and tensor-directory rules.
fn estimate_slm_byte_count(
    tensors: &[crate::tensor_writer::TensorSpec],
    tokenizer: &ByteTokenizerSection,
) -> io::Result<u64> {
    let tensor_directory_offset = align_to_64(SLM_HEADER_LEN + tokenizer.bytes.len());
    let tensor_data_offset =
        align_to_64(tensor_directory_offset + tensors.len() * SLM_TENSOR_ENTRY_LEN);
    let mut cursor = tensor_data_offset;
    for tensor in tensors {
        cursor = align_to_64(cursor);
        cursor = cursor
            .checked_add(tensor.byte_len())
            .ok_or_else(|| invalid("safetensors candidate review byte estimate overflow"))?;
        let scale_len = tensor.scale_byte_len();
        if scale_len > 0 {
            cursor = align_to_64(cursor);
            cursor = cursor
                .checked_add(scale_len)
                .ok_or_else(|| invalid("safetensors candidate review scale estimate overflow"))?;
        }
    }
    u64::try_from(cursor)
        .map_err(|_| invalid("safetensors candidate review byte estimate overflow"))
}

/// Selects the tokenizer section used to estimate a candidate `.slm` artifact.
fn tokenizer_for_review(
    contract: &trained_source::SourceShapeContract,
    tokenizer_override: Option<&trained_source::SourceTokenizerOverride>,
) -> io::Result<ByteTokenizerSection> {
    if let Some(tokenizer_override) = tokenizer_override {
        if contract.tokenizer_strategy != "manifest-bpe-v1" {
            return Err(invalid(
                "safetensors candidate review tokenizer override requires BPE strategy",
            ));
        }
        return Ok(TokenizerSection::bpe_from_parts(
            contract.shape.vocab_size,
            &tokenizer_override.tokens,
            &tokenizer_override.merges,
        ));
    }
    match contract.tokenizer_strategy {
        "byte-tokenizer-v1" => Ok(ByteTokenizerSection::phase_one()),
        "manifest-bpe-v1" => Ok(TokenizerSection::tiny_bpe_demo()),
        _ => Err(invalid(
            "safetensors candidate review tokenizer strategy is unsupported",
        )),
    }
}

/// Computes the runtime KV-cache budget for the reviewed shape.
fn kv_cache_byte_budget_for_shape(shape: &crate::tensor_writer::ModelShape) -> io::Result<u64> {
    u64::from(shape.layer_count)
        .checked_mul(u64::from(shape.max_context))
        .and_then(|value| value.checked_mul(u64::from(shape.kv_head_count)))
        .and_then(|value| value.checked_mul(u64::from(shape.head_dim)))
        .and_then(|value| value.checked_mul(2))
        .and_then(|value| value.checked_mul(4))
        .ok_or_else(|| invalid("safetensors candidate review KV-cache budget overflow"))
}

/// Computes the 64 KiB WebAssembly page count for a byte budget.
fn page_count_for_bytes(byte_count: u64) -> u64 {
    byte_count.div_ceil(65_536)
}

/// Chooses the raw f32 extraction action required for a safetensors dtype.
fn source_conversion_action(dtype: &str) -> io::Result<&'static str> {
    match dtype {
        "F32" => Ok("copy-f32"),
        "F16" => Ok("decode-f16-to-f32"),
        "BF16" => Ok("decode-bf16-to-f32"),
        _ => Err(invalid(&format!(
            "safetensors source plan only supports F32, F16, or BF16 tensors, not {dtype}"
        ))),
    }
}

/// Computes a stable checksum for ordered source extraction mappings.
fn source_plan_mapping_checksum(tensors: &[SourceTensorPlan]) -> u64 {
    let mut text = String::new();
    for tensor in tensors {
        text.push_str(&tensor.name);
        text.push('|');
        text.push_str(&tensor.source_name);
        text.push('|');
        text.push_str(&tensor.dtype);
        text.push('|');
        text.push_str(&shape_text(&tensor.shape));
        text.push('|');
        text.push_str(&tensor.start.to_string());
        text.push(':');
        text.push_str(&tensor.end.to_string());
        text.push('|');
        text.push_str(&tensor.raw_source_file);
        text.push('|');
        text.push_str(&tensor.raw_source_bytes.to_string());
        text.push('|');
        text.push_str(tensor.conversion_action);
        text.push('\n');
    }
    local_checksum(text.as_bytes())
}

/// Computes total source parameters across all inspected tensors.
fn total_parameter_count(inspection: &SafetensorsInspection) -> u64 {
    inspection
        .tensors
        .iter()
        .fold(0u64, |acc, tensor| acc.saturating_add(tensor.element_count))
}

/// Computes a stable checksum over tensor names, dtypes, shapes, and offsets.
fn tensor_directory_checksum(tensors: &[TensorInfo]) -> u64 {
    let mut text = String::new();
    for tensor in tensors {
        text.push_str(&tensor.name);
        text.push('|');
        text.push_str(&tensor.dtype);
        text.push('|');
        text.push_str(&shape_text(&tensor.shape));
        text.push('|');
        text.push_str(&tensor.start.to_string());
        text.push(':');
        text.push_str(&tensor.end.to_string());
        text.push('\n');
    }
    local_checksum(text.as_bytes())
}

/// Calculates the element count described by a safetensors shape array.
fn shape_element_count(shape: &[u64]) -> io::Result<u64> {
    let mut count = 1u64;
    for dim in shape {
        count = count
            .checked_mul(*dim)
            .ok_or_else(|| invalid("safetensors shape element count overflow"))?;
    }
    Ok(count)
}

/// Maps safetensors dtype labels to their local byte widths.
fn dtype_byte_size(dtype: &str) -> io::Result<u64> {
    match dtype {
        "F64" | "I64" | "U64" => Ok(8),
        "F32" | "I32" | "U32" => Ok(4),
        "F16" | "BF16" | "I16" | "U16" => Ok(2),
        "F8_E5M2" | "F8_E4M3" | "I8" | "U8" | "BOOL" => Ok(1),
        _ => Err(invalid(&format!("unsupported safetensors dtype {dtype}"))),
    }
}

/// Extracts an object field as a string value.
fn require_string_field<'a>(object: &'a [(String, JsonValue)], key: &str) -> io::Result<&'a str> {
    match object_field(object, key)? {
        JsonValue::String(value) => Ok(value),
        _ => Err(invalid(&format!(
            "safetensors field {key} must be a string"
        ))),
    }
}

/// Extracts an object field as an array of unsigned integers.
fn require_number_array(object: &[(String, JsonValue)], key: &str) -> io::Result<Vec<u64>> {
    let JsonValue::Array(items) = object_field(object, key)? else {
        return Err(invalid(&format!(
            "safetensors field {key} must be an array"
        )));
    };
    let mut numbers = Vec::with_capacity(items.len());
    for item in items {
        match item {
            JsonValue::Number(value) => numbers.push(value.parse::<u64>().map_err(|_| {
                invalid(&format!(
                    "safetensors field {key} must contain unsigned integer numbers"
                ))
            })?),
            _ => {
                return Err(invalid(&format!(
                    "safetensors field {key} must contain numbers"
                )))
            }
        }
    }
    Ok(numbers)
}

/// Requires at least one named field to exist on a JSON object.
fn require_any_object_field(
    object: &[(String, JsonValue)],
    keys: &[&str],
    label: &str,
) -> io::Result<()> {
    if keys
        .iter()
        .any(|key| find_object_field(object, key).is_some())
    {
        Ok(())
    } else {
        Err(invalid(&format!(
            "safetensors candidate review {label} must include model metadata fields"
        )))
    }
}

/// Requires an optional numeric config field, when present, to match a target value.
fn require_optional_number_match(
    object: &[(String, JsonValue)],
    keys: &[&str],
    expected: u64,
    label: &str,
) -> io::Result<()> {
    for key in keys {
        if let Some(value) = optional_u64_field(object, key)? {
            if value != expected {
                return Err(invalid(&format!(
                    "safetensors candidate review {label} was {value}, expected {expected}"
                )));
            }
            return Ok(());
        }
    }
    Ok(())
}

/// Requires a named JSON field to be an object and returns it.
fn require_object_field<'a>(
    object: &'a [(String, JsonValue)],
    key: &str,
    label: &str,
) -> io::Result<&'a [(String, JsonValue)]> {
    optional_object_field(object, key).ok_or_else(|| {
        invalid(&format!(
            "safetensors candidate review {label} must be an object"
        ))
    })
}

/// Requires a named JSON field to be an array and returns it.
fn require_array_field<'a>(
    object: &'a [(String, JsonValue)],
    key: &str,
    label: &str,
) -> io::Result<&'a [JsonValue]> {
    match find_object_field(object, key) {
        Some(JsonValue::Array(items)) => Ok(items),
        Some(_) => Err(invalid(&format!(
            "safetensors candidate review {label} must be an array"
        ))),
        None => Err(invalid(&format!(
            "safetensors candidate review {label} is missing"
        ))),
    }
}

/// Extracts an optional object field as a string.
fn optional_string_field<'a>(object: &'a [(String, JsonValue)], key: &str) -> Option<&'a str> {
    match find_object_field(object, key) {
        Some(JsonValue::String(value)) => Some(value),
        _ => None,
    }
}

/// Extracts an optional object field as a nested object.
fn optional_object_field<'a>(
    object: &'a [(String, JsonValue)],
    key: &str,
) -> Option<&'a [(String, JsonValue)]> {
    match find_object_field(object, key) {
        Some(JsonValue::Object(value)) => Some(value),
        _ => None,
    }
}

/// Extracts an optional unsigned integer field from a JSON object.
fn optional_u64_field(object: &[(String, JsonValue)], key: &str) -> io::Result<Option<u64>> {
    match find_object_field(object, key) {
        Some(JsonValue::Number(value)) => value.parse::<u64>().map(Some).map_err(|_| {
            invalid(&format!(
                "safetensors candidate review field {key} must be an unsigned integer"
            ))
        }),
        Some(_) => Err(invalid(&format!(
            "safetensors candidate review field {key} must be a number"
        ))),
        None => Ok(None),
    }
}

/// Locates an object field without turning absence into an error.
fn find_object_field<'a>(object: &'a [(String, JsonValue)], key: &str) -> Option<&'a JsonValue> {
    object
        .iter()
        .find_map(|(field, value)| if field == key { Some(value) } else { None })
}

/// Locates a required object field while rejecting missing tensor metadata.
fn object_field<'a>(object: &'a [(String, JsonValue)], key: &str) -> io::Result<&'a JsonValue> {
    find_object_field(object, key)
        .ok_or_else(|| invalid(&format!("safetensors tensor missing field {key}")))
}

/// Borrows a parsed JSON value as an object.
fn as_object<'a>(value: &'a JsonValue, label: &str) -> io::Result<&'a [(String, JsonValue)]> {
    match value {
        JsonValue::Object(object) => Ok(object),
        _ => Err(invalid(&format!("{label} must be a JSON object"))),
    }
}

/// Parses a complete JSON document whose root must be an object.
fn parse_json_object(text: &str) -> io::Result<Vec<(String, JsonValue)>> {
    let mut parser = JsonParser {
        bytes: text.as_bytes(),
        index: 0,
    };
    let value = parser.parse_value()?;
    parser.skip_ws();
    if parser.index != parser.bytes.len() {
        return Err(invalid("safetensors header has trailing JSON bytes"));
    }
    match value {
        JsonValue::Object(object) => Ok(object),
        _ => Err(invalid("safetensors header root must be a JSON object")),
    }
}

impl<'a> JsonParser<'a> {
    /// Parses one JSON value from the current byte position.
    fn parse_value(&mut self) -> io::Result<JsonValue> {
        self.skip_ws();
        match self.peek() {
            Some(b'{') => self.parse_object().map(JsonValue::Object),
            Some(b'[') => self.parse_array().map(JsonValue::Array),
            Some(b'"') => self.parse_string().map(JsonValue::String),
            Some(b'-' | b'0'..=b'9') => self.parse_number().map(JsonValue::Number),
            Some(b't') => {
                self.parse_literal(b"true")?;
                Ok(JsonValue::Bool)
            }
            Some(b'f') => {
                self.parse_literal(b"false")?;
                Ok(JsonValue::Bool)
            }
            Some(b'n') => {
                self.parse_literal(b"null")?;
                Ok(JsonValue::Null)
            }
            _ => Err(invalid(
                "safetensors header contains unsupported JSON value",
            )),
        }
    }

    /// Parses a JSON object while preserving field order for stable reports.
    fn parse_object(&mut self) -> io::Result<Vec<(String, JsonValue)>> {
        self.expect_byte(b'{')?;
        let mut fields = Vec::new();
        self.skip_ws();
        if self.try_consume(b'}') {
            return Ok(fields);
        }
        loop {
            self.skip_ws();
            let key = self.parse_string()?;
            self.skip_ws();
            self.expect_byte(b':')?;
            let value = self.parse_value()?;
            fields.push((key, value));
            self.skip_ws();
            if self.try_consume(b'}') {
                break;
            }
            self.expect_byte(b',')?;
        }
        Ok(fields)
    }

    /// Parses a JSON array for shape and data offset fields.
    fn parse_array(&mut self) -> io::Result<Vec<JsonValue>> {
        self.expect_byte(b'[')?;
        let mut values = Vec::new();
        self.skip_ws();
        if self.try_consume(b']') {
            return Ok(values);
        }
        loop {
            values.push(self.parse_value()?);
            self.skip_ws();
            if self.try_consume(b']') {
                break;
            }
            self.expect_byte(b',')?;
        }
        Ok(values)
    }

    /// Parses a JSON string and decodes common escape sequences.
    fn parse_string(&mut self) -> io::Result<String> {
        self.expect_byte(b'"')?;
        let mut value = String::new();
        while let Some(byte) = self.bump() {
            match byte {
                b'"' => return Ok(value),
                b'\\' => value.push(self.parse_escape()?),
                0x00..=0x1f => return Err(invalid("safetensors JSON string has a control byte")),
                0x80..=0xff => {
                    let start = self.index - 1;
                    let end = start
                        .checked_add(utf8_char_width(byte)?)
                        .ok_or_else(|| invalid("safetensors JSON string UTF-8 span overflow"))?;
                    if end > self.bytes.len() {
                        return Err(invalid("safetensors JSON string UTF-8 byte is truncated"));
                    }
                    let text = std::str::from_utf8(&self.bytes[start..end])
                        .map_err(|_| invalid("safetensors JSON string has invalid UTF-8"))?;
                    let ch = text
                        .chars()
                        .next()
                        .ok_or_else(|| invalid("safetensors JSON string has empty UTF-8 span"))?;
                    value.push(ch);
                    self.index = end;
                }
                _ => value.push(byte as char),
            }
        }
        Err(invalid("safetensors JSON string is unterminated"))
    }

    /// Parses a JSON number while leaving integer-only validation to callers.
    fn parse_number(&mut self) -> io::Result<String> {
        let start = self.index;
        if self.try_consume(b'-') && !matches!(self.peek(), Some(b'0'..=b'9')) {
            return Err(invalid("safetensors JSON number has an invalid sign"));
        }
        match self.peek() {
            Some(b'0') => {
                self.index += 1;
            }
            Some(b'1'..=b'9') => {
                while matches!(self.peek(), Some(b'0'..=b'9')) {
                    self.index += 1;
                }
            }
            _ => return Err(invalid("safetensors JSON number is missing digits")),
        }
        if self.try_consume(b'.') {
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return Err(invalid(
                    "safetensors JSON number fraction is missing digits",
                ));
            }
            while matches!(self.peek(), Some(b'0'..=b'9')) {
                self.index += 1;
            }
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            self.index += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.index += 1;
            }
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return Err(invalid(
                    "safetensors JSON number exponent is missing digits",
                ));
            }
            while matches!(self.peek(), Some(b'0'..=b'9')) {
                self.index += 1;
            }
        }
        let text = std::str::from_utf8(&self.bytes[start..self.index])
            .map_err(|_| invalid("safetensors JSON number was not UTF-8"))?;
        Ok(text.to_string())
    }

    /// Parses one JSON string escape sequence.
    fn parse_escape(&mut self) -> io::Result<char> {
        let Some(byte) = self.bump() else {
            return Err(invalid("safetensors JSON escape is incomplete"));
        };
        match byte {
            b'"' => Ok('"'),
            b'\\' => Ok('\\'),
            b'/' => Ok('/'),
            b'b' => Ok('\u{0008}'),
            b'f' => Ok('\u{000c}'),
            b'n' => Ok('\n'),
            b'r' => Ok('\r'),
            b't' => Ok('\t'),
            b'u' => self.parse_unicode_escape(),
            _ => Err(invalid("safetensors JSON escape is unsupported")),
        }
    }

    /// Parses a basic `\uXXXX` JSON escape into a Unicode scalar.
    fn parse_unicode_escape(&mut self) -> io::Result<char> {
        let mut value = 0u32;
        for _ in 0..4 {
            let Some(byte) = self.bump() else {
                return Err(invalid("safetensors JSON unicode escape is incomplete"));
            };
            value = (value << 4) | u32::from(hex_nibble(byte)?);
        }
        char::from_u32(value).ok_or_else(|| invalid("safetensors JSON unicode escape is invalid"))
    }

    /// Consumes an exact JSON literal such as `true`, `false`, or `null`.
    fn parse_literal(&mut self, literal: &[u8]) -> io::Result<()> {
        if self.bytes.len().saturating_sub(self.index) < literal.len() {
            return Err(invalid("safetensors JSON literal is truncated"));
        }
        if &self.bytes[self.index..self.index + literal.len()] != literal {
            return Err(invalid("safetensors JSON literal is invalid"));
        }
        self.index += literal.len();
        Ok(())
    }

    /// Skips insignificant JSON whitespace.
    fn skip_ws(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.index += 1;
        }
    }

    /// Returns the current byte without advancing.
    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.index).copied()
    }

    /// Consumes the current byte if one is available.
    fn bump(&mut self) -> Option<u8> {
        let byte = self.peek()?;
        self.index += 1;
        Some(byte)
    }

    /// Consumes a required structural byte.
    fn expect_byte(&mut self, expected: u8) -> io::Result<()> {
        match self.bump() {
            Some(actual) if actual == expected => Ok(()),
            _ => Err(invalid("safetensors JSON structure is malformed")),
        }
    }

    /// Consumes an optional structural byte.
    fn try_consume(&mut self, expected: u8) -> bool {
        if self.peek() == Some(expected) {
            self.index += 1;
            true
        } else {
            false
        }
    }
}

/// Returns the UTF-8 sequence width for a non-ASCII string byte.
fn utf8_char_width(first: u8) -> io::Result<usize> {
    match first {
        0xc2..=0xdf => Ok(2),
        0xe0..=0xef => Ok(3),
        0xf0..=0xf4 => Ok(4),
        _ => Err(invalid(
            "safetensors JSON string has invalid UTF-8 lead byte",
        )),
    }
}

/// Converts a lowercase or uppercase hex digit into its value.
fn hex_nibble(byte: u8) -> io::Result<u8> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err(invalid(
            "safetensors JSON unicode escape contains a non-hex digit",
        )),
    }
}

/// Formats tensor shape arrays for line-based reports.
fn shape_text(shape: &[u64]) -> String {
    shape
        .iter()
        .map(u64::to_string)
        .collect::<Vec<_>>()
        .join("x")
}

/// Appends one key/value line to a TinyRustLM report body.
fn push_line(text: &mut String, key: &str, value: &str) {
    text.push_str(key);
    text.push('=');
    text.push_str(value);
    text.push('\n');
}

/// Appends local-or-route-only artifact evidence to a candidate review report.
fn push_review_artifact_lines(text: &mut String, prefix: &str, artifact: &ReviewArtifactEvidence) {
    push_line(text, &format!("{prefix}_artifact_status"), artifact.status);
    push_line(text, &format!("{prefix}_artifact_kind"), artifact.kind);
    push_line(
        text,
        &format!("{prefix}_artifact_checksum"),
        artifact.checksum.as_deref().unwrap_or("not-local"),
    );
    push_line(
        text,
        &format!("{prefix}_artifact_bytes"),
        &artifact
            .byte_count
            .map(|value| value.to_string())
            .unwrap_or_else(|| "not-local".to_string()),
    );
    push_line(
        text,
        &format!("{prefix}_artifact_detail"),
        artifact.detail.as_deref().unwrap_or("not-local"),
    );
}

fn candidate_review_checksum(path: &Path) -> io::Result<String> {
    // Binds the raw-source manifest to the reviewed pre-extraction gate file.
    let bytes = fs::read(path)?;
    Ok(hex64(provenance::text_checksum(&bytes)))
}

/// Formats a 64-bit local checksum as a report value.
fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

/// Computes the local non-cryptographic checksum used for routing evidence.
fn local_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x6eed0e9da4d94a4fu64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 3);
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    acc
}

/// Builds a local invalid-input error with a project-scoped message.
fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{provenance, slm_validate};
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn inspects_valid_safetensors_header_and_writes_report() {
        let dir = unique_dir("valid");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny.safetensors");
        let report_path = dir.join("tiny.safetensors.report");
        write_safetensors_file(
            &input,
            r#"{"token.weight":{"dtype":"F32","shape":[2,3],"data_offsets":[0,24]},"norm.weight":{"dtype":"F16","shape":[4],"data_offsets":[24,32]},"__metadata__":{"format":"pt"}}"#,
            32,
        );

        inspect_path(&input, Some(&report_path)).unwrap();

        let report = fs::read_to_string(report_path).unwrap();
        assert!(report.contains("source_layout=safetensors-v1"));
        assert!(report.contains("tensor_count=2"));
        assert!(report.contains("parameter_count=10"));
        assert!(report.contains("dtype.0.name=F16"));
        assert!(report.contains("dtype.1.name=F32"));
        assert!(report.contains("tensor.0.name=token.weight"));
        assert!(report.contains("tensor.1.shape=4"));
    }

    #[test]
    fn inspects_valid_safetensors_header_with_utf8_metadata_without_report_path() {
        let dir = unique_dir("utf8");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("utf8.safetensors");
        let header = format!(
            "{{\"__metadata__\":{{\"note\":\"{}\"}},\"token.weight\":{{\"dtype\":\"U8\",\"shape\":[4],\"data_offsets\":[0,4]}}}}",
            '\u{00e9}'
        );
        write_safetensors_file(&input, &header, 4);

        inspect_path(&input, None).unwrap();
    }

    #[test]
    fn rejects_non_contiguous_safetensors_offsets() {
        let dir = unique_dir("offset-gap");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("gap.safetensors");
        write_safetensors_file(
            &input,
            r#"{"a":{"dtype":"U8","shape":[4],"data_offsets":[0,4]},"b":{"dtype":"U8","shape":[4],"data_offsets":[8,12]}}"#,
            12,
        );

        let error = inspect_path(&input, None).unwrap_err();

        assert!(error.to_string().contains("not contiguous"));
    }

    #[test]
    fn rejects_safetensors_dtype_byte_mismatch() {
        let dir = unique_dir("byte-mismatch");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("bad-bytes.safetensors");
        write_safetensors_file(
            &input,
            r#"{"a":{"dtype":"F32","shape":[2],"data_offsets":[0,4]}}"#,
            4,
        );

        let error = inspect_path(&input, None).unwrap_err();

        assert!(error.to_string().contains("expected 8"));
    }

    #[test]
    fn rejects_unsupported_safetensors_dtype() {
        let dir = unique_dir("bad-dtype");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("bad-dtype.safetensors");
        write_safetensors_file(
            &input,
            r#"{"a":{"dtype":"Q4_0","shape":[4],"data_offsets":[0,4]}}"#,
            4,
        );

        let error = inspect_path(&input, None).unwrap_err();

        assert!(error.to_string().contains("unsupported safetensors dtype"));
    }

    #[test]
    fn plans_f32_safetensors_source_with_output_path() {
        let dir = unique_dir("source-plan-f32");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source.safetensors");
        let output = dir.join("tiny-source.plan");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", None, false);

        plan_source_path(&input, "tiny-fixture", Some(&output)).unwrap();

        let plan = fs::read_to_string(output).unwrap();
        assert!(plan.contains("tinyrustlm_safetensors_source_plan_version=1"));
        assert!(plan.contains("target_model_shape=tiny-fixture"));
        assert!(plan.contains("conversion_status=copy-ready"));
        assert!(plan.contains("tensor.0.name=tok_embeddings.weight"));
        assert!(plan.contains("tensor.0.raw_source_file=tensors/tok_embeddings_weight.f32"));
        assert!(plan.contains("tensor.0.conversion_action=copy-f32"));
    }

    #[test]
    fn plans_bf16_safetensors_source_without_output_path() {
        let dir = unique_dir("source-plan-bf16");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-tied-source.safetensors");
        write_source_plan_safetensors(&input, "tiny-fixture-tied", "BF16", None, false);

        let plan = build_source_plan(&input, "tiny-fixture-tied").unwrap();
        let report = render_source_plan(&plan);

        assert_eq!(plan.tensors.len(), 11);
        assert_eq!(plan.conversion_status, "decode-required");
        assert!(report.contains("target_model_shape=tiny-fixture-tied"));
        assert!(report.contains("tensor.0.conversion_action=decode-bf16-to-f32"));
        assert!(!report.contains("output.weight"));
    }

    #[test]
    fn plans_huggingface_llama_safetensors_aliases() {
        let dir = unique_dir("source-plan-hf-aliases");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output = dir.join("tiny-hf-source.plan");
        write_source_plan_safetensors_with_hf_aliases(&input, "tiny-fixture", "F32", None, false);

        plan_source_path(&input, "tiny-fixture", Some(&output)).unwrap();

        let plan = fs::read_to_string(output).unwrap();
        assert!(plan.contains("tensor.0.name=tok_embeddings.weight"));
        assert!(plan.contains("tensor.0.safetensors_name=model.embed_tokens.weight"));
        assert!(plan.contains("tensor.2.name=output.weight"));
        assert!(plan.contains("tensor.2.safetensors_name=lm_head.weight"));
        assert!(plan.contains("safetensors_name=model.layers.0.self_attn.q_proj.weight"));
    }

    #[test]
    fn plans_tinylm16_bpe_safetensors_source_without_dense_payloads() {
        let dir = unique_dir("source-plan-tinylm16-bpe");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tinylm16-bpe.safetensors");
        write_sparse_source_plan_safetensors(&input, "tinylm16-bpe", "F32");

        let plan = build_source_plan(&input, "tinylm16-bpe").unwrap();
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tinylm16-bpe");
        assert_eq!(plan.tensors.len(), 39);
        assert_eq!(plan.tensors[0].name, "tok_embeddings.weight");
        assert_eq!(plan.tensors[0].shape, vec![262, 512]);
        assert_eq!(plan.tensors[2].name, "output.weight");
        assert_eq!(plan.tensors[2].shape, vec![262, 512]);
        assert!(report.contains("target_model_shape=tinylm16-bpe"));
        assert!(report.contains("tensor.0.raw_source_file=tensors/tok_embeddings_weight.f32"));
        assert!(report.contains("conversion_status=copy-ready"));
    }

    #[test]
    fn reviews_safetensors_candidate_with_budget_and_reference_routes() {
        let dir = unique_dir("candidate-review-q8");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output = dir.join("tiny.review");
        write_source_plan_safetensors_with_hf_aliases(&input, "tiny-fixture", "F32", None, false);

        review_candidate_path(
            &input,
            "tiny-fixture",
            "q8_0",
            "Xenova/llama2.c-stories15M",
            "sha256:source",
            "0x00000000000000c1",
            "0x00000000000000c2",
            "license-review://xenova-15m",
            &output,
            Some("fixtures/reference-prompts/xenova-15m-hi.txt"),
            Some("0x00000000000000c3"),
            Some("fixtures/eval/xenova-15m.eval-cases.txt"),
            Some("fixtures/source-configs/xenova-15m.config.json"),
            Some("fixtures/tokenizers/xenova-15m.tokenizer.json"),
        )
        .unwrap();

        let review = fs::read_to_string(output).unwrap();
        assert!(review.contains("tinyrustlm_safetensors_candidate_review_version=1"));
        assert!(review.contains("review_layout=safetensors-real-trained-candidate-review-v1"));
        assert!(review.contains("source_model_id=Xenova/llama2.c-stories15M"));
        assert!(review.contains("source_model_sha=sha256:source"));
        assert!(review.contains("source_config_checksum=0x00000000000000c1"));
        assert!(
            review.contains("source_config_route=fixtures/source-configs/xenova-15m.config.json")
        );
        assert!(review.contains("source_tokenizer_checksum=0x00000000000000c2"));
        assert!(
            review.contains("source_tokenizer_route=fixtures/tokenizers/xenova-15m.tokenizer.json")
        );
        assert!(review.contains("source_license_route=license-review://xenova-15m"));
        assert!(review.contains("target_model_shape=tiny-fixture"));
        assert!(review.contains("tensor_layout_strategy=local-or-huggingface-llama-aliases-v1"));
        assert!(review.contains("tokenizer_strategy=byte-tokenizer-v1"));
        assert!(review.contains("quantization_target=q8_0"));
        assert!(review.contains("selector_model_byte_budget=33554432"));
        assert!(review.contains("selector_budget_status=fits"));
        assert!(review.contains("f32_selector_budget_status=fits"));
        assert!(review.contains("q8_0_selector_budget_status=fits"));
        assert!(review.contains("q4_0_selector_budget_status=fits"));
        assert!(review.contains("browser_admission_default_strategy=browser-frugal-quantized"));
        assert!(review.contains("browser_admission_preferred_quantization=q8_0"));
        assert!(review.contains("browser_admission_preference_reason=target-fits-selector-budget"));
        assert!(review.contains("browser_admission_fallback_quantization=q4_0"));
        assert!(review.contains("module_plan_context_token_limit=16"));
        assert!(review.contains("module_plan_kv_cache_byte_budget=1024"));
        assert!(review.contains("module_plan_kv_cache_page_count=1"));
        assert!(review.contains("converter_gap_status=ready-for-reviewed-extraction"));
        assert!(
            review.contains("reference_prompt_route=fixtures/reference-prompts/xenova-15m-hi.txt")
        );
        assert!(review.contains("reference_output_checksum=0x00000000000000c3"));
        assert!(review.contains("eval_cases_route=fixtures/eval/xenova-15m.eval-cases.txt"));
        assert!(review.contains("required_next_gate=extract-raw-f32-tensors"));
    }

    #[test]
    fn reviews_bpe_safetensors_candidate_with_exact_q8_estimate() {
        let dir = unique_dir("candidate-review-bpe-estimate");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review_path = dir.join("tiny-bpe.review");
        let output_dir = dir.join("tiny-bpe-source-q8");
        let output_slm = dir.join("tiny-bpe-q8.slm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "BPE");

        review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review_path,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap();
        convert_source_path_with_review(
            &input,
            "tiny-fixture-bpe",
            &output_dir,
            &output_slm,
            "q8_0",
            Some(&review_path),
        )
        .unwrap();

        // The review must count manifest BPE bytes exactly like the writer.
        let actual_slm_bytes = fs::metadata(&output_slm).unwrap().len();
        let review = fs::read_to_string(&review_path).unwrap();
        assert!(review.contains("target_model_shape=tiny-fixture-bpe"));
        assert!(review.contains("tokenizer_strategy=manifest-bpe-v1"));
        assert!(review.contains(&format!("estimated_slm_bytes={actual_slm_bytes}")));
        assert!(review.contains(&format!("q8_0_estimated_slm_bytes={actual_slm_bytes}")));
        assert!(review.contains("browser_admission_preferred_quantization=q8_0"));
        assert!(review.contains("required_next_gate=extract-raw-f32-tensors"));

        let bytes = fs::read(&output_slm).unwrap();
        assert_eq!(&bytes[SLM_HEADER_LEN..SLM_HEADER_LEN + 4], b"BPE1");
        let source_manifest = fs::read_to_string(output_dir.join("source.manifest")).unwrap();
        assert!(source_manifest.contains("model_shape=tiny-fixture-bpe"));
        assert!(source_manifest.contains("tokenizer=bpe-v1"));
        assert!(source_manifest.contains("source_review_kind=safetensors-candidate-review"));
    }

    #[test]
    fn rejects_bpe_safetensors_candidate_without_local_tokenizer_artifact() {
        let dir = unique_dir("candidate-review-bpe-route-only");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review_path = dir.join("tiny-bpe.review");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");

        let error = review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            "0x0000000000000b01",
            "0x0000000000000b02",
            "license-review://tiny-bpe",
            &review_path,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some("fixtures/source-configs/tiny-bpe.config.json"),
            Some("fixtures/tokenizers/tiny-bpe.tokenizer.json"),
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("local compatible BPE tokenizer artifact"));
        assert!(!review_path.exists());
    }

    #[test]
    fn reviews_safetensors_candidate_with_local_config_and_bpe_tokenizer_artifacts() {
        let dir = unique_dir("candidate-review-local-artifacts");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review_path = dir.join("tiny-bpe.review");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "BPE");

        review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review_path,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap();

        let review = fs::read_to_string(&review_path).unwrap();
        assert!(review.contains("source_config_artifact_status=local-json-validated"));
        assert!(review.contains("source_config_artifact_kind=llama-config-json"));
        assert!(review.contains(&format!(
            "source_config_artifact_checksum={config_checksum}"
        )));
        assert!(review.contains(
            "source_config_artifact_detail=model_type:llama;vocab_size:262;hidden_size:8;layer_count:1;attention_heads:2;kv_heads:2;ffn_size:16;max_context:16"
        ));
        assert!(review.contains("source_tokenizer_artifact_status=local-json-validated"));
        assert!(review.contains("source_tokenizer_artifact_kind=bpe-tokenizer-json"));
        assert!(review.contains(&format!(
            "source_tokenizer_artifact_checksum={tokenizer_checksum}"
        )));
        assert!(review.contains(
            "source_tokenizer_artifact_detail=model_type:BPE;vocab_entries:6;max_token_id:261;merge_count:2"
        ));
        assert!(review.contains("tokenizer_strategy=manifest-bpe-v1"));
    }

    #[test]
    fn rejects_safetensors_candidate_review_local_artifact_checksum_mismatch() {
        let dir = unique_dir("candidate-review-artifact-checksum");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review_path = dir.join("tiny-bpe.review");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let (config_route, _config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "BPE");

        let error = review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            "0x0000000000000000",
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review_path,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap_err();

        assert!(error.to_string().contains("source_config_checksum"));
        assert!(!review_path.exists());
    }

    #[test]
    fn rejects_safetensors_candidate_review_bpe_tokenizer_artifact_mismatch() {
        let dir = unique_dir("candidate-review-tokenizer-kind");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review_path = dir.join("tiny-bpe.review");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "WordPiece");

        let error = review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review_path,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap_err();

        assert!(error.to_string().contains("BPE tokenizer route"));
        assert!(!review_path.exists());
    }

    #[test]
    fn reviews_tinylm16_candidate_as_over_budget_for_f32() {
        let dir = unique_dir("candidate-review-f32-budget");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tinylm16.safetensors");
        write_sparse_source_plan_safetensors(&input, "tinylm16", "F32");

        let metadata = CandidateReviewMetadata {
            source_model_id: "local/tinylm16",
            source_model_sha: "sha256:tinylm16",
            source_config_checksum: "0x0000000000000101",
            source_tokenizer_checksum: "0x0000000000000102",
            source_license_route: "license-review://tinylm16",
            reference_prompt_route: None,
            reference_output_checksum: None,
            eval_cases_route: None,
            source_config_route: None,
            source_tokenizer_route: None,
        };
        let review = build_candidate_review(&input, "tinylm16", "f32", metadata).unwrap();
        let report = render_candidate_review(&review);

        assert_eq!(review.selector_budget_status, "exceeds");
        assert_eq!(review.converter_gap_status, "selector-budget-exceeded");
        assert!(review.estimated_slm_bytes > SELECTOR_MODEL_BYTE_BUDGET);
        assert!(report.contains("quantization_target=f32"));
        assert!(report.contains("f32_selector_budget_status=exceeds"));
        assert!(report.contains("q8_0_selector_budget_status=fits"));
        assert!(report.contains("q4_0_selector_budget_status=fits"));
        assert!(report.contains("browser_admission_default_strategy=browser-frugal-quantized"));
        assert!(report.contains("browser_admission_preferred_quantization=q4_0"));
        assert!(report.contains(
            "browser_admission_preference_reason=target-exceeds-selector-budget-frugal-fit"
        ));
        assert!(report.contains("browser_admission_fallback_quantization=q4_0"));
        assert!(report.contains("reference_output_checksum=pending-reference-output"));
        assert!(report.contains("eval_cases_route=pending-eval-cases"));
        assert!(report.contains("module_plan_context_token_limit=512"));
        assert!(report.contains("module_plan_kv_cache_byte_budget=8388608"));
        assert!(report.contains("module_plan_kv_cache_page_count=128"));
    }

    #[test]
    fn rejects_safetensors_candidate_review_invalid_quantization() {
        let dir = unique_dir("candidate-review-quant");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source.safetensors");
        let output = dir.join("tiny.review");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", None, false);

        let error = review_candidate_path(
            &input,
            "tiny-fixture",
            "q2_0",
            "local/tiny",
            "sha256:tiny",
            "0x0000000000000201",
            "0x0000000000000202",
            "license-review://tiny",
            &output,
            None,
            None,
            None,
            None,
            None,
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("converted output quantization must be f32, q8_0, or q4_0"));
        assert!(!output.exists());
    }

    #[test]
    fn rejects_safetensors_candidate_review_multiline_metadata() {
        let dir = unique_dir("candidate-review-metadata");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source.safetensors");
        let output = dir.join("tiny.review");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", None, false);

        let error = review_candidate_path(
            &input,
            "tiny-fixture",
            "q8_0",
            "local/tiny\nextra",
            "sha256:tiny",
            "0x0000000000000301",
            "0x0000000000000302",
            "license-review://tiny",
            &output,
            None,
            None,
            None,
            Some("fixtures/configs/tiny.config.json\nextra"),
            None,
        )
        .unwrap_err();

        assert!(error.to_string().contains("source_model_id"));
        assert!(!output.exists());
    }

    #[test]
    fn rejects_safetensors_candidate_review_invalid_checksum_fields() {
        let dir = unique_dir("candidate-review-checksums");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source.safetensors");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", None, false);

        for (field, config_checksum, tokenizer_checksum, reference_checksum) in [
            (
                "source_config_checksum",
                "sha256:not-a-review-checksum",
                "0x0000000000000502",
                Some("0x0000000000000503"),
            ),
            (
                "source_tokenizer_checksum",
                "0x0000000000000501",
                "0x502",
                Some("0x0000000000000503"),
            ),
            (
                "reference_output_checksum",
                "0x0000000000000501",
                "0x0000000000000502",
                Some("not-a-hex64"),
            ),
        ] {
            let output = dir.join(format!("{field}.review"));

            let error = review_candidate_path(
                &input,
                "tiny-fixture",
                "q8_0",
                "local/tiny",
                "sha256:tiny",
                config_checksum,
                tokenizer_checksum,
                "license-review://tiny",
                &output,
                Some("fixtures/prompts/tiny.txt"),
                reference_checksum,
                Some("fixtures/eval/tiny.eval-cases.txt"),
                None,
                None,
            )
            .unwrap_err();

            assert!(error.to_string().contains(field));
            assert!(!output.exists());
        }
    }

    #[test]
    fn rejects_safetensors_candidate_review_multiline_source_routes() {
        let dir = unique_dir("candidate-review-route-metadata");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source.safetensors");
        let output = dir.join("tiny.review");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", None, false);

        let error = review_candidate_path(
            &input,
            "tiny-fixture",
            "q8_0",
            "local/tiny",
            "sha256:tiny",
            "0x0000000000000401",
            "0x0000000000000402",
            "license-review://tiny",
            &output,
            Some("fixtures/prompts/tiny.txt"),
            Some("0x0000000000000403"),
            Some("fixtures/eval/tiny.eval-cases.txt"),
            Some("fixtures/configs/tiny.config.json\nextra"),
            Some("fixtures/tokenizers/tiny.tokenizer.json"),
        )
        .unwrap_err();

        assert!(error.to_string().contains("source_config_route"));
        assert!(!output.exists());
    }

    // Proves a complete pre-extraction review can authorize raw f32 source extraction.
    #[test]
    fn extracts_safetensors_source_with_candidate_review_gate() {
        let dir = unique_dir("review-bound-extract");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let review = dir.join("tiny.review");
        let output_dir = dir.join("source");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");
        write_reviewed_candidate_for_test(&input, "tiny-fixture", "q8_0", &review);

        extract_source_path_with_review(&input, "tiny-fixture", &output_dir, Some(&review))
            .unwrap();

        trained_source::validate_source_path(&output_dir).unwrap();
        let manifest = fs::read_to_string(output_dir.join("source.manifest")).unwrap();
        let review_checksum = candidate_review_checksum(&review).unwrap();
        assert!(manifest.contains("source_kind=trained-export"));
        assert!(manifest.contains("source_id=safetensors-tensor-directory-0x"));
        assert!(manifest.contains("source_review_kind=safetensors-candidate-review"));
        assert!(manifest.contains("source_review_status=validated-before-extraction"));
        assert!(manifest.contains(&format!("source_review_checksum={review_checksum}")));
        assert!(manifest.contains("source_review_required_next_gate=extract-raw-f32-tensors"));
    }

    // Proves conversion consumes the review artifact and preserves its selected quantization.
    #[test]
    fn converts_safetensors_source_with_candidate_review_gate() {
        let dir = unique_dir("review-bound-convert");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let review = dir.join("tiny.review");
        let output_dir = dir.join("source");
        let output_slm = dir.join("converted-q8.slm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");
        write_reviewed_candidate_for_test(&input, "tiny-fixture", "q8_0", &review);

        convert_source_path_with_review(
            &input,
            "tiny-fixture",
            &output_dir,
            &output_slm,
            "q8_0",
            Some(&review),
        )
        .unwrap();

        let bytes = fs::read(&output_slm).unwrap();
        let report =
            slm_validate::validate_bytes(&bytes, &output_slm.display().to_string()).unwrap();
        assert_eq!(report.quantization_label(), "q8_0");
    }

    // Proves browser bundle generation follows the reviewed browser-fit quantization route.
    #[test]
    fn writes_browser_bundle_with_candidate_review_gate() {
        let dir = unique_dir("review-bound-browser");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let review = dir.join("tiny.review");
        let output_dir = dir.join("source");
        let root = dir.join("tinyrustlm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");
        write_reviewed_candidate_for_test(&input, "tiny-fixture", "q4_0", &review);

        browser_bundle_path_with_eval_cases_and_review(
            &input,
            "tiny-fixture",
            &output_dir,
            &root,
            "q4_0",
            None,
            Some(&review),
        )
        .unwrap();

        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        let review_checksum = candidate_review_checksum(&review).unwrap();
        assert!(registry.contains("entry.0.candidate_id=converted-trained-q4"));
        assert!(registry.contains("entry.0.quantization=q4_0"));
        assert!(registry.contains("entry.0.source_review_kind=safetensors-candidate-review"));
        assert!(registry.contains("entry.0.source_review_status=validated-before-extraction"));
        assert!(registry.contains(&format!("entry.0.source_review_checksum={review_checksum}")));
        assert!(
            registry.contains("entry.0.source_review_required_next_gate=extract-raw-f32-tensors")
        );
        assert_browser_source_manifest_snapshot(&root, "converted-trained-q4");
    }

    // Proves review-bound extraction rejects source-plan evidence drift before output exists.
    #[test]
    fn rejects_review_bound_extraction_source_plan_checksum_drift() {
        let dir = unique_dir("review-bound-plan-drift");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let review = dir.join("tiny.review");
        let output_dir = dir.join("source");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");
        write_reviewed_candidate_for_test(&input, "tiny-fixture", "q8_0", &review);
        rewrite_review_line(
            &review,
            "source_plan_mapping_checksum",
            "source_plan_mapping_checksum=0x0000000000000000",
        );

        let error =
            extract_source_path_with_review(&input, "tiny-fixture", &output_dir, Some(&review))
                .unwrap_err();

        assert!(error.to_string().contains("source_plan_mapping_checksum"));
        assert!(!output_dir.exists());
    }

    // Proves local config/tokenizer artifact evidence remains checksum-bound at extraction time.
    #[test]
    fn rejects_review_bound_extraction_source_artifact_checksum_drift() {
        let dir = unique_dir("review-bound-artifact-drift");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review = dir.join("tiny-bpe.review");
        let output_dir = dir.join("source");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "BPE");
        review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap();
        rewrite_review_line(
            &review,
            "source_tokenizer_artifact_checksum",
            "source_tokenizer_artifact_checksum=0x0000000000000000",
        );

        let error =
            extract_source_path_with_review(&input, "tiny-fixture-bpe", &output_dir, Some(&review))
                .unwrap_err();

        assert!(error
            .to_string()
            .contains("source_tokenizer_artifact_checksum"));
        assert!(!output_dir.exists());
    }

    // Proves normalized local artifact details remain part of review-bound extraction evidence.
    #[test]
    fn rejects_review_bound_extraction_source_artifact_detail_drift() {
        let dir = unique_dir("review-bound-artifact-detail-drift");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review = dir.join("tiny-bpe.review");
        let output_dir = dir.join("source");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "BPE");
        review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap();
        rewrite_review_line(
            &review,
            "source_tokenizer_artifact_detail",
            "source_tokenizer_artifact_detail=model_type:BPE;vocab_entries:6;max_token_id:260;merge_count:2",
        );

        let error =
            extract_source_path_with_review(&input, "tiny-fixture-bpe", &output_dir, Some(&review))
                .unwrap_err();

        assert!(error
            .to_string()
            .contains("source_tokenizer_artifact_detail"));
        assert!(!output_dir.exists());
    }

    // Proves reviewed local BPE tokenizer artifacts are carried into source and byte estimates.
    #[test]
    fn extracts_reviewed_bpe_tokenizer_artifact_into_source_manifest_and_estimate() {
        let dir = unique_dir("review-bound-bpe-tokenizer-manifest");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review = dir.join("tiny-bpe.review");
        let output_dir = dir.join("source");
        let output_slm = dir.join("tiny-bpe-q8.slm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let tokenizer = r#"{"version":"1.0","model":{"type":"BPE","vocab":{"<unk>":0,"t":116,"o":111,"to":260},"merges":["t o"]}}"#;
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts_with_tokenizer(&dir, tokenizer);

        review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe-custom-tokenizer",
            "sha256:tiny-bpe-custom-tokenizer",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review,
            Some("fixtures/reference-prompts/tiny-bpe-to.txt"),
            Some("0x0000000000000b04"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap();
        let review_text = fs::read_to_string(&review).unwrap();
        let review_fields = provenance::parse_manifest(&review_text).unwrap();
        let estimated_q8 = review_fields
            .get("q8_0_estimated_slm_bytes")
            .unwrap()
            .parse::<u64>()
            .unwrap();
        assert!(review_text.contains(
            "source_tokenizer_artifact_detail=model_type:BPE;vocab_entries:4;max_token_id:260;merge_count:1"
        ));

        convert_source_path_with_review(
            &input,
            "tiny-fixture-bpe",
            &output_dir,
            &output_slm,
            "q8_0",
            Some(&review),
        )
        .unwrap();

        let source_manifest = fs::read_to_string(output_dir.join("source.manifest")).unwrap();
        assert!(source_manifest.contains("tokenizer=bpe-v1"));
        assert!(source_manifest.contains("bpe_token_count=1"));
        assert!(source_manifest.contains("bpe_merge_count=1"));
        assert!(source_manifest.contains("bpe.token.0.bytes_hex=746f"));
        assert!(source_manifest.contains("bpe.merge.0.right=111"));
        assert!(!source_manifest.contains("bpe.token.0.bytes_hex=7468"));
        let actual_slm_bytes = fs::metadata(&output_slm).unwrap().len();
        assert_eq!(estimated_q8, actual_slm_bytes);
    }

    // Proves unsupported byte-level BPE remapping is rejected before extraction.
    #[test]
    fn rejects_reviewed_bpe_tokenizer_with_non_byte_fallback_merge() {
        let dir = unique_dir("review-bound-bpe-bytelevel-reject");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review = dir.join("tiny-bpe.review");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        let tokenizer = r#"{"version":"1.0","model":{"type":"BPE","vocab":{"\u0120":220,"t":116,"\u0120t":260},"merges":["\u0120 t"]}}"#;
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts_with_tokenizer(&dir, tokenizer);

        let error = review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe-bytelevel",
            "sha256:tiny-bpe-bytelevel",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review,
            Some("fixtures/reference-prompts/tiny-bpe.txt"),
            Some("0x0000000000000b05"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap_err();

        assert!(error.to_string().contains("non-byte-fallback token id"));
        assert!(!review.exists());
    }

    // Proves placeholder source or eval routes cannot pass the review-bound extraction gate.
    #[test]
    fn rejects_review_bound_extraction_with_pending_routes() {
        let dir = unique_dir("review-bound-pending");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let review = dir.join("tiny.review");
        let output_dir = dir.join("source");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");
        review_candidate_path(
            &input,
            "tiny-fixture",
            "q8_0",
            "Xenova/llama2.c-stories15M",
            "sha256:source",
            "0x00000000000000c1",
            "0x00000000000000c2",
            "license-review://xenova-15m",
            &review,
            None,
            None,
            None,
            None,
            None,
        )
        .unwrap();

        let error =
            extract_source_path_with_review(&input, "tiny-fixture", &output_dir, Some(&review))
                .unwrap_err();

        assert!(error.to_string().contains("source_config_route"));
        assert!(!output_dir.exists());
    }

    // Proves browser admission cannot choose a non-preferred quantization from the review.
    #[test]
    fn rejects_browser_bundle_review_quantization_preference_drift() {
        let dir = unique_dir("review-bound-browser-quant");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let review = dir.join("tiny.review");
        let output_dir = dir.join("source");
        let root = dir.join("tinyrustlm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");
        write_reviewed_candidate_for_test(&input, "tiny-fixture", "q8_0", &review);

        let error = browser_bundle_path_with_eval_cases_and_review(
            &input,
            "tiny-fixture",
            &output_dir,
            &root,
            "q4_0",
            None,
            Some(&review),
        )
        .unwrap_err();

        assert!(error
            .to_string()
            .contains("browser bundle quantization q4_0"));
        assert!(!output_dir.exists());
    }

    #[test]
    fn rejects_safetensors_source_plan_shape_mismatch() {
        let dir = unique_dir("source-plan-shape");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("shape-drift.safetensors");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", Some(vec![2080]), false);

        let error = source_plan_error(&input, "tiny-fixture");

        assert!(error.to_string().contains("shape was 2080, expected 260x8"));
    }

    #[test]
    fn rejects_safetensors_source_plan_missing_tensor() {
        let dir = unique_dir("source-plan-missing");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("missing.safetensors");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", None, true);

        let error = source_plan_error(&input, "tiny-fixture");

        assert!(error.to_string().contains("missing tensor"));
        assert!(error.to_string().contains("output.weight"));
    }

    #[test]
    fn rejects_safetensors_source_plan_extra_tensor() {
        let dir = unique_dir("source-plan-extra");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("extra.safetensors");
        write_source_plan_safetensors_with_extra(&input, "tiny-fixture", "F32");

        let error = source_plan_error(&input, "tiny-fixture");

        assert!(error
            .to_string()
            .contains("unsupported tensor extra.weight"));
    }

    #[test]
    fn rejects_safetensors_source_plan_integer_dtype() {
        let dir = unique_dir("source-plan-integer");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("integer.safetensors");
        write_source_plan_safetensors(&input, "tiny-fixture", "U8", None, false);

        let error = source_plan_error(&input, "tiny-fixture");

        assert!(error
            .to_string()
            .contains("source plan only supports F32, F16, or BF16"));
    }

    #[test]
    fn extracts_f32_safetensors_source_and_validates_output_dir() {
        let dir = unique_dir("source-extract-f32");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source.safetensors");
        let output_dir = dir.join("nested").join("source");
        write_source_extract_safetensors(&input, "tiny-fixture", "F32");

        extract_source_path(&input, "tiny-fixture", &output_dir).unwrap();

        let manifest = fs::read_to_string(output_dir.join("source.manifest")).unwrap();
        assert!(manifest.contains("source_kind=trained-export"));
        assert!(manifest.contains("source_id=safetensors-tensor-directory-0x"));
        assert!(manifest.contains("model_shape=tiny-fixture"));
        assert!(output_dir
            .join("tensors")
            .join("tok_embeddings_weight.f32")
            .exists());
        assert_eq!(
            read_first_f32(&output_dir.join("tensors").join("tok_embeddings_weight.f32")),
            1.0
        );
        trained_source::validate_source_path(&output_dir).unwrap();
    }

    #[test]
    fn extracts_f16_safetensors_source_to_f32_bytes() {
        let dir = unique_dir("source-extract-f16");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source-f16.safetensors");
        let output_dir = dir.join("source");
        write_source_extract_safetensors(&input, "tiny-fixture-tied", "F16");

        extract_source_path(&input, "tiny-fixture-tied", &output_dir).unwrap();

        assert_eq!(
            read_first_f32(&output_dir.join("tensors").join("tok_embeddings_weight.f32")),
            1.0
        );
        let manifest = fs::read_to_string(output_dir.join("source.manifest")).unwrap();
        assert!(manifest.contains("tied_output=true"));
        assert!(!manifest.contains("output.weight"));
        trained_source::validate_source_path(&output_dir).unwrap();
    }

    #[test]
    fn extracts_bf16_safetensors_source_to_f32_bytes() {
        let dir = unique_dir("source-extract-bf16");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-source-bf16.safetensors");
        let output_dir = dir.join("source");
        write_source_extract_safetensors(&input, "tiny-fixture-tied", "BF16");

        extract_source_path(&input, "tiny-fixture-tied", &output_dir).unwrap();

        assert_eq!(
            read_first_f32(&output_dir.join("tensors").join("tok_embeddings_weight.f32")),
            1.0
        );
        trained_source::validate_source_path(&output_dir).unwrap();
    }

    #[test]
    fn converts_huggingface_alias_safetensors_source_to_q8_slm() {
        let dir = unique_dir("source-convert-hf-q8");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output_dir = dir.join("source");
        let output_slm = dir.join("converted-q8.slm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");

        convert_source_path(&input, "tiny-fixture", &output_dir, &output_slm, "q8_0").unwrap();

        trained_source::validate_source_path(&output_dir).unwrap();
        let bytes = fs::read(&output_slm).unwrap();
        let report =
            slm_validate::validate_bytes(&bytes, &output_slm.display().to_string()).unwrap();
        assert_eq!(report.quantization_label(), "q8_0");
        provenance::validate_manifest_path(&output_slm, &slm_manifest_path(&output_slm)).unwrap();
    }

    #[test]
    fn converts_bf16_tied_safetensors_source_to_q4_slm() {
        let dir = unique_dir("source-convert-bf16-q4");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-tied-source.safetensors");
        let output_dir = dir.join("source");
        let output_slm = dir.join("converted-q4.slm");
        write_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-tied", "BF16");

        convert_source_path(
            &input,
            "tiny-fixture-tied",
            &output_dir,
            &output_slm,
            "q4_0",
        )
        .unwrap();

        let manifest = fs::read_to_string(output_dir.join("source.manifest")).unwrap();
        assert!(manifest.contains("tied_output=true"));
        trained_source::validate_source_path(&output_dir).unwrap();
        let bytes = fs::read(&output_slm).unwrap();
        let report =
            slm_validate::validate_bytes(&bytes, &output_slm.display().to_string()).unwrap();
        assert_eq!(report.quantization_label(), "q4_0");
        assert_eq!(report.output_contract_label(), "tied-output");
        provenance::validate_manifest_path(&output_slm, &slm_manifest_path(&output_slm)).unwrap();
    }

    #[test]
    fn rejects_safetensors_conversion_invalid_quantization_before_extraction() {
        let dir = unique_dir("source-convert-invalid-quant");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output_dir = dir.join("source");
        let output_slm = dir.join("converted-q2.slm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");

        let error = convert_source_path(&input, "tiny-fixture", &output_dir, &output_slm, "q2_0")
            .unwrap_err();

        assert!(error
            .to_string()
            .contains("converted output quantization must be f32, q8_0, or q4_0"));
        assert!(!output_dir.exists());
        assert!(!output_slm.exists());
    }

    #[test]
    fn writes_browser_bundle_from_huggingface_alias_safetensors_source() {
        let dir = unique_dir("browser-bundle-hf-q8");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output_dir = dir.join("source");
        let root = dir.join("tinyrustlm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");

        browser_bundle_path(&input, "tiny-fixture", &output_dir, &root, "q8_0").unwrap();

        trained_source::validate_source_path(&output_dir).unwrap();
        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry.0.candidate_id=converted-trained-q8"));
        assert!(registry.contains("entry.0.model_path=../models/converted-trained-q8.slm"));
        assert!(registry.contains("entry.0.quantization=q8_0"));
        assert!(registry.contains("entry.0.source_manifest_source_kind=trained-export"));
        assert!(
            registry.contains("entry.0.source_manifest_source_id=safetensors-tensor-directory-0x")
        );
        assert!(registry.contains("entry.0.source_manifest_model_shape=tiny-fixture"));
        let output_slm = root.join("models").join("converted-trained-q8.slm");
        let bytes = fs::read(&output_slm).unwrap();
        let report =
            slm_validate::validate_bytes(&bytes, &output_slm.display().to_string()).unwrap();
        assert_eq!(report.quantization_label(), "q8_0");
        provenance::validate_manifest_path(&output_slm, &slm_manifest_path(&output_slm)).unwrap();
        let eval = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.eval"),
        )
        .unwrap();
        assert!(eval.contains("cases_passed=2"));
        assert!(eval.contains("case.1.actual=eeee"));
        assert_browser_source_manifest_snapshot(&root, "converted-trained-q8");
        assert_browser_runtime_manifest(&root);
    }

    #[test]
    fn writes_browser_bundle_from_bpe_safetensors_source_with_review_gate() {
        let dir = unique_dir("browser-bundle-bpe-review");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-bpe-source.safetensors");
        let review = dir.join("tiny-bpe.review");
        let eval_cases = dir.join("tiny-bpe.eval-cases.txt");
        let output_dir = dir.join("source");
        let root = dir.join("tinyrustlm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture-bpe");
        fs::write(
            &eval_cases,
            "tinyrustlm_eval_cases_version=1\nscope=tiny-bpe-fixture-runtime-eval-only\nquality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality\nsafety_review_status=pass\nquality_decision=accepted-for-assistant-quality\nevaluator=unit-test-evaluator\neval_summary=BPE browser admission fixture route.\ncase_count=1\ncase.0.prompt=the\ncase.0.max_new_tokens=1\ncase.0.expected_text=e\ncase.0.required_result=exact\n",
        )
        .unwrap();
        let (config_route, config_checksum, tokenizer_route, tokenizer_checksum) =
            write_local_review_artifacts(&dir, "BPE");
        review_candidate_path(
            &input,
            "tiny-fixture-bpe",
            "q8_0",
            "local/tiny-bpe",
            "sha256:tiny-bpe",
            &config_checksum,
            &tokenizer_checksum,
            "license-review://tiny-bpe",
            &review,
            Some("fixtures/reference-prompts/tiny-bpe-the.txt"),
            Some("0x0000000000000b03"),
            Some("fixtures/eval/tiny-bpe.eval-cases.txt"),
            Some(&config_route),
            Some(&tokenizer_route),
        )
        .unwrap();

        browser_bundle_path_with_eval_cases_and_review(
            &input,
            "tiny-fixture-bpe",
            &output_dir,
            &root,
            "q8_0",
            Some(&eval_cases),
            Some(&review),
        )
        .unwrap();

        trained_source::validate_source_path(&output_dir).unwrap();
        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        let review_checksum = candidate_review_checksum(&review).unwrap();
        assert!(registry.contains("entry.0.candidate_id=converted-trained-q8"));
        assert!(registry.contains("entry.0.quantization=q8_0"));
        assert!(registry.contains("entry.0.source_manifest_model_shape=tiny-fixture-bpe"));
        assert!(registry.contains(&format!("entry.0.source_review_checksum={review_checksum}")));
        let output_slm = root.join("models").join("converted-trained-q8.slm");
        let bytes = fs::read(&output_slm).unwrap();
        assert_eq!(&bytes[SLM_HEADER_LEN..SLM_HEADER_LEN + 4], b"BPE1");
        let report =
            slm_validate::validate_bytes(&bytes, &output_slm.display().to_string()).unwrap();
        assert_eq!(report.quantization_label(), "q8_0");
        let eval = fs::read_to_string(
            root.join("evidence")
                .join("converted-trained-q8")
                .join("converted-trained.eval"),
        )
        .unwrap();
        assert!(eval.contains("quality_scope=tiny-bpe-fixture-runtime-eval-only"));
        assert!(eval.contains("cases_passed=1"));
        assert!(eval.contains("case.0.actual=e"));
        assert_browser_source_manifest_snapshot_shape(
            &root,
            "converted-trained-q8",
            "tiny-fixture-bpe",
        );
        assert_browser_runtime_manifest(&root);
    }

    #[test]
    fn writes_all_browser_bundle_from_huggingface_alias_safetensors_source() {
        let dir = unique_dir("browser-bundle-hf-all");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output_dir = dir.join("source");
        let root = dir.join("tinyrustlm");
        write_template_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture");

        browser_bundle_path(&input, "tiny-fixture", &output_dir, &root, "all").unwrap();

        trained_source::validate_source_path(&output_dir).unwrap();
        let registry = fs::read_to_string(root.join("models").join("selector.registry")).unwrap();
        assert!(registry.contains("entry_count=3"));
        assert!(registry.contains("selector_default_candidate_id=converted-trained-q4"));
        for (candidate_id, quantization) in [
            ("converted-trained-f32", "f32"),
            ("converted-trained-q8", "q8_0"),
            ("converted-trained-q4", "q4_0"),
        ] {
            assert!(registry.contains(&format!("candidate_id={candidate_id}")));
            assert!(registry.contains(&format!("quantization={quantization}")));
            assert!(registry.contains("source_manifest_source_kind=trained-export"));
            assert!(registry.contains("source_manifest_source_id=safetensors-tensor-directory-0x"));
            assert!(registry.contains("source_manifest_model_shape=tiny-fixture"));
            assert!(root
                .join("models")
                .join(format!("{candidate_id}.slm"))
                .exists());
            assert!(root
                .join("models")
                .join(format!("{candidate_id}.slm.manifest"))
                .exists());
            let eval = fs::read_to_string(
                root.join("evidence")
                    .join(candidate_id)
                    .join("converted-trained.eval"),
            )
            .unwrap();
            assert!(eval.contains("cases_passed=2"));
            assert_browser_source_manifest_snapshot(&root, candidate_id);
        }
        assert_browser_runtime_manifest(&root);
    }

    #[test]
    fn rejects_browser_bundle_invalid_quantization_before_extraction() {
        let dir = unique_dir("browser-bundle-invalid-quant");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("tiny-hf-source.safetensors");
        let output_dir = dir.join("source");
        let root = dir.join("tinyrustlm");
        write_source_extract_safetensors_with_hf_aliases(&input, "tiny-fixture", "F32");

        let error =
            browser_bundle_path(&input, "tiny-fixture", &output_dir, &root, "bf16").unwrap_err();

        assert!(error.to_string().contains(
            "browser-converted-trained-bundle quantization must be f32, q8_0, q4_0, or all"
        ));
        assert!(!output_dir.exists());
        assert!(!root.exists());
    }

    #[test]
    fn rejects_safetensors_source_extraction_shape_mismatch() {
        let dir = unique_dir("source-extract-shape");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("shape-drift.safetensors");
        let output_dir = dir.join("source");
        write_source_plan_safetensors(&input, "tiny-fixture", "F32", Some(vec![2080]), false);

        let error = extract_source_path(&input, "tiny-fixture", &output_dir).unwrap_err();

        assert!(error.to_string().contains("shape was 2080, expected 260x8"));
    }

    #[test]
    fn rejects_safetensors_source_extraction_integer_dtype() {
        let dir = unique_dir("source-extract-integer");
        fs::create_dir_all(&dir).unwrap();
        let input = dir.join("integer.safetensors");
        let output_dir = dir.join("source");
        write_source_plan_safetensors(&input, "tiny-fixture", "U8", None, false);

        let error = extract_source_path(&input, "tiny-fixture", &output_dir).unwrap_err();

        assert!(error
            .to_string()
            .contains("source plan only supports F32, F16, or BF16"));
    }

    // Builds a tiny safetensors-like file with real length prefix and data bytes.
    fn write_safetensors_file(path: &Path, header: &str, data_len: usize) {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&(header.len() as u64).to_le_bytes());
        bytes.extend_from_slice(header.as_bytes());
        bytes.extend(std::iter::repeat(0u8).take(data_len));
        fs::write(path, bytes).unwrap();
    }

    // Builds a safetensors-like file whose data length is real but not densely materialized.
    fn write_sparse_safetensors_file(path: &Path, header: &str, data_len: u64) {
        let mut file = File::create(path).unwrap();
        file.write_all(&(header.len() as u64).to_le_bytes())
            .unwrap();
        file.write_all(header.as_bytes()).unwrap();
        file.set_len(8 + header.len() as u64 + data_len).unwrap();
    }

    // Builds a tiny safetensors-like file with caller-supplied tensor data bytes.
    fn write_safetensors_file_with_data(path: &Path, header: &str, data: &[u8]) {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&(header.len() as u64).to_le_bytes());
        bytes.extend_from_slice(header.as_bytes());
        bytes.extend_from_slice(data);
        fs::write(path, bytes).unwrap();
    }

    // Returns a source-plan error without requiring the successful plan type to implement Debug.
    fn source_plan_error(path: &Path, shape_name: &str) -> io::Error {
        match build_source_plan(path, shape_name) {
            Ok(_) => panic!("source plan unexpectedly succeeded"),
            Err(error) => error,
        }
    }

    // Builds a safetensors-like file whose directory matches a TinyRustLM source shape.
    fn write_source_plan_safetensors(
        path: &Path,
        shape_name: &str,
        dtype: &str,
        first_shape_override: Option<Vec<u64>>,
        omit_output: bool,
    ) {
        write_source_plan_safetensors_with_name_map(
            path,
            shape_name,
            dtype,
            first_shape_override,
            omit_output,
            str::to_string,
        );
    }

    // Builds a source-plan safetensors fixture for large shapes without dense data bytes.
    fn write_sparse_source_plan_safetensors(path: &Path, shape_name: &str, dtype: &str) {
        let expectations = trained_source::source_tensor_expectations(shape_name).unwrap();
        let mut header = String::from("{");
        let mut offset = 0u64;
        for (index, expectation) in expectations.iter().enumerate() {
            if index > 0 {
                header.push(',');
            }
            let data_bytes = expectation
                .f32_bytes
                .checked_div(4)
                .unwrap()
                .checked_mul(dtype_byte_size(dtype).unwrap())
                .unwrap();
            push_safetensors_header_tensor(
                &mut header,
                &expectation.name,
                dtype,
                &expectation.dims,
                offset,
            );
            offset += data_bytes;
            header.push_str(&format!(",{offset}]}}"));
        }
        header.push('}');
        write_sparse_safetensors_file(path, &header, offset);
    }

    // Builds a source-plan safetensors fixture using Hugging Face Llama tensor aliases.
    fn write_source_plan_safetensors_with_hf_aliases(
        path: &Path,
        shape_name: &str,
        dtype: &str,
        first_shape_override: Option<Vec<u64>>,
        omit_output: bool,
    ) {
        write_source_plan_safetensors_with_name_map(
            path,
            shape_name,
            dtype,
            first_shape_override,
            omit_output,
            hf_alias_for_test,
        );
    }

    // Builds a source-plan safetensors fixture with a caller-selected source tensor name map.
    fn write_source_plan_safetensors_with_name_map<F>(
        path: &Path,
        shape_name: &str,
        dtype: &str,
        first_shape_override: Option<Vec<u64>>,
        omit_output: bool,
        source_name_for: F,
    ) where
        F: Fn(&str) -> String,
    {
        let expectations = trained_source::source_tensor_expectations(shape_name).unwrap();
        let mut header = String::from("{");
        let mut offset = 0u64;
        let mut wrote = false;
        for (index, expectation) in expectations.iter().enumerate() {
            if omit_output && expectation.name == "output.weight" {
                continue;
            }
            if wrote {
                header.push(',');
            }
            wrote = true;
            let shape = if index == 0 {
                first_shape_override
                    .clone()
                    .unwrap_or_else(|| expectation.dims.clone())
            } else {
                expectation.dims.clone()
            };
            let data_bytes = shape_element_count(&shape)
                .unwrap()
                .checked_mul(dtype_byte_size(dtype).unwrap())
                .unwrap();
            let source_name = source_name_for(&expectation.name);
            push_safetensors_header_tensor(&mut header, &source_name, dtype, &shape, offset);
            offset += data_bytes;
            header.push_str(&format!(",{offset}]}}"));
        }
        header.push('}');
        write_safetensors_file(path, &header, offset as usize);
    }

    // Adds the front half of one tensor header entry so tests can vary the final offset.
    fn push_safetensors_header_tensor(
        header: &mut String,
        name: &str,
        dtype: &str,
        shape: &[u64],
        offset: u64,
    ) {
        header.push('"');
        header.push_str(name);
        header.push_str("\":{\"dtype\":\"");
        header.push_str(dtype);
        header.push_str("\",\"shape\":[");
        header.push_str(
            &shape
                .iter()
                .map(u64::to_string)
                .collect::<Vec<_>>()
                .join(","),
        );
        header.push_str("],\"data_offsets\":[");
        header.push_str(&offset.to_string());
    }

    // Adds one unsupported tensor after the otherwise valid source tensor set.
    fn write_source_plan_safetensors_with_extra(path: &Path, shape_name: &str, dtype: &str) {
        let expectations = trained_source::source_tensor_expectations(shape_name).unwrap();
        let mut header = String::from("{");
        let mut offset = 0u64;
        for (index, expectation) in expectations.iter().enumerate() {
            if index > 0 {
                header.push(',');
            }
            let data_bytes = expectation
                .f32_bytes
                .checked_div(4)
                .unwrap()
                .checked_mul(dtype_byte_size(dtype).unwrap())
                .unwrap();
            push_safetensors_header_tensor(
                &mut header,
                &expectation.name,
                dtype,
                &expectation.dims,
                offset,
            );
            offset += data_bytes;
            header.push_str(&format!(",{offset}]}}"));
        }
        header.push_str(",\"extra.weight\":{\"dtype\":\"F32\",\"shape\":[1],\"data_offsets\":[");
        header.push_str(&offset.to_string());
        offset += 4;
        header.push_str(&format!(",{offset}]}}}}"));
        write_safetensors_file(path, &header, offset as usize);
    }

    // Builds a source-shaped safetensors file whose tensor values all decode to 1.0f32.
    fn write_source_extract_safetensors(path: &Path, shape_name: &str, dtype: &str) {
        write_source_extract_safetensors_with_name_map(path, shape_name, dtype, str::to_string);
    }

    // Builds a source-shaped safetensors file using Hugging Face Llama tensor aliases.
    fn write_source_extract_safetensors_with_hf_aliases(
        path: &Path,
        shape_name: &str,
        dtype: &str,
    ) {
        write_source_extract_safetensors_with_name_map(path, shape_name, dtype, hf_alias_for_test);
    }

    // Builds a safetensors file from the deterministic source template so eval evidence can pass.
    fn write_template_source_extract_safetensors_with_hf_aliases(path: &Path, shape_name: &str) {
        let source_dir = path.parent().unwrap().join("template-source");
        trained_source::write_source_template_path(&source_dir, shape_name).unwrap();
        write_template_source_extract_safetensors_with_name_map(
            path,
            shape_name,
            &source_dir,
            hf_alias_for_test,
        );
    }

    // Builds an F32 safetensors fixture by copying raw source-template tensor bytes.
    fn write_template_source_extract_safetensors_with_name_map<F>(
        path: &Path,
        shape_name: &str,
        source_dir: &Path,
        source_name_for: F,
    ) where
        F: Fn(&str) -> String,
    {
        let expectations = trained_source::source_tensor_expectations(shape_name).unwrap();
        let mut header = String::from("{");
        let mut data = Vec::new();
        let mut offset = 0u64;
        for (index, expectation) in expectations.iter().enumerate() {
            if index > 0 {
                header.push(',');
            }
            let tensor_bytes = fs::read(source_dir.join(&expectation.relative_file)).unwrap();
            assert_eq!(tensor_bytes.len() as u64, expectation.f32_bytes);
            let source_name = source_name_for(&expectation.name);
            push_safetensors_header_tensor(
                &mut header,
                &source_name,
                "F32",
                &expectation.dims,
                offset,
            );
            offset += tensor_bytes.len() as u64;
            header.push_str(&format!(",{offset}]}}"));
            data.extend_from_slice(&tensor_bytes);
        }
        header.push('}');
        assert_eq!(data.len(), offset as usize);
        write_safetensors_file_with_data(path, &header, &data);
    }

    // Builds an extractable safetensors fixture with a caller-selected source tensor name map.
    fn write_source_extract_safetensors_with_name_map<F>(
        path: &Path,
        shape_name: &str,
        dtype: &str,
        source_name_for: F,
    ) where
        F: Fn(&str) -> String,
    {
        let expectations = trained_source::source_tensor_expectations(shape_name).unwrap();
        let mut header = String::from("{");
        let mut data = Vec::new();
        let mut offset = 0u64;
        for (index, expectation) in expectations.iter().enumerate() {
            if index > 0 {
                header.push(',');
            }
            let element_count = expectation.f32_bytes / 4;
            let data_bytes = element_count
                .checked_mul(dtype_byte_size(dtype).unwrap())
                .unwrap();
            let source_name = source_name_for(&expectation.name);
            push_safetensors_header_tensor(
                &mut header,
                &source_name,
                dtype,
                &expectation.dims,
                offset,
            );
            offset += data_bytes;
            header.push_str(&format!(",{offset}]}}"));
            for _ in 0..element_count {
                data.extend_from_slice(&encoded_one(dtype));
            }
        }
        header.push('}');
        assert_eq!(data.len(), offset as usize);
        write_safetensors_file_with_data(path, &header, &data);
    }

    // Returns the Hugging Face alias used by the test fixture, falling back to the local name.
    fn hf_alias_for_test(local_name: &str) -> String {
        source_tensor_aliases(local_name)
            .last()
            .cloned()
            .unwrap_or_else(|| local_name.to_string())
    }

    // Mirrors the converted-trained sidecar convention used by trained_source.
    fn slm_manifest_path(output_slm: &Path) -> std::path::PathBuf {
        let mut manifest = output_slm.as_os_str().to_owned();
        manifest.push(".manifest");
        std::path::PathBuf::from(manifest)
    }

    // Confirms the browser bundle staged the runtime manifest used before WASM instantiation.
    fn assert_browser_runtime_manifest(root: &Path) {
        let manifest =
            fs::read_to_string(root.join("runtime").join("tinyrustlm.wasm.manifest")).unwrap();
        assert!(manifest.contains("tinyrustlm_wasm_manifest_version=1"));
        assert!(manifest.contains("runtime_wasm_checksum=0x"));
    }

    // Confirms safetensors-generated browser roots carry their reviewed source manifest snapshot.
    fn assert_browser_source_manifest_snapshot(root: &Path, candidate_id: &str) {
        assert_browser_source_manifest_snapshot_shape(root, candidate_id, "tiny-fixture");
    }

    // Confirms source-manifest snapshots keep the expected trained-source shape and tokenizer.
    fn assert_browser_source_manifest_snapshot_shape(
        root: &Path,
        candidate_id: &str,
        shape_name: &str,
    ) {
        let source_manifest = fs::read_to_string(
            root.join("evidence")
                .join(candidate_id)
                .join("converted-trained.source.manifest"),
        )
        .unwrap();
        assert!(source_manifest.contains("source_kind=trained-export"));
        assert!(source_manifest.contains("source_id=safetensors-tensor-directory-0x"));
        assert!(source_manifest.contains(&format!("model_shape={shape_name}")));
        if shape_name.ends_with("-bpe") {
            assert!(source_manifest.contains("tokenizer=bpe-v1"));
        }
    }

    // Writes a complete candidate review that the review-bound extraction gate can consume.
    fn write_reviewed_candidate_for_test(
        input: &Path,
        shape_name: &str,
        quantization: &str,
        output_review: &Path,
    ) {
        review_candidate_path(
            input,
            shape_name,
            quantization,
            "Xenova/llama2.c-stories15M",
            "sha256:source",
            "0x00000000000000c1",
            "0x00000000000000c2",
            "license-review://xenova-15m",
            output_review,
            Some("fixtures/reference-prompts/xenova-15m-hi.txt"),
            Some("0x00000000000000c3"),
            Some("fixtures/eval/xenova-15m.eval-cases.txt"),
            Some("fixtures/source-configs/xenova-15m.config.json"),
            Some("fixtures/tokenizers/xenova-15m.tokenizer.json"),
        )
        .unwrap();
    }

    // Writes local config/tokenizer JSON artifacts and returns their routes plus local checksums.
    fn write_local_review_artifacts(
        dir: &Path,
        tokenizer_model_type: &str,
    ) -> (String, String, String, String) {
        let tokenizer = if tokenizer_model_type == "BPE" {
            r#"{"version":"1.0","model":{"type":"BPE","vocab":{"<unk>":0,"t":116,"h":104,"e":101,"th":260,"the":261},"merges":["t h","th e"]}}"#.to_string()
        } else {
            format!(
                r#"{{"version":"1.0","model":{{"type":"{tokenizer_model_type}","unk_token":"[UNK]","vocab":{{"[UNK]":0}}}}}}"#
            )
        };
        write_local_review_artifacts_with_tokenizer(dir, &tokenizer)
    }

    // Writes local config JSON plus caller-supplied tokenizer JSON for review tests.
    fn write_local_review_artifacts_with_tokenizer(
        dir: &Path,
        tokenizer: &str,
    ) -> (String, String, String, String) {
        let config_path = dir.join("candidate.config.json");
        let tokenizer_path = dir.join("candidate.tokenizer.json");
        let config = r#"{"model_type":"llama","vocab_size":262,"hidden_size":8,"num_hidden_layers":1,"num_attention_heads":2,"num_key_value_heads":2,"intermediate_size":16,"max_position_embeddings":16,"rope_theta":10000.0}"#;
        let config_checksum = write_local_review_json(&config_path, config);
        let tokenizer_checksum = write_local_review_json(&tokenizer_path, tokenizer);
        (
            config_path.display().to_string(),
            config_checksum,
            tokenizer_path.display().to_string(),
            tokenizer_checksum,
        )
    }

    // Writes one JSON artifact and returns the text checksum expected by review validation.
    fn write_local_review_json(path: &Path, text: &str) -> String {
        fs::write(path, text).unwrap();
        hex64(provenance::text_checksum(text.as_bytes()))
    }

    // Rewrites one line-oriented review field while keeping the rest of the report intact.
    fn rewrite_review_line(path: &Path, key: &str, replacement: &str) {
        let text = fs::read_to_string(path).unwrap();
        let mut lines = text
            .lines()
            .map(|line| {
                if line.starts_with(&format!("{key}=")) {
                    replacement.to_string()
                } else {
                    line.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
        lines.push('\n');
        fs::write(path, lines).unwrap();
    }

    // Returns the dtype-specific encoding for an exact numeric 1.0 tensor value.
    fn encoded_one(dtype: &str) -> Vec<u8> {
        match dtype {
            "F32" => 1.0f32.to_le_bytes().to_vec(),
            "F16" => 0x3c00u16.to_le_bytes().to_vec(),
            "BF16" => 0x3f80u16.to_le_bytes().to_vec(),
            _ => panic!("unsupported test dtype {dtype}"),
        }
    }

    // Reads the first little-endian f32 value from an extracted raw source tensor.
    fn read_first_f32(path: &Path) -> f32 {
        let bytes = fs::read(path).unwrap();
        f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
    }

    // Creates a temp directory path unique enough for parallel cargo tests.
    fn unique_dir(label: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "tinyrustlm-safetensors-{label}-{}-{nanos}",
            std::process::id()
        ))
    }
}
