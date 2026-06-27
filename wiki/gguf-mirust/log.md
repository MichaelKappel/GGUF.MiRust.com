---
title: GGUF.MiRust.com LLM Wiki Log
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/log/
status: planned_pending_publication
reviewed_utc: 2026-06-27T16:36:46Z
---

# LLM Wiki Log

## 2026-06-24

- Created the GGUF.MiRust.com Rust workspace skeleton.
- Configured UAIX Project Handoff with File Handoff plus LLM Wiki memory.
- Routed durable memory to AIWikis.org under `/gguf-mirust/`.
- Recorded dogfood feedback for UAIX and LLMWikis setup guidance.

## 2026-06-26

- Processed 26 active Improvement reports into raw evidence under `raw/gguf-mirust/report-intake-2026-06-26/`.
- Added model-breeding durable memory, reference ideas, and report intake routing.
- Added `.uai/taboo.uai` to route GGUF.MiRust.com public copy toward constructive local-model craft and lineage.

## 2026-06-27

- Added browser selector byte-budget intake so registry entries must declare bounded `entry.N.model_bytes`, fetched registry models must match declared bytes before WASM transfer, and oversized registry routes fall back before model fetch.
- Added a selector registry budget contract so generated registries carry `selector_model_byte_budget=33554432`, Rust validates the line, and the browser requires it before accepting registry entries.
- Added registry-controlled browser auto assembly so generated selector entries require adapter auto-apply fields, the browser applies the receipt-preferred sparse ASP1 module after receipt/evidence/manifest verification, and generated-root smokes prove q4_0, q8_0, and f32 assembly before generation.
- Added TinyRustLM runtime f32 `ADP1` adapter apply support through Rust model validation, runtime state reset, WASM ABI export, and Node ABI smoke coverage.
- Added the TinyRustLM browser Adapter Sidecar route for the checked tiny f32 self-ADP1 package with static harness, headless browser smoke, and workspace test evidence.
- Extended runtime `ADP1` adapter apply and checked browser Adapter Sidecar routing to tiny q8_0 and q4_0 self-sidecars, preserving compact quantized storage after apply.
- Added generated selector-registry f32 adapter sidecar routing so `browser-multi-parent-bundle` stages a self-ADP1 package and `adapter-sidecar-registry-file` verifies the browser path.
- Added generated selector-registry adapter-family routing so the bundle stages self and family ADP1 packages and browser smoke applies the second registry option.
- Added adapter-family receipt routing so generated selector registries carry a served receipt path, checksum, family strategy, and adapter count for compatible f32 ADP1 sidecar sets.
- Added assembly receipt routing so generated multi-parent bundles carry a browser-verified receipt and fetch/checksum the referenced ledger, review, recipe, operator, candidate, promotion, runtime, eval, admission, and adapter-family evidence files.
- Extended selector-registry adapter routing to f32/q8_0/q4_0 entries when apply status matches quantization, with a focused q8_0 registry-adapter browser smoke.
- Extended generated browser bundle routing to file-backed f32/q8_0/q4_0 roots, including selector registry, model, manifest, assembly receipt, evidence files, adapter-family receipt, adapter manifests, and family ADP1 apply smoke for q8_0 and q4_0.
- Added sparse task-delta receipt metadata for density, nonzero-delta retention, unchanged/pruned counts, and an implicit top-k mask checksum.
- Added sparse `ASP1` adapter packages with write/validate commands, manifest density and mask metadata, and runtime f32/q8_0/q4_0 sparse apply.
- Added browser-routed sparse `ASP1` adapter-family members for generated bundles, including served manifest verification, ASP1 artifact checksum transfer, refreshed WASM, and headless `adapter-sidecar-registry-file` apply proof.
- Added receipt-bound preferred adapter selection so generated adapter-family receipts name the sparse `ASP1` member and the browser defaults to that verified route before Apply.
- Added combined multi-quant generated selector roots so one `browser-multi-parent-bundle all` output serves f32, q8_0, and q4_0 multi-parent modules with receipt-preferred sparse `ASP1` apply proof for each entry.
- Added browser-frugal selector defaults so combined generated roots start on q4_0 before any model bytes load while still allowing q8_0 and f32 entry switching.
- Added parent-pool relatedness metadata: recipes write relatedness metric, scope, pair count, shared-family checksum, and per-parent group fields; sign-merge receipts echo them; multi-parent candidate manifests carry the summary.
- Added population-review objective-vector metadata: reviews write quality/frugality/quantization fit weights plus per-entry objective-vector checksums before parent-pool routing.
