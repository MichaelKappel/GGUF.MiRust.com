//! Quantization helpers for q8_0 and q4_0.

use crate::errors::ErrorCode;

/// Computes a q8_0 row-major matrix-vector product with one scale per row.
pub fn matvec_q8_0(
    weights: &[i8],
    scales: &[f32],
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if weights.len() != rows.checked_mul(cols).ok_or(ErrorCode::InvalidLength)?
        || scales.len() != rows
        || vector.len() != cols
        || out.len() != rows
    {
        return Err(ErrorCode::ShapeMismatch);
    }
    for row in 0..rows {
        let mut sum = 0.0f32;
        let row_start = row * cols;
        for col in 0..cols {
            sum += f32::from(weights[row_start + col]) * scales[row] * vector[col];
        }
        out[row] = sum;
    }
    Ok(())
}

/// Dequantizes a packed q4_0 block into signed f32 values.
pub fn dequant_q4_0_block(packed: &[u8], scale: f32, out: &mut [f32]) -> Result<(), ErrorCode> {
    if out.len() != packed.len() * 2 {
        return Err(ErrorCode::ShapeMismatch);
    }
    for (index, byte) in packed.iter().enumerate() {
        let lo = sign_extend_4(byte & 0x0f);
        let hi = sign_extend_4(byte >> 4);
        out[index * 2] = f32::from(lo) * scale;
        out[index * 2 + 1] = f32::from(hi) * scale;
    }
    Ok(())
}

/// Computes a q4_0 row-major matrix-vector product with one scale per quantization block.
pub fn matvec_q4_0(
    packed: &[u8],
    scales: &[f32],
    block_size: usize,
    rows: usize,
    cols: usize,
    vector: &[f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if block_size == 0
        || block_size % 2 != 0
        || cols % block_size != 0
        || vector.len() != cols
        || out.len() != rows
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
    for row in 0..rows {
        let mut sum = 0.0f32;
        for col_byte in 0..bytes_per_row {
            let byte = packed[row * bytes_per_row + col_byte];
            let col = col_byte * 2;
            let scale = scales[row * blocks_per_row + col / block_size];
            sum += f32::from(sign_extend_4(byte & 0x0f)) * scale * vector[col];
            sum += f32::from(sign_extend_4(byte >> 4)) * scale * vector[col + 1];
        }
        out[row] = sum;
    }
    Ok(())
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

    #[test]
    fn q8_dequant_known_output() {
        let weights = [1i8, -2, 3, 4];
        let scales = [0.5, 1.0];
        let vector = [2.0, 1.0];
        let mut out = [0.0; 2];
        matvec_q8_0(&weights, &scales, 2, 2, &vector, &mut out).unwrap();
        assert_eq!(out, [0.0, 10.0]);
    }

    #[test]
    fn q4_dequant_known_output() {
        let packed = [0x1f, 0x80];
        let mut out = [0.0; 4];
        dequant_q4_0_block(&packed, 0.5, &mut out).unwrap();
        assert_eq!(out, [-0.5, 0.5, 0.0, -4.0]);
    }

    #[test]
    fn q4_matvec_uses_block_scales() {
        let packed = [0x11, 0x22];
        let scales = [1.0, 2.0];
        let vector = [1.0, 1.0, 1.0, 1.0];
        let mut out = [0.0];
        matvec_q4_0(&packed, &scales, 2, 1, 4, &vector, &mut out).unwrap();
        assert_eq!(out, [10.0]);
    }
}
