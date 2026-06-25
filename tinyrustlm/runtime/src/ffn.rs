//! Feed-forward network helpers.

use crate::errors::ErrorCode;
use crate::ops::{matvec_f32, swiglu};

/// Applies a f32 SwiGLU feed-forward block.
pub fn ffn_f32(
    w1: &[f32],
    w2: &[f32],
    w3: &[f32],
    hidden: usize,
    ffn: usize,
    input: &[f32],
    scratch: &mut [f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    if scratch.len() < ffn * 3 || out.len() != hidden || input.len() != hidden {
        return Err(ErrorCode::ShapeMismatch);
    }
    let (gate, rest) = scratch.split_at_mut(ffn);
    let (up, activated) = rest.split_at_mut(ffn);
    matvec_f32(w1, ffn, hidden, input, gate)?;
    matvec_f32(w3, ffn, hidden, input, up)?;
    swiglu(gate, up, &mut activated[..ffn])?;
    matvec_f32(w2, hidden, ffn, &activated[..ffn], out)?;
    Ok(())
}
