# TinyRustLM

TinyRustLM is the zero-dependency client-side SLM runtime for GGUF.MiRust.com.

The app target is a static browser UI plus a Rust-compiled WASM runtime that loads a local `.slm` model file, validates it, tokenizes prompts, and runs local inference without remote APIs or third-party runtime libraries.

## Current Milestone

Implemented source slice:

- Static browser shell in `app/`.
- Handwritten JavaScript WASM/model loader.
- Rust runtime crate with no dependencies.
- Raw WASM exports for allocation, model load, prompt transfer, generation boundary, diagnostics, context reset, and model free.
- Byte tokenizer, `.slm` parser, tensor views, math ops, q8/q4 helpers, RoPE, KV cache, sampler, and diagnostics source.
- No-crate `slm_pack` source for generating a tiny fixture `.slm`.
- Generated `runtime/tinyrustlm.wasm`.
- Generated `models/tiny-test-model.slm`.
- Generated `models/tiny-test-model-q8.slm` and `models/tiny-test-model-q4.slm`.
- Generated `models/tiny-test-model-bpe.slm` custom BPE fixture.
- Generated `models/tiny-test-model-tied.slm` tied-output fixture.
- Generated `models/tinylm16-f32.slm`.
- Generated `models/tinylm16-q8.slm`.
- Generated `models/tinylm16-q4.slm`.
- Checksum-bearing `.slm` artifacts; the runtime rejects zero or mismatched checksums before tensor decoding.
- Provenance `.slm.manifest` sidecars for every local model artifact, with deterministic-smoke status and explicit trained-quality non-claim.
- Browser model provenance panel that fetches the selected local `.slm.manifest` after Rust accepts the model and renders source kind, admission status, quality claim, trained-quality claim, checksum, and required next gate.
- Browser decoding controls for temperature, top-k, top-p, and deterministic seed, defaulting to greedy decoding for repeatable smoke tests.
- Packer-side `eval-template` and `quality-gate` commands that separate runtime smoke admission from future assistant-quality admission.
- Packer-side raw-f32 trained-source layout validation and `convert-trained` command for converting checked source weights into f32/q8_0/q4_0 `.slm` artifacts, including explicit tied-output source manifests that omit `output.weight`.
- Tiny trained-source fixture under `tests/fixtures/trained-source-tiny/` and scoped eval cases under `tests/fixtures/assistant-quality-eval-cases.txt`.
- Native no-crate `tinyrustlm-eval` runner for executing scoped eval cases against a local `.slm` and writing an eval sidecar.
- No-crate Rust local static server in `tools/local_server/`, plus the older no-dependency Node server script retained for narrow tooling fallback.
- No-crate Rust mini browser harness in `tools/browser_harness/` for static app crawl, required UI contract, local-only asset policy, WASM boundary markers, model/manifest presence, and optional loopback route checks.
- One-layer tiny f32 transformer forward path.
- Greedy local generation over f32, q8_0, and q4_0 tiny fixtures.
- Greedy local generation over the TinyLM-16M-shaped f32 model.
- Greedy local generation over the TinyLM-16M-shaped q8_0 model using direct q8_0 matvec dispatch.
- Greedy local generation over the TinyLM-16M-shaped q4_0 model using direct q4_0 matvec dispatch.
- q8_0 and q4_0 tensors stay in native compact storage without full decoded f32 shadow copies; embedding rows and norm vectors dequantize into scratch on demand.
- Model load pre-resolves top-level and per-layer tensor indices, and the checked-in tied-output fixture proves projection flags route output logits through token embeddings when `output.weight` is omitted.
- Runtime generation allocates reusable scratch buffers and logits with the loaded model, then reuses them across prompt generation and single-token stepping; stochastic sampling uses a fixed candidate buffer instead of a vocab-sized per-token vector.
- Generated result decoding is capped at 64 KiB; byte and BPE decode paths return `OutputBufferExceeded` before replacing `last_result`, and full `generate` failures clear stale token/cache diagnostics.
- Runtime diagnostics with tokenizer output, logits summary, selected token, top-k candidates, KV cache length, quantization mode, and active sampling configuration.
- Handwritten diagnostics JSON escaping for quotes, backslashes, control characters, line separators, and paragraph separators before browser parsing.
- Browser model selector for TinyLM-16M q8_0, TinyLM-16M q4_0, TinyLM-16M f32, f32/q8_0/q4_0 tiny fixtures, the tiny BPE fixture, and the tiny tied-output fixture.
- Browser conversation transcript that appends local User and TinyRustLM turns, keeps text insertion DOM-safe, persists across runtime Reset, and clears through the Clear control.
- Browser Step Token control that calls `generate_next_token` after generation context exists, appends one decoded token to the response and latest TinyRustLM transcript turn, and records the action in the token console.
- Browser product shell footer exposing TinyRustLM, GGUF.MiRust.com, browser-local Rust/WASM identity, and local `.slm` model scope.
- Browser smoke tool for headless Chrome or Edge UI verification.
- Browser UI audit mode for desktop/mobile structure, local-only notice, footer identity, model controls, panel coverage, diagnostics/developer mirror, benchmark fields, layout overflow, and local-only requests.
- Browser smoke and UI audit assertions for transcript state, including empty ready state, disabled Clear button before generation, generated User/TinyRustLM entries, Clear-click transcript removal, and response preservation after clearing history.
- Browser UI audit coverage for the model provenance panel, including deterministic-smoke source, runtime-smoke admission, runtime-execution-only quality claim, trained-quality non-claim, checksum, and required next gate.
- WASM ABI smoke tool for invalid UTF-8, null pointer, invalid length, recovery-after-error, step-token, and model-free verification.
- Visual Studio 2022 solution wrapper in `../TinyRustLM.sln`.

