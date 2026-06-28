---
title: GGUF.MiRust.com LLM Wiki Log
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/log/
status: planned_pending_publication
reviewed_utc: 2026-06-28T20:20:00Z
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

- Added browser Module Plan checksums so generated `.module-plan.receipt` files carry uniform `module.N.checksum` fields, the UI renders the checksum summary, and `module-plan-checksum-drift` proves checksum mismatches stop before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
- Refreshed UAIX File Handoff memory strategy so reports stay in durable raw/wiki memory, short-term memory routes current report/research/dogfood paths, long-term memory keeps checksum pointers, and the Model Breeding reference page names diverse research lanes.
- Added browser Module Plan byte counts so generated `.module-plan.receipt` files carry `module.N.byte_count` fields, the UI renders the byte summary, and `module-plan-byte-drift` proves byte-count mismatches stop before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
- Added browser Module Plan phases so generated `.module-plan.receipt` files carry `module.N.phase` fields, the UI renders the phase summary, and `module-plan-phase-drift` proves phase mismatches stop before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
- Added browser Module Plan dependencies so generated `.module-plan.receipt` files carry `module.N.depends_on` fields, the UI renders the dependency summary, and `module-plan-dependency-drift` proves dependency mismatches stop before generated `.slm`, ADP1, ASP1, or adapter-manifest routes.
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

## 2026-06-28

