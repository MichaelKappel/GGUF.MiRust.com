# TinyRustLM Enterprise Quality Round Memory - 2026-07-02

## Scope

This quality pass focused on the browser-local TinyRustLM source-option surface, especially Hugging Face metadata search and the MiniModel P2P source lane. The goal was to reduce repeated UI code, make source-state decisions easier to audit, strengthen automated regression coverage, and keep public documentation aligned with the deployable source.

## Refactor

`tinyrustlm/app/app.js` now has shared DOM/action helpers for repeated model-result rows:

- `elementWithText`
- `actionButton`
- `externalActionLink`
- `modelResultItem`

The Hugging Face rendering path now computes one row view model through `hfResultView`, then derives simple and advanced text from shared helper functions. This consolidates the previous duplicated compatibility checks across `renderHfResults` and `renderSimpleHfResults`.

The simple Hugging Face lane keeps the user-facing action model:

- P2P enabled by default.
- Peer-proof MiniModel matches show `P2P Import`.
- Non-peer-ready rows show `Start Conversion`.
- Disabling P2P changes all simple primary actions to `Start Conversion`.
- The disabled-P2P warning is list-level only.
- No simple row exposes `Choose converted .slm`, `Save Conversion Request`, or `Save Rust Conversion Script`.

The advanced lane still exposes lower-level `Use MiniModel Metadata`, `Save Conversion Request`, and `Save Rust Conversion Script` controls for pro workflows.

## Root Route

`tinyrustlm/index.html` is now the public app shell for TinyRustLM.com `/`, with assets loaded from `./app/app.css` and `./app/app.js`. `/app/` remains a secondary route. `tinyrustlm/.htaccess` no longer redirects root to `/app/`; it keeps the WASM content type rule.

## Test Hardening

`tinyrustlm/tools/browser-smoke.js` now captures primary simple Hugging Face action buttons separately from explanatory text:

- `primaryActionTextsAfterSearch`
- `primaryActionTextsAfterP2pDisable`

The `hf-search-ui` smoke now asserts:

- search and refilter clicks keep the source chooser open
- P2P starts enabled
- the P2P-enabled primary actions are exactly one `Start Conversion` and one `P2P Import`
- exactly one disabled-P2P warning element exists
- disabling P2P produces exactly two `Start Conversion` primary actions
- simple rows do not expose old per-row conversion/import controls
- no Hugging Face `/resolve/` byte route is exposed
- `Start Conversion` saves the local Rust conversion script handoff

## Documentation

TinyRustLM.MiRust.com documentation was updated so the source-options implementation note names TinyRustLM.com `/` as the deploy target and describes the corrected Hugging Face P2P action model.

## Verification

Local verification for this pass included:

- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `node tinyrustlm/tools/browser-smoke.js http://127.0.0.1:8099/ 9273 tinylm16q8 hf-search-ui`

The focused browser smoke proved root-route app loading, open source chooser behavior, P2P default-on behavior, exact simple primary-action labels, single list-level disabled-P2P warning, no Hugging Face model-byte route, and local conversion-script handoff.

## Boundaries

This pass did not add peer networking, server-side model execution, project-server model-byte hosting, or Hugging Face model-byte proxying. TinyRustLM remains browser-local, and every runnable model path still converges on local `.slm` verification.
