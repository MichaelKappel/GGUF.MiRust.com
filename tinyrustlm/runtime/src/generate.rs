//! Autoregressive generation state.

use crate::diagnostics::Diagnostics;
use crate::errors::ErrorCode;
use crate::kv_cache::KvCache;
use crate::model::{LayerTensorIndices, Model};
use crate::ops::{dot, rms_norm, softmax, swiglu};
use crate::rng::XorShift64;
use crate::rope::apply_rope;
use crate::sampler::{sample_with_rng, validate_config, SamplingConfig};
use crate::tokenizer::{Tokenizer, EOS};
use core::fmt::Write as _;

const MAX_RESULT_BYTES: usize = 64 * 1024;

/// Runtime state shared by browser exports.
pub struct Runtime {
    model: Option<Model>,
    kv_cache: Option<KvCache>,
    tokenizer: Tokenizer,
    tokens: Vec<u32>,
    generated_tokens: Vec<u32>,
    last_result: Vec<u8>,
    diagnostics_text: Vec<u8>,
    diagnostics: Diagnostics,
    sampling_config: SamplingConfig,
    rng: XorShift64,
    scratch: Option<ForwardScratch>,
    logits: Vec<f32>,
}

impl Runtime {
    /// Creates a fresh runtime with no loaded model.
    pub fn new() -> Self {
        let mut runtime = Self {
            model: None,
            kv_cache: None,
            tokenizer: Tokenizer::default(),
            tokens: Vec::new(),
            generated_tokens: Vec::new(),
            last_result: Vec::new(),
            diagnostics_text: Vec::new(),
            diagnostics: Diagnostics::default(),
            sampling_config: SamplingConfig::default(),
            rng: XorShift64::new(SamplingConfig::default().seed),
            scratch: None,
            logits: Vec::new(),
        };
        runtime.apply_sampling_to_diagnostics();
        runtime.refresh_diagnostics();
        runtime
    }

