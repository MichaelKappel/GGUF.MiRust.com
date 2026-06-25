//! Parser for the custom `.slm` binary format.

use crate::errors::ErrorCode;
use std::convert::TryInto;

/// Supported `.slm` file magic.
pub const SLM_MAGIC: [u8; 4] = *b"SLM1";
/// Supported `.slm` version.
pub const SLM_VERSION: u32 = 1;
/// Minimum header length for version 1.
pub const HEADER_LEN: usize = 108;
/// Tensor directory entry length including reserved padding.
pub const TENSOR_ENTRY_LEN: usize = 64;

/// Float32 tensor dtype.
pub const DTYPE_F32: u32 = 1;
/// Q8_0 tensor dtype.
pub const DTYPE_Q8_0: u32 = 2;
/// Q4_0 tensor dtype.
pub const DTYPE_Q4_0: u32 = 3;

/// Parsed `.slm` header.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SlmHeader {
    /// Explicit format version.
    pub version: u32,
    /// Header length in bytes.
    pub header_length: u32,
    /// Model type identifier.
    pub model_type: u32,
    /// Format flags.
    pub flags: u32,
    /// Token vocabulary size.
    pub vocab_size: u32,
    /// Special token count.
    pub special_token_count: u32,
    /// Transformer hidden size.
    pub hidden_size: u32,
    /// Transformer layer count.
    pub layer_count: u32,
    /// Attention head count.
    pub head_count: u32,
    /// Key/value head count.
    pub kv_head_count: u32,
    /// Per-head dimension.
    pub head_dim: u32,
    /// Feed-forward intermediate size.
    pub ffn_size: u32,
    /// Maximum context length.
    pub max_context: u32,
    /// RoPE theta value.
    pub rope_theta: f32,
    /// RMSNorm epsilon.
    pub rms_norm_epsilon: f32,
    /// Tokenizer section offset.
    pub tokenizer_offset: u64,
    /// Tokenizer section length.
    pub tokenizer_length: u64,
    /// Tensor directory offset.
    pub tensor_directory_offset: u64,
    /// Tensor count.
    pub tensor_count: u32,
    /// Tensor data section offset.
    pub tensor_data_offset: u64,
    /// Simple custom checksum.
    pub checksum: u64,
}

/// Parsed tensor directory entry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TensorEntry {
    /// Stable hash of the tensor name.
    pub name_hash: u64,
    /// Tensor dtype.
    pub dtype: u32,
    /// Tensor rank.
    pub rank: u32,
    /// Dimension 0.
    pub dim0: u32,
    /// Dimension 1.
    pub dim1: u32,
    /// Dimension 2.
    pub dim2: u32,
    /// Dimension 3.
    pub dim3: u32,
    /// Byte offset relative to the file start.
    pub byte_offset: u64,
    /// Tensor byte length.
    pub byte_length: u64,
    /// Quantization scale offset when quantized.
    pub scale_offset: u64,
    /// Quantization block size when quantized.
    pub block_size: u32,
}

/// Parsed `.slm` view.
#[derive(Debug)]
pub struct ParsedSlm {
    /// Parsed header.
    pub header: SlmHeader,
    /// Parsed tensor directory entries.
    pub tensors: Vec<TensorEntry>,
}

/// Parses and validates an `.slm` byte slice.
pub fn parse_slm(bytes: &[u8]) -> Result<ParsedSlm, ErrorCode> {
    if bytes.len() < HEADER_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    if bytes[0..4] != SLM_MAGIC {
        return Err(ErrorCode::InvalidModelMagic);
    }

    let header = SlmHeader {
        version: read_u32(bytes, 4)?,
        header_length: read_u32(bytes, 8)?,
        model_type: read_u32(bytes, 12)?,
        flags: read_u32(bytes, 16)?,
        vocab_size: read_u32(bytes, 20)?,
        special_token_count: read_u32(bytes, 24)?,
        hidden_size: read_u32(bytes, 28)?,
        layer_count: read_u32(bytes, 32)?,
        head_count: read_u32(bytes, 36)?,
        kv_head_count: read_u32(bytes, 40)?,
        head_dim: read_u32(bytes, 44)?,
        ffn_size: read_u32(bytes, 48)?,
        max_context: read_u32(bytes, 52)?,
        rope_theta: f32::from_bits(read_u32(bytes, 56)?),
        rms_norm_epsilon: f32::from_bits(read_u32(bytes, 60)?),
        tokenizer_offset: read_u64(bytes, 64)?,
        tokenizer_length: read_u64(bytes, 72)?,
        tensor_directory_offset: read_u64(bytes, 80)?,
        tensor_count: read_u32(bytes, 88)?,
        tensor_data_offset: read_u64(bytes, 92)?,
        checksum: read_u64(bytes, 100)?,
    };

    validate_header(&header, bytes.len())?;
    validate_checksum(bytes, &header)?;
    let tensors = parse_tensor_directory(bytes, &header)?;
    validate_tensor_ranges(bytes.len(), &tensors)?;
    Ok(ParsedSlm { header, tensors })
}

