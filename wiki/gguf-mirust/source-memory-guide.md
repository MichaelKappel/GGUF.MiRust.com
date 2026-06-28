---
title: GGUF.MiRust.com Source Memory Guide
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/source-memory-guide/
status: planned_pending_publication
reviewed_utc: 2026-06-28T11:25:34Z
---

# GGUF.MiRust.com Source Memory Guide

Use this guide to route future agents to the correct memory layer.

## Active Project Memory

Hot Project Handoff memory lives in `.uai/`. Start with `.uai/startup-packet.uai`, `.uai/workspace-guidance.uai`, `.uai/file-handoff.uai`, `.uai/long-term-memory.uai`, and `.uai/taboo.uai` when public site voice or product copy is in scope.

## Durable Project Memory

Reviewed durable memory lives in `wiki/gguf-mirust/` and publishes under `https://aiwikis.org/gguf-mirust/` when deployed. Raw evidence manifests live under `raw/gguf-mirust/`.

Report-derived long-term memory lives under `wiki/gguf-mirust/reports/`. Start with `reports/report-intake-index-2026-06-25.md` for the first processed batch and `reports/report-intake-index-2026-06-26.md` for model-breeding research, then load only the thematic synthesis record needed for the task.

UAIX File Handoff strategy is recorded in `docs/dogfood/uaix-file-handoff-memory-strategy-2026-06-26.md`. Current report pages are represented in `.uai/long-term-memory.uai`; `.uai/short-term-memory.uai` tells agents which report, research, dogfood, and pointer-ledger routes to open now.

For browser-served model-breeding evidence, load `reports/assembly-receipt-memory-2026-06-27.md` when selector assembly receipt fields, generated bundle evidence staging, evidence-file fetches, or browser Assembly Evidence rendering are in scope.

For compact adapter package work, load `reports/sparse-adapter-package-memory-2026-06-27.md` when `ASP1`, `sparse-adapter-delta`, `validate-sparse-adapter-delta`, or runtime sparse adapter apply is in scope.

For low-rank adapter package work, load `reports/low-rank-adapter-package-memory-2026-06-28.md` when `ALR1`, `low-rank-adapter-delta`, `validate-low-rank-adapter-delta`, deterministic factor payloads, or runtime low-rank adapter apply is in scope.

For trained adapter source work, load `reports/trained-adapter-source-memory-2026-06-28.md` when `adapter-source-template`, `validate-adapter-source`, trained low-rank factor manifests, or factor-file validation is in scope.

For trained adapter source ALR1 conversion, load `reports/trained-adapter-source-alr1-memory-2026-06-28.md` when `convert-adapter-source`, `validate-converted-adapter-source`, source-factor ALR1 packaging, source-backed ALR1 manifests, or reviewed factor-to-runtime adapter routing is in scope.

For browser low-rank adapter routing, load `reports/browser-low-rank-adapter-route-memory-2026-06-28.md` when generated `.alr1` routes, low-rank adapter-family members, `ALR1` manifests, module-plan low-rank stack roles, or `adapter-sidecar-registry-file` ALR1 smoke evidence is in scope.

For browser source-backed ALR1 routing, load `reports/browser-source-backed-alr1-route-memory-2026-06-28.md` when generated bundles should convert reviewed adapter source templates into served source-backed `.alr1` stack members, or when app `.alr1` manifest kind/dtype acceptance changes.

For browser sparse adapter routing, load `reports/browser-sparse-adapter-route-memory-2026-06-27.md` when selector adapter routes, generated adapter families, served `.asp1` artifacts, browser manifest checks, or `adapter-sidecar-registry-file` smoke are in scope.

For browser preferred adapter routing, load `reports/browser-preferred-adapter-route-memory-2026-06-27.md` when adapter-family receipt preferred fields, browser default adapter selection, generated sparse ASP1 preference, or smoke assertions around `selectedAdapterBeforeApply` are in scope.

