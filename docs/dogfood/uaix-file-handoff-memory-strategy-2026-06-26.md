# UAIX File Handoff Memory Strategy Dogfood 2026-06-26

Source: https://uaix.org/en-us/tools/ai-memory-package-wizard/#setup-file-handoff

This note records how GGUF.MiRust.com applies the UAIX AI Memory Package Wizard setup path after processing the 2026-06-26 Improvement batch.

## Adopted Strategy

- Keep active dropped files only in `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/`.
- Preserve reviewed originals under `raw/gguf-mirust/` with SHA256 hashes and a manifest.
- Synthesize durable routing pages under `wiki/gguf-mirust/`.
- Keep `.uai/long-term-memory.uai` as a pointer ledger with checksums and routing summaries.
- Keep `.uai/report-synthesis.uai` and `.uai/short-term-memory.uai` compact enough for cold-start agents to know what durable pages to open.
- Clear processed source-site copies only after raw preservation, durable synthesis, hot-memory routing, and ledger updates are complete.

## Project-Specific Addition

The 2026-06-26 human request adds `.uai/taboo.uai` as a hot voice-control file. It routes GGUF.MiRust.com public copy toward constructive local model craft, verifiable execution, model lineage, and research momentum.

## 2026-06-27 Refresh

The setup-file-handoff route is now recorded as a cycle: scan active buckets, classify source files, record disposition and proof-of-use, preserve reviewed originals with checksums, synthesize durable wiki/report nodes, refresh short-term routing plus long-term checksum pointers, then remove processed source copies or name why they remain active.

For model-breeding reports and research notes, the bodies live in raw evidence and wiki pages. `.uai/short-term-memory.uai` carries the current route to those pages, while `.uai/long-term-memory.uai` stays a checksum-bearing pointer ledger.

The public-copy voice rule is part of that cycle: model-breeding, mutualist, and tiny-ecology page work should read `.uai/taboo.uai` before publishing wording on GGUF.MiRust.com.

## Dogfood Result

The active model-breeding reports became a new durable intake, a model-breeding synthesis page, a research reference page, and hot `.uai` routes. This keeps the UAIX setup practical: raw evidence remains exact, long-term memory stays pointer-shaped, and short-term memory points future agents to the right durable node.
