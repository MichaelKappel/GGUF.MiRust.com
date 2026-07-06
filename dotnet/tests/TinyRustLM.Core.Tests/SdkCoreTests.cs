using System.Text.Json;
using TinyRustLM;
using Xunit;

namespace TinyRustLM.Core.Tests;

public sealed class SdkCoreTests
{
    private const int MaxManifestJsonBytes = 1024 * 1024;
    private const int MaxAnnouncementJsonBytes = 256 * 1024;
    private const int MaxAnnouncementCatalogJsonBytes = 4 * 1024 * 1024;
    private const int MaxReceiptJsonBytes = 256 * 1024;

    [Fact]
    public void InspectorValidatesFixtureModel()
    {
        var inspector = new TinySlmInspector();
        var report = inspector.Inspect(FixtureModelPath());

        Assert.Equal("tinyrustlm.slm.inspection.v0", report.Kind);
        Assert.StartsWith("sha256:", report.Sha256, StringComparison.Ordinal);
        Assert.True(report.ByteCount > 0);
        Assert.True(report.TensorCount > 0);
    }

    [Fact]
    public void RuntimeLoadsAndGeneratesWithFixtureModel()
    {
        var factory = new TinyRustLmRuntimeFactory();
        using var runtime = factory.CreateRuntime();
        var load = runtime.LoadModel(FixtureModelPath());

        Assert.True(load.Inspection.TensorCount > 0);
        var result = runtime.Generate("hello", new TinyRustLmGenerationOptions(MaxNewTokens: 2));
        Assert.NotNull(result.Text);
        Assert.Contains("model_loaded", result.Diagnostics, StringComparison.Ordinal);
    }

    [Fact]
    public void RuntimePreservesEmptyPromptAcrossNativeBridge()
    {
        var factory = new TinyRustLmRuntimeFactory();
        using var runtime = factory.CreateRuntime();
        runtime.LoadModel(FixtureModelPath());

        var result = runtime.Generate(string.Empty, new TinyRustLmGenerationOptions(MaxNewTokens: 1));

        Assert.NotNull(result.Text);
        Assert.Contains("prompt_token_count", result.Diagnostics, StringComparison.Ordinal);
    }

