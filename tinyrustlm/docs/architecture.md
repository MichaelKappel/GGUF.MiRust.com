# TinyRustLM Architecture

## Purpose

TinyRustLM is a browser-local SLM runtime with a static UI, handwritten JavaScript bootstrap, no-crate Rust local server, no-crate Rust mini browser harness, Rust WASM runtime, and local `.slm` model files.

## Constraints

The runtime, local server, and mini browser harness use no third-party Rust crates, no JavaScript frameworks, no tokenizer libraries, no ML frameworks, and no remote inference APIs. Rust owns local static hosting, app-contract verification, model validation, tokenization, math, KV cache, sampling, and diagnostics. JavaScript only fetches local static files, copies bytes into WASM memory, calls exports, and renders UI state such as provenance, diagnostics, benchmark values, and the local conversation transcript.

## Data Structures

The core data structures are `SlmHeader`, `TensorEntry`, typed tensor storage, pre-resolved top-level and per-layer tensor indices, `Tokenizer`, `TensorView`, `MutableTensorView`, `KvCache`, `SamplingConfig`, `Diagnostics`, and `Runtime`. The local server adds a small request-line parser, percent decoder, traversal-checked path resolver, and content-type mapper for static browser files. The Rust mini browser harness adds required DOM id checks, local-only marker scanning, model-route verification, line-based manifest validation, loopback URL parsing, and simple HTTP response validation. The packer adds `source.manifest` records and raw f32 tensor files as the trained-source input boundary before `.slm` conversion. The native eval runner adds line-based eval cases and eval sidecars as the evidence boundary after runtime execution. The runtime keeps q8_0 raw rows plus scales and q4_0 packed nibbles plus block scales for direct matvec, then dequantizes only requested rows or small vectors into model-loaded reusable scratch for embedding and norm paths. Model load resolves the tensor indices needed by generation once, including the tied-output flag fallback from `output.weight` to `tok_embeddings.weight`, so per-token forward passes do not format layer tensor names or scan the tensor directory by stable name. It also owns a reusable logits buffer so prompt generation and `generate_next_token` do not allocate scratch or vocab-sized logits per token. Decoding defaults to greedy for repeatable tests, while Rust also owns validated temperature, top-k, top-p, seeded PRNG sampling, and fixed candidate buffers capped at 1024 candidates so BPE vocabularies above byte-tokenizer size do not require a per-token heap vector. The first real-shaped target uses four layers, hidden size 512, eight heads, FFN size 2048, and context 512.

## Binary Formats

The `.slm` model file is little-endian and starts with `SLM1`. It contains a fixed v1 header, tokenizer section, tensor directory, 64-byte-aligned tensor data, and aligned scale sections for quantized tensors. Model loading parses the tokenizer section and selects either the fixed byte tokenizer (`BTOK`) or the custom BPE tokenizer (`BPE1`) before generation.

## Failure Cases

The runtime rejects null pointers, invalid lengths, invalid UTF-8, invalid magic, unsupported model versions, malformed headers, malformed tensor directories, missing tensors, shape mismatches, unsupported dtypes, context overflow, unloaded model calls, generation failures, and output overflow. The local server rejects unsupported methods, malformed request lines, invalid percent escapes, absolute paths, traversal paths, drive-qualified paths, and missing files. The Rust mini browser harness rejects missing UI contract markers, remote asset markers, missing model or manifest files, manifest quality overclaims, non-loopback HTTP URLs, wrong content types, and local route failures.

## Validation Rules

Every raw pointer crossing the WASM boundary is checked before use. Every binary parser validates bounds before reading. Tensor shapes must match element counts. Header dimensions must be non-zero and attention heads times head dimension must equal hidden size.

Model admission is split into source validation, structural validation, provenance validation, runtime eval evidence, and quality gating. Source validation accepts only line-declared raw f32 tensor files with safe paths, exact sizes, matching source checksums, expected shapes, finite bounded values, and nonzero payloads. Current deterministic TinyLM-16M-shaped artifacts can pass `runtime-smoke`, which proves local execution and diagnostics only. Converted-trained artifacts can also pass `runtime-smoke` after source conversion and `.slm` admission. Assistant-quality claims require a converted-trained provenance manifest and a separate evaluation sidecar with matching model and manifest checksums, passed task evaluation, passed safety review, a non-placeholder quality scope, positive case count, zero failed cases, exact per-case expected/actual matches, and an accepted quality decision.

The Rust mini browser harness runs before heavy browser automation. Static mode checks the checked-in app tree, required local UI, manifest sidecars, selected model routes, WASM call markers, and local-only policy. Optional HTTP mode probes the Rust local server over loopback for app, CSS, JS, WASM, q8 model, and q8 manifest routes. Headless browser smoke still owns actual JavaScript execution, WASM loading, generation, transcript rendering, and UI interaction proof.

## Future Expansion Path

Milestones continue from verified tiny fixtures, TinyLM-16M f32/q8_0/q4_0 smoke models, raw-f32 trained-source conversion, structural `BPE1` tokenizer support, and fixture-scoped eval execution into real trained weights, larger reviewed BPE tables, broader evaluation fixtures, and product-quality evidence review. TinyLM-64M and TinyLM-135M stay out of scope until the 16M path is correct.
