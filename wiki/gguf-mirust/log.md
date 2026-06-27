---
title: GGUF.MiRust.com LLM Wiki Log
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/log/
status: planned_pending_publication
reviewed_utc: 2026-06-27T22:07:39Z
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

- Added browser Module Plan assembly slots so generated `.module-plan.receipt` files carry typed `module.N.assembly_slot` fields, the UI renders the slot summary, and `module-plan-slot-drift` proves slot mismatches stop before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
- Added browser-smoke `module-plan-role-drift` so a checksum-consistent generated q4 module-plan receipt role mismatch stops before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
- Added browser Module Plan role display so generated `.module-plan.receipt` files carry planner-readable `module.N.role` fields, source fallback reads unavailable, and generated q4 smoke asserts the rendered runtime/model-manifest/assembly/adapter-family/stack role summary.
- Added browser Module Plan budget display so verified `.module-plan.receipt` model and adapter byte envelopes render in the UI, source fallback reads unavailable, and generated q4 smoke asserts `6592 bytes` plus `1048576 bytes`.
- Added browser Module Plan display so verified `.module-plan.receipt` status, kind, resource class, module count, model route, and stack routes render in the UI and smoke assertions cover source fallback plus generated q4 receipt state.
- Added browser-smoke `module-plan-stack-drift` so a checksum-consistent generated q4 module-plan receipt stack member path mismatch stops before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
- Added browser-smoke `module-plan-graph-drift` so a checksum-consistent generated q4 module-plan receipt model path mismatch stops before the generated `.slm` route.
- Added browser-smoke `module-plan-resource-drift` so a checksum-consistent generated q4 module-plan receipt budget mismatch stops before the generated `.slm` route.
- Added browser module-plan resource envelopes so generated selector entries and served `.module-plan.receipt` files declare a resource class, admitted model byte budget, and adapter-family byte budget before browser model fetch.
- Added browser module-plan receipts so generated selector entries declare checksum-bound `.module-plan.receipt` routes, app.js verifies the plan graph before generated `.slm` fetch, and generated-root smoke proves the plan route is requested before stack assembly and generation.
- Added browser adapter-stack self assembly so generated adapter-family receipts declare ordered stack members, selector registries carry stack fields, and browser smoke proves family ADP1 plus sparse ASP1 apply before generation.
- Added browser text-sidecar budget contract fields to selector registries so generated registries declare selector, manifest, receipt, and evidence text envelopes, Rust validates them, and browser intake requires exact local matches before accepting entries.
- Added a browser runtime WASM manifest so checked and generated roots verify runtime bytes before `WebAssembly.instantiate`, and added a drift smoke proving model routes are not requested after runtime manifest checksum mismatch.
- Added browser text-sidecar byte envelopes for selector registries, manifests, receipts, and assembly evidence files, with durable report routing.
- Added browser selector byte-budget intake so registry entries must declare bounded `entry.N.model_bytes`, fetched registry models must match declared bytes before WASM transfer, and oversized registry routes fall back before model fetch.
- Added a selector registry budget contract so generated registries carry `selector_model_byte_budget=33554432`, Rust validates the line, and the browser requires it before accepting registry entries.
- Added registry-controlled browser auto assembly so generated selector entries require adapter auto-apply fields, the browser applies the receipt-preferred sparse ASP1 module after receipt/evidence/manifest verification, and generated-root smokes prove q4_0, q8_0, and f32 assembly before generation.
- Added an adapter auto-assembly byte-budget contract so generated adapter-family entries carry `adapter_auto_apply_byte_budget=1048576`, browser manifest checks parse `adapter_artifact_bytes`, and fetched auto-assembled module bytes must match the manifest before WASM transfer.
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