    [Fact]
    public void CapabilitiesDeclareProtectedBoundary()
    {
        var factory = new TinyRustLmRuntimeFactory();
        var version = factory.GetVersion();
        var capabilities = factory.GetCapabilities();

        Assert.Equal("TinyRustLM public NuGet SDK", version.Product);
        Assert.False(string.IsNullOrWhiteSpace(version.SdkVersion));
        Assert.True(version.NativeAbiVersion >= 1);
        Assert.True(capabilities.SlmValidation);
        Assert.True(capabilities.P2PMetadataWorkflows);
        Assert.Contains(capabilities.ExcludedPrivateCapabilities, item =>
            item.Contains("model conversion", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(capabilities.ExcludedPrivateCapabilities, item =>
            string.IsNullOrWhiteSpace(item));
    }

    [Theory]
    [MemberData(nameof(InvalidGenerationOptions))]
    public void RuntimeRejectsInvalidGenerationOptionsBeforeNativeCall(
        TinyRustLmGenerationOptions options,
        string parameterName)
    {
        var factory = new TinyRustLmRuntimeFactory();
        using var runtime = factory.CreateRuntime();

        var error = Assert.Throws<ArgumentOutOfRangeException>(() =>
            runtime.Generate("hello", options));

        Assert.Equal(parameterName, error.ParamName);
    }

    [Theory]
    [MemberData(nameof(EmbeddedNulInputs))]
    public void PublicApisRejectEmbeddedNulStringsBeforeNativeCall(
        Action action,
        string parameterName)
    {
        var error = Assert.Throws<ArgumentException>(action);

        Assert.Equal(parameterName, error.ParamName);
        Assert.Contains("embedded NUL", error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(InvalidPrepareShareKitRequests))]
    public void P2PClientRejectsInvalidPrepareShareKitRequestsBeforeNativeCall(
        PrepareShareKitRequest request,
        string parameterName)
    {
        var error = Assert.ThrowsAny<ArgumentException>(() =>
            new TinyRustLmP2PClient().PrepareLocalShareKit(request));

        Assert.Equal(parameterName, error.ParamName);
    }

    [Theory]
    [MemberData(nameof(OversizedP2PJsonHandoffs))]
    public void P2PClientRejectsOversizedJsonHandoffsBeforeNativeCall(
        Action action,
        string parameterName)
    {
        var error = Assert.Throws<ArgumentException>(action);

        Assert.Equal(parameterName, error.ParamName);
        Assert.Contains("UTF-8 byte budget", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void P2PClientPreparesMetadataOnlyShareKit()
    {
        var outputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-p2p-{Guid.NewGuid():N}");
        var client = new TinyRustLmP2PClient();
        var report = client.PrepareLocalShareKit(new PrepareShareKitRequest(
            FixtureModelPath(),
            outputDir,
            ManifestId: "dotnet-fixture-share",
            ModelId: "dotnet-fixture-model",
            PeerId: "dotnet-peer",
            PublicBaseUrl: "http://127.0.0.1:8123/peer",
            PieceSize: 4096));
        var reportJson = client.PrepareLocalShareKitJson(new PrepareShareKitRequest(
            FixtureModelPath(),
            Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-p2p-json-{Guid.NewGuid():N}"),
            ManifestId: "dotnet-fixture-share-json",
            ModelId: "dotnet-fixture-model-json",
            PeerId: "dotnet-peer",
            PublicBaseUrl: "http://127.0.0.1:8123/peer",
            PieceSize: 4096));

        using var rawReport = JsonDocument.Parse(reportJson);
        Assert.Equal("tinyrustlm.p2p_share_kit_report.v0", report.Kind);
        Assert.Equal("dotnet-fixture-share", report.Manifest.ManifestId);
        Assert.True(File.Exists(report.ManifestPath));
        Assert.True(File.Exists(report.ShareMetadataPath));
        Assert.False(report.Manifest.Boundary.ManifestContainsModelBytes);
        Assert.False(report.Manifest.Boundary.ExposesPrivateRouting);
        Assert.True(report.Manifest.Boundary.RequiresPieceSha256Validation);
        Assert.True(report.Manifest.Boundary.RequiresArtifactSha256Validation);
        Assert.Equal("tinyrustlm.p2p_share_kit_report.v0", rawReport.RootElement.GetProperty("kind").GetString());

        var manifestJson = File.ReadAllText(report.ManifestPath);
        Assert.False(string.IsNullOrWhiteSpace(report.AnnouncementPath));
        var announcementJson = File.ReadAllText(report.AnnouncementPath!);
        var announcement = client.ValidateAnnouncement(announcementJson);
        var validatedAnnouncementJson = client.ValidateAnnouncementJson(announcementJson);
        var catalog = client.ApplyReceivedAnnouncement(announcementJson);
        var catalogJson = client.ApplyReceivedAnnouncementJson(announcementJson);
        var duplicateCatalog = client.ApplyReceivedAnnouncement(announcementJson, catalogJson);
        var catalogInspection = client.InspectAnnouncementCatalog(catalogJson);
        var catalogInspectionJson = client.InspectAnnouncementCatalogJson(catalogJson);
        var conflictingAnnouncementJson = JsonSerializer.Serialize(
            announcement with
            {
                ManifestSha256 = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            NativeJson.SerializerOptions);
        var conflictError = Assert.Throws<TinyRustLmException>(() =>
            client.ApplyReceivedAnnouncement(conflictingAnnouncementJson, catalogJson));
        var oversizedCatalogJson = new string('x', (4 * 1024 * 1024) + 1);
        var oversizedInspectError = Assert.Throws<ArgumentException>(() =>
            client.InspectAnnouncementCatalog(oversizedCatalogJson));
        var oversizedApplyError = Assert.Throws<ArgumentException>(() =>
            client.ApplyReceivedAnnouncement(announcementJson, oversizedCatalogJson));
        var inspection = client.InspectManifest(manifestJson);
        var plan = client.ImportFromManifest(manifestJson);
        var metadata = client.ExportShareMetadata(manifestJson);
        var metadataJson = client.ExportShareMetadataJson(manifestJson);
        var assembledPath = Path.Combine(outputDir, "dotnet-fixture-assembled.slm");
        var receipt = client.ImportFromManifest(manifestJson, outputDir, assembledPath);
        var receiptInspection = client.InspectLocalImportReceipt(
            File.ReadAllText(receipt.ReceiptPath),
            assembledPath);

        Assert.Equal("dotnet-fixture-share", inspection.ManifestId);
        Assert.Equal("tinyrustlm.p2p_announcement.v0", announcement.Kind);
        Assert.Equal("dotnet-peer", announcement.PeerId);
        Assert.Equal("dotnet-fixture-share", announcement.ManifestId);
        Assert.Equal(inspection.ManifestSha256, announcement.ManifestSha256);
        Assert.Contains("\"kind\": \"tinyrustlm.p2p_announcement.v0\"", validatedAnnouncementJson, StringComparison.Ordinal);
        Assert.Equal("tinyrustlm.p2p_announcement_catalog.v0", catalog.Kind);
        Assert.Single(catalog.Announcements);
        Assert.Single(duplicateCatalog.Announcements);
        Assert.Equal("tinyrustlm.p2p_announcement_catalog_inspection.v0", catalogInspection.Kind);
        Assert.Equal(1, catalogInspection.AnnouncementCount);
        Assert.Equal(1, catalogInspection.PeerCount);
        Assert.Equal(1, catalogInspection.ManifestCount);
        Assert.Equal(1, catalogInspection.ModelCount);
        Assert.Equal(announcement.ArtifactByteCount, catalogInspection.TotalAnnouncedArtifactBytes);
        Assert.True(catalogInspection.Valid);
        Assert.Contains(
            "\"kind\": \"tinyrustlm.p2p_announcement_catalog_inspection.v0\"",
            catalogInspectionJson,
            StringComparison.Ordinal);
        Assert.Equal("p2p_apply_announcement_failed", conflictError.Code);
        Assert.Contains("conflicting metadata", conflictError.Message, StringComparison.Ordinal);
        Assert.Equal("catalogJson", oversizedInspectError.ParamName);
        Assert.Contains("UTF-8 byte budget", oversizedInspectError.Message, StringComparison.Ordinal);
        Assert.Equal("existingCatalogJson", oversizedApplyError.ParamName);
        Assert.Contains("UTF-8 byte budget", oversizedApplyError.Message, StringComparison.Ordinal);
        Assert.Contains("\"announcements\": [", catalogJson, StringComparison.Ordinal);
        Assert.Equal("tinyrustlm.p2p_share_metadata.v0", metadata.Kind);
        Assert.Equal(inspection.ManifestSha256, metadata.ManifestSha256);
        Assert.Contains("\"kind\": \"tinyrustlm.p2p_share_metadata.v0\"", metadataJson, StringComparison.Ordinal);
        Assert.Equal(inspection.PieceCount, plan.RequiredPieces.Count);
        Assert.True(File.Exists(assembledPath));
        Assert.True(File.Exists(receipt.ReceiptPath));
        Assert.Equal(inspection.ArtifactSha256, receipt.OutputSha256);
        Assert.Equal(inspection.ArtifactByteCount, receipt.OutputByteCount);
        Assert.Equal(inspection.PieceCount, receipt.VerifiedPieceCount);
        Assert.False(receipt.Boundary.NetworkFetchPerformed);
        Assert.False(receipt.Boundary.PrivateRoutingUsed);
        Assert.True(receipt.Boundary.PieceSha256Verified);
        Assert.True(receipt.Boundary.ArtifactSha256Verified);
        Assert.True(receipt.Boundary.SlmValidationPerformed);
        Assert.Equal("tinyrustlm.p2p_local_import_receipt_inspection.v0", receiptInspection.Kind);
        Assert.Equal(receipt.OutputSha256, receiptInspection.InspectedOutputSha256);
        Assert.Equal(receipt.OutputByteCount, receiptInspection.InspectedOutputByteCount);
        Assert.Equal(receipt.VerifiedPieceCount, receiptInspection.VerifiedPieceCount);
        Assert.True(receiptInspection.Valid);
        Assert.True(receiptInspection.Boundary.SlmValidationPerformed);
        Assert.False(manifestJson.Contains("\"manifest_contains_model_bytes\": true", StringComparison.Ordinal));
    }

    [Fact]
    public void P2PClientRejectsUnsafeAnnouncementBaseUrl()
    {
        var outputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-p2p-unsafe-{Guid.NewGuid():N}");
        var client = new TinyRustLmP2PClient();

        var error = Assert.Throws<TinyRustLmException>(() => client.PrepareLocalShareKit(
            new PrepareShareKitRequest(
                FixtureModelPath(),
                outputDir,
                ManifestId: "dotnet-fixture-unsafe-url",
                ModelId: "dotnet-fixture-model",
                PeerId: "dotnet-peer",
                PublicBaseUrl: "https://example.com/peer?download=1",
                PieceSize: 4096)));

        Assert.Contains("public_base_url", error.Message, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(outputDir, "tinyrustlm.p2p-manifest.v0.json")));
        Assert.False(File.Exists(Path.Combine(outputDir, "tinyrustlm.p2p-announcement.v0.json")));
    }

    private static string FixtureModelPath()
    {
        var configured = Environment.GetEnvironmentVariable("TINYRUSTLM_FIXTURE_MODEL");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        var current = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 10 && current is not null; i++, current = current.Parent)
        {
            var candidate = Path.Combine(current.FullName, "tinyrustlm", "models", "tiny-test-model.slm");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException("Could not locate tinyrustlm/models/tiny-test-model.slm.");
    }

    public static IEnumerable<object[]> InvalidGenerationOptions()
    {
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(MaxNewTokens: 0),
            "MaxNewTokens"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(MaxNewTokens: -1),
            "MaxNewTokens"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(Temperature: float.NaN),
            "Temperature"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(Temperature: -0.1f),
            "Temperature"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopK: 0),
            "TopK"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopK: 1025),
            "TopK"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopP: 0.0f),
            "TopP"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopP: float.PositiveInfinity),
            "TopP"
        };
        yield return new object[]
        {
            new TinyRustLmGenerationOptions(TopP: 1.1f),
            "TopP"
        };
    }

    public static IEnumerable<object[]> EmbeddedNulInputs()
    {
        yield return new object[]
        {
            (Action)(() => new TinySlmInspector().Inspect("bad\0path.slm")),
            "path"
        };
        yield return new object[]
        {
            (Action)(() =>
            {
                var factory = new TinyRustLmRuntimeFactory();
                using var runtime = factory.CreateRuntime();
                runtime.LoadModel("bad\0path.slm");
            }),
            "path"
        };
        yield return new object[]
        {
            (Action)(() =>
            {
                var factory = new TinyRustLmRuntimeFactory();
                using var runtime = factory.CreateRuntime();
                runtime.Generate("hello\0world");
            }),
            "prompt"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectManifest("{\"kind\":\"x\"}\0")),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().PrepareLocalShareKit(new PrepareShareKitRequest(
                "bad\0path.slm",
                Path.Combine(Path.GetTempPath(), $"tinyrustlm-dotnet-nul-{Guid.NewGuid():N}")))),
            "ModelPath"
        };
    }

    public static IEnumerable<object[]> InvalidPrepareShareKitRequests()
    {
        yield return new object[]
        {
            null!,
            "request"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(null!, Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid")),
            "ModelPath"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest("   ", Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid")),
            "ModelPath"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(FixtureModelPath(), null!),
            "OutputDir"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(FixtureModelPath(), "   "),
            "OutputDir"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(
                FixtureModelPath(),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid"),
                PieceSize: 1023),
            "PieceSize"
        };
        yield return new object[]
        {
            new PrepareShareKitRequest(
                FixtureModelPath(),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-invalid"),
                PieceSize: (16 * 1024 * 1024) + 1),
            "PieceSize"
        };
    }

    public static IEnumerable<object[]> OversizedP2PJsonHandoffs()
    {
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectManifest(
                OversizedJson(MaxManifestJsonBytes))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ImportFromManifest(
                OversizedJson(MaxManifestJsonBytes))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ImportFromManifest(
                OversizedJson(MaxManifestJsonBytes),
                Path.GetTempPath(),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-oversized.slm"))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ExportShareMetadataJson(
                OversizedJson(MaxManifestJsonBytes))),
            "manifestJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectLocalImportReceipt(
                OversizedJson(MaxReceiptJsonBytes),
                Path.Combine(Path.GetTempPath(), "tinyrustlm-oversized.slm"))),
            "receiptJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ValidateAnnouncement(
                OversizedJson(MaxAnnouncementJsonBytes))),
            "announcementJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().ApplyReceivedAnnouncement(
                "{\"kind\":\"tinyrustlm.p2p_announcement.v0\"}",
                OversizedJson(MaxAnnouncementCatalogJsonBytes))),
            "existingCatalogJson"
        };
        yield return new object[]
        {
            (Action)(() => new TinyRustLmP2PClient().InspectAnnouncementCatalog(
                OversizedJson(MaxAnnouncementCatalogJsonBytes))),
            "catalogJson"
        };
    }

    private static string OversizedJson(int maxBytes) => new('x', maxBytes + 1);
}
