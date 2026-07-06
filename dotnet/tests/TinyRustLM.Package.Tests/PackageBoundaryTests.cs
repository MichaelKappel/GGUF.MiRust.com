using System.IO.Compression;
using System.Text.Json;
using Xunit;

namespace TinyRustLM.Package.Tests;

public sealed class PackageBoundaryTests
{
    [Fact]
    public void RequiredNuGetInfrastructureExists()
    {
        var root = RepositoryRoot();
        var required = new[]
        {
            "rust/crates/tinyrustlm-runtime/Cargo.toml",
            "rust/crates/tinyrustlm-slm/Cargo.toml",
            "rust/crates/tinyrustlm-p2p/Cargo.toml",
            "rust/crates/tinyrustlm-native/Cargo.toml",
            "dotnet/TinyRustLM.sln",
            "eng/build-native.ps1",
            "eng/get-package-version.ps1",
            "eng/get-package-version.sh",
            "eng/audit-nuget-release-readiness.ps1",
            "eng/audit-nuget-release-readiness.sh",
            "eng/pack.ps1",
            "eng/publish-nuget.ps1",
            "eng/publish-nuget.sh",
            "eng/verify-consumer.ps1",
            "eng/verify-feed-current.ps1",
            "eng/verify-feed-current.sh",
            "eng/verify-feed-package-hashes.ps1",
            "eng/verify-feed-package-hashes.sh",
            "eng/verify-feed.ps1",
            "eng/verify-feed.sh",
            "eng/verify-package.ps1",
            "eng/write-package-audit.ps1",
            "eng/write-package-audit.sh",
            "docs/nuget/API_BOUNDARY.md",
            "docs/nuget/PACKAGE_SECURITY.md",
            ".github/workflows/ci.yml",
            ".github/workflows/nuget-feed-monitor.yml",
            ".github/workflows/release-nuget.yml"
        };

        foreach (var relative in required)
        {
            Assert.True(File.Exists(Path.Combine(root, relative)), relative);
        }
    }

