//! Offline adapter/delta artifacts for modular model-breeding candidates.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;

use crate::blend::{
    hex64, invalid, output_specs, parse_manifest, parse_model_values, parse_passing_compatibility,
    push_line, push_parent_lines, require_equal, require_key, require_parent_report,
    require_report_equal, require_same_tensor_spec, same_shape, ParsedModel,
};
use crate::build_model_file_from_values_with_flags;
use crate::lineage;
use crate::slm_validate::{self, ValidationReport};
use crate::writer::{align_to_64, write_f32, write_u32, write_u64};

const ADAPTER_ARTIFACT_VERSION: &str = "1";
const ADAPTER_BINARY_VERSION: u32 = 1;
const ADAPTER_ARTIFACT_KIND: &str = "raw-f32-task-delta-v1";
const ADAPTER_STATUS: &str = "artifact-written";
const ADAPTER_DTYPE: &str = "f32-delta";
const ADAPTER_BASE_CONTRACT: &str = "matches-parent-direct-parameter-contract";
const ADAPTER_APPLY_STATUS: &str = "offline-artifact-only";
const REQUIRED_NEXT_GATE: &str = "fuse-to-slm-plus-candidate-manifest-plus-runtime-smoke-plus-eval";
const ADAPTER_FUSE_VERSION: &str = "1";
const FUSE_OPERATOR_KIND: &str = "adapter-delta-fuse-to-slm";
const FUSE_OPERATOR_STATUS: &str = "candidate-written";
const FUSE_OPERATOR_OUTPUT_STATUS: &str = "slm-validated";
const FUSE_APPLY_STATUS: &str = "fused-to-slm-candidate";
const FUSE_MANIFEST_STATUS: &str = "validated";
const FUSE_REQUIRED_NEXT_GATE: &str = "candidate-manifest-plus-runtime-smoke-plus-eval";
const HEADER_LEN: usize = 64;
const ENTRY_LEN: usize = 64;
const CHECKSUM_OFFSET: usize = 56;
const MAGIC: &[u8; 4] = b"ADP1";

/// Writes a raw f32 task-delta adapter artifact plus a recomputable manifest.
pub(crate) fn write_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    output_adapter: &Path,
    output_manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let (adapter, manifest) = build_artifact_bytes_and_manifest(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &output_adapter.display().to_string(),
    )?;
    if let Some(parent) = output_adapter.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_adapter, adapter)?;
    if let Some(parent) = output_manifest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_manifest, manifest)?;
    println!(
        "SLM adapter-delta artifact written: {}",
        output_adapter.display()
    );
    println!(
        "SLM adapter-delta manifest written: {}",
        output_manifest.display()
    );
    Ok(())
}

/// Validates an adapter artifact and manifest by recomputing both from parents.
pub(crate) fn validate_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    manifest: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let manifest_text = fs::read_to_string(manifest)?;
    validate_artifact_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &manifest_text,
    )?;
    println!("SLM adapter-delta validation: PASS");
    println!("adapter: {}", adapter.display());
    println!("manifest: {}", manifest.display());
    Ok(())
}

/// Fuses a validated adapter/delta artifact into a normal `.slm` candidate.
pub(crate) fn fuse_artifact_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    adapter_manifest: &Path,
    output_slm: &Path,
    output_receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let adapter_manifest_text = fs::read_to_string(adapter_manifest)?;
    let (candidate, receipt) = build_fused_candidate_bytes_and_receipt(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &adapter_manifest_text,
        &output_slm.display().to_string(),
    )?;
    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, candidate)?;
    if let Some(parent) = output_receipt.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_receipt, receipt)?;
    println!(
        "SLM adapter-fused candidate written: {}",
        output_slm.display()
    );
    println!(
        "SLM adapter-fuse operator receipt written: {}",
        output_receipt.display()
    );
    Ok(())
}

