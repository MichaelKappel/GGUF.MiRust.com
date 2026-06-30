# Browser Converted Trained Runtime Eval Memory - 2026-06-30

## Route

Use this report when work touches `browser-converted-trained-bundle`, `browser-safetensors-trained-bundle`, converted-trained eval sidecars, selector admission timing, assistant-quality gates, or real-checkpoint browser bundle intake.

## Implementation

Converted-trained browser bundle generation now executes the candidate through the native Rust eval runner before writing selector admission evidence. The default route uses `tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt`, and both converted-trained and safetensors browser bundle commands accept an optional trailing eval-cases path for reviewed real-checkpoint case sets.

Each bundle entry writes `converted-trained.eval` from `eval_runner::run_eval_to_sidecar`, then runs the existing quality gate and admission record only when the eval sidecar passes. A failing eval leaves the eval sidecar for review and stops before `converted-trained.admission`.

`browser-safetensors-trained-bundle` passes the optional eval-cases path through the safetensors bridge into the shared converted-trained bundle writer, so local safetensors checkpoints and raw trained-source directories share the same admission evidence boundary.

Positive safetensors browser-bundle tests now generate fixture-equivalent safetensors payloads from the trained-source template so the runtime eval proof is tied to actual converted bytes instead of synthetic sidecar text.

## Source Files

- `tinyrustlm/tools/slm_pack/Cargo.toml`: adds the internal `tinyrustlm-runtime` dependency for native eval execution.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`: runs `eval_runner::run_eval_to_sidecar`, accepts explicit eval-cases paths, and tests passed plus failed eval admission paths.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs`: routes optional eval cases through safetensors browser bundle generation and builds fixture-equivalent safetensors payloads for runtime eval tests.
- `tinyrustlm/tools/slm_pack/src/main.rs`: exposes optional `[eval-cases.txt]` arguments for converted-trained and safetensors browser bundle commands.
- `tinyrustlm/README.md`: documents runtime-executed eval before selector admission and updated command examples.
- `tinyrustlm/docs/slm-format.md`: records the shared native eval runner path for browser converted-trained bundles.
- `tinyrustlm/docs/testing.md`: records coverage expectations for passed eval evidence and failed eval admission stops.

## Verification

- `cargo fmt --all`: passed.
- `cargo test -p tinyrustlm-slm-pack browser_bundle --quiet`: 14 tests passed.
- `cargo test -p tinyrustlm-slm-pack safetensors --quiet`: 24 tests passed.
- `cargo test -p tinyrustlm-runtime eval_runner --quiet`: 4 tests passed.
- `cargo test -p tinyrustlm-slm-pack --quiet`: 360 tests passed.
- `cargo test --workspace --quiet`: passed across all workspace crates.
- `cargo fmt --all -- --check`: passed.
- `node --check tinyrustlm/app/app.js`: passed.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter-related coverage is carried by tests for output root, source directory, quantization selector, default eval-cases path, explicit eval-cases path, safetensors input path, target source shape, output source directory, q8_0 browser bundle generation, all-quant browser bundle generation, pass case totals, failed per-case actual text, and absent admission after failed eval.

## Next Useful Work

Run a real tiny safetensors checkpoint through `browser-safetensors-trained-bundle ... [eval-cases.txt]`, serve the generated root, and add a browser smoke that proves selector admission, eval case evidence, source manifest evidence, and converted model bytes all line up from the same checkpoint.