For combined generated selector roots, load `reports/browser-multi-quant-selector-root-memory-2026-06-27.md` when `browser-multi-parent-bundle all`, one-root f32/q8_0/q4_0 selector fan-in, or same-served-root adapter-sidecar smokes are in scope.

For combined selector assembly proof, load `reports/browser-combined-selector-assembly-memory-2026-06-28.md` when `combined-selector-assembly`, all-root q4_0 default, all-three-entry module-plan ordering, or same-page q4_0/q8_0/f32 auto assembly is in scope.

For combined selector cycle proof, load `reports/browser-combined-selector-cycle-memory-2026-06-28.md` when `combined-selector-cycle`, repeated all-root q4_0/q8_0/f32 switching, release-before-reassembly behavior, per-pass Rust stack validation/apply deltas, or fresh generated-root path-flexible Module Plan summaries are in scope.

For combined selector route-soak proof, load `reports/browser-combined-selector-route-soak-memory-2026-06-28.md` when `combined-selector-route-soak`, repeated generated self-assembly route counts, no-store local fetch behavior, or longer q4_0/q8_0/f32 selector pressure is in scope.

For browser module-plan profile proof, load `reports/browser-module-plan-profile-memory-2026-06-28.md` when `browser-constrained-v1`, selector-to-receipt self-assembly profile matching, generated module-plan profile fields, or `module-plan-profile-drift` is in scope.

For browser module-plan execution profile proof, load `reports/browser-module-plan-execution-profile-memory-2026-06-28.md` when `single-threaded-wasm-local-v1`, Module Plan `Execution`, generated module-plan execution fields, or `module-plan-execution-profile-drift` is in scope.

For browser module-plan fetch-policy proof, load `reports/browser-module-plan-fetch-policy-memory-2026-06-28.md` when `local-no-store-v1`, Module Plan `Fetch`, generated module-plan fetch fields, no-store local fetch behavior, or `module-plan-fetch-policy-drift` is in scope.

For browser module-plan origin-policy proof, load `reports/browser-module-plan-origin-policy-memory-2026-06-28.md` when `same-origin-loopback-local-v1`, Module Plan `Origin`, generated module-plan origin fields, same-origin local assembly behavior, or `module-plan-origin-policy-drift` is in scope.

For browser module-plan runtime scratch proof, load `reports/browser-module-plan-runtime-scratch-memory-2026-06-28.md` when `module_plan_runtime_scratch_byte_budget`, Module Plan `Scratch Budget`, browser runtime scratch envelopes, or `module-plan-runtime-scratch-drift` is in scope.

For browser assembly trace proof, load `reports/browser-assembly-trace-memory-2026-06-28.md` when the Module Plan Trace row, browser load checkpoints, generated all-root trace assertion, or ready-state sequencing is in scope.

For browser eval-case evidence checksum proof, load `reports/browser-eval-case-evidence-checksum-memory-2026-06-28.md` when selector admission eval evidence fields, promotion-ledger admission copies, generated assembly receipt eval digests, Model Provenance eval fields, or browser-smoke registry-backed provenance assertions are in scope.

For browser assembly eval-case drift proof, load `reports/browser-assembly-eval-case-drift-memory-2026-06-28.md` when generated assembly receipt eval digests, selector-to-assembly digest matching, Assembly Evidence failure states, or `assembly-eval-case-drift` smoke assertions are in scope.

For browser assembly evidence-file drift proof, load `reports/browser-assembly-evidence-file-drift-memory-2026-06-28.md` when `verifyAssemblyEvidenceFiles`, fetched evidence-file checksums, generated evidence routes, Assembly Evidence failure states, or `assembly-evidence-file-drift` smoke assertions are in scope.

For browser adapter-family receipt drift proof, load `reports/browser-adapter-family-receipt-drift-memory-2026-06-28.md` when `loadAdapterFamilyReceipt`, served adapter-family receipt bytes, post-evidence adapter-family failure state, or `adapter-family-receipt-drift` smoke assertions are in scope.

