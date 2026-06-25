# Browser Runtime

## Purpose

The browser runtime hosts TinyRustLM as static files and keeps prompts local to the user browser.

## Constraints

The app uses static HTML, custom CSS, handwritten JavaScript, local WASM, and local `.slm` files only. It does not use npm, CDN scripts, frontend frameworks, remote inference APIs, telemetry, analytics, or model downloads from external hosts during inference.

Local development hosting uses the no-crate Rust server in `tools/local_server/`. It serves only the checked-in static tree over loopback, supports `GET` and `HEAD`, rejects traversal paths, and keeps Visual Studio F5 on the Rust toolchain path. The no-crate Rust mini browser harness in `tools/browser_harness/` audits the static app contract and can probe loopback routes before headless browser automation. The older Node server remains only as a narrow fallback utility.

## Data Structures

JavaScript tracks the WASM instance, selected local model path, selected local model manifest, local conversation transcript, max-token control, decoding controls, host-side benchmark timing, exports, UTF-8 encoder/decoder, DOM nodes, and typed-array views over WASM memory. Rust owns runtime state. The transcript is browser-local UI state only: generation appends User and TinyRustLM entries with DOM text nodes, Reset clears runtime context and output without clearing transcript history, and Clear empties the transcript. The Rust mini browser harness tracks required app ids, local file routes, manifest fields, loopback HTTP status, and content types as a test-only contract surface.

## Binary Formats

The Rust local server serves `runtime/tinyrustlm.wasm`, selected local `.slm` files under `models/`, and local `.slm.manifest` sidecars. The browser copies model bytes into WASM memory and calls `load_model`. After Rust accepts the model, JavaScript fetches the matching local `.slm.manifest` sidecar and renders source kind, admission status, quality claim, trained-quality claim, checksum, and required next gate. The default model is `models/tinylm16-q8.slm`; TinyLM-16M q4_0, f32, and tiny fixtures remain selectable for regression checks.

## Failure Cases

Fetch failure, missing model files, WASM instantiation failure, allocation failure, model rejection, UTF-8 transfer failure, model reload failure, missing manifest sidecars, context overflow, and generation errors render in the UI. Model-specific failures disable Generate and Reset while keeping model selection available for recovery after the WASM runtime is loaded. A manifest-sidecar failure does not replace Rust model admission; it leaves inference available while making provenance unavailable.

## Validation Rules

JavaScript does not parse model bytes. It only transfers them. JavaScript parses only the line-based local `.slm.manifest` sidecar after Rust accepts the model so the UI can display the provenance and quality boundary. Temperature, top-k, top-p, and seed controls are clamped in JavaScript, then passed through `set_sampling_config`; Rust validates and owns sampling with a fixed 1024-candidate cap. Rust returns explicit error codes and readable result text for the UI. `generate_next_token` follows that same ABI rule: it returns an `ErrorCode`, writes decoded token text into `last_result`, and exposes the selected token id in diagnostics. The Rust mini browser harness validates the checked-in app tree for required UI ids, model route declarations, manifest fields, local-only markers, Rust WASM export definitions, and optional loopback HTTP content types. The Rust local server is smoke-tested with direct HTTP probes for `/app/`, `/runtime/tinyrustlm.wasm`, `.slm`, and `.slm.manifest` routes. `tools/browser-smoke.js` verifies the UI by loading the app in headless Chrome or Edge, clicking Generate, reading rendered output and diagnostics, asserting transcript entries, Clear-click behavior, and Clear-button state, auditing desktop/mobile product-shell structure, checking default greedy sampling controls, checking the provenance panel, checking repeated q8/q4 generation with reset, intercepting malformed local model bytes, intercepting missing local model files, submitting an over-context prompt, running endurance loops, and asserting local-only network requests.

## Future Expansion Path

Later UI work can add richer benchmark charts and a reviewed trained-model selector once real trained weights and assistant-quality evidence exist. Missing-file UI coverage, context overflow rendering, malformed model rejection, repeated q8/q4 loops, transcript rendering, desktop/mobile shell audit, provenance-panel audit, endurance loops, sampling ABI validation, invalid UTF-8 WASM ABI checks, single-token stepping, and model-free behavior are covered by smoke tools. Tokenizer detail, logits summary, top-k candidates, KV cache length, quant mode, active sampling config, host-side benchmark timing, transcript history, and model quality boundary are already exposed in the UI.