    /// Loads a validated `.slm` model.
    pub fn load_model(&mut self, bytes: &[u8]) -> ErrorCode {
        match Model::load(bytes) {
            Ok(model) => {
                let header = model.header();
                let layer_count = header.layer_count as usize;
                let max_context = header.max_context as usize;
                let kv_head_count = header.kv_head_count as usize;
                let head_dim = header.head_dim as usize;
                let vocab_size = header.vocab_size as usize;
                let quantization_mode = model.quantization_mode();
                let scratch = match ForwardScratch::new(&model) {
                    Ok(scratch) => scratch,
                    Err(error) => {
                        self.clear_model_state();
                        self.diagnostics.model_loaded = false;
                        self.set_result(error.message());
                        return self.finish(error);
                    }
                };
                let cache = match KvCache::new(layer_count, max_context, kv_head_count, head_dim) {
                    Ok(cache) => cache,
                    Err(error) => {
                        self.clear_model_state();
                        self.diagnostics.model_loaded = false;
                        self.set_result(error.message());
                        return self.finish(error);
                    }
                };
                self.tokens.clear();
                self.generated_tokens.clear();
                self.tokenizer = model.tokenizer().clone();
                self.model = Some(model);
                self.kv_cache = Some(cache);
                self.scratch = Some(scratch);
                self.logits = vec![0.0; vocab_size];
                self.diagnostics.reset_generation();
                self.diagnostics.model_loaded = true;
                self.diagnostics.active_quantization_mode = quantization_mode;
                self.set_result("model loaded");
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.clear_model_state();
                self.diagnostics.model_loaded = false;
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Configures deterministic decoding.
    pub fn configure_sampling(
        &mut self,
        temperature: f32,
        top_k: u32,
        top_p: f32,
        seed: u32,
    ) -> ErrorCode {
        let config = SamplingConfig {
            temperature,
            top_k: top_k as usize,
            top_p,
            seed: seed as u64,
        };
        if validate_config(config).is_err() {
            self.set_result(ErrorCode::InvalidLength.message());
            return self.finish(ErrorCode::InvalidLength);
        }
        self.sampling_config = config;
        self.rng = XorShift64::new(self.sampling_config.seed);
        self.apply_sampling_to_diagnostics();
        self.set_result("sampling configured");
        self.finish(ErrorCode::Ok)
    }

    /// Applies a validated f32 adapter-delta package to the loaded model.
    pub fn apply_adapter_delta(&mut self, bytes: &[u8]) -> ErrorCode {
        let result = match self.model.as_mut() {
            Some(model) => model.apply_adapter_delta(bytes),
            None => Err(ErrorCode::ModelNotLoaded),
        };
        match result {
            Ok(()) => {
                self.clear_generation_state();
                self.set_result("adapter applied");
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    /// Generates text for a prompt with configured local decoding.
    pub fn generate(&mut self, prompt: &str, max_new_tokens: u32) -> ErrorCode {
        if self.model.is_none() {
            self.set_result(ErrorCode::ModelNotLoaded.message());
            return self.finish(ErrorCode::ModelNotLoaded);
        }
        if max_new_tokens == 0 {
            return self.finish_generation_error(ErrorCode::InvalidLength);
        }
        self.clear_generation_state();
        let encode_result = self.tokenizer.encode(prompt, &mut self.tokens);
        if let Err(error) = encode_result {
            return self.finish_generation_error(error);
        }
        let prompt_tokens = prompt_tokens_without_eos(&self.tokens);
        let prompt_count = prompt_tokens.len();
        let prompt_context_len = prompt_tokens.len();
        let result = {
            let model = self.model.as_ref().ok_or(ErrorCode::ModelNotLoaded);
            let cache = self.kv_cache.as_mut().ok_or(ErrorCode::ModelNotLoaded);
            let scratch = self.scratch.as_mut().ok_or(ErrorCode::ModelNotLoaded);
            match (model, cache, scratch) {
                (Ok(model), Ok(cache), Ok(scratch)) => run_generation(
                    model,
                    cache,
                    prompt_tokens,
                    max_new_tokens as usize,
                    self.sampling_config,
                    scratch,
                    &mut self.logits,
                    &mut self.generated_tokens,
                    &mut self.diagnostics,
                ),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        };
        match result {
            Ok(()) => {
                let mut decoded = String::new();
                if let Err(error) = self.tokenizer.decode_with_limit(
                    &self.generated_tokens,
                    &mut decoded,
                    MAX_RESULT_BYTES,
                ) {
                    return self.finish_generation_error(error);
                }
                self.tokens.truncate(prompt_context_len);
                self.tokens.extend_from_slice(&self.generated_tokens);
                self.diagnostics.prompt_token_count = prompt_count as u32;
                self.diagnostics.generated_token_count = self.generated_tokens.len() as u32;
                self.set_result(&decoded);
                self.finish(ErrorCode::Ok)
            }
            Err(error) => self.finish_generation_error(error),
        }
    }

    /// Generates one token from the current context.
    pub fn generate_next_token(&mut self) -> ErrorCode {
        match self.generate_next_token_id() {
            Ok(next) => {
                if should_stop(next) {
                    self.set_result("");
                } else {
                    let mut decoded = String::new();
                    if let Err(error) =
                        self.tokenizer
                            .decode_with_limit(&[next], &mut decoded, MAX_RESULT_BYTES)
                    {
                        self.set_result(error.message());
                        return self.finish(error);
                    }
                    self.set_result(&decoded);
                }
                self.finish(ErrorCode::Ok)
            }
            Err(error) => {
                self.set_result(error.message());
                self.finish(error)
            }
        }
    }

    fn generate_next_token_id(&mut self) -> Result<u32, ErrorCode> {
        let model = self.model.as_ref().ok_or(ErrorCode::ModelNotLoaded)?;
        let cache = self.kv_cache.as_mut().ok_or(ErrorCode::ModelNotLoaded)?;
        let scratch = self.scratch.as_mut().ok_or(ErrorCode::ModelNotLoaded)?;
        if self.tokens.is_empty() {
            return Err(ErrorCode::InvalidLength);
        }
        let position = cache.len();
        if position >= model.header().max_context as usize {
            return Err(ErrorCode::ContextExceeded);
        }
        let token = *self.tokens.last().ok_or(ErrorCode::InvalidLength)? as usize;
        forward_token(model, cache, token, position, scratch, &mut self.logits)?;
        let next = sample_with_rng(&self.logits, self.sampling_config, &mut self.rng)? as u32;
        if next != EOS {
            self.tokens.push(next);
            self.generated_tokens.push(next);
        }
        self.diagnostics.generated_token_count = self.generated_tokens.len() as u32;
        self.diagnostics.kv_cache_length = cache.len();
        self.diagnostics.peak_scratch_arena_usage = scratch.peak_bytes();
        update_generation_details(&mut self.diagnostics, &self.logits, next);
        Ok(next)
    }

    /// Resets prompt and cache state.
    pub fn reset_context(&mut self) -> ErrorCode {
        self.clear_generation_state();
        self.set_result("context reset");
        self.finish(ErrorCode::Ok)
    }

    /// Frees the loaded model while keeping the runtime initialized.
    pub fn free_model(&mut self) -> ErrorCode {
        self.clear_model_state();
        self.diagnostics.reset_generation();
        self.diagnostics.model_loaded = false;
        self.diagnostics.active_quantization_mode = "none";
        self.set_result("model freed");
        self.finish(ErrorCode::Ok)
    }

    /// Records an ABI boundary error message.
    pub fn record_boundary_error(&mut self, error: ErrorCode) -> ErrorCode {
        self.set_result(error.message());
        self.finish(error)
    }

    /// Returns the current result bytes.
    pub fn last_result(&self) -> &[u8] {
        &self.last_result
    }

    /// Returns current diagnostics bytes.
    pub fn diagnostics(&self) -> &[u8] {
        &self.diagnostics_text
    }

    fn set_result(&mut self, text: &str) {
        self.last_result.clear();
        self.last_result.extend_from_slice(text.as_bytes());
    }

    fn finish_generation_error(&mut self, error: ErrorCode) -> ErrorCode {
        self.clear_generation_state();
        self.set_result(error.message());
        self.finish(error)
    }

    fn finish(&mut self, code: ErrorCode) -> ErrorCode {
        self.diagnostics.record_error(code);
        self.refresh_diagnostics();
        code
    }

    fn refresh_diagnostics(&mut self) {
        self.diagnostics.render_json(&mut self.diagnostics_text);
    }

    fn apply_sampling_to_diagnostics(&mut self) {
        self.diagnostics.sampling_temperature = self.sampling_config.temperature;
        self.diagnostics.sampling_top_k = self.sampling_config.top_k;
        self.diagnostics.sampling_top_p = self.sampling_config.top_p;
        self.diagnostics.sampling_seed = self.sampling_config.seed;
    }

    fn clear_model_state(&mut self) {
        self.model = None;
        self.kv_cache = None;
        self.scratch = None;
        self.logits.clear();
    }

    fn clear_generation_state(&mut self) {
        self.tokens.clear();
        self.generated_tokens.clear();
        if let Some(cache) = self.kv_cache.as_mut() {
            cache.reset();
        }
        self.diagnostics.reset_generation();
    }
}

impl Default for Runtime {
    fn default() -> Self {
        Self::new()
    }
}

struct ForwardScratch {
    residual: Vec<f32>,
    normed: Vec<f32>,
    q: Vec<f32>,
    k: Vec<f32>,
    v: Vec<f32>,
    attention: Vec<f32>,
    projected: Vec<f32>,
    ffn_normed: Vec<f32>,
    norm_weight: Vec<f32>,
    ffn_scratch: Vec<f32>,
    ffn_out: Vec<f32>,
    scores: Vec<f32>,
}

impl ForwardScratch {
    fn new(model: &Model) -> Result<Self, ErrorCode> {
        let header = model.header();
        let hidden = header.hidden_size as usize;
        let ffn = header.ffn_size as usize;
        let max_context = header.max_context as usize;
        if header.head_count != header.kv_head_count {
            return Err(ErrorCode::ShapeMismatch);
        }
        Ok(Self {
            residual: vec![0.0; hidden],
            normed: vec![0.0; hidden],
            q: vec![0.0; hidden],
            k: vec![0.0; hidden],
            v: vec![0.0; hidden],
            attention: vec![0.0; hidden],
            projected: vec![0.0; hidden],
            ffn_normed: vec![0.0; hidden],
            norm_weight: vec![0.0; hidden],
            ffn_scratch: vec![0.0; ffn * 3],
            ffn_out: vec![0.0; hidden],
            scores: vec![0.0; max_context],
        })
    }

    fn peak_bytes(&self) -> usize {
        (self.residual.len()
            + self.normed.len()
            + self.q.len()
            + self.k.len()
            + self.v.len()
            + self.attention.len()
            + self.projected.len()
            + self.ffn_normed.len()
            + self.norm_weight.len()
            + self.ffn_scratch.len()
            + self.ffn_out.len()
            + self.scores.len())
            * core::mem::size_of::<f32>()
    }

    #[cfg(test)]
    fn buffer_addresses(&self) -> [usize; 12] {
        [
            self.residual.as_ptr() as usize,
            self.normed.as_ptr() as usize,
            self.q.as_ptr() as usize,
            self.k.as_ptr() as usize,
            self.v.as_ptr() as usize,
            self.attention.as_ptr() as usize,
            self.projected.as_ptr() as usize,
            self.ffn_normed.as_ptr() as usize,
            self.norm_weight.as_ptr() as usize,
            self.ffn_scratch.as_ptr() as usize,
            self.ffn_out.as_ptr() as usize,
            self.scores.as_ptr() as usize,
        ]
    }
}

fn run_generation(
    model: &Model,
    cache: &mut KvCache,
    prompt_tokens: &[u32],
    max_new_tokens: usize,
    sampling_config: SamplingConfig,
    scratch: &mut ForwardScratch,
    logits: &mut [f32],
    generated_tokens: &mut Vec<u32>,
    diagnostics: &mut Diagnostics,
) -> Result<(), ErrorCode> {
    if prompt_tokens.is_empty() {
        return Err(ErrorCode::InvalidLength);
    }
    let max_context = model.header().max_context as usize;
    if prompt_tokens.len() >= max_context {
        return Err(ErrorCode::ContextExceeded);
    }
    cache.reset();
    generated_tokens.clear();
    diagnostics.tokenizer_output = token_list(prompt_tokens);

    let mut rng = XorShift64::new(sampling_config.seed);
    for (position, token) in prompt_tokens.iter().enumerate() {
        forward_token(model, cache, *token as usize, position, scratch, logits)?;
    }

    let mut position = prompt_tokens.len();
    for _ in 0..max_new_tokens {
        if position >= max_context {
            break;
        }
        let next = sample_with_rng(logits, sampling_config, &mut rng)? as u32;
        update_generation_details(diagnostics, logits, next);
        if should_stop(next) {
            break;
        }
        generated_tokens.push(next);
        forward_token(model, cache, next as usize, position, scratch, logits)?;
        position += 1;
    }

    diagnostics.kv_cache_length = cache.len();
    diagnostics.peak_scratch_arena_usage = scratch.peak_bytes();
    diagnostics.tokens_per_second = 0.0;
    Ok(())
}

fn forward_token(
    model: &Model,
    cache: &mut KvCache,
    token: usize,
    position: usize,
    scratch: &mut ForwardScratch,
    logits: &mut [f32],
) -> Result<(), ErrorCode> {
    let header = model.header();
    let hidden = header.hidden_size as usize;
    let layers = header.layer_count as usize;
    let heads = header.head_count as usize;
    let head_dim = header.head_dim as usize;
    let ffn = header.ffn_size as usize;
    let vocab = header.vocab_size as usize;
    if token >= vocab || logits.len() != vocab || heads * head_dim != hidden {
        return Err(ErrorCode::ShapeMismatch);
    }

    let top_level = model.top_level_indices();
    model.copy_tensor_row_f32_by_index(
        top_level.tok_embeddings,
        token,
        hidden,
        &mut scratch.residual,
    )?;

    for layer in 0..layers {
        let layer_indices = model.layer_indices(layer)?;
        model.copy_tensor_f32_by_index(layer_indices.attention_norm, &mut scratch.norm_weight)?;
        rms_norm(
            &scratch.residual,
            &scratch.norm_weight,
            header.rms_norm_epsilon,
            &mut scratch.normed,
        )?;
        model.matvec_by_index(
            layer_indices.wq,
            hidden,
            hidden,
            &scratch.normed,
            &mut scratch.q,
        )?;
        model.matvec_by_index(
            layer_indices.wk,
            hidden,
            hidden,
            &scratch.normed,
            &mut scratch.k,
        )?;
        model.matvec_by_index(
            layer_indices.wv,
            hidden,
            hidden,
            &scratch.normed,
            &mut scratch.v,
        )?;
        for head in 0..heads {
            let start = head * head_dim;
            let end = start + head_dim;
            apply_rope(&mut scratch.q[start..end], position, header.rope_theta)?;
            apply_rope(&mut scratch.k[start..end], position, header.rope_theta)?;
        }
        cache.store_layer_at(layer, position, &scratch.k, &scratch.v)?;
        causal_attention(
            cache,
            layer,
            position,
            heads,
            head_dim,
            &scratch.q,
            &mut scratch.scores,
            &mut scratch.attention,
        )?;
        model.matvec_by_index(
            layer_indices.wo,
            hidden,
            hidden,
            &scratch.attention,
            &mut scratch.projected,
        )?;
        add_in_place(&mut scratch.residual, &scratch.projected)?;

        model.copy_tensor_f32_by_index(layer_indices.ffn_norm, &mut scratch.norm_weight)?;
        rms_norm(
            &scratch.residual,
            &scratch.norm_weight,
            header.rms_norm_epsilon,
            &mut scratch.ffn_normed,
        )?;
        ffn_model(
            model,
            layer_indices,
            hidden,
            ffn,
            &scratch.ffn_normed,
            &mut scratch.ffn_scratch,
            &mut scratch.ffn_out,
        )?;
        add_in_place(&mut scratch.residual, &scratch.ffn_out)?;
    }
    cache.commit_len(position + 1)?;

    model.copy_tensor_f32_by_index(top_level.norm, &mut scratch.norm_weight)?;
    rms_norm(
        &scratch.residual,
        &scratch.norm_weight,
        header.rms_norm_epsilon,
        &mut scratch.normed,
    )?;
    model.matvec_by_index(
        top_level.output_projection,
        vocab,
        hidden,
        &scratch.normed,
        logits,
    )?;
    Ok(())
}

fn ffn_model(
    model: &Model,
    layer_indices: LayerTensorIndices,
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
    model.matvec_by_index(layer_indices.w1, ffn, hidden, input, gate)?;
    model.matvec_by_index(layer_indices.w3, ffn, hidden, input, up)?;
    swiglu(gate, up, &mut activated[..ffn])?;
    model.matvec_by_index(layer_indices.w2, hidden, ffn, &activated[..ffn], out)?;
    Ok(())
}

fn causal_attention(
    cache: &KvCache,
    layer: usize,
    position: usize,
    heads: usize,
    head_dim: usize,
    query: &[f32],
    scores: &mut [f32],
    out: &mut [f32],
) -> Result<(), ErrorCode> {
    out.fill(0.0);
    if scores.len() <= position {
        return Err(ErrorCode::ContextExceeded);
    }
    for head in 0..heads {
        let start = head * head_dim;
        let end = start + head_dim;
        let query_head = &query[start..end];
        for past in 0..=position {
            let key_head = cache.key_head_at(layer, past, head)?;
            scores[past] = dot(query_head, key_head)? / (head_dim as f32).sqrt();
        }
        softmax(&mut scores[..=position])?;
        for past in 0..=position {
            let value_head = cache.value_head_at(layer, past, head)?;
            for dim in 0..head_dim {
                out[start + dim] += scores[past] * value_head[dim];
            }
        }
    }
    Ok(())
}

fn add_in_place(left: &mut [f32], right: &[f32]) -> Result<(), ErrorCode> {
    if left.len() != right.len() {
        return Err(ErrorCode::ShapeMismatch);
    }
    for index in 0..left.len() {
        left[index] += right[index];
    }
    Ok(())
}

fn prompt_tokens_without_eos(tokens: &[u32]) -> &[u32] {
    if tokens.last().copied() == Some(EOS) {
        &tokens[..tokens.len() - 1]
    } else {
        tokens
    }
}

fn should_stop(token: u32) -> bool {
    token == EOS
}

fn token_list(tokens: &[u32]) -> String {
    let mut text = String::new();
    for (index, token) in tokens.iter().enumerate() {
        if index > 0 {
            text.push(',');
        }
        text.push_str(&token.to_string());
    }
    text
}

fn logits_summary(logits: &[f32]) -> String {
    if logits.is_empty() {
        return String::new();
    }
    let mut min = logits[0];
    let mut max = logits[0];
    let mut max_index = 0usize;
    for (index, value) in logits.iter().enumerate() {
        min = min.min(*value);
        if *value > max {
            max = *value;
            max_index = index;
        }
    }
    let mut text = String::new();
    let _ = write!(
        &mut text,
        "min={:.4}, max={:.4}, argmax={}",
        min, max, max_index
    );
    text
}

fn top_k_summary(logits: &[f32], k: usize) -> String {
    const MAX_SUMMARY_CANDIDATES: usize = 8;
    let limit = k.min(MAX_SUMMARY_CANDIDATES).min(logits.len());
    let mut tokens = [0usize; MAX_SUMMARY_CANDIDATES];
    let mut values = [f32::NEG_INFINITY; MAX_SUMMARY_CANDIDATES];
    let mut count = 0usize;
    for (token, value) in logits.iter().copied().enumerate() {
        if count < limit {
            let mut index = count;
            while index > 0 && value > values[index - 1] {
                values[index] = values[index - 1];
                tokens[index] = tokens[index - 1];
                index -= 1;
            }
            values[index] = value;
            tokens[index] = token;
            count += 1;
        } else if limit > 0 && value > values[limit - 1] {
            let mut index = limit - 1;
            while index > 0 && value > values[index - 1] {
                values[index] = values[index - 1];
                tokens[index] = tokens[index - 1];
                index -= 1;
            }
            values[index] = value;
            tokens[index] = token;
        }
    }
    let mut text = String::new();
    for index in 0..count {
        if index > 0 {
            text.push_str(", ");
        }
        let _ = write!(&mut text, "{}:{:.4}", tokens[index], values[index]);
    }
    text
}

fn update_generation_details(diagnostics: &mut Diagnostics, logits: &[f32], selected: u32) {
    diagnostics.selected_next_token = selected;
    diagnostics.logits_summary = logits_summary(logits);
    diagnostics.top_k_candidates = top_k_summary(logits, 5);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapter::{parameter_count, section_checksum, tensor_layout_checksum};
    use crate::model_format::TensorEntry;

    const ADAPTER_HEADER_LEN: usize = 64;
    const ADAPTER_ENTRY_LEN: usize = 64;
    const ADAPTER_CHECKSUM_OFFSET: usize = 56;
    const TOKENIZER_CHECKSUM_SEED: u64 = 0x746f6b656e697a65;

    fn build_zero_adapter_bytes(model: &Model, model_bytes: &[u8]) -> Vec<u8> {
        let tensors = &model.parsed().tensors;
        let data_offset = align_to_64(ADAPTER_HEADER_LEN + tensors.len() * ADAPTER_ENTRY_LEN);
        let mut cursor = data_offset;
        let mut offsets = Vec::with_capacity(tensors.len());
        let mut lengths = Vec::with_capacity(tensors.len());
        let mut payloads = Vec::with_capacity(tensors.len());
        for tensor in tensors {
            cursor = align_to_64(cursor);
            offsets.push(cursor);
            let byte_length = tensor_element_count(tensor) * 4;
            lengths.push(byte_length);
            let payload = vec![0u8; byte_length];
            cursor += byte_length;
            payloads.push(payload);
        }

        let tokenizer_checksum = tokenizer_checksum(model, model_bytes);
        let mut bytes = vec![0u8; cursor];
        bytes[0..4].copy_from_slice(b"ADP1");
        write_u32(&mut bytes, 4, 1);
        write_u32(&mut bytes, 8, ADAPTER_HEADER_LEN as u32);
        write_u32(&mut bytes, 12, tensors.len() as u32);
        write_u32(&mut bytes, 16, model.header().flags);
        write_u32(&mut bytes, 20, ADAPTER_ENTRY_LEN as u32);
        write_u64(&mut bytes, 24, parameter_count(tensors).unwrap());
        write_u64(&mut bytes, 32, tensor_layout_checksum(tensors));
        write_u64(&mut bytes, 40, tokenizer_checksum);
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
            write_u64(&mut bytes, entry + 48, tensor_element_count(tensor) as u64);
            write_u64(
                &mut bytes,
                entry + 56,
                adapter_payload_checksum(&payloads[index]),
            );
            bytes[offsets[index]..offsets[index] + lengths[index]]
                .copy_from_slice(&payloads[index]);
        }
        let checksum = adapter_checksum(&bytes);
        write_u64(&mut bytes, ADAPTER_CHECKSUM_OFFSET, checksum);
        bytes
    }

    fn tokenizer_checksum(model: &Model, model_bytes: &[u8]) -> u64 {
        let start = model.header().tokenizer_offset as usize;
        let len = model.header().tokenizer_length as usize;
        section_checksum(&model_bytes[start..start + len], TOKENIZER_CHECKSUM_SEED)
    }

    fn tensor_element_count(entry: &TensorEntry) -> usize {
        [entry.dim0, entry.dim1, entry.dim2, entry.dim3]
            .into_iter()
            .take(entry.rank as usize)
            .fold(1usize, |acc, dim| acc * dim as usize)
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
    fn generation_stops_on_eos() {
        assert!(should_stop(EOS));
        assert!(!should_stop(101));
    }

    #[test]
    fn runtime_generates_from_tiny_fixture() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 16), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "eeeeeeeeeeeee");
        assert!(runtime
            .diagnostics()
            .windows(b"argmax=101".len())
            .any(|window| window == b"argmax=101"));
    }

    #[test]
    fn runtime_generates_from_tiny_tied_output_fixture() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-tied.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 16), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "eeeeeeeeeeeee");
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"active_quantization_mode\": \"f32\""));
        assert!(diagnostics.contains("\"selected_next_token\": 101"));
    }

    #[test]
    fn runtime_generates_from_tiny_q8_fixture() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q8.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 16), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "eeeeeeeeeeeee");
        assert!(runtime
            .diagnostics()
            .windows(b"\"active_quantization_mode\": \"q8_0\"".len())
            .any(|window| window == b"\"active_quantization_mode\": \"q8_0\""));
    }

    #[test]
    fn runtime_generates_from_tiny_q4_fixture() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q4.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 16), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "eeeeeeeeeeeee");
        assert!(runtime
            .diagnostics()
            .windows(b"\"active_quantization_mode\": \"q4_0\"".len())
            .any(|window| window == b"\"active_quantization_mode\": \"q4_0\""));
    }

    #[test]
    fn runtime_generates_from_tiny_bpe_fixture() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-bpe.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("the", 1), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert!(!text.is_empty());
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(
            diagnostics.contains("\"prompt_token_count\": 2"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"tokenizer_output\": \"256,261\""),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"active_quantization_mode\": \"f32\""),
            "{diagnostics}"
        );
    }

    #[test]
    fn runtime_accepts_stochastic_bpe_top_k_above_byte_vocab() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-bpe.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.configure_sampling(0.01, 262, 1.0, 7), ErrorCode::Ok);
        assert_eq!(runtime.generate("the", 1), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "e");
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(
            diagnostics.contains("\"sampling_top_k\": 262"),
            "{diagnostics}"
        );
        assert!(
            diagnostics.contains("\"tokenizer_output\": \"256,261\""),
            "{diagnostics}"
        );
    }

    #[test]
    fn runtime_reports_output_buffer_exceeded_without_stale_generation_state() {
        let mut runtime = Runtime::new();
        runtime.tokens.push(101);
        runtime
            .generated_tokens
            .resize(MAX_RESULT_BYTES + 1, b'x' as u32);
        runtime.diagnostics.generated_token_count = runtime.generated_tokens.len() as u32;
        let mut decoded = String::new();
        let error = runtime
            .tokenizer
            .decode_with_limit(&runtime.generated_tokens, &mut decoded, MAX_RESULT_BYTES)
            .unwrap_err();
        assert_eq!(error, ErrorCode::OutputBufferExceeded);
        assert_eq!(
            runtime.finish_generation_error(error),
            ErrorCode::OutputBufferExceeded
        );
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "output buffer exceeded"
        );
        assert!(runtime.tokens.is_empty());
        assert!(runtime.generated_tokens.is_empty());
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"output buffer exceeded\""));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
    }

    #[test]
    fn runtime_generate_next_token_continues_current_context() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q8.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(runtime.tokens.last().copied(), Some(101));
        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        let text = core::str::from_utf8(runtime.last_result()).unwrap();
        assert_eq!(text, "e");
        assert_eq!(runtime.tokens.last().copied(), Some(101));
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"generated_token_count\": 2"));
        assert!(diagnostics.contains("\"kv_cache_length\": 5"));
        assert!(diagnostics.contains("\"selected_next_token\": 101"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"q8_0\""));
    }

    #[test]
    fn runtime_adapter_apply_resets_generation_diagnostics() {
        let model_bytes = include_bytes!("../../models/tiny-test-model.slm");
        let mut runtime = Runtime::new();
        assert_eq!(runtime.load_model(model_bytes), ErrorCode::Ok);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert!(core::str::from_utf8(runtime.diagnostics())
            .unwrap()
            .contains("\"generated_token_count\": 1"));
        let adapter = {
            let model = runtime.model.as_ref().unwrap();
            build_zero_adapter_bytes(model, model_bytes)
        };

        assert_eq!(runtime.apply_adapter_delta(&adapter), ErrorCode::Ok);

        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "adapter applied"
        );
        assert!(runtime.tokens.is_empty());
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), Some(0));
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"model_loaded\": true"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"f32\""));
        assert!(diagnostics.contains("\"prompt_token_count\": 0"));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(diagnostics.contains("\"kv_cache_length\": 0"));
        assert!(diagnostics.contains("\"selected_next_token\": 0"));
    }

    #[test]
    fn runtime_q8_adapter_apply_resets_generation_diagnostics() {
        let model_bytes = include_bytes!("../../models/tiny-test-model-q8.slm");
        let mut runtime = Runtime::new();
        assert_eq!(runtime.load_model(model_bytes), ErrorCode::Ok);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert!(core::str::from_utf8(runtime.diagnostics())
            .unwrap()
            .contains("\"generated_token_count\": 1"));
        let adapter = {
            let model = runtime.model.as_ref().unwrap();
            build_zero_adapter_bytes(model, model_bytes)
        };

        assert_eq!(runtime.apply_adapter_delta(&adapter), ErrorCode::Ok);

        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "adapter applied"
        );
        assert!(runtime.tokens.is_empty());
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), Some(0));
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"model_loaded\": true"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"q8_0\""));
        assert!(diagnostics.contains("\"prompt_token_count\": 0"));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(diagnostics.contains("\"kv_cache_length\": 0"));
        assert!(diagnostics.contains("\"selected_next_token\": 0"));
    }

    #[test]
    fn runtime_accepts_last_prompt_slot_and_rejects_full_context_prompt() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q8.slm")),
            ErrorCode::Ok
        );

        assert_eq!(runtime.generate(&"a".repeat(14), 1), ErrorCode::Ok);
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"prompt_token_count\": 15"));
        assert!(diagnostics.contains("\"generated_token_count\": 1"));
        assert!(diagnostics.contains("\"kv_cache_length\": 16"));

        assert_eq!(
            runtime.generate(&"a".repeat(15), 1),
            ErrorCode::ContextExceeded
        );
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "context exceeded"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"context exceeded\""));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(runtime.tokens.is_empty());
        assert_eq!(runtime.kv_cache.as_ref().map(KvCache::len), Some(0));
    }

    #[test]
    fn runtime_reuses_generation_buffers_across_generate_and_steps() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q8.slm")),
            ErrorCode::Ok
        );
        let loaded_buffers = generation_buffer_snapshot(&runtime);
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(generation_buffer_snapshot(&runtime), loaded_buffers);
        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        assert_eq!(generation_buffer_snapshot(&runtime), loaded_buffers);
        assert_eq!(runtime.generate_next_token(), ErrorCode::Ok);
        assert_eq!(generation_buffer_snapshot(&runtime), loaded_buffers);
    }

    #[test]
    fn runtime_free_model_blocks_later_generation() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q8.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert_eq!(runtime.free_model(), ErrorCode::Ok);
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "model freed"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"ok\""));
        assert!(diagnostics.contains("\"model_loaded\": false"));
        assert!(diagnostics.contains("\"active_quantization_mode\": \"none\""));
        assert!(runtime.scratch.is_none());
        assert!(runtime.logits.is_empty());

        assert_eq!(runtime.generate_next_token(), ErrorCode::ModelNotLoaded);
        assert_eq!(
            core::str::from_utf8(runtime.last_result()).unwrap(),
            "model not loaded"
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"model not loaded\""));
        assert!(diagnostics.contains("\"model_loaded\": false"));
    }

    #[test]
    fn top_k_summary_keeps_highest_candidates_without_sorting_vector() {
        assert_eq!(
            top_k_summary(&[0.1, 2.0, 1.5, 2.0, -1.0], 3),
            "1:2.0000, 3:2.0000, 2:1.5000"
        );
        assert_eq!(top_k_summary(&[], 5), "");
        assert_eq!(top_k_summary(&[1.0, 2.0], 0), "");
    }

    #[test]
    fn model_reload_resets_generation_diagnostics() {
        let mut runtime = Runtime::new();
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q8.slm")),
            ErrorCode::Ok
        );
        assert_eq!(runtime.generate("hi", 1), ErrorCode::Ok);
        assert!(runtime
            .diagnostics()
            .windows(b"\"generated_token_count\": 1".len())
            .any(|window| window == b"\"generated_token_count\": 1"));
        assert_eq!(
            runtime.load_model(include_bytes!("../../models/tiny-test-model-q4.slm")),
            ErrorCode::Ok
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"active_quantization_mode\": \"q4_0\""));
        assert!(diagnostics.contains("\"prompt_token_count\": 0"));
        assert!(diagnostics.contains("\"generated_token_count\": 0"));
        assert!(diagnostics.contains("\"kv_cache_length\": 0"));
        assert!(diagnostics.contains("\"tokenizer_output\": \"\""));
        assert!(diagnostics.contains("\"selected_next_token\": 0"));
    }

    #[test]
    fn runtime_configures_sampling_diagnostics() {
        let mut runtime = Runtime::new();
        assert_eq!(runtime.configure_sampling(0.75, 4, 0.9, 123), ErrorCode::Ok);
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"sampling_temperature\": 0.750"));
        assert!(diagnostics.contains("\"sampling_top_k\": 4"));
        assert!(diagnostics.contains("\"sampling_top_p\": 0.900"));
        assert!(diagnostics.contains("\"sampling_seed\": 123"));

        assert_eq!(
            runtime.configure_sampling(1.0, 0, 1.0, 1),
            ErrorCode::InvalidLength
        );
        let diagnostics = core::str::from_utf8(runtime.diagnostics()).unwrap();
        assert!(diagnostics.contains("\"last_error\": \"invalid length\""));
    }

    fn generation_buffer_snapshot(runtime: &Runtime) -> ([usize; 12], usize, usize) {
        let scratch = runtime.scratch.as_ref().expect("scratch loaded");
        (
            scratch.buffer_addresses(),
            runtime.logits.as_ptr() as usize,
            runtime.logits.capacity(),
        )
    }
}
