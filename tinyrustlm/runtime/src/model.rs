//! Loaded model metadata and tensor storage.

use crate::adapter::{
    parameter_count, read_f32, read_low_rank_delta_value, read_sparse_delta_pair, section_checksum,
    tensor_layout_checksum, AdapterDelta, AdapterDeltaPayload, AdapterDeltaPayloadKind,
    AdapterExpected,
};
use crate::errors::ErrorCode;
use crate::model_format::{
    name_hash, parse_slm, ParsedSlm, SlmHeader, TensorEntry, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::ops::matvec_f32;
use crate::quant::{matvec_q4_0, matvec_q8_0, pack_q4_pair, quantize_q4_block, quantize_q8_row};
use crate::tokenizer::Tokenizer;
use std::convert::TryInto;

const FLAG_TIED_OUTPUT: u32 = 1;
const TOKENIZER_CHECKSUM_SEED: u64 = 0x746f6b656e697a65;

/// Loaded model directory and header.
#[derive(Debug)]
pub struct Model {
    parsed: ParsedSlm,
    tensors: Vec<LoadedTensor>,
    tokenizer: Tokenizer,
    parameter_count: u64,
    tensor_layout_checksum: u64,
    tokenizer_checksum: u64,
    top_level_indices: TopLevelTensorIndices,
    layer_indices: Vec<LayerTensorIndices>,
}

/// Pre-resolved indices for model-level tensors used during generation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct TopLevelTensorIndices {
    /// Token embedding matrix index.
    pub(crate) tok_embeddings: usize,
    /// Final normalization weight index.
    pub(crate) norm: usize,
    /// Output projection matrix index, falling back to embeddings when tied.
    pub(crate) output_projection: usize,
}

/// Pre-resolved indices for one decoder layer's tensors.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct LayerTensorIndices {
    /// Attention RMSNorm weight index.
    pub(crate) attention_norm: usize,
    /// Feed-forward RMSNorm weight index.
    pub(crate) ffn_norm: usize,
    /// Query projection matrix index.
    pub(crate) wq: usize,
    /// Key projection matrix index.
    pub(crate) wk: usize,
    /// Value projection matrix index.
    pub(crate) wv: usize,
    /// Attention output projection matrix index.
    pub(crate) wo: usize,
    /// SwiGLU gate projection matrix index.
    pub(crate) w1: usize,
    /// Feed-forward down projection matrix index.
    pub(crate) w2: usize,
    /// SwiGLU up projection matrix index.
    pub(crate) w3: usize,
}

#[derive(Debug)]
struct LoadedTensor {
    entry: TensorEntry,
    storage: TensorStorage,
}

#[derive(Debug)]
enum TensorStorage {
    F32 {
        data: Vec<f32>,
    },
    Q8 {
        weights: Vec<i8>,
        scales: Vec<f32>,
    },
    Q4 {
        packed: Vec<u8>,
        scales: Vec<f32>,
        block_size: usize,
    },
}

impl LoadedTensor {
    fn f32_data(&self) -> Result<&[f32], ErrorCode> {
        match &self.storage {
            TensorStorage::F32 { data } => Ok(data),
            TensorStorage::Q8 { .. } | TensorStorage::Q4 { .. } => Err(ErrorCode::UnsupportedDType),
        }
    }

