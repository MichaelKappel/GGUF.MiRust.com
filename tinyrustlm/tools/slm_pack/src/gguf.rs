//! GGUF metadata intake for future standard-model conversion.

use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::Path;

use crate::trained_source;

const GGUF_REPORT_VERSION: &str = "1";
const GGUF_SOURCE_PLAN_VERSION: &str = "1";
const GGUF_MAGIC: &[u8; 4] = b"GGUF";
const DEFAULT_ALIGNMENT: u64 = 32;
const MAX_METADATA_KV_COUNT: u64 = 100_000;
const MAX_TENSOR_COUNT: u64 = 1_000_000;
const MAX_STRING_BYTES: u64 = 1024 * 1024;
const MAX_METADATA_ARRAY_ITEMS: u64 = 1_000_000;
const MAX_DIMENSIONS: u32 = 8;
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
const GGUF_SOURCE_PLAN_LAYOUT: &str = "gguf-to-raw-f32-source-plan-v1";
const RAW_SOURCE_LAYOUT: &str = "raw-f32-tensor-files-v1";

#[derive(Clone, Debug)]
struct TensorInfo {
    name: String,
    type_name: &'static str,
    shape: Vec<u64>,
    element_count: u64,
    relative_offset: u64,
    absolute_start: u64,
    byte_count: u64,
    absolute_end: u64,
}

#[derive(Debug, Default)]
struct TypeStats {
    tensor_count: u64,
    parameter_count: u64,
    data_bytes: u64,
}

#[derive(Debug)]
struct GgufInspection {
    source_path: String,
    file_bytes: u64,
    version: u32,
    metadata_kv_count: u64,
    tensor_count: u64,
    alignment: u64,
    architecture: Option<String>,
    model_name: Option<String>,
    metadata_checksum: u64,
    tensor_directory_checksum: u64,
    tensor_directory_bytes: u64,
    tensor_data_offset: u64,
    tensor_data_bytes: u64,
    tensor_data_span_end: u64,
    tensors: Vec<TensorInfo>,
    type_stats: BTreeMap<&'static str, TypeStats>,
}

struct SourceTensorPlan {
    name: String,
    source_name: String,
    type_name: &'static str,
    shape: Vec<u64>,
    absolute_start: u64,
    absolute_end: u64,
    raw_source_file: String,
    raw_source_bytes: u64,
    conversion_action: &'static str,
}

struct SourcePlan {
    inspection: GgufInspection,
    target_model_shape: String,
    conversion_status: &'static str,
    raw_source_bytes: u64,
    tensors: Vec<SourceTensorPlan>,
}

struct GgufReader {
    file: File,
    offset: u64,
}

#[derive(Clone, Copy)]
struct GgmlType {
    id: u32,
    name: &'static str,
    block_size: u64,
    type_size: u64,
}

enum MetadataValueSummary {
    U32(u32),
    U64(u64),
    String(String),
    Other,
}

/// Reads a local `.gguf` file header and tensor directory without loading tensor data.
pub fn inspect_path(input: &Path, output_report: Option<&Path>) -> io::Result<()> {
    let inspection = inspect_input(input)?;
    let report = render_report(&inspection);
    if let Some(output) = output_report {
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output, &report)?;
    }
    println!("GGUF inspection: PASS");
    println!("source_path: {}", inspection.source_path);
    println!("gguf_version: {}", inspection.version);
    println!("tensor_count: {}", inspection.tensor_count);
    println!("tensor_data_bytes: {}", inspection.tensor_data_bytes);
    Ok(())
}

/// Writes a tiny deterministic GGUF file for public CLI and parser tests.
pub fn write_fixture_path(output: &Path) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = fixture_bytes()?;
    fs::write(output, bytes)?;
    println!("GGUF fixture written: {}", output.display());
    Ok(())
}

/// Writes a TinyRustLM source-compatible GGUF fixture for conversion smoke tests.
pub fn write_source_fixture_path(output: &Path, shape_name: &str) -> io::Result<()> {
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = source_fixture_bytes(shape_name)?;
    fs::write(output, bytes)?;
    println!("GGUF source fixture written: {}", output.display());
    println!("target_model_shape: {shape_name}");
    Ok(())
}

/// Plans how a local `.gguf` tensor directory maps into raw f32 source files.
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
    println!("GGUF source plan: PASS");
    println!("source_path: {}", plan.inspection.source_path);
    println!("target_model_shape: {}", plan.target_model_shape);
    println!("matched_tensor_count: {}", plan.tensors.len());
    println!("raw_source_bytes: {}", plan.raw_source_bytes);
    println!("conversion_status: {}", plan.conversion_status);
    Ok(())
}

