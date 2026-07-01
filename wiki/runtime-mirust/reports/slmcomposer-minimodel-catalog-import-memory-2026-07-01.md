# SLMComposer MiniModel Catalog Import Route

## Purpose

This route records the first MiniModel catalog-to-SLMComposer implementation slice. The feature keeps model bytes local while allowing SLMComposer to read metadata from a default MiniModel.org catalog endpoint or from a user-supplied local JSON list.

## Implemented Boundary

- SLMComposer renders a Model Catalog panel with `https://MiniModel.org/catalog/models.v0.json` prefilled.
- Catalog metadata can be loaded from HTTP(S) or from a local JSON file.
- Catalog entries are accepted only when they avoid project-server model-byte URLs, server-served model bytes, and server-side model execution claims.
- Selecting a catalog entry creates an expected local `.slm` import contract, but the browser still requires the user-selected `.slm` file picker.
- Browser import verifies catalog byte count and SHA-256 before passing bytes to Rust/WASM `load_model`.
- Rust/WASM validation remains the `.slm` acceptance gate, and the local import provenance records catalog identity after the model is accepted.

## MiniModel.org Catalog Endpoint

- `E:\Source\Rust\MiniModel.org\catalog\models.v0.json` is a metadata-only static catalog with TinyRustLM fixture entries, byte counts, SHA-256 artifact hashes, local filename hints, TinyRustLM checksums, routes to docs/license metadata, and explicit no-server-byte/no-server-execution flags.
- `E:\Source\Rust\MiniModel.org\catalog\.htaccess` advertises JSON type and permissive CORS for metadata fetches where Apache-style hosting honors it.
- `E:\Source\Rust\MiniModel.org\index.html` and `ROADMAP.md` link the catalog endpoint.

## Verification

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8080/app/ 9223 tinylm16q8 catalog-local-import`
- `node tinyrustlm/tools/browser-smoke.js http://slmcomposer.com:8080/app/ 9224 tinylm16q8 public-local-only`

## Follow-Up

The next MiniModel implementation slice can move into `minimodel-core` and CLI verification for the same manifest/catalog contract: parse metadata, reject server-byte boundaries, verify user-supplied local `.slm` byte count and SHA-256, validate TinyRustLM fields, and write local import receipts before any peer transfer work.
