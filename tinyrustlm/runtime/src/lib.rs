//! TinyRustLM zero-dependency Rust runtime.
//!
//! The runtime is designed for browser-hosted WebAssembly without wasm-bindgen,
//! JavaScript frameworks, tokenizer crates, inference frameworks, or remote
//! APIs. Early milestones expose a strict memory boundary, byte tokenizer,
//! `.slm` parser, math kernels, diagnostics, and deterministic sampling.

/// Causal attention helpers.
pub mod attention;
/// Runtime diagnostics and benchmark counters.
pub mod diagnostics;
/// Error codes shared across Rust and the browser host.
pub mod errors;
/// Native evaluation runner for local model/case evidence.
pub mod eval_runner;
/// Feed-forward network helpers.
pub mod ffn;
/// Autoregressive generation state.
pub mod generate;
/// Key/value cache storage.
pub mod kv_cache;
/// WASM memory boundary helpers.
pub mod memory;
/// Loaded model metadata and tensor lookup.
pub mod model;
/// Custom `.slm` binary parser.
pub mod model_format;
/// Core math operations.
pub mod ops;
/// Quantization helpers.
pub mod quant;
/// Deterministic pseudo-random generator.
pub mod rng;
/// Rotary positional embedding helpers.
pub mod rope;
/// Sampling helpers.
pub mod sampler;
/// Tensor view types.
pub mod tensor;
/// Byte-level tokenizer.
pub mod tokenizer;
/// Exports consumed by the handwritten JavaScript bootstrap.
pub mod wasm_exports;

pub use errors::ErrorCode;
