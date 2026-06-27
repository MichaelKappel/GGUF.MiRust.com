---
title: Registry Adapter Family Memory
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/reports/registry-adapter-family-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T08:55:00Z
---

# Registry Adapter Family Memory

## Summary

TinyRustLM now proves a generated selector registry can expose a small family of compatible local f32 `ADP1` sidecars for one admitted f32 model entry. The registry keeps the earlier single-adapter fields for the first route, then adds indexed adapter-family fields when more than one route exists. The browser parses the indexed family, displays both generated options, selects the second route during `adapter-sidecar-registry-file`, fetches `multi-parent-sign-merge-f32-family.adp1` from the same local origin, transfers bytes into WASM, and leaves `ADP1` validation to Rust.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` stores zero or more `RegistryAdapterRoute` values per entry, rejects duplicate adapter paths for the same candidate, and still requires adapter routes to attach only to f32 registry entries.
- Single-adapter registries keep the existing `entry.N.adapter_path`, manifest, label, apply status, and checksum fields.
- Multi-adapter registries add `entry.N.adapter_count` plus indexed fields such as `entry.N.adapter.1.path`, `manifest_path`, `label`, `apply_status`, `artifact_checksum`, and `manifest_checksum`.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now stages both `multi-parent-sign-merge-f32-self.adp1` and `multi-parent-sign-merge-f32-family.adp1` through the same compatibility, lineage, adapter-delta, and validation gates.
- `tinyrustlm/app/app.js` parses either the legacy single-sidecar fields or indexed adapter-family fields, keeps routes local to `../models/*.adp1`, and does not parse adapter bytes.
- `tinyrustlm/tools/browser-smoke.js` now expects both generated adapter options and applies the second family route during `adapter-sidecar-registry-file`.

## Validation Memory

- `cargo fmt --all` passed.
- `node --check tinyrustlm/app/app.js` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- `cargo test -p tinyrustlm-slm-pack selector` passed with 17 tests.
- `cargo test -p tinyrustlm-slm-pack browser_bundle` passed.
- A generated browser bundle served over the Rust local server passed `adapter-sidecar-registry-file`, showing both generated adapter options and applying `multi-parent-sign-merge-f32-family.adp1`.

## Routing Notes

Use this report before changing selector registry adapter-family fields, generated bundle adapter staging, browser registry adapter parsing, or `adapter-sidecar-registry-file` assertions. This report extends the registry adapter sidecar memory from one route to a small typed family; runtime `ADP1` package validation and browser byte-transfer boundaries remain owned by the earlier runtime and browser adapter reports.
