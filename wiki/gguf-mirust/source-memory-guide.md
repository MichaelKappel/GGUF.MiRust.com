---
title: GGUF.MiRust.com Source Memory Guide
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/source-memory-guide/
status: planned_pending_publication
reviewed_utc: 2026-06-27T22:07:39Z
---

# GGUF.MiRust.com Source Memory Guide

Use this guide to route future agents to the correct memory layer.

## Active Project Memory

Hot Project Handoff memory lives in `.uai/`. Start with `.uai/startup-packet.uai`, `.uai/workspace-guidance.uai`, `.uai/file-handoff.uai`, `.uai/long-term-memory.uai`, and `.uai/taboo.uai` when public site voice or product copy is in scope.

## Durable Project Memory

Reviewed durable memory lives in `wiki/gguf-mirust/` and publishes under `https://aiwikis.org/gguf-mirust/` when deployed. Raw evidence manifests live under `raw/gguf-mirust/`.

Report-derived long-term memory lives under `wiki/gguf-mirust/reports/`. Start with `reports/report-intake-index-2026-06-25.md` for the first processed batch and `reports/report-intake-index-2026-06-26.md` for model-breeding research, then load only the thematic synthesis record needed for the task.

For browser-served model-breeding evidence, load `reports/assembly-receipt-memory-2026-06-27.md` when selector assembly receipt fields, generated bundle evidence staging, evidence-file fetches, or browser Assembly Evidence rendering are in scope.

For compact adapter package work, load `reports/sparse-adapter-package-memory-2026-06-27.md` when `ASP1`, `sparse-adapter-delta`, `validate-sparse-adapter-delta`, or runtime sparse adapter apply is in scope.

For browser sparse adapter routing, load `reports/browser-sparse-adapter-route-memory-2026-06-27.md` when selector adapter routes, generated adapter families, served `.asp1` artifacts, browser manifest checks, or `adapter-sidecar-registry-file` smoke are in scope.

For browser preferred adapter routing, load `reports/browser-preferred-adapter-route-memory-2026-06-27.md` when adapter-family receipt preferred fields, browser default adapter selection, generated sparse ASP1 preference, or smoke assertions around `selectedAdapterBeforeApply` are in scope.

For combined generated selector roots, load `reports/browser-multi-quant-selector-root-memory-2026-06-27.md` when `browser-multi-parent-bundle all`, one-root f32/q8_0/q4_0 selector fan-in, or same-served-root adapter-sidecar smokes are in scope.

For browser frugal selector defaults, load `reports/browser-frugal-selector-default-memory-2026-06-27.md` when selector default metadata, q4_0 initial selection, combined-root first load behavior, or default-selection smoke assertions are in scope.

For browser selector byte budgets, load `reports/browser-selector-budget-memory-2026-06-27.md` when `entry.N.model_bytes`, registry fallback behavior, pre-WASM model byte transfer checks, or `selector-budget` smoke assertions are in scope.

For browser selector budget contracts, load `reports/browser-selector-budget-contract-memory-2026-06-27.md` when `selector_model_byte_budget`, registry-level budget validation, generated bundle registry fields, or selector-budget contract smoke evidence is in scope.

For browser auto assembly, load `reports/browser-auto-assembly-memory-2026-06-27.md` when selector adapter auto-apply fields, generated adapter-family startup apply, receipt-preferred sparse ASP1 auto selection, or `adapter-sidecar-registry-file` pre-generation assembly proof is in scope.

For browser auto-assembly byte budgets, load `reports/browser-auto-assembly-budget-memory-2026-06-27.md` when `adapter_auto_apply_byte_budget`, adapter manifest artifact bytes, pre-WASM adapter transfer checks, or constrained browser module assembly is in scope.

For browser text-sidecar byte budgets, load `reports/browser-text-sidecar-budget-memory-2026-06-27.md` when selector.registry, `.slm` manifests, adapter manifests, receipts, assembly evidence text, or sidecar pre-parse fetch limits are in scope.

For browser text-sidecar budget contracts, load `reports/browser-text-sidecar-contract-memory-2026-06-27.md` when selector registry header fields, generated registry contract validation, exact browser budget intake, or sidecar-budget-contract fallback smoke evidence is in scope.

For browser runtime manifests, load `reports/browser-runtime-manifest-memory-2026-06-27.md` when runtime WASM rebuild/copy flows, generated bundle runtime staging, browser boot sequencing, or manifest-drift smoke evidence is in scope.

For browser adapter stacks, load `reports/browser-adapter-stack-memory-2026-06-27.md` when generated adapter-family receipts, selector `adapter_auto_apply_stack_*` fields, ordered ADP1/ASP1 startup apply, or adapter-stack smoke evidence is in scope.

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

Model-breeding references live under `wiki/gguf-mirust/research/model-breeding-reference-ideas-2026-06-26.md`; open it for sparse-mask breadcrumbs, population objective-vector metadata, parent relatedness metadata, evolutionary recipes, adaptive search, and multi-objective fitness routing.

## Active File Intake

Dropped files live only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`. There is no source-site Archive bucket for default resting memory.

## Implementation Boundary

The repository currently contains TinyRustLM, a zero-dependency Rust/WASM browser-local SLM runtime and UI. Future claims still require source inspection and current test evidence; report memory provides design pressure, not implementation proof.
