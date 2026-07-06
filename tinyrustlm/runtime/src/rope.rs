//! Rotary positional embedding helpers.

use crate::errors::ErrorCode;

/// Applies RoPE to an even-length vector in-place.
pub fn apply_rope(vector: &mut [f32], position: usize, theta: f32) -> Result<(), ErrorCode> {
    if !vector.len().is_multiple_of(2) || theta <= 0.0 {
        return Err(ErrorCode::ShapeMismatch);
    }
    let half = vector.len() / 2;
    for pair in 0..half {
        let even = pair * 2;
        let odd = even + 1;
        let freq = theta.powf(-(even as f32) / vector.len() as f32);
        let angle = position as f32 * freq;
        let cos = angle.cos();
        let sin = angle.sin();
        let x = vector[even];
        let y = vector[odd];
        vector[even] = x * cos - y * sin;
        vector[odd] = x * sin + y * cos;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rope_known_small_vector() {
        let mut vector = [1.0, 0.0];
        apply_rope(&mut vector, 0, 10000.0).unwrap();
        assert!((vector[0] - 1.0).abs() < 0.0001);
        assert!(vector[1].abs() < 0.0001);
    }
}
