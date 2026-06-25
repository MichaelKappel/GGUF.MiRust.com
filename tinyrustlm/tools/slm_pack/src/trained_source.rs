//! Trained source-weight layout validation and conversion.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::provenance;
use crate::slm_validate;
use crate::tensor_writer::{
    tensors_for_shape, ModelShape, TensorSpec, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::tokenizer_writer::ByteTokenizerSection;
use crate::{build_model_file_from_values, fixture_value};

const SOURCE_MANIFEST_NAME: &str = "source.manifest";
const SOURCE_VERSION: &str = "1";
const SOURCE_LAYOUT: &str = "raw-f32-tensor-files-v1";
const MAX_ABS_SOURCE_WEIGHT: f32 = 64.0;

struct SourceBundle {
    shape: ModelShape,
    tensors: Vec<TensorSpec>,
    values: Vec<Vec<f32>>,
}

/// Writes a reviewable raw-f32 trained-source fixture directory.
pub fn write_source_template_path(output_dir: &Path, shape_name: &str) -> io::Result<()> {
    let shape = shape_for_name(shape_name)?;
    let tensors = tensors_for_shape(&shape, DTYPE_F32);
    let tensor_dir = output_dir.join("tensors");
    fs::create_dir_all(&tensor_dir)?;

    let mut manifest = String::new();
    push_line(
        &mut manifest,
        "tinyrustlm_trained_source_version",
        SOURCE_VERSION,
    );
    push_line(&mut manifest, "model_family", "tinyrustlm");
    push_line(&mut manifest, "layout", SOURCE_LAYOUT);
    push_line(&mut manifest, "model_shape", shape_name);
    push_line(&mut manifest, "tokenizer", "byte-v1");
    push_line(&mut manifest, "source_dtype", "f32");
    push_line(&mut manifest, "source_kind", "trained-source-fixture");
    push_line(
        &mut manifest,
        "source_id",
        "tinyrustlm-local-source-fixture",
    );
    push_line(&mut manifest, "source_license", "local-fixture-only");
    push_line(
        &mut manifest,
        "source_dataset",
        "tinyrustlm-local-conversion-fixture",
    );
    push_line(
        &mut manifest,
        "source_training_summary",
        "Deterministic source-weight fixture for conversion path validation",
    );
    push_shape_lines(&mut manifest, &shape);
    push_line(&mut manifest, "tensor_count", &tensors.len().to_string());

    for (index, tensor) in tensors.iter().enumerate() {
        let tensor_name = tensor_name_for_spec(&shape, index)?;
        let relative_file = format!("tensors/{}", tensor_file_name(&tensor_name));
        let file_path = output_dir.join(&relative_file);
        let bytes = source_tensor_bytes(tensor)?;
        fs::write(&file_path, &bytes)?;

        let prefix = format!("tensor.{index}");
        push_line(&mut manifest, &format!("{prefix}.name"), &tensor_name);
        push_line(
            &mut manifest,
            &format!("{prefix}.rank"),
            &tensor.rank.to_string(),
        );
        push_line(&mut manifest, &format!("{prefix}.dims"), &dims_text(tensor));
        push_line(&mut manifest, &format!("{prefix}.file"), &relative_file);
        push_line(
            &mut manifest,
            &format!("{prefix}.bytes"),
            &bytes.len().to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.checksum"),
            &format!("0x{:016x}", source_checksum(&bytes)),
        );
    }

    fs::write(output_dir.join(SOURCE_MANIFEST_NAME), manifest)?;
    println!("SLM source template written: {}", output_dir.display());
    Ok(())
}

/// Validates a raw-f32 trained-source directory and prints an admission report.
pub fn validate_source_path(source_dir: &Path) -> io::Result<()> {
    let bundle = read_source_bundle(source_dir)?;
    println!("SLM source validation: PASS");
    println!("source_dir: {}", source_dir.display());
    println!(
        "shape: vocab={} hidden={} layers={} heads={} kv_heads={} head_dim={} ffn={} context={}",
        bundle.shape.vocab_size,
        bundle.shape.hidden_size,
        bundle.shape.layer_count,
        bundle.shape.head_count,
        bundle.shape.kv_head_count,
        bundle.shape.head_dim,
        bundle.shape.ffn_size,
        bundle.shape.max_context
    );
    println!("tensor_count: {}", bundle.tensors.len());
    println!("source_dtype: f32");
    Ok(())
}

/// Converts a validated raw-f32 trained-source directory into an `.slm` artifact.
pub fn convert_trained_path(
    source_dir: &Path,
    output_slm: &Path,
    output_quantization: &str,
) -> io::Result<()> {
    let bundle = read_source_bundle(source_dir)?;
    let dtype = dtype_for_output(output_quantization)?;
    let output_tensors = tensors_for_shape(&bundle.shape, dtype);
    let tokenizer = ByteTokenizerSection::phase_one();
    let bytes =
        build_model_file_from_values(&bundle.shape, &output_tensors, &tokenizer, &bundle.values)?;

    if let Some(parent) = output_slm.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(output_slm, &bytes)?;
    let report = slm_validate::validate_bytes(&bytes, &output_slm.display().to_string())?;
    println!(
        "SLM converted trained source written: {}",
        output_slm.display()
    );
    println!("quantization: {}", report.quantization_label());
    println!("checksum: 0x{:016x}", report.checksum());

    let manifest = sidecar_manifest_path(output_slm);
    provenance::write_manifest_for_path(output_slm, &manifest, "converted-trained")?;
    Ok(())
}

fn read_source_bundle(source_dir: &Path) -> io::Result<SourceBundle> {
    let manifest_path = source_dir.join(SOURCE_MANIFEST_NAME);
    let manifest = fs::read_to_string(&manifest_path)?;
    let fields = parse_key_value_manifest(&manifest)?;
    validate_source_header(&fields)?;
    let shape = shape_from_fields(&fields)?;
    let expected_tensors = tensors_for_shape(&shape, DTYPE_F32);
    require_equal(&fields, "tensor_count", &expected_tensors.len().to_string())?;

    let mut values = Vec::with_capacity(expected_tensors.len());
    for (index, expected) in expected_tensors.iter().enumerate() {
        let name = tensor_name_for_spec(&shape, index)?;
        let prefix = format!("tensor.{index}");
        require_equal(&fields, &format!("{prefix}.name"), &name)?;
        require_equal(
            &fields,
            &format!("{prefix}.rank"),
            &expected.rank.to_string(),
        )?;
        require_equal(&fields, &format!("{prefix}.dims"), &dims_text(expected))?;
        let relative_file = require_key(&fields, &format!("{prefix}.file"))?;
        let tensor_path = safe_tensor_path(source_dir, relative_file)?;
        let bytes = fs::read(&tensor_path)?;
        require_equal(
            &fields,
            &format!("{prefix}.bytes"),
            &bytes.len().to_string(),
        )?;
        require_equal(
            &fields,
            &format!("{prefix}.checksum"),
            &format!("0x{:016x}", source_checksum(&bytes)),
        )?;
        values.push(read_raw_f32_values(&bytes, expected)?);
    }

    Ok(SourceBundle {
        shape,
        tensors: expected_tensors,
        values,
    })
}

fn validate_source_header(fields: &HashMap<String, String>) -> io::Result<()> {
    require_equal(fields, "tinyrustlm_trained_source_version", SOURCE_VERSION)?;
    require_equal(fields, "model_family", "tinyrustlm")?;
    require_equal(fields, "layout", SOURCE_LAYOUT)?;
    require_equal(fields, "tokenizer", "byte-v1")?;
    require_equal(fields, "source_dtype", "f32")?;
    match require_key(fields, "source_kind")? {
        "trained-source-fixture" | "trained-export" => {}
        _ => {
            return Err(invalid(
                "source_kind must be trained-source-fixture or trained-export",
            ));
        }
    }
    require_evidence_field(fields, "source_id")?;
    require_evidence_field(fields, "source_license")?;
    require_evidence_field(fields, "source_dataset")?;
    require_evidence_field(fields, "source_training_summary")?;
    Ok(())
}

fn shape_for_name(shape_name: &str) -> io::Result<ModelShape> {
    match shape_name {
        "tiny-fixture" => Ok(ModelShape::tiny_fixture()),
        "tinylm16" => Ok(ModelShape::tinylm16()),
        _ => Err(invalid(
            "source-template shape must be tiny-fixture or tinylm16",
        )),
    }
}

fn shape_from_fields(fields: &HashMap<String, String>) -> io::Result<ModelShape> {
    let shape = ModelShape {
        vocab_size: parse_u32_key(fields, "vocab_size")?,
        special_token_count: parse_u32_key(fields, "special_token_count")?,
        hidden_size: parse_u32_key(fields, "hidden_size")?,
        layer_count: parse_u32_key(fields, "layer_count")?,
        head_count: parse_u32_key(fields, "head_count")?,
        kv_head_count: parse_u32_key(fields, "kv_head_count")?,
        head_dim: parse_u32_key(fields, "head_dim")?,
        ffn_size: parse_u32_key(fields, "ffn_size")?,
        max_context: parse_u32_key(fields, "max_context")?,
    };
    if shape.vocab_size < 260 || shape.special_token_count < 4 {
        return Err(invalid(
            "source shape must support the phase-one byte tokenizer",
        ));
    }
    if shape.hidden_size == 0
        || shape.layer_count == 0
        || shape.head_count == 0
        || shape.kv_head_count == 0
        || shape.head_dim == 0
        || shape.ffn_size == 0
        || shape.max_context == 0
    {
        return Err(invalid("source shape dimensions must be nonzero"));
    }
    if shape.head_count.checked_mul(shape.head_dim) != Some(shape.hidden_size) {
        return Err(invalid("source hidden_size must equal heads * head_dim"));
    }
    if shape.kv_head_count > shape.head_count || shape.head_count % shape.kv_head_count != 0 {
        return Err(invalid("source kv_head_count must divide head_count"));
    }
    let shape_name = require_key(fields, "model_shape")?;
    if shape_name == "tiny-fixture" && !shape_matches(&shape, &ModelShape::tiny_fixture()) {
        return Err(invalid(
            "model_shape=tiny-fixture does not match dimensions",
        ));
    }
    if shape_name == "tinylm16" && !shape_matches(&shape, &ModelShape::tinylm16()) {
        return Err(invalid("model_shape=tinylm16 does not match dimensions"));
    }
    Ok(shape)
}

fn read_raw_f32_values(bytes: &[u8], tensor: &TensorSpec) -> io::Result<Vec<f32>> {
    let expected_bytes = tensor.element_count().checked_mul(4).ok_or_else(|| {
        invalid("source tensor byte length overflow while validating f32 payload")
    })?;
    if bytes.len() != expected_bytes {
        return Err(invalid("source tensor byte length does not match shape"));
    }

    let mut values = Vec::with_capacity(tensor.element_count());
    let mut any_nonzero = false;
    for chunk in bytes.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() {
            return Err(invalid("source tensor contains a non-finite f32 value"));
        }
        if value.abs() > MAX_ABS_SOURCE_WEIGHT {
            return Err(invalid("source tensor contains an out-of-range f32 value"));
        }
        any_nonzero |= value != 0.0;
        values.push(value);
    }
    if !any_nonzero {
        return Err(invalid("source tensor must not be entirely zero"));
    }
    Ok(values)
}

