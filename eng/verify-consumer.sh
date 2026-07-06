#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_SOURCE="${1:-$REPO_ROOT/artifacts/packages}"
MODEL_PATH="${2:-$REPO_ROOT/tinyrustlm/models/tiny-test-model.slm}"
PACKAGE_VERSION="${3:-$("$REPO_ROOT/eng/get-package-version.sh")}"

if ! command -v dotnet >/dev/null 2>&1; then
  echo "dotnet CLI is required to run TinyRustLM clean consumer package verification." >&2
  exit 127
fi
if [[ -d "$PACKAGE_SOURCE" ]]; then
  PACKAGE_SOURCE="$(cd "$PACKAGE_SOURCE" && pwd)"
fi
if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Model fixture does not exist: $MODEL_PATH" >&2
  exit 1
fi
MODEL_DIR="$(cd "$(dirname "$MODEL_PATH")" && pwd)"
MODEL_PATH="$MODEL_DIR/$(basename "$MODEL_PATH")"

TEMP_ROOT="$(mktemp -d)"
PROJECT_DIR="$TEMP_ROOT/ConsumerSmoke"
export NUGET_PACKAGES="$TEMP_ROOT/packages"
cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

dotnet new console --framework net8.0 --output "$PROJECT_DIR" >/dev/null
(
  cd "$PROJECT_DIR"
  dotnet add package TinyRustLM.Core --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE" >/dev/null
  dotnet add package TinyRustLM.P2P --version "$PACKAGE_VERSION" --source "$PACKAGE_SOURCE" >/dev/null
)

cat > "$PROJECT_DIR/Program.cs" <<'CS'
using System.Text.Json;
using TinyRustLM;

var modelPath = args.Length > 0 ? args[0] : throw new ArgumentException("model path argument is required");
var inspector = new TinySlmInspector();
var inspection = inspector.Inspect(modelPath);
if (!inspection.Sha256.StartsWith("sha256:", StringComparison.Ordinal) || inspection.ByteCount <= 0)
{
    throw new InvalidOperationException("Package consumer could not inspect the .slm model.");
}

