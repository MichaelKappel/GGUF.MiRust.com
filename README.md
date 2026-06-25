# GGUF.MiRust.com

Canonical Rust source root for the GGUF.MiRust.com client-side SLM runtime and browser UI.

The active implementation target is `tinyrustlm/`: a 100% custom Rust/WASM browser-local AI app named TinyRustLM. The runtime is zero-dependency by design: no third-party Rust crates, no JavaScript frameworks, no tokenizer libraries, no inference frameworks, no package-manager runtime, no remote inference API, and no CDN dependency.

## Active Workspace

- `TinyRustLM.sln`: Visual Studio 2022 solution wrapper for building and running the Rust/WASM app through NMake.
- `tinyrustlm/app/`: static browser UI with handwritten HTML, CSS, JavaScript, local-only notice, local conversation transcript, diagnostics, benchmark panels, developer console, and product footer.
- `tinyrustlm/runtime/`: no-crate Rust runtime for WASM exports, memory transfer, `.slm` parsing, tokenizer, math kernels, quant helpers, KV cache, sampler, diagnostics, and native eval-case execution.
- `tinyrustlm/tools/slm_pack/`: no-crate Rust utility for writing `.slm` files, validating model admission, generating provenance manifests, validating raw trained-source layouts, converting source weights, creating pending evaluation templates, and enforcing quality gates.
- `tinyrustlm/tools/local_server/`: no-crate Rust static server for local browser hosting, Visual Studio F5, and browser-smoke startup.
- `tinyrustlm/tools/browser_harness/`: no-crate Rust mini browser contract harness for static app crawl, local-only asset policy, model/manifest presence, and optional loopback route checks.
- `tinyrustlm/docs/`: architecture, `.slm`, tokenizer, quantization, browser runtime, testing, and performance notes.
- `tinyrustlm/tests/fixtures/`: small text fixtures for runtime tests.
- `.uai/`: hot Project Handoff memory and routing state.
- `wiki/gguf-mirust/`: local LLM Wiki source namespace for AIWikis publication.
- `agent-file-handoff/Content` and `agent-file-handoff/Improvement`: active intake buckets only.

## Current Status

TinyRustLM now implements the static browser shell, WASM memory boundary, byte tokenizer, custom BPE tokenizer path, `.slm` parser, core math, one-layer tiny transformer forward pass, greedy generation, generated WASM artifact, generated tiny `.slm` models, and passing tests.

TinyLM-16M-shaped deterministic smoke models are verified for f32, q8_0, and q4_0, the tiny BPE fixture proves a custom `BPE1` `.slm` tokenizer through runtime diagnostics, and the tiny tied-output fixture proves omitted `output.weight` only works through the v1 tied-output flag. q8_0 and q4_0 matrix dispatch use direct quantized matvec paths, and quantized tensors no longer keep full decoded f32 shadow copies in runtime memory. Model loading now pre-resolves the top-level and per-layer tensor indices used by generation, so the token loop does not allocate layer-name strings or scan tensors by name, and the runtime routes tied-output projection flags to token embeddings. The browser UI now records each local user/assistant turn in an in-page conversation transcript; Reset clears runtime context and output while Clear empties only the transcript. The headless browser harness verifies generation, transcript entries, error recovery, benchmark panels, local-only requests, and desktop/mobile UI structure. Each local model now has a `.slm.manifest` provenance sidecar that marks these artifacts as deterministic smoke models, not trained-quality assistants. The packer has a raw-f32 trained-source layout, source-weight validator, and `convert-trained` command that can emit f32/q8_0/q4_0 `.slm` artifacts with converted-trained provenance. The trained-source lane also supports explicit tied-output source manifests, omitting `output.weight` and setting the v1 tied-output flag during f32/q8_0/q4_0 conversion. The runtime has a native eval runner that executes scoped fixture cases and writes a quality-gate sidecar. The Visual Studio test helper gates every converted fixture mode, including tied-output source conversion for runtime smoke, so f32, q8_0, and q4_0 conversion can no longer drift behind one another. The quality gate remains strict: deterministic smoke and converted-trained artifacts can pass `runtime-smoke`, while `assistant-quality` requires passed task-evaluation, safety-review evidence, and a declared quality scope.

## Intended Commands

Run these once a Rust toolchain is installed or exposed:

```powershell
cargo fmt --all
cargo test --workspace
cargo rustdoc -p tinyrustlm-runtime --lib -- -D missing_docs
cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs
cargo rustdoc -p tinyrustlm-local-server --bin tinyrustlm-local-server -- -D missing_docs
cargo rustdoc -p tinyrustlm-browser-harness --bin tinyrustlm-browser-harness -- -D missing_docs
rustup target add wasm32-unknown-unknown
cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model.slm tiny-fixture
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-bpe.slm tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-tied.slm tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- validate-manifest .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest
cargo run -p tinyrustlm-slm-pack -- quality-gate .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- validate-source .\tinyrustlm\tests\fixtures\trained-source-tiny
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-f32.slm f32
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q4.slm q4_0
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-tied tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-tied
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q8.slm q8_0
cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest assistant-quality .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- eval-template .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest .\tinyrustlm\models\tinylm16-q8.slm.eval assistant-quality
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Then serve the static app with the checked-in no-crate Rust static server:

```powershell
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Visual Studio 2022:

```text
Open TinyRustLM.sln, then Build Solution and press F5.
```

F5 reuses an already-running TinyRustLM server only after checking the app page and WASM route. If port 8080 is occupied by another local service, the run helper walks to the next free loopback port. See `docs/visual-studio.md` for the exact prerequisites and helper scripts.

## Memory Setup

UAIX Project Handoff is active through `.uai/`. LLM Wiki long memory targets AIWikis.org under `https://aiwikis.org/gguf-mirust/`, with local source records in `wiki/gguf-mirust/`. The long-term memory ledger is pointer-only and routing-only; durable reports belong in Markdown/wiki files, not inside `.uai/long-term-memory.uai`.