/// Extracts checked unquantized GGUF tensors into the raw f32 trained-source layout.
pub fn extract_source_path(input: &Path, shape_name: &str, output_dir: &Path) -> io::Result<()> {
    let plan = build_source_plan(input, shape_name)?;
    let payloads = extract_source_payloads(input, &plan)?;
    let source_id = format!(
        "gguf-tensor-directory-{}",
        hex64(plan.inspection.tensor_directory_checksum)
    );
    let source_training_summary = format!(
        "Extracted {} checked GGUF tensors into TinyRustLM raw f32 source layout",
        plan.tensors.len()
    );
    let metadata = trained_source::SourceExportMetadata {
        source_id: &source_id,
        source_license: "local-gguf-source-review",
        source_dataset: "local-gguf-source-export",
        source_training_summary: &source_training_summary,
        source_review_kind: None,
        source_review_status: None,
        source_review_checksum: None,
        source_review_required_next_gate: None,
        source_tokenizer_override: None,
    };
    trained_source::write_source_export_path(output_dir, shape_name, &metadata, &payloads)?;
    println!("GGUF source extraction: PASS");
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

/// Converts checked unquantized GGUF tensors into an `.slm` through the raw source layout.
pub fn convert_source_path(
    input: &Path,
    shape_name: &str,
    output_source_dir: &Path,
    output_slm: &Path,
    output_quantization: &str,
) -> io::Result<()> {
    trained_source::validate_output_quantization(output_quantization)?;
    extract_source_path(input, shape_name, output_source_dir)?;
    trained_source::validate_source_path(output_source_dir)?;
    trained_source::convert_trained_path(output_source_dir, output_slm, output_quantization)?;
    println!("GGUF trained conversion: PASS");
    println!("source_path: {}", input.display());
    println!("target_model_shape: {shape_name}");
    println!("output_quantization: {output_quantization}");
    println!("output_slm: {}", output_slm.display());
    Ok(())
}

fn inspect_input(input: &Path) -> io::Result<GgufInspection> {
    let mut reader = GgufReader::open(input)?;
    let file_bytes = reader.file.metadata()?.len();
    let magic = reader.read_bytes(4)?;
    if magic.as_slice() != GGUF_MAGIC {
        return invalid_data("not a GGUF file: missing GGUF magic");
    }
    let version = reader.read_u32()?;
    if version != 2 && version != 3 {
        return invalid_data(format!("unsupported GGUF version {version}"));
    }

    let tensor_count = reader.read_u64()?;
    let metadata_kv_count = reader.read_u64()?;
    if tensor_count == 0 {
        return invalid_data("GGUF inspection requires at least one tensor");
    }
    if tensor_count > MAX_TENSOR_COUNT {
        return invalid_data(format!(
            "GGUF tensor count {tensor_count} exceeds limit {MAX_TENSOR_COUNT}"
        ));
    }
    if metadata_kv_count > MAX_METADATA_KV_COUNT {
        return invalid_data(format!(
            "GGUF metadata count {metadata_kv_count} exceeds limit {MAX_METADATA_KV_COUNT}"
        ));
    }

    let mut metadata_checksum = FNV_OFFSET;
    let mut alignment = DEFAULT_ALIGNMENT;
    let mut architecture = None;
    let mut model_name = None;
    for _ in 0..metadata_kv_count {
        let key = reader.read_string()?;
        fnv_update(&mut metadata_checksum, key.as_bytes());
        let value_type = reader.read_u32()?;
        fnv_update(&mut metadata_checksum, &value_type.to_le_bytes());
        let value = read_metadata_value(&mut reader, value_type, &mut metadata_checksum)?;
        match (key.as_str(), value) {
            ("general.alignment", MetadataValueSummary::U32(value)) => {
                alignment = u64::from(value);
            }
            ("general.alignment", MetadataValueSummary::U64(value)) => {
                alignment = value;
            }
            ("general.architecture", MetadataValueSummary::String(value)) => {
                architecture = Some(value);
            }
            ("general.name", MetadataValueSummary::String(value)) => {
                model_name = Some(value);
            }
            _ => {}
        }
    }
    validate_alignment(alignment)?;

    let tensor_directory_start = reader.offset;
    let mut tensor_directory_checksum = FNV_OFFSET;
    let mut tensors = Vec::new();
    for _ in 0..tensor_count {
        let tensor = read_tensor_info(&mut reader, &mut tensor_directory_checksum)?;
        tensors.push(tensor);
    }
    let tensor_directory_bytes = reader
        .offset
        .checked_sub(tensor_directory_start)
        .ok_or_else(|| invalid_data_error("GGUF tensor directory offset underflow"))?;
    let tensor_data_offset = align_to(reader.offset, alignment)?;
    if file_bytes < tensor_data_offset {
        return invalid_data(format!(
            "GGUF tensor data offset {tensor_data_offset} exceeds file size {file_bytes}"
        ));
    }

    let mut spans = Vec::new();
    let mut resolved_tensors = Vec::with_capacity(tensors.len());
    for mut tensor in tensors {
        if tensor.relative_offset % alignment != 0 {
            return invalid_data(format!(
                "GGUF tensor {} relative offset {} is not aligned to {} bytes",
                tensor.name, tensor.relative_offset, alignment
            ));
        }
        tensor.absolute_start = tensor_data_offset
            .checked_add(tensor.relative_offset)
            .ok_or_else(|| invalid_data_error("GGUF tensor absolute offset overflow"))?;
        tensor.absolute_end = tensor
            .absolute_start
            .checked_add(tensor.byte_count)
            .ok_or_else(|| invalid_data_error("GGUF tensor byte range overflow"))?;
        if tensor.absolute_end > file_bytes {
            return invalid_data(format!(
                "GGUF tensor {} ends at byte {} beyond file size {}",
                tensor.name, tensor.absolute_end, file_bytes
            ));
        }
        spans.push((
            tensor.absolute_start,
            tensor.absolute_end,
            tensor.name.clone(),
        ));
        resolved_tensors.push(tensor);
    }
    spans.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(&right.1)));
    let mut previous_end = tensor_data_offset;
    let mut previous_name = String::new();
    for (start, end, name) in spans {
        if start < previous_end {
            return invalid_data(format!(
                "GGUF tensor {name} overlaps previous tensor {previous_name}"
            ));
        }
        previous_end = end;
        previous_name = name;
    }

    let mut type_stats = BTreeMap::new();
    let mut tensor_data_bytes = 0u64;
    let mut tensor_data_span_end = tensor_data_offset;
    for tensor in &resolved_tensors {
        let stats = type_stats
            .entry(tensor.type_name)
            .or_insert_with(TypeStats::default);
        stats.tensor_count += 1;
        stats.parameter_count = stats
            .parameter_count
            .checked_add(tensor.element_count)
            .ok_or_else(|| invalid_data_error("GGUF type parameter count overflow"))?;
        stats.data_bytes = stats
            .data_bytes
            .checked_add(tensor.byte_count)
            .ok_or_else(|| invalid_data_error("GGUF type byte count overflow"))?;
        tensor_data_bytes = tensor_data_bytes
            .checked_add(tensor.byte_count)
            .ok_or_else(|| invalid_data_error("GGUF tensor data byte count overflow"))?;
        tensor_data_span_end = tensor_data_span_end.max(tensor.absolute_end);
    }

    Ok(GgufInspection {
        source_path: input.display().to_string(),
        file_bytes,
        version,
        metadata_kv_count,
        tensor_count,
        alignment,
        architecture,
        model_name,
        metadata_checksum,
        tensor_directory_checksum,
        tensor_directory_bytes,
        tensor_data_offset,
        tensor_data_bytes,
        tensor_data_span_end,
        tensors: resolved_tensors,
        type_stats,
    })
}