    fn copy_f32(&self, out: &mut [f32]) -> Result<(), ErrorCode> {
        let expected = tensor_element_count(&self.entry)?;
        if out.len() != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        match &self.storage {
            TensorStorage::F32 { data } => {
                out.copy_from_slice(data);
                Ok(())
            }
            TensorStorage::Q8 { weights, scales } => {
                let (rows, cols) = tensor_matrix_shape(&self.entry)?;
                for row in 0..rows {
                    let scale = scales[row];
                    let start = row * cols;
                    for col in 0..cols {
                        out[start + col] = f32::from(weights[start + col]) * scale;
                    }
                }
                Ok(())
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => copy_q4_to_f32(packed, scales, *block_size, &self.entry, out),
        }
    }

    fn copy_row_f32(&self, row: usize, cols: usize, out: &mut [f32]) -> Result<(), ErrorCode> {
        let (rows, expected_cols) = tensor_matrix_shape(&self.entry)?;
        if row >= rows || cols != expected_cols || out.len() != cols {
            return Err(ErrorCode::ShapeMismatch);
        }
        match &self.storage {
            TensorStorage::F32 { data } => {
                let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                out.copy_from_slice(&data[start..start + cols]);
                Ok(())
            }
            TensorStorage::Q8 { weights, scales } => {
                let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let scale = scales[row];
                for col in 0..cols {
                    out[col] = f32::from(weights[start + col]) * scale;
                }
                Ok(())
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => copy_q4_row_to_f32(packed, scales, *block_size, &self.entry, row, cols, out),
        }
    }

    fn matvec(
        &self,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        let expected = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
        if tensor_element_count(&self.entry)? != expected {
            return Err(ErrorCode::ShapeMismatch);
        }
        match &self.storage {
            TensorStorage::F32 { data } => matvec_f32(data, rows, cols, vector, out),
            TensorStorage::Q8 { weights, scales } => {
                matvec_q8_0(weights, scales, rows, cols, vector, out)
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => matvec_q4_0(packed, scales, *block_size, rows, cols, vector, out),
        }
    }

    fn validate_adapter_payload(
        &self,
        bytes: &[u8],
        payload: AdapterDeltaPayload,
    ) -> Result<(), ErrorCode> {
        if tensor_element_count(&self.entry)? != payload.element_count {
            return Err(ErrorCode::ShapeMismatch);
        }
        match payload.kind {
            AdapterDeltaPayloadKind::RawF32 => {
                for value_index in 0..payload.element_count {
                    let value = self.f32_value_at(value_index)?
                        + adapter_delta_value(bytes, payload, value_index)?;
                    if !value.is_finite() {
                        return Err(ErrorCode::InvalidHeader);
                    }
                }
            }
            AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
                for pair_index in 0..pair_count {
                    let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                    let value = self.f32_value_at(value_index)? + delta;
                    if !value.is_finite() {
                        return Err(ErrorCode::InvalidHeader);
                    }
                }
            }
            AdapterDeltaPayloadKind::LowRankF32 { .. } => {
                for value_index in 0..payload.element_count {
                    let value = self.f32_value_at(value_index)?
                        + read_low_rank_delta_value(bytes, payload, value_index)?;
                    if !value.is_finite() {
                        return Err(ErrorCode::InvalidHeader);
                    }
                }
            }
        }
        Ok(())
    }

    fn apply_adapter_payload(
        &mut self,
        bytes: &[u8],
        payload: AdapterDeltaPayload,
    ) -> Result<(), ErrorCode> {
        match &mut self.storage {
            TensorStorage::F32 { data } => apply_f32_adapter_payload(data, bytes, payload),
            TensorStorage::Q8 { weights, scales } => {
                apply_q8_adapter_payload(&self.entry, weights, scales, bytes, payload)
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => apply_q4_adapter_payload(&self.entry, packed, scales, *block_size, bytes, payload),
        }
    }

    fn f32_value_at(&self, value_index: usize) -> Result<f32, ErrorCode> {
        match &self.storage {
            TensorStorage::F32 { data } => data
                .get(value_index)
                .copied()
                .ok_or(ErrorCode::ShapeMismatch),
            TensorStorage::Q8 { weights, scales } => {
                let (_rows, cols) = tensor_matrix_shape(&self.entry)?;
                let row = value_index / cols;
                let weight = weights.get(value_index).ok_or(ErrorCode::ShapeMismatch)?;
                let scale = scales.get(row).ok_or(ErrorCode::ShapeMismatch)?;
                Ok(f32::from(*weight) * *scale)
            }
            TensorStorage::Q4 {
                packed,
                scales,
                block_size,
            } => q4_value_at(packed, scales, *block_size, &self.entry, value_index),
        }
    }
}

impl Model {
    /// Parses and validates model bytes into a loaded model directory.
    pub fn load(bytes: &[u8]) -> Result<Self, ErrorCode> {
        let parsed = parse_slm(bytes)?;
        let tokenizer_section = tokenizer_section(bytes, &parsed.header)?;
        let tokenizer = Tokenizer::from_section(tokenizer_section)?;
        let tokenizer_checksum = section_checksum(tokenizer_section, TOKENIZER_CHECKSUM_SEED);
        validate_required_tensors(&parsed)?;
        validate_required_shapes(&parsed)?;
        let tensors = load_tensors(bytes, &parsed)?;
        let parameter_count = parameter_count(&parsed.tensors)?;
        let tensor_layout_checksum = tensor_layout_checksum(&parsed.tensors);
        let top_level_indices = resolve_top_level_indices(&parsed)?;
        let layer_indices = resolve_layer_indices(&parsed)?;
        Ok(Self {
            parsed,
            tensors,
            tokenizer,
            parameter_count,
            tensor_layout_checksum,
            tokenizer_checksum,
            top_level_indices,
            layer_indices,
        })
    }

    /// Returns a tensor entry by stable tensor name.
    pub fn tensor(&self, name: &str) -> Option<TensorEntry> {
        let hash = name_hash(name);
        self.parsed
            .tensors
            .iter()
            .copied()
            .find(|entry| entry.name_hash == hash)
    }

    /// Returns the parsed model view.
    pub fn parsed(&self) -> &ParsedSlm {
        &self.parsed
    }

    /// Returns parsed model header values.
    pub fn header(&self) -> &SlmHeader {
        &self.parsed.header
    }

    /// Returns the tokenizer parsed from the model tokenizer section.
    pub fn tokenizer(&self) -> &Tokenizer {
        &self.tokenizer
    }

    /// Returns pre-resolved top-level tensor indices used by generation.
    pub(crate) fn top_level_indices(&self) -> TopLevelTensorIndices {
        self.top_level_indices
    }

    /// Returns pre-resolved tensor indices for a decoder layer.
    pub(crate) fn layer_indices(&self, layer: usize) -> Result<LayerTensorIndices, ErrorCode> {
        self.layer_indices
            .get(layer)
            .copied()
            .ok_or(ErrorCode::MissingTensor)
    }

    /// Returns a loaded f32 tensor by stable tensor name.
    pub fn tensor_f32(&self, name: &str) -> Result<&[f32], ErrorCode> {
        self.loaded_tensor(name)?.f32_data()
    }

    /// Copies a named tensor into caller-owned f32 storage.
    pub fn copy_tensor_f32(&self, name: &str, out: &mut [f32]) -> Result<(), ErrorCode> {
        self.loaded_tensor(name)?.copy_f32(out)
    }

    /// Copies one row from a named tensor into caller-owned f32 storage.
    pub fn copy_tensor_row_f32(
        &self,
        name: &str,
        row: usize,
        cols: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor(name)?.copy_row_f32(row, cols, out)
    }

    /// Copies a pre-resolved tensor into caller-owned f32 storage.
    pub(crate) fn copy_tensor_f32_by_index(
        &self,
        index: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor_by_index(index)?.copy_f32(out)
    }

    /// Copies one row from a pre-resolved tensor into caller-owned f32 storage.
    pub(crate) fn copy_tensor_row_f32_by_index(
        &self,
        index: usize,
        row: usize,
        cols: usize,
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor_by_index(index)?
            .copy_row_f32(row, cols, out)
    }

    /// Computes a matrix-vector product for a named tensor using its native storage.
    pub fn matvec(
        &self,
        name: &str,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        let hash = name_hash(name);
        self.tensors
            .iter()
            .find(|tensor| tensor.entry.name_hash == hash)
            .ok_or(ErrorCode::MissingTensor)?
            .matvec(rows, cols, vector, out)
    }

    /// Computes a matrix-vector product for a pre-resolved tensor index.
    pub(crate) fn matvec_by_index(
        &self,
        index: usize,
        rows: usize,
        cols: usize,
        vector: &[f32],
        out: &mut [f32],
    ) -> Result<(), ErrorCode> {
        self.loaded_tensor_by_index(index)?
            .matvec(rows, cols, vector, out)
    }

    /// Returns a compact runtime quantization label for diagnostics.
    pub fn quantization_mode(&self) -> &'static str {
        let mut has_f32 = false;
        let mut has_q8 = false;
        let mut has_q4 = false;
        for tensor in &self.tensors {
            match tensor.entry.dtype {
                DTYPE_F32 => has_f32 = true,
                DTYPE_Q8_0 => has_q8 = true,
                DTYPE_Q4_0 => has_q4 = true,
                _ => {}
            }
        }
        match (has_f32, has_q8, has_q4) {
            (true, false, false) => "f32",
            (_, true, false) => "q8_0",
            (_, false, true) => "q4_0",
            (_, true, true) => "mixed",
            _ => "none",
        }
    }

    /// Applies an `ADP1` f32 adapter-delta package to loaded f32, q8_0, or q4_0 tensors.
    pub fn apply_adapter_delta(&mut self, bytes: &[u8]) -> Result<(), ErrorCode> {
        let expected = AdapterExpected {
            flags: self.parsed.header.flags,
            tensors: &self.parsed.tensors,
            parameter_count: self.parameter_count,
            tensor_layout_checksum: self.tensor_layout_checksum,
            tokenizer_checksum: self.tokenizer_checksum,
        };
        let adapter = AdapterDelta::parse(bytes, &expected)?;
        for (tensor, payload) in self.tensors.iter().zip(adapter.entries()) {
            tensor.validate_adapter_payload(bytes, payload)?;
        }
        for (tensor, payload) in self.tensors.iter_mut().zip(adapter.entries()) {
            tensor.apply_adapter_payload(bytes, payload)?;
        }
        Ok(())
    }

    fn loaded_tensor(&self, name: &str) -> Result<&LoadedTensor, ErrorCode> {
        let hash = name_hash(name);
        self.tensors
            .iter()
            .find(|tensor| tensor.entry.name_hash == hash)
            .ok_or(ErrorCode::MissingTensor)
    }

    fn loaded_tensor_by_index(&self, index: usize) -> Result<&LoadedTensor, ErrorCode> {
        self.tensors.get(index).ok_or(ErrorCode::MissingTensor)
    }
}

fn tokenizer_section<'a>(bytes: &'a [u8], header: &SlmHeader) -> Result<&'a [u8], ErrorCode> {
    let start = usize::try_from(header.tokenizer_offset).map_err(|_| ErrorCode::InvalidLength)?;
    let len = usize::try_from(header.tokenizer_length).map_err(|_| ErrorCode::InvalidLength)?;
    let end = start.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
    bytes.get(start..end).ok_or(ErrorCode::InvalidHeader)
}

