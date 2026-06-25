//! Quantization writer helpers.

#![allow(dead_code)]

/// Quantizes one f32 row into signed q8 values and a row scale.
pub fn quantize_q8_row(row: &[f32], out: &mut [i8]) -> f32 {
    let mut max_abs = 0.0f32;
    for value in row {
        max_abs = max_abs.max(value.abs());
    }
    let scale = if max_abs == 0.0 { 1.0 } else { max_abs / 127.0 };
    for (index, value) in row.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-127.0, 127.0) as i8;
    }
    scale
}

/// Packs signed q4 nibbles into bytes using low nibble first.
pub fn pack_q4_pair(a: i8, b: i8) -> u8 {
    ((b as u8) & 0x0f) << 4 | ((a as u8) & 0x0f)
}

/// Quantizes one f32 block into signed q4 values and a block scale.
pub fn quantize_q4_block(block: &[f32], out: &mut [i8]) -> f32 {
    let mut max_abs = 0.0f32;
    for value in block {
        max_abs = max_abs.max(value.abs());
    }
    let scale = if max_abs == 0.0 { 1.0 } else { max_abs / 7.0 };
    for (index, value) in block.iter().enumerate() {
        out[index] = (*value / scale).round().clamp(-8.0, 7.0) as i8;
    }
    scale
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantize_q8_row_produces_scale() {
        let mut out = [0i8; 2];
        let scale = quantize_q8_row(&[1.0, -1.0], &mut out);
        assert!(scale > 0.0);
        assert_eq!(out, [127, -127]);
    }

    #[test]
    fn pack_q4_pair_low_nibble_first() {
        assert_eq!(pack_q4_pair(-1, 1), 0x1f);
    }

    #[test]
    fn quantize_q4_block_produces_scale() {
        let mut out = [0i8; 2];
        let scale = quantize_q4_block(&[1.0, -1.0], &mut out);
        assert!(scale > 0.0);
        assert_eq!(out, [7, -7]);
    }
}
