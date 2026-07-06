param(
    [string]$NuGetSource = "",
    [string]$PublishPlanReport = "",
    [string]$ReportOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $PublishPlanReport) {
    $PublishPlanReport = if ($env:TINYRUSTLM_PUBLISH_PLAN_REPORT) {
        $env:TINYRUSTLM_PUBLISH_PLAN_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-publish-plan.json"
    }
}
if (-not $ReportOutput) {
    $ReportOutput = if ($env:TINYRUSTLM_FEED_HASH_REPORT) {
        $env:TINYRUSTLM_FEED_HASH_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-feed-hashes.json"
    }
}

function Get-FileSha256 {
    param([string]$Path)

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-NuGetFlatContainerBaseUrl {
    param([string]$Source)

    $index = Invoke-RestMethod -Uri $Source -Headers @{ "User-Agent" = "TinyRustLM-NuGet-Hash/1.0" }
    $resource = $index.resources | Where-Object {
        $resourceTypes = @($_."@type")
        @($resourceTypes | Where-Object { [string]$_ -like "*PackageBaseAddress/3.0.0*" }).Count -gt 0
    } | Select-Object -First 1
    if (-not $resource -or -not $resource."@id") {
        throw "NuGet source does not expose PackageBaseAddress/3.0.0: $Source"
    }
    $baseUrl = [string]$resource."@id"
    if (-not $baseUrl.EndsWith("/")) {
        $baseUrl += "/"
    }
    return $baseUrl
}

function Get-RemotePackageUrl {
    param(
        [string]$FlatContainerBaseUrl,
        [string]$PackageId,
        [string]$PackageVersion
    )

    $lowerId = $PackageId.ToLowerInvariant()
    $lowerVersion = $PackageVersion.ToLowerInvariant()
    return "$FlatContainerBaseUrl$lowerId/$lowerVersion/$lowerId.$lowerVersion.nupkg"
}

if (-not (Test-Path -LiteralPath $PublishPlanReport)) {
    throw "Publish plan report does not exist: $PublishPlanReport"
}
$PublishPlanReport = (Resolve-Path -LiteralPath $PublishPlanReport).Path
$publishPlan = Get-Content -LiteralPath $PublishPlanReport -Raw | ConvertFrom-Json
if ($publishPlan.schema -ne "tinyrustlm.nuget.publish_plan.v0") {
    throw "Publish plan report schema mismatch: $($publishPlan.schema)"
}
if (-not $publishPlan.package_audit_match) {
    throw "Publish plan report is not bound to a passing package audit: $PublishPlanReport"
}

$sourceKind = if (Test-Path -LiteralPath $NuGetSource -PathType Container) { "folder" } else { "nuget-v3" }
$resolvedSource = if ($sourceKind -eq "folder") { (Resolve-Path -LiteralPath $NuGetSource).Path } else { $NuGetSource }
$flatContainerBaseUrl = if ($sourceKind -eq "nuget-v3") { Get-NuGetFlatContainerBaseUrl -Source $NuGetSource } else { "" }
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "tinyrustlm-feed-hashes-$([Guid]::NewGuid().ToString('N'))"

$packageReports = @()
try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    foreach ($package in @($publishPlan.packages)) {
        $name = [string]$package.name
        $packageId = [string]$package.package_id
        $expectedSha256 = ([string]$package.sha256).ToLowerInvariant()
        $expectedByteCount = [int64]$package.byte_count
        $sourcePath = ""
        $actualSha256 = ""
        $actualByteCount = 0
        $present = $false
        $errorMessage = ""

        try {
            if ($sourceKind -eq "folder") {
                $sourcePath = Join-Path $resolvedSource $name
                if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
                    throw "Package file does not exist in feed folder: $sourcePath"
                }
            }
            else {
                $sourcePath = Get-RemotePackageUrl -FlatContainerBaseUrl $flatContainerBaseUrl -PackageId $packageId -PackageVersion ([string]$publishPlan.package_version)
                $downloadPath = Join-Path $tempRoot $name
                Invoke-WebRequest -Uri $sourcePath -OutFile $downloadPath -Headers @{ "User-Agent" = "TinyRustLM-NuGet-Hash/1.0" } | Out-Null
                $sourcePath = $downloadPath
            }

            $present = $true
            $actualSha256 = Get-FileSha256 -Path $sourcePath
            $actualByteCount = (Get-Item -LiteralPath $sourcePath).Length
        }
        catch {
            $errorMessage = $_.Exception.Message
        }

        $packageReports += [ordered]@{
            package_id = $packageId
            name = $name
            feed_location = if ($sourceKind -eq "nuget-v3" -and $present) {
                Get-RemotePackageUrl -FlatContainerBaseUrl $flatContainerBaseUrl -PackageId $packageId -PackageVersion ([string]$publishPlan.package_version)
            } else {
                $sourcePath
            }
            present = $present
            expected_sha256 = $expectedSha256
            actual_sha256 = $actualSha256
            sha256_match = $present -and ($actualSha256 -eq $expectedSha256)
            expected_byte_count = $expectedByteCount
            actual_byte_count = $actualByteCount
            byte_count_match = $present -and ([int64]$actualByteCount -eq $expectedByteCount)
            error_message = $errorMessage
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

$missingPackages = @($packageReports | Where-Object { -not $_.present })
$hashMismatches = @($packageReports | Where-Object { $_.present -and -not $_.sha256_match })
$sizeMismatches = @($packageReports | Where-Object { $_.present -and -not $_.byte_count_match })
$status = if ($missingPackages.Count -eq 0 -and $hashMismatches.Count -eq 0 -and $sizeMismatches.Count -eq 0) { "pass" } else { "fail" }
$report = [ordered]@{
    schema = "tinyrustlm.nuget.feed_hashes.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    status = $status
    source = $resolvedSource
    source_kind = $sourceKind
    package_version = [string]$publishPlan.package_version
    publish_plan_report_path = $PublishPlanReport
    publish_plan_report_sha256 = Get-FileSha256 -Path $PublishPlanReport
    package_audit_report_sha256 = [string]$publishPlan.package_audit_report_sha256
    secret_material_included = $false
    package_count = $packageReports.Count
    missing_package_count = $missingPackages.Count
    hash_mismatch_count = $hashMismatches.Count
    byte_count_mismatch_count = $sizeMismatches.Count
    packages = @($packageReports)
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "TinyRustLM NuGet feed-hashes report written to $ReportOutput"

if ($status -ne "pass") {
    throw "TinyRustLM NuGet feed hash verification failed. See $ReportOutput"
}
Write-Host "TinyRustLM NuGet feed package hashes match publish plan: $resolvedSource"