The runtime now proves local generation for f32, q8_0, and q4_0 tiny fixtures, a custom BPE tiny fixture with merged token diagnostics, a tied-output tiny fixture without `output.weight`, and real-shaped TinyLM-16M f32, q8_0, and q4_0 models. Quantized runtime storage no longer carries full decoded f32 shadows for q8_0 or q4_0 tensors, and the generation loop uses model-load-time tensor indices instead of per-token layer-name formatting. The packer can validate and convert raw source-weight bundles into f32, q8_0, and q4_0 artifacts, including tied source bundles where `tied_output=true` agrees with a tied shape name and conversion sets the v1 tied-output flag. The native eval runner can produce scoped fixture evidence for each converted mode. The project still needs real trained weights and broader review before it can claim product assistant quality.

## Build Commands

Native tests:

```powershell
cargo test --workspace
```

Strict Rust public API documentation checks:

```powershell
cargo rustdoc -p tinyrustlm-runtime --lib -- -D missing_docs
cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs
cargo rustdoc -p tinyrustlm-local-server --bin tinyrustlm-local-server -- -D missing_docs
cargo rustdoc -p tinyrustlm-browser-harness --bin tinyrustlm-browser-harness -- -D missing_docs
```

WASM build:

```powershell
rustup target add wasm32-unknown-unknown
cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown
Copy-Item .\target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm .\tinyrustlm\runtime\tinyrustlm.wasm
```

Model packing:

```powershell
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model.slm tiny-fixture
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q8.slm tiny-fixture-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q4.slm tiny-fixture-q4
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-bpe.slm tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-tied.slm tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-f32.slm tinylm16-f32
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-q8.slm tinylm16-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-q4.slm tinylm16-q4
```

Model validation and provenance:

```powershell
cargo run -p tinyrustlm-slm-pack -- validate .\tinyrustlm\models\tinylm16-q8.slm
cargo run -p tinyrustlm-slm-pack -- manifest .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest deterministic-smoke
cargo run -p tinyrustlm-slm-pack -- validate-manifest .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest
cargo run -p tinyrustlm-slm-pack -- quality-gate .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- eval-template .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest .\tinyrustlm\models\tinylm16-q8.slm.eval assistant-quality
```

The validator is a native no-crate admission gate for generated or future converted `.slm` files. It checks header bounds, checksum, byte-tokenizer metadata, required tensor names and shapes, dtype-specific payload lengths, quantization scale ranges, finite f32 payload values, and reports the model shape, tensor count, parameter count, quantization mode, and checksum.

The manifest sidecar is line-based, not JSON. It binds model byte count, `.slm` checksum, shape, tensor count, parameter count, quantization mode, source kind, admission status, and quality boundary. Current artifacts use `source_kind=deterministic-smoke`, `quality_claim=runtime-execution-smoke-only`, and `trained_quality_claim=not-claimed`. The browser app displays this sidecar in the Model Provenance panel after Rust accepts the selected `.slm` model, keeping the trained-quality boundary visible in the local UI.

The quality gate is also line-based and no-crate. `quality-gate ... runtime-smoke` admits deterministic smoke or converted-trained artifacts only for runtime execution evidence. `quality-gate ... assistant-quality <input.eval>` requires `source_kind=converted-trained`, a matching model checksum, a matching manifest checksum, passed task evaluation, passed safety review, and `quality_decision=accepted-for-assistant-quality`. `eval-template` writes a bound pending template; pending templates intentionally fail `assistant-quality` until reviewed evidence replaces the placeholder fields.