- Added browser module-plan count drift proof so checksum-consistent receipt `module_count` drift rejects against selector `module_plan_module_count` before generated `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser module-plan WASM memory pages so generated selector entries and `.module-plan.receipt` files carry `module_plan_wasm_memory_initial_pages=17`, the Module Plan panel renders `WASM Pages`, and `module-plan-wasm-memory-drift` proves page-count mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser module-plan total budget so generated selector entries and `.module-plan.receipt` files carry `module_plan_total_byte_budget`, the Module Plan panel renders `Total Budget`, and `module-plan-total-budget-drift` proves total mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser-smoke `combined-selector-reload-soak` so a generated `browser-multi-parent-bundle all` root proves q4_0 default boot selection and q4_0/q8_0/f32 self-assembly across separate page lifetimes with repeated local route requests.
- Added browser source-backed ALR1 contract proof so source-backed `.alr1` manifests must match exact kind/dtype pairs and adapter-family receipt source echoes; `source-backed-alr1-manifest-drift` proves source contract drift stops before ADP1/ASP1/ALR1 stack artifact fetch.
- Added browser source-backed ALR1 routing so generated bundles convert reviewed adapter source templates into served `.alr1` stack members, browser `.alr1` manifest checks accept the source-backed kind/dtype, and `combined-selector-assembly` proves q4_0/q8_0/f32 apply ADP1 plus ASP1 plus source-backed ALR1 before generation.
- Added trained adapter source ALR1 conversion so `convert-adapter-source` packs reviewed low-rank f32 factor bundles into runtime `ALR1` packages and `validate-converted-adapter-source` recomputes the artifact and manifest from source plus base `.slm`.
- Added trained low-rank adapter source intake so `adapter-source-template` writes `adapter-source.manifest` plus raw f32 factor files and `validate-adapter-source` recomputes target tensor, factor rank, checksum, finite-factor, parameter-count, and delta-L1 fields before future ALR1 packaging.
- Added runtime assembly diagnostics so Rust reports `adapter_apply_count`, `last_adapter_checksum`, and `assembly_state_checksum`; WASM ABI smoke, checked manual sidecar smoke, and generated q4_0/q8_0/f32 combined selector smokes now assert those fields.
- Added browser module-plan origin policy so generated selector entries and `.module-plan.receipt` files carry `module_plan_origin_policy=same-origin-loopback-local-v1`, the Module Plan panel renders `Origin`, and `module-plan-origin-policy-drift` proves origin-policy mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser module-plan fetch policy so generated selector entries and `.module-plan.receipt` files carry `module_plan_fetch_policy=local-no-store-v1`, the Module Plan panel renders `Fetch`, and `module-plan-fetch-policy-drift` proves fetch-policy mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser module-plan execution profile so generated selector entries and `.module-plan.receipt` files carry `module_plan_execution_profile=single-threaded-wasm-local-v1`, the Module Plan panel renders `Execution`, and `module-plan-execution-profile-drift` proves execution-profile mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser module-plan runtime scratch budget so generated selector entries and `.module-plan.receipt` files carry `module_plan_runtime_scratch_byte_budget=65536`, the Module Plan panel renders `Scratch Budget`, and `module-plan-runtime-scratch-drift` proves scratch-budget mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser module-plan profile contract so generated selector entries and `.module-plan.receipt` files carry `browser-constrained-v1`, Rust and browser validation require it before generated model fetch, and `module-plan-profile-drift` proves profile mismatch stops before `.slm`, adapter-family, adapter-manifest, or stack artifact routes.
- Added browser-smoke `combined-selector-route-soak` so one generated `browser-multi-parent-bundle all` root runs three q4_0/q8_0/f32 cycles and proves every module-plan, model, manifest, assembly, evidence, adapter-family, adapter-manifest, and ADP1/ASP1/ALR1 stack route is requested once per pass.
- Added browser-smoke `combined-selector-route-extended-soak` so one generated `browser-multi-parent-bundle all` root runs five q4_0/q8_0/f32 cycles, proves fifteen assemblies, keeps path-flexible total-budget assertions, and requires every generated self-assembly route once per pass.
- Added browser-smoke `combined-selector-cycle` so one generated `browser-multi-parent-bundle all` root cycles q4_0, q8_0, and f32 twice in one page while post-initial passes release the prior WASM model before fresh Rust stack validation, stack apply, stack completion, reset diagnostics, and one-token generation.
- Added browser adapter stack Rust validation so generated auto assembly fetches/checks the ADP1/ASP1/ALR1 stack, calls `validate_adapter_delta` for every fetched member, then applies the stack only after semantic preflight passes.
- Added browser-smoke `adapter-stack-rust-validate-drift` so checksum-consistent family ADP1 identity drift passes browser byte gates, reaches Rust `validate_adapter_delta`, returns `shape mismatch`, and stops before any `apply_adapter_delta`.
- Added low-rank `ALR1` adapter packages with write/validate commands, deterministic factor manifests, and runtime f32/q8_0/q4_0 low-rank apply.
- Added browser Module Plan Trace so generated roots render a browser-owned checkpoint chain from plan verification through model acceptance, manifest, assembly evidence, adapter-family verification, adapter-stack apply, and ready state.
- Added browser-smoke `combined-selector-assembly` so one generated `browser-multi-parent-bundle all` root starts on q4_0, switches through q4_0, q8_0, and f32 entries, verifies each module plan before model bytes, auto-applies each ADP1 plus ASP1 stack before generation, and keeps requests local.
- Added browser-routed low-rank `ALR1` adapter-family members so generated f32/q8_0/q4_0 bundles stage `{id}-low-rank.alr1`, module plans declare a third stack member, and browser smokes prove ADP1 plus ASP1 plus ALR1 auto assembly before generation.
- Added browser eval-case evidence checksums so passed eval sidecars now flow through admissions, promotion ledgers, selector registries, generated assembly receipts, and Model Provenance; `combined-selector-assembly` proves q4_0/q8_0/f32 entries display the same eval digest.
- Added browser-smoke `assembly-eval-case-drift` so a checksum-consistent generated assembly receipt with a mismatched eval digest stops before evidence files, adapter-family receipts, adapter manifests, or adapter stack routes.
- Added browser-smoke `assembly-evidence-file-drift` so a generated root with valid selector, module-plan, model, manifest, and assembly receipt bytes rejects one drifted fetched evidence file before later evidence, adapter-family, adapter manifest, or stack routes.
- Added browser-smoke `adapter-family-receipt-drift` so a generated root with valid assembly evidence rejects drifted adapter-family receipt bytes before adapter manifests or ADP1/ASP1/ALR1 stack artifacts.
- Added browser-smoke `adapter-manifest-drift` so a generated root with valid assembly evidence and adapter-family receipt rejects a drifted family ADP1 manifest before sparse/low-rank manifests or ADP1/ASP1/ALR1 stack artifacts.
- Added browser-smoke `adapter-artifact-drift` so a generated root with valid adapter manifests rejects drifted family ADP1 artifact bytes before sparse/low-rank artifacts or any `apply_adapter_delta` call.
- Added browser-smoke `adapter-stack-prefetch-drift` so generated auto assembly verifies the fetched family ADP1 and sparse ASP1 stack bytes before any Rust adapter apply, then stops before low-rank ALR1 on sparse artifact drift.