fn read_tensor_info(
    reader: &mut GgufReader,
    tensor_directory_checksum: &mut u64,
) -> io::Result<TensorInfo> {
    let name = reader.read_string()?;
    fnv_update(tensor_directory_checksum, name.as_bytes());
    let n_dimensions = reader.read_u32()?;
    fnv_update(tensor_directory_checksum, &n_dimensions.to_le_bytes());
    if n_dimensions == 0 || n_dimensions > MAX_DIMENSIONS {
        return invalid_data(format!(
            "GGUF tensor {name} has unsupported dimension count {n_dimensions}"
        ));
    }
    let mut shape = Vec::with_capacity(n_dimensions as usize);
    for _ in 0..n_dimensions {
        let dimension = reader.read_u64()?;
        fnv_update(tensor_directory_checksum, &dimension.to_le_bytes());
        if dimension == 0 {
            return invalid_data(format!("GGUF tensor {name} has a zero dimension"));
        }
        shape.push(dimension);
    }
    let type_id = reader.read_u32()?;
    fnv_update(tensor_directory_checksum, &type_id.to_le_bytes());
    let relative_offset = reader.read_u64()?;
    fnv_update(tensor_directory_checksum, &relative_offset.to_le_bytes());

    let ggml_type = ggml_type(type_id)
        .ok_or_else(|| invalid_data_error(format!("unsupported GGUF tensor type id {type_id}")))?;
    let element_count = element_count(&shape)?;
    let byte_count = tensor_byte_count(&name, element_count, ggml_type)?;
    Ok(TensorInfo {
        name,
        type_name: ggml_type.name,
        shape,
        element_count,
        relative_offset,
        absolute_start: 0,
        byte_count,
        absolute_end: 0,
    })
}