Trained source conversion:

```powershell
cargo run -p tinyrustlm-slm-pack -- source-template .\tinyrustlm\tests\fixtures\trained-source-tiny tiny-fixture
cargo run -p tinyrustlm-slm-pack -- validate-source .\tinyrustlm\tests\fixtures\trained-source-tiny
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-f32.slm f32
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q4.slm q4_0
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-tied tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-tied
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-f32.slm f32
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q4.slm q4_0
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest assistant-quality .\target\trained-source-smoke\tiny-converted-q8.eval
```

The source layout is line metadata plus raw little-endian f32 tensor files under `tensors/`. Validation requires safe relative paths, exact byte counts, matching source checksums, expected tensor names and shapes, finite f32 values, bounded absolute weights, nonzero tensor payloads, and agreement between `model_shape` and `tied_output`. Tied source bundles omit `output.weight` and converted `.slm` artifacts carry the v1 tied-output flag. `convert-trained` writes a converted-trained manifest automatically. The standing unit and Visual Studio gates convert the fixture to f32, q8_0, and q4_0 so each advertised output mode is admitted directly; tied-output source conversion is also smoke-gated across f32, q8_0, and q4_0. `tinyrustlm-eval` runs exact fixture cases through the runtime and writes a scoped eval sidecar. The checked-in cases prove only `tiny-converted-source-fixture-only`, not product assistant quality.

Local static server using the no-crate Rust server:

```powershell
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Rust mini browser contract harness:

```powershell
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm --http http://127.0.0.1:8080/app/
```

The legacy Node server remains available for comparison or ad hoc tool checks:

```powershell
node .\tinyrustlm\tools\static-server.js .\tinyrustlm 8080
```

Browser smoke verification:

```powershell
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9225
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9226 tinylm16q4
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9227 tinylm16q8 loop
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9228 tinylm16q8 model-error
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9229 tinylm16q8 context-error
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9230 tinylm16q8 missing-model
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9231 tinylm16q8 endurance 3
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9232 tinylm16q8 performance 4
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9233 tinylm16q8 performance-soak 3 4
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9234 tinylm16q8 ui-audit
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9235 tinylm16q8 step-token
```

WASM ABI boundary smoke:

```powershell
node .\tinyrustlm\tools\wasm-abi-smoke.js
```

The ABI smoke also checks `set_sampling_config`, rejects invalid stochastic settings, restores greedy defaults, verifies diagnostics still report `temperature=0`, `top_k=1`, `top_p=1`, and `seed=1` after recovery generation, requires `generate_next_token` to return an explicit `ErrorCode` while exposing token text through `last_result`, and requires `free_model` to clear loaded-model diagnostics before later generation returns `ModelNotLoaded`. Unit tests cover the 64 KiB generated-result cap for byte and BPE decode paths plus runtime `OutputBufferExceeded` diagnostics.

The browser runtime ships only static HTML, CSS, JS, WASM, and local `.slm` files. The current browser milestone defaults to `tinylm16-q8.slm` and keeps TinyLM-16M q4_0, f32, tiny byte-tokenizer fixtures, the tiny BPE fixture, and the tiny tied-output fixture available for regression checks.

## Current Fixture Behavior

The tiny fixture is intentionally deterministic. Prompt `hi` generates local byte tokens that decode to:

```text
eeeeeeeeeeeee
```

Diagnostics show `argmax=101`, selected token `101`, and active quantization mode `f32`, `q8_0`, or `q4_0` depending on the selected fixture.

The TinyLM-16M f32, q8_0, and q4_0 fixtures are also deterministic. Prompt `hi` with `max_new_tokens=1` generates:

```text
e
```

## Current Local Server

Start a local static server with:

```text
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

The Visual Studio F5 wrapper verifies whether a running server is actually TinyRustLM before reusing it. If port 8080 is occupied by another local service, the wrapper starts the Rust static server on the next free loopback port and opens that URL.

## Visual Studio

Open `..\TinyRustLM.sln` in Visual Studio 2022. `Build Solution` invokes `tools/vs/Build-TinyRustLM.ps1`; `F5` invokes `tools/vs/Run-TinyRustLM.ps1`, reuses a verified TinyRustLM server or starts the local static server, and opens the app.

The Visual Studio test helper can run browser hardening checks:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
.\tools\vs\Test-TinyRustLM.ps1 -PerformanceSoak -PerformanceSoakCycles 3 -PerformanceSoakTokens 4
```
