---
title: Registry Adapter Sidecar Memory
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/reports/registry-adapter-sidecar-memory-2026-06-27/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:10:00Z
---

# Registry Adapter Sidecar Memory

## Summary

TinyRustLM now proves selector registries can carry admitted local `.slm` model routes plus compatible local f32, q8_0, or q4_0 `ADP1` adapter sidecar routes when the adapter apply status matches the entry quantization. `browser-multi-parent-bundle` still stages the generated f32 sign-merge family, and the browser smoke harness now also serves an intercepted tiny q8_0 registry entry with a matching ADP1 route. In both paths, the browser loads the model from the registry, shows the registry-supplied adapter option, checks the selected `.adp1` artifact checksum, transfers the local bytes into WASM, and Rust validates the package before applying it.

## Implementation Memory

- `tinyrustlm/tools/slm_pack/src/selector.rs` now has optional `RegistryAdapterRoute` fields for f32/q8_0/q4_0 registry entries: adapter path, adapter manifest path, label, apply status, adapter checksum, and manifest checksum.
- Selector validation still recomputes the admitted model route fields from admission records, then validates optional adapter route fields structurally and requires apply status to match entry quantization.
- `tinyrustlm/tools/slm_pack/src/browser_bundle.rs` now builds a self-adapter from the generated f32 sign-merge candidate to itself through the existing compatibility, lineage, adapter-delta, and validate-adapter-delta gates.
- `tools/browser-smoke.js` now has `adapter-sidecar-registry-file` mode, which reuses the adapter-sidecar click path against a generated file-backed registry, plus `adapter-sidecar-registry-q8` for a quantized registry-supplied adapter route.
- `tools/vs/Test-TinyRustLM.ps1 -BrowserSmoke` now runs the generated registry model smoke and the generated registry adapter smoke against the same staged bundle server.

## Validation Memory

- `cargo fmt --all -- --check` passed.
- `node --check tinyrustlm/tools/browser-smoke.js` passed.
- PowerShell parsing of `tools/vs/Test-TinyRustLM.ps1` passed.
- `cargo test -p tinyrustlm-slm-pack selector::` passed with 17 tests.
- `cargo test -p tinyrustlm-slm-pack adapter_family::` passed with 3 tests.
- `cargo test -p tinyrustlm-slm-pack` passed with 147 tests.
- `cargo run -p tinyrustlm-browser-harness -- tinyrustlm` passed with 8 checks.
- `node tinyrustlm/tools/wasm-abi-smoke.js` passed.
- A generated browser bundle served over the Rust local server passed `multi-parent-registry-file`.
- The same generated bundle passed `adapter-sidecar-registry-file`, including the local `multi-parent-sign-merge-f32-self.adp1` request and post-apply f32 diagnostic reset.
- The intercepted q8_0 registry route passed `adapter-sidecar-registry-q8`, including the `models/selector.registry` request, `tiny-test-model-q8-self.adp1` request, `adapter applied` response, and q8_0 diagnostic reset.
- The checked tiny f32/q8_0/q4_0 fallback routes pass `adapter-sidecar`.

## Routing Notes

Use this report before changing selector registry fields, generated browser bundle staging, registry-supplied adapter UI behavior, or file-backed browser smoke coverage. This report does not replace the runtime adapter apply report or the checked browser adapter sidecar report; it links those two beads into the selector registry route.

Future adapter work can extend this bead toward LoRA-style packages, compact adapter variants, file-backed q8_0/q4_0 generated bundles, or compact adapter-family metadata. Those future formats still need explicit package manifests, runtime validation, browser route filtering, and smoke evidence before they become browser-visible options.
