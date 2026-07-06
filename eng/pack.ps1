param(
    [string]$Configuration = "Release",
    [string]$PackageOutput = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
function Invoke-DotNet {
    param(
        [string[]]$Arguments
    )

    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

if (-not $PackageOutput) {
    $PackageOutput = Join-Path $RepoRoot "artifacts/packages"
}
New-Item -ItemType Directory -Force -Path $PackageOutput | Out-Null
$PackageOutput = (Resolve-Path -LiteralPath $PackageOutput).Path
Get-ChildItem -LiteralPath $PackageOutput -Filter "TinyRustLM*.nupkg" -File |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }

& (Join-Path $PSScriptRoot "build-native.ps1") -Configuration release

Push-Location $RepoRoot
try {
    Invoke-DotNet -Arguments @("restore", "dotnet/TinyRustLM.sln")
    Invoke-DotNet -Arguments @("build", "dotnet/TinyRustLM.sln", "-c", $Configuration, "--no-restore")
    $env:TINYRUSTLM_REPO_ROOT = $RepoRoot
    $env:TINYRUSTLM_PACKAGE_DIR = $PackageOutput
    Invoke-DotNet -Arguments @("test", "dotnet/TinyRustLM.sln", "-c", $Configuration, "--no-build")
    Invoke-DotNet -Arguments @("pack", "dotnet/src/TinyRustLM.Abstractions/TinyRustLM.Abstractions.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput)
    Invoke-DotNet -Arguments @("pack", "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput)
    Invoke-DotNet -Arguments @("pack", "dotnet/src/TinyRustLM.P2P/TinyRustLM.P2P.csproj", "-c", $Configuration, "--no-build", "-o", $PackageOutput)
    Write-Host "TinyRustLM packages written to $PackageOutput"
}
finally {
    Pop-Location
}