fn source_tensor_bytes(tensor: &TensorSpec) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::with_capacity(tensor.element_count() * 4);
    for elem in 0..tensor.element_count() {
        bytes.extend_from_slice(&fixture_value(tensor, elem).to_le_bytes());
    }
    Ok(bytes)
}

fn safe_tensor_path(source_dir: &Path, relative_file: &str) -> io::Result<PathBuf> {
    let path = Path::new(relative_file);
    if path.is_absolute() {
        return Err(invalid("source tensor file path must be relative"));
    }
    let mut components = path.components();
    match components.next() {
        Some(Component::Normal(first)) if first == "tensors" => {}
        _ => return Err(invalid("source tensor files must live under tensors/")),
    }
    for component in components {
        match component {
            Component::Normal(_) => {}
            _ => return Err(invalid("source tensor file path is not safe")),
        }
    }
    Ok(source_dir.join(path))
}

fn dtype_for_output(output_quantization: &str) -> io::Result<u32> {
    match output_quantization {
        "f32" => Ok(DTYPE_F32),
        "q8_0" => Ok(DTYPE_Q8_0),
        "q4_0" => Ok(DTYPE_Q4_0),
        _ => Err(invalid(
            "converted output quantization must be f32, q8_0, or q4_0",
        )),
    }
}

