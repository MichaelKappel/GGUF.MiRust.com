# Browser Converted Trained Source Evidence Memory - 2026-06-30

## Route

Use this report when work touches `browser-converted-trained-bundle`, `browser-safetensors-trained-bundle`, converted-trained browser evidence directories, source-manifest snapshots, selector source-manifest/source-review route fields, or reviewable browser roots made from trained-source input.

## Implementation

Each converted-trained browser bundle entry now copies the reviewed `source.manifest` into its generated evidence lane as `evidence/<candidate-id>/converted-trained.source.manifest` after source conversion succeeds.

The generated admission now carries `source_manifest_path`, `source_manifest_checksum`, `source_manifest_kind=trained-source-manifest`, and `source_manifest_status=reviewed-source-snapshot`. When the copied source manifest includes a safetensors candidate review, the same admission also carries `source_review_kind=safetensors-candidate-review`, `source_review_status=validated-before-extraction`, `source_review_checksum`, and `source_review_required_next_gate=extract-raw-f32-tensors`.

`selector.registry` copies the source-manifest and optional source-review fields into the matching entry only when the route is `../evidence/<candidate-id>/converted-trained.source.manifest`, validates checksum/kind/status drift against the admission source route, and binds review checksum into the heritable artifact identity when present.

The browser selector intake accepts those optional fields, then fetches and checksum-verifies the reviewed source manifest before requesting the converted `.slm` bytes. It also verifies that fetched `source_review_*` fields match the selector-carried review identity, and rejects a selector that omits review fields while the fetched source manifest has them. `converted-trained-source-manifest-drift` proves a changed source manifest body stops q8 loading at `source manifest checksum mismatch`, `converted-trained-source-review-drift` proves checksum-matched review-field drift stops at `source review identity field source_review_checksum`, and `converted-trained-source-review-omitted` proves selector omission stops at `source review identity missing from selector`, all before q8 model bytes are requested.

The snapshot is written for single-quant and all-quant browser roots, including safetensors-generated roots. It preserves the reviewed source identity next to the compatibility, lineage, candidate, promotion, runtime, eval, and admission sidecars while making the browser verify the source breadcrumb before model use.

## Source Files

- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs`: copies `source.manifest` into each converted-trained browser evidence lane, appends source-manifest plus optional source-review route fields to generated admissions, and tests q8_0 plus all-quant registry fields/checksums.
- `tinyrustlm/tools/slm_pack/src/selector.rs`: validates optional source-manifest and source-review route fields and rejects route/checksum drift.
- `tinyrustlm/app/app.js`: fetches and checksum-verifies selector-carried source manifests, then verifies selector-carried source review identity before converted `.slm` bytes.
- `tinyrustlm/tools/browser-smoke.js`: asserts normal converted-trained file roots request source manifests before model bytes and adds `converted-trained-source-manifest-drift`, `converted-trained-source-review-drift`, and `converted-trained-source-review-omitted`.
- `tinyrustlm/tools/slm_pack/src/safetensors.rs`: tests safetensors-generated browser roots for copied source snapshots carrying `source_id=safetensors-tensor-directory-0x`.
- `tinyrustlm/README.md`: documents converted-trained and safetensors browser bundle source-manifest snapshots.
- `tinyrustlm/docs/testing.md`: routes safetensors browser bundle snapshot coverage.

## Verification

- `node --check tinyrustlm/app/app.js`: passed.
- `node --check tinyrustlm/tools/browser-smoke.js`: passed.
- `cargo test -p tinyrustlm-slm-pack selector --quiet`: 104 focused selector tests passed.
- `cargo test -p tinyrustlm-slm-pack browser_bundle --quiet`: 16 focused browser-bundle tests passed.
- `cargo test -p tinyrustlm-slm-pack --quiet`: 376 tests passed.
- `cargo test --workspace --quiet`: passed all workspace tests.
- `cargo run -p tinyrustlm-browser-harness --quiet -- tinyrustlm`: passed 9 static browser checks.
- `cargo fmt --all -- --check`: passed.
- Generated `target/browser-converted-trained-source-route/tinyrustlm` from `browser-converted-trained-bundle ... all`.
- Served that root on `http://127.0.0.1:18790/app/`; `converted-trained-registry-file` passed for `converted-trained-q4`, `converted-trained-q8`, and `converted-trained-f32`, with source-manifest requests before selected model bytes.
- `converted-trained-source-manifest-drift` passed for `converted-trained-q8`, proving source manifest checksum drift stops before q8 model bytes.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8187/app/ 9387 converted-trained-q8 converted-trained-registry`: passed and rendered Source Review `validated-before-extraction / extract-raw-f32-tensors / 0x00000000000000b1`.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8187/app/ 9388 converted-trained-q8 converted-trained-source-review-drift`: passed and stopped before model bytes at source-review checksum mismatch.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8187/app/ 9389 converted-trained-q8 converted-trained-source-review-omitted`: passed and stopped before model bytes at selector source-review omission.

## Coverage Notes

No coverage binary is active in the no-third-party workspace. Parameter-related coverage is carried by selector tests for source-manifest route path/checksum/kind/status and source-review kind/status/checksum/next-gate, converted-trained bundle tests for source directory, output root, q8_0 selector, all selector, safetensors bridge tests for input safetensors path, target source shape, output source directory, output root, q8_0 selector, all selector, and browser smokes for source-review checksum drift and selector omission before model bytes.

## Next Useful Work

Fold converted-trained source-manifest routes into full generated module-plan receipts when converted-trained roots gain module-plan self-assembly, so the route-set checksum accounts for the source breadcrumb alongside model, manifest, assembly, and adapter routes.
