# Browser Converted Trained Eval Evidence Memory - 2026-06-30

## Route

Use this report when work touches selector-carried converted-trained eval routes, browser pre-model evidence verification, converted-trained browser smoke modes, or case-ledger checksum binding.

## Implementation

Converted-trained browser bundle admissions now append `eval_path=../evidence/<candidate-id>/converted-trained.eval` after native eval passes. `selector.registry` preserves that route as `entry.N.eval_path` when it is scoped to the same candidate evidence folder.

The browser selector parser accepts the eval route together with `eval_manifest_checksum` and `eval_case_evidence_checksum`. For converted-trained entries that also carry a reviewed source-manifest route, `app.js` fetches `converted-trained.source.manifest`, then fetches `converted-trained.eval`, verifies the sidecar text checksum, verifies pass-status and case totals, recomputes the eval-case evidence checksum from the fetched per-case ledger rows, and only then requests converted `.slm` bytes.

`browser-smoke.js` now serves a compact converted-trained eval sidecar for `converted-trained-registry`, asserts real file-backed q4/q8/f32 converted-trained roots request eval evidence before model bytes, and adds `converted-trained-eval-evidence-drift` to prove changed eval evidence stops before the selected q8 model bytes.

## Source Files

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`: appends converted-trained eval routes to generated admissions and tests q8/all selector registry eval route/checksum fields.
- `tinyrustlm/tools/slm_pack/src/selector.rs`: preserves optional candidate-scoped `eval_path` fields in selector registries and rejects route drift.
- `tinyrustlm/app/app.js`: verifies converted-trained eval sidecar text and recomputes eval-case evidence checksums before converted model bytes.
- `tinyrustlm/tools/browser-smoke.js`: serves compact eval evidence, asserts eval route ordering, and adds the eval-evidence drift smoke.
- `tinyrustlm/README.md`: documents eval evidence route verification and the new browser-smoke command.
- `tinyrustlm/docs/testing.md`: routes the eval-evidence drift smoke after converted-trained eval route changes.

## Verification

- `cargo test -p tinyrustlm-slm-pack selector --quiet`: 101 tests passed.
- `cargo test -p tinyrustlm-slm-pack browser_bundle --quiet`: 14 tests passed.
- Generated `target/browser-converted-trained-eval-evidence/tinyrustlm` with `browser-converted-trained-bundle ... all`.
- Served the root on `http://127.0.0.1:8097/app/`.
- `converted-trained-registry-file` passed for `converted-trained-q4`, `converted-trained-q8`, and `converted-trained-f32`, with eval evidence requested before selected model bytes.
- `converted-trained-eval-evidence-drift` passed for `converted-trained-q8`, stopping before q8 model bytes.
- `cargo test -p tinyrustlm-slm-pack --quiet`: 361 tests passed.
- `cargo test --workspace --quiet`: passed across all workspace crates.
- `cargo fmt --all -- --check`: passed.
- `node --check tinyrustlm/app/app.js`: passed.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed.
- `git diff --check`: passed with line-ending notices only.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter-related coverage is carried by selector tests for candidate id plus eval path scoping, browser-bundle tests for output root, source directory, quantization selector, eval cases, q8/all route generation, and browser smokes for q4/q8/f32 route selection plus eval-evidence drift.

## Next Useful Work

Run a real tiny safetensors checkpoint through `browser-safetensors-trained-bundle ... [eval-cases.txt]`, serve the generated root, and prove source manifest, eval sidecar, selector admission, and converted model bytes all bind to the same checkpoint route.
