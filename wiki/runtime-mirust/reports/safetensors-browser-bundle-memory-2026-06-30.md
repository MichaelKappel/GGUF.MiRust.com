# Safetensors Browser Bundle Memory - 2026-06-30

## Route

Use this report when work touches `browser-safetensors-trained-bundle`, direct safetensors-to-browser selector roots, preserved raw source directories for browser bundles, converted-trained all-quant roots from safetensors, or first real checkpoint browser intake.
The 2026-06-30 continuation also covers browser smoke acceptance for safetensors-derived `trained-export` source identities.
The latest continuation covers candidate-review-bound bundle admission, where the browser bundle route consumes the same review artifact used by extraction and conversion, carries its checksum into source/admission/selector evidence, and exposes verified Source Review provenance in the browser.

## Implementation

`tinyrustlm-slm-pack browser-safetensors-trained-bundle <output-tinyrustlm-root> <input.safetensors> <source-shape> <output-source-dir> [f32|q8_0|q4_0|all] [eval-cases.txt] [candidate-review]` now bridges local safetensors checkpoints into a runnable TinyRustLM root.

The command validates the browser bundle quantization selector before writing output, optionally verifies that the supplied candidate review still matches the safetensors source plan, requires the requested bundle quantization to match `browser_admission_preferred_quantization` or use `all`, extracts the safetensors payload into the reviewed raw f32 trained-source layout, validates that preserved source directory, then reuses `browser-converted-trained-bundle` internals to stage `models/selector.registry`, converted `.slm` files, `.slm.manifest` files, runtime/eval/admission evidence, per-entry `converted-trained.source.manifest` snapshots, runtime WASM manifest, and the app shell.

When a candidate review is supplied, the preserved raw `source.manifest` records `source_review_kind`, `source_review_status`, `source_review_checksum`, and `source_review_required_next_gate`. The converted-trained browser bundle copies those fields into admission and selector registry evidence, and the browser verifies them against the fetched source manifest before requesting the selected `.slm`.

The bridge accepts TinyRustLM local tensor names and Hugging Face Llama aliases through the same safetensors source planner used by `convert-safetensors-trained`. The preserved `output-source-dir` remains the durable source evidence between checkpoint bytes and browser-loaded modules.

## Source Files

- `tinyrustlm/tools/slm_pack/src/main.rs`: `browser-safetensors-trained-bundle` CLI dispatch and usage text.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs`: browser bundle bridge, candidate-review validation, and focused safetensors browser-bundle tests.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`: shared converted-trained bundle quantization validator, source manifest snapshot staging, and existing browser selector-root writer.
- `tinyrustlm/tools/browser-smoke.js`: converted-trained registry-file smoke now accepts both fixture source snapshots and safetensors-exported source identities, renders Source Review when present, and adds `converted-trained-source-review-drift` plus `converted-trained-source-review-omitted`.
- `tinyrustlm/README.md`: command example and bridge documentation.
- `tinyrustlm/docs/testing.md`: safetensors browser-bundle acceptance route.

## Verification

- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`: 35 focused safetensors tests passed after the review-bound extraction/conversion/browser bundle gate landed.
- `cargo test -p tinyrustlm-slm-pack browser_bundle --quiet`: 16 focused browser-bundle tests passed.
- `cargo test -p tinyrustlm-slm-pack trained_source --quiet`: 20 focused trained-source tests passed.
- `cargo test -p tinyrustlm-slm-pack --quiet`: 376 tests passed.
- `cargo test --workspace --quiet`: passed all workspace tests.
- `cargo fmt --all -- --check`: passed.
- `node --check tinyrustlm/app/app.js`: passed.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed.
- `cargo run -p tinyrustlm-browser-harness --quiet -- tinyrustlm`: passed 9 static browser checks.
- Targeted `git diff --check` for touched tracked files passed with CRLF warnings only; full `git diff --check` remains blocked by unrelated pre-existing trailing whitespace in `.uai/startup-packet.uai`.
- Browser smoke served the generated all-quant safetensors root from `tinyrustlm-safetensors-browser-bundle-hf-all-*` on `http://127.0.0.1:18761/app/` and ran `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18761/app/ 9328 converted-trained-q4 converted-trained-registry-file`. The browser loaded `converted-trained-q4`, reported `active_quantization_mode=q4_0`, rendered `provenanceSourceSnapshot=trained-export`, `provenanceSourceId=safetensors-tensor-directory-0x0d5a55ae71c5de5d`, and requested `converted-trained.source.manifest` plus `converted-trained.eval` before `converted-trained-q4.slm`.
- Compact browser smoke on `http://127.0.0.1:8187/app/` passed `converted-trained-registry`, rendering Source Review `validated-before-extraction / extract-raw-f32-tensors / 0x00000000000000b1`, passed `converted-trained-source-review-drift`, stopping before converted q8 bytes on review checksum mismatch, and passed `converted-trained-source-review-omitted`, stopping before q8 bytes when selector review fields were absent.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter coverage is carried by focused tests for output root, input safetensors path, target source shape, output source directory, q8_0 browser bundle generation, all-quant browser bundle generation, Hugging Face alias tensor names, source validation, selector registry fields, `.slm` validation, `.slm.manifest` validation, source manifest snapshot staging, runtime WASM manifest staging, candidate-review bundle admission, source-review checksum carry-forward, invalid browser bundle quantization before extraction, browser quantization preference drift before extraction, selector source-review drift, browser source-review drift and omission, and browser smoke acceptance of safetensors-exported source identity.

## Next Useful Work

The next source-intake bead is a reviewed real tiny safetensors checkpoint run through this command with the candidate-review path supplied, plus tokenizer conversion work for non-fixture tokenizer inputs.