fn validate_required_tensors(parsed: &ParsedSlm) -> Result<(), ErrorCode> {
    let mut required = vec![name_hash("tok_embeddings.weight"), name_hash("norm.weight")];
    if parsed.header.flags & FLAG_TIED_OUTPUT == 0 {
        required.push(name_hash("output.weight"));
    }
    for layer in 0..parsed.header.layer_count {
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
            required.push(name_hash(&format!("layers.{layer}.{suffix}")));
        }
    }
    for hash in required {
        if !parsed.tensors.iter().any(|entry| entry.name_hash == hash) {
            return Err(ErrorCode::MissingTensor);
        }
    }
    Ok(())
}

fn validate_required_shapes(parsed: &ParsedSlm) -> Result<(), ErrorCode> {
    let header = &parsed.header;
    require_shape(
        parsed,
        "tok_embeddings.weight",
        &[header.vocab_size, header.hidden_size],
    )?;
    require_shape(parsed, "norm.weight", &[header.hidden_size])?;
    if header.flags & FLAG_TIED_OUTPUT == 0 {
        require_shape(
            parsed,
            "output.weight",
            &[header.vocab_size, header.hidden_size],
        )?;
    }
    for layer in 0..header.layer_count {
        let prefix = format!("layers.{layer}");
        require_shape(
            parsed,
            &format!("{prefix}.attention_norm.weight"),
            &[header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.ffn_norm.weight"),
            &[header.hidden_size],
        )?;
        for suffix in ["wq.weight", "wk.weight", "wv.weight", "wo.weight"] {
            require_shape(
                parsed,
                &format!("{prefix}.{suffix}"),
                &[header.hidden_size, header.hidden_size],
            )?;
        }
        require_shape(
            parsed,
            &format!("{prefix}.w1.weight"),
            &[header.ffn_size, header.hidden_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.w2.weight"),
            &[header.hidden_size, header.ffn_size],
        )?;
        require_shape(
            parsed,
            &format!("{prefix}.w3.weight"),
            &[header.ffn_size, header.hidden_size],
        )?;
    }
    Ok(())
}

fn resolve_top_level_indices(parsed: &ParsedSlm) -> Result<TopLevelTensorIndices, ErrorCode> {
    let tok_embeddings = find_tensor_index(parsed, "tok_embeddings.weight")?;
    let norm = find_tensor_index(parsed, "norm.weight")?;
    let output_projection = if parsed.header.flags & FLAG_TIED_OUTPUT != 0 {
        tok_embeddings
    } else {
        find_tensor_index(parsed, "output.weight")?
    };
    Ok(TopLevelTensorIndices {
        tok_embeddings,
        norm,
        output_projection,
    })
}

fn resolve_layer_indices(parsed: &ParsedSlm) -> Result<Vec<LayerTensorIndices>, ErrorCode> {
    let mut layers = Vec::with_capacity(parsed.header.layer_count as usize);
    for layer in 0..parsed.header.layer_count {
        let prefix = format!("layers.{layer}");
        layers.push(LayerTensorIndices {
            attention_norm: find_tensor_index(parsed, &format!("{prefix}.attention_norm.weight"))?,
            ffn_norm: find_tensor_index(parsed, &format!("{prefix}.ffn_norm.weight"))?,
            wq: find_tensor_index(parsed, &format!("{prefix}.wq.weight"))?,
            wk: find_tensor_index(parsed, &format!("{prefix}.wk.weight"))?,
            wv: find_tensor_index(parsed, &format!("{prefix}.wv.weight"))?,
            wo: find_tensor_index(parsed, &format!("{prefix}.wo.weight"))?,
            w1: find_tensor_index(parsed, &format!("{prefix}.w1.weight"))?,
            w2: find_tensor_index(parsed, &format!("{prefix}.w2.weight"))?,
            w3: find_tensor_index(parsed, &format!("{prefix}.w3.weight"))?,
        });
    }
    Ok(layers)
}

fn find_tensor_index(parsed: &ParsedSlm, name: &str) -> Result<usize, ErrorCode> {
    let hash = name_hash(name);
    parsed
        .tensors
        .iter()
        .position(|entry| entry.name_hash == hash)
        .ok_or(ErrorCode::MissingTensor)
}

fn require_shape(parsed: &ParsedSlm, name: &str, expected: &[u32]) -> Result<(), ErrorCode> {
    let hash = name_hash(name);
    let entry = parsed
        .tensors
        .iter()
        .find(|tensor| tensor.name_hash == hash)
        .ok_or(ErrorCode::MissingTensor)?;
    if !matches!(entry.dtype, DTYPE_F32 | DTYPE_Q8_0 | DTYPE_Q4_0) {
        return Err(ErrorCode::UnsupportedDType);
    }
    if tensor_dims(entry) != expected {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(())
}

fn load_tensors(bytes: &[u8], parsed: &ParsedSlm) -> Result<Vec<LoadedTensor>, ErrorCode> {
    let mut tensors = Vec::with_capacity(parsed.tensors.len());
    for entry in &parsed.tensors {
        let storage = match entry.dtype {
            DTYPE_F32 => load_f32_tensor(bytes, entry)?,
            DTYPE_Q8_0 => load_q8_tensor(bytes, entry)?,
            DTYPE_Q4_0 => load_q4_tensor(bytes, entry)?,
            _ => return Err(ErrorCode::UnsupportedDType),
        };
        tensors.push(LoadedTensor {
            entry: *entry,
            storage,
        });
    }
    Ok(tensors)
}

fn load_f32_tensor(bytes: &[u8], entry: &TensorEntry) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    let expected_bytes = element_count
        .checked_mul(4)
        .ok_or(ErrorCode::InvalidLength)?;
    if entry.byte_length as usize != expected_bytes {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let raw = tensor_bytes(bytes, entry.byte_offset, expected_bytes)?;
    let mut f32_data = Vec::with_capacity(element_count);
    for chunk in raw.chunks_exact(4) {
        let value = f32::from_le_bytes(chunk.try_into().map_err(|_| ErrorCode::InvalidHeader)?);
        f32_data.push(value);
    }
    Ok(TensorStorage::F32 { data: f32_data })
}

fn load_q8_tensor(bytes: &[u8], entry: &TensorEntry) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    if entry.byte_length as usize != element_count || entry.scale_offset == 0 {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let (rows, _cols) = tensor_matrix_shape(entry)?;
    let raw = tensor_bytes(bytes, entry.byte_offset, element_count)?;
    let scales = scale_values(bytes, entry.scale_offset, rows)?;
    let mut weights = Vec::with_capacity(element_count);
    for value in raw {
        weights.push(*value as i8);
    }
    Ok(TensorStorage::Q8 { weights, scales })
}

fn load_q4_tensor(bytes: &[u8], entry: &TensorEntry) -> Result<TensorStorage, ErrorCode> {
    let element_count = tensor_element_count(entry)?;
    if element_count % 2 != 0 || entry.scale_offset == 0 || entry.block_size == 0 {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let (rows, cols) = tensor_matrix_shape(entry)?;
    let block_size = entry.block_size as usize;
    if block_size == 0 || block_size % 2 != 0 || cols % block_size != 0 {
        return Err(ErrorCode::ShapeMismatch);
    }
    let packed_len = element_count / 2;
    if entry.byte_length as usize != packed_len {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    let blocks_per_row = cols / block_size;
    let raw = tensor_bytes(bytes, entry.byte_offset, packed_len)?;
    let packed = raw.to_vec();
    let scales = scale_values(
        bytes,
        entry.scale_offset,
        rows.checked_mul(blocks_per_row)
            .ok_or(ErrorCode::InvalidLength)?,
    )?;
    Ok(TensorStorage::Q4 {
        packed,
        scales,
        block_size,
    })
}

fn tensor_bytes(bytes: &[u8], offset: u64, len: usize) -> Result<&[u8], ErrorCode> {
    let start = usize::try_from(offset).map_err(|_| ErrorCode::InvalidLength)?;
    let end = start.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
    bytes
        .get(start..end)
        .ok_or(ErrorCode::InvalidTensorDirectory)
}

fn scale_values(bytes: &[u8], offset: u64, count: usize) -> Result<Vec<f32>, ErrorCode> {
    let byte_len = count.checked_mul(4).ok_or(ErrorCode::InvalidLength)?;
    let raw = tensor_bytes(bytes, offset, byte_len)?;
    let mut scales = Vec::with_capacity(count);
    for chunk in raw.chunks_exact(4) {
        scales.push(f32::from_le_bytes(
            chunk.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
        ));
    }
    Ok(scales)
}

fn copy_q4_to_f32(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    for row in 0..rows {
        let start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
        copy_q4_row_to_f32(
            packed,
            scales,
            block_size,
            entry,
            row,
            cols,
            &mut out[start..start + cols],
        )?;
    }
    Ok(())
}

fn copy_q4_row_to_f32(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    row: usize,
    cols: usize,
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    let (rows, expected_cols) = tensor_matrix_shape(entry)?;
    if row >= rows
        || cols != expected_cols
        || out.len() != cols
        || block_size == 0
        || block_size % 2 != 0
        || cols % block_size != 0
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row_byte_start = row
        .checked_mul(bytes_per_row)
        .ok_or(ErrorCode::InvalidLength)?;
    for byte_index in 0..bytes_per_row {
        let col = byte_index * 2;
        let scale = scales[row * blocks_per_row + col / block_size];
        let pair = packed[row_byte_start + byte_index];
        out[col] = f32::from(sign_extend_4(pair & 0x0f)) * scale;
        out[col + 1] = f32::from(sign_extend_4(pair >> 4)) * scale;
    }
    Ok(())
}

fn apply_f32_adapter_payload(
    data: &mut [f32],
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    if data.len() != payload.element_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    match payload.kind {
        AdapterDeltaPayloadKind::RawF32 => {
            for (value_index, value) in data.iter_mut().enumerate() {
                *value += adapter_delta_value(bytes, payload, value_index)?;
            }
        }
        AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
            for pair_index in 0..pair_count {
                let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                let value = data.get_mut(value_index).ok_or(ErrorCode::ShapeMismatch)?;
                *value += delta;
            }
        }
        AdapterDeltaPayloadKind::LowRankF32 { .. } => {
            for (value_index, value) in data.iter_mut().enumerate() {
                *value += read_low_rank_delta_value(bytes, payload, value_index)?;
            }
        }
    }
    Ok(())
}

fn apply_q8_adapter_payload(
    entry: &TensorEntry,
    weights: &mut [i8],
    scales: &mut [f32],
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if payload.element_count != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
        || weights.len() != payload.element_count
        || scales.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut row_values = vec![0.0f32; cols];
    let mut row_weights = vec![0i8; cols];
    match payload.kind {
        AdapterDeltaPayloadKind::RawF32 => {
            for row in 0..rows {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let base_scale = scales[row];
                for col in 0..cols {
                    let index = row_start + col;
                    row_values[col] = f32::from(weights[index]) * base_scale
                        + adapter_delta_value(bytes, payload, index)?;
                }
                scales[row] = quantize_q8_row(&row_values, &mut row_weights)?;
                weights[row_start..row_start + cols].copy_from_slice(&row_weights);
            }
        }
        AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
            let mut pair_index = 0usize;
            for row in 0..rows {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let row_end = row_start
                    .checked_add(cols)
                    .ok_or(ErrorCode::InvalidLength)?;
                let base_scale = scales[row];
                for col in 0..cols {
                    row_values[col] = f32::from(weights[row_start + col]) * base_scale;
                }
                while pair_index < pair_count {
                    let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                    if value_index >= row_end {
                        break;
                    }
                    if value_index < row_start {
                        return Err(ErrorCode::ShapeMismatch);
                    }
                    row_values[value_index - row_start] += delta;
                    pair_index += 1;
                }
                scales[row] = quantize_q8_row(&row_values, &mut row_weights)?;
                weights[row_start..row_start + cols].copy_from_slice(&row_weights);
            }
            if pair_index != pair_count {
                return Err(ErrorCode::ShapeMismatch);
            }
        }
        AdapterDeltaPayloadKind::LowRankF32 { .. } => {
            for row in 0..rows {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let base_scale = scales[row];
                for col in 0..cols {
                    let index = row_start + col;
                    row_values[col] = f32::from(weights[index]) * base_scale
                        + read_low_rank_delta_value(bytes, payload, index)?;
                }
                scales[row] = quantize_q8_row(&row_values, &mut row_weights)?;
                weights[row_start..row_start + cols].copy_from_slice(&row_weights);
            }
        }
    }
    Ok(())
}

fn apply_q4_adapter_payload(
    entry: &TensorEntry,
    packed: &mut [u8],
    scales: &mut [f32],
    block_size: usize,
    bytes: &[u8],
    payload: AdapterDeltaPayload,
) -> Result<(), ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if block_size == 0
        || block_size % 2 != 0
        || cols % block_size != 0
        || payload.element_count != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let mut block_weights = vec![0i8; block_size];
    match payload.kind {
        AdapterDeltaPayloadKind::RawF32 => {
            let mut block_values = vec![0.0f32; block_size];
            for row in 0..rows {
                for block in 0..blocks_per_row {
                    let scale_index = row * blocks_per_row + block;
                    let base_scale = scales[scale_index];
                    for block_col in 0..block_size {
                        let col = block * block_size + block_col;
                        let index = row * cols + col;
                        let byte_index = row * bytes_per_row + col / 2;
                        let byte = packed[byte_index];
                        let nibble = if col % 2 == 0 { byte & 0x0f } else { byte >> 4 };
                        block_values[block_col] = f32::from(sign_extend_4(nibble)) * base_scale
                            + adapter_delta_value(bytes, payload, index)?;
                    }
                    scales[scale_index] = quantize_q4_block(&block_values, &mut block_weights)?;
                    let byte_start = row * bytes_per_row + block * (block_size / 2);
                    for pair in 0..block_size / 2 {
                        packed[byte_start + pair] =
                            pack_q4_pair(block_weights[pair * 2], block_weights[pair * 2 + 1]);
                    }
                }
            }
        }
        AdapterDeltaPayloadKind::SparseF32 { pair_count } => {
            let mut row_values = vec![0.0f32; cols];
            let mut pair_index = 0usize;
            for row in 0..rows {
                let row_start = row.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
                let row_end = row_start
                    .checked_add(cols)
                    .ok_or(ErrorCode::InvalidLength)?;
                for col in 0..cols {
                    let byte_index = row * bytes_per_row + col / 2;
                    let byte = packed[byte_index];
                    let nibble = if col % 2 == 0 { byte & 0x0f } else { byte >> 4 };
                    let scale = scales[row * blocks_per_row + col / block_size];
                    row_values[col] = f32::from(sign_extend_4(nibble)) * scale;
                }
                while pair_index < pair_count {
                    let (value_index, delta) = read_sparse_delta_pair(bytes, payload, pair_index)?;
                    if value_index >= row_end {
                        break;
                    }
                    if value_index < row_start {
                        return Err(ErrorCode::ShapeMismatch);
                    }
                    row_values[value_index - row_start] += delta;
                    pair_index += 1;
                }
                for block in 0..blocks_per_row {
                    let scale_index = row * blocks_per_row + block;
                    let value_start = block * block_size;
                    scales[scale_index] = quantize_q4_block(
                        &row_values[value_start..value_start + block_size],
                        &mut block_weights,
                    )?;
                    let byte_start = row * bytes_per_row + block * (block_size / 2);
                    for pair in 0..block_size / 2 {
                        packed[byte_start + pair] =
                            pack_q4_pair(block_weights[pair * 2], block_weights[pair * 2 + 1]);
                    }
                }
            }
            if pair_index != pair_count {
                return Err(ErrorCode::ShapeMismatch);
            }
        }
        AdapterDeltaPayloadKind::LowRankF32 { .. } => {
            let mut block_values = vec![0.0f32; block_size];
            for row in 0..rows {
                for block in 0..blocks_per_row {
                    let scale_index = row * blocks_per_row + block;
                    let base_scale = scales[scale_index];
                    for block_col in 0..block_size {
                        let col = block * block_size + block_col;
                        let index = row * cols + col;
                        let byte_index = row * bytes_per_row + col / 2;
                        let byte = packed[byte_index];
                        let nibble = if col % 2 == 0 { byte & 0x0f } else { byte >> 4 };
                        block_values[block_col] = f32::from(sign_extend_4(nibble)) * base_scale
                            + read_low_rank_delta_value(bytes, payload, index)?;
                    }
                    scales[scale_index] = quantize_q4_block(&block_values, &mut block_weights)?;
                    let byte_start = row * bytes_per_row + block * (block_size / 2);
                    for pair in 0..block_size / 2 {
                        packed[byte_start + pair] =
                            pack_q4_pair(block_weights[pair * 2], block_weights[pair * 2 + 1]);
                    }
                }
            }
        }
    }
    Ok(())
}

fn q4_value_at(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    entry: &TensorEntry,
    value_index: usize,
) -> Result<f32, ErrorCode> {
    let (rows, cols) = tensor_matrix_shape(entry)?;
    if block_size == 0 || block_size % 2 != 0 || cols % block_size != 0 {
        return Err(ErrorCode::ShapeMismatch);
    }
    let element_count = rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?;
    if value_index >= element_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    let bytes_per_row = cols / 2;
    let blocks_per_row = cols / block_size;
    if packed.len()
        != rows
            .checked_mul(bytes_per_row)
            .ok_or(ErrorCode::InvalidLength)?
        || scales.len()
            != rows
                .checked_mul(blocks_per_row)
                .ok_or(ErrorCode::InvalidLength)?
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    let row = value_index / cols;
    let col = value_index % cols;
    let byte = packed[row * bytes_per_row + col / 2];
    let nibble = if col % 2 == 0 { byte & 0x0f } else { byte >> 4 };
    let scale = scales[row * blocks_per_row + col / block_size];
    Ok(f32::from(sign_extend_4(nibble)) * scale)
}

fn adapter_delta_value(
    bytes: &[u8],
    payload: AdapterDeltaPayload,
    value_index: usize,
) -> Result<f32, ErrorCode> {
    if !matches!(payload.kind, AdapterDeltaPayloadKind::RawF32) {
        return Err(ErrorCode::ShapeMismatch);
    }
    if value_index >= payload.element_count {
        return Err(ErrorCode::ShapeMismatch);
    }
    let delta_offset = payload
        .byte_offset
        .checked_add(value_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
        .ok_or(ErrorCode::InvalidLength)?;
    read_f32(bytes, delta_offset)
}

fn tensor_dims(entry: &TensorEntry) -> Vec<u32> {
    [entry.dim0, entry.dim1, entry.dim2, entry.dim3]
        .into_iter()
        .take(entry.rank as usize)
        .collect()
}

fn tensor_element_count(entry: &TensorEntry) -> Result<usize, ErrorCode> {
    let mut total = 1usize;
    for dim in tensor_dims(entry) {
        if dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        total = total
            .checked_mul(dim as usize)
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok(total)
}

fn tensor_matrix_shape(entry: &TensorEntry) -> Result<(usize, usize), ErrorCode> {
    let dims = tensor_dims(entry);
    if dims.is_empty() {
        return Err(ErrorCode::ShapeMismatch);
    }
    let rows = if dims.len() == 1 { 1 } else { dims[0] as usize };
    let mut cols = 1usize;
    let col_dims = if dims.len() == 1 {
        &dims[..]
    } else {
        &dims[1..]
    };
    for dim in col_dims {
        cols = cols
            .checked_mul(*dim as usize)
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok((rows, cols))
}

fn sign_extend_4(value: u8) -> i8 {
    let nibble = (value & 0x0f) as i8;
    if nibble >= 8 {
        nibble - 16
    } else {
        nibble
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model_format::{simple_checksum, HEADER_LEN, SLM_VERSION, TENSOR_ENTRY_LEN};
    use crate::ops::matvec_f32;

    const ADAPTER_HEADER_LEN: usize = 64;
    const ADAPTER_ENTRY_LEN: usize = 64;
    const ADAPTER_CHECKSUM_OFFSET: usize = 56;
    const LOW_RANK_PAYLOAD_HEADER_LEN: usize = 16;

    fn valid_header_without_tensors() -> Vec<u8> {
        let tokenizer = {
            let mut bytes = Vec::new();
            bytes.extend_from_slice(b"BTOK");
            bytes.extend_from_slice(&1u32.to_le_bytes());
            bytes.extend_from_slice(&260u32.to_le_bytes());
            bytes.extend_from_slice(&256u32.to_le_bytes());
            bytes.extend_from_slice(&257u32.to_le_bytes());
            bytes.extend_from_slice(&258u32.to_le_bytes());
            bytes.extend_from_slice(&259u32.to_le_bytes());
            bytes
        };
        let directory_offset = ((HEADER_LEN + tokenizer.len() + 63) & !63) as u64;
        let tensor_data_offset = ((directory_offset as usize + TENSOR_ENTRY_LEN + 63) & !63) as u64;
        let mut bytes = vec![0u8; tensor_data_offset as usize];
        bytes[0..4].copy_from_slice(b"SLM1");
        bytes[4..8].copy_from_slice(&SLM_VERSION.to_le_bytes());
        bytes[8..12].copy_from_slice(&(HEADER_LEN as u32).to_le_bytes());
        bytes[12..16].copy_from_slice(&1u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&0u32.to_le_bytes());
        bytes[20..24].copy_from_slice(&260u32.to_le_bytes());
        bytes[24..28].copy_from_slice(&4u32.to_le_bytes());
        bytes[28..32].copy_from_slice(&8u32.to_le_bytes());
        bytes[32..36].copy_from_slice(&1u32.to_le_bytes());
        bytes[36..40].copy_from_slice(&2u32.to_le_bytes());
        bytes[40..44].copy_from_slice(&2u32.to_le_bytes());
        bytes[44..48].copy_from_slice(&4u32.to_le_bytes());
        bytes[48..52].copy_from_slice(&16u32.to_le_bytes());
        bytes[52..56].copy_from_slice(&16u32.to_le_bytes());
        bytes[56..60].copy_from_slice(&10000.0f32.to_le_bytes());
        bytes[60..64].copy_from_slice(&0.00001f32.to_le_bytes());
        bytes[64..72].copy_from_slice(&(HEADER_LEN as u64).to_le_bytes());
        bytes[72..80].copy_from_slice(&(tokenizer.len() as u64).to_le_bytes());
        bytes[80..88].copy_from_slice(&directory_offset.to_le_bytes());
        bytes[88..92].copy_from_slice(&0u32.to_le_bytes());
        bytes[92..100].copy_from_slice(&tensor_data_offset.to_le_bytes());
        bytes[100..108].copy_from_slice(&0u64.to_le_bytes());
        bytes[HEADER_LEN..HEADER_LEN + tokenizer.len()].copy_from_slice(&tokenizer);
        let checksum = simple_checksum(&bytes);
        bytes[100..108].copy_from_slice(&checksum.to_le_bytes());
        bytes
    }

    fn build_adapter_bytes<F>(model: &Model, mut delta: F) -> Vec<u8>
    where
        F: FnMut(usize, usize, &TensorEntry) -> f32,
    {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for (tensor_index, tensor) in tensors.iter().enumerate() {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let element_count = tensor_element_count(tensor).unwrap();
            let byte_length = element_count * 4;
            lengths.push(byte_length);
            let mut payload = vec![0u8; byte_length];
            for value_index in 0..element_count {
                let value = delta(tensor_index, value_index, tensor);
                payload[value_index * 4..value_index * 4 + 4].copy_from_slice(&value.to_le_bytes());
            }
            cursor += byte_length;
            payloads.push(payload);
        }

        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ADP1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, model.parameter_count);
        write_u64(&mut bytes, 32, model.tensor_layout_checksum);
        write_u64(&mut bytes, 40, model.tokenizer_checksum);
        write_u64(&mut bytes, 48, data_offset as u64);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, 0);

        for (index, tensor) in tensors.iter().enumerate() {
            let entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
            write_u64(&mut bytes, entry, tensor.name_hash);
            write_u32(&mut bytes, entry + 8, tensor.rank);
            write_u32(&mut bytes, entry + 12, tensor.dim0);
            write_u32(&mut bytes, entry + 16, tensor.dim1);
            write_u32(&mut bytes, entry + 20, tensor.dim2);
            write_u32(&mut bytes, entry + 24, tensor.dim3);
            write_u32(&mut bytes, entry + 28, 0);
            write_u64(&mut bytes, entry + 32, offsets[index] as u64);
            write_u64(&mut bytes, entry + 40, lengths[index] as u64);
            write_u64(
                &mut bytes,
                entry + 48,
                tensor_element_count(tensor).unwrap() as u64,
            );
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            let start = offsets[index];
            bytes[start..start + lengths[index]].copy_from_slice(&payloads[index]);
        }
        refresh_adapter_checksum(&mut bytes);
        bytes
    }

    fn build_sparse_adapter_bytes<F>(model: &Model, mut delta: F) -> Vec<u8>
    where
        F: FnMut(usize, usize, &TensorEntry) -> Option<f32>,
    {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for (tensor_index, tensor) in tensors.iter().enumerate() {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let element_count = tensor_element_count(tensor).unwrap();
            let mut payload = Vec::new();
            for value_index in 0..element_count {
                if let Some(value) = delta(tensor_index, value_index, tensor) {
                    payload.extend_from_slice(&(value_index as u64).to_le_bytes());
                    payload.extend_from_slice(&value.to_le_bytes());
                }
            }
            lengths.push(payload.len());
            cursor += payload.len();
            payloads.push(payload);
        }

        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ASP1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, model.parameter_count);
        write_u64(&mut bytes, 32, model.tensor_layout_checksum);
        write_u64(&mut bytes, 40, model.tokenizer_checksum);
        write_u64(&mut bytes, 48, data_offset as u64);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, 0);

        for (index, tensor) in tensors.iter().enumerate() {
            let entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
            write_u64(&mut bytes, entry, tensor.name_hash);
            write_u32(&mut bytes, entry + 8, tensor.rank);
            write_u32(&mut bytes, entry + 12, tensor.dim0);
            write_u32(&mut bytes, entry + 16, tensor.dim1);
            write_u32(&mut bytes, entry + 20, tensor.dim2);
            write_u32(&mut bytes, entry + 24, tensor.dim3);
            write_u32(&mut bytes, entry + 28, 0);
            write_u64(&mut bytes, entry + 32, offsets[index] as u64);
            write_u64(&mut bytes, entry + 40, lengths[index] as u64);
            write_u64(
                &mut bytes,
                entry + 48,
                tensor_element_count(tensor).unwrap() as u64,
            );
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            let start = offsets[index];
            bytes[start..start + lengths[index]].copy_from_slice(&payloads[index]);
        }
        refresh_adapter_checksum(&mut bytes);
        bytes
    }

    fn build_low_rank_adapter_bytes<F>(model: &Model, mut factors: F) -> Vec<u8>
    where
        F: FnMut(usize, &TensorEntry) -> Option<(usize, usize, Vec<f32>, Vec<f32>)>,
    {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for (tensor_index, tensor) in tensors.iter().enumerate() {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let payload = if let Some((rows, cols, a_values, b_values)) =
                factors(tensor_index, tensor)
            {
                let factor_rank = a_values.len() / rows;
                assert!(factor_rank > 0);
                assert_eq!(a_values.len(), factor_rank * rows);
                assert_eq!(b_values.len(), factor_rank * cols);
                assert_eq!(tensor_element_count(tensor).unwrap(), rows * cols);
                let mut payload =
                    vec![0u8; LOW_RANK_PAYLOAD_HEADER_LEN + (a_values.len() + b_values.len()) * 4];
                write_u32(&mut payload, 0, rows as u32);
                write_u32(&mut payload, 4, cols as u32);
                write_u32(&mut payload, 8, factor_rank as u32);
                write_u32(&mut payload, 12, 0);
                let mut offset = LOW_RANK_PAYLOAD_HEADER_LEN;
                for value in a_values.iter().chain(b_values.iter()) {
                    payload[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
                    offset += 4;
                }
                payload
            } else {
                Vec::new()
            };
            lengths.push(payload.len());
            cursor += payload.len();
            payloads.push(payload);
        }

        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ALR1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, model.parameter_count);
        write_u64(&mut bytes, 32, model.tensor_layout_checksum);
        write_u64(&mut bytes, 40, model.tokenizer_checksum);
        write_u64(&mut bytes, 48, data_offset as u64);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, 0);

        for (index, tensor) in tensors.iter().enumerate() {
            let entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
            write_u64(&mut bytes, entry, tensor.name_hash);
            write_u32(&mut bytes, entry + 8, tensor.rank);
            write_u32(&mut bytes, entry + 12, tensor.dim0);
            write_u32(&mut bytes, entry + 16, tensor.dim1);
            write_u32(&mut bytes, entry + 20, tensor.dim2);
            write_u32(&mut bytes, entry + 24, tensor.dim3);
            write_u32(&mut bytes, entry + 28, 0);
            write_u64(&mut bytes, entry + 32, offsets[index] as u64);
            write_u64(&mut bytes, entry + 40, lengths[index] as u64);
            write_u64(
                &mut bytes,
                entry + 48,
                tensor_element_count(tensor).unwrap() as u64,
            );
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            let start = offsets[index];
            bytes[start..start + lengths[index]].copy_from_slice(&payloads[index]);
        }
        refresh_adapter_checksum(&mut bytes);
        bytes
    }

    fn refresh_adapter_checksum(bytes: &mut [u8]) {
        write_u64(bytes, ADAPTER_CHECKSUM_OFFSET, 0);
        let checksum = adapter_checksum(bytes);
        write_u64(bytes, ADAPTER_CHECKSUM_OFFSET, checksum);
    }

    fn align_to_64(value: usize) -> usize {
        (value + 63) & !63
    }

    fn adapter_checksum(bytes: &[u8]) -> u64 {
        let mut acc = 0x6164617074657231u64;
        for (index, byte) in bytes.iter().enumerate() {
            let value = if (ADAPTER_CHECKSUM_OFFSET..ADAPTER_CHECKSUM_OFFSET + 8).contains(&index) {
                0
            } else {
                *byte
            };
            acc ^= u64::from(value).wrapping_add((index as u64) << 3);
            acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
        }
        acc
    }

    fn adapter_payload_checksum(bytes: &[u8]) -> u64 {
        let mut acc = 0x64656c7461663332u64;
        for (index, byte) in bytes.iter().enumerate() {
            acc ^= u64::from(*byte).wrapping_add((index as u64) << 1);
            acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
        }
        acc
    }

    fn write_u32(bytes: &mut [u8], offset: usize, value: u32) {
        bytes[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn write_u64(bytes: &mut [u8], offset: usize, value: u64) {
        bytes[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    }

    #[test]
    fn missing_tensor_rejection() {
        let error = Model::load(&valid_header_without_tensors()).unwrap_err();
        assert_eq!(error, ErrorCode::MissingTensor);
    }

    #[test]
    fn q8_named_matvec_matches_copied_reference() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let vector = [1.0f32; 8];
        let mut direct = [0.0f32; 260];
        let mut decoded = [0.0f32; 260];
        model
            .matvec("output.weight", 260, 8, &vector, &mut direct)
            .unwrap();
        let mut copied = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut copied).unwrap();
        matvec_f32(&copied, 260, 8, &vector, &mut decoded).unwrap();
        for index in 0..direct.len() {
            assert!((direct[index] - decoded[index]).abs() < 0.0001);
        }
    }

    #[test]
    fn q4_named_matvec_matches_copied_reference() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q4.slm")).unwrap();
        let vector = [1.0f32; 8];
        let mut direct = [0.0f32; 260];
        let mut decoded = [0.0f32; 260];
        model
            .matvec("output.weight", 260, 8, &vector, &mut direct)
            .unwrap();
        let mut copied = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut copied).unwrap();
        matvec_f32(&copied, 260, 8, &vector, &mut decoded).unwrap();
        for index in 0..direct.len() {
            assert!((direct[index] - decoded[index]).abs() < 0.0001);
        }
    }

    #[test]
    fn applies_f32_adapter_delta_to_loaded_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                0.25
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after[0], before[0] + 0.25);
        assert_eq!(after[1], before[1]);
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_f32_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                Some(0.25)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after[0], before[0] + 0.25);
        assert_eq!(after[1], before[1]);
    }

    #[test]
    fn applies_low_rank_adapter_delta_to_loaded_f32_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_low_rank_adapter_bytes(&model, |_tensor_index, tensor| {
            if tensor.name_hash != name_hash("output.weight") {
                return None;
            }
            let (rows, cols) = tensor_matrix_shape(tensor).unwrap();
            let mut a = vec![0.0f32; rows];
            let b = vec![1.0f32; cols];
            a[0] = 0.25;
            Some((rows, cols, a, b))
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after[0], before[0] + 0.25);
        assert_eq!(after[7], before[7] + 0.25);
        assert_eq!(after[8], before[8]);
    }

    #[test]
    fn adapter_identity_drift_rejects_without_mutating_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let mut adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index == 0 {
                0.25
            } else {
                0.0
            }
        });
        write_u32(&mut adapter, 16, model.header().flags ^ 1);
        refresh_adapter_checksum(&mut adapter);

        assert_eq!(
            model.apply_adapter_delta(&adapter).unwrap_err(),
            ErrorCode::ShapeMismatch
        );

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after, before);
    }

    #[test]
    fn applies_q8_adapter_delta_to_loaded_compact_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 4.0);
        assert_eq!(model.quantization_mode(), "q8_0");
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_q8_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                Some(1.0)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 4.0);
        assert_eq!(model.quantization_mode(), "q8_0");
    }

    #[test]
    fn applies_low_rank_adapter_delta_to_loaded_q8_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_low_rank_adapter_bytes(&model, |_tensor_index, tensor| {
            if tensor.name_hash != name_hash("output.weight") {
                return None;
            }
            let (rows, cols) = tensor_matrix_shape(tensor).unwrap();
            let mut a = vec![0.0f32; rows];
            let b = vec![1.0f32; cols];
            a[0] = 1.0;
            Some((rows, cols, a, b))
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 4.0);
        assert_eq!(model.quantization_mode(), "q8_0");
    }

    #[test]
    fn applies_q4_adapter_delta_to_loaded_compact_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q4.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 3.0);
        assert_eq!(model.quantization_mode(), "q4_0");
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn applies_sparse_adapter_delta_to_loaded_q4_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q4.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let adapter = build_sparse_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                Some(1.0)
            } else {
                None
            }
        });

        model.apply_adapter_delta(&adapter).unwrap();

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        let before_sum = before[..8].iter().sum::<f32>();
        let after_sum = after[..8].iter().sum::<f32>();
        assert!(after_sum > before_sum + 3.0);
        assert_eq!(model.quantization_mode(), "q4_0");
    }

    #[test]
    fn q8_adapter_identity_drift_rejects_without_mutating_tensor() {
        let mut model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        let mut before = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut before).unwrap();
        let mut adapter = build_adapter_bytes(&model, |_tensor_index, value_index, tensor| {
            if tensor.name_hash == name_hash("output.weight") && value_index < 8 {
                1.0
            } else {
                0.0
            }
        });
        write_u32(&mut adapter, 16, model.header().flags ^ 1);
        refresh_adapter_checksum(&mut adapter);

        assert_eq!(
            model.apply_adapter_delta(&adapter).unwrap_err(),
            ErrorCode::ShapeMismatch
        );

        let mut after = vec![0.0f32; 260 * 8];
        model.copy_tensor_f32("output.weight", &mut after).unwrap();
        assert_eq!(after, before);
        assert_eq!(model.quantization_mode(), "q8_0");
    }

    #[test]
    fn quantized_tensor_f32_borrow_is_rejected() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-q8.slm")).unwrap();
        assert_eq!(
            model.tensor_f32("output.weight").unwrap_err(),
            ErrorCode::UnsupportedDType
        );
    }

    #[test]
    fn tied_output_projection_uses_embedding_tensor_index() {
        let mut parsed = parse_slm(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        parsed.header.flags |= FLAG_TIED_OUTPUT;

        let top_level = resolve_top_level_indices(&parsed).unwrap();

        assert_eq!(top_level.output_projection, top_level.tok_embeddings);
        assert_ne!(top_level.norm, top_level.output_projection);
    }

    #[test]
    fn tied_output_fixture_loads_without_output_tensor() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model-tied.slm")).unwrap();
        let top_level = model.top_level_indices();

        assert!(model.tensor("output.weight").is_none());
        assert_eq!(top_level.output_projection, top_level.tok_embeddings);
        assert_eq!(
            model.parsed().tensors[top_level.tok_embeddings].name_hash,
            name_hash("tok_embeddings.weight")
        );
    }

    #[test]
    fn loaded_model_exposes_pre_resolved_tensor_indices() {
        let model = Model::load(include_bytes!("../../models/tiny-test-model.slm")).unwrap();
        let top_level = model.top_level_indices();
        let layer = model.layer_indices(0).unwrap();

        assert_ne!(top_level.tok_embeddings, top_level.output_projection);
        assert_eq!(
            model.parsed().tensors[top_level.tok_embeddings].name_hash,
            name_hash("tok_embeddings.weight")
        );
        assert_eq!(
            model.parsed().tensors[layer.wq].name_hash,
            name_hash("layers.0.wq.weight")
        );
        assert_eq!(
            model.layer_indices(1).unwrap_err(),
            ErrorCode::MissingTensor
        );
    }
}
