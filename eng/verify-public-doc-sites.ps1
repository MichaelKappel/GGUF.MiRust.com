param(
    [string[]]$SiteRoots = @(),
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SourceRoot = Resolve-Path (Join-Path $RepoRoot "..")
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-public-doc-sites-audit.json"
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function New-Check {
    param(
        [string]$Name,
        [string]$Path,
        [string[]]$RequiredTerms = @(),
        [string[]]$ForbiddenTerms = @()
    )

    $exists = Test-Path -LiteralPath $Path -PathType Leaf
    $text = if ($exists) { Get-Content -LiteralPath $Path -Raw } else { "" }
    $missingTerms = @($RequiredTerms | Where-Object {
        $text.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -lt 0
    })
    $forbiddenMatches = @($ForbiddenTerms | Where-Object {
        $text.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
    $status = if ($exists -and $missingTerms.Count -eq 0 -and $forbiddenMatches.Count -eq 0) { "pass" } else { "fail" }

    return [ordered]@{
        name = $Name
        path = $Path
        exists = $exists
        status = $status
        sha256 = if ($exists) { Get-FileSha256 -Path $Path } else { "" }
        required_terms = @($RequiredTerms)
        missing_terms = @($missingTerms)
        forbidden_terms = @($ForbiddenTerms)
        forbidden_matches = @($forbiddenMatches)
    }
}

if ($SiteRoots.Count -eq 0) {
    $SiteRoots = @(
        (Join-Path $SourceRoot "TinyRustLM.com"),
        (Join-Path $SourceRoot "TinyRustLM.MiRust.com"),
        (Join-Path $SourceRoot "MiniModel.org"),
        (Join-Path $SourceRoot "MiniModel.MiRust.com")
    )
}

$resolvedSiteRoots = @($SiteRoots | ForEach-Object {
    if (Test-Path -LiteralPath $_ -PathType Container) {
        (Resolve-Path -LiteralPath $_).Path
    }
    else {
        $_
    }
})

$checks = New-Object System.Collections.Generic.List[object]
$siteRootReports = New-Object System.Collections.Generic.List[object]
foreach ($siteRoot in $resolvedSiteRoots) {
    $siteRootReports.Add([ordered]@{
        path = $siteRoot
        exists = Test-Path -LiteralPath $siteRoot -PathType Container
    })
}

$siteMap = @{
    "TinyRustLM.com" = @(
        "README.md",
        "llms.txt",
        "llms-full.txt"
    )
    "TinyRustLM.MiRust.com" = @(
        "README.md",
        "llms.txt",
        "llms-full.txt",
        "docs/long-term-memory.md",
        "data/pages.php"
    )
    "MiniModel.org" = @(
        "docs/catalog-boundary.md"
    )
    "MiniModel.MiRust.com" = @(
        "README.md",
        "llms.txt",
        "llms-full.txt",
        "docs/catalog-boundary.md"
    )
}

$commonRequiredTerms = @(
    "TinyRustLM.Abstractions",
    "TinyRustLM.Core",
    "TinyRustLM.P2P",
    "TinyRustLM.Memory",
    ".snupkg",
    "symbol package",
    "symbol-hash-bound"
)
$shaRequiredTerms = @("SHA256SUMS", "symbol_publish_mode", "explicit_snupkg_push_after_primary_package")
$browserFeedRequiredTerms = @("SymbolsPackage", "PDB evidence", "NuGet Package Manager", "debug-symbol sidecar")
$browserFeedCurrentRequiredTerms = @(
    "TINYRUSTLM_FEED_PACKAGE_IDS",
    "UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT",
    "uaix-browser-nuget-feed-current.json"
)
$browserPublishRequiredTerms = @(
    "release-browser-nuget.yml",
    "audit-browser-nuget-release-readiness.ps1",
    "uaix.browser.nuget.release_readiness.v0",
    "uaix-browser-nuget-release-readiness.json",
    "published_current",
    "blocked_remote_hash_mismatch",
    "VersionPrefix",
    "publish-browser-nuget.ps1",
    "uaix.browser.nuget.publish_plan.v0",
    "uaix-browser-nuget-publish-plan.json",
    "uaix-browser-nuget-feed-hashes.json",
    "UAIX.Browser.p2pLLM.Runtime"
)
$browserNuGetPublishedRequiredTerms = @(
    "UAIX.Browser.Core.Abstractions",
    "UAIX.Browser.p2pLLM.Runtime",
    "UAIX.Browser.p2pRuntime.P2P",
    "UAIX.Browser.Memory",
    "UAIX.Browser.p2pLLM.Conversion",
    "0.1.6",
    "post-publish verified"
)
$uiVerificationRequiredTerms = @(
    "tinyrustlm.ui_verification.v0",
    "verify-tinyrustlm-ui.ps1",
    "source-options-ui",
    "local-connect-approval-ui",
    "local-connect-endpoint-ui",
    "local-connect-rust-endpoint-ui",
    "Local .slm",
    "Hugging Face",
    "P2P import",
    "Advanced tools"
)
$publicRootVerificationRequiredTerms = @(
    "tinyrustlm.public_root_verification.v0",
    "verify-tinyrustlm-public-root.ps1",
    "verify-tinyrustlm-public-root.sh",
    "tinyrustlm-public-root-verification.json",
    "tinyrustlm.com-loopback-browser-smoke",
    "public-local-only",
    "catalog-local-import",
    "local-import-ambiguous-selection",
    "peer-url-unsafe-ui"
)
$browserMemoryFileDeckRequiredTerms = @(
    "FileDeck",
    "FileDeck 62 required",
    "local-memory-deck-ui",
    "UAIX memory active",
    "UAIX exports verified",
    "persona source evidence bound",
    "uaix_memory=advanced_persona_profile"
)

foreach ($siteRoot in $resolvedSiteRoots) {
    $siteName = Split-Path -Leaf $siteRoot
    if (-not $siteMap.ContainsKey($siteName)) {
        continue
    }
    foreach ($relativePath in $siteMap[$siteName]) {
        $requiredTerms = @($commonRequiredTerms)
        if ($siteName -in @("TinyRustLM.com", "TinyRustLM.MiRust.com", "MiniModel.org", "MiniModel.MiRust.com")) {
            $requiredTerms += $shaRequiredTerms
            $requiredTerms += $browserNuGetPublishedRequiredTerms
        }
        if ($siteName -in @("TinyRustLM.com", "TinyRustLM.MiRust.com")) {
            $requiredTerms += $browserFeedRequiredTerms
            $requiredTerms += $browserFeedCurrentRequiredTerms
            $requiredTerms += $browserPublishRequiredTerms
            $requiredTerms += $uiVerificationRequiredTerms
            $requiredTerms += $publicRootVerificationRequiredTerms
            $requiredTerms += $browserMemoryFileDeckRequiredTerms
        }
        elseif ($relativePath -eq "docs/catalog-boundary.md") {
            $requiredTerms += @("SHA256SUMS-bound")
        }

        $checks.Add((New-Check `
            -Name "$siteName/$relativePath" `
            -Path (Join-Path $siteRoot $relativePath) `
            -RequiredTerms $requiredTerms))
    }
}

$staleMatches = New-Object System.Collections.Generic.List[object]
$staleLiteralPatterns = @(
    'authenticated publish plus feed-current and feed-hash verification',
    'feed-current and feed-hash verification passes',
    'feed-current plus feed-hash verification',
    'NuGet.org has zero listed versions',
    'NuGet.org reports zero listed versions',
    'blocked_missing_api_key',
    'version `0.1.1` with SHA256SUMS-bound package-hash evidence',
    'version `0.1.2` and passed clean consumer',
    'TinyRustLM.Abstractions, TinyRustLM.Core, and TinyRustLM.P2P',
    'TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P'
)

$staleScanFiles = @($checks.ToArray() |
    Where-Object { $_.exists } |
    ForEach-Object { Get-Item -LiteralPath $_.path })
foreach ($file in $staleScanFiles) {
    $lineNumber = 0
    foreach ($line in (Get-Content -LiteralPath $file.FullName)) {
        $lineNumber++
        if ($line.Contains("TinyRustLM.Abstractions") -and $line.Contains("TinyRustLM.P2P") -and -not $line.Contains("TinyRustLM.Memory")) {
            $staleMatches.Add([ordered]@{
                path = $file.FullName
                line = $lineNumber
                pattern = "three_package_without_memory"
                text = $line
            })
        }
        foreach ($pattern in $staleLiteralPatterns) {
            if ($line.IndexOf($pattern, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $staleMatches.Add([ordered]@{
                    path = $file.FullName
                    line = $lineNumber
                    pattern = $pattern
                    text = $line
                })
            }
        }
    }
}

$missingRoots = @($siteRootReports | Where-Object { -not $_.exists })
$missingFiles = @($checks | Where-Object { -not $_.exists })
$failedChecks = @($checks | Where-Object { $_.status -ne "pass" })
$status = if ($missingRoots.Count -eq 0 -and $failedChecks.Count -eq 0 -and $staleMatches.Count -eq 0) { "pass" } else { "fail" }

$report = [ordered]@{
    schema = "tinyrustlm.docs.public_site_audit.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = $status
    repository_root = (Resolve-Path -LiteralPath $RepoRoot).Path
    source_root = (Resolve-Path -LiteralPath $SourceRoot).Path
    secret_material_included = $false
    site_roots = @($siteRootReports.ToArray())
    missing_site_root_count = $missingRoots.Count
    missing_file_count = $missingFiles.Count
    failed_check_count = $failedChecks.Count
    stale_match_count = $staleMatches.Count
    checks = @($checks.ToArray())
    stale_matches = @($staleMatches.ToArray())
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "TinyRustLM public doc-sites audit written to $ReportOutput"

if ($status -ne "pass") {
    throw "TinyRustLM public doc-sites audit failed. See $ReportOutput"
}
Write-Host "TinyRustLM public doc-sites audit passed."