fn read_metadata_value(
    reader: &mut GgufReader,
    value_type: u32,
    checksum: &mut u64,
) -> io::Result<MetadataValueSummary> {
    match value_type {
        0 => {
            let value = reader.read_bytes(1)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        1 => {
            let value = reader.read_bytes(1)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        2 => {
            let value = reader.read_bytes(2)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        3 => {
            let value = reader.read_bytes(2)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        4 => {
            let value = reader.read_u32()?;
            fnv_update(checksum, &value.to_le_bytes());
            Ok(MetadataValueSummary::U32(value))
        }
        5 => {
            let value = reader.read_bytes(4)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        6 => {
            let value = reader.read_bytes(4)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        7 => {
            let value = reader.read_bytes(1)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        8 => {
            let value = reader.read_string()?;
            fnv_update(checksum, value.as_bytes());
            Ok(MetadataValueSummary::String(value))
        }
        9 => {
            let element_type = reader.read_u32()?;
            fnv_update(checksum, &element_type.to_le_bytes());
            if element_type == 9 {
                return invalid_data("nested GGUF metadata arrays are not supported");
            }
            let length = reader.read_u64()?;
            fnv_update(checksum, &length.to_le_bytes());
            if length > MAX_METADATA_ARRAY_ITEMS {
                return invalid_data(format!(
                    "GGUF metadata array length {length} exceeds limit {MAX_METADATA_ARRAY_ITEMS}"
                ));
            }
            for _ in 0..length {
                read_metadata_value(reader, element_type, checksum)?;
            }
            Ok(MetadataValueSummary::Other)
        }
        10 => {
            let value = reader.read_u64()?;
            fnv_update(checksum, &value.to_le_bytes());
            Ok(MetadataValueSummary::U64(value))
        }
        11 => {
            let value = reader.read_bytes(8)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        12 => {
            let value = reader.read_bytes(8)?;
            fnv_update(checksum, &value);
            Ok(MetadataValueSummary::Other)
        }
        _ => invalid_data(format!("unsupported GGUF metadata value type {value_type}")),
    }
}

fn render_report(inspection: &GgufInspection) -> String {
    let mut out = String::new();
    push_field(
        &mut out,
        "tinyrustlm_gguf_inspection_version",
        GGUF_REPORT_VERSION,
    );
    push_field(
        &mut out,
        "source_layout",
        &format!("gguf-v{}", inspection.version),
    );
    push_field(&mut out, "source_path", &inspection.source_path);
    push_field(&mut out, "file_bytes", &inspection.file_bytes.to_string());
    push_field(&mut out, "gguf.version", &inspection.version.to_string());
    push_field(
        &mut out,
        "metadata_kv_count",
        &inspection.metadata_kv_count.to_string(),
    );
    push_field(
        &mut out,
        "tensor_count",
        &inspection.tensor_count.to_string(),
    );
    push_field(&mut out, "alignment", &inspection.alignment.to_string());
    push_field(
        &mut out,
        "architecture",
        inspection.architecture.as_deref().unwrap_or("unknown"),
    );
    push_field(
        &mut out,
        "model_name",
        inspection.model_name.as_deref().unwrap_or("unknown"),
    );
    push_field(
        &mut out,
        "metadata_checksum",
        &format!("0x{:016x}", inspection.metadata_checksum),
    );
    push_field(
        &mut out,
        "tensor_directory_checksum",
        &format!("0x{:016x}", inspection.tensor_directory_checksum),
    );
    push_field(
        &mut out,
        "tensor_directory_bytes",
        &inspection.tensor_directory_bytes.to_string(),
    );
    push_field(
        &mut out,
        "tensor_data_offset",
        &inspection.tensor_data_offset.to_string(),
    );
    push_field(
        &mut out,
        "tensor_data_bytes",
        &inspection.tensor_data_bytes.to_string(),
    );
    push_field(
        &mut out,
        "tensor_data_span_end",
        &inspection.tensor_data_span_end.to_string(),
    );
    push_field(
        &mut out,
        "type_stats_count",
        &inspection.type_stats.len().to_string(),
    );
    for (index, (type_name, stats)) in inspection.type_stats.iter().enumerate() {
        push_field(&mut out, &format!("type.{index}.name"), type_name);
        push_field(
            &mut out,
            &format!("type.{index}.tensor_count"),
            &stats.tensor_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("type.{index}.parameter_count"),
            &stats.parameter_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("type.{index}.data_bytes"),
            &stats.data_bytes.to_string(),
        );
    }
    for (index, tensor) in inspection.tensors.iter().enumerate() {
        push_field(&mut out, &format!("tensor.{index}.name"), &tensor.name);
        push_field(&mut out, &format!("tensor.{index}.type"), tensor.type_name);
        push_field(
            &mut out,
            &format!("tensor.{index}.shape"),
            &shape_text(&tensor.shape),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.element_count"),
            &tensor.element_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.relative_offset"),
            &tensor.relative_offset.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.absolute_start"),
            &tensor.absolute_start.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.byte_count"),
            &tensor.byte_count.to_string(),
        );
        push_field(
            &mut out,
            &format!("tensor.{index}.absolute_end"),
            &tensor.absolute_end.to_string(),
        );
    }
    out
}

fn build_source_plan(input: &Path, shape_name: &str) -> io::Result<SourcePlan> {
    let inspection = inspect_input(input)?;
    let expectations = trained_source::source_tensor_expectations(shape_name)?;
    let mut by_name = BTreeMap::new();
    for tensor in &inspection.tensors {
        if by_name.insert(tensor.name.clone(), tensor).is_some() {
            return invalid_data("GGUF source plan found duplicate tensor names");
        }
    }

    let mut tensors = Vec::with_capacity(expectations.len());
    let mut raw_source_bytes = 0u64;
    let mut requires_decode = false;
    for expectation in expectations {
        let (source_name, tensor) = take_source_tensor(&mut by_name, &expectation.name)?;
        if tensor.shape != expectation.dims {
            return invalid_data(format!(
                "GGUF tensor {} shape was {}, expected {}",
                tensor.name,
                shape_text(&tensor.shape),
                shape_text(&expectation.dims)
            ));
        }
        let conversion_action = source_conversion_action(tensor.type_name)?;
        requires_decode |= conversion_action != "copy-f32";
        raw_source_bytes = raw_source_bytes
            .checked_add(expectation.f32_bytes)
            .ok_or_else(|| invalid_data_error("GGUF source plan raw byte count overflow"))?;
        tensors.push(SourceTensorPlan {
            name: expectation.name,
            source_name,
            type_name: tensor.type_name,
            shape: tensor.shape.clone(),
            absolute_start: tensor.absolute_start,
            absolute_end: tensor.absolute_end,
            raw_source_file: expectation.relative_file,
            raw_source_bytes: expectation.f32_bytes,
            conversion_action,
        });
    }
    if let Some(extra_name) = by_name.keys().next() {
        return invalid_data(format!(
            "GGUF source plan found unsupported tensor {extra_name}"
        ));
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
        return invalid_data(format!(
            "GGUF source plan matched multiple source names for {local_name}: {}",
            matches.join(", ")
        ));
    }
    let Some(source_name) = matches.pop() else {
        return invalid_data(format!(
            "GGUF source plan missing tensor {local_name} (accepted source names: {})",
            aliases.join(", ")
        ));
    };
    let tensor = by_name
        .remove(&source_name)
        .ok_or_else(|| invalid_data_error("GGUF source plan alias lookup drifted"))?;
    Ok((source_name, tensor))
}

fn source_tensor_aliases(local_name: &str) -> Vec<String> {
    let mut names = vec![local_name.to_string()];
    if let Some(alias) = gguf_alias_for_local(local_name) {
        names.push(alias);
    }
    names
}

fn gguf_alias_for_local(local_name: &str) -> Option<String> {
    match local_name {
        "tok_embeddings.weight" => Some("token_embd.weight".to_string()),
        "norm.weight" => Some("output_norm.weight".to_string()),
        "output.weight" => Some("output.weight".to_string()),
        _ => {
            let (layer, suffix) = local_layer_suffix(local_name)?;
            let alias_suffix = gguf_layer_alias_suffix(suffix)?;
            Some(format!("blk.{layer}.{alias_suffix}"))
        }
    }
}

fn local_layer_suffix(local_name: &str) -> Option<(&str, &str)> {
    let rest = local_name.strip_prefix("layers.")?;
    rest.split_once('.')
}

fn gguf_layer_alias_suffix(local_suffix: &str) -> Option<&'static str> {
    match local_suffix {
        "attention_norm.weight" => Some("attn_norm.weight"),
        "ffn_norm.weight" => Some("ffn_norm.weight"),
        "wq.weight" => Some("attn_q.weight"),
        "wk.weight" => Some("attn_k.weight"),
        "wv.weight" => Some("attn_v.weight"),
        "wo.weight" => Some("attn_output.weight"),
        "w1.weight" => Some("ffn_gate.weight"),
        "w2.weight" => Some("ffn_down.weight"),
        "w3.weight" => Some("ffn_up.weight"),
        _ => None,
    }
}

fn source_conversion_action(type_name: &str) -> io::Result<&'static str> {
    match type_name {
        "F32" => Ok("copy-f32"),
        "F16" => Ok("decode-f16"),
        "BF16" => Ok("decode-bf16"),
        _ => invalid_data(format!(
            "GGUF source extraction only supports F32, F16, or BF16 tensors, not {type_name}"
        )),
    }
}

fn extract_source_payloads(
    input: &Path,
    plan: &SourcePlan,
) -> io::Result<Vec<trained_source::SourceTensorPayload>> {
    let mut file = File::open(input)?;
    let mut payloads = Vec::with_capacity(plan.tensors.len());
    for tensor in &plan.tensors {
        let raw_len = tensor
            .absolute_end
            .checked_sub(tensor.absolute_start)
            .ok_or_else(|| invalid_data_error("GGUF tensor source offset underflow"))?;
        let raw_len = usize::try_from(raw_len)
            .map_err(|_| invalid_data_error("GGUF tensor slice is too large for this host"))?;
        let mut raw = vec![0u8; raw_len];
        file.seek(SeekFrom::Start(tensor.absolute_start))?;
        file.read_exact(&mut raw)?;
        let bytes = decode_source_tensor_to_f32(tensor.type_name, &raw)?;
        if bytes.len() as u64 != tensor.raw_source_bytes {
            return invalid_data(format!(
                "GGUF tensor {} decoded to {} bytes, expected {}",
                tensor.name,
                bytes.len(),
                tensor.raw_source_bytes
            ));
        }
        payloads.push(trained_source::SourceTensorPayload {
            name: tensor.name.clone(),
            bytes,
        });
    }
    Ok(payloads)
}

fn decode_source_tensor_to_f32(type_name: &str, raw: &[u8]) -> io::Result<Vec<u8>> {
    match type_name {
        "F32" => {
            if raw.len() % 4 != 0 {
                return invalid_data("F32 GGUF payload length must divide by four");
            }
            Ok(raw.to_vec())
        }
        "F16" => decode_f16_payload_to_f32(raw),
        "BF16" => decode_bf16_payload_to_f32(raw),
        _ => invalid_data(format!(
            "GGUF source extraction only supports F32, F16, or BF16 tensors, not {type_name}"
        )),
    }
}

fn decode_f16_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if raw.len() % 2 != 0 {
        return invalid_data("F16 GGUF payload length must divide by two");
    }
    let mut bytes = Vec::with_capacity(raw.len() * 2);
    for chunk in raw.chunks_exact(2) {
        let bits = u16::from_le_bytes([chunk[0], chunk[1]]);
        bytes.extend_from_slice(&f16_bits_to_f32(bits).to_le_bytes());
    }
    Ok(bytes)
}

fn decode_bf16_payload_to_f32(raw: &[u8]) -> io::Result<Vec<u8>> {
    if raw.len() % 2 != 0 {
        return invalid_data("BF16 GGUF payload length must divide by two");
    }
    let mut bytes = Vec::with_capacity(raw.len() * 2);
    for chunk in raw.chunks_exact(2) {
        let high = u16::from_le_bytes([chunk[0], chunk[1]]);
        bytes.extend_from_slice(&f32::from_bits(u32::from(high) << 16).to_le_bytes());
    }
    Ok(bytes)
}

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

fn render_source_plan(plan: &SourcePlan) -> String {
    let mut out = String::new();
    push_field(
        &mut out,
        "tinyrustlm_gguf_source_plan_version",
        GGUF_SOURCE_PLAN_VERSION,
    );
    push_field(&mut out, "plan_layout", GGUF_SOURCE_PLAN_LAYOUT);
    push_field(
        &mut out,
        "source_layout",
        &format!("gguf-v{}", plan.inspection.version),
    );
    push_field(&mut out, "target_source_layout", RAW_SOURCE_LAYOUT);
    push_field(&mut out, "source_path", &plan.inspection.source_path);
    push_field(&mut out, "target_model_shape", &plan.target_model_shape);
    push_field(
        &mut out,
        "gguf_tensor_count",
        &plan.inspection.tensor_count.to_string(),
    );
    push_field(
        &mut out,
        "matched_tensor_count",
        &plan.tensors.len().to_string(),
    );
    push_field(
        &mut out,
        "gguf_tensor_data_bytes",
        &plan.inspection.tensor_data_bytes.to_string(),
    );
    push_field(
        &mut out,
        "raw_source_bytes",
        &plan.raw_source_bytes.to_string(),
    );
    push_field(
        &mut out,
        "tensor_directory_checksum",
        &hex64(plan.inspection.tensor_directory_checksum),
    );
    push_field(
        &mut out,
        "source_plan_mapping_checksum",
        &hex64(source_plan_mapping_checksum(&plan.tensors)),
    );
    push_field(&mut out, "conversion_status", plan.conversion_status);
    push_field(&mut out, "required_next_gate", "extract-raw-f32-tensors");
    for (index, tensor) in plan.tensors.iter().enumerate() {
        let prefix = format!("tensor.{index}");
        push_field(&mut out, &format!("{prefix}.name"), &tensor.name);
        push_field(
            &mut out,
            &format!("{prefix}.gguf_name"),
            &tensor.source_name,
        );
        push_field(&mut out, &format!("{prefix}.gguf_type"), tensor.type_name);
        push_field(
            &mut out,
            &format!("{prefix}.gguf_shape"),
            &shape_text(&tensor.shape),
        );
        push_field(
            &mut out,
            &format!("{prefix}.gguf_data_start"),
            &tensor.absolute_start.to_string(),
        );
        push_field(
            &mut out,
            &format!("{prefix}.gguf_data_end"),
            &tensor.absolute_end.to_string(),
        );
        push_field(
            &mut out,
            &format!("{prefix}.raw_source_file"),
            &tensor.raw_source_file,
        );
        push_field(
            &mut out,
            &format!("{prefix}.raw_source_bytes"),
            &tensor.raw_source_bytes.to_string(),
        );
        push_field(
            &mut out,
            &format!("{prefix}.conversion_action"),
            tensor.conversion_action,
        );
    }
    out
}

fn source_plan_mapping_checksum(tensors: &[SourceTensorPlan]) -> u64 {
    let mut checksum = FNV_OFFSET;
    for tensor in tensors {
        fnv_update(&mut checksum, tensor.name.as_bytes());
        fnv_update(&mut checksum, tensor.source_name.as_bytes());
        fnv_update(&mut checksum, tensor.type_name.as_bytes());
        fnv_update(&mut checksum, shape_text(&tensor.shape).as_bytes());
        fnv_update(&mut checksum, tensor.raw_source_file.as_bytes());
        fnv_update(&mut checksum, &tensor.raw_source_bytes.to_le_bytes());
        fnv_update(&mut checksum, tensor.conversion_action.as_bytes());
    }
    checksum
}

fn ggml_type(type_id: u32) -> Option<GgmlType> {
    let (name, block_size, type_size) = match type_id {
        0 => ("F32", 1, 4),
        1 => ("F16", 1, 2),
        2 => ("Q4_0", 32, 18),
        3 => ("Q4_1", 32, 20),
        6 => ("Q5_0", 32, 22),
        7 => ("Q5_1", 32, 24),
        8 => ("Q8_0", 32, 34),
        9 => ("Q8_1", 32, 40),
        10 => ("Q2_K", 256, 84),
        11 => ("Q3_K", 256, 110),
        12 => ("Q4_K", 256, 144),
        13 => ("Q5_K", 256, 176),
        14 => ("Q6_K", 256, 210),
        15 => ("Q8_K", 256, 292),
        24 => ("I8", 1, 1),
        25 => ("I16", 1, 2),
        26 => ("I32", 1, 4),
        27 => ("I64", 1, 8),
        28 => ("F64", 1, 8),
        30 => ("BF16", 1, 2),
        _ => return None,
    };
    Some(GgmlType {
        id: type_id,
        name,
        block_size,
        type_size,
    })
}

fn tensor_byte_count(name: &str, element_count: u64, ggml_type: GgmlType) -> io::Result<u64> {
    if element_count % ggml_type.block_size != 0 {
        return invalid_data(format!(
            "GGUF tensor {name} element count {element_count} is not divisible by block size {} for type {}",
            ggml_type.block_size, ggml_type.name
        ));
    }
    element_count
        .checked_div(ggml_type.block_size)
        .and_then(|blocks| blocks.checked_mul(ggml_type.type_size))
        .ok_or_else(|| {
            invalid_data_error(format!(
                "GGUF tensor {name} byte count overflow for type id {}",
                ggml_type.id
            ))
        })
}

fn element_count(shape: &[u64]) -> io::Result<u64> {
    let mut count = 1u64;
    for dimension in shape {
        count = count
            .checked_mul(*dimension)
            .ok_or_else(|| invalid_data_error("GGUF tensor element count overflow"))?;
    }
    Ok(count)
}

fn validate_alignment(alignment: u64) -> io::Result<()> {
    if alignment == 0 {
        return invalid_data("GGUF alignment must be non-zero");
    }
    if !alignment.is_power_of_two() {
        return invalid_data(format!("GGUF alignment {alignment} is not a power of two"));
    }
    Ok(())
}

fn align_to(value: u64, alignment: u64) -> io::Result<u64> {
    validate_alignment(alignment)?;
    let remainder = value % alignment;
    if remainder == 0 {
        return Ok(value);
    }
    value
        .checked_add(alignment - remainder)
        .ok_or_else(|| invalid_data_error("GGUF alignment overflow"))
}

fn push_field(out: &mut String, key: &str, value: &str) {
    out.push_str(key);
    out.push('=');
    out.push_str(value);
    out.push('\n');
}

fn shape_text(shape: &[u64]) -> String {
    shape
        .iter()
        .map(u64::to_string)
        .collect::<Vec<_>>()
        .join("x")
}

fn fnv_update(checksum: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *checksum ^= u64::from(*byte);
        *checksum = checksum.wrapping_mul(FNV_PRIME);
    }
}

fn invalid_data<T>(message: impl Into<String>) -> io::Result<T> {
    Err(invalid_data_error(message))
}

fn invalid_data_error(message: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message.into())
}

impl GgufReader {
    fn open(path: &Path) -> io::Result<Self> {
        Ok(Self {
            file: File::open(path)?,
            offset: 0,
        })
    }

    fn read_bytes(&mut self, length: usize) -> io::Result<Vec<u8>> {
        let mut bytes = vec![0u8; length];
        self.file.read_exact(&mut bytes)?;
        self.offset = self
            .offset
            .checked_add(length as u64)
            .ok_or_else(|| invalid_data_error("GGUF reader offset overflow"))?;
        Ok(bytes)
    }

    fn read_u32(&mut self) -> io::Result<u32> {
        let bytes = self.read_bytes(4)?;
        Ok(u32::from_le_bytes(
            bytes.try_into().expect("u32 read length"),
        ))
    }

    fn read_u64(&mut self) -> io::Result<u64> {
        let bytes = self.read_bytes(8)?;
        Ok(u64::from_le_bytes(
            bytes.try_into().expect("u64 read length"),
        ))
    }

    fn read_string(&mut self) -> io::Result<String> {
        let length = self.read_u64()?;
        if length > MAX_STRING_BYTES {
            return invalid_data(format!(
                "GGUF string length {length} exceeds limit {MAX_STRING_BYTES}"
            ));
        }
        let bytes = self.read_bytes(length as usize)?;
        String::from_utf8(bytes).map_err(|_| invalid_data_error("GGUF string is not valid UTF-8"))
    }
}

fn fixture_bytes() -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(GGUF_MAGIC);
    write_u32_vec(&mut bytes, 3);
    write_u64_vec(&mut bytes, 2);
    write_u64_vec(&mut bytes, 3);
    write_metadata_string(&mut bytes, "general.architecture", "tinyrustlm-fixture")?;
    write_metadata_string(&mut bytes, "general.name", "TinyRustLM GGUF fixture")?;
    write_metadata_u32(&mut bytes, "general.alignment", DEFAULT_ALIGNMENT as u32)?;

    write_string_vec(&mut bytes, "token_embd.weight")?;
    write_u32_vec(&mut bytes, 2);
    write_u64_vec(&mut bytes, 4);
    write_u64_vec(&mut bytes, 2);
    write_u32_vec(&mut bytes, 0);
    write_u64_vec(&mut bytes, 0);

    write_string_vec(&mut bytes, "output.weight")?;
    write_u32_vec(&mut bytes, 2);
    write_u64_vec(&mut bytes, 4);
    write_u64_vec(&mut bytes, 2);
    write_u32_vec(&mut bytes, 1);
    write_u64_vec(&mut bytes, 32);

    let tensor_data_offset = align_to(bytes.len() as u64, DEFAULT_ALIGNMENT)?;
    bytes.resize(tensor_data_offset as usize, 0);
    bytes.extend_from_slice(&[0u8; 32]);
    bytes.extend_from_slice(&[0u8; 16]);
    Ok(bytes)
}

fn source_fixture_bytes(shape_name: &str) -> io::Result<Vec<u8>> {
    let expectations = trained_source::source_tensor_expectations(shape_name)?;
    let mut payloads = Vec::with_capacity(expectations.len());
    let mut relative_offsets = Vec::with_capacity(expectations.len());
    let mut cursor = 0u64;
    for (index, expectation) in expectations.iter().enumerate() {
        cursor = align_to(cursor, DEFAULT_ALIGNMENT)?;
        relative_offsets.push(cursor);
        let payload = source_fixture_payload(index, expectation)?;
        cursor = cursor
            .checked_add(payload.len() as u64)
            .ok_or_else(|| invalid_data_error("GGUF source fixture tensor data overflow"))?;
        payloads.push(payload);
    }

    let mut bytes = Vec::new();
    bytes.extend_from_slice(GGUF_MAGIC);
    write_u32_vec(&mut bytes, 3);
    write_u64_vec(&mut bytes, expectations.len() as u64);
    write_u64_vec(&mut bytes, 4);
    write_metadata_string(&mut bytes, "general.architecture", "tinyrustlm-fixture")?;
    write_metadata_string(&mut bytes, "general.name", "TinyRustLM GGUF source fixture")?;
    write_metadata_string(&mut bytes, "tinyrustlm.source_shape", shape_name)?;
    write_metadata_u32(&mut bytes, "general.alignment", DEFAULT_ALIGNMENT as u32)?;

    for (index, expectation) in expectations.iter().enumerate() {
        let source_name =
            gguf_alias_for_local(&expectation.name).unwrap_or_else(|| expectation.name.clone());
        write_string_vec(&mut bytes, &source_name)?;
        write_u32_vec(&mut bytes, expectation.dims.len() as u32);
        for dimension in &expectation.dims {
            write_u64_vec(&mut bytes, *dimension);
        }
        write_u32_vec(&mut bytes, 0);
        write_u64_vec(&mut bytes, relative_offsets[index]);
    }

    let tensor_data_offset = align_to(bytes.len() as u64, DEFAULT_ALIGNMENT)?;
    bytes.resize(tensor_data_offset as usize, 0);
    for (index, payload) in payloads.iter().enumerate() {
        let absolute_start = tensor_data_offset
            .checked_add(relative_offsets[index])
            .ok_or_else(|| invalid_data_error("GGUF source fixture absolute offset overflow"))?;
        if bytes.len() < absolute_start as usize {
            bytes.resize(absolute_start as usize, 0);
        }
        bytes.extend_from_slice(payload);
    }
    Ok(bytes)
}

fn source_fixture_payload(
    tensor_index: usize,
    expectation: &trained_source::SourceTensorExpectation,
) -> io::Result<Vec<u8>> {
    let element_count = expectation
        .f32_bytes
        .checked_div(4)
        .ok_or_else(|| invalid_data_error("GGUF source fixture f32 byte underflow"))?;
    let element_count = usize::try_from(element_count)
        .map_err(|_| invalid_data_error("GGUF source fixture tensor is too large for this host"))?;
    let mut bytes = Vec::with_capacity(element_count * 4);
    for index in 0..element_count {
        let value = ((tensor_index + 1) as f32 * 0.01) + ((index % 97) as f32 * 0.0001);
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    Ok(bytes)
}

fn write_metadata_string(bytes: &mut Vec<u8>, key: &str, value: &str) -> io::Result<()> {
    write_string_vec(bytes, key)?;
    write_u32_vec(bytes, 8);
    write_string_vec(bytes, value)
}

fn write_metadata_u32(bytes: &mut Vec<u8>, key: &str, value: u32) -> io::Result<()> {
    write_string_vec(bytes, key)?;
    write_u32_vec(bytes, 4);
    write_u32_vec(bytes, value);
    Ok(())
}

fn write_string_vec(bytes: &mut Vec<u8>, value: &str) -> io::Result<()> {
    write_u64_vec(bytes, value.len() as u64);
    bytes.write_all(value.as_bytes())
}

fn write_u32_vec(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn write_u64_vec(bytes: &mut Vec<u8>, value: u64) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn hex64(value: u64) -> String {
    format!("0x{value:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_path(name: &str) -> std::path::PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after UNIX_EPOCH")
            .as_millis();
        std::env::temp_dir().join(format!(
            "tinyrustlm-gguf-{name}-{}-{millis}.gguf",
            std::process::id()
        ))
    }

    fn unique_dir(name: &str) -> std::path::PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after UNIX_EPOCH")
            .as_millis();
        std::env::temp_dir().join(format!(
            "tinyrustlm-gguf-{name}-{}-{millis}",
            std::process::id()
        ))
    }

    #[test]
    fn fixture_inspection_reports_metadata_and_tensor_bounds() {
        let path = unique_path("fixture");
        write_fixture_path(&path).expect("write GGUF fixture");

        let inspection = inspect_input(&path).expect("inspect GGUF fixture");

        assert_eq!(inspection.version, 3);
        assert_eq!(inspection.metadata_kv_count, 3);
        assert_eq!(inspection.tensor_count, 2);
        assert_eq!(inspection.alignment, DEFAULT_ALIGNMENT);
        assert_eq!(
            inspection.architecture.as_deref(),
            Some("tinyrustlm-fixture")
        );
        assert_eq!(
            inspection.model_name.as_deref(),
            Some("TinyRustLM GGUF fixture")
        );
        assert_eq!(inspection.tensors[0].name, "token_embd.weight");
        assert_eq!(inspection.tensors[0].type_name, "F32");
        assert_eq!(inspection.tensors[0].byte_count, 32);
        assert_eq!(inspection.tensors[1].name, "output.weight");
        assert_eq!(inspection.tensors[1].type_name, "F16");
        assert_eq!(inspection.tensors[1].relative_offset, 32);
        assert_eq!(inspection.tensor_data_bytes, 48);

        let report = render_report(&inspection);
        assert!(report.contains("tinyrustlm_gguf_inspection_version=1"));
        assert!(report.contains("source_layout=gguf-v3"));
        assert!(report.contains("tensor.0.name=token_embd.weight"));
        assert!(report.contains("tensor.1.type=F16"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn source_fixture_plans_and_extracts_to_raw_source() {
        let dir = unique_dir("source-extract");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-source.gguf");
        let output_dir = dir.join("raw-source");
        write_source_fixture_path(&input, "tiny-fixture").expect("write GGUF source fixture");

        let plan = build_source_plan(&input, "tiny-fixture").expect("build GGUF source plan");
        let report = render_source_plan(&plan);

        assert_eq!(plan.target_model_shape, "tiny-fixture");
        assert_eq!(plan.tensors.len(), 12);
        assert_eq!(plan.conversion_status, "copy-ready");
        assert!(report.contains("tinyrustlm_gguf_source_plan_version=1"));
        assert!(report.contains("plan_layout=gguf-to-raw-f32-source-plan-v1"));
        assert!(report.contains("tensor.0.gguf_name=token_embd.weight"));
        assert!(report.contains("tensor.3.gguf_name=blk.0.attn_norm.weight"));

        extract_source_path(&input, "tiny-fixture", &output_dir).expect("extract GGUF source");
        trained_source::validate_source_path(&output_dir).expect("validate raw source");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn converts_source_fixture_to_slm() {
        let dir = unique_dir("source-convert");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create test directory");
        let input = dir.join("tiny-source.gguf");
        let source_dir = dir.join("raw-source");
        let output_slm = dir.join("tiny-source-q8.slm");
        write_source_fixture_path(&input, "tiny-fixture").expect("write GGUF source fixture");

        convert_source_path(&input, "tiny-fixture", &source_dir, &output_slm, "q8_0")
            .expect("convert GGUF source fixture");

        assert!(output_slm.exists());
        assert!(output_slm.with_extension("slm.manifest").exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_quantized_tensor_for_source_extraction() {
        let path = unique_path("quantized-source");
        let mut bytes = source_fixture_bytes("tiny-fixture").expect("build GGUF source fixture");
        let type_position = find_subsequence(&bytes, b"token_embd.weight")
            .expect("first tensor name")
            + "token_embd.weight".len()
            + 4
            + 8
            + 8;
        bytes[type_position..type_position + 4].copy_from_slice(&8u32.to_le_bytes());
        fs::write(&path, bytes).expect("write quantized GGUF fixture");

        let error = build_source_plan(&path, "tiny-fixture")
            .expect_err("quantized source extraction should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("only supports F32, F16, or BF16"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_overlapping_tensor_ranges() {
        let path = unique_path("overlap");
        let mut bytes = fixture_bytes().expect("build GGUF fixture");
        let offset_position = find_subsequence(&bytes, b"output.weight")
            .expect("output tensor name")
            + "output.weight".len()
            + 4
            + 8
            + 8
            + 4;
        bytes[offset_position..offset_position + 8].copy_from_slice(&0u64.to_le_bytes());
        fs::write(&path, bytes).expect("write overlapping GGUF fixture");

        let error = inspect_input(&path).expect_err("overlap should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("overlaps previous tensor"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unaligned_tensor_offset() {
        let path = unique_path("unaligned-offset");
        let mut bytes = fixture_bytes().expect("build GGUF fixture");
        let offset_position = find_subsequence(&bytes, b"output.weight")
            .expect("output tensor name")
            + "output.weight".len()
            + 4
            + 8
            + 8
            + 4;
        bytes[offset_position..offset_position + 8].copy_from_slice(&16u64.to_le_bytes());
        fs::write(&path, bytes).expect("write unaligned GGUF fixture");

        let error = inspect_input(&path).expect_err("unaligned offset should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("is not aligned"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unsupported_tensor_type() {
        let path = unique_path("unsupported-type");
        let mut bytes = fixture_bytes().expect("build GGUF fixture");
        let type_position = find_subsequence(&bytes, b"token_embd.weight")
            .expect("first tensor name")
            + "token_embd.weight".len()
            + 4
            + 8
            + 8;
        bytes[type_position..type_position + 4].copy_from_slice(&999u32.to_le_bytes());
        fs::write(&path, bytes).expect("write unsupported GGUF fixture");

        let error = inspect_input(&path).expect_err("unsupported type should fail");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("unsupported GGUF tensor type id 999"));

        let _ = fs::remove_file(path);
    }

    fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
        haystack
            .windows(needle.len())
            .position(|window| window == needle)
    }
}
