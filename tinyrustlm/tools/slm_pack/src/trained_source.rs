//! Trained source-weight layout validation and conversion.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use crate::provenance;
use crate::slm_validate;
use crate::tensor_writer::{
    tensors_for_shape, tensors_for_shape_with_tied_output, ModelShape, TensorSpec, DTYPE_F32,
    DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::tokenizer_writer::{BpeMergeSpec, BpeTokenSpec, TokenizerSection};
use crate::{build_model_file_from_values_with_flags, fixture_value};

const SOURCE_MANIFEST_NAME: &str = "source.manifest";
const SOURCE_VERSION: &str = "1";
const SOURCE_LAYOUT: &str = "raw-f32-tensor-files-v1";
pub(crate) const SOURCE_REVIEW_KIND: &str = "safetensors-candidate-review";
pub(crate) const SOURCE_REVIEW_STATUS: &str = "validated-before-extraction";
pub(crate) const SOURCE_REVIEW_REQUIRED_NEXT_GATE: &str = "extract-raw-f32-tensors";
const MAX_ABS_SOURCE_WEIGHT: f32 = 64.0;
const FLAG_TIED_OUTPUT: u32 = 1;

struct SourceBundle {
    shape: ModelShape,
    tied_output: bool,
    tokenizer: TokenizerSection,
    tensors: Vec<TensorSpec>,
    values: Vec<Vec<f32>>,
}

#[derive(Clone, Copy)]
enum SourceTokenizerTemplate {
    Byte,
    TinyBpeDemo,
}

struct SourceTemplate {
    shape: ModelShape,
    tied_output: bool,
    tokenizer: SourceTokenizerTemplate,
}

/// Reviewed source-shape contract shared with safetensors intake planning.
pub(crate) struct SourceShapeContract {
    /// Model dimensions expected by the raw source shape.
    pub shape: ModelShape,
    /// Whether the source shape omits `output.weight` and reuses embeddings.
    pub tied_output: bool,
    /// Stable tokenizer strategy label for review artifacts.
    pub tokenizer_strategy: &'static str,
}

/// Ordered raw-source tensor expectation used by safetensors conversion planning.
pub(crate) struct SourceTensorExpectation {
    /// TinyRustLM tensor name expected by the raw-source manifest.
    pub name: String,
    /// Tensor dimensions in manifest order.
    pub dims: Vec<u64>,
    /// Safe relative output file path under the raw-source `tensors/` directory.
    pub relative_file: String,
    /// Byte count required by the raw f32 tensor payload.
    pub f32_bytes: u64,
}

/// Reviewed metadata attached to a raw-f32 trained export manifest.
pub(crate) struct SourceExportMetadata<'a> {
    /// Stable route or identifier for the reviewed source checkpoint.
    pub source_id: &'a str,
    /// License evidence or local review route attached to the source checkpoint.
    pub source_license: &'a str,
    /// Dataset or training corpus route attached to the source checkpoint.
    pub source_dataset: &'a str,
    /// Short training or extraction summary attached to the source checkpoint.
    pub source_training_summary: &'a str,
    /// Review artifact kind that authorized extraction, when available.
    pub source_review_kind: Option<&'a str>,
    /// Review validation status carried from the pre-extraction gate.
    pub source_review_status: Option<&'a str>,
    /// Checksum of the candidate-review artifact that authorized extraction.
    pub source_review_checksum: Option<&'a str>,
    /// Review-declared next gate that extraction consumes.
    pub source_review_required_next_gate: Option<&'a str>,
    /// Reviewed tokenizer rows to write instead of the shape template.
    pub source_tokenizer_override: Option<&'a SourceTokenizerOverride>,
}

/// Reviewed tokenizer manifest rows carried from a local source artifact.
pub(crate) struct SourceTokenizerOverride {
    /// Custom BPE token entries for ids outside byte fallback and specials.
    pub tokens: Vec<BpeTokenSpec>,
    /// Ranked BPE merge rules that produce custom token ids.
    pub merges: Vec<BpeMergeSpec>,
}

/// Ordered f32 tensor payload ready to be written into a raw-source bundle.
pub(crate) struct SourceTensorPayload {
    /// TinyRustLM tensor name for this payload.
    pub name: String,
    /// Raw little-endian f32 bytes for the tensor.
    pub bytes: Vec<u8>,
}

