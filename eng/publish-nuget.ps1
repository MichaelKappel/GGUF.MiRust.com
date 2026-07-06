param(
    [string]$Configuration = "Release",
    [string]$PackageSource = "",
    [string]$NuGetSource = "",
    [string]$ApiKey = "",
    [string]$PackageVersion = "",
    [string]$AuditReport = "",
    [string]$ReportOutput = "",
    [switch]$SkipVerification,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
function Invoke-DotNet {
    param(
        [string[]]$Arguments
    )

    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $(Format-DotNetArgumentsForLog -Arguments $Arguments) failed with exit code $LASTEXITCODE"
    }
}

function Format-DotNetArgumentsForLog {
    param(
        [string[]]$Arguments
    )

    $redacted = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Arguments.Count; $i++) {
        $argument = $Arguments[$i]
        if ($i -gt 0 -and $Arguments[$i - 1] -eq "--api-key") {
            $redacted.Add("<redacted>")
        }
        else {
            $redacted.Add($argument)
        }
    }
    return ($redacted -join " ")
}

function Get-PackageIdFromName {
    param(
        [string]$PackageName,
        [string]$Version
    )

    $suffix = ".$Version.nupkg"
    if ($PackageName.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
        return $PackageName.Substring(0, $PackageName.Length - $suffix.Length)
    }
    return [System.IO.Path]::GetFileNameWithoutExtension($PackageName)
}

