param(
    [string]$Root = "",
    [int]$Port = 8184,
    [int]$DebugPort = 9442,
    [string]$ReportOutput = "",
    [switch]$RunBrowserSmoke
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $Root) {
    $Root = Join-Path $RepoRoot "tinyrustlm"
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-verification.json"
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$Label
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $true
    $startInfo.Arguments = ($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Value $_ }) -join " "

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $output = ($stdout, $stderr | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode)`n$output"
    }
    return $output
}

function ConvertTo-ProcessArgument {
    param([string]$Value)

    if ($null -eq $Value) {
        return '""'
    }
    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $backslashes++
            continue
        }
        if ($character -eq '"') {
            [void]$builder.Append('\', ($backslashes * 2) + 1)
            [void]$builder.Append('"')
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$builder.Append('\', $backslashes)
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        [void]$builder.Append('\', $backslashes * 2)
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Write-UiReport {
    param(
        [string]$Status,
        [string]$StaticHarnessStatus,
        [string]$HttpHarnessStatus,
        [string]$BrowserSmokeStatus,
        [string[]]$BrowserSmokeModes,
        [System.Collections.IDictionary]$BrowserSmokeStatuses,
        [string]$StaticHarnessOutput,
        [string]$HttpHarnessOutput,
        [string]$ErrorMessage,
        [System.Collections.IDictionary]$BrowserSmokeReportPaths,
        [System.Collections.IDictionary]$BrowserDebugPorts,
        [string]$ServerStdoutPath,
        [string]$ServerStderrPath
    )

    $reportDirectory = Split-Path -Parent $ReportOutput
    New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    $report = [ordered]@{
        schema = "tinyrustlm.ui_verification.v0"
        generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
        status = $Status
        repository_root = $RepoRoot
        app_root = (Resolve-Path $Root).Path
        local_server_url = "http://127.0.0.1:$Port/app/"
        static_harness_status = $StaticHarnessStatus
        http_harness_status = $HttpHarnessStatus
        browser_smoke_requested = [bool]$RunBrowserSmoke
        browser_smoke_status = $BrowserSmokeStatus
        browser_smoke_mode = if ($RunBrowserSmoke) { ($BrowserSmokeModes -join ",") } else { "" }
        browser_smoke_modes = if ($RunBrowserSmoke) { @($BrowserSmokeModes) } else { @() }
        browser_smoke_statuses = if ($RunBrowserSmoke) { $BrowserSmokeStatuses } else { [ordered]@{} }
        browser_debug_port = $DebugPort
        browser_debug_ports = if ($RunBrowserSmoke) { $BrowserDebugPorts } else { [ordered]@{} }
        static_harness_output = $StaticHarnessOutput
        http_harness_output = $HttpHarnessOutput
        browser_smoke_report_path = if ($RunBrowserSmoke) { [string]$BrowserSmokeReportPaths["source-options-ui"] } else { "" }
        browser_smoke_report_paths = if ($RunBrowserSmoke) { $BrowserSmokeReportPaths } else { [ordered]@{} }
        server_stdout_path = $ServerStdoutPath
        server_stderr_path = $ServerStderrPath
        error = $ErrorMessage
    }
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
    Write-Host "TinyRustLM UI verification report written to $ReportOutput"
}

function Wait-UiServer {
    param([System.Diagnostics.Process]$ServerProcess)

    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        if ($ServerProcess.HasExited) {
            throw "tinyrustlm-local-server exited early with code $($ServerProcess.ExitCode)"
        }
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/app/" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                return
            }
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }
    throw "tinyrustlm-local-server did not become ready on port $Port"
}

$staticHarnessStatus = "not_run"
$httpHarnessStatus = "not_run"
$browserSmokeStatus = if ($RunBrowserSmoke) { "not_run" } else { "skipped" }
$staticHarnessOutput = ""
$httpHarnessOutput = ""
$browserSmokeModes = @(
    "source-options-ui",
    "local-memory-deck-ui",
    "local-connect-approval-ui",
    "local-connect-endpoint-ui",
    "local-connect-rust-endpoint-ui"
)
$sourceOptionsSmokeReportName = "tinyrustlm-source-options-ui-smoke.json"
$browserSmokeReportPaths = [ordered]@{}
$browserSmokeStatuses = [ordered]@{}
$browserDebugPorts = [ordered]@{}
for ($index = 0; $index -lt $browserSmokeModes.Count; $index++) {
    $mode = $browserSmokeModes[$index]
    $reportName = if ($mode -eq "source-options-ui") { $sourceOptionsSmokeReportName } else { "tinyrustlm-$mode-smoke.json" }
    $browserSmokeReportPaths[$mode] = Join-Path $RepoRoot "artifacts/reports/$reportName"
    $browserSmokeStatuses[$mode] = if ($RunBrowserSmoke) { "not_run" } else { "skipped" }
    $browserDebugPorts[$mode] = $DebugPort + $index
}
$serverStdout = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-server-$Port.out.log"
$serverStderr = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-ui-server-$Port.err.log"
$server = $null

try {
    $resolvedRoot = (Resolve-Path $Root).Path
    $staticHarnessOutput = Invoke-Checked `
        -FilePath "cargo" `
        -Arguments @("run", "-p", "tinyrustlm-browser-harness", "--", $resolvedRoot) `
        -Label "TinyRustLM static browser harness"
    $staticHarnessStatus = "pass"

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $serverStdout) | Out-Null
    Remove-Item -LiteralPath $serverStdout, $serverStderr -Force -ErrorAction SilentlyContinue
    $server = Start-Process `
        -FilePath "cargo" `
        -ArgumentList @("run", "-p", "tinyrustlm-local-server", "--", $resolvedRoot, "$Port") `
        -WorkingDirectory $RepoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $serverStdout `
        -RedirectStandardError $serverStderr `
        -PassThru

    Wait-UiServer -ServerProcess $server
    $appUrl = "http://127.0.0.1:$Port/app/"
    $httpHarnessOutput = Invoke-Checked `
        -FilePath "cargo" `
        -Arguments @("run", "-p", "tinyrustlm-browser-harness", "--", $resolvedRoot, "--http", $appUrl) `
        -Label "TinyRustLM HTTP browser harness"
    $httpHarnessStatus = "pass"

    if ($RunBrowserSmoke) {
        foreach ($mode in $browserSmokeModes) {
            $reportPath = [string]$browserSmokeReportPaths[$mode]
            $modeDebugPort = [string]$browserDebugPorts[$mode]
            Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
            $smokeOutput = Invoke-Checked `
                -FilePath "node" `
                -Arguments @((Join-Path $RepoRoot "tinyrustlm/tools/browser-smoke.js"), $appUrl, $modeDebugPort, "tinylm16q8", $mode) `
                -Label "$mode browser smoke"
            $smokeOutput | Set-Content -LiteralPath $reportPath -Encoding UTF8
            $browserSmokeStatuses[$mode] = "pass"
        }
        $browserSmokeStatus = "pass"
    }

    Write-UiReport `
        -Status "pass" `
        -StaticHarnessStatus $staticHarnessStatus `
        -HttpHarnessStatus $httpHarnessStatus `
        -BrowserSmokeStatus $browserSmokeStatus `
        -BrowserSmokeModes $browserSmokeModes `
        -BrowserSmokeStatuses $browserSmokeStatuses `
        -StaticHarnessOutput $staticHarnessOutput `
        -HttpHarnessOutput $httpHarnessOutput `
        -ErrorMessage "" `
        -BrowserSmokeReportPaths $browserSmokeReportPaths `
        -BrowserDebugPorts $browserDebugPorts `
        -ServerStdoutPath $serverStdout `
        -ServerStderrPath $serverStderr
    Write-Host "TinyRustLM UI verification passed."
}
catch {
    $message = $_.Exception.Message
    Write-UiReport `
        -Status "fail" `
        -StaticHarnessStatus $staticHarnessStatus `
        -HttpHarnessStatus $httpHarnessStatus `
        -BrowserSmokeStatus $browserSmokeStatus `
        -BrowserSmokeModes $browserSmokeModes `
        -BrowserSmokeStatuses $browserSmokeStatuses `
        -StaticHarnessOutput $staticHarnessOutput `
        -HttpHarnessOutput $httpHarnessOutput `
        -ErrorMessage $message `
        -BrowserSmokeReportPaths $browserSmokeReportPaths `
        -BrowserDebugPorts $browserDebugPorts `
        -ServerStdoutPath $serverStdout `
        -ServerStderrPath $serverStderr
    throw
}
finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
