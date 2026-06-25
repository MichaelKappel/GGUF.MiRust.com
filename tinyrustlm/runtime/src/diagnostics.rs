//! Diagnostics and benchmark counters.

use crate::errors::ErrorCode;

/// Runtime diagnostics rendered for the browser UI.
pub struct Diagnostics {
    /// Last model load time in milliseconds.
    pub model_load_time_ms: u32,
    /// Last prompt token count.
    pub prompt_token_count: u32,
    /// Last generated token count.
    pub generated_token_count: u32,
    /// Last measured tokens per second.
    pub tokens_per_second: f32,
    /// Peak scratch arena usage in bytes.
    pub peak_scratch_arena_usage: usize,
    /// Current KV cache length.
    pub kv_cache_length: usize,
    /// Active quantization mode.
    pub active_quantization_mode: &'static str,
    /// Last error code.
    pub last_error: ErrorCode,
    /// Whether a model is loaded.
    pub model_loaded: bool,
    /// Tokenizer output for developer mode.
    pub tokenizer_output: String,
    /// Last logits summary for developer mode.
    pub logits_summary: String,
    /// Last selected token for developer mode.
    pub selected_next_token: u32,
    /// Top candidate summary for developer mode.
    pub top_k_candidates: String,
    /// Sampling temperature currently used for generation.
    pub sampling_temperature: f32,
    /// Sampling top-k candidate cap currently used for generation.
    pub sampling_top_k: usize,
    /// Sampling top-p nucleus threshold currently used for generation.
    pub sampling_top_p: f32,
    /// Sampling seed currently used for deterministic stochastic decoding.
    pub sampling_seed: u64,
}

impl Default for Diagnostics {
    fn default() -> Self {
        Self {
            model_load_time_ms: 0,
            prompt_token_count: 0,
            generated_token_count: 0,
            tokens_per_second: 0.0,
            peak_scratch_arena_usage: 0,
            kv_cache_length: 0,
            active_quantization_mode: "none",
            last_error: ErrorCode::Ok,
            model_loaded: false,
            tokenizer_output: String::new(),
            logits_summary: String::new(),
            selected_next_token: 0,
            top_k_candidates: String::new(),
            sampling_temperature: 0.0,
            sampling_top_k: 1,
            sampling_top_p: 1.0,
            sampling_seed: 1,
        }
    }
}

impl Diagnostics {
    /// Clears generation-specific counters and developer fields.
    pub fn reset_generation(&mut self) {
        self.prompt_token_count = 0;
        self.generated_token_count = 0;
        self.tokens_per_second = 0.0;
        self.peak_scratch_arena_usage = 0;
        self.kv_cache_length = 0;
        self.tokenizer_output.clear();
        self.logits_summary.clear();
        self.selected_next_token = 0;
        self.top_k_candidates.clear();
    }

    /// Records an error for the next diagnostics render.
    pub fn record_error(&mut self, error: ErrorCode) {
        self.last_error = error;
    }

    /// Renders diagnostics as JSON without using serde.
    pub fn render_json(&self, out: &mut Vec<u8>) {
        out.clear();
        let text = format!(
            "{{\n  \"model_load_time_ms\": {},\n  \"prompt_token_count\": {},\n  \"generated_token_count\": {},\n  \"tokens_per_second\": {:.3},\n  \"peak_scratch_arena_usage\": {},\n  \"kv_cache_length\": {},\n  \"active_quantization_mode\": \"{}\",\n  \"model_loaded\": {},\n  \"last_error\": \"{}\",\n  \"tokenizer_output\": \"{}\",\n  \"logits_summary\": \"{}\",\n  \"selected_next_token\": {},\n  \"top_k_candidates\": \"{}\",\n  \"sampling_temperature\": {:.3},\n  \"sampling_top_k\": {},\n  \"sampling_top_p\": {:.3},\n  \"sampling_seed\": {}\n}}",
            self.model_load_time_ms,
            self.prompt_token_count,
            self.generated_token_count,
            self.tokens_per_second,
            self.peak_scratch_arena_usage,
            self.kv_cache_length,
            self.active_quantization_mode,
            if self.model_loaded { "true" } else { "false" },
            self.last_error.message(),
            json_escape(&self.tokenizer_output),
            json_escape(&self.logits_summary),
            self.selected_next_token,
            json_escape(&self.top_k_candidates),
            self.sampling_temperature,
            self.sampling_top_k,
            self.sampling_top_p,
            self.sampling_seed,
        );
        out.extend_from_slice(text.as_bytes());
    }
}

fn json_escape(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\u{0008}' => escaped.push_str("\\b"),
            '\u{000C}' => escaped.push_str("\\f"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            '\u{2028}' => escaped.push_str("\\u2028"),
            '\u{2029}' => escaped.push_str("\\u2029"),
            ch if ch <= '\u{001F}' => {
                escaped.push_str("\\u00");
                escaped.push(hex_digit(((ch as u32) >> 4) as u8));
                escaped.push(hex_digit((ch as u32 & 0x0F) as u8));
            }
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'A' + (value - 10)) as char,
    }
}

#[cfg(test)]
mod tests {
    use super::Diagnostics;

    #[test]
    fn diagnostics_json_escapes_control_characters() {
        let mut diagnostics = Diagnostics::default();
        diagnostics.tokenizer_output = "quote \" slash \\ bell \u{0007} next\nline".to_string();
        diagnostics.logits_summary = "separator \u{2028} paragraph \u{2029}".to_string();
        diagnostics.top_k_candidates = "tab\tform\u{000C}back\u{0008}".to_string();

        let mut rendered = Vec::new();
        diagnostics.render_json(&mut rendered);
        let text = core::str::from_utf8(&rendered).expect("diagnostics JSON is UTF-8");

        assert!(text.contains("quote \\\" slash \\\\ bell \\u0007 next\\nline"));
        assert!(text.contains("separator \\u2028 paragraph \\u2029"));
        assert!(text.contains("tab\\tform\\fback\\b"));
    }
}
