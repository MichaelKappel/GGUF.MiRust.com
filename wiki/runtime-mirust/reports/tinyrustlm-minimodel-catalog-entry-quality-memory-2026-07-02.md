# TinyRustLM MiniModel Catalog Entry Quality Memory - 2026-07-02

This continuation made the "convert once, share by P2P later" path less hand-written and more verifiable.

MiniModel now has `minimodel write-catalog-entry <manifest> <peer-offer> <output-json> [source-huggingface-model-id]`. The command validates an admitted MiniModel manifest against a `.minimodel-peer-offer` proof before writing catalog JSON. It rejects artifact field drift, `.slm` field drift, chunk count drift, chunk-list SHA-256 drift, Merkle root drift, admission evidence checksum drift, and per-chunk row drift.

`examples/catalog-entry.v0.json` is now generated from the real q8 fixture manifest and peer-offer proof rather than placeholder checksums. Proof-ready catalog rows use `peer_hint_status=peer-offer-ready-known-peer-needed` and `peer_import_status=request-script-ready`, which means TinyRustLM may save a peer-import request plus Rust fetch/assemble/reverify script after the user supplies a consenting peer URL. It does not mean MiniModel.org serves model bytes.

TinyRustLM now parses `peer_import_status`, renders proof-ready rows as `P2P proof ready`, and keeps unmatched Hugging Face rows on `Start Conversion`. The generated conversion script now prints the post-admission `write-catalog-entry`, `export-peer-pieces`, and `serve-peer-pieces` MiniModel commands.

Verification:

- `cargo fmt --all -- --check` in MiniModel.org.
- `cargo test` in MiniModel.org passed 23 tests, including catalog-entry write/drift tests.
- `node --check tinyrustlm/app/app.js`.
- `node --check tinyrustlm/tools/browser-smoke.js`.
- Focused `hf-search-ui` browser smoke passed on `http://127.0.0.1:55410/app/`, proving `P2P proof ready`, `P2P Import`, `Start Conversion`, no fake first-run transcript text, and no project-hosted model-byte path.

Boundary:

- Project servers still never run user model bytes.
- Project servers still never serve user model bytes.
- P2P import remains a local request and Rust re-verification handoff until a broader peer discovery/cache client exists.
