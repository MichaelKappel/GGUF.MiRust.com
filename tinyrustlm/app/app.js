(function () {
  "use strict";

  const paths = {
    wasm: "../runtime/tinyrustlm.wasm",
    wasmManifest: "../runtime/tinyrustlm.wasm.manifest",
    registry: "../models/selector.registry",
    models: {
      tinylm16q8: {
        label: "TinyLM-16M q8_0",
        path: "../models/tinylm16-q8.slm",
        maxTokens: 8
      },
      tinylm16q4: {
        label: "TinyLM-16M q4_0",
        path: "../models/tinylm16-q4.slm",
        maxTokens: 8
      },
      tinylm16f32: {
        label: "TinyLM-16M f32",
        path: "../models/tinylm16-f32.slm",
        maxTokens: 8
      },
      tinyf32: {
        label: "Tiny Fixture f32",
        path: "../models/tiny-test-model.slm",
        maxTokens: 16,
        adapters: [
          {
            label: "Tiny Fixture f32 self ADP1",
            path: "../models/tiny-test-model-self.adp1",
            manifestPath: "../models/tiny-test-model-self.adp1.manifest",
            applyStatus: "runtime-f32-compatible-or-fuse-to-slm",
            artifactChecksum: "0xe9669ade4571fd42",
            manifestChecksum: "0x3810be9f3ee711b6"
          }
        ]
      },
      tinytied: {
        label: "Tiny Fixture tied-output f32",
        path: "../models/tiny-test-model-tied.slm",
        maxTokens: 16
      },
      tinyq8: {
        label: "Tiny Fixture q8_0",
        path: "../models/tiny-test-model-q8.slm",
        maxTokens: 16,
        adapters: [
          {
            label: "Tiny Fixture q8_0 self ADP1",
            path: "../models/tiny-test-model-q8-self.adp1",
            manifestPath: "../models/tiny-test-model-q8-self.adp1.manifest",
            applyStatus: "runtime-q8-q4-compatible-or-fuse-to-slm",
            artifactChecksum: "0x8194a8a671285019",
            manifestChecksum: "0x536f9b488db9822b"
          }
        ]
      },
      tinyq4: {
        label: "Tiny Fixture q4_0",
        path: "../models/tiny-test-model-q4.slm",
        maxTokens: 16,
        adapters: [
          {
            label: "Tiny Fixture q4_0 self ADP1",
            path: "../models/tiny-test-model-q4-self.adp1",
            manifestPath: "../models/tiny-test-model-q4-self.adp1.manifest",
            applyStatus: "runtime-q8-q4-compatible-or-fuse-to-slm",
            artifactChecksum: "0x0bd71e0020bc6ebf",
            manifestChecksum: "0xe62b43e1d8e06516"
          }
        ]
      },
      tinybpe: {
        label: "Tiny Fixture BPE f32",
        path: "../models/tiny-test-model-bpe.slm",
        maxTokens: 16
      }
    }
  };
  const staticModels = paths.models;
  const localModelKey = "__local_slm_file";
  const localModelMaxBytes = 128 * 1024 * 1024;
  const publicLocalOnlyHosts = new Set(["tinyrustlm.com", "www.tinyrustlm.com"]);
  const defaultCatalogUrl = "https" + "://MiniModel.org/catalog/models.v0.json";
  const svgNamespace = "http" + "://www.w3.org/2000/svg";
  const catalogTextByteBudget = 256 * 1024;
  const catalogMaxEntries = 64;
  const catalogMaxAnnouncementRoutes = 8;
  const hfDiscoveryScheme = "https";
  const hfDiscoveryHost = "huggingface.co";
  const hfSearchLimit = 8;
  const blockedPeerHosts = new Set([
    "minimodel.org",
    "www.minimodel.org",
    "tinyrustlm.com",
    "www.tinyrustlm.com",
    "slmcomposer.com",
    "www.slmcomposer.com",
    "lmcomposer.com",
    "www.lmcomposer.com",
    "runtime.mirust.com",
    "tinyrustlm.mirust.com",
    "huggingface.co",
    "www.huggingface.co"
  ]);

  const registryAdapterApplyStatus = "runtime-f32-compatible-or-fuse-to-slm";
  const registryQuantizedAdapterApplyStatus = "runtime-q8-q4-compatible-or-fuse-to-slm";
  const registryLowRankAdapterApplyStatus = "runtime-f32-compatible-low-rank";
  const registryQuantizedLowRankAdapterApplyStatus = "runtime-q8-q4-compatible-low-rank";
  const registryAdapterApplyStatuses = new Set([
    registryAdapterApplyStatus,
    registryQuantizedAdapterApplyStatus,
    registryLowRankAdapterApplyStatus,
    registryQuantizedLowRankAdapterApplyStatus
  ]);
  const registryAdapterFamilyStatus = "receipt-validated";
  const registryAdapterFamilyStrategy = "single-adapter-selection";
  const registryAdapterAutoApplyStatus = "enabled";
  const registryAdapterAutoApplyStrategy = "receipt-preferred-compatible";
  const registryAdapterAutoApplyStackStatus = "enabled";
  const registryAdapterAutoApplyStackStrategy = "receipt-declared-compatible-stack";
  const registryAdapterAutoApplyByteBudget = 1024 * 1024;
  const registryAssemblyStatus = "receipt-validated";
  const registryAssemblyKind = "browser-local-assembly-evidence";
  const registryModulePlanStatus = "receipt-validated";
  const registryModulePlanKind = "browser-local-module-plan";
  const registryModulePlanStrategy = "selector-entry-self-assembly";
  const registryModulePlanResourceClass = "browser-constrained-local-assembly";
  const registryModulePlanProfile = "browser-constrained-v1";
  const registryModulePlanExecutionProfile = "single-threaded-wasm-local-v1";
  const registryModulePlanFetchPolicy = "local-no-store-v1";
  const registryModulePlanOriginPolicy = "same-origin-loopback-local-v1";
  const registryModulePlanFetchCountLimit = 32;
  const registryModulePlanPlannedFetchCount = 21;
  const registryModulePlanRouteSetVersion = "1";
  const registryModulePlanRouteSetChecksumAlgorithm = "tinyrustlm-text-checksum-v1";
  const registryModulePlanWasmMemoryInitialPages = 17;
  const registryModulePlanWasmExportSet = "tinyrustlm-generate-v1";
  const registryModulePlanWasmTransferStrategy = "copy-then-release-v1";
  const registryModulePlanModelReleaseStrategy = "free-before-reassembly-v1";
  const registryModulePlanRuntimeResetStrategy = "reset-context-before-assembly-v1";
  const registryModulePlanAdapterValidationStrategy = "rust-validate-before-apply-v1";
  const registryModulePlanAdapterValidationCount = 3;
  const registryModulePlanAdapterApplyCount = 3;
  const registryModulePlanWasmHeapMinBytes = 64 * 1024;
  const registryModulePlanWasmExports = [
    "memory",
    "alloc",
    "dealloc",
    "init_runtime",
    "load_model",
    "generate",
    "set_sampling_config",
    "generate_next_token",
    "validate_adapter_delta",
    "apply_adapter_delta",
    "last_result_ptr",
    "last_result_len",
    "get_diagnostics_ptr",
    "get_diagnostics_len",
    "reset_context",
    "free_model"
  ];
  const registryModulePlanContextTokenLimitLimit = 4096;
  const registryModulePlanSamplerCandidateCap = 1024;
  const registryModulePlanPromptByteLimit = 4 * 1024;
  const registryModulePlanRuntimeScratchByteBudget = 64 * 1024;
  const registryModulePlanOutputByteLimit = 64 * 1024;
  const registryModulePlanKvCacheByteBudgetLimit = 8 * 1024 * 1024;
  const runtimeWasmKind = "tinyrustlm-rust-wasm";
  const runtimeWasmStatus = "validated-local-runtime";
  const runtimeWasmNextGate = "instantiate-wasm-runtime";
  const selectorDefaultStrategy = "browser-frugal-quantized";
  const registryGenomeStrategy = "selector-admission-genome-v1";
  const registryGenomeLineageStatus = "admission-bound";
  const registrySpeciesStrategy = "selector-speciation-fit-v1";
  const registrySpeciesFitStatus = "browser-fit-bound";
  const registryNoveltyStrategy = "selector-novelty-sketch-v1";
  const registryNoveltyStatus = "behavior-sketch-bound";
  const registryPopulationStrategy = "selector-population-review-route-v1";
  const registryPopulationStatus = "population-review-bound";
  const registryMateSelectionStrategy = "selector-mate-selection-route-v1";
  const registryMateSelectionParentPoolStatus = "parent-pool-bound";
  const registryMateSelectionAdmissionStatus = "admission-only";
  const registryOperatorReceiptStatus = "receipt-bound";
  const registryEvolutionRecipeVersion = "1";
  const registryEvolutionRecipeStrategy = "population-based-parent-pool-replay-v1";
  const registryEvolutionRecipeStatus = "operator-family-planned";
  const registryEvolutionSelectionSource = "population-fitness-normalized-seed-weights";
  const registryEvolutionScheduleChecksumAlgorithm = "tinyrustlm-text-checksum-v1";
  const registryPhenotypeEvidenceStrategy = "selector-phenotype-evidence-v1";
  const registryPhenotypeEvidenceStatus = "runtime-eval-bound";
  const registryHeritableArtifactStrategy = "selector-heritable-artifact-v1";
  const registryHeritableArtifactStatus = "served-artifact-bound";
  const registryFitnessVectorStatus = "eval-bound";
  const registrySourceManifestKind = "trained-source-manifest";
  const registrySourceManifestStatus = "reviewed-source-snapshot";
  const registrySourceManifestLayout = "raw-f32-tensor-files-v1";
  const registrySourceReviewKind = "safetensors-candidate-review";
  const registrySourceReviewStatus = "validated-before-extraction";
  const registrySourceReviewRequiredNextGate = "extract-raw-f32-tensors";
  const registrySourceValidationGate = "validate-source";
  const registrySourceValidationStatus = "pass";
  const registrySourceValidationDecision = "accepted-for-conversion";
  const registrySourceValidationRequiredNextGate = "convert-raw-f32-source-to-slm";
  const registryAdmissionStatus = "admitted-for-browser-selector";
  const registryAdmissionPromotionStatus = "runtime-smoke-and-eval-passed";
  const registryAdmissionRuntimeSmokeStatus = "pass";
  const registryAdmissionEvalStatus = "pass";
  const registryAdmissionQualityGate = "assistant-quality";
  const registryAdmissionPromotionDecision = "accepted-for-browser-selector";
  const registryAdmissionBrowserSelectorStatus = "admitted";
  const registryAdmissionPublicClaimStatus = "bound-to-eval-scope";
  const registryAdmissionRequiredNextGate = "browser-selector-loads-only-admission-record-artifacts";
  const selectorModelByteBudget = 32 * 1024 * 1024;
  const selectorRegistryTextByteBudget = 256 * 1024;
  const manifestTextByteBudget = 64 * 1024;
  const receiptTextByteBudget = 128 * 1024;
  const evidenceTextByteBudget = 128 * 1024;
  const registryModulePlanTotalByteBudgetLimit =
    selectorModelByteBudget +
    registryAdapterAutoApplyByteBudget +
    registryModulePlanKvCacheByteBudgetLimit +
    manifestTextByteBudget +
    receiptTextByteBudget +
    receiptTextByteBudget +
    registryModulePlanPromptByteLimit +
    registryModulePlanRuntimeScratchByteBudget +
    registryModulePlanOutputByteLimit;
  const adapterFamilyReceiptStatus = "validated";
  const assemblyReceiptStatus = "validated";
  const assemblyReceiptStrategies = new Set([
    "multi-parent-sign-merge",
    "multi-parent-weighted-soup"
  ]);
  const modulePlanReceiptStatus = "validated";
  const localFetchOptions = Object.freeze({ cache: "no-store" });
  const adapterManifestArtifactVersion = "1";
  const adapterManifestStatus = "artifact-written";
  const sourceBackedLowRankAdapterKind = "trained-source-low-rank-f32-v1";
  const sourceBackedLowRankManifestFields = [
    ["adapter_source_manifest", "source_manifest", "adapter-source.manifest", false],
    ["adapter_source_manifest_checksum", "source_manifest_checksum", "", true],
    ["adapter_source_layout", "source_layout", "low-rank-f32-factor-files-v1", false],
    ["adapter_source_format", "source_format", "trained-low-rank-factors-v1", false],
    ["adapter_source_base_contract", "source_base_contract", "matches-reviewed-adapter-source-base-contract", false]
  ];
  const adapterManifestFormats = [
    {
      extension: ".adp1",
      kindDtypePairs: [["raw-f32-task-delta-v1", "f32-delta"]],
      defaultLabel: "ADP1 adapter",
      applyStatus: registryAdapterApplyStatus,
      quantizedApplyStatus: registryQuantizedAdapterApplyStatus
    },
    {
      extension: ".asp1",
      kindDtypePairs: [["sparse-f32-task-delta-v1", "sparse-f32-delta"]],
      defaultLabel: "ASP1 adapter",
      applyStatus: registryAdapterApplyStatus,
      quantizedApplyStatus: registryQuantizedAdapterApplyStatus
    },
    {
      extension: ".alr1",
      kindDtypePairs: [
        ["low-rank-f32-task-delta-v1", "low-rank-f32-delta"],
        [sourceBackedLowRankAdapterKind, "low-rank-f32-source-delta"]
      ],
      defaultLabel: "ALR1 adapter",
      applyStatus: registryLowRankAdapterApplyStatus,
      quantizedApplyStatus: registryQuantizedLowRankAdapterApplyStatus
    }
  ];
  const adapterFamilyReceiptKinds = new Set([
    "browser-local-adapter-family",
    "browser-local-adp1-family"
  ]);
  const checksumMask = (1n << 64n) - 1n;
  const checksumPrime = 0x100000001b3n;
  const adapterFamilyIdentityKeys = [
    "adapter_tensor_count",
    "adapter_parameter_count",
    "adapter_model_shape",
    "adapter_base_quantization",
    "adapter_output_contract",
    "adapter_tokenizer_checksum",
    "adapter_tensor_layout_checksum",
    "adapter_base_contract"
  ];
  const assemblyEvidenceBaseRoutes = [
    ["promotion_ledger_path", "promotion_ledger_checksum", "population.ledger"],
    ["population_review_path", "population_review_checksum", "population.review"],
    ["parent_pool_recipe_path", "parent_pool_recipe_checksum", "parent-pool.recipe"]
  ];
  const assemblyOperatorEvidenceRoutes = [
    ["operator_receipt_path", "operator_receipt_checksum", "operator"],
    ["candidate_manifest_path", "candidate_manifest_checksum", "candidate"],
    ["promotion_manifest_path", "promotion_manifest_checksum", "promotion"],
    ["runtime_smoke_path", "runtime_smoke_manifest_checksum", "runtime"],
    ["eval_path", "eval_manifest_checksum", "eval"],
    ["admission_path", "admission_checksum", "multi.admission"]
  ];

  const state = {
    instance: null,
    exports: null,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),
    modelLoadMs: 0,
    lastGenerateMs: 0,
    lastMeasuredTokens: 0,
    modelLoadSequence: 0,
    wasmMemoryInitialPages: 0,
    activeModelKey: "",
    modelLoaded: false,
    modelManifest: null,
    modulePlanReceipt: null,
    modulePlanActualFetchCount: null,
    modulePlanActualRoutes: null,
    modulePlanActualRouteSetChecksum: null,
    modulePlanActualModuleBytes: null,
    modulePlanActualModuleByteIndexes: null,
    modulePlanActualModuleChecksums: null,
    assemblyReceipt: null,
    modulePlanTrace: [],
    selectorRegistry: null,
    selectorDefaultModelKey: "",
    localModel: null,
    catalogEntries: [],
    selectedCatalogEntry: null,
    pendingConversionRequest: null,
    catalogFetchAbort: null,
    hfSearchAbort: null,
    hasContext: false,
    messages: [],
    runHistory: [],
    latestDiagnostics: null,
    latestSampling: null,
    consoleAutoScroll: true,
    simpleSourceOption: "local",
    modelPopoverHoldUntil: 0,
    p2pEnabled: true,
    peerBaseUrl: "",
    hfLastAccepted: [],
    defaultCatalogCheckedForAvailability: false
  };

  const el = {
    appShell: document.querySelector(".app-shell"),
    systemStatusDot: document.getElementById("systemStatusDot"),
    statusDetail: document.getElementById("statusDetail"),
    simpleModeButton: document.getElementById("simpleModeButton"),
    advancedModeButton: document.getElementById("advancedModeButton"),
    currentModelSummary: document.getElementById("currentModelSummary"),
    simpleDiscoveryPanel: document.getElementById("simpleDiscoveryPanel"),
    simpleLocalSourceButton: document.getElementById("simpleLocalSourceButton"),
    simpleHfSourceButton: document.getElementById("simpleHfSourceButton"),
    simpleP2pSourceButton: document.getElementById("simpleP2pSourceButton"),
    simpleChooseLocalButton: document.getElementById("simpleChooseLocalButton"),
    simpleImportLocalModelButton: document.getElementById("simpleImportLocalModelButton"),
    simpleHfSearchInput: document.getElementById("simpleHfSearchInput"),
    simpleHfSearchButton: document.getElementById("simpleHfSearchButton"),
    simpleHfP2pToggle: document.getElementById("simpleHfP2pToggle"),
    simpleHfP2pStatus: document.getElementById("simpleHfP2pStatus"),
    simpleHfP2pWarning: document.getElementById("simpleHfP2pWarning"),
    simplePeerBaseUrlInput: document.getElementById("simplePeerBaseUrlInput"),
    simpleSavePeerUrlButton: document.getElementById("simpleSavePeerUrlButton"),
    simplePeerUrlStatus: document.getElementById("simplePeerUrlStatus"),
    simpleCatalogResults: document.getElementById("simpleCatalogResults"),
    simpleHfResults: document.getElementById("simpleHfResults"),
    simpleLoadCatalogButton: document.getElementById("simpleLoadCatalogButton"),
    simplePeerAnnouncementFile: document.getElementById("simplePeerAnnouncementFile"),
    simpleApplyPeerAnnouncementButton: document.getElementById("simpleApplyPeerAnnouncementButton"),
    simpleSaveShareMetadataButton: document.getElementById("simpleSaveShareMetadataButton"),
    simpleShareMetadataStatus: document.getElementById("simpleShareMetadataStatus"),
    simpleOpenAdvancedDiscoveryButton: document.getElementById("simpleOpenAdvancedDiscoveryButton"),
    simpleDiscoveryStatus: document.getElementById("simpleDiscoveryStatus"),
    simpleErrorPanel: document.getElementById("simpleErrorPanel"),
    simpleErrorMessage: document.getElementById("simpleErrorMessage"),
    modelToolbarName: document.getElementById("modelToolbarName"),
    modelLoadPill: document.getElementById("modelLoadPill"),
    modelContextPill: document.getElementById("modelContextPill"),
    simpleRepeatable: document.getElementById("simpleRepeatable"),
    keepRunHistoryToggle: document.getElementById("keepRunHistoryToggle"),
    clearRunHistoryButton: document.getElementById("clearRunHistoryButton"),
    runHistoryList: document.getElementById("runHistoryList"),
    runSummary: document.getElementById("runSummary"),
    diagnosticsRail: document.getElementById("diagnosticsRail"),
    diagnosticsRailToggle: document.getElementById("diagnosticsRailToggle"),
    mobileAdvancedButton: document.getElementById("mobileAdvancedButton"),
    clearConsoleButton: document.getElementById("clearConsoleButton"),
    copyConsoleButton: document.getElementById("copyConsoleButton"),
    pauseConsoleScroll: document.getElementById("pauseConsoleScroll"),
    runtimeStatus: document.getElementById("runtimeStatus"),
    wasmState: document.getElementById("wasmState"),
    modelState: document.getElementById("modelState"),
    errorState: document.getElementById("errorState"),
    diagnostics: document.getElementById("diagnostics"),
    console: document.getElementById("console"),
    developer: document.getElementById("developer"),
    response: document.getElementById("response"),
    form: document.getElementById("chatForm"),
    prompt: document.getElementById("prompt"),
    maxTokens: document.getElementById("maxTokens"),
    temperature: document.getElementById("temperature"),
    topK: document.getElementById("topK"),
    topP: document.getElementById("topP"),
    seed: document.getElementById("seed"),
    modelSelect: document.getElementById("modelSelect"),
    localModelFile: document.getElementById("localModelFile"),
    importLocalModelButton: document.getElementById("importLocalModelButton"),
    localModelState: document.getElementById("localModelState"),
    conversionRequestFile: document.getElementById("conversionRequestFile"),
    importConversionRequestButton: document.getElementById("importConversionRequestButton"),
    conversionRequestState: document.getElementById("conversionRequestState"),
    catalogUrlInput: document.getElementById("catalogUrlInput"),
    catalogLoadButton: document.getElementById("catalogLoadButton"),
    localCatalogFile: document.getElementById("localCatalogFile"),
    importLocalCatalogButton: document.getElementById("importLocalCatalogButton"),
    peerAnnouncementFile: document.getElementById("peerAnnouncementFile"),
    applyPeerAnnouncementButton: document.getElementById("applyPeerAnnouncementButton"),
    catalogStatus: document.getElementById("catalogStatus"),
    catalogResults: document.getElementById("catalogResults"),
    hfSearchInput: document.getElementById("hfSearchInput"),
    hfSearchButton: document.getElementById("hfSearchButton"),
    hfStatus: document.getElementById("hfStatus"),
    hfResults: document.getElementById("hfResults"),
    saveShareMetadataButton: document.getElementById("saveShareMetadataButton"),
    shareMetadataState: document.getElementById("shareMetadataState"),
    adapterSelect: document.getElementById("adapterSelect"),
    applyAdapterButton: document.getElementById("applyAdapterButton"),
    adapterState: document.getElementById("adapterState"),
    generateButton: document.getElementById("generateButton"),
    stepTokenButton: document.getElementById("stepTokenButton"),
    resetButton: document.getElementById("resetButton"),
    clearChatButton: document.getElementById("clearChatButton"),
    conversation: document.getElementById("conversation"),
    benchLoadMs: document.getElementById("benchLoadMs"),
    benchPromptTokens: document.getElementById("benchPromptTokens"),
    benchGeneratedTokens: document.getElementById("benchGeneratedTokens"),
    benchTokensPerSecond: document.getElementById("benchTokensPerSecond"),
    benchScratch: document.getElementById("benchScratch"),
    provenanceState: document.getElementById("provenanceState"),
    provenanceSourceKind: document.getElementById("provenanceSourceKind"),
    provenanceSourceSnapshot: document.getElementById("provenanceSourceSnapshot"),
    provenanceSourceId: document.getElementById("provenanceSourceId"),
    provenanceSourceShape: document.getElementById("provenanceSourceShape"),
    provenanceSourceReview: document.getElementById("provenanceSourceReview"),
    provenanceSourceReviewRoutes: document.getElementById("provenanceSourceReviewRoutes"),
    provenanceSourceReviewArtifacts: document.getElementById("provenanceSourceReviewArtifacts"),
    provenanceSourceTokenizerImport: document.getElementById("provenanceSourceTokenizerImport"),
    provenanceSourceValidation: document.getElementById("provenanceSourceValidation"),
    provenanceAdmission: document.getElementById("provenanceAdmission"),
    provenanceQualityClaim: document.getElementById("provenanceQualityClaim"),
    provenanceTrainedClaim: document.getElementById("provenanceTrainedClaim"),
    provenanceGenome: document.getElementById("provenanceGenome"),
    provenanceSpecies: document.getElementById("provenanceSpecies"),
    provenanceNovelty: document.getElementById("provenanceNovelty"),
    provenancePopulation: document.getElementById("provenancePopulation"),
    provenanceMateSelection: document.getElementById("provenanceMateSelection"),
    provenanceOperator: document.getElementById("provenanceOperator"),
    provenanceSchedule: document.getElementById("provenanceSchedule"),
    provenancePhenotype: document.getElementById("provenancePhenotype"),
    provenanceArtifact: document.getElementById("provenanceArtifact"),
    provenanceFitness: document.getElementById("provenanceFitness"),
    provenanceEvalCases: document.getElementById("provenanceEvalCases"),
    provenanceEvalChecksum: document.getElementById("provenanceEvalChecksum"),
    provenanceChecksum: document.getElementById("provenanceChecksum"),
    provenanceNextGate: document.getElementById("provenanceNextGate"),
    assemblyState: document.getElementById("assemblyState"),
    assemblyKind: document.getElementById("assemblyKind"),
    assemblyParents: document.getElementById("assemblyParents"),
    assemblyOperator: document.getElementById("assemblyOperator"),
    assemblyLedger: document.getElementById("assemblyLedger"),
    assemblyNextGate: document.getElementById("assemblyNextGate"),
    modulePlanState: document.getElementById("modulePlanState"),
    modulePlanKind: document.getElementById("modulePlanKind"),
    modulePlanResource: document.getElementById("modulePlanResource"),
    modulePlanExecution: document.getElementById("modulePlanExecution"),
    modulePlanFetch: document.getElementById("modulePlanFetch"),
    modulePlanOrigin: document.getElementById("modulePlanOrigin"),
    modulePlanFetchLimit: document.getElementById("modulePlanFetchLimit"),
    modulePlanPlannedFetchCount: document.getElementById("modulePlanPlannedFetchCount"),
    modulePlanActualFetchCount: document.getElementById("modulePlanActualFetchCount"),
    modulePlanRouteSetChecksumAlgorithm: document.getElementById("modulePlanRouteSetChecksumAlgorithm"),
    modulePlanRouteSetVersion: document.getElementById("modulePlanRouteSetVersion"),
    modulePlanRouteSetChecksum: document.getElementById("modulePlanRouteSetChecksum"),
    modulePlanActualRouteSetChecksum: document.getElementById("modulePlanActualRouteSetChecksum"),
    modulePlanWasmPages: document.getElementById("modulePlanWasmPages"),
    modulePlanWasmExportSet: document.getElementById("modulePlanWasmExportSet"),
    modulePlanWasmTransferStrategy: document.getElementById("modulePlanWasmTransferStrategy"),
    modulePlanModelReleaseStrategy: document.getElementById("modulePlanModelReleaseStrategy"),
    modulePlanRuntimeResetStrategy: document.getElementById("modulePlanRuntimeResetStrategy"),
    modulePlanAdapterValidationStrategy: document.getElementById("modulePlanAdapterValidationStrategy"),
    modulePlanAdapterValidationCount: document.getElementById("modulePlanAdapterValidationCount"),
    modulePlanAdapterApplyCount: document.getElementById("modulePlanAdapterApplyCount"),
    modulePlanWasmHeapMinBytes: document.getElementById("modulePlanWasmHeapMinBytes"),
    modulePlanContextTokens: document.getElementById("modulePlanContextTokens"),
    modulePlanSamplerCap: document.getElementById("modulePlanSamplerCap"),
    modulePlanTokenizer: document.getElementById("modulePlanTokenizer"),
    modulePlanModules: document.getElementById("modulePlanModules"),
    modulePlanModelBudget: document.getElementById("modulePlanModelBudget"),
    modulePlanAdapterBudget: document.getElementById("modulePlanAdapterBudget"),
    modulePlanAdapterStackBudget: document.getElementById("modulePlanAdapterStackBudget"),
    modulePlanScratchBudget: document.getElementById("modulePlanScratchBudget"),
    modulePlanPromptLimit: document.getElementById("modulePlanPromptLimit"),
    modulePlanOutputLimit: document.getElementById("modulePlanOutputLimit"),
    modulePlanKvCacheBudget: document.getElementById("modulePlanKvCacheBudget"),
    modulePlanKvCachePages: document.getElementById("modulePlanKvCachePages"),
    modulePlanTotalBudget: document.getElementById("modulePlanTotalBudget"),
    modulePlanTotalLimit: document.getElementById("modulePlanTotalLimit"),
    modulePlanBytes: document.getElementById("modulePlanBytes"),
    modulePlanActualModuleBytes: document.getElementById("modulePlanActualModuleBytes"),
    modulePlanChecksums: document.getElementById("modulePlanChecksums"),
    modulePlanActualModuleChecksums: document.getElementById("modulePlanActualModuleChecksums"),
    modulePlanSlots: document.getElementById("modulePlanSlots"),
    modulePlanRoles: document.getElementById("modulePlanRoles"),
    modulePlanPhases: document.getElementById("modulePlanPhases"),
    modulePlanDepends: document.getElementById("modulePlanDepends"),
    modulePlanTrace: document.getElementById("modulePlanTrace"),
    modulePlanModel: document.getElementById("modulePlanModel"),
    modulePlanStack: document.getElementById("modulePlanStack")
  };

  const uiStorageKeys = {
    version: "slmcomposer.ui.version",
    mode: "slmcomposer.ui.mode",
    selectedStarter: "slmcomposer.ui.selectedStarter",
    simpleSourceOption: "slmcomposer.ui.simpleSourceOption",
    p2pEnabled: "slmcomposer.ui.p2pEnabled",
    peerBaseUrl: "slmcomposer.ui.peerBaseUrl",
    creativity: "slmcomposer.ui.creativity",
    length: "slmcomposer.ui.length",
    repeatable: "slmcomposer.ui.repeatable",
    sidebarCollapsed: "slmcomposer.ui.sidebarCollapsed",
    railCollapsed: "slmcomposer.ui.railCollapsed",
    activeTab: "slmcomposer.ui.activeTab",
    keepRunHistory: "slmcomposer.ui.keepRunHistory",
    runHistory: "slmcomposer.ui.runHistory",
    consolePaused: "slmcomposer.ui.consolePaused"
  };

  const uiPreferenceVersion = "local-ai-dashboard-v2";

  const starterProfiles = {
    fast: {
      modelKey: "tinylm16q4",
      creativity: "balanced",
      length: "short",
      message: "Fast local profile selected. Import a trusted local model if this preset is unavailable."
    },
    balanced: {
      modelKey: "tinylm16q8",
      creativity: "balanced",
      length: "normal",
      message: "Balanced local profile selected."
    },
    precise: {
      modelKey: "tinylm16f32",
      creativity: "focused",
      length: "normal",
      repeatable: true,
      message: "Precise profile selected with lower randomness."
    }
  };

  const semanticSettings = {
    creativity: {
      focused: { temperature: "0", topK: "1", topP: "1" },
      balanced: { temperature: "0.65", topK: "40", topP: "0.90" },
      creative: { temperature: "1", topK: "80", topP: "0.95" }
    },
    length: {
      short: "32",
      normal: "80",
      detailed: "160"
    }
  };

  const generationPresets = {
    balanced: { temperature: "0.70", topK: "40", topP: "0.90" },
    creative: { temperature: "0.95", topK: "80", topP: "0.95" },
    precise: { temperature: "0.25", topK: "20", topP: "0.70" },
    code: { temperature: "0.20", topK: "30", topP: "0.80" },
    json: { temperature: "0.10", topK: "20", topP: "0.65" }
  };

  function storageGet(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // UI preferences are best-effort only.
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (_error) {
      // UI preferences are best-effort only.
    }
  }

  function resetUiPreferencesForVersion() {
    if (storageGet(uiStorageKeys.version, "") === uiPreferenceVersion) {
      return;
    }
    storageRemove(uiStorageKeys.mode);
    storageRemove(uiStorageKeys.selectedStarter);
    storageRemove(uiStorageKeys.simpleSourceOption);
    storageRemove(uiStorageKeys.sidebarCollapsed);
    storageSet(uiStorageKeys.version, uiPreferenceVersion);
  }

  function initialAppMode() {
    const search = new URLSearchParams(window.location.search);
    if (search.get("mode") === "advanced") {
      return "advanced";
    }
    return storageGet(uiStorageKeys.mode, "simple");
  }

  function selectedRadioValue(name, fallback) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : fallback;
  }

  function setRadioValue(name, value) {
    const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) {
      input.checked = true;
    }
  }

  function copyText(text) {
    const value = String(text || "");
    if (!value) {
      return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(value).catch(() => {});
    }
  }

  function downloadTextFile(fileName, text, mimeType = "application/json") {
    const blob = new Blob([text], { type: `${mimeType}; charset=utf-8` });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = safeLocalModelName(fileName);
    link.addEventListener("click", (event) => event.stopPropagation());
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  function systemStateForText(text, isError) {
    const value = String(text || "").toLowerCase();
    if (isError || value.includes("failed") || value.includes("rejected") || value.includes("error")) {
      return ["error", "Error"];
    }
    if (value.includes("generating")) {
      return ["generating", "Generating"];
    }
    if (value.includes("catalog") || value.includes("metadata")) {
      return ["fetching", "Fetching catalog"];
    }
    if (value.includes("import")) {
      return ["importing", "Importing local model"];
    }
    if (value.includes("loading runtime")) {
      return ["loading", "Compiling WASM"];
    }
    if (value.includes("loading") || value.includes("assembling") || value.includes("applying")) {
      return ["loading", "Loading model"];
    }
    if (value === "ready") {
      return ["ready", "Ready"];
    }
    if (value.includes("runtime ready") || value.includes("choose a local")) {
      return ["waiting", "Waiting for model"];
    }
    return ["booting", "Booting"];
  }

  function updateSystemStatus(text, isError) {
    if (!el.appShell) {
      return;
    }
    const [stateName, detail] = systemStateForText(text, isError);
    el.appShell.dataset.systemState = stateName;
    if (el.statusDetail) {
      el.statusDetail.textContent = detail;
    }
  }

  function friendlyError(text) {
    const value = String(text || "").trim();
    if (!value || value === "none") {
      return "";
    }
    if (value.toLowerCase().includes("catalog")) {
      return "The model list could not be loaded. Check the URL or try a local JSON list.";
    }
    if (value.toLowerCase().includes("prompt byte limit")) {
      return "The prompt is too large for this browser-local model. Try a shorter prompt.";
    }
    if (value.toLowerCase().includes("model")) {
      return "The model could not be loaded. Try a smaller local model or check that the file is a valid .slm file.";
    }
    return "The local runtime could not finish that action. Advanced Mode has the raw technical detail.";
  }

  function renderSimpleError(text, isError) {
    if (!el.simpleErrorPanel || !el.simpleErrorMessage) {
      return;
    }
    const message = isError ? friendlyError(text) : "";
    el.simpleErrorPanel.hidden = !message;
    if (message) {
      el.simpleErrorMessage.textContent = message;
    }
  }

  function appendPlainResponse(container, text) {
    if (text) {
      container.append(document.createTextNode(text));
    }
  }

  function renderResponse(container, text, isError) {
    const value = String(text === undefined || text === null ? "" : text);
    container.replaceChildren();
    container.classList.toggle("error", Boolean(isError));
    container.dataset.rawText = value;
    if (!value) {
      return;
    }
    const fencePattern = /```([A-Za-z0-9_-]+)?\n?([\s\S]*?)```/g;
    let cursor = 0;
    let match = fencePattern.exec(value);
    while (match) {
      appendPlainResponse(container, value.slice(cursor, match.index));
      const block = document.createElement("div");
      const copyButton = document.createElement("button");
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      block.className = "response-code-block";
      copyButton.className = "copy-code-button";
      copyButton.type = "button";
      copyButton.setAttribute("aria-label", "Copy code block");
      code.textContent = match[2] || "";
      pre.append(code);
      copyButton.addEventListener("click", () => copyText(code.textContent));
      block.append(copyButton, pre);
      container.append(block);
      cursor = match.index + match[0].length;
      match = fencePattern.exec(value);
    }
    appendPlainResponse(container, value.slice(cursor));
  }

  function ensureCopyButton(node) {
    if (!node || !node.classList || !node.classList.contains("copyable")) {
      return;
    }
    const raw = Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join("")
      .trim();
    if (!raw || raw === "waiting" || node.querySelector(".copy-field-button")) {
      return;
    }
    const button = document.createElement("button");
    button.className = "copy-field-button";
    button.type = "button";
    button.setAttribute("aria-label", "Copy field value");
    button.addEventListener("click", () => copyText(raw));
    node.append(button);
  }

  function setText(node, text, isError) {
    if (!node) {
      return;
    }
    if (node === el.response) {
      renderResponse(node, text, isError);
    } else {
      node.textContent = text;
      node.classList.toggle("error", Boolean(isError));
      ensureCopyButton(node);
    }
    if (node === el.runtimeStatus) {
      updateSystemStatus(text, isError);
    }
    if (node === el.errorState) {
      renderSimpleError(text, isError);
    }
    if (node === el.modelState || node === el.localModelState) {
      updateModelSummary();
    }
  }

  function updateModelSummary() {
    if (!el.currentModelSummary || !el.modelSelect) {
      return;
    }
    const selected = el.modelSelect.selectedOptions && el.modelSelect.selectedOptions[0]
      ? el.modelSelect.selectedOptions[0].textContent.trim()
      : "No model selected";
    const stateText = el.modelState ? el.modelState.textContent : "";
    const model = paths.models[state.activeModelKey] || paths.models[el.modelSelect.value] || null;
    const hasLoadedModel = state.modelLoaded === true;
    const hasLocalCandidate = Boolean(state.localModel);
    const friendlyModelName = hasLoadedModel
      ? selected
      : hasLocalCandidate
        ? state.localModel.label || "Selected local .slm"
        : "Choose a local .slm";
    if (el.modelToolbarName) {
      el.modelToolbarName.textContent = friendlyModelName;
    }
    if (el.modelLoadPill) {
      let pillText = "No model imported";
      let pillClass = "status-pill neutral";
      const lowerState = String(stateText || "").toLowerCase();
      if (hasLoadedModel) {
        pillText = "Loaded locally";
        pillClass = "status-pill success";
      } else if (lowerState.includes("loading") || lowerState.includes("reading") || lowerState.includes("import")) {
        pillText = "Importing";
        pillClass = "status-pill info";
      } else if (lowerState.includes("error") || lowerState.includes("rejected") || lowerState.includes("failed")) {
        pillText = "Needs attention";
        pillClass = "status-pill error";
      } else if (hasLocalCandidate) {
        pillText = "Ready to import";
        pillClass = "status-pill neutral";
      }
      let dot = el.modelLoadPill.querySelector(".mini-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "mini-dot";
      }
      el.modelLoadPill.className = pillClass;
      el.modelLoadPill.replaceChildren(dot, document.createTextNode(pillText));
    }
    if (el.modelContextPill) {
      el.modelContextPill.textContent = hasLoadedModel && model && Number.isFinite(model.maxTokens)
        ? `${model.maxTokens} max tokens`
        : "Browser local";
    }
    el.currentModelSummary.textContent = `${selected} / ${stateText || "waiting"}`;
    updateShareMetadataControls();
  }

  function setAppMode(mode) {
    const nextMode = mode === "advanced" ? "advanced" : "simple";
    if (el.appShell) {
      el.appShell.dataset.mode = nextMode;
    }
    if (el.simpleModeButton) {
      el.simpleModeButton.setAttribute("aria-pressed", String(nextMode === "simple"));
    }
    if (el.advancedModeButton) {
      el.advancedModeButton.setAttribute("aria-pressed", String(nextMode === "advanced"));
    }
    storageSet(uiStorageKeys.mode, nextMode);
  }

  function setSimpleSourceOption(option, reveal) {
    const nextOption = option === "huggingface" || option === "p2p" ? option : "local";
    state.simpleSourceOption = nextOption;
    if (reveal && el.simpleDiscoveryPanel) {
      el.simpleDiscoveryPanel.hidden = false;
    }
    document.querySelectorAll("[data-source-option]").forEach((button) => {
      const selected = button.dataset.sourceOption === nextOption;
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-source-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.sourcePanel !== nextOption;
    });
    storageSet(uiStorageKeys.simpleSourceOption, nextOption);
    if (el.simpleDiscoveryStatus) {
      const messages = {
        local: "Choose a trusted local .slm file. No network is needed.",
        huggingface: "Search returns model cards. Rust conversion decides whether a source can become a runnable .slm.",
        p2p: "Use MiniModel manifests from a consenting peer. Rust fetches pieces, assembles, and revalidates before import."
      };
      el.simpleDiscoveryStatus.textContent = messages[nextOption];
      el.simpleDiscoveryStatus.classList.remove("error");
    }
  }

  function syncSemanticControls(refreshSeed) {
    const creativity = selectedRadioValue("simpleCreativity", "balanced");
    const length = selectedRadioValue("simpleLength", "normal");
    const repeatable = Boolean(el.simpleRepeatable && el.simpleRepeatable.checked);
    const sampling = semanticSettings.creativity[creativity] || semanticSettings.creativity.balanced;
    if (el.temperature) {
      el.temperature.value = sampling.temperature;
    }
    if (el.topK) {
      el.topK.value = sampling.topK;
    }
    if (el.topP) {
      el.topP.value = sampling.topP;
    }
    if (el.maxTokens) {
      el.maxTokens.value = semanticSettings.length[length] || semanticSettings.length.normal;
    }
    if (el.seed && (refreshSeed || repeatable)) {
      el.seed.value = repeatable ? "1" : String(Math.floor(Math.random() * 4294967295));
    }
    syncRangeControls();
    storageSet(uiStorageKeys.creativity, creativity);
    storageSet(uiStorageKeys.length, length);
    storageSet(uiStorageKeys.repeatable, String(repeatable));
  }

  function restoreSemanticPreferences() {
    setRadioValue("simpleCreativity", storageGet(uiStorageKeys.creativity, "balanced"));
    setRadioValue("simpleLength", storageGet(uiStorageKeys.length, "normal"));
    if (el.simpleRepeatable) {
      el.simpleRepeatable.checked = storageGet(uiStorageKeys.repeatable, "false") === "true";
    }
    syncSemanticControls(false);
  }

  function formatRangeValue(input) {
    if (!input) {
      return "";
    }
    if (input.id === "temperature" || input.id === "topP") {
      return Number.parseFloat(input.value || "0").toFixed(2);
    }
    return String(Number.parseInt(input.value, 10) || 0);
  }

  function syncRangeControl(input) {
    if (!input || input.type !== "range") {
      return;
    }
    const min = Number.parseFloat(input.min || "0");
    const max = Number.parseFloat(input.max || "100");
    const value = Number.parseFloat(input.value || input.min || "0");
    const span = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--fill", `${Math.max(0, Math.min(100, span))}%`);
    const output = document.querySelector(`[data-value-for="${input.id}"]`);
    if (output) {
      output.textContent = formatRangeValue(input);
    }
  }

  function syncRangeControls() {
    document.querySelectorAll('input[type="range"]').forEach(syncRangeControl);
  }

  function setPresetButtonState(preset) {
    document.querySelectorAll(".preset-button").forEach((button) => {
      const selected = button.dataset.preset === preset;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function applyGenerationPreset(preset) {
    const nextPreset = generationPresets[preset] ? preset : "balanced";
    const values = generationPresets[nextPreset];
    setPresetButtonState(nextPreset);
    if (el.temperature) {
      el.temperature.value = values.temperature;
    }
    if (el.topK) {
      el.topK.value = values.topK;
    }
    if (el.topP) {
      el.topP.value = values.topP;
    }
    syncRangeControls();
  }

  function toggleModelPopover(forceOpen) {
    const panel = el.simpleDiscoveryPanel;
    const openers = document.querySelectorAll("[data-open-model-popover], #modelEditButton");
    if (!panel) {
      return;
    }
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
    panel.hidden = !nextOpen;
    openers.forEach((button) => button.setAttribute("aria-expanded", String(nextOpen)));
  }

  function holdModelPopoverOpen(durationMs = 1500) {
    state.modelPopoverHoldUntil = Math.max(
      state.modelPopoverHoldUntil || 0,
      Date.now() + durationMs
    );
    toggleModelPopover(true);
  }

  function updateHfP2pStatus() {
    const enabled = state.p2pEnabled !== false;
    if (el.simpleHfP2pToggle) {
      el.simpleHfP2pToggle.checked = enabled;
    }
    if (el.simpleHfP2pStatus) {
      el.simpleHfP2pStatus.textContent = enabled
        ? "P2P on. Peer-ready matches can use P2P Import."
        : "P2P off. Results will use local conversion.";
    }
    if (el.simpleHfP2pWarning) {
      el.simpleHfP2pWarning.hidden = enabled;
    }
  }

  function normalizedPeerBaseUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_error) {
      throw new Error("Enter a full consenting peer URL, for example http://127.0.0.1:8123/");
    }
    if (parsed.protocol !== "http:") {
      throw new Error("Known-peer import uses direct http:// peer URLs only in this prototype.");
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || blockedPeerHosts.has(host)) {
      throw new Error("That host is not a peer. Project, docs, and Hugging Face hosts cannot serve model bytes.");
    }
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.href;
  }

  function updatePeerUrlStatus(message, isError = false) {
    if (el.simplePeerBaseUrlInput && el.simplePeerBaseUrlInput.value !== state.peerBaseUrl) {
      el.simplePeerBaseUrlInput.value = state.peerBaseUrl || "";
    }
    if (el.simplePeerUrlStatus) {
      const peerText = state.peerBaseUrl
        ? `Known peer set: ${state.peerBaseUrl}`
        : "Enter the consenting peer URL once; P2P imports will use it.";
      el.simplePeerUrlStatus.textContent = message || peerText;
      el.simplePeerUrlStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function setPeerBaseUrl(value) {
    const normalized = normalizedPeerBaseUrl(value);
    state.peerBaseUrl = normalized;
    storageSet(uiStorageKeys.peerBaseUrl, normalized);
    updatePeerUrlStatus(normalized ? `Known peer set: ${normalized}` : "", false);
    return normalized;
  }

  function setHfP2pEnabled(enabled) {
    state.p2pEnabled = Boolean(enabled);
    storageSet(uiStorageKeys.p2pEnabled, String(state.p2pEnabled));
    updateHfP2pStatus();
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderSimpleHfResults(state.hfLastAccepted);
    }
  }

  function collapseSidebar(collapsed) {
    if (!el.appShell) {
      return;
    }
    el.appShell.dataset.sidebarCollapsed = String(Boolean(collapsed));
    const button = document.getElementById("sidebarCollapseButton");
    if (button) {
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      button.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    }
    storageSet(uiStorageKeys.sidebarCollapsed, String(Boolean(collapsed)));
  }

  function useStarterPrompt(button) {
    const template = button ? button.dataset.promptTemplate : "";
    if (!template || !el.prompt) {
      return false;
    }
    markStarterSelected(button.dataset.starter || "");
    el.prompt.value = template;
    el.prompt.focus();
    return true;
  }

  function selectModelIfAvailable(modelKey) {
    if (!el.modelSelect || !modelKey) {
      return false;
    }
    const option = Array.from(el.modelSelect.options).find((candidate) => candidate.value === modelKey && !candidate.disabled);
    if (!option) {
      return false;
    }
    el.modelSelect.value = modelKey;
    el.modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
    updateModelSummary();
    return true;
  }

  function markStarterSelected(starter) {
    document.querySelectorAll(".starter-action").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.starter === starter);
    });
    if (starter) {
      storageSet(uiStorageKeys.selectedStarter, starter);
    }
  }

  function applyStarter(starter) {
    markStarterSelected(starter);
    if (starter === "custom") {
      setSimpleSourceOption("local", true);
      if (el.localModelFile) {
        el.localModelFile.click();
        el.localModelFile.focus();
      }
      setLocalModelStatus("Choose a trusted local .slm file", false);
      return;
    }
    if (starter === "external") {
      setSimpleSourceOption("huggingface", true);
      return;
    }
    const profile = starterProfiles[starter];
    if (!profile) {
      return;
    }
    setRadioValue("simpleCreativity", profile.creativity);
    setRadioValue("simpleLength", profile.length);
    if (el.simpleRepeatable && Object.prototype.hasOwnProperty.call(profile, "repeatable")) {
      el.simpleRepeatable.checked = Boolean(profile.repeatable);
    }
    syncSemanticControls(true);
    if (!selectModelIfAvailable(profile.modelKey)) {
      setLocalModelStatus(profile.message, false);
    }
  }

  function setActiveTab(tabName) {
    const targetTab = tabName || "runtime";
    document.querySelectorAll(".tab-button").forEach((button) => {
      const selected = button.dataset.tab === targetTab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const button = document.querySelector(`.tab-button[aria-controls="${panel.id}"]`);
      panel.hidden = !(button && button.dataset.tab === targetTab);
    });
    storageSet(uiStorageKeys.activeTab, targetTab);
  }

  function setRailCollapsed(collapsed) {
    if (!el.appShell) {
      return;
    }
    el.appShell.dataset.railCollapsed = String(Boolean(collapsed));
    if (el.diagnosticsRailToggle) {
      el.diagnosticsRailToggle.setAttribute(
        "aria-label",
        collapsed ? "Show Advanced Options" : "Collapse Advanced Options"
      );
      el.diagnosticsRailToggle.setAttribute("aria-expanded", String(!collapsed));
    }
    if (el.mobileAdvancedButton) {
      el.mobileAdvancedButton.setAttribute("aria-expanded", String(!collapsed));
    }
    storageSet(uiStorageKeys.railCollapsed, String(Boolean(collapsed)));
  }

  function latestDiagnosticsSnapshot() {
    try {
      return el.diagnostics && el.diagnostics.textContent ? JSON.parse(el.diagnostics.textContent) : null;
    } catch (_error) {
      return null;
    }
  }

  function runSnapshot(promptText, generatedText, isError) {
    const diagnostics = latestDiagnosticsSnapshot();
    return {
      timestamp: new Date().toISOString(),
      selectedModel: el.modelSelect && el.modelSelect.selectedOptions && el.modelSelect.selectedOptions[0]
        ? el.modelSelect.selectedOptions[0].textContent.trim()
        : "",
      prompt: String(promptText || ""),
      maxTokens: el.maxTokens ? el.maxTokens.value : "",
      temperature: el.temperature ? el.temperature.value : "",
      topK: el.topK ? el.topK.value : "",
      topP: el.topP ? el.topP.value : "",
      seed: el.seed ? el.seed.value : "",
      adapterStatus: el.adapterState ? el.adapterState.textContent : "",
      generatedTokenCount: diagnostics ? diagnostics.generated_token_count : 0,
      speed: el.benchTokensPerSecond ? el.benchTokensPerSecond.textContent : "",
      scratchBytes: diagnostics ? diagnostics.peak_scratch_arena_usage : 0,
      errorStatus: isError ? String(generatedText || "") : (el.errorState ? el.errorState.textContent : ""),
      routeHash: el.modulePlanRouteSetChecksum ? el.modulePlanRouteSetChecksum.textContent : "",
      checksum: el.provenanceChecksum ? el.provenanceChecksum.textContent : ""
    };
  }

  function persistRunHistory() {
    if (el.keepRunHistoryToggle && el.keepRunHistoryToggle.checked) {
      storageSet(uiStorageKeys.runHistory, JSON.stringify(state.runHistory.slice(0, 25)));
      return;
    }
    storageRemove(uiStorageKeys.runHistory);
  }

  function runSummaryText(run) {
    return [
      `time=${run.timestamp}`,
      `model=${run.selectedModel}`,
      `max_tokens=${run.maxTokens}`,
      `temperature=${run.temperature}`,
      `top_k=${run.topK}`,
      `top_p=${run.topP}`,
      `seed=${run.seed}`,
      `generated_tokens=${run.generatedTokenCount}`,
      `speed=${run.speed}`,
      `scratch_bytes=${run.scratchBytes}`,
      `error=${run.errorStatus}`,
      `route_hash=${run.routeHash}`,
      `checksum=${run.checksum}`
    ].join("\n");
  }

  function renderRunHistory() {
    if (!el.runHistoryList) {
      return;
    }
    el.runHistoryList.replaceChildren();
    for (const [index, run] of state.runHistory.entries()) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      const meta = document.createElement("p");
      const actions = document.createElement("div");
      item.className = "run-history-item";
      actions.className = "run-history-actions";
      title.textContent = `${new Date(run.timestamp).toLocaleString()} / ${run.selectedModel || "local model"}`;
      meta.textContent = `${run.generatedTokenCount || 0} tokens / ${run.speed || "0 tok/s"} / ${run.errorStatus || "none"}`;
      for (const [label, action] of [["Restore settings", "restore"], ["Duplicate run", "duplicate"], ["Copy run summary", "copy"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.runIndex = String(index);
        button.dataset.runAction = action;
        actions.append(button);
      }
      item.append(title, meta, actions);
      el.runHistoryList.append(item);
    }
    if (el.runSummary) {
      el.runSummary.textContent = state.runHistory[0]
        ? runSummaryText(state.runHistory[0]).replace(/\n/g, " / ")
        : "No generation run yet.";
    }
  }

  function captureRun(promptText, generatedText, isError) {
    state.runHistory.unshift(runSnapshot(promptText, generatedText, isError));
    state.runHistory = state.runHistory.slice(0, 25);
    persistRunHistory();
    renderRunHistory();
  }

  function restoreRun(run, duplicatePrompt) {
    if (!run) {
      return;
    }
    if (el.maxTokens) el.maxTokens.value = run.maxTokens || el.maxTokens.value;
    if (el.temperature) el.temperature.value = run.temperature || el.temperature.value;
    if (el.topK) el.topK.value = run.topK || el.topK.value;
    if (el.topP) el.topP.value = run.topP || el.topP.value;
    if (el.seed) el.seed.value = run.seed || el.seed.value;
    if (duplicatePrompt && el.prompt) {
      el.prompt.value = run.prompt || el.prompt.value;
      el.prompt.focus();
    }
  }

  function restoreRunHistoryPreference() {
    const keep = storageGet(uiStorageKeys.keepRunHistory, "false") === "true";
    if (el.keepRunHistoryToggle) {
      el.keepRunHistoryToggle.checked = keep;
    }
    if (keep) {
      try {
        const parsed = JSON.parse(storageGet(uiStorageKeys.runHistory, "[]"));
        state.runHistory = Array.isArray(parsed) ? parsed.slice(0, 25) : [];
      } catch (_error) {
        state.runHistory = [];
      }
    }
    renderRunHistory();
  }

  function initializeUiShell() {
    resetUiPreferencesForVersion();
    state.p2pEnabled = storageGet(uiStorageKeys.p2pEnabled, "true") !== "false";
    state.peerBaseUrl = storageGet(uiStorageKeys.peerBaseUrl, "");
    updateHfP2pStatus();
    updatePeerUrlStatus();
    setAppMode(initialAppMode());
    restoreSemanticPreferences();
    markStarterSelected(storageGet(uiStorageKeys.selectedStarter, ""));
    setSimpleSourceOption(storageGet(uiStorageKeys.simpleSourceOption, "local"), false);
    setActiveTab(storageGet(uiStorageKeys.activeTab, "runtime"));
    collapseSidebar(storageGet(uiStorageKeys.sidebarCollapsed, "false") === "true");
    const storedRailCollapsed = storageGet(uiStorageKeys.railCollapsed, null);
    const shouldCollapseRail = storedRailCollapsed !== null
      ? storedRailCollapsed === "true"
      : window.matchMedia("(max-width: 1199px)").matches;
    setRailCollapsed(shouldCollapseRail);
    if (el.pauseConsoleScroll) {
      el.pauseConsoleScroll.checked = storageGet(uiStorageKeys.consolePaused, "false") === "true";
      state.consoleAutoScroll = !el.pauseConsoleScroll.checked;
    }
    document.querySelectorAll("details[data-panel-key]").forEach((panel) => {
      const summary = panel.querySelector("summary");
      const stored = storageGet(`slmcomposer.ui.panel.${panel.dataset.panelKey}`, null);
      if (stored !== null) {
        panel.open = stored === "true";
      }
      if (summary) {
        summary.setAttribute("aria-expanded", String(panel.open));
      }
      panel.addEventListener("toggle", () => {
        if (summary) {
          summary.setAttribute("aria-expanded", String(panel.open));
        }
        storageSet(`slmcomposer.ui.panel.${panel.dataset.panelKey}`, String(panel.open));
      });
    });
    restoreRunHistoryPreference();
    updateSystemStatus(el.runtimeStatus ? el.runtimeStatus.textContent : "Booting", false);
    updateModelSummary();
    syncRangeControls();
  }

  function installUiEventHandlers() {
    if (el.simpleModeButton) {
      el.simpleModeButton.addEventListener("click", () => setAppMode("simple"));
    }
    if (el.advancedModeButton) {
      el.advancedModeButton.addEventListener("click", () => setAppMode("advanced"));
    }
    document.querySelectorAll(".starter-action").forEach((button) => {
      button.addEventListener("click", () => {
        if (!useStarterPrompt(button)) {
          applyStarter(button.dataset.starter);
        }
      });
    });
    const sidebarButton = document.getElementById("sidebarCollapseButton");
    if (sidebarButton) {
      sidebarButton.addEventListener("click", () => {
        collapseSidebar(!(el.appShell && el.appShell.dataset.sidebarCollapsed === "true"));
      });
    }
    const newChatButton = document.getElementById("newChatButton");
    if (newChatButton) {
      newChatButton.addEventListener("click", () => {
        state.messages = [];
        if (el.prompt) {
          el.prompt.value = "";
          el.prompt.focus();
        }
        if (el.response) {
          el.response.textContent = "";
        }
        renderConversation();
      });
    }
    document.querySelectorAll("[data-open-model-popover], #modelEditButton").forEach((button) => {
      button.addEventListener("click", () => toggleModelPopover());
    });
    if (el.simpleDiscoveryPanel) {
      el.simpleDiscoveryPanel.addEventListener("pointerdown", (event) => event.stopPropagation());
      el.simpleDiscoveryPanel.addEventListener("click", (event) => event.stopPropagation());
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        toggleModelPopover(false);
      }
    });
    document.addEventListener("click", (event) => {
      const panel = el.simpleDiscoveryPanel;
      if (!panel || panel.hidden) {
        return;
      }
      if (Date.now() < (state.modelPopoverHoldUntil || 0)) {
        toggleModelPopover(true);
        return;
      }
      const clickedOpener = event.target.closest("[data-open-model-popover], #modelEditButton");
      if (!clickedOpener && !panel.contains(event.target)) {
        toggleModelPopover(false);
      }
    });
    document.querySelectorAll(".preset-button").forEach((button) => {
      button.addEventListener("click", () => applyGenerationPreset(button.dataset.preset));
    });
    document.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener("input", () => {
        input.dataset.userEdited = "true";
        syncRangeControl(input);
      });
      input.addEventListener("change", () => syncRangeControl(input));
    });
    const seedRandomButton = document.getElementById("seedRandomButton");
    if (seedRandomButton && el.seed) {
      seedRandomButton.addEventListener("click", () => {
        el.seed.value = String(Math.floor(Math.random() * 4294967295));
      });
    }
    document.querySelectorAll("[data-source-option]").forEach((button) => {
      button.addEventListener("click", () => setSimpleSourceOption(button.dataset.sourceOption, true));
    });
    if (el.simpleChooseLocalButton) {
      el.simpleChooseLocalButton.addEventListener("click", () => {
        if (el.localModelFile) {
          el.localModelFile.click();
          el.localModelFile.focus();
        }
      });
    }
    if (el.simpleImportLocalModelButton) {
      el.simpleImportLocalModelButton.addEventListener("click", () => {
        importLocalModelFile().catch((error) => {
          const text = errorMessage(error);
          setLocalModelStatus(text, true);
          setText(el.errorState, text, true);
          if (state.exports) {
            setControls(state.modelLoaded, true);
          }
        });
      });
    }
    document.querySelectorAll('input[name="simpleCreativity"], input[name="simpleLength"]').forEach((input) => {
      input.addEventListener("change", () => syncSemanticControls(true));
    });
    if (el.simpleRepeatable) {
      el.simpleRepeatable.addEventListener("change", () => syncSemanticControls(true));
    }
    if (el.simpleLoadCatalogButton) {
      el.simpleLoadCatalogButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        if (el.catalogLoadButton) {
          el.catalogLoadButton.click();
        }
      });
    }
    if (el.simpleApplyPeerAnnouncementButton) {
      el.simpleApplyPeerAnnouncementButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        applyPeerSourceAnnouncementFile(el.simplePeerAnnouncementFile).catch((error) => {
          setCatalogStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerAnnouncementFile) {
      el.simplePeerAnnouncementFile.addEventListener("change", () => {
        const file = el.simplePeerAnnouncementFile.files && el.simplePeerAnnouncementFile.files[0];
        if (!file) {
          setCatalogStatus("choose a peer-source announcement after loading metadata", false);
          return;
        }
        setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer-source announcement selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleSaveShareMetadataButton) {
      el.simpleSaveShareMetadataButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        saveShareMetadata().catch((error) => {
          setShareMetadataStatus(errorMessage(error), true);
        });
      });
    }
    if (el.simpleSavePeerUrlButton) {
      el.simpleSavePeerUrlButton.addEventListener("click", () => {
        try {
          setPeerBaseUrl(el.simplePeerBaseUrlInput ? el.simplePeerBaseUrlInput.value : "");
          holdModelPopoverOpen(2000);
        } catch (error) {
          updatePeerUrlStatus(errorMessage(error), true);
          holdModelPopoverOpen(2500);
        }
      });
    }
    if (el.simplePeerBaseUrlInput) {
      el.simplePeerBaseUrlInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (el.simpleSavePeerUrlButton) {
          el.simpleSavePeerUrlButton.click();
        }
      });
      el.simplePeerBaseUrlInput.addEventListener("change", () => {
        try {
          setPeerBaseUrl(el.simplePeerBaseUrlInput.value);
        } catch (error) {
          updatePeerUrlStatus(errorMessage(error), true);
        }
      });
    }
    if (el.simpleHfSearchButton) {
      el.simpleHfSearchButton.addEventListener("pointerdown", () => holdModelPopoverOpen(3000));
      el.simpleHfSearchButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setSimpleSourceOption("huggingface", true);
        holdModelPopoverOpen(5000);
        if (el.hfSearchInput && el.simpleHfSearchInput) {
          el.hfSearchInput.value = el.simpleHfSearchInput.value;
        }
        searchHuggingFaceModels({ keepSimplePopover: true }).catch((error) => {
          if (error && error.name === "AbortError") {
            return;
          }
          setHfStatus(errorMessage(error), true);
          holdModelPopoverOpen(2500);
        });
        holdModelPopoverOpen(5000);
      });
    }
    if (el.simpleHfSearchInput) {
      el.simpleHfSearchInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        if (el.simpleHfSearchButton) {
          el.simpleHfSearchButton.click();
        }
      });
    }
    if (el.simpleHfP2pToggle) {
      el.simpleHfP2pToggle.addEventListener("change", () => {
        setHfP2pEnabled(el.simpleHfP2pToggle.checked);
        holdModelPopoverOpen(2000);
        if (state.p2pEnabled && state.hfLastAccepted && state.hfLastAccepted.length) {
          ensureDefaultCatalogForHfAvailability().then(() => {
            renderSimpleHfResults(state.hfLastAccepted);
          }).catch((error) => {
            setHfStatus(errorMessage(error), true);
          });
        }
      });
    }
    if (el.simpleOpenAdvancedDiscoveryButton) {
      el.simpleOpenAdvancedDiscoveryButton.addEventListener("click", () => {
        setAppMode("advanced");
        setRailCollapsed(false);
        const panelKey = state.simpleSourceOption === "huggingface"
          ? "advanced-discovery"
          : state.simpleSourceOption === "local"
            ? "advanced-local-import"
            : "advanced-catalog";
        const drawer = document.querySelector(`[data-panel-key="${panelKey}"]`);
        if (drawer) {
          drawer.open = true;
          drawer.scrollIntoView({ block: "nearest" });
        }
      });
    }
    document.querySelectorAll(".tab-button").forEach((button, index, buttons) => {
      button.addEventListener("click", () => setActiveTab(button.dataset.tab));
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = buttons[(index + direction + buttons.length) % buttons.length];
        next.focus();
        setActiveTab(next.dataset.tab);
      });
    });
    if (el.diagnosticsRailToggle) {
      el.diagnosticsRailToggle.addEventListener("click", () => {
        setRailCollapsed(!(el.appShell && el.appShell.dataset.railCollapsed === "true"));
      });
    }
    if (el.mobileAdvancedButton) {
      el.mobileAdvancedButton.addEventListener("click", () => {
        setRailCollapsed(false);
      });
    }
    if (el.clearConsoleButton) {
      el.clearConsoleButton.addEventListener("click", () => {
        if (el.console) {
          el.console.textContent = "";
        }
      });
    }
    if (el.copyConsoleButton) {
      el.copyConsoleButton.addEventListener("click", () => copyText(el.console ? el.console.textContent : ""));
    }
    if (el.pauseConsoleScroll) {
      el.pauseConsoleScroll.addEventListener("change", () => {
        state.consoleAutoScroll = !el.pauseConsoleScroll.checked;
        storageSet(uiStorageKeys.consolePaused, String(el.pauseConsoleScroll.checked));
      });
    }
    if (el.keepRunHistoryToggle) {
      el.keepRunHistoryToggle.addEventListener("change", () => {
        storageSet(uiStorageKeys.keepRunHistory, String(el.keepRunHistoryToggle.checked));
        persistRunHistory();
      });
    }
    if (el.clearRunHistoryButton) {
      el.clearRunHistoryButton.addEventListener("click", () => {
        state.runHistory = [];
        storageRemove(uiStorageKeys.runHistory);
        renderRunHistory();
      });
    }
    if (el.runHistoryList) {
      el.runHistoryList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-run-action]");
        if (!button) {
          return;
        }
        const run = state.runHistory[Number.parseInt(button.dataset.runIndex, 10)];
        if (!run) {
          return;
        }
        if (button.dataset.runAction === "copy") {
          copyText(runSummaryText(run));
        } else if (button.dataset.runAction === "duplicate") {
          restoreRun(run, true);
        } else {
          restoreRun(run, false);
        }
      });
    }
  }

  function observeCopyableFields() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll("dd.copyable").forEach(ensureCopyButton);
    });
    document.querySelectorAll("dd.copyable").forEach((node) => {
      observer.observe(node, { childList: true, characterData: true, subtree: true });
      ensureCopyButton(node);
    });
  }

  function memory() {
    return new Uint8Array(state.exports.memory.buffer);
  }

  function readString(ptr, len) {
    return state.decoder.decode(memory().slice(ptr, ptr + len));
  }

  function readLastResult() {
    return readString(state.exports.last_result_ptr(), state.exports.last_result_len());
  }

  function readDiagnostics() {
    return readString(state.exports.get_diagnostics_ptr(), state.exports.get_diagnostics_len());
  }

  // Parses runtime diagnostics after adapter assembly so module-plan counters can be checked.
  function readDiagnosticsJson() {
    try {
      return JSON.parse(readDiagnostics());
    } catch (_error) {
      return null;
    }
  }

  function allocCopy(bytes) {
    const ptr = state.exports.alloc(bytes.length);
    if (!ptr) {
      throw new Error("WASM allocation failed");
    }
    memory().set(bytes, ptr);
    return ptr;
  }

  function release(ptr, len) {
    if (ptr) {
      state.exports.dealloc(ptr, len);
    }
  }

  function probeWasmHeapAllocation(byteCount) {
    // Proves the declared generated-module transfer floor before bytes enter WASM.
    const ptr = state.exports.alloc(byteCount);
    if (!ptr) {
      throw new Error("Module plan WASM heap allocation probe failed");
    }
    release(ptr, byteCount);
  }

  // Captures the static exported memory footprint before runtime init can grow it.
  function wasmMemoryInitialPages() {
    const pageBytes = 64 * 1024;
    const byteLength = state.exports.memory.buffer.byteLength;
    if (byteLength % pageBytes !== 0) {
      throw new Error("WASM memory byte length was not page aligned");
    }
    return byteLength / pageBytes;
  }

  // Checks the named Rust/WASM ABI before a generated module plan can fetch model bytes.
  function hasRuntimeWasmExport(name) {
    if (name === "memory") {
      return state.exports.memory && state.exports.memory.buffer instanceof ArrayBuffer;
    }
    return typeof state.exports[name] === "function";
  }

  function verifyModulePlanWasmExports(exportSet) {
    if (exportSet !== registryModulePlanWasmExportSet) {
      return false;
    }
    return registryModulePlanWasmExports.every((name) => hasRuntimeWasmExport(name));
  }

  function renderDiagnostics() {
    const diagnostics = readDiagnostics();
    el.diagnostics.textContent = diagnostics;
    el.developer.textContent = diagnostics;
    state.latestDiagnostics = latestDiagnosticsSnapshot();
    renderBenchmark(diagnostics);
  }

  function renderBenchmark(diagnosticsText) {
    let diagnostics = null;
    try {
      diagnostics = JSON.parse(diagnosticsText);
    } catch (_error) {
      diagnostics = null;
    }
    const promptTokens = diagnostics ? diagnostics.prompt_token_count : 0;
    const generatedTokens = diagnostics ? diagnostics.generated_token_count : 0;
    const scratchBytes = diagnostics ? diagnostics.peak_scratch_arena_usage : 0;
    const measuredTokens = state.lastMeasuredTokens > 0 ? state.lastMeasuredTokens : generatedTokens;
    const measuredSpeed = measuredTokens > 0 && state.lastGenerateMs > 0
      ? measuredTokens / (state.lastGenerateMs / 1000)
      : 0;
    const reportedSpeed = diagnostics ? diagnostics.tokens_per_second : 0;
    const speed = measuredSpeed || reportedSpeed || 0;
    el.benchLoadMs.textContent = state.modelLoadMs > 0 ? `${state.modelLoadMs} ms` : "waiting";
    el.benchPromptTokens.textContent = `${promptTokens} tokens`;
    el.benchGeneratedTokens.textContent = `${generatedTokens} tokens`;
    el.benchTokensPerSecond.textContent = `${speed.toFixed(3)} tok/s`;
    el.benchScratch.textContent = `${scratchBytes} bytes`;
    if (el.runSummary && state.runHistory.length === 0) {
      el.runSummary.textContent = generatedTokens > 0
        ? `${generatedTokens} tokens / ${speed.toFixed(3)} tok/s / ${scratchBytes} scratch bytes`
        : "No generation run yet.";
    }
  }

  function renderConversation() {
    el.conversation.replaceChildren();
    if (state.messages.length === 0) {
      const item = document.createElement("li");
      item.className = "empty-message";
      item.textContent = "No conversation yet. Import a verified local .slm file to run the first real prompt.";
      el.conversation.append(item);
      el.clearChatButton.disabled = true;
      return;
    }
    for (const message of state.messages) {
      const item = document.createElement("li");
      const avatar = document.createElement("div");
      const content = document.createElement("div");
      const role = document.createElement("div");
      const text = document.createElement("div");
      const time = document.createElement("time");
      item.className = `message message-${message.role}`;
      item.classList.toggle("error", Boolean(message.isError));
      avatar.className = message.role === "user" ? "message-avatar" : "assistant-avatar";
      avatar.textContent = message.role === "user" ? "You" : "";
      if (message.role !== "user") {
        const icon = document.createElementNS(svgNamespace, "svg");
        const use = document.createElementNS(svgNamespace, "use");
        use.setAttribute("href", "#icon-cube");
        icon.append(use);
        avatar.append(icon);
      }
      role.className = "message-role";
      text.className = "message-text";
      time.className = "message-time";
      role.textContent = message.role === "user" ? "You" : "TinyRustLM";
      text.textContent = message.text;
      time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      content.append(role, text);
      item.append(avatar, content, time);
      el.conversation.append(item);
    }
    el.clearChatButton.disabled = state.messages.length === 0;
    el.conversation.scrollTop = el.conversation.scrollHeight;
  }

  function appendMessage(role, text, isError) {
    state.messages.push({
      role,
      text,
      isError: Boolean(isError)
    });
    renderConversation();
  }

  function extendAssistantMessage(text) {
    if (!text) {
      return;
    }
    const last = state.messages[state.messages.length - 1];
    if (last && last.role === "assistant" && !last.isError) {
      last.text += text;
      renderConversation();
      return;
    }
    appendMessage("assistant", text, false);
  }

  function appendConsole(text) {
    el.console.textContent = el.console.textContent
      ? `${el.console.textContent}\n${text}`
      : text;
    if (state.consoleAutoScroll) {
      el.console.scrollTop = el.console.scrollHeight;
    }
  }

  function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  function clampInteger(value, min, max, fallback) {
    return Math.trunc(clampNumber(value, min, max, fallback));
  }

  function readSamplingConfig() {
    const config = {
      temperature: clampNumber(el.temperature.value, 0, 5, 0),
      topK: clampInteger(el.topK.value, 1, registryModulePlanSamplerCandidateCap, 1),
      topP: clampNumber(el.topP.value, 0.01, 1, 1),
      seed: clampInteger(el.seed.value, 0, 4294967295, 1)
    };
    el.temperature.value = String(config.temperature);
    el.topK.value = String(config.topK);
    el.topP.value = String(config.topP);
    el.seed.value = String(config.seed);
    syncRangeControls();
    return config;
  }

  function applySamplingConfig() {
    const config = readSamplingConfig();
    if (typeof state.exports.set_sampling_config !== "function") {
      throw new Error("WASM runtime does not expose sampling configuration");
    }
    const code = state.exports.set_sampling_config(
      config.temperature,
      config.topK,
      config.topP,
      config.seed
    );
    if (code !== 0) {
      throw new Error(readLastResult() || `sampling configuration failed (${code})`);
    }
    return config;
  }

  function parseManifest(text) {
    const fields = Object.create(null);
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      fields[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
    }
    return fields;
  }

  async function fetchTextWithinBudget(route, byteBudget, label, allowMissing) {
    const response = await fetch(route, localFetchOptions);
    if (!response.ok) {
      if (allowMissing) {
        return null;
      }
      throw new Error(`Unable to fetch local ${label} (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > byteBudget) {
      throw new Error(`${label} byte budget exceeded`);
    }
    return state.decoder.decode(bytes);
  }

  // Clears generated self-assembly route observations for a new model load.
  function resetModulePlanActualFetchCount(model) {
    const hasModulePlan = Boolean(model && model.modulePlan);
    state.modulePlanActualFetchCount = hasModulePlan ? 0 : null;
    state.modulePlanActualRoutes = hasModulePlan ? [] : null;
    state.modulePlanActualRouteSetChecksum = null;
    state.modulePlanActualModuleBytes = hasModulePlan ? 0 : null;
    state.modulePlanActualModuleByteIndexes = hasModulePlan ? [] : null;
    state.modulePlanActualModuleChecksums = hasModulePlan ? [] : null;
    const fields = model && model.modulePlanReceipt;
    updateModulePlanActualFetchCount(fields);
    updateModulePlanActualRouteSetChecksum(fields);
    updateModulePlanActualModuleBytes(fields);
    updateModulePlanActualModuleChecksums(fields);
  }

  // Records one accepted generated self-assembly route fetch and its route-set entry.
  function recordModulePlanFetch(model, kind, route) {
    if (!model || !model.modulePlan) {
      return;
    }
    if (!kind || !route) {
      throw new Error("Module plan actual route metadata missing");
    }
    if (!Number.isInteger(state.modulePlanActualFetchCount)) {
      state.modulePlanActualFetchCount = 0;
    }
    if (!Array.isArray(state.modulePlanActualRoutes)) {
      state.modulePlanActualRoutes = [];
    }
    state.modulePlanActualFetchCount += 1;
    state.modulePlanActualRoutes.push({ kind, path: route });
    state.modulePlanActualRouteSetChecksum = modulePlanRouteSetChecksum(state.modulePlanActualRoutes);
    const fields = model.modulePlanReceipt || state.modulePlanReceipt;
    updateModulePlanActualFetchCount(fields);
    updateModulePlanActualRouteSetChecksum(fields);
  }

  // Fetches receipt/manifest/evidence text while counting generated module-plan routes.
  async function fetchModulePlanTextWithinBudget(model, route, byteBudget, label, kind) {
    const text = await fetchTextWithinBudget(route, byteBudget, label);
    recordModulePlanFetch(model, kind, route);
    return text;
  }

  // Fetches binary generated model or adapter artifacts while counting module-plan routes.
  async function fetchModulePlanBytes(model, route, label, kind) {
    const response = await fetch(route, localFetchOptions);
    if (!response.ok) {
      throw new Error(`Unable to fetch local ${label} (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    recordModulePlanFetch(model, kind, route);
    return bytes;
  }

  // Updates only the Actual Fetches row during an in-flight generated assembly.
  function updateModulePlanActualFetchCount(fields) {
    if (el.modulePlanActualFetchCount) {
      el.modulePlanActualFetchCount.textContent = modulePlanActualFetchSummary(fields);
    }
  }

  // Updates only the Actual Route Set row while the observed route list grows.
  function updateModulePlanActualRouteSetChecksum(fields) {
    if (el.modulePlanActualRouteSetChecksum) {
      el.modulePlanActualRouteSetChecksum.textContent = modulePlanActualRouteSetSummary(fields);
    }
  }

  // Updates the observed module-byte total without disturbing receipt-owned byte rows.
  function updateModulePlanActualModuleBytes(fields) {
    if (el.modulePlanActualModuleBytes) {
      el.modulePlanActualModuleBytes.textContent = modulePlanActualModuleByteSummary(fields);
    }
  }

  // Updates the observed module-checksum row as each verified module payload arrives.
  function updateModulePlanActualModuleChecksums(fields) {
    if (el.modulePlanActualModuleChecksums) {
      el.modulePlanActualModuleChecksums.textContent = modulePlanActualModuleChecksumSummary(fields);
    }
  }

  function manifestValue(fields, key) {
    return fields && fields[key] ? fields[key] : "unavailable";
  }

  // Renders selector entries while allowing registry boot to prefer its declared default.
  function renderModelOptions(models, preferDeclaredDefault, selectedOverride) {
    const selected = selectedOverride || (preferDeclaredDefault ? "" : el.modelSelect.value);
    el.modelSelect.replaceChildren();
    let firstKey = "";
    for (const key of Object.keys(models)) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = models[key].label || key;
      el.modelSelect.append(option);
      if (!firstKey) {
        firstKey = key;
      }
    }
    if (!firstKey) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Choose a local .slm file";
      option.disabled = true;
      option.selected = true;
      el.modelSelect.append(option);
      return;
    }
    const defaultKey = state.selectorDefaultModelKey;
    el.modelSelect.value = models[selected] ? selected : (models[defaultKey] ? defaultKey : firstKey);
    updateModelSummary();
  }

  function isPublicLocalOnlyHost() {
    return publicLocalOnlyHosts.has(window.location.hostname.toLowerCase());
  }

  function modelsWithoutLocalModel(models) {
    const result = Object.create(null);
    for (const key of Object.keys(models || {})) {
      if (key !== localModelKey) {
        result[key] = models[key];
      }
    }
    return result;
  }

  function modelsWithLocalModel(models) {
    const result = isPublicLocalOnlyHost() ? Object.create(null) : modelsWithoutLocalModel(models);
    if (state.localModel) {
      result[localModelKey] = state.localModel;
    }
    return result;
  }

  // Restores the built-in model menu when optional selector registry intake finds no accepted entries.
  function restoreStaticModelOptions() {
    paths.models = modelsWithLocalModel(staticModels);
    state.selectorRegistry = null;
    state.selectorDefaultModelKey = "";
    renderModelOptions(paths.models, false);
  }

  function formatByteCount(bytes) {
    if (!Number.isFinite(bytes)) {
      return "unknown bytes";
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KiB`;
    }
    return `${bytes} bytes`;
  }

  function safeLocalModelName(name) {
    const cleaned = String(name || "local-model.slm")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return (cleaned || "local-model.slm").slice(0, 96);
  }

  function elementWithText(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    node.textContent = text;
    return node;
  }

  function actionButton(label, onClick, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) {
      button.className = className;
    }
    button.addEventListener("click", onClick);
    return button;
  }

  function appendActionIfPresent(parent, action) {
    if (action) {
      parent.append(action);
    }
  }

  function externalActionLink(label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function modelResultItem(titleText) {
    const item = document.createElement("li");
    item.className = "model-result";
    item.append(elementWithText("strong", "", titleText));
    return item;
  }

  function simpleLocalStatusText(text, isError) {
    const value = String(text || "");
    const lower = value.toLowerCase();
    if (isError) {
      return friendlyError(value);
    }
    if (lower.includes("selected")) {
      return "Local file selected. Click Import Selected .slm to validate it.";
    }
    if (lower.includes("reading")) {
      return "Reading local model file.";
    }
    if (lower.includes("choose")) {
      return "Choose a trusted local .slm file from this computer.";
    }
    if (lower.includes("0x")) {
      return "Local model imported and verified. You can generate now.";
    }
    if (lower.includes("sha256")) {
      return "Metadata selected. Choose the matching local .slm file, then import it.";
    }
    return value || "Waiting for a local model file.";
  }

  function setLocalModelStatus(text, isError) {
    if (el.localModelState) {
      setText(el.localModelState, text, isError);
    }
    if (el.simpleDiscoveryStatus && el.simpleDiscoveryPanel && !el.simpleDiscoveryPanel.hidden) {
      el.simpleDiscoveryStatus.textContent = simpleLocalStatusText(text, isError);
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
    if (String(text || "").toLowerCase().includes("loading") || String(text || "").toLowerCase().includes("import")) {
      updateSystemStatus("Importing local model", isError);
    }
  }

  function setCatalogStatus(text, isError) {
    if (el.catalogStatus) {
      setText(el.catalogStatus, text, isError);
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = text;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
    if (String(text || "").toLowerCase().includes("loading") || String(text || "").toLowerCase().includes("metadata")) {
      updateSystemStatus("Fetching catalog", isError);
    }
  }

  function clearCatalogResults() {
    if (el.catalogResults) {
      el.catalogResults.replaceChildren();
    }
    if (el.simpleCatalogResults) {
      el.simpleCatalogResults.replaceChildren();
    }
  }

  function catalogText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function catalogInteger(value) {
    if (typeof value === "number" && Number.isSafeInteger(value)) {
      return value;
    }
    const text = catalogText(value);
    if (!/^[0-9]+$/.test(text)) {
      return null;
    }
    const parsed = Number.parseInt(text, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  function isCatalogModelId(value) {
    return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,179}$/.test(value || "");
  }

  function isCatalogSha256(value) {
    return /^sha256:[0-9a-f]{64}$/i.test(value || "");
  }

  function normalizeCatalogSha256(value) {
    const text = catalogText(value).toLowerCase();
    return isCatalogSha256(text) ? text : "";
  }

  function catalogRouteUrl(entry, route) {
    const text = catalogText(route);
    if (!text || text.includes("\n") || text.includes("\r")) {
      return "";
    }
    try {
      return new URL(text, entry.catalogBaseUrl || window.location.href).toString();
    } catch (_error) {
      return "";
    }
  }

  function catalogMetadataRouteUrl(route, catalogBaseUrl, label) {
    const text = catalogText(route);
    if (!text || text.includes("\n") || text.includes("\r")) {
      throw new Error(`${label} route was invalid`);
    }
    if (!catalogBaseUrl) {
      throw new Error(`${label} needs a catalog URL before route resolution`);
    }
    let catalogUrl;
    let routeUrl;
    try {
      catalogUrl = new URL(catalogBaseUrl, window.location.href);
      routeUrl = new URL(text, catalogUrl);
    } catch (_error) {
      throw new Error(`${label} route URL was invalid`);
    }
    if (routeUrl.protocol !== "https:" && routeUrl.protocol !== "http:") {
      throw new Error(`${label} route must use HTTP or HTTPS`);
    }
    if (routeUrl.origin !== catalogUrl.origin) {
      throw new Error(`${label} route must stay on the catalog origin`);
    }
    return routeUrl.toString();
  }

  function assertMetadataOnlyCatalogBoundary(raw, label) {
    if (raw && raw.project_server_serves_model_bytes === true) {
      throw new Error(`${label} declares server-served model bytes`);
    }
    if (raw && raw.project_server_runs_model_bytes === true) {
      throw new Error(`${label} declares server-side model execution`);
    }
    if (catalogText(raw && raw.artifact_project_server_url)) {
      throw new Error(`${label} declares a project-server model URL`);
    }
  }

  function catalogPeerSourcesFromRaw(raw, label) {
    const rawSources = Array.isArray(raw && raw.peer_sources) ? raw.peer_sources : [];
    const declaredCount = catalogInteger(raw && raw.peer_source_count);
    if (declaredCount !== null && declaredCount !== rawSources.length) {
      throw new Error(`${label} peer source count did not match peer_sources`);
    }
    if (rawSources.length > 8) {
      throw new Error(`${label} listed more than 8 peer sources`);
    }
    return rawSources.map((source, index) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        throw new Error(`${label} peer source ${index + 1} was not an object`);
      }
      assertMetadataOnlyCatalogBoundary(source, `${label} peer source ${index + 1}`);
      const peerBaseUrl = normalizedPeerBaseUrl(source.peer_base_url);
      const sourceKind = catalogText(source.source_kind || source.kind);
      const transport = catalogText(source.transport);
      const consentStatus = catalogText(source.consent_status);
      if (sourceKind && sourceKind !== "known-direct-http-peer-v0") {
        throw new Error(`${label} peer source ${index + 1} kind was unsupported`);
      }
      if (transport && transport !== "direct-http-piece-server-v0") {
        throw new Error(`${label} peer source ${index + 1} transport was unsupported`);
      }
      if (consentStatus && consentStatus !== "publisher-declared-consenting-peer") {
        throw new Error(`${label} peer source ${index + 1} consent status was unsupported`);
      }
      return {
        sourceKind: sourceKind || "known-direct-http-peer-v0",
        transport: transport || "direct-http-piece-server-v0",
        peerBaseUrl,
        consentStatus: consentStatus || "publisher-declared-consenting-peer"
      };
    });
  }

  function catalogEntryFromRaw(raw, index, catalogBaseUrl) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Catalog entry ${index + 1} was not an object`);
    }
    assertMetadataOnlyCatalogBoundary(raw, `Catalog entry ${index + 1}`);
    const modelId = catalogText(raw.model_id || raw.id);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`Catalog entry ${index + 1} model id was invalid`);
    }
    const artifactKind = catalogText(raw.artifact_kind || raw.kind).toLowerCase();
    if (artifactKind !== "slm") {
      throw new Error(`Catalog entry ${modelId} was not an .slm artifact`);
    }
    const artifactByteCount = catalogInteger(raw.artifact_byte_count || raw.artifact_bytes);
    if (!artifactByteCount || artifactByteCount > localModelMaxBytes) {
      throw new Error(`Catalog entry ${modelId} byte count was invalid`);
    }
    const artifactSha256 = normalizeCatalogSha256(raw.artifact_sha256 || raw.sha256);
    if (!artifactSha256) {
      throw new Error(`Catalog entry ${modelId} SHA-256 was invalid`);
    }
    const displayName = (catalogText(raw.display_name || raw.name) || modelId).slice(0, 96);
    const maxTokens = catalogInteger(raw.max_tokens);
    const fileNameHint = safeLocalModelName(
      raw.local_file_name_hint ||
      raw.artifact_file_name ||
      `${modelId.split("/").pop()}.slm`
    );
    const peerSources = catalogPeerSourcesFromRaw(raw, `Catalog entry ${modelId}`);
    return {
      raw,
      catalogBaseUrl,
      modelId,
      displayName,
      publisherId: catalogText(raw.publisher_id || raw.source_identity || raw.source_id),
      publisherKeyId: catalogText(raw.publisher_key_id || raw.publisher_key || raw.key_id),
      artifactKind,
      artifactByteCount,
      artifactSha256,
      slmChecksum: catalogText(raw.slm_checksum),
      modelShape: catalogText(raw.slm_model_shape || raw.model_shape),
      quantization: catalogText(raw.slm_quantization || raw.quantization),
      tokenizerChecksum: catalogText(raw.slm_tokenizer_checksum || raw.tokenizer_checksum),
      configChecksum: catalogText(raw.slm_config_checksum || raw.config_checksum),
      sourceKind: catalogText(raw.source_kind) || "catalog-local-file",
      sourceIdentity: catalogText(raw.source_identity || raw.source_id),
      sourceModelId: catalogText(raw.source_model_id || raw.upstream_model_id || raw.upstream_source_id),
      sourceHuggingFaceModelId: catalogText(raw.source_huggingface_model_id || raw.huggingface_model_id || raw.hf_model_id),
      sourceUrl: catalogText(raw.source_url || raw.huggingface_url || raw.upstream_url),
      peerHintStatus: catalogText(raw.peer_hint_status || raw.p2p_status || raw.transfer_status) || "disabled",
      peerImportStatus: catalogText(raw.peer_import_status || raw.peer_transfer_status || raw.import_status),
      peerOfferRoute: catalogText(raw.peer_offer_route || raw.peer_offer_path),
      peerOfferSha256: normalizeCatalogSha256(raw.peer_offer_sha256 || raw.peer_offer_checksum),
      peerOfferChunkCount: catalogInteger(raw.peer_offer_chunk_count),
      peerOfferMerkleRootSha256: normalizeCatalogSha256(raw.peer_offer_merkle_root_sha256 || raw.merkle_root_sha256),
      peerSources,
      licenseRoute: catalogText(raw.license_route),
      modelCardRoute: catalogText(raw.model_card_route),
      manifestRoute: catalogText(raw.manifest_route),
      evidenceRoute: catalogText(raw.evidence_admission_route || raw.admission_route || raw.eval_route),
      admissionStatus: catalogText(raw.evidence_admission_status || raw.admission_status) || "catalog-metadata-only",
      qualityClaim: catalogText(raw.quality_claim) || "not-endorsed-by-project",
      trainedQualityClaim: catalogText(raw.trained_quality_claim) || "not-claimed",
      requiredNextGate: catalogText(raw.required_next_gate) || "user-local-file-import",
      fileNameHint,
      maxTokens: maxTokens && maxTokens > 0 && maxTokens <= 512 ? maxTokens : 16
    };
  }

  function catalogPeerStateText(entry) {
    if (!entry.peerOfferRoute) {
      return entry.peerHintStatus && entry.peerHintStatus !== "disabled"
        ? entry.peerHintStatus
        : "local file required";
    }
    const sourceState = entry.peerSources.length
      ? "catalog peer listed"
      : entry.peerImportStatus || "known peer URL required";
    return `peer proof ready / ${entry.peerOfferChunkCount || "chunk count unknown"} chunks / ${sourceState}`;
  }

  function simpleCatalogPeerStateText(entry) {
    if (!entry.peerOfferRoute) {
      return entry.sourceKind || "verified source pending";
    }
    return entry.peerSources.length
      ? "P2P proof ready / catalog peer listed"
      : `P2P proof ready / ${entry.peerImportStatus || "known peer URL required"}`;
  }

  function appendCatalogRouteLinks(actions, entry, routes) {
    for (const [label, route] of routes) {
      const href = catalogRouteUrl(entry, route);
      if (!href) {
        continue;
      }
      actions.append(externalActionLink(label, href));
    }
  }

  function catalogEntriesFromBody(body, sourceLabel, catalogBaseUrl) {
    if (!body || typeof body !== "object") {
      throw new Error(`${sourceLabel} was not a JSON object`);
    }
    assertMetadataOnlyCatalogBoundary(body, sourceLabel);
    const rawEntries = Array.isArray(body) ? body : Array.isArray(body.entries) ? body.entries : [body];
    if (rawEntries.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed more than ${catalogMaxEntries} models`);
    }
    const entries = rawEntries.map((entry, index) => catalogEntryFromRaw(entry, index, catalogBaseUrl));
    if (!entries.length) {
      throw new Error(`${sourceLabel} did not list any models`);
    }
    return entries;
  }

  function catalogAnnouncementRouteFromRaw(raw, index, catalogBaseUrl) {
    const label = `Catalog peer-source announcement route ${index + 1}`;
    let route = "";
    let sha256 = "";
    if (typeof raw === "string") {
      route = raw;
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      route = raw.route || raw.announcement_route || raw.url || raw.href;
      sha256 = normalizeCatalogSha256(
        raw.sha256 ||
        raw.checksum_sha256 ||
        raw.announcement_sha256 ||
        raw.peer_source_announcement_sha256
      );
    } else {
      throw new Error(`${label} was not a string or object`);
    }
    if (!sha256) {
      throw new Error(`${label} must include a SHA-256 checksum`);
    }
    return {
      route: catalogText(route),
      url: catalogMetadataRouteUrl(route, catalogBaseUrl, label),
      sha256
    };
  }

  function catalogAnnouncementRoutesFromBody(body, catalogBaseUrl) {
    if (!body || typeof body !== "object" || Array.isArray(body) || !catalogBaseUrl) {
      return [];
    }
    const rawRoutes = [];
    if (body.peer_source_announcement_route) {
      rawRoutes.push({
        route: body.peer_source_announcement_route,
        sha256: body.peer_source_announcement_sha256 || body.peer_source_announcement_checksum_sha256
      });
    }
    if (Array.isArray(body.peer_source_announcement_routes)) {
      rawRoutes.push(...body.peer_source_announcement_routes);
    }
    if (Array.isArray(body.peer_source_announcement_feeds)) {
      rawRoutes.push(...body.peer_source_announcement_feeds);
    }
    if (rawRoutes.length > catalogMaxAnnouncementRoutes) {
      throw new Error(`Catalog listed more than ${catalogMaxAnnouncementRoutes} peer-source announcement routes`);
    }
    return rawRoutes.map((route, index) => catalogAnnouncementRouteFromRaw(route, index, catalogBaseUrl));
  }

  function renderCatalogResults(entries) {
    clearCatalogResults();
    for (const entry of entries) {
      const item = document.createElement("li");
      item.className = "model-result";
      const title = document.createElement("strong");
      title.textContent = entry.displayName;
      const meta = document.createElement("div");
      meta.className = "model-result-meta";
      meta.textContent = [
        entry.modelId,
        formatByteCount(entry.artifactByteCount),
        entry.artifactSha256,
        entry.quantization || "quantization unavailable",
        catalogPeerStateText(entry)
      ].join(" / ");
      const actions = document.createElement("div");
      actions.className = "model-result-actions";
      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.textContent = "Select";
      selectButton.addEventListener("click", function () {
        selectCatalogEntry(entry);
      });
      actions.append(selectButton);
      appendActionIfPresent(actions, p2pCatalogActionButton(entry));
      appendCatalogRouteLinks(actions, entry, [["Manifest", entry.manifestRoute], ["Model Card", entry.modelCardRoute], ["License", entry.licenseRoute]]);
      item.append(title, meta, actions);
      el.catalogResults.append(item);
    }
    renderSimpleCatalogResults(entries);
  }

  function renderSimpleCatalogResults(entries) {
    if (!el.simpleCatalogResults) {
      return;
    }
    el.simpleCatalogResults.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement("li");
      item.className = "model-result";
      const title = document.createElement("strong");
      title.textContent = entry.displayName;
      const meta = document.createElement("div");
      meta.className = "model-result-meta";
      meta.textContent = [
        "MiniModel metadata",
        formatByteCount(entry.artifactByteCount),
        simpleCatalogPeerStateText(entry)
      ].filter(Boolean).join(" / ");
      const actions = document.createElement("div");
      actions.className = "model-result-actions";
      appendActionIfPresent(actions, p2pCatalogActionButton(entry));
      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.textContent = "Use Metadata";
      selectButton.addEventListener("click", function () {
        selectCatalogEntry(entry);
      });
      actions.append(selectButton);
      appendCatalogRouteLinks(actions, entry, [["Model Card", entry.modelCardRoute], ["License", entry.licenseRoute], ["Manifest", entry.manifestRoute]]);
      item.append(title, meta, actions);
      el.simpleCatalogResults.append(item);
    }
  }

  function selectCatalogEntry(entry) {
    state.selectedCatalogEntry = entry;
    setCatalogStatus(`${entry.displayName} selected`, false);
    setLocalModelStatus(
      `${entry.fileNameHint} / ${formatByteCount(entry.artifactByteCount)} / ${entry.artifactSha256}`,
      false
    );
    if (el.localModelFile) {
      el.localModelFile.value = "";
      el.localModelFile.focus();
    }
  }

  async function loadCatalogFromUrl() {
    const rawUrl = catalogText(el.catalogUrlInput && el.catalogUrlInput.value);
    if (!rawUrl) {
      throw new Error("Enter a catalog URL");
    }
    let url = null;
    try {
      url = new URL(rawUrl, window.location.href);
    } catch (_error) {
      throw new Error("Catalog URL was invalid");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Catalog URL must use HTTP or HTTPS");
    }
    if (state.catalogFetchAbort) {
      state.catalogFetchAbort.abort();
    }
    clearCatalogResults();
    setCatalogStatus("loading metadata", false);
    const controller = new AbortController();
    state.catalogFetchAbort = controller;
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Catalog request failed (${response.status})`);
    }
    const text = await response.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Catalog metadata exceeded browser budget");
    }
    const body = JSON.parse(text);
    const entries = catalogEntriesFromBody(body, url.hostname, url.toString());
    const announcementRoutes = catalogAnnouncementRoutesFromBody(body, url.toString());
    state.catalogEntries = entries;
    state.defaultCatalogCheckedForAvailability = rawUrl === defaultCatalogUrl;
    renderCatalogResults(entries);
    if (announcementRoutes.length) {
      const routeResult = await applyCatalogAnnouncementRoutes(announcementRoutes, controller.signal);
      const appliedText = `${routeResult.appliedCount} peer-source announcement${routeResult.appliedCount === 1 ? "" : "s"} applied`;
      const duplicateText = routeResult.duplicateCount
        ? `; ${routeResult.duplicateCount} duplicate${routeResult.duplicateCount === 1 ? "" : "s"} already loaded`
        : "";
      setCatalogStatus(`${entries.length} metadata entries; ${appliedText}${duplicateText}`, false);
      return;
    }
    setCatalogStatus(`${entries.length} metadata entries`, false);
  }

  async function importLocalCatalogFile() {
    const file = el.localCatalogFile && el.localCatalogFile.files ? el.localCatalogFile.files[0] : null;
    if (!file) {
      throw new Error("Choose a local models.v0.json catalog snapshot");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Local catalog snapshot is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Local catalog snapshot exceeded browser budget");
    }
    clearCatalogResults();
    const fileName = safeLocalModelName(file.name);
    setCatalogStatus(`reading local metadata snapshot ${fileName}`, false);
    const text = await file.text();
    const body = JSON.parse(text);
    const entries = catalogEntriesFromBody(body, fileName, "");
    state.catalogEntries = entries;
    state.defaultCatalogCheckedForAvailability = false;
    renderCatalogResults(entries);
    setCatalogStatus(`${entries.length} local MiniModel metadata entries from ${fileName}`, false);
  }

  function catalogPeerSourceRaw(source) {
    return {
      source_kind: source.sourceKind || "known-direct-http-peer-v0",
      transport: source.transport || "direct-http-piece-server-v0",
      peer_base_url: source.peerBaseUrl,
      consent_status: source.consentStatus || "publisher-declared-consenting-peer",
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false
    };
  }

  function catalogPeerSourceKey(source) {
    return [
      source.sourceKind || "known-direct-http-peer-v0",
      source.transport || "direct-http-piece-server-v0",
      source.peerBaseUrl || "",
      source.consentStatus || "publisher-declared-consenting-peer"
    ].join("|");
  }

  function peerSourceAnnouncementFromRaw(raw, index) {
    const label = `Peer-source announcement ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} was not a JSON object`);
    }
    assertMetadataOnlyCatalogBoundary(raw, label);
    if (raw.project_server_proxies_model_bytes === true) {
      throw new Error(`${label} declares project-server model-byte proxying`);
    }
    if (catalogInteger(raw.announcement_version) !== 0) {
      throw new Error(`${label} version was unsupported`);
    }
    if (catalogText(raw.announcement_kind) !== "minimodel.peer_source_announcement") {
      throw new Error(`${label} kind was unsupported`);
    }
    if (catalogText(raw.announcement_status) !== "peer-source-available-metadata-only") {
      throw new Error(`${label} status was unsupported`);
    }
    if (catalogText(raw.artifact_kind).toLowerCase() !== "slm") {
      throw new Error(`${label} was not for an .slm artifact`);
    }
    const modelId = catalogText(raw.model_id);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label} model id was invalid`);
    }
    const artifactByteCount = catalogInteger(raw.artifact_byte_count);
    if (!artifactByteCount || artifactByteCount > localModelMaxBytes) {
      throw new Error(`${label} byte count was invalid`);
    }
    const artifactSha256 = normalizeCatalogSha256(raw.artifact_sha256);
    const peerOfferSha256 = normalizeCatalogSha256(raw.peer_offer_sha256);
    const peerOfferMerkleRootSha256 = normalizeCatalogSha256(raw.peer_offer_merkle_root_sha256);
    const catalogEntrySha256 = normalizeCatalogSha256(raw.catalog_entry_sha256);
    if (!artifactSha256 || !peerOfferSha256 || !peerOfferMerkleRootSha256 || !catalogEntrySha256) {
      throw new Error(`${label} checksums were invalid`);
    }
    const peerOfferRoute = catalogText(raw.peer_offer_route);
    if (!peerOfferRoute || peerOfferRoute.includes("\n") || peerOfferRoute.includes("\r")) {
      throw new Error(`${label} peer offer route was invalid`);
    }
    const peerOfferChunkCount = catalogInteger(raw.peer_offer_chunk_count);
    if (!peerOfferChunkCount || peerOfferChunkCount < 1) {
      throw new Error(`${label} peer offer chunk count was invalid`);
    }
    const peerSources = catalogPeerSourcesFromRaw(
      { peer_source_count: 1, peer_sources: [raw.peer_source] },
      label
    );
    if (!peerSources[0] || !peerSources[0].peerBaseUrl) {
      throw new Error(`${label} did not name a consenting peer URL`);
    }
    return {
      raw,
      modelId,
      artifactByteCount,
      artifactSha256,
      peerOfferSha256,
      peerOfferMerkleRootSha256,
      peerOfferRoute,
      peerOfferChunkCount,
      catalogEntrySha256,
      peerSource: peerSources[0]
    };
  }

  function peerSourceAnnouncementsFromBody(body, sourceLabel) {
    const rawAnnouncements = Array.isArray(body)
      ? body
      : Array.isArray(body && body.announcements)
        ? body.announcements
        : [body];
    if (rawAnnouncements.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed too many peer-source announcements`);
    }
    const announcements = rawAnnouncements.map((announcement, index) => (
      peerSourceAnnouncementFromRaw(announcement, index)
    ));
    if (!announcements.length) {
      throw new Error(`${sourceLabel} did not list any peer-source announcements`);
    }
    return announcements;
  }

  function assertPeerAnnouncementMatchesEntry(entry, announcement) {
    if (entry.artifactByteCount !== announcement.artifactByteCount) {
      throw new Error(`${announcement.modelId} peer-source announcement byte count did not match catalog metadata`);
    }
    if (entry.artifactSha256 !== announcement.artifactSha256) {
      throw new Error(`${announcement.modelId} peer-source announcement artifact checksum did not match catalog metadata`);
    }
    if (!entry.peerOfferRoute || entry.peerOfferRoute !== announcement.peerOfferRoute) {
      throw new Error(`${announcement.modelId} peer-source announcement peer-offer route did not match catalog metadata`);
    }
    if (entry.peerOfferSha256 !== announcement.peerOfferSha256) {
      throw new Error(`${announcement.modelId} peer-source announcement peer-offer checksum did not match catalog metadata`);
    }
    if (entry.peerOfferMerkleRootSha256 !== announcement.peerOfferMerkleRootSha256) {
      throw new Error(`${announcement.modelId} peer-source announcement Merkle root did not match catalog metadata`);
    }
    if (entry.peerOfferChunkCount !== announcement.peerOfferChunkCount) {
      throw new Error(`${announcement.modelId} peer-source announcement chunk count did not match catalog metadata`);
    }
  }

  function applyPeerSourceAnnouncements(announcements) {
    if (!state.catalogEntries.length) {
      throw new Error("Load MiniModel metadata or a local models.v0.json before applying peer-source announcements.");
    }
    const catalogByModelId = new Map();
    for (const entry of state.catalogEntries) {
      if (!catalogByModelId.has(entry.modelId)) {
        catalogByModelId.set(entry.modelId, entry);
      }
    }
    for (const announcement of announcements) {
      const entry = catalogByModelId.get(announcement.modelId);
      if (!entry) {
        throw new Error(`${announcement.modelId} did not match any loaded MiniModel metadata entry`);
      }
      assertPeerAnnouncementMatchesEntry(entry, announcement);
    }

    const announcementsByModelId = new Map();
    for (const announcement of announcements) {
      const list = announcementsByModelId.get(announcement.modelId) || [];
      list.push(announcement);
      announcementsByModelId.set(announcement.modelId, list);
    }

    let appliedCount = 0;
    let duplicateCount = 0;
    const nextEntries = state.catalogEntries.map((entry) => {
      const modelAnnouncements = announcementsByModelId.get(entry.modelId) || [];
      if (!modelAnnouncements.length) {
        return entry;
      }
      const peerSources = entry.peerSources.slice();
      const seen = new Set(peerSources.map(catalogPeerSourceKey));
      for (const announcement of modelAnnouncements) {
        const key = catalogPeerSourceKey(announcement.peerSource);
        if (seen.has(key)) {
          duplicateCount += 1;
          continue;
        }
        seen.add(key);
        peerSources.push(announcement.peerSource);
        appliedCount += 1;
      }
      if (peerSources.length === entry.peerSources.length) {
        return entry;
      }
      const rawPeerSources = peerSources.map(catalogPeerSourceRaw);
      return {
        ...entry,
        raw: {
          ...entry.raw,
          peer_source_count: rawPeerSources.length,
          peer_sources: rawPeerSources
        },
        peerSources,
        peerImportStatus: entry.peerImportStatus || "request-script-ready",
        peerHintStatus: entry.peerHintStatus === "disabled"
          ? "peer-source-available-metadata-only"
          : entry.peerHintStatus
      };
    });
    if (!appliedCount && !duplicateCount) {
      throw new Error("No peer-source announcements were applied.");
    }
    const selectedModelId = state.selectedCatalogEntry && state.selectedCatalogEntry.modelId;
    state.catalogEntries = nextEntries;
    if (selectedModelId) {
      state.selectedCatalogEntry = nextEntries.find((entry) => entry.modelId === selectedModelId) || state.selectedCatalogEntry;
    }
    renderCatalogResults(nextEntries);
    refreshHfResultsForCatalogChange();
    return { appliedCount, duplicateCount };
  }

  function selectedPeerAnnouncementFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerAnnouncementFile && el.peerAnnouncementFile.files && el.peerAnnouncementFile.files[0]) {
      return el.peerAnnouncementFile.files[0];
    }
    if (el.simplePeerAnnouncementFile && el.simplePeerAnnouncementFile.files && el.simplePeerAnnouncementFile.files[0]) {
      return el.simplePeerAnnouncementFile.files[0];
    }
    return null;
  }

  async function applyPeerSourceAnnouncementFile(preferredInput) {
    const file = selectedPeerAnnouncementFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer-source announcement JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer-source announcement file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer-source announcement exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setCatalogStatus(`reading peer-source announcement ${fileName}`, false);
    const text = await file.text();
    const body = JSON.parse(text);
    const announcements = peerSourceAnnouncementsFromBody(body, fileName);
    const result = applyPeerSourceAnnouncements(announcements);
    const appliedText = `${result.appliedCount} peer-source announcement${result.appliedCount === 1 ? "" : "s"} applied`;
    const duplicateText = result.duplicateCount
      ? `; ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? "" : "s"} already loaded`
      : "";
    setCatalogStatus(`${appliedText}${duplicateText} from ${fileName}`, false);
  }

  async function applyCatalogAnnouncementRoutes(routes, signal) {
    let appliedCount = 0;
    let duplicateCount = 0;
    for (const route of routes) {
      const response = await fetch(route.url, {
        cache: "no-store",
        credentials: "omit",
        signal
      });
      if (!response.ok) {
        throw new Error(`Peer-source announcement request failed (${response.status})`);
      }
      const text = await response.text();
      if (state.encoder.encode(text).length > catalogTextByteBudget) {
        throw new Error("Peer-source announcement metadata exceeded browser budget");
      }
      const actualSha256 = await sha256Text(text);
      if (actualSha256 !== route.sha256) {
        throw new Error("Peer-source announcement checksum did not match catalog metadata");
      }
      const body = JSON.parse(text);
      const announcements = peerSourceAnnouncementsFromBody(body, route.url);
      const result = applyPeerSourceAnnouncements(announcements);
      appliedCount += result.appliedCount;
      duplicateCount += result.duplicateCount;
    }
    return { routeCount: routes.length, appliedCount, duplicateCount };
  }

  const peerShareChunkBytes = 1024 * 1024;

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  function hexToBytes(hex) {
    const clean = String(hex || "").replace(/^sha256:/i, "");
    if (!/^[0-9a-f]{64}$/i.test(clean)) {
      throw new Error("SHA-256 hex was invalid");
    }
    const bytes = new Uint8Array(32);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  async function sha256Raw(bytes) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Browser SHA-256 verification is unavailable");
    }
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(digest);
  }

  async function sha256Hex(bytes) {
    return `sha256:${bytesToHex(await sha256Raw(bytes))}`;
  }

  async function sha256Text(text) {
    return sha256Hex(state.encoder.encode(String(text || "")));
  }

  async function chunkSha256List(bytes, chunkSize) {
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      chunks.push({
        index: chunks.length,
        offset,
        byte_count: chunk.length,
        sha256: await sha256Hex(chunk)
      });
    }
    return chunks;
  }

  async function merkleRootSha256(chunks) {
    if (!chunks.length) {
      return "";
    }
    let level = chunks.map((chunk) => hexToBytes(chunk.sha256));
    while (level.length > 1) {
      const nextLevel = [];
      for (let index = 0; index < level.length; index += 2) {
        const left = level[index];
        const right = level[index + 1] || left;
        const pair = new Uint8Array(left.length + right.length);
        pair.set(left, 0);
        pair.set(right, left.length);
        nextLevel.push(await sha256Raw(pair));
      }
      level = nextLevel;
    }
    return `sha256:${bytesToHex(level[0])}`;
  }

  function validateCatalogArtifactMatch(entry, name, bytes, sha256) {
    if (!entry) {
      return;
    }
    if (bytes.length !== entry.artifactByteCount) {
      throw new Error("Catalog byte count mismatch");
    }
    if (sha256 !== entry.artifactSha256) {
      throw new Error("Catalog SHA-256 mismatch");
    }
    if (!/\.slm$/i.test(name)) {
      throw new Error("Catalog artifact must be a local .slm file");
    }
  }

  function hasVerifiedLocalModelFile() {
    return Boolean(
      state.localModel &&
      state.localModel.localFile &&
      state.localModel.localFile.bytes &&
      state.localModel.localFile.verified === true
    );
  }

  function setShareMetadataStatus(text, isError) {
    const targetText = text || (hasVerifiedLocalModelFile() ? "share metadata ready" : "import a local .slm first");
    for (const node of [el.shareMetadataState, el.simpleShareMetadataStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function updateShareMetadataControls() {
    const disabled = !hasVerifiedLocalModelFile();
    for (const button of [el.saveShareMetadataButton, el.simpleSaveShareMetadataButton]) {
      if (button) {
        button.disabled = disabled;
        button.title = disabled
          ? "Import and load a Rust-validated local .slm before saving share metadata."
          : "Save checksum-bound MiniModel metadata for this verified local .slm.";
      }
    }
    if (disabled) {
      setShareMetadataStatus("import and load a local .slm first", false);
    }
  }

  function setLocalFileVerificationState(model, verified, text, isError) {
    if (model && model.localFile) {
      model.localFile.verified = Boolean(verified);
      updateShareMetadataControls();
      if (text) {
        setShareMetadataStatus(text, isError);
      }
    }
  }

  function setConversionRequestStatus(text, isError) {
    if (el.conversionRequestState) {
      setText(el.conversionRequestState, text, isError);
    }
  }

  function normalizeConversionRequest(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Conversion request must be a JSON object");
    }
    if (body.request_kind !== "minimodel.huggingface_conversion_request.v0") {
      throw new Error("Conversion request kind was not minimodel.huggingface_conversion_request.v0");
    }
    const source = body.source && typeof body.source === "object" ? body.source : {};
    const sourceModelId = hfModelId({ modelId: source.model_id });
    if (!sourceModelId) {
      throw new Error("Conversion request source model id was invalid");
    }
    return {
      request: body,
      sourceModelId,
      sourceUrl: catalogText(source.model_url) || hfModelUrl(sourceModelId),
      generatedAt: catalogText(body.generated_at)
    };
  }

  async function importConversionRequestFile() {
    const file = el.conversionRequestFile && el.conversionRequestFile.files ? el.conversionRequestFile.files[0] : null;
    if (!file) {
      throw new Error("Choose a conversion request JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > catalogTextByteBudget) {
      throw new Error("Conversion request JSON size was invalid");
    }
    const body = JSON.parse(await file.text());
    state.pendingConversionRequest = normalizeConversionRequest(body);
    setConversionRequestStatus(`${state.pendingConversionRequest.sourceModelId} bound`, false);
  }

  function slugForShareMetadata(value) {
    const slug = String(value || "")
      .toLowerCase()
      .replace(/\.slm$/i, "")
      .replace(/[^a-z0-9._/-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160);
    return /^[a-z0-9]/.test(slug) ? slug : "local-slm";
  }

  function sourceFieldsForShareMetadata(localFile) {
    const entry = localFile.catalogEntry || null;
    const conversion = state.pendingConversionRequest || null;
    const sourceHfId = entry && entry.sourceHuggingFaceModelId
      ? entry.sourceHuggingFaceModelId
      : conversion
        ? conversion.sourceModelId
        : "";
    return {
      sourceKind: sourceHfId ? "huggingface-hub" : entry ? entry.sourceKind : "user-local-file",
      sourceIdentity: entry && entry.sourceIdentity
        ? entry.sourceIdentity
        : conversion
          ? conversion.sourceUrl
          : "user-local-file",
      sourceHuggingFaceModelId: sourceHfId,
      sourceUrl: entry && entry.sourceUrl
        ? entry.sourceUrl
        : conversion
          ? conversion.sourceUrl
          : "",
      modelId: entry
        ? entry.modelId
        : sourceHfId
          ? `converted/${sourceHfId}`.slice(0, 180)
          : `local/${slugForShareMetadata(localFile.name)}`,
      displayName: entry ? entry.displayName : safeLocalModelName(localFile.name).replace(/\.slm$/i, "")
    };
  }

  async function buildShareMetadataBundle() {
    if (!hasVerifiedLocalModelFile()) {
      throw new Error("Import a verified local .slm before saving share metadata");
    }
    const localFile = state.localModel.localFile;
    const chunks = await chunkSha256List(localFile.bytes, peerShareChunkBytes);
    const chunkListText = chunks.map((chunk) => [
      chunk.index,
      chunk.offset,
      chunk.byte_count,
      chunk.sha256
    ].join("=")).join("\n");
    const source = sourceFieldsForShareMetadata(localFile);
    const merkleRoot = await merkleRootSha256(chunks);
    const chunkListSha256 = await sha256Text(`${chunkListText}\n`);
    const catalogEntry = {
      catalog_version: 0,
      entry_kind: "minimodel.catalog_entry",
      model_id: source.modelId,
      display_name: source.displayName,
      publisher_id: "local-user",
      publisher_key_id: "local-user-unsigned",
      artifact_kind: "slm",
      artifact_file_name: localFile.name,
      local_file_name_hint: localFile.name,
      artifact_byte_count: localFile.byteLength,
      artifact_sha256: localFile.sha256,
      artifact_project_server_url: null,
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false,
      peer_hint_status: "metadata-ready-transfer-not-implemented",
      execution_policy: "user-local-file-only",
      source_kind: source.sourceKind,
      source_identity: source.sourceIdentity,
      evidence_admission_status: "local-import-verified",
      quality_claim: "not-endorsed-by-project",
      trained_quality_claim: "not-claimed",
      required_next_gate: "publisher-review-admission-and-peer-transfer-implementation",
      slm_checksum: localFile.checksum
    };
    if (source.sourceHuggingFaceModelId) {
      catalogEntry.source_huggingface_model_id = source.sourceHuggingFaceModelId;
    }
    if (source.sourceUrl) {
      catalogEntry.source_url = source.sourceUrl;
    }
    if (localFile.catalogEntry) {
      if (localFile.catalogEntry.modelShape) {
        catalogEntry.slm_model_shape = localFile.catalogEntry.modelShape;
      }
      if (localFile.catalogEntry.quantization) {
        catalogEntry.slm_quantization = localFile.catalogEntry.quantization;
      }
      if (localFile.catalogEntry.tokenizerChecksum) {
        catalogEntry.slm_tokenizer_checksum = localFile.catalogEntry.tokenizerChecksum;
      }
      if (localFile.catalogEntry.configChecksum) {
        catalogEntry.slm_config_checksum = localFile.catalogEntry.configChecksum;
      }
    }
    return {
      bundle_kind: "minimodel.local_slm_share_metadata.v0",
      generated_at: new Date().toISOString(),
      boundary: {
        project_server_runs_model_bytes: false,
        project_server_serves_model_bytes: false,
        peer_transfer_implemented: false,
        user_consent_required_before_transfer: true,
        tiny_rust_lm_execution_rule: "User imports a verified local .slm through the browser file picker before execution."
      },
      catalog_entry: catalogEntry,
      peer_offer: {
        offer_kind: "minimodel.peer_offer.v0",
        offer_version: 0,
        offer_status: "metadata-ready-transfer-not-implemented",
        artifact_kind: "slm",
        artifact_file_name: localFile.name,
        artifact_byte_count: localFile.byteLength,
        artifact_sha256: localFile.sha256,
        slm_checksum: localFile.checksum,
        chunks: {
          algorithm: "sha256-merkle-v0",
          chunk_size: peerShareChunkBytes,
          chunk_count: chunks.length,
          chunk_list_sha256: chunkListSha256,
          merkle_root_sha256: merkleRoot,
          entries: chunks
        },
        transfer: {
          protocols: [],
          network_transfer_available: false,
          required_next_gate: "implement-consent-based-peer-transfer-and-rust-reverify-before-import"
        }
      },
      conversion_request: state.pendingConversionRequest
        ? {
          request_kind: state.pendingConversionRequest.request.request_kind,
          source: state.pendingConversionRequest.request.source,
          generated_at: state.pendingConversionRequest.generatedAt
        }
        : null
    };
  }

  async function saveShareMetadata() {
    setShareMetadataStatus("computing chunk hashes", false);
    const bundle = await buildShareMetadataBundle();
    const fileName = `${slugForShareMetadata(bundle.catalog_entry.model_id)}.minimodel-share-metadata.json`;
    downloadTextFile(fileName, `${JSON.stringify(bundle, null, 2)}\n`);
    setShareMetadataStatus(`${bundle.peer_offer.chunks.chunk_count} chunks / share metadata saved locally`, false);
  }

  async function importLocalModelFile() {
    const file = el.localModelFile && el.localModelFile.files ? el.localModelFile.files[0] : null;
    if (!file) {
      throw new Error("Choose a local .slm file");
    }
    const name = safeLocalModelName(file.name);
    if (!/\.slm$/i.test(name)) {
      throw new Error("Local model must use the .slm extension");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Local model file is empty");
    }
    if (file.size > localModelMaxBytes) {
      throw new Error(`Local model exceeds ${formatByteCount(localModelMaxBytes)} browser limit`);
    }
    setLocalModelStatus(`reading ${name}`, false);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    validateCatalogArtifactMatch(state.selectedCatalogEntry, name, bytes, sha256);
    const checksum = bytesChecksumHex(bytes);
    const catalogEntry = state.selectedCatalogEntry;
    state.localModel = {
      label: `${catalogEntry ? catalogEntry.displayName : name} (local file)`,
      path: `local-file:${name}`,
      maxTokens: catalogEntry ? catalogEntry.maxTokens : 64,
      localFile: {
        name,
        bytes,
        byteLength: bytes.length,
        checksum,
        sha256,
        catalogEntry,
        verified: false
      }
    };
    paths.models = modelsWithLocalModel(paths.models);
    renderModelOptions(paths.models, false, localModelKey);
    setLocalModelStatus(`${name} / ${formatByteCount(bytes.length)} / ${sha256} / ${checksum}`, false);
    setShareMetadataStatus("validating local .slm", false);
    setText(el.errorState, "none", false);
    if (state.exports) {
      const loaded = await loadSelectedModel();
      if (!loaded) {
        throw new Error("Local .slm failed Rust/WASM validation");
      }
    }
  }

  function hfOrigin() {
    return `${hfDiscoveryScheme}://${hfDiscoveryHost}`;
  }

  function hfModelUrl(modelId) {
    return `${hfOrigin()}/${String(modelId).split("/").map(encodeURIComponent).join("/")}`;
  }

  function setHfStatus(text, isError) {
    if (el.hfStatus) {
      setText(el.hfStatus, text, isError);
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "huggingface") {
      el.simpleDiscoveryStatus.textContent = text;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function clearHfResults() {
    if (el.hfResults) {
      el.hfResults.replaceChildren();
    }
    if (el.simpleHfResults) {
      el.simpleHfResults.replaceChildren();
    }
  }

  function hfModelId(result) {
    const id = result && (result.modelId || result.id || result.name);
    const text = String(id || "").trim();
    return /^[A-Za-z0-9][A-Za-z0-9._/-]{1,180}$/.test(text) ? text : "";
  }

  function hfSiblingFileName(sibling) {
    const text = String(sibling && (sibling.rfilename || sibling.path || sibling.name) || "").trim();
    if (!text || text.includes("\\") || text.includes("://") || /[\x00-\x1f\x7f]/.test(text)) {
      return "";
    }
    if (!text.split("/").every((part) => part && part !== "." && part !== "..")) {
      return "";
    }
    return text;
  }

  function hfSiblingByteCount(sibling) {
    const candidates = [
      sibling && sibling.size,
      sibling && sibling.blobSize,
      sibling && sibling.lfs && sibling.lfs.size
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric;
      }
    }
    return null;
  }

  function hfSlmSiblings(result) {
    const siblings = result && Array.isArray(result.siblings) ? result.siblings : [];
    return siblings
      .map(hfSiblingFileName)
      .filter((fileName) => /\.slm$/i.test(fileName) && !fileName.includes("\\"))
      .slice(0, 3);
  }

  function hfSafetensorsSiblings(result) {
    const siblings = result && Array.isArray(result.siblings) ? result.siblings : [];
    const seen = new Set();
    const files = [];
    for (const sibling of siblings) {
      const fileName = hfSiblingFileName(sibling);
      if (!/\.safetensors$/i.test(fileName) || seen.has(fileName.toLowerCase())) {
        continue;
      }
      seen.add(fileName.toLowerCase());
      files.push({
        file_name: fileName,
        byte_count: hfSiblingByteCount(sibling)
      });
      if (files.length >= 8) {
        break;
      }
    }
    return files;
  }

  function normalizeModelIdentity(value) {
    return String(value || "")
      .trim()
      .replace(/^https:\/\/huggingface\.co\//i, "")
      .replace(/^http:\/\/huggingface\.co\//i, "")
      .replace(/^hf:\/\//i, "")
      .replace(/\/+$/g, "")
      .toLowerCase();
  }

  function catalogEntryMatchesHfModel(entry, modelId) {
    const target = normalizeModelIdentity(modelId);
    if (!target || !entry) {
      return false;
    }
    const raw = entry.raw || {};
    const candidates = [
      entry.sourceHuggingFaceModelId,
      entry.sourceModelId,
      entry.sourceIdentity,
      entry.sourceUrl,
      raw.source_huggingface_model_id,
      raw.huggingface_model_id,
      raw.hf_model_id,
      raw.source_model_id,
      raw.upstream_model_id,
      raw.source_url
    ].map(normalizeModelIdentity).filter(Boolean);
    return candidates.some((candidate) => candidate === target);
  }

  function hfP2pMatches(modelId) {
    return state.catalogEntries.filter((entry) => catalogEntryMatchesHfModel(entry, modelId));
  }

  function firstPeerOfferMatch(matches) {
    return matches.find((match) => Boolean(match.peerOfferRoute)) || null;
  }

  function catalogPeerBaseUrl(entry) {
    return entry && Array.isArray(entry.peerSources) && entry.peerSources.length
      ? entry.peerSources[0].peerBaseUrl
      : "";
  }

  function p2pImportBaseUrl(entry, explicitPeerBaseUrl = state.peerBaseUrl) {
    if (explicitPeerBaseUrl) {
      return normalizedPeerBaseUrl(explicitPeerBaseUrl);
    }
    return catalogPeerBaseUrl(entry);
  }

  function canStartP2pImport(entry) {
    return Boolean(entry && entry.peerOfferRoute && p2pImportBaseUrl(entry));
  }

  function p2pCatalogActionButton(entry) {
    if (!entry || !entry.peerOfferRoute) {
      return null;
    }
    return actionButton(
      canStartP2pImport(entry) ? "P2P Import" : "Set Peer URL",
      () => startP2pImportOrRequestPeer(entry),
      "primary-result-action"
    );
  }

  function requestKnownPeerForEntry(entry) {
    selectCatalogEntry(entry);
    setSimpleSourceOption("p2p", true);
    updatePeerUrlStatus("Enter the consenting peer URL once, then use P2P Import.", false);
    holdModelPopoverOpen(4000);
  }

  function startP2pImportOrRequestPeer(entry) {
    if (canStartP2pImport(entry)) {
      importHfP2pMatch(entry);
      return;
    }
    requestKnownPeerForEntry(entry);
  }

  function hfP2pImportMatch(matches) {
    if (state.p2pEnabled === false) {
      return null;
    }
    return matches.find((match) => canStartP2pImport(match)) || null;
  }

  function peerImportFileStem(modelId) {
    return conversionFileStem(modelId || "minimodel-peer-import");
  }

  function peerImportRequest(match, peerBaseUrl = state.peerBaseUrl) {
    const manifestUrl = catalogRouteUrl(match, match.manifestRoute);
    const peerOfferUrl = catalogRouteUrl(match, match.peerOfferRoute);
    const normalizedPeerUrl = p2pImportBaseUrl(match, peerBaseUrl);
    if (!normalizedPeerUrl) {
      throw new Error("Set a known consenting peer URL before starting P2P Import.");
    }
    return {
      request_kind: "minimodel.peer_import_request.v0",
      request_version: 0,
      created_by: "TinyRustLM browser source chooser",
      model: {
        model_id: match.modelId,
        display_name: match.displayName,
        artifact_kind: match.artifactKind,
        artifact_file_name: match.fileNameHint,
        artifact_byte_count: match.artifactByteCount,
        artifact_sha256: match.artifactSha256,
        slm_model_shape: match.modelShape || null,
        quantization: match.quantization || null
      },
      source: {
        kind: match.sourceKind,
        huggingface_model_id: match.sourceHuggingFaceModelId || null,
        identity: match.sourceIdentity || match.sourceUrl || null,
        model_card_route: catalogRouteUrl(match, match.modelCardRoute) || null,
        license_route: catalogRouteUrl(match, match.licenseRoute) || null
      },
      minimodel_metadata: {
        catalog_base_url: match.catalogBaseUrl || null,
        manifest_route: match.manifestRoute || null,
        manifest_url: manifestUrl || null,
        peer_offer_route: match.peerOfferRoute || null,
        peer_offer_url: peerOfferUrl || null,
        peer_offer_sha256: match.peerOfferSha256 || null,
        peer_offer_chunk_count: match.peerOfferChunkCount || null,
        peer_offer_merkle_root_sha256: match.peerOfferMerkleRootSha256 || null,
        peer_hint_status: match.peerHintStatus,
        admission_status: match.admissionStatus,
        required_next_gate: match.requiredNextGate
      },
      local_peer_piece_contract: {
        expected_piece_set_kind: "minimodel.peer_piece_set.v0",
        expected_peer_base_url: normalizedPeerUrl,
        expected_piece_dir: `${peerImportFileStem(match.modelId)}-peer-pieces`,
        assembled_output_slm: match.fileNameHint,
        peer_side_commands: [
          "minimodel prepare-peer-share <artifact.slm> <share-dir> <model-id> [source-huggingface-model-id] [known-peer-base-url]",
          "minimodel serve-peer-pieces <manifest> <piece-dir> <bind-addr>"
        ],
        rust_commands: [
          "minimodel import-peer-request <request-json> <manifest> <output-dir>"
        ]
      },
      boundary: {
        project_server_serves_model_bytes: false,
        project_server_runs_model_bytes: false,
        project_server_proxies_huggingface_bytes: false,
        browser_runs_after_rust_wasm_local_slm_validation: true,
        transfer_requires_user_consent_and_local_reverify: true
      }
    };
  }

  function peerImportScript(match, peerBaseUrl = state.peerBaseUrl) {
    const stem = peerImportFileStem(match.modelId);
    const request = peerImportRequest(match, peerBaseUrl);
    const peerUrl = request.local_peer_piece_contract.expected_peer_base_url;
    const lines = [
      "# MiniModel peer import handoff",
      `# Model: ${match.displayName} (${match.modelId})`,
      "#",
      "# This script does not download model bytes from MiniModel.org, TinyRustLM.com, or Hugging Face.",
      "# It fetches peer pieces only from the consenting peer URL you enter below.",
      "# MiniModel rejects project-server peer hosts and verifies every piece before assembly.",
      "# Rust then fetches pieces, assembles, verifies, and writes an import receipt.",
      "# Peer serving counterpart: cargo run -p minimodel -- serve-peer-pieces <manifest> <piece-dir> 127.0.0.1:8123",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "# Edit the workspace, request, manifest, and output directory before running.",
      "$MiniModelWorkspace = \"EDIT_ME\\\\MiniModel.org\"",
      `$PeerImportRequest = ${powerShellSingleQuote(`${stem}.minimodel-peer-import-request.json`)}`,
      "$Manifest = \"EDIT_ME\\\\model.minimodel.manifest.v0\"",
      `$ImportDir = ${powerShellSingleQuote(`${stem}-peer-import`)}`,
      `$ExpectedPeerBaseUrl = ${powerShellDoubleQuote(peerUrl)}`,
      "",
      "Set-Location $MiniModelWorkspace",
      "Write-Host \"Expected consenting peer:\" $ExpectedPeerBaseUrl",
      "cargo run -p minimodel -- import-peer-request $PeerImportRequest $Manifest $ImportDir",
      "",
      "Write-Host \"Verified peer import output directory:\" $ImportDir",
      "Write-Host \"Next: open TinyRustLM.com, choose Your Local Files, and import the verified .slm.\"",
      "",
      "# Peer import request summary:",
      `# artifact_sha256: ${request.model.artifact_sha256}`,
      `# artifact_byte_count: ${request.model.artifact_byte_count}`,
      `# peer_offer_sha256: ${request.minimodel_metadata.peer_offer_sha256 || "unavailable"}`,
      `# peer_offer_merkle_root_sha256: ${request.minimodel_metadata.peer_offer_merkle_root_sha256 || "unavailable"}`,
      ""
    ];
    return lines.join("\n");
  }

  function savePeerImportHandoff(match) {
    const stem = peerImportFileStem(match.modelId);
    let request;
    try {
      request = peerImportRequest(match);
    } catch (error) {
      updatePeerUrlStatus(errorMessage(error), true);
      setSimpleSourceOption("p2p", true);
      holdModelPopoverOpen(3000);
      return;
    }
    downloadTextFile(`${stem}.minimodel-peer-import-request.json`, `${JSON.stringify(request, null, 2)}\n`);
    downloadTextFile(`${stem}.minimodel-peer-import.ps1`, peerImportScript(match, request.local_peer_piece_contract.expected_peer_base_url), "text/plain");
    setHfStatus(`${match.displayName} P2P import request saved for ${request.local_peer_piece_contract.expected_peer_base_url}; waiting for Rust reverify`, false);
    holdModelPopoverOpen(2500);
  }

  function startHfConversion(entry, matches) {
    const request = hfConversionRequest(entry, matches);
    state.pendingConversionRequest = normalizeConversionRequest(request);
    setConversionRequestStatus(`${state.pendingConversionRequest.sourceModelId} bound`, false);
    const stem = conversionFileStem(entry.modelId);
    downloadTextFile(`${stem}.minimodel-conversion-request.json`, `${JSON.stringify(request, null, 2)}\n`);
    downloadTextFile(`${stem}.tinyrustlm-convert.ps1`, hfConversionScript(entry, matches), "text/plain");
    setHfStatus("conversion started: local Rust request and script saved", false);
    holdModelPopoverOpen(2500);
  }

  function importHfP2pMatch(match) {
    selectCatalogEntry(match);
    savePeerImportHandoff(match);
  }

  function hfCountText(value, unit) {
    return Number.isFinite(value) ? `${value} ${unit}` : `${unit} unavailable`;
  }

  function hfResultView(entry) {
    const matches = hfP2pMatches(entry.modelId);
    const slmFiles = hfSlmSiblings(entry.result);
    const safetensorsFiles = hfSafetensorsSiblings(entry.result);
    return {
      entry,
      matches,
      slmFiles,
      safetensorsFiles,
      hasPeerOffer: matches.some((match) => Boolean(match.peerOfferRoute)),
      peerOfferMatch: firstPeerOfferMatch(matches),
      p2pMatch: hfP2pImportMatch(matches),
      downloads: hfCountText(entry.result.downloads, "downloads"),
      likes: hfCountText(entry.result.likes, "likes")
    };
  }

  function hfCompatibilityClass(view) {
    return view.matches.length || view.slmFiles.length
      ? "compatibility-pill candidate"
      : "compatibility-pill convert";
  }

  function hfAdvancedStatusText(view) {
    if (view.matches.length) {
      return view.p2pMatch
        ? "P2P available"
        : view.hasPeerOffer
          ? "P2P proof ready; peer URL required"
        : "Catalog match, local .slm needed";
    }
    if (view.slmFiles.length) {
      return "External .slm listed, verify locally";
    }
    return "Rust conversion required";
  }

  function hfAdvancedMetaText(view) {
    const sourceState = view.matches.length
      ? view.p2pMatch
        ? "MiniModel metadata lists a peer source; Rust must fetch, assemble, and reverify before import"
        : view.hasPeerOffer
          ? "MiniModel metadata has a peer-offer proof; enter a consenting peer URL before Rust fetches, assembles, and reverifies"
        : "MiniModel metadata only; choose the matching local .slm before running"
      : "model card only; not runnable here until Rust conversion and local .slm verification";
    return `${view.downloads} / ${view.likes} / ${sourceState}`;
  }

  function hfSimpleMetaText(view) {
    if (view.matches.length) {
      if (state.p2pEnabled === false) {
        return `Hugging Face model card / ${view.downloads} / P2P disabled; local conversion path selected`;
      }
      if (view.p2pMatch) {
        return `Hugging Face model card / ${view.downloads} / P2P source listed; Rust reverify required`;
      }
      return `Hugging Face model card / ${view.downloads} / ${view.hasPeerOffer ? "P2P proof ready; consenting peer URL required" : "MiniModel metadata found; local .slm needed"}`;
    }
    return `Hugging Face model card / ${view.downloads} / not compatible yet; Rust conversion required`;
  }

  function hfSimpleCompatibilityText(view) {
    if (view.p2pMatch) {
      return "P2P available";
    }
    if (view.matches.length && state.p2pEnabled === false) {
      return "P2P off; conversion";
    }
    if (view.matches.length) {
      return view.hasPeerOffer
        ? "P2P proof ready"
        : "Catalog match, local .slm needed";
    }
    if (view.slmFiles.length) {
      return "External .slm listed, verify locally";
    }
    return "Rust conversion required";
  }

  function hfSimpleFallbackNote(view) {
    if (view.p2pMatch) {
      return "P2P Import saves a peer-piece request and Rust fetch/verify script. Project servers never provide model bytes.";
    }
    if (view.matches.length && state.p2pEnabled === false) {
      return "P2P is disabled for this list, so conversion will use local/manual source files and may take a while.";
    }
    if (view.hasPeerOffer) {
      return "MiniModel has a peer-offer proof. Enter one consenting peer URL in P2P Exchange to import without repeating source conversion.";
    }
    return "This is a model-card result. Convert locally, save peer-offer proof, then publish metadata for future P2P reuse.";
  }

  function appendHfSlmFileNotes(actions, slmFiles, actionWord) {
    for (const fileName of slmFiles) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `${safeLocalModelName(fileName)} is listed externally; ${actionWord} only after local review and Rust validation.`
      ));
    }
  }

  function appendHfSafetensorsFileNotes(actions, safetensorsFiles) {
    if (!safetensorsFiles.length) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        "No .safetensors source file was listed in metadata; review the model card before choosing a local source file."
      ));
      return;
    }
    for (const file of safetensorsFiles.slice(0, 2)) {
      const size = Number.isFinite(file.byte_count) && file.byte_count > 0
        ? ` / ${formatByteCount(file.byte_count)}`
        : "";
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `Source file listed: ${safeLocalModelName(file.file_name)}${size}. Download/review locally; Start Conversion will not fetch it.`
      ));
    }
    if (safetensorsFiles.length > 2) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `${safetensorsFiles.length - 2} more .safetensors files listed; Rust planner decides local compatibility.`
      ));
    }
  }

  function appendHfSourceFileNotes(actions, view, options = {}) {
    if (view.slmFiles.length) {
      appendHfSlmFileNotes(actions, view.slmFiles, options.slmActionWord || "import");
      return;
    }
    const noSlmText = options.noSlmText || "No compatible .slm is available to this app yet.";
    if (noSlmText) {
      actions.append(elementWithText("span", "model-result-meta", noSlmText));
    }
    appendHfSafetensorsFileNotes(actions, view.safetensorsFiles);
  }

  function hfEnabledP2pActionMatch(view) {
    if (state.p2pEnabled === false) {
      return null;
    }
    return view.p2pMatch || view.peerOfferMatch || null;
  }

  function appendHfAdvancedActions(actions, entry, view) {
    actions.append(externalActionLink("Review Model Card", hfModelUrl(entry.modelId)));
    if (view.matches.length) {
      for (const match of view.matches.slice(0, 2)) {
        if (match.peerOfferRoute && state.p2pEnabled !== false) {
          appendActionIfPresent(actions, p2pCatalogActionButton(match));
        }
        actions.append(actionButton("Use MiniModel Metadata", () => selectCatalogEntry(match)));
      }
      return;
    }
    actions.append(
      actionButton("Save Conversion Request", () => saveHfConversionRequest(entry, view.matches)),
      actionButton("Save Rust Conversion Script", () => saveHfConversionScript(entry, view.matches))
    );
  }

  function appendHfSimpleActions(actions, entry, view) {
    actions.append(externalActionLink("Review Model Card", hfModelUrl(entry.modelId)));
    actions.append(elementWithText("span", hfCompatibilityClass(view), hfSimpleCompatibilityText(view)));
    const p2pActionMatch = hfEnabledP2pActionMatch(view);
    if (p2pActionMatch) {
      appendActionIfPresent(actions, p2pCatalogActionButton(p2pActionMatch));
      return;
    }
    actions.append(actionButton("Start Conversion", () => startHfConversion(entry, view.matches), "primary-result-action"));
  }

  async function ensureDefaultCatalogForHfAvailability() {
    if (state.p2pEnabled === false) {
      return;
    }
    if (state.catalogEntries.length || state.defaultCatalogCheckedForAvailability) {
      return;
    }
    state.defaultCatalogCheckedForAvailability = true;
    try {
      const response = await fetch(defaultCatalogUrl, {
        cache: "no-store",
        credentials: "omit"
      });
      if (!response.ok) {
        return;
      }
      const text = await response.text();
      if (state.encoder.encode(text).length > catalogTextByteBudget) {
        return;
      }
      const body = JSON.parse(text);
      const announcementRoutes = catalogAnnouncementRoutesFromBody(body, defaultCatalogUrl);
      state.catalogEntries = catalogEntriesFromBody(body, "MiniModel.org", defaultCatalogUrl);
      if (announcementRoutes.length) {
        try {
          await applyCatalogAnnouncementRoutes(announcementRoutes);
        } catch (_error) {
          // Keep the base proof-ready metadata, but fail closed on optional peer sources.
        }
      }
    } catch (_error) {
      state.catalogEntries = [];
    }
  }

  function hfConversionRequest(entry, matches) {
    const slmFiles = hfSlmSiblings(entry.result);
    const safetensorsFiles = hfSafetensorsSiblings(entry.result);
    const suggestedSourceFile = safetensorsFiles.length ? safetensorsFiles[0].file_name : null;
    const defaultShape = "tinylm16-bpe";
    const defaultQuantization = "q8_0";
    return {
      request_kind: "minimodel.huggingface_conversion_request.v0",
      generated_at: new Date().toISOString(),
      source: {
        kind: "huggingface_model",
        model_id: entry.modelId,
        model_url: hfModelUrl(entry.modelId),
        downloads: Number.isFinite(entry.result.downloads) ? entry.result.downloads : null,
        likes: Number.isFinite(entry.result.likes) ? entry.result.likes : null,
        discovered_slm_files: slmFiles,
        discovered_safetensors_files: safetensorsFiles
      },
      requested_artifact: {
        kind: "slm",
        preferred_quantization_order: ["q8_0", "q4_0", "f32"],
        supported_source_shapes: ["tiny-fixture", "tiny-fixture-tied", "tiny-fixture-bpe", "tinylm16", "tinylm16-tied", "tinylm16-bpe"],
        default_source_shape: defaultShape,
        default_quantization: defaultQuantization,
        runtime_target: "TinyRustLM Rust/WASM browser-local runtime",
        browser_import_rule: "User imports the converted .slm with the browser file picker; project servers do not serve model bytes."
      },
      local_conversion: {
        converter: "tinyrustlm-slm-pack",
        required_local_input: suggestedSourceFile
          ? `A reviewed local copy of ${suggestedSourceFile}; the browser does not download it.`
          : "A user-selected .safetensors file already present on this machine.",
        suggested_source_safetensors_file: suggestedSourceFile,
        command_shape: `cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request <request.json> <input.safetensors> <output-dir> ${defaultShape} ${defaultQuantization}`,
        peer_share_shape: "cargo run -p minimodel -- prepare-peer-share <output.slm> <share-dir> <minimodel-model-id> [source-huggingface-model-id] [known-peer-base-url]",
        peer_source_shape: "cargo run -p minimodel -- add-peer-source <catalog-entry-json> <output-json> <known-peer-base-url>",
        peer_source_announcement_shape: "cargo run -p minimodel -- write-peer-source-announcement <catalog-entry-json> <announcement-json> <known-peer-base-url>",
        peer_source_apply_shape: "cargo run -p minimodel -- apply-peer-source-announcements <catalog-entry-json> <output-json> <announcement-json>...",
        peer_source_batch_snapshot_shape: "cargo run -p minimodel -- write-catalog-snapshot-with-announcements <models.v0.json> <catalog-entry-json>... --announcements <announcement-json>...",
        catalog_snapshot_shape: "cargo run -p minimodel -- write-catalog-snapshot <models.v0.json> <catalog-entry-json>...",
        compatibility_rule: "The Rust planner/converter must accept the safetensors tensor names and exact TinyRustLM shape before a .slm is usable. MiniModel prepare-peer-share then writes the manifest, peer-offer proof, local peer pieces, and catalog entry from the verified .slm."
      },
      conversion_gates: [
        "source license and model-card review",
        "config/tokenizer checksum capture",
        "safetensors/source artifact checksum capture",
        "local conversion to .slm",
        "tinyrustlm-slm-pack validate",
        "MiniModel prepare-peer-share",
        "MiniModel add-peer-source when peer availability is known later",
        "MiniModel write-peer-source-announcement for catalog-maintainer P2P availability",
        "MiniModel apply-peer-source-announcements before shared metadata snapshots",
        "MiniModel write-catalog-snapshot-with-announcements for batch maintainer publication",
        "MiniModel write-catalog-snapshot",
        "runtime smoke proof",
        "eval/admission evidence",
        "MiniModel manifest signature",
        "P2P peer availability metadata"
      ],
      existing_minimodel_matches: matches.map((match) => ({
        model_id: match.modelId,
        display_name: match.displayName,
        artifact_sha256: match.artifactSha256,
        artifact_byte_count: match.artifactByteCount,
        peer_hint_status: match.peerHintStatus,
        required_next_gate: match.requiredNextGate
      })),
      boundary: {
        project_server_runs_model_bytes: false,
        project_server_serves_model_bytes: false,
        p2p_goal: "Convert once, publish checksum-bound metadata plus a peer-offer proof, then let consenting peers serve MiniModel pieces that receivers fetch, assemble, and reverify locally."
      }
    };
  }

  function powerShellSingleQuote(value) {
    return `'${String(value || "").replace(/'/g, "''")}'`;
  }

  function powerShellDoubleQuote(value) {
    return `"${String(value || "").replace(/[`"$]/g, "`$&")}"`;
  }

  function hfLocalSafetensorsPathHint(fileName) {
    const safeName = String(fileName || "model.safetensors").replace(/\//g, "\\");
    return `EDIT_ME\\${safeName}`;
  }

  function conversionFileStem(modelId) {
    const stem = String(modelId || "huggingface-model")
      .replace(/[\\/]+/g, "__")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
    return stem || "huggingface-model";
  }

  function minimodelModelIdForHf(modelId) {
    const cleaned = String(modelId || "huggingface/model")
      .toLowerCase()
      .replace(/[\\]+/g, "/")
      .replace(/[^a-z0-9._/-]+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^[-/]+|[-/]+$/g, "")
      .slice(0, 160);
    return cleaned || "huggingface/model";
  }

  function hfConversionScript(entry, matches) {
    const request = hfConversionRequest(entry, matches);
    const stem = conversionFileStem(entry.modelId);
    const sourceShape = request.requested_artifact.default_source_shape;
    const quantization = request.requested_artifact.default_quantization;
    const modelUrl = hfModelUrl(entry.modelId);
    const minimodelModelId = minimodelModelIdForHf(entry.modelId);
    const safetensorsFiles = Array.isArray(request.source.discovered_safetensors_files)
      ? request.source.discovered_safetensors_files
      : [];
    const suggestedSourceFile = request.local_conversion.suggested_source_safetensors_file || "model.safetensors";
    const sourceCandidateLines = safetensorsFiles.length
      ? safetensorsFiles.map((file) => {
        const size = Number.isFinite(file.byte_count) && file.byte_count > 0
          ? ` / ${formatByteCount(file.byte_count)}`
          : "";
        return `#   - ${file.file_name}${size}`;
      })
      : ["#   - no .safetensors sibling listed by metadata; inspect the model card before choosing a local file."];
    const lines = [
      "# TinyRustLM Hugging Face to .slm conversion script",
      `# Source model: ${entry.modelId}`,
      `# Model card: ${modelUrl}`,
      "#",
      "# Hugging Face metadata source-file candidates:",
      ...sourceCandidateLines,
      "#",
      "# This script never downloads model bytes for you.",
      "# First download or otherwise obtain the source .safetensors file yourself,",
      "# review the model card/license, then edit $SourceSafetensors below.",
      "# $SourceSafetensors must point to your reviewed local copy of a listed source file.",
      "# If the Rust planner rejects the file, this model is not currently compatible",
      "# with the selected TinyRustLM source shape.",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "# Edit these values before running.",
      "$TinyRustLMWorkspace = \"EDIT_ME\\\\SLMComposer.com\"",
      "$MiniModelWorkspace = \"EDIT_ME\\\\MiniModel.org\"",
      `$SuggestedSourceSafetensorsFileName = ${powerShellSingleQuote(suggestedSourceFile)}`,
      `$ConversionRequest = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}.minimodel-conversion-request.json`)}`,
      `$SourceSafetensors = ${powerShellDoubleQuote(hfLocalSafetensorsPathHint(suggestedSourceFile))} # Replace with your reviewed local copy.`,
      `$SourceShape = ${powerShellSingleQuote(sourceShape)}`,
      `$Quantization = ${powerShellSingleQuote(quantization)}`,
      `$ModelId = ${powerShellSingleQuote(entry.modelId)}`,
      `$MiniModelModelId = ${powerShellSingleQuote(minimodelModelId)}`,
      "$KnownPeerBaseUrl = \"\" # Optional, for example http://127.0.0.1:8123/",
      `$WorkDir = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}-tinyrustlm-conversion`)}`,
      `$OutputSlm = Join-Path $WorkDir ${powerShellSingleQuote(`${stem}.${quantization}.slm`)}`,
      "$MiniModelShareDir = Join-Path $WorkDir \"minimodel-peer-share\"",
      `$MiniModelCatalogEntry = Join-Path $MiniModelShareDir ${powerShellSingleQuote(`${stem}.${quantization}.catalog-entry.v0.json`)}`,
      `$MiniModelCatalogEntryWithPeer = Join-Path $MiniModelShareDir ${powerShellSingleQuote(`${stem}.${quantization}.catalog-entry.with-peer.v0.json`)}`,
      `$MiniModelPeerSourceAnnouncement = Join-Path $MiniModelShareDir ${powerShellSingleQuote(`${stem}.${quantization}.peer-source-announcement.v0.json`)}`,
      "$MiniModelCatalogSnapshot = Join-Path $WorkDir \"models.v0.json\"",
      "$ConversionReceipt = Join-Path $WorkDir \"tinyrustlm-conversion.receipt\"",
      "",
      "New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null",
      "Set-Location $TinyRustLMWorkspace",
      "",
      "# Start Conversion saved this request JSON beside this script.",
      "# Rust performs inspect, plan, convert, validate, manifest validation, and receipt writing.",
      "cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request $ConversionRequest $SourceSafetensors $WorkDir $SourceShape $Quantization",
      "",
      "# Prepare checksum-bound MiniModel metadata and local peer pieces in one Rust step.",
      "# This does not upload model bytes and does not serve them from project servers.",
      "Set-Location $MiniModelWorkspace",
      "$PrepareArgs = @(\"run\", \"-p\", \"minimodel\", \"--\", \"prepare-peer-share\", $OutputSlm, $MiniModelShareDir, $MiniModelModelId, $ModelId)",
      "& cargo @PrepareArgs",
      "$MiniModelCatalogEntryForSnapshot = $MiniModelCatalogEntry",
      "if ($KnownPeerBaseUrl.Trim().Length -gt 0) {",
      "  cargo run -p minimodel -- add-peer-source $MiniModelCatalogEntry $MiniModelCatalogEntryWithPeer $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-source-announcement $MiniModelCatalogEntry $MiniModelPeerSourceAnnouncement $KnownPeerBaseUrl",
      "  $MiniModelCatalogEntryForSnapshot = $MiniModelCatalogEntryWithPeer",
      "}",
      "",
      "# Build a metadata-only catalog snapshot from the generated entry.",
      "# This is safe to share as catalog metadata; it still does not include or host model bytes.",
      "cargo run -p minimodel -- write-catalog-snapshot $MiniModelCatalogSnapshot $MiniModelCatalogEntryForSnapshot",
      "",
      "Write-Host \"Converted .slm:\" $OutputSlm",
      "Write-Host \"Conversion receipt:\" $ConversionReceipt",
      "Write-Host \"MiniModel share directory:\" $MiniModelShareDir",
      "Write-Host \"MiniModel catalog snapshot:\" $MiniModelCatalogSnapshot",
      "if ($KnownPeerBaseUrl.Trim().Length -eq 0) {",
      "  Write-Host \"Later, when you have a consenting peer URL, publish P2P availability metadata with:\"",
      "  Write-Host \"cargo run -p minimodel -- add-peer-source '$MiniModelCatalogEntry' '$MiniModelCatalogEntryWithPeer' http://127.0.0.1:8123/\"",
      "  Write-Host \"cargo run -p minimodel -- write-peer-source-announcement '$MiniModelCatalogEntry' '$MiniModelPeerSourceAnnouncement' http://127.0.0.1:8123/\"",
      "  Write-Host \"Send the announcement JSON to a catalog maintainer, who can run:\"",
      "  Write-Host \"cargo run -p minimodel -- apply-peer-source-announcements '$MiniModelCatalogEntry' '$MiniModelCatalogEntryWithPeer' '$MiniModelPeerSourceAnnouncement'\"",
      "  Write-Host \"or batch-publish many entries and announcements with:\"",
      "  Write-Host \"cargo run -p minimodel -- write-catalog-snapshot-with-announcements '$MiniModelCatalogSnapshot' '$MiniModelCatalogEntry' --announcements '$MiniModelPeerSourceAnnouncement'\"",
      "  Write-Host \"The batch command writes models.v0.json directly; if using apply-peer-source-announcements, rerun write-catalog-snapshot with the with-peer entry.\"",
      "}",
      "Write-Host \"If you consent to serve pieces, run the serve-peer-pieces command printed by MiniModel from your own machine.\"",
      "Write-Host \"Next: open TinyRustLM.com, choose Your Local Files, and import the converted .slm.\"",
      ""
    ];
    return lines.join("\n");
  }

  function saveHfConversionRequest(entry, matches) {
    const request = hfConversionRequest(entry, matches);
    state.pendingConversionRequest = normalizeConversionRequest(request);
    setConversionRequestStatus(`${state.pendingConversionRequest.sourceModelId} bound`, false);
    const fileName = `${conversionFileStem(entry.modelId)}.minimodel-conversion-request.json`;
    downloadTextFile(fileName, `${JSON.stringify(request, null, 2)}\n`);
    setHfStatus("conversion request saved locally", false);
    holdModelPopoverOpen(2500);
  }

  function saveHfConversionScript(entry, matches) {
    const request = hfConversionRequest(entry, matches);
    state.pendingConversionRequest = normalizeConversionRequest(request);
    setConversionRequestStatus(`${state.pendingConversionRequest.sourceModelId} bound`, false);
    const stem = conversionFileStem(entry.modelId);
    downloadTextFile(`${stem}.minimodel-conversion-request.json`, `${JSON.stringify(request, null, 2)}\n`);
    downloadTextFile(`${stem}.tinyrustlm-convert.ps1`, hfConversionScript(entry, matches), "text/plain");
    setHfStatus("conversion request and script saved locally", false);
    holdModelPopoverOpen(2500);
  }

  function renderAcceptedHfResults(accepted) {
    if (el.hfResults) {
      el.hfResults.replaceChildren();
      for (const entry of accepted) {
        const view = hfResultView(entry);
        const item = modelResultItem(entry.modelId);
        const status = elementWithText("span", hfCompatibilityClass(view), hfAdvancedStatusText(view));
        const meta = elementWithText("div", "model-result-meta", hfAdvancedMetaText(view));
        const actions = elementWithText("div", "model-result-actions", "");
        appendHfAdvancedActions(actions, entry, view);
        appendHfSourceFileNotes(actions, view);
        item.append(status, meta, actions);
        el.hfResults.append(item);
      }
    }
    renderSimpleHfResults(accepted);
  }

  function refreshHfResultsForCatalogChange() {
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderAcceptedHfResults(state.hfLastAccepted);
    }
  }

  function renderHfResults(results) {
    clearHfResults();
    const accepted = [];
    for (const result of results) {
      const modelId = hfModelId(result);
      if (modelId) {
        accepted.push({ result, modelId });
      }
      if (accepted.length >= hfSearchLimit) {
        break;
      }
    }
    state.hfLastAccepted = accepted;
    if (!accepted.length) {
      setHfStatus("no model records returned", false);
      return;
    }
    renderAcceptedHfResults(accepted);
    setHfStatus(`${accepted.length} external records; local .slm verification required`, false);
  }

  function renderSimpleHfResults(accepted) {
    if (!el.simpleHfResults) {
      return;
    }
    el.simpleHfResults.replaceChildren();
    for (const entry of accepted) {
      const view = hfResultView(entry);
      const item = modelResultItem(entry.modelId);
      const meta = elementWithText("div", "model-result-meta", hfSimpleMetaText(view));
      const actions = elementWithText("div", "model-result-actions", "");
      appendHfSimpleActions(actions, entry, view);
      appendHfSourceFileNotes(actions, view, {
        slmActionWord: "use it",
        noSlmText: hfSimpleFallbackNote(view)
      });
      item.append(meta, actions);
      el.simpleHfResults.append(item);
    }
  }

  async function searchHuggingFaceModels(options = {}) {
    const keepSimplePopover = Boolean(options.keepSimplePopover);
    if (keepSimplePopover) {
      setSimpleSourceOption("huggingface", true);
      holdModelPopoverOpen(5000);
    }
    const query = String(el.hfSearchInput && el.hfSearchInput.value ? el.hfSearchInput.value : "").trim();
    if (!query) {
      throw new Error("Enter a model search phrase");
    }
    if (state.hfSearchAbort) {
      state.hfSearchAbort.abort();
    }
    clearHfResults();
    setHfStatus("searching model-card metadata", false);
    const controller = new AbortController();
    state.hfSearchAbort = controller;
    const catalogAvailability = ensureDefaultCatalogForHfAvailability();
    const url = new URL(`${hfOrigin()}/api/models`);
    url.searchParams.set("search", query);
    url.searchParams.set("filter", "text-generation");
    url.searchParams.set("sort", "downloads");
    url.searchParams.set("direction", "-1");
    url.searchParams.set("limit", String(hfSearchLimit));
    url.searchParams.set("full", "true");
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`External model search failed (${response.status})`);
    }
    const results = await response.json();
    if (!Array.isArray(results)) {
      throw new Error("External model search returned an unexpected body");
    }
    await catalogAvailability;
    renderHfResults(results);
    if (keepSimplePopover) {
      holdModelPopoverOpen(3000);
    }
  }

  function isSafeRegistryModelPath(value) {
    if (!value || !value.startsWith("../models/") || !value.endsWith(".slm")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../models/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function adapterFormatForPath(value) {
    if (!value) {
      return null;
    }
    return adapterManifestFormats.find((format) => value.endsWith(format.extension)) || null;
  }

  function isSafeRegistryAdapterPath(value) {
    if (!value || !value.startsWith("../models/") || !adapterFormatForPath(value)) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../models/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeRegistryAdapterFamilyReceiptPath(value) {
    if (!value || !value.startsWith("../models/") || !value.endsWith(".adapter-family.receipt")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../models/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeRegistryAssemblyReceiptPath(value) {
    if (!value || !value.startsWith("../models/") || !value.endsWith(".assembly.receipt")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../models/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeRegistryModulePlanPath(value) {
    if (!value || !value.startsWith("../models/") || !value.endsWith(".module-plan.receipt")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../models/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeAssemblyEvidencePath(value) {
    if (!value || !value.startsWith("../evidence/")) {
      return false;
    }
    if (value.includes("\\") || value.includes("://") || value.includes("//")) {
      return false;
    }
    const rest = value.slice("../evidence/".length);
    return rest.split("/").every((part) => part && part !== "." && part !== "..");
  }

  function isSafeRegistrySourceManifestPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.source.manifest`;
    if (value !== expected) {
      return false;
    }
    return isSafeAssemblyEvidencePath(value);
  }

  function isSafeRegistrySourceReviewPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.source.review`;
    if (value !== expected) {
      return false;
    }
    return isSafeAssemblyEvidencePath(value);
  }

  function isSafeRegistrySourceValidationPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.source.validation`;
    if (value !== expected) {
      return false;
    }
    return isSafeAssemblyEvidencePath(value);
  }

  function isSafeRegistryAdmissionPath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.admission`;
    if (value !== expected) {
      return false;
    }
    return isSafeAssemblyEvidencePath(value);
  }

  function isSafeRegistryEvalEvidencePath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.eval`;
    if (value !== expected) {
      return false;
    }
    return isSafeAssemblyEvidencePath(value);
  }

  function isSafeRegistryRuntimeSmokePath(candidateId, value) {
    if (!isRegistrySlug(candidateId)) {
      return false;
    }
    const expected = `../evidence/${candidateId}/converted-trained.runtime`;
    if (value !== expected) {
      return false;
    }
    return isSafeAssemblyEvidencePath(value);
  }

  function isRegistryHex64(value) {
    return /^0x[0-9a-fA-F]{16}$/.test(value || "");
  }

  function isSourceModelSha(value) {
    const text = String(value || "");
    if (/^sha256:[0-9a-f]{64}$/i.test(text) || /^sha1:[0-9a-f]{40}$/i.test(text)) {
      return true;
    }
    return /^[0-9a-f]{40}$/i.test(text) || /^[0-9a-f]{64}$/i.test(text);
  }

  function isRegistrySlug(value) {
    return /^[A-Za-z0-9._-]{1,96}$/.test(value || "");
  }

  function rotateLeft64(value, bits) {
    return ((value << bits) | (value >> (64n - bits))) & checksumMask;
  }

  function textChecksumHex(text) {
    const bytes = state.encoder.encode(text);
    return bytesChecksumHex(bytes);
  }

  function evalCaseEvidenceChecksum(fields) {
    // Replays the Rust eval-case evidence digest over fetched sidecar case rows.
    const caseCount = registryDecimalCount(fields.case_count);
    if (caseCount === null) {
      throw new Error("eval evidence case_count mismatch");
    }
    const lines = [];
    for (const key of ["case_count", "cases_passed", "cases_failed"]) {
      lines.push(`${key}=${requireManifestField(fields, key, "eval evidence")}`);
    }
    for (let index = 0; index < caseCount; index += 1) {
      const prefix = `case.${index}`;
      for (const suffix of ["status", "expected", "actual", "error"]) {
        const key = `${prefix}.${suffix}`;
        lines.push(`${key}=${requireManifestField(fields, key, "eval evidence")}`);
      }
    }
    return textChecksumHex(`${lines.join("\n")}\n`);
  }

  function bytesChecksumHex(bytes) {
    let acc = 0x4d595df4d0f33173n;
    for (let index = 0; index < bytes.length; index += 1) {
      acc ^= BigInt(bytes[index]) + (BigInt(index) << 2n);
      acc = (rotateLeft64(acc, 9n) * checksumPrime) & checksumMask;
    }
    return `0x${acc.toString(16).padStart(16, "0")}`;
  }

  function adapterArtifactChecksumHex(bytes) {
    if (!bytes || bytes.length < 64) {
      throw new Error("Adapter artifact is too short");
    }
    let acc = 0x6164617074657231n;
    for (let index = 0; index < bytes.length; index += 1) {
      const value = index >= 56 && index < 64 ? 0 : bytes[index];
      acc ^= BigInt(value) + (BigInt(index) << 3n);
      acc = (rotateLeft64(acc, 11n) * checksumPrime) & checksumMask;
    }
    return `0x${acc.toString(16).padStart(16, "0")}`;
  }

  function requireManifestField(fields, key, source) {
    const value = fields[key];
    if (!value) {
      throw new Error(`Missing ${source || "receipt"} field ${key}`);
    }
    return value;
  }

  function requireManifestEqual(fields, key, expected, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (actual !== expected) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
  }

  function requireManifestOneOf(fields, key, expectedValues, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (!expectedValues.includes(actual)) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
  }

  // Validates 64-bit checksum text before using a manifest field as a route contract.
  function requireHex64ManifestField(fields, key, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (!isRegistryHex64(actual)) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
    return actual;
  }

  function requireSourceModelShaManifestField(fields, key, source) {
    const actual = requireManifestField(fields, key, source ? source.toLowerCase() : undefined);
    if (!isSourceModelSha(actual)) {
      throw new Error(`${source || "Receipt"} field ${key} was ${actual}`);
    }
    return actual;
  }

  function requireOptionalSourceReviewArtifact(fields, prefix) {
    // Validates optional candidate-review artifact rows before showing them in provenance.
    const status = fields[`${prefix}_artifact_status`];
    if (!status) {
      return null;
    }
    const kind = requireManifestField(fields, `${prefix}_artifact_kind`, "source review artifact");
    const checksum = requireManifestField(fields, `${prefix}_artifact_checksum`, "source review artifact");
    const bytesText = requireManifestField(fields, `${prefix}_artifact_bytes`, "source review artifact");
    const detail = requireManifestField(fields, `${prefix}_artifact_detail`, "source review artifact");
    if (status === "not-local") {
      for (const [label, value] of [["kind", kind], ["checksum", checksum], ["bytes", bytesText], ["detail", detail]]) {
        if (value !== "not-local") {
          throw new Error(`source review artifact ${prefix} ${label} was ${value}`);
        }
      }
      return { status, kind, checksum, bytesText, detail };
    }
    if (!/^[a-z0-9._-]+$/.test(status) || !/^[a-z0-9._-]+$/.test(kind)) {
      throw new Error(`source review artifact ${prefix} identity was invalid`);
    }
    if (!isRegistryHex64(checksum)) {
      throw new Error(`source review artifact ${prefix} checksum was ${checksum}`);
    }
    if (registryDecimalCount(bytesText) === null) {
      throw new Error(`source review artifact ${prefix} bytes was ${bytesText}`);
    }
    if (!detail || detail.includes("\n") || detail.includes("\r")) {
      throw new Error(`source review artifact ${prefix} detail was invalid`);
    }
    return { status, kind, checksum, bytesText, detail };
  }

  function requireSourceReviewTokenizerImport(fields) {
    // Binds imported tokenizer rows to the fetched source-review sidecar.
    const status = requireManifestField(fields, "source_tokenizer_import_status", "source review");
    const tokenCountText = requireManifestField(fields, "source_tokenizer_import_token_count", "source review");
    const mergeCountText = requireManifestField(fields, "source_tokenizer_import_merge_count", "source review");
    const checksum = requireHex64ManifestField(fields, "source_tokenizer_import_checksum", "source review");
    const tokenCount = registryDecimalIndex(tokenCountText);
    const mergeCount = registryDecimalIndex(mergeCountText);
    if (tokenCount === null || mergeCount === null) {
      throw new Error(`source review tokenizer import counts were ${tokenCountText}/${mergeCountText}`);
    }
    if (status === "not-imported") {
      if (tokenCount !== 0 || mergeCount !== 0 || checksum !== "0x0000000000000000") {
        throw new Error("source review tokenizer import not-imported row had imported evidence");
      }
      return { status, tokenCount, mergeCount, checksum };
    }
    if (status !== "byte-fallback-bpe-compatible") {
      throw new Error(`source review tokenizer import status was ${status}`);
    }
    if (tokenCount < 1 || mergeCount < 1 || checksum === "0x0000000000000000") {
      throw new Error("source review tokenizer import compatible row was empty");
    }
    return { status, tokenCount, mergeCount, checksum };
  }

  // Keeps adapter kind and dtype coupled so source-backed ALR1 cannot masquerade as plain ALR1.
  function requireAdapterKindDtypePair(fields, kindKey, dtypeKey, kindDtypePairs, source) {
    const kind = requireManifestField(fields, kindKey, source ? source.toLowerCase() : undefined);
    const dtype = requireManifestField(fields, dtypeKey, source ? source.toLowerCase() : undefined);
    const matched = kindDtypePairs.some(([acceptedKind, acceptedDtype]) => {
      return kind === acceptedKind && dtype === acceptedDtype;
    });
    if (!matched) {
      throw new Error(`${source || "Receipt"} adapter kind/dtype pair was ${kind}/${dtype}`);
    }
    return kind;
  }

  function requireChecksumEqual(actual, expected, label) {
    if (!isRegistryHex64(actual) || actual.toLowerCase() !== String(expected || "").toLowerCase()) {
      throw new Error(`${label} checksum mismatch`);
    }
  }

  function adapterApplyStatusForQuantization(adapterFormat, quantization) {
    if (!adapterFormat) {
      return null;
    }
    if (quantization === "f32") {
      return adapterFormat.applyStatus;
    }
    if (quantization === "q8_0" || quantization === "q4_0") {
      return adapterFormat.quantizedApplyStatus;
    }
    return null;
  }

  function registryAdapterFromFields(
    fields,
    pathKey,
    manifestKey,
    labelKey,
    applyStatusKey,
    artifactChecksumKey,
    manifestChecksumKey,
    baseQuantization
  ) {
    const adapterPath = fields[pathKey];
    if (!isSafeRegistryAdapterPath(adapterPath)) {
      return null;
    }
    const adapterFormat = adapterFormatForPath(adapterPath);
    const manifestPath = fields[manifestKey];
    if (manifestPath && manifestPath !== `${adapterPath}.manifest`) {
      return null;
    }
    const applyStatus = fields[applyStatusKey];
    const expectedApplyStatus = adapterApplyStatusForQuantization(adapterFormat, baseQuantization);
    if (!expectedApplyStatus || (applyStatus && applyStatus !== expectedApplyStatus)) {
      return null;
    }
    if (applyStatus && !registryAdapterApplyStatuses.has(applyStatus)) {
      return null;
    }
    const artifactChecksum = fields[artifactChecksumKey];
    const manifestChecksum = fields[manifestChecksumKey];
    if (!isRegistryHex64(artifactChecksum) || !isRegistryHex64(manifestChecksum)) {
      return null;
    }
    return {
      label: fields[labelKey] || adapterFormat.defaultLabel,
      path: adapterPath,
      manifestPath: manifestPath || `${adapterPath}.manifest`,
      applyStatus: applyStatus || expectedApplyStatus,
      baseQuantization,
      artifactChecksum,
      manifestChecksum
    };
  }

  function registryAdapterEntries(fields, prefix, baseQuantization) {
    const adapterCountValue = fields[`${prefix}.adapter_count`];
    if (adapterCountValue) {
      const adapterCount = Number.parseInt(adapterCountValue, 10);
      if (!Number.isInteger(adapterCount) || adapterCount < 1 || adapterCount > 16) {
        return null;
      }
      const adapters = [];
      const seenPaths = new Set();
      for (let adapterIndex = 0; adapterIndex < adapterCount; adapterIndex += 1) {
        const adapterPrefix = `${prefix}.adapter.${adapterIndex}`;
        const adapter = registryAdapterFromFields(
          fields,
          `${adapterPrefix}.path`,
          `${adapterPrefix}.manifest_path`,
          `${adapterPrefix}.label`,
          `${adapterPrefix}.apply_status`,
          `${adapterPrefix}.artifact_checksum`,
          `${adapterPrefix}.manifest_checksum`,
          baseQuantization
        );
        if (!adapter || seenPaths.has(adapter.path)) {
          return null;
        }
        seenPaths.add(adapter.path);
        adapters.push(adapter);
      }
      return adapters;
    }
    if (!fields[`${prefix}.adapter_path`]) {
      return [];
    }
    const adapter = registryAdapterFromFields(
      fields,
      `${prefix}.adapter_path`,
      `${prefix}.adapter_manifest_path`,
      `${prefix}.adapter_label`,
      `${prefix}.adapter_apply_status`,
      `${prefix}.adapter_artifact_checksum`,
      `${prefix}.adapter_manifest_checksum`,
      baseQuantization
    );
    return adapter ? [adapter] : null;
  }

  function registryAdapterFamilyEntry(fields, prefix, adapterCount) {
    const keys = [
      "adapter_family_receipt_path",
      "adapter_family_receipt_checksum",
      "adapter_family_label",
      "adapter_family_status",
      "adapter_family_strategy",
      "adapter_family_adapter_count",
      "adapter_auto_apply_status",
      "adapter_auto_apply_strategy",
      "adapter_auto_apply_stack_status",
      "adapter_auto_apply_stack_strategy",
      "adapter_auto_apply_stack_count",
      "adapter_auto_apply_byte_budget"
    ];
    const hasFamily = keys.some((key) => fields[`${prefix}.${key}`]);
    if (!hasFamily) {
      return undefined;
    }
    const receiptPath = fields[`${prefix}.adapter_family_receipt_path`];
    const receiptChecksum = fields[`${prefix}.adapter_family_receipt_checksum`];
    const familyCount = Number.parseInt(fields[`${prefix}.adapter_family_adapter_count`] || "0", 10);
    const stackCount = Number.parseInt(fields[`${prefix}.adapter_auto_apply_stack_count`] || "0", 10);
    const autoApplyByteBudget = registryAdapterAutoApplyBudget(
      fields[`${prefix}.adapter_auto_apply_byte_budget`]
    );
    if (!isSafeRegistryAdapterFamilyReceiptPath(receiptPath) || !isRegistryHex64(receiptChecksum)) {
      return null;
    }
    if (fields[`${prefix}.adapter_family_status`] !== registryAdapterFamilyStatus) {
      return null;
    }
    if (fields[`${prefix}.adapter_family_strategy`] !== registryAdapterFamilyStrategy) {
      return null;
    }
    if (fields[`${prefix}.adapter_auto_apply_status`] !== registryAdapterAutoApplyStatus) {
      return null;
    }
    if (fields[`${prefix}.adapter_auto_apply_strategy`] !== registryAdapterAutoApplyStrategy) {
      return null;
    }
    if (fields[`${prefix}.adapter_auto_apply_stack_status`] !== registryAdapterAutoApplyStackStatus) {
      return null;
    }
    if (fields[`${prefix}.adapter_auto_apply_stack_strategy`] !== registryAdapterAutoApplyStackStrategy) {
      return null;
    }
    if (!Number.isInteger(stackCount) || stackCount < 1 || stackCount > familyCount) {
      return null;
    }
    if (autoApplyByteBudget === null) {
      return null;
    }
    if (!Number.isInteger(familyCount) || familyCount !== adapterCount || familyCount < 2 || familyCount > 16) {
      return null;
    }
    return {
      label: fields[`${prefix}.adapter_family_label`] || "ADP1 adapter family",
      path: receiptPath,
      checksum: receiptChecksum,
      strategy: fields[`${prefix}.adapter_family_strategy`],
      count: familyCount,
      autoApplyStatus: fields[`${prefix}.adapter_auto_apply_status`],
      autoApplyStrategy: fields[`${prefix}.adapter_auto_apply_strategy`],
      autoApplyStackStatus: fields[`${prefix}.adapter_auto_apply_stack_status`],
      autoApplyStackStrategy: fields[`${prefix}.adapter_auto_apply_stack_strategy`],
      autoApplyStackCount: stackCount,
      autoApplyByteBudget
    };
  }

  function registryAssemblyEntry(fields, prefix) {
    const keys = [
      "assembly_receipt_path",
      "assembly_receipt_checksum",
      "assembly_label",
      "assembly_status",
      "assembly_kind"
    ];
    const hasAssembly = keys.some((key) => fields[`${prefix}.${key}`]);
    if (!hasAssembly) {
      return undefined;
    }
    const receiptPath = fields[`${prefix}.assembly_receipt_path`];
    const receiptChecksum = fields[`${prefix}.assembly_receipt_checksum`];
    if (!isSafeRegistryAssemblyReceiptPath(receiptPath) || !isRegistryHex64(receiptChecksum)) {
      return null;
    }
    if (fields[`${prefix}.assembly_status`] !== registryAssemblyStatus) {
      return null;
    }
    if (fields[`${prefix}.assembly_kind`] !== registryAssemblyKind) {
      return null;
    }
    return {
      label: fields[`${prefix}.assembly_label`] || "Assembly evidence",
      path: receiptPath,
      checksum: receiptChecksum,
      status: fields[`${prefix}.assembly_status`],
      kind: fields[`${prefix}.assembly_kind`]
    };
  }

  // Maps generated parent-pool entries to the operator kind their assembly route implies.
  function expectedGeneratedOperatorReceiptKind(candidateId, assembly) {
    if (!assembly) {
      return "";
    }
    const id = String(candidateId || "");
    if (id.startsWith("multi-parent-soup-")) {
      return "seed-weighted-parent-pool-soup";
    }
    if (id.startsWith("multi-parent-sign-merge-")) {
      return "sign-aware-parent-pool-merge";
    }
    return "";
  }

  // Maps a receipt operator kind to the exact schedule family fields the browser accepts.
  function expectedEvolutionScheduleFamily(operatorKind) {
    if (operatorKind === "seed-weighted-parent-pool-soup") {
      return {
        familyIndex: 1,
        familyCommand: "soup-candidate",
        familySelectionRule: "seed-weighted-direct-parameter-average",
        familyOutputGate: "multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval"
      };
    }
    if (operatorKind === "sign-aware-parent-pool-merge") {
      return {
        familyIndex: 0,
        familyCommand: "sign-merge-candidate",
        familySelectionRule: "seed-weighted-delta-sign-consensus",
        familyOutputGate: "multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval"
      };
    }
    return null;
  }

  // Reads selector genome routing fields before a registry entry can become selectable.
  function registryGenomeEntry(fields, prefix) {
    const genomeId = fields[`${prefix}.genome_id`];
    const strategy = fields[`${prefix}.genome_strategy`];
    const lineageStatus = fields[`${prefix}.genome_lineage_status`];
    const lineageChecksum = fields[`${prefix}.genome_lineage_checksum`];
    if (
      !isRegistryHex64(genomeId) ||
      strategy !== registryGenomeStrategy ||
      lineageStatus !== registryGenomeLineageStatus ||
      !isRegistryHex64(lineageChecksum)
    ) {
      return null;
    }
    return {
      id: genomeId,
      strategy,
      lineageStatus,
      lineageChecksum
    };
  }

  // Reads selector species-fit fields that group candidates by browser-compatible traits.
  function registrySpeciesEntry(fields, prefix) {
    const speciesId = fields[`${prefix}.species_id`];
    const strategy = fields[`${prefix}.species_strategy`];
    const fitStatus = fields[`${prefix}.species_fit_status`];
    const fitChecksum = fields[`${prefix}.species_fit_checksum`];
    if (
      !isRegistryHex64(speciesId) ||
      strategy !== registrySpeciesStrategy ||
      fitStatus !== registrySpeciesFitStatus ||
      !isRegistryHex64(fitChecksum)
    ) {
      return null;
    }
    return {
      id: speciesId,
      strategy,
      fitStatus,
      fitChecksum
    };
  }

  // Reads selector novelty sketches that preserve behavior variety across candidates.
  function registryNoveltyEntry(fields, prefix) {
    const noveltyId = fields[`${prefix}.novelty_id`];
    const strategy = fields[`${prefix}.novelty_strategy`];
    const status = fields[`${prefix}.novelty_status`];
    const checksum = fields[`${prefix}.novelty_checksum`];
    if (
      !isRegistryHex64(noveltyId) ||
      strategy !== registryNoveltyStrategy ||
      status !== registryNoveltyStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: noveltyId,
      strategy,
      status,
      checksum
    };
  }

  // Reads selector population review routes that connect candidates to population context.
  function registryPopulationEntry(fields, prefix) {
    const populationId = fields[`${prefix}.population_id`];
    const strategy = fields[`${prefix}.population_strategy`];
    const status = fields[`${prefix}.population_status`];
    const checksum = fields[`${prefix}.population_checksum`];
    if (
      !isRegistryHex64(populationId) ||
      strategy !== registryPopulationStrategy ||
      status !== registryPopulationStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: populationId,
      strategy,
      status,
      checksum
    };
  }

  // Reads selector mate-selection routes that bind parent-pool recipes to provenance.
  function registryMateSelectionEntry(fields, prefix) {
    const mateSelectionId = fields[`${prefix}.mate_selection_id`];
    const strategy = fields[`${prefix}.mate_selection_strategy`];
    const status = fields[`${prefix}.mate_selection_status`];
    const parentCount = registryDecimalByteCount(fields[`${prefix}.mate_selection_parent_count`]);
    const checksum = fields[`${prefix}.mate_selection_checksum`];
    const isKnownStatus =
      status === registryMateSelectionParentPoolStatus ||
      status === registryMateSelectionAdmissionStatus;
    if (
      !isRegistryHex64(mateSelectionId) ||
      strategy !== registryMateSelectionStrategy ||
      !isKnownStatus ||
      parentCount === null ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    if (status === registryMateSelectionParentPoolStatus && parentCount < 2) {
      return null;
    }
    if (status === registryMateSelectionAdmissionStatus && parentCount !== 1) {
      return null;
    }
    return {
      id: mateSelectionId,
      strategy,
      status,
      parentCount,
      checksum
    };
  }

  // Reads copied operator receipt metadata and checks generated route kind agreement.
  function registryOperatorReceiptEntry(fields, prefix, candidateId, assembly, modelBytes, slmChecksum) {
    const suffixes = [
      "operator_receipt_status",
      "operator_receipt_path",
      "operator_receipt_checksum",
      "operator_receipt_operator_id",
      "operator_receipt_operator_kind",
      "operator_receipt_candidate_slm_checksum",
      "operator_receipt_candidate_artifact_bytes"
    ];
    const hasReceiptField = suffixes.some((suffix) => fields[`${prefix}.${suffix}`] !== undefined);
    if (!hasReceiptField) {
      return undefined;
    }
    const status = fields[`${prefix}.operator_receipt_status`];
    const path = fields[`${prefix}.operator_receipt_path`];
    const checksum = fields[`${prefix}.operator_receipt_checksum`];
    const operatorId = fields[`${prefix}.operator_receipt_operator_id`];
    const operatorKind = fields[`${prefix}.operator_receipt_operator_kind`];
    const candidateSlmChecksum = fields[`${prefix}.operator_receipt_candidate_slm_checksum`];
    const candidateArtifactBytes = registryDecimalByteCount(
      fields[`${prefix}.operator_receipt_candidate_artifact_bytes`]
    );
    const expectedOperatorKind = expectedGeneratedOperatorReceiptKind(candidateId, assembly);
    if (
      status !== registryOperatorReceiptStatus ||
      !path ||
      !isRegistryHex64(checksum) ||
      !operatorId ||
      !operatorKind ||
      (expectedOperatorKind && operatorKind !== expectedOperatorKind) ||
      candidateSlmChecksum !== slmChecksum ||
      candidateArtifactBytes !== modelBytes
    ) {
      return null;
    }
    return {
      status,
      path,
      checksum,
      operatorId,
      operatorKind,
      candidateSlmChecksum,
      candidateArtifactBytes
    };
  }

  // Reads copied parent-pool schedule metadata and binds it to the accepted operator receipt.
  function registryEvolutionScheduleEntry(fields, prefix, operatorReceipt) {
    const suffixes = [
      "evolution_recipe_version",
      "evolution_recipe_strategy",
      "evolution_recipe_status",
      "evolution_selection_source",
      "evolution_relatedness_contract_checksum",
      "evolution_schedule_checksum_algorithm",
      "evolution_schedule_checksum",
      "scheduled_operator_family_index",
      "scheduled_operator_family_kind",
      "scheduled_operator_family_command",
      "scheduled_operator_family_selection_rule",
      "scheduled_operator_family_output_gate"
    ];
    const hasScheduleField = suffixes.some((suffix) => fields[`${prefix}.${suffix}`] !== undefined);
    if (!hasScheduleField) {
      return undefined;
    }
    if (!operatorReceipt) {
      return null;
    }
    const recipeVersion = fields[`${prefix}.evolution_recipe_version`];
    const recipeStrategy = fields[`${prefix}.evolution_recipe_strategy`];
    const recipeStatus = fields[`${prefix}.evolution_recipe_status`];
    const selectionSource = fields[`${prefix}.evolution_selection_source`];
    const relatednessContractChecksum = fields[`${prefix}.evolution_relatedness_contract_checksum`];
    const scheduleChecksumAlgorithm = fields[`${prefix}.evolution_schedule_checksum_algorithm`];
    const scheduleChecksum = fields[`${prefix}.evolution_schedule_checksum`];
    const familyIndex = registryDecimalIndex(fields[`${prefix}.scheduled_operator_family_index`]);
    const familyKind = fields[`${prefix}.scheduled_operator_family_kind`];
    const familyCommand = fields[`${prefix}.scheduled_operator_family_command`];
    const familySelectionRule = fields[`${prefix}.scheduled_operator_family_selection_rule`];
    const familyOutputGate = fields[`${prefix}.scheduled_operator_family_output_gate`];
    const expectedFamily = expectedEvolutionScheduleFamily(operatorReceipt.operatorKind);
    if (
      recipeVersion !== registryEvolutionRecipeVersion ||
      recipeStrategy !== registryEvolutionRecipeStrategy ||
      recipeStatus !== registryEvolutionRecipeStatus ||
      selectionSource !== registryEvolutionSelectionSource ||
      !isRegistryHex64(relatednessContractChecksum) ||
      scheduleChecksumAlgorithm !== registryEvolutionScheduleChecksumAlgorithm ||
      !isRegistryHex64(scheduleChecksum) ||
      familyIndex === null ||
      !isRegistrySlug(familyKind) ||
      !isRegistrySlug(familyCommand) ||
      !isRegistrySlug(familySelectionRule) ||
      !isRegistrySlug(familyOutputGate) ||
      familyKind !== operatorReceipt.operatorKind ||
      !expectedFamily ||
      familyIndex !== expectedFamily.familyIndex ||
      familyCommand !== expectedFamily.familyCommand ||
      familySelectionRule !== expectedFamily.familySelectionRule ||
      familyOutputGate !== expectedFamily.familyOutputGate
    ) {
      return null;
    }
    return {
      recipeVersion,
      recipeStrategy,
      recipeStatus,
      selectionSource,
      relatednessContractChecksum,
      scheduleChecksumAlgorithm,
      scheduleChecksum,
      familyIndex,
      familyKind,
      familyCommand,
      familySelectionRule,
      familyOutputGate
    };
  }

  // Reads selector phenotype evidence that binds runtime and eval observations to provenance.
  function registryPhenotypeEvidenceEntry(fields, prefix) {
    const phenotypeEvidenceId = fields[`${prefix}.phenotype_evidence_id`];
    const strategy = fields[`${prefix}.phenotype_evidence_strategy`];
    const status = fields[`${prefix}.phenotype_evidence_status`];
    const checksum = fields[`${prefix}.phenotype_evidence_checksum`];
    if (
      !isRegistryHex64(phenotypeEvidenceId) ||
      strategy !== registryPhenotypeEvidenceStrategy ||
      status !== registryPhenotypeEvidenceStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: phenotypeEvidenceId,
      strategy,
      status,
      checksum
    };
  }

  // Reads selector heritable artifact metadata that binds served model identity to provenance.
  function registryHeritableArtifactEntry(fields, prefix) {
    const artifactId = fields[`${prefix}.heritable_artifact_id`];
    const strategy = fields[`${prefix}.heritable_artifact_strategy`];
    const status = fields[`${prefix}.heritable_artifact_status`];
    const checksum = fields[`${prefix}.heritable_artifact_checksum`];
    if (
      !isRegistryHex64(artifactId) ||
      strategy !== registryHeritableArtifactStrategy ||
      status !== registryHeritableArtifactStatus ||
      !isRegistryHex64(checksum)
    ) {
      return null;
    }
    return {
      id: artifactId,
      strategy,
      status,
      checksum
    };
  }

  // Reads scoped eval facts as a compact fitness vector for selector provenance.
  function registryEvalEvidenceEntry(fields, prefix, candidateId) {
    const path = fields[`${prefix}.eval_path`] || "";
    const checksum = fields[`${prefix}.eval_case_evidence_checksum`];
    const manifestChecksum = fields[`${prefix}.eval_manifest_checksum`];
    const casesPassed = registryDecimalByteCount(fields[`${prefix}.cases_passed`]);
    const fitnessVectorStatus = fields[`${prefix}.fitness_vector_status`];
    const fitnessVectorChecksum = fields[`${prefix}.fitness_vector_checksum`];
    if (
      (path && !isSafeRegistryEvalEvidencePath(candidateId, path)) ||
      !isRegistryHex64(checksum) ||
      !isRegistryHex64(manifestChecksum) ||
      casesPassed === null ||
      fitnessVectorStatus !== registryFitnessVectorStatus ||
      !isRegistryHex64(fitnessVectorChecksum)
    ) {
      return null;
    }
    return {
      path,
      checksum,
      manifestChecksum,
      casesPassed,
      fitnessVectorStatus,
      fitnessVectorChecksum,
      qualityScope: fields[`${prefix}.quality_scope`] || "",
      qualityBoundary: fields[`${prefix}.quality_boundary`] || "",
      evalDataset: fields[`${prefix}.eval_dataset`] || ""
    };
  }

  function registryRuntimeSmokeEvidenceEntry(fields, prefix, candidateId) {
    // Reads an optional converted-trained runtime-smoke sidecar route for browser verification.
    const path = fields[`${prefix}.runtime_smoke_path`] || "";
    const manifestChecksum = fields[`${prefix}.runtime_smoke_manifest_checksum`] || "";
    if (
      (path && !isSafeRegistryRuntimeSmokePath(candidateId, path)) ||
      !isRegistryHex64(manifestChecksum)
    ) {
      return null;
    }
    return {
      path,
      manifestChecksum,
      verified: false,
      fields: null
    };
  }

  function registrySourceManifestEntry(fields, prefix, candidateId) {
    // Reads selector-carried source snapshot identity so browser fetches can bind to it.
    const keys = [
      "source_manifest_path",
      "source_manifest_checksum",
      "source_manifest_kind",
      "source_manifest_status",
      "source_manifest_source_kind",
      "source_manifest_source_id",
      "source_manifest_model_shape",
      "source_review_kind",
      "source_review_path",
      "source_review_status",
      "source_review_checksum",
      "source_review_required_next_gate"
    ];
    const hasSourceManifest = keys.some((key) => fields[`${prefix}.${key}`]);
    if (!hasSourceManifest) {
      return undefined;
    }
    const path = fields[`${prefix}.source_manifest_path`] || "";
    const checksum = fields[`${prefix}.source_manifest_checksum`] || "";
    const kind = fields[`${prefix}.source_manifest_kind`] || "";
    const status = fields[`${prefix}.source_manifest_status`] || "";
    const sourceKind = fields[`${prefix}.source_manifest_source_kind`] || "";
    const sourceId = fields[`${prefix}.source_manifest_source_id`] || "";
    const modelShape = fields[`${prefix}.source_manifest_model_shape`] || "";
    const reviewKeys = [
      "source_review_kind",
      "source_review_path",
      "source_review_status",
      "source_review_checksum",
      "source_review_required_next_gate"
    ];
    const hasSourceReview = reviewKeys.some((key) => fields[`${prefix}.${key}`]);
    let sourceReview = null;
    if (hasSourceReview) {
      const reviewKind = fields[`${prefix}.source_review_kind`] || "";
      const reviewPath = fields[`${prefix}.source_review_path`] || "";
      const reviewStatus = fields[`${prefix}.source_review_status`] || "";
      const reviewChecksum = fields[`${prefix}.source_review_checksum`] || "";
      const reviewRequiredNextGate =
        fields[`${prefix}.source_review_required_next_gate`] || "";
      if (
        reviewKind !== registrySourceReviewKind ||
        !isSafeRegistrySourceReviewPath(candidateId, reviewPath) ||
        reviewStatus !== registrySourceReviewStatus ||
        !isRegistryHex64(reviewChecksum) ||
        reviewRequiredNextGate !== registrySourceReviewRequiredNextGate
      ) {
        return null;
      }
      sourceReview = {
        kind: reviewKind,
        path: reviewPath,
        status: reviewStatus,
        checksum: reviewChecksum,
        requiredNextGate: reviewRequiredNextGate
      };
    }
    if (
      !isSafeRegistrySourceManifestPath(candidateId, path) ||
      !isRegistryHex64(checksum) ||
      kind !== registrySourceManifestKind ||
      status !== registrySourceManifestStatus ||
      !["trained-source-fixture", "trained-export"].includes(sourceKind) ||
      !isRegistrySlug(sourceId) ||
      !isRegistrySlug(modelShape)
    ) {
      return null;
    }
    return { path, checksum, kind, status, sourceKind, sourceId, modelShape, sourceReview };
  }

  function registrySourceValidationEntry(fields, prefix, candidateId) {
    // Reads the converted-trained validate-source sidecar route when a registry entry exposes it.
    const path = fields[`${prefix}.source_validation_path`] || "";
    const checksum = fields[`${prefix}.source_validation_checksum`] || "";
    if (!path && !checksum) {
      return undefined;
    }
    if (!isSafeRegistrySourceValidationPath(candidateId, path) || !isRegistryHex64(checksum)) {
      return null;
    }
    return {
      path,
      checksum,
      verified: false,
      fields: null
    };
  }

  function registryAdmissionEvidenceEntry(fields, prefix, candidateId) {
    // Reads the selector admission sidecar route when converted-trained entries expose it.
    const path = fields[`${prefix}.admission_path`] || "";
    const checksum = fields[`${prefix}.admission_checksum`] || "";
    if (!path) {
      return undefined;
    }
    if (!isSafeRegistryAdmissionPath(candidateId, path) || !isRegistryHex64(checksum)) {
      return null;
    }
    return {
      path,
      checksum,
      verified: false,
      fields: null
    };
  }

  function registryModulePlanEntry(
    fields,
    prefix,
    candidateId,
    modelPath,
    adapters,
    adapterFamily,
    assembly,
    modelBytes,
    tokenizerChecksum,
    contextTokenLimit,
    maxTokens
  ) {
    const keys = [
      "module_plan_path",
      "module_plan_checksum",
      "module_plan_label",
      "module_plan_status",
      "module_plan_kind",
      "module_plan_strategy",
      "module_plan_resource_class",
      "module_plan_profile",
      "module_plan_execution_profile",
      "module_plan_fetch_policy",
      "module_plan_origin_policy",
      "module_plan_fetch_count_limit",
      "module_plan_planned_fetch_count",
      "module_plan_route_set_version",
      "module_plan_route_set_checksum_algorithm",
      "module_plan_route_set_checksum",
      "module_plan_operator_receipt_path",
      "module_plan_operator_receipt_checksum",
      "module_plan_wasm_memory_initial_pages",
      "module_plan_wasm_export_set",
      "module_plan_wasm_transfer_strategy",
      "module_plan_model_release_strategy",
      "module_plan_runtime_reset_strategy",
      "module_plan_adapter_validation_strategy",
      "module_plan_adapter_validation_count",
      "module_plan_adapter_apply_count",
      "module_plan_wasm_heap_min_bytes",
      "module_plan_context_token_limit",
      "module_plan_sampler_candidate_cap",
      "module_plan_tokenizer_checksum",
      "module_plan_model_byte_budget",
      "module_plan_adapter_byte_budget",
      "module_plan_adapter_stack_byte_budget",
      "module_plan_prompt_byte_limit",
      "module_plan_runtime_scratch_byte_budget",
      "module_plan_output_byte_limit",
      "module_plan_kv_cache_byte_budget",
      "module_plan_kv_cache_page_count",
      "module_plan_total_byte_budget",
      "module_plan_total_byte_budget_limit",
      "module_plan_module_count"
    ];
    const hasModulePlan = keys.some((key) => fields[`${prefix}.${key}`]);
    if (!hasModulePlan) {
      return undefined;
    }
    const receiptPath = fields[`${prefix}.module_plan_path`];
    const receiptChecksum = fields[`${prefix}.module_plan_checksum`];
    const moduleCount = Number.parseInt(fields[`${prefix}.module_plan_module_count`] || "0", 10);
    const wasmMemoryInitialPages = Number.parseInt(
      fields[`${prefix}.module_plan_wasm_memory_initial_pages`] || "0",
      10
    );
    const fetchCountLimit = registryDecimalCount(
      fields[`${prefix}.module_plan_fetch_count_limit`]
    );
    const plannedFetchCount = registryDecimalCount(
      fields[`${prefix}.module_plan_planned_fetch_count`]
    );
    const routeSetVersion = fields[`${prefix}.module_plan_route_set_version`] || "";
    const routeSetChecksumAlgorithm = fields[`${prefix}.module_plan_route_set_checksum_algorithm`] || "";
    const routeSetChecksum = fields[`${prefix}.module_plan_route_set_checksum`] || "";
    const operatorReceiptPath = fields[`${prefix}.module_plan_operator_receipt_path`] || "";
    const operatorReceiptChecksum =
      fields[`${prefix}.module_plan_operator_receipt_checksum`] || "";
    const wasmExportSet = fields[`${prefix}.module_plan_wasm_export_set`] || "";
    const wasmHeapMinBytes = registryDecimalByteCount(
      fields[`${prefix}.module_plan_wasm_heap_min_bytes`]
    );
    const planContextTokenLimit = registryDecimalCount(
      fields[`${prefix}.module_plan_context_token_limit`]
    );
    const samplerCandidateCap = registryDecimalCount(
      fields[`${prefix}.module_plan_sampler_candidate_cap`]
    );
    const adapterApplyCount = registryDecimalCount(
      fields[`${prefix}.module_plan_adapter_apply_count`]
    );
    const adapterValidationCount = registryDecimalCount(
      fields[`${prefix}.module_plan_adapter_validation_count`]
    );
    const planTokenizerChecksum = fields[`${prefix}.module_plan_tokenizer_checksum`] || "";
    const modelByteBudget = registryDecimalByteCount(fields[`${prefix}.module_plan_model_byte_budget`]);
    const adapterByteBudget = registryDecimalByteCount(fields[`${prefix}.module_plan_adapter_byte_budget`]);
    const adapterStackByteBudget = registryDecimalByteCount(
      fields[`${prefix}.module_plan_adapter_stack_byte_budget`]
    );
    const promptByteLimit = registryDecimalByteCount(fields[`${prefix}.module_plan_prompt_byte_limit`]);
    const runtimeScratchByteBudget = registryDecimalByteCount(
      fields[`${prefix}.module_plan_runtime_scratch_byte_budget`]
    );
    const outputByteLimit = registryDecimalByteCount(fields[`${prefix}.module_plan_output_byte_limit`]);
    const kvCacheByteBudget = registryDecimalByteCount(fields[`${prefix}.module_plan_kv_cache_byte_budget`]);
    const kvCachePageCount = Number.parseInt(fields[`${prefix}.module_plan_kv_cache_page_count`] || "0", 10);
    const totalByteBudget = registryDecimalByteCount(fields[`${prefix}.module_plan_total_byte_budget`]);
    const totalByteBudgetLimit = registryDecimalByteCount(
      fields[`${prefix}.module_plan_total_byte_budget_limit`]
    );
    if (!isSafeRegistryModulePlanPath(receiptPath) || !isRegistryHex64(receiptChecksum)) {
      return null;
    }
    if (fields[`${prefix}.module_plan_status`] !== registryModulePlanStatus) {
      return null;
    }
    if (fields[`${prefix}.module_plan_kind`] !== registryModulePlanKind) {
      return null;
    }
    if (fields[`${prefix}.module_plan_strategy`] !== registryModulePlanStrategy) {
      return null;
    }
    if (fields[`${prefix}.module_plan_resource_class`] !== registryModulePlanResourceClass) {
      return null;
    }
    if (fields[`${prefix}.module_plan_profile`] !== registryModulePlanProfile) {
      return null;
    }
    if (fields[`${prefix}.module_plan_execution_profile`] !== registryModulePlanExecutionProfile) {
      return null;
    }
    if (fields[`${prefix}.module_plan_fetch_policy`] !== registryModulePlanFetchPolicy) {
      return null;
    }
    if (fields[`${prefix}.module_plan_origin_policy`] !== registryModulePlanOriginPolicy) {
      return null;
    }
    if (
      fetchCountLimit === null ||
      fetchCountLimit !== registryModulePlanFetchCountLimit
    ) {
      return null;
    }
    if (
      !Number.isInteger(wasmMemoryInitialPages) ||
      String(wasmMemoryInitialPages) !== fields[`${prefix}.module_plan_wasm_memory_initial_pages`] ||
      wasmMemoryInitialPages !== registryModulePlanWasmMemoryInitialPages
    ) {
      return null;
    }
    if (wasmExportSet !== registryModulePlanWasmExportSet) {
      return null;
    }
    if (fields[`${prefix}.module_plan_wasm_transfer_strategy`] !== registryModulePlanWasmTransferStrategy) {
      return null;
    }
    if (fields[`${prefix}.module_plan_model_release_strategy`] !== registryModulePlanModelReleaseStrategy) {
      return null;
    }
    if (fields[`${prefix}.module_plan_runtime_reset_strategy`] !== registryModulePlanRuntimeResetStrategy) {
      return null;
    }
    if (
      fields[`${prefix}.module_plan_adapter_validation_strategy`] !==
      registryModulePlanAdapterValidationStrategy
    ) {
      return null;
    }
    if (
      adapterApplyCount === null ||
      !adapterFamily ||
      adapterApplyCount !== adapterFamily.autoApplyStackCount ||
      adapterApplyCount !== registryModulePlanAdapterApplyCount
    ) {
      return null;
    }
    if (
      adapterValidationCount === null ||
      !adapterFamily ||
      adapterValidationCount !== adapterFamily.autoApplyStackCount ||
      adapterValidationCount !== adapterApplyCount ||
      adapterValidationCount !== registryModulePlanAdapterValidationCount
    ) {
      return null;
    }
    if (
      planContextTokenLimit === null ||
      planContextTokenLimit !== contextTokenLimit ||
      planContextTokenLimit < maxTokens ||
      planContextTokenLimit > registryModulePlanContextTokenLimitLimit
    ) {
      return null;
    }
    // Keeps generated module plans bound to the runtime's fixed-size sampler candidate buffer.
    if (
      samplerCandidateCap === null ||
      samplerCandidateCap !== registryModulePlanSamplerCandidateCap
    ) {
      return null;
    }
    if (
      !isRegistryHex64(planTokenizerChecksum) ||
      !isRegistryHex64(tokenizerChecksum) ||
      planTokenizerChecksum !== tokenizerChecksum
    ) {
      return null;
    }
    if (!adapterFamily || !assembly) {
      return null;
    }
    if (modelByteBudget === null || modelByteBudget !== modelBytes) {
      return null;
    }
    if (adapterByteBudget === null || adapterByteBudget !== adapterFamily.autoApplyByteBudget) {
      return null;
    }
    if (
      adapterStackByteBudget === null ||
      adapterStackByteBudget <= 0 ||
      adapterStackByteBudget > adapterByteBudget
    ) {
      return null;
    }
    if (promptByteLimit === null || promptByteLimit !== registryModulePlanPromptByteLimit) {
      return null;
    }
    if (
      wasmHeapMinBytes === null ||
      wasmHeapMinBytes !== modulePlanWasmHeapMinBytes(
        modelByteBudget,
        adapterStackByteBudget,
        promptByteLimit
      )
    ) {
      return null;
    }
    if (
      runtimeScratchByteBudget === null ||
      runtimeScratchByteBudget !== registryModulePlanRuntimeScratchByteBudget
    ) {
      return null;
    }
    if (outputByteLimit === null || outputByteLimit !== registryModulePlanOutputByteLimit) {
      return null;
    }
    if (
      kvCacheByteBudget === null ||
      kvCacheByteBudget > registryModulePlanKvCacheByteBudgetLimit ||
      !Number.isInteger(kvCachePageCount) ||
      String(kvCachePageCount) !== fields[`${prefix}.module_plan_kv_cache_page_count`] ||
      kvCachePageCount !== modulePlanPageCountForBytes(kvCacheByteBudget)
    ) {
      return null;
    }
    if (
      totalByteBudget === null ||
      totalByteBudget <
        modelBytes +
          adapterStackByteBudget +
          promptByteLimit +
          runtimeScratchByteBudget +
          outputByteLimit +
          kvCacheByteBudget ||
      totalByteBudget > totalByteBudgetLimit
    ) {
      return null;
    }
    if (
      totalByteBudgetLimit === null ||
      totalByteBudgetLimit !== registryModulePlanTotalByteBudgetLimit
    ) {
      return null;
    }
    const expectedModuleCount = 4 + adapterFamily.autoApplyStackCount;
    if (!Number.isInteger(moduleCount) || moduleCount !== expectedModuleCount) {
      return null;
    }
    const declaredFetchCount =
      registryModulePlanDeclaredFetchCount(adapterFamily, assembly, moduleCount);
    if (
      plannedFetchCount === null ||
      plannedFetchCount !== declaredFetchCount ||
      plannedFetchCount !== registryModulePlanPlannedFetchCount ||
      plannedFetchCount > fetchCountLimit
    ) {
      return null;
    }
    if (routeSetVersion !== registryModulePlanRouteSetVersion) {
      return null;
    }
    if (routeSetChecksumAlgorithm !== registryModulePlanRouteSetChecksumAlgorithm) {
      return null;
    }
    const operatorEvidencePrefix = assemblyEvidencePrefixFromOperatorPath(
      candidateId,
      operatorReceiptPath
    );
    if (!operatorEvidencePrefix || !isRegistryHex64(operatorReceiptChecksum)) {
      return null;
    }
    const routeSetRoutes = modulePlanRouteSetRoutes(
      candidateId,
      receiptPath,
      modelPath,
      `${modelPath}.manifest`,
      assembly.path,
      adapterFamily.path,
      adapters,
      adapterFamily.autoApplyStackCount,
      operatorEvidencePrefix
    );
    const expectedRouteSetChecksum = routeSetRoutes
      ? modulePlanRouteSetChecksum(routeSetRoutes)
      : "";
    if (
      !isRegistryHex64(routeSetChecksum) ||
      routeSetChecksum !== expectedRouteSetChecksum
    ) {
      return null;
    }
    if (
      !isSafeAssemblyEvidencePath(operatorReceiptPath) ||
      operatorReceiptPath !== modulePlanEvidenceRoute(candidateId, `${operatorEvidencePrefix}.operator`)
    ) {
      return null;
    }
    return {
      label: fields[`${prefix}.module_plan_label`] || "Module plan",
      path: receiptPath,
      checksum: receiptChecksum,
      status: fields[`${prefix}.module_plan_status`],
      kind: fields[`${prefix}.module_plan_kind`],
      strategy: fields[`${prefix}.module_plan_strategy`],
      resourceClass: fields[`${prefix}.module_plan_resource_class`],
      profile: fields[`${prefix}.module_plan_profile`],
      executionProfile: fields[`${prefix}.module_plan_execution_profile`],
      fetchPolicy: fields[`${prefix}.module_plan_fetch_policy`],
      originPolicy: fields[`${prefix}.module_plan_origin_policy`],
      fetchCountLimit,
      plannedFetchCount,
      routeSetVersion,
      routeSetChecksumAlgorithm,
      routeSetChecksum,
      operatorReceiptPath,
      operatorReceiptChecksum,
      wasmMemoryInitialPages,
      wasmExportSet,
      wasmTransferStrategy: fields[`${prefix}.module_plan_wasm_transfer_strategy`],
      modelReleaseStrategy: fields[`${prefix}.module_plan_model_release_strategy`],
      runtimeResetStrategy: fields[`${prefix}.module_plan_runtime_reset_strategy`],
      adapterValidationStrategy: fields[`${prefix}.module_plan_adapter_validation_strategy`],
      adapterValidationCount,
      adapterApplyCount,
      wasmHeapMinBytes,
      contextTokenLimit: planContextTokenLimit,
      samplerCandidateCap,
      tokenizerChecksum: planTokenizerChecksum,
      modelByteBudget,
      adapterByteBudget,
      adapterStackByteBudget,
      promptByteLimit,
      runtimeScratchByteBudget,
      outputByteLimit,
      kvCacheByteBudget,
      kvCachePageCount,
      totalByteBudget,
      totalByteBudgetLimit,
      moduleCount
    };
  }

  // Counts route fetches implied by selector metadata before a generated model is accepted.
  function registryModulePlanDeclaredFetchCount(adapterFamily, assembly, moduleCount) {
    let fetchCount = 1 + moduleCount;
    if (assembly) {
      fetchCount += assemblyEvidenceRoutesForOperatorPrefix("operator").length;
    }
    if (adapterFamily) {
      fetchCount += adapterFamily.count;
    }
    return fetchCount;
  }

  // Builds the ordered route set fetched by generated browser self-assembly.
  function modulePlanRouteSetRoutes(
    candidateId,
    modulePlanPath,
    modelPath,
    manifestPath,
    assemblyPath,
    adapterFamilyPath,
    adapters,
    stackCount,
    operatorEvidencePrefix
  ) {
    if (
      !candidateId ||
      !modulePlanPath ||
      !modelPath ||
      !manifestPath ||
      !assemblyPath ||
      !adapterFamilyPath ||
      !operatorEvidencePrefix ||
      !Array.isArray(adapters)
    ) {
      return null;
    }
    const stackIndexes = modulePlanAutoApplyStackIndexes(adapters.length, stackCount);
    if (!stackIndexes) {
      return null;
    }
    const routes = [];
    modulePlanPushRoute(routes, "module-plan-receipt", modulePlanPath);
    modulePlanPushRoute(routes, "model", modelPath);
    modulePlanPushRoute(routes, "model-manifest", manifestPath);
    modulePlanPushRoute(routes, "assembly-receipt", assemblyPath);
    for (const route of assemblyEvidenceRoutesForOperatorPrefix(operatorEvidencePrefix)) {
      modulePlanPushRoute(routes, "assembly-evidence", modulePlanEvidenceRoute(candidateId, route[2]));
    }
    modulePlanPushRoute(routes, "adapter-family-receipt", adapterFamilyPath);
    for (const adapter of adapters) {
      if (!adapter || !adapter.manifestPath) {
        return null;
      }
      modulePlanPushRoute(routes, "adapter-manifest", adapter.manifestPath);
    }
    for (const adapterIndex of stackIndexes) {
      const adapter = adapters[adapterIndex];
      if (!adapter || !adapter.path) {
        return null;
      }
      modulePlanPushRoute(routes, "adapter-stack-artifact", adapter.path);
    }
    return routes;
  }

  function modulePlanAutoApplyStackIndexes(adapterCount, stackCount) {
    // Mirrors the generated adapter-family policy before the family receipt is loaded.
    if (
      !Number.isInteger(adapterCount) ||
      !Number.isInteger(stackCount) ||
      adapterCount < 1 ||
      stackCount < 1 ||
      stackCount > adapterCount
    ) {
      return null;
    }
    const expectedStackCount = adapterCount >= 3 ? adapterCount - 1 : adapterCount;
    if (stackCount !== expectedStackCount) {
      return null;
    }
    const indexes = [];
    for (let index = adapterCount - stackCount; index < adapterCount; index += 1) {
      indexes.push(index);
    }
    return indexes;
  }

  function modulePlanPushRoute(routes, kind, path) {
    // Keeps route hashing keyed by both route class and route path.
    routes.push({ kind, path });
  }

  function modulePlanEvidenceRoute(candidateId, fileName) {
    return `../evidence/${candidateId}/${fileName}`;
  }

  function assemblyEvidenceRoutesForOperatorPrefix(operatorEvidencePrefix) {
    // Builds the assembly evidence route family for the operator that produced the candidate.
    return assemblyEvidenceBaseRoutes.concat(
      assemblyOperatorEvidenceRoutes.map(([pathKey, checksumKey, suffix]) => [
        pathKey,
        checksumKey,
        `${operatorEvidencePrefix}.${suffix}`
      ])
    );
  }

  function assemblyEvidencePrefixFromOperatorPath(candidateId, operatorReceiptPath) {
    // Derives the operator evidence prefix from the bound operator receipt route.
    const prefix = `../evidence/${candidateId}/`;
    const suffix = ".operator";
    if (
      !isSafeAssemblyEvidencePath(operatorReceiptPath) ||
      !operatorReceiptPath.startsWith(prefix) ||
      !operatorReceiptPath.endsWith(suffix)
    ) {
      return "";
    }
    const operatorEvidencePrefix = operatorReceiptPath.slice(
      prefix.length,
      operatorReceiptPath.length - suffix.length
    );
    return /^[a-z0-9][a-z0-9-]{0,63}$/.test(operatorEvidencePrefix)
      ? operatorEvidencePrefix
      : "";
  }

  function modulePlanRouteSetChecksum(routes) {
    // Hashes the same route-list text emitted by the Rust bundle writer.
    const lines = [
      `route_set_version=${registryModulePlanRouteSetVersion}`,
      `route_set_checksum_algorithm=${registryModulePlanRouteSetChecksumAlgorithm}`,
      `route_count=${routes.length}`
    ];
    for (let index = 0; index < routes.length; index += 1) {
      lines.push(`route.${index}.kind=${routes[index].kind}`);
      lines.push(`route.${index}.path=${routes[index].path}`);
    }
    return textChecksumHex(`${lines.join("\n")}\n`);
  }

  function modulePlanWasmHeapMinBytes(modelByteBudget, adapterStackByteBudget, promptByteLimit) {
    return Math.max(
      registryModulePlanWasmHeapMinBytes,
      modelByteBudget,
      adapterStackByteBudget,
      promptByteLimit
    );
  }

  function registryModelEntries(fields) {
    if (!fields || fields.tinyrustlm_selector_registry_version !== "1") {
      return null;
    }
    if (fields.registry_status !== "admitted-records-only") {
      return null;
    }
    const registryByteBudget = registrySelectorModelByteBudget(fields.selector_model_byte_budget);
    if (registryByteBudget === null) {
      return null;
    }
    if (!registryTextSidecarBudgets(fields)) {
      return null;
    }
    const entryCount = Number.parseInt(fields.entry_count || "0", 10);
    if (!Number.isInteger(entryCount) || entryCount < 1 || entryCount > 64) {
      return null;
    }
    const models = Object.create(null);
    for (let index = 0; index < entryCount; index += 1) {
      const prefix = `entry.${index}`;
      if (fields[`${prefix}.selector_status`] !== "admitted") {
        return null;
      }
      const modelPath = fields[`${prefix}.model_path`];
      if (!isSafeRegistryModelPath(modelPath)) {
        return null;
      }
      const candidateId = fields[`${prefix}.candidate_id`];
      if (!candidateId) {
        return null;
      }
      if (models[candidateId]) {
        return null;
      }
      const maxTokens = clampInteger(fields[`${prefix}.max_tokens`], 1, 512, 8);
      const modelBytes = registryModelBytes(fields[`${prefix}.model_bytes`], registryByteBudget);
      if (modelBytes === null) {
        return null;
      }
      const modelShape = fields[`${prefix}.model_shape`] || "";
      const contextTokenLimit = registryModelShapeContextTokenLimit(modelShape);
      if (contextTokenLimit === null || contextTokenLimit < maxTokens) {
        return null;
      }
      const tokenizerChecksum = fields[`${prefix}.tokenizer_checksum`] || "";
      if (tokenizerChecksum && !isRegistryHex64(tokenizerChecksum)) {
        return null;
      }
      const slmChecksum = fields[`${prefix}.slm_checksum`] || "";
      if (!isRegistryHex64(slmChecksum)) {
        return null;
      }
      const sourceManifest = registrySourceManifestEntry(fields, prefix, candidateId);
      if (sourceManifest === null) {
        return null;
      }
      const sourceValidation = registrySourceValidationEntry(fields, prefix, candidateId);
      if (sourceValidation === null) {
        return null;
      }
      const admissionEvidence = registryAdmissionEvidenceEntry(fields, prefix, candidateId);
      if (admissionEvidence === null) {
        return null;
      }
      const quantization = fields[`${prefix}.quantization`] || "";
      const adapters = registryAdapterEntries(fields, prefix, quantization);
      if (!adapters) {
        return null;
      }
      const adapterFamily = registryAdapterFamilyEntry(fields, prefix, adapters.length);
      if (adapterFamily === null) {
        return null;
      }
      const assembly = registryAssemblyEntry(fields, prefix);
      if (assembly === null) {
        return null;
      }
      const genome = registryGenomeEntry(fields, prefix);
      if (!genome) {
        return null;
      }
      const species = registrySpeciesEntry(fields, prefix);
      if (!species) {
        return null;
      }
      const novelty = registryNoveltyEntry(fields, prefix);
      if (!novelty) {
        return null;
      }
      const population = registryPopulationEntry(fields, prefix);
      if (!population) {
        return null;
      }
      const mateSelection = registryMateSelectionEntry(fields, prefix);
      if (!mateSelection) {
        return null;
      }
      const operatorReceipt = registryOperatorReceiptEntry(
        fields,
        prefix,
        candidateId,
        assembly,
        modelBytes,
        slmChecksum
      );
      if (operatorReceipt === null) {
        return null;
      }
      const evolutionSchedule = registryEvolutionScheduleEntry(fields, prefix, operatorReceipt);
      if (evolutionSchedule === null) {
        return null;
      }
      const phenotypeEvidence = registryPhenotypeEvidenceEntry(fields, prefix);
      if (!phenotypeEvidence) {
        return null;
      }
      const heritableArtifact = registryHeritableArtifactEntry(fields, prefix);
      if (!heritableArtifact) {
        return null;
      }
      const runtimeSmokeEvidence = registryRuntimeSmokeEvidenceEntry(fields, prefix, candidateId);
      if (!runtimeSmokeEvidence) {
        return null;
      }
      const evalEvidence = registryEvalEvidenceEntry(fields, prefix, candidateId);
      if (!evalEvidence) {
        return null;
      }
      const modulePlan = registryModulePlanEntry(
        fields,
        prefix,
        candidateId,
        modelPath,
        adapters,
        adapterFamily,
        assembly,
        modelBytes,
        tokenizerChecksum,
        contextTokenLimit,
        maxTokens
      );
      if (modulePlan === null) {
        return null;
      }
      models[candidateId] = {
        candidateId,
        label: fields[`${prefix}.display_name`] || candidateId,
        path: modelPath,
        modelBytes,
        slmChecksum,
        modelShape,
        maxTokens,
        contextTokenLimit,
        tokenizerChecksum,
        quantization,
        adapters,
        adapterFamily: adapterFamily || null,
        autoApplyPreferredAdapter: Boolean(adapterFamily),
        genome,
        species,
        novelty,
        population,
        mateSelection,
        operatorReceipt: operatorReceipt || null,
        evolutionSchedule: evolutionSchedule || null,
        phenotypeEvidence,
        heritableArtifact,
        admissionEvidence: admissionEvidence || null,
        runtimeSmokeEvidence,
        evalEvidence,
        sourceManifest: sourceManifest || null,
        sourceValidation: sourceValidation || null,
        assembly: assembly || null,
        modulePlan: modulePlan || null
      };
    }
    const defaultModelKey = registryDefaultModelKey(fields, models);
    if (defaultModelKey === null) {
      return null;
    }
    return { models, defaultModelKey };
  }

  function registrySelectorModelByteBudget(value) {
    const byteBudget = registryDecimalByteCount(value);
    if (byteBudget === null || byteBudget > selectorModelByteBudget) {
      return null;
    }
    return byteBudget;
  }

  function registryTextSidecarBudgets(fields) {
    return registryExactByteBudget(
      fields.selector_registry_text_byte_budget,
      selectorRegistryTextByteBudget
    ) &&
      registryExactByteBudget(fields.manifest_text_byte_budget, manifestTextByteBudget) &&
      registryExactByteBudget(fields.receipt_text_byte_budget, receiptTextByteBudget) &&
      registryExactByteBudget(fields.evidence_text_byte_budget, evidenceTextByteBudget);
  }

  function registryExactByteBudget(value, expected) {
    const byteBudget = registryDecimalByteCount(value);
    return byteBudget !== null && byteBudget === expected;
  }

  function registryModelBytes(value, byteBudget) {
    const modelBytes = registryDecimalByteCount(value);
    if (modelBytes === null || modelBytes > byteBudget) {
      return null;
    }
    return modelBytes;
  }

  function runtimeWasmManifestBytes(value) {
    const byteCount = registryDecimalByteCount(value);
    if (byteCount === null || byteCount < 1) {
      return null;
    }
    return byteCount;
  }

  function registryAdapterAutoApplyBudget(value) {
    const byteBudget = registryDecimalByteCount(value);
    if (byteBudget === null || byteBudget > registryAdapterAutoApplyByteBudget) {
      return null;
    }
    return byteBudget;
  }

  function registryDecimalCount(value) {
    // Accepts exact positive decimal registry fields without whitespace or leading zero drift.
    if (!value) {
      return null;
    }
    const count = Number.parseInt(value, 10);
    if (
      !Number.isSafeInteger(count) ||
      String(count) !== value ||
      count < 1
    ) {
      return null;
    }
    return count;
  }

  function registryDecimalIndex(value) {
    // Accepts exact zero-based decimal indices for ordered schedule families.
    if (!value) {
      return null;
    }
    const index = Number.parseInt(value, 10);
    if (
      !Number.isSafeInteger(index) ||
      String(index) !== value ||
      index < 0
    ) {
      return null;
    }
    return index;
  }

  function registryDecimalByteCount(value) {
    return registryDecimalCount(value);
  }

  function registryModelShapeContextTokenLimit(modelShape) {
    const match = String(modelShape || "").match(/(?:^|,)(?:context|ctx)=(\d+)(?:,|$)/);
    if (!match) {
      return null;
    }
    const tokens = registryDecimalCount(match[1]);
    if (tokens === null || tokens > registryModulePlanContextTokenLimitLimit) {
      return null;
    }
    return tokens;
  }

  function modulePlanPageCountForBytes(bytes) {
    // Mirrors the Rust 64 KiB page math for selector and receipt KV-cache checks.
    return Math.ceil(bytes / (64 * 1024));
  }

  function registryDefaultModelKey(fields, models) {
    const keys = [
      "selector_default_strategy",
      "selector_default_candidate_id",
      "selector_default_quantization"
    ];
    const hasDefault = keys.some((key) => fields[key]);
    if (!hasDefault) {
      return "";
    }
    if (fields.selector_default_strategy !== selectorDefaultStrategy) {
      return null;
    }
    const candidateId = fields.selector_default_candidate_id;
    const model = models[candidateId];
    if (!model || fields.selector_default_quantization !== model.quantization) {
      return null;
    }
    return candidateId;
  }

  // Loads the optional generated selector registry before the first model is chosen.
  async function loadSelectorRegistry() {
    if (isPublicLocalOnlyHost()) {
      return;
    }
    try {
      const text = await fetchTextWithinBudget(
        paths.registry,
        selectorRegistryTextByteBudget,
        "selector registry",
        true
      );
      if (text === null) {
        return;
      }
      const fields = parseManifest(text);
      const registry = registryModelEntries(fields);
      if (!registry) {
        restoreStaticModelOptions();
        return;
      }
      paths.models = modelsWithLocalModel(registry.models);
      state.selectorRegistry = fields;
      state.selectorDefaultModelKey = registry.defaultModelKey || "";
      renderModelOptions(paths.models, Boolean(state.selectorDefaultModelKey));
    } catch (_error) {
      restoreStaticModelOptions();
    }
  }

  async function loadRuntimeWasmBytes() {
    const manifestText = await fetchTextWithinBudget(
      paths.wasmManifest,
      manifestTextByteBudget,
      "WASM manifest"
    );
    const fields = parseManifest(manifestText);
    requireManifestEqual(fields, "tinyrustlm_wasm_manifest_version", "1", "WASM manifest");
    requireManifestEqual(fields, "runtime_kind", runtimeWasmKind, "WASM manifest");
    requireManifestEqual(fields, "runtime_status", runtimeWasmStatus, "WASM manifest");
    requireManifestEqual(fields, "runtime_wasm_path", paths.wasm, "WASM manifest");
    requireManifestEqual(fields, "required_next_gate", runtimeWasmNextGate, "WASM manifest");
    const expectedBytes = runtimeWasmManifestBytes(
      requireManifestField(fields, "runtime_wasm_bytes", "WASM manifest")
    );
    if (expectedBytes === null) {
      throw new Error("WASM manifest field runtime_wasm_bytes was invalid");
    }
    const expectedChecksum = requireManifestField(fields, "runtime_wasm_checksum", "WASM manifest");
    const response = await fetch(paths.wasm, localFetchOptions);
    if (!response.ok) {
      throw new Error(`Unable to fetch WASM runtime (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== expectedBytes) {
      throw new Error("WASM runtime byte length mismatch");
    }
    requireChecksumEqual(bytesChecksumHex(bytes), expectedChecksum, "WASM runtime");
    return bytes;
  }

  // Renders manifest provenance and the selector evidence that was validated before model bytes.
  function renderProvenance(status, fields, isError) {
    setText(el.provenanceState, status, isError);
    const model = paths.models[state.activeModelKey] || null;
    const sourceManifest = model && model.sourceManifest ? model.sourceManifest : null;
    const sourceReview = sourceManifest && sourceManifest.sourceReview ? sourceManifest.sourceReview : null;
    const sourceValidation = model && model.sourceValidation ? model.sourceValidation : null;
    const genome = model && model.genome ? model.genome : null;
    const species = model && model.species ? model.species : null;
    const novelty = model && model.novelty ? model.novelty : null;
    const population = model && model.population ? model.population : null;
    const mateSelection = model && model.mateSelection ? model.mateSelection : null;
    const operatorReceipt = model && model.operatorReceipt ? model.operatorReceipt : null;
    const evolutionSchedule = model && model.evolutionSchedule ? model.evolutionSchedule : null;
    const phenotypeEvidence = model && model.phenotypeEvidence ? model.phenotypeEvidence : null;
    const heritableArtifact = model && model.heritableArtifact ? model.heritableArtifact : null;
    const admissionEvidence = model && model.admissionEvidence ? model.admissionEvidence : null;
    const evalEvidence = model && model.evalEvidence ? model.evalEvidence : null;
    el.provenanceSourceKind.textContent = manifestValue(fields, "source_kind");
    el.provenanceSourceSnapshot.textContent = sourceManifest
      ? sourceManifest.sourceKind
      : manifestValue(fields, "source_snapshot");
    el.provenanceSourceId.textContent = sourceManifest
      ? sourceManifest.sourceId
      : manifestValue(fields, "source_id");
    el.provenanceSourceShape.textContent = sourceManifest
      ? sourceManifest.modelShape
      : manifestValue(fields, "model_shape");
    el.provenanceSourceReview.textContent = sourceReview
      ? [
          sourceReview.status,
          sourceReview.requiredNextGate,
          sourceReview.checksum,
          sourceReview.sourceModelId,
          sourceReview.sourceModelSha
        ].filter(Boolean).join(" / ")
      : "unavailable";
    el.provenanceSourceReviewRoutes.textContent = sourceReviewRouteSummary(sourceReview);
    el.provenanceSourceReviewArtifacts.textContent = sourceReviewArtifactSummary(sourceReview);
    el.provenanceSourceTokenizerImport.textContent = sourceReviewTokenizerImportSummary(sourceReview);
    el.provenanceSourceValidation.textContent = sourceValidationSummary(sourceValidation);
    el.provenanceAdmission.textContent = admissionEvidenceSummary(admissionEvidence, fields);
    el.provenanceQualityClaim.textContent = manifestValue(fields, "quality_claim");
    el.provenanceTrainedClaim.textContent = manifestValue(fields, "trained_quality_claim");
    el.provenanceGenome.textContent = genome ? genome.id : "unavailable";
    el.provenanceSpecies.textContent = species
      ? `${species.fitStatus} / ${species.id} / ${species.fitChecksum}`
      : "unavailable";
    el.provenanceNovelty.textContent = novelty
      ? `${novelty.status} / ${novelty.id} / ${novelty.checksum}`
      : "unavailable";
    el.provenancePopulation.textContent = population
      ? `${population.status} / ${population.id} / ${population.checksum}`
      : "unavailable";
    el.provenanceMateSelection.textContent = mateSelection
      ? `${mateSelection.status} / ${mateSelection.parentCount} parents / ${mateSelection.id} / ${mateSelection.checksum}`
      : "unavailable";
    el.provenanceOperator.textContent = operatorReceipt
      ? `${operatorReceipt.status} / ${operatorReceipt.operatorKind} / ${operatorReceipt.checksum}`
      : "unavailable";
    el.provenanceSchedule.textContent = evolutionSchedule
      ? `${evolutionSchedule.recipeStatus} / family ${evolutionSchedule.familyIndex} / ${evolutionSchedule.familyCommand} / ${evolutionSchedule.familySelectionRule} / ${evolutionSchedule.familyOutputGate} / ${evolutionSchedule.scheduleChecksum}`
      : "unavailable";
    el.provenancePhenotype.textContent = phenotypeEvidence
      ? `${phenotypeEvidence.status} / ${phenotypeEvidence.id} / ${phenotypeEvidence.checksum}`
      : "unavailable";
    el.provenanceArtifact.textContent = heritableArtifact
      ? `${heritableArtifact.status} / ${heritableArtifact.id} / ${heritableArtifact.checksum}`
      : "unavailable";
    el.provenanceFitness.textContent = evalEvidence
      ? `${evalEvidence.fitnessVectorStatus} / ${evalEvidence.fitnessVectorChecksum}`
      : "unavailable";
    el.provenanceEvalCases.textContent = evalEvidence ? `${evalEvidence.casesPassed} passed` : "unavailable";
    el.provenanceEvalChecksum.textContent = evalEvidence ? evalEvidence.checksum : "unavailable";
    el.provenanceChecksum.textContent = manifestValue(fields, "slm_checksum");
    el.provenanceNextGate.textContent = manifestValue(fields, "required_next_gate");
  }

  function sourceReviewRouteSummary(sourceReview) {
    if (!sourceReview || !sourceReview.fields) {
      return "unavailable";
    }
    return [
      `license=${sourceReview.sourceLicenseRoute}`,
      `prompt=${sourceReview.referencePromptRoute}`,
      `reference=${sourceReview.referenceOutputChecksum}`,
      `eval=${sourceReview.evalCasesRoute}`
    ].join(" / ");
  }

  function sourceReviewArtifactSummary(sourceReview) {
    if (!sourceReview || !sourceReview.artifacts) {
      return "unavailable";
    }
    const parts = [];
    for (const [label, artifact] of Object.entries(sourceReview.artifacts)) {
      if (!artifact) {
        continue;
      }
      if (artifact.status === "not-local") {
        parts.push(`${label}=not-local`);
      } else {
        parts.push(`${label}=${artifact.status}@${artifact.checksum}`);
      }
    }
    return parts.length > 0 ? parts.join(" / ") : "unavailable";
  }

  function sourceReviewTokenizerImportSummary(sourceReview) {
    if (!sourceReview || !sourceReview.tokenizerImport) {
      return "unavailable";
    }
    const tokenizerImport = sourceReview.tokenizerImport;
    return [
      tokenizerImport.status,
      `tokens=${tokenizerImport.tokenCount}`,
      `merges=${tokenizerImport.mergeCount}`,
      tokenizerImport.checksum
    ].join(" / ");
  }

  function sourceValidationSummary(sourceValidation) {
    if (!sourceValidation || !sourceValidation.verified || !sourceValidation.fields) {
      return "unavailable";
    }
    return [
      sourceValidation.fields.source_validation_status,
      sourceValidation.fields.required_next_gate,
      sourceValidation.checksum
    ].filter(Boolean).join(" / ");
  }

  function admissionEvidenceSummary(admissionEvidence, fields) {
    if (!admissionEvidence || !admissionEvidence.verified || !admissionEvidence.fields) {
      return manifestValue(fields, "admission_status");
    }
    return [
      admissionEvidence.fields.admission_status,
      admissionEvidence.fields.required_next_gate,
      admissionEvidence.checksum
    ].filter(Boolean).join(" / ");
  }

  function renderAssembly(status, fields, isError) {
    setText(el.assemblyState, status, isError);
    el.assemblyKind.textContent = manifestValue(fields, "assembly_kind");
    el.assemblyParents.textContent = manifestValue(fields, "parent_count");
    el.assemblyOperator.textContent = manifestValue(fields, "operator_receipt_checksum");
    el.assemblyLedger.textContent = manifestValue(fields, "promotion_ledger_checksum");
    el.assemblyNextGate.textContent = manifestValue(fields, "required_next_gate");
  }

  function modulePlanStackSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.adapter_auto_apply_stack_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "none";
    }
    const routes = [];
    for (let stackIndex = 0; stackIndex < count; stackIndex += 1) {
      const pathValue = fields[`module.${stackIndex + 4}.adapter_path`];
      if (!pathValue) {
        return "unavailable";
      }
      routes.push(pathValue);
    }
    return `${count}: ${routes.join(", ")}`;
  }

  function modulePlanByteSummary(fields, key) {
    if (!fields) {
      return "unavailable";
    }
    const value = fields[key];
    if (!value) {
      return "unavailable";
    }
    return `${value} bytes`;
  }

  function modulePlanTokenSummary(fields, key) {
    if (!fields) {
      return "unavailable";
    }
    const tokens = registryDecimalCount(fields[key]);
    return tokens === null ? "unavailable" : `${tokens} tokens`;
  }

  function modulePlanSamplerSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const candidates = registryDecimalCount(fields.module_plan_sampler_candidate_cap);
    return candidates === null ? "unavailable" : `${candidates} candidates`;
  }

  // Formats the receipt-owned route-count envelope for the Module Plan panel.
  function modulePlanFetchCountSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const fetches = registryDecimalCount(fields.module_plan_fetch_count_limit);
    return fetches === null ? "unavailable" : `${fetches} fetches`;
  }

  // Formats the exact self-assembly route count declared by the verified receipt.
  function modulePlanPlannedFetchSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const fetches = registryDecimalCount(fields.module_plan_planned_fetch_count);
    return fetches === null ? "unavailable" : `${fetches} fetches`;
  }

  // Formats the browser-observed generated self-assembly route count.
  function modulePlanActualFetchSummary(fields) {
    if (!fields || !Number.isInteger(state.modulePlanActualFetchCount)) {
      return "unavailable";
    }
    return `${state.modulePlanActualFetchCount} fetches`;
  }

  // Formats the browser-observed route set checksum once all planned routes are seen.
  function modulePlanActualRouteSetSummary(fields) {
    if (!fields || !Array.isArray(state.modulePlanActualRoutes)) {
      return "unavailable";
    }
    const plannedFetchCount = registryDecimalCount(fields.module_plan_planned_fetch_count);
    if (plannedFetchCount === null) {
      return "unavailable";
    }
    if (state.modulePlanActualRoutes.length !== plannedFetchCount) {
      return `${state.modulePlanActualRoutes.length}/${plannedFetchCount} routes`;
    }
    return isRegistryHex64(state.modulePlanActualRouteSetChecksum)
      ? state.modulePlanActualRouteSetChecksum
      : "unavailable";
  }

  // Formats the browser-observed byte total for receipt-declared modules.
  function modulePlanActualModuleByteSummary(fields) {
    if (
      !fields ||
      !Number.isSafeInteger(state.modulePlanActualModuleBytes) ||
      !Array.isArray(state.modulePlanActualModuleByteIndexes)
    ) {
      return "unavailable";
    }
    const declared = modulePlanModuleByteTotal(fields);
    if (!declared) {
      return "unavailable";
    }
    if (state.modulePlanActualModuleByteIndexes.length !== declared.count) {
      return `${state.modulePlanActualModuleBytes}/${declared.total} bytes`;
    }
    return `${state.modulePlanActualModuleBytes} bytes`;
  }

  // Formats checksums recomputed from the module payloads accepted by this browser load.
  function modulePlanActualModuleChecksumSummary(fields) {
    if (!fields || !Array.isArray(state.modulePlanActualModuleChecksums)) {
      return "unavailable";
    }
    const declared = modulePlanModuleChecksumList(fields);
    if (!declared) {
      return "unavailable";
    }
    let seen = 0;
    for (const checksum of state.modulePlanActualModuleChecksums) {
      if (checksum) {
        seen += 1;
      }
    }
    if (seen !== declared.length) {
      return `${seen}/${declared.length} checksums`;
    }
    const checksums = [];
    for (let index = 0; index < declared.length; index += 1) {
      const checksum = state.modulePlanActualModuleChecksums[index];
      if (!checksum) {
        return `${seen}/${declared.length} checksums`;
      }
      checksums.push(`${index}: ${checksum}`);
    }
    return checksums.join(", ");
  }

  function modulePlanModuleByteTotal(fields) {
    const countValue = fields && fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return null;
    }
    let total = 0;
    for (let index = 0; index < count; index += 1) {
      const bytes = registryDecimalByteCount(fields[`module.${index}.byte_count`]);
      if (bytes === null) {
        return null;
      }
      total += bytes;
    }
    return { count, total };
  }

  function modulePlanModuleChecksumList(fields) {
    const countValue = fields && fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return null;
    }
    const checksums = [];
    for (let index = 0; index < count; index += 1) {
      const checksum = fields[`module.${index}.checksum`];
      if (!isRegistryHex64(checksum)) {
        return null;
      }
      checksums.push(checksum);
    }
    return checksums;
  }

  function modulePlanModuleByteSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "unavailable";
    }
    const byteCounts = [];
    for (let index = 0; index < count; index += 1) {
      const byteCount = fields[`module.${index}.byte_count`];
      if (!byteCount) {
        return "unavailable";
      }
      byteCounts.push(`${index}: ${byteCount} bytes`);
    }
    return byteCounts.join(", ");
  }

  function modulePlanChecksumSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "unavailable";
    }
    const checksums = [];
    for (let index = 0; index < count; index += 1) {
      const checksum = fields[`module.${index}.checksum`];
      if (!checksum) {
        return "unavailable";
      }
      checksums.push(`${index}: ${checksum}`);
    }
    return checksums.join(", ");
  }

  function modulePlanRoleSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "unavailable";
    }
    const roles = [];
    for (let index = 0; index < count; index += 1) {
      const role = fields[`module.${index}.role`];
      if (!role) {
        return "unavailable";
      }
      roles.push(`${index}: ${role}`);
    }
    return roles.join(", ");
  }

  function modulePlanSlotSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "unavailable";
    }
    const slots = [];
    for (let index = 0; index < count; index += 1) {
      const slot = fields[`module.${index}.assembly_slot`];
      if (!slot) {
        return "unavailable";
      }
      slots.push(`${index}: ${slot}`);
    }
    return slots.join(", ");
  }

  function modulePlanPhaseSummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "unavailable";
    }
    const phases = [];
    for (let index = 0; index < count; index += 1) {
      const phase = fields[`module.${index}.phase`];
      if (!phase) {
        return "unavailable";
      }
      phases.push(`${index}: ${phase}`);
    }
    return phases.join(", ");
  }

  function modulePlanDependencySummary(fields) {
    if (!fields) {
      return "unavailable";
    }
    const countValue = fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 1) {
      return "unavailable";
    }
    const dependencies = [];
    for (let index = 0; index < count; index += 1) {
      const dependency = fields[`module.${index}.depends_on`];
      if (!dependency) {
        return "unavailable";
      }
      dependencies.push(`${index}: ${dependency}`);
    }
    return dependencies.join(", ");
  }

  function renderModulePlan(status, fields, isError) {
    setText(el.modulePlanState, status, isError);
    el.modulePlanKind.textContent = manifestValue(fields, "module_plan_kind");
    el.modulePlanResource.textContent = manifestValue(fields, "module_plan_resource_class");
    el.modulePlanExecution.textContent = manifestValue(fields, "module_plan_execution_profile");
    el.modulePlanFetch.textContent = manifestValue(fields, "module_plan_fetch_policy");
    el.modulePlanOrigin.textContent = manifestValue(fields, "module_plan_origin_policy");
    el.modulePlanFetchLimit.textContent = modulePlanFetchCountSummary(fields);
    el.modulePlanPlannedFetchCount.textContent = modulePlanPlannedFetchSummary(fields);
    updateModulePlanActualFetchCount(fields);
    el.modulePlanRouteSetVersion.textContent = manifestValue(
      fields,
      "module_plan_route_set_version"
    );
    el.modulePlanRouteSetChecksumAlgorithm.textContent = manifestValue(
      fields,
      "module_plan_route_set_checksum_algorithm"
    );
    el.modulePlanRouteSetChecksum.textContent = manifestValue(
      fields,
      "module_plan_route_set_checksum"
    );
    updateModulePlanActualRouteSetChecksum(fields);
    el.modulePlanWasmPages.textContent = manifestValue(fields, "module_plan_wasm_memory_initial_pages");
    el.modulePlanWasmExportSet.textContent = manifestValue(fields, "module_plan_wasm_export_set");
    el.modulePlanWasmTransferStrategy.textContent = manifestValue(
      fields,
      "module_plan_wasm_transfer_strategy"
    );
    el.modulePlanModelReleaseStrategy.textContent = manifestValue(
      fields,
      "module_plan_model_release_strategy"
    );
    el.modulePlanRuntimeResetStrategy.textContent = manifestValue(
      fields,
      "module_plan_runtime_reset_strategy"
    );
    el.modulePlanAdapterValidationStrategy.textContent = manifestValue(
      fields,
      "module_plan_adapter_validation_strategy"
    );
    el.modulePlanAdapterValidationCount.textContent = manifestValue(
      fields,
      "module_plan_adapter_validation_count"
    );
    el.modulePlanAdapterApplyCount.textContent = manifestValue(
      fields,
      "module_plan_adapter_apply_count"
    );
    el.modulePlanWasmHeapMinBytes.textContent = modulePlanByteSummary(
      fields,
      "module_plan_wasm_heap_min_bytes"
    );
    el.modulePlanContextTokens.textContent = modulePlanTokenSummary(
      fields,
      "module_plan_context_token_limit"
    );
    el.modulePlanSamplerCap.textContent = modulePlanSamplerSummary(fields);
    el.modulePlanTokenizer.textContent = manifestValue(fields, "module_plan_tokenizer_checksum");
    el.modulePlanModules.textContent = manifestValue(fields, "module_count");
    el.modulePlanModelBudget.textContent = modulePlanByteSummary(fields, "module_plan_model_byte_budget");
    el.modulePlanAdapterBudget.textContent = modulePlanByteSummary(fields, "module_plan_adapter_byte_budget");
    el.modulePlanAdapterStackBudget.textContent = modulePlanByteSummary(
      fields,
      "module_plan_adapter_stack_byte_budget"
    );
    el.modulePlanScratchBudget.textContent = modulePlanByteSummary(
      fields,
      "module_plan_runtime_scratch_byte_budget"
    );
    el.modulePlanPromptLimit.textContent = modulePlanByteSummary(
      fields,
      "module_plan_prompt_byte_limit"
    );
    el.modulePlanOutputLimit.textContent = modulePlanByteSummary(
      fields,
      "module_plan_output_byte_limit"
    );
    el.modulePlanKvCacheBudget.textContent = modulePlanByteSummary(
      fields,
      "module_plan_kv_cache_byte_budget"
    );
    el.modulePlanKvCachePages.textContent = manifestValue(fields, "module_plan_kv_cache_page_count");
    el.modulePlanTotalBudget.textContent = modulePlanByteSummary(fields, "module_plan_total_byte_budget");
    el.modulePlanTotalLimit.textContent = modulePlanByteSummary(
      fields,
      "module_plan_total_byte_budget_limit"
    );
    el.modulePlanBytes.textContent = modulePlanModuleByteSummary(fields);
    updateModulePlanActualModuleBytes(fields);
    el.modulePlanChecksums.textContent = modulePlanChecksumSummary(fields);
    updateModulePlanActualModuleChecksums(fields);
    el.modulePlanSlots.textContent = modulePlanSlotSummary(fields);
    el.modulePlanRoles.textContent = modulePlanRoleSummary(fields);
    el.modulePlanPhases.textContent = modulePlanPhaseSummary(fields);
    el.modulePlanDepends.textContent = modulePlanDependencySummary(fields);
    el.modulePlanModel.textContent = manifestValue(fields, "module.0.path");
    el.modulePlanStack.textContent = modulePlanStackSummary(fields);
  }

  function resetModulePlanTrace(status, isError) {
    state.modulePlanTrace = [];
    setText(el.modulePlanTrace, status || "waiting", isError);
  }

  function recordModulePlanTrace(label) {
    state.modulePlanTrace.push(`${state.modulePlanTrace.length}: ${label}`);
    setText(el.modulePlanTrace, state.modulePlanTrace.join(", "), false);
  }

  function modelAdapters(model) {
    if (!model || !Array.isArray(model.adapters)) {
      return [];
    }
    if (model.adapterFamily && !model.adapterFamilyVerified) {
      return [];
    }
    return model.adapters;
  }

  function selectedAdapter() {
    const model = paths.models[state.activeModelKey];
    const adapters = modelAdapters(model);
    const index = selectedAdapterIndex(adapters);
    if (index === null) {
      return null;
    }
    return adapters[index];
  }

  function selectedAdapterIndex(adapters) {
    const index = Number.parseInt(el.adapterSelect.value, 10);
    if (!Number.isInteger(index) || index < 0 || index >= adapters.length) {
      return null;
    }
    return index;
  }

  function renderAdapterOptions(model, status, isError) {
    const adapters = modelAdapters(model);
    el.adapterSelect.replaceChildren();
    if (adapters.length === 0) {
      const option = document.createElement("option");
      option.value = "none";
      option.textContent = "None";
      el.adapterSelect.append(option);
    } else {
      for (let index = 0; index < adapters.length; index += 1) {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = adapters[index].label || `Adapter ${index + 1}`;
        el.adapterSelect.append(option);
      }
      const preferredIndex = Number.isInteger(model.adapterFamilyPreferredIndex)
        ? model.adapterFamilyPreferredIndex
        : 0;
      if (preferredIndex >= 0 && preferredIndex < adapters.length) {
        el.adapterSelect.value = String(preferredIndex);
      }
    }
    setText(el.adapterState, status || (adapters.length > 0 ? "ready" : "none"), isError);
  }

  function adapterFamilyPreferredIndex(model, fields) {
    const source = "adapter family receipt";
    const indexValue = requireManifestField(fields, "adapter_family_preferred_adapter_index", source);
    const index = Number.parseInt(indexValue, 10);
    if (!Number.isInteger(index) || String(index) !== indexValue || index < 0 || index >= model.adapters.length) {
      throw new Error("Adapter family preferred adapter index mismatch");
    }
    const preferred = model.adapters[index];
    requireManifestEqual(fields, "adapter_family_preferred_adapter_path", preferred.path, source);
    requireManifestEqual(fields, "adapter_family_preferred_manifest_path", preferred.manifestPath, source);
    return index;
  }

  function adapterFamilyAutoApplyIndexes(model, fields) {
    const source = "adapter family receipt";
    requireManifestEqual(fields, "adapter_family_auto_apply_stack_status", registryAdapterAutoApplyStackStatus, source);
    requireManifestEqual(
      fields,
      "adapter_family_auto_apply_stack_strategy",
      registryAdapterAutoApplyStackStrategy,
      source
    );
    const countValue = requireManifestField(fields, "adapter_family_auto_apply_stack_count", source);
    const count = Number.parseInt(countValue, 10);
    if (
      !Number.isInteger(count) ||
      String(count) !== countValue ||
      count < 1 ||
      count > model.adapters.length ||
      (model.adapterFamily && count !== model.adapterFamily.autoApplyStackCount)
    ) {
      throw new Error("Adapter family auto-apply stack count mismatch");
    }
    const indexes = [];
    const seen = new Set();
    for (let stackIndex = 0; stackIndex < count; stackIndex += 1) {
      const prefix = `adapter_family_auto_apply_stack.${stackIndex}`;
      const indexValue = requireManifestField(fields, `${prefix}.adapter_index`, source);
      const index = Number.parseInt(indexValue, 10);
      if (
        !Number.isInteger(index) ||
        String(index) !== indexValue ||
        index < 0 ||
        index >= model.adapters.length ||
        seen.has(index)
      ) {
        throw new Error("Adapter family auto-apply stack index mismatch");
      }
      const adapter = model.adapters[index];
      requireManifestEqual(fields, `${prefix}.adapter_path`, adapter.path, source);
      requireManifestEqual(fields, `${prefix}.manifest_path`, adapter.manifestPath, source);
      seen.add(index);
      indexes.push(index);
    }
    return indexes;
  }

  // Verifies receipt-declared adapter members before any generated adapter manifest is trusted.
  function validateAdapterFamilyReceipt(model, receiptText) {
    const family = model.adapterFamily;
    if (!family) {
      return null;
    }
    requireChecksumEqual(textChecksumHex(receiptText), family.checksum, "adapter family receipt");
    const fields = parseManifest(receiptText);
    requireManifestEqual(fields, "tinyrustlm_adapter_family_receipt_version", "1");
    const familyKind = requireManifestField(fields, "adapter_family_kind", "adapter family receipt");
    if (!adapterFamilyReceiptKinds.has(familyKind)) {
      throw new Error("Adapter family receipt kind mismatch");
    }
    requireManifestEqual(fields, "adapter_family_status", adapterFamilyReceiptStatus);
    requireManifestEqual(fields, "adapter_family_receipt_path", family.path);
    requireManifestEqual(fields, "adapter_family_strategy", family.strategy);
    const adapterCount = Number.parseInt(requireManifestField(fields, "adapter_count"), 10);
    if (!Number.isInteger(adapterCount) || adapterCount !== family.count || adapterCount !== model.adapters.length) {
      throw new Error("Adapter family receipt count mismatch");
    }
    adapterFamilyPreferredIndex(model, fields);
    for (const key of adapterFamilyIdentityKeys) {
      requireManifestField(fields, `family.${key}`);
    }
    adapterFamilyAutoApplyIndexes(model, fields);
    for (let index = 0; index < model.adapters.length; index += 1) {
      const adapter = model.adapters[index];
      const prefix = `adapter.${index}`;
      requireManifestEqual(fields, `${prefix}.path`, adapter.path);
      requireManifestEqual(fields, `${prefix}.manifest_path`, adapter.manifestPath);
      requireManifestEqual(fields, `${prefix}.label`, adapter.label);
      requireManifestEqual(fields, `${prefix}.apply_status`, adapter.applyStatus);
      requireChecksumEqual(
        requireManifestField(fields, `${prefix}.artifact_checksum`),
        adapter.artifactChecksum,
        `adapter ${index} artifact`
      );
      requireChecksumEqual(
        requireManifestField(fields, `${prefix}.manifest_checksum`),
        adapter.manifestChecksum,
        `adapter ${index} manifest`
      );
      const adapterFormat = adapterFormatForPath(adapter.path);
      if (!adapterFormat) {
        throw new Error("Adapter route format mismatch");
      }
      const artifactKind = requireAdapterKindDtypePair(
        fields,
        `${prefix}.kind`,
        `${prefix}.dtype`,
        adapterFormat.kindDtypePairs,
        "adapter family receipt"
      );
      validateSourceBackedReceiptFields(fields, prefix, artifactKind);
      for (const key of adapterFamilyIdentityKeys) {
        requireManifestEqual(fields, `${prefix}.${key}`, requireManifestField(fields, `family.${key}`));
      }
    }
    return fields;
  }

  // Checks source-backed ALR1 receipt echoes while the receipt checksum is still the authority.
  function validateSourceBackedReceiptFields(fields, prefix, artifactKind) {
    if (artifactKind !== sourceBackedLowRankAdapterKind) {
      return;
    }
    for (const [manifestKey, receiptKey, expectedValue, isChecksum] of sourceBackedLowRankManifestFields) {
      const fieldKey = `${prefix}.${receiptKey}`;
      const value = isChecksum
        ? requireHex64ManifestField(fields, fieldKey, "adapter family receipt")
        : requireManifestField(fields, fieldKey, "adapter family receipt");
      if (expectedValue && value !== expectedValue) {
        throw new Error(`Adapter family receipt field ${fieldKey} was ${value}`);
      }
    }
  }

  // Verifies one fetched adapter manifest against both its route and receipt-backed source fields.
  function validateAdapterManifest(adapter, manifestText, receiptFields, index) {
    requireChecksumEqual(textChecksumHex(manifestText), adapter.manifestChecksum, `adapter ${index} manifest`);
    const fields = parseManifest(manifestText);
    const source = "Adapter manifest";
    const adapterFormat = adapterFormatForPath(adapter.path);
    if (!adapterFormat) {
      throw new Error("Adapter route format mismatch");
    }
    requireManifestEqual(fields, "tinyrustlm_adapter_artifact_version", adapterManifestArtifactVersion, source);
    const artifactKind = requireAdapterKindDtypePair(
      fields,
      "adapter_artifact_kind",
      "adapter_dtype",
      adapterFormat.kindDtypePairs,
      source
    );
    requireManifestEqual(fields, "adapter_status", adapterManifestStatus, source);
    requireManifestEqual(fields, "adapter_base_quantization", adapter.baseQuantization, source);
    requireManifestEqual(fields, "adapter_apply_status", adapter.applyStatus, source);
    requireChecksumEqual(
      requireManifestField(fields, "adapter_artifact_checksum", "adapter manifest"),
      adapter.artifactChecksum,
      `adapter ${index} artifact`
    );
    adapterManifestArtifactBytes(fields, source);
    const receiptPrefix = `adapter.${index}`;
    const expectedManifestBytes = Number.parseInt(
      requireManifestField(receiptFields, `${receiptPrefix}.manifest_bytes`),
      10
    );
    const actualManifestBytes = state.encoder.encode(manifestText).length;
    if (!Number.isInteger(expectedManifestBytes) || expectedManifestBytes !== actualManifestBytes) {
      throw new Error(`Adapter ${index} manifest byte count mismatch`);
    }
    for (const key of adapterFamilyIdentityKeys) {
      requireManifestEqual(
        fields,
        key,
        requireManifestField(receiptFields, `${receiptPrefix}.${key}`),
        source
      );
    }
    validateSourceBackedAdapterManifest(fields, receiptFields, receiptPrefix, artifactKind, source);
    return fields;
  }

  // Binds source-backed ALR1 manifest provenance to the already-verified adapter-family receipt.
  function validateSourceBackedAdapterManifest(fields, receiptFields, receiptPrefix, artifactKind, source) {
    if (artifactKind !== sourceBackedLowRankAdapterKind) {
      return;
    }
    requireManifestEqual(
      fields,
      "adapter_base_contract",
      "matches-parent-direct-parameter-contract",
      source
    );
    for (const [manifestKey, receiptKey, expectedValue, isChecksum] of sourceBackedLowRankManifestFields) {
      const receiptValue = isChecksum
        ? requireHex64ManifestField(receiptFields, `${receiptPrefix}.${receiptKey}`, "adapter family receipt")
        : requireManifestField(receiptFields, `${receiptPrefix}.${receiptKey}`, "adapter family receipt");
      if (expectedValue && receiptValue !== expectedValue) {
        throw new Error(`Adapter family receipt field ${receiptPrefix}.${receiptKey} was ${receiptValue}`);
      }
      if (isChecksum) {
        requireChecksumEqual(
          requireManifestField(fields, manifestKey, source.toLowerCase()),
          receiptValue,
          `adapter ${receiptPrefix} source manifest`
        );
      } else {
        requireManifestEqual(fields, manifestKey, receiptValue, source);
      }
    }
  }

  function adapterManifestArtifactBytes(fields, source) {
    const artifactBytes = registryDecimalByteCount(
      requireManifestField(fields, "adapter_artifact_bytes", source || "adapter manifest")
    );
    if (artifactBytes === null) {
      throw new Error("Adapter artifact byte count mismatch");
    }
    return artifactBytes;
  }

  async function loadAdapterFamilyReceipt(model) {
    if (!model.adapterFamily) {
      return "";
    }
    model.adapterFamilyVerified = false;
    model.adapterFamilyReceipt = null;
    model.adapterFamilyManifests = null;
    model.adapterFamilyPreferredIndex = null;
    model.adapterFamilyAutoApplyIndexes = null;
    const text = await fetchModulePlanTextWithinBudget(
      model,
      model.adapterFamily.path,
      receiptTextByteBudget,
      "adapter-family receipt",
      "adapter-family-receipt"
    );
    requireModulePlanTextByteCount(model, 3, text);
    const receiptFields = validateAdapterFamilyReceipt(model, text);
    const preferredIndex = adapterFamilyPreferredIndex(model, receiptFields);
    const autoApplyIndexes = adapterFamilyAutoApplyIndexes(model, receiptFields);
    const manifestFields = [];
    for (let index = 0; index < model.adapters.length; index += 1) {
      const adapter = model.adapters[index];
      const manifestText = await fetchModulePlanTextWithinBudget(
        model,
        adapter.manifestPath,
        manifestTextByteBudget,
        "Adapter manifest",
        "adapter-manifest"
      );
      const fields = validateAdapterManifest(adapter, manifestText, receiptFields, index);
      const moduleIndex = modulePlanStackModuleIndexForAdapter(model.modulePlanReceipt, index);
      if (moduleIndex !== null) {
        requireModulePlanActualByteCount(
          model.modulePlanReceipt,
          moduleIndex,
          adapterManifestArtifactBytes(fields, "Adapter manifest")
        );
      }
      manifestFields.push(fields);
    }
    if (model.autoApplyPreferredAdapter) {
      let autoApplyBytes = 0;
      for (const index of autoApplyIndexes) {
        autoApplyBytes += adapterManifestArtifactBytes(manifestFields[index], "Adapter manifest");
      }
      if (model.modulePlan && autoApplyBytes !== model.modulePlan.adapterStackByteBudget) {
        throw new Error("Module plan adapter stack byte budget mismatch");
      }
      if (autoApplyBytes > model.adapterFamily.autoApplyByteBudget) {
        throw new Error("Adapter auto assembly byte budget exceeded");
      }
    }
    model.adapterFamilyReceipt = receiptFields;
    model.adapterFamilyManifests = manifestFields;
    model.adapterFamilyPreferredIndex = preferredIndex;
    model.adapterFamilyAutoApplyIndexes = autoApplyIndexes;
    model.adapterFamilyVerified = true;
    return "family verified";
  }

  function validateModulePlanReceipt(model, receiptText) {
    const plan = model.modulePlan;
    if (!plan) {
      return null;
    }
    requireChecksumEqual(textChecksumHex(receiptText), plan.checksum, "module plan");
    const fields = parseManifest(receiptText);
    const source = "Module plan";
    requireManifestEqual(fields, "tinyrustlm_module_plan_version", "1", source);
    requireManifestEqual(fields, "module_plan_kind", registryModulePlanKind, source);
    requireManifestEqual(fields, "module_plan_status", modulePlanReceiptStatus, source);
    requireManifestEqual(fields, "module_plan_strategy", registryModulePlanStrategy, source);
    requireManifestEqual(fields, "candidate_id", state.activeModelKey, source);
    requireManifestEqual(fields, "module_plan_path", plan.path, source);
    requireManifestEqual(fields, "module_plan_resource_class", plan.resourceClass, source);
    requireManifestEqual(fields, "module_plan_profile", plan.profile, source);
    requireManifestEqual(fields, "module_plan_execution_profile", plan.executionProfile, source);
    requireManifestEqual(fields, "module_plan_fetch_policy", plan.fetchPolicy, source);
    requireManifestEqual(fields, "module_plan_origin_policy", plan.originPolicy, source);
    const fetchCountLimit = requireModulePlanCount(
      fields,
      "module_plan_fetch_count_limit",
      plan.fetchCountLimit
    );
    if (
      fetchCountLimit !== registryModulePlanFetchCountLimit ||
      modulePlanDeclaredFetchCount(model, plan.moduleCount) > fetchCountLimit
    ) {
      throw new Error("Module plan fetch count limit mismatch");
    }
    const plannedFetchCount = requireModulePlanCount(
      fields,
      "module_plan_planned_fetch_count",
      plan.plannedFetchCount
    );
    const declaredFetchCount = modulePlanDeclaredFetchCount(model, plan.moduleCount);
    if (
      plannedFetchCount !== declaredFetchCount ||
      plannedFetchCount !== registryModulePlanPlannedFetchCount ||
      plannedFetchCount > fetchCountLimit
    ) {
      throw new Error("Module plan planned fetch count mismatch");
    }
    if (!model.assembly || !model.adapterFamily) {
      throw new Error("Module plan route set checksum mismatch");
    }
    const routeSetVersion = requireManifestField(
      fields,
      "module_plan_route_set_version",
      source
    );
    if (
      routeSetVersion !== plan.routeSetVersion ||
      routeSetVersion !== registryModulePlanRouteSetVersion
    ) {
      throw new Error("Module plan route set version mismatch");
    }
    const routeSetChecksumAlgorithm = requireManifestField(
      fields,
      "module_plan_route_set_checksum_algorithm",
      source
    );
    if (
      routeSetChecksumAlgorithm !== plan.routeSetChecksumAlgorithm ||
      routeSetChecksumAlgorithm !== registryModulePlanRouteSetChecksumAlgorithm
    ) {
      throw new Error("Module plan route set checksum algorithm mismatch");
    }
    const routeSetChecksum = requireManifestField(
      fields,
      "module_plan_route_set_checksum",
      source
    );
    const routeSetCandidateId = model.candidateId || state.activeModelKey;
    const operatorEvidencePrefix = assemblyEvidencePrefixFromOperatorPath(
      routeSetCandidateId,
      plan.operatorReceiptPath
    );
    if (!operatorEvidencePrefix) {
      throw new Error("Module plan operator receipt path mismatch");
    }
    const routeSetRoutes = modulePlanRouteSetRoutes(
      routeSetCandidateId,
      plan.path,
      model.path,
      `${model.path}.manifest`,
      model.assembly.path,
      model.adapterFamily.path,
      model.adapters,
      model.adapterFamily.autoApplyStackCount,
      operatorEvidencePrefix
    );
    const expectedRouteSetChecksum = routeSetRoutes
      ? modulePlanRouteSetChecksum(routeSetRoutes)
      : "";
    if (
      !isRegistryHex64(routeSetChecksum) ||
      routeSetChecksum !== plan.routeSetChecksum ||
      routeSetChecksum !== expectedRouteSetChecksum
    ) {
      throw new Error("Module plan route set checksum mismatch");
    }
    requireManifestEqual(fields, "operator_receipt_path", plan.operatorReceiptPath, source);
    requireChecksumEqual(
      requireManifestField(fields, "operator_receipt_checksum", source),
      plan.operatorReceiptChecksum,
      "module plan operator receipt"
    );
    const wasmMemoryInitialPages = requireManifestField(
      fields,
      "module_plan_wasm_memory_initial_pages",
      source
    );
    if (
      wasmMemoryInitialPages !== String(plan.wasmMemoryInitialPages) ||
      plan.wasmMemoryInitialPages !== state.wasmMemoryInitialPages
    ) {
      throw new Error("Module plan WASM memory initial pages mismatch");
    }
    const wasmExportSet = requireManifestField(fields, "module_plan_wasm_export_set", source);
    if (wasmExportSet !== plan.wasmExportSet || !verifyModulePlanWasmExports(wasmExportSet)) {
      throw new Error("Module plan WASM export set mismatch");
    }
    const wasmTransferStrategy = requireManifestField(
      fields,
      "module_plan_wasm_transfer_strategy",
      source
    );
    if (
      wasmTransferStrategy !== plan.wasmTransferStrategy ||
      wasmTransferStrategy !== registryModulePlanWasmTransferStrategy
    ) {
      throw new Error("Module plan WASM transfer strategy mismatch");
    }
    const modelReleaseStrategy = requireManifestField(
      fields,
      "module_plan_model_release_strategy",
      source
    );
    if (
      modelReleaseStrategy !== plan.modelReleaseStrategy ||
      modelReleaseStrategy !== registryModulePlanModelReleaseStrategy
    ) {
      throw new Error("Module plan model release strategy mismatch");
    }
    const runtimeResetStrategy = requireManifestField(
      fields,
      "module_plan_runtime_reset_strategy",
      source
    );
    if (
      runtimeResetStrategy !== plan.runtimeResetStrategy ||
      runtimeResetStrategy !== registryModulePlanRuntimeResetStrategy
    ) {
      throw new Error("Module plan runtime reset strategy mismatch");
    }
    const adapterValidationStrategy = requireManifestField(
      fields,
      "module_plan_adapter_validation_strategy",
      source
    );
    if (
      adapterValidationStrategy !== plan.adapterValidationStrategy ||
      adapterValidationStrategy !== registryModulePlanAdapterValidationStrategy
    ) {
      throw new Error("Module plan adapter validation strategy mismatch");
    }
    const adapterValidationCountValue = requireManifestField(
      fields,
      "module_plan_adapter_validation_count",
      source
    );
    const adapterValidationCount = registryDecimalCount(adapterValidationCountValue);
    if (
      adapterValidationCount === null ||
      adapterValidationCount !== plan.adapterValidationCount ||
      adapterValidationCount !== plan.adapterApplyCount ||
      (model.adapterFamily && adapterValidationCount !== model.adapterFamily.autoApplyStackCount) ||
      adapterValidationCount !== registryModulePlanAdapterValidationCount
    ) {
      throw new Error("Module plan adapter validation count mismatch");
    }
    const adapterApplyCountValue = requireManifestField(
      fields,
      "module_plan_adapter_apply_count",
      source
    );
    const adapterApplyCount = registryDecimalCount(adapterApplyCountValue);
    if (
      adapterApplyCount === null ||
      adapterApplyCount !== plan.adapterApplyCount ||
      (model.adapterFamily && adapterApplyCount !== model.adapterFamily.autoApplyStackCount) ||
      adapterApplyCount !== registryModulePlanAdapterApplyCount
    ) {
      throw new Error("Module plan adapter apply count mismatch");
    }
    const wasmHeapMinValue = requireManifestField(
      fields,
      "module_plan_wasm_heap_min_bytes",
      source
    );
    const wasmHeapMinBytes = registryDecimalByteCount(wasmHeapMinValue);
    if (wasmHeapMinBytes === null || wasmHeapMinBytes !== plan.wasmHeapMinBytes) {
      throw new Error("Module plan WASM heap min bytes mismatch");
    }
    const contextTokenLimitValue = requireManifestField(
      fields,
      "module_plan_context_token_limit",
      source
    );
    const contextTokenLimit = registryDecimalCount(contextTokenLimitValue);
    if (
      contextTokenLimit === null ||
      contextTokenLimit !== plan.contextTokenLimit ||
      contextTokenLimit !== model.contextTokenLimit ||
      contextTokenLimit < model.maxTokens ||
      contextTokenLimit > registryModulePlanContextTokenLimitLimit
    ) {
      throw new Error("Module plan context token limit mismatch");
    }
    const samplerCandidateCapValue = requireManifestField(
      fields,
      "module_plan_sampler_candidate_cap",
      source
    );
    const samplerCandidateCap = registryDecimalCount(samplerCandidateCapValue);
    // Mirrors the fixed top-k candidate buffer before generated model bytes are fetched.
    if (
      samplerCandidateCap === null ||
      samplerCandidateCap !== plan.samplerCandidateCap ||
      samplerCandidateCap !== registryModulePlanSamplerCandidateCap
    ) {
      throw new Error("Module plan sampler candidate cap mismatch");
    }
    const tokenizerChecksum = requireManifestField(fields, "module_plan_tokenizer_checksum", source);
    if (
      !isRegistryHex64(tokenizerChecksum) ||
      tokenizerChecksum !== plan.tokenizerChecksum ||
      tokenizerChecksum !== model.tokenizerChecksum
    ) {
      throw new Error("Module plan tokenizer checksum mismatch");
    }
    const modelByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_model_byte_budget",
      plan.modelByteBudget
    );
    const adapterByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_adapter_byte_budget",
      plan.adapterByteBudget
    );
    const adapterStackByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_adapter_stack_byte_budget",
      plan.adapterStackByteBudget
    );
    const promptByteLimit = requireModulePlanByteBudget(
      fields,
      "module_plan_prompt_byte_limit",
      plan.promptByteLimit
    );
    const runtimeScratchByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_runtime_scratch_byte_budget",
      plan.runtimeScratchByteBudget
    );
    const outputByteLimit = requireModulePlanByteBudget(
      fields,
      "module_plan_output_byte_limit",
      plan.outputByteLimit
    );
    const kvCacheByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_kv_cache_byte_budget",
      plan.kvCacheByteBudget
    );
    const kvCachePageCountValue = requireManifestField(
      fields,
      "module_plan_kv_cache_page_count",
      source
    );
    const kvCachePageCount = Number.parseInt(kvCachePageCountValue, 10);
    if (
      !Number.isInteger(kvCachePageCount) ||
      String(kvCachePageCount) !== kvCachePageCountValue ||
      kvCachePageCount !== plan.kvCachePageCount ||
      kvCachePageCount !== modulePlanPageCountForBytes(kvCacheByteBudget)
    ) {
      throw new Error("Module plan KV cache page count mismatch");
    }
    const totalByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_total_byte_budget",
      plan.totalByteBudget
    );
    const totalByteBudgetLimit = requireModulePlanByteBudget(
      fields,
      "module_plan_total_byte_budget_limit",
      plan.totalByteBudgetLimit
    );
    if (modelByteBudget !== model.modelBytes) {
      throw new Error("Module plan model byte budget mismatch");
    }
    if (model.adapterFamily && adapterByteBudget !== model.adapterFamily.autoApplyByteBudget) {
      throw new Error("Module plan adapter byte budget mismatch");
    }
    if (adapterStackByteBudget <= 0 || adapterStackByteBudget > adapterByteBudget) {
      throw new Error("Module plan adapter stack byte budget mismatch");
    }
    if (promptByteLimit !== registryModulePlanPromptByteLimit) {
      throw new Error("Module plan prompt byte limit mismatch");
    }
    if (
      wasmHeapMinBytes !==
      modulePlanWasmHeapMinBytes(modelByteBudget, adapterStackByteBudget, promptByteLimit)
    ) {
      throw new Error("Module plan WASM heap min bytes mismatch");
    }
    probeWasmHeapAllocation(wasmHeapMinBytes);
    if (runtimeScratchByteBudget !== registryModulePlanRuntimeScratchByteBudget) {
      throw new Error("Module plan runtime scratch byte budget mismatch");
    }
    if (outputByteLimit !== registryModulePlanOutputByteLimit) {
      throw new Error("Module plan output byte limit mismatch");
    }
    if (kvCacheByteBudget > registryModulePlanKvCacheByteBudgetLimit) {
      throw new Error("Module plan KV cache byte budget mismatch");
    }
    if (
      totalByteBudgetLimit !== registryModulePlanTotalByteBudgetLimit ||
      totalByteBudget > totalByteBudgetLimit
    ) {
      throw new Error("Module plan total byte budget limit mismatch");
    }
    requireManifestEqual(fields, "model_path", model.path, source);
    requireManifestEqual(fields, "manifest_path", `${model.path}.manifest`, source);
    requireManifestEqual(fields, "quantization", model.quantization, source);
    const modelChecksum = requireManifestField(fields, "model_checksum", source);
    const manifestChecksum = requireManifestField(fields, "manifest_checksum", source);
    if (!isRegistryHex64(modelChecksum) || !isRegistryHex64(manifestChecksum)) {
      throw new Error("Module plan model checksum field is invalid");
    }
    if (model.assembly) {
      requireManifestEqual(fields, "assembly_receipt_path", model.assembly.path, source);
      requireChecksumEqual(
        requireManifestField(fields, "assembly_receipt_checksum", source),
        model.assembly.checksum,
        "module plan assembly"
      );
    }
    if (model.adapterFamily) {
      requireManifestEqual(fields, "adapter_family_receipt_path", model.adapterFamily.path, source);
      requireChecksumEqual(
        requireManifestField(fields, "adapter_family_receipt_checksum", source),
        model.adapterFamily.checksum,
        "module plan adapter family"
      );
      const stackCountValue = requireManifestField(fields, "adapter_auto_apply_stack_count", source);
      const stackCount = Number.parseInt(stackCountValue, 10);
      if (
        !Number.isInteger(stackCount) ||
        String(stackCount) !== stackCountValue ||
        stackCount !== model.adapterFamily.autoApplyStackCount
      ) {
        throw new Error("Module plan adapter stack count mismatch");
      }
    }
    const moduleCountValue = requireManifestField(fields, "module_count", source);
    const moduleCount = Number.parseInt(moduleCountValue, 10);
    if (
      !Number.isInteger(moduleCount) ||
      String(moduleCount) !== moduleCountValue ||
      moduleCount !== plan.moduleCount
    ) {
      throw new Error("Module plan module count mismatch");
    }
    requireModulePlanLine(
      fields,
      0,
      "model",
      "runtime-model",
      "runtime-model",
      modulePlanPhase(0),
      modulePlanDependency(0),
      model.path,
      modelChecksum,
      model.modelBytes,
      modelByteBudget
    );
    requireModulePlanLine(
      fields,
      1,
      "model-manifest",
      "model-manifest",
      "model-provenance-manifest",
      modulePlanPhase(1),
      modulePlanDependency(1),
      `${model.path}.manifest`,
      manifestChecksum,
      null,
      manifestTextByteBudget
    );
    if (model.assembly) {
      requireModulePlanLine(
        fields,
        2,
        "assembly-receipt",
        "assembly-receipt",
        "assembly-evidence",
        modulePlanPhase(2),
        modulePlanDependency(2),
        model.assembly.path,
        model.assembly.checksum,
        null,
        receiptTextByteBudget
      );
    }
    if (model.adapterFamily) {
      requireModulePlanLine(
        fields,
        3,
        "adapter-family-receipt",
        "adapter-family-receipt",
        "adapter-family",
        modulePlanPhase(3),
        modulePlanDependency(3),
        model.adapterFamily.path,
        model.adapterFamily.checksum,
        null,
        receiptTextByteBudget
      );
      const seen = new Set();
      let declaredStackByteBudget = 0;
      for (let stackIndex = 0; stackIndex < model.adapterFamily.autoApplyStackCount; stackIndex += 1) {
        const moduleIndex = stackIndex + 4;
        const prefix = `module.${moduleIndex}`;
        requireManifestEqual(fields, `${prefix}.kind`, "adapter-stack-member", source);
        const indexValue = requireManifestField(fields, `${prefix}.adapter_index`, source);
        const adapterIndex = Number.parseInt(indexValue, 10);
        if (
          !Number.isInteger(adapterIndex) ||
          String(adapterIndex) !== indexValue ||
          adapterIndex < 0 ||
          adapterIndex >= model.adapters.length ||
          seen.has(adapterIndex)
        ) {
          throw new Error("Module plan adapter index mismatch");
        }
        const adapter = model.adapters[adapterIndex];
        requireManifestEqual(fields, `${prefix}.assembly_slot`, modulePlanAdapterSlot(stackIndex), source);
        requireManifestEqual(fields, `${prefix}.role`, modulePlanAdapterRole(adapter.path), source);
        requireManifestEqual(fields, `${prefix}.phase`, modulePlanPhase(moduleIndex), source);
        requireManifestEqual(fields, `${prefix}.depends_on`, modulePlanDependency(moduleIndex), source);
        declaredStackByteBudget += requireModulePlanByteCount(
          fields,
          prefix,
          null,
          model.adapterFamily.autoApplyByteBudget,
          source
        );
        requireChecksumEqual(
          requireManifestField(fields, `${prefix}.checksum`, source),
          adapter.artifactChecksum,
          "module plan adapter module"
        );
        requireManifestEqual(fields, `${prefix}.adapter_path`, adapter.path, source);
        requireManifestEqual(fields, `${prefix}.manifest_path`, adapter.manifestPath, source);
        requireChecksumEqual(
          requireManifestField(fields, `${prefix}.artifact_checksum`, source),
          adapter.artifactChecksum,
          "module plan adapter artifact"
        );
        requireChecksumEqual(
          requireManifestField(fields, `${prefix}.manifest_checksum`, source),
          adapter.manifestChecksum,
          "module plan adapter manifest"
        );
        seen.add(adapterIndex);
      }
      if (declaredStackByteBudget !== adapterStackByteBudget) {
        throw new Error("Module plan adapter stack byte budget mismatch");
      }
    }
    if (
      modulePlanDeclaredByteTotal(
        fields,
      moduleCount,
      promptByteLimit,
      runtimeScratchByteBudget,
      outputByteLimit,
        kvCacheByteBudget
      ) !==
      totalByteBudget
    ) {
      throw new Error("Module plan total byte budget mismatch");
    }
    return fields;
  }

  function modulePlanAdapterRole(adapterPath) {
    if (adapterPath.endsWith("-sparse.asp1")) {
      return "adapter-stack-sparse-delta";
    }
    if (adapterPath.endsWith("-low-rank.alr1")) {
      return "adapter-stack-low-rank-delta";
    }
    if (adapterPath.endsWith("-family.adp1")) {
      return "adapter-stack-family-delta";
    }
    if (adapterPath.endsWith("-self.adp1")) {
      return "adapter-stack-self-delta";
    }
    return "adapter-stack-delta";
  }

  function modulePlanAdapterSlot(stackIndex) {
    return `adapter-stack-${stackIndex}`;
  }

  function modulePlanDependency(index) {
    return index === 0 ? "runtime-wasm" : `module.${index - 1}`;
  }

  function modulePlanPhase(index) {
    const basePhases = [
      "load-model-bytes",
      "verify-model-manifest",
      "verify-assembly-evidence",
      "verify-adapter-family"
    ];
    return index < basePhases.length ? basePhases[index] : `apply-adapter-stack-${index - 4}`;
  }

  function requireModulePlanByteBudget(fields, key, expected) {
    const source = "Module plan";
    const value = requireManifestField(fields, key, source);
    const bytes = registryDecimalByteCount(value);
    if (bytes === null || bytes !== expected) {
      throw new Error(`Module plan ${key.replace(/_/g, " ")} mismatch`);
    }
    return bytes;
  }

  // Requires a decimal module-plan count to match the selector-owned envelope.
  function requireModulePlanCount(fields, key, expected) {
    const source = "Module plan";
    const value = requireManifestField(fields, key, source);
    const count = registryDecimalCount(value);
    if (count === null || count !== expected) {
      throw new Error(`Module plan ${key.replace(/_/g, " ")} mismatch`);
    }
    return count;
  }

  // Mirrors the route classes fetched during generated self-assembly.
  function modulePlanDeclaredFetchCount(model, moduleCount) {
    let fetchCount = 1 + moduleCount;
    if (model.assembly) {
      fetchCount += assemblyEvidenceRoutesForOperatorPrefix("operator").length;
    }
    if (Array.isArray(model.adapters)) {
      fetchCount += model.adapters.length;
    }
    return fetchCount;
  }

  // Requires the browser-observed generated fetch count to match the verified receipt.
  function requireModulePlanActualFetchCount(model) {
    if (!model || !model.modulePlan) {
      return;
    }
    if (state.modulePlanActualFetchCount !== model.modulePlan.plannedFetchCount) {
      throw new Error("Module plan actual fetch count mismatch");
    }
    updateModulePlanActualFetchCount(model.modulePlanReceipt);
  }

  // Requires the browser-observed generated route set to match the declared route-set checksum.
  function requireModulePlanActualRouteSet(model) {
    if (!model || !model.modulePlan) {
      return;
    }
    if (
      !Array.isArray(state.modulePlanActualRoutes) ||
      state.modulePlanActualRoutes.length !== model.modulePlan.plannedFetchCount ||
      state.modulePlanActualRoutes.length !== state.modulePlanActualFetchCount
    ) {
      throw new Error("Module plan actual route set mismatch");
    }
    const actualChecksum = modulePlanRouteSetChecksum(state.modulePlanActualRoutes);
    state.modulePlanActualRouteSetChecksum = actualChecksum;
    if (actualChecksum !== model.modulePlan.routeSetChecksum) {
      throw new Error("Module plan actual route set mismatch");
    }
    updateModulePlanActualRouteSetChecksum(model.modulePlanReceipt);
  }

  // Requires observed module bytes to match the checksum-verified module byte rows.
  function requireModulePlanActualModuleBytes(model) {
    if (!model || !model.modulePlan) {
      return;
    }
    const declared = modulePlanModuleByteTotal(model.modulePlanReceipt);
    if (
      !declared ||
      !Array.isArray(state.modulePlanActualModuleByteIndexes) ||
      state.modulePlanActualModuleByteIndexes.length !== declared.count ||
      state.modulePlanActualModuleBytes !== declared.total
    ) {
      throw new Error("Module plan actual module bytes mismatch");
    }
    updateModulePlanActualModuleBytes(model.modulePlanReceipt);
  }

  // Requires observed module checksums to match every checksum-verified module row.
  function requireModulePlanActualModuleChecksums(model) {
    if (!model || !model.modulePlan) {
      return;
    }
    const declared = modulePlanModuleChecksumList(model.modulePlanReceipt);
    if (!declared || !Array.isArray(state.modulePlanActualModuleChecksums)) {
      throw new Error("Module plan actual module checksum mismatch");
    }
    for (let index = 0; index < declared.length; index += 1) {
      if (state.modulePlanActualModuleChecksums[index] !== declared[index]) {
        throw new Error("Module plan actual module checksum mismatch");
      }
    }
    updateModulePlanActualModuleChecksums(model.modulePlanReceipt);
  }

  // Recomputes the receipt-declared self-assembly total before generated bytes are used.
  function modulePlanDeclaredByteTotal(
    fields,
    moduleCount,
    promptByteLimit,
    runtimeScratchByteBudget,
    outputByteLimit,
    kvCacheByteBudget
  ) {
    let total = promptByteLimit + runtimeScratchByteBudget + outputByteLimit + kvCacheByteBudget;
    for (let index = 0; index < moduleCount; index += 1) {
      const bytes = registryDecimalByteCount(
        requireManifestField(fields, `module.${index}.byte_count`, "Module plan")
      );
      if (bytes === null) {
        throw new Error("Module plan module byte count mismatch");
      }
      total += bytes;
    }
    return total;
  }

  function requireModulePlanByteCount(fields, prefix, expected, max, source) {
    const value = requireManifestField(fields, `${prefix}.byte_count`, source);
    const bytes = registryDecimalByteCount(value);
    if (
      bytes === null ||
      (expected !== null && bytes !== expected) ||
      (expected === null && Number.isSafeInteger(max) && bytes > max)
    ) {
      throw new Error(`${source || "Receipt"} field ${prefix}.byte_count was ${value}`);
    }
    return bytes;
  }

  function requireModulePlanActualByteCount(fields, index, actualBytes) {
    requireModulePlanByteCount(fields, `module.${index}`, actualBytes, null, "Module plan");
  }

  // Records one browser-observed module byte count after the module payload is fetched.
  function recordModulePlanActualModuleBytes(model, index, actualBytes) {
    if (!model || !model.modulePlan || !model.modulePlanReceipt) {
      return;
    }
    if (
      !Number.isInteger(index) ||
      !Number.isSafeInteger(actualBytes) ||
      actualBytes < 0 ||
      !Array.isArray(state.modulePlanActualModuleByteIndexes)
    ) {
      throw new Error("Module plan actual module byte metadata mismatch");
    }
    if (state.modulePlanActualModuleByteIndexes.includes(index)) {
      throw new Error("Module plan actual module byte duplicate");
    }
    requireModulePlanActualByteCount(model.modulePlanReceipt, index, actualBytes);
    state.modulePlanActualModuleByteIndexes.push(index);
    state.modulePlanActualModuleBytes += actualBytes;
    updateModulePlanActualModuleBytes(model.modulePlanReceipt);
  }

  // Records both the byte count and checksum for a fetched generated text module.
  function requireModulePlanTextByteCount(model, index, text) {
    if (model.modulePlanReceipt) {
      recordModulePlanActualModuleBytes(model, index, state.encoder.encode(text).length);
      recordModulePlanActualModuleChecksum(model, index, textChecksumHex(text));
    }
  }

  // Records one browser-observed module checksum after the module payload is accepted.
  function recordModulePlanActualModuleChecksum(model, index, actualChecksum) {
    if (!model || !model.modulePlan || !model.modulePlanReceipt) {
      return;
    }
    if (
      !Number.isInteger(index) ||
      !isRegistryHex64(actualChecksum) ||
      !Array.isArray(state.modulePlanActualModuleChecksums)
    ) {
      throw new Error("Module plan actual module checksum metadata mismatch");
    }
    if (state.modulePlanActualModuleChecksums[index]) {
      throw new Error("Module plan actual module checksum duplicate");
    }
    requireChecksumEqual(
      actualChecksum,
      requireManifestField(model.modulePlanReceipt, `module.${index}.checksum`, "Module plan"),
      "module plan actual module"
    );
    state.modulePlanActualModuleChecksums[index] = actualChecksum;
    updateModulePlanActualModuleChecksums(model.modulePlanReceipt);
  }

  function modulePlanStackModuleIndexForAdapter(fields, adapterIndex) {
    const countValue = fields && fields.module_count;
    const count = Number.parseInt(countValue || "0", 10);
    if (!Number.isInteger(count) || String(count) !== countValue || count < 5) {
      return null;
    }
    for (let moduleIndex = 4; moduleIndex < count; moduleIndex += 1) {
      const value = fields[`module.${moduleIndex}.adapter_index`];
      if (value === String(adapterIndex)) {
        return moduleIndex;
      }
    }
    return null;
  }

  function requireModulePlanLine(
    fields,
    index,
    kind,
    assemblySlot,
    role,
    phase,
    dependsOn,
    path,
    checksum,
    byteCount,
    maxByteCount
  ) {
    const source = "Module plan";
    const prefix = `module.${index}`;
    requireManifestEqual(fields, `${prefix}.kind`, kind, source);
    requireManifestEqual(fields, `${prefix}.assembly_slot`, assemblySlot, source);
    requireManifestEqual(fields, `${prefix}.role`, role, source);
    requireManifestEqual(fields, `${prefix}.phase`, phase, source);
    requireManifestEqual(fields, `${prefix}.depends_on`, dependsOn, source);
    requireModulePlanByteCount(fields, prefix, byteCount, maxByteCount, source);
    requireManifestEqual(fields, `${prefix}.path`, path, source);
    requireChecksumEqual(
      requireManifestField(fields, `${prefix}.checksum`, source),
      checksum,
      `module plan ${kind}`
    );
  }

  async function loadModulePlanReceipt(model) {
    if (!model.modulePlan) {
      state.modulePlanReceipt = null;
      renderModulePlan("none", null, false);
      resetModulePlanTrace("unavailable", false);
      return "";
    }
    model.modulePlanVerified = false;
    model.modulePlanReceipt = null;
    state.modulePlanReceipt = null;
    const text = await fetchModulePlanTextWithinBudget(
      model,
      model.modulePlan.path,
      receiptTextByteBudget,
      "module plan",
      "module-plan-receipt"
    );
    const fields = validateModulePlanReceipt(model, text);
    model.modulePlanReceipt = fields;
    model.modulePlanVerified = true;
    state.modulePlanReceipt = fields;
    renderModulePlan("loaded", fields, false);
    resetModulePlanTrace("", false);
    recordModulePlanTrace("plan verified");
    return "module plan verified";
  }

  function validateAssemblyReceipt(model, receiptText) {
    const assembly = model.assembly;
    if (!assembly) {
      return null;
    }
    if (!state.modelManifest) {
      throw new Error("Assembly receipt requires a loaded model manifest");
    }
    requireChecksumEqual(textChecksumHex(receiptText), assembly.checksum, "assembly receipt");
    const fields = parseManifest(receiptText);
    const source = "Assembly receipt";
    requireManifestEqual(fields, "tinyrustlm_assembly_receipt_version", "1", source);
    requireManifestEqual(fields, "assembly_kind", registryAssemblyKind, source);
    requireManifestEqual(fields, "assembly_status", assemblyReceiptStatus, source);
    const assemblyStrategy = requireManifestField(fields, "assembly_strategy", source);
    if (!assemblyReceiptStrategies.has(assemblyStrategy)) {
      throw new Error("Assembly receipt strategy mismatch");
    }
    requireManifestEqual(fields, "candidate_id", state.activeModelKey, source);
    requireManifestEqual(fields, "assembly_receipt_path", assembly.path, source);
    requireManifestEqual(fields, "model_path", model.path, source);
    requireManifestEqual(fields, "manifest_path", `${model.path}.manifest`, source);
    requireChecksumEqual(
      requireManifestField(fields, "slm_checksum", "assembly receipt"),
      requireManifestField(state.modelManifest, "slm_checksum", "model manifest"),
      "assembly model"
    );
    const parentCount = Number.parseInt(requireManifestField(fields, "parent_count", "assembly receipt"), 10);
    if (!Number.isInteger(parentCount) || parentCount < 1 || parentCount > 16) {
      throw new Error("Assembly receipt parent count mismatch");
    }
    for (const key of [
      "manifest_checksum",
      "promotion_ledger_checksum",
      "population_review_checksum",
      "parent_pool_recipe_checksum",
      "operator_receipt_checksum",
      "candidate_manifest_checksum",
      "promotion_manifest_checksum",
      "runtime_smoke_manifest_checksum",
      "eval_manifest_checksum",
      "eval_case_evidence_checksum",
      "admission_checksum",
      "adapter_family_receipt_checksum"
    ]) {
      const value = requireManifestField(fields, key, "assembly receipt");
      if (!isRegistryHex64(value)) {
        throw new Error(`Assembly receipt field ${key} is invalid`);
      }
    }
    const operatorReceiptPath = requireManifestField(
      fields,
      "operator_receipt_path",
      "assembly receipt"
    );
    const operatorEvidencePrefix = assemblyEvidencePrefixFromOperatorPath(
      state.activeModelKey,
      operatorReceiptPath
    );
    if (!operatorEvidencePrefix) {
      throw new Error("Assembly receipt operator evidence path mismatch");
    }
    for (const [pathKey, _checksumKey, fileName] of assemblyEvidenceRoutesForOperatorPrefix(operatorEvidencePrefix)) {
      const route = requireManifestField(fields, pathKey, "assembly receipt");
      if (
        !isSafeAssemblyEvidencePath(route) ||
        route !== modulePlanEvidenceRoute(state.activeModelKey, fileName)
      ) {
        throw new Error(`Assembly receipt field ${pathKey} is invalid`);
      }
    }
    if (model.modulePlan) {
      requireManifestEqual(
        fields,
        "operator_receipt_path",
        model.modulePlan.operatorReceiptPath,
        source
      );
      requireChecksumEqual(
        requireManifestField(fields, "operator_receipt_checksum", "assembly receipt"),
        model.modulePlan.operatorReceiptChecksum,
        "assembly operator receipt"
      );
    }
    if (model.adapterFamily) {
      requireManifestEqual(fields, "adapter_family_receipt_path", model.adapterFamily.path, source);
      requireChecksumEqual(
        requireManifestField(fields, "adapter_family_receipt_checksum", "assembly receipt"),
        model.adapterFamily.checksum,
        "assembly adapter family"
      );
    }
    if (model.evalEvidence) {
      requireChecksumEqual(
        requireManifestField(fields, "eval_case_evidence_checksum", "assembly receipt"),
        model.evalEvidence.checksum,
        "assembly eval case evidence"
      );
    }
    requireManifestEqual(fields, "required_next_gate", "browser-selector-registry-route-binding", source);
    return fields;
  }

  async function loadRuntimeSmokeEvidence(model) {
    // Binds converted-trained selector runtime evidence to the fetched sidecar before model bytes.
    const runtimeSmoke = model.runtimeSmokeEvidence;
    if (!runtimeSmoke || !runtimeSmoke.path) {
      return "runtime smoke evidence unavailable";
    }
    runtimeSmoke.verified = false;
    runtimeSmoke.fields = null;
    const text = await fetchTextWithinBudget(
      runtimeSmoke.path,
      evidenceTextByteBudget,
      "runtime smoke evidence"
    );
    requireChecksumEqual(
      textChecksumHex(text),
      runtimeSmoke.manifestChecksum,
      "runtime smoke evidence"
    );
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_runtime_smoke_version",
      "1",
      "runtime smoke evidence"
    );
    requireManifestEqual(fields, "gate", "runtime-smoke", "runtime smoke evidence");
    requireManifestEqual(fields, "source_kind", "converted-trained", "runtime smoke evidence");
    requireManifestEqual(fields, "runtime_smoke_status", "pass", "runtime smoke evidence");
    requireManifestEqual(
      fields,
      "runtime_smoke_decision",
      "accepted-for-runtime-smoke",
      "runtime smoke evidence"
    );
    requireManifestEqual(
      fields,
      "required_next_gate",
      "promotion-eval-and-selector-admission",
      "runtime smoke evidence"
    );
    runtimeSmoke.fields = fields;
    runtimeSmoke.verified = true;
    return "runtime smoke evidence verified";
  }

  async function verifyAssemblyEvidenceFiles(model, fields) {
    const evidence = [];
    const operatorEvidencePrefix = assemblyEvidencePrefixFromOperatorPath(
      state.activeModelKey,
      requireManifestField(fields, "operator_receipt_path", "assembly receipt")
    );
    if (!operatorEvidencePrefix) {
      throw new Error("Assembly receipt operator evidence path mismatch");
    }
    for (const [pathKey, checksumKey] of assemblyEvidenceRoutesForOperatorPrefix(operatorEvidencePrefix)) {
      const route = requireManifestField(fields, pathKey, "assembly receipt");
      const expectedChecksum = requireManifestField(fields, checksumKey, "assembly receipt");
      const text = await fetchModulePlanTextWithinBudget(
        model,
        route,
        evidenceTextByteBudget,
        "assembly evidence",
        "assembly-evidence"
      );
      requireChecksumEqual(textChecksumHex(text), expectedChecksum, `assembly evidence ${pathKey}`);
      evidence.push({
        pathKey,
        checksumKey,
        route,
        checksum: expectedChecksum
      });
    }
    return evidence;
  }

  async function loadAssemblyReceipt(model) {
    if (!model.assembly) {
      state.assemblyReceipt = null;
      renderAssembly("none", null, false);
      return "";
    }
    model.assemblyVerified = false;
    model.assemblyReceipt = null;
    model.assemblyEvidence = null;
    const text = await fetchModulePlanTextWithinBudget(
      model,
      model.assembly.path,
      receiptTextByteBudget,
      "assembly receipt",
      "assembly-receipt"
    );
    requireModulePlanTextByteCount(model, 2, text);
    const fields = validateAssemblyReceipt(model, text);
    const evidence = await verifyAssemblyEvidenceFiles(model, fields);
    model.assemblyReceipt = fields;
    model.assemblyEvidence = evidence;
    model.assemblyVerified = true;
    state.assemblyReceipt = fields;
    renderAssembly("loaded", fields, false);
    return "assembly verified";
  }

  function setAdapterControls(canApply) {
    const hasAdapter = Boolean(selectedAdapter());
    el.adapterSelect.disabled = !canApply || !hasAdapter;
    el.applyAdapterButton.disabled = !canApply || !hasAdapter;
  }

  async function loadModelManifest(model) {
    if (model.localFile) {
      const catalogEntry = model.localFile.catalogEntry || null;
      const fields = {
        source_kind: catalogEntry ? catalogEntry.sourceKind : "user-local-file",
        source_id: catalogEntry ? catalogEntry.modelId : model.localFile.name,
        source_snapshot: catalogEntry ? "catalog-metadata-plus-browser-file-picker" : "browser-file-picker",
        model_shape: catalogEntry ? catalogEntry.modelShape || "runtime-validated-by-wasm" : "runtime-validated-by-wasm",
        quality_claim: catalogEntry ? catalogEntry.qualityClaim : "not-claimed",
        trained_quality_claim: catalogEntry ? catalogEntry.trainedQualityClaim : "not-claimed",
        admission_status: catalogEntry ? catalogEntry.admissionStatus : "runtime-validated-local-file",
        slm_checksum: model.localFile.checksum,
        artifact_sha256: model.localFile.sha256,
        artifact_bytes: String(model.localFile.byteLength),
        required_next_gate: catalogEntry ? catalogEntry.requiredNextGate : "user-owned-local-review"
      };
      state.modelManifest = fields;
      renderProvenance("local file", fields, false);
      return;
    }
    const manifestPath = `${model.path}.manifest`;
    try {
      const text = await fetchModulePlanTextWithinBudget(
        model,
        manifestPath,
        manifestTextByteBudget,
        ".slm manifest",
        "model-manifest"
      );
      requireModulePlanTextByteCount(model, 1, text);
      const fields = parseManifest(text);
      if (model.modulePlanReceipt) {
        recordModulePlanActualModuleChecksum(
          model,
          0,
          requireManifestField(fields, "slm_checksum", "model manifest")
        );
      }
      state.modelManifest = fields;
      renderProvenance("loaded", fields, false);
    } catch (error) {
      state.modelManifest = null;
      renderProvenance(errorMessage(error), null, true);
    }
  }

  async function loadSourceManifest(model) {
    // Verifies reviewed trained-source evidence before converted model bytes are fetched.
    if (!model.sourceManifest) {
      return "source manifest unavailable";
    }
    model.sourceManifestVerified = false;
    model.sourceManifestFields = null;
    const text = await fetchTextWithinBudget(
      model.sourceManifest.path,
      evidenceTextByteBudget,
      "source manifest"
    );
    requireChecksumEqual(textChecksumHex(text), model.sourceManifest.checksum, "source manifest");
    const fields = parseManifest(text);
    requireManifestEqual(fields, "tinyrustlm_trained_source_version", "1", "source manifest");
    requireManifestEqual(fields, "model_family", "tinyrustlm", "source manifest");
    requireManifestEqual(fields, "layout", registrySourceManifestLayout, "source manifest");
    requireManifestEqual(fields, "source_dtype", "f32", "source manifest");
    requireManifestField(fields, "source_kind", "source manifest");
    requireManifestField(fields, "source_id", "source manifest");
    requireManifestEqual(
      fields,
      "source_kind",
      model.sourceManifest.sourceKind,
      "source manifest identity"
    );
    requireManifestEqual(
      fields,
      "source_id",
      model.sourceManifest.sourceId,
      "source manifest identity"
    );
    requireManifestEqual(
      fields,
      "model_shape",
      model.sourceManifest.modelShape,
      "source manifest identity"
    );
    const sourceReviewKeys = [
      "source_review_kind",
      "source_review_status",
      "source_review_checksum",
      "source_review_required_next_gate"
    ];
    const manifestHasSourceReview = sourceReviewKeys.some((key) => fields[key]);
    if (manifestHasSourceReview && !model.sourceManifest.sourceReview) {
      throw new Error("source review identity missing from selector");
    }
    if (model.sourceManifest.sourceReview) {
      requireManifestEqual(
        fields,
        "source_review_kind",
        model.sourceManifest.sourceReview.kind,
        "source review identity"
      );
      requireManifestEqual(
        fields,
        "source_review_status",
        model.sourceManifest.sourceReview.status,
        "source review identity"
      );
      requireManifestEqual(
        fields,
        "source_review_checksum",
        model.sourceManifest.sourceReview.checksum,
        "source review identity"
      );
      requireManifestEqual(
        fields,
        "source_review_required_next_gate",
        model.sourceManifest.sourceReview.requiredNextGate,
        "source review identity"
      );
    }
    const tensorCount = registryDecimalCount(
      requireManifestField(fields, "tensor_count", "source manifest")
    );
    if (tensorCount === null) {
      throw new Error("source manifest tensor count mismatch");
    }
    model.sourceManifestFields = fields;
    model.sourceManifestVerified = true;
    return "source manifest verified";
  }

  async function loadSourceReviewEvidence(model) {
    // Fetches the reviewed safetensors candidate report before model bytes are requested.
    const sourceReview =
      model.sourceManifest && model.sourceManifest.sourceReview
        ? model.sourceManifest.sourceReview
        : null;
    if (!sourceReview) {
      return "source review unavailable";
    }
    sourceReview.verified = false;
    sourceReview.fields = null;
    const text = await fetchTextWithinBudget(
      sourceReview.path,
      evidenceTextByteBudget,
      "source review"
    );
    requireChecksumEqual(textChecksumHex(text), sourceReview.checksum, "source review");
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_safetensors_candidate_review_version",
      "1",
      "source review"
    );
    requireManifestEqual(
      fields,
      "review_layout",
      "safetensors-real-trained-candidate-review-v1",
      "source review"
    );
    requireManifestEqual(
      fields,
      "target_model_shape",
      model.sourceManifest.modelShape,
      "source review"
    );
    const sourceModelId = requireManifestField(fields, "source_model_id", "source review");
    const sourceModelSha = requireSourceModelShaManifestField(
      fields,
      "source_model_sha",
      "source review"
    );
    const sourceConfigChecksum = requireHex64ManifestField(fields, "source_config_checksum", "source review");
    const sourceTokenizerChecksum = requireHex64ManifestField(fields, "source_tokenizer_checksum", "source review");
    const sourceLicenseRoute = requireManifestField(fields, "source_license_route", "source review");
    const referencePromptRoute = requireManifestField(fields, "reference_prompt_route", "source review");
    const referenceOutputChecksum = requireHex64ManifestField(fields, "reference_output_checksum", "source review");
    const evalCasesRoute = requireManifestField(fields, "eval_cases_route", "source review");
    const artifacts = {
      config: requireOptionalSourceReviewArtifact(fields, "source_config"),
      tokenizer: requireOptionalSourceReviewArtifact(fields, "source_tokenizer"),
      license: requireOptionalSourceReviewArtifact(fields, "source_license"),
      prompt: requireOptionalSourceReviewArtifact(fields, "reference_prompt"),
      eval: requireOptionalSourceReviewArtifact(fields, "eval_cases")
    };
    const tokenizerImport = requireSourceReviewTokenizerImport(fields);
    if (artifacts.config && artifacts.config.status !== "not-local") {
      requireChecksumEqual(artifacts.config.checksum, sourceConfigChecksum, "source config artifact");
    }
    if (artifacts.tokenizer && artifacts.tokenizer.status !== "not-local") {
      requireChecksumEqual(artifacts.tokenizer.checksum, sourceTokenizerChecksum, "source tokenizer artifact");
    }
    requireManifestEqual(
      fields,
      "required_next_gate",
      sourceReview.requiredNextGate,
      "source review"
    );
    sourceReview.sourceModelId = sourceModelId;
    sourceReview.sourceModelSha = sourceModelSha;
    sourceReview.sourceConfigChecksum = sourceConfigChecksum;
    sourceReview.sourceTokenizerChecksum = sourceTokenizerChecksum;
    sourceReview.sourceLicenseRoute = sourceLicenseRoute;
    sourceReview.referencePromptRoute = referencePromptRoute;
    sourceReview.referenceOutputChecksum = referenceOutputChecksum;
    sourceReview.evalCasesRoute = evalCasesRoute;
    sourceReview.artifacts = artifacts;
    sourceReview.tokenizerImport = tokenizerImport;
    sourceReview.fields = fields;
    sourceReview.verified = true;
    return "source review verified";
  }

  async function loadSourceValidationEvidence(model) {
    // Verifies the converted-trained validate-source gate before runtime smoke, eval, or model bytes.
    const sourceValidation = model.sourceValidation;
    if (!sourceValidation || !sourceValidation.path) {
      return "source validation unavailable";
    }
    if (!model.sourceManifest || !model.sourceManifestVerified || !model.sourceManifestFields) {
      throw new Error("source validation requires verified source manifest");
    }
    sourceValidation.verified = false;
    sourceValidation.fields = null;
    const text = await fetchTextWithinBudget(
      sourceValidation.path,
      evidenceTextByteBudget,
      "source validation"
    );
    requireChecksumEqual(textChecksumHex(text), sourceValidation.checksum, "source validation");
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_source_validation_version",
      "1",
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_validation_gate",
      registrySourceValidationGate,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_validation_status",
      registrySourceValidationStatus,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_validation_decision",
      registrySourceValidationDecision,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_manifest_path",
      model.sourceManifest.path,
      "source validation"
    );
    requireChecksumEqual(
      requireManifestField(fields, "source_manifest_checksum", "source validation"),
      model.sourceManifest.checksum,
      "source validation source manifest"
    );
    requireManifestEqual(
      fields,
      "source_kind",
      model.sourceManifest.sourceKind,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "source_id",
      model.sourceManifest.sourceId,
      "source validation"
    );
    requireManifestEqual(
      fields,
      "model_shape",
      model.sourceManifest.modelShape,
      "source validation"
    );
    requireManifestEqual(fields, "source_dtype", "f32", "source validation");
    requireManifestEqual(
      fields,
      "tied_output",
      requireManifestField(model.sourceManifestFields, "tied_output", "source manifest"),
      "source validation"
    );
    requireManifestEqual(
      fields,
      "tensor_count",
      requireManifestField(model.sourceManifestFields, "tensor_count", "source manifest"),
      "source validation"
    );
    if (
      registryDecimalCount(requireManifestField(fields, "tensor_count", "source validation")) ===
      null
    ) {
      throw new Error("source validation tensor count mismatch");
    }
    if (model.sourceManifest.sourceReview) {
      requireChecksumEqual(
        requireManifestField(fields, "source_review_checksum", "source validation"),
        model.sourceManifest.sourceReview.checksum,
        "source validation source review"
      );
    }
    requireManifestEqual(
      fields,
      "required_next_gate",
      registrySourceValidationRequiredNextGate,
      "source validation"
    );
    sourceValidation.fields = fields;
    sourceValidation.verified = true;
    return "source validation verified";
  }

  async function loadEvalEvidence(model) {
    // Binds converted-trained provenance rows to the eval sidecar fetched by this browser load.
    if (!model.sourceManifest) {
      return "eval evidence unavailable";
    }
    const evalEvidence = model.evalEvidence;
    if (!evalEvidence || !evalEvidence.path) {
      throw new Error("converted-trained eval evidence route missing");
    }
    evalEvidence.verified = false;
    evalEvidence.fields = null;
    const text = await fetchTextWithinBudget(
      evalEvidence.path,
      evidenceTextByteBudget,
      "eval evidence"
    );
    requireChecksumEqual(textChecksumHex(text), evalEvidence.manifestChecksum, "eval evidence");
    const fields = parseManifest(text);
    requireManifestEqual(fields, "tinyrustlm_eval_manifest_version", "1", "eval evidence");
    requireManifestEqual(fields, "gate", "assistant-quality", "eval evidence");
    requireManifestEqual(fields, "eval_status", "pass", "eval evidence");
    requireManifestEqual(fields, "task_eval_status", "pass", "eval evidence");
    requireManifestEqual(fields, "cases_failed", "0", "eval evidence");
    requireManifestEqual(fields, "cases_passed", String(evalEvidence.casesPassed), "eval evidence");
    requireManifestEqual(fields, "quality_scope", evalEvidence.qualityScope, "eval evidence");
    requireManifestEqual(fields, "quality_boundary", evalEvidence.qualityBoundary, "eval evidence");
    requireManifestEqual(fields, "eval_dataset", evalEvidence.evalDataset, "eval evidence");
    const sourceReview =
      model.sourceManifest && model.sourceManifest.sourceReview
        ? model.sourceManifest.sourceReview
        : null;
    if (sourceReview && sourceReview.verified) {
      requireManifestEqual(
        fields,
        "eval_cases_route",
        sourceReview.evalCasesRoute,
        "eval evidence route"
      );
    }
    requireChecksumEqual(evalCaseEvidenceChecksum(fields), evalEvidence.checksum, "eval case evidence");
    evalEvidence.fields = fields;
    evalEvidence.verified = true;
    return "eval evidence verified";
  }

  function admissionArtifactMatchesModelPath(admissionArtifactPath, modelPath) {
    // Compares local admission artifact paths with the served browser model route suffix.
    if (!isSafeRegistryModelPath(modelPath)) {
      return false;
    }
    const rest = modelPath.slice("../models/".length);
    const normalized = String(admissionArtifactPath || "").replaceAll("\\", "/");
    return normalized === `../models/${rest}` || normalized.endsWith(`tinyrustlm/models/${rest}`);
  }

  async function loadAdmissionEvidence(model) {
    // Verifies the selector admission record after all referenced evidence and before model bytes.
    const admission = model.admissionEvidence;
    if (!admission || !admission.path) {
      return "admission evidence unavailable";
    }
    if (model.sourceValidation && !model.sourceValidation.verified) {
      throw new Error("admission evidence requires verified source validation");
    }
    if (!model.runtimeSmokeEvidence || !model.runtimeSmokeEvidence.verified) {
      throw new Error("admission evidence requires verified runtime smoke evidence");
    }
    if (!model.evalEvidence || !model.evalEvidence.verified) {
      throw new Error("admission evidence requires verified eval evidence");
    }
    admission.verified = false;
    admission.fields = null;
    const text = await fetchTextWithinBudget(
      admission.path,
      evidenceTextByteBudget,
      "admission evidence"
    );
    requireChecksumEqual(textChecksumHex(text), admission.checksum, "admission evidence");
    const fields = parseManifest(text);
    requireManifestEqual(
      fields,
      "tinyrustlm_selector_admission_version",
      "1",
      "admission evidence"
    );
    requireManifestEqual(fields, "selector_id", "browser-local-selector", "admission evidence");
    requireManifestEqual(fields, "candidate_id", model.candidateId, "admission evidence");
    requireManifestEqual(fields, "admission_path", admission.path, "admission evidence");
    requireManifestEqual(
      fields,
      "admission_status",
      registryAdmissionStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "promotion_status",
      registryAdmissionPromotionStatus,
      "admission evidence"
    );
    if (
      !admissionArtifactMatchesModelPath(
        requireManifestField(fields, "candidate_artifact_path", "admission evidence"),
        model.path
      )
    ) {
      throw new Error("admission evidence candidate artifact path mismatch");
    }
    requireManifestEqual(
      fields,
      "candidate_artifact_bytes",
      String(model.modelBytes),
      "admission evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "candidate_slm_checksum", "admission evidence"),
      model.slmChecksum,
      "admission evidence candidate"
    );
    requireManifestEqual(
      fields,
      "candidate_model_shape",
      model.modelShape,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "candidate_quantization",
      model.quantization,
      "admission evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "candidate_tokenizer_checksum", "admission evidence"),
      model.tokenizerChecksum,
      "admission evidence tokenizer"
    );
    if (model.sourceManifest) {
      requireManifestEqual(
        fields,
        "source_manifest_path",
        model.sourceManifest.path,
        "admission evidence"
      );
      requireChecksumEqual(
        requireManifestField(fields, "source_manifest_checksum", "admission evidence"),
        model.sourceManifest.checksum,
        "admission evidence source manifest"
      );
      if (model.sourceManifest.sourceReview) {
        requireManifestEqual(
          fields,
          "source_review_path",
          model.sourceManifest.sourceReview.path,
          "admission evidence"
        );
        requireChecksumEqual(
          requireManifestField(fields, "source_review_checksum", "admission evidence"),
          model.sourceManifest.sourceReview.checksum,
          "admission evidence source review"
        );
      }
    }
    if (model.sourceValidation) {
      requireManifestEqual(
        fields,
        "source_validation_path",
        model.sourceValidation.path,
        "admission evidence"
      );
      requireChecksumEqual(
        requireManifestField(fields, "source_validation_checksum", "admission evidence"),
        model.sourceValidation.checksum,
        "admission evidence source validation"
      );
    }
    requireManifestEqual(
      fields,
      "runtime_smoke_path",
      model.runtimeSmokeEvidence.path,
      "admission evidence"
    );
    requireChecksumEqual(
      requireManifestField(fields, "runtime_smoke_manifest_checksum", "admission evidence"),
      model.runtimeSmokeEvidence.manifestChecksum,
      "admission evidence runtime smoke"
    );
    requireManifestEqual(fields, "eval_path", model.evalEvidence.path, "admission evidence");
    requireChecksumEqual(
      requireManifestField(fields, "eval_manifest_checksum", "admission evidence"),
      model.evalEvidence.manifestChecksum,
      "admission evidence eval"
    );
    requireChecksumEqual(
      requireManifestField(fields, "eval_case_evidence_checksum", "admission evidence"),
      model.evalEvidence.checksum,
      "admission evidence eval cases"
    );
    requireManifestEqual(
      fields,
      "runtime_smoke_status",
      registryAdmissionRuntimeSmokeStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "eval_status",
      registryAdmissionEvalStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "quality_gate",
      registryAdmissionQualityGate,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "quality_scope",
      model.evalEvidence.qualityScope,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "quality_boundary",
      model.evalEvidence.qualityBoundary,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "eval_dataset",
      model.evalEvidence.evalDataset,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "cases_passed",
      String(model.evalEvidence.casesPassed),
      "admission evidence"
    );
    requireManifestEqual(fields, "cases_failed", "0", "admission evidence");
    requireManifestEqual(
      fields,
      "promotion_decision",
      registryAdmissionPromotionDecision,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "browser_selector_status",
      registryAdmissionBrowserSelectorStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "public_claim_status",
      registryAdmissionPublicClaimStatus,
      "admission evidence"
    );
    requireManifestEqual(
      fields,
      "required_next_gate",
      registryAdmissionRequiredNextGate,
      "admission evidence"
    );
    admission.fields = fields;
    admission.verified = true;
    return "admission evidence verified";
  }

  function setInteractive(enabled) {
    setControls(enabled, enabled);
  }

  function setControls(canGenerate, canSelectModel) {
    el.generateButton.disabled = !canGenerate;
    el.stepTokenButton.disabled = !canGenerate || !state.hasContext;
    el.resetButton.disabled = !canGenerate;
    el.modelSelect.disabled = !canSelectModel || !state.exports;
    setAdapterControls(canGenerate && state.modelLoaded);
  }

  function freeLoadedModelForSwitch(previousModelKey, selectedModel, wasModelLoaded) {
    if (!state.exports || typeof state.exports.free_model !== "function" || !wasModelLoaded) {
      return true;
    }
    const code = state.exports.free_model();
    const text = readLastResult() || `free_model returned ${code}`;
    appendConsole(`free_model(${previousModelKey || "unknown"} -> ${selectedModel}) -> ${code}\n${text}`);
    renderDiagnostics();
    if (code !== 0) {
      throw new Error(text);
    }
    return true;
  }

  function applyModulePlanRuntimeReset(model, selectedModel) {
    // Applies the module-plan reset boundary after model bytes load and before assembly work begins.
    if (!model.modulePlan) {
      return true;
    }
    if (model.modulePlan.runtimeResetStrategy !== registryModulePlanRuntimeResetStrategy) {
      throw new Error("Module plan runtime reset strategy mismatch");
    }
    if (!state.exports || typeof state.exports.reset_context !== "function") {
      throw new Error("WASM runtime does not expose context reset");
    }
    const code = state.exports.reset_context();
    const text = readLastResult() || `reset_context returned ${code}`;
    appendConsole(`reset_context(${selectedModel}) -> ${code}\n${text}`);
    renderDiagnostics();
    if (code !== 0) {
      throw new Error(text);
    }
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    return true;
  }

  async function loadSelectedModel() {
    const loadId = state.modelLoadSequence + 1;
    state.modelLoadSequence = loadId;
    const selectedValue = el.modelSelect.value;
    const selectedModel = paths.models[selectedValue]
      ? selectedValue
      : paths.models[localModelKey]
        ? localModelKey
        : paths.models.tinylm16q8
          ? "tinylm16q8"
          : Object.keys(paths.models)[0] || "";
    if (!selectedModel) {
      state.activeModelKey = "";
      state.modelLoaded = false;
      state.hasContext = false;
      setInteractive(false);
      renderAdapterOptions(null, "waiting");
      renderProvenance("choose a local .slm file", null, false);
      renderModulePlan("none", null, false);
      resetModulePlanTrace("unavailable", false);
      renderAssembly("none", null, false);
      setText(el.runtimeStatus, state.exports ? "Runtime ready" : "Booting", false);
      setText(el.modelState, "choose a local .slm file", false);
      setText(el.errorState, "none", false);
      renderDiagnostics();
      return false;
    }
    const model = paths.models[selectedModel];
    const previousModelKey = state.activeModelKey;
    const releaseLoadedModel = state.modelLoaded === true;
    el.modelSelect.value = selectedModel;
    const modelPath = model.path;
    if (el.maxTokens && !el.maxTokens.dataset.userEdited && !el.maxTokens.dataset.presetApplied) {
      el.maxTokens.value = el.maxTokens.value || String(model.maxTokens);
    }
    syncRangeControls();
    state.activeModelKey = selectedModel;
    state.modelLoaded = false;
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    if (model.adapterFamily) {
      model.adapterFamilyVerified = false;
      model.adapterFamilyReceipt = null;
      model.adapterFamilyManifests = null;
      model.adapterFamilyPreferredIndex = null;
      model.adapterFamilyAutoApplyIndexes = null;
      model.autoAssemblyApplied = false;
    }
    if (model.assembly) {
      model.assemblyVerified = false;
      model.assemblyReceipt = null;
      model.assemblyEvidence = null;
    }
    if (model.modulePlan) {
      model.modulePlanVerified = false;
      model.modulePlanReceipt = null;
    }
    if (model.sourceManifest) {
      model.sourceManifestVerified = false;
      model.sourceManifestFields = null;
      if (model.sourceManifest.sourceReview) {
        model.sourceManifest.sourceReview.verified = false;
        model.sourceManifest.sourceReview.fields = null;
      }
    }
    if (model.sourceValidation) {
      model.sourceValidation.verified = false;
      model.sourceValidation.fields = null;
    }
    if (model.runtimeSmokeEvidence) {
      model.runtimeSmokeEvidence.verified = false;
      model.runtimeSmokeEvidence.fields = null;
    }
    if (model.evalEvidence) {
      model.evalEvidence.verified = false;
      model.evalEvidence.fields = null;
    }
    if (model.admissionEvidence) {
      model.admissionEvidence.verified = false;
      model.admissionEvidence.fields = null;
    }
    setLocalFileVerificationState(model, false, model.localFile ? "validating local .slm" : "", false);
    resetModulePlanActualFetchCount(model);
    renderAdapterOptions(model, "waiting");
    setInteractive(false);
    el.response.textContent = "";
    el.console.textContent = "";
    if (releaseLoadedModel) {
      freeLoadedModelForSwitch(previousModelKey, selectedModel, releaseLoadedModel);
    }
    state.modelManifest = null;
    state.modulePlanReceipt = null;
    state.assemblyReceipt = null;
    renderProvenance("waiting for accepted model", null, false);
    renderModulePlan("waiting for local plan", null, false);
    resetModulePlanTrace("waiting for local plan", false);
    renderAssembly("waiting for accepted model", null, false);
    setText(el.runtimeStatus, "Loading local model");
    setText(el.modelState, "loading");
    const started = performance.now();
    let modelBytes = null;
    try {
      if (model.localFile) {
        modelBytes = new Uint8Array(model.localFile.bytes);
      } else {
        await loadModulePlanReceipt(model);
        await loadSourceManifest(model);
        await loadSourceReviewEvidence(model);
        await loadSourceValidationEvidence(model);
        await loadRuntimeSmokeEvidence(model);
        await loadEvalEvidence(model);
        await loadAdmissionEvidence(model);
        modelBytes = await fetchModulePlanBytes(model, modelPath, ".slm model", "model");
        if (Number.isSafeInteger(model.modelBytes) && modelBytes.length !== model.modelBytes) {
          throw new Error("Selector model byte count mismatch");
        }
      }
      recordModulePlanActualModuleBytes(model, 0, modelBytes.length);
    } catch (error) {
      if (loadId !== state.modelLoadSequence) {
        return false;
      }
      state.modelLoadMs = Math.round(performance.now() - started);
      state.lastGenerateMs = 0;
      state.modelLoaded = false;
      state.hasContext = false;
      state.lastMeasuredTokens = 0;
      setText(el.modelState, "fetch error", true);
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.errorState, errorMessage(error), true);
      renderProvenance("model not loaded", null, true);
      if (model.modulePlan && !model.modulePlanVerified) {
        renderModulePlan(errorMessage(error), null, true);
        resetModulePlanTrace(errorMessage(error), true);
      } else if (!model.modulePlan) {
        renderModulePlan("none", null, false);
        resetModulePlanTrace("unavailable", false);
      }
      renderAssembly("model not loaded", null, true);
      setText(el.adapterState, "model not loaded", true);
      setLocalFileVerificationState(model, false, "local .slm not verified", true);
      setControls(false, true);
      renderDiagnostics();
      return false;
    }
    if (loadId !== state.modelLoadSequence) {
      return false;
    }
    const ptr = allocCopy(modelBytes);
    const loadCode = state.exports.load_model(ptr, modelBytes.length);
    release(ptr, modelBytes.length);
    if (loadId !== state.modelLoadSequence) {
      return false;
    }
    state.modelLoadMs = Math.round(performance.now() - started);
    state.lastGenerateMs = 0;
    state.modelLoaded = loadCode === 0;
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    setText(el.modelState, loadCode === 0 ? `loaded (${state.modelLoadMs} ms)` : `error ${loadCode}`, loadCode !== 0);
    setText(el.runtimeStatus, loadCode === 0 ? "Ready" : "Model rejected", loadCode !== 0);
    setText(el.errorState, loadCode === 0 ? "none" : readLastResult(), loadCode !== 0);
    if (loadCode === 0) {
      try {
        applyModulePlanRuntimeReset(model, selectedModel);
      } catch (error) {
        const text = errorMessage(error);
        state.modelLoaded = false;
        state.hasContext = false;
        state.lastMeasuredTokens = 0;
        setText(el.modelState, "runtime reset rejected", true);
        setText(el.runtimeStatus, "Model load failed", true);
        setText(el.errorState, text, true);
        renderProvenance("model not loaded", null, true);
        renderModulePlan(text, model.modulePlanReceipt, true);
        resetModulePlanTrace(text, true);
        renderAssembly("model not loaded", null, true);
        setText(el.adapterState, "model not loaded", true);
        setLocalFileVerificationState(model, false, "local .slm not verified", true);
        setControls(false, true);
        renderDiagnostics();
        return false;
      }
      if (model.modulePlan) {
        recordModulePlanTrace("model accepted");
      }
      if (model.localFile) {
        setLocalModelStatus(
          `${model.localFile.name} / ${formatByteCount(model.localFile.byteLength)} / ${model.localFile.sha256} / ${model.localFile.checksum} / loaded`,
          false
        );
      }
      renderProvenance("loading local manifest", null, false);
      await loadModelManifest(model);
      if (loadId !== state.modelLoadSequence) {
        return false;
      }
      if (model.modulePlan && state.modelManifest) {
        recordModulePlanTrace("manifest verified");
      }
      let assemblyStatus = "";
      let assemblyStatusIsError = false;
      try {
        await loadAssemblyReceipt(model);
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        if (model.modulePlan && model.assemblyVerified) {
          recordModulePlanTrace("assembly evidence verified");
        }
      } catch (error) {
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        assemblyStatus = errorMessage(error);
        assemblyStatusIsError = true;
        renderAssembly(assemblyStatus, null, true);
        appendConsole(assemblyStatus);
      }
      if (assemblyStatusIsError) {
        if (typeof state.exports.free_model === "function") {
          state.exports.free_model();
        }
        state.modelLoaded = false;
        state.hasContext = false;
        state.lastMeasuredTokens = 0;
        setText(el.modelState, "assembly evidence rejected", true);
        setText(el.runtimeStatus, "Model load failed", true);
        setText(el.errorState, assemblyStatus, true);
        if (model.modulePlan) {
          recordModulePlanTrace("assembly evidence rejected");
        }
        renderAdapterOptions(model, "assembly evidence rejected", true);
        setLocalFileVerificationState(model, false, "local .slm not verified", true);
        setControls(false, true);
        renderDiagnostics();
        return false;
      }
      let adapterStatus = "";
      let adapterStatusIsError = false;
      try {
        adapterStatus = await loadAdapterFamilyReceipt(model);
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        if (model.modulePlan && model.adapterFamilyVerified) {
          recordModulePlanTrace("adapter family verified");
        }
      } catch (error) {
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        adapterStatus = errorMessage(error);
        adapterStatusIsError = true;
        appendConsole(adapterStatus);
      }
      renderAdapterOptions(model, adapterStatus || undefined, adapterStatusIsError);
      if (
        !adapterStatusIsError &&
        model.autoApplyPreferredAdapter &&
        model.adapterFamilyVerified &&
        loadId === state.modelLoadSequence
      ) {
        model.autoAssemblyApplied = await applyAutoAssemblyStack(model, loadId);
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        if (model.autoAssemblyApplied && model.modulePlan) {
          recordModulePlanTrace("adapter stack applied");
        }
      }
      if (
        model.modulePlan &&
        loadId === state.modelLoadSequence &&
        (!model.assembly || model.assemblyVerified) &&
        (!model.adapterFamily || model.adapterFamilyVerified) &&
        (!model.autoApplyPreferredAdapter || model.autoAssemblyApplied)
      ) {
        try {
          requireModulePlanActualFetchCount(model);
          requireModulePlanActualRouteSet(model);
          requireModulePlanActualModuleBytes(model);
          requireModulePlanActualModuleChecksums(model);
        } catch (error) {
          const text = errorMessage(error);
          state.modelLoaded = false;
          state.hasContext = false;
          state.lastMeasuredTokens = 0;
          setText(el.modelState, "module plan rejected", true);
          setText(el.runtimeStatus, "Model load failed", true);
          setText(el.errorState, text, true);
          renderModulePlan(text, model.modulePlanReceipt, true);
          renderAdapterOptions(model, text, true);
          setLocalFileVerificationState(model, false, "local .slm not verified", true);
          setControls(false, true);
          renderDiagnostics();
          return false;
        }
        recordModulePlanTrace("ready");
      }
    } else {
      renderProvenance("model rejected", null, true);
      renderAssembly("model rejected", null, true);
      if (model.modulePlan) {
        resetModulePlanTrace("model rejected", true);
      }
      renderAdapterOptions(model, "model not loaded");
    }
    setLocalFileVerificationState(
      model,
      loadCode === 0,
      loadCode === 0 ? "local .slm verified; share metadata ready" : "local .slm rejected",
      loadCode !== 0
    );
    setControls(loadCode === 0, true);
    renderDiagnostics();
    return loadCode === 0;
  }

  async function applySelectedAdapter(mode) {
    if (!state.exports || !state.modelLoaded) {
      return false;
    }
    const model = paths.models[state.activeModelKey];
    const adapters = modelAdapters(model);
    const selectedIndex = selectedAdapterIndex(adapters);
    if (selectedIndex === null) {
      return false;
    }
    const result = await applyAdapterByIndex(model, selectedIndex, mode, 0);
    return result.ok;
  }

  async function applyAutoAssemblyStack(model, loadId) {
    const indexes = Array.isArray(model.adapterFamilyAutoApplyIndexes)
      ? model.adapterFamilyAutoApplyIndexes
      : [model.adapterFamilyPreferredIndex];
    if (
      !model.modulePlan ||
      model.modulePlan.adapterValidationStrategy !== registryModulePlanAdapterValidationStrategy
    ) {
      throw new Error("Module plan adapter validation strategy mismatch");
    }
    if (model.modulePlan.adapterApplyCount !== indexes.length) {
      throw new Error("Module plan adapter apply count mismatch");
    }
    if (model.modulePlan.adapterValidationCount !== indexes.length) {
      throw new Error("Module plan adapter validation count mismatch");
    }
    let autoAssemblyBytes = 0;
    const verifiedStack = [];
    const adapters = modelAdapters(model);
    setControls(false, true);
    setText(el.runtimeStatus, "Assembling modules");
    setText(el.adapterState, "loading");
    try {
      for (const index of indexes) {
        if (
          loadId !== state.modelLoadSequence ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= adapters.length
        ) {
          return false;
        }
        const adapterBytes = await fetchVerifiedAdapterBytes(model, index, true, autoAssemblyBytes);
        verifiedStack.push({ index, adapterBytes });
        autoAssemblyBytes += adapterBytes.length;
      }
      let validated = 0;
      for (const verified of verifiedStack) {
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        validateAdapterWithRuntime(adapters[verified.index], verified.adapterBytes);
        validated += 1;
      }
      if (validated !== model.modulePlan.adapterValidationCount) {
        throw new Error("Module plan adapter validation count mismatch");
      }
    } catch (error) {
      const text = errorMessage(error);
      setText(el.runtimeStatus, "Adapter load failed", true);
      setText(el.adapterState, text, true);
      setText(el.errorState, text, true);
      appendConsole(text);
      renderDiagnostics();
      setControls(state.modelLoaded, true);
      return false;
    }
    autoAssemblyBytes = 0;
    let applied = 0;
    for (const verified of verifiedStack) {
      if (loadId !== state.modelLoadSequence) {
        return false;
      }
      const result = await applyAdapterByIndex(
        model,
        verified.index,
        "auto",
        autoAssemblyBytes,
        verified.adapterBytes
      );
      autoAssemblyBytes = result.autoAssemblyBytes;
      if (!result.ok) {
        return false;
      }
      applied += 1;
    }
    const diagnostics = readDiagnosticsJson();
    if (
      applied !== model.modulePlan.adapterApplyCount ||
      !diagnostics ||
      diagnostics.adapter_apply_count !== model.modulePlan.adapterApplyCount
    ) {
      throw new Error("Module plan adapter apply count mismatch");
    }
    if (applied > 1) {
      appendConsole(`adapter_stack_applied(${applied})`);
      setText(el.adapterState, "applied", false);
    }
    return applied > 0;
  }

  async function fetchAdapterBytes(adapter, model) {
    if (model && model.modulePlan) {
      return fetchModulePlanBytes(model, adapter.path, "adapter", "adapter-stack-artifact");
    }
    const response = await fetch(adapter.path, localFetchOptions);
    if (!response.ok) {
      throw new Error(`Unable to fetch local adapter (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  function verifyAdapterBytes(model, selectedIndex, adapter, adapterBytes, isAutoAssembly, autoAssemblyBytes) {
    const manifestFields = Array.isArray(model.adapterFamilyManifests)
      ? model.adapterFamilyManifests[selectedIndex]
      : null;
    if (manifestFields) {
      const expectedBytes = adapterManifestArtifactBytes(manifestFields, "Adapter manifest");
      if (adapterBytes.length !== expectedBytes) {
        throw new Error("Adapter artifact byte count mismatch");
      }
      if (
        isAutoAssembly &&
        model.adapterFamily &&
        autoAssemblyBytes + adapterBytes.length > model.adapterFamily.autoApplyByteBudget
      ) {
        throw new Error("Adapter auto assembly byte budget exceeded");
      }
    }
    if (adapter.artifactChecksum) {
      requireChecksumEqual(
        adapterArtifactChecksumHex(adapterBytes),
        adapter.artifactChecksum,
        "adapter artifact"
      );
    }
  }

  async function fetchVerifiedAdapterBytes(model, selectedIndex, isAutoAssembly, autoAssemblyBytes) {
    const adapter = modelAdapters(model)[selectedIndex];
    const adapterBytes = await fetchAdapterBytes(adapter, model);
    verifyAdapterBytes(model, selectedIndex, adapter, adapterBytes, isAutoAssembly, autoAssemblyBytes);
    if (isAutoAssembly && model.modulePlan) {
      const moduleIndex = modulePlanStackModuleIndexForAdapter(model.modulePlanReceipt, selectedIndex);
      if (moduleIndex === null) {
        throw new Error("Module plan adapter index mismatch");
      }
      recordModulePlanActualModuleBytes(model, moduleIndex, adapterBytes.length);
      recordModulePlanActualModuleChecksum(model, moduleIndex, adapterArtifactChecksumHex(adapterBytes));
    }
    return adapterBytes;
  }

  function validateAdapterWithRuntime(adapter, adapterBytes) {
    if (typeof state.exports.validate_adapter_delta !== "function") {
      throw new Error("WASM runtime does not expose adapter validation");
    }
    const ptr = allocCopy(adapterBytes);
    const code = state.exports.validate_adapter_delta(ptr, adapterBytes.length);
    release(ptr, adapterBytes.length);
    const text = readLastResult() || `adapter validation returned ${code}`;
    appendConsole(`validate_adapter_delta(${adapter.label || adapter.path}) -> ${code}\n${text}`);
    renderDiagnostics();
    if (code !== 0) {
      throw new Error(text);
    }
    return true;
  }

  async function applyAdapterByIndex(model, selectedIndex, mode, autoAssemblyBytes, verifiedAdapterBytes) {
    if (!state.exports || !state.modelLoaded) {
      return { ok: false, autoAssemblyBytes };
    }
    const adapters = modelAdapters(model);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= adapters.length) {
      return { ok: false, autoAssemblyBytes };
    }
    const adapter = adapters[selectedIndex];
    if (typeof state.exports.apply_adapter_delta !== "function") {
      throw new Error("WASM runtime does not expose adapter apply");
    }
    setControls(false, true);
    const isAutoAssembly = mode === "auto";
    setText(el.runtimeStatus, isAutoAssembly ? "Assembling modules" : "Applying adapter");
    setText(el.adapterState, "loading");
    let adapterBytes = null;
    try {
      adapterBytes = verifiedAdapterBytes || await fetchAdapterBytes(adapter, isAutoAssembly ? model : null);
      verifyAdapterBytes(model, selectedIndex, adapter, adapterBytes, isAutoAssembly, autoAssemblyBytes);
    } catch (error) {
      const text = errorMessage(error);
      setText(el.runtimeStatus, "Adapter load failed", true);
      setText(el.adapterState, text, true);
      setText(el.errorState, text, true);
      appendConsole(text);
      renderDiagnostics();
      setControls(state.modelLoaded, true);
      return { ok: false, autoAssemblyBytes };
    }
    const ptr = allocCopy(adapterBytes);
    const code = state.exports.apply_adapter_delta(ptr, adapterBytes.length);
    release(ptr, adapterBytes.length);
    const text = readLastResult() || `adapter apply returned ${code}`;
    state.lastGenerateMs = 0;
    state.lastMeasuredTokens = 0;
    state.hasContext = false;
    if (code === 0) {
      setText(el.runtimeStatus, "Ready", false);
      setText(el.adapterState, "applied", false);
      setText(el.errorState, "none", false);
      setText(el.response, text, false);
    } else {
      setText(el.runtimeStatus, "Adapter rejected", true);
      setText(el.adapterState, text, true);
      setText(el.errorState, text, true);
      setText(el.response, text, true);
    }
    appendConsole(`apply_adapter_delta(${adapter.label || adapter.path}) -> ${code}\n${text}`);
    renderDiagnostics();
    setControls(state.modelLoaded, true);
    if (code === 0 && isAutoAssembly) {
      autoAssemblyBytes += adapterBytes.length;
    }
    return { ok: code === 0, autoAssemblyBytes };
  }

  async function boot() {
    try {
      setText(el.runtimeStatus, "Loading runtime");
      setInteractive(false);
      const wasmBytes = await loadRuntimeWasmBytes();
      state.instance = await WebAssembly.instantiate(wasmBytes, {});
      state.exports = state.instance.instance.exports;
      state.wasmMemoryInitialPages = wasmMemoryInitialPages();
      const initCode = state.exports.init_runtime();
      setText(el.wasmState, initCode === 0 ? "loaded" : `error ${initCode}`, initCode !== 0);
      if (initCode !== 0) {
        setText(el.runtimeStatus, "Runtime rejected", true);
        setText(el.errorState, readLastResult(), true);
        renderDiagnostics();
        return;
      }
      restoreStaticModelOptions();
      await loadSelectorRegistry();
      await loadSelectedModel();
    } catch (error) {
      setText(el.runtimeStatus, "Boot failed", true);
      setText(el.modelState, "boot error", true);
      setText(el.errorState, errorMessage(error), true);
    }
  }

  el.form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!state.exports) {
      return;
    }
    if (el.appShell && el.appShell.dataset.mode === "simple") {
      syncSemanticControls(true);
    }
    const promptText = el.prompt.value;
    const bytes = state.encoder.encode(promptText);
    // Keeps prompt transfer bytes inside the same envelope declared by generated module plans.
    if (bytes.length > registryModulePlanPromptByteLimit) {
      const text = "prompt byte limit exceeded";
      setText(el.response, text, true);
      setText(el.errorState, text, true);
      el.console.textContent = text;
      appendMessage("user", promptText, false);
      appendMessage("assistant", text, true);
      renderDiagnostics();
      captureRun(promptText, text, true);
      setControls(true, true);
      return;
    }
    const ptr = allocCopy(bytes);
    const maxTokens = Math.max(1, Math.min(512, Number.parseInt(el.maxTokens.value, 10) || 1));
    el.maxTokens.value = String(maxTokens);
    syncRangeControls();
    let sampling = null;
    try {
      sampling = applySamplingConfig();
    } catch (error) {
      release(ptr, bytes.length);
      const text = errorMessage(error);
      setText(el.response, text, true);
      setText(el.errorState, text, true);
      el.console.textContent = text;
      appendMessage("user", promptText, false);
      appendMessage("assistant", text, true);
      renderDiagnostics();
      captureRun(promptText, text, true);
      return;
    }
    setControls(false, false);
    setText(el.runtimeStatus, "Generating", false);
    const started = performance.now();
    const code = state.exports.generate(ptr, bytes.length, maxTokens);
    state.lastGenerateMs = Math.round(performance.now() - started);
    state.lastMeasuredTokens = 0;
    state.latestSampling = sampling;
    release(ptr, bytes.length);
    const text = readLastResult();
    state.hasContext = code === 0;
    setText(el.response, text, code !== 0);
    el.console.textContent = `generate(max_new_tokens=${maxTokens}, temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
    setText(el.errorState, code === 0 ? "none" : text, code !== 0);
    setText(el.runtimeStatus, code === 0 ? "Ready" : "Generate failed", code !== 0);
    appendMessage("user", promptText, false);
    appendMessage("assistant", text, code !== 0);
    renderDiagnostics();
    captureRun(promptText, text, code !== 0);
    setControls(true, true);
  });

  el.stepTokenButton.addEventListener("click", function () {
    if (!state.exports || !state.hasContext) {
      return;
    }
    let sampling = null;
    try {
      sampling = applySamplingConfig();
    } catch (error) {
      const text = errorMessage(error);
      setText(el.errorState, text, true);
      appendConsole(text);
      renderDiagnostics();
      setControls(true, true);
      return;
    }
    setControls(false, false);
    setText(el.runtimeStatus, "Generating", false);
    const started = performance.now();
    const code = state.exports.generate_next_token();
    state.lastGenerateMs = Math.round(performance.now() - started);
    const text = readLastResult();
    const resultText = text || `generate_next_token failed (${code})`;
    const consoleText = `generate_next_token(temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}) -> ${code} in ${state.lastGenerateMs} ms\n${resultText}`;
    state.lastMeasuredTokens = code === 0 ? 1 : 0;
    state.hasContext = code === 0;
    appendConsole(consoleText);
    if (code === 0) {
      setText(el.response, `${el.response.textContent}${text}`, false);
      setText(el.errorState, "none", false);
      setText(el.runtimeStatus, "Ready", false);
      extendAssistantMessage(text);
    } else {
      setText(el.errorState, resultText, true);
      setText(el.runtimeStatus, "Step token failed", true);
      if (!el.response.textContent) {
        setText(el.response, resultText, true);
      }
      appendMessage("assistant", resultText, true);
    }
    renderDiagnostics();
    captureRun(el.prompt ? el.prompt.value : "", resultText, code !== 0);
    setControls(true, true);
  });

  el.modelSelect.addEventListener("change", function () {
    if (!state.exports) {
      return;
    }
    loadSelectedModel().catch((error) => {
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.modelState, "unexpected error", true);
      setText(el.errorState, errorMessage(error), true);
      setControls(false, Boolean(state.exports));
    });
  });

  el.importLocalModelButton.addEventListener("click", function () {
    importLocalModelFile().catch((error) => {
      const text = errorMessage(error);
      setLocalModelStatus(text, true);
      setText(el.errorState, text, true);
      if (state.exports) {
        setControls(state.modelLoaded, true);
      }
    });
  });

  el.localModelFile.addEventListener("change", function () {
    const file = el.localModelFile.files && el.localModelFile.files[0];
    if (!file) {
      setLocalModelStatus("waiting", false);
      return;
    }
    const name = safeLocalModelName(file.name);
    const expected = state.selectedCatalogEntry
      ? ` / expecting ${state.selectedCatalogEntry.displayName}`
      : "";
    setLocalModelStatus(`${name} / ${formatByteCount(file.size)} selected${expected}`, false);
  });

  el.importConversionRequestButton.addEventListener("click", function () {
    importConversionRequestFile().catch((error) => {
      setConversionRequestStatus(errorMessage(error), true);
    });
  });

  el.conversionRequestFile.addEventListener("change", function () {
    const file = el.conversionRequestFile.files && el.conversionRequestFile.files[0];
    if (!file) {
      setConversionRequestStatus("optional source handoff", false);
      return;
    }
    setConversionRequestStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} selected`, false);
  });

  el.catalogLoadButton.addEventListener("click", function () {
    loadCatalogFromUrl().catch((error) => {
      if (error && error.name === "AbortError") {
        return;
      }
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.catalogUrlInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    el.catalogLoadButton.click();
  });

  el.importLocalCatalogButton.addEventListener("click", function () {
    importLocalCatalogFile().catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.localCatalogFile.addEventListener("change", function () {
    const file = el.localCatalogFile.files && el.localCatalogFile.files[0];
    if (!file) {
      setCatalogStatus("idle", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} local catalog selected`, false);
  });

  el.applyPeerAnnouncementButton.addEventListener("click", function () {
    applyPeerSourceAnnouncementFile(el.peerAnnouncementFile).catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.peerAnnouncementFile.addEventListener("change", function () {
    const file = el.peerAnnouncementFile.files && el.peerAnnouncementFile.files[0];
    if (!file) {
      setCatalogStatus("choose a peer-source announcement after loading metadata", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer-source announcement selected`, false);
  });

  el.hfSearchButton.addEventListener("click", function () {
    searchHuggingFaceModels().catch((error) => {
      if (error && error.name === "AbortError") {
        return;
      }
      setHfStatus(errorMessage(error), true);
    });
  });

  el.hfSearchInput.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    el.hfSearchButton.click();
  });

  el.saveShareMetadataButton.addEventListener("click", function () {
    saveShareMetadata().catch((error) => {
      setShareMetadataStatus(errorMessage(error), true);
    });
  });

  el.applyAdapterButton.addEventListener("click", function () {
    applySelectedAdapter().catch((error) => {
      const text = errorMessage(error);
      setText(el.runtimeStatus, "Adapter load failed", true);
      setText(el.adapterState, text, true);
      setText(el.errorState, text, true);
      appendConsole(text);
      renderDiagnostics();
      setControls(state.modelLoaded, Boolean(state.exports));
    });
  });

  el.resetButton.addEventListener("click", function () {
    if (state.exports) {
      state.exports.reset_context();
      state.lastGenerateMs = 0;
      state.lastMeasuredTokens = 0;
      state.hasContext = false;
      el.response.textContent = "";
      el.console.textContent = "context reset";
      renderDiagnostics();
      setControls(true, true);
    }
  });

  el.clearChatButton.addEventListener("click", function () {
    state.messages = [];
    renderConversation();
  });

  if (el.catalogUrlInput && !catalogText(el.catalogUrlInput.value)) {
    el.catalogUrlInput.value = defaultCatalogUrl;
  }
  initializeUiShell();
  installUiEventHandlers();
  observeCopyableFields();
  renderConversation();
  updateShareMetadataControls();
  boot();
}());
