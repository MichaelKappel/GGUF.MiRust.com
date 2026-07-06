param(
    [string]$PackageSource = "",
    [string]$ReportOutput = "",
    [string[]]$RequiredNativeRids = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $PackageSource) {
    $PackageSource = Join-Path $RepoRoot "artifacts/packages"
}
if (-not $ReportOutput) {
    $ReportOutput = Join-Path $RepoRoot "artifacts/reports/tinyrustlm-nuget-package-audit.json"
}

if (-not (Test-Path -LiteralPath $PackageSource)) {
    throw "Package source does not exist: $PackageSource"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-NativeRidFromEntry {
    param([string]$EntryName)

    if ($EntryName -match "^runtimes/([^/]+)/native/") {
        return $Matches[1]
    }
    return $null
}

function Read-ZipEntryText {
    param($Entry)

    $stream = $Entry.Open()
    try {
        $reader = [System.IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-ZipEntrySha256 {
    param($Entry)

    $stream = $Entry.Open()
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hashBytes = $sha256.ComputeHash($stream)
            return ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Read-NuspecDependencies {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return @()
    }

    [xml]$nuspec = $NuspecText
    $dependencyNodes = $nuspec.SelectNodes("//*[local-name()='dependency']")
    $dependencies = @()
    foreach ($node in $dependencyNodes) {
        $dependencies += [ordered]@{
            id = $node.GetAttribute("id")
            version = $node.GetAttribute("version")
            exclude = $node.GetAttribute("exclude")
        }
    }
    return $dependencies
}

function Test-TextPackageEntry {
    param([string]$EntryName)

    $lower = $EntryName.ToLowerInvariant()
    $textExtensions = @(
        ".nuspec",
        ".props",
        ".targets",
        ".md",
        ".txt",
        ".json",
        ".xml",
        ".ps1",
        ".psm1",
        ".sh",
        ".csproj",
        ".fsproj",
        ".vbproj"
    )
    foreach ($extension in $textExtensions) {
        if ($lower.EndsWith($extension)) {
            return $true
        }
    }
    return $false
}

function Get-AbsolutePathMatches {
    param($Entries)

    $rules = @(
        [ordered]@{
            kind = "windows_user_or_workspace_path"
            pattern = "(?i)\b[A-Z]:\\(?:Users|Source|repos|work|workspace|agent|actions-runner|a)\\"
        },
        [ordered]@{
            kind = "unix_user_or_workspace_path"
            pattern = "(?i)/(?:home|Users|mnt|workspace|work|agent|actions-runner|__w|private/var/folders)/"
        }
    )

    $pathMatches = @()
    foreach ($entry in $Entries) {
        if (-not (Test-TextPackageEntry -EntryName $entry.FullName)) {
            continue
        }
        if ($entry.Length -gt 1048576) {
            continue
        }

        $text = Read-ZipEntryText -Entry $entry
        foreach ($rule in $rules) {
            $matches = [regex]::Matches($text, $rule.pattern)
            foreach ($match in $matches) {
                $pathMatches += [ordered]@{
                    entry = $entry.FullName
                    kind = $rule.kind
                    index = $match.Index
                }
            }
        }
    }
    return $pathMatches
}

function Get-XmlText {
    param(
        [xml]$Document,
        [string]$ElementName
    )

    $node = $Document.SelectSingleNode("//*[local-name()='$ElementName']")
    if ($node) {
        return $node.InnerText
    }
    return ""
}

function Get-SourcePackageVersion {
    $propsPath = Join-Path $RepoRoot "dotnet/Directory.Build.props"
    [xml]$props = Get-Content -LiteralPath $propsPath -Raw
    $version = Get-XmlText -Document $props -ElementName "Version"
    if (-not [string]::IsNullOrWhiteSpace($version)) {
        return $version
    }

    $prefix = Get-XmlText -Document $props -ElementName "VersionPrefix"
    if ([string]::IsNullOrWhiteSpace($prefix)) {
        throw "VersionPrefix is required in $propsPath"
    }

    $suffix = Get-XmlText -Document $props -ElementName "VersionSuffix"
    if ([string]::IsNullOrWhiteSpace($suffix)) {
        return $prefix
    }
    return "$prefix-$suffix"
}

function Get-ExpectedPackageNames {
    param([string]$PackageVersion)

    return @(
        "TinyRustLM.Abstractions.$PackageVersion.nupkg",
        "TinyRustLM.Core.$PackageVersion.nupkg",
        "TinyRustLM.P2P.$PackageVersion.nupkg"
    )
}

function Get-ExpectedPackageIdForName {
    param(
        [string]$PackageName,
        [string]$PackageVersion
    )

    $suffix = ".$PackageVersion.nupkg"
    if ($PackageName.EndsWith($suffix, [StringComparison]::OrdinalIgnoreCase)) {
        return $PackageName.Substring(0, $PackageName.Length - $suffix.Length)
    }
    return ""
}

function Read-NuspecMetadata {
    param([string]$NuspecText)

    if (-not $NuspecText) {
        return [ordered]@{
            id = ""
            version = ""
            title = ""
            authors = ""
            description = ""
            project_url = ""
            repository_url = ""
            repository_type = ""
            license = ""
            license_type = ""
            readme = ""
            tags = ""
            release_notes = ""
            require_license_acceptance = ""
        }
    }

    [xml]$nuspec = $NuspecText
    $repository = $nuspec.SelectSingleNode("//*[local-name()='repository']")
    $license = $nuspec.SelectSingleNode("//*[local-name()='license']")
    return [ordered]@{
        id = Get-XmlText -Document $nuspec -ElementName "id"
        version = Get-XmlText -Document $nuspec -ElementName "version"
        title = Get-XmlText -Document $nuspec -ElementName "title"
        authors = Get-XmlText -Document $nuspec -ElementName "authors"
        description = Get-XmlText -Document $nuspec -ElementName "description"
        project_url = Get-XmlText -Document $nuspec -ElementName "projectUrl"
        repository_url = if ($repository) { $repository.GetAttribute("url") } else { "" }
        repository_type = if ($repository) { $repository.GetAttribute("type") } else { "" }
        license = if ($license) { $license.InnerText } else { "" }
        license_type = if ($license) { $license.GetAttribute("type") } else { "" }
        readme = Get-XmlText -Document $nuspec -ElementName "readme"
        tags = Get-XmlText -Document $nuspec -ElementName "tags"
        release_notes = Get-XmlText -Document $nuspec -ElementName "releaseNotes"
        require_license_acceptance = Get-XmlText -Document $nuspec -ElementName "requireLicenseAcceptance"
    }
}

function Get-MissingMetadataFields {
    param($Metadata)

    $required = @(
        "id",
        "version",
        "title",
        "authors",
        "description",
        "project_url",
        "repository_url",
        "repository_type",
        "license",
        "license_type",
        "readme",
        "tags",
        "release_notes"
    )
    $missing = @()
    foreach ($field in $required) {
        if ([string]::IsNullOrWhiteSpace([string]$Metadata[$field])) {
            $missing += $field
        }
    }
    if ($Metadata.require_license_acceptance -ne "true") {
        $missing += "require_license_acceptance"
    }
    if ($Metadata.license_type -and $Metadata.license_type -ne "file") {
        $missing += "license_type:file"
    }
    if ($Metadata.readme -and $Metadata.readme -ne "README.md") {
        $missing += "readme:README.md"
    }
    return $missing
}

function Get-DeclaredPackageFileEntries {
    param($Metadata)

    $declared = @()
    if (-not [string]::IsNullOrWhiteSpace([string]$Metadata.readme)) {
        $declared += [string]$Metadata.readme
    }
    if ($Metadata.license_type -eq "file" -and -not [string]::IsNullOrWhiteSpace([string]$Metadata.license)) {
        $declared += [string]$Metadata.license
    }
    return @($declared | Sort-Object -Unique)
}

function Get-PackageDocumentationEntries {
    param([string[]]$EntryNames)

    return @($EntryNames | Where-Object {
        $_ -eq "README.md" -or
        $_ -eq "LICENSE.txt" -or
        $_ -like "docs/*.md"
    })
}

function New-ExpectedPackageDocumentationEntry {
    param(
        [string]$Entry,
        [string]$Source
    )

    return [ordered]@{
        entry = $Entry
        source = $Source
    }
}

function Get-ExpectedPackageDocumentationEntries {
    param([string]$PackageId)

    $entries = @(
        (New-ExpectedPackageDocumentationEntry -Entry "README.md" -Source "docs/nuget/README.md"),
        (New-ExpectedPackageDocumentationEntry -Entry "LICENSE.txt" -Source "docs/nuget/LICENSE.txt")
    )

    if ($PackageId -eq "TinyRustLM.Core") {
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/PACKAGE_SECURITY.md" -Source "docs/nuget/PACKAGE_SECURITY.md"
    }
    elseif ($PackageId -eq "TinyRustLM.P2P") {
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/API_BOUNDARY.md" -Source "docs/nuget/API_BOUNDARY.md"
        $entries += New-ExpectedPackageDocumentationEntry -Entry "docs/P2P_SHARE_FLOW.md" -Source "docs/nuget/P2P_SHARE_FLOW.md"
    }

    return $entries
}

function Get-PackageDocumentationVerification {
    param(
        [string]$PackageId,
        $Entries
    )

    $verification = @()
    foreach ($expected in (Get-ExpectedPackageDocumentationEntries -PackageId $PackageId)) {
        $sourcePath = Join-Path $RepoRoot $expected.source
        $sourceExists = Test-Path -LiteralPath $sourcePath
        $packageEntry = $Entries | Where-Object { $_.FullName -eq $expected.entry } | Select-Object -First 1
        $packageEntryExists = $null -ne $packageEntry
        $sourceSha256 = if ($sourceExists) { (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant() } else { "" }
        $packageSha256 = if ($packageEntryExists) { Get-ZipEntrySha256 -Entry $packageEntry } else { "" }

        $verification += [ordered]@{
            entry = $expected.entry
            source = $expected.source
            source_exists = $sourceExists
            package_entry_exists = $packageEntryExists
            source_sha256 = $sourceSha256
            package_sha256 = $packageSha256
            sha256_match = ($sourceExists -and $packageEntryExists -and $sourceSha256 -eq $packageSha256)
        }
    }
    return $verification
}

function Get-AllowedPackageEntryPatterns {
    param([string]$PackageId)

    $patterns = @(
        "[Content_Types].xml",
        "_rels/.rels",
        "$PackageId.nuspec",
        "README.md",
        "LICENSE.txt",
        "package/services/metadata/core-properties/*.psmdcp",
        "lib/net8.0/$PackageId.dll",
        "lib/net8.0/$PackageId.xml"
    )

    foreach ($expected in (Get-ExpectedPackageDocumentationEntries -PackageId $PackageId)) {
        if ($patterns -notcontains $expected.entry) {
            $patterns += $expected.entry
        }
    }

    foreach ($entry in (Get-AllowedNativeEntriesForPackage -PackageId $PackageId)) {
        $patterns += $entry
    }

    return @($patterns)
}

function Test-PackageEntryAllowed {
    param(
        [string]$PackageId,
        [string]$EntryName,
        [string[]]$AllowedNativeEntries
    )

    $literalEntries = @(
        "[Content_Types].xml",
        "_rels/.rels",
        "$PackageId.nuspec",
        "README.md",
        "LICENSE.txt",
        "lib/net8.0/$PackageId.dll",
        "lib/net8.0/$PackageId.xml"
    )
    if ($literalEntries -contains $EntryName) {
        return $true
    }

    if ($EntryName -match "^package/services/metadata/core-properties/[^/]+\.psmdcp$") {
        return $true
    }

    $expectedDocumentationEntries = @(Get-ExpectedPackageDocumentationEntries -PackageId $PackageId |
        ForEach-Object { $_.entry })
    if ($expectedDocumentationEntries -contains $EntryName) {
        return $true
    }

    if ($AllowedNativeEntries -contains $EntryName) {
        return $true
    }

    return $false
}

function Get-UnexpectedPackageContentEntries {
    param(
        [string]$PackageId,
        [string[]]$EntryNames,
        [string[]]$AllowedNativeEntries
    )

    return @($EntryNames | Where-Object {
        -not (Test-PackageEntryAllowed `
            -PackageId $PackageId `
            -EntryName $_ `
            -AllowedNativeEntries $AllowedNativeEntries)
    })
}

function Read-XmlDocumentationMemberNames {
    param($Entry)

    if (-not $Entry) {
        return @()
    }

    $text = Read-ZipEntryText -Entry $Entry
    if ([string]::IsNullOrWhiteSpace($text)) {
        return @()
    }

    [xml]$xml = $text
    $members = $xml.SelectNodes("//*[local-name()='member']")
    $names = @()
    foreach ($member in $members) {
        $name = $member.GetAttribute("name")
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            $names += $name
        }
    }
    return @($names | Sort-Object -Unique)
}

function Get-ExpectedPublicApiEntries {
    param([string]$PackageId)

    if ($PackageId -eq "TinyRustLM.Abstractions") {
        return @(
            'M:TinyRustLM.ISlmInspector.Inspect(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ApplyReceivedAnnouncement(System.String,System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ApplyReceivedAnnouncementJson(System.String,System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ExportShareMetadata(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ExportShareMetadataJson(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ImportFromManifest(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ImportFromManifest(System.String,System.String,System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.InspectAnnouncementCatalog(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.InspectAnnouncementCatalogJson(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.InspectLocalImportReceipt(System.String,System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.InspectManifest(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.PrepareLocalShareKit(TinyRustLM.PrepareShareKitRequest)',
            'M:TinyRustLM.ITinyRustLmP2PClient.PrepareLocalShareKitJson(TinyRustLM.PrepareShareKitRequest)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ValidateAnnouncement(System.String)',
            'M:TinyRustLM.ITinyRustLmP2PClient.ValidateAnnouncementJson(System.String)',
            'M:TinyRustLM.ITinyRustLmRuntime.Generate(System.String,TinyRustLM.TinyRustLmGenerationOptions)',
            'M:TinyRustLM.ITinyRustLmRuntime.GetDiagnostics',
            'M:TinyRustLM.ITinyRustLmRuntime.LoadModel(System.String,System.String)',
            'M:TinyRustLM.ITinyRustLmRuntime.Reset',
            'M:TinyRustLM.ITinyRustLmRuntime.Step',
            'M:TinyRustLM.ITinyRustLmRuntime.UnloadModel',
            'M:TinyRustLM.ITinyRustLmRuntimeFactory.CreateRuntime',
            'M:TinyRustLM.ITinyRustLmRuntimeFactory.GetCapabilities',
            'M:TinyRustLM.ITinyRustLmRuntimeFactory.GetVersion',
            'M:TinyRustLM.P2PAnnouncement.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.String,System.Int64,System.Boolean,System.Int64)',
            'M:TinyRustLM.P2PAnnouncementCatalog.#ctor(System.String,System.Int32,System.Collections.Generic.IReadOnlyList{TinyRustLM.P2PAnnouncement})',
            'M:TinyRustLM.P2PAnnouncementCatalogInspection.#ctor(System.String,System.Int32,System.String,System.Int32,System.Int32,System.Int32,System.Int32,System.Int64,System.Boolean)',
            'M:TinyRustLM.P2PImportPlan.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Collections.Generic.IReadOnlyList{TinyRustLM.P2PPiece},System.String)',
            'M:TinyRustLM.P2PLocalImportBoundary.#ctor(System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean)',
            'M:TinyRustLM.P2PLocalImportReceipt.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Int64,System.String,System.String,System.String,System.Int64,System.Int32,System.Int32,System.Int64,TinyRustLM.P2PLocalImportBoundary)',
            'M:TinyRustLM.P2PLocalImportReceiptInspection.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.Int64,System.String,System.String,System.String,System.Int64,System.Int32,System.Int32,System.Boolean,TinyRustLM.P2PLocalImportBoundary)',
            'M:TinyRustLM.P2PManifest.#ctor(System.String,System.Int32,System.String,System.String,TinyRustLM.SlmInspection,System.String,System.Int64,System.Int64,System.Int32,System.Collections.Generic.IReadOnlyList{TinyRustLM.P2PPiece},System.Int64,TinyRustLM.P2PManifestBoundary)',
            'M:TinyRustLM.P2PManifestBoundary.#ctor(System.Boolean,System.Boolean,System.Boolean,System.Boolean)',
            'M:TinyRustLM.P2PManifestInspection.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Int64,System.Int32,System.Int64,System.Boolean)',
            'M:TinyRustLM.P2PPiece.#ctor(System.Int32,System.String,System.Int64,System.String)',
            'M:TinyRustLM.P2PShareKitReport.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.String,System.String,System.String,TinyRustLM.P2PManifest)',
            'M:TinyRustLM.P2PShareMetadata.#ctor(System.String,System.Int32,System.String,System.String,System.String,System.String,System.Int64,System.Int32,System.Int64,TinyRustLM.P2PManifestBoundary)',
            'M:TinyRustLM.PrepareShareKitRequest.#ctor(System.String,System.String,System.String,System.String,System.String,System.String,System.Nullable{System.Int64})',
            'M:TinyRustLM.SlmInspection.#ctor(System.String,System.Int32,System.String,System.Int64,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int32,System.Int64,System.Int32,System.Int32,System.Int32,System.Int32,System.String,System.UInt64)',
            'M:TinyRustLM.TinyRustLmCapabilities.#ctor(System.String,System.Int32,System.String,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Boolean,System.Collections.Generic.IReadOnlyList{System.String})',
            'M:TinyRustLM.TinyRustLmGenerationOptions.#ctor(System.Int32,System.Single,System.Int32,System.Single,System.UInt32)',
            'M:TinyRustLM.TinyRustLmGenerationResult.#ctor(System.String,System.String)',
            'M:TinyRustLM.TinyRustLmLoadReport.#ctor(TinyRustLM.SlmInspection,System.String)',
            'M:TinyRustLM.TinyRustLmSdkVersion.#ctor(System.String,System.Int32,System.String)',
            'P:TinyRustLM.TinyRustLmGenerationOptions.MaxNewTokens',
            'P:TinyRustLM.TinyRustLmGenerationOptions.Seed',
            'P:TinyRustLM.TinyRustLmGenerationOptions.Temperature',
            'P:TinyRustLM.TinyRustLmGenerationOptions.TopK',
            'P:TinyRustLM.TinyRustLmGenerationOptions.TopP',
            'T:TinyRustLM.ISlmInspector',
            'T:TinyRustLM.ITinyRustLmP2PClient',
            'T:TinyRustLM.ITinyRustLmRuntime',
            'T:TinyRustLM.ITinyRustLmRuntimeFactory',
            'T:TinyRustLM.P2PAnnouncement',
            'T:TinyRustLM.P2PAnnouncementCatalog',
            'T:TinyRustLM.P2PAnnouncementCatalogInspection',
            'T:TinyRustLM.P2PImportPlan',
            'T:TinyRustLM.P2PLocalImportBoundary',
            'T:TinyRustLM.P2PLocalImportReceipt',
            'T:TinyRustLM.P2PLocalImportReceiptInspection',
            'T:TinyRustLM.P2PManifest',
            'T:TinyRustLM.P2PManifestBoundary',
            'T:TinyRustLM.P2PManifestInspection',
            'T:TinyRustLM.P2PPiece',
            'T:TinyRustLM.P2PShareKitReport',
            'T:TinyRustLM.P2PShareMetadata',
            'T:TinyRustLM.PrepareShareKitRequest',
            'T:TinyRustLM.SlmInspection',
            'T:TinyRustLM.TinyRustLmCapabilities',
            'T:TinyRustLM.TinyRustLmGenerationOptions',
            'T:TinyRustLM.TinyRustLmGenerationResult',
            'T:TinyRustLM.TinyRustLmLoadReport',
            'T:TinyRustLM.TinyRustLmSdkVersion'
        )
    }

    if ($PackageId -eq "TinyRustLM.Core") {
        return @(
            'M:TinyRustLM.TinyRustLmException.#ctor(System.String,System.String)',
            'M:TinyRustLM.TinyRustLmRuntime.Dispose',
            'M:TinyRustLM.TinyRustLmRuntime.Generate(System.String,TinyRustLM.TinyRustLmGenerationOptions)',
            'M:TinyRustLM.TinyRustLmRuntime.GetDiagnostics',
            'M:TinyRustLM.TinyRustLmRuntime.LoadModel(System.String,System.String)',
            'M:TinyRustLM.TinyRustLmRuntime.Reset',
            'M:TinyRustLM.TinyRustLmRuntime.Step',
            'M:TinyRustLM.TinyRustLmRuntime.UnloadModel',
            'M:TinyRustLM.TinyRustLmRuntimeFactory.CreateRuntime',
            'M:TinyRustLM.TinyRustLmRuntimeFactory.GetCapabilities',
            'M:TinyRustLM.TinyRustLmRuntimeFactory.GetVersion',
            'M:TinyRustLM.TinySlmInspector.Inspect(System.String)',
            'P:TinyRustLM.TinyRustLmException.Code',
            'T:TinyRustLM.TinyRustLmException',
            'T:TinyRustLM.TinyRustLmRuntime',
            'T:TinyRustLM.TinyRustLmRuntimeFactory',
            'T:TinyRustLM.TinySlmInspector'
        )
    }

    if ($PackageId -eq "TinyRustLM.P2P") {
        return @(
            'M:TinyRustLM.TinyRustLmP2PClient.ApplyReceivedAnnouncement(System.String,System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.ApplyReceivedAnnouncementJson(System.String,System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.ExportShareMetadata(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.ExportShareMetadataJson(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.ImportFromManifest(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.ImportFromManifest(System.String,System.String,System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.InspectAnnouncementCatalog(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.InspectAnnouncementCatalogJson(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.InspectLocalImportReceipt(System.String,System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.InspectManifest(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.PrepareLocalShareKit(TinyRustLM.PrepareShareKitRequest)',
            'M:TinyRustLM.TinyRustLmP2PClient.PrepareLocalShareKitJson(TinyRustLM.PrepareShareKitRequest)',
            'M:TinyRustLM.TinyRustLmP2PClient.ValidateAnnouncement(System.String)',
            'M:TinyRustLM.TinyRustLmP2PClient.ValidateAnnouncementJson(System.String)',
            'T:TinyRustLM.TinyRustLmP2PClient'
        )
    }

    return @()
}

function Get-MissingPublicApiEntries {
    param(
        [string[]]$Expected,
        [string[]]$Actual
    )

    return @($Expected | Where-Object { $Actual -notcontains $_ })
}

function Get-UnexpectedPublicApiEntries {
    param(
        [string[]]$Expected,
        [string[]]$Actual
    )

    return @($Actual | Where-Object { $Expected -notcontains $_ })
}

function New-ExpectedDependencyEntry {
    param(
        [string]$Id,
        [string]$Version,
        [string]$Exclude = "Build,Analyzers"
    )

    return [ordered]@{
        id = $Id
        version = $Version
        exclude = $Exclude
    }
}

function Get-ExpectedDependencies {
    param(
        [string]$PackageId,
        [string]$PackageVersion
    )

    if ($PackageId -eq "TinyRustLM.Core") {
        return @(
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Abstractions" -Version $PackageVersion)
        )
    }
    if ($PackageId -eq "TinyRustLM.P2P") {
        return @(
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Abstractions" -Version $PackageVersion),
            (New-ExpectedDependencyEntry -Id "TinyRustLM.Core" -Version $PackageVersion)
        )
    }
    return @()
}

function Get-MissingDependencyEntries {
    param(
        $ExpectedDependencies,
        $ActualDependencies
    )

    $missing = @()
    foreach ($expected in $ExpectedDependencies) {
        $match = $ActualDependencies | Where-Object {
            $_.id -eq $expected.id -and
            $_.version -eq $expected.version -and
            $_.exclude -eq $expected.exclude
        } | Select-Object -First 1
        if (-not $match) {
            $missing += $expected
        }
    }
    return $missing
}

function Get-UnexpectedDependencyEntries {
    param(
        $ExpectedDependencies,
        $ActualDependencies
    )

    $unexpected = @()
    foreach ($actual in $ActualDependencies) {
        $match = $ExpectedDependencies | Where-Object {
            $_.id -eq $actual.id -and
            $_.version -eq $actual.version -and
            $_.exclude -eq $actual.exclude
        } | Select-Object -First 1
        if (-not $match) {
            $unexpected += $actual
        }
    }
    return $unexpected
}

function Get-UnexpectedNativeEntries {
    param(
        [string]$PackageId,
        [string[]]$NativeEntries
    )

    if ($PackageId -ne "TinyRustLM.Core") {
        return @($NativeEntries)
    }

    $allowedNativeEntries = @(Get-AllowedNativeEntries)
    return @($NativeEntries | Where-Object { $allowedNativeEntries -notcontains $_ })
}

function Get-AllowedNativeEntries {
    return @(
        "runtimes/win-x64/native/tinyrustlm_native.dll",
        "runtimes/linux-x64/native/libtinyrustlm_native.so",
        "runtimes/osx-x64/native/libtinyrustlm_native.dylib",
        "runtimes/osx-arm64/native/libtinyrustlm_native.dylib"
    )
}

function Get-AllowedNativeEntriesForPackage {
    param([string]$PackageId)

    if ($PackageId -eq "TinyRustLM.Core") {
        return @(Get-AllowedNativeEntries)
    }
    return @()
}

function Get-PackageIdentityMismatches {
    param(
        [string]$PackageName,
        [string]$ExpectedPackageId,
        [string]$ExpectedPackageVersion,
        $Metadata
    )

    $mismatches = @()
    if ([string]::IsNullOrWhiteSpace($ExpectedPackageId)) {
        return $mismatches
    }

    $actualId = [string]$Metadata.id
    $actualVersion = [string]$Metadata.version
    if ($actualId -ne $ExpectedPackageId -or $actualVersion -ne $ExpectedPackageVersion) {
        $mismatches += [ordered]@{
            name = $PackageName
            expected_id = $ExpectedPackageId
            actual_id = $actualId
            expected_version = $ExpectedPackageVersion
            actual_version = $actualVersion
        }
    }
    return $mismatches
}

$packageFiles = Get-ChildItem -Path $PackageSource -Filter "TinyRustLM*.nupkg" -File | Sort-Object Name
if (-not $packageFiles) {
    throw "No TinyRustLM packages were found in $PackageSource"
}

$sourcePackageVersion = Get-SourcePackageVersion
$expectedPackageNames = @(Get-ExpectedPackageNames -PackageVersion $sourcePackageVersion)
$packageNames = @($packageFiles | ForEach-Object { $_.Name })
$missingPackageEntries = @($expectedPackageNames | Where-Object { $packageNames -notcontains $_ })
$unexpectedPackageEntries = @($packageNames | Where-Object { $expectedPackageNames -notcontains $_ })

$privateSurfacePattern = "slm_pack|selector|adapter_family|trained_source|breeding"
$sourceFilePattern = "\.(cs|fs|vb|rs|c|cc|cpp|cxx|h|hh|hpp|hxx|m|mm|swift|kt|kts|java|go|py|ts|tsx|js|jsx|ps1|psm1|psd1|sh|bash)$"
$debugSymbolPattern = "\.(pdb|mdb|dbg)$|\.dSYM(?:/|$)"
$generatedOutputPattern = "(^|/)(bin|obj|target|artifacts)/"
$packageReports = @()
foreach ($package in $packageFiles) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($package.FullName)
    try {
        $entries = $zip.Entries | Sort-Object FullName
        $entryNames = $entries | ForEach-Object { $_.FullName }
        $privateMatches = @($entryNames | Where-Object { $_ -match $privateSurfacePattern })
        $sourceFileEntries = @($entryNames | Where-Object { $_ -match $sourceFilePattern })
        $debugSymbolEntries = @($entryNames | Where-Object { $_ -match $debugSymbolPattern })
        $generatedOutputEntries = @($entryNames | Where-Object { $_ -match $generatedOutputPattern })
        $absolutePathMatches = @(Get-AbsolutePathMatches -Entries $entries)
        $nativeEntries = @($entryNames | Where-Object { $_ -match "^runtimes/[^/]+/native/" })
        $xmlDocumentationEntries = @($entryNames | Where-Object { $_ -match "^lib/[^/]+/TinyRustLM\.[^/]+\.xml$" })
        $xmlDocumentationEntry = $entries | Where-Object { $_.FullName -match "^lib/[^/]+/TinyRustLM\.[^/]+\.xml$" } | Select-Object -First 1
        $nativeRids = @($nativeEntries | ForEach-Object { Get-NativeRidFromEntry -EntryName $_ } | Where-Object { $_ } | Sort-Object -Unique)
        $nuspecEntry = $entries | Where-Object { $_.FullName -like "*.nuspec" } | Select-Object -First 1
        $nuspecText = if ($nuspecEntry) { Read-ZipEntryText -Entry $nuspecEntry } else { "" }
        $metadata = Read-NuspecMetadata -NuspecText $nuspecText
        $expectedPackageId = Get-ExpectedPackageIdForName -PackageName $package.Name -PackageVersion $sourcePackageVersion
        $expectedPackageVersion = if ($expectedPackageId) { $sourcePackageVersion } else { "" }
        $packageIdentityMismatches = @(Get-PackageIdentityMismatches `
            -PackageName $package.Name `
            -ExpectedPackageId $expectedPackageId `
            -ExpectedPackageVersion $expectedPackageVersion `
            -Metadata $metadata)
        $packageId = $package.BaseName -replace "\.\d+(\.\d+){1,3}.*$", ""
        $packageVersion = [string]$metadata.version
        $dependencies = @(Read-NuspecDependencies -NuspecText $nuspecText)
        $expectedDependencyEntries = @(Get-ExpectedDependencies -PackageId $packageId -PackageVersion $packageVersion)
        $missingDependencyEntries = @(Get-MissingDependencyEntries -ExpectedDependencies $expectedDependencyEntries -ActualDependencies $dependencies)
        $unexpectedDependencyEntries = @(Get-UnexpectedDependencyEntries -ExpectedDependencies $expectedDependencyEntries -ActualDependencies $dependencies)
        $allowedNativeEntries = @(Get-AllowedNativeEntriesForPackage -PackageId $packageId)
        $unexpectedNativeEntries = @(Get-UnexpectedNativeEntries -PackageId $packageId -NativeEntries $nativeEntries)
        $allowedPackageEntryPatterns = @(Get-AllowedPackageEntryPatterns -PackageId $packageId)
        $unexpectedPackageContentEntries = @(Get-UnexpectedPackageContentEntries `
            -PackageId $packageId `
            -EntryNames $entryNames `
            -AllowedNativeEntries $allowedNativeEntries)
        $publicApiEntries = @(Read-XmlDocumentationMemberNames -Entry $xmlDocumentationEntry)
        $expectedPublicApiEntries = @(Get-ExpectedPublicApiEntries -PackageId $packageId)
        $missingPublicApiEntries = @(Get-MissingPublicApiEntries `
            -Expected $expectedPublicApiEntries `
            -Actual $publicApiEntries)
        $unexpectedPublicApiEntries = @(Get-UnexpectedPublicApiEntries `
            -Expected $expectedPublicApiEntries `
            -Actual $publicApiEntries)
        $expectedDocumentationEntry = "lib/net8.0/$packageId.xml"
        $missingDocumentationEntries = @()
        if ($xmlDocumentationEntries -notcontains $expectedDocumentationEntry) {
            $missingDocumentationEntries += $expectedDocumentationEntry
        }
        $declaredPackageFileEntries = @(Get-DeclaredPackageFileEntries -Metadata $metadata)
        $missingPackageFileEntries = @($declaredPackageFileEntries | Where-Object {
            $entryNames -notcontains $_
        })
        $packageDocumentationEntries = @(Get-PackageDocumentationEntries -EntryNames $entryNames)
        $expectedPackageDocumentationEntries = @(Get-PackageDocumentationVerification -PackageId $packageId -Entries $entries)
        $packageDocumentationMismatches = @($expectedPackageDocumentationEntries | Where-Object { -not $_.sha256_match })

        $packageReports += [ordered]@{
            name = $package.Name
            package_id = $packageId
            expected_package_id = $expectedPackageId
            expected_package_version = $expectedPackageVersion
            path = $package.FullName
            sha256 = (Get-FileHash -LiteralPath $package.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            byte_count = $package.Length
            entry_count = $entries.Count
            package_entry_names = $entryNames
            allowed_package_entry_patterns = $allowedPackageEntryPatterns
            unexpected_package_content_entries = $unexpectedPackageContentEntries
            public_api_entries = $publicApiEntries
            expected_public_api_entries = $expectedPublicApiEntries
            missing_public_api_entries = $missingPublicApiEntries
            unexpected_public_api_entries = $unexpectedPublicApiEntries
            native_rids = $nativeRids
            native_entries = $nativeEntries
            allowed_native_entries = $allowedNativeEntries
            unexpected_native_entries = $unexpectedNativeEntries
            metadata = $metadata
            package_identity_mismatches = $packageIdentityMismatches
            missing_metadata_fields = @(Get-MissingMetadataFields -Metadata $metadata)
            declared_package_file_entries = $declaredPackageFileEntries
            missing_package_file_entries = $missingPackageFileEntries
            package_documentation_entries = $packageDocumentationEntries
            expected_package_documentation_entries = $expectedPackageDocumentationEntries
            package_documentation_mismatches = $packageDocumentationMismatches
            xml_documentation_entries = $xmlDocumentationEntries
            missing_documentation_entries = $missingDocumentationEntries
            dependencies = $dependencies
            expected_dependency_entries = $expectedDependencyEntries
            missing_dependency_entries = $missingDependencyEntries
            unexpected_dependency_entries = $unexpectedDependencyEntries
            private_surface_matches = $privateMatches
            source_file_entries = $sourceFileEntries
            debug_symbol_entries = $debugSymbolEntries
            generated_output_entries = $generatedOutputEntries
            absolute_path_matches = $absolutePathMatches
        }
    }
    finally {
        $zip.Dispose()
    }
}

$corePackage = $packageReports | Where-Object { $_.name -like "TinyRustLM.Core.*.nupkg" } | Select-Object -First 1
$missingNativeRids = @()
if ($corePackage) {
    foreach ($rid in $RequiredNativeRids) {
        if ($corePackage.native_rids -notcontains $rid) {
            $missingNativeRids += $rid
        }
    }
}
elseif ($RequiredNativeRids.Count -gt 0) {
    $missingNativeRids = $RequiredNativeRids
}

$allPrivateMatches = @($packageReports | ForEach-Object { $_.private_surface_matches } | Where-Object { $_ })
$allPackageIdentityMismatches = @($packageReports | ForEach-Object { $_.package_identity_mismatches } | Where-Object { $_ })
$allMissingMetadata = @($packageReports | ForEach-Object { $_.missing_metadata_fields } | Where-Object { $_ })
$allMissingPackageFiles = @($packageReports | ForEach-Object { $_.missing_package_file_entries } | Where-Object { $_ })
$allPackageDocumentationMismatches = @($packageReports | ForEach-Object { $_.package_documentation_mismatches } | Where-Object { $_ })
$allMissingDependencies = @($packageReports | ForEach-Object { $_.missing_dependency_entries } | Where-Object { $_ })
$allUnexpectedDependencies = @($packageReports | ForEach-Object { $_.unexpected_dependency_entries } | Where-Object { $_ })
$allUnexpectedNativeEntries = @($packageReports | ForEach-Object { $_.unexpected_native_entries } | Where-Object { $_ })
$allUnexpectedPackageContentEntries = @($packageReports | ForEach-Object { $_.unexpected_package_content_entries } | Where-Object { $_ })
$allMissingPublicApiEntries = @($packageReports | ForEach-Object { $_.missing_public_api_entries } | Where-Object { $_ })
$allUnexpectedPublicApiEntries = @($packageReports | ForEach-Object { $_.unexpected_public_api_entries } | Where-Object { $_ })
$allMissingDocumentation = @($packageReports | ForEach-Object { $_.missing_documentation_entries } | Where-Object { $_ })
$allSourceFileEntries = @($packageReports | ForEach-Object { $_.source_file_entries } | Where-Object { $_ })
$allDebugSymbolEntries = @($packageReports | ForEach-Object { $_.debug_symbol_entries } | Where-Object { $_ })
$allGeneratedOutputEntries = @($packageReports | ForEach-Object { $_.generated_output_entries } | Where-Object { $_ })
$allAbsolutePathMatches = @($packageReports | ForEach-Object { $_.absolute_path_matches } | Where-Object { $_ })
$checksPassed = @(
    $missingPackageEntries.Count -eq 0
    $unexpectedPackageEntries.Count -eq 0
    $allPackageIdentityMismatches.Count -eq 0
    $missingNativeRids.Count -eq 0
    $allPrivateMatches.Count -eq 0
    $allMissingMetadata.Count -eq 0
    $allMissingPackageFiles.Count -eq 0
    $allPackageDocumentationMismatches.Count -eq 0
    $allMissingDependencies.Count -eq 0
    $allUnexpectedDependencies.Count -eq 0
    $allUnexpectedNativeEntries.Count -eq 0
    $allUnexpectedPackageContentEntries.Count -eq 0
    $allMissingPublicApiEntries.Count -eq 0
    $allUnexpectedPublicApiEntries.Count -eq 0
    $allMissingDocumentation.Count -eq 0
    $allSourceFileEntries.Count -eq 0
    $allDebugSymbolEntries.Count -eq 0
    $allGeneratedOutputEntries.Count -eq 0
    $allAbsolutePathMatches.Count -eq 0
) -notcontains $false
$status = if ($checksPassed) { "pass" } else { "fail" }
$report = [ordered]@{
    schema = "tinyrustlm.nuget.package_audit.v0"
    generated_utc = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ")
    package_source = (Resolve-Path -LiteralPath $PackageSource).Path
    package_version = $sourcePackageVersion
    expected_package_names = $expectedPackageNames
    required_native_rids = $RequiredNativeRids
    status = $status
    missing_package_entries = $missingPackageEntries
    unexpected_package_entries = $unexpectedPackageEntries
    missing_native_rids = $missingNativeRids
    missing_package_count = $missingPackageEntries.Count
    unexpected_package_count = $unexpectedPackageEntries.Count
    package_identity_mismatch_count = $allPackageIdentityMismatches.Count
    missing_metadata_count = $allMissingMetadata.Count
    missing_package_file_count = $allMissingPackageFiles.Count
    package_documentation_mismatch_count = $allPackageDocumentationMismatches.Count
    missing_dependency_count = $allMissingDependencies.Count
    unexpected_dependency_count = $allUnexpectedDependencies.Count
    unexpected_native_entry_count = $allUnexpectedNativeEntries.Count
    unexpected_package_content_entry_count = $allUnexpectedPackageContentEntries.Count
    missing_public_api_entry_count = $allMissingPublicApiEntries.Count
    unexpected_public_api_entry_count = $allUnexpectedPublicApiEntries.Count
    missing_documentation_count = $allMissingDocumentation.Count
    source_file_count = $allSourceFileEntries.Count
    debug_symbol_count = $allDebugSymbolEntries.Count
    generated_output_count = $allGeneratedOutputEntries.Count
    absolute_path_match_count = $allAbsolutePathMatches.Count
    package_count = $packageReports.Count
    packages = $packageReports
}

$reportDirectory = Split-Path -Parent $ReportOutput
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportOutput -Encoding UTF8
Write-Host "TinyRustLM NuGet package audit written to $ReportOutput"

if ($status -ne "pass") {
    throw "TinyRustLM NuGet package audit failed. See $ReportOutput"
}