fn tensor_name_for_spec(shape: &ModelShape, index: usize) -> io::Result<String> {
    if index == 0 {
        return Ok("tok_embeddings.weight".to_string());
    }
    if index == 1 {
        return Ok("norm.weight".to_string());
    }
    if index == 2 {
        return Ok("output.weight".to_string());
    }
    let per_layer = 9usize;
    let layer_index = index
        .checked_sub(3)
        .ok_or_else(|| invalid("tensor index underflow"))?;
    let layer = layer_index / per_layer;
    let within = layer_index % per_layer;
    if layer >= shape.layer_count as usize {
        return Err(invalid("tensor index exceeds model shape"));
    }
    let suffix = match within {
        0 => Ok("attention_norm.weight"),
        1 => Ok("ffn_norm.weight"),
        2 => Ok("wq.weight"),
        3 => Ok("wk.weight"),
        4 => Ok("wv.weight"),
        5 => Ok("wo.weight"),
        6 => Ok("w1.weight"),
        7 => Ok("w2.weight"),
        8 => Ok("w3.weight"),
        _ => Err(invalid("invalid tensor index")),
    }?;
    Ok(format!("layers.{layer}.{suffix}"))
}

fn tensor_file_name(name: &str) -> String {
    let mut file = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            file.push(ch);
        } else {
            file.push('_');
        }
    }
    file.push_str(".f32");
    file
}