/// Writes a reviewable raw-f32 trained-source fixture directory.
pub fn write_source_template_path(output_dir: &Path, shape_name: &str) -> io::Result<()> {
    let template = template_for_name(shape_name)?;
    let shape = template.shape;
    let tied_output = template.tied_output;
    let tensors = tensors_for_shape_and_output(&shape, DTYPE_F32, tied_output);
    let tensor_names = tensor_names_for_shape(&shape, tied_output);
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
    push_line(
        &mut manifest,
        "tied_output",
        if tied_output { "true" } else { "false" },
    );
    push_tokenizer_template_lines(&mut manifest, template.tokenizer)?;
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
        let tensor_name = &tensor_names[index];
        let relative_file = format!("tensors/{}", tensor_file_name(tensor_name));
        let file_path = output_dir.join(&relative_file);
        let bytes = source_tensor_bytes(tensor)?;
        fs::write(&file_path, &bytes)?;

        let prefix = format!("tensor.{index}");
        push_line(&mut manifest, &format!("{prefix}.name"), tensor_name);
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
    println!("tied_output: {}", bundle.tied_output);
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
    let output_tensors = tensors_for_shape_and_output(&bundle.shape, dtype, bundle.tied_output);
    let flags = if bundle.tied_output {
        FLAG_TIED_OUTPUT
    } else {
        0
    };
    let bytes = build_model_file_from_values_with_flags(
        &bundle.shape,
        &output_tensors,
        &bundle.tokenizer,
        &bundle.values,
        flags,
    )?;

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

/// Confirms that a trained-source output quantization name maps to a supported `.slm` dtype.
pub(crate) fn validate_output_quantization(output_quantization: &str) -> io::Result<()> {
    dtype_for_output(output_quantization).map(|_| ())
}

/// Returns ordered raw-source tensor expectations for a supported TinyRustLM source shape.
pub(crate) fn source_tensor_expectations(
    shape_name: &str,
) -> io::Result<Vec<SourceTensorExpectation>> {
    let template = template_for_name(shape_name)?;
    let tensors = tensors_for_shape_and_output(&template.shape, DTYPE_F32, template.tied_output);
    let tensor_names = tensor_names_for_shape(&template.shape, template.tied_output);
    let mut expectations = Vec::with_capacity(tensors.len());
    for (index, tensor) in tensors.iter().enumerate() {
        let name = tensor_names[index].clone();
        let dims = tensor
            .dims
            .iter()
            .take(tensor.rank as usize)
            .map(|dim| u64::from(*dim))
            .collect::<Vec<_>>();
        let f32_bytes = (tensor.element_count() as u64)
            .checked_mul(4)
            .ok_or_else(|| invalid("source tensor f32 byte length overflow"))?;
        expectations.push(SourceTensorExpectation {
            relative_file: format!("tensors/{}", tensor_file_name(&name)),
            name,
            dims,
            f32_bytes,
        });
    }
    Ok(expectations)
}

/// Returns shape, output-head, and tokenizer metadata for a supported source shape.
pub(crate) fn source_shape_contract(shape_name: &str) -> io::Result<SourceShapeContract> {
    let template = template_for_name(shape_name)?;
    let tokenizer_strategy = match template.tokenizer {
        SourceTokenizerTemplate::Byte => "byte-tokenizer-v1",
        SourceTokenizerTemplate::TinyBpeDemo => "manifest-bpe-v1",
    };
    Ok(SourceShapeContract {
        shape: template.shape,
        tied_output: template.tied_output,
        tokenizer_strategy,
    })
}

/// Writes a reviewed raw-f32 trained export directory from ordered tensor payloads.
pub(crate) fn write_source_export_path(
    output_dir: &Path,
    shape_name: &str,
    metadata: &SourceExportMetadata<'_>,
    payloads: &[SourceTensorPayload],
) -> io::Result<()> {
    validate_evidence_value("source_id", metadata.source_id)?;
    validate_evidence_value("source_license", metadata.source_license)?;
    validate_evidence_value("source_dataset", metadata.source_dataset)?;
    validate_evidence_value("source_training_summary", metadata.source_training_summary)?;
    validate_source_review_metadata(metadata)?;

    let template = template_for_name(shape_name)?;
    let shape = template.shape;
    let tied_output = template.tied_output;
    let tensors = tensors_for_shape_and_output(&shape, DTYPE_F32, tied_output);
    let tensor_names = tensor_names_for_shape(&shape, tied_output);
    if payloads.len() != tensors.len() {
        return Err(invalid(
            "source export payload count does not match target source shape",
        ));
    }

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
    push_line(
        &mut manifest,
        "tied_output",
        if tied_output { "true" } else { "false" },
    );
    push_source_tokenizer_lines(
        &mut manifest,
        template.tokenizer,
        metadata.source_tokenizer_override,
        &shape,
    )?;
    push_line(&mut manifest, "source_dtype", "f32");
    push_line(&mut manifest, "source_kind", "trained-export");
    push_line(&mut manifest, "source_id", metadata.source_id);
    push_line(&mut manifest, "source_license", metadata.source_license);
    push_line(&mut manifest, "source_dataset", metadata.source_dataset);
    push_line(
        &mut manifest,
        "source_training_summary",
        metadata.source_training_summary,
    );
    if let (Some(kind), Some(status), Some(checksum), Some(required_next_gate)) = (
        metadata.source_review_kind,
        metadata.source_review_status,
        metadata.source_review_checksum,
        metadata.source_review_required_next_gate,
    ) {
        push_line(&mut manifest, "source_review_kind", kind);
        push_line(&mut manifest, "source_review_status", status);
        push_line(&mut manifest, "source_review_checksum", checksum);
        push_line(
            &mut manifest,
            "source_review_required_next_gate",
            required_next_gate,
        );
    }
    push_shape_lines(&mut manifest, &shape);
    push_line(&mut manifest, "tensor_count", &tensors.len().to_string());

    for (index, tensor) in tensors.iter().enumerate() {
        let expected_name = &tensor_names[index];
        let payload = &payloads[index];
        if payload.name != *expected_name {
            return Err(invalid(&format!(
                "source export payload {index} was {}, expected {expected_name}",
                payload.name
            )));
        }
        validate_raw_f32_tensor_bytes(&payload.bytes, tensor)?;
        let relative_file = format!("tensors/{}", tensor_file_name(expected_name));
        let file_path = output_dir.join(&relative_file);
        fs::write(&file_path, &payload.bytes)?;

        let prefix = format!("tensor.{index}");
        push_line(&mut manifest, &format!("{prefix}.name"), expected_name);
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
            &payload.bytes.len().to_string(),
        );
        push_line(
            &mut manifest,
            &format!("{prefix}.checksum"),
            &format!("0x{:016x}", source_checksum(&payload.bytes)),
        );
    }

    fs::write(output_dir.join(SOURCE_MANIFEST_NAME), manifest)?;
    Ok(())
}

