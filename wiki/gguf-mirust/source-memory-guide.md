---
title: GGUF.MiRust.com Source Memory Guide
source_site: GGUF.MiRust.com
public_route: /gguf-mirust/source-memory-guide/
status: planned_pending_publication
reviewed_utc: 2026-06-26T18:44:35Z
---

# GGUF.MiRust.com Source Memory Guide

Use this guide to route future agents to the correct memory layer.

## Active Project Memory

Hot Project Handoff memory lives in `.uai/`. Start with `.uai/startup-packet.uai`, `.uai/workspace-guidance.uai`, `.uai/file-handoff.uai`, `.uai/long-term-memory.uai`, and `.uai/taboo.uai` when public site voice or product copy is in scope.

## Durable Project Memory

Reviewed durable memory lives in `wiki/gguf-mirust/` and publishes under `https://aiwikis.org/gguf-mirust/` when deployed. Raw evidence manifests live under `raw/gguf-mirust/`.

Report-derived long-term memory lives under `wiki/gguf-mirust/reports/`. Start with `reports/report-intake-index-2026-06-25.md` for the first processed batch and `reports/report-intake-index-2026-06-26.md` for model-breeding research, then load only the thematic synthesis record needed for the task.

Model-breeding references live under `wiki/gguf-mirust/research/model-breeding-reference-ideas-2026-06-26.md`.

## Active File Intake

Dropped files live only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`. There is no source-site Archive bucket for default resting memory.

## Implementation Boundary

The repository currently contains TinyRustLM, a zero-dependency Rust/WASM browser-local SLM runtime and UI. Future claims still require source inspection and current test evidence; report memory provides design pressure, not implementation proof.