function Get-FileSha256 {
    param([string]$Path)

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-PackageAuditBinding {
    param(
        [System.IO.FileInfo[]]$Packages,
        [string[]]$ExpectedNames,
        [string]$AuditReportPath
    )

    $evidence = [ordered]@{
        package_audit_report_path = ""
        package_audit_report_sha256 = ""
        package_audit_status = "missing"
        package_audit_match = $false
        package_audit_error = ""
    }

    if (-not (Test-Path -LiteralPath $AuditReportPath)) {
        $evidence.package_audit_report_path = $AuditReportPath
        $evidence.package_audit_error = "Package audit report is required before publishing: $AuditReportPath"
        return $evidence
    }

    $resolvedAuditReport = (Resolve-Path -LiteralPath $AuditReportPath).Path
    $evidence.package_audit_report_path = $resolvedAuditReport
    $evidence.package_audit_report_sha256 = Get-FileSha256 -Path $resolvedAuditReport

    try {
        $audit = Get-Content -LiteralPath $resolvedAuditReport -Raw | ConvertFrom-Json
    }
    catch {
        $evidence.package_audit_status = "invalid"
        $evidence.package_audit_error = "Package audit report is not valid JSON: $($_.Exception.Message)"
        return $evidence
    }

    $evidence.package_audit_status = [string]$audit.status
    if ($audit.schema -ne "tinyrustlm.nuget.package_audit.v0") {
        $evidence.package_audit_error = "Package audit report schema mismatch: $($audit.schema)"
        return $evidence
    }
    if ($audit.status -ne "pass") {
        $evidence.package_audit_error = "Package audit report status is not pass: $($audit.status)"
        return $evidence
    }

    $auditPackages = @($audit.packages)
    $auditNames = @($auditPackages | ForEach-Object { [string]$_.name })
    $packageNames = @($Packages | ForEach-Object { $_.Name })
    foreach ($expectedName in $ExpectedNames) {
        if ($auditNames -notcontains $expectedName) {
            $evidence.package_audit_error = "Package audit report is missing expected package: $expectedName"
            return $evidence
        }
    }
    foreach ($packageName in $packageNames) {
        if ($auditNames -notcontains $packageName) {
            $evidence.package_audit_error = "Publish package was not present in audit report: $packageName"
            return $evidence
        }
    }

    foreach ($package in $Packages) {
        $auditPackage = $auditPackages | Where-Object { $_.name -eq $package.Name } | Select-Object -First 1
        if (-not $auditPackage) {
            $evidence.package_audit_error = "Publish package was not present in audit report: $($package.Name)"
            return $evidence
        }

        $packageHash = Get-FileSha256 -Path $package.FullName
        if ($auditPackage.sha256 -ne $packageHash) {
            $evidence.package_audit_error = "Package hash differs from audit report: $($package.Name)"
            return $evidence
        }
        if ([Int64]$auditPackage.byte_count -ne [Int64]$package.Length) {
            $evidence.package_audit_error = "Package size differs from audit report: $($package.Name)"
            return $evidence
        }
    }

    $evidence.package_audit_match = $true
    return $evidence
}

function Write-PublishPlanReport {
    param(
        [string]$OutputPath,
        [string]$Status,
        [System.IO.FileInfo[]]$Packages,
        [string[]]$ExpectedNames,
        [string]$PackageSource,
        [string]$NuGetSource,
        [string]$PackageVersion,
        [bool]$DryRunValue,
        [bool]$SkipVerificationValue,
        $AuditEvidence,
        [string]$PublishError = ""
    )

    $packageReports = @($Packages | ForEach-Object {
        [ordered]@{
            name = $_.Name
            package_id = Get-PackageIdFromName -PackageName $_.Name -Version $PackageVersion
            path = $_.FullName
            sha256 = Get-FileSha256 -Path $_.FullName
            byte_count = $_.Length
        }
    })

    $report = [ordered]@{
        schema = "tinyrustlm.nuget.publish_plan.v0"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        status = $Status
        package_source = $PackageSource
        nuget_source = $NuGetSource
        package_version = $PackageVersion
        dry_run = $DryRunValue
        skip_verification = $SkipVerificationValue
        secret_material_included = $false
        package_audit_report_path = $AuditEvidence.package_audit_report_path
        package_audit_report_sha256 = $AuditEvidence.package_audit_report_sha256
        package_audit_status = $AuditEvidence.package_audit_status
        package_audit_match = $AuditEvidence.package_audit_match
        package_audit_error = $AuditEvidence.package_audit_error
        publish_error = $PublishError
        package_count = $packageReports.Count
        expected_package_names = @($ExpectedNames)
        packages = @($packageReports)
    }

    $reportDirectory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Host "TinyRustLM NuGet publish plan written to $OutputPath"
}

if (-not $PackageSource) {
    $PackageSource = Join-Path $RepoRoot "artifacts/packages"
}
if (-not $NuGetSource) {
    $NuGetSource = if ($env:NUGET_SOURCE) { $env:NUGET_SOURCE } else { "https://api.nuget.org/v3/index.json" }
}
if (-not $ApiKey) {
    $ApiKey = $env:NUGET_API_KEY
}
if (-not $PackageVersion) {
    $PackageVersion = (& (Join-Path $PSScriptRoot "get-package-version.ps1")).Trim()
}
if (-not $AuditReport) {
    $AuditReport = if ($env:TINYRUSTLM_PACKAGE_AUDIT_REPORT) {
        $env:TINYRUSTLM_PACKAGE_AUDIT_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-package-audit.json"
    }
}
if (-not $ReportOutput) {
    $ReportOutput = if ($env:TINYRUSTLM_PUBLISH_PLAN_REPORT) {
        $env:TINYRUSTLM_PUBLISH_PLAN_REPORT
    }
    else {
        Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-publish-plan.json"
    }
}

Push-Location $RepoRoot
try {
    if (-not $SkipVerification) {
        & (Join-Path $PSScriptRoot "verify-package.ps1") -Configuration $Configuration
    }

    if (-not (Test-Path -LiteralPath $PackageSource)) {
        throw "Package source does not exist: $PackageSource"
    }
    $PackageSource = (Resolve-Path -LiteralPath $PackageSource).Path
    $packages = Get-ChildItem -Path $PackageSource -Filter "TinyRustLM*.nupkg" -File | Sort-Object Name
    if (-not $packages) {
        throw "No TinyRustLM packages were found in $PackageSource"
    }

    $requiredPackages = @(
        "TinyRustLM.Abstractions",
        "TinyRustLM.Core",
        "TinyRustLM.P2P"
    )
    $expectedNames = @($requiredPackages | ForEach-Object { "$_.$PackageVersion.nupkg" })
    foreach ($expectedName in $expectedNames) {
        if (-not ($packages | Where-Object { $_.Name -eq $expectedName })) {
            throw "Required package is missing from publish set: $expectedName"
        }
    }
    $unexpectedPackages = @($packages | Where-Object { $expectedNames -notcontains $_.Name })
    if ($unexpectedPackages.Count -gt 0) {
        $unexpectedNames = ($unexpectedPackages | ForEach-Object { $_.Name }) -join ", "
        $expectedList = $expectedNames -join ", "
        throw "Publish set contains unexpected package(s): $unexpectedNames. Expected exactly: $expectedList"
    }

    $auditEvidence = Test-PackageAuditBinding -Packages $packages -ExpectedNames $expectedNames -AuditReportPath $AuditReport
    if (-not $auditEvidence.package_audit_match) {
        $blockedStatus = if ($auditEvidence.package_audit_status -eq "missing") { "blocked_missing_audit_report" } else { "blocked_audit_mismatch" }
        Write-PublishPlanReport `
            -OutputPath $ReportOutput `
            -Status $blockedStatus `
            -Packages $packages `
            -ExpectedNames $expectedNames `
            -PackageSource $PackageSource `
            -NuGetSource $NuGetSource `
            -PackageVersion $PackageVersion `
            -DryRunValue ([bool]$DryRun) `
            -SkipVerificationValue ([bool]$SkipVerification) `
            -AuditEvidence $auditEvidence
        throw $auditEvidence.package_audit_error
    }

    Write-Host "TinyRustLM NuGet publish set:"
    foreach ($package in $packages) {
        Write-Host " - $($package.Name)"
    }
    Write-Host "NuGet source: $NuGetSource"
    Write-Host "Package version: $PackageVersion"

    if ($DryRun) {
        Write-PublishPlanReport `
            -OutputPath $ReportOutput `
            -Status "dry_run" `
            -Packages $packages `
            -ExpectedNames $expectedNames `
            -PackageSource $PackageSource `
            -NuGetSource $NuGetSource `
            -PackageVersion $PackageVersion `
            -DryRunValue $true `
            -SkipVerificationValue ([bool]$SkipVerification) `
            -AuditEvidence $auditEvidence
        Write-Host "Dry run requested; packages were not pushed."
        return
    }
    if (-not $ApiKey) {
        Write-PublishPlanReport `
            -OutputPath $ReportOutput `
            -Status "blocked_missing_api_key" `
            -Packages $packages `
            -ExpectedNames $expectedNames `
            -PackageSource $PackageSource `
            -NuGetSource $NuGetSource `
            -PackageVersion $PackageVersion `
            -DryRunValue $false `
            -SkipVerificationValue ([bool]$SkipVerification) `
            -AuditEvidence $auditEvidence
        throw "NUGET_API_KEY or -ApiKey is required unless -DryRun is used."
    }

    Write-PublishPlanReport `
        -OutputPath $ReportOutput `
        -Status "ready_to_push" `
        -Packages $packages `
        -ExpectedNames $expectedNames `
        -PackageSource $PackageSource `
        -NuGetSource $NuGetSource `
        -PackageVersion $PackageVersion `
        -DryRunValue $false `
        -SkipVerificationValue ([bool]$SkipVerification) `
        -AuditEvidence $auditEvidence

    try {
        foreach ($package in $packages) {
            Invoke-DotNet -Arguments @(
                "nuget",
                "push",
                $package.FullName,
                "--source",
                $NuGetSource,
                "--api-key",
                $ApiKey,
                "--skip-duplicate"
            )
        }
    }
    catch {
        $publishError = $_.Exception.Message
        if ($ApiKey) {
            $publishError = $publishError.Replace($ApiKey, "<redacted>")
        }
        Write-PublishPlanReport `
            -OutputPath $ReportOutput `
            -Status "push_failed" `
            -Packages $packages `
            -ExpectedNames $expectedNames `
            -PackageSource $PackageSource `
            -NuGetSource $NuGetSource `
            -PackageVersion $PackageVersion `
            -DryRunValue $false `
            -SkipVerificationValue ([bool]$SkipVerification) `
            -AuditEvidence $auditEvidence `
            -PublishError $publishError
        throw
    }

    Write-PublishPlanReport `
        -OutputPath $ReportOutput `
        -Status "pushed" `
        -Packages $packages `
        -ExpectedNames $expectedNames `
        -PackageSource $PackageSource `
        -NuGetSource $NuGetSource `
        -PackageVersion $PackageVersion `
        -DryRunValue $false `
        -SkipVerificationValue ([bool]$SkipVerification) `
        -AuditEvidence $auditEvidence
}
finally {
    Pop-Location
}
