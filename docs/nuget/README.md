# TinyRustLM NuGet SDK

TinyRustLM NuGet packages expose the protected public SDK surface for `.slm` adoption:

- `TinyRustLM.Abstractions`: public interfaces and DTOs.
- `TinyRustLM.Core`: native-backed `.slm` inspection plus runtime harness operations.
- `TinyRustLM.P2P`: metadata-bound P2P share/import workflows, including local piece verification, assembly from a validated manifest, and receipt-sidecar inspection.

The package intentionally does not include model conversion, quantization authoring, adapter authoring, selector generation, offline breeding, lineage promotion, premium routing, telemetry, licensing internals, or commercial orchestration.

## Publication Status

Treat built packages as publish-ready only after `eng\verify-package.ps1`, the dry-run publish plan, and `eng\audit-nuget-release-readiness.ps1` pass or report a non-blocked state. Treat a public or private feed as current only after `eng\verify-feed-current.ps1 -NuGetSource <feed>` passes for all three package IDs.

The July 6, 2026 NuGet.org check showed no listed versions for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, or `TinyRustLM.P2P`, so the local `0.1.1` artifacts are not yet public on NuGet.org. The checked-in release path is locally verified, but public availability must not be claimed until an authenticated publish completes and the post-publish feed-current and feed-hash verifiers pass.

NuGet.org publication supports two authenticated modes in `.github/workflows/release-nuget.yml`: `api_key` for a scoped `NUGET_API_KEY`, and `trusted_publishing` for NuGet.org Trusted Publishing through GitHub OIDC. Trusted Publishing is only valid for NuGet.org sources; private feeds must use `api_key` mode with scoped private-feed credentials.

## Build Locally

```powershell
eng\verify-package.ps1
```

On Unix-like shells, use `eng/verify-package.sh`.

The PowerShell and Bash verifiers build the Rust native bridge, run Rust tests, restore/build/test the .NET solution, pack NuGet packages into `artifacts/packages`, inspect packages for private-authoring leakage plus source/debug/generated-output/local-path leakage, prove the exact source-versioned package set contains only `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`, prove each package's nuspec `id` and `version` match its protected filename and source version, prove declared package files such as `README.md` and `LICENSE.txt` are present and byte-match the current `docs/nuget` sources, prove every `.nupkg` entry is within the public package allow-list, prove the packages use only the expected same-version public dependency graph with `exclude=Build,Analyzers` dependency metadata, then install the produced packages into a clean temporary console app and exercise `.slm` inspect/load/generate plus metadata-bound P2P share/import, announcement JSON handoff, catalog application and inspection, and receipt-inspection workflows from package references.

Local verification requires the current machine's native runtime asset. The official `release-nuget.yml` workflow builds native bridge artifacts on `windows-latest`, `ubuntu-latest`, `macos-13`, and `macos-14`, then packs only after `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64` native assets are present in `TinyRustLM.Core`. The package audit fails if native runtime entries appear in `TinyRustLM.Abstractions` or `TinyRustLM.P2P`; those packages remain managed public API/metadata wrappers. The Core package may contain only the expected RID/native filenames: `tinyrustlm_native.dll` for Windows, `libtinyrustlm_native.so` for Linux, and `libtinyrustlm_native.dylib` for macOS.

Every PowerShell and Bash verifier run writes `artifacts/reports/tinyrustlm-nuget-package-audit.json`. The audit report records the expected package names, missing/unexpected package entries, package identity checks, package SHA-256 values, byte counts, ZIP entry names, allowed package entry patterns, unexpected package content entries, required NuGet metadata, XML documentation entries, packaged documentation source/hash parity, dependencies, expected dependency metadata, native runtime IDs, native entries, allowed native entries, required RID gaps, private-surface scan results, source/debug-symbol/generated-output leakage counts, and local absolute path match counts for release evidence. The package content allow-list is intentionally narrow: NuGet metadata, nuspec, README/license, package-specific public docs, `lib/net8.0` DLL/XML outputs, and approved Core native runtime assets.

To audit the publish set without pushing:

```powershell
eng\publish-nuget.ps1 -SkipVerification -DryRun
```

Run this after `eng\verify-package.ps1` or `eng/verify-package.sh`, because dry-run and real publish paths now bind the package push set to `artifacts/reports/tinyrustlm-nuget-package-audit.json`. The real publish path requires `NUGET_API_KEY` or `-ApiKey` and uses the same package-set validation before `dotnet nuget push --skip-duplicate`; in Trusted Publishing workflow runs, `NuGet/login@v1` supplies `-ApiKey` from a short-lived NuGet.org token. The publish set must contain exactly `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P` at the source-declared version; stale or unintended extra `TinyRustLM*.nupkg` files fail the dry run and the real publish path. Missing or mismatched audit evidence also fails closed before publication.

