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

## Dogfood Result

The active model-breeding reports became a new durable intake, a model-breeding synthesis page, a research reference page, and hot `.uai` routes. This keeps the UAIX setup practical: raw evidence remains exact, long-term memory stays pointer-shaped, and short-term memory points future agents to the right durable node.
