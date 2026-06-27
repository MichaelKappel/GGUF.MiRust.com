//! Runtime parser for `ADP1` adapter-delta packages.

use crate::errors::ErrorCode;
use crate::model_format::TensorEntry;

const MAGIC: &[u8; 4] = b"ADP1";
const VERSION: u32 = 1;
const HEADER_LEN: usize = 64;
const ENTRY_LEN: usize = 64;
const CHECKSUM_OFFSET: usize = 56;

/// Identity values the adapter package must match before it can be applied.
pub(crate) struct AdapterExpected<'a> {
    pub(crate) flags: u32,
    pub(crate) tensors: &'a [TensorEntry],
    pub(crate) parameter_count: u64,
    pub(crate) tensor_layout_checksum: u64,
    pub(crate) tokenizer_checksum: u64,
}

/// Validated adapter payload ranges, aligned to the model tensor directory order.
pub(crate) struct AdapterDelta {
    entries: Vec<AdapterDeltaEntry>,
}

struct AdapterDeltaEntry {
    byte_offset: usize,
    element_count: usize,
}

impl AdapterDelta {
    /// Parses and validates an `ADP1` package for a loaded model identity.
    pub(crate) fn parse(bytes: &[u8], expected: &AdapterExpected<'_>) -> Result<Self, ErrorCode> {
        validate_adapter_bytes(bytes)?;
        let tensor_count = read_u32(bytes, 12)? as usize;
        if tensor_count != expected.tensors.len() {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u32(bytes, 16)? != expected.flags {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u64(bytes, 24)? != expected.parameter_count {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u64(bytes, 32)? != expected.tensor_layout_checksum {
            return Err(ErrorCode::ShapeMismatch);
        }
        if read_u64(bytes, 40)? != expected.tokenizer_checksum {
            return Err(ErrorCode::ShapeMismatch);
        }

        let data_offset = usize_from_u64(read_u64(bytes, 48)?)?;
        let mut entries = Vec::with_capacity(tensor_count);
        for (index, tensor) in expected.tensors.iter().enumerate() {
            let entry_offset = HEADER_LEN + index * ENTRY_LEN;
            validate_entry_identity(bytes, entry_offset, tensor, data_offset)?;
            let byte_offset = usize_from_u64(read_u64(bytes, entry_offset + 32)?)?;
            let element_count = usize_from_u64(read_u64(bytes, entry_offset + 48)?)?;
            validate_finite_payload(bytes, byte_offset, element_count)?;
            entries.push(AdapterDeltaEntry {
                byte_offset,
                element_count,
            });
        }
        Ok(Self { entries })
    }

    pub(crate) fn entries(&self) -> impl Iterator<Item = AdapterDeltaPayload> + '_ {
        self.entries.iter().map(|entry| AdapterDeltaPayload {
            byte_offset: entry.byte_offset,
            element_count: entry.element_count,
        })
    }
}

/// One validated f32-delta payload.
#[derive(Clone, Copy)]
pub(crate) struct AdapterDeltaPayload {
    pub(crate) byte_offset: usize,
    pub(crate) element_count: usize,
}

/// Computes the checksum used by packer reports for tokenizer sections.
pub(crate) fn section_checksum(bytes: &[u8], seed: u64) -> u64 {
    let mut acc = seed;
    for (index, byte) in bytes.iter().enumerate() {
        acc ^= u64::from(*byte).wrapping_add((index as u64) << 2);
        acc = acc.rotate_left(9).wrapping_mul(0x100000001b3);
    }
    acc
}

/// Computes the checksum used by packer reports for tensor layout identity.
pub(crate) fn tensor_layout_checksum(tensors: &[TensorEntry]) -> u64 {
    let mut sorted = tensors.iter().collect::<Vec<_>>();
    sorted.sort_by_key(|tensor| tensor.name_hash);
    let mut acc = 0x74656e736f722d6cu64;
    for tensor in sorted {
        mix_u64(&mut acc, tensor.name_hash);
        mix_u64(&mut acc, u64::from(tensor.dtype));
        mix_u64(&mut acc, u64::from(tensor.rank));
        for dim in [tensor.dim0, tensor.dim1, tensor.dim2, tensor.dim3] {
            mix_u64(&mut acc, u64::from(dim));
        }
        mix_u64(&mut acc, u64::from(tensor.block_size));
        mix_u64(&mut acc, tensor.byte_length);
    }
    acc
}

pub(crate) fn parameter_count(tensors: &[TensorEntry]) -> Result<u64, ErrorCode> {
    tensors.iter().try_fold(0u64, |acc, tensor| {
        acc.checked_add(tensor_element_count(tensor)? as u64)
            .ok_or(ErrorCode::InvalidLength)
    })
}

pub(crate) fn read_f32(bytes: &[u8], offset: usize) -> Result<f32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(f32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn validate_adapter_bytes(bytes: &[u8]) -> Result<(), ErrorCode> {
    if bytes.get(0..4) != Some(MAGIC) {
        return Err(ErrorCode::InvalidHeader);
    }
    if read_u32(bytes, 4)? != VERSION {
        return Err(ErrorCode::UnsupportedModelVersion);
    }
    if read_u32(bytes, 8)? as usize != HEADER_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    let tensor_count = read_u32(bytes, 12)? as usize;
    if read_u32(bytes, 20)? as usize != ENTRY_LEN {
        return Err(ErrorCode::InvalidHeader);
    }
    let data_offset = usize_from_u64(read_u64(bytes, 48)?)?;
    let directory_end = HEADER_LEN
        .checked_add(
            tensor_count
                .checked_mul(ENTRY_LEN)
                .ok_or(ErrorCode::InvalidLength)?,
        )
        .ok_or(ErrorCode::InvalidLength)?;
    if data_offset < directory_end || data_offset % 64 != 0 || data_offset > bytes.len() {
        return Err(ErrorCode::InvalidHeader);
    }
    if read_u64(bytes, CHECKSUM_OFFSET)? != adapter_checksum(bytes)? {
        return Err(ErrorCode::InvalidHeader);
    }
    for index in 0..tensor_count {
        let entry_offset = HEADER_LEN + index * ENTRY_LEN;
        let byte_offset = usize_from_u64(read_u64(bytes, entry_offset + 32)?)?;
        let byte_length = usize_from_u64(read_u64(bytes, entry_offset + 40)?)?;
        let element_count = usize_from_u64(read_u64(bytes, entry_offset + 48)?)?;
        let expected_byte_length = element_count
            .checked_mul(4)
            .ok_or(ErrorCode::InvalidLength)?;
        if byte_length != expected_byte_length {
            return Err(ErrorCode::ShapeMismatch);
        }
        let end = byte_offset
            .checked_add(byte_length)
            .ok_or(ErrorCode::InvalidLength)?;
        let payload = bytes
            .get(byte_offset..end)
            .ok_or(ErrorCode::InvalidHeader)?;
        if read_u64(bytes, entry_offset + 56)? != payload_checksum(payload) {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn validate_entry_identity(
    bytes: &[u8],
    entry_offset: usize,
    tensor: &TensorEntry,
    data_offset: usize,
) -> Result<(), ErrorCode> {
    if read_u64(bytes, entry_offset)? != tensor.name_hash {
        return Err(ErrorCode::ShapeMismatch);
    }
    if read_u32(bytes, entry_offset + 8)? != tensor.rank {
        return Err(ErrorCode::ShapeMismatch);
    }
    for (dim_index, expected) in [tensor.dim0, tensor.dim1, tensor.dim2, tensor.dim3]
        .iter()
        .enumerate()
    {
        if read_u32(bytes, entry_offset + 12 + dim_index * 4)? != *expected {
            return Err(ErrorCode::ShapeMismatch);
        }
    }
    if read_u32(bytes, entry_offset + 28)? != 0 {
        return Err(ErrorCode::InvalidHeader);
    }
    let byte_offset = usize_from_u64(read_u64(bytes, entry_offset + 32)?)?;
    if byte_offset < data_offset || byte_offset % 64 != 0 {
        return Err(ErrorCode::InvalidHeader);
    }
    let element_count = read_u64(bytes, entry_offset + 48)?;
    if element_count != tensor_element_count(tensor)? as u64 {
        return Err(ErrorCode::ShapeMismatch);
    }
    Ok(())
}

fn validate_finite_payload(
    bytes: &[u8],
    byte_offset: usize,
    element_count: usize,
) -> Result<(), ErrorCode> {
    for value_index in 0..element_count {
        let offset = byte_offset
            .checked_add(value_index.checked_mul(4).ok_or(ErrorCode::InvalidLength)?)
            .ok_or(ErrorCode::InvalidLength)?;
        if !read_f32(bytes, offset)?.is_finite() {
            return Err(ErrorCode::InvalidHeader);
        }
    }
    Ok(())
}

fn adapter_checksum(bytes: &[u8]) -> Result<u64, ErrorCode> {
    if bytes.len() < HEADER_LEN {
        return Err(ErrorCode::InvalidHeader);
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

fn tensor_element_count(entry: &TensorEntry) -> Result<usize, ErrorCode> {
    let mut total = 1usize;
    for dim in [entry.dim0, entry.dim1, entry.dim2, entry.dim3]
        .into_iter()
        .take(entry.rank as usize)
    {
        if dim == 0 {
            return Err(ErrorCode::ShapeMismatch);
        }
        total = total
            .checked_mul(dim as usize)
            .ok_or(ErrorCode::InvalidLength)?;
    }
    Ok(total)
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, ErrorCode> {
    let end = offset.checked_add(4).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, ErrorCode> {
    let end = offset.checked_add(8).ok_or(ErrorCode::InvalidLength)?;
    let slice = bytes.get(offset..end).ok_or(ErrorCode::InvalidHeader)?;
    Ok(u64::from_le_bytes([
        slice[0], slice[1], slice[2], slice[3], slice[4], slice[5], slice[6], slice[7],
    ]))
}

fn usize_from_u64(value: u64) -> Result<usize, ErrorCode> {
    usize::try_from(value).map_err(|_| ErrorCode::InvalidLength)
}

fn mix_u64(acc: &mut u64, value: u64) {
    for byte in value.to_le_bytes() {
        *acc ^= u64::from(byte);
        *acc = acc.rotate_left(11).wrapping_mul(0x100000001b3);
    }
}