Every dry run and publish attempt writes `artifacts/reports/tinyrustlm-nuget-publish-plan.json`. The publish-plan report records the exact package names, SHA-256 values, byte counts, package version, package source, target feed, package-audit report hash, audit match status, dry-run/push status, and `secret_material_included=false`. If an authenticated push fails after the publish set is validated, the report status becomes `push_failed` and records a redacted `publish_error` instead of leaving stale `ready_to_push` evidence. The release workflow validates and uploads this report whenever it exists, including failed authenticated push attempts.

To audit the full release state without pushing:

```powershell
eng\audit-nuget-release-readiness.ps1
```

On Unix-like shells, use `eng/audit-nuget-release-readiness.sh`. The audit refreshes the dry-run publish plan, verifies the local package folder with feed-current and feed-hash checks, checks the configured remote feed for the declared version, verifies remote package bytes when that version is already listed, and writes `artifacts/reports/tinyrustlm-nuget-release-readiness.json`. Each subreport path is cleared before its step runs, and each readiness step records `report_written`, so stale JSON from a previous run cannot be reused as current publish evidence. The report never stores API-key material; it records only `auth_mode`, `api_key_present`, `trusted_publishing_requested`, and `trusted_publishing_supported`. Status values include `ready_to_publish`, `published_current`, `blocked_missing_api_key`, `blocked_trusted_publishing_unsupported`, `blocked_local_verification`, `blocked_feed_status_unknown`, and `blocked_remote_hash_mismatch`. Pass `-AuthMode trusted_publishing` for a NuGet.org OIDC readiness check, `-FailOnBlocked` in PowerShell, or `FAIL_ON_BLOCKED=1` on Unix-like shells when a CI gate should fail on blocked states. The official release workflow skips the push step when readiness is already `published_current`, then still runs the mandatory feed-current and feed-hash gates.

For NuGet.org Trusted Publishing, configure a trusted publishing policy on NuGet.org for this GitHub repository, workflow file `release-nuget.yml`, and environment `nuget-release`; then dispatch the release workflow with `auth_mode=trusted_publishing` and a NuGet username from the `nuget_user` input, repository variable `NUGET_USER`, or secret `NUGET_USER`. The workflow grants `id-token: write`, calls `NuGet/login@v1`, and passes the temporary key to the same audited `eng\publish-nuget.ps1` path used by API-key releases.

After a package is available on a feed, run a clean consumer smoke directly against that feed when you want the heavier install/runtime/P2P workflow proof:

```powershell
eng\verify-feed.ps1 -NuGetSource <feed-url-or-source-name>
```

This creates an isolated temporary NuGet cache, installs `TinyRustLM.Core` and `TinyRustLM.P2P` from the feed at the version declared in `dotnet/Directory.Build.props`, then runs `.slm` inspect/load/generate plus metadata-bound P2P share/import, announcement JSON handoff, catalog application and inspection, and receipt-inspection workflows. It writes `artifacts/reports/tinyrustlm-nuget-feed-smoke.json`; Unix runs fail early with a clear report message when the `dotnet` CLI is unavailable. Pass `-PackageVersion <version>` only when verifying an older already-published version.

To prove the feed itself is current for all protected SDK package IDs:

```powershell
eng\verify-feed-current.ps1 -NuGetSource <v3-feed-url-or-local-package-folder>
```

On Unix-like shells, use `eng/verify-feed-current.sh <v3-feed-url-or-local-package-folder>`.

The current-version verifier writes `artifacts/reports/tinyrustlm-nuget-feed-current.json` and fails if any of `TinyRustLM.Abstractions`, `TinyRustLM.Core`, or `TinyRustLM.P2P` is missing the version declared in `dotnet/Directory.Build.props` or if the feed reports a newer version than the source tree. Use `-AllowNewer` or `ALLOW_NEWER=1` only when intentionally verifying an older maintenance branch.

To prove the feed serves the exact package bytes recorded in the publish plan:

```powershell
eng\verify-feed-package-hashes.ps1 -NuGetSource <v3-feed-url-or-local-package-folder>
```

On Unix-like shells, use `eng/verify-feed-package-hashes.sh <v3-feed-url-or-local-package-folder>`.

The feed-hash verifier reads `artifacts/reports/tinyrustlm-nuget-publish-plan.json`, downloads or reads each package from the feed, compares SHA-256 values and byte counts, and writes `artifacts/reports/tinyrustlm-nuget-feed-hashes.json`. The official release workflow always runs feed-current and feed-hash checks after publishing, with short retries for feed indexing delay. The workflow input `verify_after_publish` controls only the heavier clean consumer smoke.

## Ongoing Feed Monitoring