/// Validates an adapter-fused `.slm` candidate by recomputing it from parents.
pub(crate) fn validate_fused_candidate_path(
    compatibility: &Path,
    lineage_manifest: &Path,
    base_parent: &Path,
    target_parent: &Path,
    adapter: &Path,
    adapter_manifest: &Path,
    candidate_slm: &Path,
    receipt: &Path,
) -> io::Result<()> {
    let compatibility_text = fs::read_to_string(compatibility)?;
    let lineage_text = fs::read_to_string(lineage_manifest)?;
    let base_bytes = fs::read(base_parent)?;
    let target_bytes = fs::read(target_parent)?;
    let adapter_bytes = fs::read(adapter)?;
    let adapter_manifest_text = fs::read_to_string(adapter_manifest)?;
    let candidate_bytes = fs::read(candidate_slm)?;
    let receipt_text = fs::read_to_string(receipt)?;
    validate_fused_candidate_text(
        &compatibility_text,
        &lineage_text,
        &base_bytes,
        &base_parent.display().to_string(),
        &target_bytes,
        &target_parent.display().to_string(),
        &adapter_bytes,
        &adapter.display().to_string(),
        &adapter_manifest_text,
        &candidate_bytes,
        &candidate_slm.display().to_string(),
        &receipt_text,
    )?;
    println!("SLM adapter-fused candidate validation: PASS");
    println!("candidate: {}", candidate_slm.display());
    println!("receipt: {}", receipt.display());
    Ok(())
}