For browser adapter manifest drift proof, load `reports/browser-adapter-manifest-drift-memory-2026-06-28.md` when `validateAdapterManifest`, served adapter manifest bytes, post-receipt adapter failure state, or `adapter-manifest-drift` smoke assertions are in scope.

For browser adapter artifact drift proof, load `reports/browser-adapter-artifact-drift-memory-2026-06-28.md` when generated adapter artifact checksum matching, exact stack artifact route interception, post-manifest adapter failure state, or `adapter-artifact-drift` smoke assertions are in scope.

For browser adapter stack preflight proof, load `reports/browser-adapter-stack-prefetch-drift-memory-2026-06-28.md` when generated auto-apply stack bytes, full-stack artifact prefetch, pre-WASM stack verification, or `adapter-stack-prefetch-drift` smoke assertions are in scope.

For browser adapter stack Rust validation proof, load `reports/browser-adapter-stack-rust-validate-memory-2026-06-28.md` when `validate_adapter_delta`, generated auto-stack semantic preflight, validation-before-apply ordering, or WASM adapter ABI coverage is in scope.

For browser adapter stack Rust validation drift proof, load `reports/browser-adapter-stack-rust-validate-drift-memory-2026-06-28.md` when checksum-consistent ADP1 identity drift, `adapter-stack-rust-validate-drift`, validation failure state, or no-apply assertions are in scope.

For browser runtime assembly diagnostics proof, load `reports/browser-runtime-assembly-diagnostics-memory-2026-06-28.md` when Rust diagnostics assembly fields, `adapter_apply_count`, `last_adapter_checksum`, `assembly_state_checksum`, manual adapter sidecar assertions, or generated auto-stack runtime state assertions are in scope.

For browser frugal selector defaults, load `reports/browser-frugal-selector-default-memory-2026-06-27.md` when selector default metadata, q4_0 initial selection, combined-root first load behavior, or default-selection smoke assertions are in scope.

For browser selector byte budgets, load `reports/browser-selector-budget-memory-2026-06-27.md` when `entry.N.model_bytes`, registry fallback behavior, pre-WASM model byte transfer checks, or `selector-budget` smoke assertions are in scope.

For browser selector budget contracts, load `reports/browser-selector-budget-contract-memory-2026-06-27.md` when `selector_model_byte_budget`, registry-level budget validation, generated bundle registry fields, or selector-budget contract smoke evidence is in scope.

For browser auto assembly, load `reports/browser-auto-assembly-memory-2026-06-27.md` when selector adapter auto-apply fields, generated adapter-family startup apply, receipt-preferred sparse ASP1 auto selection, or `adapter-sidecar-registry-file` pre-generation assembly proof is in scope.

For browser auto-assembly byte budgets, load `reports/browser-auto-assembly-budget-memory-2026-06-27.md` when `adapter_auto_apply_byte_budget`, adapter manifest artifact bytes, pre-WASM adapter transfer checks, or constrained browser module assembly is in scope.

For browser text-sidecar byte budgets, load `reports/browser-text-sidecar-budget-memory-2026-06-27.md` when selector.registry, `.slm` manifests, adapter manifests, receipts, assembly evidence text, or sidecar pre-parse fetch limits are in scope.

For browser text-sidecar budget contracts, load `reports/browser-text-sidecar-contract-memory-2026-06-27.md` when selector registry header fields, generated registry contract validation, exact browser budget intake, or sidecar-budget-contract fallback smoke evidence is in scope.

For browser runtime manifests, load `reports/browser-runtime-manifest-memory-2026-06-27.md` when runtime WASM rebuild/copy flows, generated bundle runtime staging, browser boot sequencing, or manifest-drift smoke evidence is in scope.

For browser adapter stacks, load `reports/browser-adapter-stack-memory-2026-06-27.md` when generated adapter-family receipts, selector `adapter_auto_apply_stack_*` fields, ordered ADP1/ASP1/ALR1 startup apply, or adapter-stack smoke evidence is in scope.

