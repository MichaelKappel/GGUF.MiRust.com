---
title: Browser Converted Trained Source Provenance Memory
source_site: Runtime.MiRust.com
status: current
reviewed_utc: 2026-06-30T09:40:00Z
---

# Browser Converted Trained Source Provenance Memory

## What Changed

- The browser Model Provenance panel now renders verified converted-trained source snapshot identity as Source Snapshot, Source ID, Source Shape, and Source Review rows.
- Converted-trained registry smoke asserts the fixture values `trained-source-fixture`, `tinyrustlm-local-source-fixture`, `tiny-fixture`, and `validated-before-extraction / extract-raw-f32-tensors / 0x00000000000000b1`.
- Static deterministic models render the same rows as `unavailable`, and `ui-audit` checks that fallback on desktop and mobile.
- The Rust browser harness requires the new provenance row ids so the static UI contract remains crawled.

## Why

Converted-trained selector entries already verify the copied `converted-trained.source.manifest` before model bytes. This bead makes the reviewed source identity and review gate visible in the browser so local checkpoint review can see which source snapshot and candidate-review artifact produced the loaded `.slm`.

## Verification

- `C:\Users\AI\.cargo\bin\cargo.exe fmt --all -- --check`
- `node --check tinyrustlm/app/app.js`
- `node --check tinyrustlm/tools/browser-smoke.js`
- `C:\Users\AI\.cargo\bin\cargo.exe test -p tinyrustlm-browser-harness --quiet`
- `C:\Users\AI\.cargo\bin\cargo.exe run -p tinyrustlm-browser-harness -- tinyrustlm`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9387 converted-trained-q8 converted-trained-registry`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9388 converted-trained-q8 converted-trained-source-review-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8187/app/ 9389 converted-trained-q8 converted-trained-source-review-omitted`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8098/app/ 9271 converted-trained-q8 converted-trained-source-identity-drift`
- `node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8098/app/ 9272 tinylm16q8 ui-audit`
- `C:\Users\AI\.cargo\bin\cargo.exe test --workspace --quiet`
- Targeted `git diff --check` for touched tracked files; full `git diff --check` remains blocked by unrelated pre-existing `.uai/startup-packet.uai` trailing whitespace.