fn validate_artifact_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    manifest_text: &str,
) -> io::Result<()> {
    let manifest = parse_manifest(manifest_text, "adapter-delta manifest")?;
    require_equal(
        &manifest,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    )?;
    require_equal(&manifest, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND)?;
    let (expected_adapter, expected_manifest) = build_artifact_bytes_and_manifest(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_path,
    )?;
    if adapter_bytes != expected_adapter {
        return Err(invalid(
            "adapter-delta artifact bytes do not match recomputed parent deltas",
        ));
    }
    if manifest_text != expected_manifest {
        return Err(invalid(
            "adapter-delta manifest fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn validate_fused_candidate_text(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    adapter_manifest_text: &str,
    candidate_bytes: &[u8],
    candidate_path: &str,
    receipt_text: &str,
) -> io::Result<()> {
    let receipt = parse_manifest(receipt_text, "adapter-fuse operator receipt")?;
    require_equal(
        &receipt,
        "tinyrustlm_adapter_fuse_version",
        ADAPTER_FUSE_VERSION,
    )?;
    require_equal(&receipt, "operator_kind", FUSE_OPERATOR_KIND)?;
    require_equal(&receipt, "operator_status", FUSE_OPERATOR_STATUS)?;
    require_equal(&receipt, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND)?;
    require_equal(&receipt, "adapter_manifest_status", FUSE_MANIFEST_STATUS)?;
    require_equal(&receipt, "adapter_apply_status", FUSE_APPLY_STATUS)?;
    require_equal(&receipt, "candidate_parent_contract", ADAPTER_BASE_CONTRACT)?;
    require_equal(
        &receipt,
        "operator_output_status",
        FUSE_OPERATOR_OUTPUT_STATUS,
    )?;
    let (expected_candidate, expected_receipt) = build_fused_candidate_bytes_and_receipt(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_bytes,
        adapter_path,
        adapter_manifest_text,
        candidate_path,
    )?;
    if candidate_bytes != expected_candidate {
        return Err(invalid(
            "adapter-fused candidate bytes do not match recomputed output",
        ));
    }
    if receipt_text != expected_receipt {
        return Err(invalid(
            "adapter-fuse operator receipt fields do not match recomputed output",
        ));
    }
    Ok(())
}

fn build_fused_candidate_bytes_and_receipt(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_bytes: &[u8],
    adapter_path: &str,
    adapter_manifest_text: &str,
    candidate_path: &str,
) -> io::Result<(Vec<u8>, String)> {
    validate_artifact_text(
        compatibility_text,
        lineage_text,
        base_bytes,
        base_path,
        target_bytes,
        target_path,
        adapter_bytes,
        adapter_path,
        adapter_manifest_text,
    )?;
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let target_report = slm_validate::validate_bytes(target_bytes, target_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &target_report)?;

    let base = parse_model_values(base_bytes)?;
    let adapter_deltas = read_adapter_deltas(adapter_bytes, &base, &base_report)?;
    let output_values = fused_values(&base, &adapter_deltas)?;
    let output_tensors = output_specs(&base);
    let candidate = build_model_file_from_values_with_flags(
        &base.shape,
        &output_tensors,
        &base.tokenizer,
        &output_values,
        base.flags,
    )?;
    let candidate_report = slm_validate::validate_bytes(&candidate, candidate_path)?;
    require_report_equal(
        &compatibility,
        "parent.0.model_shape",
        &candidate_report.shape_summary(),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.quantization",
        candidate_report.quantization_label(),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.output_contract",
        candidate_report.output_contract_label(),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.tokenizer_checksum",
        &hex64(candidate_report.tokenizer_checksum()),
    )?;
    require_report_equal(
        &compatibility,
        "parent.0.tensor_layout_checksum",
        &hex64(candidate_report.tensor_layout_checksum()),
    )?;
    let receipt = build_fuse_receipt_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        adapter_path,
        adapter_manifest_text,
        adapter_bytes,
        &candidate_report,
    )?;
    Ok((candidate, receipt))
}

fn build_artifact_bytes_and_manifest(
    compatibility_text: &str,
    lineage_text: &str,
    base_bytes: &[u8],
    base_path: &str,
    target_bytes: &[u8],
    target_path: &str,
    adapter_path: &str,
) -> io::Result<(Vec<u8>, String)> {
    lineage::validate_text(compatibility_text, lineage_text)?;
    let compatibility = parse_passing_compatibility(compatibility_text)?;
    let lineage_fields = parse_manifest(lineage_text, "lineage")?;
    let base_report = slm_validate::validate_bytes(base_bytes, base_path)?;
    let target_report = slm_validate::validate_bytes(target_bytes, target_path)?;
    require_parent_report(&compatibility, 0, &base_report)?;
    require_parent_report(&compatibility, 1, &target_report)?;

    let base = parse_model_values(base_bytes)?;
    let target = parse_model_values(target_bytes)?;
    let adapter = build_adapter_bytes(&base, &target, &base_report)?;
    validate_adapter_bytes(&adapter)?;
    let manifest = build_manifest_text(
        &compatibility,
        &lineage_fields,
        lineage_text,
        base_path,
        target_path,
        &base_report,
        &target_report,
        adapter_path,
        &adapter,
    )?;
    Ok((adapter, manifest))
}

fn build_adapter_bytes(
    base: &ParsedModel,
    target: &ParsedModel,
    base_report: &ValidationReport,
) -> io::Result<Vec<u8>> {
    validate_parent_models(base, target)?;
    let tensor_count = base.tensors.len();
    let directory_offset = HEADER_LEN;
    let data_offset = align_to_64(directory_offset + tensor_count * ENTRY_LEN);
    let mut tensor_offsets = Vec::with_capacity(tensor_count);
    let mut tensor_lengths = Vec::with_capacity(tensor_count);
    let mut tensor_checksums = Vec::with_capacity(tensor_count);
    let mut delta_values = Vec::with_capacity(tensor_count);
    let mut cursor = data_offset;

    for (base_tensor, target_tensor) in base.tensors.iter().zip(target.tensors.iter()) {
        require_same_tensor_spec(&base_tensor.spec, &target_tensor.spec)?;
        cursor = align_to_64(cursor);
        tensor_offsets.push(cursor);
        let mut deltas = Vec::with_capacity(base_tensor.values.len());
        for (base_value, target_value) in base_tensor.values.iter().zip(target_tensor.values.iter())
        {
            deltas.push(target_value - base_value);
        }
        let byte_length = deltas
            .len()
            .checked_mul(4)
            .ok_or_else(|| invalid("adapter tensor byte length overflow"))?;
        tensor_lengths.push(byte_length);
        cursor = cursor
            .checked_add(byte_length)
            .ok_or_else(|| invalid("adapter payload length overflow"))?;
        let mut payload = vec![0u8; byte_length];
        for (index, value) in deltas.iter().enumerate() {
            write_f32(&mut payload, index * 4, *value)?;
        }
        tensor_checksums.push(payload_checksum(&payload));
        delta_values.push(deltas);
    }

    let mut bytes = vec![0u8; cursor];
    bytes[0..4].copy_from_slice(MAGIC);
    write_u32(&mut bytes, 4, ADAPTER_BINARY_VERSION)?;
    write_u32(&mut bytes, 8, HEADER_LEN as u32)?;
    write_u32(&mut bytes, 12, tensor_count as u32)?;
    write_u32(&mut bytes, 16, base.flags)?;
    write_u32(&mut bytes, 20, ENTRY_LEN as u32)?;
    write_u64(&mut bytes, 24, base_report.parameter_count() as u64)?;
    write_u64(&mut bytes, 32, base_report.tensor_layout_checksum())?;
    write_u64(&mut bytes, 40, base_report.tokenizer_checksum())?;
    write_u64(&mut bytes, 48, data_offset as u64)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, 0)?;

    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = directory_offset + index * ENTRY_LEN;
        write_u64(&mut bytes, entry, tensor.spec.name_hash)?;
        write_u32(&mut bytes, entry + 8, tensor.spec.rank)?;
        write_u32(&mut bytes, entry + 12, tensor.spec.dims[0])?;
        write_u32(&mut bytes, entry + 16, tensor.spec.dims[1])?;
        write_u32(&mut bytes, entry + 20, tensor.spec.dims[2])?;
        write_u32(&mut bytes, entry + 24, tensor.spec.dims[3])?;
        write_u32(&mut bytes, entry + 28, 0)?;
        write_u64(&mut bytes, entry + 32, tensor_offsets[index] as u64)?;
        write_u64(&mut bytes, entry + 40, tensor_lengths[index] as u64)?;
        write_u64(&mut bytes, entry + 48, tensor.spec.element_count() as u64)?;
        write_u64(&mut bytes, entry + 56, tensor_checksums[index])?;

        let start = tensor_offsets[index];
        for (value_index, value) in delta_values[index].iter().enumerate() {
            write_f32(&mut bytes, start + value_index * 4, *value)?;
        }
    }

    let checksum = adapter_checksum(&bytes)?;
    write_u64(&mut bytes, CHECKSUM_OFFSET, checksum)?;
    Ok(bytes)
}

