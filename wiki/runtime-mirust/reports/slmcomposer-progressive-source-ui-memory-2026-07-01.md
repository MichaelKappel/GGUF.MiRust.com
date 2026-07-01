# SLMComposer Progressive Source UI Memory

## Purpose

This route records the SLMComposer app UI restructuring that turns the flat browser-local TinyRustLM page into a progressive Simple/Advanced interface while preserving the local Rust/WASM runtime boundary.

## Implemented UI Boundary

- First load defaults to Simple Mode.
- Simple Mode hides raw generation parameters, provenance, assembly evidence, module plan, benchmark, token console, adapter controls, raw catalog URLs, raw Hugging Face search, and WASM/module checksum fields.
- Advanced Mode exposes the existing model dropdown, local `.slm` import, MiniModel catalog URL and local JSON list import, Hugging Face search, adapter sidecar, raw generation parameters, Step Token, run history, and diagnostics.
- The right diagnostics rail is tabbed and collapsible, with Runtime, Provenance, Assembly, Module Plan, Benchmark, Token Console, and Teleodynamic tabs.
- Provenance is grouped as Source, Review, Lineage, and Evaluation. Module Plan is grouped as Identity, Fetch and Origin, Routes, WASM and Memory, Budgets, Bytes and Checksums, and Execution Graph.
- Teleodynamic Diagnostics renders only empty real-data placeholders and the message `No teleodynamic event data available for this run.` No metrics are invented.

## Source Options

Simple Mode now presents three explicit model source options:

1. User local files: the direct path where the browser file picker selects a trusted local `.slm` artifact and Rust/WASM validates it.
2. Hugging Face: user-triggered metadata discovery and model-card review. It does not auto-run remote inference and does not import bytes into the runtime without local file selection.
3. P2P Exchange: a future MiniModel verified-transfer route. The current UI names it as a metadata/manifests path and keeps transfer/import gated on local `.slm` verification.

All three source options converge on local `.slm` import. SLMComposer.com still does not serve runnable model weights, does not proxy Hugging Face or peer model bytes, and does not run user model bytes on project servers.

## Browser Behavior

- Starter cards map user intent to existing local model choices and semantic generation settings.
- `Custom Local Model` opens the local `.slm` source flow.
- `Explore Model Sources` opens the Simple source chooser, defaulting to Hugging Face metadata discovery.
- Simple source results are mirrored from the existing Advanced catalog and Hugging Face renderers; fetch/import logic remains shared.
- Local import status is summarized in Simple Mode without exposing checksums there. Advanced Mode keeps raw byte counts and checksums.
- Run history stays local and persists only when the user enables the device-local history toggle.
- Response rendering remains text-safe and supports fenced code copy buttons without executing generated content.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node --check tinyrustlm/tools/static-server.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9432 tinylm16q8 catalog-local-import`
- `node tinyrustlm/tools/browser-smoke.js http://slmcomposer.com:8098/app/ 9434 tinylm16q8 public-local-only`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9436 tinylm16q8 ui-audit`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8098/app/ 9437 tinylm16q8 source-options-ui`

The new `source-options-ui` smoke proves first-load Simple Mode, hidden Advanced controls, Local/Hugging Face/P2P source switching, Advanced source surface visibility after the mode toggle, and no Hugging Face or MiniModel network request before explicit search/catalog-load actions.

## Follow-Up

Keep the next implementation slice focused on local manifest verification and import receipts. Peer transfer, relays, DHTs, and remote execution remain later phases and must not alter the browser-local model-byte boundary.
