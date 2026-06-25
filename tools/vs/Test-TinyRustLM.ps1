[CmdletBinding()]
param(
    [switch]$BrowserSmoke,
    [switch]$PerformanceSoak,
    [int]$BrowserSmokePort = 8080,
    [int]$PortSearchLimit = 20,
    [int]$PerformanceSoakCycles = 3,
    [int]$PerformanceSoakTokens = 4
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Resolve-CommandPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string[]]$PreferredPaths = @()
    )

    foreach ($candidate in $PreferredPaths) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    throw "Required command '$Name' was not found. Install Rust and Node, then reopen Visual Studio."
}

$Cargo = Resolve-CommandPath "cargo.exe" @(
    (Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"),
    "C:\Users\AI\.cargo\bin\cargo.exe"
)

function Get-AppUrl {
    param([int]$CandidatePort)
    return "http://127.0.0.1:$CandidatePort/app/"
}

function Get-WasmUrl {
    param([int]$CandidatePort)
    return "http://127.0.0.1:$CandidatePort/runtime/tinyrustlm.wasm"
}

function Test-LocalPortOpen {
    param([int]$CandidatePort)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connect = $client.ConnectAsync("127.0.0.1", $CandidatePort)
        if (-not $connect.Wait(300)) {
            return $false
        }
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Test-TinyRustLMServer {
    param([int]$CandidatePort)

    try {
        $page = Invoke-WebRequest -Uri (Get-AppUrl $CandidatePort) -Method Get -UseBasicParsing -TimeoutSec 2
        if ($page.StatusCode -lt 200 -or $page.StatusCode -ge 300) {
            return $false
        }
        if (-not ([string]$page.Content).Contains("<title>TinyRustLM</title>")) {
            return $false
        }

        $wasm = Invoke-WebRequest -Uri (Get-WasmUrl $CandidatePort) -Method Head -UseBasicParsing -TimeoutSec 2
        if ($wasm.StatusCode -lt 200 -or $wasm.StatusCode -ge 300) {
            return $false
        }
        return $true
    }
    catch {
        return $false
    }
}

function Resolve-BrowserSmokeTarget {
    param(
        [int]$PreferredPort,
        [int]$SearchLimit
    )

    if ($SearchLimit -lt 0) {
        throw "PortSearchLimit must be zero or greater."
    }

    for ($offset = 0; $offset -le $SearchLimit; $offset++) {
        $candidate = $PreferredPort + $offset
        if ($candidate -gt 65535) {
            break
        }

        if (Test-TinyRustLMServer $candidate) {
            return [pscustomobject]@{
                Port = $candidate
                Url = Get-AppUrl $candidate
                Reuse = $true
            }
        }

        if (-not (Test-LocalPortOpen $candidate)) {
            return [pscustomobject]@{
                Port = $candidate
                Url = Get-AppUrl $candidate
                Reuse = $false
            }
        }
    }

    throw "No available local browser-smoke port found from $PreferredPort through $($PreferredPort + $SearchLimit)."
}

function Resolve-ServerExecutable {
    $server = Join-Path $Root "target\debug\tinyrustlm-local-server.exe"
    if (-not (Test-Path -LiteralPath $server)) {
        throw "TinyRustLM Rust local server was not found at $server after build."
    }
    return (Resolve-Path -LiteralPath $server).Path
}

Push-Location $Root
try {
    & (Join-Path $PSScriptRoot "Build-TinyRustLM.ps1") -Configuration Debug -RunTests
    if ($LASTEXITCODE -ne 0) {
        throw "build and unit tests failed with exit code $LASTEXITCODE"
    }

    $docTargets = @(
        @("rustdoc", "-p", "tinyrustlm-runtime", "--lib", "--", "-D", "missing_docs"),
        @("rustdoc", "-p", "tinyrustlm-slm-pack", "--bin", "tinyrustlm-slm-pack", "--", "-D", "missing_docs"),
        @("rustdoc", "-p", "tinyrustlm-local-server", "--bin", "tinyrustlm-local-server", "--", "-D", "missing_docs"),
        @("rustdoc", "-p", "tinyrustlm-browser-harness", "--bin", "tinyrustlm-browser-harness", "--", "-D", "missing_docs")
    )
    foreach ($docTarget in $docTargets) {
        & $Cargo @docTarget
        if ($LASTEXITCODE -ne 0) {
            throw "Rust public API documentation check failed for '$($docTarget -join ' ')' with exit code $LASTEXITCODE"
        }
    }

    node --check "tinyrustlm\app\app.js"
    if ($LASTEXITCODE -ne 0) {
        throw "app.js syntax check failed with exit code $LASTEXITCODE"
    }
    node --check "tinyrustlm\tools\static-server.js"
    if ($LASTEXITCODE -ne 0) {
        throw "static-server.js syntax check failed with exit code $LASTEXITCODE"
    }
    node --check "tinyrustlm\tools\browser-smoke.js"
    if ($LASTEXITCODE -ne 0) {
        throw "browser-smoke.js syntax check failed with exit code $LASTEXITCODE"
    }
    node --check "tinyrustlm\tools\wasm-abi-smoke.js"
    if ($LASTEXITCODE -ne 0) {
        throw "wasm-abi-smoke.js syntax check failed with exit code $LASTEXITCODE"
    }

    & $Cargo run -p tinyrustlm-browser-harness -- tinyrustlm
    if ($LASTEXITCODE -ne 0) {
        throw "TinyRustLM Rust browser harness static contract check failed with exit code $LASTEXITCODE"
    }

    $modelPaths = @(
        "tinyrustlm\models\tiny-test-model.slm",
        "tinyrustlm\models\tiny-test-model-tied.slm",
        "tinyrustlm\models\tiny-test-model-q8.slm",
        "tinyrustlm\models\tiny-test-model-q4.slm",
        "tinyrustlm\models\tiny-test-model-bpe.slm",
        "tinyrustlm\models\tinylm16-f32.slm",
        "tinyrustlm\models\tinylm16-q8.slm",
        "tinyrustlm\models\tinylm16-q4.slm"
    )
    foreach ($modelPath in $modelPaths) {
        & $Cargo run -p tinyrustlm-slm-pack -- validate $modelPath
        if ($LASTEXITCODE -ne 0) {
            throw "SLM validation failed for $modelPath with exit code $LASTEXITCODE"
        }
        $manifestPath = "$modelPath.manifest"
        if (-not (Test-Path -LiteralPath $manifestPath)) {
            throw "SLM provenance manifest is missing for $modelPath"
        }
        & $Cargo run -p tinyrustlm-slm-pack -- validate-manifest $modelPath $manifestPath
        if ($LASTEXITCODE -ne 0) {
            throw "SLM manifest validation failed for $modelPath with exit code $LASTEXITCODE"
        }
    }

    $sourceFixture = "tinyrustlm\tests\fixtures\trained-source-tiny"
    & $Cargo run -p tinyrustlm-slm-pack -- validate-source $sourceFixture
    if ($LASTEXITCODE -ne 0) {
        throw "SLM trained-source validation failed for $sourceFixture with exit code $LASTEXITCODE"
    }
    $convertedDir = "target\trained-source-smoke"
    New-Item -ItemType Directory -Force -Path $convertedDir | Out-Null
    $conversionModes = @(
        [pscustomobject]@{ Quantization = "f32"; Suffix = "f32" },
        [pscustomobject]@{ Quantization = "q8_0"; Suffix = "q8" },
        [pscustomobject]@{ Quantization = "q4_0"; Suffix = "q4" }
    )
    foreach ($conversionMode in $conversionModes) {
        $convertedModel = Join-Path $convertedDir "tiny-converted-$($conversionMode.Suffix).slm"
        $convertedManifest = "$convertedModel.manifest"
        & $Cargo run -p tinyrustlm-slm-pack -- convert-trained $sourceFixture $convertedModel $conversionMode.Quantization
        if ($LASTEXITCODE -ne 0) {
            throw "SLM trained-source $($conversionMode.Quantization) conversion failed with exit code $LASTEXITCODE"
        }
        & $Cargo run -p tinyrustlm-slm-pack -- validate $convertedModel
        if ($LASTEXITCODE -ne 0) {
            throw "Converted $($conversionMode.Quantization) SLM validation failed with exit code $LASTEXITCODE"
        }
        & $Cargo run -p tinyrustlm-slm-pack -- validate-manifest $convertedModel $convertedManifest
        if ($LASTEXITCODE -ne 0) {
            throw "Converted $($conversionMode.Quantization) SLM manifest validation failed with exit code $LASTEXITCODE"
        }
        & $Cargo run -p tinyrustlm-slm-pack -- quality-gate $convertedModel $convertedManifest runtime-smoke
        if ($LASTEXITCODE -ne 0) {
            throw "Converted $($conversionMode.Quantization) SLM runtime-smoke gate failed with exit code $LASTEXITCODE"
        }
        $convertedEval = Join-Path $convertedDir "tiny-converted-$($conversionMode.Suffix).eval"
        & $Cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- $convertedModel $convertedManifest "tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt" $convertedEval
        if ($LASTEXITCODE -ne 0) {
            throw "TinyRustLM $($conversionMode.Quantization) eval runner failed with exit code $LASTEXITCODE"
        }
        & $Cargo run -p tinyrustlm-slm-pack -- quality-gate $convertedModel $convertedManifest assistant-quality $convertedEval
        if ($LASTEXITCODE -ne 0) {
            throw "Converted $($conversionMode.Quantization) SLM assistant-quality gate failed with exit code $LASTEXITCODE"
        }
    }

    node "tinyrustlm\tools\wasm-abi-smoke.js"
    if ($LASTEXITCODE -ne 0) {
        throw "WASM ABI smoke failed with exit code $LASTEXITCODE"
    }

    if ($BrowserSmoke -or $PerformanceSoak) {
        $target = Resolve-BrowserSmokeTarget -PreferredPort $BrowserSmokePort -SearchLimit $PortSearchLimit
        $server = $null
        if ($target.Reuse) {
            Write-Host "Using existing TinyRustLM server at $($target.Url) for browser checks."
        }
        else {
            $serverExe = Resolve-ServerExecutable
            $server = Start-Process -FilePath $serverExe -ArgumentList @("tinyrustlm", "$($target.Port)") -PassThru -WindowStyle Hidden
        }
        try {
            for ($i = 0; $i -lt 40; $i++) {
                if (Test-TinyRustLMServer $target.Port) {
                    break
                }
                Start-Sleep -Milliseconds 250
            }
            if (-not (Test-TinyRustLMServer $target.Port)) {
                throw "TinyRustLM browser-smoke server did not become ready at $($target.Url)"
            }

            & $Cargo run -p tinyrustlm-browser-harness -- tinyrustlm --http $target.Url
            if ($LASTEXITCODE -ne 0) {
                throw "TinyRustLM Rust browser harness HTTP contract check failed with exit code $LASTEXITCODE"
            }

            if ($BrowserSmoke) {
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9225 tinylm16q8
                if ($LASTEXITCODE -ne 0) {
                    throw "q8 browser smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9226 tinylm16q4
                if ($LASTEXITCODE -ne 0) {
                    throw "q4 browser smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9227 tinylm16q8 loop
                if ($LASTEXITCODE -ne 0) {
                    throw "browser loop smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9228 tinylm16q8 model-error
                if ($LASTEXITCODE -ne 0) {
                    throw "malformed model browser smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9229 tinylm16q8 context-error
                if ($LASTEXITCODE -ne 0) {
                    throw "context overflow browser smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9230 tinylm16q8 missing-model
                if ($LASTEXITCODE -ne 0) {
                    throw "missing model browser smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9231 tinylm16q8 endurance 3
                if ($LASTEXITCODE -ne 0) {
                    throw "browser endurance smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9232 tinylm16q8 performance 4
                if ($LASTEXITCODE -ne 0) {
                    throw "browser performance smoke failed with exit code $LASTEXITCODE"
                }
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9234 tinylm16q8 ui-audit
                if ($LASTEXITCODE -ne 0) {
                    throw "browser UI audit failed with exit code $LASTEXITCODE"
                }
            }

            if ($PerformanceSoak) {
                node "tinyrustlm\tools\browser-smoke.js" $target.Url 9233 tinylm16q8 performance-soak $PerformanceSoakCycles $PerformanceSoakTokens
                if ($LASTEXITCODE -ne 0) {
                    throw "browser performance soak failed with exit code $LASTEXITCODE"
                }
            }
        }
        finally {
            if ($null -ne $server -and -not $server.HasExited) {
                Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }

    Write-Host "TinyRustLM tests complete."
}
finally {
    Pop-Location
}