`.github/workflows/nuget-feed-monitor.yml` runs the feed-current verifier manually through `workflow_dispatch` and can also run on a daily schedule. Scheduled runs are disabled until repository variable `TINYRUSTLM_NUGET_MONITOR_ENABLED` is set to `true`, which avoids noisy failures before the packages are published. For scheduled private-feed monitoring, set `TINYRUSTLM_NUGET_SOURCE` to the feed's NuGet v3 index URL. Set `TINYRUSTLM_NUGET_MONITOR_ALLOW_NEWER=true` only for intentionally older maintenance branches. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER=true` when the scheduled monitor should also run `eng/verify-feed.ps1` and upload `tinyrustlm-nuget-feed-smoke.json`. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES=true` and `TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT=<path>` only when the retained publish-plan JSON is available in the monitor checkout or runner environment.

## Minimal Runtime Use

```csharp
using TinyRustLM;

var inspector = new TinySlmInspector();
var inspection = inspector.Inspect("model.slm");

var factory = new TinyRustLmRuntimeFactory();
var version = factory.GetVersion();
Console.WriteLine($"{version.Product} {version.SdkVersion} ABI {version.NativeAbiVersion}");
using var runtime = factory.CreateRuntime();
runtime.LoadModel("model.slm", inspection.Sha256);
var result = runtime.Generate("hello", new TinyRustLmGenerationOptions(MaxNewTokens: 32));
Console.WriteLine(result.Text);
```

The .NET wrapper and native public runtime SDK validate generation options before runtime mutation: `MaxNewTokens` / `max_new_tokens` must be greater than zero, `Temperature` / `temperature` must be finite and non-negative, `TopK` / `top_k` must be between 1 and 1024, and `TopP` / `top_p` must be finite in `(0, 1]`. Direct native callers receive an `invalid_generation_options` JSON envelope before runtime-handle lookup when the values violate that public fixed-buffer sampler contract.

Managed path, prompt, and JSON handoff strings are also checked for embedded NUL characters before P/Invoke. This prevents accidental C-string truncation at the native boundary for `.slm` paths, generation prompts, P2P manifests, announcements, catalogs, receipts, and share-kit request fields.

The .NET P2P wrapper enforces the public Rust byte budgets before P/Invoke for JSON handoff documents: manifests are capped at 1 MiB, announcements and local import receipts at 256 KiB, and announcement catalogs at 4 MiB. Oversized managed handoff strings fail as argument errors before native C-string allocation or Rust parsing.

The managed bridge preserves empty strings as real native empty strings instead of converting them to null pointers. Optional string arguments still use null for "not supplied", but an empty prompt remains an empty prompt through the native runtime call.

## Minimal P2P Share Use

```csharp
using TinyRustLM;

var p2p = new TinyRustLmP2PClient();
var report = p2p.PrepareLocalShareKit(new PrepareShareKitRequest(
    ModelPath: "model.slm",
    OutputDir: "share-kit",
    PeerId: "local-peer",
    PublicBaseUrl: "https://peer.example/tinyrustlm"));
var metadata = p2p.ExportShareMetadata(File.ReadAllText(report.ManifestPath));
var announcement = p2p.ValidateAnnouncement(File.ReadAllText(report.AnnouncementPath!));
var catalogJson = p2p.ApplyReceivedAnnouncementJson(File.ReadAllText(report.AnnouncementPath!));
var catalogInspection = p2p.InspectAnnouncementCatalog(catalogJson);
var manifestJson = File.ReadAllText("share-kit/tinyrustlm.p2p-manifest.v0.json");
var receipt = p2p.ImportFromManifest(manifestJson, "share-kit", "imported.slm");
var inspection = p2p.InspectLocalImportReceipt(
    File.ReadAllText(receipt.ReceiptPath),
    "imported.slm");
```

`PrepareLocalShareKitJson`, `ExportShareMetadataJson`, `ValidateAnnouncementJson`, `ApplyReceivedAnnouncementJson`, and `InspectAnnouncementCatalogJson` are available when a caller needs the exact native JSON document for file handoff or auditing, but the primary .NET API returns typed records. Catalog application deduplicates honest announcement replays while rejecting conflicting same-peer/same-manifest metadata, and catalog inspection enforces a 4 MiB pre-parse byte budget.

The .NET P2P wrapper validates `PrepareShareKitRequest` before serializing to native JSON: `ModelPath` and `OutputDir` must be present, and `PieceSize` must be omitted or between 1 KiB and 16 MiB. Deeper identifier, public URL, manifest, and artifact validation remains enforced by the Rust P2P SDK.

See `API_BOUNDARY.md`, `PACKAGE_SECURITY.md`, `P2P_SHARE_FLOW.md`, and `SLM_VALIDATION.md` before publishing packages outside a private feed.