fn read_source_bundle(source_dir: &Path) -> io::Result<SourceBundle> {
    let manifest_path = source_dir.join(SOURCE_MANIFEST_NAME);
    let manifest = fs::read_to_string(&manifest_path)?;
    let fields = parse_key_value_manifest(&manifest)?;
    validate_source_header(&fields)?;
    let shape = shape_from_fields(&fields)?;
    let tied_output = tied_output_from_fields(&fields)?;
    validate_shape_name_and_tied_output(&fields, &shape, tied_output)?;
    validate_shape_name_and_tokenizer(&fields)?;
    let tokenizer = tokenizer_from_fields(&fields, &shape)?;
    let expected_tensors = tensors_for_shape_and_output(&shape, DTYPE_F32, tied_output);
    let expected_names = tensor_names_for_shape(&shape, tied_output);
    require_equal(&fields, "tensor_count", &expected_tensors.len().to_string())?;

    let mut values = Vec::with_capacity(expected_tensors.len());
    for (index, expected) in expected_tensors.iter().enumerate() {
        let name = &expected_names[index];
        let prefix = format!("tensor.{index}");
        require_equal(&fields, &format!("{prefix}.name"), name)?;
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
        tied_output,
        tokenizer,
        tensors: expected_tensors,
        values,
    })
}

fn validate_source_header(fields: &HashMap<String, String>) -> io::Result<()> {
    require_equal(fields, "tinyrustlm_trained_source_version", SOURCE_VERSION)?;
    require_equal(fields, "model_family", "tinyrustlm")?;
    require_equal(fields, "layout", SOURCE_LAYOUT)?;
    match require_key(fields, "tokenizer")? {
        "byte-v1" | "bpe-v1" => {}
        _ => return Err(invalid("source tokenizer must be byte-v1 or bpe-v1")),
    }
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
    validate_source_review_fields(fields)?;
    Ok(())
}