/// Computes the stable FNV-1a hash used for tensor names.
pub fn name_hash(name: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in name.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Computes a simple checksum over model bytes.
pub fn simple_checksum(bytes: &[u8]) -> u64 {
    let mut acc = 0x9e3779b97f4a7c15u64;
    for (index, byte) in bytes.iter().enumerate() {
        let value = if (100..108).contains(&index) {
            0
        } else {
            *byte
        };
        acc ^= u64::from(value).wrapping_add((index as u64) << 1);
        acc = acc.rotate_left(7).wrapping_mul(0x100000001b3);
    }
    acc
}

fn validate_header(header: &SlmHeader, file_len: usize) -> Result<(), ErrorCode> {
    if header.version != SLM_VERSION {
        return Err(ErrorCode::UnsupportedModelVersion);
    }
    if header.checksum == 0 {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.header_length < HEADER_LEN as u32 || header.header_length as usize > file_len {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.hidden_size == 0
        || header.layer_count == 0
        || header.head_count == 0
        || header.kv_head_count == 0
        || header.head_dim == 0
        || header.ffn_size == 0
        || header.max_context == 0
    {
        return Err(ErrorCode::InvalidHeader);
    }
    if header.head_count.saturating_mul(header.head_dim) != header.hidden_size {
        return Err(ErrorCode::ShapeMismatch);
    }
    if header.tensor_data_offset % 64 != 0 {
        return Err(ErrorCode::InvalidHeader);
    }
    if !range_within(file_len, header.tokenizer_offset, header.tokenizer_length) {
        return Err(ErrorCode::InvalidHeader);
    }
    let directory_len = u64::from(header.tensor_count) * TENSOR_ENTRY_LEN as u64;
    if !range_within(file_len, header.tensor_directory_offset, directory_len) {
        return Err(ErrorCode::InvalidTensorDirectory);
    }
    Ok(())
}

fn validate_checksum(bytes: &[u8], header: &SlmHeader) -> Result<(), ErrorCode> {
    if header.checksum != simple_checksum(bytes) {
        return Err(ErrorCode::InvalidHeader);
    }
    Ok(())
}

fn parse_tensor_directory(bytes: &[u8], header: &SlmHeader) -> Result<Vec<TensorEntry>, ErrorCode> {
    let mut tensors = Vec::with_capacity(header.tensor_count as usize);
    let start = usize_from_u64(header.tensor_directory_offset)?;
    for index in 0..header.tensor_count as usize {
        let base = start + index * TENSOR_ENTRY_LEN;
        let entry = TensorEntry {
            name_hash: read_u64(bytes, base)?,
            dtype: read_u32(bytes, base + 8)?,
            rank: read_u32(bytes, base + 12)?,
            dim0: read_u32(bytes, base + 16)?,
            dim1: read_u32(bytes, base + 20)?,
            dim2: read_u32(bytes, base + 24)?,
            dim3: read_u32(bytes, base + 28)?,
            byte_offset: read_u64(bytes, base + 32)?,
            byte_length: read_u64(bytes, base + 40)?,
            scale_offset: read_u64(bytes, base + 48)?,
            block_size: read_u32(bytes, base + 56)?,
        };
        if entry.rank == 0 || entry.rank > 4 {
            return Err(ErrorCode::InvalidTensorDirectory);
        }
        if !matches!(entry.dtype, DTYPE_F32 | DTYPE_Q8_0 | DTYPE_Q4_0) {
            return Err(ErrorCode::UnsupportedDType);
        }
        tensors.push(entry);
    }
    Ok(tensors)
}

fn validate_tensor_ranges(file_len: usize, tensors: &[TensorEntry]) -> Result<(), ErrorCode> {
    for tensor in tensors {
        if !range_within(file_len, tensor.byte_offset, tensor.byte_length) {
            return Err(ErrorCode::InvalidTensorDirectory);
        }
        if tensor.dtype != DTYPE_F32
            && tensor.scale_offset != 0
            && tensor.scale_offset >= file_len as u64
        {
            return Err(ErrorCode::InvalidTensorDirectory);
        }
    }
    Ok(())
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidHeader)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u32::from_le_bytes(
        slice.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
    ))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidHeader)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u64::from_le_bytes(
        slice.try_into().map_err(|_| ErrorCode::InvalidHeader)?,
    ))
}

fn range_within(file_len: usize, offset: u64, len: u64) -> bool {
    let Some(end) = offset.checked_add(len) else {
        return false;
    };
    end <= file_len as u64
}

fn usize_from_u64(value: u64) -> Result<usize, ErrorCode> {
    usize::try_from(value).map_err(|_| ErrorCode::InvalidLength)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_header_bytes(tensor_count: u32) -> Vec<u8> {
        let directory_offset = 128u64;
        let directory_len = tensor_count as usize * TENSOR_ENTRY_LEN;
        let tensor_data_offset = ((directory_offset as usize + directory_len + 63) & !63) as u64;
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
        bytes[72..80].copy_from_slice(&0u64.to_le_bytes());
        bytes[80..88].copy_from_slice(&directory_offset.to_le_bytes());
        bytes[88..92].copy_from_slice(&tensor_count.to_le_bytes());
        bytes[92..100].copy_from_slice(&tensor_data_offset.to_le_bytes());
        bytes[100..108].copy_from_slice(&0u64.to_le_bytes());
        let checksum = simple_checksum(&bytes);
        bytes[100..108].copy_from_slice(&checksum.to_le_bytes());
        bytes
    }

    #[test]
    fn slm_header_parse() {
        let parsed = parse_slm(&valid_header_bytes(0)).unwrap();
        assert_eq!(parsed.header.hidden_size, 8);
        assert_eq!(parsed.header.layer_count, 1);
        assert_eq!(parsed.header.tensor_count, 0);
    }

    #[test]
    fn invalid_magic_rejection() {
        let mut bytes = vec![0; HEADER_LEN];
        bytes[0..4].copy_from_slice(b"NOPE");
        assert_eq!(parse_slm(&bytes).unwrap_err(), ErrorCode::InvalidModelMagic);
    }

    #[test]
    fn checksum_rejection() {
        let mut bytes = valid_header_bytes(0);
        bytes[20] ^= 1;
        assert_eq!(parse_slm(&bytes).unwrap_err(), ErrorCode::InvalidHeader);
    }
}