var factory = new TinyRustLmRuntimeFactory();
var version = factory.GetVersion();
if (version.Product != "TinyRustLM public NuGet SDK" || version.NativeAbiVersion < 1)
{
    throw new InvalidOperationException("Package consumer version report did not expose the public native SDK boundary.");
}
var capabilities = factory.GetCapabilities();
if (!capabilities.SlmValidation || !capabilities.Generation || !capabilities.P2PMetadataWorkflows)
{
    throw new InvalidOperationException("Package consumer capability report did not expose the public SDK surface.");
}
if (!capabilities.ExcludedPrivateCapabilities.Any(item => item.Contains("model conversion", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("Package consumer capability report did not declare the protected private boundary.");
}

using (var runtime = factory.CreateRuntime())
{
    runtime.LoadModel(modelPath, inspection.Sha256);
    var generated = runtime.Generate("hello", new TinyRustLmGenerationOptions(MaxNewTokens: 2));
    if (generated.Diagnostics.Length == 0 || !runtime.GetDiagnostics().Contains("model_loaded", StringComparison.Ordinal))
    {
        throw new InvalidOperationException("Package consumer runtime diagnostics were not available.");
    }
}

var outputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-consumer-share-{Guid.NewGuid():N}");
var p2p = new TinyRustLmP2PClient();
var unsafeOutputDir = Path.Combine(Path.GetTempPath(), $"tinyrustlm-consumer-share-unsafe-{Guid.NewGuid():N}");
try
{
    p2p.PrepareLocalShareKit(new PrepareShareKitRequest(
        ModelPath: modelPath,
        OutputDir: unsafeOutputDir,
        ManifestId: "consumer-smoke-unsafe-url",
        ModelId: "consumer-smoke-model",
        PeerId: "consumer-smoke-peer",
        PublicBaseUrl: "https://example.com/peer?download=1",
        PieceSize: 4096));
    throw new InvalidOperationException("Package consumer accepted an unsafe P2P announcement base URL.");
}
catch (TinyRustLmException ex) when (ex.Message.Contains("public_base_url", StringComparison.Ordinal))
{
}
if (File.Exists(Path.Combine(unsafeOutputDir, "tinyrustlm.p2p-manifest.v0.json"))
    || File.Exists(Path.Combine(unsafeOutputDir, "tinyrustlm.p2p-announcement.v0.json")))
{
    throw new InvalidOperationException("Package consumer wrote P2P metadata after rejecting an unsafe base URL.");
}

P2PShareKitReport shareReport = p2p.PrepareLocalShareKit(new PrepareShareKitRequest(
    ModelPath: modelPath,
    OutputDir: outputDir,
    ManifestId: "consumer-smoke-share",
    ModelId: "consumer-smoke-model",
    PeerId: "consumer-smoke-peer",
    PublicBaseUrl: "http://127.0.0.1:8123/peer",
    PieceSize: 4096));

if (shareReport.Kind != "tinyrustlm.p2p_share_kit_report.v0"
    || !File.Exists(shareReport.ManifestPath)
    || !File.Exists(shareReport.ShareMetadataPath)
    || shareReport.Manifest.Boundary.ManifestContainsModelBytes
    || shareReport.Manifest.Boundary.ExposesPrivateRouting
    || !shareReport.Manifest.Boundary.RequiresPieceSha256Validation
    || !shareReport.Manifest.Boundary.RequiresArtifactSha256Validation)
{
    throw new InvalidOperationException("Package consumer typed P2P share report did not validate.");
}
if (string.IsNullOrWhiteSpace(shareReport.AnnouncementPath) || !File.Exists(shareReport.AnnouncementPath))
{
    throw new InvalidOperationException("Package consumer P2P share report did not expose an announcement path.");
}
var announcementJson = File.ReadAllText(shareReport.AnnouncementPath);
var announcement = p2p.ValidateAnnouncement(announcementJson);
var validatedAnnouncementJson = p2p.ValidateAnnouncementJson(announcementJson);
var catalog = p2p.ApplyReceivedAnnouncement(announcementJson);
var catalogJson = p2p.ApplyReceivedAnnouncementJson(announcementJson);
var duplicateCatalog = p2p.ApplyReceivedAnnouncement(announcementJson, catalogJson);
var catalogInspection = p2p.InspectAnnouncementCatalog(catalogJson);
var catalogInspectionJson = p2p.InspectAnnouncementCatalogJson(catalogJson);
if (announcement.Kind != "tinyrustlm.p2p_announcement.v0"
    || announcement.PeerId != "consumer-smoke-peer"
    || announcement.ManifestId != "consumer-smoke-share"
    || !announcement.PeerConsent
    || !validatedAnnouncementJson.Contains("\"kind\": \"tinyrustlm.p2p_announcement.v0\"", StringComparison.Ordinal)
    || catalog.Kind != "tinyrustlm.p2p_announcement_catalog.v0"
    || catalog.Announcements.Count != 1
    || duplicateCatalog.Announcements.Count != 1
    || !catalogJson.Contains("\"announcements\": [", StringComparison.Ordinal)
    || catalogInspection.Kind != "tinyrustlm.p2p_announcement_catalog_inspection.v0"
    || catalogInspection.AnnouncementCount != 1
    || catalogInspection.PeerCount != 1
    || catalogInspection.ManifestCount != 1
    || catalogInspection.ModelCount != 1
    || !catalogInspection.Valid
    || !catalogInspectionJson.Contains(
        "\"kind\": \"tinyrustlm.p2p_announcement_catalog_inspection.v0\"",
        StringComparison.Ordinal))
{
    throw new InvalidOperationException("Package consumer P2P announcement/catalog handoff did not validate.");
}
var manifestJson = File.ReadAllText(shareReport.ManifestPath);
var manifest = p2p.InspectManifest(manifestJson);
P2PShareMetadata metadata = p2p.ExportShareMetadata(manifestJson);
var plan = p2p.ImportFromManifest(manifestJson);
var assembledPath = Path.Combine(outputDir, "consumer-smoke-assembled.slm");
var receipt = p2p.ImportFromManifest(manifestJson, outputDir, assembledPath);
var receiptInspection = p2p.InspectLocalImportReceipt(File.ReadAllText(receipt.ReceiptPath), assembledPath);
if (!manifest.Valid || plan.RequiredPieces.Count != manifest.PieceCount)
{
    throw new InvalidOperationException("Package consumer P2P manifest/import plan did not validate.");
}
if (metadata.Kind != "tinyrustlm.p2p_share_metadata.v0"
    || metadata.ManifestSha256 != manifest.ManifestSha256
    || metadata.ArtifactSha256 != manifest.ArtifactSha256
    || metadata.Boundary.ManifestContainsModelBytes
    || metadata.Boundary.ExposesPrivateRouting)
{
    throw new InvalidOperationException("Package consumer typed P2P share metadata did not validate.");
}
if (!File.Exists(assembledPath)
    || !File.Exists(receipt.ReceiptPath)
    || receipt.OutputSha256 != manifest.ArtifactSha256
    || receipt.OutputByteCount != manifest.ArtifactByteCount
    || receipt.VerifiedPieceCount != manifest.PieceCount
    || receipt.Boundary.NetworkFetchPerformed
    || receipt.Boundary.PrivateRoutingUsed
    || !receipt.Boundary.PieceSha256Verified
    || !receipt.Boundary.ArtifactSha256Verified
    || !receipt.Boundary.SlmValidationPerformed)
{
    throw new InvalidOperationException("Package consumer P2P local assembly receipt did not validate.");
}
if (!receiptInspection.Valid
    || receiptInspection.InspectedOutputSha256 != receipt.OutputSha256
    || receiptInspection.InspectedOutputByteCount != receipt.OutputByteCount
    || receiptInspection.VerifiedPieceCount != receipt.VerifiedPieceCount
    || !receiptInspection.Boundary.SlmValidationPerformed)
{
    throw new InvalidOperationException("Package consumer P2P local import receipt inspection did not validate.");
}
if (manifestJson.Contains("\"manifest_contains_model_bytes\": true", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Package consumer manifest exposed model bytes.");
}

Console.WriteLine($"TinyRustLM consumer smoke passed: {inspection.Sha256} {plan.RequiredPieces.Count} pieces, assembled {receipt.OutputPath}, receipt {receipt.ReceiptPath}, receipt inspection {receiptInspection.ReceiptSha256}");
CS

dotnet run --project "$PROJECT_DIR" --configuration Release -- "$MODEL_PATH"
echo "TinyRustLM consumer package source verified: $PACKAGE_SOURCE @ $PACKAGE_VERSION"
