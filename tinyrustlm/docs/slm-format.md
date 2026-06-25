# SLM Format

## Purpose

`.slm` is the local model file format for TinyRustLM. It is designed for simple browser loading and strict Rust-side validation.

## Constraints

The format is little-endian, self-describing, versioned, non-JSON, and static. It has no dynamic schema language and no dependency on GGUF, ONNX, safetensors, or external tokenization formats.

## Data Structures

The v1 header stores model dimensions, tokenizer offsets, tensor directory offsets, tensor count, tensor data offset, and checksum. The checksum is a simple custom u64 over the complete file with the checksum field itself treated as zero, so the packer can write it after all payload bytes are finalized. Tensor directory entries store name hash, dtype, rank, dimensions, data offset, byte length, quant scale offset, and block size. q8_0 uses one f32 scale per row. q4_0 uses f32 scales per row block. The tokenizer section is now validated as either `BTOK` byte-tokenizer metadata or `BPE1` custom BPE metadata.

## Binary Formats

Header fields start with four bytes `SLM1`, followed by u32/u64/f32 fields in little-endian order. Tensor directory entries are 64 bytes. Tensor payloads and quantization scale payloads are aligned to 64-byte offsets.

`BTOK` tokenizer sections contain magic, version, fixed vocab size, and special token ids. `BPE1` tokenizer sections contain magic, version, vocab size, special token ids, token count, merge count, variable token records, and merge records. BPE token records store `token_id`, byte length, and raw bytes. BPE merge records store `left`, `right`, `output`, and `rank`.

## Failure Cases

Invalid magic, short files, unsupported versions, zero checksum, checksum mismatch, zero dimensions, attention shape mismatch, out-of-range offsets, malformed tokenizer sections, malformed tensor directory entries, unsupported dtype, missing scale payloads, invalid q4 block sizes, missing required tensors, and an omitted `output.weight` without the v1 tied-output flag are fatal loader errors.

## Validation Rules

The parser validates the file has enough bytes before every read. Header length must be at least the v1 minimum. Tensor data offset must be 64-byte aligned. A v1 file must carry a nonzero checksum, and the parser recomputes the checksum with bytes 100..108 treated as zero before accepting the header. Each tensor payload range must fit inside the file. The model loader validates dtype-specific byte lengths and scale counts before decoding tensors. The v1 tied-output flag is `flags & 1 != 0`; when set, `output.weight` may be omitted and output projection uses `tok_embeddings.weight`. Without that flag, `output.weight` remains required.

The native packer also exposes `tinyrustlm-slm-pack validate <input.slm>` as an admission gate for generated or future converted models. That command verifies checksum, byte-tokenizer or BPE metadata, required tensor names and shapes, dtype-specific payload lengths, quantization scale ranges, finite f32 payload values, duplicate tensor hashes, and reports the accepted shape, tensor count, parameter count, quantization mode, and checksum.

The packer also exposes a line-based provenance sidecar: `tinyrustlm-slm-pack manifest <input.slm> <output.manifest> [source_kind]` and `tinyrustlm-slm-pack validate-manifest <input.slm> <input.manifest>`. The sidecar is outside the v1 binary file so the runtime format stays stable. It binds model bytes, `.slm` checksum, shape, tensor count, parameter count, quantization mode, source kind, admission status, and quality boundary. Deterministic smoke models must not claim trained quality; converted trained models validate only as structure-accepted and quality-pending.

Trained source conversion is intentionally outside the browser runtime. `tinyrustlm-slm-pack source-template <output-source-dir> [tiny-fixture|tiny-fixture-tied|tinylm16|tinylm16-tied]` writes a reviewable source-weight directory with `source.manifest` and raw little-endian f32 tensor files under `tensors/`. `validate-source <input-source-dir>` checks the source before conversion. `convert-trained <input-source-dir> <output.slm> [f32|q8_0|q4_0]` reads validated f32 tensors, writes a checksum-bearing `.slm`, validates it, and writes a converted-trained provenance sidecar.

The source manifest is line-based, not JSON. It declares `tinyrustlm_trained_source_version=1`, `layout=raw-f32-tensor-files-v1`, `tied_output=true|false`, shape fields, tokenizer, source dtype, source kind, source evidence fields, tensor count, and one record per required tensor. Existing manifests without `tied_output` are accepted as `false` for backward compatibility. Tied source manifests must use a tied shape name, must omit `output.weight`, and must produce a v1 `.slm` file with the tied-output flag set. Each tensor record must name the expected tensor, rank, dimensions, safe relative file path, exact byte count, and source checksum. Source paths must stay under `tensors/`; absolute paths and parent traversal are rejected.

Source-weight constraints are deliberately strict. The first conversion layout accepts raw f32 source tensors only, then performs q8_0 or q4_0 quantization itself when requested. Every source tensor must have the exact byte length implied by shape, finite f32 values, absolute values no larger than 64.0, a nonzero payload, and a matching source checksum. The validator also rejects `model_shape` and `tied_output` disagreement so source manifests cannot silently drift between tied and untied output layouts. These checks catch broken endian exports, missing files, path confusion, placeholder tensors, accidental prequantized input, and output-head layout drift before a converted model can receive a `.slm.manifest`.

Quality admission is a separate gate. `tinyrustlm-slm-pack quality-gate <input.slm> <input.manifest> runtime-smoke` permits deterministic smoke or converted-trained artifacts only for runtime-execution evidence. `tinyrustlm-slm-pack eval-template <input.slm> <input.manifest> <output.eval> assistant-quality` writes a pending line-based evaluation sidecar bound to the exact model checksum, model shape, source kind, and manifest checksum. `cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- <input.slm> <input.manifest> <cases.txt> <output.eval>` executes exact local cases through the Rust runtime and writes a scoped eval sidecar. Eval case files must declare at least one nonempty exact case and cannot carry stray case keys outside the declared count. `tinyrustlm-slm-pack quality-gate <input.slm> <input.manifest> assistant-quality <input.eval>` requires `source_kind=converted-trained`, matching checksums, `eval_status=pass`, `task_eval_status=pass`, `safety_review_status=pass`, `quality_decision=accepted-for-assistant-quality`, non-placeholder `quality_scope`, evaluator, dataset, summary, quality boundary, positive case count, all cases passed, zero failed cases, and exact per-case expected/actual matches. Pending templates, missing case evidence, mismatched case text, and deterministic smoke manifests fail the assistant-quality gate.

## Future Expansion Path

The first format path supports f32, q8_0, and q4_0 tiny byte-tokenizer fixtures, a tiny f32 BPE fixture with a checked runtime merge proof, a tied-output tiny fixture that omits `output.weight`, and real-shaped TinyLM-16M f32, q8_0, and q4_0 models. The first trained-source conversion path is raw f32 by design so quantization stays local and reviewable, and it now supports tied raw source bundles that omit `output.weight` while setting the v1 tied-output flag during conversion. Current `BPE1` support gives trained models a custom tokenizer table and merge table without external formats. Later versions can add richer trained conversion metadata, embedded provenance sections, stronger checksums, and paging metadata without changing the v1 parser contract.