For browser module plans, load `reports/browser-module-plan-memory-2026-06-27.md` when generated selector `module_plan_*` fields, served `.module-plan.receipt` files, pre-model-fetch plan verification, or generated-root adapter-stack smoke routes are in scope.

For browser module-plan resource envelopes, load `reports/browser-module-plan-resource-memory-2026-06-27.md` when `module_plan_resource_class`, `module_plan_model_byte_budget`, `module_plan_adapter_byte_budget`, constrained self-assembly routing, or pre-model-fetch plan budget checks are in scope.

For browser module-plan resource drift proof, load `reports/browser-module-plan-resource-drift-memory-2026-06-27.md` when `module-plan-resource-drift`, checksum-consistent receipt mutation, or no-generated-`.slm`-fetch proof is in scope.

For browser module-plan graph drift proof, load `reports/browser-module-plan-graph-drift-memory-2026-06-27.md` when `module-plan-graph-drift`, checksum-consistent graph-route mutation, or no-generated-`.slm`-fetch proof is in scope.

For browser module-plan stack drift proof, load `reports/browser-module-plan-stack-drift-memory-2026-06-27.md` when `module-plan-stack-drift`, checksum-consistent stack-member mutation, or no-generated-model-or-stack-artifact-fetch proof is in scope.

For browser module-plan role drift proof, load `reports/browser-module-plan-role-drift-memory-2026-06-27.md` when `module-plan-role-drift`, checksum-consistent role mutation, or no-generated-model-or-stack-artifact-fetch proof is in scope.

For browser module-plan display proof, load `reports/browser-module-plan-display-memory-2026-06-27.md` when the Module Plan panel, rendered verified receipt fields, generated model route display, stack route display, or panel smoke assertions are in scope.

For browser module-plan budget display proof, load `reports/browser-module-plan-budget-display-memory-2026-06-27.md` when the Module Plan panel's visible model/adapter byte-budget rows or budget smoke assertions are in scope.

For browser module-plan role display proof, load `reports/browser-module-plan-role-display-memory-2026-06-27.md` when `.module-plan.receipt` module roles, rendered role summaries, or role smoke assertions are in scope.

For browser module-plan assembly-slot proof, load `reports/browser-module-plan-slots-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.assembly_slot` fields, rendered slot summaries, or `module-plan-slot-drift` assertions are in scope.

For browser module-plan dependency proof, load `reports/browser-module-plan-dependencies-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.depends_on` fields, rendered dependency summaries, or `module-plan-dependency-drift` assertions are in scope.

For browser module-plan phase proof, load `reports/browser-module-plan-phases-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.phase` fields, rendered phase summaries, or `module-plan-phase-drift` assertions are in scope.

For browser module-plan byte-count proof, load `reports/browser-module-plan-byte-counts-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.byte_count` fields, rendered byte summaries, fetched text/model byte matching, adapter-stack artifact byte matching, or `module-plan-byte-drift` assertions are in scope.

For browser module-plan checksum proof, load `reports/browser-module-plan-checksums-memory-2026-06-27.md` when `.module-plan.receipt` `module.N.checksum` fields, rendered checksum summaries, stack artifact checksum matching, or `module-plan-checksum-drift` assertions are in scope.

Model-breeding references live under `wiki/gguf-mirust/research/model-breeding-reference-ideas-2026-06-26.md`; open it for compatible merge, sparse-lineage, adapter-ecology, low-rank ALR1/LoRA reference routing, source-backed browser ALR1 routing, population-search, federated/local-update, browser-constrained-assembly, UAIX-memory-strategy, sparse-mask breadcrumb, objective-vector, parent-relatedness, evolutionary-recipe, adaptive-search, and multi-objective-fitness routing.

## Active File Intake

Dropped files live only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`. There is no source-site Archive bucket for default resting memory.

## Implementation Boundary

The repository currently contains TinyRustLM, a zero-dependency Rust/WASM browser-local SLM runtime and UI. Future claims still require source inspection and current test evidence; report memory provides design pressure, not implementation proof.
