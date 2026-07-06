# Private Feed Publishing

TinyRustLM packages should be published to a private NuGet feed until the public SDK boundary has completed legal, security, and product review.

As of the July 6, 2026 public-feed check, NuGet.org did not list `TinyRustLM.Abstractions`, `TinyRustLM.Core`, or `TinyRustLM.P2P`. Use the private-feed flow below for review, then promote to NuGet.org only with an authenticated publish run and passing post-publish feed-current/feed-hash verification.

Private feeds must use scoped feed credentials through `api_key` mode. NuGet.org Trusted Publishing is supported only for NuGet.org sources, where a NuGet.org trusted publishing policy can exchange a GitHub OIDC token for a short-lived push key.

## Recommended Flow

1. Run `eng/verify-package.ps1` locally, or `eng/verify-package.sh` on Unix-like shells, or use `release-nuget.yml` for a publish candidate that must include `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64` native bridge artifacts.
2. Review `artifacts/packages/*.nupkg` and `artifacts/reports/tinyrustlm-nuget-package-audit.json`.
3. Confirm the audit report status is `pass`, package SHA-256 values are recorded, required metadata and XML-documentation gaps are empty, private-surface matches are empty, source/debug-symbol/generated-output leakage counts are zero, local absolute path match counts are zero, and native RID coverage matches the intended feed audience.
4. Audit the package push set:

```powershell
eng\publish-nuget.ps1 -SkipVerification -DryRun -PackageSource artifacts\packages
```

The dry run and real publish path reject stale or unintended extra `TinyRustLM*.nupkg` files. The package source must contain exactly `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P` at the version declared by `dotnet/Directory.Build.props`, and those package names, SHA-256 values, and byte counts must match the package-audit report from step 2.

The publish command writes `artifacts/reports/tinyrustlm-nuget-publish-plan.json` with package SHA-256 values, byte counts, package source, package-audit report hash, audit match status, target feed, and dry-run or push status. The report deliberately records `secret_material_included=false`. Authenticated push failures are recorded as `push_failed` with a redacted `publish_error`; the official release workflow still validates and uploads that report when it exists.

5. Run the release-readiness audit before pushing:

```powershell
eng\audit-nuget-release-readiness.ps1 -NuGetSource <private-feed-url>
```

The audit writes `artifacts/reports/tinyrustlm-nuget-release-readiness.json` with local feed-current/hash evidence, target-feed status, blocker status, `auth_mode`, and only non-secret credential metadata such as boolean `api_key_present`. Use `-AuthMode api_key -FailOnBlocked` in automation when the private feed must be publishable from that environment. `-AuthMode trusted_publishing` is intentionally blocked for non-NuGet.org sources. When the official release workflow sees `published_current`, it skips the push step and still runs the mandatory feed-current/feed-hash gates.

6. Publish to a private feed:

```powershell
eng\publish-nuget.ps1 -SkipVerification -PackageSource artifacts\packages -NuGetSource <private-feed-url> -ApiKey <token>
```

Preserve `artifacts/reports/tinyrustlm-nuget-package-audit.json`, `artifacts/reports/tinyrustlm-nuget-release-readiness.json`, and `artifacts/reports/tinyrustlm-nuget-publish-plan.json` with release evidence.

When using `.github/workflows/release-nuget.yml` for a private feed, dispatch it with `auth_mode=api_key`, `source=<private-v3-feed-url>`, and a repository secret `NUGET_API_KEY` scoped to the package push operation.

7. Once the feed has indexed the package and credentials are configured, run the optional post-publish consumer smoke:

```powershell
eng\verify-feed.ps1 -NuGetSource <private-feed-url-or-source-name>
```

This writes `artifacts/reports/tinyrustlm-nuget-feed-smoke.json` with the clean consumer smoke status, package version, feed source, and no-secret-material flag.

8. Verify that the feed now exposes the source-declared package version for all three protected packages. The official release workflow runs this gate automatically after every publish:

```powershell
eng\verify-feed-current.ps1 -NuGetSource <private-v3-feed-url>
```

On Unix-like shells, use `eng/verify-feed-current.sh <private-v3-feed-url>`.

This writes `artifacts/reports/tinyrustlm-nuget-feed-current.json` with the declared version, latest reported version, and current-version status for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`.

9. Verify that the feed serves the exact package bytes from the publish plan. The official release workflow runs this gate automatically after every publish:

```powershell
eng\verify-feed-package-hashes.ps1 -NuGetSource <private-v3-feed-url-or-package-folder>
```

This writes `artifacts/reports/tinyrustlm-nuget-feed-hashes.json` with per-package SHA-256 and byte-count match evidence.

For ongoing private-feed monitoring, set repository variable `TINYRUSTLM_NUGET_MONITOR_ENABLED=true` and `TINYRUSTLM_NUGET_SOURCE=<private-v3-feed-url>`, then use `.github/workflows/nuget-feed-monitor.yml` for scheduled or manual feed-current reports. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER=true` after feed credentials and native runtime assets are ready for scheduled clean consumer install/runtime/P2P smoke reports. Set `TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES=true` and `TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT=<path>` only when the retained publish-plan JSON is available to the monitor.

10. Run `eng/verify-consumer.ps1 -PackageSource artifacts\packages` if you need to repeat the local artifact install smoke separately from the full verifier.
11. Install from a clean sample application against the private feed and verify that only `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, docs, and runtime-native assets are present.

## Feed Policy

Use scoped credentials, immutable package versions, package retention, and manual approval for public promotion. Do not publish packages that include private conversion, adapter, selector, breeding, or training artifacts.
