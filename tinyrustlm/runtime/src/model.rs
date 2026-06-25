//! Loaded model metadata and tensor storage.

use crate::errors::ErrorCode;
use crate::model_format::{
    name_hash, parse_slm, ParsedSlm, SlmHeader, TensorEntry, DTYPE_F32, DTYPE_Q4_0, DTYPE_Q8_0,
};
use crate::ops::matvec_f32;
use crate::quant::{matvec_q4_0, matvec_q8_0};
use crate::tokenizer::Tokenizer;
use std::convert::TryInto;

const FLAG_TIED_OUTPUT: u32 = 1;

/// Loaded model directory and header.
#[derive(Debug)]
pub struct Model {
    parsed: ParsedSlm,
    tensors: Vec<LoadedTensor>,
    tokenizer: Tokenizer,
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
}

impl Model {
    /// Parses and validates model bytes into a loaded model directory.
    pub fn load(bytes: &[u8]) -> Result<Self, ErrorCode> {
        let parsed = parse_slm(bytes)?;
        let tokenizer = parse_tokenizer(bytes, &parsed.header)?;
        validate_required_tensors(&parsed)?;
        validate_required_shapes(&parsed)?;
        let tensors = load_tensors(bytes, &parsed)?;
        let top_level_indices = resolve_top_level_indices(&parsed)?;
        let layer_indices = resolve_layer_indices(&parsed)?;
        Ok(Self {
            parsed,
            tensors,
            tokenizer,
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

fn parse_tokenizer(bytes: &[u8], header: &SlmHeader) -> Result<Tokenizer, ErrorCode> {
    let start = usize::try_from(header.tokenizer_offset).map_err(|_| ErrorCode::InvalidLength)?;
    let len = usize::try_from(header.tokenizer_length).map_err(|_| ErrorCode::InvalidLength)?;
    let end = start.checked_add(len).ok_or(ErrorCode::InvalidLength)?;
    let section = bytes.get(start..end).ok_or(ErrorCode::InvalidHeader)?;
    Tokenizer::from_section(section)
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
