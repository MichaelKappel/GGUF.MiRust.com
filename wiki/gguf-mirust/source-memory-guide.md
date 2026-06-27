---
title: GGUF.MiRust.com Source Memory Guide
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/source-memory-guide/
status: planned_pending_publication
reviewed_utc: 2026-06-27T15:17:51Z
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

Model-breeding references live under `wiki/gguf-mirust/research/model-breeding-reference-ideas-2026-06-26.md`; open it for sparse-mask breadcrumbs, population objective-vector metadata, parent relatedness metadata, evolutionary recipes, adaptive search, and multi-objective fitness routing.

## Active File Intake

Dropped files live only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`. There is no source-site Archive bucket for default resting memory.

## Implementation Boundary

The repository currently contains TinyRustLM, a zero-dependency Rust/WASM browser-local SLM runtime and UI. Future claims still require source inspection and current test evidence; report memory provides design pressure, not implementation proof.