    [Fact]
    public void NuGetAndRustWorkspaceVersionsStayAligned()
    {
        var root = RepositoryRoot();
        var props = File.ReadAllText(Path.Combine(root, "dotnet/Directory.Build.props"));
        var releaseNotes = ExtractProperty(props, "PackageReleaseNotes");
        var packageVersion = PackageVersion();
        var cargoVersion = WorkspacePackageVersion(File.ReadAllText(Path.Combine(root, "Cargo.toml")));
        var protectedCrates = new[]
        {
            "rust/crates/tinyrustlm-runtime/Cargo.toml",
            "rust/crates/tinyrustlm-slm/Cargo.toml",
            "rust/crates/tinyrustlm-p2p/Cargo.toml",
            "rust/crates/tinyrustlm-native/Cargo.toml"
        };

        Assert.Equal(packageVersion, cargoVersion);
        Assert.Contains("receipt-sidecar inspection", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("typed share-kit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("direct announcement URL validation", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("announcement JSON handoff", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("catalog inspection", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("managed/native generation-option validation", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("embedded-NUL string-boundary validation", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("empty-string native bridge preservation", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("managed share-kit request validation", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("managed P2P JSON byte-budget preflight", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("declared package-file audit gates", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("package documentation hash parity audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("exact package-set audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("package identity audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("public dependency graph audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dependency metadata policy audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("native asset placement audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("native asset filename audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("package entry allow-list audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("public API surface audit", releaseNotes, StringComparison.OrdinalIgnoreCase);
        foreach (var relativePath in protectedCrates)
        {
            var crateToml = File.ReadAllText(Path.Combine(root, relativePath));
            Assert.Contains("version.workspace = true", crateToml, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void PackageVerificationScriptsWriteMachineReadableAudit()
    {
        var root = RepositoryRoot();
        var powershellVerifier = File.ReadAllText(Path.Combine(root, "eng/verify-package.ps1"));
        var bashVerifier = File.ReadAllText(Path.Combine(root, "eng/verify-package.sh"));
        var powershellAuditWriter = File.ReadAllText(Path.Combine(root, "eng/write-package-audit.ps1"));
        var bashAuditWriter = File.ReadAllText(Path.Combine(root, "eng/write-package-audit.sh"));

        Assert.Contains("write-package-audit.ps1", powershellVerifier, StringComparison.Ordinal);
        Assert.Contains("write-package-audit.sh", bashVerifier, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_PACKAGE_AUDIT_REPORT", powershellVerifier, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_PACKAGE_AUDIT_REPORT", bashVerifier, StringComparison.Ordinal);

        foreach (var writer in new[] { powershellAuditWriter, bashAuditWriter })
        {
            Assert.Contains("tinyrustlm.nuget.package_audit.v0", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_names", writer, StringComparison.Ordinal);
            Assert.Contains("missing_package_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_package_count", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_count", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_id", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_version", writer, StringComparison.Ordinal);
            Assert.Contains("package_identity_mismatches", writer, StringComparison.Ordinal);
            Assert.Contains("package_identity_mismatch_count", writer, StringComparison.Ordinal);
            Assert.Contains("missing_metadata_fields", writer, StringComparison.Ordinal);
            Assert.Contains("declared_package_file_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_package_file_entries", writer, StringComparison.Ordinal);
            Assert.Contains("package_documentation_entries", writer, StringComparison.Ordinal);
            Assert.Contains("expected_package_documentation_entries", writer, StringComparison.Ordinal);
            Assert.Contains("package_documentation_mismatches", writer, StringComparison.Ordinal);
            Assert.Contains("package_documentation_mismatch_count", writer, StringComparison.Ordinal);
            Assert.Contains("package_entry_names", writer, StringComparison.Ordinal);
            Assert.Contains("allowed_package_entry_patterns", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_content_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_package_content_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("package/services/metadata/core-properties/*.psmdcp", writer, StringComparison.Ordinal);
            Assert.Contains("public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("expected_public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_public_api_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_public_api_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_public_api_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("TinyRustLmP2PClient", writer, StringComparison.Ordinal);
            Assert.Contains("TinySlmInspector", writer, StringComparison.Ordinal);
            Assert.Contains("expected_dependency_entries", writer, StringComparison.Ordinal);
            Assert.Contains("missing_dependency_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_dependency_entries", writer, StringComparison.Ordinal);
            Assert.Contains("Build,Analyzers", writer, StringComparison.Ordinal);
            Assert.Contains("allowed_native_entries", writer, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm_native.dll", writer, StringComparison.Ordinal);
            Assert.Contains("libtinyrustlm_native.so", writer, StringComparison.Ordinal);
            Assert.Contains("libtinyrustlm_native.dylib", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_native_entries", writer, StringComparison.Ordinal);
            Assert.Contains("unexpected_native_entry_count", writer, StringComparison.Ordinal);
            Assert.Contains("xml_documentation_entries", writer, StringComparison.Ordinal);
            Assert.Contains("absolute_path_matches", writer, StringComparison.Ordinal);
            Assert.Contains("source_file_entries", writer, StringComparison.Ordinal);
            Assert.Contains("debug_symbol_entries", writer, StringComparison.Ordinal);
            Assert.Contains("generated_output_entries", writer, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void PackScriptsRemoveStaleTinyRustLmPackagesBeforePacking()
    {
        var root = RepositoryRoot();
        var powershellPack = File.ReadAllText(Path.Combine(root, "eng/pack.ps1"));
        var bashPack = File.ReadAllText(Path.Combine(root, "eng/pack.sh"));

        Assert.Contains("TinyRustLM*.nupkg", powershellPack, StringComparison.Ordinal);
        Assert.Contains("Remove-Item", powershellPack, StringComparison.Ordinal);
        Assert.Contains("TinyRustLM*.nupkg", bashPack, StringComparison.Ordinal);
        Assert.Contains("-delete", bashPack, StringComparison.Ordinal);
    }

    [Fact]
    public void CorePackageProjectDoesNotReferencePrivateTooling()
    {
        var root = RepositoryRoot();
        var coreProject = File.ReadAllText(Path.Combine(
            root,
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj"));
        var nativeCargo = File.ReadAllText(Path.Combine(
            root,
            "rust/crates/tinyrustlm-native/Cargo.toml"));

        Assert.DoesNotContain("slm_pack", coreProject, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("tools/slm_pack", nativeCargo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("selector", nativeCargo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("breeding", nativeCargo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ReleaseWorkflowUsesAuditedPublishScript()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/release-nuget.yml"));
        var gitignore = File.ReadAllText(Path.Combine(root, ".gitignore"));

        Assert.Contains("eng/publish-nuget.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-current.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-package-hashes.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-current.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-hashes.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke.json", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedSmokeReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedHashReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("Post-publish feed-current and feed-hash checks are mandatory", workflow, StringComparison.Ordinal);
        Assert.Contains("Start-Sleep -Seconds 30", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-post-publish-required-reports", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke-report", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-publish-plan.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-publish-plan", workflow, StringComparison.Ordinal);
        Assert.Contains("hashFiles('artifacts/reports/tinyrustlm-nuget-publish-plan.json') != ''", workflow, StringComparison.Ordinal);
        Assert.Contains("PublishPlanReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/audit-nuget-release-readiness.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-release-readiness.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-release-readiness", workflow, StringComparison.Ordinal);
        Assert.Contains("ReleaseReadinessReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("id: readiness", workflow, StringComparison.Ordinal);
        Assert.Contains("status=$($report.status)", workflow, StringComparison.Ordinal);
        Assert.Contains("id-token: write", workflow, StringComparison.Ordinal);
        Assert.Contains("auth_mode", workflow, StringComparison.Ordinal);
        Assert.Contains("trusted_publishing", workflow, StringComparison.Ordinal);
        Assert.Contains("NuGet/login@v1", workflow, StringComparison.Ordinal);
        Assert.Contains("id: nuget_login", workflow, StringComparison.Ordinal);
        Assert.Contains("steps.nuget_login.outputs.NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("-AuthMode $env:TINYRUSTLM_NUGET_AUTH_MODE", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_TEMP_NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("steps.readiness.outputs.status != 'published_current'", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_FEED_CURRENT_REPORT", workflow, StringComparison.Ordinal);
        Assert.Contains("build-native:", workflow, StringComparison.Ordinal);
        Assert.Contains("win-x64,linux-x64,osx-x64,osx-arm64", workflow, StringComparison.Ordinal);
        Assert.DoesNotContain("-PackageVersion 0.1.0", workflow, StringComparison.Ordinal);
        Assert.Contains("NUGET_API_KEY", workflow, StringComparison.Ordinal);
        Assert.Contains("**/bin/", gitignore, StringComparison.Ordinal);
        Assert.Contains("**/obj/", gitignore, StringComparison.Ordinal);
    }

    [Fact]
    public void PublishScriptsRejectUnexpectedPackages()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("Publish set contains unexpected package", script, StringComparison.Ordinal);
            Assert.Contains("Expected exactly", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Abstractions", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.Core", script, StringComparison.Ordinal);
            Assert.Contains("TinyRustLM.P2P", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void P2PPublicSdkExposesLocalAssemblyBoundary()
    {
        var root = RepositoryRoot();
        var p2pRust = File.ReadAllText(Path.Combine(root, "rust/crates/tinyrustlm-p2p/src/lib.rs"));
        var nativeRust = File.ReadAllText(Path.Combine(root, "rust/crates/tinyrustlm-native/src/lib.rs"));
        var runtimeSdkRust = File.ReadAllText(Path.Combine(root, "rust/crates/tinyrustlm-runtime/src/lib.rs"));
        var nativeMethods = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Core/NativeMethods.cs"));
        var nativeJson = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Core/NativeJson.cs"));
        var runtimeModels = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Abstractions/RuntimeModels.cs"));
        var runtimeFactory = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Core/TinyRustLmRuntimeFactory.cs"));
        var abstractions = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.Abstractions/P2PModels.cs"));
        var client = File.ReadAllText(Path.Combine(root, "dotnet/src/TinyRustLM.P2P/TinyRustLmP2PClient.cs"));
        var verifyConsumerPowerShell = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.ps1"));
        var verifyConsumerBash = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.sh"));
        var boundaryDoc = File.ReadAllText(Path.Combine(root, "docs/nuget/API_BOUNDARY.md"));

        Assert.Contains("TinyRustLmSdkVersion", runtimeModels, StringComparison.Ordinal);
        Assert.Contains("GetVersion()", runtimeModels, StringComparison.Ordinal);
        Assert.Contains("embedded NUL", nativeJson, StringComparison.Ordinal);
        Assert.Contains("ThrowIfContainsEmbeddedNul", nativeJson, StringComparison.Ordinal);
        Assert.Contains("value is null", nativeJson, StringComparison.Ordinal);
        Assert.DoesNotContain("string.IsNullOrEmpty(value)", nativeJson, StringComparison.Ordinal);
        Assert.Contains("MAX_GENERATION_TOP_K", runtimeSdkRust, StringComparison.Ordinal);
        Assert.Contains("InvalidGenerationOptions", runtimeSdkRust, StringComparison.Ordinal);
        Assert.Contains("GenerationOptions::from_native", nativeRust, StringComparison.Ordinal);
        Assert.Contains("invalid_generation_options", nativeRust, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_sdk_version_json", nativeMethods, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_sdk_version_json", runtimeFactory, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.p2p_local_import_receipt.v0", p2pRust, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.p2p_local_import_receipt_inspection.v0", p2pRust, StringComparison.Ordinal);
        Assert.Contains("assemble_from_manifest_text", p2pRust, StringComparison.Ordinal);
        Assert.Contains("inspect_local_import_receipt_text", p2pRust, StringComparison.Ordinal);
        Assert.Contains("safe_load_slm_from_path", p2pRust, StringComparison.Ordinal);
        Assert.Contains("network_fetch_performed: false", p2pRust, StringComparison.Ordinal);
        Assert.Contains("private_routing_used: false", p2pRust, StringComparison.Ordinal);
        Assert.Contains("normalize_public_base_url", p2pRust, StringComparison.Ordinal);
        Assert.DoesNotContain("placeholder.json", p2pRust, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("tinyrustlm_p2p_assemble_from_manifest_json", nativeRust, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_p2p_inspect_local_import_receipt_json", nativeRust, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_p2p_inspect_announcement_catalog_json", nativeRust, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_p2p_assemble_from_manifest_json", nativeMethods, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_p2p_inspect_local_import_receipt_json", nativeMethods, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm_p2p_inspect_announcement_catalog_json", nativeMethods, StringComparison.Ordinal);
        Assert.Contains("P2PShareKitReport", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PShareMetadata", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PManifestBoundary", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PLocalImportReceipt", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PLocalImportReceiptInspection", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PAnnouncement", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PAnnouncementCatalog", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PAnnouncementCatalogInspection", abstractions, StringComparison.Ordinal);
        Assert.Contains("ValidateAnnouncementJson", abstractions, StringComparison.Ordinal);
        Assert.Contains("ApplyReceivedAnnouncementJson", abstractions, StringComparison.Ordinal);
        Assert.Contains("InspectAnnouncementCatalogJson", abstractions, StringComparison.Ordinal);
        Assert.Contains("ReceiptPath", abstractions, StringComparison.Ordinal);
        Assert.Contains("P2PShareKitReport PrepareLocalShareKit", client, StringComparison.Ordinal);
        Assert.Contains("ValidatePrepareShareKitRequest", client, StringComparison.Ordinal);
        Assert.Contains("ValidateJsonHandoff", client, StringComparison.Ordinal);
        Assert.Contains("ValidateOptionalJsonHandoff", client, StringComparison.Ordinal);
        Assert.Contains("MinPieceSize", client, StringComparison.Ordinal);
        Assert.Contains("MaxPieceSize", client, StringComparison.Ordinal);
        Assert.Contains("MaxManifestJsonBytes", client, StringComparison.Ordinal);
        Assert.Contains("MaxAnnouncementJsonBytes", client, StringComparison.Ordinal);
        Assert.Contains("MaxAnnouncementCatalogJsonBytes", client, StringComparison.Ordinal);
        Assert.Contains("MaxReceiptJsonBytes", client, StringComparison.Ordinal);
        Assert.Contains("PrepareLocalShareKitJson", client, StringComparison.Ordinal);
        Assert.Contains("P2PShareMetadata ExportShareMetadata", client, StringComparison.Ordinal);
        Assert.Contains("ExportShareMetadataJson", client, StringComparison.Ordinal);
        Assert.Contains("P2PAnnouncement ValidateAnnouncement", client, StringComparison.Ordinal);
        Assert.Contains("ValidateAnnouncementJson", client, StringComparison.Ordinal);
        Assert.Contains("P2PAnnouncementCatalog ApplyReceivedAnnouncement", client, StringComparison.Ordinal);
        Assert.Contains("ApplyReceivedAnnouncementJson", client, StringComparison.Ordinal);
        Assert.Contains("P2PAnnouncementCatalogInspection InspectAnnouncementCatalog", client, StringComparison.Ordinal);
        Assert.Contains("InspectAnnouncementCatalogJson", client, StringComparison.Ordinal);
        Assert.Contains("ImportFromManifest(", client, StringComparison.Ordinal);
        Assert.Contains("InspectLocalImportReceipt", client, StringComparison.Ordinal);
        Assert.Contains("GetVersion()", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("GetVersion()", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("P2PShareKitReport", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("P2PShareKitReport", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("consumer-smoke-assembled.slm", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("consumer-smoke-assembled.slm", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("ReceiptPath", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("ReceiptPath", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("InspectLocalImportReceipt", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("InspectLocalImportReceipt", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("ValidateAnnouncementJson", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("ValidateAnnouncementJson", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("ApplyReceivedAnnouncementJson", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("ApplyReceivedAnnouncementJson", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("InspectAnnouncementCatalog", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("InspectAnnouncementCatalog", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.p2p_announcement_catalog_inspection.v0", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm.p2p_announcement_catalog_inspection.v0", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("consumer-smoke-unsafe-url", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("consumer-smoke-unsafe-url", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("public_base_url", verifyConsumerPowerShell, StringComparison.Ordinal);
        Assert.Contains("public_base_url", verifyConsumerBash, StringComparison.Ordinal);
        Assert.Contains("local manifest-declared pieces", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("typed local share-kit report", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("typed share metadata", boundaryDoc, StringComparison.Ordinal);
        Assert.Contains("announcement/catalog JSON handoff", boundaryDoc, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("inspect a local import receipt", boundaryDoc, StringComparison.Ordinal);
        Assert.DoesNotContain("slm_pack", client, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void PublishScriptsWriteMachineReadablePlan()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/publish-nuget.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-publish-plan.json", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("package_audit_match", script, StringComparison.Ordinal);
            Assert.Contains("blocked_missing_audit_report", script, StringComparison.Ordinal);
            Assert.Contains("blocked_audit_mismatch", script, StringComparison.Ordinal);
            Assert.Contains("push_failed", script, StringComparison.Ordinal);
            Assert.Contains("publish_error", script, StringComparison.Ordinal);
            Assert.Contains("<redacted>", script, StringComparison.Ordinal);
            Assert.Contains("sha256", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void FeedMonitorWorkflowRunsFreshnessGate()
    {
        var root = RepositoryRoot();
        var workflow = File.ReadAllText(Path.Combine(root, ".github/workflows/nuget-feed-monitor.yml"));

        Assert.Contains("schedule:", workflow, StringComparison.Ordinal);
        Assert.Contains("cron:", workflow, StringComparison.Ordinal);
        Assert.Contains("workflow_dispatch:", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_ENABLED", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_SOURCE", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_ALLOW_NEWER", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_VERIFY_CONSUMER", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_VERIFY_HASHES", workflow, StringComparison.Ordinal);
        Assert.Contains("TINYRUSTLM_NUGET_MONITOR_PUBLISH_PLAN_REPORT", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.allow_newer)", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.verify_consumer)", workflow, StringComparison.Ordinal);
        Assert.Contains("format('{0}', inputs.verify_hashes)", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-current.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed-package-hashes.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("eng/verify-feed.ps1", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedCurrentReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedSmokeReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("FeedHashReportIsMachineReadableWhenPresent", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-current.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-hashes.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke.json", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-monitor-report", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-hash-report", workflow, StringComparison.Ordinal);
        Assert.Contains("tinyrustlm-nuget-feed-smoke-report", workflow, StringComparison.Ordinal);
        Assert.DoesNotContain("NUGET_API_KEY", workflow, StringComparison.Ordinal);
    }

    [Fact]
    public void FeedHashVerificationScriptsWriteMachineReadableReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed-package-hashes.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed-package-hashes.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.feed_hashes.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-feed-hashes.json", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm.nuget.publish_plan.v0", script, StringComparison.Ordinal);
            Assert.Contains("PackageBaseAddress/3.0.0", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_report_sha256", script, StringComparison.Ordinal);
            Assert.Contains("package_audit_report_sha256", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void ReleaseReadinessScriptsWriteMachineReadableReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/audit-nuget-release-readiness.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/audit-nuget-release-readiness.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.release_readiness.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-release-readiness.json", script, StringComparison.Ordinal);
            Assert.Contains("publish_plan_dry_run", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_current", script, StringComparison.Ordinal);
            Assert.Contains("local_feed_hashes", script, StringComparison.Ordinal);
            Assert.Contains("remote_feed_current", script, StringComparison.Ordinal);
            Assert.Contains("remote_feed_hashes", script, StringComparison.Ordinal);
            Assert.Contains("blocked_missing_api_key", script, StringComparison.Ordinal);
            Assert.Contains("blocked_trusted_publishing_unsupported", script, StringComparison.Ordinal);
            Assert.Contains("ready_to_publish", script, StringComparison.Ordinal);
            Assert.Contains("published_current", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("auth_mode", script, StringComparison.Ordinal);
            Assert.Contains("api_key_present", script, StringComparison.Ordinal);
            Assert.Contains("trusted_publishing_requested", script, StringComparison.Ordinal);
            Assert.Contains("trusted_publishing_supported", script, StringComparison.Ordinal);
            Assert.Contains("report_written", script, StringComparison.Ordinal);
        }

        Assert.Contains("Remove-Item -LiteralPath $ReportPath", powershellScript, StringComparison.Ordinal);
        Assert.Contains("Remove-Item -LiteralPath $RemoteFeedHashReport", powershellScript, StringComparison.Ordinal);
        Assert.Contains("rm -f -- \"$report_path\"", bashScript, StringComparison.Ordinal);
        Assert.Contains("rm -f -- \"$REMOTE_FEED_HASH_REPORT\"", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void FeedVerificationScriptsWriteMachineReadableSmokeReport()
    {
        var root = RepositoryRoot();
        var powershellScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed.ps1"));
        var bashScript = File.ReadAllText(Path.Combine(root, "eng/verify-feed.sh"));
        var bashConsumerScript = File.ReadAllText(Path.Combine(root, "eng/verify-consumer.sh"));

        foreach (var script in new[] { powershellScript, bashScript })
        {
            Assert.Contains("tinyrustlm.nuget.feed_smoke.v0", script, StringComparison.Ordinal);
            Assert.Contains("tinyrustlm-nuget-feed-smoke.json", script, StringComparison.Ordinal);
            Assert.Contains("secret_material_included", script, StringComparison.Ordinal);
            Assert.Contains("local_piece_assembly_verified", script, StringComparison.Ordinal);
            Assert.Contains("consumer_output_sha256", script, StringComparison.Ordinal);
            Assert.Contains("consumer_output_excerpt", script, StringComparison.Ordinal);
        }

        Assert.Contains("dotnet CLI is required", bashConsumerScript, StringComparison.Ordinal);
        Assert.Contains("consumer_output", bashScript, StringComparison.Ordinal);
        Assert.Contains("error_message", bashScript, StringComparison.Ordinal);
    }

    [Fact]
    public void CorePackageProjectDeclaresSupportedNativeAssets()
    {
        var root = RepositoryRoot();
        var coreProject = File.ReadAllText(Path.Combine(
            root,
            "dotnet/src/TinyRustLM.Core/TinyRustLM.Core.csproj"));

        var requiredEntries = new[]
        {
            "runtimes\\win-x64\\native\\",
            "runtimes\\linux-x64\\native\\",
            "runtimes\\osx-x64\\native\\",
            "runtimes\\osx-arm64\\native\\"
        };

        foreach (var entry in requiredEntries)
        {
            Assert.Contains(entry, coreProject, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void BuiltPackagesDoNotContainPrivateAuthoringCratesWhenPresent()
    {
        var packagesDir = Environment.GetEnvironmentVariable("TINYRUSTLM_PACKAGE_DIR");
        if (string.IsNullOrWhiteSpace(packagesDir) || !Directory.Exists(packagesDir))
        {
            return;
        }

        foreach (var package in Directory.EnumerateFiles(packagesDir, "TinyRustLM*.nupkg"))
        {
            using var zip = ZipFile.OpenRead(package);
            var entries = zip.Entries.Select(entry => entry.FullName).ToArray();
            Assert.DoesNotContain(entries, entry =>
                entry.Contains("slm_pack", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("selector", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("adapter_family", StringComparison.OrdinalIgnoreCase)
                || entry.Contains("trained_source", StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void PackageAuditReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_PACKAGE_AUDIT_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.package_audit.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.Equal(3, root.GetProperty("package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("package_identity_mismatch_count").GetInt32());
        Assert.Empty(root.GetProperty("missing_package_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("unexpected_package_entries").EnumerateArray());
        Assert.Empty(root.GetProperty("missing_native_rids").EnumerateArray());
        Assert.Equal(0, root.GetProperty("source_file_count").GetInt32());
        Assert.Equal(0, root.GetProperty("debug_symbol_count").GetInt32());
        Assert.Equal(0, root.GetProperty("generated_output_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_package_file_count").GetInt32());
        Assert.Equal(0, root.GetProperty("package_documentation_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_dependency_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_dependency_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_native_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_package_content_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("missing_public_api_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("unexpected_public_api_entry_count").GetInt32());
        Assert.Equal(0, root.GetProperty("absolute_path_match_count").GetInt32());

        var expectedPackageNames = root.GetProperty("expected_package_names")
            .EnumerateArray()
            .Select(package => package.GetString())
            .ToArray();
        Assert.Equal(3, expectedPackageNames.Length);
        Assert.Contains($"TinyRustLM.Abstractions.{packageVersion}.nupkg", expectedPackageNames);
        Assert.Contains($"TinyRustLM.Core.{packageVersion}.nupkg", expectedPackageNames);
        Assert.Contains($"TinyRustLM.P2P.{packageVersion}.nupkg", expectedPackageNames);

        var packageNames = root.GetProperty("packages")
            .EnumerateArray()
            .Select(package => package.GetProperty("name").GetString())
            .ToArray();
        Assert.Equal(expectedPackageNames.OrderBy(name => name), packageNames.OrderBy(name => name));

        foreach (var package in root.GetProperty("packages").EnumerateArray())
        {
            AssertExpectedPackageIdentity(package, packageVersion);
            Assert.Empty(package.GetProperty("package_identity_mismatches").EnumerateArray());
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
            Assert.Empty(package.GetProperty("missing_metadata_fields").EnumerateArray());
            Assert.Contains(package.GetProperty("declared_package_file_entries").EnumerateArray(), entry =>
                entry.GetString() == "README.md");
            Assert.Contains(package.GetProperty("declared_package_file_entries").EnumerateArray(), entry =>
                entry.GetString() == "LICENSE.txt");
            Assert.Empty(package.GetProperty("missing_package_file_entries").EnumerateArray());
            Assert.Contains(package.GetProperty("package_documentation_entries").EnumerateArray(), entry =>
                entry.GetString() == "README.md");
            Assert.Contains(package.GetProperty("package_documentation_entries").EnumerateArray(), entry =>
                entry.GetString() == "LICENSE.txt");
            AssertExpectedPackageDocumentation(package);
            Assert.Empty(package.GetProperty("package_documentation_mismatches").EnumerateArray());
            AssertExpectedPackageDependencies(package);
            AssertExpectedPackageContentEntries(package);
            AssertExpectedPublicApiEntries(package);
            AssertExpectedNativeEntries(package);
            Assert.Empty(package.GetProperty("missing_dependency_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_dependency_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_native_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_package_content_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("missing_public_api_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("unexpected_public_api_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("missing_documentation_entries").EnumerateArray());
            Assert.NotEmpty(package.GetProperty("xml_documentation_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("private_surface_matches").EnumerateArray());
            Assert.Empty(package.GetProperty("source_file_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("debug_symbol_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("generated_output_entries").EnumerateArray());
            Assert.Empty(package.GetProperty("absolute_path_matches").EnumerateArray());
            Assert.False(string.IsNullOrWhiteSpace(package.GetProperty("metadata").GetProperty("tags").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(package.GetProperty("metadata").GetProperty("release_notes").GetString()));
        }
    }

    [Fact]
    public void FeedCurrentReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_FEED_CURRENT_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.feed_current.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.Equal(0, root.GetProperty("missing_declared_version_count").GetInt32());
        if (!root.GetProperty("allow_newer").GetBoolean())
        {
            Assert.Equal(0, root.GetProperty("not_latest_count").GetInt32());
        }

        var packageReports = root.GetProperty("packages").EnumerateArray().ToArray();
        Assert.Equal(3, packageReports.Length);
        foreach (var packageId in new[] { "TinyRustLM.Abstractions", "TinyRustLM.Core", "TinyRustLM.P2P" })
        {
            var report = Assert.Single(packageReports, package =>
                package.GetProperty("package_id").GetString() == packageId);
            Assert.True(report.GetProperty("declared_version_present").GetBoolean(), packageId);
            Assert.Equal(packageVersion, report.GetProperty("declared_version").GetString());
            Assert.Contains(report.GetProperty("listed_versions").EnumerateArray(), version =>
                string.Equals(version.GetString(), packageVersion, StringComparison.OrdinalIgnoreCase));
        }
    }

    [Fact]
    public void FeedHashReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_FEED_HASH_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.feed_hashes.v0", root.GetProperty("schema").GetString());
        Assert.Equal("pass", root.GetProperty("status").GetString());
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Equal(0, root.GetProperty("missing_package_count").GetInt32());
        Assert.Equal(0, root.GetProperty("hash_mismatch_count").GetInt32());
        Assert.Equal(0, root.GetProperty("byte_count_mismatch_count").GetInt32());
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("publish_plan_report_sha256").GetString() ?? "");
        Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_audit_report_sha256").GetString() ?? "");

        var packages = root.GetProperty("packages").EnumerateArray().ToArray();
        Assert.Equal(3, root.GetProperty("package_count").GetInt32());
        Assert.Equal(3, packages.Length);
        foreach (var package in packages)
        {
            Assert.True(package.GetProperty("present").GetBoolean());
            Assert.True(package.GetProperty("sha256_match").GetBoolean());
            Assert.True(package.GetProperty("byte_count_match").GetBoolean());
            Assert.Equal(
                package.GetProperty("expected_sha256").GetString(),
                package.GetProperty("actual_sha256").GetString());
            Assert.True(package.GetProperty("actual_byte_count").GetInt64() > 0);
            Assert.True(string.IsNullOrWhiteSpace(package.GetProperty("error_message").GetString()));
        }
    }

    [Fact]
    public void FeedSmokeReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_FEED_SMOKE_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var status = root.GetProperty("status").GetString();

        Assert.Equal("tinyrustlm.nuget.feed_smoke.v0", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[] { "pass", "fail" });
        Assert.Equal(PackageVersion(), root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("nuget_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("model_path").GetString()));
        if (string.Equals(status, "pass", StringComparison.Ordinal))
        {
            Assert.True(string.IsNullOrWhiteSpace(root.GetProperty("error_message").GetString()));
            Assert.True(root.GetProperty("local_piece_assembly_verified").GetBoolean());
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("consumer_output_sha256").GetString() ?? "");
            Assert.Contains(
                "consumer-smoke-assembled.slm",
                root.GetProperty("consumer_output_excerpt").GetString() ?? "",
                StringComparison.Ordinal);
        }
        else
        {
            Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("error_message").GetString()));
        }
    }

    [Fact]
    public void PublishPlanReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_PUBLISH_PLAN_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();

        Assert.Equal("tinyrustlm.nuget.publish_plan.v0", root.GetProperty("schema").GetString());
        var status = root.GetProperty("status").GetString();
        Assert.Contains(status, new[]
        {
            "dry_run",
            "ready_to_push",
            "pushed",
            "push_failed",
            "blocked_missing_api_key",
            "blocked_missing_audit_report",
            "blocked_audit_mismatch"
        });
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.True(root.TryGetProperty("package_audit_match", out var auditMatch));
        Assert.True(root.TryGetProperty("package_audit_status", out var auditStatus));
        Assert.True(root.TryGetProperty("package_audit_error", out var auditError));
        Assert.True(root.TryGetProperty("publish_error", out var publishError));
        if (status is "dry_run" or "ready_to_push" or "pushed" or "blocked_missing_api_key" or "push_failed")
        {
            Assert.True(auditMatch.GetBoolean());
            Assert.Equal("pass", auditStatus.GetString());
            Assert.True(string.IsNullOrWhiteSpace(auditError.GetString()));
            Assert.Matches("^[0-9a-f]{64}$", root.GetProperty("package_audit_report_sha256").GetString() ?? "");
            if (status == "push_failed")
            {
                Assert.False(string.IsNullOrWhiteSpace(publishError.GetString()));
                Assert.DoesNotContain("NUGET_API_KEY", publishError.GetString() ?? "", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                Assert.True(string.IsNullOrWhiteSpace(publishError.GetString()));
            }
        }
        else
        {
            Assert.False(auditMatch.GetBoolean());
            Assert.False(string.IsNullOrWhiteSpace(auditError.GetString()));
            Assert.True(string.IsNullOrWhiteSpace(publishError.GetString()));
        }

        var expectedNames = root.GetProperty("expected_package_names")
            .EnumerateArray()
            .Select(name => name.GetString())
            .ToArray();
        Assert.Contains($"TinyRustLM.Abstractions.{packageVersion}.nupkg", expectedNames);
        Assert.Contains($"TinyRustLM.Core.{packageVersion}.nupkg", expectedNames);
        Assert.Contains($"TinyRustLM.P2P.{packageVersion}.nupkg", expectedNames);

        var packages = root.GetProperty("packages").EnumerateArray().ToArray();
        Assert.Equal(3, root.GetProperty("package_count").GetInt32());
        Assert.Equal(3, packages.Length);
        foreach (var package in packages)
        {
            Assert.Matches("^[0-9a-f]{64}$", package.GetProperty("sha256").GetString() ?? "");
            Assert.True(package.GetProperty("byte_count").GetInt64() > 0);
            Assert.Contains(package.GetProperty("name").GetString(), expectedNames);
        }
    }

    [Fact]
    public void ReleaseReadinessReportIsMachineReadableWhenPresent()
    {
        var reportPath = Environment.GetEnvironmentVariable("TINYRUSTLM_RELEASE_READINESS_REPORT");
        if (string.IsNullOrWhiteSpace(reportPath) || !File.Exists(reportPath))
        {
            return;
        }

        using var document = JsonDocument.Parse(File.ReadAllText(reportPath));
        var root = document.RootElement;
        var packageVersion = PackageVersion();
        var status = root.GetProperty("status").GetString();

        Assert.Equal("tinyrustlm.nuget.release_readiness.v0", root.GetProperty("schema").GetString());
        Assert.Contains(status, new[]
        {
            "blocked_local_verification",
            "blocked_feed_status_unknown",
            "blocked_missing_api_key",
            "blocked_remote_hash_mismatch",
            "blocked_trusted_publishing_unsupported",
            "ready_to_publish",
            "published_current"
        });
        Assert.Equal(packageVersion, root.GetProperty("package_version").GetString());
        Assert.False(root.GetProperty("secret_material_included").GetBoolean());
        Assert.Contains(root.GetProperty("auth_mode").GetString(), new[] { "api_key", "trusted_publishing" });
        Assert.True(root.TryGetProperty("api_key_present", out _));
        Assert.True(root.TryGetProperty("trusted_publishing_requested", out _));
        Assert.True(root.TryGetProperty("trusted_publishing_supported", out _));
        Assert.True(root.TryGetProperty("fail_on_blocked", out _));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("package_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("nuget_source").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("publish_plan_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("local_feed_current_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("local_feed_hash_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("remote_feed_current_report_path").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("remote_feed_hash_report_path").GetString()));

        var steps = root.GetProperty("steps").EnumerateArray().ToArray();
        Assert.Equal(5, steps.Length);
        foreach (var stepName in new[]
        {
            "publish_plan_dry_run",
            "local_feed_current",
            "local_feed_hashes",
            "remote_feed_current",
            "remote_feed_hashes"
        })
        {
            var step = Assert.Single(steps, item => item.GetProperty("name").GetString() == stepName);
            Assert.Contains(step.GetProperty("status").GetString(), new[] { "pass", "fail", "skipped" });
            Assert.True(step.TryGetProperty("report_written", out _));
            Assert.True(step.TryGetProperty("report_status", out _));
            Assert.True(step.TryGetProperty("error_message", out _));
        }

        var blockers = root.GetProperty("blockers").EnumerateArray().ToArray();
        if (status is "ready_to_publish" or "published_current")
        {
            Assert.Empty(blockers);
        }
        else
        {
            Assert.NotEmpty(blockers);
        }
    }

    private static string RepositoryRoot()
    {
        var configured = Environment.GetEnvironmentVariable("TINYRUSTLM_REPO_ROOT");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && current is not null; i++, current = current.Parent)
        {
            if (File.Exists(Path.Combine(current.FullName, "Cargo.toml"))
                && Directory.Exists(Path.Combine(current.FullName, "dotnet")))
            {
                return current.FullName;
            }
        }

        throw new DirectoryNotFoundException("Could not locate TinyRustLM repository root.");
    }

    private static string PackageVersion()
    {
        var root = RepositoryRoot();
        var props = File.ReadAllText(Path.Combine(root, "dotnet/Directory.Build.props"));
        var version = ExtractProperty(props, "Version");
        if (!string.IsNullOrWhiteSpace(version))
        {
            return version;
        }

        var prefix = ExtractProperty(props, "VersionPrefix");
        Assert.False(string.IsNullOrWhiteSpace(prefix), "VersionPrefix is required.");
        var suffix = ExtractProperty(props, "VersionSuffix");
        return string.IsNullOrWhiteSpace(suffix) ? prefix : $"{prefix}-{suffix}";
    }

    private static string WorkspacePackageVersion(string cargoToml)
    {
        var inWorkspacePackage = false;
        foreach (var rawLine in cargoToml.Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.StartsWith('['))
            {
                inWorkspacePackage = string.Equals(line, "[workspace.package]", StringComparison.Ordinal);
                continue;
            }
            if (!inWorkspacePackage || !line.StartsWith("version", StringComparison.Ordinal))
            {
                continue;
            }

            var equalsIndex = line.IndexOf('=', StringComparison.Ordinal);
            if (equalsIndex < 0)
            {
                continue;
            }
            return line[(equalsIndex + 1)..].Trim().Trim('"');
        }

        return string.Empty;
    }

    private static string ExtractProperty(string xml, string propertyName)
    {
        var startTag = $"<{propertyName}>";
        var endTag = $"</{propertyName}>";
        var start = xml.IndexOf(startTag, StringComparison.Ordinal);
        if (start < 0)
        {
            return string.Empty;
        }

        start += startTag.Length;
        var end = xml.IndexOf(endTag, start, StringComparison.Ordinal);
        return end < 0 ? string.Empty : xml[start..end].Trim();
    }

    private static void AssertExpectedPackageDocumentation(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var expectedNames = packageId switch
        {
            "TinyRustLM.Core" => new[]
            {
                "README.md",
                "LICENSE.txt",
                "docs/PACKAGE_SECURITY.md"
            },
            "TinyRustLM.P2P" => new[]
            {
                "README.md",
                "LICENSE.txt",
                "docs/API_BOUNDARY.md",
                "docs/P2P_SHARE_FLOW.md"
            },
            _ => new[]
            {
                "README.md",
                "LICENSE.txt"
            }
        };
        var expected = package.GetProperty("expected_package_documentation_entries")
            .EnumerateArray()
            .ToArray();

        Assert.Equal(expectedNames.Length, expected.Length);
        foreach (var entryName in expectedNames)
        {
            var entry = expected.FirstOrDefault(item =>
                item.GetProperty("entry").GetString() == entryName);
            Assert.NotEqual(JsonValueKind.Undefined, entry.ValueKind);
            Assert.True(entry.GetProperty("source_exists").GetBoolean(), entryName);
            Assert.True(entry.GetProperty("package_entry_exists").GetBoolean(), entryName);
            Assert.True(entry.GetProperty("sha256_match").GetBoolean(), entryName);
            Assert.Matches("^[0-9a-f]{64}$", entry.GetProperty("source_sha256").GetString() ?? "");
            Assert.Equal(
                entry.GetProperty("source_sha256").GetString(),
                entry.GetProperty("package_sha256").GetString());
        }
    }

    private static void AssertExpectedPackageIdentity(JsonElement package, string packageVersion)
    {
        var packageName = package.GetProperty("name").GetString() ?? "";
        var expectedId = packageName.EndsWith($".{packageVersion}.nupkg", StringComparison.Ordinal)
            ? packageName[..^($".{packageVersion}.nupkg".Length)]
            : "";

        Assert.Equal(expectedId, package.GetProperty("expected_package_id").GetString());
        Assert.Equal(packageVersion, package.GetProperty("expected_package_version").GetString());
        Assert.Equal(expectedId, package.GetProperty("metadata").GetProperty("id").GetString());
        Assert.Equal(packageVersion, package.GetProperty("metadata").GetProperty("version").GetString());
    }

    private static void AssertExpectedPackageDependencies(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var packageVersion = package.GetProperty("metadata").GetProperty("version").GetString();
        var expected = package.GetProperty("expected_dependency_entries").EnumerateArray().ToArray();
        var actual = package.GetProperty("dependencies").EnumerateArray().ToArray();

        if (packageId == "TinyRustLM.Abstractions")
        {
            Assert.Empty(expected);
            Assert.Empty(actual);
            return;
        }

        if (packageId == "TinyRustLM.Core")
        {
            Assert.Single(expected);
            Assert.Single(actual);
            AssertDependency(expected[0], "TinyRustLM.Abstractions", packageVersion);
            AssertDependency(actual[0], "TinyRustLM.Abstractions", packageVersion);
            return;
        }

        if (packageId == "TinyRustLM.P2P")
        {
            Assert.Equal(2, expected.Length);
            Assert.Equal(2, actual.Length);
            Assert.Contains(expected, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Abstractions",
                packageVersion));
            Assert.Contains(expected, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Core",
                packageVersion));
            Assert.Contains(actual, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Abstractions",
                packageVersion));
            Assert.Contains(actual, dependency => DependencyMatches(
                dependency,
                "TinyRustLM.Core",
                packageVersion));
        }
    }

    private static void AssertDependency(JsonElement dependency, string id, string? version)
    {
        Assert.True(DependencyMatches(dependency, id, version));
    }

    private static bool DependencyMatches(JsonElement dependency, string id, string? version) =>
        dependency.GetProperty("id").GetString() == id
        && dependency.GetProperty("version").GetString() == version
        && dependency.GetProperty("exclude").GetString() == "Build,Analyzers";

    private static void AssertExpectedPackageContentEntries(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var entryNames = package.GetProperty("package_entry_names")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .ToArray();
        var allowedPatterns = package.GetProperty("allowed_package_entry_patterns")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .ToArray();

        Assert.NotEmpty(entryNames);
        Assert.Contains("[Content_Types].xml", entryNames);
        Assert.Contains("_rels/.rels", entryNames);
        Assert.Contains($"{packageId}.nuspec", entryNames);
        Assert.Contains("README.md", entryNames);
        Assert.Contains("LICENSE.txt", entryNames);
        Assert.Contains($"lib/net8.0/{packageId}.dll", entryNames);
        Assert.Contains($"lib/net8.0/{packageId}.xml", entryNames);
        Assert.Contains("package/services/metadata/core-properties/*.psmdcp", allowedPatterns);
        Assert.Contains($"{packageId}.nuspec", allowedPatterns);
        Assert.Contains($"lib/net8.0/{packageId}.dll", allowedPatterns);
        Assert.Contains($"lib/net8.0/{packageId}.xml", allowedPatterns);

        foreach (var entry in entryNames)
        {
            Assert.True(IsAllowedPackageEntry(entry, allowedPatterns), entry);
        }
    }

    private static bool IsAllowedPackageEntry(string entry, IReadOnlyCollection<string> allowedPatterns) =>
        allowedPatterns.Contains(entry)
        || (allowedPatterns.Contains("package/services/metadata/core-properties/*.psmdcp")
            && entry.StartsWith("package/services/metadata/core-properties/", StringComparison.Ordinal)
            && entry.EndsWith(".psmdcp", StringComparison.Ordinal)
            && entry.Count(character => character == '/') == 3);

    private static void AssertExpectedPublicApiEntries(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var actual = package.GetProperty("public_api_entries")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .OrderBy(entry => entry, StringComparer.Ordinal)
            .ToArray();
        var expected = package.GetProperty("expected_public_api_entries")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .Where(entry => entry is not null)
            .Cast<string>()
            .OrderBy(entry => entry, StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(actual);
        Assert.Equal(expected, actual);
        Assert.DoesNotContain(actual, entry =>
            entry.Contains("Conversion", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Quantization", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Adapter", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Selector", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Breeding", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("Telemetry", StringComparison.OrdinalIgnoreCase)
            || entry.Contains("LicenseServer", StringComparison.OrdinalIgnoreCase));

        if (packageId == "TinyRustLM.Abstractions")
        {
            Assert.Contains("T:TinyRustLM.ITinyRustLmRuntime", actual);
            Assert.Contains("T:TinyRustLM.ITinyRustLmP2PClient", actual);
            Assert.Contains("T:TinyRustLM.SlmInspection", actual);
            Assert.DoesNotContain(actual, entry => entry.Contains("TinyRustLmP2PClient", StringComparison.Ordinal));
            return;
        }

        if (packageId == "TinyRustLM.Core")
        {
            Assert.Contains("T:TinyRustLM.TinySlmInspector", actual);
            Assert.Contains("T:TinyRustLM.TinyRustLmRuntimeFactory", actual);
            Assert.Contains("M:TinyRustLM.TinyRustLmRuntimeFactory.GetCapabilities", actual);
            return;
        }

        if (packageId == "TinyRustLM.P2P")
        {
            Assert.Contains("T:TinyRustLM.TinyRustLmP2PClient", actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmP2PClient.ImportFromManifest(System.String,System.String,System.String)",
                actual);
            Assert.Contains(
                "M:TinyRustLM.TinyRustLmP2PClient.InspectAnnouncementCatalog(System.String)",
                actual);
        }
    }

    private static void AssertExpectedNativeEntries(JsonElement package)
    {
        var packageId = package.GetProperty("package_id").GetString();
        var nativeEntries = package.GetProperty("native_entries").EnumerateArray().ToArray();
        var allowedNativeEntries = package.GetProperty("allowed_native_entries")
            .EnumerateArray()
            .Select(entry => entry.GetString())
            .ToArray();

        if (packageId == "TinyRustLM.Core")
        {
            var expectedAllowedEntries = new[]
            {
                "runtimes/win-x64/native/tinyrustlm_native.dll",
                "runtimes/linux-x64/native/libtinyrustlm_native.so",
                "runtimes/osx-x64/native/libtinyrustlm_native.dylib",
                "runtimes/osx-arm64/native/libtinyrustlm_native.dylib"
            };

            Assert.Equal(expectedAllowedEntries.OrderBy(entry => entry), allowedNativeEntries.OrderBy(entry => entry));
            Assert.All(nativeEntries, entry =>
                Assert.Contains(entry.GetString(), expectedAllowedEntries));
            return;
        }

        Assert.Empty(allowedNativeEntries);
        Assert.Empty(nativeEntries);
    }
}
