//! Token sampling helpers.

use crate::errors::ErrorCode;
use crate::rng::XorShift64;

/// Maximum stochastic candidates retained without heap allocation.
pub const MAX_SAMPLING_CANDIDATES: usize = 1024;

/// Sampling configuration.
#[derive(Clone, Copy)]
pub struct SamplingConfig {
    /// Temperature for stochastic sampling.
    pub temperature: f32,
    /// Maximum top-k candidate count.
    pub top_k: usize,
    /// Nucleus sampling probability.
    pub top_p: f32,
    /// Deterministic seed.
    pub seed: u64,
}

impl Default for SamplingConfig {
    fn default() -> Self {
        Self {
            temperature: 0.0,
            top_k: 1,
            top_p: 1.0,
            seed: 1,
        }
    }
}

impl SamplingConfig {
    /// Returns true when this configuration should select the greedy argmax.
    pub fn is_greedy(self) -> bool {
        self.temperature <= 0.0 || self.top_k == 1
    }
}

/// Validates a sampling config against runtime fixed-buffer limits.
pub fn validate_config(config: SamplingConfig) -> Result<(), ErrorCode> {
    if !config.temperature.is_finite()
        || config.temperature < 0.0
        || !config.top_p.is_finite()
        || config.top_p <= 0.0
        || config.top_p > 1.0
        || config.top_k == 0
        || config.top_k > MAX_SAMPLING_CANDIDATES
    {
        return Err(ErrorCode::InvalidLength);
    }
    Ok(())
}

/// Selects the highest-logit token.
pub fn greedy(logits: &[f32]) -> Result<usize, ErrorCode> {
    if logits.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    let mut best_index = 0usize;
    let mut best_value = logits[0];
    for (index, value) in logits.iter().enumerate().skip(1) {
        if *value > best_value {
            best_value = *value;
            best_index = index;
        }
    }
    Ok(best_index)
}

/// Selects a token using deterministic greedy or seeded stochastic sampling.
pub fn sample(logits: &[f32], config: SamplingConfig) -> Result<usize, ErrorCode> {
    let mut rng = XorShift64::new(config.seed);
    sample_with_rng(logits, config, &mut rng)
}

/// Selects a token using temperature, top-k, top-p, and caller-owned RNG state.
pub fn sample_with_rng(
    logits: &[f32],
    config: SamplingConfig,
    rng: &mut XorShift64,
) -> Result<usize, ErrorCode> {
    if logits.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    validate_config(config)?;
    if config.is_greedy() {
        return greedy(logits);
    }

    let limit = config.top_k.min(logits.len());
    let mut tokens = [0usize; MAX_SAMPLING_CANDIDATES];
    let mut weights = [f32::NEG_INFINITY; MAX_SAMPLING_CANDIDATES];
    let mut count = 0usize;
    for (token, value) in logits.iter().copied().enumerate() {
        if count < limit {
            insert_candidate(&mut tokens, &mut weights, count, token, value);
            count += 1;
        } else if limit > 0 && value > weights[limit - 1] {
            insert_candidate(&mut tokens, &mut weights, limit - 1, token, value);
        }
    }

    let max_logit = weights[0];
    let mut total = 0.0f32;
    for weight in weights.iter_mut().take(count) {
        let scaled = ((*weight - max_logit) / config.temperature).exp();
        *weight = if scaled.is_finite() { scaled } else { 0.0 };
        total += *weight;
    }
    if total <= 0.0 || !total.is_finite() {
        return greedy(logits);
    }

    let mut keep = count;
    if config.top_p < 1.0 {
        let mut cumulative = 0.0f32;
        let threshold = total * config.top_p;
        for (index, weight) in weights.iter().take(count).enumerate() {
            cumulative += *weight;
            if cumulative >= threshold {
                keep = index + 1;
                break;
            }
        }
        keep = keep.max(1);
    }
    let truncated_total = weights.iter().take(keep).sum::<f32>();
    if truncated_total <= 0.0 || !truncated_total.is_finite() {
        return greedy(logits);
    }

    let threshold = rng.next_f32() * truncated_total;
    let mut cumulative = 0.0f32;
    for index in 0..keep {
        cumulative += weights[index];
        if threshold <= cumulative {
            return Ok(tokens[index]);
        }
    }
    Ok(tokens[keep - 1])
}

fn insert_candidate(
    tokens: &mut [usize; MAX_SAMPLING_CANDIDATES],
    weights: &mut [f32; MAX_SAMPLING_CANDIDATES],
    mut index: usize,
    token: usize,
    value: f32,
) {
    while index > 0 && value > weights[index - 1] {
        weights[index] = weights[index - 1];
        tokens[index] = tokens[index - 1];
        index -= 1;
    }
    weights[index] = value;
    tokens[index] = token;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greedy_sampler_deterministic_selection() {
        assert_eq!(greedy(&[0.1, 2.0, 1.5]).unwrap(), 1);
    }

    #[test]
    fn stochastic_sampler_is_seeded_and_top_k_limited() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 2,
            top_p: 1.0,
            seed: 42,
        };
        let logits = [0.0, 10.0, 9.0, 1.0];
        let first = sample(&logits, config).unwrap();
        let second = sample(&logits, config).unwrap();
        assert_eq!(first, second);
        assert!(first == 1 || first == 2);
    }

    #[test]
    fn stochastic_sampler_accepts_fixed_candidate_cap_without_vocab_vector() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: MAX_SAMPLING_CANDIDATES,
            top_p: 1.0,
            seed: 7,
        };
        let mut logits = [0.0f32; MAX_SAMPLING_CANDIDATES + 4];
        logits[3] = 10.0;
        logits[MAX_SAMPLING_CANDIDATES + 1] = 9.5;
        assert!(sample(&logits, config).is_ok());
    }

    #[test]
    fn stochastic_sampler_accepts_bpe_vocab_above_byte_tokenizer_size() {
        let config = SamplingConfig {
            temperature: 0.01,
            top_k: 262,
            top_p: 1.0,
            seed: 7,
        };
        let mut logits = [0.0f32; 262];
        logits[261] = 5.0;
        assert_eq!(sample(&logits, config).unwrap(), 261);
    }

    #[test]
    fn top_p_can_collapse_to_the_highest_probability_token() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 4,
            top_p: 0.5,
            seed: 99,
        };
        assert_eq!(sample(&[5.0, 1.0, 0.0, -1.0], config).unwrap(), 0);
    }

    #[test]
    fn sampler_rejects_invalid_stochastic_config() {
        let config = SamplingConfig {
            temperature: 1.0,
            top_k: 0,
            top_p: 1.0,
            seed: 1,
        };
        assert_eq!(sample(&[1.0, 2.0], config), Err(ErrorCode::InvalidLength));

        let oversized = SamplingConfig {
            temperature: 1.0,
            top_k: MAX_SAMPLING_CANDIDATES + 1,
            top_p: 1.0,
            seed: 1,
        };
        assert_eq!(
            sample(&[1.0, 2.0], oversized),
            Err(ErrorCode::InvalidLength)
        );
    }
}
