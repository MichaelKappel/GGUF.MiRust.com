---
title: Adapter Family Receipt Memory
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/reports/adapter-family-receipt-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:10:00Z
---

# Adapter Family Receipt Memory

## Summary

TinyRustLM now gives compatible `ADP1` adapter families a recomputable receipt and served manifest checks that the browser completes before family options are enabled. `browser-multi-parent-bundle` writes a runnable TinyRustLM root with app shell, WASM runtime, `multi-parent-sign-merge-f32.adapter-family.receipt`, generated self and family adapter manifests, and selector metadata; the packer validates that both sidecars share the same adapter identity, including base quantization, and records a receipt path plus checksum in `selector.registry`. `app.js` fetches the served receipt, recomputes its text checksum, fetches each served adapter manifest, matches each member route, manifest route, label, apply status, artifact checksum, manifest checksum, manifest byte count, and shared identity field before showing the family sidecars, then recomputes the selected ADP1 artifact checksum before WASM transfer.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/adapter_family.rs` builds and validates `browser-local-adp1-family` receipts from registry adapter routes plus adapter manifest files.
- The receipt requires two to sixteen members, local `../models/*.adp1` routes, matching manifest checksums, f32 runtime apply status, and shared tensor count, parameter count, model shape, output contract, tokenizer checksum, tensor layout checksum, and adapter base contract.
- `tinyrustlm/tools/slm_pack/src/selector.rs` now accepts optional `entry.N.adapter_family_*` fields for a f32 selector entry and validates receipt route, receipt checksum shape, family status, strategy, and adapter count against the indexed ADP1 routes.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes a runnable browser root by copying the app shell and WASM runtime, writes the served `.adapter-family.receipt`, validates it, then emits one selector-family route alongside the two indexed ADP1 sidecars.
- `tinyrustlm/app/app.js` route-checks the receipt metadata from `selector.registry`, fetches and checksum-verifies the served receipt, fetches and verifies each served adapter manifest, matches family members against the registry routes, recomputes the selected ADP1 artifact checksum before transfer, and still leaves ADP1 byte parsing and mutation authority inside Rust.
- `tinyrustlm/tools/browser-smoke.js` requires the generated browser smoke network trace to include `/models/multi-parent-sign-merge-f32.adapter-family.receipt` plus both generated `.adp1.manifest` routes before the registry-supplied family sidecar can pass, and the applied sidecar must match the artifact checksum embedded in the verified metadata.

## Validation Memory

- `cargo fmt --all -- --check` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo test -p tinyrustlm-slm-pack adapter_family` passed with 5 filtered tests.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 19 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed.
- `cargo test -p tinyrustlm-slm-pack` passed with 141 tests.
- `cargo test --workspace` passed with 219 tests.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18640/app/ 9241 tinyf32 adapter-sidecar` passed, applying the checked tiny f32 sidecar after artifact checksum verification.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9240 tinyq8 adapter-sidecar` passed after static q8_0 sidecar routing was added.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8091/app/ 9241 tinyq4 adapter-sidecar` passed after static q4_0 sidecar routing was added.
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:18640/app/ 9242 tinyf32 adapter-sidecar-checksum-mismatch` passed, proving a corrupted sidecar is rejected before `apply_adapter_delta` and prior generation diagnostics remain intact.
- A self-contained generated-root `adapter-sidecar-registry-file` browser smoke passed against `http://127.0.0.1:18642/app/`, loading the real generated selector registry from a packer-written app root, fetching `multi-parent-sign-merge-f32.adapter-family.receipt`, fetching both generated `.adp1.manifest` files, and applying `multi-parent-sign-merge-f32-family.adp1`.
- A focused `adapter-sidecar-registry-q8` browser smoke passed against `http://127.0.0.1:8092/app/`, proving the browser accepts registry metadata for a q8_0 ADP1 route whose apply status matches the selected entry quantization.

## Routing Notes

Use this report before changing `adapter_family.rs`, selector registry `entry.N.adapter_family_*` fields, generated browser bundle ADP1 staging, browser registry receipt parsing, browser adapter manifest parsing, or browser adapter artifact checksum verification. The receipt and served manifests are selector assembly proof for compatible f32/q8_0/q4_0 sidecar choices, the selected artifact checksum must match before WASM transfer, and Rust runtime validation still owns ADP1 package identity and tensor mutation.