fn dims_text(tensor: &TensorSpec) -> String {
    let mut text = String::new();
    for (index, dim) in tensor.dims.iter().take(tensor.rank as usize).enumerate() {
        if index > 0 {
            text.push(',');
        }
        text.push_str(&dim.to_string());
    }
    text
}

fn push_shape_lines(text: &mut String, shape: &ModelShape) {
    push_line(text, "vocab_size", &shape.vocab_size.to_string());
    push_line(
        text,
        "special_token_count",
        &shape.special_token_count.to_string(),
    );
    push_line(text, "hidden_size", &shape.hidden_size.to_string());
    push_line(text, "layer_count", &shape.layer_count.to_string());
    push_line(text, "head_count", &shape.head_count.to_string());
    push_line(text, "kv_head_count", &shape.kv_head_count.to_string());
    push_line(text, "head_dim", &shape.head_dim.to_string());
    push_line(text, "ffn_size", &shape.ffn_size.to_string());
    push_line(text, "max_context", &shape.max_context.to_string());
}

fn shape_matches(a: &ModelShape, b: &ModelShape) -> bool {
    a.vocab_size == b.vocab_size
        && a.special_token_count == b.special_token_count
        && a.hidden_size == b.hidden_size
        && a.layer_count == b.layer_count
        && a.head_count == b.head_count
        && a.kv_head_count == b.kv_head_count
        && a.head_dim == b.head_dim
        && a.ffn_size == b.ffn_size
        && a.max_context == b.max_context
}

fn sidecar_manifest_path(output_slm: &Path) -> PathBuf {
    let mut value = output_slm.as_os_str().to_os_string();
    value.push(".manifest");
    PathBuf::from(value)
}

fn parse_key_value_manifest(text: &str) -> io::Result<HashMap<String, String>> {
    let mut fields = HashMap::new();
    for (line_index, raw_line) in text.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            return Err(invalid(&format!(
                "source manifest line {} is missing '='",
                line_index + 1
            )));
        };
        let key = key.trim();
        let value = value.trim();
        if key.is_empty() || value.is_empty() {
            return Err(invalid(&format!(
                "source manifest line {} has an empty key or value",
                line_index + 1
            )));
        }
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(invalid(&format!("duplicate source manifest key {key}")));
        }
    }
    Ok(fields)
}

