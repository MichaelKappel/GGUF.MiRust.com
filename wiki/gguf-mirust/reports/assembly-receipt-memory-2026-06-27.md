---
title: Assembly Receipt Memory
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/reports/assembly-receipt-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T12:05:00Z
---

# Assembly Receipt Memory

## Summary

TinyRustLM now gives generated browser-served multi-parent bundles a compact assembly receipt that the browser can verify and display. `browser-multi-parent-bundle` writes `multi-parent-sign-merge-f32.assembly.receipt` next to the generated `.slm`, records the receipt path, checksum, label, status, and kind in `selector.registry`, and validates that registry before the bundle is complete.

The receipt binds the generated model to its model manifest, population ledger, population review, parent-pool recipe, sign-merge operator receipt, multi-parent candidate manifest, promotion template, runtime-smoke sidecar, eval manifest, selector admission record, and adapter-family receipt by local routes and text checksums. The browser fetches the receipt only after the selected model is accepted and its local `.slm.manifest` is loaded, recomputes the receipt checksum, matches the selected model path and manifest path, matches the model checksum, fetches the nine local evidence files named by the receipt, recomputes each evidence text checksum, and renders the assembly kind, parent count, operator checksum, ledger checksum, and next gate.

## Implementation Notes

- `tinyrustlm/tools/slm_pack/src/selector.rs` now supports optional `entry.N.assembly_receipt_path`, `entry.N.assembly_receipt_checksum`, `entry.N.assembly_label`, `entry.N.assembly_status`, and `entry.N.assembly_kind` fields.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` writes the assembly receipt into generated bundle roots and adds one selector assembly route for `multi-parent-sign-merge-f32`.
- `tinyrustlm/app/index.html` adds an Assembly Evidence panel.
- `tinyrustlm/app/app.js` route-checks assembly receipt metadata, fetches the served receipt, recomputes its text checksum, validates the selected model and manifest linkage, fetches each local evidence file named by the receipt, verifies each evidence checksum, and renders receipt fields without parsing model or adapter bytes.
- `tinyrustlm/tools/browser-smoke.js` requires the generated-root `adapter-sidecar-registry-file` trace to include `/models/multi-parent-sign-merge-f32.assembly.receipt` plus the nine `/evidence/multi-parent-sign-merge-f32/*` evidence routes, and checks rendered receipt fields before the sidecar smoke can pass.
- `tinyrustlm/tools/browser_harness/src/main.rs` includes the Assembly Evidence panel in the static browser contract.

## Verification

- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo fmt --all -- --check` passed.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 20 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 8 checks.
- `cargo test -p tinyrustlm-slm-pack` passed with 142 tests.
- `cargo test --workspace` passed with 220 tests.
- A generated-root `adapter-sidecar-registry-file` browser smoke passed against `http://127.0.0.1:18644/app/`, loading the real generated selector registry, fetching the assembly receipt, fetching all nine referenced evidence files, rendering parent count 3 plus operator and ledger checksums, fetching the adapter-family receipt and both adapter manifests, and applying `multi-parent-sign-merge-f32-family.adp1`.

## Routing

Use this report before changing selector registry assembly fields, generated browser bundle evidence staging, browser assembly receipt parsing, Assembly Evidence UI, or generated-root adapter-sidecar smoke expectations. The assembly receipt is a browser-visible proof route for the multi-parent evidence chain; Rust tooling still owns artifact generation and validation, while the browser verifies served receipt integrity, fetches the referenced evidence files, verifies their checksums, and displays the route result.