fn build_manifest_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    adapter_path: &str,
    adapter_bytes: &[u8],
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_artifact_version",
        ADAPTER_ARTIFACT_VERSION,
    );
    push_line(&mut text, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND);
    push_line(&mut text, "adapter_status", ADAPTER_STATUS);
    push_line(
        &mut text,
        "candidate_id",
        require_key(lineage_fields, "candidate_id")?,
    );
    push_line(
        &mut text,
        "operator_id",
        require_key(lineage_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(lineage_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(lineage_fields, "resource_budget")?,
    );
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(lineage_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    );
    push_line(
        &mut text,
        "compatibility_scope",
        require_key(compatibility, "compatibility_scope")?,
    );
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(read_u64(adapter_bytes, CHECKSUM_OFFSET)?),
    );
    push_line(
        &mut text,
        "adapter_tensor_count",
        &base_report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "adapter_parameter_count",
        &base_report.parameter_count().to_string(),
    );
    push_line(&mut text, "adapter_dtype", ADAPTER_DTYPE);
    push_line(
        &mut text,
        "adapter_model_shape",
        &base_report.shape_summary(),
    );
    push_line(
        &mut text,
        "adapter_base_quantization",
        base_report.quantization_label(),
    );
    push_line(
        &mut text,
        "adapter_output_contract",
        base_report.output_contract_label(),
    );
    push_line(
        &mut text,
        "adapter_tokenizer_checksum",
        &hex64(base_report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "adapter_tensor_layout_checksum",
        &hex64(base_report.tensor_layout_checksum()),
    );
    push_line(&mut text, "adapter_base_contract", ADAPTER_BASE_CONTRACT);
    push_line(&mut text, "adapter_apply_status", ADAPTER_APPLY_STATUS);
    push_line(&mut text, "required_next_gate", REQUIRED_NEXT_GATE);
    Ok(text)
}

fn build_fuse_receipt_text(
    compatibility: &HashMap<String, String>,
    lineage_fields: &HashMap<String, String>,
    lineage_text: &str,
    base_path: &str,
    target_path: &str,
    base_report: &ValidationReport,
    target_report: &ValidationReport,
    adapter_path: &str,
    adapter_manifest_text: &str,
    adapter_bytes: &[u8],
    candidate_report: &ValidationReport,
) -> io::Result<String> {
    let mut text = String::new();
    push_line(
        &mut text,
        "tinyrustlm_adapter_fuse_version",
        ADAPTER_FUSE_VERSION,
    );
    push_line(&mut text, "operator_kind", FUSE_OPERATOR_KIND);
    push_line(&mut text, "operator_status", FUSE_OPERATOR_STATUS);
    push_line(
        &mut text,
        "candidate_id",
        require_key(lineage_fields, "candidate_id")?,
    );
    push_line(
        &mut text,
        "operator_id",
        require_key(lineage_fields, "operator_id")?,
    );
    push_line(
        &mut text,
        "operator_lane",
        require_key(lineage_fields, "operator_lane")?,
    );
    push_line(
        &mut text,
        "resource_budget",
        require_key(lineage_fields, "resource_budget")?,
    );
    push_line(
        &mut text,
        "compatibility_report_checksum",
        require_key(lineage_fields, "compatibility_report_checksum")?,
    );
    push_line(
        &mut text,
        "lineage_manifest_checksum",
        &hex64(lineage::text_checksum(lineage_text.as_bytes())),
    );
    push_line(
        &mut text,
        "compatibility_scope",
        require_key(compatibility, "compatibility_scope")?,
    );
    push_line(&mut text, "parent_count", "2");
    push_parent_lines(&mut text, compatibility, 0, base_path, base_report)?;
    push_parent_lines(&mut text, compatibility, 1, target_path, target_report)?;
    push_line(&mut text, "adapter_artifact_kind", ADAPTER_ARTIFACT_KIND);
    push_line(&mut text, "adapter_source_parent_index", "0");
    push_line(&mut text, "adapter_target_parent_index", "1");
    push_line(&mut text, "adapter_artifact_path", adapter_path);
    push_line(
        &mut text,
        "adapter_manifest_checksum",
        &hex64(lineage::text_checksum(adapter_manifest_text.as_bytes())),
    );
    push_line(
        &mut text,
        "adapter_artifact_bytes",
        &adapter_bytes.len().to_string(),
    );
    push_line(
        &mut text,
        "adapter_artifact_checksum",
        &hex64(read_u64(adapter_bytes, CHECKSUM_OFFSET)?),
    );
    push_line(
        &mut text,
        "adapter_tensor_count",
        &base_report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "adapter_parameter_count",
        &base_report.parameter_count().to_string(),
    );
    push_line(&mut text, "adapter_dtype", ADAPTER_DTYPE);
    push_line(
        &mut text,
        "adapter_model_shape",
        &base_report.shape_summary(),
    );
    push_line(
        &mut text,
        "adapter_base_quantization",
        base_report.quantization_label(),
    );
    push_line(
        &mut text,
        "adapter_output_contract",
        base_report.output_contract_label(),
    );
    push_line(
        &mut text,
        "adapter_tokenizer_checksum",
        &hex64(base_report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "adapter_tensor_layout_checksum",
        &hex64(base_report.tensor_layout_checksum()),
    );
    push_line(&mut text, "adapter_base_contract", ADAPTER_BASE_CONTRACT);
    push_line(&mut text, "adapter_manifest_status", FUSE_MANIFEST_STATUS);
    push_line(&mut text, "adapter_apply_status", FUSE_APPLY_STATUS);
    push_line(
        &mut text,
        "candidate_artifact_path",
        candidate_report.path(),
    );
    push_line(
        &mut text,
        "candidate_artifact_bytes",
        &candidate_report.file_bytes().to_string(),
    );
    push_line(
        &mut text,
        "candidate_slm_version",
        &candidate_report.slm_version().to_string(),
    );
    push_line(
        &mut text,
        "candidate_slm_checksum",
        &hex64(candidate_report.checksum()),
    );
    push_line(
        &mut text,
        "candidate_model_shape",
        &candidate_report.shape_summary(),
    );
    push_line(
        &mut text,
        "candidate_tensor_count",
        &candidate_report.tensor_count().to_string(),
    );
    push_line(
        &mut text,
        "candidate_parameter_count",
        &candidate_report.parameter_count().to_string(),
    );
    push_line(
        &mut text,
        "candidate_quantization",
        candidate_report.quantization_label(),
    );
    push_line(
        &mut text,
        "candidate_output_contract",
        candidate_report.output_contract_label(),
    );
    push_line(
        &mut text,
        "candidate_tokenizer_checksum",
        &hex64(candidate_report.tokenizer_checksum()),
    );
    push_line(
        &mut text,
        "candidate_tensor_layout_checksum",
        &hex64(candidate_report.tensor_layout_checksum()),
    );
    push_line(
        &mut text,
        "candidate_parent_contract",
        ADAPTER_BASE_CONTRACT,
    );
    push_line(
        &mut text,
        "operator_output_status",
        FUSE_OPERATOR_OUTPUT_STATUS,
    );
    push_line(&mut text, "required_next_gate", FUSE_REQUIRED_NEXT_GATE);
    Ok(text)
}

fn read_adapter_deltas(
    bytes: &[u8],
    base: &ParsedModel,
    base_report: &ValidationReport,
) -> io::Result<Vec<Vec<f32>>> {
    validate_adapter_bytes(bytes)?;
    let tensor_count = read_u32(bytes, 12)? as usize;
    if tensor_count != base.tensors.len() {
        return Err(invalid(
            "adapter tensor count does not match base parent tensor count",
        ));
    }
    if read_u32(bytes, 16)? != base.flags {
        return Err(invalid(
            "adapter output flags do not match base parent output flags",
        ));
    }
    if read_u64(bytes, 24)? != base_report.parameter_count() as u64 {
        return Err(invalid(
            "adapter parameter count does not match base parent parameter count",
        ));
    }
    if read_u64(bytes, 32)? != base_report.tensor_layout_checksum() {
        return Err(invalid(
            "adapter tensor layout checksum does not match base parent",
        ));
    }
    if read_u64(bytes, 40)? != base_report.tokenizer_checksum() {
        return Err(invalid(
            "adapter tokenizer checksum does not match base parent",
        ));
    }
    let data_offset = read_u64(bytes, 48)? as usize;
    let mut output = Vec::with_capacity(tensor_count);
    for (index, tensor) in base.tensors.iter().enumerate() {
        let entry = HEADER_LEN + index * ENTRY_LEN;
        if read_u64(bytes, entry)? != tensor.spec.name_hash {
            return Err(invalid(
                "adapter tensor name hash does not match base parent",
            ));
        }
        if read_u32(bytes, entry + 8)? != tensor.spec.rank {
            return Err(invalid("adapter tensor rank does not match base parent"));
        }
        for dim_index in 0..4 {
            if read_u32(bytes, entry + 12 + dim_index * 4)? != tensor.spec.dims[dim_index] {
                return Err(invalid("adapter tensor dims do not match base parent"));
            }
        }
        if read_u32(bytes, entry + 28)? != 0 {
            return Err(invalid("adapter tensor reserved field is not zero"));
        }
        let byte_offset = read_u64(bytes, entry + 32)? as usize;
        if byte_offset < data_offset || byte_offset % 64 != 0 {
            return Err(invalid("adapter tensor payload offset is invalid"));
        }
        let byte_length = read_u64(bytes, entry + 40)? as usize;
        let element_count = read_u64(bytes, entry + 48)? as usize;
        if element_count != tensor.spec.element_count() {
            return Err(invalid(
                "adapter tensor element count does not match base parent",
            ));
        }
        let expected_byte_length = element_count
            .checked_mul(4)
            .ok_or_else(|| invalid("adapter tensor byte length overflow"))?;
        if byte_length != expected_byte_length {
            return Err(invalid(
                "adapter tensor byte length does not match element count",
            ));
        }
        let mut values = Vec::with_capacity(element_count);
        for value_index in 0..element_count {
            let value = read_f32(bytes, byte_offset + value_index * 4)?;
            if !value.is_finite() {
                return Err(invalid("adapter tensor delta is not finite"));
            }
            values.push(value);
        }
        output.push(values);
    }
    Ok(output)
}

fn fused_values(base: &ParsedModel, adapter_deltas: &[Vec<f32>]) -> io::Result<Vec<Vec<f32>>> {
    if adapter_deltas.len() != base.tensors.len() {
        return Err(invalid("adapter deltas do not match base tensor count"));
    }
    let mut output = Vec::with_capacity(base.tensors.len());
    for (tensor, deltas) in base.tensors.iter().zip(adapter_deltas.iter()) {
        if tensor.values.len() != deltas.len() {
            return Err(invalid(
                "adapter delta tensor length does not match base tensor length",
            ));
        }
        let values = tensor
            .values
            .iter()
            .zip(deltas.iter())
            .map(|(base_value, delta)| base_value + delta)
            .collect::<Vec<_>>();
        output.push(values);
    }
    Ok(output)
}

fn validate_parent_models(base: &ParsedModel, target: &ParsedModel) -> io::Result<()> {
    if !same_shape(&base.shape, &target.shape) {
        return Err(invalid("adapter parents have different model shapes"));
    }
    if base.flags != target.flags {
        return Err(invalid("adapter parents have different output flags"));
    }
    if base.tokenizer.bytes != target.tokenizer.bytes {
        return Err(invalid("adapter parents have different tokenizer bytes"));
    }
    if base.tensors.len() != target.tensors.len() {
        return Err(invalid("adapter parents have different tensor counts"));
    }
    Ok(())
}

fn validate_adapter_bytes(bytes: &[u8]) -> io::Result<()> {
    if bytes.get(0..4) != Some(MAGIC) {
        return Err(invalid("adapter artifact has invalid magic"));
    }
    let version = read_u32(bytes, 4)?;
    if version != ADAPTER_BINARY_VERSION {
        return Err(invalid("adapter artifact has unsupported version"));
    }
    let header_len = read_u32(bytes, 8)? as usize;
    if header_len != HEADER_LEN {
        return Err(invalid("adapter artifact has invalid header length"));
    }
    let tensor_count = read_u32(bytes, 12)? as usize;
    let entry_len = read_u32(bytes, 20)? as usize;
    if entry_len != ENTRY_LEN {
        return Err(invalid("adapter artifact has invalid entry length"));
    }
    let data_offset = read_u64(bytes, 48)? as usize;
    let directory_end = HEADER_LEN
        .checked_add(
            tensor_count
                .checked_mul(ENTRY_LEN)
                .ok_or_else(|| invalid("adapter directory length overflow"))?,
        )
        .ok_or_else(|| invalid("adapter directory end overflow"))?;
    if data_offset < directory_end || data_offset % 64 != 0 {
        return Err(invalid("adapter artifact has invalid data offset"));
    }
    if read_u64(bytes, CHECKSUM_OFFSET)? != adapter_checksum(bytes)? {
        return Err(invalid("adapter artifact checksum mismatch"));
    }
    for index in 0..tensor_count {
        let entry = HEADER_LEN + index * ENTRY_LEN;
        let byte_offset = read_u64(bytes, entry + 32)? as usize;
        let byte_length = read_u64(bytes, entry + 40)? as usize;
        let element_count = read_u64(bytes, entry + 48)? as usize;
        let expected_byte_length = element_count
            .checked_mul(4)
            .ok_or_else(|| invalid("adapter tensor byte length overflow"))?;
        if byte_length != expected_byte_length {
            return Err(invalid(
                "adapter tensor byte length does not match element count",
            ));
        }
        let end = byte_offset
            .checked_add(byte_length)
            .ok_or_else(|| invalid("adapter tensor payload end overflow"))?;
        let payload = bytes
            .get(byte_offset..end)
            .ok_or_else(|| invalid("adapter tensor payload escapes artifact"))?;
        if read_u64(bytes, entry + 56)? != payload_checksum(payload) {
            return Err(invalid("adapter tensor payload checksum mismatch"));
        }
    }
    Ok(())
}

fn adapter_checksum(bytes: &[u8]) -> io::Result<u64> {
    if bytes.len() < HEADER_LEN {
        return Err(invalid("adapter artifact is too short"));
    }
    let mut acc = 0x6164617074657231u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (CHECKSUM_OFFSET..CHECKSUM_OFFSET + 8).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 3);
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    Ok(acc)
}

fn payload_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x64656c7461663332u64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn read_u32(bytes: &[u8], offset: usize) -> io::Result<u32> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| invalid("u32 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading u32"))?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u64(bytes: &[u8], offset: usize) -> io::Result<u64> {
    let end = offset
        .checked_add(8)
        .ok_or_else(|| invalid("u64 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading u64"))?;
    Ok(u64::from_le_bytes([
        slice[0], slice[1], slice[2], slice[3], slice[4], slice[5], slice[6], slice[7],
    ]))
}