fn template_for_name(shape_name: &str) -> io::Result<SourceTemplate> {
    match shape_name {
        "tiny-fixture" => Ok(SourceTemplate {
            shape: ModelShape::tiny_fixture(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tiny-fixture-tied" => Ok(SourceTemplate {
            shape: ModelShape::tiny_fixture(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tiny-fixture-bpe" => Ok(SourceTemplate {
            shape: tiny_bpe_fixture_shape(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::TinyBpeDemo,
        }),
        "tinylm16" => Ok(SourceTemplate {
            shape: ModelShape::tinylm16(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tinylm16-tied" => Ok(SourceTemplate {
            shape: ModelShape::tinylm16(),
            tied_output: true,
            tokenizer: SourceTokenizerTemplate::Byte,
        }),
        "tinylm16-bpe" => Ok(SourceTemplate {
            shape: tinylm16_bpe_shape(),
            tied_output: false,
            tokenizer: SourceTokenizerTemplate::TinyBpeDemo,
        }),
        _ => Err(invalid(
            "source-template shape must be tiny-fixture, tiny-fixture-tied, tiny-fixture-bpe, tinylm16, tinylm16-tied, or tinylm16-bpe",
        )),
    }
}

fn tiny_bpe_fixture_shape() -> ModelShape {
    ModelShape {
        vocab_size: 262,
        ..ModelShape::tiny_fixture()
    }
}

// Keeps the TinyLM-16M tensor layout while selecting the manifest-native BPE path.
fn tinylm16_bpe_shape() -> ModelShape {
    ModelShape {
        vocab_size: 262,
        ..ModelShape::tinylm16()
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
    if shape.kv_head_count > shape.head_count
        || !shape.head_count.is_multiple_of(shape.kv_head_count)
    {
        return Err(invalid("source kv_head_count must divide head_count"));
    }
    let shape_name = require_key(fields, "model_shape")?;
    if matches!(shape_name, "tiny-fixture" | "tiny-fixture-tied")
        && !shape_matches(&shape, &ModelShape::tiny_fixture())
    {
        return Err(invalid(
            "model_shape=tiny-fixture does not match dimensions",
        ));
    }
    if shape_name == "tiny-fixture-bpe" && !shape_matches(&shape, &tiny_bpe_fixture_shape()) {
        return Err(invalid(
            "model_shape=tiny-fixture-bpe does not match dimensions",
        ));
    }
    if matches!(shape_name, "tinylm16" | "tinylm16-tied")
        && !shape_matches(&shape, &ModelShape::tinylm16())
    {
        return Err(invalid("model_shape=tinylm16 does not match dimensions"));
    }
    if shape_name == "tinylm16-bpe" && !shape_matches_except_vocab(&shape, &ModelShape::tinylm16())
    {
        return Err(invalid(
            "model_shape=tinylm16-bpe must match TinyLM-16M dimensions except vocab_size",
        ));
    }
    if !matches!(
        shape_name,
        "tiny-fixture"
            | "tiny-fixture-tied"
            | "tiny-fixture-bpe"
            | "tinylm16"
            | "tinylm16-tied"
            | "tinylm16-bpe"
    ) {
        return Err(invalid(
            "model_shape must be tiny-fixture, tiny-fixture-tied, tiny-fixture-bpe, tinylm16, tinylm16-tied, or tinylm16-bpe",
        ));
    }
    Ok(shape)
}

fn tied_output_from_fields(fields: &HashMap<String, String>) -> io::Result<bool> {
    match fields.get("tied_output").map(String::as_str) {
        Some("true") => Ok(true),
        Some("false") | None => Ok(false),
        Some(_) => Err(invalid(
            "source manifest key tied_output must be true or false",
        )),
    }
}

fn validate_shape_name_and_tied_output(
    fields: &HashMap<String, String>,
    _shape: &ModelShape,
    tied_output: bool,
) -> io::Result<()> {
    let shape_name = require_key(fields, "model_shape")?;
    let shape_name_is_tied = matches!(shape_name, "tiny-fixture-tied" | "tinylm16-tied");
    if shape_name_is_tied != tied_output {
        return Err(invalid(
            "source manifest model_shape and tied_output must agree",
        ));
    }
    Ok(())
}

fn validate_shape_name_and_tokenizer(fields: &HashMap<String, String>) -> io::Result<()> {
    let shape_name = require_key(fields, "model_shape")?;
    let tokenizer = require_key(fields, "tokenizer")?;
    let shape_name_is_bpe = matches!(shape_name, "tiny-fixture-bpe" | "tinylm16-bpe");
    if shape_name_is_bpe && tokenizer != "bpe-v1" {
        return Err(invalid("BPE source model_shape requires tokenizer=bpe-v1"));
    }
    if !shape_name_is_bpe && tokenizer == "bpe-v1" {
        return Err(invalid(
            "tokenizer=bpe-v1 requires a BPE source model_shape",
        ));
    }
    Ok(())
}

fn tokenizer_from_fields(
    fields: &HashMap<String, String>,
    shape: &ModelShape,
) -> io::Result<TokenizerSection> {
    match require_key(fields, "tokenizer")? {
        "byte-v1" => Ok(TokenizerSection::phase_one()),
        "bpe-v1" => bpe_tokenizer_from_fields(fields, shape.vocab_size),
        _ => Err(invalid("source tokenizer must be byte-v1 or bpe-v1")),
    }
}

fn bpe_tokenizer_from_fields(
    fields: &HashMap<String, String>,
    vocab_size: u32,
) -> io::Result<TokenizerSection> {
    let token_count = parse_usize_key(fields, "bpe_token_count")?;
    let merge_count = parse_usize_key(fields, "bpe_merge_count")?;
    if token_count == 0 || merge_count == 0 {
        return Err(invalid(
            "BPE source tokenizer requires at least one token and one merge",
        ));
    }
    let mut tokens = Vec::with_capacity(token_count);
    for index in 0..token_count {
        let prefix = format!("bpe.token.{index}");
        let id = parse_u32_key(fields, &format!("{prefix}.id"))?;
        let bytes = parse_hex_bytes(require_key(fields, &format!("{prefix}.bytes_hex"))?)?;
        tokens.push(BpeTokenSpec { id, bytes });
    }

    let mut merges = Vec::with_capacity(merge_count);
    for index in 0..merge_count {
        let prefix = format!("bpe.merge.{index}");
        let left = parse_u32_key(fields, &format!("{prefix}.left"))?;
        let right = parse_u32_key(fields, &format!("{prefix}.right"))?;
        let output = parse_u32_key(fields, &format!("{prefix}.output"))?;
        let rank = parse_u32_key(fields, &format!("{prefix}.rank"))?;
        merges.push(BpeMergeSpec {
            left,
            right,
            output,
            rank,
        });
    }
    reject_extra_bpe_keys(fields, token_count, merge_count)?;
    validate_bpe_parts(vocab_size, &tokens, &merges)?;
    Ok(TokenizerSection::bpe_from_parts(
        vocab_size, &tokens, &merges,
    ))
}

/// Validates reusable BPE parts before they are written or converted.
fn validate_bpe_parts(
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    if tokens.is_empty() || merges.is_empty() {
        return Err(invalid(
            "BPE source tokenizer requires at least one token and one merge",
        ));
    }
    for (index, token) in tokens.iter().enumerate() {
        if token.id < 260 || token.id >= vocab_size || token.bytes.is_empty() {
            return Err(invalid(
                "BPE token entry is outside the declared vocabulary",
            ));
        }
        if tokens[..index].iter().any(|seen| seen.id == token.id) {
            return Err(invalid("BPE token ids must be unique"));
        }
    }
    for (index, merge) in merges.iter().enumerate() {
        if merge.left >= vocab_size
            || merge.right >= vocab_size
            || merge.output >= vocab_size
            || merge.output < 260
        {
            return Err(invalid("BPE merge ids must stay inside vocabulary"));
        }
        if !tokens.iter().any(|token| token.id == merge.output) {
            return Err(invalid("BPE merge output must reference a declared token"));
        }
        if merges[..index].iter().any(|seen| seen.rank == merge.rank) {
            return Err(invalid("BPE merge ranks must be unique"));
        }
    }
    Ok(())
}

fn tensors_for_shape_and_output(
    shape: &ModelShape,
    dtype: u32,
    tied_output: bool,
) -> Vec<TensorSpec> {
    if tied_output {
        tensors_for_shape_with_tied_output(shape, dtype)
    } else {
        tensors_for_shape(shape, dtype)
    }
}

fn read_raw_f32_values(bytes: &[u8], tensor: &TensorSpec) -> io::Result<Vec<f32>> {
    validate_raw_f32_tensor_bytes(bytes, tensor)?;
    let mut values = Vec::with_capacity(tensor.element_count());
    for chunk in bytes.chunks_exact(4) {
        values.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    Ok(values)
}

fn validate_raw_f32_tensor_bytes(bytes: &[u8], tensor: &TensorSpec) -> io::Result<()> {
    let expected_bytes = tensor.element_count().checked_mul(4).ok_or_else(|| {
        invalid("source tensor byte length overflow while validating f32 payload")
    })?;
    if bytes.len() != expected_bytes {
        return Err(invalid("source tensor byte length does not match shape"));
    }

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
    }
    if !any_nonzero {
        return Err(invalid("source tensor must not be entirely zero"));
    }
    Ok(())
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

fn tensor_names_for_shape(shape: &ModelShape, tied_output: bool) -> Vec<String> {
    let mut names = vec![
        "tok_embeddings.weight".to_string(),
        "norm.weight".to_string(),
    ];
    if !tied_output {
        names.push("output.weight".to_string());
    }
    let per_layer = 9usize;
    names.reserve(shape.layer_count as usize * per_layer);
    for layer in 0..shape.layer_count {
        for suffix in [
            "attention_norm.weight",
            "ffn_norm.weight",
            "wq.weight",
            "wk.weight",
            "wv.weight",
            "wo.weight",
            "w1.weight",
            "w2.weight",
            "w3.weight",
        ] {
            names.push(format!("layers.{layer}.{suffix}"));
        }
    }
    names
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

/// Writes tokenizer rows from either a reviewed override or the shape template.
fn push_source_tokenizer_lines(
    text: &mut String,
    tokenizer: SourceTokenizerTemplate,
    tokenizer_override: Option<&SourceTokenizerOverride>,
    shape: &ModelShape,
) -> io::Result<()> {
    match tokenizer_override {
        Some(override_rows) => {
            if !matches!(tokenizer, SourceTokenizerTemplate::TinyBpeDemo) {
                return Err(invalid(
                    "source tokenizer override requires a BPE source model_shape",
                ));
            }
            push_bpe_tokenizer_lines(
                text,
                shape.vocab_size,
                &override_rows.tokens,
                &override_rows.merges,
            )
        }
        None => push_tokenizer_template_lines(text, tokenizer),
    }
}

/// Writes tokenizer rows supplied by a source-shape template.
fn push_tokenizer_template_lines(
    text: &mut String,
    tokenizer: SourceTokenizerTemplate,
) -> io::Result<()> {
    match tokenizer {
        SourceTokenizerTemplate::Byte => {
            push_line(text, "tokenizer", "byte-v1");
            Ok(())
        }
        SourceTokenizerTemplate::TinyBpeDemo => {
            let tokens = tiny_bpe_token_specs();
            let merges = tiny_bpe_merge_specs();
            push_bpe_tokenizer_lines(text, 262, &tokens, &merges)
        }
    }
}

/// Writes BPE tokenizer rows after validating ids, ranks, and vocabulary bounds.
fn push_bpe_tokenizer_lines(
    text: &mut String,
    vocab_size: u32,
    tokens: &[BpeTokenSpec],
    merges: &[BpeMergeSpec],
) -> io::Result<()> {
    validate_bpe_parts(vocab_size, tokens, merges)?;
    push_line(text, "tokenizer", "bpe-v1");
    push_line(text, "bpe_token_count", &tokens.len().to_string());
    push_line(text, "bpe_merge_count", &merges.len().to_string());
    for (index, token) in tokens.iter().enumerate() {
        let prefix = format!("bpe.token.{index}");
        push_line(text, &format!("{prefix}.id"), &token.id.to_string());
        push_line(
            text,
            &format!("{prefix}.bytes_hex"),
            &hex_bytes(&token.bytes),
        );
    }
    for (index, merge) in merges.iter().enumerate() {
        let prefix = format!("bpe.merge.{index}");
        push_line(text, &format!("{prefix}.left"), &merge.left.to_string());
        push_line(text, &format!("{prefix}.right"), &merge.right.to_string());
        push_line(text, &format!("{prefix}.output"), &merge.output.to_string());
        push_line(text, &format!("{prefix}.rank"), &merge.rank.to_string());
    }
    Ok(())
}

fn tiny_bpe_token_specs() -> Vec<BpeTokenSpec> {
    vec![
        BpeTokenSpec {
            id: 260,
            bytes: b"th".to_vec(),
        },
        BpeTokenSpec {
            id: 261,
            bytes: b"the".to_vec(),
        },
    ]
}

fn tiny_bpe_merge_specs() -> Vec<BpeMergeSpec> {
    vec![
        BpeMergeSpec {
            left: 116,
            right: 104,
            output: 260,
            rank: 0,
        },
        BpeMergeSpec {
            left: 260,
            right: 101,
            output: 261,
            rank: 1,
        },
    ]
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

fn shape_matches_except_vocab(a: &ModelShape, b: &ModelShape) -> bool {
    a.special_token_count == b.special_token_count
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
    validate_evidence_value(key, value)
}

fn validate_source_review_metadata(metadata: &SourceExportMetadata<'_>) -> io::Result<()> {
    let values = [
        metadata.source_review_kind,
        metadata.source_review_status,
        metadata.source_review_checksum,
        metadata.source_review_required_next_gate,
    ];
    if values.iter().all(|value| value.is_none()) {
        return Ok(());
    }
    let kind = metadata
        .source_review_kind
        .ok_or_else(|| invalid("source review metadata missing source_review_kind"))?;
    let status = metadata
        .source_review_status
        .ok_or_else(|| invalid("source review metadata missing source_review_status"))?;
    let checksum = metadata
        .source_review_checksum
        .ok_or_else(|| invalid("source review metadata missing source_review_checksum"))?;
    let required_next_gate = metadata.source_review_required_next_gate.ok_or_else(|| {
        invalid("source review metadata missing source_review_required_next_gate")
    })?;
    validate_source_review_record(kind, status, checksum, required_next_gate)
}

fn validate_source_review_fields(fields: &HashMap<String, String>) -> io::Result<()> {
    let keys = [
        "source_review_kind",
        "source_review_status",
        "source_review_checksum",
        "source_review_required_next_gate",
    ];
    if !keys.iter().any(|key| fields.contains_key(*key)) {
        return Ok(());
    }
    let kind = require_key(fields, "source_review_kind")?;
    let status = require_key(fields, "source_review_status")?;
    let checksum = require_key(fields, "source_review_checksum")?;
    let required_next_gate = require_key(fields, "source_review_required_next_gate")?;
    validate_source_review_record(kind, status, checksum, required_next_gate)
}

fn validate_source_review_record(
    kind: &str,
    status: &str,
    checksum: &str,
    required_next_gate: &str,
) -> io::Result<()> {
    if kind != SOURCE_REVIEW_KIND {
        return Err(invalid("source_review_kind is invalid"));
    }
    if status != SOURCE_REVIEW_STATUS {
        return Err(invalid("source_review_status is invalid"));
    }
    validate_hex64_text("source_review_checksum", checksum)?;
    if required_next_gate != SOURCE_REVIEW_REQUIRED_NEXT_GATE {
        return Err(invalid("source_review_required_next_gate is invalid"));
    }
    Ok(())
}

fn validate_evidence_value(key: &str, value: &str) -> io::Result<()> {
    if value == "pending" || value == "not-reviewed" || value == "not-provided" || value.len() < 8 {
        return Err(invalid(&format!(
            "source field {key} must contain reviewed routing evidence"
        )));
    }
    Ok(())
}

fn validate_hex64_text(key: &str, value: &str) -> io::Result<()> {
    let Some(rest) = value.strip_prefix("0x") else {
        return Err(invalid(&format!(
            "source field {key} must be a hex64 checksum"
        )));
    };
    if rest.len() != 16 || !rest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(invalid(&format!(
            "source field {key} must be a hex64 checksum"
        )));
    }
    Ok(())
}

fn parse_u32_key(fields: &HashMap<String, String>, key: &str) -> io::Result<u32> {
    require_key(fields, key)?
        .parse::<u32>()
        .map_err(|_| invalid(&format!("source manifest key {key} must be a u32")))
}

fn parse_usize_key(fields: &HashMap<String, String>, key: &str) -> io::Result<usize> {
    require_key(fields, key)?
        .parse::<usize>()
        .map_err(|_| invalid(&format!("source manifest key {key} must be a usize")))
}

fn reject_extra_bpe_keys(
    fields: &HashMap<String, String>,
    token_count: usize,
    merge_count: usize,
) -> io::Result<()> {
    for key in fields.keys() {
        if let Some(rest) = key.strip_prefix("bpe.token.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("BPE token key {key} is malformed")));
            };
            let index = index_text
                .parse::<usize>()
                .map_err(|_| invalid(&format!("BPE token key {key} has invalid index")))?;
            if index >= token_count {
                return Err(invalid(&format!(
                    "BPE token key {key} is outside declared bpe_token_count"
                )));
            }
            match field_name {
                "id" | "bytes_hex" => {}
                _ => return Err(invalid(&format!("BPE token key {key} has unknown field"))),
            }
        }
        if let Some(rest) = key.strip_prefix("bpe.merge.") {
            let Some((index_text, field_name)) = rest.split_once('.') else {
                return Err(invalid(&format!("BPE merge key {key} is malformed")));
            };
            let index = index_text
                .parse::<usize>()
                .map_err(|_| invalid(&format!("BPE merge key {key} has invalid index")))?;
            if index >= merge_count {
                return Err(invalid(&format!(
                    "BPE merge key {key} is outside declared bpe_merge_count"
                )));
            }
            match field_name {
                "left" | "right" | "output" | "rank" => {}
                _ => return Err(invalid(&format!("BPE merge key {key} has unknown field"))),
            }
        }
    }
    Ok(())
}

fn parse_hex_bytes(value: &str) -> io::Result<Vec<u8>> {
    if !value.len().is_multiple_of(2) {
        return Err(invalid("BPE token bytes_hex must have even length"));
    }
    let mut bytes = Vec::with_capacity(value.len() / 2);
    for pair in value.as_bytes().chunks_exact(2) {
        let high = hex_nibble(pair[0])?;
        let low = hex_nibble(pair[1])?;
        bytes.push((high << 4) | low);
    }
    Ok(bytes)
}

fn hex_nibble(byte: u8) -> io::Result<u8> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err(invalid("BPE token bytes_hex contains a non-hex digit")),
    }
}

fn hex_bytes(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut text = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        text.push(HEX[(byte >> 4) as usize] as char);
        text.push(HEX[(byte & 0x0f) as usize] as char);
    }
    text
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
    use crate::tensor_writer::name_hash;

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
    fn validates_output_quantization_parameter_before_conversion() {
        for quantization in ["f32", "q8_0", "q4_0"] {
            validate_output_quantization(quantization).unwrap();
        }

        let error = validate_output_quantization("q2_0").unwrap_err();

        assert!(error
            .to_string()
            .contains("converted output quantization must be f32, q8_0, or q4_0"));
    }

    #[test]
    fn returns_ordered_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("tiny-fixture-tied").unwrap();

        assert_eq!(expectations.len(), 11);
        assert_eq!(expectations[0].name, "tok_embeddings.weight");
        assert_eq!(expectations[0].dims, vec![260, 8]);
        assert_eq!(
            expectations[0].relative_file,
            "tensors/tok_embeddings_weight.f32"
        );
        assert_eq!(expectations[0].f32_bytes, 260 * 8 * 4);
        assert!(!expectations
            .iter()
            .any(|expectation| expectation.name == "output.weight"));
    }

    #[test]
    fn returns_tinylm16_bpe_source_tensor_expectations_for_planning() {
        let expectations = source_tensor_expectations("tinylm16-bpe").unwrap();
        let template = template_for_name("tinylm16-bpe").unwrap();

        assert!(matches!(
            template.tokenizer,
            SourceTokenizerTemplate::TinyBpeDemo
        ));
        assert_eq!(template.shape.hidden_size, 512);
        assert_eq!(template.shape.vocab_size, 262);
        assert_eq!(expectations.len(), 39);
        assert_eq!(expectations[0].name, "tok_embeddings.weight");
        assert_eq!(expectations[0].dims, vec![262, 512]);
        assert_eq!(expectations[2].name, "output.weight");
        assert_eq!(expectations[2].dims, vec![262, 512]);
        assert_eq!(expectations[0].f32_bytes, 262 * 512 * 4);
    }

    #[test]
    fn writes_reviewed_source_export_and_validates_metadata() {
        let dir = temp_path("source-export");
        let payloads = one_f32_payloads("tiny-fixture-tied");
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-001",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: Some(SOURCE_REVIEW_STATUS),
            source_review_checksum: Some("0x00000000000000f1"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: None,
        };

        write_source_export_path(&dir, "tiny-fixture-tied", &metadata, &payloads).unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("source_kind=trained-export"));
        assert!(manifest.contains("source_id=reviewed-source-001"));
        assert!(manifest.contains("source_license=reviewed-local-license"));
        assert!(manifest.contains("source_dataset=reviewed-local-dataset"));
        assert!(manifest
            .contains("source_training_summary=Reviewed local safetensors extraction route"));
        assert!(manifest.contains("source_review_kind=safetensors-candidate-review"));
        assert!(manifest.contains("source_review_status=validated-before-extraction"));
        assert!(manifest.contains("source_review_checksum=0x00000000000000f1"));
        assert!(manifest.contains("source_review_required_next_gate=extract-raw-f32-tensors"));
        assert!(manifest.contains("model_shape=tiny-fixture-tied"));
        assert!(!manifest.contains("output.weight"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn writes_reviewed_source_export_with_bpe_tokenizer_override() {
        let dir = temp_path("source-export-bpe-override");
        let payloads = one_f32_payloads("tiny-fixture-bpe");
        let tokenizer_override = SourceTokenizerOverride {
            tokens: vec![BpeTokenSpec {
                id: 260,
                bytes: b"to".to_vec(),
            }],
            merges: vec![BpeMergeSpec {
                left: 116,
                right: 111,
                output: 260,
                rank: 0,
            }],
        };
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-bpe",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local BPE safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: Some(SOURCE_REVIEW_STATUS),
            source_review_checksum: Some("0x00000000000000b1"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: Some(&tokenizer_override),
        };

        write_source_export_path(&dir, "tiny-fixture-bpe", &metadata, &payloads).unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-bpe"));
        assert!(manifest.contains("tokenizer=bpe-v1"));
        assert!(manifest.contains("bpe_token_count=1"));
        assert!(manifest.contains("bpe_merge_count=1"));
        assert!(manifest.contains("bpe.token.0.bytes_hex=746f"));
        assert!(manifest.contains("bpe.merge.0.right=111"));
        assert!(!manifest.contains("bpe.token.0.bytes_hex=7468"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn rejects_source_export_metadata_without_reviewed_evidence() {
        let dir = temp_path("source-export-metadata");
        let payloads = one_f32_payloads("tiny-fixture");
        let metadata = SourceExportMetadata {
            source_id: "pending",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: None,
            source_review_status: None,
            source_review_checksum: None,
            source_review_required_next_gate: None,
            source_tokenizer_override: None,
        };

        let error =
            write_source_export_path(&dir, "tiny-fixture", &metadata, &payloads).unwrap_err();

        assert!(error.to_string().contains("source field source_id"));
    }

    #[test]
    fn rejects_source_export_partial_review_metadata() {
        let dir = temp_path("source-export-partial-review");
        let payloads = one_f32_payloads("tiny-fixture");
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-001",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: Some(SOURCE_REVIEW_KIND),
            source_review_status: None,
            source_review_checksum: Some("0x00000000000000f1"),
            source_review_required_next_gate: Some(SOURCE_REVIEW_REQUIRED_NEXT_GATE),
            source_tokenizer_override: None,
        };

        let error =
            write_source_export_path(&dir, "tiny-fixture", &metadata, &payloads).unwrap_err();

        assert!(error.to_string().contains("source_review_status"));
    }

    #[test]
    fn rejects_source_export_payload_name_mismatch() {
        let dir = temp_path("source-export-payload-name");
        let mut payloads = one_f32_payloads("tiny-fixture");
        payloads[0].name = "wrong.weight".to_string();
        let metadata = SourceExportMetadata {
            source_id: "reviewed-source-001",
            source_license: "reviewed-local-license",
            source_dataset: "reviewed-local-dataset",
            source_training_summary: "Reviewed local safetensors extraction route",
            source_review_kind: None,
            source_review_status: None,
            source_review_checksum: None,
            source_review_required_next_gate: None,
            source_tokenizer_override: None,
        };

        let error =
            write_source_export_path(&dir, "tiny-fixture", &metadata, &payloads).unwrap_err();

        assert!(error
            .to_string()
            .contains("source export payload 0 was wrong.weight"));
    }

    #[test]
    fn validates_generated_tied_source_fixture_without_output_tensor() {
        let dir = temp_path("source-tied-fixture");
        write_source_template_path(&dir, "tiny-fixture-tied").unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-tied"));
        assert!(manifest.contains("tied_output=true"));
        assert!(manifest.contains("tensor_count=11"));
        assert!(!manifest.contains("output.weight"));
        assert!(!dir.join("tensors").join("output_weight.f32").exists());
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn rejects_tied_output_manifest_shape_disagreement() {
        let dir = temp_path("source-tied-disagreement");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path)
            .unwrap()
            .replace("tied_output=false", "tied_output=true");
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("model_shape and tied_output"));
        cleanup(&dir);
    }

    #[test]
    fn converts_tied_source_fixture_to_all_supported_slm_quantizations() {
        let dir = temp_path("source-tied-convert");
        write_source_template_path(&dir, "tiny-fixture-tied").unwrap();

        for quantization in ["f32", "q8_0", "q4_0"] {
            let output = dir.join(format!("tied-converted-{quantization}.slm"));
            convert_trained_path(&dir, &output, quantization).unwrap();
            let bytes = fs::read(&output).unwrap();
            let report =
                slm_validate::validate_bytes(&bytes, &output.display().to_string()).unwrap();
            assert_eq!(read_u32_le(&bytes, 16) & FLAG_TIED_OUTPUT, FLAG_TIED_OUTPUT);
            assert_eq!(report.tensor_count(), 11);
            assert!(!contains_tensor_hash(&bytes, name_hash("output.weight")));
            assert!(contains_tensor_hash(
                &bytes,
                name_hash("tok_embeddings.weight")
            ));
            provenance::validate_manifest_path(&output, &sidecar_manifest_path(&output)).unwrap();
        }
        cleanup(&dir);
    }

    #[test]
    fn validates_generated_bpe_source_fixture() {
        let dir = temp_path("source-bpe-fixture");
        write_source_template_path(&dir, "tiny-fixture-bpe").unwrap();

        let manifest = fs::read_to_string(dir.join(SOURCE_MANIFEST_NAME)).unwrap();
        assert!(manifest.contains("model_shape=tiny-fixture-bpe"));
        assert!(manifest.contains("tokenizer=bpe-v1"));
        assert!(manifest.contains("vocab_size=262"));
        assert!(manifest.contains("bpe.token.1.bytes_hex=746865"));
        validate_source_path(&dir).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn converts_bpe_source_fixture_to_bpe_slm() {
        let dir = temp_path("source-bpe-convert");
        write_source_template_path(&dir, "tiny-fixture-bpe").unwrap();
        let output = dir.join("bpe-converted-q8.slm");

        convert_trained_path(&dir, &output, "q8_0").unwrap();

        let bytes = fs::read(&output).unwrap();
        let report = slm_validate::validate_bytes(&bytes, &output.display().to_string()).unwrap();
        assert!(report.shape_summary().starts_with("vocab=262,"));
        assert_eq!(bytes[108..112], *b"BPE1");
        provenance::validate_manifest_path(&output, &sidecar_manifest_path(&output)).unwrap();
        cleanup(&dir);
    }

    #[test]
    fn rejects_bpe_source_manifest_without_matching_shape() {
        let dir = temp_path("source-bpe-shape-mismatch");
        write_source_template_path(&dir, "tiny-fixture").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path)
            .unwrap()
            .replace("tokenizer=byte-v1", "tokenizer=bpe-v1");
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("BPE source model_shape"));
        cleanup(&dir);
    }

    #[test]
    fn rejects_bpe_source_merge_outside_vocab() {
        let dir = temp_path("source-bpe-merge-output");
        write_source_template_path(&dir, "tiny-fixture-bpe").unwrap();
        let manifest_path = dir.join(SOURCE_MANIFEST_NAME);
        let manifest = fs::read_to_string(&manifest_path)
            .unwrap()
            .replace("bpe.merge.1.output=261", "bpe.merge.1.output=300");
        fs::write(&manifest_path, manifest).unwrap();

        let error = validate_source_path(&dir).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("inside vocabulary"));
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

    fn read_u32_le(bytes: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ])
    }

    fn read_u64_le(bytes: &[u8], offset: usize) -> u64 {
        u64::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ])
    }

    fn contains_tensor_hash(bytes: &[u8], hash: u64) -> bool {
        let directory = read_u64_le(bytes, 80) as usize;
        let count = read_u32_le(bytes, 88) as usize;
        (0..count).any(|index| read_u64_le(bytes, directory + index * 64) == hash)
    }

    fn temp_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("tinyrustlm-{name}-{}-{nanos}", std::process::id()))
    }

    fn one_f32_payloads(shape_name: &str) -> Vec<SourceTensorPayload> {
        source_tensor_expectations(shape_name)
            .unwrap()
            .into_iter()
            .map(|expectation| {
                let mut bytes = Vec::with_capacity(expectation.f32_bytes as usize);
                for _ in 0..(expectation.f32_bytes / 4) {
                    bytes.extend_from_slice(&1.0f32.to_le_bytes());
                }
                SourceTensorPayload {
                    name: expectation.name,
                    bytes,
                }
            })
            .collect()
    }

    fn cleanup(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }
}
