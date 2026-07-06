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
  const httpScheme = "http" + "://";
  const httpsScheme = "https" + "://";
  const peerExampleUrl = `${httpScheme}127.0.0.1:8123/`;
  const peerStatusRoute = "minimodel.peer_status.v0.json";
  const peerPieceSetRoute = "minimodel.peer_piece_set.v0";
  const peerCompanionStateRoute = "minimodel.peer_companion_state.v0.json";
  const miniModelImportReceiptNextGate = "user-selected-tinyrustlm-local-file-open";
  const docsTargets = {
    runtime: `${httpsScheme}TinyRustLM.MiRust.com/`,
    minimodel: `${httpsScheme}MiniModel.MiRust.com/`
  };
  const defaultCatalogUrl = `${httpsScheme}MiniModel.org/catalog/models.v0.json`;
  const svgNamespace = "http" + "://www.w3.org/2000/svg";
  const catalogTextByteBudget = 256 * 1024;
  const catalogMaxEntries = 64;
  const catalogMaxAnnouncementRoutes = 8;
  const hfDiscoveryScheme = "https";
  const hfDiscoveryHost = "huggingface.co";
  const hfSearchLimit = 8;
  const hfSearchApiLimit = 24;
  const hfLargeSourceWarningBytes = 2 * 1024 * 1024 * 1024;
  const blockedPeerHosts = new Set([
    "minimodel.org",
    "tinyrustlm.com",
    "slmcomposer.com",
    "lmcomposer.com",
    "mirust.com",
    "huggingface.co"
  ]);
  const blockedPeerHostSuffixes = [
    ".minimodel.org",
    ".tinyrustlm.com",
    ".slmcomposer.com",
    ".lmcomposer.com",
    ".mirust.com",
    ".huggingface.co"
  ];
  const localMemoryUniversalPaths = [
    ".uai/memory-maintenance.uai",
    ".uai/identity.uai",
    ".uai/world-context.uai",
    ".uai/totem.uai",
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/short-term-memory.uai"
  ];
  const localMemoryBaselinePaths = [
    ".uai/manifest.uaix.json",
    ".uai/startup-packet.uai",
    ".uai/system-profile.uai",
    ".uai/receiver-brief.uai",
    ".uai/index.uai",
    ".uai/context.uai",
    ".uai/constraints.uai",
    ".uai/progress.uai",
    ".uai/operations.uai",
    ".uai/test-plan.uai",
    ".uai/decisions.uai",
    ".uai/memory.uai",
    ".uai/agent-pickup.uai",
    ".uai/archives/session-log.uai",
    ".uai/exports/manifest.json",
    ".uai/exports/manifest-overlay.json",
    ".uai/exports/package-model.json",
    ".uai/exports/knowledge-graph.json",
    ".uai/exports/llms.uai",
    ".uai/exports/llms-full.uai"
  ];
  const localMemoryFileHandoffPaths = [
    ".uai/file-handoff.uai",
    ".uai/intake-outcome-ledger.uai"
  ];
  const localMemoryCodeBearingPaths = [
    ".uai/coding-standards.uai",
    ".uai/architecture.uai",
    ".uai/next-recursive-prompt.uai"
  ];
  const localMemoryMultiAgentPaths = [
    ".uai/agent-instructions.uai",
    ".uai/owners.uai",
    ".uai/current-state.uai",
    ".uai/next-actions.uai",
    ".uai/open-questions.uai",
    ".uai/risk-register.uai"
  ];
  const localMemoryTalismanPaths = [
    ".uai/agent-instructions.uai",
    ".uai/owners.uai",
    ".uai/risk-register.uai",
    "reports/deployment-memory-and-test-report.uai"
  ];
  const localMemoryAdvancedPersonaPaths = [
    ".uai/readme.human",
    ".uai/persona.uai",
    ".uai/personality/identity.uai",
    ".uai/personality/religion-worldview.uai",
    ".uai/personality/political-leaning.uai",
    ".uai/personality/sense-of-style.uai",
    ".uai/personality/physical-appearance.uai",
    ".uai/personality/birth-age-generation.uai",
    ".uai/personality/romantic-orientation.uai",
    ".uai/personality/voice.uai",
    ".uai/personality/values.uai",
    ".uai/personality/temperament.uai",
    ".uai/personality/reasoning-style.uai",
    ".uai/personality/emotional-patterns.uai",
    ".uai/personality/relationship-style.uai",
    ".uai/personality/behavioral-patterns.uai",
    ".uai/personality/boundaries.uai",
    ".uai/personality/examples-dialogue.uai",
    ".uai/personality/adaptation-rules.uai",
    ".uai/personality/preservation-rules.uai",
    ".uai/evidence/source-excerpts.uai",
    ".uai/evidence/source-platform-profile.uai",
    ".uai/evidence/persona-fidelity-test-deck.uai",
    ".uai/evidence/variance-report-template.uai",
    ".uai/evidence/provenance.uai",
    ".uai/personality/sense-of-winter.uai",
    ".uai/personality/sense-of-spring-fall.uai",
    ".uai/personality/super-fashion-style.uai",
    ".uai/personality/jewelry-choices.uai"
  ];
  const localMemoryAdvancedPersonaDimensions = [
    ["Religion and worldview", ".uai/personality/religion-worldview.uai"],
    ["Political leaning", ".uai/personality/political-leaning.uai"],
    ["Sense of style", ".uai/personality/sense-of-style.uai"],
    ["Physical appearance", ".uai/personality/physical-appearance.uai"],
    ["Birth, age, and generation", ".uai/personality/birth-age-generation.uai"],
    ["Romantic orientation", ".uai/personality/romantic-orientation.uai"],
    ["Winter style", ".uai/personality/sense-of-winter.uai"],
    ["Spring/fall style", ".uai/personality/sense-of-spring-fall.uai"],
    ["Super fashion/style", ".uai/personality/super-fashion-style.uai"],
    ["Jewelry choices", ".uai/personality/jewelry-choices.uai"]
  ];
  const localMemoryOptionalContentPaths = [
    ["tool_permissions", ".uai/tool-permissions.uai"],
    ["delegated_operations", ".uai/credential-inventory.uai"],
    ["deployment", "reports/deployment-memory-and-test-report.uai"],
    ["contact_memory", ".uai/contact-memory.uai"],
    ["calendar_scheduling", ".uai/calendar-and-scheduling.uai"],
    ["communication_style", ".uai/communication-style.uai"],
    ["tasks_commitments", ".uai/tasks-and-commitments.uai"],
    ["routines_preferences", ".uai/routines-and-preferences.uai"],
    ["safety_support_boundaries", ".uai/safety-and-support-boundary.uai"],
    ["source_notes", ".uai/source-notes.uai"],
    ["public_facing_boundaries", ".uai/public-facing-boundary.uai"]
  ];
  const localMemoryContextPriority = [
    ".uai/persona.uai",
    ".uai/system-profile.uai",
    ".uai/receiver-brief.uai",
    ".uai/context.uai",
    ".uai/constraints.uai",
    ".uai/memory.uai",
    ".uai/short-term-memory.uai",
    ".uai/identity.uai",
    ".uai/world-context.uai",
    ".uai/totem.uai",
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/long-term-memory.uai",
    ".uai/tasks-and-commitments.uai",
    ".uai/communication-style.uai",
    ".uai/agent-instructions.uai",
    ".uai/current-state.uai",
    ".uai/next-actions.uai",
    ".uai/open-questions.uai",
    ".uai/risk-register.uai",
    ".uai/personality/identity.uai",
    ".uai/personality/values.uai",
    ".uai/personality/temperament.uai",
    ".uai/personality/reasoning-style.uai",
    ".uai/personality/relationship-style.uai",
    ".uai/personality/boundaries.uai",
    ".uai/personality/preservation-rules.uai"
  ];

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
  const localMemoryPackageMaxFiles = 512;
  const localMemoryPackageMaxFileBytes = 1024 * 1024;
  const localMemoryPackageMaxBytes = 16 * 1024 * 1024;
  const localMemoryContextByteLimit = 192;
  const uaixMemoryWizardUrl = `${httpsScheme}uaix.org/en-us/tools/ai-memory-package-wizard/`;
  const uaixPersonaPackUrl = `${httpsScheme}uaix.org/en-us/ai-memory/uai-files/persona-uai/personality-packs/`;
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
    importReceiptLedger: null,
    peerStatusCheck: null,
    peerCompanionInventory: null,
    localMemoryPackage: null,
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
    peerContactBookPeers: [],
    peerContactBookSourceName: "",
    localConnectApprovalMode: "ask",
    localConnectFullControlAcknowledged: false,
    localConnectCategoryRules: null,
    localConnectApprovedApps: [],
    localConnectEndpointUrl: `${"http:"}//127.0.0.1:8711`,
    localConnectEndpointApps: null,
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
    simpleHfFlowSummary: document.getElementById("simpleHfFlowSummary"),
    simplePeerBaseUrlInput: document.getElementById("simplePeerBaseUrlInput"),
    simpleSavePeerUrlButton: document.getElementById("simpleSavePeerUrlButton"),
    simplePeerUrlStatus: document.getElementById("simplePeerUrlStatus"),
    simplePeerContactCardFile: document.getElementById("simplePeerContactCardFile"),
    simpleApplyPeerContactCardButton: document.getElementById("simpleApplyPeerContactCardButton"),
    simplePeerContactBookFile: document.getElementById("simplePeerContactBookFile"),
    simpleApplyPeerContactBookButton: document.getElementById("simpleApplyPeerContactBookButton"),
    simplePeerContactBookPeers: document.getElementById("simplePeerContactBookPeers"),
    simpleCatalogResults: document.getElementById("simpleCatalogResults"),
    simpleHfResults: document.getElementById("simpleHfResults"),
    simpleLoadCatalogButton: document.getElementById("simpleLoadCatalogButton"),
    simpleLocalCatalogFile: document.getElementById("simpleLocalCatalogFile"),
    simpleImportLocalCatalogButton: document.getElementById("simpleImportLocalCatalogButton"),
    simpleShareMetadataFile: document.getElementById("simpleShareMetadataFile"),
    simpleImportShareMetadataButton: document.getElementById("simpleImportShareMetadataButton"),
    simplePeerAnnouncementFile: document.getElementById("simplePeerAnnouncementFile"),
    simpleApplyPeerAnnouncementButton: document.getElementById("simpleApplyPeerAnnouncementButton"),
    simpleImportReceiptLedgerFile: document.getElementById("simpleImportReceiptLedgerFile"),
    simpleImportReceiptLedgerButton: document.getElementById("simpleImportReceiptLedgerButton"),
    simpleImportReceiptLedgerStatus: document.getElementById("simpleImportReceiptLedgerStatus"),
    simpleImportReceiptLedgerEntries: document.getElementById("simpleImportReceiptLedgerEntries"),
    simplePeerStatusCheckFile: document.getElementById("simplePeerStatusCheckFile"),
    simplePeerStatusCheckButton: document.getElementById("simplePeerStatusCheckButton"),
    simplePeerStatusCheckStatus: document.getElementById("simplePeerStatusCheckStatus"),
    simplePeerCompanionInventoryFile: document.getElementById("simplePeerCompanionInventoryFile"),
    simplePeerCompanionInventoryButton: document.getElementById("simplePeerCompanionInventoryButton"),
    simplePeerCompanionInventoryStatus: document.getElementById("simplePeerCompanionInventoryStatus"),
    simpleSaveShareMetadataButton: document.getElementById("simpleSaveShareMetadataButton"),
    simpleSaveShareKitButton: document.getElementById("simpleSaveShareKitButton"),
    simpleShareMetadataStatus: document.getElementById("simpleShareMetadataStatus"),
    simpleLocalConnectApprovalsButton: document.getElementById("simpleLocalConnectApprovalsButton"),
    simpleLocalConnectStatus: document.getElementById("simpleLocalConnectStatus"),
    simpleOpenAdvancedDiscoveryButton: document.getElementById("simpleOpenAdvancedDiscoveryButton"),
    simpleDiscoveryStatus: document.getElementById("simpleDiscoveryStatus"),
    simpleLocalMemoryPackageFiles: document.getElementById("simpleLocalMemoryPackageFiles"),
    simpleInspectLocalMemoryPackageButton: document.getElementById("simpleInspectLocalMemoryPackageButton"),
    simpleLocalMemoryPackageStatus: document.getElementById("simpleLocalMemoryPackageStatus"),
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
    localMemoryPackageSetup: document.getElementById("localMemoryPackageSetup"),
    localMemoryPackageFiles: document.getElementById("localMemoryPackageFiles"),
    inspectLocalMemoryPackageButton: document.getElementById("inspectLocalMemoryPackageButton"),
    clearLocalMemoryPackageButton: document.getElementById("clearLocalMemoryPackageButton"),
    localMemoryPackageStatus: document.getElementById("localMemoryPackageStatus"),
    localMemoryPackageSummary: document.getElementById("localMemoryPackageSummary"),
    localMemoryPackageContextPreview: document.getElementById("localMemoryPackageContextPreview"),
    catalogUrlInput: document.getElementById("catalogUrlInput"),
    catalogLoadButton: document.getElementById("catalogLoadButton"),
    localCatalogFile: document.getElementById("localCatalogFile"),
    importLocalCatalogButton: document.getElementById("importLocalCatalogButton"),
    shareMetadataFile: document.getElementById("shareMetadataFile"),
    importShareMetadataButton: document.getElementById("importShareMetadataButton"),
    peerContactCardFile: document.getElementById("peerContactCardFile"),
    applyPeerContactCardButton: document.getElementById("applyPeerContactCardButton"),
    peerContactBookFile: document.getElementById("peerContactBookFile"),
    applyPeerContactBookButton: document.getElementById("applyPeerContactBookButton"),
    peerContactBookPeers: document.getElementById("peerContactBookPeers"),
    peerAnnouncementFile: document.getElementById("peerAnnouncementFile"),
    applyPeerAnnouncementButton: document.getElementById("applyPeerAnnouncementButton"),
    importReceiptLedgerFile: document.getElementById("importReceiptLedgerFile"),
    importReceiptLedgerButton: document.getElementById("importReceiptLedgerButton"),
    receiptLedgerStatus: document.getElementById("receiptLedgerStatus"),
    importReceiptLedgerEntries: document.getElementById("importReceiptLedgerEntries"),
    peerStatusCheckFile: document.getElementById("peerStatusCheckFile"),
    peerStatusCheckButton: document.getElementById("peerStatusCheckButton"),
    peerStatusCheckStatus: document.getElementById("peerStatusCheckStatus"),
    peerCompanionInventoryFile: document.getElementById("peerCompanionInventoryFile"),
    peerCompanionInventoryButton: document.getElementById("peerCompanionInventoryButton"),
    peerCompanionInventoryStatus: document.getElementById("peerCompanionInventoryStatus"),
    catalogStatus: document.getElementById("catalogStatus"),
    catalogResults: document.getElementById("catalogResults"),
    hfSearchInput: document.getElementById("hfSearchInput"),
    hfSearchButton: document.getElementById("hfSearchButton"),
    hfStatus: document.getElementById("hfStatus"),
    hfResults: document.getElementById("hfResults"),
    saveShareMetadataButton: document.getElementById("saveShareMetadataButton"),
    saveShareKitButton: document.getElementById("saveShareKitButton"),
    shareMetadataState: document.getElementById("shareMetadataState"),
    localConnectApprovalMode: document.getElementById("localConnectApprovalMode"),
    localConnectFullControlAck: document.getElementById("localConnectFullControlAck"),
    localConnectModeWarning: document.getElementById("localConnectModeWarning"),
    localConnectCategoryList: document.getElementById("localConnectCategoryList"),
    localConnectApprovedApps: document.getElementById("localConnectApprovedApps"),
    trustBrowserEmailLocalConnectButton: document.getElementById("trustBrowserEmailLocalConnectButton"),
    saveLocalConnectPolicyButton: document.getElementById("saveLocalConnectPolicyButton"),
    saveLocalConnectPolicyFileButton: document.getElementById("saveLocalConnectPolicyFileButton"),
    resetLocalConnectPolicyButton: document.getElementById("resetLocalConnectPolicyButton"),
    localConnectEndpointUrl: document.getElementById("localConnectEndpointUrl"),
    checkLocalConnectEndpointButton: document.getElementById("checkLocalConnectEndpointButton"),
    dryRunLocalConnectDecisionButton: document.getElementById("dryRunLocalConnectDecisionButton"),
    dryRunLocalConnectActionButton: document.getElementById("dryRunLocalConnectActionButton"),
    executeLocalConnectActionButton: document.getElementById("executeLocalConnectActionButton"),
    localConnectEndpointStatus: document.getElementById("localConnectEndpointStatus"),
    localConnectEndpointAppList: document.getElementById("localConnectEndpointAppList"),
    localConnectPolicyStatus: document.getElementById("localConnectPolicyStatus"),
    localConnectPolicyPreview: document.getElementById("localConnectPolicyPreview"),
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
    localConnectApprovalMode: "slmcomposer.ui.localConnectApprovalMode",
    localConnectFullControlAcknowledged: "slmcomposer.ui.localConnectFullControlAcknowledged",
    localConnectCategoryRules: "slmcomposer.ui.localConnectCategoryRules",
    localConnectApprovedApps: "slmcomposer.ui.localConnectApprovedApps",
    localConnectEndpointUrl: "slmcomposer.ui.localConnectEndpointUrl",
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

  const localConnectPolicyKind = "tinyrustlm.local_connect_approval_policy.v0";
  const localConnectPolicyVersion = 2;
  const localConnectAppInventoryPolicy = "bounded-name-discovery-no-paths-v1";
  const localConnectAppInventoryPathExposure = "never";
  const localConnectAppApprovalBindingPolicy = "app-and-category-v1";
  const localConnectActionExecutionPolicy = "typed-action-dry-run-default-execution-consent-v1";
  const localConnectApprovalModes = {
    ask: {
      label: "Ask every time",
      warning: "Local Connect asks before app control."
    },
    selected: {
      label: "Always approve selected",
      warning: "Only categories or apps marked Always approve can run without prompts."
    },
    full: {
      label: "Full local-control lab mode",
      warning: "High risk: requires a non-sensitive local machine acknowledgement before endpoint use."
    }
  };
  const localConnectApprovalLevels = {
    ask: "Ask every time",
    always: "Always approve",
    deny: "Block"
  };
  const localConnectAppCategories = Object.freeze([
    {
      id: "browser",
      label: "Browsers",
      risk: "medium",
      warning: "Can read pages, submit forms, download files, and act inside signed-in browser sessions."
    },
    {
      id: "email",
      label: "Email apps",
      risk: "high",
      warning: "Can read, send, delete, or forward messages and attachments."
    },
    {
      id: "documents",
      label: "Docs and office",
      risk: "medium",
      warning: "Can edit documents, spreadsheets, and local business records."
    },
    {
      id: "files",
      label: "Files and folders",
      risk: "high",
      warning: "Can move, overwrite, upload, or delete local files."
    },
    {
      id: "terminal",
      label: "Terminal and scripts",
      risk: "critical",
      warning: "Can execute commands, install software, and change system state."
    },
    {
      id: "secrets",
      label: "Passwords, payments, settings",
      risk: "critical",
      warning: "Can affect credentials, accounts, money movement, and security settings."
    }
  ]);
  const localConnectKnownAppCategories = Object.freeze(new Map([
    ["chrome.exe", "browser"],
    ["msedge.exe", "browser"],
    ["firefox.exe", "browser"],
    ["outlook.exe", "email"],
    ["thunderbird.exe", "email"],
    ["winword.exe", "documents"],
    ["excel.exe", "documents"],
    ["explorer.exe", "files"],
    ["powershell.exe", "terminal"],
    ["pwsh.exe", "terminal"],
    ["cmd.exe", "terminal"],
    ["bitwarden.exe", "secrets"],
    ["1password.exe", "secrets"]
  ]));

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
    storageRemove(uiStorageKeys.localConnectApprovalMode);
    storageRemove(uiStorageKeys.localConnectFullControlAcknowledged);
    storageRemove(uiStorageKeys.localConnectCategoryRules);
    storageRemove(uiStorageKeys.localConnectApprovedApps);
    storageRemove(uiStorageKeys.localConnectEndpointUrl);
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
      el.modelContextPill.textContent = state.localMemoryPackage && state.localMemoryPackage.valid
        ? "UAIX memory active"
        : hasLoadedModel && model && Number.isFinite(model.maxTokens)
        ? `${model.maxTokens} max tokens`
        : "Browser local";
      el.modelContextPill.className = state.localMemoryPackage && state.localMemoryPackage.valid
        ? "status-pill info"
        : "status-pill neutral";
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
    document.querySelectorAll("[data-sidebar-source]").forEach((button) => {
      const selected = button.dataset.sidebarSource === nextOption;
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

  function defaultLocalConnectCategoryRules() {
    const rules = Object.create(null);
    for (const category of localConnectAppCategories) {
      rules[category.id] = "ask";
    }
    return rules;
  }

  function sanitizeLocalConnectApprovalMode(value) {
    return Object.prototype.hasOwnProperty.call(localConnectApprovalModes, value) ? value : "ask";
  }

  function sanitizeLocalConnectApprovalLevel(value) {
    return Object.prototype.hasOwnProperty.call(localConnectApprovalLevels, value) ? value : "ask";
  }

  function safeLocalConnectCssToken(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 32) || "unknown";
  }

  function findLocalConnectCategory(categoryId) {
    return localConnectAppCategories.find((category) => category.id === categoryId) || null;
  }

  function localConnectKnownCategoryForApp(appName) {
    return localConnectKnownAppCategories.get(String(appName || "").trim().toLowerCase()) || "";
  }

  function localConnectAppLevelApprovalAllowed(category) {
    return Boolean(category && category.id !== "terminal" && category.id !== "secrets");
  }

  function localConnectApprovedAppBindings(approvedApps) {
    return approvedApps
      .map((app) => {
        const categoryId = localConnectKnownCategoryForApp(app) || "files";
        const category = findLocalConnectCategory(categoryId);
        if (!localConnectAppLevelApprovalAllowed(category)) {
          return null;
        }
        return {
          app,
          category: category.id,
          category_label: category.label,
          risk: category.risk,
          warning: category.warning,
          approval: "always"
        };
      })
      .filter(Boolean);
  }

  function localConnectApprovedAppBindingFor(snapshot, appName) {
    const normalizedName = String(appName || "").trim().toLowerCase();
    if (!normalizedName || !snapshot || !Array.isArray(snapshot.approved_app_bindings)) {
      return null;
    }
    return snapshot.approved_app_bindings.find(
      (binding) => String(binding.app || "").trim().toLowerCase() === normalizedName
    ) || null;
  }

  function localConnectAppApprovedForCategory(snapshot, appName, category) {
    if (!category) {
      return false;
    }
    const binding = localConnectApprovedAppBindingFor(snapshot, appName);
    return Boolean(binding && binding.category === category.id);
  }

  function parseLocalConnectCategoryRules(raw) {
    const rules = defaultLocalConnectCategoryRules();
    if (!raw) {
      return rules;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return rules;
      }
      for (const category of localConnectAppCategories) {
        rules[category.id] = sanitizeLocalConnectApprovalLevel(parsed[category.id]);
      }
    } catch (_error) {
      return rules;
    }
    return rules;
  }

  function normalizeLocalConnectApprovedApps(value) {
    const seen = new Set();
    const apps = [];
    const raw = Array.isArray(value) ? value.join("\n") : String(value || "");
    for (const part of raw.split(/[\n,;]+/)) {
      const app = part
        .replace(/[\u0000-\u001f\u007f]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 96);
      if (!app || seen.has(app.toLowerCase())) {
        continue;
      }
      const knownCategory = localConnectKnownCategoryForApp(app);
      if (knownCategory === "terminal" || knownCategory === "secrets") {
        continue;
      }
      seen.add(app.toLowerCase());
      apps.push(app);
      if (apps.length >= 40) {
        break;
      }
    }
    return apps;
  }

  function sanitizeLocalConnectEndpointUrl(value) {
    const raw = String(value || "").trim() || `${"http:"}//127.0.0.1:8711`;
    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_error) {
      throw new Error("Local Connect endpoint must be a loopback HTTP URL.");
    }
    const hostname = parsed.hostname.toLowerCase();
    const safeHost = hostname === "127.0.0.1" || hostname === "localhost";
    if (parsed.protocol !== "http:" || !safeHost) {
      throw new Error("Local Connect endpoint must use loopback HTTP at 127.0.0.1 or localhost.");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("Local Connect endpoint must not include credentials, query, or fragment.");
    }
    if (parsed.pathname && parsed.pathname !== "/") {
      throw new Error("Local Connect endpoint URL must be the loopback origin only.");
    }
    if (!parsed.port) {
      parsed.port = "8711";
    }
    return parsed.origin;
  }

  function setLocalConnectEndpointStatus(message, isError) {
    if (el.localConnectEndpointStatus) {
      el.localConnectEndpointStatus.textContent = message;
      el.localConnectEndpointStatus.classList.toggle("error", Boolean(isError));
    }
  }

  async function localConnectPolicySha256(snapshot) {
    return sha256Text(`${JSON.stringify(snapshot, null, 2)}\n`);
  }

  function validateLocalConnectPolicySha256(value, expectedPolicySha256, label) {
    if (value !== expectedPolicySha256) {
      throw new Error(`Local Connect endpoint ${label} policy digest does not match the browser preview.`);
    }
  }

  function localConnectFullControlReady(snapshot) {
    return Boolean(snapshot && snapshot.full_local_control && snapshot.full_control_non_sensitive_machine_acknowledged);
  }

  function assertLocalConnectPolicyReadyForEndpoint(snapshot) {
    if (snapshot && snapshot.full_local_control && !snapshot.full_control_non_sensitive_machine_acknowledged) {
      throw new Error("Full local-control lab mode requires non-sensitive machine acknowledgement.");
    }
  }

  function validateLocalConnectHealth(health, snapshot, expectedPolicySha256) {
    if (!health || health.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0") {
      throw new Error("Local Connect endpoint health response was not recognized.");
    }
    if (health.status !== "ready" || health.bind_host !== "127.0.0.1") {
      throw new Error("Local Connect endpoint is not ready on loopback.");
    }
    if (health.policy_kind !== localConnectPolicyKind || health.policy_version !== localConnectPolicyVersion) {
      throw new Error("Local Connect endpoint policy kind/version does not match this UI.");
    }
    if (health.approval_mode !== snapshot.approval_mode) {
      throw new Error("Local Connect endpoint policy mode differs from the browser preview.");
    }
    if (health.full_local_control !== snapshot.full_local_control) {
      throw new Error("Local Connect endpoint full-control flag differs from the browser preview.");
    }
    if (health.full_control_non_sensitive_machine_acknowledged !== snapshot.full_control_non_sensitive_machine_acknowledged) {
      throw new Error("Local Connect endpoint full-control acknowledgement differs from the browser preview.");
    }
    validateLocalConnectPolicySha256(health.policy_sha256, expectedPolicySha256, "health");
    if (health.app_execution_endpoints !== true || health.action_endpoint_path !== "/v0/action") {
      throw new Error("Local Connect endpoint did not expose the gated action endpoint.");
    }
    if (
      health.app_inventory_policy !== localConnectAppInventoryPolicy ||
      health.app_inventory_path_exposure !== localConnectAppInventoryPathExposure
    ) {
      throw new Error("Local Connect endpoint did not advertise the path-free app inventory contract.");
    }
    if (health.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint did not advertise category-bound app approval.");
    }
    if (health.action_execution_policy !== localConnectActionExecutionPolicy) {
      throw new Error("Local Connect endpoint did not advertise the dry-run-first execution-consent action contract.");
    }
    if (!Array.isArray(health.supported_actions) || !health.supported_actions.includes("open-url")) {
      throw new Error("Local Connect endpoint did not advertise browser open-url action support.");
    }
  }

  function validateLocalConnectCategories(categories, snapshot, expectedPolicySha256) {
    if (!categories || categories.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0" || !Array.isArray(categories.categories)) {
      throw new Error("Local Connect endpoint category response was not recognized.");
    }
    validateLocalConnectPolicySha256(categories.policy_sha256, expectedPolicySha256, "category");
    if (categories.categories.length !== localConnectAppCategories.length) {
      throw new Error("Local Connect endpoint category count does not match this UI.");
    }
    for (const category of localConnectAppCategories) {
      const remote = categories.categories.find((entry) => entry.category === category.id);
      if (!remote || remote.risk !== category.risk || remote.approval !== snapshot.category_approval[category.id]) {
        throw new Error(`Local Connect endpoint category drift for ${category.label}.`);
      }
    }
  }

  function validateLocalConnectApps(apps, snapshot, expectedPolicySha256) {
    if (!apps || apps.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0" || !Array.isArray(apps.apps)) {
      throw new Error("Local Connect endpoint app response was not recognized.");
    }
    validateLocalConnectPolicySha256(apps.policy_sha256, expectedPolicySha256, "app-list");
    if (apps.inventory_paths_exposed !== false) {
      throw new Error("Local Connect endpoint app inventory must not expose local paths.");
    }
    if (
      apps.app_inventory_policy !== localConnectAppInventoryPolicy ||
      apps.app_inventory_path_exposure !== localConnectAppInventoryPathExposure
    ) {
      throw new Error("Local Connect endpoint app inventory contract was not recognized.");
    }
    if (apps.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint app approval binding contract was not recognized.");
    }
    if (apps.action_execution_policy !== localConnectActionExecutionPolicy) {
      throw new Error("Local Connect endpoint action execution contract was not recognized.");
    }
    if (typeof apps.inventory_source !== "string" || !apps.inventory_source.trim()) {
      throw new Error("Local Connect endpoint app inventory source was missing.");
    }
    if (apps.app_execution_endpoints !== true || apps.action_endpoint_path !== "/v0/action") {
      throw new Error("Local Connect endpoint app list did not advertise the gated action endpoint.");
    }
    const approvedAppNames = new Set(snapshot.approved_apps.map((app) => app.toLowerCase()));
    const approvedBindings = new Map(
      snapshot.approved_app_bindings.map((binding) => [
        String(binding.app || "").trim().toLowerCase(),
        binding
      ])
    );
    const listedApprovedApps = new Set();
    for (const app of apps.apps) {
      if (!app || typeof app !== "object") {
        throw new Error("Local Connect endpoint app row was not recognized.");
      }
      const category = findLocalConnectCategory(app.category);
      if (!category || app.risk !== category.risk || app.warning !== category.warning) {
        throw new Error("Local Connect endpoint app category drift.");
      }
      if (app.approval !== snapshot.category_approval[category.id]) {
        throw new Error(`Local Connect endpoint app approval drift for ${category.label}.`);
      }
      if (!["allow", "ask", "deny"].includes(app.decision) || !String(app.reason || "").trim()) {
        throw new Error("Local Connect endpoint app decision was not recognized.");
      }
      if (app.app_execution_performed !== false) {
        throw new Error("Local Connect endpoint app list executed an app.");
      }
      if (app.inventory_paths_exposed !== false) {
        throw new Error("Local Connect endpoint app row exposed a local path.");
      }
      if (app.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
        throw new Error("Local Connect endpoint app row approval binding contract was not recognized.");
      }
      if (app.action_execution_policy !== localConnectActionExecutionPolicy) {
        throw new Error("Local Connect endpoint app row action execution contract was not recognized.");
      }
      if (typeof app.source_label !== "string" || !app.source_label.trim()) {
        throw new Error("Local Connect endpoint app row was missing a source label.");
      }
      if (!Array.isArray(app.supported_actions)) {
        throw new Error("Local Connect endpoint app row did not include supported actions.");
      }
      const appName = String(app.app || "").trim();
      if (!appName) {
        throw new Error("Local Connect endpoint app row was missing a name.");
      }
      if (approvedAppNames.has(appName.toLowerCase())) {
        listedApprovedApps.add(appName.toLowerCase());
      }
      const approvedBinding = approvedBindings.get(appName.toLowerCase());
      if (approvedBinding && approvedBinding.category !== app.category) {
        throw new Error("Local Connect endpoint approved app category drift.");
      }
    }
    for (const approvedApp of approvedAppNames) {
      if (!listedApprovedApps.has(approvedApp)) {
        throw new Error("Local Connect endpoint app list omitted an approved app.");
      }
    }
  }

  function validateLocalConnectDecision(decision, expectedPolicySha256) {
    if (!decision || decision.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0") {
      throw new Error("Local Connect endpoint decision response was not recognized.");
    }
    validateLocalConnectPolicySha256(decision.policy_sha256, expectedPolicySha256, "decision");
    if (decision.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint decision did not bind approved apps to categories.");
    }
    if (!["allow", "ask", "deny"].includes(decision.decision)) {
      throw new Error("Local Connect endpoint returned an unknown decision.");
    }
    if (decision.app_execution_performed !== false) {
      throw new Error("Local Connect endpoint executed an app during a dry run.");
    }
  }

  function validateLocalConnectAction(action, expectedPolicySha256, snapshot, expectedDryRun = true) {
    if (!action || action.endpoint_kind !== "tinyrustlm.local_connect_endpoint.v0") {
      throw new Error("Local Connect endpoint action response was not recognized.");
    }
    validateLocalConnectPolicySha256(action.policy_sha256, expectedPolicySha256, "action");
    if (action.app_approval_binding_policy !== localConnectAppApprovalBindingPolicy) {
      throw new Error("Local Connect endpoint action did not bind approved apps to categories.");
    }
    if (action.action_execution_policy !== localConnectActionExecutionPolicy) {
      throw new Error("Local Connect endpoint action did not use the dry-run-first execution-consent contract.");
    }
    const allowedReasons = new Set(["category-always-approved", "app-approved"]);
    if (localConnectFullControlReady(snapshot)) {
      allowedReasons.add("full-local-control");
    }
    if (action.decision !== "allow" || !allowedReasons.has(action.reason)) {
      throw new Error("Local Connect endpoint action was not allowed by the browser approval policy.");
    }
    if (localConnectFullControlReady(snapshot) && action.full_control_warning !== true) {
      throw new Error("Local Connect endpoint did not echo the full-control warning.");
    }
    if (action.action !== "open-url" || action.target_kind !== "https-url") {
      throw new Error("Local Connect endpoint action response did not bind the requested open-url action.");
    }
    if (!isCatalogSha256(action.action_request_sha256)) {
      throw new Error("Local Connect endpoint action response did not include a valid request fingerprint.");
    }
    if (expectedDryRun && (action.dry_run !== true || action.app_execution_performed !== false || action.execution_status !== "dry-run")) {
      throw new Error("Local Connect endpoint action dry run performed app execution.");
    }
    if (!expectedDryRun && (action.dry_run !== false || action.app_execution_performed !== true || action.execution_status !== "started")) {
      throw new Error("Local Connect endpoint action did not report explicit execution.");
    }
  }

  function localConnectEndpointDisplayDecision(app, snapshot, category) {
    const appName = String(app && app.app || "").trim();
    const appApproved = localConnectAppApprovedForCategory(snapshot, appName, category);
    const categoryApproval = category ? snapshot.category_approval[category.id] : "ask";
    if (categoryApproval === "deny") {
      return { decision: "deny", reason: "category-denied" };
    }
    if (localConnectFullControlReady(snapshot)) {
      return { decision: "allow", reason: "full-local-control" };
    }
    if (categoryApproval === "always") {
      return { decision: "allow", reason: "category-always-approved" };
    }
    if (appApproved) {
      return { decision: "allow", reason: "app-approved" };
    }
    if (app && ["allow", "ask", "deny"].includes(app.decision)) {
      return { decision: app.decision, reason: String(app.reason || "endpoint") };
    }
    return { decision: "ask", reason: "not-selected" };
  }

  function approveLocalConnectEndpointApp(appName, categoryId) {
    const category = findLocalConnectCategory(categoryId);
    if (!localConnectAppLevelApprovalAllowed(category)) {
      setLocalConnectEndpointStatus("Critical categories cannot be app-level always approved. Use ask/block or full local-control lab mode on a non-sensitive machine.", true);
      return;
    }
    const normalized = normalizeLocalConnectApprovedApps([
      ...(state.localConnectApprovedApps || []),
      String(appName || "").trim()
    ]);
    state.localConnectApprovedApps = normalized;
    if (el.localConnectApprovedApps) {
      el.localConnectApprovedApps.value = normalized.join("\n");
    }
    if (state.localConnectApprovalMode === "ask") {
      state.localConnectApprovalMode = "selected";
    }
    persistLocalConnectPolicy("Approved app saved. Re-check endpoint before relying on the updated policy.", {
      preserveEndpointApps: true
    });
    setLocalConnectEndpointStatus("Approved app saved locally. Save the endpoint policy JSON over the watched policy file to enforce it.", false);
  }

  function setLocalConnectEndpointCategoryApproval(categoryId, approvalLevel) {
    const category = findLocalConnectCategory(categoryId);
    if (!category) {
      return;
    }
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    state.localConnectCategoryRules[category.id] = sanitizeLocalConnectApprovalLevel(approvalLevel);
    if (state.localConnectApprovalMode === "ask" && state.localConnectCategoryRules[category.id] === "always") {
      state.localConnectApprovalMode = "selected";
    }
    const label = state.localConnectCategoryRules[category.id] === "deny" ? "blocked" : "always approved";
    persistLocalConnectPolicy(`${category.label} ${label}. Re-check endpoint before relying on the updated policy.`, {
      preserveEndpointApps: true
    });
    setLocalConnectEndpointStatus(`${category.label} ${label} locally. Save the endpoint policy JSON over the watched policy file to enforce it.`, false);
  }

  function renderLocalConnectEndpointApps(apps) {
    if (!el.localConnectEndpointAppList) {
      return;
    }
    state.localConnectEndpointApps = apps || null;
    el.localConnectEndpointAppList.replaceChildren();
    const rows = apps && Array.isArray(apps.apps) ? apps.apps.slice(0, 12) : [];
    const snapshot = localConnectPolicySnapshot();
    for (const app of rows) {
      const appName = String(app.app || "").trim();
      const categorySpec = findLocalConnectCategory(app.category);
      const displayDecision = localConnectEndpointDisplayDecision(app, snapshot, categorySpec);
      const categoryApproval = categorySpec ? snapshot.category_approval[categorySpec.id] : app.approval;
      const appApproved = localConnectAppApprovedForCategory(snapshot, appName, categorySpec);
      const appApprovalAllowed = localConnectAppLevelApprovalAllowed(categorySpec);
      const row = document.createElement("div");
      row.className = `local-connect-endpoint-app risk-${safeLocalConnectCssToken(app.risk)}`;
      row.setAttribute("role", "listitem");
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = app.app;
      const meta = document.createElement("div");
      meta.className = "local-connect-app-meta";
      const category = document.createElement("span");
      category.textContent = app.category_label || app.category;
      const risk = document.createElement("span");
      risk.textContent = `${app.risk} risk`;
      const approval = document.createElement("span");
      approval.textContent = `${categoryApproval} category`;
      const source = document.createElement("span");
      source.textContent = app.inventory_observed ? "found locally" : (app.source_label || app.source || "candidate");
      meta.append(category, risk, approval, source);
      const warning = document.createElement("small");
      warning.className = "local-connect-app-warning";
      warning.textContent = app.warning || "";
      copy.append(name, meta, warning);
      const controls = document.createElement("div");
      controls.className = "local-connect-app-controls";
      const approveAppButton = document.createElement("button");
      approveAppButton.className = "secondary-action local-connect-app-action";
      approveAppButton.type = "button";
      approveAppButton.dataset.localConnectAppAction = "approve-app";
      approveAppButton.dataset.localConnectAppName = appName;
      approveAppButton.textContent = snapshot.full_local_control
        ? localConnectFullControlReady(snapshot) ? "Full mode active" : "Needs acknowledgement"
        : !appApprovalAllowed ? "Category risk only" : appApproved ? "App approved" : "Always approve app";
      approveAppButton.disabled = snapshot.full_local_control || appApproved || !appName || !appApprovalAllowed;
      approveAppButton.addEventListener("click", () => {
        approveLocalConnectEndpointApp(appName, app.category);
      });
      const approveCategoryButton = document.createElement("button");
      approveCategoryButton.className = "secondary-action local-connect-app-action";
      approveCategoryButton.type = "button";
      approveCategoryButton.dataset.localConnectAppAction = "approve-category";
      approveCategoryButton.dataset.localConnectCategory = app.category;
      approveCategoryButton.textContent = categoryApproval === "always" ? "Category approved" : "Always approve category";
      approveCategoryButton.disabled = snapshot.full_local_control || categoryApproval === "always" || !categorySpec;
      approveCategoryButton.addEventListener("click", () => {
        setLocalConnectEndpointCategoryApproval(app.category, "always");
      });
      const blockCategoryButton = document.createElement("button");
      blockCategoryButton.className = "secondary-action local-connect-app-action";
      blockCategoryButton.type = "button";
      blockCategoryButton.dataset.localConnectAppAction = "block-category";
      blockCategoryButton.dataset.localConnectCategory = app.category;
      blockCategoryButton.textContent = categoryApproval === "deny" ? "Category blocked" : "Block category";
      blockCategoryButton.disabled = categoryApproval === "deny" || !categorySpec;
      blockCategoryButton.addEventListener("click", () => {
        setLocalConnectEndpointCategoryApproval(app.category, "deny");
      });
      controls.append(approveAppButton, approveCategoryButton, blockCategoryButton);
      const decision = document.createElement("span");
      decision.className = `local-connect-app-decision ${safeLocalConnectCssToken(displayDecision.decision)}`;
      decision.textContent = displayDecision.decision;
      decision.title = displayDecision.reason;
      row.title = app.warning || "";
      row.append(copy, controls, decision);
      el.localConnectEndpointAppList.append(row);
    }
  }

  function clearLocalConnectEndpointApps() {
    state.localConnectEndpointApps = null;
    if (el.localConnectEndpointAppList) {
      el.localConnectEndpointAppList.replaceChildren();
    }
  }

  async function fetchLocalConnectJson(url, options) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      ...options
    });
    let body = null;
    try {
      body = await response.json();
    } catch (_error) {
      // Response shape is validated by the caller.
    }
    if (!response.ok) {
      const detail = body && body.message ? ` ${body.message}` : "";
      throw new Error(`Local Connect endpoint returned ${response.status}.${detail}`);
    }
    return body;
  }

  async function checkLocalConnectEndpoint(dryRunDecision) {
    persistLocalConnectPolicy();
    const endpoint = sanitizeLocalConnectEndpointUrl(
      el.localConnectEndpointUrl ? el.localConnectEndpointUrl.value : state.localConnectEndpointUrl
    );
    state.localConnectEndpointUrl = endpoint;
    storageSet(uiStorageKeys.localConnectEndpointUrl, endpoint);
    if (el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.value = endpoint;
    }
    setLocalConnectEndpointStatus("Checking Local Connect endpoint...", false);
    const snapshot = localConnectPolicySnapshot();
    assertLocalConnectPolicyReadyForEndpoint(snapshot);
    const expectedPolicySha256 = await localConnectPolicySha256(snapshot);
    const health = await fetchLocalConnectJson(`${endpoint}/v0/health`);
    validateLocalConnectHealth(health, snapshot, expectedPolicySha256);
    const categories = await fetchLocalConnectJson(`${endpoint}/v0/categories`);
    validateLocalConnectCategories(categories, snapshot, expectedPolicySha256);
    const apps = await fetchLocalConnectJson(`${endpoint}/v0/apps`);
    validateLocalConnectApps(apps, snapshot, expectedPolicySha256);
    renderLocalConnectEndpointApps(apps);
    if (!dryRunDecision) {
      setLocalConnectEndpointStatus(
        `Endpoint ready at ${endpoint}. Policy digest matched. Gated action endpoint available.`,
        false
      );
      return;
    }
    const decision = await fetchLocalConnectJson(`${endpoint}/v0/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "browser", app: "chrome.exe" })
    });
    validateLocalConnectDecision(decision, expectedPolicySha256);
    setLocalConnectEndpointStatus(
      `Endpoint decision: ${decision.decision} for browser/chrome.exe; policy digest matched and no app execution performed.`,
      decision.decision === "deny"
    );
  }

  async function requestLocalConnectOpenUrlAction(dryRun) {
    persistLocalConnectPolicy(undefined, { preserveEndpointApps: true });
    const endpoint = sanitizeLocalConnectEndpointUrl(
      el.localConnectEndpointUrl ? el.localConnectEndpointUrl.value : state.localConnectEndpointUrl
    );
    state.localConnectEndpointUrl = endpoint;
    storageSet(uiStorageKeys.localConnectEndpointUrl, endpoint);
    if (el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.value = endpoint;
    }
    setLocalConnectEndpointStatus(
      dryRun ? "Dry-running Local Connect open-url action..." : "Executing Local Connect open-url action...",
      false
    );
    const snapshot = localConnectPolicySnapshot();
    assertLocalConnectPolicyReadyForEndpoint(snapshot);
    const expectedPolicySha256 = await localConnectPolicySha256(snapshot);
    const headers = {
      "content-type": "application/json",
      "x-tinyrustlm-policy-sha256": expectedPolicySha256
    };
    if (!dryRun) {
      headers["x-tinyrustlm-execution-consent"] = "native-opener-v1";
    }
    const action = await fetchLocalConnectJson(`${endpoint}/v0/action`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        policy_sha256: expectedPolicySha256,
        category: "browser",
        app: "chrome.exe",
        action: "open-url",
        target: dryRun
          ? `${"https:"}//tinyrustlm.com/local-connect-dry-run`
          : `${"https:"}//tinyrustlm.com/local-connect-executed`,
        dry_run: dryRun
      })
    });
    validateLocalConnectAction(action, expectedPolicySha256, snapshot, dryRun);
    setLocalConnectEndpointStatus(
      dryRun
        ? `Endpoint action dry run: ${action.decision} ${action.action} for browser/chrome.exe; request fingerprint ${action.action_request_sha256}; no app execution performed.`
        : `Endpoint action executed: ${action.decision} ${action.action} for browser/chrome.exe; request fingerprint ${action.action_request_sha256}; endpoint reported native opener start.`,
      false
    );
  }

  async function dryRunLocalConnectAction() {
    await requestLocalConnectOpenUrlAction(true);
  }

  async function executeLocalConnectAction() {
    await requestLocalConnectOpenUrlAction(false);
  }

  function saveLocalConnectEndpointPolicyJson() {
    persistLocalConnectPolicy();
    const snapshot = localConnectPolicySnapshot();
    assertLocalConnectPolicyReadyForEndpoint(snapshot);
    downloadTextFile("tinyrustlm-local-connect-policy.v0.json", `${JSON.stringify(snapshot, null, 2)}\n`);
    updateLocalConnectPolicyUi("Endpoint policy JSON saved.");
    setLocalConnectEndpointStatus("Endpoint policy JSON saved. Replace the endpoint's watched policy file to apply it live.", false);
  }

  function localConnectPolicySnapshot() {
    const categoryRules = defaultLocalConnectCategoryRules();
    for (const category of localConnectAppCategories) {
      categoryRules[category.id] = sanitizeLocalConnectApprovalLevel(
        state.localConnectCategoryRules && state.localConnectCategoryRules[category.id]
      );
    }
    const approvedApps = normalizeLocalConnectApprovedApps(state.localConnectApprovedApps || []);
    const approvedAppBindings = localConnectApprovedAppBindings(approvedApps);
    const mode = sanitizeLocalConnectApprovalMode(state.localConnectApprovalMode);
    const fullControlAcknowledged = mode === "full" && Boolean(state.localConnectFullControlAcknowledged);
    return {
      policy_kind: localConnectPolicyKind,
      policy_version: localConnectPolicyVersion,
      approval_mode: mode,
      approval_mode_label: localConnectApprovalModes[mode].label,
      full_local_control: mode === "full",
      full_control_non_sensitive_machine_acknowledged: fullControlAcknowledged,
      browser_local_storage_only: true,
      project_server_receives_policy: false,
      local_endpoint_must_enforce_policy: true,
      category_approval: categoryRules,
      approved_apps: approvedApps,
      approved_app_bindings: approvedAppBindings,
      risk_warnings: localConnectAppCategories.map((category) => ({
        category: category.id,
        label: category.label,
        risk: category.risk,
        warning: category.warning,
        approval: categoryRules[category.id]
      }))
    };
  }

  function localConnectPolicyStatusText(snapshot) {
    if (snapshot.full_local_control) {
      return snapshot.full_control_non_sensitive_machine_acknowledged
        ? "Full local-control lab mode active for this non-sensitive computer."
        : "Full local-control lab mode needs non-sensitive machine acknowledgement.";
    }
    const alwaysCategories = localConnectAppCategories
      .filter((category) => snapshot.category_approval[category.id] === "always")
      .map((category) => category.label);
    const approvedAppCount = snapshot.approved_apps.length;
    if (alwaysCategories.length || approvedAppCount) {
      const parts = [];
      if (alwaysCategories.length) {
        parts.push(alwaysCategories.length === 1 ? "1 category" : `${alwaysCategories.length} categories`);
      }
      if (approvedAppCount) {
        parts.push(`${approvedAppCount} app${approvedAppCount === 1 ? "" : "s"}`);
      }
      return `Always approve selected: ${parts.join(" and ")}.`;
    }
    return "Ask every time for all app categories.";
  }

  function renderLocalConnectCategoryRows() {
    if (!el.localConnectCategoryList) {
      return;
    }
    el.localConnectCategoryList.replaceChildren();
    for (const category of localConnectAppCategories) {
      const row = document.createElement("div");
      row.className = `local-connect-category risk-${category.risk}`;
      row.setAttribute("role", "listitem");
      const text = document.createElement("div");
      text.className = "local-connect-category-copy";
      const title = document.createElement("strong");
      title.textContent = category.label;
      const risk = document.createElement("span");
      risk.className = "local-connect-risk";
      risk.textContent = `${category.risk} risk`;
      const warning = document.createElement("small");
      warning.textContent = category.warning;
      text.append(title, risk, warning);
      const select = document.createElement("select");
      select.dataset.localConnectCategory = category.id;
      select.setAttribute("aria-label", `${category.label} approval`);
      for (const [value, label] of Object.entries(localConnectApprovalLevels)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = sanitizeLocalConnectApprovalLevel(
        state.localConnectCategoryRules && state.localConnectCategoryRules[category.id]
      );
      select.addEventListener("change", () => {
        if (!state.localConnectCategoryRules) {
          state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
        }
        state.localConnectCategoryRules[category.id] = sanitizeLocalConnectApprovalLevel(select.value);
        if (state.localConnectApprovalMode === "ask" && select.value === "always") {
          state.localConnectApprovalMode = "selected";
        }
        persistLocalConnectPolicy("Approval policy saved.");
      });
      row.append(text, select);
      el.localConnectCategoryList.append(row);
    }
  }

  function updateLocalConnectPolicyUi(statusOverride) {
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    const snapshot = localConnectPolicySnapshot();
    const modeWarning = localConnectApprovalModes[snapshot.approval_mode].warning;
    const policyStatus = localConnectPolicyStatusText(snapshot);
    const statusText = statusOverride ? `${statusOverride} ${policyStatus}` : policyStatus;
    const isFullControl = snapshot.full_local_control;
    const fullControlNeedsAck = isFullControl && !snapshot.full_control_non_sensitive_machine_acknowledged;
    if (el.localConnectApprovalMode) {
      el.localConnectApprovalMode.value = snapshot.approval_mode;
    }
    if (el.localConnectFullControlAck) {
      el.localConnectFullControlAck.checked = snapshot.full_control_non_sensitive_machine_acknowledged;
      el.localConnectFullControlAck.disabled = !isFullControl;
      const row = el.localConnectFullControlAck.closest(".local-connect-full-ack");
      if (row) {
        row.classList.toggle("active", isFullControl);
        row.classList.toggle("error", fullControlNeedsAck);
      }
    }
    if (el.localConnectModeWarning) {
      el.localConnectModeWarning.textContent = modeWarning;
      el.localConnectModeWarning.classList.toggle("error", isFullControl);
      el.localConnectModeWarning.classList.toggle("source-warning", isFullControl);
    }
    if (el.localConnectApprovedApps && document.activeElement !== el.localConnectApprovedApps) {
      el.localConnectApprovedApps.value = snapshot.approved_apps.join("\n");
    }
    if (el.localConnectEndpointUrl && document.activeElement !== el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.value = state.localConnectEndpointUrl || `${"http:"}//127.0.0.1:8711`;
    }
    if (el.localConnectPolicyStatus) {
      el.localConnectPolicyStatus.textContent = statusText;
      el.localConnectPolicyStatus.classList.toggle("error", isFullControl);
    }
    if (el.simpleLocalConnectStatus) {
      el.simpleLocalConnectStatus.textContent = isFullControl ? modeWarning : statusText;
      el.simpleLocalConnectStatus.classList.toggle("error", isFullControl);
    }
    if (el.localConnectPolicyPreview) {
      el.localConnectPolicyPreview.textContent = `${JSON.stringify(snapshot, null, 2)}\n`;
    }
    renderLocalConnectCategoryRows();
  }

  function persistLocalConnectPolicy(statusOverride, options = {}) {
    state.localConnectApprovalMode = sanitizeLocalConnectApprovalMode(state.localConnectApprovalMode);
    if (el.localConnectFullControlAck) {
      state.localConnectFullControlAcknowledged = Boolean(el.localConnectFullControlAck.checked);
    }
    if (state.localConnectApprovalMode !== "full") {
      state.localConnectFullControlAcknowledged = false;
    }
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    state.localConnectApprovedApps = normalizeLocalConnectApprovedApps(
      el.localConnectApprovedApps ? el.localConnectApprovedApps.value : state.localConnectApprovedApps
    );
    const hasAlwaysApproval = localConnectAppCategories.some(
      (category) => state.localConnectCategoryRules[category.id] === "always"
    ) || state.localConnectApprovedApps.length > 0;
    if (state.localConnectApprovalMode === "ask" && hasAlwaysApproval) {
      state.localConnectApprovalMode = "selected";
    }
    storageSet(uiStorageKeys.localConnectApprovalMode, state.localConnectApprovalMode);
    storageSet(uiStorageKeys.localConnectFullControlAcknowledged, String(Boolean(state.localConnectFullControlAcknowledged)));
    storageSet(uiStorageKeys.localConnectCategoryRules, JSON.stringify(state.localConnectCategoryRules));
    storageSet(uiStorageKeys.localConnectApprovedApps, JSON.stringify(state.localConnectApprovedApps));
    if (!options.preserveEndpointApps) {
      clearLocalConnectEndpointApps();
    }
    updateLocalConnectPolicyUi(statusOverride);
    if (options.preserveEndpointApps && state.localConnectEndpointApps) {
      const cachedEndpointApps = state.localConnectEndpointApps;
      renderLocalConnectEndpointApps(cachedEndpointApps);
    }
  }

  function restoreLocalConnectPolicy() {
    state.localConnectApprovalMode = sanitizeLocalConnectApprovalMode(
      storageGet(uiStorageKeys.localConnectApprovalMode, "ask")
    );
    state.localConnectFullControlAcknowledged = state.localConnectApprovalMode === "full"
      && storageGet(uiStorageKeys.localConnectFullControlAcknowledged, "false") === "true";
    state.localConnectCategoryRules = parseLocalConnectCategoryRules(
      storageGet(uiStorageKeys.localConnectCategoryRules, "")
    );
    try {
      state.localConnectApprovedApps = normalizeLocalConnectApprovedApps(
        JSON.parse(storageGet(uiStorageKeys.localConnectApprovedApps, "[]"))
      );
    } catch (_error) {
      state.localConnectApprovedApps = [];
    }
    try {
      state.localConnectEndpointUrl = sanitizeLocalConnectEndpointUrl(
        storageGet(uiStorageKeys.localConnectEndpointUrl, `${"http:"}//127.0.0.1:8711`)
      );
    } catch (_error) {
      state.localConnectEndpointUrl = `${"http:"}//127.0.0.1:8711`;
    }
    updateLocalConnectPolicyUi();
  }

  function resetLocalConnectPolicy() {
    state.localConnectApprovalMode = "ask";
    state.localConnectFullControlAcknowledged = false;
    state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    state.localConnectApprovedApps = [];
    if (el.localConnectApprovedApps) {
      el.localConnectApprovedApps.value = "";
    }
    persistLocalConnectPolicy("Reset to ask every time.");
  }

  function trustBrowserEmailLocalConnectPolicy() {
    if (!state.localConnectCategoryRules) {
      state.localConnectCategoryRules = defaultLocalConnectCategoryRules();
    }
    state.localConnectApprovalMode = "selected";
    state.localConnectCategoryRules.browser = "always";
    state.localConnectCategoryRules.email = "always";
    persistLocalConnectPolicy(
      "Browsers and email apps always approved locally. Save the endpoint policy JSON over the watched policy file before relying on it.",
      { preserveEndpointApps: true }
    );
    setLocalConnectEndpointStatus("Browsers and email apps approved in the local preview. Save the endpoint policy JSON over the watched policy file to enforce it.", false);
  }

  function openLocalConnectApprovals() {
    setAppMode("advanced");
    setRailCollapsed(false);
    const drawer = document.querySelector('[data-panel-key="dashboard-local-connect-approvals"]');
    if (drawer) {
      drawer.open = true;
      drawer.scrollIntoView({ block: "nearest" });
    }
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
      throw new Error(`Enter a full consenting peer URL, for example ${peerExampleUrl}`);
    }
    if (parsed.protocol !== "http:") {
      throw new Error("Known-peer import uses direct HTTP peer URLs only in this prototype.");
    }
    if (/[?#]/.test(raw)) {
      throw new Error("Known peer URL must be a plain HTTP path without query or fragment.");
    }
    const host = parsed.hostname.toLowerCase();
    const normalizedHost = host.replace(/\.+$/, "");
    if (!normalizedHost || normalizedHost.startsWith(".") || normalizedHost.includes("..")) {
      throw new Error("Known peer host must be plain DNS or IPv4 text.");
    }
    if (isBlockedPeerHost(normalizedHost)) {
      throw new Error("That host is not a peer. Project, docs, and Hugging Face hosts cannot serve model bytes.");
    }
    if (!/^[a-z0-9.-]+$/i.test(normalizedHost)) {
      throw new Error("Known peer host must be plain DNS or IPv4 text.");
    }
    parsed.hostname = normalizedHost;
    const rawPathMatch = raw.match(/^http:\/\/[^/]*(\/.*)?$/i);
    const rawPath = rawPathMatch ? rawPathMatch[1] || "/" : parsed.pathname;
    if (rawPath.includes("\\") || rawPath.includes("..") || /[\u0000-\u0020\u007f]/.test(rawPath)) {
      throw new Error("Known peer URL path must be a plain safe path.");
    }
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.href;
  }

  function isBlockedPeerHost(host) {
    const plainHost = host.startsWith("www.") ? host.slice(4) : host;
    return blockedPeerHosts.has(plainHost)
      || blockedPeerHostSuffixes.some((suffix) => plainHost.endsWith(suffix));
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

  function renderPeerContactBookPeerList(container) {
    if (!container) {
      return;
    }
    const peers = Array.isArray(state.peerContactBookPeers) ? state.peerContactBookPeers : [];
    container.replaceChildren();
    container.hidden = peers.length === 0;
    if (!peers.length) {
      return;
    }
    peers.forEach((peer, index) => {
      const isSelected = peer.peerBaseUrl === state.peerBaseUrl;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "peer-contact-book-peer";
      button.classList.toggle("selected", isSelected);
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-pressed", String(isSelected));
      button.dataset.peerIndex = String(index);

      const label = document.createElement("strong");
      label.textContent = peer.peerLabel || `Peer ${index + 1}`;
      const url = document.createElement("span");
      url.className = "peer-contact-book-url";
      url.textContent = peer.peerBaseUrl;
      const stateText = document.createElement("small");
      stateText.textContent = isSelected ? "Selected peer" : "Use peer";

      button.append(label, url, stateText);
      button.addEventListener("click", () => selectPeerContactBookPeer(index));
      container.append(button);
    });
  }

  function renderPeerContactBookPeers() {
    renderPeerContactBookPeerList(el.simplePeerContactBookPeers);
    renderPeerContactBookPeerList(el.peerContactBookPeers);
  }

  function clearPeerContactBookPeers() {
    state.peerContactBookPeers = [];
    state.peerContactBookSourceName = "";
    renderPeerContactBookPeers();
  }

  function setPeerBaseUrl(value, options = {}) {
    const normalized = normalizedPeerBaseUrl(value);
    state.peerBaseUrl = normalized;
    storageSet(uiStorageKeys.peerBaseUrl, normalized);
    if (!options.keepPeerContactBook) {
      clearPeerContactBookPeers();
    }
    updatePeerUrlStatus(normalized ? `Known peer set: ${normalized}` : "", false);
    renderPeerContactBookPeers();
    refreshPeerAvailabilityViews();
    return normalized;
  }

  function selectPeerContactBookPeer(index) {
    const peers = Array.isArray(state.peerContactBookPeers) ? state.peerContactBookPeers : [];
    const peer = peers[index];
    if (!peer) {
      return;
    }
    setPeerBaseUrl(peer.peerBaseUrl, { keepPeerContactBook: true });
    const sourceText = state.peerContactBookSourceName ? ` from ${state.peerContactBookSourceName}` : "";
    updatePeerUrlStatus(
      `Peer contact book${sourceText}: using ${peer.peerLabel} (${peer.peerBaseUrl}); Rust reverify required`,
      false
    );
    setCatalogStatus(
      `Peer contact book peer selected: ${peer.peerLabel}; known peer is ${peer.peerBaseUrl}`,
      false
    );
    holdModelPopoverOpen(2500);
  }

  function refreshPeerAvailabilityViews() {
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderAcceptedHfResults(state.hfLastAccepted);
    }
    if (state.catalogEntries && state.catalogEntries.length) {
      renderCatalogResults(state.catalogEntries);
    }
  }

  function requireTrueMetadataFlag(raw, key, label) {
    if (!raw || raw[key] !== true) {
      throw new Error(`${label} must declare ${key}=true`);
    }
  }

  function validatePeerContactLabel(value, label) {
    const text = catalogText(value);
    if (!text || text.length > 96 || /[\u0000-\u001f\u007f]/.test(text)) {
      throw new Error(`${label} peer_label must be 1-96 printable characters`);
    }
    return text;
  }

  function peerContactCardFromRaw(raw, sourceLabel) {
    const label = sourceLabel || "peer contact card";
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} must be a JSON object`);
    }
    if (catalogText(raw.card_kind) !== "minimodel.peer_contact_card") {
      throw new Error(`${label} card kind was unsupported`);
    }
    if (catalogInteger(raw.card_version) !== 0) {
      throw new Error(`${label} card version was unsupported`);
    }
    if (catalogText(raw.transfer_protocol) !== "direct-http-piece-server-v0") {
      throw new Error(`${label} transfer protocol was unsupported`);
    }
    if (catalogText(raw.contact_status) !== "operator-reviewed-consenting-peer") {
      throw new Error(`${label} must name an operator-reviewed consenting peer`);
    }
    if (catalogText(raw.intended_use) !== "known-peer-url-for-minimodel-peer-piece-import") {
      throw new Error(`${label} intended use was unsupported`);
    }
    const peerLabel = validatePeerContactLabel(raw.peer_label, label);
    const peerBaseUrl = normalizedPeerBaseUrl(raw.peer_base_url);
    requireFalseMetadataFlag(raw, "project_server_serves_model_bytes", label);
    requireFalseMetadataFlag(raw, "project_server_runs_model_bytes", label);
    requireFalseMetadataFlag(raw, "project_server_proxies_model_bytes", label);
    const boundary = raw.boundary;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
      throw new Error(`${label} must include a boundary object`);
    }
    requireTrueMetadataFlag(boundary, "metadata_only", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_card_embeds_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_serves_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_runs_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_proxies_model_bytes", `${label} boundary`);
    requireTrueMetadataFlag(boundary, "requires_rust_reverify_before_browser_import", `${label} boundary`);
    return { peerLabel, peerBaseUrl };
  }

  function requirePeerContactBookBoundary(raw, label) {
    const boundary = raw && raw.boundary;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
      throw new Error(`${label} must include a boundary object`);
    }
    requireTrueMetadataFlag(boundary, "metadata_only", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_book_embeds_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_book_embeds_peer_piece_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "peer_contact_book_contains_catalog_availability_claims", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_serves_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_runs_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_proxies_model_bytes", `${label} boundary`);
    requireTrueMetadataFlag(boundary, "requires_rust_reverify_before_browser_import", `${label} boundary`);
  }

  function requirePeerContactBookSha256(value, label) {
    const text = catalogText(value).toLowerCase();
    if (!/^sha256:[0-9a-f]{64}$/.test(text)) {
      throw new Error(`${label} must be a sha256 digest`);
    }
    return text;
  }

  async function peerContactBookFromRaw(raw, sourceLabel) {
    const label = sourceLabel || "peer contact book";
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${label} must be a JSON object`);
    }
    if (catalogText(raw.book_kind) !== "minimodel.peer_contact_book.v0") {
      throw new Error(`${label} book kind was unsupported`);
    }
    if (catalogInteger(raw.book_version) !== 1) {
      throw new Error(`${label} book version was unsupported`);
    }
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : null;
    if (!contacts || contacts.length < 1 || contacts.length > 64) {
      throw new Error(`${label} must include 1-64 contacts`);
    }
    if (catalogInteger(raw.contact_card_count) !== contacts.length) {
      throw new Error(`${label} contact_card_count must match contacts length`);
    }
    requirePeerContactBookBoundary(raw, label);

    const seenPeerUrls = new Set();
    const cards = [];
    for (const [index, contact] of contacts.entries()) {
      const contactLabel = `${label} contacts[${index}]`;
      if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
        throw new Error(`${contactLabel} must be a JSON object`);
      }
      const expectedCardSha256 = requirePeerContactBookSha256(contact.card_sha256, `${contactLabel}.card_sha256`);
      const card = peerContactCardFromRaw(contact.card, `${contactLabel}.card`);
      const actualCardSha256 = await sha256Text(`${JSON.stringify(contact.card, null, 2)}\n`);
      if (actualCardSha256 !== expectedCardSha256) {
        throw new Error(`${contactLabel}.card_sha256 mismatch; run MiniModel inspect-peer-contact-book`);
      }
      if (seenPeerUrls.has(card.peerBaseUrl)) {
        throw new Error(`${label} contains duplicate peer_base_url ${card.peerBaseUrl}`);
      }
      seenPeerUrls.add(card.peerBaseUrl);
      cards.push(card);
    }

    return {
      contactCount: cards.length,
      firstPeerLabel: cards[0].peerLabel,
      firstPeerBaseUrl: cards[0].peerBaseUrl,
      peerLabels: cards.map((card) => card.peerLabel),
      peers: cards.map((card, index) => ({
        index,
        peerLabel: card.peerLabel,
        peerBaseUrl: card.peerBaseUrl
      }))
    };
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

  function openSidebarSource(option) {
    setAppMode("simple");
    setSimpleSourceOption(option, true);
    toggleModelPopover(true);
    holdModelPopoverOpen(2500);
  }

  function openSidebarAdvancedTools() {
    setAppMode("advanced");
    setRailCollapsed(false);
    toggleModelPopover(false);
    const drawer = document.querySelector('[data-panel-key="dashboard-model-source"]')
      || document.getElementById("advancedOptionsTitle");
    if (drawer && "open" in drawer) {
      drawer.open = true;
    }
    if (drawer && typeof drawer.scrollIntoView === "function") {
      drawer.scrollIntoView({ block: "nearest" });
    }
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
    restoreLocalConnectPolicy();
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
    document.querySelectorAll("[data-sidebar-source]").forEach((button) => {
      button.addEventListener("click", () => openSidebarSource(button.dataset.sidebarSource));
    });
    document.querySelectorAll('[data-sidebar-action="advanced"]').forEach((button) => {
      button.addEventListener("click", () => openSidebarAdvancedTools());
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
    if (el.simpleInspectLocalMemoryPackageButton) {
      el.simpleInspectLocalMemoryPackageButton.addEventListener("click", () => {
        bindLocalMemoryPackage(el.simpleLocalMemoryPackageFiles, { setup: "auto" }).catch((error) => {
          const text = errorMessage(error);
          state.localMemoryPackage = null;
          renderLocalMemoryPackageSummary(null);
          setLocalMemoryPackageStatus(text, true);
        }).finally(() => {
          holdModelPopoverOpen(2500);
        });
      });
    }
    if (el.simpleLocalMemoryPackageFiles) {
      el.simpleLocalMemoryPackageFiles.addEventListener("change", () => {
        setLocalMemorySelectionStatus(el.simpleLocalMemoryPackageFiles);
        holdModelPopoverOpen(2000);
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
          setCatalogStatus("choose a peer-source announcement or feed after loading metadata", false);
          return;
        }
        setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer-source announcement/feed selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleImportReceiptLedgerButton) {
      el.simpleImportReceiptLedgerButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importReceiptLedgerFile(el.simpleImportReceiptLedgerFile).catch((error) => {
          setImportReceiptLedgerStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simpleImportReceiptLedgerFile) {
      el.simpleImportReceiptLedgerFile.addEventListener("change", () => {
        const file = el.simpleImportReceiptLedgerFile.files && el.simpleImportReceiptLedgerFile.files[0];
        if (!file) {
          setImportReceiptLedgerStatus("choose an import receipt ledger JSON file", false);
          return;
        }
        setImportReceiptLedgerStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} import receipt ledger selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simplePeerStatusCheckButton) {
      el.simplePeerStatusCheckButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importPeerStatusCheckFile(el.simplePeerStatusCheckFile).catch((error) => {
          setPeerStatusCheckStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerStatusCheckFile) {
      el.simplePeerStatusCheckFile.addEventListener("change", () => {
        const file = el.simplePeerStatusCheckFile.files && el.simplePeerStatusCheckFile.files[0];
        if (!file) {
          setPeerStatusCheckStatus("choose a peer status check JSON file", false);
          return;
        }
        setPeerStatusCheckStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer status check selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simplePeerCompanionInventoryButton) {
      el.simplePeerCompanionInventoryButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importPeerCompanionInventoryFile(el.simplePeerCompanionInventoryFile).catch((error) => {
          setPeerCompanionInventoryStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerCompanionInventoryFile) {
      el.simplePeerCompanionInventoryFile.addEventListener("change", () => {
        const file = el.simplePeerCompanionInventoryFile.files && el.simplePeerCompanionInventoryFile.files[0];
        if (!file) {
          setPeerCompanionInventoryStatus("choose a peer companion inventory JSON file", false);
          return;
        }
        setPeerCompanionInventoryStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer companion inventory selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleImportShareMetadataButton) {
      el.simpleImportShareMetadataButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        importShareMetadataFile(el.simpleShareMetadataFile).catch((error) => {
          setCatalogStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simpleShareMetadataFile) {
      el.simpleShareMetadataFile.addEventListener("change", () => {
        const file = el.simpleShareMetadataFile.files && el.simpleShareMetadataFile.files[0];
        if (!file) {
          setCatalogStatus("choose a share metadata JSON file", false);
          return;
        }
        setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} share metadata selected`, false);
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
    if (el.simpleSaveShareKitButton) {
      el.simpleSaveShareKitButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        saveShareKit().catch((error) => {
          setShareMetadataStatus(errorMessage(error), true);
        });
      });
    }
    if (el.simpleLocalConnectApprovalsButton) {
      el.simpleLocalConnectApprovalsButton.addEventListener("click", () => {
        openLocalConnectApprovals();
      });
    }
    if (el.localConnectApprovalMode) {
      el.localConnectApprovalMode.addEventListener("change", () => {
        state.localConnectApprovalMode = sanitizeLocalConnectApprovalMode(el.localConnectApprovalMode.value);
        if (state.localConnectApprovalMode !== "full") {
          state.localConnectFullControlAcknowledged = false;
        }
        persistLocalConnectPolicy("Approval mode saved.", { preserveEndpointApps: true });
      });
    }
    if (el.localConnectFullControlAck) {
      el.localConnectFullControlAck.addEventListener("change", () => {
        state.localConnectFullControlAcknowledged = Boolean(el.localConnectFullControlAck.checked);
        persistLocalConnectPolicy("Full-control acknowledgement saved.", { preserveEndpointApps: true });
      });
    }
    if (el.localConnectApprovedApps) {
      el.localConnectApprovedApps.addEventListener("input", () => {
        state.localConnectApprovedApps = normalizeLocalConnectApprovedApps(el.localConnectApprovedApps.value);
        updateLocalConnectPolicyUi();
      });
      el.localConnectApprovedApps.addEventListener("change", () => {
        persistLocalConnectPolicy("Approved app list saved.");
      });
    }
    if (el.trustBrowserEmailLocalConnectButton) {
      el.trustBrowserEmailLocalConnectButton.addEventListener("click", () => {
        trustBrowserEmailLocalConnectPolicy();
      });
    }
    if (el.saveLocalConnectPolicyButton) {
      el.saveLocalConnectPolicyButton.addEventListener("click", () => {
        persistLocalConnectPolicy("Approval policy saved.");
      });
    }
    if (el.saveLocalConnectPolicyFileButton) {
      el.saveLocalConnectPolicyFileButton.addEventListener("click", () => {
        try {
          saveLocalConnectEndpointPolicyJson();
        } catch (error) {
          setLocalConnectEndpointStatus(errorMessage(error), true);
          updateLocalConnectPolicyUi();
        }
      });
    }
    if (el.resetLocalConnectPolicyButton) {
      el.resetLocalConnectPolicyButton.addEventListener("click", () => {
        resetLocalConnectPolicy();
      });
    }
    if (el.localConnectEndpointUrl) {
      el.localConnectEndpointUrl.addEventListener("change", () => {
        try {
          state.localConnectEndpointUrl = sanitizeLocalConnectEndpointUrl(el.localConnectEndpointUrl.value);
          el.localConnectEndpointUrl.value = state.localConnectEndpointUrl;
          storageSet(uiStorageKeys.localConnectEndpointUrl, state.localConnectEndpointUrl);
          clearLocalConnectEndpointApps();
          setLocalConnectEndpointStatus("Endpoint saved. Run a check before relying on it.", false);
        } catch (error) {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        }
      });
    }
    if (el.checkLocalConnectEndpointButton) {
      el.checkLocalConnectEndpointButton.addEventListener("click", () => {
        checkLocalConnectEndpoint(false).catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    if (el.dryRunLocalConnectDecisionButton) {
      el.dryRunLocalConnectDecisionButton.addEventListener("click", () => {
        checkLocalConnectEndpoint(true).catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    if (el.dryRunLocalConnectActionButton) {
      el.dryRunLocalConnectActionButton.addEventListener("click", () => {
        dryRunLocalConnectAction().catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    if (el.executeLocalConnectActionButton) {
      el.executeLocalConnectActionButton.addEventListener("click", () => {
        executeLocalConnectAction().catch((error) => {
          setLocalConnectEndpointStatus(errorMessage(error), true);
        });
      });
    }
    document.querySelectorAll("[data-doc-target]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = link.getAttribute("data-doc-target") || "";
        const url = docsTargets[target];
        if (url) {
          window.open(url, "_blank", "noopener");
        }
      });
    });
    if (el.simplePeerBaseUrlInput) {
      el.simplePeerBaseUrlInput.placeholder = peerExampleUrl;
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
    if (el.simpleApplyPeerContactCardButton) {
      el.simpleApplyPeerContactCardButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        applyPeerContactCardFile(el.simplePeerContactCardFile).catch((error) => {
          updatePeerUrlStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerContactCardFile) {
      el.simplePeerContactCardFile.addEventListener("change", () => {
        const file = el.simplePeerContactCardFile.files && el.simplePeerContactCardFile.files[0];
        if (!file) {
          updatePeerUrlStatus("choose a peer contact card or enter a URL", false);
          return;
        }
        updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact card selected`, false);
        holdModelPopoverOpen(2500);
      });
    }
    if (el.simpleApplyPeerContactBookButton) {
      el.simpleApplyPeerContactBookButton.addEventListener("click", () => {
        setSimpleSourceOption("p2p", true);
        applyPeerContactBookFile(el.simplePeerContactBookFile).catch((error) => {
          updatePeerUrlStatus(errorMessage(error), true);
        }).finally(() => {
          holdModelPopoverOpen(3000);
        });
      });
    }
    if (el.simplePeerContactBookFile) {
      el.simplePeerContactBookFile.addEventListener("change", () => {
        const file = el.simplePeerContactBookFile.files && el.simplePeerContactBookFile.files[0];
        if (!file) {
          updatePeerUrlStatus("choose a peer contact book, peer contact card, or enter a URL", false);
          return;
        }
        updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact book selected`, false);
        holdModelPopoverOpen(2500);
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
    if (el.prompt) {
      el.prompt.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
          return;
        }
        if (!el.generateButton || el.generateButton.disabled || !el.form) {
          return;
        }
        event.preventDefault();
        if (typeof el.form.requestSubmit === "function") {
          el.form.requestSubmit(el.generateButton);
        } else {
          el.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
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
      item.textContent = "No conversation yet. Messages appear only after a verified local .slm runs through Rust/WASM generation; use local import, P2P Import, or Start Conversion to create one.";
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
    if (bytes >= 1024 * 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TiB`;
    }
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
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

  function safeLocalPathLeaf(pathHint, fallback = "local-file") {
    const text = String(pathHint || "").replace(/\\/g, "/");
    const leaf = text.split("/").filter(Boolean).pop() || fallback;
    return safeLocalModelName(leaf);
  }

  function normalizeLocalMemoryPath(pathHint, fallback = "memory.uai") {
    const raw = String(pathHint || fallback)
      .replace(/\\/g, "/")
      .replace(/^[a-zA-Z]:\//, "")
      .replace(/^\/+/, "")
      .trim();
    let parts = raw.split("/").filter(Boolean);
    const uaiIndex = parts.findIndex((segment) => segment.toLowerCase() === ".uai");
    if (uaiIndex >= 0) {
      parts = parts.slice(uaiIndex);
    } else if (parts[0] && parts[0].toLowerCase() === "uai") {
      parts[0] = ".uai";
    } else {
      const leaf = safeLocalModelName(parts[parts.length - 1] || fallback);
      const requiredPaths = [
        ...localMemoryUniversalPaths,
        ...localMemoryBaselinePaths,
        ...localMemoryFileHandoffPaths,
        ...localMemoryCodeBearingPaths,
        ...localMemoryMultiAgentPaths,
        ...localMemoryTalismanPaths,
        ...localMemoryAdvancedPersonaPaths,
        ...localMemoryOptionalContentPaths.map((entry) => entry[1])
      ];
      const candidates = requiredPaths.filter((path) => safeLocalPathLeaf(path).toLowerCase() === leaf.toLowerCase());
      if (candidates.length === 1) {
        return candidates[0];
      }
      parts = [".uai", leaf];
    }
    if (!parts.length || parts[0].toLowerCase() !== ".uai") {
      throw new Error("UAIX memory deck files must be inside a .uai folder");
    }
    const normalized = parts.map((segment, index) => {
      const value = String(segment || "").trim();
      if (!value || value === "." || value === "..") {
        throw new Error("UAIX memory deck paths cannot contain empty or parent segments");
      }
      return index === 0 ? ".uai" : safeLocalModelName(value);
    }).join("/");
    return normalized.toLowerCase();
  }

  function normalizeLocalMemoryManifestPath(value) {
    try {
      return normalizeLocalMemoryPath(value, "");
    } catch (_error) {
      return "";
    }
  }

  function localMemoryPathHintFromText(text) {
    const match = String(text || "").match(/(?:^|\n)\s*(\.uai\/[A-Za-z0-9._/-]+)/);
    return match ? match[1] : "";
  }

  function localMemoryManifestEntry(entries) {
    return entries.get(".uai/manifest.uaix.json") || null;
  }

  function localMemorySelectedFiles(input) {
    return Array.from(input && input.files ? input.files : []);
  }

  function localMemorySetupLabel(setup) {
    const labels = {
      base: "Base active memory",
      agent_file_handoff: "Agent File Handoff",
      llm_wiki: "LLM Wiki",
      file_handoff_llm_wiki: "File Handoff + LLM Wiki",
      multi_agent_communication: "Multi-Agent Communication",
      talisman_system: "Talisman System",
      advanced_persona_profile: "Advanced Persona Profile"
    };
    return labels[setup] || labels.base;
  }

  function valueContainsLocalMemoryString(value, needle) {
    const target = String(needle || "").toLowerCase();
    if (!target) {
      return false;
    }
    if (typeof value === "string") {
      return value.toLowerCase().includes(target);
    }
    if (Array.isArray(value)) {
      return value.some((item) => valueContainsLocalMemoryString(item, target));
    }
    if (value && typeof value === "object") {
      return Object.entries(value).some(([key, item]) => {
        return String(key).toLowerCase().includes(target) || valueContainsLocalMemoryString(item, target);
      });
    }
    return false;
  }

  function localMemoryManifestBoolean(manifest, key) {
    if (!manifest || typeof manifest !== "object") {
      return false;
    }
    if (manifest[key] === true) {
      return true;
    }
    const dashed = key.replace(/_/g, "-");
    return valueContainsLocalMemoryString(manifest, key) || valueContainsLocalMemoryString(manifest, dashed);
  }

  function extractLocalMemoryManifestPaths(value, paths = new Set()) {
    if (typeof value === "string") {
      const pathValue = normalizeLocalMemoryManifestPath(value);
      if (pathValue) {
        paths.add(pathValue);
      }
      return paths;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => extractLocalMemoryManifestPaths(item, paths));
      return paths;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        const keyText = String(key || "").toLowerCase();
        if (typeof item === "string" && (keyText.includes("path") || keyText.includes("file") || keyText.includes("entry"))) {
          const pathValue = normalizeLocalMemoryManifestPath(item);
          if (pathValue) {
            paths.add(pathValue);
          }
        }
        extractLocalMemoryManifestPaths(item, paths);
      });
    }
    return paths;
  }

  function inferLocalMemorySetup(manifest, selectedSetup) {
    if (selectedSetup && selectedSetup !== "auto") {
      return selectedSetup;
    }
    if (valueContainsLocalMemoryString(manifest, "advanced_persona_profile")) {
      return "advanced_persona_profile";
    }
    if (valueContainsLocalMemoryString(manifest, "talisman_system")) {
      return "talisman_system";
    }
    if (valueContainsLocalMemoryString(manifest, "multi_agent_communication")) {
      return "multi_agent_communication";
    }
    if (valueContainsLocalMemoryString(manifest, "file_handoff_llm_wiki")) {
      return "file_handoff_llm_wiki";
    }
    if (valueContainsLocalMemoryString(manifest, "agent_file_handoff")) {
      return "agent_file_handoff";
    }
    if (valueContainsLocalMemoryString(manifest, "llm_wiki")) {
      return "llm_wiki";
    }
    return "base";
  }

  function uniqueLocalMemoryPaths(paths) {
    return Array.from(new Set(paths.map((path) => normalizeLocalMemoryPath(path)))).sort();
  }

  function orderedUniqueLocalMemoryPaths(paths) {
    const seen = new Set();
    const result = [];
    for (const path of paths) {
      const normalized = normalizeLocalMemoryPath(path);
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  function localMemoryRequiredPaths(setup, manifest, entries, declaredPaths) {
    const required = [
      ...localMemoryUniversalPaths,
      ...localMemoryBaselinePaths
    ];
    if (setup === "agent_file_handoff" || setup === "file_handoff_llm_wiki") {
      required.push(...localMemoryFileHandoffPaths);
    }
    if (setup === "llm_wiki" || setup === "file_handoff_llm_wiki") {
      required.push(".uai/long-term-memory.uai");
    }
    if (setup === "file_handoff_llm_wiki" || localMemoryManifestBoolean(manifest, "code_like_artifacts")) {
      required.push(...localMemoryCodeBearingPaths);
    }
    if (setup === "multi_agent_communication") {
      required.push(...localMemoryMultiAgentPaths);
    }
    if (setup === "talisman_system") {
      required.push(...localMemoryTalismanPaths);
    }
    for (const [key, path] of localMemoryOptionalContentPaths) {
      const normalized = normalizeLocalMemoryPath(path);
      if (localMemoryManifestBoolean(manifest, key) || entries.has(normalized) || declaredPaths.has(normalized)) {
        required.push(path);
      }
    }
    if (setup === "advanced_persona_profile") {
      required.push(...localMemoryAdvancedPersonaPaths);
    }
    return uniqueLocalMemoryPaths(required);
  }

  function localMemoryTextContainsMarker(text, markers) {
    const normalized = String(text || "").toLowerCase();
    return markers.some((marker) => normalized.includes(String(marker).toLowerCase()));
  }

  function localMemoryDepthLevel(text) {
    const normalized = String(text || "").toLowerCase();
    for (const marker of ["depth_level_0_to_10", "depth level 0 to 10"]) {
      const index = normalized.indexOf(marker);
      if (index < 0) {
        continue;
      }
      const tail = normalized.slice(index + marker.length);
      const match = tail.match(/\d+/);
      if (!match) {
        continue;
      }
      const value = Number.parseInt(match[0], 10);
      if (Number.isInteger(value) && value >= 0 && value <= 10) {
        return value;
      }
    }
    return null;
  }

  function inspectLocalMemoryPersonaDimensions(entries, setup) {
    if (setup !== "advanced_persona_profile") {
      return [];
    }
    return localMemoryAdvancedPersonaDimensions.map(([dimension, path]) => {
      const normalized = normalizeLocalMemoryPath(path);
      const entry = entries.get(normalized) || null;
      const text = entry && entry.text ? entry.text : "";
      const warnings = [];
      const exists = Boolean(entry && entry.byteCount > 0);
      if (!exists) {
        warnings.push("persona dimension file is missing or empty");
      }
      const declaresDepthLevel = localMemoryTextContainsMarker(text, ["depth_level_0_to_10", "depth level 0 to 10"]);
      const depthLevel0To10 = localMemoryDepthLevel(text);
      const declaresDisclosureBoundary = localMemoryTextContainsMarker(text, ["disclosure_boundary", "disclosure boundary"]);
      const declaresSourceConfidence = localMemoryTextContainsMarker(text, ["source_confidence", "source confidence"]);
      const declaresNonInferenceRules = localMemoryTextContainsMarker(text, [
        "non_inference",
        "non-inference",
        "non inference",
        "do not infer",
        "no inference"
      ]);
      if (exists && !declaresDepthLevel) {
        warnings.push("persona dimension did not declare depth_level_0_to_10");
      }
      if (exists && depthLevel0To10 === null) {
        warnings.push("persona dimension did not provide a parsed depth value from 0 to 10");
      }
      if (exists && !declaresDisclosureBoundary) {
        warnings.push("persona dimension did not declare a disclosure boundary");
      }
      if (exists && !declaresSourceConfidence) {
        warnings.push("persona dimension did not declare source confidence");
      }
      if (exists && !declaresNonInferenceRules) {
        warnings.push("persona dimension did not declare non-inference rules");
      }
      return {
        dimension,
        path: normalized,
        exists,
        byteCount: entry ? entry.byteCount : 0,
        sha256: entry ? entry.sha256 : "",
        declaresDepthLevel,
        depthLevel0To10,
        declaresDisclosureBoundary,
        declaresSourceConfidence,
        declaresNonInferenceRules,
        valid: exists && declaresDepthLevel && depthLevel0To10 !== null && declaresDisclosureBoundary && declaresSourceConfidence && declaresNonInferenceRules,
        warnings
      };
    });
  }

  function trimTextToByteLimit(text, byteLimit) {
    const limit = Math.max(0, Number.parseInt(byteLimit, 10) || 0);
    const value = String(text || "");
    if (state.encoder.encode(value).length <= limit) {
      return value;
    }
    let low = 0;
    let high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (state.encoder.encode(value.slice(0, mid)).length <= limit) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return `${value.slice(0, low).trimEnd()}\n[trimmed]`;
  }

  function buildLocalMemoryContextText(entries, requiredPaths) {
    const contextPaths = orderedUniqueLocalMemoryPaths([
      ...localMemoryContextPriority,
      ...localMemoryAdvancedPersonaDimensions.map((entry) => entry[1]),
      ...requiredPaths.filter((path) => path.endsWith(".uai"))
    ]);
    const sections = [];
    let usedBytes = 0;
    for (const path of contextPaths) {
      const entry = entries.get(path);
      if (!entry || !entry.text || !entry.text.trim()) {
        continue;
      }
      const body = entry.text.replace(/\u0000/g, "").trim();
      if (!body) {
        continue;
      }
      const sectionHeader = `## ${path}\n`;
      const remaining = localMemoryContextByteLimit - usedBytes - state.encoder.encode(sectionHeader).length - 2;
      if (remaining < 96) {
        break;
      }
      const trimmedBody = trimTextToByteLimit(body, Math.min(remaining, 512));
      const section = `${sectionHeader}${trimmedBody}`;
      usedBytes += state.encoder.encode(`${section}\n\n`).length;
      sections.push(section);
      if (usedBytes >= localMemoryContextByteLimit) {
        break;
      }
    }
    return sections.join("\n\n").trim();
  }

  async function loadLocalMemoryPackageEntries(files) {
    if (!files.length) {
      throw new Error("Choose an extracted `.uai` folder before inspecting memory");
    }
    if (files.length > localMemoryPackageMaxFiles) {
      throw new Error(`UAIX memory deck exceeds ${localMemoryPackageMaxFiles} browser file limit`);
    }
    const entries = new Map();
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size || 0;
      if (totalBytes > localMemoryPackageMaxBytes) {
        throw new Error(`UAIX memory deck exceeds ${formatByteCount(localMemoryPackageMaxBytes)} browser limit`);
      }
      if (file.size > localMemoryPackageMaxFileBytes) {
        throw new Error(`${safeLocalModelName(file.name)} exceeds ${formatByteCount(localMemoryPackageMaxFileBytes)} per-file limit`);
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text = "";
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (_error) {
        text = "";
      }
      const relativePath = normalizeLocalMemoryPath(file.webkitRelativePath || localMemoryPathHintFromText(text) || file.name, file.name);
      if (entries.has(relativePath)) {
        throw new Error(`Duplicate UAIX memory file path: ${relativePath}`);
      }
      entries.set(relativePath, {
        path: relativePath,
        name: safeLocalModelName(file.name),
        byteCount: bytes.length,
        sha256: await sha256Hex(bytes),
        text
      });
    }
    return entries;
  }

  async function inspectLocalMemoryPackage(input = el.localMemoryPackageFiles, options = {}) {
    const files = localMemorySelectedFiles(input);
    const entries = await loadLocalMemoryPackageEntries(files);
    const manifestEntry = localMemoryManifestEntry(entries);
    if (!manifestEntry || !manifestEntry.text) {
      throw new Error("UAIX memory deck is missing `.uai/manifest.uaix.json`");
    }
    let manifest = null;
    try {
      manifest = JSON.parse(manifestEntry.text);
    } catch (error) {
      throw new Error(`UAIX memory manifest JSON is invalid: ${errorMessage(error)}`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error("UAIX memory manifest must be a JSON object");
    }
    const declaredPaths = extractLocalMemoryManifestPaths(manifest);
    const selectedSetup = Object.prototype.hasOwnProperty.call(options, "setup")
      ? options.setup
      : (el.localMemoryPackageSetup ? el.localMemoryPackageSetup.value : "auto");
    const setup = inferLocalMemorySetup(manifest, selectedSetup);
    const requiredPaths = localMemoryRequiredPaths(setup, manifest, entries, declaredPaths);
    const requiredFiles = requiredPaths.map((path) => {
      const entry = entries.get(path) || null;
      return {
        path,
        exists: Boolean(entry && entry.byteCount > 0),
        byteCount: entry ? entry.byteCount : 0,
        sha256: entry ? entry.sha256 : ""
      };
    });
    const missingRequiredFiles = requiredFiles.filter((file) => !file.exists).map((file) => file.path);
    const manifestMissingRequiredFiles = requiredPaths.filter((path) => !declaredPaths.has(path));
    const personaDimensions = inspectLocalMemoryPersonaDimensions(entries, setup);
    const personaDimensionWarnings = personaDimensions.reduce((count, dimension) => count + dimension.warnings.length, 0);
    const personaDimensionsValid = setup !== "advanced_persona_profile" || personaDimensions.every((dimension) => dimension.valid);
    const valid = missingRequiredFiles.length === 0 && manifestMissingRequiredFiles.length === 0 && personaDimensionsValid;
    const contextText = valid ? buildLocalMemoryContextText(entries, requiredPaths) : "";
    return {
      kind: "uaix.memory.browser_deck_inspection.v0",
      setup,
      setupLabel: localMemorySetupLabel(setup),
      fileCount: entries.size,
      byteCount: Array.from(entries.values()).reduce((total, entry) => total + entry.byteCount, 0),
      manifestSha256: manifestEntry.sha256,
      requiredFiles,
      missingRequiredFiles,
      manifestMissingRequiredFiles,
      manifestDeclaresRequiredFiles: manifestMissingRequiredFiles.length === 0,
      personaDimensions,
      personaDimensionsValid,
      personaDimensionWarnings,
      contextText,
      valid,
      sourceUrls: [uaixMemoryWizardUrl, uaixPersonaPackUrl],
      boundary: {
        browser_local_only: true,
        project_server_receives_memory_files: false,
        persona_source_mutation_allowed: false,
        native_archive_validation_package: "UAIX.Browser.Memory"
      }
    };
  }

  function setLocalMemoryPackageStatus(text, isError) {
    if (el.localMemoryPackageStatus) {
      setText(el.localMemoryPackageStatus, text, isError);
    }
    if (el.simpleLocalMemoryPackageStatus) {
      setText(el.simpleLocalMemoryPackageStatus, text, isError);
    }
    updateModelSummary();
  }

  function renderLocalMemoryPackageSummary(inspection) {
    if (!el.localMemoryPackageSummary || !el.localMemoryPackageContextPreview) {
      return;
    }
    el.localMemoryPackageSummary.replaceChildren();
    if (!inspection) {
      el.localMemoryPackageSummary.hidden = true;
      el.localMemoryPackageContextPreview.textContent = "";
      return;
    }
    el.localMemoryPackageSummary.hidden = false;
    const summary = elementWithText(
      "strong",
      "",
      `${inspection.setupLabel} / ${inspection.fileCount} files / ${formatByteCount(inspection.byteCount)} / manifest ${shortSha256(inspection.manifestSha256)}`
    );
    el.localMemoryPackageSummary.append(summary);
    const required = elementWithText(
      "span",
      "",
      `${inspection.requiredFiles.length} required files checked; project server receives memory files: no`
    );
    el.localMemoryPackageSummary.append(required);
    if (inspection.missingRequiredFiles.length) {
      el.localMemoryPackageSummary.append(elementWithText(
        "span",
        "memory-deck-warning",
        `Missing: ${inspection.missingRequiredFiles.slice(0, 6).join(", ")}`
      ));
    }
    if (inspection.manifestMissingRequiredFiles.length) {
      el.localMemoryPackageSummary.append(elementWithText(
        "span",
        "memory-deck-warning",
        `Manifest does not declare: ${inspection.manifestMissingRequiredFiles.slice(0, 6).join(", ")}`
      ));
    }
    if (inspection.personaDimensionWarnings > 0) {
      const warnings = inspection.personaDimensions
        .filter((dimension) => dimension.warnings.length)
        .slice(0, 4)
        .map((dimension) => `${dimension.dimension}: ${dimension.warnings[0]}`)
        .join("; ");
      el.localMemoryPackageSummary.append(elementWithText("span", "memory-deck-warning", warnings));
    }
    el.localMemoryPackageContextPreview.textContent = inspection.contextText || "No runtime memory context is active until the deck passes validation.";
  }

  async function bindLocalMemoryPackage(input = el.localMemoryPackageFiles, options = {}) {
    setLocalMemoryPackageStatus("inspecting UAIX memory deck", false);
    const inspection = await inspectLocalMemoryPackage(input, options);
    state.localMemoryPackage = inspection.valid ? inspection : null;
    renderLocalMemoryPackageSummary(inspection);
    if (!inspection.valid) {
      setLocalMemoryPackageStatus("UAIX memory deck failed validation; context not bound", true);
      return inspection;
    }
    setLocalMemoryPackageStatus(
      `${inspection.setupLabel} bound locally; ${inspection.requiredFiles.length} required files verified`,
      false
    );
    return inspection;
  }

  function clearLocalMemoryPackage() {
    state.localMemoryPackage = null;
    if (el.localMemoryPackageFiles) {
      el.localMemoryPackageFiles.value = "";
    }
    if (el.simpleLocalMemoryPackageFiles) {
      el.simpleLocalMemoryPackageFiles.value = "";
    }
    renderLocalMemoryPackageSummary(null);
    setLocalMemoryPackageStatus("memory deck optional", false);
  }

  function setLocalMemorySelectionStatus(input) {
    const files = localMemorySelectedFiles(input);
    if (!files.length) {
      setLocalMemoryPackageStatus("memory deck optional", false);
      return;
    }
    const totalBytes = files.reduce((total, file) => total + (file.size || 0), 0);
    setLocalMemoryPackageStatus(`${files.length} UAIX memory files selected / ${formatByteCount(totalBytes)}`, false);
  }

  function runtimePromptWithLocalMemory(promptText) {
    const prompt = String(promptText || "");
    const memory = state.localMemoryPackage;
    if (!memory || !memory.valid || !memory.contextText) {
      return prompt;
    }
    const prefix = [
      "[UAIX memory context]",
      `setup=${memory.setup}`,
      "source=local user-selected .uai deck",
      "boundary=local-only; no project-server memory upload; do not mutate source persona",
      ""
    ].join("\n");
    const suffix = `\n[End UAIX memory context]\n\n[User prompt]\n${prompt}`;
    const fixedBytes = state.encoder.encode(prefix + suffix).length;
    const availableContextBytes = Math.min(localMemoryContextByteLimit, registryModulePlanPromptByteLimit - fixedBytes);
    if (availableContextBytes < 128) {
      return prompt;
    }
    const context = trimTextToByteLimit(memory.contextText, availableContextBytes);
    const combined = `${prefix}${context}${suffix}`;
    return state.encoder.encode(combined).length <= registryModulePlanPromptByteLimit
      ? combined
      : prompt;
  }

  function shortSha256(sha256) {
    const text = normalizeCatalogSha256(sha256) || "";
    return text ? `${text.slice(0, 19)}...${text.slice(-8)}` : "sha256 unavailable";
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
    const peerHintStatus = catalogText(raw.peer_hint_status || raw.p2p_status || raw.transfer_status) || "disabled";
    const peerImportStatus = catalogText(raw.peer_import_status || raw.peer_transfer_status || raw.import_status);
    const peerOfferRoute = catalogText(raw.peer_offer_route || raw.peer_offer_path);
    const peerOfferSha256 = normalizeCatalogSha256(raw.peer_offer_sha256 || raw.peer_offer_checksum);
    const peerOfferChunkCount = catalogInteger(raw.peer_offer_chunk_count);
    const peerOfferMerkleRootSha256 = normalizeCatalogSha256(raw.peer_offer_merkle_root_sha256 || raw.merkle_root_sha256);
    const hasPeerOfferFields = Boolean(peerOfferRoute || peerOfferSha256 || peerOfferChunkCount || peerOfferMerkleRootSha256);
    if (
      peerImportStatus === "request-script-ready" ||
      peerHintStatus === "peer-offer-ready-known-peer-needed" ||
      peerSources.length ||
      hasPeerOfferFields
    ) {
      const peerOfferKind = catalogText(raw.peer_offer_kind);
      const peerOfferChunkAlgorithm = catalogText(raw.peer_offer_chunk_algorithm);
      const peerOfferChunkSize = catalogInteger(raw.peer_offer_chunk_size);
      if (peerOfferKind !== "minimodel.peer_offer.v0") {
        throw new Error(`Catalog entry ${modelId} peer offer kind was invalid`);
      }
      if (peerOfferChunkAlgorithm !== "sha256-merkle-v0") {
        throw new Error(`Catalog entry ${modelId} peer offer chunk algorithm was invalid`);
      }
      if (!peerOfferRoute || peerOfferRoute.includes("\n") || peerOfferRoute.includes("\r")) {
        throw new Error(`Catalog entry ${modelId} peer offer route was invalid`);
      }
      if (!peerOfferSha256) {
        throw new Error(`Catalog entry ${modelId} peer offer SHA-256 was invalid`);
      }
      if (!peerOfferChunkSize || peerOfferChunkSize < 1) {
        throw new Error(`Catalog entry ${modelId} peer offer chunk size was invalid`);
      }
      if (!peerOfferChunkCount || peerOfferChunkCount < 1) {
        throw new Error(`Catalog entry ${modelId} peer offer chunk count was invalid`);
      }
      if (!peerOfferMerkleRootSha256) {
        throw new Error(`Catalog entry ${modelId} peer offer Merkle root was invalid`);
      }
    }
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
      peerHintStatus,
      peerImportStatus,
      peerOfferRoute,
      peerOfferSha256,
      peerOfferChunkCount,
      peerOfferMerkleRootSha256,
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
      if (entry.shareMetadataStatus) {
        return entry.shareMetadataLocalShareKitAvailable
          ? "Share metadata verified / run share kit then load generated catalog"
          : "Share metadata verified / matching local .slm needed";
      }
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

  function catalogAnnouncementRouteStatusText(routeResult) {
    const appliedText = `${routeResult.appliedCount} peer-source announcement${routeResult.appliedCount === 1 ? "" : "s"} applied`;
    const duplicateText = routeResult.duplicateCount
      ? `; ${routeResult.duplicateCount} duplicate${routeResult.duplicateCount === 1 ? "" : "s"} already loaded`
      : "";
    const emptyText = routeResult.emptyFeedCount
      ? `; ${routeResult.emptyFeedCount} availability feed${routeResult.emptyFeedCount === 1 ? "" : "s"} checked with no peer sources`
      : "";
    return `${appliedText}${duplicateText}${emptyText}`;
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
      setCatalogStatus(`${entries.length} metadata entries; ${catalogAnnouncementRouteStatusText(routeResult)}`, false);
      return;
    }
    setCatalogStatus(`${entries.length} metadata entries`, false);
  }

  async function importLocalCatalogFile(input = el.localCatalogFile) {
    const file = input && input.files ? input.files[0] : null;
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

  function shareMetadataModeFromBundle(bundle, label) {
    const boundary = bundle && bundle.boundary;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
      throw new Error(`${label} boundary was invalid`);
    }
    requireFalseMetadataFlag(boundary, "project_server_serves_model_bytes", `${label} boundary`);
    requireFalseMetadataFlag(boundary, "project_server_runs_model_bytes", `${label} boundary`);
    if (boundary.project_server_proxies_model_bytes === true) {
      throw new Error(`${label} boundary declares project-server model-byte proxying`);
    }
    if (boundary.user_consent_required_before_transfer !== true) {
      throw new Error(`${label} boundary must require user consent before transfer`);
    }
    const status = catalogText(boundary.peer_transfer_status);
    const implementation = catalogText(boundary.peer_transfer_implementation);
    const implemented = boundary.peer_transfer_implemented === true;
    if (
      !implemented &&
      status === "metadata-only" &&
      implementation === "not-included-in-metadata-export"
    ) {
      return {
        shareKitReady: false,
        status,
        implementation,
        peerHintStatus: "share-metadata-verified-local-file-required",
        requiredNextGate: "import-matching-local-slm-or-run-share-kit-before-p2p"
      };
    }
    if (
      implemented &&
      status === "local-share-kit-script-ready-known-peer-needed" &&
      implementation === "generated-local-minimodel-share-kit-v0"
    ) {
      return {
        shareKitReady: true,
        status,
        implementation,
        peerHintStatus: "share-kit-ready-run-local-script-known-peer-needed",
        requiredNextGate: "run-local-share-kit-and-load-generated-models-v0-json-for-p2p"
      };
    }
    throw new Error(`${label} peer transfer profile was unsupported`);
  }

  function requireShareMetadataObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return value;
  }

  function requireShareMetadataSha(value, label) {
    const normalized = normalizeCatalogSha256(value);
    if (!normalized) {
      throw new Error(`${label} SHA-256 was invalid`);
    }
    return normalized;
  }

  function requireShareMetadataInteger(value, label) {
    const parsed = catalogInteger(value);
    if (!parsed || parsed < 1) {
      throw new Error(`${label} was invalid`);
    }
    return parsed;
  }

  async function validateShareMetadataChunks(chunks, artifactByteCount, artifactSha256, label) {
    requireShareMetadataObject(chunks, `${label} chunks`);
    if (catalogText(chunks.algorithm) !== "sha256-merkle-v0") {
      throw new Error(`${label} chunk algorithm was unsupported`);
    }
    const chunkSize = requireShareMetadataInteger(chunks.chunk_size, `${label} chunk size`);
    if (chunkSize !== peerShareChunkBytes) {
      throw new Error(`${label} chunk size must be ${peerShareChunkBytes}`);
    }
    const chunkCount = requireShareMetadataInteger(chunks.chunk_count, `${label} chunk count`);
    const entries = Array.isArray(chunks.entries) ? chunks.entries : [];
    if (entries.length !== chunkCount) {
      throw new Error(`${label} chunk count did not match entries`);
    }
    const normalizedEntries = [];
    let expectedOffset = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = requireShareMetadataObject(entries[index], `${label} chunk ${index + 1}`);
      const chunkIndex = catalogInteger(entry.index);
      const offset = catalogInteger(entry.offset);
      const byteCount = requireShareMetadataInteger(entry.byte_count, `${label} chunk ${index + 1} byte count`);
      const sha256 = requireShareMetadataSha(entry.sha256, `${label} chunk ${index + 1}`);
      if (chunkIndex !== index) {
        throw new Error(`${label} chunk ${index + 1} index was invalid`);
      }
      if (offset === null || offset !== expectedOffset) {
        throw new Error(`${label} chunk ${index + 1} offset was invalid`);
      }
      expectedOffset += byteCount;
      normalizedEntries.push({
        index,
        offset,
        byte_count: byteCount,
        sha256
      });
    }
    if (expectedOffset !== artifactByteCount) {
      throw new Error(`${label} chunk byte count did not match artifact byte count`);
    }
    if (normalizedEntries.length === 1 && normalizedEntries[0].sha256 !== artifactSha256) {
      throw new Error(`${label} single chunk checksum did not match artifact SHA-256`);
    }
    const chunkListText = normalizedEntries.map((chunk) => [
      chunk.index,
      chunk.offset,
      chunk.byte_count,
      chunk.sha256
    ].join("=")).join("\n");
    const chunkListSha256 = await sha256Text(`${chunkListText}\n`);
    const expectedChunkListSha256 = requireShareMetadataSha(chunks.chunk_list_sha256, `${label} chunk list`);
    if (chunkListSha256 !== expectedChunkListSha256) {
      throw new Error(`${label} chunk list checksum did not match entries`);
    }
    const merkleRoot = await merkleRootSha256(normalizedEntries);
    const expectedMerkleRoot = requireShareMetadataSha(chunks.merkle_root_sha256, `${label} Merkle root`);
    if (merkleRoot !== expectedMerkleRoot) {
      throw new Error(`${label} Merkle root did not match entries`);
    }
    return {
      chunkCount,
      chunkSize,
      chunkListSha256,
      merkleRootSha256: merkleRoot
    };
  }

  function validateShareMetadataTransfer(offer, mode, label) {
    const transfer = requireShareMetadataObject(offer.transfer, `${label} transfer`);
    requireFalseMetadataFlag(transfer, "project_server_serves_model_bytes", `${label} transfer`);
    requireFalseMetadataFlag(transfer, "project_server_runs_model_bytes", `${label} transfer`);
    if (transfer.network_transfer_available !== false) {
      throw new Error(`${label} transfer must declare network_transfer_available=false`);
    }
    const protocols = Array.isArray(transfer.protocols) ? transfer.protocols.map(catalogText) : [];
    if (!mode.shareKitReady) {
      if (
        catalogText(offer.offer_status) !== "metadata-ready-transfer-not-implemented" ||
        transfer.local_share_kit_available !== false ||
        transfer.serve_helper_available !== false ||
        protocols.length
      ) {
        throw new Error(`${label} metadata-only transfer profile was invalid`);
      }
      return;
    }
    if (
      catalogText(offer.offer_status) !== "local-share-kit-ready-known-peer-needed" ||
      transfer.local_share_kit_available !== true ||
      transfer.serve_helper_available !== true ||
      !protocols.includes("minimodel-prepare-peer-share-v0") ||
      !protocols.includes("known-direct-http-peer-v0") ||
      !protocols.includes("minimodel-peer-companion-v0")
    ) {
      throw new Error(`${label} share-kit transfer profile was invalid`);
    }
  }

  function validateShareKitDescriptor(bundle, mode, label) {
    if (!mode.shareKitReady) {
      if (Object.prototype.hasOwnProperty.call(bundle, "share_kit")) {
        throw new Error(`${label} metadata-only bundle must not include share_kit`);
      }
      return;
    }
    const shareKit = requireShareMetadataObject(bundle.share_kit, `${label} share_kit`);
    if (
      catalogText(shareKit.kit_kind) !== "tinyrustlm.local_p2p_share_kit.v0" ||
      catalogText(shareKit.kit_status) !== "script-ready-known-peer-needed" ||
      shareKit.prepares_peer_pieces !== true ||
      shareKit.writes_catalog_snapshot !== true ||
      shareKit.writes_import_receipt_ledger !== true ||
      shareKit.writes_peer_companion_state_when_known_peer_set !== true ||
      shareKit.writes_peer_contact_card_when_known_peer_set !== true ||
      shareKit.writes_peer_contact_book_when_known_peer_set !== true ||
      shareKit.writes_peer_companion_inventory_when_known_peer_set !== true ||
      shareKit.serve_helper_available !== true
    ) {
      throw new Error(`${label} share_kit descriptor was invalid`);
    }
    requireFalseMetadataFlag(shareKit, "project_server_serves_model_bytes", `${label} share_kit`);
    requireFalseMetadataFlag(shareKit, "project_server_runs_model_bytes", `${label} share_kit`);
  }

  async function catalogEntryFromShareMetadataBundle(bundle, sourceLabel) {
    requireShareMetadataObject(bundle, sourceLabel);
    if (catalogText(bundle.bundle_kind) !== "minimodel.local_slm_share_metadata.v0") {
      throw new Error(`${sourceLabel} bundle kind was unsupported`);
    }
    assertMetadataOnlyCatalogBoundary(bundle, sourceLabel);
    const mode = shareMetadataModeFromBundle(bundle, sourceLabel);
    const rawEntry = {
      ...requireShareMetadataObject(bundle.catalog_entry, `${sourceLabel} catalog_entry`)
    };
    const offer = requireShareMetadataObject(bundle.peer_offer, `${sourceLabel} peer_offer`);
    assertMetadataOnlyCatalogBoundary(rawEntry, `${sourceLabel} catalog_entry`);
    assertMetadataOnlyCatalogBoundary(offer, `${sourceLabel} peer_offer`);
    if (catalogText(offer.offer_kind) !== "minimodel.peer_offer.v0") {
      throw new Error(`${sourceLabel} peer offer kind was unsupported`);
    }
    if (catalogText(offer.artifact_kind).toLowerCase() !== "slm") {
      throw new Error(`${sourceLabel} peer offer artifact kind was unsupported`);
    }
    const artifactByteCount = requireShareMetadataInteger(rawEntry.artifact_byte_count, `${sourceLabel} artifact byte count`);
    const offerByteCount = requireShareMetadataInteger(offer.artifact_byte_count, `${sourceLabel} peer offer artifact byte count`);
    if (artifactByteCount !== offerByteCount) {
      throw new Error(`${sourceLabel} peer offer byte count did not match catalog entry`);
    }
    const artifactSha256 = requireShareMetadataSha(rawEntry.artifact_sha256, `${sourceLabel} artifact`);
    const offerSha256 = requireShareMetadataSha(offer.artifact_sha256, `${sourceLabel} peer offer artifact`);
    if (artifactSha256 !== offerSha256) {
      throw new Error(`${sourceLabel} peer offer SHA-256 did not match catalog entry`);
    }
    const chunkSummary = await validateShareMetadataChunks(
      offer.chunks,
      artifactByteCount,
      artifactSha256,
      sourceLabel
    );
    validateShareMetadataTransfer(offer, mode, sourceLabel);
    validateShareKitDescriptor(bundle, mode, sourceLabel);
    const catalogRaw = {
      ...rawEntry,
      artifact_sha256: artifactSha256,
      artifact_byte_count: artifactByteCount,
      peer_hint_status: mode.peerHintStatus,
      peer_import_status: "",
      required_next_gate: mode.requiredNextGate,
      share_metadata_status: mode.status,
      share_metadata_peer_transfer_implementation: mode.implementation,
      share_metadata_chunk_count: chunkSummary.chunkCount,
      share_metadata_chunk_list_sha256: chunkSummary.chunkListSha256,
      share_metadata_merkle_root_sha256: chunkSummary.merkleRootSha256,
      share_metadata_local_share_kit_available: mode.shareKitReady,
      project_server_serves_model_bytes: false,
      project_server_runs_model_bytes: false,
      artifact_project_server_url: null
    };
    delete catalogRaw.peer_offer_route;
    delete catalogRaw.peer_offer_path;
    delete catalogRaw.peer_offer_sha256;
    delete catalogRaw.peer_offer_checksum;
    delete catalogRaw.peer_offer_kind;
    delete catalogRaw.peer_offer_chunk_algorithm;
    delete catalogRaw.peer_offer_chunk_size;
    delete catalogRaw.peer_offer_chunk_count;
    delete catalogRaw.peer_offer_merkle_root_sha256;
    return {
      ...catalogEntryFromRaw(catalogRaw, 0, ""),
      shareMetadataStatus: mode.status,
      shareMetadataImplementation: mode.implementation,
      shareMetadataChunkCount: chunkSummary.chunkCount,
      shareMetadataMerkleRootSha256: chunkSummary.merkleRootSha256,
      shareMetadataLocalShareKitAvailable: mode.shareKitReady
    };
  }

  function selectedShareMetadataFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.shareMetadataFile && el.shareMetadataFile.files && el.shareMetadataFile.files[0]) {
      return el.shareMetadataFile.files[0];
    }
    if (el.simpleShareMetadataFile && el.simpleShareMetadataFile.files && el.simpleShareMetadataFile.files[0]) {
      return el.simpleShareMetadataFile.files[0];
    }
    return null;
  }

  async function importShareMetadataFile(preferredInput) {
    const file = selectedShareMetadataFile(preferredInput);
    if (!file) {
      throw new Error("Choose a MiniModel share metadata JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Share metadata file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Share metadata exceeded browser metadata budget");
    }
    clearCatalogResults();
    const fileName = safeLocalModelName(file.name);
    setCatalogStatus(`reading share metadata ${fileName}`, false);
    const body = JSON.parse(await file.text());
    const entry = await catalogEntryFromShareMetadataBundle(body, fileName);
    state.catalogEntries = [entry];
    state.defaultCatalogCheckedForAvailability = false;
    renderCatalogResults(state.catalogEntries);
    selectCatalogEntry(entry);
    setCatalogStatus(`1 share metadata entry from ${fileName}; ${entry.peerHintStatus}`, false);
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

  function isPeerSourceAnnouncementFeedBody(body) {
    return Boolean(
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (
        Array.isArray(body.announcements) ||
        Object.prototype.hasOwnProperty.call(body, "announcement_catalog_kind") ||
        Object.prototype.hasOwnProperty.call(body, "announcement_catalog_version")
      )
    );
  }

  function requireFalseMetadataFlag(raw, key, label) {
    if (!raw || raw[key] !== false) {
      throw new Error(`${label} must declare ${key}=false`);
    }
  }

  function validatePeerSourceAnnouncementFeedEnvelope(body, sourceLabel) {
    if (catalogInteger(body.announcement_catalog_version) !== 0) {
      throw new Error(`${sourceLabel} announcement catalog version was unsupported`);
    }
    if (catalogText(body.announcement_catalog_kind) !== "minimodel.peer_source_announcement_catalog") {
      throw new Error(`${sourceLabel} announcement catalog kind was unsupported`);
    }
    requireFalseMetadataFlag(body, "project_server_serves_model_bytes", sourceLabel);
    requireFalseMetadataFlag(body, "project_server_runs_model_bytes", sourceLabel);
    requireFalseMetadataFlag(body, "project_server_proxies_model_bytes", sourceLabel);
    if (!Array.isArray(body.announcements)) {
      throw new Error(`${sourceLabel} announcement catalog must include an announcements array`);
    }
    if (body.announcements.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed too many peer-source announcements`);
    }
    return body.announcements;
  }

  function peerSourceAnnouncementsFromBody(body, sourceLabel) {
    const rawAnnouncements = Array.isArray(body)
      ? body
      : isPeerSourceAnnouncementFeedBody(body)
        ? validatePeerSourceAnnouncementFeedEnvelope(body, sourceLabel)
        : [body];
    if (rawAnnouncements.length > catalogMaxEntries) {
      throw new Error(`${sourceLabel} listed too many peer-source announcements`);
    }
    const announcements = rawAnnouncements.map((announcement, index) => (
      peerSourceAnnouncementFromRaw(announcement, index)
    ));
    const seen = new Set();
    for (const announcement of announcements) {
      const key = `${announcement.modelId}|${announcement.peerSource.peerBaseUrl}`;
      if (seen.has(key)) {
        throw new Error(`${sourceLabel} duplicated model id and peer URL in peer-source announcements`);
      }
      seen.add(key);
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

  function selectedPeerContactCardFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerContactCardFile && el.peerContactCardFile.files && el.peerContactCardFile.files[0]) {
      return el.peerContactCardFile.files[0];
    }
    if (el.simplePeerContactCardFile && el.simplePeerContactCardFile.files && el.simplePeerContactCardFile.files[0]) {
      return el.simplePeerContactCardFile.files[0];
    }
    return null;
  }

  function selectedPeerContactBookFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerContactBookFile && el.peerContactBookFile.files && el.peerContactBookFile.files[0]) {
      return el.peerContactBookFile.files[0];
    }
    if (el.simplePeerContactBookFile && el.simplePeerContactBookFile.files && el.simplePeerContactBookFile.files[0]) {
      return el.simplePeerContactBookFile.files[0];
    }
    return null;
  }

  async function applyPeerContactCardFile(preferredInput) {
    const file = selectedPeerContactCardFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer contact card JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer contact card file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer contact card exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    updatePeerUrlStatus(`reading peer contact card ${fileName}`, false);
    const body = JSON.parse(await file.text());
    const card = peerContactCardFromRaw(body, fileName);
    setPeerBaseUrl(card.peerBaseUrl);
    updatePeerUrlStatus(`Known peer card loaded: ${card.peerLabel} (${card.peerBaseUrl})`, false);
    setCatalogStatus(`Peer contact card loaded from ${fileName}; known peer is ${card.peerBaseUrl}`, false);
  }

  async function applyPeerContactBookFile(preferredInput) {
    const file = selectedPeerContactBookFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer contact book JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer contact book file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer contact book exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    updatePeerUrlStatus(`reading peer contact book ${fileName}`, false);
    const body = JSON.parse(await file.text());
    const book = await peerContactBookFromRaw(body, fileName);
    state.peerContactBookPeers = book.peers;
    state.peerContactBookSourceName = fileName;
    setPeerBaseUrl(book.firstPeerBaseUrl, { keepPeerContactBook: true });
    const peerText = book.contactCount === 1 ? "1 peer" : `${book.contactCount} peers`;
    updatePeerUrlStatus(
      `Known peer book loaded: ${peerText}; using ${book.firstPeerLabel} (${book.firstPeerBaseUrl}); Rust reverify required`,
      false
    );
    setCatalogStatus(
      `Peer contact book loaded from ${fileName}; ${peerText}; known peer is ${book.firstPeerBaseUrl}`,
      false
    );
  }

  async function applyPeerSourceAnnouncementFile(preferredInput) {
    const file = selectedPeerAnnouncementFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer-source announcement or feed JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer-source announcement/feed file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer-source announcement/feed exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setCatalogStatus(`reading peer-source announcement/feed ${fileName}`, false);
    const text = await file.text();
    const body = JSON.parse(text);
    const announcements = peerSourceAnnouncementsFromBody(body, fileName);
    if (!announcements.length) {
      setCatalogStatus(`0 peer-source announcements found in ${fileName}`, false);
      return;
    }
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
    let emptyFeedCount = 0;
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
      if (!announcements.length) {
        emptyFeedCount += 1;
        continue;
      }
      const result = applyPeerSourceAnnouncements(announcements);
      appliedCount += result.appliedCount;
      duplicateCount += result.duplicateCount;
    }
    return { routeCount: routes.length, appliedCount, duplicateCount, emptyFeedCount };
  }

  function setImportReceiptLedgerStatus(text, isError) {
    const targetText = text || "receipt ledger optional";
    for (const node of [el.receiptLedgerStatus, el.simpleImportReceiptLedgerStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function selectedImportReceiptLedgerFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.importReceiptLedgerFile && el.importReceiptLedgerFile.files && el.importReceiptLedgerFile.files[0]) {
      return el.importReceiptLedgerFile.files[0];
    }
    if (el.simpleImportReceiptLedgerFile && el.simpleImportReceiptLedgerFile.files && el.simpleImportReceiptLedgerFile.files[0]) {
      return el.simpleImportReceiptLedgerFile.files[0];
    }
    return null;
  }

  function requireImportLedgerObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return value;
  }

  function requireImportLedgerString(value, label, maxLength = 512) {
    if (typeof value !== "string" || !value || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`${label} was invalid`);
    }
    return value;
  }

  function requireImportLedgerPathHint(value, label) {
    const text = requireImportLedgerString(value, label, 1024);
    if (!text.trim() || text.includes("://")) {
      throw new Error(`${label} must be a local path hint`);
    }
    return text;
  }

  function requireImportLedgerSha(value, label) {
    const sha256 = normalizeCatalogSha256(value);
    if (!sha256) {
      throw new Error(`${label} must be a sha256 digest`);
    }
    return sha256;
  }

  function requireImportLedgerInteger(value, label, options = {}) {
    const parsed = catalogInteger(value);
    const minimum = options.minimum === undefined ? 0 : options.minimum;
    if (parsed === null || parsed < minimum) {
      throw new Error(`${label} was invalid`);
    }
    return parsed;
  }

  function requireImportLedgerBool(value, label, expected) {
    if (typeof value !== "boolean") {
      throw new Error(`${label} must be a boolean`);
    }
    if (expected !== undefined && value !== expected) {
      throw new Error(`${label} must be ${expected}`);
    }
    return value;
  }

  function optionalImportLedgerString(value, label, maxLength = 512) {
    if (value === null || value === undefined) {
      return null;
    }
    return requireImportLedgerString(value, label, maxLength);
  }

  function optionalImportLedgerSha(value, label) {
    if (value === null || value === undefined) {
      return null;
    }
    return requireImportLedgerSha(value, label);
  }

  function optionalImportLedgerInteger(value, label, options = {}) {
    if (value === null || value === undefined) {
      return null;
    }
    return requireImportLedgerInteger(value, label, options);
  }

  function validateImportReceiptLedgerBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.contains_model_bytes, `${label}.contains_model_bytes`, false);
    requireImportLedgerBool(object.contains_peer_piece_bytes, `${label}.contains_peer_piece_bytes`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_huggingface_bytes, `${label}.project_server_proxies_huggingface_bytes`, false);
    requireImportLedgerBool(object.local_companion_receipt_index, `${label}.local_companion_receipt_index`, true);
    requireImportLedgerBool(object.rust_reverify_required_before_trust, `${label}.rust_reverify_required_before_trust`, true);
  }

  function validateImportReceiptLedgerEntry(entry, index) {
    const label = `Import receipt ledger entry ${index}`;
    const object = requireImportLedgerObject(entry, label);
    const entryIndex = requireImportLedgerInteger(object.entry_index, `${label}.entry_index`);
    if (entryIndex !== index) {
      throw new Error(`${label}.entry_index was ${entryIndex}, expected ${index}`);
    }
    if (catalogText(object.entry_kind) !== "minimodel.import_receipt_ledger_entry.v0") {
      throw new Error(`${label}.entry_kind was unsupported`);
    }
    const receiptPath = requireImportLedgerPathHint(object.receipt_path, `${label}.receipt_path`);
    const manifestPath = requireImportLedgerPathHint(object.manifest_path, `${label}.manifest_path`);
    const artifactPath = requireImportLedgerPathHint(object.artifact_path, `${label}.artifact_path`);
    const receiptSha256 = requireImportLedgerSha(object.receipt_sha256, `${label}.receipt_sha256`);
    const manifestSha256 = requireImportLedgerSha(object.manifest_sha256, `${label}.manifest_sha256`);
    const artifactSha256 = requireImportLedgerSha(object.artifact_sha256, `${label}.artifact_sha256`);
    const artifactByteCount = requireImportLedgerInteger(object.artifact_byte_count, `${label}.artifact_byte_count`, { minimum: 1 });
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    requireImportLedgerString(object.slm_model_shape, `${label}.slm_model_shape`, 512);
    const quantization = requireImportLedgerString(object.slm_quantization, `${label}.slm_quantization`, 64);
    if (!/^[A-Za-z0-9._-]+$/.test(quantization)) {
      throw new Error(`${label}.slm_quantization was invalid`);
    }
    const peerImport = requireImportLedgerBool(object.peer_import, `${label}.peer_import`);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_huggingface_bytes, `${label}.project_server_proxies_huggingface_bytes`, false);
    if (peerImport) {
      if (object.receiver_validation_contract_status !== "validated") {
        throw new Error(`${label}.receiver_validation_contract_status was ${object.receiver_validation_contract_status}`);
      }
      requireImportLedgerBool(object.check_peer_status_before_piece_fetch, `${label}.check_peer_status_before_piece_fetch`, true);
      requireImportLedgerBool(object.preflight_fetches_piece_set_before_pieces, `${label}.preflight_fetches_piece_set_before_pieces`, true);
      requireImportLedgerBool(object.validate_advertised_companion_state_before_piece_fetch, `${label}.validate_advertised_companion_state_before_piece_fetch`, true);
      requireImportLedgerBool(object.import_receipt_required_before_browser_load, `${label}.import_receipt_required_before_browser_load`, true);
      const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
      const companionStateStatus = requireImportLedgerString(object.companion_state_status, `${label}.companion_state_status`, 96);
      if (!["validated", "not-advertised"].includes(companionStateStatus)) {
        throw new Error(`${label}.companion_state_status was ${companionStateStatus}`);
      }
      const pieceCount = requireImportLedgerInteger(object.piece_count, `${label}.piece_count`, { minimum: 1 });
      const merkleRootSha256 = requireImportLedgerSha(object.merkle_root_sha256, `${label}.merkle_root_sha256`);
      requireImportLedgerBool(object.peer_piece_bytes_fetched, `${label}.peer_piece_bytes_fetched`, true);
      requireImportLedgerBool(object.artifact_assembled_from_peer_pieces, `${label}.artifact_assembled_from_peer_pieces`, true);
      return {
        receiptPath,
        manifestPath,
        artifactPath,
        receiptSha256,
        manifestSha256,
        artifactSha256,
        artifactByteCount,
        modelId,
        quantization,
        peerImport,
        peerBaseUrl,
        companionStateStatus,
        pieceCount,
        merkleRootSha256,
        receiverValidationContractStatus: "validated"
      };
    } else {
      const receiverValidationContractStatus = optionalImportLedgerString(object.receiver_validation_contract_status, `${label}.receiver_validation_contract_status`, 96);
      const peerBaseUrl = optionalImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256);
      const companionStateStatus = optionalImportLedgerString(object.companion_state_status, `${label}.companion_state_status`, 96);
      const pieceCount = optionalImportLedgerInteger(object.piece_count, `${label}.piece_count`, { minimum: 1 });
      const merkleRootSha256 = optionalImportLedgerSha(object.merkle_root_sha256, `${label}.merkle_root_sha256`);
      requireImportLedgerBool(object.peer_piece_bytes_fetched, `${label}.peer_piece_bytes_fetched`, false);
      requireImportLedgerBool(object.artifact_assembled_from_peer_pieces, `${label}.artifact_assembled_from_peer_pieces`, false);
      return {
        receiptPath,
        manifestPath,
        artifactPath,
        receiptSha256,
        manifestSha256,
        artifactSha256,
        artifactByteCount,
        modelId,
        quantization,
        peerImport,
        peerBaseUrl,
        companionStateStatus,
        pieceCount,
        merkleRootSha256,
        receiverValidationContractStatus
      };
    }
  }

  function validateImportReceiptLedgerBody(body, ledgerSha256, sourceLabel) {
    const label = sourceLabel || "Import receipt ledger";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.ledger_kind) !== "minimodel.import_receipt_ledger.v0") {
      throw new Error(`${label} kind was unsupported`);
    }
    if (catalogInteger(object.ledger_version) !== 1) {
      throw new Error(`${label} version was unsupported`);
    }
    const generatedAt = requireImportLedgerString(object.generated_at, `${label}.generated_at`, 32);
    if (!isStrictMiniModelUtcTimestamp(generatedAt)) {
      throw new Error(`${label}.generated_at was invalid`);
    }
    const entryCount = requireImportLedgerInteger(object.entry_count, `${label}.entry_count`, { minimum: 1 });
    const peerImportCount = requireImportLedgerInteger(object.peer_import_count, `${label}.peer_import_count`);
    const modelCount = requireImportLedgerInteger(object.model_count, `${label}.model_count`, { minimum: 1 });
    validateImportReceiptLedgerBoundary(object.boundary, `${label}.boundary`);
    if (!Array.isArray(object.entries) || object.entries.length > catalogMaxEntries) {
      throw new Error(`${label} entries were invalid`);
    }
    if (object.entries.length !== entryCount) {
      throw new Error(`${label}.entry_count was ${entryCount}, expected ${object.entries.length}`);
    }
    const seenReceipts = new Set();
    const seenModels = new Set();
    let actualPeerImportCount = 0;
    const entries = object.entries.map((entry, index) => {
      const parsed = validateImportReceiptLedgerEntry(entry, index);
      const receiptKey = parsed.receiptPath.toLowerCase();
      if (seenReceipts.has(receiptKey)) {
        throw new Error(`Import receipt ledger entry ${index}.receipt_path was duplicated`);
      }
      seenReceipts.add(receiptKey);
      seenModels.add(parsed.modelId);
      if (parsed.peerImport) {
        actualPeerImportCount += 1;
      }
      return parsed;
    });
    if (actualPeerImportCount !== peerImportCount) {
      throw new Error(`${label}.peer_import_count was ${peerImportCount}, expected ${actualPeerImportCount}`);
    }
    if (seenModels.size !== modelCount) {
      throw new Error(`${label}.model_count was ${modelCount}, expected ${seenModels.size}`);
    }
    return {
      sourceLabel: label,
      ledgerSha256,
      generatedAt,
      entryCount,
      peerImportCount,
      modelCount,
      entries
    };
  }

  function importReceiptLedgerStatusText(ledger) {
    if (!ledger) {
      return "receipt ledger optional";
    }
    const entryText = `${ledger.entryCount} entr${ledger.entryCount === 1 ? "y" : "ies"}`;
    const peerText = `${ledger.peerImportCount} peer import${ledger.peerImportCount === 1 ? "" : "s"}`;
    const modelText = `${ledger.modelCount} model${ledger.modelCount === 1 ? "" : "s"}`;
    return `Receipt ledger loaded: ${ledger.sourceLabel} / ${entryText} / ${peerText} / ${modelText} / ${ledger.ledgerSha256} / Rust reverify required`;
  }

  function renderImportReceiptLedgerEntriesIn(container) {
    if (!container) {
      return;
    }
    const ledger = state.importReceiptLedger;
    const entries = ledger && Array.isArray(ledger.entries) ? ledger.entries : [];
    container.replaceChildren();
    container.hidden = entries.length === 0;
    if (!entries.length) {
      return;
    }
    entries.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "receipt-ledger-entry";
      item.setAttribute("role", "listitem");

      const header = document.createElement("div");
      header.className = "receipt-ledger-entry-header";
      const title = elementWithText("strong", "", entry.modelId);
      const kind = elementWithText(
        "span",
        entry.peerImport ? "receipt-ledger-kind peer" : "receipt-ledger-kind local",
        entry.peerImport ? "Peer import" : "Local import"
      );
      header.append(title, kind);

      const facts = document.createElement("dl");
      facts.className = "receipt-ledger-entry-facts";
      const addFact = (term, value) => {
        if (value === null || value === undefined || value === "") {
          return;
        }
        facts.append(
          elementWithText("dt", "", term),
          elementWithText("dd", "", String(value))
        );
      };

      addFact("Receipt", safeLocalPathLeaf(entry.receiptPath, `receipt-${index + 1}`));
      addFact("Artifact", `${safeLocalPathLeaf(entry.artifactPath, "artifact.slm")} / ${formatByteCount(entry.artifactByteCount)} / ${entry.quantization}`);
      addFact("Artifact SHA-256", shortSha256(entry.artifactSha256));
      addFact("Receipt SHA-256", shortSha256(entry.receiptSha256));
      if (entry.peerImport) {
        addFact("Peer", entry.peerBaseUrl);
        addFact("Receiver", entry.receiverValidationContractStatus || "validated");
        addFact("Companion", entry.companionStateStatus);
        addFact("Pieces", `${entry.pieceCount} / ${shortSha256(entry.merkleRootSha256)}`);
      }

      item.append(header, facts);
      container.append(item);
    });
  }

  function renderImportReceiptLedgerEntries() {
    renderImportReceiptLedgerEntriesIn(el.simpleImportReceiptLedgerEntries);
    renderImportReceiptLedgerEntriesIn(el.importReceiptLedgerEntries);
  }

  async function importReceiptLedgerFile(preferredInput) {
    const file = selectedImportReceiptLedgerFile(preferredInput);
    if (!file) {
      throw new Error("Choose an import receipt ledger JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Import receipt ledger file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Import receipt ledger exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    state.importReceiptLedger = null;
    renderImportReceiptLedgerEntries();
    setImportReceiptLedgerStatus(`reading import receipt ledger ${fileName}`, false);
    const text = await file.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Import receipt ledger exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const ledger = validateImportReceiptLedgerBody(body, await sha256Text(text), fileName);
    state.importReceiptLedger = ledger;
    renderImportReceiptLedgerEntries();
    setImportReceiptLedgerStatus(importReceiptLedgerStatusText(ledger), false);
    return ledger;
  }

  function setPeerStatusCheckStatus(text, isError) {
    const targetText = text || "peer status optional";
    for (const node of [el.peerStatusCheckStatus, el.simplePeerStatusCheckStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function selectedPeerStatusCheckFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerStatusCheckFile && el.peerStatusCheckFile.files && el.peerStatusCheckFile.files[0]) {
      return el.peerStatusCheckFile.files[0];
    }
    if (el.simplePeerStatusCheckFile && el.simplePeerStatusCheckFile.files && el.simplePeerStatusCheckFile.files[0]) {
      return el.simplePeerStatusCheckFile.files[0];
    }
    return null;
  }

  function validatePeerStatusCheckBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.peer_piece_bytes_fetched, `${label}.peer_piece_bytes_fetched`, false);
    requireImportLedgerBool(object.artifact_bytes_fetched, `${label}.artifact_bytes_fetched`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    requireImportLedgerBool(object.requires_rust_reverify_before_browser_import, `${label}.requires_rust_reverify_before_browser_import`, true);
  }

  function validatePeerStatusCheckBody(body, reportSha256, sourceLabel) {
    const label = sourceLabel || "Peer status check";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.check_kind) !== "minimodel.peer_status_check") {
      throw new Error(`${label}.check_kind was unsupported`);
    }
    if (catalogInteger(object.check_version) !== 0) {
      throw new Error(`${label}.check_version was unsupported`);
    }
    const checkedAt = requireImportLedgerString(object.checked_utc, `${label}.checked_utc`, 32);
    if (!isStrictMiniModelUtcTimestamp(checkedAt)) {
      throw new Error(`${label}.checked_utc was invalid`);
    }
    const status = requireImportLedgerString(object.status, `${label}.status`, 64);
    if (status !== "validated") {
      throw new Error(`${label}.status was unsupported`);
    }
    const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    const statusUrl = requireImportLedgerString(object.status_url, `${label}.status_url`, 512);
    const expectedStatusUrl = new URL(peerStatusRoute, peerBaseUrl).href;
    if (statusUrl !== expectedStatusUrl) {
      throw new Error(`${label}.status_url did not match peer_base_url and ${peerStatusRoute}`);
    }
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    const routes = requireImportLedgerObject(object.routes, `${label}.routes`);
    if (requireImportLedgerString(routes.peer_status, `${label}.routes.peer_status`, 128) !== peerStatusRoute) {
      throw new Error(`${label}.routes.peer_status was unsupported`);
    }
    if (requireImportLedgerString(routes.peer_piece_set, `${label}.routes.peer_piece_set`, 128) !== peerPieceSetRoute) {
      throw new Error(`${label}.routes.peer_piece_set was unsupported`);
    }
    const companionStateRoute = requireImportLedgerString(routes.peer_companion_state, `${label}.routes.peer_companion_state`, 128);
    if (companionStateRoute !== peerCompanionStateRoute && companionStateRoute !== "not-advertised") {
      throw new Error(`${label}.routes.peer_companion_state was unsupported`);
    }
    const manifest = requireImportLedgerObject(object.manifest, `${label}.manifest`);
    const manifestSha256 = requireImportLedgerSha(manifest.sha256, `${label}.manifest.sha256`);
    const artifact = requireImportLedgerObject(object.artifact, `${label}.artifact`);
    if (requireImportLedgerString(artifact.kind, `${label}.artifact.kind`, 32) !== "slm") {
      throw new Error(`${label}.artifact.kind was unsupported`);
    }
    const artifactByteCount = requireImportLedgerInteger(artifact.byte_count, `${label}.artifact.byte_count`, { minimum: 1 });
    const artifactSha256 = requireImportLedgerSha(artifact.sha256, `${label}.artifact.sha256`);
    const pieces = requireImportLedgerObject(object.pieces, `${label}.pieces`);
    const pieceSetSha256 = requireImportLedgerSha(pieces.piece_set_sha256, `${label}.pieces.piece_set_sha256`);
    const pieceCount = requireImportLedgerInteger(pieces.piece_count, `${label}.pieces.piece_count`, { minimum: 1 });
    const merkleRootSha256 = requireImportLedgerSha(pieces.merkle_root_sha256, `${label}.pieces.merkle_root_sha256`);
    validatePeerStatusCheckBoundary(object.boundary, `${label}.boundary`);
    return {
      sourceLabel: label,
      reportSha256,
      checkedAt,
      modelId,
      peerBaseUrl,
      statusUrl,
      companionStateRoute,
      manifestSha256,
      artifactByteCount,
      artifactSha256,
      pieceSetSha256,
      pieceCount,
      merkleRootSha256
    };
  }

  function peerStatusCheckStatusText(check) {
    if (!check) {
      return "peer status optional";
    }
    const pieceText = `${check.pieceCount} piece${check.pieceCount === 1 ? "" : "s"}`;
    return `Peer status check loaded: ${check.sourceLabel} / ${check.modelId} / ${pieceText} / ${formatByteCount(check.artifactByteCount)} artifact / ${check.peerBaseUrl} / companion ${check.companionStateRoute} / no peer bytes fetched / ${check.reportSha256} / Rust reverify required`;
  }

  async function importPeerStatusCheckFile(preferredInput) {
    const file = selectedPeerStatusCheckFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer status check JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer status check file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer status check exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setPeerStatusCheckStatus(`reading peer status check ${fileName}`, false);
    const text = await file.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Peer status check exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const check = validatePeerStatusCheckBody(body, await sha256Text(text), fileName);
    state.peerStatusCheck = check;
    setPeerStatusCheckStatus(peerStatusCheckStatusText(check), false);
    return check;
  }

  function setPeerCompanionInventoryStatus(text, isError) {
    const targetText = text || "companion inventory optional";
    for (const node of [el.peerCompanionInventoryStatus, el.simplePeerCompanionInventoryStatus]) {
      if (node) {
        setText(node, targetText, isError);
      }
    }
    if (el.simpleDiscoveryStatus && state.simpleSourceOption === "p2p") {
      el.simpleDiscoveryStatus.textContent = targetText;
      el.simpleDiscoveryStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function selectedPeerCompanionInventoryFile(preferredInput) {
    if (preferredInput && preferredInput.files && preferredInput.files[0]) {
      return preferredInput.files[0];
    }
    if (el.peerCompanionInventoryFile && el.peerCompanionInventoryFile.files && el.peerCompanionInventoryFile.files[0]) {
      return el.peerCompanionInventoryFile.files[0];
    }
    if (el.simplePeerCompanionInventoryFile && el.simplePeerCompanionInventoryFile.files && el.simplePeerCompanionInventoryFile.files[0]) {
      return el.simplePeerCompanionInventoryFile.files[0];
    }
    return null;
  }

  function validatePeerCompanionInventoryBoundary(boundary, label) {
    const object = requireImportLedgerObject(boundary, label);
    requireImportLedgerBool(object.metadata_only, `${label}.metadata_only`, true);
    requireImportLedgerBool(object.user_run_local_software, `${label}.user_run_local_software`, true);
    requireImportLedgerBool(object.inventory_contains_model_bytes, `${label}.inventory_contains_model_bytes`, false);
    requireImportLedgerBool(object.inventory_contains_peer_piece_bytes, `${label}.inventory_contains_peer_piece_bytes`, false);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    requireImportLedgerBool(object.local_piece_store_user_controlled, `${label}.local_piece_store_user_controlled`, true);
    requireImportLedgerBool(object.rust_reverify_required_before_trust, `${label}.rust_reverify_required_before_trust`, true);
    const importGate = requireImportLedgerString(object.tinyrustlm_import_gate, `${label}.tinyrustlm_import_gate`, 160);
    if (!importGate.includes("user-selected-local-slm") && !importGate.includes("user-selected-local")) {
      throw new Error(`${label}.tinyrustlm_import_gate must require a user-selected local .slm`);
    }
  }

  function validatePeerCompanionInventoryShareState(shareState, label, expectedPeerBaseUrl) {
    const object = requireImportLedgerObject(shareState, label);
    const statePath = requireImportLedgerPathHint(object.path, `${label}.path`);
    requireImportLedgerSha(object.sha256, `${label}.sha256`);
    const stateRoute = requireImportLedgerString(object.state_route, `${label}.state_route`, 128);
    if (stateRoute !== "minimodel.peer_companion_state.v0.json") {
      throw new Error(`${label}.state_route was unsupported`);
    }
    const manifestPath = requireImportLedgerPathHint(object.manifest_path, `${label}.manifest_path`);
    const manifestSha256 = requireImportLedgerSha(object.manifest_sha256, `${label}.manifest_sha256`);
    const pieceDirPath = requireImportLedgerPathHint(object.piece_dir_path, `${label}.piece_dir_path`);
    if (requireImportLedgerString(object.piece_set_path_hint, `${label}.piece_set_path_hint`, 128) !== "minimodel.peer_piece_set.v0") {
      throw new Error(`${label}.piece_set_path_hint was unsupported`);
    }
    const pieceSetSha256 = requireImportLedgerSha(object.piece_set_sha256, `${label}.piece_set_sha256`);
    const artifactSha256 = requireImportLedgerSha(object.artifact_sha256, `${label}.artifact_sha256`);
    const artifactByteCount = requireImportLedgerInteger(object.artifact_byte_count, `${label}.artifact_byte_count`, { minimum: 1 });
    const pieceCount = requireImportLedgerInteger(object.piece_count, `${label}.piece_count`, { minimum: 1 });
    const merkleRootSha256 = requireImportLedgerSha(object.merkle_root_sha256, `${label}.merkle_root_sha256`);
    return {
      expectedPeerBaseUrl,
      statePath,
      stateRoute,
      manifestPath,
      manifestSha256,
      pieceDirPath,
      pieceSetSha256,
      artifactSha256,
      artifactByteCount,
      pieceCount,
      merkleRootSha256
    };
  }

  function validatePeerCompanionInventoryPieceStore(pieceStore, label, shareState) {
    const object = requireImportLedgerObject(pieceStore, label);
    const directoryPath = requireImportLedgerPathHint(object.directory_path, `${label}.directory_path`);
    if (directoryPath.toLowerCase() !== shareState.pieceDirPath.toLowerCase()) {
      throw new Error(`${label}.directory_path did not match share_state.piece_dir_path`);
    }
    const byteCount = requireImportLedgerInteger(object.piece_store_byte_count, `${label}.piece_store_byte_count`, { minimum: 1 });
    const quotaBytes = requireImportLedgerInteger(object.piece_store_quota_bytes, `${label}.piece_store_quota_bytes`, { minimum: 1 });
    if (byteCount > quotaBytes) {
      throw new Error(`${label}.piece_store_byte_count exceeds quota`);
    }
    const pieceStoreSha256 = requireImportLedgerSha(object.piece_store_sha256, `${label}.piece_store_sha256`);
    if (requireImportLedgerString(object.quota_status, `${label}.quota_status`, 64) !== "within-quota") {
      throw new Error(`${label}.quota_status was not within-quota`);
    }
    requireImportLedgerBool(object.piece_store_user_controlled, `${label}.piece_store_user_controlled`, true);
    return { byteCount, quotaBytes, pieceStoreSha256 };
  }

  function validatePeerCompanionInventoryReceiptLedger(receiptLedger, label) {
    const object = requireImportLedgerObject(receiptLedger, label);
    requireImportLedgerPathHint(object.path, `${label}.path`);
    requireImportLedgerSha(object.sha256, `${label}.sha256`);
    const entryCount = requireImportLedgerInteger(object.entry_count, `${label}.entry_count`, { minimum: 1 });
    const peerImportCount = requireImportLedgerInteger(object.peer_import_count, `${label}.peer_import_count`);
    if (peerImportCount > entryCount) {
      throw new Error(`${label}.peer_import_count exceeded entry_count`);
    }
    requireImportLedgerInteger(object.model_count, `${label}.model_count`, { minimum: 1 });
    requireImportLedgerBool(object.contains_model_id, `${label}.contains_model_id`, true);
    return { entryCount, peerImportCount };
  }

  function validatePeerCompanionInventoryContactCards(contactCards, contactCardCount, peerBaseUrl, label) {
    if (!Array.isArray(contactCards) || contactCards.length > catalogMaxEntries) {
      throw new Error(`${label} were invalid`);
    }
    if (contactCards.length !== contactCardCount) {
      throw new Error(`${label} count was ${contactCardCount}, expected ${contactCards.length}`);
    }
    const seenPaths = new Set();
    for (const [index, card] of contactCards.entries()) {
      const cardLabel = `${label}.${index}`;
      const object = requireImportLedgerObject(card, cardLabel);
      const cardPath = requireImportLedgerPathHint(object.path, `${cardLabel}.path`);
      const cardPathKey = cardPath.toLowerCase();
      if (seenPaths.has(cardPathKey)) {
        throw new Error(`${cardLabel}.path was duplicated`);
      }
      seenPaths.add(cardPathKey);
      requireImportLedgerSha(object.sha256, `${cardLabel}.sha256`);
      requireImportLedgerString(object.peer_label, `${cardLabel}.peer_label`, 120);
      const cardPeerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${cardLabel}.peer_base_url`, 256));
      if (cardPeerBaseUrl !== peerBaseUrl) {
        throw new Error(`${cardLabel}.peer_base_url did not match inventory peer_base_url`);
      }
    }
  }

  function validatePeerCompanionInventoryCommands(commands, label) {
    const object = requireImportLedgerObject(commands, label);
    const requiredCommands = [
      ["inspect_inventory", "inspect-peer-companion-inventory"],
      ["inspect_state", "inspect-peer-companion-state"],
      ["inspect_receipt_ledger", "inspect-import-receipt-ledger"],
      ["serve_peer_companion", "serve-peer-companion"]
    ];
    for (const [field, expectedText] of requiredCommands) {
      const command = requireImportLedgerString(object[field], `${label}.${field}`, 1024);
      if (!command.includes(expectedText)) {
        throw new Error(`${label}.${field} must include ${expectedText}`);
      }
    }
  }

  function validatePeerCompanionInventoryServePlan(servePlan, label, peerBaseUrl, shareState) {
    const object = requireImportLedgerObject(servePlan, label);
    const status = requireImportLedgerString(object.status, `${label}.status`, 96);
    if (status !== "ready-after-rust-reverify") {
      throw new Error(`${label}.status was unsupported`);
    }
    if (requireImportLedgerString(object.transport, `${label}.transport`, 96) !== "direct-http-piece-server-v0") {
      throw new Error(`${label}.transport was unsupported`);
    }
    const planPeerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    if (planPeerBaseUrl !== peerBaseUrl) {
      throw new Error(`${label}.peer_base_url did not match inventory peer_base_url`);
    }
    const peerStatusRoute = requireImportLedgerString(object.peer_status_route, `${label}.peer_status_route`, 128);
    if (peerStatusRoute !== "minimodel.peer_status.v0.json") {
      throw new Error(`${label}.peer_status_route was unsupported`);
    }
    const peerPieceSetRoute = requireImportLedgerString(object.peer_piece_set_route, `${label}.peer_piece_set_route`, 128);
    if (peerPieceSetRoute !== "minimodel.peer_piece_set.v0") {
      throw new Error(`${label}.peer_piece_set_route was unsupported`);
    }
    const peerCompanionStateRoute = requireImportLedgerString(object.peer_companion_state_route, `${label}.peer_companion_state_route`, 128);
    if (peerCompanionStateRoute !== shareState.stateRoute) {
      throw new Error(`${label}.peer_companion_state_route did not match share_state.state_route`);
    }
    const statePath = requireImportLedgerPathHint(object.state_path, `${label}.state_path`);
    if (statePath.toLowerCase() !== shareState.statePath.toLowerCase()) {
      throw new Error(`${label}.state_path did not match share_state.path`);
    }
    const manifestPath = requireImportLedgerPathHint(object.manifest_path, `${label}.manifest_path`);
    if (manifestPath.toLowerCase() !== shareState.manifestPath.toLowerCase()) {
      throw new Error(`${label}.manifest_path did not match share_state.manifest_path`);
    }
    const pieceDirPath = requireImportLedgerPathHint(object.piece_dir_path, `${label}.piece_dir_path`);
    if (pieceDirPath.toLowerCase() !== shareState.pieceDirPath.toLowerCase()) {
      throw new Error(`${label}.piece_dir_path did not match share_state.piece_dir_path`);
    }
    const serveCommand = requireImportLedgerString(object.serve_command, `${label}.serve_command`, 1024);
    if (serveCommand !== "minimodel serve-peer-companion <state-json> <manifest> <piece-dir> <bind-addr>") {
      throw new Error(`${label}.serve_command was unsupported`);
    }
    const expectedPreflightCommands = [
      "minimodel inspect-peer-companion-inventory <inventory-json>",
      "minimodel inspect-peer-companion-state <state-json> <manifest> <piece-dir>",
      "minimodel inspect-import-receipt-ledger <ledger-json>"
    ];
    if (!Array.isArray(object.preflight_commands) || object.preflight_commands.length !== expectedPreflightCommands.length) {
      throw new Error(`${label}.preflight_commands were invalid`);
    }
    expectedPreflightCommands.forEach((expectedCommand, index) => {
      const command = requireImportLedgerString(object.preflight_commands[index], `${label}.preflight_commands.${index}`, 1024);
      if (command !== expectedCommand) {
        throw new Error(`${label}.preflight_commands.${index} was unsupported`);
      }
    });
    requireImportLedgerBool(object.requires_operator_consent, `${label}.requires_operator_consent`, true);
    requireImportLedgerBool(object.requires_loopback_or_direct_peer_url, `${label}.requires_loopback_or_direct_peer_url`, true);
    requireImportLedgerBool(object.rust_reverify_required_before_serving, `${label}.rust_reverify_required_before_serving`, true);
    requireImportLedgerBool(object.project_server_serves_model_bytes, `${label}.project_server_serves_model_bytes`, false);
    requireImportLedgerBool(object.project_server_runs_model_bytes, `${label}.project_server_runs_model_bytes`, false);
    requireImportLedgerBool(object.project_server_proxies_model_bytes, `${label}.project_server_proxies_model_bytes`, false);
    return {
      status,
      peerStatusRoute,
      peerPieceSetRoute,
      peerCompanionStateRoute
    };
  }

  function validatePeerCompanionInventoryBody(body, inventorySha256, sourceLabel) {
    const label = sourceLabel || "Peer companion inventory";
    const object = requireImportLedgerObject(body, label);
    if (catalogText(object.inventory_kind) !== "minimodel.peer_companion_inventory.v0") {
      throw new Error(`${label} kind was unsupported`);
    }
    if (catalogInteger(object.inventory_version) !== 1) {
      throw new Error(`${label} version was unsupported`);
    }
    const generatedAt = requireImportLedgerString(object.generated_at, `${label}.generated_at`, 32);
    if (!isStrictMiniModelUtcTimestamp(generatedAt)) {
      throw new Error(`${label}.generated_at was invalid`);
    }
    const modelId = requireImportLedgerString(object.model_id, `${label}.model_id`, 180);
    if (!isCatalogModelId(modelId)) {
      throw new Error(`${label}.model_id was invalid`);
    }
    const peerBaseUrl = normalizedPeerBaseUrl(requireImportLedgerString(object.peer_base_url, `${label}.peer_base_url`, 256));
    const shareState = validatePeerCompanionInventoryShareState(object.share_state, `${label}.share_state`, peerBaseUrl);
    const pieceStore = validatePeerCompanionInventoryPieceStore(object.piece_store, `${label}.piece_store`, shareState);
    const receiptLedger = validatePeerCompanionInventoryReceiptLedger(object.receipt_ledger, `${label}.receipt_ledger`);
    const contactCardCount = requireImportLedgerInteger(object.contact_card_count, `${label}.contact_card_count`);
    validatePeerCompanionInventoryContactCards(object.contact_cards, contactCardCount, peerBaseUrl, `${label}.contact_cards`);
    validatePeerCompanionInventoryCommands(object.commands, `${label}.commands`);
    const servePlan = validatePeerCompanionInventoryServePlan(object.serve_plan, `${label}.serve_plan`, peerBaseUrl, shareState);
    validatePeerCompanionInventoryBoundary(object.boundary, `${label}.boundary`);
    return {
      sourceLabel: label,
      inventorySha256,
      generatedAt,
      modelId,
      peerBaseUrl,
      servePlanStatus: servePlan.status,
      servePlanPeerStatusRoute: servePlan.peerStatusRoute,
      servePlanPeerPieceSetRoute: servePlan.peerPieceSetRoute,
      pieceCount: shareState.pieceCount,
      pieceStoreByteCount: pieceStore.byteCount,
      pieceStoreSha256: pieceStore.pieceStoreSha256,
      pieceStoreQuotaBytes: pieceStore.quotaBytes,
      receiptEntryCount: receiptLedger.entryCount,
      receiptPeerImportCount: receiptLedger.peerImportCount,
      contactCardCount
    };
  }

  function peerCompanionInventoryStatusText(inventory) {
    if (!inventory) {
      return "companion inventory optional";
    }
    const pieceText = `${inventory.pieceCount} piece${inventory.pieceCount === 1 ? "" : "s"}`;
    const receiptText = `${inventory.receiptEntryCount} receipt${inventory.receiptEntryCount === 1 ? "" : "s"}`;
    const contactText = `${inventory.contactCardCount} contact card${inventory.contactCardCount === 1 ? "" : "s"}`;
    return `Peer companion inventory loaded: ${inventory.sourceLabel} / ${inventory.modelId} / ${pieceText} / ${formatByteCount(inventory.pieceStoreByteCount)} store of ${formatByteCount(inventory.pieceStoreQuotaBytes)} quota / store ${inventory.pieceStoreSha256} / peer ${inventory.peerBaseUrl} / ${receiptText} / ${contactText} / serve plan ${inventory.servePlanStatus} / status route ${inventory.servePlanPeerStatusRoute} / ${inventory.inventorySha256} / Rust reverify required`;
  }

  async function importPeerCompanionInventoryFile(preferredInput) {
    const file = selectedPeerCompanionInventoryFile(preferredInput);
    if (!file) {
      throw new Error("Choose a peer companion inventory JSON file");
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error("Peer companion inventory file is empty");
    }
    if (file.size > catalogTextByteBudget) {
      throw new Error("Peer companion inventory exceeded browser metadata budget");
    }
    const fileName = safeLocalModelName(file.name);
    setPeerCompanionInventoryStatus(`reading peer companion inventory ${fileName}`, false);
    const text = await file.text();
    if (state.encoder.encode(text).length > catalogTextByteBudget) {
      throw new Error("Peer companion inventory exceeded browser metadata budget");
    }
    const body = JSON.parse(text);
    const inventory = validatePeerCompanionInventoryBody(body, await sha256Text(text), fileName);
    state.peerCompanionInventory = inventory;
    setPeerBaseUrl(inventory.peerBaseUrl, { keepPeerContactBook: true });
    updatePeerUrlStatus(`Peer companion inventory loaded: known peer set to ${inventory.peerBaseUrl}; Rust reverify required`, false);
    setPeerCompanionInventoryStatus(peerCompanionInventoryStatusText(inventory), false);
    return inventory;
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

  function localModelSelectedFiles() {
    const files = Array.from(el.localModelFile && el.localModelFile.files ? el.localModelFile.files : []);
    const slms = files.filter((file) => /\.slm$/i.test(safeLocalModelName(file.name)));
    const receipts = files.filter((file) => /\.minimodel-receipt$/i.test(safeLocalModelName(file.name)));
    return {
      files,
      slms,
      receipts,
      slm: slms.length === 1 ? slms[0] : null,
      receipt: receipts.length === 1 ? receipts[0] : null
    };
  }

  function localModelSelectionError(selectedFiles) {
    if (selectedFiles.slms.length > 1) {
      return "Choose exactly one local .slm file";
    }
    if (selectedFiles.receipts.length > 1) {
      return "Choose at most one MiniModel receipt sidecar";
    }
    if (selectedFiles.files.length > 0 && selectedFiles.slms.length === 0) {
      return `${selectedFiles.files.length} file(s) selected / choose one .slm file`;
    }
    return "";
  }

  function requireMiniModelReceiptBool(fields, key, expected) {
    const actual = requireManifestField(fields, key, "MiniModel import receipt");
    if (actual !== "true" && actual !== "false") {
      throw new Error(`MiniModel import receipt field ${key} was ${actual}`);
    }
    const parsed = actual === "true";
    if (parsed !== expected) {
      throw new Error(`MiniModel import receipt field ${key} was ${actual}`);
    }
    return parsed;
  }

  function requireMiniModelReceiptSha(fields, key) {
    const value = normalizeCatalogSha256(requireManifestField(fields, key, "MiniModel import receipt"));
    if (!value) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptOptionalBool(fields, key, expected) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      return null;
    }
    return requireMiniModelReceiptBool(fields, key, expected);
  }

  function isMiniModelReceiptLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function miniModelReceiptDaysInMonth(year, month) {
    if ([1, 3, 5, 7, 8, 10, 12].includes(month)) {
      return 31;
    }
    if ([4, 6, 9, 11].includes(month)) {
      return 30;
    }
    if (month === 2) {
      return isMiniModelReceiptLeapYear(year) ? 29 : 28;
    }
    return 0;
  }

  function isStrictMiniModelUtcTimestamp(value) {
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z$/.exec(String(value || ""));
    if (!match) {
      return false;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    const hour = Number.parseInt(match[4], 10);
    const minute = Number.parseInt(match[5], 10);
    const second = Number.parseInt(match[6], 10);
    return (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= miniModelReceiptDaysInMonth(year, month) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59
    );
  }

  function requireMiniModelReceiptTimestamp(fields, key) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (!isStrictMiniModelUtcTimestamp(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptModelId(fields, key) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (!/^[a-z0-9][a-z0-9._/-]{0,179}$/.test(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptPrintable(fields, key, maxLength) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptToken(fields, key) {
    const value = requireMiniModelReceiptPrintable(fields, key, 96);
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptPathHint(fields, key) {
    const value = requireMiniModelReceiptPrintable(fields, key, 128);
    if (
      value !== value.trim() ||
      value !== safeLocalModelName(value) ||
      value.startsWith(".") ||
      value.includes("..") ||
      /[\\/:*?"<>|\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new Error(`MiniModel import receipt field ${key} was invalid`);
    }
    return value;
  }

  function requireMiniModelReceiptOneOf(fields, key, allowedValues) {
    const value = requireManifestField(fields, key, "MiniModel import receipt");
    if (!allowedValues.includes(value)) {
      throw new Error(`MiniModel import receipt field ${key} was ${value}`);
    }
    return value;
  }

  function requireMiniModelReceiptPeerBaseUrl(fields, key) {
    try {
      return normalizedPeerBaseUrl(requireManifestField(fields, key, "MiniModel import receipt"));
    } catch (error) {
      throw new Error(`MiniModel import receipt field ${key} was invalid: ${error.message || error}`);
    }
  }

  function miniModelPeerReceiptRouteUrl(peerBaseUrl, route) {
    return new URL(route, peerBaseUrl).href;
  }

  async function inspectLocalMiniModelImportReceipt(receiptFile, artifactName, artifactBytes, artifactSha256) {
    if (!receiptFile) {
      return null;
    }
    const receiptName = safeLocalModelName(receiptFile.name);
    if (!/\.minimodel-receipt$/i.test(receiptName)) {
      throw new Error("MiniModel receipt sidecar must use the .minimodel-receipt extension");
    }
    if (!Number.isFinite(receiptFile.size) || receiptFile.size <= 0 || receiptFile.size > receiptTextByteBudget) {
      throw new Error("MiniModel receipt sidecar size was invalid");
    }
    const text = await receiptFile.text();
    if (state.encoder.encode(text).length > receiptTextByteBudget) {
      throw new Error("MiniModel receipt sidecar exceeded the receipt byte budget");
    }
    const fields = parseManifest(text);
    requireManifestEqual(fields, "receipt.version", "0", "MiniModel import receipt");
    requireManifestEqual(fields, "receipt.kind", "minimodel.import_receipt", "MiniModel import receipt");
    const receiptCreatedUtc = requireMiniModelReceiptTimestamp(fields, "receipt.created_utc");
    const manifestSha256 = requireMiniModelReceiptSha(fields, "manifest.sha256");
    const modelId = requireMiniModelReceiptModelId(fields, "manifest.model_id");
    requireManifestEqual(fields, "artifact.local_path_hint", artifactName, "MiniModel import receipt");
    const receiptByteCount = catalogInteger(requireManifestField(fields, "artifact.byte_count", "MiniModel import receipt"));
    if (receiptByteCount !== artifactBytes.length) {
      throw new Error("MiniModel import receipt artifact.byte_count mismatch");
    }
    const receiptArtifactSha256 = requireMiniModelReceiptSha(fields, "artifact.sha256");
    if (receiptArtifactSha256 !== artifactSha256) {
      throw new Error("MiniModel import receipt artifact.sha256 mismatch");
    }
    requireManifestEqual(fields, "slm.validation_status", "passed", "MiniModel import receipt");
    const slmModelShape = requireMiniModelReceiptPrintable(fields, "slm.model_shape", 512);
    const quantization = requireMiniModelReceiptToken(fields, "slm.quantization");
    const evidenceStatus = requireMiniModelReceiptToken(fields, "evidence.status");
    requireManifestEqual(fields, "import.next_gate", miniModelImportReceiptNextGate, "MiniModel import receipt");
    for (const key of [
      "project_server_serves_model_bytes",
      "project_server_runs_model_bytes",
      "project_server_proxies_huggingface_bytes"
    ]) {
      requireMiniModelReceiptOptionalBool(fields, key, false);
    }
    const peerImport = Boolean(
      fields["peer_import.transport"] ||
      fields["peer_import.verification_status"] ||
      fields["peer.base_url"] ||
      fields["peer_piece_bytes_fetched"] ||
      fields["artifact.assembled_from_peer_pieces"]
    );
    let peerBaseUrl = "unavailable";
    let companionStateStatus = "unavailable";
    let receiverValidationContractStatus = "unavailable";
    let pieceCount = null;
    if (peerImport) {
      requireManifestEqual(fields, "peer_import.transport", "known-direct-http-peer-v0", "MiniModel import receipt");
      requireManifestEqual(fields, "peer_import.verification_status", "passed", "MiniModel import receipt");
      receiverValidationContractStatus = requireMiniModelReceiptOneOf(fields, "receiver_validation_contract.status", ["validated"]);
      requireMiniModelReceiptBool(fields, "receiver_validation.check_peer_status_before_piece_fetch", true);
      requireMiniModelReceiptBool(fields, "receiver_validation.preflight_fetches_piece_set_before_pieces", true);
      requireMiniModelReceiptBool(fields, "receiver_validation.validate_advertised_companion_state_before_piece_fetch", true);
      requireMiniModelReceiptBool(fields, "receiver_validation.import_receipt_required_before_browser_load", true);
      requireMiniModelReceiptPathHint(fields, "peer_import.request_path_hint");
      peerBaseUrl = requireMiniModelReceiptPeerBaseUrl(fields, "peer.base_url");
      requireMiniModelReceiptPathHint(fields, "peer.piece_dir_path_hint");
      requireManifestEqual(fields, "peer.piece_set_path_hint", peerPieceSetRoute, "MiniModel import receipt");
      requireMiniModelReceiptSha(fields, "peer.piece_set_sha256");
      const companionStateUrl = requireManifestField(fields, "peer.companion_state_url", "MiniModel import receipt");
      const expectedCompanionStateUrl = miniModelPeerReceiptRouteUrl(peerBaseUrl, peerCompanionStateRoute);
      if (companionStateUrl !== expectedCompanionStateUrl) {
        throw new Error("MiniModel import receipt peer.companion_state_url mismatch");
      }
      companionStateStatus = requireMiniModelReceiptOneOf(fields, "peer.companion_state_status", ["validated", "not-advertised"]);
      requireManifestEqual(fields, "chunks.mode", "fixed-size-merkle-v0", "MiniModel import receipt");
      requireMiniModelReceiptSha(fields, "chunks.merkle_root_sha256");
      pieceCount = catalogInteger(requireManifestField(fields, "chunks.count", "MiniModel import receipt"));
      if (!pieceCount) {
        throw new Error("MiniModel import receipt chunks.count was invalid");
      }
      requireMiniModelReceiptBool(fields, "peer_piece_set_metadata_fetched", true);
      requireMiniModelReceiptBool(fields, "peer_companion_state_metadata_fetched", companionStateStatus === "validated");
      requireMiniModelReceiptBool(fields, "peer_piece_bytes_fetched", true);
      requireMiniModelReceiptBool(fields, "artifact.assembled_from_peer_pieces", true);
      requireMiniModelReceiptBool(fields, "project_server_serves_model_bytes", false);
      requireMiniModelReceiptBool(fields, "project_server_runs_model_bytes", false);
      requireMiniModelReceiptBool(fields, "project_server_proxies_huggingface_bytes", false);
    }
    return {
      fileName: receiptName,
      receiptSha256: await sha256Text(text),
      fields,
      receiptCreatedUtc,
      modelId,
      manifestSha256,
      artifactSha256: receiptArtifactSha256,
      slmModelShape,
      quantization,
      evidenceStatus,
      nextGate: miniModelImportReceiptNextGate,
      peerImport,
      peerBaseUrl,
      receiverValidationContractStatus,
      companionStateStatus,
      pieceCount
    };
  }

  function localImportReceiptSummary(receipt) {
    if (!receipt) {
      return "";
    }
    if (receipt.peerImport) {
      return `MiniModel P2P receipt / ${receipt.companionStateStatus} / ${receipt.pieceCount || "unknown"} chunks`;
    }
    return "MiniModel import receipt";
  }

  function localImportReceiptProvenanceSnapshot(receipt) {
    if (!receipt) {
      return "";
    }
    const parts = [
      localImportReceiptSummary(receipt),
      `receipt ${receipt.receiptSha256}`,
      `created ${receipt.receiptCreatedUtc}`
    ];
    if (receipt.peerImport) {
      parts.push(
        `receiver validation ${receipt.receiverValidationContractStatus}`,
        `peer ${receipt.peerBaseUrl}`,
        `companion ${receipt.companionStateStatus}`,
        `${receipt.pieceCount || "unknown"} chunks`
      );
    } else {
      parts.push(`manifest ${receipt.manifestSha256}`);
    }
    return parts.filter(Boolean).join(" / ");
  }

  function localImportReceiptReviewSummary(receipt) {
    if (!receipt) {
      return "";
    }
    return [
      `receipt ${receipt.fileName}`,
      `evidence ${receipt.evidenceStatus}`,
      `manifest ${receipt.manifestSha256}`,
      receipt.peerImport ? `receiver validation ${receipt.receiverValidationContractStatus}` : "",
      `quantization ${receipt.quantization}`
    ].filter(Boolean).join(" / ");
  }

  function localImportReceiptRouteSummary(receipt) {
    if (!receipt) {
      return "";
    }
    return receipt.peerImport
      ? `receipt=${receipt.fileName} / receiver-validation=${receipt.receiverValidationContractStatus} / peer=${receipt.peerBaseUrl} / companion=minimodel.peer_companion_state.v0.json`
      : `receipt=${receipt.fileName}`;
  }

  function localImportReceiptArtifactSummary(receipt, byteLength) {
    if (!receipt) {
      return "";
    }
    return `artifact=${receipt.artifactSha256} / bytes=${byteLength}`;
  }

  function localImportReceiptValidationSummary(receipt) {
    if (!receipt) {
      return "";
    }
    if (receipt.peerImport) {
      return [
        "receipt-chain-ready-for-browser-load",
        `receiver validation ${receipt.receiverValidationContractStatus}`,
        `peer ${receipt.peerBaseUrl}`,
        `companion ${receipt.companionStateStatus}`,
        `chunks ${receipt.pieceCount || "unknown"}`,
        `artifact ${receipt.artifactSha256}`
      ].join(" / ");
    }
    return `receipt-ready-for-browser-load / artifact ${receipt.artifactSha256}`;
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
    for (const button of [
      el.saveShareMetadataButton,
      el.simpleSaveShareMetadataButton,
      el.saveShareKitButton,
      el.simpleSaveShareKitButton
    ]) {
      if (button) {
        button.disabled = disabled;
        button.title = disabled
          ? "Import and load a Rust-validated local .slm before exporting MiniModel share files."
          : button === el.saveShareKitButton || button === el.simpleSaveShareKitButton
            ? "Save a local Rust script that prepares peer pieces and P2P availability metadata for this verified .slm."
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

  function shareTransferProfile(shareKitReady) {
    return shareKitReady
      ? {
        peerTransferImplemented: true,
        peerTransferStatus: "local-share-kit-script-ready-known-peer-needed",
        peerTransferImplementation: "generated-local-minimodel-share-kit-v0",
        offerStatus: "local-share-kit-ready-known-peer-needed",
        protocols: [
          "minimodel-prepare-peer-share-v0",
          "known-direct-http-peer-v0",
          "minimodel-peer-companion-v0"
        ],
        localShareKitAvailable: true,
        serveHelperAvailable: true,
        requiredNextGate: "run-generated-share-kit-set-known-peer-url-and-serve-from-user-machine"
      }
      : {
        peerTransferImplemented: false,
        peerTransferStatus: "metadata-only",
        peerTransferImplementation: "not-included-in-metadata-export",
        offerStatus: "metadata-ready-transfer-not-implemented",
        protocols: [],
        localShareKitAvailable: false,
        serveHelperAvailable: false,
        requiredNextGate: "implement-consent-based-peer-transfer-and-rust-reverify-before-import"
      };
  }

  async function buildShareMetadataBundle(options = {}) {
    if (!hasVerifiedLocalModelFile()) {
      throw new Error("Import a verified local .slm before saving share metadata");
    }
    const shareKitReady = Boolean(options.shareKitReady);
    const transferProfile = shareTransferProfile(shareKitReady);
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
    const bundle = {
      bundle_kind: "minimodel.local_slm_share_metadata.v0",
      generated_at: new Date().toISOString(),
      boundary: {
        project_server_runs_model_bytes: false,
        project_server_serves_model_bytes: false,
        peer_transfer_implemented: transferProfile.peerTransferImplemented,
        peer_transfer_status: transferProfile.peerTransferStatus,
        peer_transfer_implementation: transferProfile.peerTransferImplementation,
        user_consent_required_before_transfer: true,
        tiny_rust_lm_execution_rule: "User imports a verified local .slm through the browser file picker before execution."
      },
      catalog_entry: catalogEntry,
      peer_offer: {
        offer_kind: "minimodel.peer_offer.v0",
        offer_version: 0,
        offer_status: transferProfile.offerStatus,
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
          protocols: transferProfile.protocols,
          network_transfer_available: false,
          local_share_kit_available: transferProfile.localShareKitAvailable,
          serve_helper_available: transferProfile.serveHelperAvailable,
          project_server_serves_model_bytes: false,
          project_server_runs_model_bytes: false,
          required_next_gate: transferProfile.requiredNextGate
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
    if (shareKitReady) {
      bundle.share_kit = {
        kit_kind: "tinyrustlm.local_p2p_share_kit.v0",
        kit_status: "script-ready-known-peer-needed",
        prepares_peer_pieces: true,
        writes_catalog_snapshot: true,
        writes_import_receipt_ledger: true,
        writes_peer_source_metadata_when_known_peer_set: true,
        writes_peer_companion_state_when_known_peer_set: true,
        writes_peer_contact_card_when_known_peer_set: true,
        writes_peer_contact_book_when_known_peer_set: true,
        writes_peer_companion_inventory_when_known_peer_set: true,
        serve_helper_available: true,
        user_consent_required_before_transfer: true,
        project_server_serves_model_bytes: false,
        project_server_runs_model_bytes: false,
        execution_rule: "Run the generated PowerShell scripts locally after reviewing the verified .slm path and consenting peer URL."
      };
    }
    return bundle;
  }

  async function saveShareMetadata() {
    setShareMetadataStatus("computing chunk hashes", false);
    const bundle = await buildShareMetadataBundle();
    const fileName = `${slugForShareMetadata(bundle.catalog_entry.model_id)}.minimodel-share-metadata.json`;
    downloadTextFile(fileName, `${JSON.stringify(bundle, null, 2)}\n`);
    setShareMetadataStatus(`${bundle.peer_offer.chunks.chunk_count} chunks / share metadata saved locally`, false);
  }

  function miniModelServePeerPiecesScript({ scriptTitle, modelId, shareDirRelativePath }) {
    const relativeShareDir = String(shareDirRelativePath || "minimodel-peer-share")
      .split(/[\\/]+/)
      .filter(Boolean)
      .map((segment) => safeLocalModelName(segment))
      .join("\\") || "minimodel-peer-share";
    const lines = [
      `# ${scriptTitle || "MiniModel local peer piece server"}`,
      `# Model: ${modelId || "local/slm"}`,
      "#",
      "# This serves local peer pieces only from this machine after you choose to run it.",
      "# It does not upload model bytes to TinyRustLM.com, MiniModel.org, or any project server.",
      "# Stop the PowerShell window to stop serving.",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "function Resolve-ExistingPath {",
      "  param(",
      "    [string[]] $Candidates,",
      "    [string] $Label,",
      "    [string] $Help",
      "  )",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "  }",
      "  throw \"$Label not found. $Help\"",
      "}",
      "",
      "function Resolve-GeneratedFile {",
      "  param(",
      "    [string] $Directory,",
      "    [string] $Filter,",
      "    [string] $Label",
      "  )",
      "  $Matches = @(Get-ChildItem -LiteralPath $Directory -File -Filter $Filter | Sort-Object LastWriteTimeUtc -Descending)",
      "  if ($Matches.Count -lt 1) {",
      "    throw \"$Label was not produced in $Directory. Run the conversion/share kit first.\"",
      "  }",
      "  return $Matches[0].FullName",
      "}",
      "",
      "function Resolve-GeneratedFileOrNull {",
      "  param(",
      "    [string[]] $Directories,",
      "    [string] $Filter",
      "  )",
      "  foreach ($Directory in $Directories) {",
      "    if ([string]::IsNullOrWhiteSpace($Directory)) { continue }",
      "    if (!(Test-Path -LiteralPath $Directory -PathType Container)) { continue }",
      "    $Matches = @(Get-ChildItem -LiteralPath $Directory -File -Filter $Filter -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending)",
      "    if ($Matches.Count -gt 0) {",
      "      return $Matches[0].FullName",
      "    }",
      "  }",
      "  return \"\"",
      "}",
      "",
      "function Resolve-GeneratedDirectory {",
      "  param(",
      "    [string] $Directory,",
      "    [string] $Filter,",
      "    [string] $Label",
      "  )",
      "  $Matches = @(Get-ChildItem -LiteralPath $Directory -Directory -Filter $Filter | Sort-Object LastWriteTimeUtc -Descending)",
      "  if ($Matches.Count -lt 1) {",
      "    throw \"$Label was not produced in $Directory. Run the conversion/share kit first.\"",
      "  }",
      "  return $Matches[0].FullName",
      "}",
      "",
      "# Optional overrides:",
      "#   $env:MINIMODEL_WORKSPACE = full path to the MiniModel.org Rust workspace",
      "#   $env:MINIMODEL_PEER_BIND_ADDR = bind address, default 127.0.0.1:8123",
      "$CandidateMiniModelWorkspaces = @(",
      "  $env:MINIMODEL_WORKSPACE,",
      "  \"E:/Source/Rust/MiniModel.org\",",
      "  (Join-Path $PSScriptRoot \"MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\MiniModel.org\")",
      ")",
      "$MiniModelWorkspace = Resolve-ExistingPath $CandidateMiniModelWorkspaces \"MiniModel Rust workspace\" \"Set MINIMODEL_WORKSPACE or edit `$CandidateMiniModelWorkspaces.\"",
      `$ShareDir = Join-Path $PSScriptRoot ${powerShellSingleQuote(relativeShareDir)}`,
      "$Manifest = Resolve-GeneratedFile $ShareDir \"*.minimodel.manifest.v0\" \"MiniModel manifest\"",
      "$PeerPiecesDir = Resolve-GeneratedDirectory $ShareDir \"*.peer-pieces\" \"MiniModel peer pieces\"",
      "$ShareParentDir = Split-Path -Parent $ShareDir",
      "$PeerCompanionState = Resolve-GeneratedFileOrNull @($ShareDir, $ShareParentDir, $PSScriptRoot) \"*.peer-companion-state.v0.json\"",
      "$BindAddr = if ($env:MINIMODEL_PEER_BIND_ADDR) { $env:MINIMODEL_PEER_BIND_ADDR } else { \"127.0.0.1:8123\" }",
      "",
      "Write-Host \"MiniModel workspace:\" $MiniModelWorkspace",
      "Write-Host \"MiniModel manifest:\" $Manifest",
      "Write-Host \"Peer pieces directory:\" $PeerPiecesDir",
      "Write-Host \"Serving from this machine only:\" $BindAddr",
      "Write-Host \"Project servers are not serving, proxying, caching, or running these model bytes.\"",
      "Set-Location $MiniModelWorkspace",
      "if ($PeerCompanionState.Trim().Length -gt 0) {",
      "  Write-Host \"Peer companion state:\" $PeerCompanionState",
      "  Write-Host \"Inspecting peer companion state before serving.\"",
      "  cargo run -p minimodel -- inspect-peer-companion-state $PeerCompanionState $Manifest $PeerPiecesDir",
      "  Write-Host \"Serving companion state route: minimodel.peer_companion_state.v0.json\"",
      "  cargo run -p minimodel -- serve-peer-companion $PeerCompanionState $Manifest $PeerPiecesDir $BindAddr",
      "} else {",
      "  Write-Host \"Peer companion state: not found; serving peer pieces only.\"",
      "  cargo run -p minimodel -- serve-peer-pieces $Manifest $PeerPiecesDir $BindAddr",
      "}",
      ""
    ];
    return lines.join("\n");
  }

  function localShareKitScript(bundle) {
    const entry = bundle.catalog_entry || {};
    const offer = bundle.peer_offer || {};
    const chunks = offer.chunks || {};
    const modelId = catalogText(entry.model_id) || "local/slm";
    const displayName = catalogText(entry.display_name) || modelId;
    const artifactFileName = safeLocalModelName(entry.artifact_file_name || "local-model.slm");
    const artifactStem = artifactFileName.replace(/\.slm$/i, "") || "local-model";
    const sourceHuggingFaceModelId = catalogText(entry.source_huggingface_model_id);
    const expectedSha256 = catalogText(entry.artifact_sha256 || offer.artifact_sha256);
    const expectedByteCount = Number.isFinite(entry.artifact_byte_count)
      ? entry.artifact_byte_count
      : Number.isFinite(offer.artifact_byte_count)
        ? offer.artifact_byte_count
        : 0;
    const scriptStem = safeLocalModelName(`${slugForShareMetadata(modelId)}.minimodel-share`);
    const serveScriptFileName = safeLocalModelName(`${slugForShareMetadata(modelId)}.minimodel-serve-peer-pieces.ps1`);
    const lines = [
      "# TinyRustLM local .slm to MiniModel P2P share kit",
      `# Model: ${displayName} (${modelId})`,
      "#",
      "# This script never uploads model bytes to TinyRustLM.com, MiniModel.org, or any project server.",
      "# It prepares local peer pieces, metadata, and optional peer-source announcement files.",
      "# Put the verified .slm beside this script, under ./source/, or set TINYRUSTLM_LOCAL_SLM.",
      "# Set KnownPeerBaseUrl only when you consent to serve pieces from your own peer endpoint.",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "function Resolve-ExistingPath {",
      "  param(",
      "    [string[]] $Candidates,",
      "    [string] $Label,",
      "    [string] $Help",
      "  )",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "  }",
      "  throw \"$Label not found. $Help\"",
      "}",
      "",
      "function Invoke-CheckedCargo {",
      "  param(",
      "    [string] $Label,",
      "    [string[]] $Arguments",
      "  )",
      "  & cargo @Arguments",
      "  $ExitCode = $LASTEXITCODE",
      "  if ($ExitCode -ne 0) {",
      "    throw \"$Label failed with exit code $ExitCode.\"",
      "  }",
      "}",
      "",
      "# Optional overrides:",
      "#   $env:MINIMODEL_WORKSPACE = full path to the MiniModel.org Rust workspace",
      "#   $env:TINYRUSTLM_LOCAL_SLM = full path to the verified local .slm file",
      "#   $env:MINIMODEL_KNOWN_PEER_BASE_URL = consenting peer base URL, for example 127.0.0.1:8123/peer-pieces with HTTP",
      "$CandidateMiniModelWorkspaces = @(",
      "  $env:MINIMODEL_WORKSPACE,",
      "  \"E:/Source/Rust/MiniModel.org\",",
      "  (Join-Path $PSScriptRoot \"MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\MiniModel.org\")",
      ")",
      `$LocalSlmFileName = ${powerShellSingleQuote(artifactFileName)}`,
      "$LocalSlmCandidates = @(",
      "  $env:TINYRUSTLM_LOCAL_SLM,",
      "  (Join-Path $PSScriptRoot $LocalSlmFileName),",
      "  (Join-Path $PSScriptRoot (Join-Path \"source\" $LocalSlmFileName))",
      ")",
      "$MiniModelWorkspace = Resolve-ExistingPath $CandidateMiniModelWorkspaces \"MiniModel Rust workspace\" \"Set MINIMODEL_WORKSPACE or edit `$CandidateMiniModelWorkspaces.\"",
      "$LocalSlm = Resolve-ExistingPath $LocalSlmCandidates \"Verified local .slm\" \"Put the verified .slm beside this script, under ./source/, set TINYRUSTLM_LOCAL_SLM, or edit `$LocalSlmCandidates.\"",
      `$ExpectedArtifactSha256 = ${powerShellDoubleQuote(expectedSha256)}`,
      `$ExpectedArtifactByteCount = ${Math.max(0, Math.trunc(expectedByteCount))}`,
      `$ModelId = ${powerShellSingleQuote(modelId)}`,
      `$SourceHuggingFaceModelId = ${powerShellSingleQuote(sourceHuggingFaceModelId)}`,
      `$KnownPeerBaseUrl = if ($env:MINIMODEL_KNOWN_PEER_BASE_URL) { $env:MINIMODEL_KNOWN_PEER_BASE_URL } else { "" } # Optional, for example ${peerExampleUrl}`,
      "$BindAddr = \"127.0.0.1:8123\"",
      `$WorkDir = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${scriptStem}-kit`)}`,
      "$ShareDir = Join-Path $WorkDir \"minimodel-peer-share\"",
      `$Manifest = Join-Path $ShareDir ${powerShellSingleQuote(`${artifactStem}.minimodel.manifest.v0`)}`,
      `$PeerPiecesDir = Join-Path $ShareDir ${powerShellSingleQuote(`${artifactStem}.peer-pieces`)}`,
      `$CatalogEntry = Join-Path $ShareDir ${powerShellSingleQuote(`${artifactStem}.catalog-entry.v0.json`)}`,
      `$CatalogEntryWithPeer = Join-Path $ShareDir ${powerShellSingleQuote(`${artifactStem}.catalog-entry.with-peer.v0.json`)}`,
      `$PeerSourceAnnouncement = Join-Path $WorkDir ${powerShellSingleQuote(`${artifactStem}.peer-source-announcement.v0.json`)}`,
      "$PeerSourceAnnouncementFeed = Join-Path $WorkDir \"peer-source-announcements.v0.json\"",
      `$PeerCompanionState = Join-Path $WorkDir ${powerShellSingleQuote(`${artifactStem}.peer-companion-state.v0.json`)}`,
      `$PeerContactCard = Join-Path $WorkDir ${powerShellSingleQuote(`${artifactStem}.peer-contact-card.v0.json`)}`,
      `$PeerContactBook = Join-Path $WorkDir ${powerShellSingleQuote(`${artifactStem}.peer-contact-book.v0.json`)}`,
      `$PeerCompanionInventory = Join-Path $WorkDir ${powerShellSingleQuote(`${artifactStem}.peer-companion-inventory.v0.json`)}`,
      `$LocalImportReceipt = Join-Path $WorkDir ${powerShellSingleQuote(`${artifactStem}.local.minimodel-receipt`)}`,
      "$LocalImportReceiptLedger = Join-Path $WorkDir \"import-receipts.v0.json\"",
      "$CatalogSnapshot = Join-Path $WorkDir \"models.v0.json\"",
      "$CatalogSnapshotWithFeed = Join-Path $WorkDir \"models.with-announcement-feed.v0.json\"",
      `$ServeScript = Join-Path $PSScriptRoot ${powerShellSingleQuote(serveScriptFileName)}`,
      "",
      "$ActualArtifactByteCount = (Get-Item -LiteralPath $LocalSlm).Length",
      "if ($ExpectedArtifactByteCount -gt 0 -and $ActualArtifactByteCount -ne $ExpectedArtifactByteCount) {",
      "  throw \"Local .slm byte count mismatch. Expected $ExpectedArtifactByteCount, got $ActualArtifactByteCount.\"",
      "}",
      "$ActualArtifactSha256 = \"sha256:\" + ((Get-FileHash -Algorithm SHA256 -LiteralPath $LocalSlm).Hash.ToLowerInvariant())",
      "if ($ExpectedArtifactSha256.Trim().Length -gt 0 -and $ActualArtifactSha256 -ne $ExpectedArtifactSha256) {",
      "  throw \"Local .slm SHA-256 mismatch. Expected $ExpectedArtifactSha256, got $ActualArtifactSha256.\"",
      "}",
      "",
      "Write-Host \"MiniModel workspace:\" $MiniModelWorkspace",
      "Write-Host \"Verified local .slm:\" $LocalSlm",
      "Write-Host \"Artifact SHA-256:\" $ActualArtifactSha256",
      "Write-Host \"Output directory:\" $WorkDir",
      "New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null",
      "Set-Location $MiniModelWorkspace",
      "",
      "# Prepare checksum-bound manifest, peer-offer proof, local peer pieces, and catalog entry.",
      "$PrepareArgs = @(\"run\", \"-p\", \"minimodel\", \"--\", \"prepare-peer-share\", $LocalSlm, $ShareDir, $ModelId)",
      "if ($SourceHuggingFaceModelId.Trim().Length -gt 0) {",
      "  $PrepareArgs += $SourceHuggingFaceModelId",
      "}",
      "Invoke-CheckedCargo \"MiniModel prepare peer share\" $PrepareArgs",
      "",
      "# Write a local receipt and metadata-only receipt ledger for companion/audit use.",
      "Invoke-CheckedCargo \"MiniModel write local import receipt\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-import-receipt\", $Manifest, $LocalSlm, $LocalImportReceipt)",
      "Invoke-CheckedCargo \"MiniModel inspect local import receipt\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-import-receipt\", $LocalImportReceipt, $Manifest, $LocalSlm)",
      "Invoke-CheckedCargo \"MiniModel write local import receipt ledger\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-import-receipt-ledger\", $LocalImportReceiptLedger, $LocalImportReceipt, $Manifest, $LocalSlm)",
      "Invoke-CheckedCargo \"MiniModel inspect local import receipt ledger\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-import-receipt-ledger\", $LocalImportReceiptLedger)",
      "",
      "$CatalogEntryForSnapshot = $CatalogEntry",
      "if ($KnownPeerBaseUrl.Trim().Length -gt 0) {",
      "  Invoke-CheckedCargo \"MiniModel add peer source\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"add-peer-source\", $CatalogEntry, $CatalogEntryWithPeer, $KnownPeerBaseUrl)",
      "  Invoke-CheckedCargo \"MiniModel write peer source announcement\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-peer-source-announcement\", $CatalogEntry, $PeerSourceAnnouncement, $KnownPeerBaseUrl)",
      "  Invoke-CheckedCargo \"MiniModel write peer source announcement feed\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-peer-source-announcement-feed\", $PeerSourceAnnouncementFeed, $PeerSourceAnnouncement)",
      "  Invoke-CheckedCargo \"MiniModel inspect peer source announcement feed\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-peer-source-announcement-feed\", $PeerSourceAnnouncementFeed)",
      "  Invoke-CheckedCargo \"MiniModel write peer companion state\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-peer-companion-state\", $Manifest, $PeerPiecesDir, $PeerCompanionState, $KnownPeerBaseUrl)",
      "  Invoke-CheckedCargo \"MiniModel inspect peer companion state\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-peer-companion-state\", $PeerCompanionState, $Manifest, $PeerPiecesDir)",
      "  Invoke-CheckedCargo \"MiniModel write peer contact card\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-peer-contact-card\", $PeerContactCard, $KnownPeerBaseUrl)",
      "  Invoke-CheckedCargo \"MiniModel write peer contact book\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-peer-contact-book\", $PeerContactBook, $PeerContactCard)",
      "  Invoke-CheckedCargo \"MiniModel inspect peer contact book\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-peer-contact-book\", $PeerContactBook)",
      "  Invoke-CheckedCargo \"MiniModel write peer companion inventory\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-peer-companion-inventory\", $PeerCompanionInventory, $PeerCompanionState, $Manifest, $PeerPiecesDir, $LocalImportReceiptLedger, $ActualArtifactByteCount, $PeerContactCard)",
      "  Invoke-CheckedCargo \"MiniModel inspect peer companion inventory\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-peer-companion-inventory\", $PeerCompanionInventory)",
      "  Invoke-CheckedCargo \"MiniModel write feed-bound catalog snapshot\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-catalog-snapshot-with-announcement-feed\", $CatalogSnapshotWithFeed, \"peer-source-announcements.v0.json\", $PeerSourceAnnouncementFeed, $CatalogEntry)",
      "  Invoke-CheckedCargo \"MiniModel inspect feed-bound catalog snapshot\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-catalog-snapshot\", $CatalogSnapshotWithFeed)",
      "  $CatalogEntryForSnapshot = $CatalogEntryWithPeer",
      "}",
      "Invoke-CheckedCargo \"MiniModel write catalog snapshot\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"write-catalog-snapshot\", $CatalogSnapshot, $CatalogEntryForSnapshot)",
      "Invoke-CheckedCargo \"MiniModel inspect catalog snapshot\" @(\"run\", \"-p\", \"minimodel\", \"--\", \"inspect-catalog-snapshot\", $CatalogSnapshot)",
      "",
      "Write-Host \"MiniModel manifest:\" $Manifest",
      "Write-Host \"Peer pieces directory:\" $PeerPiecesDir",
      "Write-Host \"Local import receipt:\" $LocalImportReceipt",
      "Write-Host \"Local import receipt ledger:\" $LocalImportReceiptLedger",
      "Write-Host \"Catalog snapshot:\" $CatalogSnapshot",
      "if ($KnownPeerBaseUrl.Trim().Length -gt 0) {",
      "  Write-Host \"Peer-source announcement:\" $PeerSourceAnnouncement",
      "  Write-Host \"Peer-source announcement feed:\" $PeerSourceAnnouncementFeed",
      "  Write-Host \"Peer companion state:\" $PeerCompanionState",
      "  Write-Host \"Peer contact card:\" $PeerContactCard",
      "  Write-Host \"Peer contact book:\" $PeerContactBook",
      "  Write-Host \"Peer companion inventory:\" $PeerCompanionInventory",
      "  Write-Host \"Feed-bound catalog snapshot:\" $CatalogSnapshotWithFeed",
      "  Write-Host \"Send only metadata JSON to a catalog maintainer. Do not upload peer pieces or .slm bytes to project servers.\"",
      "} else {",
      "  Write-Host \"To publish P2P availability later, rerun with KnownPeerBaseUrl set to your consenting peer URL.\"",
      "}",
      "Write-Host \"To serve from this machine, run:\"",
      "if ($KnownPeerBaseUrl.Trim().Length -gt 0) {",
      "  Write-Host \"cargo run -p minimodel -- inspect-peer-companion-state '$PeerCompanionState' '$Manifest' '$PeerPiecesDir'\"",
      "  Write-Host \"cargo run -p minimodel -- serve-peer-companion '$PeerCompanionState' '$Manifest' '$PeerPiecesDir' $BindAddr\"",
      "} else {",
      "  Write-Host \"cargo run -p minimodel -- serve-peer-pieces '$Manifest' '$PeerPiecesDir' $BindAddr\"",
      "}",
      "Write-Host \"or run the downloaded helper script:\"",
      "Write-Host \"powershell -ExecutionPolicy Bypass -File '$ServeScript'\"",
      "Write-Host \"Future users import by selecting the P2P-ready row, saving its import kit, and running MiniModel import-peer-request.\"",
      "",
      "# Share metadata summary:",
      `# artifact_sha256: ${expectedSha256 || "unavailable"}`,
      `# artifact_byte_count: ${expectedByteCount || "unavailable"}`,
      `# chunk_count: ${chunks.chunk_count || "unavailable"}`,
      `# merkle_root_sha256: ${chunks.merkle_root_sha256 || "unavailable"}`
    ];
    return `${lines.join("\n")}\n`;
  }

  async function saveShareKit() {
    setShareMetadataStatus("building P2P share kit", false);
    const bundle = await buildShareMetadataBundle({ shareKitReady: true });
    const stem = safeLocalModelName(slugForShareMetadata(bundle.catalog_entry.model_id));
    downloadTextFile(`${stem}.minimodel-share-metadata.json`, `${JSON.stringify(bundle, null, 2)}\n`);
    downloadTextFile(`${stem}.minimodel-share-kit.ps1`, localShareKitScript(bundle), "text/plain");
    downloadTextFile(
      `${stem}.minimodel-serve-peer-pieces.ps1`,
      miniModelServePeerPiecesScript({
        scriptTitle: "TinyRustLM local .slm MiniModel peer serving helper",
        modelId: catalogText(bundle.catalog_entry && bundle.catalog_entry.model_id) || "local/slm",
        shareDirRelativePath: `${safeLocalModelName(`${slugForShareMetadata(bundle.catalog_entry.model_id)}.minimodel-share`)}-kit\\minimodel-peer-share`
      }),
      "text/plain"
    );
    setShareMetadataStatus(`${bundle.peer_offer.chunks.chunk_count} chunks / P2P share kit saved locally / serve script saved locally`, false);
  }

  async function importLocalModelFile() {
    const selectedFiles = localModelSelectedFiles();
    const selectionError = localModelSelectionError(selectedFiles);
    if (selectionError) {
      throw new Error(selectionError);
    }
    const file = selectedFiles.slm;
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
    const receiptArtifactName = String(file.name || name);
    const importReceipt = await inspectLocalMiniModelImportReceipt(selectedFiles.receipt, receiptArtifactName, bytes, sha256);
    const checksum = bytesChecksumHex(bytes);
    const catalogEntry = state.selectedCatalogEntry;
    state.localModel = {
      label: `${catalogEntry ? catalogEntry.displayName : name} (${importReceipt && importReceipt.peerImport ? "P2P receipt" : "local file"})`,
      path: `local-file:${name}`,
      maxTokens: catalogEntry ? catalogEntry.maxTokens : 64,
      localFile: {
        name,
        bytes,
        byteLength: bytes.length,
        checksum,
        sha256,
        catalogEntry,
        importReceipt,
        verified: false
      }
    };
    paths.models = modelsWithLocalModel(paths.models);
    renderModelOptions(paths.models, false, localModelKey);
    const receiptSummary = localImportReceiptSummary(importReceipt);
    setLocalModelStatus(
      `${name} / ${formatByteCount(bytes.length)} / ${sha256} / ${checksum}${receiptSummary ? ` / ${receiptSummary}` : ""}`,
      false
    );
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

  function hfResolveUrl(modelId, fileName) {
    const modelPath = String(modelId || "").split("/").map(encodeURIComponent).join("/");
    const filePath = String(fileName || "").split("/").map(encodeURIComponent).join("/");
    return modelPath && filePath ? `${hfOrigin()}/${modelPath}/resolve/main/${filePath}` : "";
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
    if (el.simpleHfFlowSummary) {
      el.simpleHfFlowSummary.replaceChildren();
      el.simpleHfFlowSummary.hidden = true;
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

  function hfSiblingSha256(sibling) {
    const candidates = [
      sibling && sibling.sha256,
      sibling && sibling.oid,
      sibling && sibling.lfs && sibling.lfs.oid
    ];
    for (const value of candidates) {
      const text = String(value || "").trim().replace(/^sha256:/i, "");
      if (/^[0-9a-f]{64}$/i.test(text)) {
        return `sha256:${text.toLowerCase()}`;
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
        byte_count: hfSiblingByteCount(sibling),
        sha256: hfSiblingSha256(sibling),
        download_url: hfResolveUrl(result && result.modelId || result && result.id || result && result.name, fileName)
      });
      if (files.length >= 8) {
        break;
      }
    }
    return files;
  }

  function hfGgufSiblings(result) {
    const siblings = result && Array.isArray(result.siblings) ? result.siblings : [];
    const seen = new Set();
    const files = [];
    for (const sibling of siblings) {
      const fileName = hfSiblingFileName(sibling);
      if (!/\.gguf$/i.test(fileName) || seen.has(fileName.toLowerCase())) {
        continue;
      }
      seen.add(fileName.toLowerCase());
      files.push({
        file_name: fileName,
        byte_count: hfSiblingByteCount(sibling),
        sha256: hfSiblingSha256(sibling),
        download_url: hfResolveUrl(result && result.modelId || result && result.id || result && result.name, fileName)
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

  function routeFileName(route, fallback) {
    const routeText = catalogText(route).split(/[?#]/, 1)[0].replace(/\\/g, "/");
    const leaf = routeText.split("/").filter(Boolean).pop() || "";
    return leaf ? safeLocalModelName(leaf) : fallback;
  }

  function peerImportManifestFileName(match) {
    const fallback = `${peerImportFileStem(match && match.modelId)}.minimodel.manifest.v0`;
    const fileName = routeFileName(match && match.manifestRoute, fallback);
    return fileName.endsWith(".minimodel.manifest.v0") ? fileName : fallback;
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
        metadata_routes: {
          peer_status: "minimodel.peer_status.v0.json",
          peer_piece_set: "minimodel.peer_piece_set.v0",
          peer_companion_state: "minimodel.peer_companion_state.v0.json"
        },
        receiver_validation_contract: {
          check_peer_status_before_piece_fetch: true,
          preflight_fetches_piece_set_before_pieces: true,
          validate_advertised_companion_state_before_piece_fetch: true,
          import_receipt_required_before_browser_load: true
        },
        peer_side_commands: [
          "minimodel prepare-peer-share <artifact.slm> <share-dir> <model-id> [source-huggingface-model-id] [known-peer-base-url]",
          "minimodel write-peer-companion-state <manifest> <piece-dir> <state-json> <known-peer-base-url>",
          "minimodel inspect-peer-companion-state <state-json> <manifest> <piece-dir>",
          "minimodel serve-peer-companion <state-json> <manifest> <piece-dir> <bind-addr>",
          "minimodel serve-peer-pieces <manifest> <piece-dir> <bind-addr>"
        ],
        rust_commands: [
          "minimodel inspect-peer-import-request <request-json> <manifest>",
          "minimodel check-peer-status <manifest> <known-peer-base-url> <output-json>",
          "minimodel inspect-peer-status-check <status-check-json> <manifest>",
          "minimodel preflight-peer-import-request <request-json> <manifest> <output.preflight>",
          "minimodel inspect-peer-import-preflight <output.preflight> <request-json> <manifest>",
          "minimodel import-peer-request <request-json> <manifest> <output-dir>",
          "minimodel inspect-import-receipt <receipt.minimodel-receipt> <manifest> <artifact.slm>",
          "minimodel inspect-peer-import-receipt <receipt.minimodel-receipt> <request-json> <output.preflight> <manifest> <artifact.slm>",
          "minimodel write-import-receipt-ledger <output-json> <receipt> <manifest> <artifact.slm>",
          "minimodel inspect-import-receipt-ledger <ledger-json>"
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
    const manifestFileName = peerImportManifestFileName(match);
    const request = peerImportRequest(match, peerBaseUrl);
    const requestJson = `${JSON.stringify(request, null, 2)}\n`;
    const requestBase64 = base64Utf8(requestJson);
    const peerUrl = request.local_peer_piece_contract.expected_peer_base_url;
    const manifestUrl = request.minimodel_metadata.manifest_url || "";
    const assembledOutputSlm = request.local_peer_piece_contract.assembled_output_slm;
    const receiptFileName = assembledOutputSlm.toLowerCase().endsWith(".slm")
      ? `${assembledOutputSlm.slice(0, -4)}.minimodel-receipt`
      : `${stem}.minimodel-receipt`;
    const lines = [
      "# MiniModel peer import handoff",
      `# Model: ${match.displayName} (${match.modelId})`,
      "#",
      "# This script does not download model bytes from MiniModel.org, TinyRustLM.com, or Hugging Face.",
      "# It may download the MiniModel manifest metadata if the catalog supplied a manifest URL.",
      "# Before contacting the peer, Rust inspects this request against the metadata manifest and confirms the no-project-server-byte boundary.",
      "# Before importing, Rust checks minimodel.peer_status.v0.json metadata, then fetches minimodel.peer_piece_set.v0 metadata and advertised peer companion-state metadata for preflight.",
      "# Rust re-inspects the saved peer-status-check JSON against the manifest before any preflight or piece fetch.",
      "# Rust re-inspects the saved preflight report so route/gate evidence and no-byte-transfer flags cannot drift before import.",
      "# It fetches peer pieces only from the consenting peer URL you enter below.",
      "# MiniModel rejects project-server peer hosts and verifies every piece before assembly.",
      "# Rust then fetches pieces, assembles, verifies, and writes an import receipt with peer-transfer evidence.",
      "# Rust inspects that receipt against the assembled .slm before TinyRustLM local-file import.",
      "# Rust writes and inspects a local metadata-only import receipt ledger for companion/audit use.",
      "# Peer serving counterpart first validates companion state: cargo run -p minimodel -- inspect-peer-companion-state <state-json> <manifest> <piece-dir>",
      "# Peer serving counterpart: cargo run -p minimodel -- serve-peer-companion <state-json> <manifest> <piece-dir> 127.0.0.1:8123",
      "# Fallback without companion state: cargo run -p minimodel -- serve-peer-pieces <manifest> <piece-dir> 127.0.0.1:8123",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "function Resolve-ExistingPath {",
      "  param(",
      "    [string[]] $Candidates,",
      "    [string] $Label,",
      "    [string] $Help",
      "  )",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "  }",
      "  throw \"$Label not found. $Help\"",
      "}",
      "",
      "# Optional override:",
      "#   $env:MINIMODEL_WORKSPACE = full path to the MiniModel.org Rust workspace",
      "$CandidateMiniModelWorkspaces = @(",
      "  $env:MINIMODEL_WORKSPACE,",
      "  \"E:/Source/Rust/MiniModel.org\",",
      "  (Join-Path $PSScriptRoot \"MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\MiniModel.org\")",
      ")",
      "$MiniModelWorkspace = Resolve-ExistingPath $CandidateMiniModelWorkspaces \"MiniModel Rust workspace\" \"Set MINIMODEL_WORKSPACE or edit `$CandidateMiniModelWorkspaces.\"",
      `$PeerImportRequest = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}.minimodel-peer-import-request.json`)}`,
      `$EmbeddedPeerImportRequestBase64 = ${powerShellSingleQuote(requestBase64)}`,
      `$Manifest = Join-Path $PSScriptRoot ${powerShellSingleQuote(manifestFileName)}`,
      `$ManifestUrl = ${powerShellDoubleQuote(manifestUrl)}`,
      `$ImportDir = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}-peer-import`)}`,
      `$ImportedSlm = Join-Path $ImportDir ${powerShellSingleQuote(assembledOutputSlm)}`,
      `$PeerImportReceipt = Join-Path $ImportDir ${powerShellSingleQuote(receiptFileName)}`,
      "$PeerImportReceiptLedger = Join-Path $ImportDir \"import-receipts.v0.json\"",
      `$PeerStatusCheck = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}.peer-status-check.v0.json`)}`,
      `$PeerImportPreflight = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}.peer-import.preflight`)}`,
      `$ExpectedPeerBaseUrl = ${powerShellDoubleQuote(peerUrl)}`,
      "",
      "if (!(Test-Path -LiteralPath $PeerImportRequest)) {",
      "  $EmbeddedPeerImportRequestJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EmbeddedPeerImportRequestBase64))",
      "  [System.IO.File]::WriteAllText($PeerImportRequest, $EmbeddedPeerImportRequestJson, [System.Text.Encoding]::UTF8)",
      "  Write-Host \"Wrote embedded peer import request:\" $PeerImportRequest",
      "}",
      "if ($ManifestUrl.Trim().Length -gt 0 -and !(Test-Path -LiteralPath $Manifest)) {",
      "  Write-Host \"Downloading MiniModel metadata manifest:\" $ManifestUrl",
      "  Invoke-WebRequest -UseBasicParsing -Uri $ManifestUrl -OutFile $Manifest",
      "}",
      "if (!(Test-Path -LiteralPath $Manifest)) {",
      "  throw \"MiniModel manifest missing. Put the metadata manifest at $Manifest or set `$ManifestUrl before running.\"",
      "}",
      "",
      "Write-Host \"MiniModel workspace:\" $MiniModelWorkspace",
      "Write-Host \"Peer import request:\" $PeerImportRequest",
      "Write-Host \"MiniModel manifest:\" $Manifest",
      "Write-Host \"Peer status check:\" $PeerStatusCheck",
      "Write-Host \"Peer import preflight:\" $PeerImportPreflight",
      "Write-Host \"Verified output directory:\" $ImportDir",
      "Write-Host \"Imported .slm:\" $ImportedSlm",
      "Write-Host \"Peer import receipt:\" $PeerImportReceipt",
      "Write-Host \"Peer import receipt ledger:\" $PeerImportReceiptLedger",
      "Set-Location $MiniModelWorkspace",
      "Write-Host \"Expected consenting peer:\" $ExpectedPeerBaseUrl",
      "& cargo run -p minimodel -- inspect-peer-import-request $PeerImportRequest $Manifest",
      "$InspectExitCode = $LASTEXITCODE",
      "if ($InspectExitCode -ne 0) {",
      "  throw \"MiniModel peer import request inspection failed with exit code $InspectExitCode. Check the request JSON and metadata manifest before contacting the peer.\"",
      "}",
      "Write-Host \"Peer import request inspection passed without network access:\" $PeerImportRequest",
      "& cargo run -p minimodel -- check-peer-status $Manifest $ExpectedPeerBaseUrl $PeerStatusCheck",
      "$PeerStatusExitCode = $LASTEXITCODE",
      "if ($PeerStatusExitCode -ne 0) {",
      "  throw \"MiniModel peer status check failed with exit code $PeerStatusExitCode. Check the peer URL, manifest, and $PeerStatusCheck if it exists.\"",
      "}",
      "Write-Host \"Peer status check passed without fetching peer piece bytes:\" $PeerStatusCheck",
      "& cargo run -p minimodel -- inspect-peer-status-check $PeerStatusCheck $Manifest",
      "$PeerStatusInspectExitCode = $LASTEXITCODE",
      "if ($PeerStatusInspectExitCode -ne 0) {",
      "  throw \"MiniModel peer status check inspection failed with exit code $PeerStatusInspectExitCode. Check the saved status check report before preflight.\"",
      "}",
      "Write-Host \"Peer status check inspection passed without fetching peer piece bytes:\" $PeerStatusCheck",
      "& cargo run -p minimodel -- preflight-peer-import-request $PeerImportRequest $Manifest $PeerImportPreflight",
      "$PreflightExitCode = $LASTEXITCODE",
      "if ($PreflightExitCode -ne 0) {",
      "  throw \"MiniModel peer import preflight failed with exit code $PreflightExitCode. Check the peer URL, manifest, and $PeerImportPreflight if it exists.\"",
      "}",
      "Write-Host \"Peer import preflight passed without fetching peer piece bytes:\" $PeerImportPreflight",
      "& cargo run -p minimodel -- inspect-peer-import-preflight $PeerImportPreflight $PeerImportRequest $Manifest",
      "$PreflightInspectExitCode = $LASTEXITCODE",
      "if ($PreflightInspectExitCode -ne 0) {",
      "  throw \"MiniModel peer import preflight inspection failed with exit code $PreflightInspectExitCode. Check the saved preflight report before importing peer pieces.\"",
      "}",
      "Write-Host \"Peer import preflight inspection passed without fetching peer piece bytes:\" $PeerImportPreflight",
      "& cargo run -p minimodel -- import-peer-request $PeerImportRequest $Manifest $ImportDir",
      "$ImportExitCode = $LASTEXITCODE",
      "if ($ImportExitCode -ne 0) {",
      "  throw \"MiniModel peer import failed with exit code $ImportExitCode. The preflight report is $PeerImportPreflight.\"",
      "}",
      "& cargo run -p minimodel -- inspect-import-receipt $PeerImportReceipt $Manifest $ImportedSlm",
      "$ReceiptInspectExitCode = $LASTEXITCODE",
      "if ($ReceiptInspectExitCode -ne 0) {",
      "  throw \"MiniModel import receipt inspection failed with exit code $ReceiptInspectExitCode. The peer import output is $ImportDir.\"",
      "}",
      "Write-Host \"Peer import receipt inspection passed:\" $PeerImportReceipt",
      "& cargo run -p minimodel -- inspect-peer-import-receipt $PeerImportReceipt $PeerImportRequest $PeerImportPreflight $Manifest $ImportedSlm",
      "$PeerReceiptChainExitCode = $LASTEXITCODE",
      "if ($PeerReceiptChainExitCode -ne 0) {",
      "  throw \"MiniModel peer import receipt chain inspection failed with exit code $PeerReceiptChainExitCode. Check the request, preflight report, receipt, and assembled .slm before browser import.\"",
      "}",
      "Write-Host \"Peer import receipt chain inspection passed:\" $PeerImportReceipt",
      "& cargo run -p minimodel -- write-import-receipt-ledger $PeerImportReceiptLedger $PeerImportReceipt $Manifest $ImportedSlm",
      "$ReceiptLedgerWriteExitCode = $LASTEXITCODE",
      "if ($ReceiptLedgerWriteExitCode -ne 0) {",
      "  throw \"MiniModel import receipt ledger write failed with exit code $ReceiptLedgerWriteExitCode. Check the verified receipt, manifest, and assembled .slm.\"",
      "}",
      "Write-Host \"Peer import receipt ledger written:\" $PeerImportReceiptLedger",
      "& cargo run -p minimodel -- inspect-import-receipt-ledger $PeerImportReceiptLedger",
      "$ReceiptLedgerInspectExitCode = $LASTEXITCODE",
      "if ($ReceiptLedgerInspectExitCode -ne 0) {",
      "  throw \"MiniModel import receipt ledger inspection failed with exit code $ReceiptLedgerInspectExitCode. Check the ledger before companion or audit use.\"",
      "}",
      "Write-Host \"Peer import receipt ledger inspection passed:\" $PeerImportReceiptLedger",
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
    downloadTextFile(`${stem}.tinyrustlm-conversion.README.txt`, hfConversionReadme(entry, matches), "text/plain");
    setHfStatus(
      request.local_conversion.source_format === "gguf"
        ? "Rust GGUF conversion kit saved: use a reviewed local .gguf file with F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors, or opt into direct Hugging Face download, then run it to create .slm plus MiniModel P2P metadata"
        : "Rust conversion kit saved: use a reviewed local .safetensors file or shard directory, or opt into direct Hugging Face download, then run it to create .slm plus MiniModel P2P metadata",
      false
    );
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
    const ggufFiles = hfGgufSiblings(entry.result);
    return {
      entry,
      matches,
      slmFiles,
      safetensorsFiles,
      ggufFiles,
      hasPeerOffer: matches.some((match) => Boolean(match.peerOfferRoute)),
      peerOfferMatch: firstPeerOfferMatch(matches),
      p2pMatch: hfP2pImportMatch(matches),
      downloads: hfCountText(entry.result.downloads, "downloads"),
      likes: hfCountText(entry.result.likes, "likes")
    };
  }

  function hfCanStartConversion(view) {
    return Boolean(
      view &&
      (
        (view.safetensorsFiles && view.safetensorsFiles.length) ||
        (view.ggufFiles && view.ggufFiles.length)
      )
    );
  }

  function hfPreferredSourceFormat(view) {
    if (view && Array.isArray(view.safetensorsFiles) && view.safetensorsFiles.length) {
      return "safetensors";
    }
    if (view && Array.isArray(view.ggufFiles) && view.ggufFiles.length) {
      return "gguf";
    }
    return "none";
  }

  function hfPreferredSourceFiles(view) {
    if (hfPreferredSourceFormat(view) === "gguf") {
      return Array.isArray(view.ggufFiles) ? view.ggufFiles : [];
    }
    return view && Array.isArray(view.safetensorsFiles) ? view.safetensorsFiles : [];
  }

  function hfPrimarySafetensorsFile(view) {
    return view && Array.isArray(view.safetensorsFiles) && view.safetensorsFiles.length
      ? view.safetensorsFiles[0]
      : null;
  }

  function hfPrimaryGgufFile(view) {
    return view && Array.isArray(view.ggufFiles) && view.ggufFiles.length
      ? view.ggufFiles[0]
      : null;
  }

  function hfSourceByteSummary(view) {
    const files = hfPreferredSourceFiles(view);
    if (!files.length) {
      return { risk: "none", bytes: null, fileCount: 0 };
    }
    let total = 0;
    for (const file of files) {
      const bytes = Number(file.byte_count);
      if (!Number.isFinite(bytes) || bytes <= 0) {
        return { risk: "unknown", bytes: null, fileCount: files.length };
      }
      total += bytes;
    }
    return {
      risk: total >= hfLargeSourceWarningBytes ? "large" : "normal",
      bytes: total,
      fileCount: files.length
    };
  }

  function hfSourceByteRisk(view) {
    return hfSourceByteSummary(view).risk;
  }

  function hfSourceByteSummaryText(view) {
    const summary = hfSourceByteSummary(view);
    if (!Number.isFinite(summary.bytes)) {
      return summary.fileCount > 1 ? `${summary.fileCount} source files` : "source size unknown";
    }
    const size = formatByteCount(summary.bytes);
    return summary.fileCount > 1 ? `${size} across ${summary.fileCount} source files` : size;
  }

  function hfConversionActionLabel(view) {
    if (hfPreferredSourceFormat(view) === "gguf") {
      return "Review Conversion";
    }
    return hfSourceByteRisk(view) === "normal" ? "Start Conversion" : "Review Conversion";
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
    if (!hfCanStartConversion(view)) {
      return "No supported source listed";
    }
    if (hfSourceByteRisk(view) === "large") {
      return "Large source; P2P preferred";
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return "Source size unknown";
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
      : hfCanStartConversion(view)
        ? hfPreferredSourceFormat(view) === "gguf"
          ? "model card only; GGUF source listed, Rust can convert F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors after local review"
          : hfSourceByteRisk(view) === "large"
            ? "model card only; large source listed, so P2P reuse is preferred before local conversion"
            : hfSourceByteRisk(view) === "unknown"
              ? "model card only; source size unknown, so review before local conversion"
              : "model card only; not runnable here until Rust conversion and local .slm verification"
        : "model card only; no .safetensors or reviewable .gguf source listed for the Rust converter";
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
    if (!hfCanStartConversion(view)) {
      return `Hugging Face model card / ${view.downloads} / no supported .safetensors or reviewable .gguf source listed`;
    }
    if (hfPreferredSourceFormat(view) === "gguf") {
      return `Hugging Face model card / ${view.downloads} / GGUF source listed; Rust tensor review required`;
    }
    if (hfSourceByteRisk(view) === "large") {
      return `Hugging Face model card / ${view.downloads} / large source listed; P2P preferred before local conversion`;
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return `Hugging Face model card / ${view.downloads} / source size unknown; review before local conversion`;
    }
    return `Hugging Face model card / ${view.downloads} / not runnable yet; Rust preflight and conversion required`;
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
    if (!hfCanStartConversion(view)) {
      return "No supported source listed";
    }
    if (hfSourceByteRisk(view) === "large") {
      return "Large source; P2P preferred";
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return "Source size unknown";
    }
    return "Rust conversion required";
  }

  function hfSimpleFallbackNote(view) {
    if (view.p2pMatch) {
      return "Already converted by a listed peer. P2P Import saves a Rust fetch/verify kit; project servers never provide model bytes.";
    }
    if (view.matches.length && state.p2pEnabled === false) {
      return "P2P is disabled for this list, so conversion will use local/manual source files and may take a while.";
    }
    if (view.hasPeerOffer) {
      return "MiniModel has a peer-offer proof. Enter one consenting peer URL in P2P Exchange to import without repeating source conversion.";
    }
    if (!hfCanStartConversion(view)) {
      return "No converted peer, .safetensors source, or reviewable .gguf source is listed yet. Review the model card before choosing a local conversion path.";
    }
    if (hfPreferredSourceFormat(view) === "gguf") {
      return "No converted peer is listed yet. Review Conversion saves a Rust script that inspects the local GGUF first and converts F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensor payloads into a verified .slm before MiniModel sharing.";
    }
    if (hfSourceByteRisk(view) === "large") {
      const size = hfSourceByteSummaryText(view);
      return `Large source listed (${size}). Prefer a MiniModel P2P import when available; local conversion should be an explicit reviewed choice because it may require a large Hugging Face download.`;
    }
    if (hfSourceByteRisk(view) === "unknown") {
      return "Source size is unavailable from metadata. Review the model card before local conversion; P2P reuse is preferred when a verified peer entry appears.";
    }
    return "No converted peer is listed yet. Start Conversion saves a Rust script that turns a reviewed local .safetensors file or shard directory into a verified .slm, prepares peer pieces, and writes metadata so future users can import by P2P.";
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
        `Source file listed: ${safeLocalModelName(file.file_name)}${size}. Use a reviewed local copy, or let the saved script download it directly from Hugging Face after explicit opt-in.`
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

  function appendHfGgufFileNotes(actions, ggufFiles) {
    if (!ggufFiles.length) {
      return;
    }
    for (const file of ggufFiles.slice(0, 2)) {
      const size = Number.isFinite(file.byte_count) && file.byte_count > 0
        ? ` / ${formatByteCount(file.byte_count)}`
        : "";
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `GGUF file listed: ${safeLocalModelName(file.file_name)}${size}. Rust can inspect any GGUF metadata, but conversion only accepts F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors.`
      ));
    }
    if (ggufFiles.length > 2) {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `${ggufFiles.length - 2} more .gguf files listed; Rust review decides whether any tensor layout is compatible.`
      ));
    }
  }

  function appendHfSourceRiskNote(actions, view) {
    const risk = hfSourceByteRisk(view);
    if (risk === "large") {
      const size = hfSourceByteSummaryText(view);
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        `Large source warning: ${size}. Prefer P2P reuse if a verified peer becomes available; local conversion is explicit and may take a while.`
      ));
    } else if (risk === "unknown") {
      actions.append(elementWithText(
        "span",
        "model-result-meta",
        "Source size unavailable in metadata. Review before local conversion; prefer P2P reuse when available."
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
    if (view.safetensorsFiles.length) {
      appendHfSafetensorsFileNotes(actions, view.safetensorsFiles);
    } else if (view.ggufFiles.length) {
      appendHfGgufFileNotes(actions, view.ggufFiles);
    } else {
      appendHfSafetensorsFileNotes(actions, view.safetensorsFiles);
    }
    appendHfSourceRiskNote(actions, view);
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
      actionButton("Save Conversion Request", () => saveHfConversionRequest(entry, view.matches))
    );
    if (hfCanStartConversion(view)) {
      actions.append(actionButton("Save Rust Conversion Script", () => saveHfConversionScript(entry, view.matches)));
    } else {
      actions.append(elementWithText("span", "model-result-meta", "Rust script unavailable until metadata lists a .safetensors source or reviewable .gguf source."));
    }
  }

  function appendHfSimpleActions(actions, entry, view) {
    actions.append(externalActionLink("Review Model Card", hfModelUrl(entry.modelId)));
    actions.append(elementWithText("span", hfCompatibilityClass(view), hfSimpleCompatibilityText(view)));
    const p2pActionMatch = hfEnabledP2pActionMatch(view);
    if (p2pActionMatch) {
      appendActionIfPresent(actions, p2pCatalogActionButton(p2pActionMatch));
      return;
    }
    if (!hfCanStartConversion(view)) {
      return;
    }
    actions.append(actionButton(hfConversionActionLabel(view), () => startHfConversion(entry, view.matches), "primary-result-action"));
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
          const routeResult = await applyCatalogAnnouncementRoutes(announcementRoutes);
          setCatalogStatus(`${state.catalogEntries.length} metadata entries; ${catalogAnnouncementRouteStatusText(routeResult)}`, false);
        } catch (error) {
          // Keep the base proof-ready metadata, but fail closed on optional peer sources.
          const message = error && error.message ? error.message : "peer-source announcement metadata unavailable";
          setCatalogStatus(`${state.catalogEntries.length} metadata entries; peer-source announcement feed ignored: ${message}`, true);
        }
      } else {
        setCatalogStatus(`${state.catalogEntries.length} metadata entries`, false);
      }
    } catch (_error) {
      state.catalogEntries = [];
    }
  }

  function hfConversionRequest(entry, matches) {
    const slmFiles = hfSlmSiblings(entry.result);
    const safetensorsFiles = hfSafetensorsSiblings(entry.result);
    const ggufFiles = hfGgufSiblings(entry.result);
    const sourceFormat = safetensorsFiles.length ? "safetensors" : ggufFiles.length ? "gguf" : "safetensors";
    const preferredFiles = sourceFormat === "gguf" ? ggufFiles : safetensorsFiles;
    const suggestedSourceFile = preferredFiles.length ? preferredFiles[0].file_name : null;
    const suggestedSource = preferredFiles.length ? preferredFiles[0] : null;
    const sourceInputMode = sourceFormat === "gguf"
      ? "single-gguf-file"
      : safetensorsFiles.length > 1
      ? "safetensors-shard-directory"
      : suggestedSourceFile
        ? "single-safetensors-file"
        : "reviewed-local-safetensors";
    const defaultShape = "tinylm16-bpe";
    const defaultQuantization = "q8_0";
    const knownPeerBaseUrl = state.p2pEnabled !== false ? state.peerBaseUrl || "" : "";
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
        discovered_safetensors_files: safetensorsFiles,
        discovered_gguf_files: ggufFiles
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
        source_format: sourceFormat,
        source_input_mode: sourceInputMode,
        required_local_input: sourceFormat === "gguf"
          ? `A reviewed local GGUF file matching ${suggestedSourceFile || "the selected source"} with F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors, or an explicit local-script Hugging Face download with TINYRUSTLM_ALLOW_HF_DOWNLOAD=1. GGUF conversion still requires supported tensor names/shapes.`
          : safetensorsFiles.length > 1
          ? `A reviewed local source directory containing all ${safetensorsFiles.length} listed .safetensors shards, or an explicit local-script Hugging Face download with TINYRUSTLM_ALLOW_HF_DOWNLOAD=1.`
          : suggestedSourceFile
            ? `A reviewed local copy of ${suggestedSourceFile}, or an explicit local-script Hugging Face download with TINYRUSTLM_ALLOW_HF_DOWNLOAD=1.`
            : "A user-selected .safetensors file or shard directory already present on this machine.",
        suggested_source_safetensors_file: sourceFormat === "safetensors" ? suggestedSourceFile : null,
        suggested_source_safetensors_files: safetensorsFiles.map((file) => ({
          file_name: file.file_name,
          download_url: file.download_url || null,
          sha256: file.sha256 || null,
          byte_count: Number.isFinite(file.byte_count) ? file.byte_count : null
        })),
        suggested_source_safetensors_url: sourceFormat === "safetensors" && suggestedSource ? suggestedSource.download_url : null,
        suggested_source_safetensors_sha256: sourceFormat === "safetensors" && suggestedSource ? suggestedSource.sha256 : null,
        suggested_source_safetensors_byte_count: sourceFormat === "safetensors" && suggestedSource ? suggestedSource.byte_count : null,
        suggested_source_gguf_file: sourceFormat === "gguf" ? suggestedSourceFile : null,
        suggested_source_gguf_files: ggufFiles.map((file) => ({
          file_name: file.file_name,
          download_url: file.download_url || null,
          sha256: file.sha256 || null,
          byte_count: Number.isFinite(file.byte_count) ? file.byte_count : null
        })),
        suggested_source_gguf_url: sourceFormat === "gguf" && suggestedSource ? suggestedSource.download_url : null,
        suggested_source_gguf_sha256: sourceFormat === "gguf" && suggestedSource ? suggestedSource.sha256 : null,
        suggested_source_gguf_byte_count: sourceFormat === "gguf" && suggestedSource ? suggestedSource.byte_count : null,
        source_acquisition_rule: "Browser search is metadata-only. The generated local PowerShell kit uses an existing reviewed local file by default, or downloads directly from Hugging Face only when the user explicitly sets TINYRUSTLM_ALLOW_HF_DOWNLOAD=1.",
        command_shape: sourceFormat === "gguf"
          ? `cargo run -p tinyrustlm-slm-pack -- convert-gguf-trained <input.gguf> ${defaultShape} <output-source-dir> <output.slm> ${defaultQuantization}`
          : `cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request <request.json> <input.safetensors-or-directory> <output-dir> ${defaultShape} ${defaultQuantization}`,
        request_inspect_shape: "cargo run -p tinyrustlm-slm-pack -- inspect-huggingface-conversion-request <request.json> [output.report]",
        peer_share_shape: "cargo run -p minimodel -- prepare-peer-share <output.slm> <share-dir> <minimodel-model-id> [source-huggingface-model-id] [known-peer-base-url]",
        peer_source_shape: "cargo run -p minimodel -- add-peer-source <catalog-entry-json> <output-json> <known-peer-base-url>",
        peer_source_announcement_shape: "cargo run -p minimodel -- write-peer-source-announcement <catalog-entry-json> <announcement-json> <known-peer-base-url>",
        peer_source_announcement_feed_shape: "cargo run -p minimodel -- write-peer-source-announcement-feed <feed-json> <announcement-json>...",
        peer_source_announcement_feed_inspect_shape: "cargo run -p minimodel -- inspect-peer-source-announcement-feed <feed-json>",
        peer_source_apply_shape: "cargo run -p minimodel -- apply-peer-source-announcements <catalog-entry-json> <output-json> <announcement-json>...",
      peer_source_batch_snapshot_shape: "cargo run -p minimodel -- write-catalog-snapshot-with-announcements <models.v0.json> <catalog-entry-json>... --announcements <announcement-json>...",
      peer_source_feed_snapshot_shape: "cargo run -p minimodel -- write-catalog-snapshot-with-announcement-feed <models.v0.json> <feed-route> <feed-json> <catalog-entry-json>...",
      peer_companion_state_shape: "cargo run -p minimodel -- write-peer-companion-state <manifest> <piece-dir> <state-json> <known-peer-base-url>",
      peer_companion_state_inspect_shape: "cargo run -p minimodel -- inspect-peer-companion-state <state-json> <manifest> <piece-dir>",
      peer_contact_card_shape: "cargo run -p minimodel -- write-peer-contact-card <peer-card-json> <known-peer-base-url> [peer-label]",
      peer_contact_book_shape: "cargo run -p minimodel -- write-peer-contact-book <peer-book-json> <peer-card-json>...",
      peer_companion_inventory_shape: "cargo run -p minimodel -- write-peer-companion-inventory <inventory-json> <state-json> <manifest> <piece-dir> <receipt-ledger-json> <piece-store-quota-bytes> [contact-card-json...]",
      peer_companion_inventory_inspect_shape: "cargo run -p minimodel -- inspect-peer-companion-inventory <inventory-json>",
      catalog_snapshot_shape: "cargo run -p minimodel -- write-catalog-snapshot <models.v0.json> <catalog-entry-json>...",
      catalog_snapshot_inspect_shape: "cargo run -p minimodel -- inspect-catalog-snapshot <models.v0.json>",
        known_peer_base_url: knownPeerBaseUrl || null,
        known_peer_rule: "When P2P is enabled and a consenting Known peer URL is set in TinyRustLM, the generated conversion script uses it to write peer-source announcement/feed metadata and peer-companion-state handoff metadata after local Rust conversion.",
        compatibility_rule: sourceFormat === "gguf"
          ? "The Rust GGUF planner/converter must accept F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors, common Llama/TinyRustLM tensor names, and the exact TinyRustLM shape before a .slm is usable. MiniModel prepare-peer-share then writes the manifest, peer-offer proof, local peer pieces, and catalog entry from the verified .slm."
          : "The Rust planner/converter must accept the safetensors tensor names and exact TinyRustLM shape before a .slm is usable. MiniModel prepare-peer-share then writes the manifest, peer-offer proof, local peer pieces, and catalog entry from the verified .slm."
      },
      conversion_gates: [
        "source license and model-card review",
        "config/tokenizer checksum capture",
        sourceFormat === "gguf" ? "GGUF metadata and tensor-directory inspection" : "safetensors/source artifact checksum capture",
        "local conversion to .slm",
        "tinyrustlm-slm-pack validate",
        "MiniModel prepare-peer-share",
        "MiniModel add-peer-source when peer availability is known later",
        "MiniModel write-peer-source-announcement for catalog-maintainer P2P availability",
        "MiniModel write-peer-source-announcement-feed for browser-visible availability metadata",
        "MiniModel inspect-peer-source-announcement-feed before feed-bound catalog publication",
        "MiniModel write-peer-companion-state for local companion handoff metadata",
        "MiniModel inspect-peer-companion-state before publishing or serving companion handoff metadata",
        "MiniModel write-peer-companion-inventory for local companion handoff metadata",
        "MiniModel inspect-peer-companion-inventory before trusting companion inventory metadata",
        "MiniModel apply-peer-source-announcements before shared metadata snapshots",
        "MiniModel write-catalog-snapshot-with-announcements for batch maintainer publication",
        "MiniModel write-catalog-snapshot-with-announcement-feed for checksum-bound feed publication",
        "MiniModel write-catalog-snapshot",
        "MiniModel inspect-catalog-snapshot before publishing or loading metadata snapshots",
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
        browser_downloads_huggingface_model_bytes: false,
        local_script_huggingface_download_requires_explicit_opt_in: true,
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

  function base64Utf8(value) {
    const bytes = state.encoder.encode(String(value || ""));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
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

  function hfGgufConversionScript(entry, request, requestBase64, serveScriptBase64) {
    const stem = conversionFileStem(entry.modelId);
    const sourceShape = request.requested_artifact.default_source_shape;
    const quantization = request.requested_artifact.default_quantization;
    const knownPeerBaseUrl = request.local_conversion.known_peer_base_url || "";
    const modelUrl = hfModelUrl(entry.modelId);
    const minimodelModelId = minimodelModelIdForHf(entry.modelId);
    const ggufFiles = Array.isArray(request.source.discovered_gguf_files)
      ? request.source.discovered_gguf_files
      : [];
    const suggestedSourceFile = request.local_conversion.suggested_source_gguf_file || "model.gguf";
    const suggestedSourceUrl = request.local_conversion.suggested_source_gguf_url || "";
    const suggestedSourceSha256 = request.local_conversion.suggested_source_gguf_sha256 || "";
    const suggestedSourceByteCount = Number.isFinite(request.local_conversion.suggested_source_gguf_byte_count)
      ? String(request.local_conversion.suggested_source_gguf_byte_count)
      : "";
    const suggestedSourceEntries = ggufFiles.length
      ? ggufFiles
      : [{
        file_name: suggestedSourceFile,
        download_url: suggestedSourceUrl,
        sha256: suggestedSourceSha256,
        byte_count: Number.isFinite(Number(suggestedSourceByteCount)) ? Number(suggestedSourceByteCount) : null
      }];
    const suggestedSourceEntryLines = suggestedSourceEntries
      .filter((file) => file && file.file_name)
      .map((file) => {
        const byteCount = Number.isFinite(file.byte_count) ? String(file.byte_count) : "";
        return `  @{ Name = ${powerShellSingleQuote(file.file_name)}; Url = ${powerShellDoubleQuote(file.download_url || "")}; Sha256 = ${powerShellDoubleQuote(file.sha256 || "")}; ByteCount = ${powerShellDoubleQuote(byteCount)} }`;
      });
    const sourceCandidateLines = ggufFiles.length
      ? ggufFiles.map((file) => {
        const size = Number.isFinite(file.byte_count) && file.byte_count > 0
          ? ` / ${formatByteCount(file.byte_count)}`
          : "";
        const hash = file.sha256 ? ` / ${file.sha256}` : "";
        return `#   - ${file.file_name}${size}${hash}`;
      })
      : ["#   - no .gguf sibling listed by metadata; inspect the model card before choosing a local GGUF file."];
    const lines = [
      "# TinyRustLM Hugging Face GGUF to .slm conversion script",
      `# Source model: ${entry.modelId}`,
      `# Model card: ${modelUrl}`,
      "#",
      "# Hugging Face metadata GGUF candidates:",
      ...sourceCandidateLines,
      "#",
      "# This script first runs inspect-gguf and plan-gguf-source.",
      "# Conversion supports F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K GGUF tensors that match a TinyRustLM source shape.",
      "# GGUF conversion still requires supported tensor names/shapes, tokenizer token-count compatibility, BPE token/merge import when declared, and Rust validation before .slm import.",
      "# To let this script download the suggested source directly from Hugging Face to this machine,",
      "# set TINYRUSTLM_ALLOW_HF_DOWNLOAD=1 before running it. That download never uses TinyRustLM,",
      "# MiniModel, or project servers as a proxy/cache/host.",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "function Resolve-ExistingPath {",
      "  param([string[]] $Candidates, [string] $Label, [string] $Help)",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate) { return (Resolve-Path -LiteralPath $Candidate).Path }",
      "  }",
      "  throw \"$Label not found. $Help\"",
      "}",
      "",
      "function Resolve-SourceGgufInput {",
      "  param([string[]] $Candidates)",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate -PathType Leaf) { return (Resolve-Path -LiteralPath $Candidate).Path }",
      "  }",
      "  return \"\"",
      "}",
      "",
      "function Assert-DownloadedSourceEvidence {",
      "  param([string] $Path, [string] $ExpectedSha256, [string] $ExpectedByteCount)",
      "  if (![string]::IsNullOrWhiteSpace($ExpectedByteCount)) {",
      "    $ActualByteCount = (Get-Item -LiteralPath $Path).Length",
      "    if ($ActualByteCount -ne [Int64]$ExpectedByteCount) { throw \"Downloaded source byte count mismatch: expected $ExpectedByteCount, got $ActualByteCount\" }",
      "  }",
      "  if (![string]::IsNullOrWhiteSpace($ExpectedSha256)) {",
      "    $Expected = $ExpectedSha256 -replace '^sha256:', ''",
      "    $Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()",
      "    if ($Actual -ne $Expected.ToLowerInvariant()) { throw \"Downloaded source SHA-256 mismatch: expected $Expected, got $Actual\" }",
      "  }",
      "}",
      "",
      "function Resolve-GeneratedFile {",
      "  param([string] $Directory, [string] $Filter, [string] $Label)",
      "  $Matches = @(Get-ChildItem -LiteralPath $Directory -File -Filter $Filter | Sort-Object LastWriteTimeUtc -Descending)",
      "  if ($Matches.Count -lt 1) { throw \"$Label was not produced in $Directory\" }",
      "  return $Matches[0].FullName",
      "}",
      "",
      "function Resolve-GeneratedDirectory {",
      "  param([string] $Directory, [string] $Filter, [string] $Label)",
      "  $Matches = @(Get-ChildItem -LiteralPath $Directory -Directory -Filter $Filter | Sort-Object LastWriteTimeUtc -Descending)",
      "  if ($Matches.Count -lt 1) { throw \"$Label was not produced in $Directory\" }",
      "  return $Matches[0].FullName",
      "}",
      "",
      "# Optional overrides:",
      "#   $env:TINYRUSTLM_WORKSPACE = full path to SLMComposer.com / TinyRustLM Rust workspace",
      "#   $env:MINIMODEL_WORKSPACE = full path to MiniModel.org Rust workspace",
      "#   $env:TINYRUSTLM_SOURCE_GGUF = full path to your reviewed local GGUF file",
      "#   $env:TINYRUSTLM_ALLOW_HF_DOWNLOAD = 1 to download the suggested GGUF directly from Hugging Face",
      "$CandidateTinyRustLMWorkspaces = @(",
      "  $env:TINYRUSTLM_WORKSPACE,",
      "  $env:SLMCOMPOSER_WORKSPACE,",
      "  \"E:/Source/Rust/SLMComposer.com\",",
      "  (Join-Path $PSScriptRoot \"SLMComposer.com\"),",
      "  (Join-Path $PSScriptRoot \"..\\SLMComposer.com\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\SLMComposer.com\")",
      ")",
      "$CandidateMiniModelWorkspaces = @(",
      "  $env:MINIMODEL_WORKSPACE,",
      "  \"E:/Source/Rust/MiniModel.org\",",
      "  (Join-Path $PSScriptRoot \"MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\MiniModel.org\")",
      ")",
      `$SuggestedSourceGgufFileName = ${powerShellSingleQuote(suggestedSourceFile)}`,
      "$SuggestedSourceGgufFiles = @(",
      ...(suggestedSourceEntryLines.length ? suggestedSourceEntryLines : []),
      ")",
      `$ConversionRequest = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}.minimodel-conversion-request.json`)}`,
      `$EmbeddedConversionRequestBase64 = ${powerShellSingleQuote(requestBase64)}`,
      `$EmbeddedServePeerPiecesScriptBase64 = ${powerShellSingleQuote(serveScriptBase64)}`,
      "$SourceGgufCandidates = @(",
      "  $env:TINYRUSTLM_SOURCE_GGUF,",
      "  (Join-Path $PSScriptRoot $SuggestedSourceGgufFileName),",
      "  (Join-Path $PSScriptRoot (Join-Path \"source\" $SuggestedSourceGgufFileName))",
      ")",
      "$TinyRustLMWorkspace = Resolve-ExistingPath $CandidateTinyRustLMWorkspaces \"TinyRustLM Rust workspace\" \"Set TINYRUSTLM_WORKSPACE or edit `$CandidateTinyRustLMWorkspaces.\"",
      "$MiniModelWorkspace = Resolve-ExistingPath $CandidateMiniModelWorkspaces \"MiniModel Rust workspace\" \"Set MINIMODEL_WORKSPACE or edit `$CandidateMiniModelWorkspaces.\"",
      "$SourceGguf = Resolve-SourceGgufInput $SourceGgufCandidates",
      "if ([string]::IsNullOrWhiteSpace($SourceGguf) -and $env:TINYRUSTLM_ALLOW_HF_DOWNLOAD -eq \"1\" -and $SuggestedSourceGgufFiles.Count -gt 0) {",
      "  $Source = $SuggestedSourceGgufFiles[0]",
      "  if ([string]::IsNullOrWhiteSpace($Source.Name) -or [string]::IsNullOrWhiteSpace($Source.Url)) { throw \"Hugging Face metadata did not include a download URL for the listed GGUF source.\" }",
      "  $DownloadDir = Join-Path $PSScriptRoot \"source\"",
      "  New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null",
      "  $DownloadTarget = Join-Path $DownloadDir $Source.Name",
      "  Write-Host \"Downloading Hugging Face GGUF source directly to this machine:\" $Source.Url",
      "  Invoke-WebRequest -UseBasicParsing -Uri $Source.Url -OutFile $DownloadTarget",
      "  Assert-DownloadedSourceEvidence $DownloadTarget $Source.Sha256 $Source.ByteCount",
      "  $SourceGguf = Resolve-SourceGgufInput @($DownloadTarget)",
      "}",
      "if ([string]::IsNullOrWhiteSpace($SourceGguf)) {",
      "  throw \"Reviewed source GGUF input not found. Put the file beside this script, put it under ./source/, set TINYRUSTLM_SOURCE_GGUF, or set TINYRUSTLM_ALLOW_HF_DOWNLOAD=1 to download the suggested GGUF directly to this machine.\"",
      "}",
      `$SourceShape = ${powerShellSingleQuote(sourceShape)}`,
      `$Quantization = ${powerShellSingleQuote(quantization)}`,
      `$ModelId = ${powerShellSingleQuote(entry.modelId)}`,
      `$MiniModelModelId = ${powerShellSingleQuote(minimodelModelId)}`,
      `$KnownPeerBaseUrl = ${powerShellDoubleQuote(knownPeerBaseUrl)} # Optional, for example ${peerExampleUrl}`,
      `$WorkDir = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}-tinyrustlm-gguf-conversion`)}`,
      "$ConversionRequestInspect = Join-Path $WorkDir \"tinyrustlm-conversion.request.inspect\"",
      "$GgufSourceDir = Join-Path $WorkDir \"gguf-raw-source\"",
      "$GgufInspect = Join-Path $WorkDir \"source.gguf.inspect\"",
      "$GgufPlan = Join-Path $WorkDir \"source.gguf.plan\"",
      `$OutputSlm = Join-Path $WorkDir ${powerShellSingleQuote(`${stem}-gguf-converted-${quantization}.slm`)}`,
      "$MiniModelShareDir = Join-Path $WorkDir \"minimodel-peer-share\"",
      "$MiniModelCatalogSnapshot = Join-Path $WorkDir \"models.v0.json\"",
      `$MiniModelServeScript = Join-Path $WorkDir ${powerShellSingleQuote(`${stem}.minimodel-serve-peer-pieces.ps1`)}`,
      "",
      "if (!(Test-Path -LiteralPath $ConversionRequest)) {",
      "  $EmbeddedConversionRequestJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EmbeddedConversionRequestBase64))",
      "  [System.IO.File]::WriteAllText($ConversionRequest, $EmbeddedConversionRequestJson, [System.Text.Encoding]::UTF8)",
      "  Write-Host \"Wrote embedded conversion request:\" $ConversionRequest",
      "}",
      "New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null",
      "$EmbeddedServeScriptText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EmbeddedServePeerPiecesScriptBase64))",
      "[System.IO.File]::WriteAllText($MiniModelServeScript, $EmbeddedServeScriptText, [System.Text.Encoding]::UTF8)",
      "Write-Host \"TinyRustLM workspace:\" $TinyRustLMWorkspace",
      "Write-Host \"MiniModel workspace:\" $MiniModelWorkspace",
      "Write-Host \"Conversion request:\" $ConversionRequest",
      "Write-Host \"Source GGUF:\" $SourceGguf",
      "Write-Host \"Output directory:\" $WorkDir",
      "Set-Location $TinyRustLMWorkspace",
      "& cargo run -p tinyrustlm-slm-pack -- inspect-huggingface-conversion-request $ConversionRequest $ConversionRequestInspect",
      "$ConversionRequestInspectExitCode = $LASTEXITCODE",
      "if ($ConversionRequestInspectExitCode -ne 0) { throw \"Hugging Face conversion request inspection failed with exit code $ConversionRequestInspectExitCode. Check the request JSON before inspecting or converting local source bytes.\" }",
      "Write-Host \"Conversion request inspection:\" $ConversionRequestInspect",
      "& cargo run -p tinyrustlm-slm-pack -- inspect-gguf $SourceGguf $GgufInspect",
      "& cargo run -p tinyrustlm-slm-pack -- plan-gguf-source $SourceGguf $SourceShape $GgufPlan",
      "& cargo run -p tinyrustlm-slm-pack -- convert-gguf-trained $SourceGguf $SourceShape $GgufSourceDir $OutputSlm $Quantization",
      "$ConversionExitCode = $LASTEXITCODE",
      "if ($ConversionExitCode -ne 0) { throw \"GGUF conversion failed with exit code $ConversionExitCode. check $GgufInspect and $GgufPlan for tensor-name, shape, tokenizer, or validation mismatch.\" }",
      "$OutputManifest = \"$OutputSlm.manifest\"",
      "& cargo run -p tinyrustlm-slm-pack -- validate $OutputSlm",
      "& cargo run -p tinyrustlm-slm-pack -- validate-manifest $OutputSlm $OutputManifest",
      "",
      "Set-Location $MiniModelWorkspace",
      "$PrepareArgs = @(\"run\", \"-p\", \"minimodel\", \"--\", \"prepare-peer-share\", $OutputSlm, $MiniModelShareDir, $MiniModelModelId, $ModelId)",
      "& cargo @PrepareArgs",
      "$MiniModelCatalogEntry = Resolve-GeneratedFile $MiniModelShareDir \"*.catalog-entry.v0.json\" \"MiniModel catalog entry\"",
      "$MiniModelManifest = Resolve-GeneratedFile $MiniModelShareDir \"*.minimodel.manifest.v0\" \"MiniModel manifest\"",
      "$MiniModelPieceDir = Resolve-GeneratedDirectory $MiniModelShareDir \"*.peer-pieces\" \"MiniModel peer pieces\"",
      "$CatalogStem = ([System.IO.Path]::GetFileNameWithoutExtension($MiniModelCatalogEntry)) -replace \"\\.catalog-entry\\.v0$\", \"\"",
      "$MiniModelCatalogEntryWithPeer = Join-Path $MiniModelShareDir \"$CatalogStem.catalog-entry.with-peer.v0.json\"",
      "$MiniModelPeerSourceAnnouncement = Join-Path $MiniModelShareDir \"$CatalogStem.peer-source-announcement.v0.json\"",
      "$MiniModelPeerSourceAnnouncementFeed = Join-Path $MiniModelShareDir \"peer-source-announcements.v0.json\"",
      "$MiniModelPeerCompanionState = Join-Path $MiniModelShareDir \"$CatalogStem.peer-companion-state.v0.json\"",
      "$MiniModelPeerContactCard = Join-Path $MiniModelShareDir \"$CatalogStem.peer-contact-card.v0.json\"",
      "$MiniModelPeerContactBook = Join-Path $MiniModelShareDir \"$CatalogStem.peer-contact-book.v0.json\"",
      "$MiniModelPeerCompanionInventory = Join-Path $MiniModelShareDir \"$CatalogStem.peer-companion-inventory.v0.json\"",
      "$MiniModelLocalImportReceipt = Join-Path $MiniModelShareDir \"$CatalogStem.local.minimodel-receipt\"",
      "$MiniModelImportReceiptLedger = Join-Path $MiniModelShareDir \"import-receipts.v0.json\"",
      "$MiniModelCatalogSnapshotWithFeed = Join-Path $WorkDir \"models.with-announcement-feed.v0.json\"",
      "$MiniModelPublishReadme = Join-Path $MiniModelShareDir \"converted-gguf-p2p-publish.README.txt\"",
      "$OutputSlmByteCount = (Get-Item -LiteralPath $OutputSlm).Length",
      "cargo run -p minimodel -- write-import-receipt $MiniModelManifest $OutputSlm $MiniModelLocalImportReceipt",
      "cargo run -p minimodel -- inspect-import-receipt $MiniModelLocalImportReceipt $MiniModelManifest $OutputSlm",
      "cargo run -p minimodel -- write-import-receipt-ledger $MiniModelImportReceiptLedger $MiniModelLocalImportReceipt $MiniModelManifest $OutputSlm",
      "cargo run -p minimodel -- inspect-import-receipt-ledger $MiniModelImportReceiptLedger",
      "$MiniModelCatalogEntryForSnapshot = $MiniModelCatalogEntry",
      "if ($KnownPeerBaseUrl.Trim().Length -gt 0) {",
      "  cargo run -p minimodel -- add-peer-source $MiniModelCatalogEntry $MiniModelCatalogEntryWithPeer $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-source-announcement $MiniModelCatalogEntry $MiniModelPeerSourceAnnouncement $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-source-announcement-feed $MiniModelPeerSourceAnnouncementFeed $MiniModelPeerSourceAnnouncement",
      "  cargo run -p minimodel -- inspect-peer-source-announcement-feed $MiniModelPeerSourceAnnouncementFeed",
      "  cargo run -p minimodel -- write-catalog-snapshot-with-announcement-feed $MiniModelCatalogSnapshotWithFeed \"peer-source-announcements.v0.json\" $MiniModelPeerSourceAnnouncementFeed $MiniModelCatalogEntry",
      "  cargo run -p minimodel -- inspect-catalog-snapshot $MiniModelCatalogSnapshotWithFeed",
      "  cargo run -p minimodel -- write-peer-companion-state $MiniModelManifest $MiniModelPieceDir $MiniModelPeerCompanionState $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- inspect-peer-companion-state $MiniModelPeerCompanionState $MiniModelManifest $MiniModelPieceDir",
      "  cargo run -p minimodel -- write-peer-contact-card $MiniModelPeerContactCard $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-contact-book $MiniModelPeerContactBook $MiniModelPeerContactCard",
      "  cargo run -p minimodel -- inspect-peer-contact-book $MiniModelPeerContactBook",
      "  cargo run -p minimodel -- write-peer-companion-inventory $MiniModelPeerCompanionInventory $MiniModelPeerCompanionState $MiniModelManifest $MiniModelPieceDir $MiniModelImportReceiptLedger $OutputSlmByteCount $MiniModelPeerContactCard",
      "  cargo run -p minimodel -- inspect-peer-companion-inventory $MiniModelPeerCompanionInventory",
      "  $MiniModelCatalogEntryForSnapshot = $MiniModelCatalogEntryWithPeer",
      "}",
      "cargo run -p minimodel -- write-catalog-snapshot $MiniModelCatalogSnapshot $MiniModelCatalogEntryForSnapshot",
      "cargo run -p minimodel -- inspect-catalog-snapshot $MiniModelCatalogSnapshot",
      "$PublishReadmeLines = @(",
      "  \"Converted GGUF P2P publication package\"",
      "  \"\"",
      "  \"Safe metadata files for catalog maintainers:\"",
      "  \"- Catalog entry: $MiniModelCatalogEntry\"",
      "  \"- Catalog snapshot: $MiniModelCatalogSnapshot\"",
      "  \"- Peer-source announcement/feed JSON when KnownPeerBaseUrl is set\"",
      "  \"- Peer contact card/book JSON when KnownPeerBaseUrl is set\"",
      "  \"\"",
      "  \"Local companion handoff files:\"",
      "  \"- Peer companion state: $MiniModelPeerCompanionState (created when KnownPeerBaseUrl is set; metadata only, no model bytes)\"",
      "  \"- Import receipt ledger: $MiniModelImportReceiptLedger (metadata only, no model bytes)\"",
      "  \"- Peer companion inventory: $MiniModelPeerCompanionInventory (created when KnownPeerBaseUrl is set; metadata only, no model bytes or peer pieces)\"",
      "  \"\"",
      "  \"Do not send .slm files, *.peer-pieces directories, or source GGUF files to project servers.\"",
      "  \"F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K GGUF tensors can convert; GGUF conversion still requires supported tensor names/shapes, tokenizer token-count compatibility, BPE token/merge import when declared, and Rust validation before .slm import.\"",
      ")",
      "[System.IO.File]::WriteAllLines($MiniModelPublishReadme, $PublishReadmeLines, [System.Text.Encoding]::UTF8)",
      "Write-Host \"Converted .slm:\" $OutputSlm",
      "Write-Host \"GGUF inspection:\" $GgufInspect",
      "Write-Host \"GGUF source plan:\" $GgufPlan",
      "Write-Host \"MiniModel manifest:\" $MiniModelManifest",
      "Write-Host \"MiniModel peer pieces:\" $MiniModelPieceDir",
      "Write-Host \"MiniModel local import receipt:\" $MiniModelLocalImportReceipt",
      "Write-Host \"MiniModel import receipt ledger:\" $MiniModelImportReceiptLedger",
      "Write-Host \"MiniModel catalog snapshot:\" $MiniModelCatalogSnapshot",
      "Write-Host \"MiniModel peer companion inventory:\" $MiniModelPeerCompanionInventory",
      "Write-Host \"MiniModel serve script:\" $MiniModelServeScript",
      "Write-Host \"Converted GGUF publication notes:\" $MiniModelPublishReadme",
      "Write-Host \"If you consent to serve pieces from this machine, run:\"",
      "Write-Host \"powershell -ExecutionPolicy Bypass -File '$MiniModelServeScript'\"",
      "Write-Host \"Next: open TinyRustLM.com, choose Your Local Files, and import the converted .slm.\"",
      ""
    ];
    return lines.join("\n");
  }

  function hfConversionScript(entry, matches) {
    const request = hfConversionRequest(entry, matches);
    const requestJson = `${JSON.stringify(request, null, 2)}\n`;
    const requestBase64 = base64Utf8(requestJson);
    const stem = conversionFileStem(entry.modelId);
    const sourceShape = request.requested_artifact.default_source_shape;
    const quantization = request.requested_artifact.default_quantization;
    const knownPeerBaseUrl = request.local_conversion.known_peer_base_url || "";
    const modelUrl = hfModelUrl(entry.modelId);
    const minimodelModelId = minimodelModelIdForHf(entry.modelId);
    const serveScriptBase64 = base64Utf8(miniModelServePeerPiecesScript({
      scriptTitle: "TinyRustLM converted Hugging Face MiniModel peer serving helper",
      modelId: minimodelModelId,
      shareDirRelativePath: "minimodel-peer-share"
    }));
    if (request.local_conversion.source_format === "gguf") {
      return hfGgufConversionScript(entry, request, requestBase64, serveScriptBase64);
    }
    const safetensorsFiles = Array.isArray(request.source.discovered_safetensors_files)
      ? request.source.discovered_safetensors_files
      : [];
    const suggestedSourceFile = request.local_conversion.suggested_source_safetensors_file || "model.safetensors";
    const suggestedSourceUrl = request.local_conversion.suggested_source_safetensors_url || "";
    const suggestedSourceSha256 = request.local_conversion.suggested_source_safetensors_sha256 || "";
    const suggestedSourceByteCount = Number.isFinite(request.local_conversion.suggested_source_safetensors_byte_count)
      ? String(request.local_conversion.suggested_source_safetensors_byte_count)
      : "";
    const suggestedSourceEntries = safetensorsFiles.length
      ? safetensorsFiles
      : [{
        file_name: suggestedSourceFile,
        download_url: suggestedSourceUrl,
        sha256: suggestedSourceSha256,
        byte_count: Number.isFinite(Number(suggestedSourceByteCount)) ? Number(suggestedSourceByteCount) : null
      }];
    const suggestedSourceEntryLines = suggestedSourceEntries
      .filter((file) => file && file.file_name)
      .map((file) => {
        const byteCount = Number.isFinite(file.byte_count) ? String(file.byte_count) : "";
        return `  @{ Name = ${powerShellSingleQuote(file.file_name)}; Url = ${powerShellDoubleQuote(file.download_url || "")}; Sha256 = ${powerShellDoubleQuote(file.sha256 || "")}; ByteCount = ${powerShellDoubleQuote(byteCount)} }`;
      });
    const sourceCandidateLines = safetensorsFiles.length
      ? safetensorsFiles.map((file) => {
        const size = Number.isFinite(file.byte_count) && file.byte_count > 0
          ? ` / ${formatByteCount(file.byte_count)}`
          : "";
        const hash = file.sha256 ? ` / ${file.sha256}` : "";
        return `#   - ${file.file_name}${size}${hash}`;
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
      "# By default this script uses a reviewed local source input and does not download model bytes.",
      "# To let this script download the suggested source directly from Hugging Face to this machine,",
      "# set TINYRUSTLM_ALLOW_HF_DOWNLOAD=1 before running it. That download never uses TinyRustLM,",
      "# MiniModel, or project servers as a proxy/cache/host.",
      "# You can also put the reviewed source file beside this script, under ./source/,",
      "# or put every listed shard under ./source/ when the metadata lists multiple .safetensors files,",
      "# or set TINYRUSTLM_SOURCE_SAFETENSORS to its full local file or shard directory path.",
      "# If the Rust planner rejects the file, this model is not currently compatible",
      "# with the selected TinyRustLM source shape.",
      "# When that happens, read tinyrustlm-conversion.preflight in the output folder;",
      "# it is the durable Rust report explaining why no .slm was produced.",
      "# The embedded serve helper inspects peer-companion state before serve-peer-companion, otherwise it runs serve-peer-pieces.",
      "# Project servers are not serving, proxying, caching, or running these model bytes.",
      "",
      "$ErrorActionPreference = \"Stop\"",
      "",
      "function Resolve-ExistingPath {",
      "  param(",
      "    [string[]] $Candidates,",
      "    [string] $Label,",
      "    [string] $Help",
      "  )",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "  }",
      "  throw \"$Label not found. $Help\"",
      "}",
      "",
      "function Resolve-ExistingPathOrNull {",
      "  param([string[]] $Candidates)",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "  }",
      "  return \"\"",
      "}",
      "",
      "function Test-DirectoryHasSuggestedSources {",
      "  param(",
      "    [string] $Directory,",
      "    [object[]] $Sources",
      "  )",
      "  if ([string]::IsNullOrWhiteSpace($Directory) -or !(Test-Path -LiteralPath $Directory -PathType Container)) {",
      "    return $false",
      "  }",
      "  $NamedSources = @($Sources | Where-Object { $_.Name -and $_.Name.Trim().Length -gt 0 })",
      "  if ($NamedSources.Count -lt 1) {",
      "    return @((Get-ChildItem -LiteralPath $Directory -File -Filter \"*.safetensors\" -ErrorAction SilentlyContinue)).Count -gt 0",
      "  }",
      "  foreach ($Source in $NamedSources) {",
      "    if (!(Test-Path -LiteralPath (Join-Path $Directory $Source.Name) -PathType Leaf)) {",
      "      return $false",
      "    }",
      "  }",
      "  return $true",
      "}",
      "",
      "function Resolve-SourceSafetensorsInput {",
      "  param(",
      "    [string[]] $Candidates,",
      "    [object[]] $Sources",
      "  )",
      "  foreach ($Candidate in $Candidates) {",
      "    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }",
      "    if ($Candidate -like \"EDIT_ME*\") { continue }",
      "    if (Test-Path -LiteralPath $Candidate -PathType Leaf) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "    if (Test-DirectoryHasSuggestedSources $Candidate $Sources) {",
      "      return (Resolve-Path -LiteralPath $Candidate).Path",
      "    }",
      "  }",
      "  return \"\"",
      "}",
      "",
      "function Assert-DownloadedSourceEvidence {",
      "  param(",
      "    [string] $Path,",
      "    [string] $ExpectedSha256,",
      "    [string] $ExpectedByteCount",
      "  )",
      "  if (![string]::IsNullOrWhiteSpace($ExpectedByteCount)) {",
      "    $ActualByteCount = (Get-Item -LiteralPath $Path).Length",
      "    if ($ActualByteCount -ne [Int64]$ExpectedByteCount) {",
      "      throw \"Downloaded source byte count mismatch: expected $ExpectedByteCount, got $ActualByteCount\"",
      "    }",
      "  }",
      "  if (![string]::IsNullOrWhiteSpace($ExpectedSha256)) {",
      "    $Expected = $ExpectedSha256 -replace '^sha256:', ''",
      "    $Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()",
      "    if ($Actual -ne $Expected.ToLowerInvariant()) {",
      "      throw \"Downloaded source SHA-256 mismatch: expected $Expected, got $Actual\"",
      "    }",
      "  }",
      "}",
      "",
      "function Resolve-GeneratedFile {",
      "  param(",
      "    [string] $Directory,",
      "    [string] $Filter,",
      "    [string] $Label",
      "  )",
      "  $Matches = @(Get-ChildItem -LiteralPath $Directory -File -Filter $Filter | Sort-Object LastWriteTimeUtc -Descending)",
      "  if ($Matches.Count -lt 1) {",
      "    throw \"$Label was not produced in $Directory\"",
      "  }",
      "  return $Matches[0].FullName",
      "}",
      "",
      "function Resolve-GeneratedDirectory {",
      "  param(",
      "    [string] $Directory,",
      "    [string] $Filter,",
      "    [string] $Label",
      "  )",
      "  $Matches = @(Get-ChildItem -LiteralPath $Directory -Directory -Filter $Filter | Sort-Object LastWriteTimeUtc -Descending)",
      "  if ($Matches.Count -lt 1) {",
      "    throw \"$Label was not produced in $Directory\"",
      "  }",
      "  return $Matches[0].FullName",
      "}",
      "",
      "# Optional overrides:",
      "#   $env:TINYRUSTLM_WORKSPACE = full path to SLMComposer.com / TinyRustLM Rust workspace",
      "#   $env:MINIMODEL_WORKSPACE = full path to MiniModel.org Rust workspace",
      "#   $env:TINYRUSTLM_SOURCE_SAFETENSORS = full path to your reviewed local source file or shard directory",
      "#   $env:TINYRUSTLM_ALLOW_HF_DOWNLOAD = 1 to download the suggested source directly from Hugging Face",
      "$CandidateTinyRustLMWorkspaces = @(",
      "  $env:TINYRUSTLM_WORKSPACE,",
      "  $env:SLMCOMPOSER_WORKSPACE,",
      "  \"E:/Source/Rust/SLMComposer.com\",",
      "  (Join-Path $PSScriptRoot \"SLMComposer.com\"),",
      "  (Join-Path $PSScriptRoot \"..\\SLMComposer.com\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\SLMComposer.com\")",
      ")",
      "$CandidateMiniModelWorkspaces = @(",
      "  $env:MINIMODEL_WORKSPACE,",
      "  \"E:/Source/Rust/MiniModel.org\",",
      "  (Join-Path $PSScriptRoot \"MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\MiniModel.org\"),",
      "  (Join-Path $PSScriptRoot \"..\\..\\MiniModel.org\")",
      ")",
      `$SuggestedSourceSafetensorsFileName = ${powerShellSingleQuote(suggestedSourceFile)}`,
      `$SuggestedSourceSafetensorsUrl = ${powerShellDoubleQuote(suggestedSourceUrl)}`,
      `$SuggestedSourceSafetensorsSha256 = ${powerShellDoubleQuote(suggestedSourceSha256)}`,
      `$SuggestedSourceSafetensorsByteCount = ${powerShellDoubleQuote(suggestedSourceByteCount)}`,
      "$SuggestedSourceSafetensorsFiles = @(",
      ...(suggestedSourceEntryLines.length ? suggestedSourceEntryLines : []),
      ")",
      `$ConversionRequest = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}.minimodel-conversion-request.json`)}`,
      `$EmbeddedConversionRequestBase64 = ${powerShellSingleQuote(requestBase64)}`,
      `$EmbeddedServePeerPiecesScriptBase64 = ${powerShellSingleQuote(serveScriptBase64)}`,
      "$SourceSafetensorsCandidates = @(",
      "  $env:TINYRUSTLM_SOURCE_SAFETENSORS,",
      "  (Join-Path $PSScriptRoot $SuggestedSourceSafetensorsFileName),",
      "  (Join-Path $PSScriptRoot (Join-Path \"source\" $SuggestedSourceSafetensorsFileName)),",
      "  (Join-Path $PSScriptRoot \"source\"),",
      "  $PSScriptRoot",
      ")",
      "$TinyRustLMWorkspace = Resolve-ExistingPath $CandidateTinyRustLMWorkspaces \"TinyRustLM Rust workspace\" \"Set TINYRUSTLM_WORKSPACE or edit `$CandidateTinyRustLMWorkspaces.\"",
      "$MiniModelWorkspace = Resolve-ExistingPath $CandidateMiniModelWorkspaces \"MiniModel Rust workspace\" \"Set MINIMODEL_WORKSPACE or edit `$CandidateMiniModelWorkspaces.\"",
      "$SourceSafetensors = Resolve-SourceSafetensorsInput $SourceSafetensorsCandidates $SuggestedSourceSafetensorsFiles",
      "if ([string]::IsNullOrWhiteSpace($SourceSafetensors)) {",
      "  if ($env:TINYRUSTLM_ALLOW_HF_DOWNLOAD -eq \"1\" -and $SuggestedSourceSafetensorsFiles.Count -gt 0) {",
      "    $DownloadDir = Join-Path $PSScriptRoot \"source\"",
      "    New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null",
      "    foreach ($Source in $SuggestedSourceSafetensorsFiles) {",
      "      if ([string]::IsNullOrWhiteSpace($Source.Name) -or [string]::IsNullOrWhiteSpace($Source.Url)) {",
      "        throw \"Hugging Face metadata did not include a download URL for every listed .safetensors source.\"",
      "      }",
      "      $DownloadTarget = Join-Path $DownloadDir $Source.Name",
      "      Write-Host \"Downloading Hugging Face source directly to this machine:\" $Source.Url",
      "      Invoke-WebRequest -UseBasicParsing -Uri $Source.Url -OutFile $DownloadTarget",
      "      Assert-DownloadedSourceEvidence $DownloadTarget $Source.Sha256 $Source.ByteCount",
      "    }",
      "    $SourceSafetensors = Resolve-SourceSafetensorsInput @($DownloadDir) $SuggestedSourceSafetensorsFiles",
      "  }",
      "}",
      "if ([string]::IsNullOrWhiteSpace($SourceSafetensors)) {",
      "  throw \"Reviewed source .safetensors input not found. Put the file beside this script, put every listed shard under ./source/, set TINYRUSTLM_SOURCE_SAFETENSORS to a file or shard directory, or set TINYRUSTLM_ALLOW_HF_DOWNLOAD=1 to download the suggested Hugging Face source directly to this machine.\"",
      "}",
      `$SourceShape = ${powerShellSingleQuote(sourceShape)}`,
      `$Quantization = ${powerShellSingleQuote(quantization)}`,
      `$ModelId = ${powerShellSingleQuote(entry.modelId)}`,
      `$MiniModelModelId = ${powerShellSingleQuote(minimodelModelId)}`,
      `$KnownPeerBaseUrl = ${powerShellDoubleQuote(knownPeerBaseUrl)} # Optional, for example ${peerExampleUrl}`,
      `$WorkDir = Join-Path $PSScriptRoot ${powerShellSingleQuote(`${stem}-tinyrustlm-conversion`)}`,
      "$ConversionRequestInspect = Join-Path $WorkDir \"tinyrustlm-conversion.request.inspect\"",
      "$ConversionPreflight = Join-Path $WorkDir \"tinyrustlm-conversion.preflight\"",
      "$MiniModelShareDir = Join-Path $WorkDir \"minimodel-peer-share\"",
      "$MiniModelCatalogSnapshot = Join-Path $WorkDir \"models.v0.json\"",
      `$MiniModelServeScript = Join-Path $WorkDir ${powerShellSingleQuote(`${stem}.minimodel-serve-peer-pieces.ps1`)}`,
      "",
      "if (!(Test-Path -LiteralPath $ConversionRequest)) {",
      "  $EmbeddedConversionRequestJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EmbeddedConversionRequestBase64))",
      "  [System.IO.File]::WriteAllText($ConversionRequest, $EmbeddedConversionRequestJson, [System.Text.Encoding]::UTF8)",
      "  Write-Host \"Wrote embedded conversion request:\" $ConversionRequest",
      "}",
      "Write-Host \"TinyRustLM workspace:\" $TinyRustLMWorkspace",
      "Write-Host \"MiniModel workspace:\" $MiniModelWorkspace",
      "Write-Host \"Conversion request:\" $ConversionRequest",
      "Write-Host \"Source safetensors:\" $SourceSafetensors",
      "Write-Host \"Output directory:\" $WorkDir",
      "",
      "New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null",
      "$EmbeddedServeScriptText = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EmbeddedServePeerPiecesScriptBase64))",
      "[System.IO.File]::WriteAllText($MiniModelServeScript, $EmbeddedServeScriptText, [System.Text.Encoding]::UTF8)",
      "Write-Host \"Wrote peer serving script:\" $MiniModelServeScript",
      "Set-Location $TinyRustLMWorkspace",
      "",
      "# The script writes the embedded request JSON beside itself when it is missing.",
      "# Rust inspects the request before source-byte work, then performs inspect, plan, convert, validate, manifest validation, and receipt writing.",
      "& cargo run -p tinyrustlm-slm-pack -- inspect-huggingface-conversion-request $ConversionRequest $ConversionRequestInspect",
      "$ConversionRequestInspectExitCode = $LASTEXITCODE",
      "if ($ConversionRequestInspectExitCode -ne 0) {",
      "  throw \"Hugging Face conversion request inspection failed with exit code $ConversionRequestInspectExitCode. Check the request JSON before inspecting or converting local source bytes.\"",
      "}",
      "Write-Host \"Conversion request inspection:\" $ConversionRequestInspect",
      "& cargo run -p tinyrustlm-slm-pack -- convert-huggingface-request $ConversionRequest $SourceSafetensors $WorkDir $SourceShape $Quantization",
      "$ConversionExitCode = $LASTEXITCODE",
      "if ($ConversionExitCode -ne 0) {",
      "  if (Test-Path -LiteralPath $ConversionPreflight) {",
      "    Write-Host \"Rust conversion preflight report:\" $ConversionPreflight",
      "  }",
      "  throw \"Rust conversion failed with exit code $ConversionExitCode. If the preflight report exists, it explains whether the local .safetensors input matched TinyRustLM's supported source shapes.\"",
      "}",
      "$OutputSlm = Resolve-GeneratedFile $WorkDir \"*.slm\" \"Converted .slm\"",
      "$OutputManifest = Resolve-GeneratedFile $WorkDir \"*.slm.manifest\" \"Converted .slm manifest\"",
      "Write-Host \"Conversion preflight:\" $ConversionPreflight",
      "$ConversionReceipt = Resolve-GeneratedFile $WorkDir \"tinyrustlm-conversion.receipt\" \"Conversion receipt\"",
      "& cargo run -p tinyrustlm-slm-pack -- inspect-huggingface-conversion-receipt $ConversionReceipt $ConversionRequest $ConversionPreflight $OutputSlm $OutputManifest",
      "$ConversionReceiptInspectExitCode = $LASTEXITCODE",
      "if ($ConversionReceiptInspectExitCode -ne 0) {",
      "  throw \"Hugging Face conversion receipt inspection failed with exit code $ConversionReceiptInspectExitCode. Check the request, preflight, receipt, .slm, and manifest before MiniModel sharing.\"",
      "}",
      "Write-Host \"Conversion receipt inspection passed:\" $ConversionReceipt",
      "",
      "# Prepare checksum-bound MiniModel metadata and local peer pieces in one Rust step.",
      "# This does not upload model bytes and does not serve them from project servers.",
      "Set-Location $MiniModelWorkspace",
      "$PrepareArgs = @(\"run\", \"-p\", \"minimodel\", \"--\", \"prepare-peer-share\", $OutputSlm, $MiniModelShareDir, $MiniModelModelId, $ModelId)",
      "& cargo @PrepareArgs",
      "$MiniModelCatalogEntry = Resolve-GeneratedFile $MiniModelShareDir \"*.catalog-entry.v0.json\" \"MiniModel catalog entry\"",
      "$MiniModelManifest = Resolve-GeneratedFile $MiniModelShareDir \"*.minimodel.manifest.v0\" \"MiniModel manifest\"",
      "$MiniModelPieceDir = Resolve-GeneratedDirectory $MiniModelShareDir \"*.peer-pieces\" \"MiniModel peer pieces\"",
      "$CatalogStem = ([System.IO.Path]::GetFileNameWithoutExtension($MiniModelCatalogEntry)) -replace \"\\.catalog-entry\\.v0$\", \"\"",
      "$MiniModelCatalogEntryWithPeer = Join-Path $MiniModelShareDir \"$CatalogStem.catalog-entry.with-peer.v0.json\"",
      "$MiniModelPeerSourceAnnouncement = Join-Path $MiniModelShareDir \"$CatalogStem.peer-source-announcement.v0.json\"",
      "$MiniModelPeerSourceAnnouncementFeed = Join-Path $MiniModelShareDir \"peer-source-announcements.v0.json\"",
      "$MiniModelPeerCompanionState = Join-Path $MiniModelShareDir \"$CatalogStem.peer-companion-state.v0.json\"",
      "$MiniModelPeerContactCard = Join-Path $MiniModelShareDir \"$CatalogStem.peer-contact-card.v0.json\"",
      "$MiniModelPeerContactBook = Join-Path $MiniModelShareDir \"$CatalogStem.peer-contact-book.v0.json\"",
      "$MiniModelPeerCompanionInventory = Join-Path $MiniModelShareDir \"$CatalogStem.peer-companion-inventory.v0.json\"",
      "$MiniModelLocalImportReceipt = Join-Path $MiniModelShareDir \"$CatalogStem.local.minimodel-receipt\"",
      "$MiniModelImportReceiptLedger = Join-Path $MiniModelShareDir \"import-receipts.v0.json\"",
      "$MiniModelCatalogSnapshotWithFeed = Join-Path $WorkDir \"models.with-announcement-feed.v0.json\"",
      "$MiniModelPublishReadme = Join-Path $MiniModelShareDir \"converted-once-p2p-publish.README.txt\"",
      "$OutputSlmByteCount = (Get-Item -LiteralPath $OutputSlm).Length",
      "cargo run -p minimodel -- write-import-receipt $MiniModelManifest $OutputSlm $MiniModelLocalImportReceipt",
      "cargo run -p minimodel -- inspect-import-receipt $MiniModelLocalImportReceipt $MiniModelManifest $OutputSlm",
      "cargo run -p minimodel -- write-import-receipt-ledger $MiniModelImportReceiptLedger $MiniModelLocalImportReceipt $MiniModelManifest $OutputSlm",
      "cargo run -p minimodel -- inspect-import-receipt-ledger $MiniModelImportReceiptLedger",
      "$MiniModelCatalogEntryForSnapshot = $MiniModelCatalogEntry",
      "if ($KnownPeerBaseUrl.Trim().Length -gt 0) {",
      "  cargo run -p minimodel -- add-peer-source $MiniModelCatalogEntry $MiniModelCatalogEntryWithPeer $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-source-announcement $MiniModelCatalogEntry $MiniModelPeerSourceAnnouncement $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-source-announcement-feed $MiniModelPeerSourceAnnouncementFeed $MiniModelPeerSourceAnnouncement",
      "  cargo run -p minimodel -- inspect-peer-source-announcement-feed $MiniModelPeerSourceAnnouncementFeed",
      "  cargo run -p minimodel -- write-catalog-snapshot-with-announcement-feed $MiniModelCatalogSnapshotWithFeed \"peer-source-announcements.v0.json\" $MiniModelPeerSourceAnnouncementFeed $MiniModelCatalogEntry",
      "  cargo run -p minimodel -- inspect-catalog-snapshot $MiniModelCatalogSnapshotWithFeed",
      "  cargo run -p minimodel -- write-peer-companion-state $MiniModelManifest $MiniModelPieceDir $MiniModelPeerCompanionState $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- inspect-peer-companion-state $MiniModelPeerCompanionState $MiniModelManifest $MiniModelPieceDir",
      "  cargo run -p minimodel -- write-peer-contact-card $MiniModelPeerContactCard $KnownPeerBaseUrl",
      "  cargo run -p minimodel -- write-peer-contact-book $MiniModelPeerContactBook $MiniModelPeerContactCard",
      "  cargo run -p minimodel -- inspect-peer-contact-book $MiniModelPeerContactBook",
      "  cargo run -p minimodel -- write-peer-companion-inventory $MiniModelPeerCompanionInventory $MiniModelPeerCompanionState $MiniModelManifest $MiniModelPieceDir $MiniModelImportReceiptLedger $OutputSlmByteCount $MiniModelPeerContactCard",
      "  cargo run -p minimodel -- inspect-peer-companion-inventory $MiniModelPeerCompanionInventory",
      "  $MiniModelCatalogEntryForSnapshot = $MiniModelCatalogEntryWithPeer",
      "}",
      "",
      "# Build a metadata-only catalog snapshot from the generated entry.",
      "# This is safe to share as catalog metadata; it still does not include or host model bytes.",
      "cargo run -p minimodel -- write-catalog-snapshot $MiniModelCatalogSnapshot $MiniModelCatalogEntryForSnapshot",
      "cargo run -p minimodel -- inspect-catalog-snapshot $MiniModelCatalogSnapshot",
      "$PublishReadmeLines = @(",
      "  \"Converted-once P2P publication package\"",
      "  \"\"",
      "  \"Safe metadata files for catalog maintainers:\"",
      "  \"- Catalog entry: $MiniModelCatalogEntry\"",
      "  \"- Catalog snapshot: $MiniModelCatalogSnapshot\"",
      "  \"- Peer-source announcement: $MiniModelPeerSourceAnnouncement (created when KnownPeerBaseUrl is set)\"",
      "  \"- Peer-source announcement feed: $MiniModelPeerSourceAnnouncementFeed (created when KnownPeerBaseUrl is set)\"",
      "  \"- Feed-bound catalog snapshot: $MiniModelCatalogSnapshotWithFeed (created when KnownPeerBaseUrl is set)\"",
      "  \"- Peer contact card: $MiniModelPeerContactCard (created when KnownPeerBaseUrl is set; metadata only, no model bytes)\"",
      "  \"- Peer contact book: $MiniModelPeerContactBook (created when KnownPeerBaseUrl is set; metadata only, no model bytes or peer pieces)\"",
      "  \"\"",
      "  \"Local companion handoff files:\"",
      "  \"- Peer companion state: $MiniModelPeerCompanionState (created when KnownPeerBaseUrl is set; metadata only, no model bytes)\"",
      "  \"- Import receipt ledger: $MiniModelImportReceiptLedger (metadata only, no model bytes)\"",
      "  \"- Peer companion inventory: $MiniModelPeerCompanionInventory (created when KnownPeerBaseUrl is set; metadata only, no model bytes or peer pieces)\"",
      "  \"\"",
      "  \"Do not send .slm files or *.peer-pieces directories to project servers.\"",
      "  \"Project servers may publish only metadata JSON, schemas, docs, public keys, and contact/takedown routes.\"",
      "  \"Later users get P2P Import only after metadata names a consenting peer and Rust import-peer-request verifies the bytes.\"",
      ")",
      "[System.IO.File]::WriteAllLines($MiniModelPublishReadme, $PublishReadmeLines, [System.Text.Encoding]::UTF8)",
      "",
      "Write-Host \"Converted .slm:\" $OutputSlm",
      "Write-Host \"Conversion receipt:\" $ConversionReceipt",
      "Write-Host \"MiniModel manifest:\" $MiniModelManifest",
      "Write-Host \"MiniModel peer pieces:\" $MiniModelPieceDir",
      "Write-Host \"MiniModel local import receipt:\" $MiniModelLocalImportReceipt",
      "Write-Host \"MiniModel import receipt ledger:\" $MiniModelImportReceiptLedger",
      "Write-Host \"MiniModel share directory:\" $MiniModelShareDir",
      "Write-Host \"MiniModel catalog snapshot:\" $MiniModelCatalogSnapshot",
      "Write-Host \"MiniModel peer-source announcement feed:\" $MiniModelPeerSourceAnnouncementFeed",
      "Write-Host \"MiniModel feed-bound catalog snapshot:\" $MiniModelCatalogSnapshotWithFeed",
      "Write-Host \"MiniModel peer companion state:\" $MiniModelPeerCompanionState",
      "Write-Host \"MiniModel peer contact card:\" $MiniModelPeerContactCard",
      "Write-Host \"MiniModel peer contact book:\" $MiniModelPeerContactBook",
      "Write-Host \"MiniModel peer companion inventory:\" $MiniModelPeerCompanionInventory",
      "Write-Host \"MiniModel serve script:\" $MiniModelServeScript",
      "Write-Host \"Converted-once publication notes:\" $MiniModelPublishReadme",
      "if ($KnownPeerBaseUrl.Trim().Length -eq 0) {",
      "  Write-Host \"Later, when you have a consenting peer URL, publish P2P availability metadata with:\"",
      `  Write-Host "cargo run -p minimodel -- add-peer-source '$MiniModelCatalogEntry' '$MiniModelCatalogEntryWithPeer' ${peerExampleUrl}"`,
      `  Write-Host "cargo run -p minimodel -- write-peer-source-announcement '$MiniModelCatalogEntry' '$MiniModelPeerSourceAnnouncement' ${peerExampleUrl}"`,
      `  Write-Host "cargo run -p minimodel -- write-peer-companion-state '$MiniModelManifest' '$MiniModelPieceDir' '$MiniModelPeerCompanionState' ${peerExampleUrl}"`,
      `  Write-Host "cargo run -p minimodel -- inspect-peer-companion-state '$MiniModelPeerCompanionState' '$MiniModelManifest' '$MiniModelPieceDir'"`,
      `  Write-Host "cargo run -p minimodel -- write-peer-contact-card '$MiniModelPeerContactCard' ${peerExampleUrl}"`,
      "  Write-Host \"cargo run -p minimodel -- write-peer-contact-book '$MiniModelPeerContactBook' '$MiniModelPeerContactCard'\"",
      "  Write-Host \"cargo run -p minimodel -- inspect-peer-contact-book '$MiniModelPeerContactBook'\"",
      "  Write-Host \"cargo run -p minimodel -- write-peer-companion-inventory '$MiniModelPeerCompanionInventory' '$MiniModelPeerCompanionState' '$MiniModelManifest' '$MiniModelPieceDir' '$MiniModelImportReceiptLedger' $OutputSlmByteCount '$MiniModelPeerContactCard'\"",
      "  Write-Host \"cargo run -p minimodel -- inspect-peer-companion-inventory '$MiniModelPeerCompanionInventory'\"",
      "  Write-Host \"cargo run -p minimodel -- write-peer-source-announcement-feed '$MiniModelPeerSourceAnnouncementFeed' '$MiniModelPeerSourceAnnouncement'\"",
      "  Write-Host \"cargo run -p minimodel -- inspect-peer-source-announcement-feed '$MiniModelPeerSourceAnnouncementFeed'\"",
      "  Write-Host \"cargo run -p minimodel -- write-catalog-snapshot-with-announcement-feed '$MiniModelCatalogSnapshotWithFeed' peer-source-announcements.v0.json '$MiniModelPeerSourceAnnouncementFeed' '$MiniModelCatalogEntry'\"",
      "  Write-Host \"cargo run -p minimodel -- inspect-catalog-snapshot '$MiniModelCatalogSnapshotWithFeed'\"",
      "  Write-Host \"Send the announcement JSON to a catalog maintainer, who can run:\"",
      "  Write-Host \"cargo run -p minimodel -- apply-peer-source-announcements '$MiniModelCatalogEntry' '$MiniModelCatalogEntryWithPeer' '$MiniModelPeerSourceAnnouncement'\"",
      "  Write-Host \"or batch-publish many entries and announcements with:\"",
      "  Write-Host \"cargo run -p minimodel -- write-catalog-snapshot-with-announcements '$MiniModelCatalogSnapshot' '$MiniModelCatalogEntry' --announcements '$MiniModelPeerSourceAnnouncement'\"",
      "  Write-Host \"cargo run -p minimodel -- inspect-catalog-snapshot '$MiniModelCatalogSnapshot'\"",
      "  Write-Host \"The batch command writes models.v0.json directly; if using apply-peer-source-announcements, rerun write-catalog-snapshot with the with-peer entry.\"",
      "}",
      "Write-Host \"If you consent to serve pieces from this machine, run:\"",
      "Write-Host \"powershell -ExecutionPolicy Bypass -File '$MiniModelServeScript'\"",
      "Write-Host \"Next: open TinyRustLM.com, choose Your Local Files, and import the converted .slm.\"",
      ""
    ];
    return lines.join("\n");
  }

  function hfConversionReadme(entry, matches) {
    const request = hfConversionRequest(entry, matches);
    const stem = conversionFileStem(entry.modelId);
    const scriptName = `${stem}.tinyrustlm-convert.ps1`;
    const requestName = `${stem}.minimodel-conversion-request.json`;
    const readmeName = `${stem}.tinyrustlm-conversion.README.txt`;
    const sourceFormat = request.local_conversion.source_format || "safetensors";
    if (sourceFormat === "gguf") {
      const sourceFile = request.local_conversion.suggested_source_gguf_file || "<reviewed-source>.gguf";
      const suggestedSourceUrl = request.local_conversion.suggested_source_gguf_url || "";
      const suggestedSourceSha256 = request.local_conversion.suggested_source_gguf_sha256 || "";
      const suggestedSourceByteCount = Number.isFinite(request.local_conversion.suggested_source_gguf_byte_count)
        ? String(request.local_conversion.suggested_source_gguf_byte_count)
        : "";
      const knownPeerBaseUrl = request.local_conversion.known_peer_base_url || "";
      const lines = [
        "TinyRustLM Hugging Face GGUF conversion kit",
        "",
        `Source model: ${entry.modelId}`,
        `Model card: ${hfModelUrl(entry.modelId)}`,
        "",
        "Files saved by TinyRustLM:",
        `- ${requestName}`,
        `- ${scriptName}`,
        `- ${readmeName}`,
        "",
        "What to do:",
        `1. Review the model card and license for ${entry.modelId}.`,
        `2. Put a reviewed GGUF file with F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensors at ${sourceFile}, set TINYRUSTLM_SOURCE_GGUF, or opt into direct local Hugging Face download with: $env:TINYRUSTLM_ALLOW_HF_DOWNLOAD=\"1\"`,
        `3. Run from PowerShell in this folder: powershell -ExecutionPolicy Bypass -File .\\${scriptName}`,
        "4. If conversion passes, import the verified .slm through TinyRustLM's local file picker.",
        "",
        "What the script does:",
        "- Recreates the conversion request if the JSON sidecar is missing.",
        "- Uses a reviewed local GGUF file by default, or downloads the suggested GGUF directly to this machine only after TINYRUSTLM_ALLOW_HF_DOWNLOAD=1.",
        `- Listed GGUF file: ${sourceFile}`,
        suggestedSourceUrl ? `- Suggested direct Hugging Face GGUF URL: ${suggestedSourceUrl}` : "- No direct Hugging Face GGUF URL was available from metadata.",
        suggestedSourceSha256 ? `- Expected source SHA-256 from metadata: ${suggestedSourceSha256}` : "- Expected source SHA-256 from metadata: unavailable.",
        suggestedSourceByteCount ? `- Expected source byte count from metadata: ${suggestedSourceByteCount}` : "- Expected source byte count from metadata: unavailable.",
        "- Runs tinyrustlm-slm-pack inspect-huggingface-conversion-request before local GGUF inspection.",
        "- Runs tinyrustlm-slm-pack inspect-gguf and plan-gguf-source before conversion.",
        "- Runs tinyrustlm-slm-pack convert-gguf-trained for F32/F16/BF16/Q2_K/Q3_K/Q4_0/Q4_1/Q4_K/Q5_0/Q5_1/Q5_K/Q6_K/Q8_0/Q8_1/Q8_K tensor payloads.",
        "- Runs tinyrustlm-slm-pack validate and validate-manifest before MiniModel sharing.",
        "- Runs MiniModel prepare-peer-share locally after Rust verifies the .slm.",
        "- Writes a metadata-only models.v0.json catalog snapshot.",
        "- Writes a local import receipt ledger for sender-side audit/companion handoff.",
        knownPeerBaseUrl
          ? `- Known peer URL: ${knownPeerBaseUrl}. The script writes peer-source announcement/feed metadata plus peer companion state, contact book, and peer companion inventory for this consenting peer.`
          : "- Known peer URL: not set. Peer-source announcement/feed metadata can be added later after a consenting peer URL is known.",
        "",
        "Safe to publish:",
        "- models.v0.json",
        "- catalog-entry JSON",
        "- peer-source announcement/feed JSON when present",
        "- docs, schemas, public keys, contact routes, and takedown routes",
        "",
        "Never upload to project servers:",
        "- .slm files",
        "- *.peer-pieces directories",
        "- source .gguf files",
        "",
        "Boundary:",
        "- GGUF conversion still requires supported tensor names/shapes, tokenizer token-count compatibility, BPE token/merge import when declared, and Rust validation before .slm import.",
        "- TinyRustLM.com and MiniModel.org do not serve, proxy, cache, run, or fetch user model bytes.",
        "- Model bytes stay local or move only from a consenting peer through Rust verification."
      ];
      return `${lines.join("\n")}\n`;
    }
    const sourceFile = request.local_conversion.suggested_source_safetensors_file || "<reviewed-source>.safetensors";
    const sourceFiles = Array.isArray(request.local_conversion.suggested_source_safetensors_files)
      ? request.local_conversion.suggested_source_safetensors_files
      : [];
    const sourceInputText = sourceFiles.length > 1
      ? `all ${sourceFiles.length} listed .safetensors files under ./source/`
      : sourceFile;
    const suggestedSourceUrl = request.local_conversion.suggested_source_safetensors_url || "";
    const suggestedSourceSha256 = request.local_conversion.suggested_source_safetensors_sha256 || "";
    const suggestedSourceByteCount = Number.isFinite(request.local_conversion.suggested_source_safetensors_byte_count)
      ? String(request.local_conversion.suggested_source_safetensors_byte_count)
      : "";
    const knownPeerBaseUrl = request.local_conversion.known_peer_base_url || "";
    const lines = [
      "TinyRustLM Hugging Face conversion kit",
      "",
      `Source model: ${entry.modelId}`,
      `Model card: ${hfModelUrl(entry.modelId)}`,
      "",
      "Files saved by TinyRustLM:",
      `- ${requestName}`,
      `- ${scriptName}`,
      `- ${readmeName}`,
      "",
      "What to do:",
      `1. Review the model card and license for ${entry.modelId}.`,
      `2. Either put ${sourceInputText}, set TINYRUSTLM_SOURCE_SAFETENSORS to a reviewed file or shard directory, or opt into direct local Hugging Face download with: $env:TINYRUSTLM_ALLOW_HF_DOWNLOAD=\"1\"`,
      `3. Run from PowerShell in this folder: powershell -ExecutionPolicy Bypass -File .\\${scriptName}`,
      "4. If conversion passes, import the verified .slm through TinyRustLM's local file picker.",
      "",
      "What the script does:",
      "- Recreates the conversion request if the JSON sidecar is missing.",
      "- Uses a reviewed local source file or shard directory by default, or downloads the suggested Hugging Face source directly to this machine only after TINYRUSTLM_ALLOW_HF_DOWNLOAD=1.",
      sourceFiles.length > 1 ? `- Listed source files: ${sourceFiles.map((file) => file.file_name).join(", ")}` : `- Listed source file: ${sourceFile}`,
      suggestedSourceUrl ? `- Suggested direct Hugging Face source URL: ${suggestedSourceUrl}` : "- No direct Hugging Face source URL was available from metadata.",
      suggestedSourceSha256 ? `- Expected source SHA-256 from metadata: ${suggestedSourceSha256}` : "- Expected source SHA-256 from metadata: unavailable.",
      suggestedSourceByteCount ? `- Expected source byte count from metadata: ${suggestedSourceByteCount}` : "- Expected source byte count from metadata: unavailable.",
      "- Runs tinyrustlm-slm-pack inspect-huggingface-conversion-request before local source-byte inspection.",
      "- Runs tinyrustlm-slm-pack convert-huggingface-request locally against the reviewed source file or shard directory.",
      "- Writes tinyrustlm-conversion.preflight before extraction so incompatible source inputs have a durable Rust explanation.",
      "- Runs tinyrustlm-slm-pack inspect-huggingface-conversion-receipt to bind the request, preflight, .slm, and manifest before MiniModel sharing.",
        "- Runs MiniModel prepare-peer-share locally after Rust verifies the .slm.",
        "- Writes a metadata-only models.v0.json catalog snapshot.",
        "- Writes a local import receipt ledger for sender-side audit/companion handoff.",
        knownPeerBaseUrl
        ? `- Known peer URL: ${knownPeerBaseUrl}. The script writes peer-source announcement/feed metadata plus peer companion state, contact book, and peer companion inventory for this consenting peer.`
        : "- Known peer URL: not set. Peer-source announcement/feed metadata can be added later after a consenting peer URL is known.",
      "",
      "Safe to publish:",
      "- models.v0.json",
      "- catalog-entry JSON",
      "- peer-source announcement/feed JSON when present",
      "- docs, schemas, public keys, contact routes, and takedown routes",
      "",
      "Never upload to project servers:",
      "- .slm files",
      "- *.peer-pieces directories",
      "- source .safetensors files",
      "",
      "Boundary:",
      "- TinyRustLM.com and MiniModel.org do not serve, proxy, cache, run, or fetch user model bytes.",
      "- Model bytes stay local or move only from a consenting peer through Rust verification.",
      "- Browser Hugging Face search results are metadata only until a local Rust conversion or verified P2P import succeeds."
    ];
    return `${lines.join("\n")}\n`;
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
    downloadTextFile(`${stem}.tinyrustlm-conversion.README.txt`, hfConversionReadme(entry, matches), "text/plain");
    setHfStatus(
      request.local_conversion.source_format === "gguf"
        ? "GGUF conversion request, script, and README saved locally"
        : "conversion request, script, and README saved locally",
      false
    );
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

  function pluralCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function hfAvailabilityCounts(accepted) {
    const summary = {
      p2pReady: 0,
      peerUrlNeeded: 0,
      localSlmNeeded: 0,
      externalSlmListed: 0,
      conversionNeeded: 0,
      largeSourceReview: 0,
      unknownSourceReview: 0,
      noSupportedSource: 0
    };
    for (const entry of accepted) {
      const view = hfResultView(entry);
      if (view.p2pMatch) {
        summary.p2pReady += 1;
      } else if (view.hasPeerOffer && state.p2pEnabled !== false) {
        summary.peerUrlNeeded += 1;
      } else if (view.matches.length) {
        summary.localSlmNeeded += 1;
      } else if (view.slmFiles.length) {
        summary.externalSlmListed += 1;
      } else if (!hfCanStartConversion(view)) {
        summary.noSupportedSource += 1;
      } else if (hfPreferredSourceFormat(view) === "gguf") {
        summary.unknownSourceReview += 1;
      } else if (hfSourceByteRisk(view) === "large") {
        summary.largeSourceReview += 1;
      } else if (hfSourceByteRisk(view) === "unknown") {
        summary.unknownSourceReview += 1;
      } else {
        summary.conversionNeeded += 1;
      }
    }
    return summary;
  }

  function hfAvailabilitySummary(accepted) {
    const summary = hfAvailabilityCounts(accepted);
    const parts = [pluralCount(accepted.length, "external record")];
    if (summary.p2pReady) {
      parts.push(pluralCount(summary.p2pReady, "P2P-ready match"));
    }
    if (summary.peerUrlNeeded) {
      parts.push(`${pluralCount(summary.peerUrlNeeded, "proof-ready match", "proof-ready matches")} ${summary.peerUrlNeeded === 1 ? "needs" : "need"} peer URL`);
    }
    if (summary.localSlmNeeded) {
      parts.push(`${pluralCount(summary.localSlmNeeded, "metadata match", "metadata matches")} ${summary.localSlmNeeded === 1 ? "needs" : "need"} local .slm`);
    }
    if (summary.externalSlmListed) {
      parts.push(`${pluralCount(summary.externalSlmListed, "external .slm listing")} ${summary.externalSlmListed === 1 ? "needs" : "need"} local review`);
    }
    if (summary.conversionNeeded) {
      parts.push(`${pluralCount(summary.conversionNeeded, "model")} ${summary.conversionNeeded === 1 ? "needs" : "need"} Rust conversion`);
    }
    if (summary.largeSourceReview) {
      parts.push(`${pluralCount(summary.largeSourceReview, "model")} ${summary.largeSourceReview === 1 ? "needs" : "need"} explicit large-source conversion review`);
    }
    if (summary.unknownSourceReview) {
      parts.push(`${pluralCount(summary.unknownSourceReview, "model")} ${summary.unknownSourceReview === 1 ? "needs" : "need"} source-size review`);
    }
    if (summary.noSupportedSource) {
      parts.push(`${pluralCount(summary.noSupportedSource, "model")} ${summary.noSupportedSource === 1 ? "has" : "have"} no supported source listed`);
    }
    if (state.p2pEnabled === false) {
      parts.push("P2P off");
    }
    return parts.join(" / ");
  }

  function appendFlowSummaryChip(parent, label, value, tone = "") {
    const chip = document.createElement("span");
    chip.className = `source-flow-chip${tone ? ` ${tone}` : ""}`;
    chip.append(
      elementWithText("strong", "", label),
      elementWithText("small", "", value)
    );
    parent.append(chip);
  }

  function renderSimpleHfFlowSummary(accepted) {
    if (!el.simpleHfFlowSummary) {
      return;
    }
    el.simpleHfFlowSummary.replaceChildren();
    if (!accepted.length) {
      el.simpleHfFlowSummary.hidden = true;
      return;
    }
    const counts = hfAvailabilityCounts(accepted);
    const header = elementWithText("div", "source-flow-summary-header", "Model availability");
    const chips = elementWithText("div", "source-flow-chip-row", "");
    if (counts.p2pReady) {
      appendFlowSummaryChip(chips, "P2P Import", pluralCount(counts.p2pReady, "ready match"), "ready");
    }
    if (counts.peerUrlNeeded) {
      appendFlowSummaryChip(chips, "Set Peer URL", pluralCount(counts.peerUrlNeeded, "proof-ready match", "proof-ready matches"), "peer-needed");
    }
    if (counts.conversionNeeded) {
      appendFlowSummaryChip(chips, "Start Conversion", pluralCount(counts.conversionNeeded, "source-backed model"), "convert");
    }
    if (counts.largeSourceReview || counts.unknownSourceReview) {
      appendFlowSummaryChip(
        chips,
        "Review First",
        pluralCount(counts.largeSourceReview + counts.unknownSourceReview, "source"),
        "review"
      );
    }
    if (counts.localSlmNeeded || counts.externalSlmListed) {
      appendFlowSummaryChip(
        chips,
        "Local .slm",
        pluralCount(counts.localSlmNeeded + counts.externalSlmListed, "metadata match", "metadata matches"),
        "local"
      );
    }
    if (counts.noSupportedSource) {
      appendFlowSummaryChip(chips, "No Source", pluralCount(counts.noSupportedSource, "model"), "blocked");
    }
    if (state.p2pEnabled === false) {
      appendFlowSummaryChip(chips, "P2P Off", "local conversion only", "blocked");
    }
    const note = elementWithText(
      "p",
      "source-flow-summary-note",
      "Hugging Face rows are metadata. A model runs here only after Rust conversion creates a local .slm or P2P Import fetches and reverifies peer pieces."
    );
    el.simpleHfFlowSummary.append(header, chips, note);
    el.simpleHfFlowSummary.hidden = false;
  }

  function refreshHfResultsForCatalogChange() {
    if (state.hfLastAccepted && state.hfLastAccepted.length) {
      renderAcceptedHfResults(state.hfLastAccepted);
    }
  }

  function hfResultActionRank(entry) {
    const view = hfResultView(entry);
    if (view.p2pMatch) {
      return 700;
    }
    if (view.hasPeerOffer) {
      return 650;
    }
    if (view.matches.length) {
      return 600;
    }
    if (view.slmFiles.length) {
      return 500;
    }
    if (hfCanStartConversion(view)) {
      const risk = hfSourceByteRisk(view);
      if (risk === "normal") {
        return 400;
      }
      if (risk === "unknown") {
        return 350;
      }
      return 300;
    }
    return 0;
  }

  function prioritizeHfResults(candidates) {
    return candidates
      .map((entry, index) => ({
        entry,
        index,
        rank: hfResultActionRank(entry),
        downloads: Number.isFinite(entry.result && entry.result.downloads) ? entry.result.downloads : 0
      }))
      .sort((left, right) => {
        if (right.rank !== left.rank) {
          return right.rank - left.rank;
        }
        if (right.downloads !== left.downloads) {
          return right.downloads - left.downloads;
        }
        return left.index - right.index;
      })
      .slice(0, hfSearchLimit)
      .map((item) => item.entry);
  }

  function renderHfResults(results) {
    clearHfResults();
    const candidates = [];
    for (const result of results) {
      const modelId = hfModelId(result);
      if (modelId) {
        candidates.push({ result, modelId });
      }
    }
    const accepted = prioritizeHfResults(candidates);
    state.hfLastAccepted = accepted;
    if (!accepted.length) {
      setHfStatus("no model records returned", false);
      return;
    }
    renderAcceptedHfResults(accepted);
    setHfStatus(`${hfAvailabilitySummary(accepted)}; local .slm verification required`, false);
  }

  function renderSimpleHfResults(accepted) {
    if (!el.simpleHfResults) {
      return;
    }
    renderSimpleHfFlowSummary(accepted);
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
    url.searchParams.set("limit", String(hfSearchApiLimit));
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
      : manifestValue(fields, "source_review");
    el.provenanceSourceReviewRoutes.textContent = sourceReview
      ? sourceReviewRouteSummary(sourceReview)
      : manifestValue(fields, "source_review_routes");
    el.provenanceSourceReviewArtifacts.textContent = sourceReview
      ? sourceReviewArtifactSummary(sourceReview)
      : manifestValue(fields, "source_review_artifacts");
    el.provenanceSourceTokenizerImport.textContent = sourceReviewTokenizerImportSummary(sourceReview);
    el.provenanceSourceValidation.textContent = sourceValidation
      ? sourceValidationSummary(sourceValidation)
      : manifestValue(fields, "source_validation");
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
      const importReceipt = model.localFile.importReceipt || null;
      const fields = {
        source_kind: importReceipt
          ? importReceipt.peerImport ? "minimodel-p2p-import-receipt" : "minimodel-import-receipt"
          : catalogEntry ? catalogEntry.sourceKind : "user-local-file",
        source_id: importReceipt ? importReceipt.modelId : catalogEntry ? catalogEntry.modelId : model.localFile.name,
        source_snapshot: importReceipt
          ? localImportReceiptProvenanceSnapshot(importReceipt)
          : catalogEntry ? "catalog-metadata-plus-browser-file-picker" : "browser-file-picker",
        source_review: importReceipt ? localImportReceiptReviewSummary(importReceipt) : "",
        source_review_routes: importReceipt ? localImportReceiptRouteSummary(importReceipt) : "",
        source_review_artifacts: importReceipt ? localImportReceiptArtifactSummary(importReceipt, model.localFile.byteLength) : "",
        source_validation: importReceipt ? localImportReceiptValidationSummary(importReceipt) : "",
        model_shape: importReceipt && importReceipt.slmModelShape !== "unavailable"
          ? importReceipt.slmModelShape
          : catalogEntry ? catalogEntry.modelShape || "runtime-validated-by-wasm" : "runtime-validated-by-wasm",
        quality_claim: catalogEntry ? catalogEntry.qualityClaim : "not-claimed",
        trained_quality_claim: catalogEntry ? catalogEntry.trainedQualityClaim : "not-claimed",
        admission_status: importReceipt
          ? importReceipt.peerImport ? "peer-import-receipt-validated" : "import-receipt-validated"
          : catalogEntry ? catalogEntry.admissionStatus : "runtime-validated-local-file",
        slm_checksum: model.localFile.checksum,
        artifact_sha256: model.localFile.sha256,
        artifact_bytes: String(model.localFile.byteLength),
        required_next_gate: importReceipt && importReceipt.nextGate !== "unavailable"
          ? importReceipt.nextGate
          : catalogEntry ? catalogEntry.requiredNextGate : "user-owned-local-review"
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
        const receiptSummary = localImportReceiptSummary(model.localFile.importReceipt);
        setLocalModelStatus(
          `${model.localFile.name} / ${formatByteCount(model.localFile.byteLength)} / ${model.localFile.sha256} / ${model.localFile.checksum}${receiptSummary ? ` / ${receiptSummary}` : ""} / loaded`,
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
      loadCode === 0
        ? model.localFile && model.localFile.importReceipt
          ? "local .slm verified with MiniModel receipt; share metadata ready"
          : "local .slm verified; share metadata ready"
        : "local .slm rejected",
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
    const runtimePromptText = runtimePromptWithLocalMemory(promptText);
    const bytes = state.encoder.encode(runtimePromptText);
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
    const memorySuffix = state.localMemoryPackage && state.localMemoryPackage.valid ? `, uaix_memory=${state.localMemoryPackage.setup}` : "";
    el.console.textContent = `generate(max_new_tokens=${maxTokens}, temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}${memorySuffix}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
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
    const selectedFiles = localModelSelectedFiles();
    const selectionError = localModelSelectionError(selectedFiles);
    if (selectionError) {
      setLocalModelStatus(selectionError, true);
      return;
    }
    const file = selectedFiles.slm;
    if (!file) {
      setLocalModelStatus("waiting", false);
      return;
    }
    const name = safeLocalModelName(file.name);
    const expected = state.selectedCatalogEntry
      ? ` / expecting ${state.selectedCatalogEntry.displayName}`
      : "";
    const receipt = selectedFiles.receipt ? " / MiniModel receipt selected" : "";
    setLocalModelStatus(`${name} / ${formatByteCount(file.size)} selected${receipt}${expected}`, false);
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

  if (el.inspectLocalMemoryPackageButton) {
    el.inspectLocalMemoryPackageButton.addEventListener("click", function () {
      bindLocalMemoryPackage(el.localMemoryPackageFiles).catch((error) => {
        const text = errorMessage(error);
        state.localMemoryPackage = null;
        renderLocalMemoryPackageSummary(null);
        setLocalMemoryPackageStatus(text, true);
      });
    });
  }

  if (el.clearLocalMemoryPackageButton) {
    el.clearLocalMemoryPackageButton.addEventListener("click", function () {
      clearLocalMemoryPackage();
    });
  }

  if (el.localMemoryPackageFiles) {
    el.localMemoryPackageFiles.addEventListener("change", function () {
      setLocalMemorySelectionStatus(el.localMemoryPackageFiles);
    });
  }

  if (el.localMemoryPackageSetup) {
    el.localMemoryPackageSetup.addEventListener("change", function () {
      if (localMemorySelectedFiles(el.localMemoryPackageFiles).length) {
        setLocalMemorySelectionStatus(el.localMemoryPackageFiles);
      }
    });
  }

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

  el.simpleImportLocalCatalogButton.addEventListener("click", function () {
    importLocalCatalogFile(el.simpleLocalCatalogFile).catch((error) => {
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

  el.simpleLocalCatalogFile.addEventListener("change", function () {
    const file = el.simpleLocalCatalogFile.files && el.simpleLocalCatalogFile.files[0];
    if (!file) {
      setCatalogStatus("idle", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} local catalog selected`, false);
  });

  el.importShareMetadataButton.addEventListener("click", function () {
    importShareMetadataFile(el.shareMetadataFile).catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.shareMetadataFile.addEventListener("change", function () {
    const file = el.shareMetadataFile.files && el.shareMetadataFile.files[0];
    if (!file) {
      setCatalogStatus("choose a share metadata JSON file", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} share metadata selected`, false);
  });

  el.applyPeerContactCardButton.addEventListener("click", function () {
    applyPeerContactCardFile(el.peerContactCardFile).catch((error) => {
      updatePeerUrlStatus(errorMessage(error), true);
    });
  });

  el.peerContactCardFile.addEventListener("change", function () {
    const file = el.peerContactCardFile.files && el.peerContactCardFile.files[0];
    if (!file) {
      updatePeerUrlStatus("choose a peer contact card or enter a URL", false);
      return;
    }
    updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact card selected`, false);
  });

  el.applyPeerContactBookButton.addEventListener("click", function () {
    applyPeerContactBookFile(el.peerContactBookFile).catch((error) => {
      updatePeerUrlStatus(errorMessage(error), true);
    });
  });

  el.peerContactBookFile.addEventListener("change", function () {
    const file = el.peerContactBookFile.files && el.peerContactBookFile.files[0];
    if (!file) {
      updatePeerUrlStatus("choose a peer contact book, peer contact card, or enter a URL", false);
      return;
    }
    updatePeerUrlStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer contact book selected`, false);
  });

  el.applyPeerAnnouncementButton.addEventListener("click", function () {
    applyPeerSourceAnnouncementFile(el.peerAnnouncementFile).catch((error) => {
      setCatalogStatus(errorMessage(error), true);
    });
  });

  el.peerAnnouncementFile.addEventListener("change", function () {
    const file = el.peerAnnouncementFile.files && el.peerAnnouncementFile.files[0];
    if (!file) {
      setCatalogStatus("choose a peer-source announcement or feed after loading metadata", false);
      return;
    }
    setCatalogStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer-source announcement/feed selected`, false);
  });

  el.importReceiptLedgerButton.addEventListener("click", function () {
    importReceiptLedgerFile(el.importReceiptLedgerFile).catch((error) => {
      setImportReceiptLedgerStatus(errorMessage(error), true);
    });
  });

  el.importReceiptLedgerFile.addEventListener("change", function () {
    const file = el.importReceiptLedgerFile.files && el.importReceiptLedgerFile.files[0];
    if (!file) {
      setImportReceiptLedgerStatus("choose an import receipt ledger JSON file", false);
      return;
    }
    setImportReceiptLedgerStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} import receipt ledger selected`, false);
  });

  el.peerStatusCheckButton.addEventListener("click", function () {
    importPeerStatusCheckFile(el.peerStatusCheckFile).catch((error) => {
      setPeerStatusCheckStatus(errorMessage(error), true);
    });
  });

  el.peerStatusCheckFile.addEventListener("change", function () {
    const file = el.peerStatusCheckFile.files && el.peerStatusCheckFile.files[0];
    if (!file) {
      setPeerStatusCheckStatus("choose a peer status check JSON file", false);
      return;
    }
    setPeerStatusCheckStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer status check selected`, false);
  });

  el.peerCompanionInventoryButton.addEventListener("click", function () {
    importPeerCompanionInventoryFile(el.peerCompanionInventoryFile).catch((error) => {
      setPeerCompanionInventoryStatus(errorMessage(error), true);
    });
  });

  el.peerCompanionInventoryFile.addEventListener("change", function () {
    const file = el.peerCompanionInventoryFile.files && el.peerCompanionInventoryFile.files[0];
    if (!file) {
      setPeerCompanionInventoryStatus("choose a peer companion inventory JSON file", false);
      return;
    }
    setPeerCompanionInventoryStatus(`${safeLocalModelName(file.name)} / ${formatByteCount(file.size)} peer companion inventory selected`, false);
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

  el.saveShareKitButton.addEventListener("click", function () {
    saveShareKit().catch((error) => {
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