fn read_f32(bytes: &[u8], offset: usize) -> io::Result<f32> {
    let end = offset
        .checked_add(4)
        .ok_or_else(|| invalid("f32 offset overflow"))?;
    let slice = bytes
        .get(offset..end)
        .ok_or_else(|| invalid("unexpected end while reading f32"))?;
    Ok(f32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compatibility;
    use crate::tensor_writer::{tiny_fixture_tensors, tiny_fixture_tensors_with_dtype, DTYPE_Q8_0};
    use crate::tokenizer_writer::ByteTokenizerSection;
    use crate::{build_model_file, build_model_file_from_values_with_flags, fixture_value};

    #[test]
    fn writes_and_validates_f32_adapter_delta_artifact() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();

        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
        )
        .unwrap();
        assert_eq!(adapter.get(0..4), Some(&MAGIC[..]));
        assert!(manifest.contains("adapter_artifact_kind=raw-f32-task-delta-v1"));
        assert!(manifest.contains("adapter_apply_status=offline-artifact-only"));
    }

    #[test]
    fn writes_and_validates_q8_adapter_delta_artifact() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-q8", "adapter-delta-v1", "tiny")
                .unwrap();

        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        validate_adapter_bytes(&adapter).unwrap();
        validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
        )
        .unwrap();
        assert!(manifest.contains("adapter_base_quantization=q8_0"));
    }

    #[test]
    fn fuses_f32_adapter_delta_into_slm_candidate() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        let (candidate, receipt) = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            "candidate.slm",
        )
        .unwrap();

        validate_fused_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("adapter_apply_status=fused-to-slm-candidate"));
        assert!(
            receipt.contains("required_next_gate=candidate-manifest-plus-runtime-smoke-plus-eval")
        );

        let candidate_model = parse_model_values(&candidate).unwrap();
        let target_model = parse_model_values(&target).unwrap();
        for (candidate_tensor, target_tensor) in candidate_model
            .tensors
            .iter()
            .zip(target_model.tensors.iter())
        {
            require_same_tensor_spec(&candidate_tensor.spec, &target_tensor.spec).unwrap();
            for (candidate_value, target_value) in candidate_tensor
                .values
                .iter()
                .zip(target_tensor.values.iter())
            {
                assert!((candidate_value - target_value).abs() < 0.000001);
            }
        }
    }

    #[test]
    fn fuses_q8_adapter_delta_into_slm_candidate() {
        let base = tiny_q8_bytes();
        let target = tiny_q8_bytes();
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-q8", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();

        let (candidate, receipt) = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            "candidate.slm",
        )
        .unwrap();

        slm_validate::validate_bytes(&candidate, "candidate.slm").unwrap();
        validate_fused_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap();
        assert!(receipt.contains("candidate_quantization=q8_0"));
    }

    #[test]
    fn rejects_parent_checksum_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let changed_base = tiny_f32_scaled_bytes(2.0);

        let error = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &changed_base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("parent.0.slm_checksum"));
    }

    #[test]
    fn validation_rejects_adapter_byte_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (mut adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let last = adapter.len() - 1;
        adapter[last] ^= 0x01;

        let error = validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("artifact bytes"));
    }

    #[test]
    fn validation_rejects_manifest_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let changed_manifest = manifest.replace(
            "adapter_apply_status=offline-artifact-only",
            "adapter_apply_status=fused",
        );

        let error = validate_artifact_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &changed_manifest,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest fields"));
    }

    #[test]
    fn fuse_rejects_adapter_manifest_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let changed_manifest = manifest.replace(
            "adapter_apply_status=offline-artifact-only",
            "adapter_apply_status=fused",
        );

        let error = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &changed_manifest,
            "candidate.slm",
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("manifest fields"));
    }

    #[test]
    fn validation_rejects_fused_candidate_drift() {
        let base = tiny_f32_scaled_bytes(1.0);
        let target = tiny_f32_scaled_bytes(3.0);
        let compatibility =
            compatibility::compatibility_text_for_bytes(&base, "base.slm", &target, "target.slm")
                .unwrap();
        let lineage =
            lineage::build_template_text(&compatibility, "adapter-f32", "adapter-delta-v1", "tiny")
                .unwrap();
        let (adapter, manifest) = build_artifact_bytes_and_manifest(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            "adapter.delta",
        )
        .unwrap();
        let (mut candidate, receipt) = build_fused_candidate_bytes_and_receipt(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            "candidate.slm",
        )
        .unwrap();
        let last = candidate.len() - 1;
        candidate[last] ^= 0x01;

        let error = validate_fused_candidate_text(
            &compatibility,
            &lineage,
            &base,
            "base.slm",
            &target,
            "target.slm",
            &adapter,
            "adapter.delta",
            &manifest,
            &candidate,
            "candidate.slm",
            &receipt,
        )
        .unwrap_err();

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("candidate bytes"));
    }

    fn tiny_f32_scaled_bytes(scale: f32) -> Vec<u8> {
        let tensors = tiny_fixture_tensors();
        let values = tensors
            .iter()
            .map(|tensor| {
                (0..tensor.element_count())
                    .map(|index| fixture_value(tensor, index) * scale)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        build_model_file_from_values_with_flags(
            &crate::tensor_writer::ModelShape::tiny_fixture(),
            &tensors,
            &ByteTokenizerSection::phase_one(),
            &values,
            0,
        )
        .unwrap()
    }

    fn tiny_q8_bytes() -> Vec<u8> {
        build_model_file(
            &crate::tensor_writer::ModelShape::tiny_fixture(),
            &tiny_fixture_tensors_with_dtype(DTYPE_Q8_0),
            &ByteTokenizerSection::phase_one(),
        )
        .unwrap()
    }
}