fn require_evidence_field(fields: &HashMap<String, String>, key: &str) -> io::Result<()> {
    let value = require_key(fields, key)?;
    if value == "pending" || value == "not-reviewed" || value == "not-provided" || value.len() < 8 {
        return Err(invalid(&format!(
            "source field {key} must contain reviewed routing evidence"
        )));
    }
    Ok(())
}

fn parse_u32_key(fields: &HashMap<String, String>, key: &str) -> io::Result<u32> {
    require_key(fields, key)?
        .parse::<u32>()
        .map_err(|_| invalid(&format!("source manifest key {key} must be a u32")))
}

fn require_key<'a>(fields: &'a HashMap<String, String>, key: &str) -> io::Result<&'a str> {
    fields
        .get(key)
        .map(String::as_str)
        .ok_or_else(|| invalid(&format!("source manifest missing required key {key}")))
}

fn require_equal(fields: &HashMap<String, String>, key: &str, expected: &str) -> io::Result<()> {
    let actual = require_key(fields, key)?;
    if actual != expected {
        return Err(invalid(&format!(
            "source manifest key {key} was {actual}, expected {expected}"
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

fn source_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x6eed0e9da4d94a4fu64;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 3);
        acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
    acc
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_generated_source_fixture() {
        let dir = temp_path("source-fixture");
        write_source_template_path(&dir, "tiny-fixture").unwrap();

        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn converts_source_fixture_to_all_supported_slm_quantizations() {
        let dir = temp_path("source-convert");
        write_source_template_path(&dir, "tiny-fixture").unwrap();

        for quantization in ["f32", "q8_0", "q4_0"] {
            let output = dir.join(format!("converted-{quantization}.slm"));
            convert_trained_path(&dir, &output, quantization).unwrap();
            slm_validate::validate_path(&output).unwrap();
            provenance::validate_manifest_path(&output, &sidecar_manifest_path(&output)).unwrap();
        }
        cleanup(&dir);
    }

    #[test]
    fn rejects_source_checksum_drift() {
        let dir = temp_path("source-drift");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let first_tensor = dir.join("tensors").join("tok_embeddings_weight.f32");
        let mut bytes = fs::read(&first_tensor).unwrap();
        bytes[0] ^= 0x01;
        fs::write(first_tensor, bytes).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        cleanup(&dir);
    }

    #[test]
    fn rejects_non_finite_source_weight() {
        let dir = temp_path("source-nan");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let tensor_file = dir.join("tensors").join("tok_embeddings_weight.f32");
        let mut bytes = fs::read(&tensor_file).unwrap();
        bytes[0..4].copy_from_slice(&f32::NAN.to_le_bytes());
        fs::write(&tensor_file, &bytes).unwrap();
        refresh_manifest_checksum(
            &dir.join(SOURCE_MANIFEST_NAME),
            "tensor.0.checksum",
            source_checksum(&bytes),
        );

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        cleanup(&dir);
    }

    #[test]
    fn rejects_source_path_traversal() {
        let dir = temp_path("source-path");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path).unwrap().replace(
            "tensor.0.file=tensors/tok_embeddings_weight.f32",
            "tensor.0.file=../tok_embeddings_weight.f32",
        );
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        cleanup(&dir);
    }

    fn refresh_manifest_checksum(manifest_path: &Path, key: &str, checksum: u64) {
        let mut updated = String::new();
        let prefix = format!("{key}=");
        for line in fs::read_to_string(manifest_path).unwrap().lines() {
            if line.starts_with(&prefix) {
                updated.push_str(&format!("{key}=0x{checksum:016x}\n"));
            } else {
                updated.push_str(line);
                updated.push('\n');
            }
        }
        fs::write(manifest_path, updated).unwrap();
    }

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-{name}-{}-{nanos}", std::process::id()))
    }

    fn cleanup(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }
}
