#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

const appUrl = process.argv[2] || "http://127.0.0.1:8080/app/";
const port = Number(process.argv[3] || 9223);
const smokeMode = process.argv[5] || "single";
const publicLocalOnlySmokeMode = smokeMode === "public-local-only";
const hfSearchUiSmokeMode = smokeMode === "hf-search-ui";
const hfLocalCatalogSmokeMode = smokeMode === "hf-local-catalog-ui";
const hfPeerAnnouncementSmokeMode = smokeMode === "hf-peer-announcement-ui";
const hfCatalogAnnouncementRouteSmokeMode = smokeMode === "hf-catalog-announcement-route-ui";
const shareMetadataSmokeMode = smokeMode === "share-metadata-ui";
const catalogLocalImportSmokeMode = smokeMode === "catalog-local-import";
const combinedSelectorOperatorFamilyRouteSoakMode = smokeMode === "combined-selector-operator-family-route-soak";
const combinedSelectorOperatorFamilyReloadSoakMode = smokeMode === "combined-selector-operator-family-reload-soak";
const combinedSelectorRouteSoakMode = combinedSelectorOperatorFamilyRouteSoakMode || smokeMode === "combined-selector-route-soak" || smokeMode === "combined-selector-route-extended-soak" || smokeMode === "combined-selector-route-stress-soak";
const convertedTrainedRegistrySmokeMode = smokeMode === "converted-trained-registry";
const convertedTrainedRegistryFileSmokeMode = smokeMode === "converted-trained-registry-file";
const convertedTrainedBpeRegistryFileSmokeMode = smokeMode === "converted-trained-bpe-registry-file";
const convertedTrainedSourceManifestDriftSmokeMode = smokeMode === "converted-trained-source-manifest-drift";
const convertedTrainedSourceIdentityDriftSmokeMode = smokeMode === "converted-trained-source-identity-drift";
const convertedTrainedSourceReviewDriftSmokeMode = smokeMode === "converted-trained-source-review-drift";
const convertedTrainedSourceReviewSidecarDriftSmokeMode = smokeMode === "converted-trained-source-review-sidecar-drift";
const convertedTrainedSourceReviewTokenizerImportDriftSmokeMode = smokeMode === "converted-trained-source-review-tokenizer-import-drift";
const convertedTrainedSourceReviewEvalRouteDriftSmokeMode = smokeMode === "converted-trained-source-review-eval-route-drift";
const convertedTrainedSourceReviewOmittedSmokeMode = smokeMode === "converted-trained-source-review-omitted";
const convertedTrainedSourceValidationDriftSmokeMode = smokeMode === "converted-trained-source-validation-drift";
const convertedTrainedRuntimeEvidenceDriftSmokeMode = smokeMode === "converted-trained-runtime-evidence-drift";
const convertedTrainedEvalEvidenceDriftSmokeMode = smokeMode === "converted-trained-eval-evidence-drift";
const convertedTrainedAdmissionDriftSmokeMode = smokeMode === "converted-trained-admission-drift";
const convertedTrainedRegistryAnySmokeMode = convertedTrainedRegistrySmokeMode || convertedTrainedRegistryFileSmokeMode || convertedTrainedBpeRegistryFileSmokeMode;
const q4DefaultSmokeModes = new Set([
  "adapter-manifest-budget",
  "adapter-family-receipt-drift",
  "adapter-manifest-drift",
  "source-backed-alr1-manifest-drift",
  "adapter-artifact-drift",
  "module-plan-payload-checksum-drift",
  "adapter-stack-prefetch-drift",
  "adapter-stack-rust-validate-drift",
  "module-plan-profile-drift",
  "module-plan-execution-profile-drift",
  "module-plan-fetch-policy-drift",
  "module-plan-origin-policy-drift",
  "module-plan-wasm-memory-drift",
  "module-plan-wasm-export-set-drift",
  "module-plan-wasm-transfer-drift",
  "module-plan-model-release-drift",
  "module-plan-runtime-reset-drift",
  "module-plan-adapter-validation-drift",
  "module-plan-adapter-validation-count-drift",
  "module-plan-adapter-apply-count-drift",
  "module-plan-wasm-heap-drift",
  "module-plan-context-token-drift",
  "module-plan-sampler-cap-drift",
  "module-plan-tokenizer-drift",
  "module-plan-resource-drift",
  "module-plan-runtime-scratch-drift",
  "module-plan-output-limit-drift",
  "module-plan-prompt-limit-drift",
  "module-plan-fetch-count-drift",
  "module-plan-planned-fetch-count-drift",
  "module-plan-route-set-algorithm-drift",
  "module-plan-route-set-version-drift",
  "module-plan-route-set-drift",
  "module-plan-operator-receipt-drift",
  "module-plan-kv-cache-drift",
  "module-plan-adapter-stack-budget-drift",
  "module-plan-total-budget-drift",
  "module-plan-total-limit-drift",
  "module-plan-count-drift",
  "module-plan-graph-drift",
  "module-plan-stack-drift",
  "module-plan-role-drift",
  "module-plan-slot-drift",
  "module-plan-phase-drift",
  "module-plan-byte-drift",
  "module-plan-checksum-drift",
  "module-plan-dependency-drift",
  "assembly-eval-case-drift",
  "assembly-evidence-file-drift",
  "combined-selector-assembly",
  "combined-selector-operator-family",
  "combined-selector-operator-family-cycle",
  "combined-selector-operator-family-route-soak",
  "combined-selector-operator-family-reload-soak",
  "combined-selector-cycle",
  "combined-selector-reload-soak"
]);
const compactOperatorRegistryModels = {
  "multi-parent-registry": "multi-parent-sign-merge-q8",
  "blend-operator-registry": "tinylm16-blend-q8",
  "delta-operator-registry": "tinylm16-delta-q8",
  "sparse-delta-operator-registry": "tinylm16-sparse-delta-q8",
  "dare-operator-registry": "tinylm16-dare-q8",
  "prune-operator-registry": "tinylm16-prune-q8",
  "crossover-operator-registry": "tinylm16-crossover-q8",
  "mutation-operator-registry": "tinylm16-mutation-q8"
};
const compactOperatorRegistrySmokeModes = new Set(Object.keys(compactOperatorRegistryModels));
const compactOperatorReceiptDriftSmokeModes = new Set([
  "selector-operator-receipt-drift",
  "blend-operator-receipt-drift",
  "delta-operator-receipt-drift",
  "sparse-delta-operator-receipt-drift",
  "dare-operator-receipt-drift",
  "prune-operator-receipt-drift",
  "crossover-operator-receipt-drift",
  "mutation-operator-receipt-drift"
]);
const generatedSelectorDriftSmokeModes = new Set([
  "generated-selector-operator-receipt-drift",
  "generated-selector-operator-kind-drift",
  "generated-selector-schedule-source-drift",
  "generated-selector-schedule-family-drift"
]);
const expectedModel = process.argv[4] || compactOperatorRegistryModels[smokeMode] || (convertedTrainedRegistryAnySmokeMode || convertedTrainedSourceManifestDriftSmokeMode || convertedTrainedSourceIdentityDriftSmokeMode || convertedTrainedSourceReviewDriftSmokeMode || convertedTrainedSourceReviewSidecarDriftSmokeMode || convertedTrainedSourceReviewTokenizerImportDriftSmokeMode || convertedTrainedSourceReviewEvalRouteDriftSmokeMode || convertedTrainedSourceReviewOmittedSmokeMode || convertedTrainedSourceValidationDriftSmokeMode || convertedTrainedRuntimeEvidenceDriftSmokeMode || convertedTrainedEvalEvidenceDriftSmokeMode || convertedTrainedAdmissionDriftSmokeMode ? "converted-trained-q8" : smokeMode === "adapter-sidecar-registry-q8" ? "tinyq8" : q4DefaultSmokeModes.has(smokeMode) || combinedSelectorRouteSoakMode ? "multi-parent-sign-merge-q4" : smokeMode === "multi-parent-registry-file" || smokeMode === "adapter-sidecar-registry-file" ? "multi-parent-sign-merge-f32" : smokeMode === "adapter-sidecar" || smokeMode === "adapter-sidecar-checksum-mismatch" ? "tinyf32" : "tinylm16q8");
const enduranceCycles = Math.max(2, Math.min(20, Number.parseInt(process.argv[6] || "4", 10) || 4));
const performanceTokens = Math.max(2, Math.min(8, Number.parseInt(process.argv[6] || "4", 10) || 4));
const performanceSoakCycles = Math.max(2, Math.min(10, Number.parseInt(process.argv[6] || "3", 10) || 3));
const performanceSoakTokens = Math.max(2, Math.min(8, Number.parseInt(process.argv[7] || "4", 10) || 4));
const combinedSelectorDefaultCycles = smokeMode === "combined-selector-route-stress-soak" ? "8" : smokeMode === "combined-selector-route-extended-soak" ? "5" : smokeMode === "combined-selector-route-soak" ? "3" : "2";
const combinedSelectorMinCycles = smokeMode === "combined-selector-route-stress-soak" ? 8 : smokeMode === "combined-selector-route-extended-soak" ? 5 : smokeMode === "combined-selector-route-soak" ? 3 : 2;
const combinedSelectorCycles = Math.max(combinedSelectorMinCycles, Math.min(10, Number.parseInt(process.argv[6] || combinedSelectorDefaultCycles, 10) || Number.parseInt(combinedSelectorDefaultCycles, 10)));
const combinedSelectorReloads = Math.max(2, Math.min(6, Number.parseInt(process.argv[6] || "2", 10) || 2));
const checksumMask64 = (1n << 64n) - 1n;
const checksumPrime64 = 0x100000001b3n;

function combinedSelectorModelsFor(modelKey, mode = smokeMode) {
  // Selects the generated operator family while preserving q4-first frugal switching order.
  if (
    mode === "combined-selector-operator-family" ||
    mode === "combined-selector-operator-family-cycle" ||
    mode === "combined-selector-operator-family-route-soak" ||
    mode === "combined-selector-operator-family-reload-soak"
  ) {
    return [
      "multi-parent-sign-merge-q4",
      "multi-parent-soup-q4",
      "multi-parent-sign-merge-q8",
      "multi-parent-soup-q8",
      "multi-parent-sign-merge-f32",
      "multi-parent-soup-f32"
    ];
  }
  const prefix = String(modelKey || "").startsWith("multi-parent-soup-")
    ? "multi-parent-soup"
    : "multi-parent-sign-merge";
  return [`${prefix}-q4`, `${prefix}-q8`, `${prefix}-f32`];
}

const combinedSelectorModels = combinedSelectorModelsFor(expectedModel);

function isGeneratedMultiParentModel(modelKey) {
  // Groups generated parent-pool bundles whose evidence is validated before browser use.
  return modelKey.startsWith("multi-parent-sign-merge-") || modelKey.startsWith("multi-parent-soup-");
}

function expectedOperatorKindForModel(modelKey) {
  if (modelKey.startsWith("multi-parent-soup-")) {
    return "seed-weighted-parent-pool-soup";
  }
  if (modelKey.startsWith("multi-parent-sign-merge-")) {
    return "sign-aware-parent-pool-merge";
  }
  return "";
}

function expectedEvolutionScheduleForModel(modelKey) {
  // Mirrors the parent-pool recipe family order written into generated selector entries.
  if (modelKey.startsWith("multi-parent-soup-")) {
    return {
      familyIndex: 1,
      familyCommand: "soup-candidate",
      familySelectionRule: "seed-weighted-direct-parameter-average",
      familyOutputGate: "multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval"
    };
  }
  if (modelKey.startsWith("multi-parent-sign-merge-")) {
    return {
      familyIndex: 0,
      familyCommand: "sign-merge-candidate",
      familySelectionRule: "seed-weighted-delta-sign-consensus",
      familyOutputGate: "multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval"
    };
  }
  return null;
}

const expectedQuantization = {
  tinylm16q8: "q8_0",
  tinylm16q4: "q4_0",
  tinylm16f32: "f32",
  tinyf32: "f32",
  tinytied: "f32",
  tinyq8: "q8_0",
  tinyq4: "q4_0",
  tinybpe: "f32",
  "tinylm16-blend-q8": "q8_0",
  "tinylm16-delta-q8": "q8_0",
  "tinylm16-sparse-delta-q8": "q8_0",
  "tinylm16-dare-q8": "q8_0",
  "tinylm16-prune-q8": "q8_0",
  "tinylm16-crossover-q8": "q8_0",
  "tinylm16-mutation-q8": "q8_0",
  "converted-trained-f32": "f32",
  "converted-trained-q8": "q8_0",
  "converted-trained-q4": "q4_0",
  "multi-parent-sign-merge-q8": "q8_0",
  "multi-parent-sign-merge-q4": "q4_0",
  "multi-parent-sign-merge-f32": "f32",
  "multi-parent-soup-q8": "q8_0",
  "multi-parent-soup-q4": "q4_0",
  "multi-parent-soup-f32": "f32"
};

const expectedModelLabels = {
  "tinylm16-blend-q8": "TinyLM-16M q8 blend candidate",
  "tinylm16-delta-q8": "TinyLM-16M q8 delta candidate",
  "tinylm16-sparse-delta-q8": "TinyLM-16M q8 sparse-delta candidate",
  "tinylm16-dare-q8": "TinyLM-16M q8 DARE candidate",
  "tinylm16-prune-q8": "TinyLM-16M q8 prune candidate",
  "tinylm16-crossover-q8": "TinyLM-16M q8 crossover candidate",
  "tinylm16-mutation-q8": "TinyLM-16M q8 mutation candidate",
  "converted-trained-f32": "Converted trained-source f32",
  "converted-trained-q8": "Converted trained-source q8_0",
  "converted-trained-q4": "Converted trained-source q4_0",
  "multi-parent-sign-merge-q8": "multi-parent-sign-merge-q8 q8_0",
  "multi-parent-sign-merge-q4": "multi-parent-sign-merge-q4 q4_0",
  "multi-parent-sign-merge-f32": "multi-parent-sign-merge-f32 f32",
  "multi-parent-soup-q8": "multi-parent-soup-q8 q8_0",
  "multi-parent-soup-q4": "multi-parent-soup-q4 q4_0",
  "multi-parent-soup-f32": "multi-parent-soup-f32 f32"
};

const expectedModelRoutes = {
  tinyq8: "/models/tiny-test-model-q8.slm",
  tinyq4: "/models/tiny-test-model-q4.slm",
  "tinylm16-blend-q8": "/models/tinylm16-q8.slm",
  "tinylm16-delta-q8": "/models/tinylm16-q8.slm",
  "tinylm16-sparse-delta-q8": "/models/tinylm16-q8.slm",
  "tinylm16-dare-q8": "/models/tinylm16-q8.slm",
  "tinylm16-prune-q8": "/models/tinylm16-q8.slm",
  "tinylm16-crossover-q8": "/models/tinylm16-q8.slm",
  "tinylm16-mutation-q8": "/models/tinylm16-q8.slm",
  "converted-trained-f32": "/models/converted-trained-f32.slm",
  "converted-trained-q8": "/models/converted-trained-q8.slm",
  "converted-trained-q4": "/models/converted-trained-q4.slm",
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.slm",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.slm",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.slm",
  "multi-parent-soup-q8": "/models/multi-parent-soup-q8.slm",
  "multi-parent-soup-q4": "/models/multi-parent-soup-q4.slm",
  "multi-parent-soup-f32": "/models/multi-parent-soup-f32.slm"
};

const expectedAdapterLabels = {
  tinyf32: ["Tiny Fixture f32 self ADP1"],
  tinyq8: ["Tiny Fixture q8_0 self ADP1"],
  tinyq4: ["Tiny Fixture q4_0 self ADP1"],
  "multi-parent-sign-merge-f32": [
    "Multi-parent sign-merge f32 self ADP1",
    "Multi-parent sign-merge f32 family ADP1",
    "Multi-parent sign-merge f32 sparse ASP1",
    "Multi-parent sign-merge f32 source-backed ALR1"
  ],
  "multi-parent-sign-merge-q8": [
    "Multi-parent sign-merge q8_0 self ADP1",
    "Multi-parent sign-merge q8_0 family ADP1",
    "Multi-parent sign-merge q8_0 sparse ASP1",
    "Multi-parent sign-merge q8_0 source-backed ALR1"
  ],
  "multi-parent-sign-merge-q4": [
    "Multi-parent sign-merge q4_0 self ADP1",
    "Multi-parent sign-merge q4_0 family ADP1",
    "Multi-parent sign-merge q4_0 sparse ASP1",
    "Multi-parent sign-merge q4_0 source-backed ALR1"
  ],
  "multi-parent-soup-q8": [
    "Multi-parent weighted soup q8_0 self ADP1",
    "Multi-parent weighted soup q8_0 family ADP1",
    "Multi-parent weighted soup q8_0 sparse ASP1",
    "Multi-parent weighted soup q8_0 source-backed ALR1"
  ],
  "multi-parent-soup-q4": [
    "Multi-parent weighted soup q4_0 self ADP1",
    "Multi-parent weighted soup q4_0 family ADP1",
    "Multi-parent weighted soup q4_0 sparse ASP1",
    "Multi-parent weighted soup q4_0 source-backed ALR1"
  ],
  "multi-parent-soup-f32": [
    "Multi-parent weighted soup f32 self ADP1",
    "Multi-parent weighted soup f32 family ADP1",
    "Multi-parent weighted soup f32 sparse ASP1",
    "Multi-parent weighted soup f32 source-backed ALR1"
  ]
};

const expectedAdapterRoutes = {
  tinyf32: "/models/tiny-test-model-self.adp1",
  tinyq8: "/models/tiny-test-model-q8-self.adp1",
  tinyq4: "/models/tiny-test-model-q4-self.adp1",
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8-sparse.asp1",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4-sparse.asp1",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32-sparse.asp1",
  "multi-parent-soup-q8": "/models/multi-parent-soup-q8-sparse.asp1",
  "multi-parent-soup-q4": "/models/multi-parent-soup-q4-sparse.asp1",
  "multi-parent-soup-f32": "/models/multi-parent-soup-f32-sparse.asp1"
};

const expectedAdapterStackRoutes = {
  "multi-parent-sign-merge-q8": [
    "/models/multi-parent-sign-merge-q8-family.adp1",
    "/models/multi-parent-sign-merge-q8-sparse.asp1",
    "/models/multi-parent-sign-merge-q8-low-rank.alr1"
  ],
  "multi-parent-sign-merge-q4": [
    "/models/multi-parent-sign-merge-q4-family.adp1",
    "/models/multi-parent-sign-merge-q4-sparse.asp1",
    "/models/multi-parent-sign-merge-q4-low-rank.alr1"
  ],
  "multi-parent-sign-merge-f32": [
    "/models/multi-parent-sign-merge-f32-family.adp1",
    "/models/multi-parent-sign-merge-f32-sparse.asp1",
    "/models/multi-parent-sign-merge-f32-low-rank.alr1"
  ],
  "multi-parent-soup-q8": [
    "/models/multi-parent-soup-q8-family.adp1",
    "/models/multi-parent-soup-q8-sparse.asp1",
    "/models/multi-parent-soup-q8-low-rank.alr1"
  ],
  "multi-parent-soup-q4": [
    "/models/multi-parent-soup-q4-family.adp1",
    "/models/multi-parent-soup-q4-sparse.asp1",
    "/models/multi-parent-soup-q4-low-rank.alr1"
  ],
  "multi-parent-soup-f32": [
    "/models/multi-parent-soup-f32-family.adp1",
    "/models/multi-parent-soup-f32-sparse.asp1",
    "/models/multi-parent-soup-f32-low-rank.alr1"
  ]
};

const expectedAdapterFamilyReceiptRoutes = {
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.adapter-family.receipt",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.adapter-family.receipt",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.adapter-family.receipt",
  "multi-parent-soup-q8": "/models/multi-parent-soup-q8.adapter-family.receipt",
  "multi-parent-soup-q4": "/models/multi-parent-soup-q4.adapter-family.receipt",
  "multi-parent-soup-f32": "/models/multi-parent-soup-f32.adapter-family.receipt"
};

const expectedAssemblyReceiptRoutes = {
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.assembly.receipt",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.assembly.receipt",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.assembly.receipt",
  "multi-parent-soup-q8": "/models/multi-parent-soup-q8.assembly.receipt",
  "multi-parent-soup-q4": "/models/multi-parent-soup-q4.assembly.receipt",
  "multi-parent-soup-f32": "/models/multi-parent-soup-f32.assembly.receipt"
};

const expectedModulePlanRoutes = {
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.module-plan.receipt",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.module-plan.receipt",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.module-plan.receipt",
  "multi-parent-soup-q8": "/models/multi-parent-soup-q8.module-plan.receipt",
  "multi-parent-soup-q4": "/models/multi-parent-soup-q4.module-plan.receipt",
  "multi-parent-soup-f32": "/models/multi-parent-soup-f32.module-plan.receipt"
};

const expectedModulePlanExecutionProfile = "single-threaded-wasm-local-v1";
const expectedModulePlanFetchPolicy = "local-no-store-v1";
const expectedModulePlanOriginPolicy = "same-origin-loopback-local-v1";
const expectedModulePlanFetchLimit = "32 fetches";
const expectedModulePlanFetchLimitCount = 32;
const expectedModulePlanPlannedFetches = "21 fetches";
const expectedModulePlanActualFetches = 21;
const expectedModulePlanRouteSetVersion = "1";
const expectedModulePlanRouteSetChecksumAlgorithm = "tinyrustlm-text-checksum-v1";
const expectedModulePlanWasmMemoryInitialPages = "17";
const expectedModulePlanWasmExportSet = "tinyrustlm-generate-v1";
const expectedModulePlanWasmTransferStrategy = "copy-then-release-v1";
const expectedModulePlanModelReleaseStrategy = "free-before-reassembly-v1";
const expectedModulePlanRuntimeResetStrategy = "reset-context-before-assembly-v1";
const expectedModulePlanAdapterValidationStrategy = "rust-validate-before-apply-v1";
const expectedModulePlanAdapterValidationCount = "3";
const expectedModulePlanAdapterValidationCountValue = 3;
const expectedModulePlanAdapterApplyCount = "3";
const expectedModulePlanAdapterApplyCountValue = 3;
const expectedModulePlanWasmHeapMinBytes = "65536 bytes";
const expectedModulePlanContextTokens = "16 tokens";
const expectedModulePlanSamplerCap = "1024 candidates";
const expectedModulePlanAdapterStackBudget = "22144 bytes";
const expectedModulePlanPromptLimit = "4096 bytes";
const expectedModulePlanOutputLimit = "65536 bytes";
const expectedModulePlanKvCacheBudget = "1024 bytes";
const expectedModulePlanKvCachePages = "1";

const expectedModulePlanModelBudgets = {
  "multi-parent-sign-merge-q8": "8832 bytes",
  "multi-parent-sign-merge-q4": "6592 bytes",
  "multi-parent-sign-merge-f32": "20352 bytes",
  "multi-parent-soup-q8": "8832 bytes",
  "multi-parent-soup-q4": "6592 bytes",
  "multi-parent-soup-f32": "20352 bytes"
};

const expectedModulePlanTotalBudgets = {
  "multi-parent-sign-merge-q8": "175663 bytes",
  "multi-parent-sign-merge-q4": "173423 bytes",
  "multi-parent-sign-merge-f32": "187197 bytes"
};

const expectedModulePlanTotalLimits = {
  "multi-parent-sign-merge-q8": "43454464 bytes",
  "multi-parent-sign-merge-q4": "43454464 bytes",
  "multi-parent-sign-merge-f32": "43454464 bytes",
  "multi-parent-soup-q8": "43454464 bytes",
  "multi-parent-soup-q4": "43454464 bytes",
  "multi-parent-soup-f32": "43454464 bytes"
};

const expectedModulePlanBytes = {
  "multi-parent-sign-merge-q8": "0: 8832 bytes, 1: 600 bytes, 2: 1896 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes",
  "multi-parent-sign-merge-q4": "0: 6592 bytes, 1: 600 bytes, 2: 1896 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes",
  "multi-parent-sign-merge-f32": "0: 20352 bytes, 1: 601 bytes, 2: 1909 bytes, 3: 5999 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes"
};

const expectedModulePlanChecksums = {
  "multi-parent-sign-merge-q8": "0: 0x0132bc82d5a0d7d6, 1: 0xe67e0141a8602759, 2: 0xfd017c2fe5d1f2c9, 3: 0x5857154de5cc46bc, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9",
  "multi-parent-sign-merge-q4": "0: 0x1a6808e3098d1ce0, 1: 0xbeed28d92ef80a8c, 2: 0x73c01acb9dd13aaa, 3: 0x04bb5fc25a2acfee, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2",
  "multi-parent-sign-merge-f32": "0: 0x8a0e6c4c01998199, 1: 0xef8c01142b3b0ab2, 2: 0xc93fd1b14407c277, 3: 0xeb5523a8f7a6af63, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5"
};

const expectedModulePlanRoles =
  "0: runtime-model, 1: model-provenance-manifest, 2: assembly-evidence, 3: adapter-family, 4: adapter-stack-family-delta, 5: adapter-stack-sparse-delta, 6: adapter-stack-low-rank-delta";

const expectedModulePlanSlots =
  "0: runtime-model, 1: model-manifest, 2: assembly-receipt, 3: adapter-family-receipt, 4: adapter-stack-0, 5: adapter-stack-1, 6: adapter-stack-2";

const expectedModulePlanPhases =
  "0: load-model-bytes, 1: verify-model-manifest, 2: verify-assembly-evidence, 3: verify-adapter-family, 4: apply-adapter-stack-0, 5: apply-adapter-stack-1, 6: apply-adapter-stack-2";

const expectedModulePlanDependencies =
  "0: runtime-wasm, 1: module.0, 2: module.1, 3: module.2, 4: module.3, 5: module.4, 6: module.5";

const expectedModulePlanTrace =
  "0: plan verified, 1: model accepted, 2: manifest verified, 3: assembly evidence verified, 4: adapter family verified, 5: adapter stack applied, 6: ready";

function modulePlanByteSummaryTotal(summary) {
  // Computes the receipt-declared module byte total from the rendered Module Plan row.
  const matches = String(summary || "").matchAll(/\b\d+: (\d+) bytes\b/g);
  let total = 0;
  let count = 0;
  for (const match of matches) {
    total += Number.parseInt(match[1], 10);
    count += 1;
  }
  return count > 0 ? `${total} bytes` : null;
}

function byteCountFromLabel(label) {
  // Parses rendered byte labels so path-flexible generated roots can still prove budget math.
  const match = String(label || "").match(/^(\d+) bytes$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function modulePlanExpectedTotalBudget(result) {
  // Recomputes the browser-local total budget from rendered module bytes and fixed envelopes.
  const moduleBytes = byteCountFromLabel(modulePlanByteSummaryTotal(result.modulePlanBytes));
  const scratchBytes = byteCountFromLabel(result.modulePlanScratchBudget);
  const promptBytes = byteCountFromLabel(result.modulePlanPromptLimit);
  const outputBytes = byteCountFromLabel(result.modulePlanOutputLimit);
  const kvBytes = byteCountFromLabel(result.modulePlanKvCacheBudget);
  if ([moduleBytes, scratchBytes, promptBytes, outputBytes, kvBytes].some((value) => value === null)) {
    return null;
  }
  return `${moduleBytes + scratchBytes + promptBytes + outputBytes + kvBytes} bytes`;
}

const expectedAssemblyEvidenceRoutes = {
  "multi-parent-sign-merge-q8": multiParentEvidenceRoutes("multi-parent-sign-merge-q8"),
  "multi-parent-sign-merge-q4": multiParentEvidenceRoutes("multi-parent-sign-merge-q4"),
  "multi-parent-sign-merge-f32": multiParentEvidenceRoutes("multi-parent-sign-merge-f32"),
  "multi-parent-soup-q8": multiParentEvidenceRoutes("multi-parent-soup-q8"),
  "multi-parent-soup-q4": multiParentEvidenceRoutes("multi-parent-soup-q4"),
  "multi-parent-soup-f32": multiParentEvidenceRoutes("multi-parent-soup-f32")
};

const expectedAdapterManifestRoutes = {
  "multi-parent-sign-merge-q8": [
    "/models/multi-parent-sign-merge-q8-self.adp1.manifest",
    "/models/multi-parent-sign-merge-q8-family.adp1.manifest",
    "/models/multi-parent-sign-merge-q8-sparse.asp1.manifest",
    "/models/multi-parent-sign-merge-q8-low-rank.alr1.manifest"
  ],
  "multi-parent-sign-merge-q4": [
    "/models/multi-parent-sign-merge-q4-self.adp1.manifest",
    "/models/multi-parent-sign-merge-q4-family.adp1.manifest",
    "/models/multi-parent-sign-merge-q4-sparse.asp1.manifest",
    "/models/multi-parent-sign-merge-q4-low-rank.alr1.manifest"
  ],
  "multi-parent-sign-merge-f32": [
    "/models/multi-parent-sign-merge-f32-self.adp1.manifest",
    "/models/multi-parent-sign-merge-f32-family.adp1.manifest",
    "/models/multi-parent-sign-merge-f32-sparse.asp1.manifest",
    "/models/multi-parent-sign-merge-f32-low-rank.alr1.manifest"
  ],
  "multi-parent-soup-q8": [
    "/models/multi-parent-soup-q8-self.adp1.manifest",
    "/models/multi-parent-soup-q8-family.adp1.manifest",
    "/models/multi-parent-soup-q8-sparse.asp1.manifest",
    "/models/multi-parent-soup-q8-low-rank.alr1.manifest"
  ],
  "multi-parent-soup-q4": [
    "/models/multi-parent-soup-q4-self.adp1.manifest",
    "/models/multi-parent-soup-q4-family.adp1.manifest",
    "/models/multi-parent-soup-q4-sparse.asp1.manifest",
    "/models/multi-parent-soup-q4-low-rank.alr1.manifest"
  ],
  "multi-parent-soup-f32": [
    "/models/multi-parent-soup-f32-self.adp1.manifest",
    "/models/multi-parent-soup-f32-family.adp1.manifest",
    "/models/multi-parent-soup-f32-sparse.asp1.manifest",
    "/models/multi-parent-soup-f32-low-rank.alr1.manifest"
  ]
};

const expectedAdapterApplyIndexes = {
  tinyf32: 0,
  "multi-parent-sign-merge-q8": 2,
  "multi-parent-sign-merge-q4": 2,
  "multi-parent-sign-merge-f32": 2,
  "multi-parent-soup-q8": 2,
  "multi-parent-soup-q4": 2,
  "multi-parent-soup-f32": 2
};

function multiParentEvidenceRoutes(modelKey) {
  // Chooses the generated evidence filename family from the model id stem.
  const evidencePrefix = modelKey.startsWith("multi-parent-soup-") ? "soup" : "sign-merge";
  return [
    `/evidence/${modelKey}/population.ledger`,
    `/evidence/${modelKey}/population.review`,
    `/evidence/${modelKey}/parent-pool.recipe`,
    `/evidence/${modelKey}/${evidencePrefix}.operator`,
    `/evidence/${modelKey}/${evidencePrefix}.candidate`,
    `/evidence/${modelKey}/${evidencePrefix}.promotion`,
    `/evidence/${modelKey}/${evidencePrefix}.runtime`,
    `/evidence/${modelKey}/${evidencePrefix}.eval`,
    `/evidence/${modelKey}/${evidencePrefix}.multi.admission`
  ];
}

function expectedLabelForModel(modelKey) {
  if (modelKey === "multi-parent-sign-merge-q8" && smokeMode === "multi-parent-registry") {
    return "Multi-parent sign-merge q8_0";
  }
  return expectedModelLabels[modelKey] || modelKey;
}

function expectedRouteForModel(modelKey) {
  if (modelKey === "multi-parent-sign-merge-q8" && smokeMode === "multi-parent-registry") {
    return "/models/tinylm16-q8.slm";
  }
  return expectedModelRoutes[modelKey];
}

function networkIncludesPath(networkRequests, expectedPath) {
  return networkRequests.some((requestUrl) => {
    try {
      return new URL(requestUrl).pathname === expectedPath;
    } catch (_error) {
      return requestUrl === expectedPath;
    }
  });
}

function requestUrlPathEquals(requestUrl, expectedPath) {
  try {
    return new URL(requestUrl).pathname === expectedPath;
  } catch (_error) {
    return requestUrl === expectedPath;
  }
}

// Normalizes browser request URLs so route-budget checks can reason about paths only.
function requestUrlPath(requestUrl) {
  try {
    return new URL(requestUrl).pathname;
  } catch (_error) {
    return requestUrl;
  }
}

function networkPathIndex(networkRequests, expectedPath) {
  return networkRequests.findIndex((requestUrl) => {
    try {
      return new URL(requestUrl).pathname === expectedPath;
    } catch (_error) {
      return requestUrl === expectedPath;
    }
  });
}

function networkPathCount(networkRequests, expectedPath) {
  return networkRequests.filter((requestUrl) => requestUrlPathEquals(requestUrl, expectedPath)).length;
}

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

function findBrowser() {
  for (const candidate of chromeCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("Chrome or Edge executable was not found");
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, (response) => {
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} while fetching ${url}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
    request.on("error", reject);
  });
}

async function getText(url) {
  return (await getBuffer(url)).toString("utf8");
}

function rotateLeft64(value, bits) {
  return ((value << bits) | (value >> (64n - bits))) & checksumMask64;
}

function textChecksumHex(text) {
  const bytes = Buffer.from(text, "utf8");
  let acc = 0x4d595df4d0f33173n;
  for (let index = 0; index < bytes.length; index += 1) {
    acc ^= BigInt(bytes[index]) + (BigInt(index) << 2n);
    acc = (rotateLeft64(acc, 9n) * checksumPrime64) & checksumMask64;
  }
  return `0x${acc.toString(16).padStart(16, "0")}`;
}

function parseManifestText(text) {
  const fields = Object.create(null);
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    fields[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return fields;
}

function evalCaseEvidenceChecksumFromText(text) {
  // Matches the browser and Rust case-ledger checksum for converted-trained eval sidecars.
  const fields = parseManifestText(text);
  const caseCount = Number.parseInt(fields.case_count || "", 10);
  if (!Number.isSafeInteger(caseCount) || String(caseCount) !== fields.case_count || caseCount < 1) {
    throw new Error("eval sidecar case_count was invalid");
  }
  const lines = [];
  for (const key of ["case_count", "cases_passed", "cases_failed"]) {
    if (!fields[key]) {
      throw new Error(`eval sidecar field ${key} was missing`);
    }
    lines.push(`${key}=${fields[key]}`);
  }
  for (let index = 0; index < caseCount; index += 1) {
    const prefix = `case.${index}`;
    for (const suffix of ["status", "expected", "actual", "error"]) {
      const key = `${prefix}.${suffix}`;
      if (!fields[key]) {
        throw new Error(`eval sidecar field ${key} was missing`);
      }
      lines.push(`${key}=${fields[key]}`);
    }
  }
  return textChecksumHex(`${lines.join("\n")}\n`);
}

function hex64(value) {
  return `0x${value.toString(16).padStart(16, "0")}`;
}

function isHex64(value) {
  return /^0x[0-9a-fA-F]{16}$/.test(String(value || ""));
}

function isFitnessVectorSummary(value) {
  // Matches the compact browser text rendered from selector fitness vector metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 2 && parts[0] === "eval-bound" && isHex64(parts[1]);
}

function isSpeciesFitSummary(value) {
  // Matches the compact browser text rendered from selector species-fit metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 3 && parts[0] === "browser-fit-bound" && isHex64(parts[1]) && isHex64(parts[2]);
}

function isNoveltySummary(value) {
  // Matches the compact browser text rendered from selector novelty sketch metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 3 && parts[0] === "behavior-sketch-bound" && isHex64(parts[1]) && isHex64(parts[2]);
}

function isPopulationSummary(value) {
  // Matches the compact browser text rendered from selector population review metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 3 && parts[0] === "population-review-bound" && isHex64(parts[1]) && isHex64(parts[2]);
}

function isMateSelectionSummary(value) {
  // Matches the compact browser text rendered from selector mate-selection metadata.
  const parts = String(value || "").split(" / ");
  return (
    parts.length === 4 &&
    (parts[0] === "parent-pool-bound" || parts[0] === "admission-only") &&
    /^[1-9][0-9]* parents$/.test(parts[1]) &&
    isHex64(parts[2]) &&
    isHex64(parts[3])
  );
}

function isPhenotypeEvidenceSummary(value) {
  // Matches the compact browser text rendered from selector phenotype evidence metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 3 && parts[0] === "runtime-eval-bound" && isHex64(parts[1]) && isHex64(parts[2]);
}

function isHeritableArtifactSummary(value) {
  // Matches the compact browser text rendered from selector heritable artifact metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 3 && parts[0] === "served-artifact-bound" && isHex64(parts[1]) && isHex64(parts[2]);
}

function isOperatorReceiptSummary(value, operatorKind) {
  // Matches the compact browser text rendered from selector operator receipt metadata.
  const parts = String(value || "").split(" / ");
  return parts.length === 3 && parts[0] === "receipt-bound" && parts[1] === operatorKind && isHex64(parts[2]);
}

function isEvolutionScheduleSummary(value, expectedSchedule) {
  // Matches the compact browser text rendered from parent-pool evolution schedule metadata.
  const parts = String(value || "").split(" / ");
  return Boolean(expectedSchedule) &&
    parts.length === 6 &&
    parts[0] === "operator-family-planned" &&
    parts[1] === `family ${expectedSchedule.familyIndex}` &&
    parts[2] === expectedSchedule.familyCommand &&
    parts[3] === expectedSchedule.familySelectionRule &&
    parts[4] === expectedSchedule.familyOutputGate &&
    isHex64(parts[5]);
}

function isNonZeroHex64(value) {
  return isHex64(value) && String(value) !== "0x0000000000000000";
}

function adapterArtifactChecksumValue(bytes) {
  if (!bytes || bytes.length < 64) {
    throw new Error("adapter artifact bytes were too short");
  }
  let acc = 0x6164617074657231n;
  for (let index = 0; index < bytes.length; index += 1) {
    const value = index >= 56 && index < 64 ? 0 : bytes[index];
    acc ^= BigInt(value) + (BigInt(index) << 3n);
    acc = (rotateLeft64(acc, 11n) * checksumPrime64) & checksumMask64;
  }
  return acc;
}

function adapterArtifactChecksumHex(bytes) {
  return hex64(adapterArtifactChecksumValue(bytes));
}

function writeU64Le(bytes, offset, value) {
  let remaining = BigInt(value);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

function adapterIdentityDriftBytes(bytes) {
  const body = Buffer.from(bytes);
  if (body.length < 64) {
    throw new Error("adapter artifact bytes were too short");
  }
  body[16] ^= 0x01;
  writeU64Le(body, 56, adapterArtifactChecksumValue(body));
  return body;
}

function replaceLineValue(text, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m");
  if (!pattern.test(text)) {
    throw new Error(`${key} field was not found`);
  }
  return text.replace(pattern, `${key}=${value}`);
}

function driftModulePlanResourceEnvelope(receiptText) {
  const original = "module_plan_adapter_byte_budget=1048576";
  const drifted = "module_plan_adapter_byte_budget=1048575";
  if (!receiptText.includes(original)) {
    throw new Error("module plan adapter byte budget field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanRuntimeScratchBudget(receiptText) {
  const original = "module_plan_runtime_scratch_byte_budget=65536";
  const drifted = "module_plan_runtime_scratch_byte_budget=65535";
  if (!receiptText.includes(original)) {
    throw new Error("module plan runtime scratch byte budget field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanOutputByteLimit(receiptText) {
  // Mutates the declared output cap so the browser validates it before fetching generated bytes.
  const original = "module_plan_output_byte_limit=65536";
  const drifted = "module_plan_output_byte_limit=65535";
  if (!receiptText.includes(original)) {
    throw new Error("module plan output byte limit field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanPromptByteLimit(receiptText) {
  // Mutates the declared prompt cap so input-transfer validation is receipt-bound.
  const original = "module_plan_prompt_byte_limit=4096";
  const drifted = "module_plan_prompt_byte_limit=4095";
  if (!receiptText.includes(original)) {
    throw new Error("module plan prompt byte limit field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanFetchCountLimit(receiptText) {
  // Mutates the route cap so request-count envelopes are checked before model fetches.
  const original = "module_plan_fetch_count_limit=32";
  const drifted = "module_plan_fetch_count_limit=31";
  if (!receiptText.includes(original)) {
    throw new Error("module plan fetch count limit field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanPlannedFetchCount(receiptText) {
  // Mutates the exact generated route count so route-count planning is receipt-bound.
  const original = `module_plan_planned_fetch_count=${expectedModulePlanActualFetches}`;
  const drifted = "module_plan_planned_fetch_count=20";
  if (!receiptText.includes(original)) {
    throw new Error("module plan planned fetch count field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanRouteSetVersion(receiptText) {
  // Mutates the route-set recipe version so route-list validation is version-bound.
  const original = `module_plan_route_set_version=${expectedModulePlanRouteSetVersion}`;
  const drifted = "module_plan_route_set_version=2";
  if (!receiptText.includes(original)) {
    throw new Error("module plan route set version field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanRouteSetChecksumAlgorithm(receiptText) {
  // Mutates the route-set hash label so checksum validation is algorithm-bound.
  const original = `module_plan_route_set_checksum_algorithm=${expectedModulePlanRouteSetChecksumAlgorithm}`;
  const drifted = "module_plan_route_set_checksum_algorithm=legacy-text-checksum-v0";
  if (!receiptText.includes(original)) {
    throw new Error("module plan route set checksum algorithm field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanRouteSetChecksum(receiptText) {
  // Mutates the route-set checksum so route-list validation is receipt-bound.
  const match = receiptText.match(/^module_plan_route_set_checksum=(0x[0-9a-fA-F]{16})$/m);
  if (!match) {
    throw new Error("module plan route set checksum field was not found");
  }
  const drifted =
    match[1].toLowerCase() === "0x000000000000001d"
      ? "module_plan_route_set_checksum=0x000000000000001e"
      : "module_plan_route_set_checksum=0x000000000000001d";
  return receiptText.replace(match[0], drifted);
}

function driftModulePlanOperatorReceiptChecksum(receiptText) {
  // Mutates the operator receipt checksum while preserving the receipt route.
  const match = receiptText.match(/^operator_receipt_checksum=(0x[0-9a-fA-F]{16})$/m);
  if (!match) {
    throw new Error("module plan operator receipt checksum field was not found");
  }
  const drifted =
    match[1].toLowerCase() === "0x000000000000001d"
      ? "operator_receipt_checksum=0x000000000000001e"
      : "operator_receipt_checksum=0x000000000000001d";
  return receiptText.replace(match[0], drifted);
}

function driftModulePlanKvCachePageCount(receiptText) {
  // Mutates only the KV page count so the smoke isolates cache-envelope validation.
  const original = `module_plan_kv_cache_page_count=${expectedModulePlanKvCachePages}`;
  const drifted = "module_plan_kv_cache_page_count=2";
  if (!receiptText.includes(original)) {
    throw new Error("module plan KV cache page count field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanAdapterStackBudget(receiptText) {
  const original = "module_plan_adapter_stack_byte_budget=22144";
  const drifted = "module_plan_adapter_stack_byte_budget=22143";
  if (!receiptText.includes(original)) {
    throw new Error("module plan adapter stack byte budget field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanTotalBudget(receiptText) {
  const totalMatch = receiptText.match(/^module_plan_total_byte_budget=(\d+)$/m);
  if (!totalMatch) {
    throw new Error("module plan total byte budget field was not found");
  }
  const total = Number.parseInt(totalMatch[1], 10);
  if (!Number.isSafeInteger(total) || total < 2) {
    throw new Error("module plan total byte budget field was invalid");
  }
  return receiptText.replace(totalMatch[0], `module_plan_total_byte_budget=${total - 1}`);
}

function driftModulePlanTotalLimit(receiptText) {
  const limitMatch = receiptText.match(/^module_plan_total_byte_budget_limit=(\d+)$/m);
  if (!limitMatch) {
    throw new Error("module plan total byte budget limit field was not found");
  }
  const limit = Number.parseInt(limitMatch[1], 10);
  if (!Number.isSafeInteger(limit) || limit < 2) {
    throw new Error("module plan total byte budget limit field was invalid");
  }
  return receiptText.replace(limitMatch[0], `module_plan_total_byte_budget_limit=${limit - 1}`);
}

// Mutates only receipt cardinality so selector-declared module counts must remain authoritative.
function driftModulePlanCount(receiptText) {
  const countMatch = receiptText.match(/^module_count=(\d+)$/m);
  if (!countMatch) {
    throw new Error("module plan module count field was not found");
  }
  const count = Number.parseInt(countMatch[1], 10);
  if (!Number.isSafeInteger(count) || count < 2) {
    throw new Error("module plan module count field was invalid");
  }
  return receiptText.replace(countMatch[0], `module_count=${count - 1}`);
}

function driftModulePlanWasmMemory(receiptText) {
  const original = `module_plan_wasm_memory_initial_pages=${expectedModulePlanWasmMemoryInitialPages}`;
  const drifted = "module_plan_wasm_memory_initial_pages=18";
  if (!receiptText.includes(original)) {
    throw new Error("module plan WASM memory initial pages field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only the named ABI set so the smoke isolates Rust/WASM export validation.
function driftModulePlanWasmExportSet(receiptText) {
  const original = `module_plan_wasm_export_set=${expectedModulePlanWasmExportSet}`;
  const drifted = "module_plan_wasm_export_set=tinyrustlm-extra-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan WASM export set field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanWasmTransferStrategy(receiptText) {
  const original = `module_plan_wasm_transfer_strategy=${expectedModulePlanWasmTransferStrategy}`;
  const drifted = "module_plan_wasm_transfer_strategy=copy-keep-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan WASM transfer strategy field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanModelReleaseStrategy(receiptText) {
  const original = `module_plan_model_release_strategy=${expectedModulePlanModelReleaseStrategy}`;
  const drifted = "module_plan_model_release_strategy=keep-resident-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan model release strategy field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only the reset strategy so drift stays isolated to runtime-context reset binding.
function driftModulePlanRuntimeResetStrategy(receiptText) {
  const original = `module_plan_runtime_reset_strategy=${expectedModulePlanRuntimeResetStrategy}`;
  const drifted = "module_plan_runtime_reset_strategy=skip-reset-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan runtime reset strategy field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only the adapter validation strategy so the smoke isolates Rust pre-apply validation binding.
function driftModulePlanAdapterValidationStrategy(receiptText) {
  const original = `module_plan_adapter_validation_strategy=${expectedModulePlanAdapterValidationStrategy}`;
  const drifted = "module_plan_adapter_validation_strategy=apply-without-rust-validate-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan adapter validation strategy field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only the adapter validation count so the smoke isolates Rust validation cardinality.
function driftModulePlanAdapterValidationCount(receiptText) {
  const original = `module_plan_adapter_validation_count=${expectedModulePlanAdapterValidationCount}`;
  const drifted = "module_plan_adapter_validation_count=2";
  if (!receiptText.includes(original)) {
    throw new Error("module plan adapter validation count field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only the adapter apply count so the smoke isolates planned stack cardinality.
function driftModulePlanAdapterApplyCount(receiptText) {
  const original = `module_plan_adapter_apply_count=${expectedModulePlanAdapterApplyCount}`;
  const drifted = "module_plan_adapter_apply_count=2";
  if (!receiptText.includes(original)) {
    throw new Error("module plan adapter apply count field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanWasmHeapMinBytes(receiptText) {
  const original = "module_plan_wasm_heap_min_bytes=65536";
  const drifted = "module_plan_wasm_heap_min_bytes=65535";
  if (!receiptText.includes(original)) {
    throw new Error("module plan WASM heap min bytes field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanContextTokenLimit(receiptText) {
  const original = "module_plan_context_token_limit=16";
  const drifted = "module_plan_context_token_limit=15";
  if (!receiptText.includes(original)) {
    throw new Error("module plan context token limit field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only the sampler cap so the smoke isolates fixed-buffer sampler metadata.
function driftModulePlanSamplerCandidateCap(receiptText) {
  const original = "module_plan_sampler_candidate_cap=1024";
  const drifted = "module_plan_sampler_candidate_cap=1025";
  if (!receiptText.includes(original)) {
    throw new Error("module plan sampler candidate cap field was not found");
  }
  return receiptText.replace(original, drifted);
}

// Mutates only tokenizer identity so the smoke isolates module-plan tokenizer binding.
function driftModulePlanTokenizerChecksum(receiptText) {
  const checksumPattern = /^module_plan_tokenizer_checksum=0x[0-9a-fA-F]{16}$/m;
  if (!checksumPattern.test(receiptText)) {
    throw new Error("module plan tokenizer checksum field was not found");
  }
  return receiptText.replace(checksumPattern, "module_plan_tokenizer_checksum=0x00000000000000f1");
}

function driftModulePlanProfile(receiptText) {
  const original = "module_plan_profile=browser-constrained-v1";
  const drifted = "module_plan_profile=desktop-expanded-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan profile field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanExecutionProfile(receiptText) {
  const original = `module_plan_execution_profile=${expectedModulePlanExecutionProfile}`;
  const drifted = "module_plan_execution_profile=worker-pooled-wasm-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan execution profile field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanFetchPolicy(receiptText) {
  const original = `module_plan_fetch_policy=${expectedModulePlanFetchPolicy}`;
  const drifted = "module_plan_fetch_policy=cache-default-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan fetch policy field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanOriginPolicy(receiptText) {
  const original = `module_plan_origin_policy=${expectedModulePlanOriginPolicy}`;
  const drifted = "module_plan_origin_policy=cross-origin-network-v1";
  if (!receiptText.includes(original)) {
    throw new Error("module plan origin policy field was not found");
  }
  return receiptText.replace(original, drifted);
}

function driftModulePlanGraph(receiptText) {
  const pathMatch = receiptText.match(/^module\.0\.path=([^\r\n]+)$/m);
  if (!pathMatch) {
    throw new Error("module plan model graph path field was not found");
  }
  const originalPath = pathMatch[1];
  const driftedPath = originalPath.endsWith(".slm")
    ? originalPath.slice(0, -4) + "-graph-drift.slm"
    : originalPath + "-graph-drift";
  return receiptText.replace(pathMatch[0], `module.0.path=${driftedPath}`);
}

function driftModulePlanStackMember(receiptText) {
  const pathMatch = receiptText.match(/^module\.4\.adapter_path=([^\r\n]+)$/m);
  if (!pathMatch) {
    throw new Error("module plan stack member path field was not found");
  }
  const originalPath = pathMatch[1];
  const driftedPath = originalPath.endsWith(".adp1")
    ? originalPath.slice(0, -5) + "-stack-drift.adp1"
    : originalPath + "-stack-drift";
  return receiptText.replace(pathMatch[0], `module.4.adapter_path=${driftedPath}`);
}

function driftModulePlanRole(receiptText) {
  const roleMatch = receiptText.match(/^module\.4\.role=([^\r\n]+)$/m);
  if (!roleMatch) {
    throw new Error("module plan stack member role field was not found");
  }
  return receiptText.replace(roleMatch[0], "module.4.role=adapter-stack-role-drift");
}

function driftModulePlanSlot(receiptText) {
  const slotMatch = receiptText.match(/^module\.4\.assembly_slot=([^\r\n]+)$/m);
  if (!slotMatch) {
    throw new Error("module plan stack member assembly slot field was not found");
  }
  return receiptText.replace(slotMatch[0], "module.4.assembly_slot=adapter-stack-slot-drift");
}

function driftModulePlanPhase(receiptText) {
  const phaseMatch = receiptText.match(/^module\.4\.phase=([^\r\n]+)$/m);
  if (!phaseMatch) {
    throw new Error("module plan stack member phase field was not found");
  }
  return receiptText.replace(phaseMatch[0], "module.4.phase=adapter-stack-phase-drift");
}

function driftModulePlanByteCount(receiptText) {
  const byteMatch = receiptText.match(/^module\.0\.byte_count=([0-9]+)$/m);
  if (!byteMatch) {
    throw new Error("module plan model byte count field was not found");
  }
  const byteCount = Number.parseInt(byteMatch[1], 10);
  const drifted = Number.isSafeInteger(byteCount) && byteCount > 1 ? byteCount - 1 : byteCount + 1;
  return receiptText.replace(byteMatch[0], `module.0.byte_count=${drifted}`);
}

function driftModulePlanChecksum(receiptText) {
  const checksumMatch = receiptText.match(/^module\.4\.checksum=(0x[0-9a-fA-F]{16})$/m);
  if (!checksumMatch) {
    throw new Error("module plan stack member checksum field was not found");
  }
  const checksum = BigInt(checksumMatch[1]);
  const drifted = `0x${(checksum ^ 1n).toString(16).padStart(16, "0")}`;
  return receiptText.replace(checksumMatch[0], `module.4.checksum=${drifted}`);
}

function driftModulePlanDependency(receiptText) {
  const dependencyMatch = receiptText.match(/^module\.4\.depends_on=([^\r\n]+)$/m);
  if (!dependencyMatch) {
    throw new Error("module plan stack member dependency field was not found");
  }
  return receiptText.replace(dependencyMatch[0], "module.4.depends_on=module.2");
}

function driftAssemblyEvalCaseEvidenceChecksum(receiptText) {
  const checksumMatch = receiptText.match(/^eval_case_evidence_checksum=(0x[0-9a-fA-F]{16})$/m);
  if (!checksumMatch) {
    throw new Error("assembly eval case evidence checksum field was not found");
  }
  const checksum = BigInt(checksumMatch[1]);
  const drifted = `0x${(checksum ^ 1n).toString(16).padStart(16, "0")}`;
  return receiptText.replace(checksumMatch[0], `eval_case_evidence_checksum=${drifted}`);
}

function driftAssemblyEvidenceFileText(evidenceText) {
  return `${evidenceText.replace(/\s*$/, "")}\nproof_drift=assembly-evidence-file-drift\n`;
}

function driftAdapterFamilyReceiptText(receiptText) {
  const candidateMatch = receiptText.match(/^candidate_id=([^\r\n]+)$/m);
  if (!candidateMatch) {
    throw new Error("adapter-family receipt candidate id field was not found");
  }
  const candidateId = candidateMatch[1];
  const finalChar = candidateId[candidateId.length - 1] || "0";
  const driftedFinalChar = finalChar === "x" ? "y" : "x";
  return receiptText.replace(candidateMatch[0], `candidate_id=${candidateId.slice(0, -1)}${driftedFinalChar}`);
}

function driftAdapterManifestText(manifestText) {
  const original = "adapter_status=artifact-written";
  const drifted = "adapter_status=artifact-drifted";
  if (!manifestText.includes(original)) {
    throw new Error("adapter manifest status field was not found");
  }
  if (Buffer.byteLength(original, "utf8") !== Buffer.byteLength(drifted, "utf8")) {
    throw new Error("adapter manifest drift replacement changed byte length");
  }
  return manifestText.replace(original, drifted);
}

// Mutates only the source-backed ALR1 base contract while preserving manifest byte length.
function driftSourceBackedAlr1ManifestText(manifestText) {
  const original = "adapter_source_base_contract=matches-reviewed-adapter-source-base-contract";
  const drifted = "adapter_source_base_contract=mismats-reviewed-adapter-source-base-contract";
  if (!manifestText.includes(original)) {
    throw new Error("source-backed ALR1 source base contract field was not found");
  }
  if (Buffer.byteLength(original, "utf8") !== Buffer.byteLength(drifted, "utf8")) {
    throw new Error("source-backed ALR1 drift replacement changed byte length");
  }
  return manifestText.replace(original, drifted);
}

function updateRegistryModulePlanChecksum(registryText, candidateId, checksum) {
  const candidateMatch = registryText.match(new RegExp(`^entry\\.(\\d+)\\.candidate_id=${candidateId}$`, "m"));
  if (!candidateMatch) {
    throw new Error(`selector registry entry was not found for ${candidateId}`);
  }
  const prefix = `entry.${candidateMatch[1]}`;
  const checksumPattern = new RegExp(`^${prefix}\\.module_plan_checksum=0x[0-9a-fA-F]{16}$`, "m");
  if (!checksumPattern.test(registryText)) {
    throw new Error(`module plan checksum field was not found for ${candidateId}`);
  }
  return registryText.replace(checksumPattern, `${prefix}.module_plan_checksum=${checksum}`);
}

function updateRegistryAssemblyReceiptChecksum(registryText, candidateId, checksum) {
  const candidateMatch = registryText.match(new RegExp(`^entry\\.(\\d+)\\.candidate_id=${candidateId}$`, "m"));
  if (!candidateMatch) {
    throw new Error(`selector registry entry was not found for ${candidateId}`);
  }
  const prefix = `entry.${candidateMatch[1]}`;
  const checksumPattern = new RegExp(`^${prefix}\\.assembly_receipt_checksum=0x[0-9a-fA-F]{16}$`, "m");
  if (!checksumPattern.test(registryText)) {
    throw new Error(`assembly receipt checksum field was not found for ${candidateId}`);
  }
  return registryText.replace(checksumPattern, `${prefix}.assembly_receipt_checksum=${checksum}`);
}

function updateRegistryAdapterFamilyReceiptChecksum(registryText, candidateId, checksum) {
  const candidateMatch = registryText.match(new RegExp(`^entry\\.(\\d+)\\.candidate_id=${candidateId}$`, "m"));
  if (!candidateMatch) {
    throw new Error(`selector registry entry was not found for ${candidateId}`);
  }
  const prefix = `entry.${candidateMatch[1]}`;
  return replaceLineValue(registryText, `${prefix}.adapter_family_receipt_checksum`, checksum);
}

function updateRegistryAdapterChecksums(registryText, candidateId, adapterIndex, artifactChecksum, manifestChecksum) {
  const candidateMatch = registryText.match(new RegExp(`^entry\\.(\\d+)\\.candidate_id=${candidateId}$`, "m"));
  if (!candidateMatch) {
    throw new Error(`selector registry entry was not found for ${candidateId}`);
  }
  const prefix = `entry.${candidateMatch[1]}.adapter.${adapterIndex}`;
  let updated = replaceLineValue(registryText, `${prefix}.artifact_checksum`, artifactChecksum);
  updated = replaceLineValue(updated, `${prefix}.manifest_checksum`, manifestChecksum);
  return updated;
}

// Updates only an adapter manifest checksum in the selector registry.
function updateRegistryAdapterManifestChecksum(registryText, candidateId, adapterIndex, manifestChecksum) {
  const candidateMatch = registryText.match(new RegExp(`^entry\\.(\\d+)\\.candidate_id=${candidateId}$`, "m"));
  if (!candidateMatch) {
    throw new Error(`selector registry entry was not found for ${candidateId}`);
  }
  const prefix = `entry.${candidateMatch[1]}.adapter.${adapterIndex}`;
  return replaceLineValue(registryText, `${prefix}.manifest_checksum`, manifestChecksum);
}

// Mutates generated selector operator receipt byte echoes before browser registry intake.
function driftGeneratedSelectorOperatorReceiptBytes(registryText) {
  let changed = false;
  const updated = registryText.replace(
    /^entry\.(\d+)\.operator_receipt_candidate_artifact_bytes=(\d+)$/gm,
    (_line, entryIndex, byteText) => {
      const byteCount = Number(byteText);
      if (!Number.isSafeInteger(byteCount) || byteCount < 1) {
        throw new Error(`operator receipt byte count was invalid for entry ${entryIndex}`);
      }
      changed = true;
      return `entry.${entryIndex}.operator_receipt_candidate_artifact_bytes=${byteCount + 1}`;
    }
  );
  if (!changed) {
    throw new Error("selector registry operator receipt byte fields were not found");
  }
  return updated;
}

// Mutates generated selector operator kinds while preserving receipt byte echoes.
function driftGeneratedSelectorOperatorReceiptKind(registryText) {
  let changed = false;
  const updated = registryText.replace(
    /^entry\.(\d+)\.operator_receipt_operator_kind=(seed-weighted-parent-pool-soup|sign-aware-parent-pool-merge)$/gm,
    (_line, entryIndex, operatorKind) => {
      changed = true;
      const replacement =
        operatorKind === "seed-weighted-parent-pool-soup"
          ? "sign-aware-parent-pool-merge"
          : "seed-weighted-parent-pool-soup";
      return `entry.${entryIndex}.operator_receipt_operator_kind=${replacement}`;
    }
  );
  if (!changed) {
    throw new Error("selector registry operator receipt kind fields were not found");
  }
  return updated;
}

// Mutates generated selector schedule source fields before browser registry intake.
function driftGeneratedSelectorScheduleSource(registryText) {
  let changed = false;
  const updated = registryText.replace(
    /^entry\.(\d+)\.evolution_selection_source=population-fitness-normalized-seed-weights$/gm,
    (_line, entryIndex) => {
      changed = true;
      return `entry.${entryIndex}.evolution_selection_source=population-review-frontier-v1`;
    }
  );
  if (!changed) {
    throw new Error("selector registry evolution selection source fields were not found");
  }
  return updated;
}

// Mutates copied schedule family fields while preserving the operator receipt kind.
function driftGeneratedSelectorScheduleFamily(registryText) {
  let changed = false;
  const replacements = [
    [
      /^entry\.(\d+)\.scheduled_operator_family_command=sign-merge-candidate$/gm,
      (_line, entryIndex) => {
        changed = true;
        return `entry.${entryIndex}.scheduled_operator_family_command=soup-candidate`;
      }
    ],
    [
      /^entry\.(\d+)\.scheduled_operator_family_command=soup-candidate$/gm,
      (_line, entryIndex) => {
        changed = true;
        return `entry.${entryIndex}.scheduled_operator_family_command=sign-merge-candidate`;
      }
    ],
    [
      /^entry\.(\d+)\.scheduled_operator_family_selection_rule=seed-weighted-delta-sign-consensus$/gm,
      (_line, entryIndex) => {
        changed = true;
        return `entry.${entryIndex}.scheduled_operator_family_selection_rule=seed-weighted-direct-parameter-average`;
      }
    ],
    [
      /^entry\.(\d+)\.scheduled_operator_family_selection_rule=seed-weighted-direct-parameter-average$/gm,
      (_line, entryIndex) => {
        changed = true;
        return `entry.${entryIndex}.scheduled_operator_family_selection_rule=seed-weighted-delta-sign-consensus`;
      }
    ],
    [
      /^entry\.(\d+)\.scheduled_operator_family_output_gate=multi-parent-candidate-manifest-plus-runtime-smoke-plus-eval$/gm,
      (_line, entryIndex) => {
        changed = true;
        return `entry.${entryIndex}.scheduled_operator_family_output_gate=selector-registry-only`;
      }
    ]
  ];
  const updated = replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), registryText);
  if (!changed) {
    throw new Error("selector registry scheduled family fields were not found");
  }
  return updated;
}

function updateModulePlanAssemblyReceiptChecksum(receiptText, checksum) {
  let updated = receiptText;
  for (const key of ["assembly_receipt_checksum", "module.2.checksum"]) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const checksumPattern = new RegExp(`^${escapedKey}=0x[0-9a-fA-F]{16}$`, "m");
    if (!checksumPattern.test(updated)) {
      throw new Error(`module plan ${key} field was not found`);
    }
    updated = updated.replace(checksumPattern, `${key}=${checksum}`);
  }
  return updated;
}

function updateModulePlanAdapterFamilyReceiptChecksum(receiptText, checksum) {
  let updated = receiptText;
  for (const key of ["adapter_family_receipt_checksum", "module.3.checksum"]) {
    updated = replaceLineValue(updated, key, checksum);
  }
  return updated;
}

function updateModulePlanAdapterStackChecksums(receiptText, moduleIndex, artifactChecksum, manifestChecksum) {
  let updated = replaceLineValue(receiptText, `module.${moduleIndex}.checksum`, artifactChecksum);
  updated = replaceLineValue(updated, `module.${moduleIndex}.artifact_checksum`, artifactChecksum);
  updated = replaceLineValue(updated, `module.${moduleIndex}.manifest_checksum`, manifestChecksum);
  return updated;
}

// Updates only an adapter module manifest checksum in the module plan.
function updateModulePlanAdapterManifestChecksum(receiptText, moduleIndex, manifestChecksum) {
  return replaceLineValue(receiptText, `module.${moduleIndex}.manifest_checksum`, manifestChecksum);
}

function updateAssemblyAdapterFamilyReceiptChecksum(receiptText, checksum) {
  return replaceLineValue(receiptText, "adapter_family_receipt_checksum", checksum);
}

function updateAdapterFamilyMemberChecksums(receiptText, adapterIndex, artifactChecksum, manifestChecksum) {
  let updated = replaceLineValue(receiptText, `adapter.${adapterIndex}.artifact_checksum`, artifactChecksum);
  updated = replaceLineValue(updated, `adapter.${adapterIndex}.manifest_checksum`, manifestChecksum);
  return updated;
}

// Updates only an adapter-family member manifest checksum.
function updateAdapterFamilyMemberManifestChecksum(receiptText, adapterIndex, manifestChecksum) {
  return replaceLineValue(receiptText, `adapter.${adapterIndex}.manifest_checksum`, manifestChecksum);
}

function updateAdapterManifestArtifactChecksum(manifestText, artifactChecksum) {
  return replaceLineValue(manifestText, "adapter_artifact_checksum", artifactChecksum);
}

function fulfillTextRequest(client, requestId, text) {
  const body = Buffer.from(text, "utf8");
  return client.send("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: "content-type", value: "text/plain; charset=utf-8" },
      { name: "content-length", value: String(body.length) }
    ],
    body: body.toString("base64")
  });
}

function fulfillJsonRequest(client, requestId, value) {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return client.send("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: "content-type", value: "application/json; charset=utf-8" },
      { name: "access-control-allow-origin", value: "*" },
      { name: "access-control-allow-headers", value: "*" },
      { name: "content-length", value: String(body.length) }
    ],
    body: body.toString("base64")
  });
}

function fulfillBinaryRequest(client, requestId, body) {
  return client.send("Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responseHeaders: [
      { name: "content-type", value: "application/octet-stream" },
      { name: "content-length", value: String(body.length) }
    ],
    body: body.toString("base64")
  });
}

function isStaleFetchInterception(error) {
  const message = error && error.message ? error.message : String(error || "");
  return message.includes('"code":-32602') && message.includes("Invalid InterceptionId");
}

async function continuePausedRequest(client, requestId) {
  try {
    return await client.send("Fetch.continueRequest", { requestId });
  } catch (error) {
    if (isStaleFetchInterception(error)) {
      return null;
    }
    throw error;
  }
}

function hfReadyCatalogEntry() {
  return {
    catalog_version: 0,
    entry_kind: "minimodel.catalog_entry",
    model_id: "minimodel/example-tiny-ready-slm",
    display_name: "Example Tiny Ready SLM",
    publisher_id: "minimodel.org",
    publisher_key_id: "minimodel-test-key",
    artifact_kind: "slm",
    artifact_file_name: "tiny-ready.slm",
    local_file_name_hint: "tiny-ready.slm",
    artifact_byte_count: 4096,
    artifact_sha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    artifact_project_server_url: null,
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    peer_hint_status: "peer-offer-ready-known-peer-needed",
    peer_import_status: "request-script-ready",
    peer_offer_route: "../examples/example-tiny-ready-slm.minimodel-peer-offer",
    peer_offer_sha256: "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    peer_source_count: 1,
    peer_sources: [
      {
        source_kind: "known-direct-http-peer-v0",
        transport: "direct-http-piece-server-v0",
        peer_base_url: "http://127.0.0.1:8123/",
        consent_status: "publisher-declared-consenting-peer",
        project_server_serves_model_bytes: false,
        project_server_runs_model_bytes: false
      }
    ],
    peer_offer_chunk_count: 2,
    peer_offer_merkle_root_sha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    execution_policy: "user-local-file-or-consenting-peer-only",
    source_kind: "huggingface-hub",
    source_huggingface_model_id: "example-org/tiny-ready-slm",
    source_identity: "https://huggingface.co/example-org/tiny-ready-slm",
    model_card_route: "../docs/catalog-boundary.md",
    license_route: "../LICENSE.txt",
    manifest_route: "../examples/minimodel.manifest.v0.example",
    evidence_admission_status: "metadata-only",
    required_next_gate: "known-consenting-peer-fetch-assemble-rust-reverify-before-browser-import",
    max_tokens: 16
  };
}

function hfReadyCatalogSnapshot(catalogId = "browser-smoke-minimodel-catalog") {
  return {
    catalog_version: 0,
    catalog_kind: "minimodel.model_catalog",
    catalog_id: catalogId,
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    artifact_project_server_url: null,
    entries: [hfReadyCatalogEntry()]
  };
}

function hfProofReadyCatalogEntry() {
  const entry = JSON.parse(JSON.stringify(hfReadyCatalogEntry()));
  entry.peer_source_count = 0;
  entry.peer_sources = [];
  return entry;
}

function hfProofReadyCatalogSnapshot(catalogId = "browser-smoke-proof-ready-catalog") {
  return {
    catalog_version: 0,
    catalog_kind: "minimodel.model_catalog",
    catalog_id: catalogId,
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    artifact_project_server_url: null,
    entries: [hfProofReadyCatalogEntry()]
  };
}

function hfPeerSourceAnnouncement() {
  const entry = hfReadyCatalogEntry();
  return {
    announcement_version: 0,
    announcement_kind: "minimodel.peer_source_announcement",
    announcement_status: "peer-source-available-metadata-only",
    model_id: entry.model_id,
    artifact_kind: entry.artifact_kind,
    artifact_byte_count: entry.artifact_byte_count,
    artifact_sha256: entry.artifact_sha256,
    peer_offer_route: entry.peer_offer_route,
    peer_offer_sha256: entry.peer_offer_sha256,
    peer_offer_chunk_count: entry.peer_offer_chunk_count,
    peer_offer_merkle_root_sha256: entry.peer_offer_merkle_root_sha256,
    catalog_entry_sha256: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    project_server_proxies_model_bytes: false,
    peer_source: entry.peer_sources[0]
  };
}

function jsonText(value) {
  return JSON.stringify(value);
}

function sha256Json(value) {
  return `sha256:${crypto.createHash("sha256").update(jsonText(value)).digest("hex")}`;
}

function hfPeerSourceAnnouncementFeed() {
  return {
    announcement_catalog_version: 0,
    announcement_catalog_kind: "minimodel.peer_source_announcement_catalog",
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    project_server_proxies_model_bytes: false,
    announcements: [hfPeerSourceAnnouncement()]
  };
}

function hfCatalogAnnouncementRouteSnapshot() {
  const catalog = hfProofReadyCatalogSnapshot("browser-smoke-catalog-announcement-route");
  const feed = hfPeerSourceAnnouncementFeed();
  catalog.peer_source_announcement_routes = [
    {
      route: "peer-source-announcements.v0.json",
      sha256: sha256Json(feed),
      route_kind: "minimodel.peer_source_announcement_catalog"
    }
  ];
  return catalog;
}

function installHfSearchUiInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (/^https?:\/\/huggingface\.co\/api\/models\b/i.test(requestUrl)) {
        await fulfillJsonRequest(client, params.requestId, [
          {
            modelId: "example-org/tiny-source-model",
            downloads: 123,
            likes: 7,
            siblings: [
              { rfilename: "config.json" },
              { rfilename: "model.safetensors", size: 2048 },
              { rfilename: "tokenizer.json" }
            ]
          },
          {
            modelId: "example-org/tiny-ready-slm",
            downloads: 42,
            likes: 3,
            siblings: [
              { rfilename: "tiny-ready.slm" },
              { rfilename: "README.md" }
            ]
          }
        ]);
        return;
      }
      if (/^https?:\/\/minimodel\.org\/catalog\/models\.v0\.json\b/i.test(requestUrl)) {
        await fulfillJsonRequest(
          client,
          params.requestId,
          hfCatalogAnnouncementRouteSmokeMode
            ? hfCatalogAnnouncementRouteSnapshot()
            : hfReadyCatalogSnapshot("browser-smoke-default-catalog")
        );
        return;
      }
      if (/^https?:\/\/minimodel\.org\/catalog\/peer-source-announcements\.v0\.json\b/i.test(requestUrl)) {
        await fulfillJsonRequest(client, params.requestId, hfPeerSourceAnnouncementFeed());
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function parseEvaluateValue(result) {
  if (result && result.exceptionDetails) {
    const details = result.exceptionDetails;
    const text = details.exception && details.exception.description
      ? details.exception.description
      : details.text || "browser evaluation failed";
    throw new Error(text);
  }
  const remote = result && result.result ? result.result : {};
  if (!Object.prototype.hasOwnProperty.call(remote, "value") && typeof remote.description === "string") {
    const description = remote.description.trim();
    if (description.startsWith("{") || description.startsWith("[")) {
      return JSON.parse(description);
    }
  }
  const value = remote.value;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function targetMatchesAppUrl(targetUrl) {
  if (!targetUrl) {
    return false;
  }
  try {
    const target = new URL(targetUrl);
    const expected = new URL(appUrl);
    const normalizePath = (value) => {
      const pathName = value || "/";
      return pathName.endsWith("/index.html")
        ? pathName.slice(0, -"index.html".length)
        : pathName;
    };
    return target.origin === expected.origin && normalizePath(target.pathname) === normalizePath(expected.pathname);
  } catch (_error) {
    return false;
  }
}

async function waitForTarget() {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  const observedUrls = [];
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const targets = JSON.parse(await get(endpoint));
      const appTarget = targets.find((target) => targetMatchesAppUrl(target.url));
      if (appTarget) {
        return appTarget;
      }
      targets.forEach((target) => {
        if (target.url && !observedUrls.includes(target.url) && observedUrls.length < 8) {
          observedUrls.push(target.url);
        }
      });
    } catch (_error) {
      await sleep(100);
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for app browser target on port ${port}; expected ${appUrl}; observed ${observedUrls.join(", ") || "none"}`);
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

function cdpClient(socket) {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method && listeners.has(message.method)) {
      for (const listener of listeners.get(message.method)) {
        listener(message.params || {});
      }
    }
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      callbacks.reject(new Error(JSON.stringify(message.error)));
      return;
    }
    callbacks.resolve(message.result);
  });
  return {
    send(method, params) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    on(method, listener) {
      if (!listeners.has(method)) {
        listeners.set(method, []);
      }
      listeners.get(method).push(listener);
    }
  };
}

async function runPageSmoke(client, modelKey) {
  const expression = `
    (async () => {
      const expectedModel = ${JSON.stringify(modelKey)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      for (let index = 0; index < 600; index += 1) {
        if (byId("generateButton") && !byId("generateButton").disabled) {
          break;
        }
        await sleep(100);
      }
      if (byId("modelSelect").value !== expectedModel) {
        byId("modelSelect").value = expectedModel;
        byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        for (let index = 0; index < 600; index += 1) {
          if (byId("modelSelect").value === expectedModel && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            break;
          }
          await sleep(100);
        }
      }
      byId("maxTokens").value = "1";
      byId("prompt").value = "hi";
      byId("generateButton").click();
      for (let index = 0; index < 600; index += 1) {
        if (byId("response").textContent.trim().length > 0) {
          break;
        }
        await sleep(100);
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        conversationText: byId("conversation").textContent,
        conversationItems: Array.from(document.querySelectorAll("#conversation .message")).map((node) => ({
          role: node.querySelector(".message-role") ? node.querySelector(".message-role").textContent.trim() : "",
          text: node.querySelector(".message-text") ? node.querySelector(".message-text").textContent : "",
          isError: node.classList.contains("error")
        })),
        console: byId("console").textContent,
        diagnostics: byId("diagnostics").textContent,
        benchLoadMs: byId("benchLoadMs").textContent,
        benchPromptTokens: byId("benchPromptTokens").textContent,
        benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
        benchTokensPerSecond: byId("benchTokensPerSecond").textContent,
        benchScratch: byId("benchScratch").textContent,
        selectedModel: byId("modelSelect").value,
        provenanceSourceKind: byId("provenanceSourceKind").textContent,
        provenanceSourceSnapshot: byId("provenanceSourceSnapshot").textContent,
        provenanceSourceId: byId("provenanceSourceId").textContent,
        provenanceSourceShape: byId("provenanceSourceShape").textContent,
        provenanceSourceReview: byId("provenanceSourceReview").textContent,
        provenanceSourceReviewRoutes: byId("provenanceSourceReviewRoutes").textContent,
        provenanceSourceReviewArtifacts: byId("provenanceSourceReviewArtifacts").textContent,
        provenanceSourceTokenizerImport: byId("provenanceSourceTokenizerImport").textContent,
        provenanceSourceValidation: byId("provenanceSourceValidation").textContent,
        provenanceAdmission: byId("provenanceAdmission").textContent,
        provenanceQualityClaim: byId("provenanceQualityClaim").textContent,
        provenanceTrainedClaim: byId("provenanceTrainedClaim").textContent,
        provenanceNextGate: byId("provenanceNextGate").textContent,
        provenanceOperator: byId("provenanceOperator").textContent,
        provenanceSchedule: byId("provenanceSchedule").textContent,
        modelOptions: Array.from(byId("modelSelect").options).map((option) => ({
          value: option.value,
          label: option.textContent.trim()
        })),
        stepTokenDisabled: byId("stepTokenButton").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPagePublicLocalOnlySmoke(client) {
  const expression = `
    (async () => {
      const byId = (id) => document.getElementById(id);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (predicate, label) => {
        for (let index = 0; index < 200; index += 1) {
          if (predicate()) {
            return;
          }
          await sleep(50);
        }
        throw new Error("timed out waiting for " + label);
      };
      await waitFor(
        () => byId("wasmState") && byId("wasmState").textContent !== "waiting",
        "runtime boot"
      );
      await waitFor(
        () => byId("modelState") && byId("modelState").textContent !== "waiting",
        "public model boundary"
      );
      return JSON.stringify({
        title: document.title,
        hostname: window.location.hostname,
        h1: document.querySelector("h1") ? document.querySelector("h1").textContent.trim() : "",
        eyebrow: document.querySelector(".eyebrow") ? document.querySelector(".eyebrow").textContent.trim() : "",
        notice: document.querySelector(".notice") ? document.querySelector(".notice").textContent.trim() : "",
        footer: byId("appFooter") ? byId("appFooter").textContent.trim().replace(/\\s+/g, " ") : "",
        runtimeStatus: byId("runtimeStatus").textContent,
        wasmState: byId("wasmState").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        provenanceState: byId("provenanceState").textContent,
        localModelState: byId("localModelState").textContent,
        catalogUrl: byId("catalogUrlInput").value,
        catalogStatus: byId("catalogStatus").textContent,
        hfStatus: byId("hfStatus").textContent,
        selectedModel: byId("modelSelect").value,
        modelOptions: Array.from(byId("modelSelect").options).map((option) => ({
          value: option.value,
          text: option.textContent.trim(),
          disabled: option.disabled
        })),
        generateDisabled: byId("generateButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled,
        importLocalModelDisabled: byId("importLocalModelButton").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPageSourceOptionsSmoke(client) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  const expression = `
    (async () => {
      const byId = (id) => document.getElementById(id);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (node) => {
        if (!node || node.closest("[hidden]")) {
          return false;
        }
        for (let current = node; current; current = current.parentElement) {
          const style = window.getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden") {
            return false;
          }
        }
        return node.getClientRects().length > 0;
      };
      const activeSource = () => {
        const button = document.querySelector("[data-source-option][aria-pressed='true']");
        return button ? button.dataset.sourceOption : "";
      };
      const snapshot = (label) => JSON.parse(JSON.stringify({
        label,
        mode: document.querySelector(".app-shell") ? document.querySelector(".app-shell").dataset.mode : "",
        activeSource: activeSource(),
        discoveryVisible: visible(byId("simpleDiscoveryPanel")),
        localVisible: visible(byId("simpleLocalSourcePanel")),
        hfVisible: visible(byId("simpleHfSourcePanel")),
        p2pVisible: visible(byId("simpleP2pSourcePanel")),
        advancedModelVisible: visible(byId("modelSelect")),
        maxTokensVisible: visible(byId("maxTokens")),
        hfAdvancedVisible: visible(byId("hfSearchInput")),
        catalogVisible: visible(byId("catalogUrlInput")),
        localImportVisible: visible(byId("localModelFile")),
        railVisible: visible(byId("diagnosticsRail")),
        promptVisible: visible(byId("prompt")),
        generateVisible: visible(byId("generateButton")),
        starterCardCount: document.querySelectorAll(".starter-action").length,
        starterLabels: Array.from(document.querySelectorAll(".starter-action")).map((button) => button.textContent.replace(/\\s+/g, " ").trim()),
        modeButtonLabels: Array.from(document.querySelectorAll(".mode-button")).map((button) => button.textContent.replace(/\\s+/g, " ").trim()),
        sourceLabels: Array.from(document.querySelectorAll("[data-source-option]")).map((button) => button.textContent.replace(/\\s+/g, " ").trim()),
        setupLabels: Array.from(document.querySelectorAll(".setup-step")).map((button) => button.textContent.replace(/\\s+/g, " ").trim()),
        setupPressed: Array.from(document.querySelectorAll("[data-sidebar-source]")).filter((button) => button.getAttribute("aria-pressed") === "true").map((button) => button.dataset.sidebarSource),
        status: byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : ""
      }));
      for (let index = 0; index < 600; index += 1) {
        if (byId("wasmState") && byId("wasmState").textContent !== "waiting") {
          break;
        }
        await sleep(100);
      }
      if (document.querySelector(".app-shell") && document.querySelector(".app-shell").dataset.railCollapsed === "true" && byId("diagnosticsRailToggle")) {
        byId("diagnosticsRailToggle").click();
        await sleep(100);
      }
      const initial = snapshot("initial");
      byId("sidebarHfSetupButton").click();
      await sleep(50);
      const sidebarHf = snapshot("sidebar-hf");
      byId("sidebarP2pSetupButton").click();
      await sleep(50);
      const sidebarP2p = snapshot("sidebar-p2p");
      byId("sidebarLocalSetupButton").click();
      await sleep(50);
      const sidebarLocal = snapshot("sidebar-local");
      byId("sidebarAdvancedToolsButton").click();
      await sleep(50);
      const sidebarAdvanced = snapshot("sidebar-advanced");
      byId("simpleModeButton").click();
      await sleep(50);
      byId("simpleHfSourceButton").click();
      await sleep(50);
      const external = snapshot("external");
      byId("simpleP2pSourceButton").click();
      await sleep(50);
      const p2p = snapshot("p2p");
      byId("simpleLocalSourceButton").click();
      await sleep(50);
      const local = snapshot("local");
      byId("advancedModeButton").click();
      await sleep(50);
      const advanced = snapshot("advanced");
      return JSON.stringify({ initial, sidebarHf, sidebarP2p, sidebarLocal, sidebarAdvanced, external, p2p, local, advanced });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPageHfSearchUiSmoke(client) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  const expression = `
    (async () => {
      const byId = (id) => document.getElementById(id);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const visible = (node) => {
        if (!node || node.closest("[hidden]")) {
          return false;
        }
        for (let current = node; current; current = current.parentElement) {
          const style = window.getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden") {
            return false;
          }
        }
        return node.getClientRects().length > 0;
      };
      const textList = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.textContent.replace(/\\s+/g, " ").trim());
      for (let index = 0; index < 600; index += 1) {
        if (byId("wasmState") && byId("wasmState").textContent !== "waiting") {
          break;
        }
        await sleep(100);
      }
      for (let index = 0; index < 300; index += 1) {
        if (byId("modelEditButton") && byId("simpleHfSourceButton") && byId("simpleHfSearchButton")) {
          break;
        }
        await sleep(100);
      }
      if (!byId("modelEditButton") || !byId("simpleHfSourceButton") || !byId("simpleHfSearchButton")) {
        throw new Error("Hugging Face search controls were missing from the loaded page: " + JSON.stringify({
          href: location.href,
          readyState: document.readyState,
          title: document.title,
          hasModelEditButton: Boolean(byId("modelEditButton")),
          hasSimpleHfSourceButton: Boolean(byId("simpleHfSourceButton")),
          hasSimpleHfSearchButton: Boolean(byId("simpleHfSearchButton")),
          bodyText: document.body ? document.body.textContent.replace(/\s+/g, " ").trim().slice(0, 240) : ""
        }));
      }
      const initiallyOpen = visible(byId("simpleDiscoveryPanel"));
      byId("modelEditButton").click();
      await sleep(50);
      byId("simpleHfSourceButton").click();
      await sleep(50);
      byId("simpleHfSearchInput").value = "tiny";
      window.__tinyrustlmDownloads = [];
      window.__tinyrustlmDownloadNames = [];
      const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = (blob) => {
        const url = originalCreateObjectUrl(blob);
        blob.text().then((text) => window.__tinyrustlmDownloads.push({ text, type: blob.type }));
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        window.__tinyrustlmDownloadNames.push(this.download || "");
        return originalAnchorClick.call(this);
      };
      byId("simpleHfSearchButton").click();
      await sleep(50);
      const panelImmediatelyAfterSearchClick = byId("simpleDiscoveryPanel");
      const panelOpenImmediatelyAfterSearchClick = visible(panelImmediatelyAfterSearchClick);
      const panelHiddenImmediatelyAfterSearchClick = panelImmediatelyAfterSearchClick ? panelImmediatelyAfterSearchClick.hidden : true;
      for (let index = 0; index < 120; index += 1) {
        const status = byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "";
        if (document.querySelectorAll("#simpleHfResults li").length >= 2 && status.includes("external records")) {
          break;
        }
        await sleep(100);
      }
      byId("simpleHfSearchInput").value = "tiny q8";
      byId("simpleHfSearchButton").click();
      await sleep(50);
      const panelImmediatelyAfterRefilterClick = byId("simpleDiscoveryPanel");
      const panelOpenImmediatelyAfterRefilterClick = visible(panelImmediatelyAfterRefilterClick);
      const panelHiddenImmediatelyAfterRefilterClick = panelImmediatelyAfterRefilterClick ? panelImmediatelyAfterRefilterClick.hidden : true;
      for (let index = 0; index < 120; index += 1) {
        const status = byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "";
        if (document.querySelectorAll("#simpleHfResults li").length >= 2 && status.includes("external records")) {
          break;
        }
        await sleep(100);
      }
      const panelAfterSearch = byId("simpleDiscoveryPanel");
      const panelOpenAfterSearch = visible(panelAfterSearch);
      const panelHiddenAfterSearch = panelAfterSearch ? panelAfterSearch.hidden : true;
      const hfVisibleAfterSearch = visible(byId("simpleHfSourcePanel"));
      const localVisibleAfterSearch = visible(byId("simpleLocalSourcePanel"));
      const p2pVisibleAfterSearch = visible(byId("simpleP2pSourcePanel"));
      const statusAfterSearch = byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "";
      const hfStatusAfterSearch = byId("hfStatus") ? byId("hfStatus").textContent : "";
      const p2pStatusAfterSearch = byId("simpleHfP2pStatus") ? byId("simpleHfP2pStatus").textContent : "";
      const p2pWarningVisibleAfterSearch = visible(byId("simpleHfP2pWarning"));
      const actionTextsAfterSearch = textList("#simpleHfResults button, #simpleHfResults a, #simpleHfResults .compatibility-pill, #simpleHfResults .model-result-meta");
      const primaryActionTextsAfterSearch = textList("#simpleHfResults .primary-result-action");
      const simpleSourceHintCountAfterSearch = Array.from(document.querySelectorAll("#simpleHfResults .model-result-meta"))
        .filter((node) => node.textContent.includes("Source file listed: model.safetensors")).length;
      const advancedSourceHintCountAfterSearch = Array.from(document.querySelectorAll("#hfResults .model-result-meta"))
        .filter((node) => node.textContent.includes("Source file listed: model.safetensors")).length;
      const p2pWarningCount = document.querySelectorAll("#simpleHfP2pWarning").length;
      const peerUrlStatusBeforeImport = byId("simplePeerUrlStatus") ? byId("simplePeerUrlStatus").textContent : "";
      const p2pImportButton = Array.from(document.querySelectorAll("#simpleHfResults .primary-result-action"))
        .find((button) => button.textContent.includes("P2P Import"));
      if (p2pImportButton) {
        p2pImportButton.click();
        for (let index = 0; index < 120; index += 1) {
          if (window.__tinyrustlmDownloads.length >= 2) {
            break;
          }
          await sleep(50);
        }
      }
      const peerImportDownloadNames = window.__tinyrustlmDownloadNames.slice();
      const peerImportDownloads = window.__tinyrustlmDownloads.slice();
      const statusAfterP2pImport = byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "";
      const hfStatusAfterP2pImport = byId("hfStatus") ? byId("hfStatus").textContent : "";
      window.__tinyrustlmDownloads = [];
      window.__tinyrustlmDownloadNames = [];
      if (byId("simpleHfP2pToggle")) {
        byId("simpleHfP2pToggle").click();
        await sleep(100);
      }
      const p2pStatusAfterDisable = byId("simpleHfP2pStatus") ? byId("simpleHfP2pStatus").textContent : "";
      const p2pWarningVisibleAfterDisable = visible(byId("simpleHfP2pWarning"));
      const p2pWarningTextAfterDisable = byId("simpleHfP2pWarning") ? byId("simpleHfP2pWarning").textContent : "";
      const actionTextsAfterP2pDisable = textList("#simpleHfResults button, #simpleHfResults a, #simpleHfResults .compatibility-pill, #simpleHfResults .model-result-meta");
      const primaryActionTextsAfterP2pDisable = textList("#simpleHfResults .primary-result-action");
      const startConversionButton = Array.from(document.querySelectorAll("#simpleHfResults button"))
        .find((button) => button.textContent.includes("Start Conversion"));
      if (startConversionButton) {
        startConversionButton.click();
        for (let index = 0; index < 120; index += 1) {
          if (window.__tinyrustlmDownloads.length >= 2) {
            break;
          }
          await sleep(50);
        }
      }
      const panel = byId("simpleDiscoveryPanel");
      const simpleTexts = textList("#simpleHfResults li");
      const advancedTexts = textList("#hfResults li");
      const actionTexts = textList("#simpleHfResults button, #simpleHfResults a, #simpleHfResults .compatibility-pill, #simpleHfResults .model-result-meta");
      const conversionDownloadNames = window.__tinyrustlmDownloadNames.slice();
      const conversionDownloads = window.__tinyrustlmDownloads.slice();
      const conversionRequestIndex = conversionDownloadNames.findIndex((name) => name.endsWith(".minimodel-conversion-request.json"));
      const conversionScriptIndex = conversionDownloadNames.findIndex((name) => name.endsWith(".tinyrustlm-convert.ps1"));
      const requestDownload = conversionRequestIndex >= 0 ? conversionDownloads[conversionRequestIndex] : { text: "", type: "" };
      const scriptDownload = conversionScriptIndex >= 0 ? conversionDownloads[conversionScriptIndex] : { text: "", type: "" };
      return JSON.stringify({
        initiallyOpen,
        panelOpenImmediatelyAfterSearchClick,
        panelHiddenImmediatelyAfterSearchClick,
        panelOpenImmediatelyAfterRefilterClick,
        panelHiddenImmediatelyAfterRefilterClick,
        panelOpenAfterSearch,
        panelHiddenAfterSearch,
        hfVisibleAfterSearch,
        localVisibleAfterSearch,
        p2pVisibleAfterSearch,
        statusAfterSearch,
        hfStatusAfterSearch,
        p2pStatusAfterSearch,
        p2pWarningVisibleAfterSearch,
        peerUrlStatusBeforeImport,
        actionTextsAfterSearch,
        primaryActionTextsAfterSearch,
        simpleSourceHintCountAfterSearch,
        advancedSourceHintCountAfterSearch,
        p2pWarningCount,
        peerImportDownloadNames,
        peerImportRequestText: peerImportDownloads[0] ? peerImportDownloads[0].text : "",
        peerImportRequestType: peerImportDownloads[0] ? peerImportDownloads[0].type : "",
        peerImportScriptText: peerImportDownloads[1] ? peerImportDownloads[1].text : "",
        peerImportScriptType: peerImportDownloads[1] ? peerImportDownloads[1].type : "",
        statusAfterP2pImport,
        hfStatusAfterP2pImport,
        p2pStatusAfterDisable,
        p2pWarningVisibleAfterDisable,
        p2pWarningTextAfterDisable,
        actionTextsAfterP2pDisable,
        primaryActionTextsAfterP2pDisable,
        panelOpen: visible(panel),
        panelHidden: panel ? panel.hidden : true,
        hfVisible: visible(byId("simpleHfSourcePanel")),
        localVisible: visible(byId("simpleLocalSourcePanel")),
        p2pVisible: visible(byId("simpleP2pSourcePanel")),
        status: byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "",
        hfStatus: byId("hfStatus") ? byId("hfStatus").textContent : "",
        resultCount: document.querySelectorAll("#simpleHfResults li").length,
        advancedResultCount: document.querySelectorAll("#hfResults li").length,
        simpleTexts,
        advancedTexts,
        actionTexts,
        conversionDownloadNames,
        conversionRequestName: conversionRequestIndex >= 0 ? conversionDownloadNames[conversionRequestIndex] : "",
        conversionRequestText: requestDownload.text || "",
        conversionRequestType: requestDownload.type || "",
        conversionScriptName: conversionScriptIndex >= 0 ? conversionDownloadNames[conversionScriptIndex] : "",
        conversionScriptText: scriptDownload.text || "",
        conversionScriptType: scriptDownload.type || "",
        bodyText: document.body ? document.body.textContent.replace(/\\s+/g, " ").trim() : ""
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPageHfLocalCatalogSmoke(client, options = {}) {
  const fixture = options.peerAnnouncementOverlay
    ? writeHfPeerAnnouncementFixture()
    : writeHfLocalCatalogSnapshotFixture();
  try {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    const waitExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let index = 0; index < 600; index += 1) {
          if (
            byId("wasmState") &&
            byId("wasmState").textContent !== "waiting" &&
            byId("localCatalogFile") &&
            byId("importLocalCatalogButton") &&
            byId("peerAnnouncementFile") &&
            byId("applyPeerAnnouncementButton") &&
            byId("simpleHfSearchButton")
          ) {
            return true;
          }
          await sleep(100);
        }
        throw new Error("runtime did not boot");
      })()
    `;
    parseEvaluateValue(await client.send("Runtime.evaluate", {
      expression: waitExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    }));
    await setFileInputFiles(client, "#localCatalogFile", [fixture.catalogPath]);
    if (fixture.announcementPath) {
      await setFileInputFiles(client, "#peerAnnouncementFile", [fixture.announcementPath]);
    }
    const expression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const textList = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.textContent.replace(/\\s+/g, " ").trim());
        const shouldApplyAnnouncement = ${fixture.announcementPath ? "true" : "false"};
        const visible = (node) => {
          if (!node || node.closest("[hidden]")) {
            return false;
          }
          for (let current = node; current; current = current.parentElement) {
            const style = window.getComputedStyle(current);
            if (style.display === "none" || style.visibility === "hidden") {
              return false;
            }
          }
          return node.getClientRects().length > 0;
        };
        window.__tinyrustlmDownloads = [];
        window.__tinyrustlmDownloadNames = [];
        const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
        const originalAnchorClick = HTMLAnchorElement.prototype.click;
        URL.createObjectURL = (blob) => {
          const url = originalCreateObjectUrl(blob);
          blob.text().then((text) => window.__tinyrustlmDownloads.push({ text, type: blob.type }));
          return url;
        };
        HTMLAnchorElement.prototype.click = function () {
          window.__tinyrustlmDownloadNames.push(this.download || "");
          return originalAnchorClick.call(this);
        };
        byId("localCatalogFile").dispatchEvent(new Event("change", { bubbles: true }));
        byId("importLocalCatalogButton").click();
        for (let index = 0; index < 120; index += 1) {
          if ((byId("catalogStatus").textContent || "").includes("local MiniModel metadata entries from models.v0.json")) {
            break;
          }
          await sleep(50);
        }
        const localCatalogStatus = byId("catalogStatus").textContent;
        const catalogResults = textList("#catalogResults li");
        let announcementStatus = "";
        let catalogResultsAfterAnnouncement = catalogResults;
        if (shouldApplyAnnouncement) {
          byId("peerAnnouncementFile").dispatchEvent(new Event("change", { bubbles: true }));
          byId("applyPeerAnnouncementButton").click();
          for (let index = 0; index < 120; index += 1) {
            const status = byId("catalogStatus").textContent || "";
            if (status.includes("peer-source announcement") && status.includes("applied")) {
              break;
            }
            await sleep(50);
          }
          announcementStatus = byId("catalogStatus").textContent;
          catalogResultsAfterAnnouncement = textList("#catalogResults li");
        }
        byId("modelEditButton").click();
        await sleep(50);
        byId("simpleHfSourceButton").click();
        await sleep(50);
        byId("simpleHfSearchInput").value = "tiny";
        byId("simpleHfSearchButton").click();
        for (let index = 0; index < 120; index += 1) {
          const status = byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "";
          if (document.querySelectorAll("#simpleHfResults li").length >= 2 && status.includes("external records")) {
            break;
          }
          await sleep(100);
        }
        const statusAfterSearch = byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "";
        const hfStatusAfterSearch = byId("hfStatus") ? byId("hfStatus").textContent : "";
        const p2pImportButton = Array.from(document.querySelectorAll("#simpleHfResults .primary-result-action"))
          .find((button) => button.textContent.includes("P2P Import"));
        if (p2pImportButton) {
          p2pImportButton.click();
          for (let index = 0; index < 120; index += 1) {
            if (window.__tinyrustlmDownloads.length >= 2) {
              break;
            }
            await sleep(50);
          }
        }
        const peerImportDownloads = window.__tinyrustlmDownloads.slice();
        return JSON.stringify({
          localCatalogStatus,
          announcementStatus,
          catalogResults,
          catalogResultsAfterAnnouncement,
          statusAfterSearch,
          hfStatusAfterSearch,
          simpleTexts: textList("#simpleHfResults li"),
          actionTexts: textList("#simpleHfResults button, #simpleHfResults a, #simpleHfResults .compatibility-pill, #simpleHfResults .model-result-meta"),
          primaryActionTexts: textList("#simpleHfResults .primary-result-action"),
          peerImportRequestText: peerImportDownloads[0] ? peerImportDownloads[0].text : "",
          peerImportScriptText: peerImportDownloads[1] ? peerImportDownloads[1].text : "",
          p2pStatusAfterImport: byId("simpleDiscoveryStatus") ? byId("simpleDiscoveryStatus").textContent : "",
          panelOpen: visible(byId("simpleDiscoveryPanel")),
          hfVisible: visible(byId("simpleHfSourcePanel")),
          bodyText: document.body ? document.body.textContent.replace(/\\s+/g, " ").trim() : ""
        });
      })()
    `;
    const result = await client.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    });
    return parseEvaluateValue(result);
  } finally {
    try {
      fs.rmSync(fixture.catalogDir, { recursive: true, force: true });
    } catch (_error) {
      // Best effort cleanup only.
    }
  }
}

async function waitForDomSelector(client, selector, timeoutMs = 15000) {
  await client.send("DOM.enable", {});
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = "unavailable";
  while (Date.now() < deadline) {
    try {
      const snapshotResult = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const node = document.querySelector(${JSON.stringify(selector)});
          return JSON.stringify({
            url: window.location.href,
            readyState: document.readyState,
            hasSelector: Boolean(node),
            tagName: node ? node.tagName : "",
            inputType: node && "type" in node ? node.type : "",
            inputCount: document.querySelectorAll("input").length,
            bodyPrefix: document.body ? document.body.innerHTML.slice(0, 160) : ""
          });
        })()`,
        returnByValue: true
      });
      if (snapshotResult.result && typeof snapshotResult.result.value === "string") {
        lastSnapshot = snapshotResult.result.value;
      }
      const evaluateResult = await client.send("Runtime.evaluate", {
        expression: `document.querySelector(${JSON.stringify(selector)})`,
        objectGroup: "dom-selector-wait",
        returnByValue: false
      });
      if (evaluateResult.result && evaluateResult.result.objectId) {
        return evaluateResult.result.objectId;
      }
    } catch (error) {
      if (!String(error.message || error).includes("Execution context was destroyed")) {
        throw error;
      }
    }
    await sleep(100);
  }
  throw new Error(`Unable to find DOM selector ${selector}; last page snapshot: ${lastSnapshot}`);
}

async function setFileInputFiles(client, selector, files) {
  const objectId = await waitForDomSelector(client, selector);
  await client.send("DOM.setFileInputFiles", {
    objectId,
    files
  });
}

function writeCatalogLocalImportFixture() {
  const modelPath = path.join(__dirname, "..", "models", "tiny-test-model-q8.slm");
  const modelBytes = fs.readFileSync(modelPath);
  const sha256 = crypto.createHash("sha256").update(modelBytes).digest("hex");
  const catalog = {
    catalog_version: 0,
    catalog_kind: "minimodel.model_catalog",
    catalog_id: "browser-smoke-local-catalog",
    project_server_serves_model_bytes: false,
    project_server_runs_model_bytes: false,
    artifact_project_server_url: null,
    entries: [
      {
        catalog_version: 0,
        entry_kind: "minimodel.catalog_entry",
        model_id: "tinyrustlm/tiny-test-model-q8",
        display_name: "TinyRustLM Fixture q8_0",
        publisher_id: "browser-smoke",
        publisher_key_id: "browser-smoke-key",
        manifest_route: "examples/minimodel.manifest.v0.example",
        model_card_route: "docs/catalog-boundary.md",
        license_route: "LICENSE.txt",
        artifact_kind: "slm",
        artifact_file_name: "tiny-test-model-q8.slm",
        local_file_name_hint: "tiny-test-model-q8.slm",
        artifact_byte_count: modelBytes.length,
        artifact_sha256: `sha256:${sha256}`,
        artifact_project_server_url: null,
        project_server_serves_model_bytes: false,
        project_server_runs_model_bytes: false,
        peer_hint_status: "disabled",
        execution_policy: "user-local-file-only",
        source_kind: "deterministic-smoke",
        slm_model_shape: "vocab=260,hidden=8,layers=1,heads=2,kv_heads=2,head_dim=4,ffn=16,context=16",
        slm_quantization: "q8_0",
        slm_checksum: "0xa338bbb579e3e971",
        quality_claim: "runtime-execution-smoke-only",
        trained_quality_claim: "not-claimed",
        evidence_admission_status: "accepted-for-runtime-smoke",
        required_next_gate: "user-local-file-import-and-rust-wasm-validation",
        max_tokens: 16
      }
    ]
  };
  const catalogPath = path.join(os.tmpdir(), `tinyrustlm-catalog-local-import-${process.pid}.json`);
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return { catalogPath, modelPath, sha256: `sha256:${sha256}`, modelBytes: modelBytes.length };
}

function writeHfLocalCatalogSnapshotFixture() {
  const catalogDir = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-hf-local-catalog-"));
  const catalogPath = path.join(catalogDir, "models.v0.json");
  fs.writeFileSync(
    catalogPath,
    `${JSON.stringify(hfReadyCatalogSnapshot("browser-smoke-local-models-v0"), null, 2)}\n`,
    "utf8"
  );
  return { catalogDir, catalogPath };
}

function writeHfPeerAnnouncementFixture() {
  const catalogDir = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-hf-peer-announcement-"));
  const catalogPath = path.join(catalogDir, "models.v0.json");
  const announcementPath = path.join(catalogDir, "peer-source-announcement.json");
  fs.writeFileSync(
    catalogPath,
    `${JSON.stringify(hfProofReadyCatalogSnapshot("browser-smoke-proof-ready-local-models-v0"), null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(
    announcementPath,
    `${JSON.stringify(hfPeerSourceAnnouncement(), null, 2)}\n`,
    "utf8"
  );
  return { catalogDir, catalogPath, announcementPath };
}

function writeShareMetadataFixture() {
  const modelPath = path.join(__dirname, "..", "models", "tiny-test-model-q8.slm");
  const modelBytes = fs.readFileSync(modelPath);
  const sha256 = crypto.createHash("sha256").update(modelBytes).digest("hex");
  const request = {
    request_kind: "minimodel.huggingface_conversion_request.v0",
    generated_at: "2026-07-02T00:00:00Z",
    source: {
      kind: "huggingface_model",
      model_id: "example-org/tiny-source-model",
      model_url: "https://huggingface.co/example-org/tiny-source-model",
      downloads: 123,
      likes: 7,
      discovered_slm_files: []
    },
    requested_artifact: {
      kind: "slm",
      preferred_quantization_order: ["q8_0", "q4_0", "f32"],
      runtime_target: "TinyRustLM Rust/WASM browser-local runtime"
    },
    boundary: {
      project_server_runs_model_bytes: false,
      project_server_serves_model_bytes: false
    }
  };
  const requestPath = path.join(os.tmpdir(), `tinyrustlm-conversion-request-${process.pid}.json`);
  fs.writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  return { modelPath, requestPath, sha256: `sha256:${sha256}`, modelBytes: modelBytes.length };
}

async function runPageShareMetadataSmoke(client) {
  const fixture = writeShareMetadataFixture();
  try {
    const waitExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let index = 0; index < 600; index += 1) {
          if (
            byId("wasmState") &&
            byId("wasmState").textContent === "loaded" &&
            byId("conversionRequestFile") &&
            byId("importConversionRequestButton") &&
            byId("localModelFile") &&
            byId("importLocalModelButton") &&
            byId("saveShareMetadataButton") &&
            byId("saveShareKitButton")
          ) {
            return true;
          }
          await sleep(100);
        }
        throw new Error("runtime did not boot for share metadata smoke");
      })()
    `;
    parseEvaluateValue(await client.send("Runtime.evaluate", {
      expression: waitExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    }));
    await setFileInputFiles(client, "#conversionRequestFile", [fixture.requestPath]);
    const conversionExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        byId("conversionRequestFile").dispatchEvent(new Event("change", { bubbles: true }));
        byId("importConversionRequestButton").click();
        for (let index = 0; index < 200; index += 1) {
          if (byId("conversionRequestState").textContent.includes("example-org/tiny-source-model")) {
            return true;
          }
          await sleep(50);
        }
        throw new Error("conversion request did not bind");
      })()
    `;
    await client.send("Runtime.evaluate", {
      expression: conversionExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    });
    await setFileInputFiles(client, "#localModelFile", [fixture.modelPath]);
    const importAndExportExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        window.__tinyrustlmDownloads = [];
        window.__tinyrustlmDownloadNames = [];
        const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
        const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (blob) => {
          const url = originalCreateObjectUrl(blob);
          const record = { text: "", type: blob.type };
          window.__tinyrustlmDownloads.push(record);
          blob.text().then((text) => {
            record.text = text;
          });
          return url;
        };
        URL.revokeObjectURL = (url) => originalRevokeObjectUrl(url);
        const originalAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          window.__tinyrustlmDownloadNames.push(this.download || "");
          return originalAnchorClick.call(this);
        };
        byId("localModelFile").dispatchEvent(new Event("change", { bubbles: true }));
        byId("importLocalModelButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (
            byId("modelSelect").value === "__local_slm_file" &&
            byId("localModelState").textContent.includes("loaded") &&
            byId("runtimeStatus").textContent === "Ready" &&
            !byId("saveShareMetadataButton").disabled
          ) {
            break;
          }
          await sleep(100);
        }
        byId("saveShareMetadataButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (window.__tinyrustlmDownloads.length > 0) {
            break;
          }
          await sleep(100);
        }
        byId("saveShareKitButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (window.__tinyrustlmDownloadNames.some((name) => name.endsWith(".minimodel-share-kit.ps1"))) {
            break;
          }
          await sleep(100);
        }
        for (let index = 0; index < 600; index += 1) {
          const kitIndex = window.__tinyrustlmDownloadNames.findIndex((name) => name.endsWith(".minimodel-share-kit.ps1"));
          if (kitIndex >= 0 && window.__tinyrustlmDownloads[kitIndex] && window.__tinyrustlmDownloads[kitIndex].text) {
            break;
          }
          await sleep(100);
        }
        const downloaded = window.__tinyrustlmDownloads[0] || { text: "" };
        const kitIndex = window.__tinyrustlmDownloadNames.findIndex((name) => name.endsWith(".minimodel-share-kit.ps1"));
        const kitDownload = kitIndex >= 0 ? window.__tinyrustlmDownloads[kitIndex] || { text: "", type: "" } : { text: "", type: "" };
        const parsed = downloaded.text ? JSON.parse(downloaded.text) : {};
        return JSON.stringify({
          runtimeStatus: byId("runtimeStatus").textContent,
          localModelState: byId("localModelState").textContent,
          shareMetadataState: byId("shareMetadataState").textContent,
          conversionRequestState: byId("conversionRequestState").textContent,
          downloadNames: window.__tinyrustlmDownloadNames,
          shareKitScriptText: kitDownload.text || "",
          shareKitScriptType: kitDownload.type || "",
          bundle: parsed,
          fixtureSha256: ${JSON.stringify(fixture.sha256)},
          fixtureBytes: ${JSON.stringify(fixture.modelBytes)}
        });
      })()
    `;
    const result = await client.send("Runtime.evaluate", {
      expression: importAndExportExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 120000
    });
    return parseEvaluateValue(result);
  } finally {
    try {
      fs.unlinkSync(fixture.requestPath);
    } catch (_error) {
      // Best effort cleanup only.
    }
  }
}

async function runPageCatalogLocalImportSmoke(client) {
  const fixture = writeCatalogLocalImportFixture();
  try {
    const waitExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let index = 0; index < 600; index += 1) {
          if (
            byId("wasmState") &&
            byId("wasmState").textContent === "loaded" &&
            byId("localCatalogFile") &&
            byId("importLocalCatalogButton") &&
            byId("catalogResults")
          ) {
            return true;
          }
          await sleep(100);
        }
        throw new Error("runtime did not boot");
      })()
    `;
    parseEvaluateValue(await client.send("Runtime.evaluate", {
      expression: waitExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    }));
    await setFileInputFiles(client, "#localCatalogFile", [fixture.catalogPath]);
    const catalogExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        byId("localCatalogFile").dispatchEvent(new Event("change", { bubbles: true }));
        byId("importLocalCatalogButton").click();
        for (let index = 0; index < 200; index += 1) {
          if (byId("catalogResults").querySelector("button")) {
            byId("catalogResults").querySelector("button").click();
            return true;
          }
          await sleep(50);
        }
        throw new Error("catalog entry did not render");
      })()
    `;
    await client.send("Runtime.evaluate", {
      expression: catalogExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    });
    await setFileInputFiles(client, "#localModelFile", [fixture.modelPath]);
    const importExpression = `
      (async () => {
        const byId = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        byId("localModelFile").dispatchEvent(new Event("change", { bubbles: true }));
        byId("importLocalModelButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (
            byId("modelSelect").value === "__local_slm_file" &&
            byId("localModelState").textContent.includes("loaded") &&
            byId("runtimeStatus").textContent === "Ready" &&
            !byId("generateButton").disabled
          ) {
            break;
          }
          await sleep(100);
        }
        byId("maxTokens").value = "1";
        byId("prompt").value = "hi";
        byId("generateButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (byId("response").textContent.trim().length > 0) {
            break;
          }
          await sleep(100);
        }
        return JSON.stringify({
          runtimeStatus: byId("runtimeStatus").textContent,
          wasmState: byId("wasmState").textContent,
          modelState: byId("modelState").textContent,
          errorState: byId("errorState").textContent,
          catalogUrl: byId("catalogUrlInput").value,
          catalogStatus: byId("catalogStatus").textContent,
          catalogResults: Array.from(byId("catalogResults").querySelectorAll("li")).map((node) => node.textContent.trim().replace(/\\s+/g, " ")),
          localModelState: byId("localModelState").textContent,
          selectedModel: byId("modelSelect").value,
          selectedModelLabel: byId("modelSelect").selectedOptions[0] ? byId("modelSelect").selectedOptions[0].textContent : "",
          provenanceState: byId("provenanceState").textContent,
          provenanceSourceKind: byId("provenanceSourceKind").textContent,
          provenanceSourceId: byId("provenanceSourceId").textContent,
          provenanceSourceShape: byId("provenanceSourceShape").textContent,
          provenanceAdmission: byId("provenanceAdmission").textContent,
          provenanceQualityClaim: byId("provenanceQualityClaim").textContent,
          provenanceTrainedClaim: byId("provenanceTrainedClaim").textContent,
          provenanceChecksum: byId("provenanceChecksum").textContent,
          provenanceNextGate: byId("provenanceNextGate").textContent,
          response: byId("response").textContent,
          console: byId("console").textContent,
          fixtureSha256: ${JSON.stringify(fixture.sha256)},
          fixtureBytes: ${JSON.stringify(fixture.modelBytes)}
        });
      })()
    `;
    const result = await client.send("Runtime.evaluate", {
      expression: importExpression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    });
    return parseEvaluateValue(result);
  } finally {
    try {
      fs.unlinkSync(fixture.catalogPath);
    } catch (_error) {
      // Best effort cleanup only.
    }
  }
}

async function runPageStepTokenSmoke(client, modelKey) {
  const expression = `
    (async () => {
      const expectedModel = ${JSON.stringify(modelKey)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      for (let index = 0; index < 600; index += 1) {
        if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
          break;
        }
        await sleep(100);
      }
      if (byId("modelSelect").value !== expectedModel) {
        byId("modelSelect").value = expectedModel;
        byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        for (let index = 0; index < 600; index += 1) {
          if (byId("modelSelect").value === expectedModel && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            break;
          }
          await sleep(100);
        }
      }
      const readyStepDisabled = byId("stepTokenButton").disabled;
      byId("maxTokens").value = "1";
      byId("prompt").value = "hi";
      byId("generateButton").click();
      for (let index = 0; index < 600; index += 1) {
        if (byId("response").textContent === "e" || byId("errorState").textContent !== "none") {
          break;
        }
        await sleep(100);
      }
      const afterGenerateStepDisabled = byId("stepTokenButton").disabled;
      byId("stepTokenButton").click();
      for (let index = 0; index < 600; index += 1) {
        if (byId("response").textContent === "ee" || byId("errorState").textContent !== "none") {
          break;
        }
        await sleep(100);
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        conversationItems: Array.from(document.querySelectorAll("#conversation .message")).map((node) => ({
          role: node.querySelector(".message-role") ? node.querySelector(".message-role").textContent.trim() : "",
          text: node.querySelector(".message-text") ? node.querySelector(".message-text").textContent : "",
          isError: node.classList.contains("error")
        })),
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        benchPromptTokens: byId("benchPromptTokens").textContent,
        benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
        selectedModel: byId("modelSelect").value,
        readyStepDisabled,
        afterGenerateStepDisabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        generateDisabled: byId("generateButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 120000
  });
  return parseEvaluateValue(result);
}

async function runPageAdapterSidecarSmoke(client, modelKey, expectAutoAssembly) {
  const expression = `
    (async () => {
      const expectedModel = ${JSON.stringify(modelKey)};
      const expectAutoAssembly = ${expectAutoAssembly ? "true" : "false"};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      for (let index = 0; index < 600; index += 1) {
        const ready = byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready";
        const assembled = byId("adapterState") && byId("adapterState").textContent === "applied";
        if (ready && (!expectAutoAssembly || assembled)) {
          break;
        }
        await sleep(100);
      }
      const initialSelectedModel = byId("modelSelect").value;
      const modelOptions = Array.from(byId("modelSelect").options).map((option) => ({
        value: option.value,
        label: option.textContent.trim()
      }));
      if (byId("modelSelect").value !== expectedModel) {
        byId("modelSelect").value = expectedModel;
        byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        for (let index = 0; index < 600; index += 1) {
          const ready = byId("modelSelect").value === expectedModel && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready";
          const assembled = byId("adapterState") && byId("adapterState").textContent === "applied";
          if (ready && (!expectAutoAssembly || assembled)) {
            break;
          }
          await sleep(100);
        }
      }
      const adapterOptions = Array.from(byId("adapterSelect").options).map((option) => ({
        value: option.value,
        label: option.textContent.trim()
      }));
      const selectedAdapterBeforeApply = byId("adapterSelect").value;
      const adapterSelectDisabledBefore = byId("adapterSelect").disabled;
      const applyDisabledBefore = byId("applyAdapterButton").disabled;
      const adapterStateBeforeGenerate = byId("adapterState").textContent;
      const diagnosticsBeforeGenerate = parseDiagnostics();
      const consoleBeforeGenerate = byId("console").textContent;
      const autoAppliedBeforeGenerate = adapterStateBeforeGenerate === "applied";
      byId("maxTokens").value = "1";
      byId("prompt").value = "hi";
      byId("generateButton").click();
      for (let index = 0; index < 600; index += 1) {
        if (byId("response").textContent === "e" || byId("errorState").textContent !== "none") {
          break;
        }
        await sleep(100);
      }
      const afterGenerateDiagnostics = parseDiagnostics();
      const stepDisabledAfterGenerate = byId("stepTokenButton").disabled;
      let beforeApplyDiagnostics = afterGenerateDiagnostics;
      let stepDisabledBeforeApply = stepDisabledAfterGenerate;
      let afterApplyDiagnostics = diagnosticsBeforeGenerate;
      if (!expectAutoAssembly) {
        byId("applyAdapterButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (byId("adapterState").textContent === "applied" || byId("errorState").textContent !== "none") {
            break;
          }
          await sleep(100);
        }
        afterApplyDiagnostics = parseDiagnostics();
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        initialSelectedModel,
        selectedModel: byId("modelSelect").value,
        modelOptions,
        adapterState: byId("adapterState").textContent,
        provenanceGenome: byId("provenanceGenome").textContent,
        provenanceSpecies: byId("provenanceSpecies").textContent,
        provenanceNovelty: byId("provenanceNovelty").textContent,
        provenancePopulation: byId("provenancePopulation").textContent,
        provenanceMateSelection: byId("provenanceMateSelection").textContent,
        provenanceOperator: byId("provenanceOperator").textContent,
        provenanceSchedule: byId("provenanceSchedule").textContent,
        provenancePhenotype: byId("provenancePhenotype").textContent,
        provenanceArtifact: byId("provenanceArtifact").textContent,
        provenanceFitness: byId("provenanceFitness").textContent,
        provenanceEvalCases: byId("provenanceEvalCases").textContent,
        provenanceEvalChecksum: byId("provenanceEvalChecksum").textContent,
        assemblyState: byId("assemblyState").textContent,
        assemblyKind: byId("assemblyKind").textContent,
        assemblyParents: byId("assemblyParents").textContent,
        assemblyOperator: byId("assemblyOperator").textContent,
        assemblyLedger: byId("assemblyLedger").textContent,
        assemblyNextGate: byId("assemblyNextGate").textContent,
        modulePlanState: byId("modulePlanState").textContent,
        modulePlanKind: byId("modulePlanKind").textContent,
        modulePlanResource: byId("modulePlanResource").textContent,
        modulePlanExecution: byId("modulePlanExecution").textContent,
        modulePlanFetch: byId("modulePlanFetch").textContent,
        modulePlanOrigin: byId("modulePlanOrigin").textContent,
        modulePlanFetchLimit: byId("modulePlanFetchLimit").textContent,
        modulePlanPlannedFetchCount: byId("modulePlanPlannedFetchCount").textContent,
        modulePlanActualFetchCount: byId("modulePlanActualFetchCount").textContent,
        modulePlanRouteSetChecksumAlgorithm: byId("modulePlanRouteSetChecksumAlgorithm").textContent,
        modulePlanRouteSetVersion: byId("modulePlanRouteSetVersion").textContent,
        modulePlanRouteSetChecksum: byId("modulePlanRouteSetChecksum").textContent,
        modulePlanActualRouteSetChecksum: byId("modulePlanActualRouteSetChecksum").textContent,
        modulePlanWasmPages: byId("modulePlanWasmPages").textContent,
        modulePlanWasmExportSet: byId("modulePlanWasmExportSet").textContent,
        modulePlanWasmTransferStrategy: byId("modulePlanWasmTransferStrategy").textContent,
        modulePlanModelReleaseStrategy: byId("modulePlanModelReleaseStrategy").textContent,
        modulePlanRuntimeResetStrategy: byId("modulePlanRuntimeResetStrategy").textContent,
        modulePlanAdapterValidationStrategy: byId("modulePlanAdapterValidationStrategy").textContent,
        modulePlanAdapterValidationCount: byId("modulePlanAdapterValidationCount").textContent,
        modulePlanAdapterApplyCount: byId("modulePlanAdapterApplyCount").textContent,
        modulePlanWasmHeapMinBytes: byId("modulePlanWasmHeapMinBytes").textContent,
        modulePlanContextTokens: byId("modulePlanContextTokens").textContent,
        modulePlanSamplerCap: byId("modulePlanSamplerCap").textContent,
        modulePlanTokenizer: byId("modulePlanTokenizer").textContent,
        modulePlanModules: byId("modulePlanModules").textContent,
        modulePlanModelBudget: byId("modulePlanModelBudget").textContent,
        modulePlanAdapterBudget: byId("modulePlanAdapterBudget").textContent,
        modulePlanAdapterStackBudget: byId("modulePlanAdapterStackBudget").textContent,
        modulePlanScratchBudget: byId("modulePlanScratchBudget").textContent,
        modulePlanPromptLimit: byId("modulePlanPromptLimit").textContent,
        modulePlanOutputLimit: byId("modulePlanOutputLimit").textContent,
        modulePlanKvCacheBudget: byId("modulePlanKvCacheBudget").textContent,
        modulePlanKvCachePages: byId("modulePlanKvCachePages").textContent,
        modulePlanTotalBudget: byId("modulePlanTotalBudget").textContent,
        modulePlanTotalLimit: byId("modulePlanTotalLimit").textContent,
        modulePlanBytes: byId("modulePlanBytes").textContent,
        modulePlanActualModuleBytes: byId("modulePlanActualModuleBytes").textContent,
        modulePlanChecksums: byId("modulePlanChecksums").textContent,
        modulePlanActualModuleChecksums: byId("modulePlanActualModuleChecksums").textContent,
        modulePlanSlots: byId("modulePlanSlots").textContent,
        modulePlanRoles: byId("modulePlanRoles").textContent,
        modulePlanPhases: byId("modulePlanPhases").textContent,
        modulePlanDepends: byId("modulePlanDepends").textContent,
        modulePlanTrace: byId("modulePlanTrace").textContent,
        modulePlanModel: byId("modulePlanModel").textContent,
        modulePlanStack: byId("modulePlanStack").textContent,
        adapterOptions,
        selectedAdapterBeforeApply,
        adapterSelectDisabledBefore,
        applyDisabledBefore,
        adapterStateBeforeGenerate,
        autoAppliedBeforeGenerate,
        diagnosticsBeforeGenerate,
        consoleBeforeGenerate,
        afterGenerateDiagnostics,
        stepDisabledAfterGenerate,
        stepDisabledBeforeApply,
        stepDisabledAfterApply: byId("stepTokenButton").disabled,
        generateDisabledAfterApply: byId("generateButton").disabled,
        applyDisabledAfterApply: byId("applyAdapterButton").disabled,
        beforeApplyDiagnostics,
        afterApplyDiagnostics,
        diagnosticsText: byId("diagnostics").textContent
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 120000
  });
  return parseEvaluateValue(result);
}

// Drives repeated q4/q8/f32 browser assemblies; cycles is bounded so route-soak modes stay finite.
async function runPageCombinedSelectorAssemblySmoke(client, cycles) {
  const cycleCount = Math.max(1, Math.min(10, Number.parseInt(String(cycles || 1), 10) || 1));
  const expression = `
    (async () => {
      const expectedModels = ${JSON.stringify(combinedSelectorModels)};
      const cycles = ${cycleCount};
      const expectedSequence = [];
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        for (const modelKey of expectedModels) {
          expectedSequence.push(modelKey);
        }
      }
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const countOccurrences = (text, needle) => text.split(needle).length - 1;
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      const waitForReadyAssembly = async (modelKey) => {
        for (let index = 0; index < 900; index += 1) {
          const modelSelect = byId("modelSelect");
          const generateButton = byId("generateButton");
          const runtimeStatus = byId("runtimeStatus");
          const adapterState = byId("adapterState");
          const ready = modelSelect &&
            modelSelect.value === modelKey &&
            generateButton &&
            !generateButton.disabled &&
            runtimeStatus &&
            runtimeStatus.textContent === "Ready";
          const assembled = adapterState && adapterState.textContent === "applied";
          if (ready && assembled) {
            return true;
          }
          await sleep(100);
        }
        return false;
      };
      for (let index = 0; index < 900; index += 1) {
        if (byId("modelSelect") && byId("runtimeStatus") && byId("adapterState")) {
          break;
        }
        await sleep(100);
      }
      if (!byId("modelSelect")) {
        throw new Error("modelSelect missing before combined selector assembly smoke");
      }
      for (let index = 0; index < 900; index += 1) {
        const options = Array.from(byId("modelSelect").options).map((option) => option.value);
        if (
          expectedModels.every((modelKey) => options.includes(modelKey)) &&
          byId("runtimeStatus").textContent === "Ready" &&
          byId("adapterState").textContent === "applied"
        ) {
          break;
        }
        await sleep(100);
      }
      const initialSelectedModel = byId("modelSelect").value;
      const modelOptions = Array.from(byId("modelSelect").options).map((option) => ({
        value: option.value,
        label: option.textContent.trim()
      }));
      const steps = [];
      let previousConsoleText = "";
      for (let stepIndex = 0; stepIndex < expectedSequence.length; stepIndex += 1) {
        const modelKey = expectedSequence[stepIndex];
        const consoleBeforeSelect = byId("console").textContent;
        if (byId("modelSelect").value !== modelKey) {
          byId("modelSelect").value = modelKey;
          byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        }
        await waitForReadyAssembly(modelKey);
        const adapterOptions = Array.from(byId("adapterSelect").options).map((option) => ({
          value: option.value,
          label: option.textContent.trim()
        }));
        const selectedAdapterBeforeApply = byId("adapterSelect").value;
        const adapterSelectDisabledBefore = byId("adapterSelect").disabled;
        const applyDisabledBefore = byId("applyAdapterButton").disabled;
        const adapterStateBeforeGenerate = byId("adapterState").textContent;
        const diagnosticsBeforeGenerate = parseDiagnostics();
        const consoleBeforeGenerate = byId("console").textContent;
        const consoleDeltaBeforeGenerate = consoleBeforeGenerate.startsWith(previousConsoleText)
          ? consoleBeforeGenerate.slice(previousConsoleText.length)
          : consoleBeforeGenerate;
        const firstValidateIndexSincePreviousStep = consoleDeltaBeforeGenerate.indexOf("validate_adapter_delta");
        const lastFreeIndexSincePreviousStep = consoleDeltaBeforeGenerate.lastIndexOf("free_model(");
        byId("maxTokens").value = "1";
        byId("prompt").value = "hi";
        byId("generateButton").click();
        for (let index = 0; index < 900; index += 1) {
          const diagnostics = parseDiagnostics();
          if (
            byId("response").textContent === "e" &&
            diagnostics.generated_token_count === 1 &&
            byId("errorState").textContent === "none"
          ) {
            break;
          }
          if (byId("errorState").textContent !== "none") {
            break;
          }
          await sleep(100);
        }
        steps.push({
          modelKey,
          cycleIndex: Math.floor(stepIndex / expectedModels.length),
          passIndex: stepIndex,
          runtimeStatus: byId("runtimeStatus").textContent,
          modelState: byId("modelState").textContent,
          errorState: byId("errorState").textContent,
          response: byId("response").textContent,
          console: byId("console").textContent,
          consoleBeforeSelect,
          initialSelectedModel,
          selectedModel: byId("modelSelect").value,
          modelOptions,
          adapterState: byId("adapterState").textContent,
          provenanceGenome: byId("provenanceGenome").textContent,
          provenanceSpecies: byId("provenanceSpecies").textContent,
          provenanceNovelty: byId("provenanceNovelty").textContent,
          provenancePopulation: byId("provenancePopulation").textContent,
          provenanceMateSelection: byId("provenanceMateSelection").textContent,
          provenanceOperator: byId("provenanceOperator").textContent,
          provenanceSchedule: byId("provenanceSchedule").textContent,
          provenancePhenotype: byId("provenancePhenotype").textContent,
          provenanceArtifact: byId("provenanceArtifact").textContent,
          provenanceFitness: byId("provenanceFitness").textContent,
          provenanceEvalCases: byId("provenanceEvalCases").textContent,
          provenanceEvalChecksum: byId("provenanceEvalChecksum").textContent,
          assemblyState: byId("assemblyState").textContent,
          assemblyKind: byId("assemblyKind").textContent,
          assemblyParents: byId("assemblyParents").textContent,
          assemblyOperator: byId("assemblyOperator").textContent,
          assemblyLedger: byId("assemblyLedger").textContent,
          assemblyNextGate: byId("assemblyNextGate").textContent,
          modulePlanState: byId("modulePlanState").textContent,
          modulePlanKind: byId("modulePlanKind").textContent,
          modulePlanResource: byId("modulePlanResource").textContent,
          modulePlanExecution: byId("modulePlanExecution").textContent,
          modulePlanFetch: byId("modulePlanFetch").textContent,
          modulePlanOrigin: byId("modulePlanOrigin").textContent,
          modulePlanFetchLimit: byId("modulePlanFetchLimit").textContent,
          modulePlanPlannedFetchCount: byId("modulePlanPlannedFetchCount").textContent,
          modulePlanActualFetchCount: byId("modulePlanActualFetchCount").textContent,
          modulePlanRouteSetChecksumAlgorithm: byId("modulePlanRouteSetChecksumAlgorithm").textContent,
          modulePlanRouteSetVersion: byId("modulePlanRouteSetVersion").textContent,
          modulePlanRouteSetChecksum: byId("modulePlanRouteSetChecksum").textContent,
          modulePlanActualRouteSetChecksum: byId("modulePlanActualRouteSetChecksum").textContent,
          modulePlanWasmPages: byId("modulePlanWasmPages").textContent,
          modulePlanWasmExportSet: byId("modulePlanWasmExportSet").textContent,
          modulePlanWasmTransferStrategy: byId("modulePlanWasmTransferStrategy").textContent,
          modulePlanModelReleaseStrategy: byId("modulePlanModelReleaseStrategy").textContent,
          modulePlanRuntimeResetStrategy: byId("modulePlanRuntimeResetStrategy").textContent,
          modulePlanAdapterValidationStrategy: byId("modulePlanAdapterValidationStrategy").textContent,
          modulePlanAdapterValidationCount: byId("modulePlanAdapterValidationCount").textContent,
          modulePlanAdapterApplyCount: byId("modulePlanAdapterApplyCount").textContent,
          modulePlanWasmHeapMinBytes: byId("modulePlanWasmHeapMinBytes").textContent,
          modulePlanContextTokens: byId("modulePlanContextTokens").textContent,
          modulePlanSamplerCap: byId("modulePlanSamplerCap").textContent,
          modulePlanTokenizer: byId("modulePlanTokenizer").textContent,
          modulePlanModules: byId("modulePlanModules").textContent,
          modulePlanModelBudget: byId("modulePlanModelBudget").textContent,
          modulePlanAdapterBudget: byId("modulePlanAdapterBudget").textContent,
          modulePlanAdapterStackBudget: byId("modulePlanAdapterStackBudget").textContent,
          modulePlanScratchBudget: byId("modulePlanScratchBudget").textContent,
          modulePlanPromptLimit: byId("modulePlanPromptLimit").textContent,
          modulePlanOutputLimit: byId("modulePlanOutputLimit").textContent,
          modulePlanKvCacheBudget: byId("modulePlanKvCacheBudget").textContent,
          modulePlanKvCachePages: byId("modulePlanKvCachePages").textContent,
          modulePlanTotalBudget: byId("modulePlanTotalBudget").textContent,
          modulePlanTotalLimit: byId("modulePlanTotalLimit").textContent,
          modulePlanBytes: byId("modulePlanBytes").textContent,
          modulePlanActualModuleBytes: byId("modulePlanActualModuleBytes").textContent,
          modulePlanChecksums: byId("modulePlanChecksums").textContent,
          modulePlanActualModuleChecksums: byId("modulePlanActualModuleChecksums").textContent,
          modulePlanSlots: byId("modulePlanSlots").textContent,
          modulePlanRoles: byId("modulePlanRoles").textContent,
          modulePlanPhases: byId("modulePlanPhases").textContent,
          modulePlanDepends: byId("modulePlanDepends").textContent,
          modulePlanTrace: byId("modulePlanTrace").textContent,
          modulePlanModel: byId("modulePlanModel").textContent,
          modulePlanStack: byId("modulePlanStack").textContent,
          adapterOptions,
          selectedAdapterBeforeApply,
          adapterSelectDisabledBefore,
          applyDisabledBefore,
          adapterStateBeforeGenerate,
          autoAppliedBeforeGenerate: adapterStateBeforeGenerate === "applied",
          diagnosticsBeforeGenerate,
          consoleBeforeGenerate,
          consoleDeltaBeforeGenerate,
          freeCallsBeforeGenerate: countOccurrences(consoleBeforeGenerate, "free_model("),
          freeCallsSincePreviousStep: countOccurrences(consoleDeltaBeforeGenerate, "free_model("),
          firstValidateIndexSincePreviousStep,
          lastFreeIndexSincePreviousStep,
          validateCallsBeforeGenerate: countOccurrences(consoleBeforeGenerate, "validate_adapter_delta"),
          applyCallsBeforeGenerate: countOccurrences(consoleBeforeGenerate, "apply_adapter_delta"),
          validateCallsSincePreviousStep: countOccurrences(consoleDeltaBeforeGenerate, "validate_adapter_delta"),
          applyCallsSincePreviousStep: countOccurrences(consoleDeltaBeforeGenerate, "apply_adapter_delta"),
          stackCompletionsSincePreviousStep: countOccurrences(consoleDeltaBeforeGenerate, "adapter_stack_applied(3)"),
          afterGenerateDiagnostics: parseDiagnostics(),
          stepDisabledAfterGenerate: byId("stepTokenButton").disabled,
          stepDisabledBeforeApply: byId("stepTokenButton").disabled,
          stepDisabledAfterApply: byId("stepTokenButton").disabled,
          generateDisabledAfterApply: byId("generateButton").disabled,
          applyDisabledAfterApply: byId("applyAdapterButton").disabled,
          beforeApplyDiagnostics: parseDiagnostics(),
          afterApplyDiagnostics: diagnosticsBeforeGenerate,
          diagnosticsText: byId("diagnostics").textContent
        });
        previousConsoleText = byId("console").textContent;
      }
      return JSON.stringify({
        initialSelectedModel,
        modelOptions,
        finalSelectedModel: byId("modelSelect").value,
        cycles,
        expectedSequence,
        steps
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 240000
  });
  return parseEvaluateValue(result);
}

// Runs one full q4/q8/f32 generated assembly pass after each page reload.
async function runCombinedSelectorReloadSoak(client, reloads) {
  const reloadCount = Math.max(2, Math.min(6, Number.parseInt(String(reloads || 2), 10) || 2));
  const results = [];
  for (let reloadIndex = 0; reloadIndex < reloadCount; reloadIndex += 1) {
    const pageUrl = new URL(appUrl);
    pageUrl.searchParams.set("reload_soak", String(reloadIndex));
    await client.send("Page.navigate", { url: pageUrl.toString() });
    let pageResult = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await sleep(500);
        pageResult = await runPageCombinedSelectorAssemblySmoke(client);
        break;
      } catch (error) {
        if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
          throw error;
        }
      }
    }
    if (pageResult) {
      pageResult.reloadIndex = reloadIndex;
    }
    results.push(pageResult);
  }
  return {
    reloads: reloadCount,
    results
  };
}

async function runPageAdapterLoadStateSmoke(client, modelKey) {
  const expression = `
    (async () => {
      const expectedModel = ${JSON.stringify(modelKey)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      for (let index = 0; index < 600; index += 1) {
        const adapterState = byId("adapterState") ? byId("adapterState").textContent : "";
        const status = byId("runtimeStatus") ? byId("runtimeStatus").textContent : "";
        const ready = byId("generateButton") && !byId("generateButton").disabled && status === "Ready";
        if (status === "Adapter load failed") {
          break;
        }
        if (ready && adapterState !== "waiting" && adapterState !== "loading") {
          break;
        }
        await sleep(100);
      }
      const initialSelectedModel = byId("modelSelect").value;
      if (byId("modelSelect").value !== expectedModel) {
        byId("modelSelect").value = expectedModel;
        byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        for (let index = 0; index < 600; index += 1) {
          const adapterState = byId("adapterState") ? byId("adapterState").textContent : "";
          const status = byId("runtimeStatus") ? byId("runtimeStatus").textContent : "";
          const ready = byId("modelSelect").value === expectedModel && !byId("generateButton").disabled && status === "Ready";
          if (status === "Adapter load failed") {
            break;
          }
          if (ready && adapterState !== "waiting" && adapterState !== "loading") {
            break;
          }
          await sleep(100);
        }
      }
      const adapterOptions = Array.from(byId("adapterSelect").options).map((option) => ({
        value: option.value,
        label: option.textContent.trim()
      }));
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        initialSelectedModel,
        selectedModel: byId("modelSelect").value,
        adapterState: byId("adapterState").textContent,
        assemblyState: byId("assemblyState").textContent,
        assemblyKind: byId("assemblyKind").textContent,
        assemblyParents: byId("assemblyParents").textContent,
        assemblyNextGate: byId("assemblyNextGate").textContent,
        modulePlanTrace: byId("modulePlanTrace").textContent,
        adapterOptions,
        selectedAdapter: byId("adapterSelect").value,
        adapterSelectDisabled: byId("adapterSelect").disabled,
        applyDisabled: byId("applyAdapterButton").disabled,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled,
        diagnostics: parseDiagnostics()
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 120000
  });
  return parseEvaluateValue(result);
}

async function runPageLoopSmoke(client) {
  const expression = `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const steps = [];
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      const snapshot = (label) => ({
        label,
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        benchLoadMs: byId("benchLoadMs").textContent,
        benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
      const waitReady = async () => {
        for (let index = 0; index < 600; index += 1) {
          if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            return;
          }
          await sleep(100);
        }
      };
      const selectModel = async (modelKey, label) => {
        if (byId("modelSelect").value !== modelKey) {
          byId("modelSelect").value = modelKey;
          byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        }
        await waitReady();
        steps.push(snapshot(label));
      };
      const generate = async (label) => {
        byId("response").textContent = "";
        byId("maxTokens").value = "1";
        byId("prompt").value = "hi";
        byId("generateButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (byId("response").textContent.trim().length > 0) {
            break;
          }
          await sleep(100);
        }
        steps.push(snapshot(label));
      };
      const reset = async (label) => {
        byId("resetButton").click();
        for (let index = 0; index < 200; index += 1) {
          if (byId("console").textContent === "context reset") {
            break;
          }
          await sleep(50);
        }
        steps.push(snapshot(label));
      };

      await waitReady();
      steps.push(snapshot("reload-ready"));
      await selectModel("tinylm16q8", "q8-ready");
      await generate("q8-generate-1");
      await reset("q8-reset");
      await generate("q8-generate-2");
      await selectModel("tinylm16q4", "q4-ready");
      await generate("q4-generate-1");
      await reset("q4-reset");
      await generate("q4-generate-2");
      return JSON.stringify({ steps });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 180000
  });
  return parseEvaluateValue(result);
}

async function runPageModelErrorSmoke(client, modelKey) {
  const expression = `
    (async () => {
      const expectedModel = ${JSON.stringify(modelKey || "")};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      if (expectedModel) {
        for (let index = 0; index < 600; index += 1) {
          if (byId("modelSelect")) {
            break;
          }
          await sleep(100);
        }
        if (byId("modelSelect") && byId("modelSelect").value !== expectedModel) {
          byId("modelSelect").value = expectedModel;
          byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      for (let index = 0; index < 600; index += 1) {
        const status = byId("runtimeStatus") ? byId("runtimeStatus").textContent : "Booting";
        if (status !== "Booting" && status !== "Loading runtime" && status !== "Loading local model") {
          break;
        }
        await sleep(100);
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        wasmState: byId("wasmState").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        modulePlanState: byId("modulePlanState").textContent,
        modulePlanExecution: byId("modulePlanExecution").textContent,
        modulePlanFetch: byId("modulePlanFetch").textContent,
        modulePlanOrigin: byId("modulePlanOrigin").textContent,
        modulePlanFetchLimit: byId("modulePlanFetchLimit").textContent,
        modulePlanPlannedFetchCount: byId("modulePlanPlannedFetchCount").textContent,
        modulePlanActualFetchCount: byId("modulePlanActualFetchCount").textContent,
        modulePlanRouteSetChecksumAlgorithm: byId("modulePlanRouteSetChecksumAlgorithm").textContent,
        modulePlanRouteSetVersion: byId("modulePlanRouteSetVersion").textContent,
        modulePlanRouteSetChecksum: byId("modulePlanRouteSetChecksum").textContent,
        modulePlanActualRouteSetChecksum: byId("modulePlanActualRouteSetChecksum").textContent,
        modulePlanWasmPages: byId("modulePlanWasmPages").textContent,
        modulePlanWasmExportSet: byId("modulePlanWasmExportSet").textContent,
        modulePlanWasmTransferStrategy: byId("modulePlanWasmTransferStrategy").textContent,
        modulePlanModelReleaseStrategy: byId("modulePlanModelReleaseStrategy").textContent,
        modulePlanRuntimeResetStrategy: byId("modulePlanRuntimeResetStrategy").textContent,
        modulePlanAdapterValidationStrategy: byId("modulePlanAdapterValidationStrategy").textContent,
        modulePlanAdapterValidationCount: byId("modulePlanAdapterValidationCount").textContent,
        modulePlanAdapterApplyCount: byId("modulePlanAdapterApplyCount").textContent,
        modulePlanWasmHeapMinBytes: byId("modulePlanWasmHeapMinBytes").textContent,
        modulePlanContextTokens: byId("modulePlanContextTokens").textContent,
        modulePlanSamplerCap: byId("modulePlanSamplerCap").textContent,
        modulePlanTokenizer: byId("modulePlanTokenizer").textContent,
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPageAssemblyEvalCaseDriftSmoke(client) {
  const expression = `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      for (let index = 0; index < 800; index += 1) {
        const status = byId("runtimeStatus") ? byId("runtimeStatus").textContent : "Booting";
        const assemblyState = byId("assemblyState") ? byId("assemblyState").textContent : "";
        if (
          status === "Model load failed" ||
          assemblyState.includes("assembly eval case evidence checksum mismatch")
        ) {
          break;
        }
        await sleep(100);
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        wasmState: byId("wasmState").textContent,
        modelState: byId("modelState").textContent,
        assemblyState: byId("assemblyState").textContent,
        modulePlanState: byId("modulePlanState").textContent,
        modulePlanTrace: byId("modulePlanTrace").textContent,
        adapterState: byId("adapterState").textContent,
        errorState: byId("errorState").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 120000
  });
  return parseEvaluateValue(result);
}

async function runPageMissingModelSmoke(client) {
  const expression = `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      for (let index = 0; index < 600; index += 1) {
        const status = byId("runtimeStatus") ? byId("runtimeStatus").textContent : "Booting";
        if (status !== "Booting" && status !== "Loading runtime" && status !== "Loading local model") {
          break;
        }
        await sleep(100);
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        wasmState: byId("wasmState").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPageContextErrorSmoke(client) {
  const expression = `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      for (let index = 0; index < 600; index += 1) {
        if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
          break;
        }
        await sleep(100);
      }
      byId("response").textContent = "";
      byId("maxTokens").value = "1";
      byId("prompt").value = "a".repeat(512);
      byId("generateButton").click();
      for (let index = 0; index < 600; index += 1) {
        if (byId("errorState").textContent === "context exceeded" || byId("response").textContent.trim().length > 0) {
          break;
        }
        await sleep(100);
      }
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000
  });
  return parseEvaluateValue(result);
}

async function runPageEnduranceSmoke(client, cycles) {
  const expression = `
    (async () => {
      const cycles = ${JSON.stringify(cycles)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const steps = [];
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      const snapshot = (label) => ({
        label,
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
      const waitReady = async () => {
        for (let index = 0; index < 600; index += 1) {
          if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            return;
          }
          await sleep(100);
        }
      };
      const selectModel = async (modelKey, label) => {
        if (byId("modelSelect").value !== modelKey) {
          byId("modelSelect").value = modelKey;
          byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        }
        await waitReady();
        steps.push(snapshot(label));
      };
      const generate = async (label) => {
        byId("response").textContent = "";
        byId("maxTokens").value = "1";
        byId("prompt").value = "hi";
        byId("generateButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (byId("response").textContent.trim().length > 0) {
            break;
          }
          await sleep(100);
        }
        steps.push(snapshot(label));
      };
      const reset = async (label) => {
        byId("resetButton").click();
        for (let index = 0; index < 200; index += 1) {
          if (byId("console").textContent === "context reset") {
            break;
          }
          await sleep(50);
        }
        steps.push(snapshot(label));
      };

      await waitReady();
      for (let cycle = 1; cycle <= cycles; cycle += 1) {
        await selectModel("tinylm16q8", "cycle-" + cycle + "-q8-ready");
        await generate("cycle-" + cycle + "-q8-generate");
        await reset("cycle-" + cycle + "-q8-reset");
        await selectModel("tinylm16q4", "cycle-" + cycle + "-q4-ready");
        await generate("cycle-" + cycle + "-q4-generate");
        await reset("cycle-" + cycle + "-q4-reset");
      }
      return JSON.stringify({ cycles, steps });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 300000
  });
  return parseEvaluateValue(result);
}

async function runPagePerformanceSmoke(client, maxTokens) {
  const expression = `
    (async () => {
      const maxTokens = ${JSON.stringify(maxTokens)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const steps = [];
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      const parseBenchmarkNumber = (id) => {
        const text = byId(id).textContent || "";
        const value = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
        return Number.isFinite(value) ? value : 0;
      };
      const snapshot = (label, elapsedMs) => ({
        label,
        elapsedMs,
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        benchLoadMs: byId("benchLoadMs").textContent,
        benchPromptTokens: byId("benchPromptTokens").textContent,
        benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
        benchTokensPerSecond: byId("benchTokensPerSecond").textContent,
        benchScratch: byId("benchScratch").textContent,
        benchLoadMsValue: parseBenchmarkNumber("benchLoadMs"),
        benchPromptTokensValue: parseBenchmarkNumber("benchPromptTokens"),
        benchGeneratedTokensValue: parseBenchmarkNumber("benchGeneratedTokens"),
        benchTokensPerSecondValue: parseBenchmarkNumber("benchTokensPerSecond"),
        benchScratchValue: parseBenchmarkNumber("benchScratch"),
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
      const waitReady = async () => {
        for (let index = 0; index < 600; index += 1) {
          if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            return;
          }
          await sleep(100);
        }
      };
      const selectModel = async (modelKey, label) => {
        if (byId("modelSelect").value !== modelKey) {
          byId("modelSelect").value = modelKey;
          byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        }
        await waitReady();
        steps.push(snapshot(label, 0));
      };
      const generate = async (label, prompt) => {
        byId("response").textContent = "";
        byId("maxTokens").value = String(maxTokens);
        byId("prompt").value = prompt;
        const started = performance.now();
        byId("generateButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (byId("response").textContent.trim().length >= maxTokens || byId("errorState").textContent !== "none") {
            break;
          }
          await sleep(100);
        }
        steps.push(snapshot(label, Math.round(performance.now() - started)));
      };
      const reset = async (label) => {
        byId("resetButton").click();
        for (let index = 0; index < 200; index += 1) {
          if (byId("console").textContent === "context reset") {
            break;
          }
          await sleep(50);
        }
        steps.push(snapshot(label, 0));
      };

      await waitReady();
      await selectModel("tinylm16q8", "q8-performance-ready");
      await generate("q8-performance-generate", "hi");
      await reset("q8-performance-reset");
      await selectModel("tinylm16q4", "q4-performance-ready");
      await generate("q4-performance-generate", "hi");
      await reset("q4-performance-reset");
      return JSON.stringify({ maxTokens, steps });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 240000
  });
  return parseEvaluateValue(result);
}

async function runPagePerformanceSoak(client, cycles, maxTokens) {
  const expression = `
    (async () => {
      const cycles = ${JSON.stringify(cycles)};
      const maxTokens = ${JSON.stringify(maxTokens)};
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const steps = [];
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      const parseBenchmarkNumber = (id) => {
        const text = byId(id).textContent || "";
        const value = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
        return Number.isFinite(value) ? value : 0;
      };
      const snapshot = (label, elapsedMs) => ({
        label,
        elapsedMs,
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        diagnosticsText: byId("diagnostics").textContent,
        benchLoadMs: byId("benchLoadMs").textContent,
        benchPromptTokens: byId("benchPromptTokens").textContent,
        benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
        benchTokensPerSecond: byId("benchTokensPerSecond").textContent,
        benchScratch: byId("benchScratch").textContent,
        benchLoadMsValue: parseBenchmarkNumber("benchLoadMs"),
        benchPromptTokensValue: parseBenchmarkNumber("benchPromptTokens"),
        benchGeneratedTokensValue: parseBenchmarkNumber("benchGeneratedTokens"),
        benchTokensPerSecondValue: parseBenchmarkNumber("benchTokensPerSecond"),
        benchScratchValue: parseBenchmarkNumber("benchScratch"),
        selectedModel: byId("modelSelect").value,
        generateDisabled: byId("generateButton").disabled,
        stepTokenDisabled: byId("stepTokenButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
      const waitReady = async () => {
        for (let index = 0; index < 600; index += 1) {
          if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            return;
          }
          await sleep(100);
        }
      };
      const selectModel = async (modelKey, label) => {
        if (byId("modelSelect").value !== modelKey) {
          byId("modelSelect").value = modelKey;
          byId("modelSelect").dispatchEvent(new Event("change", { bubbles: true }));
        }
        await waitReady();
        steps.push(snapshot(label, 0));
      };
      const generate = async (label, prompt) => {
        byId("response").textContent = "";
        byId("maxTokens").value = String(maxTokens);
        byId("prompt").value = prompt;
        const started = performance.now();
        byId("generateButton").click();
        for (let index = 0; index < 600; index += 1) {
          if (byId("response").textContent.trim().length >= maxTokens || byId("errorState").textContent !== "none") {
            break;
          }
          await sleep(100);
        }
        steps.push(snapshot(label, Math.round(performance.now() - started)));
      };
      const reset = async (label) => {
        byId("resetButton").click();
        for (let index = 0; index < 200; index += 1) {
          if (byId("console").textContent === "context reset") {
            break;
          }
          await sleep(50);
        }
        steps.push(snapshot(label, 0));
      };

      await waitReady();
      for (let cycle = 1; cycle <= cycles; cycle += 1) {
        await selectModel("tinylm16q8", "cycle-" + cycle + "-q8-performance-ready");
        await generate("cycle-" + cycle + "-q8-performance-generate", "hi");
        await reset("cycle-" + cycle + "-q8-performance-reset");
        await selectModel("tinylm16q4", "cycle-" + cycle + "-q4-performance-ready");
        await generate("cycle-" + cycle + "-q4-performance-generate", "hi");
        await reset("cycle-" + cycle + "-q4-performance-reset");
      }
      return JSON.stringify({ cycles, maxTokens, steps });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 600000
  });
  return parseEvaluateValue(result);
}

async function runPageUiAudit(client) {
  const expression = `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const byId = (id) => document.getElementById(id);
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch (_error) {
          return {};
        }
      };
      const parseBenchmarkNumber = (id) => {
        const text = byId(id).textContent || "";
        const value = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
        return Number.isFinite(value) ? value : 0;
      };
      const textList = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.textContent.replace(/\\s+/g, " ").trim());
      const badRects = () => Array.from(document.querySelectorAll(".left-sidebar,.main-workspace,.advanced-options-panel,.model-toolbar,.privacy-badge,.conversation-panel,.composer-panel,.model-drawer,.diagnostics-rail,.footnote,button,textarea,select,input"))
        .filter((node) => {
          if (node.closest("[hidden]")) {
            return false;
          }
          const closedDetails = node.closest("details:not([open])");
          if (closedDetails && !(node.tagName.toLowerCase() === "summary" || node.closest("summary"))) {
            return false;
          }
          for (let current = node; current; current = current.parentElement) {
            const style = window.getComputedStyle(current);
            if (style.display === "none" || style.visibility === "hidden") {
              return false;
            }
          }
          return true;
        })
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            tag: node.tagName.toLowerCase(),
            id: node.id || "",
            className: typeof node.className === "string" ? node.className : "",
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
        .filter((rect) => rect.width < 1 || rect.height < 1);
      const collect = (label) => {
        const diagnostics = parseDiagnostics();
        return {
          label,
          title: document.title,
          lang: document.documentElement.lang,
          h1: document.querySelector("h1") ? document.querySelector("h1").textContent.trim() : "",
          eyebrow: document.querySelector(".eyebrow") ? document.querySelector(".eyebrow").textContent.trim() : "",
          notice: document.querySelector(".notice") ? document.querySelector(".notice").textContent.trim() : "",
          privacyBadge: document.querySelector(".privacy-badge") ? document.querySelector(".privacy-badge").textContent.replace(/\\s+/g, " ").trim() : "",
          modelToolbar: document.querySelector(".model-toolbar") ? document.querySelector(".model-toolbar").textContent.replace(/\\s+/g, " ").trim() : "",
          starterLabels: textList(".starter-action"),
          presetLabels: textList(".preset-button"),
          hasLeftSidebar: Boolean(document.querySelector(".left-sidebar")),
          hasMainWorkspace: Boolean(document.querySelector(".main-workspace")),
          hasAdvancedOptionsPanel: Boolean(document.querySelector(".advanced-options-panel")),
          footer: byId("appFooter") ? byId("appFooter").textContent.replace(/\\s+/g, " ").trim() : "",
          headings: textList("h2, h3, summary, .tab-button"),
          labels: textList("label"),
          modelOptions: Array.from(byId("modelSelect").options).map((option) => option.textContent.trim()),
          runtimeStatus: byId("runtimeStatus").textContent,
          wasmState: byId("wasmState").textContent,
          modelState: byId("modelState").textContent,
          errorState: byId("errorState").textContent,
          response: byId("response").textContent,
          conversationText: byId("conversation").textContent,
          conversationItems: Array.from(document.querySelectorAll("#conversation .message")).map((node) => ({
            role: node.querySelector(".message-role") ? node.querySelector(".message-role").textContent.trim() : "",
            text: node.querySelector(".message-text") ? node.querySelector(".message-text").textContent : "",
            isError: node.classList.contains("error")
          })),
          console: byId("console").textContent,
          diagnostics,
          diagnosticsText: byId("diagnostics").textContent,
          developerText: byId("developer").textContent,
          provenanceState: byId("provenanceState").textContent,
          provenanceSourceKind: byId("provenanceSourceKind").textContent,
          provenanceSourceSnapshot: byId("provenanceSourceSnapshot").textContent,
          provenanceSourceId: byId("provenanceSourceId").textContent,
          provenanceSourceShape: byId("provenanceSourceShape").textContent,
          provenanceSourceReview: byId("provenanceSourceReview").textContent,
          provenanceSourceReviewRoutes: byId("provenanceSourceReviewRoutes").textContent,
          provenanceSourceReviewArtifacts: byId("provenanceSourceReviewArtifacts").textContent,
          provenanceSourceTokenizerImport: byId("provenanceSourceTokenizerImport").textContent,
          provenanceSourceValidation: byId("provenanceSourceValidation").textContent,
          provenanceAdmission: byId("provenanceAdmission").textContent,
          provenanceQualityClaim: byId("provenanceQualityClaim").textContent,
          provenanceTrainedClaim: byId("provenanceTrainedClaim").textContent,
          provenanceGenome: byId("provenanceGenome").textContent,
          provenanceSpecies: byId("provenanceSpecies").textContent,
          provenanceNovelty: byId("provenanceNovelty").textContent,
          provenancePopulation: byId("provenancePopulation").textContent,
          provenanceMateSelection: byId("provenanceMateSelection").textContent,
          provenanceOperator: byId("provenanceOperator").textContent,
          provenanceSchedule: byId("provenanceSchedule").textContent,
          provenancePhenotype: byId("provenancePhenotype").textContent,
          provenanceArtifact: byId("provenanceArtifact").textContent,
          provenanceFitness: byId("provenanceFitness").textContent,
          provenanceEvalCases: byId("provenanceEvalCases").textContent,
          provenanceEvalChecksum: byId("provenanceEvalChecksum").textContent,
          provenanceChecksum: byId("provenanceChecksum").textContent,
          provenanceNextGate: byId("provenanceNextGate").textContent,
          assemblyState: byId("assemblyState").textContent,
          assemblyKind: byId("assemblyKind").textContent,
          assemblyParents: byId("assemblyParents").textContent,
          assemblyOperator: byId("assemblyOperator").textContent,
          assemblyLedger: byId("assemblyLedger").textContent,
          assemblyNextGate: byId("assemblyNextGate").textContent,
          modulePlanState: byId("modulePlanState").textContent,
          modulePlanKind: byId("modulePlanKind").textContent,
          modulePlanResource: byId("modulePlanResource").textContent,
          modulePlanExecution: byId("modulePlanExecution").textContent,
          modulePlanFetch: byId("modulePlanFetch").textContent,
          modulePlanOrigin: byId("modulePlanOrigin").textContent,
          modulePlanFetchLimit: byId("modulePlanFetchLimit").textContent,
          modulePlanPlannedFetchCount: byId("modulePlanPlannedFetchCount").textContent,
          modulePlanActualFetchCount: byId("modulePlanActualFetchCount").textContent,
          modulePlanRouteSetChecksumAlgorithm: byId("modulePlanRouteSetChecksumAlgorithm").textContent,
          modulePlanRouteSetVersion: byId("modulePlanRouteSetVersion").textContent,
          modulePlanRouteSetChecksum: byId("modulePlanRouteSetChecksum").textContent,
          modulePlanActualRouteSetChecksum: byId("modulePlanActualRouteSetChecksum").textContent,
          modulePlanWasmPages: byId("modulePlanWasmPages").textContent,
          modulePlanWasmExportSet: byId("modulePlanWasmExportSet").textContent,
          modulePlanWasmTransferStrategy: byId("modulePlanWasmTransferStrategy").textContent,
          modulePlanModelReleaseStrategy: byId("modulePlanModelReleaseStrategy").textContent,
          modulePlanRuntimeResetStrategy: byId("modulePlanRuntimeResetStrategy").textContent,
          modulePlanAdapterValidationStrategy: byId("modulePlanAdapterValidationStrategy").textContent,
          modulePlanAdapterValidationCount: byId("modulePlanAdapterValidationCount").textContent,
          modulePlanAdapterApplyCount: byId("modulePlanAdapterApplyCount").textContent,
          modulePlanWasmHeapMinBytes: byId("modulePlanWasmHeapMinBytes").textContent,
          modulePlanContextTokens: byId("modulePlanContextTokens").textContent,
          modulePlanSamplerCap: byId("modulePlanSamplerCap").textContent,
          modulePlanTokenizer: byId("modulePlanTokenizer").textContent,
          modulePlanModules: byId("modulePlanModules").textContent,
          modulePlanModelBudget: byId("modulePlanModelBudget").textContent,
          modulePlanAdapterBudget: byId("modulePlanAdapterBudget").textContent,
          modulePlanAdapterStackBudget: byId("modulePlanAdapterStackBudget").textContent,
          modulePlanScratchBudget: byId("modulePlanScratchBudget").textContent,
          modulePlanPromptLimit: byId("modulePlanPromptLimit").textContent,
          modulePlanOutputLimit: byId("modulePlanOutputLimit").textContent,
          modulePlanKvCacheBudget: byId("modulePlanKvCacheBudget").textContent,
          modulePlanKvCachePages: byId("modulePlanKvCachePages").textContent,
          modulePlanTotalBudget: byId("modulePlanTotalBudget").textContent,
          modulePlanTotalLimit: byId("modulePlanTotalLimit").textContent,
          modulePlanBytes: byId("modulePlanBytes").textContent,
          modulePlanActualModuleBytes: byId("modulePlanActualModuleBytes").textContent,
          modulePlanChecksums: byId("modulePlanChecksums").textContent,
          modulePlanActualModuleChecksums: byId("modulePlanActualModuleChecksums").textContent,
          modulePlanSlots: byId("modulePlanSlots").textContent,
          modulePlanRoles: byId("modulePlanRoles").textContent,
          modulePlanPhases: byId("modulePlanPhases").textContent,
          modulePlanDepends: byId("modulePlanDepends").textContent,
          modulePlanTrace: byId("modulePlanTrace").textContent,
          modulePlanModel: byId("modulePlanModel").textContent,
          modulePlanStack: byId("modulePlanStack").textContent,
          benchLoadMs: byId("benchLoadMs").textContent,
          benchPromptTokens: byId("benchPromptTokens").textContent,
          benchGeneratedTokens: byId("benchGeneratedTokens").textContent,
          benchTokensPerSecond: byId("benchTokensPerSecond").textContent,
          benchScratch: byId("benchScratch").textContent,
          benchLoadMsValue: parseBenchmarkNumber("benchLoadMs"),
          benchPromptTokensValue: parseBenchmarkNumber("benchPromptTokens"),
          benchGeneratedTokensValue: parseBenchmarkNumber("benchGeneratedTokens"),
          benchScratchValue: parseBenchmarkNumber("benchScratch"),
          selectedModel: byId("modelSelect").value,
          temperatureValue: byId("temperature").value,
          topKValue: byId("topK").value,
          topPValue: byId("topP").value,
          seedValue: byId("seed").value,
          generateDisabled: byId("generateButton").disabled,
          stepTokenDisabled: byId("stepTokenButton").disabled,
          resetDisabled: byId("resetButton").disabled,
          clearChatDisabled: byId("clearChatButton").disabled,
          modelSelectDisabled: byId("modelSelect").disabled,
          panelCount: document.querySelectorAll(".conversation-panel,.composer-panel,.model-drawer,.diagnostics-rail,.advanced-options-panel,.generation-card,.status-accordion,.run-history,.drawer-section,.tab-panel").length,
          badRects: badRects(),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          gridDisplay: window.getComputedStyle(document.querySelector(".grid")).display
        };
      };
      const waitReady = async () => {
        for (let index = 0; index < 600; index += 1) {
          if (byId("generateButton") && !byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
            return;
          }
          await sleep(100);
        }
      };
      await waitReady();
      byId("advancedModeButton").click();
      await sleep(50);
      byId("temperature").value = "0";
      byId("topK").value = "1";
      byId("topP").value = "1";
      byId("seed").value = "1";
      const before = collect("ready");
      byId("response").textContent = "";
      byId("maxTokens").value = "1";
      byId("prompt").value = "hi";
      byId("generateButton").click();
      for (let index = 0; index < 600; index += 1) {
        if (byId("response").textContent.trim().length > 0 || byId("errorState").textContent !== "none") {
          break;
        }
        await sleep(100);
      }
      const after = collect("generated");
      byId("clearChatButton").click();
      await sleep(50);
      const cleared = collect("cleared");
      return JSON.stringify({ before, after, cleared });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 180000
  });
  return parseEvaluateValue(result);
}

async function removeProfile(profile) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      fs.rmSync(profile, { force: true, recursive: true });
      return;
    } catch (error) {
      if (attempt === 99) {
        throw error;
      }
      await sleep(100);
    }
  }
}

function waitForExit(process) {
  if (process.exitCode !== null || process.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    process.once("exit", resolve);
    setTimeout(resolve, 10000);
  });
}

function killProcessTree(process) {
  if (process.pid) {
    try {
      childProcess.execFileSync("taskkill.exe", ["/PID", String(process.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      return;
    } catch (_error) {
      process.kill();
      return;
    }
  }
  process.kill();
}

function killProfileProcesses(profile) {
  if (process.platform !== "win32") {
    return;
  }
  const marker = path.basename(profile).replace(/'/g, "''");
  const command = `$marker = '${marker}'; Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'chrome.exe' -or $_.Name -eq 'msedge.exe') -and $_.CommandLine -like \"*$marker*\" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  try {
    childProcess.execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
      stdio: "ignore",
      windowsHide: true
    });
  } catch (_error) {
    // Best-effort cleanup for detached Chrome children.
  }
}

function assertSmoke(result, modelKey, networkRequests) {
  const failures = [];
  const quantization = expectedQuantization[modelKey];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.response !== "e") {
    failures.push(`response was ${JSON.stringify(result.response)}`);
  }
  if (result.stepTokenDisabled) {
    failures.push("step-token control stayed disabled after generation");
  }
  if (!Array.isArray(result.conversationItems) || result.conversationItems.length !== 2) {
    failures.push(`conversation item count was ${result.conversationItems ? result.conversationItems.length : "missing"}`);
  } else {
    if (result.conversationItems[0].role !== "User" || result.conversationItems[0].text !== "hi") {
      failures.push(`conversation user item was ${JSON.stringify(result.conversationItems[0])}`);
    }
    if (result.conversationItems[1].role !== "TinyRustLM" || result.conversationItems[1].text !== "e" || result.conversationItems[1].isError) {
      failures.push(`conversation assistant item was ${JSON.stringify(result.conversationItems[1])}`);
    }
  }
  if (!result.diagnostics.includes("argmax=101")) {
    failures.push("diagnostics did not include argmax=101");
  }
  if (quantization && !result.diagnostics.includes(`"active_quantization_mode": "${quantization}"`)) {
    failures.push(`diagnostics did not report ${quantization} mode`);
  }
  if (networkRequests && !networkIncludesPath(networkRequests, "/runtime/tinyrustlm.wasm.manifest")) {
    failures.push("runtime WASM manifest route was not requested");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Names the expected source shape for converted-trained registry smoke routes.
function expectedConvertedTrainedSourceShape() {
  return convertedTrainedBpeRegistryFileSmokeMode ? "tiny-fixture-bpe" : "tiny-fixture";
}

// Checks the safetensors review row without fixing real file-backed roots to fixture checksums.
function isExpectedConvertedTrainedSourceReview(value) {
  if (convertedTrainedRegistrySmokeMode) {
    return value === [
      "validated-before-extraction",
      "extract-raw-f32-tensors",
      convertedTrainedSourceReviewChecksum(),
      convertedTrainedSourceReviewModelId(),
      convertedTrainedSourceReviewSha()
    ].join(" / ");
  }
  return /^validated-before-extraction \/ extract-raw-f32-tensors \/ 0x[0-9a-f]{16} \/ .+ \/ (?:sha256:[0-9a-f]{64}|sha1:[0-9a-f]{40}|[0-9a-f]{40}|[0-9a-f]{64})$/i.test(String(value || ""));
}

// Checks browser-visible routes copied from the checksum-verified source-review sidecar.
function isExpectedConvertedTrainedSourceReviewRoutes(value) {
  if (convertedTrainedRegistrySmokeMode) {
    return value === [
      "license=docs/report-intake/2026-06-30/Safetensors Browser Runtime Guide.md",
      "prompt=fixtures/browser-smoke-reference-prompt.txt",
      "reference=0x00000000000000e1",
      `eval=${convertedTrainedEvalCasesRoute()}`
    ].join(" / ");
  }
  return /^license=.+ \/ prompt=.+ \/ reference=0x[0-9a-f]{16} \/ eval=.+$/i.test(String(value || ""));
}

// Checks browser-visible checksum-bound local artifact summaries from the source review.
function isExpectedConvertedTrainedSourceReviewArtifacts(value) {
  if (convertedTrainedRegistrySmokeMode) {
    return value === [
      "config=local-json-bound@0x00000000000000c1",
      "tokenizer=local-json-bound@0x00000000000000c2",
      "license=local-text-bound@0x00000000000000d1",
      "prompt=local-text-bound@0x00000000000000d2",
      "eval=local-text-bound@0x00000000000000d3"
    ].join(" / ");
  }
  const text = String(value || "");
  return text === "unavailable" || /(?:config|tokenizer|license|prompt|eval)=(?:not-local|[a-z0-9._-]+@0x[0-9a-f]{16})/i.test(text);
}

// Checks the imported tokenizer rows fingerprint rendered from the fetched review sidecar.
function isExpectedConvertedTrainedSourceTokenizerImport(value) {
  if (convertedTrainedRegistrySmokeMode) {
    return value === "not-imported / tokens=0 / merges=0 / 0x0000000000000000";
  }
  const text = String(value || "");
  return text === "unavailable" || /^(?:not-imported \/ tokens=0 \/ merges=0 \/ 0x0000000000000000|byte-fallback-bpe-compatible \/ tokens=[1-9][0-9]* \/ merges=[1-9][0-9]* \/ 0x[0-9a-f]{16})$/i.test(text);
}

// Checks the validate-source sidecar summary rendered from browser-fetched evidence.
function isExpectedConvertedTrainedSourceValidation(value) {
  if (convertedTrainedRegistrySmokeMode) {
    return value === [
      "pass",
      "convert-raw-f32-source-to-slm",
      textChecksumHex(convertedTrainedSourceValidationText())
    ].join(" / ");
  }
  const text = String(value || "");
  return text === "unavailable" || /^pass \/ convert-raw-f32-source-to-slm \/ 0x[0-9a-f]{16}$/i.test(text);
}

// Checks the selector admission sidecar summary rendered after evidence verification.
function isExpectedConvertedTrainedAdmission(value) {
  if (convertedTrainedRegistrySmokeMode) {
    return value === [
      "admitted-for-browser-selector",
      "browser-selector-loads-only-admission-record-artifacts",
      textChecksumHex(convertedTrainedAdmissionText())
    ].join(" / ");
  }
  const text = String(value || "");
  return /^admitted-for-browser-selector \/ browser-selector-loads-only-admission-record-artifacts \/ 0x[0-9a-f]{16}$/i.test(text);
}

function assertMultiParentRegistrySmoke(result, modelKey, networkRequests) {
  assertSmoke(result, modelKey, networkRequests);
  const failures = [];
  if (!Array.isArray(result.modelOptions) || result.modelOptions.length !== 1) {
    failures.push(`model options were ${JSON.stringify(result.modelOptions)}`);
  } else {
    const option = result.modelOptions[0];
    if (option.value !== modelKey) {
      failures.push(`registry option value was ${option.value}`);
    }
    const expectedLabel = expectedLabelForModel(modelKey);
    if (option.label !== expectedLabel) {
      failures.push(`registry option label was ${option.label}`);
    }
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
    failures.push("selector registry route was not requested");
  }
  const expectedRoute = expectedRouteForModel(modelKey) || "/models/tinylm16-q8.slm";
  if (!networkRequests.some((requestUrl) => requestUrl.includes(expectedRoute))) {
    failures.push("registry model route was not requested");
  }
  const expectedOperatorKind = expectedRegistryOperatorKindForModel(modelKey);
  if (
    expectedOperatorKind &&
    !isOperatorReceiptSummary(result.provenanceOperator, expectedOperatorKind)
  ) {
    failures.push(`provenance operator was ${result.provenanceOperator}`);
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms a registry-served converted-trained artifact keeps its browser-visible claim boundary.
function assertConvertedTrainedRegistrySmoke(result, modelKey, networkRequests) {
  assertSmoke(result, modelKey, networkRequests);
  const failures = [];
  const modelOptionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  if (!modelOptionValues.includes(modelKey)) {
    failures.push(`registry options were ${JSON.stringify(result.modelOptions)}`);
  }
  const matchingOption = Array.isArray(result.modelOptions)
    ? result.modelOptions.find((option) => option.value === modelKey)
    : undefined;
  if (matchingOption && matchingOption.label !== expectedLabelForModel(modelKey)) {
    failures.push(`registry option label was ${matchingOption.label}`);
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
    failures.push("selector registry route was not requested");
  }
  const expectedRoute = expectedRouteForModel(modelKey) || "/models/converted-trained-q8.slm";
  if (!networkIncludesPath(networkRequests, expectedRoute)) {
    failures.push("converted-trained model route was not requested");
  }
  if (result.provenanceSourceKind !== "converted-trained") {
    failures.push(`provenance source kind was ${result.provenanceSourceKind}`);
  }
  if (!isExpectedConvertedTrainedSourceIdentity(result.provenanceSourceSnapshot, result.provenanceSourceId)) {
    failures.push(`provenance source snapshot was ${result.provenanceSourceSnapshot}; provenance source id was ${result.provenanceSourceId}`);
  }
  const expectedSourceShape = expectedConvertedTrainedSourceShape();
  if (result.provenanceSourceShape !== expectedSourceShape) {
    failures.push(`provenance source shape was ${result.provenanceSourceShape}`);
  }
  if (!isExpectedConvertedTrainedSourceReview(result.provenanceSourceReview)) {
    failures.push(`provenance source review was ${result.provenanceSourceReview}`);
  }
  if (!isExpectedConvertedTrainedSourceReviewRoutes(result.provenanceSourceReviewRoutes)) {
    failures.push(`provenance source review routes were ${result.provenanceSourceReviewRoutes}`);
  }
  if (!isExpectedConvertedTrainedSourceReviewArtifacts(result.provenanceSourceReviewArtifacts)) {
    failures.push(`provenance source review artifacts were ${result.provenanceSourceReviewArtifacts}`);
  }
  if (!isExpectedConvertedTrainedSourceTokenizerImport(result.provenanceSourceTokenizerImport)) {
    failures.push(`provenance source tokenizer import was ${result.provenanceSourceTokenizerImport}`);
  }
  if (!isExpectedConvertedTrainedSourceValidation(result.provenanceSourceValidation)) {
    failures.push(`provenance source validation was ${result.provenanceSourceValidation}`);
  }
  if (!isExpectedConvertedTrainedAdmission(result.provenanceAdmission)) {
    failures.push(`provenance admission was ${result.provenanceAdmission}`);
  }
  if (result.provenanceQualityClaim !== "runtime-compatible-not-quality-verified") {
    failures.push(`provenance quality claim was ${result.provenanceQualityClaim}`);
  }
  if (result.provenanceTrainedClaim !== "pending-evaluation") {
    failures.push(`provenance trained claim was ${result.provenanceTrainedClaim}`);
  }
  if (result.provenanceNextGate !== "task-eval-and-safety-review-before-assistant-quality-claim") {
    failures.push(`provenance next gate was ${result.provenanceNextGate}`);
  }
  if (!networkIncludesPath(networkRequests, `${expectedRoute}.manifest`)) {
    failures.push("converted-trained manifest route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedSourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  if (!networkIncludesPath(networkRequests, expectedSourceReviewRoute)) {
    failures.push("converted-trained source review route was not requested");
  }
  const expectedSourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  if (!networkIncludesPath(networkRequests, expectedSourceValidationRoute)) {
    failures.push("converted-trained source validation route was not requested");
  }
  const expectedRuntimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  if (!networkIncludesPath(networkRequests, expectedRuntimeEvidenceRoute)) {
    failures.push("converted-trained runtime smoke route was not requested");
  }
  const expectedEvalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  if (!networkIncludesPath(networkRequests, expectedEvalEvidenceRoute)) {
    failures.push("converted-trained eval evidence route was not requested");
  }
  const expectedAdmissionRoute = `/evidence/${modelKey}/converted-trained.admission`;
  if (!networkIncludesPath(networkRequests, expectedAdmissionRoute)) {
    failures.push("converted-trained admission evidence route was not requested");
  }
  const sourceManifestIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceManifestRoute));
  const sourceReviewIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceReviewRoute));
  const sourceValidationIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceValidationRoute));
  const runtimeEvidenceIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedRuntimeEvidenceRoute));
  const evalEvidenceIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedEvalEvidenceRoute));
  const admissionEvidenceIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedAdmissionRoute));
  const modelIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedRoute));
  if (sourceManifestIndex < 0 || modelIndex < 0 || sourceManifestIndex > modelIndex) {
    failures.push("converted-trained source manifest was not requested before model bytes");
  }
  if (sourceReviewIndex < 0 || modelIndex < 0 || sourceReviewIndex > modelIndex) {
    failures.push("converted-trained source review was not requested before model bytes");
  }
  if (sourceManifestIndex >= 0 && sourceReviewIndex >= 0 && sourceManifestIndex > sourceReviewIndex) {
    failures.push("converted-trained source review was requested before source manifest");
  }
  if (sourceValidationIndex < 0 || modelIndex < 0 || sourceValidationIndex > modelIndex) {
    failures.push("converted-trained source validation was not requested before model bytes");
  }
  if (sourceReviewIndex >= 0 && sourceValidationIndex >= 0 && sourceReviewIndex > sourceValidationIndex) {
    failures.push("converted-trained source validation was requested before source review");
  }
  if (runtimeEvidenceIndex < 0 || modelIndex < 0 || runtimeEvidenceIndex > modelIndex) {
    failures.push("converted-trained runtime smoke was not requested before model bytes");
  }
  if (sourceValidationIndex >= 0 && runtimeEvidenceIndex >= 0 && sourceValidationIndex > runtimeEvidenceIndex) {
    failures.push("converted-trained runtime smoke was requested before source validation");
  }
  if (evalEvidenceIndex < 0 || modelIndex < 0 || evalEvidenceIndex > modelIndex) {
    failures.push("converted-trained eval evidence was not requested before model bytes");
  }
  if (runtimeEvidenceIndex >= 0 && evalEvidenceIndex >= 0 && runtimeEvidenceIndex > evalEvidenceIndex) {
    failures.push("converted-trained eval evidence was requested before runtime smoke");
  }
  if (admissionEvidenceIndex < 0 || modelIndex < 0 || admissionEvidenceIndex > modelIndex) {
    failures.push("converted-trained admission evidence was not requested before model bytes");
  }
  if (evalEvidenceIndex >= 0 && admissionEvidenceIndex >= 0 && evalEvidenceIndex > admissionEvidenceIndex) {
    failures.push("converted-trained admission evidence was requested before eval evidence");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Accepts both intercepted fixture routes and real safetensors-exported browser roots.
function isExpectedConvertedTrainedSourceIdentity(sourceSnapshot, sourceId) {
  if (sourceSnapshot === "trained-source-fixture") {
    return sourceId === "tinyrustlm-local-source-fixture";
  }
  if (sourceSnapshot === "trained-export") {
    return /^safetensors-tensor-directory-0x[0-9a-f]+$/i.test(String(sourceId || ""));
  }
  return false;
}

// Confirms source-manifest drift stops converted-trained loading before model bytes.
function assertConvertedTrainedSourceManifestDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("source manifest checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained source manifest drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained source manifest drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push("converted-trained model route was requested after source manifest drift");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms source identity drift stops converted-trained loading even when the source checksum matches.
function assertConvertedTrainedSourceIdentityDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("source manifest identity field source_id")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained source identity drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained source identity drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedRoute = expectedRouteForModel(modelKey) || "/models/converted-trained-q8.slm";
  if (networkIncludesPath(networkRequests, expectedRoute)) {
    failures.push("converted-trained model route was requested after source identity drift");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms source review drift stops converted-trained loading even when source bytes match.
function assertConvertedTrainedSourceReviewDriftSmoke(
  result,
  modelKey,
  networkRequests,
  expectedError = "source review identity field source_review_checksum",
  expectSourceReviewSidecar = false
) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes(expectedError)) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained source review drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained source review drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedSourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  if (expectSourceReviewSidecar && !networkIncludesPath(networkRequests, expectedSourceReviewRoute)) {
    failures.push("converted-trained source review route was not requested");
  }
  const expectedEvalRoute = `/evidence/${modelKey}/converted-trained.eval`;
  if (expectSourceReviewSidecar && networkIncludesPath(networkRequests, expectedEvalRoute)) {
    failures.push("converted-trained eval route was requested after source review sidecar drift");
  }
  const expectedRoute = expectedRouteForModel(modelKey) || "/models/converted-trained-q8.slm";
  if (networkIncludesPath(networkRequests, expectedRoute)) {
    failures.push("converted-trained model route was requested after source review drift");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms source-validation drift stops converted-trained loading before runtime, eval, or model bytes.
function assertConvertedTrainedSourceValidationDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("source validation field source_validation_status")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained source validation drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained source validation drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedSourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  if (!networkIncludesPath(networkRequests, expectedSourceReviewRoute)) {
    failures.push("converted-trained source review route was not requested");
  }
  const expectedSourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  if (!networkIncludesPath(networkRequests, expectedSourceValidationRoute)) {
    failures.push("converted-trained source validation route was not requested");
  }
  const expectedRuntimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  if (networkIncludesPath(networkRequests, expectedRuntimeEvidenceRoute)) {
    failures.push("converted-trained runtime smoke route was requested after source validation drift");
  }
  const expectedEvalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  if (networkIncludesPath(networkRequests, expectedEvalEvidenceRoute)) {
    failures.push("converted-trained eval evidence route was requested after source validation drift");
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push("converted-trained model route was requested after source validation drift");
  }
  const sourceReviewIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceReviewRoute));
  const sourceValidationIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceValidationRoute));
  if (sourceReviewIndex >= 0 && sourceValidationIndex >= 0 && sourceReviewIndex > sourceValidationIndex) {
    failures.push("converted-trained source validation was requested before source review");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms runtime-smoke drift stops converted-trained loading before eval evidence or model bytes.
function assertConvertedTrainedRuntimeEvidenceDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("runtime smoke evidence checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained runtime evidence drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained runtime evidence drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedSourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  if (!networkIncludesPath(networkRequests, expectedSourceReviewRoute)) {
    failures.push("converted-trained source review route was not requested");
  }
  const expectedSourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  if (!networkIncludesPath(networkRequests, expectedSourceValidationRoute)) {
    failures.push("converted-trained source validation route was not requested");
  }
  const expectedRuntimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  if (!networkIncludesPath(networkRequests, expectedRuntimeEvidenceRoute)) {
    failures.push("converted-trained runtime smoke route was not requested");
  }
  const expectedEvalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  if (networkIncludesPath(networkRequests, expectedEvalEvidenceRoute)) {
    failures.push("converted-trained eval evidence route was requested after runtime smoke drift");
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push("converted-trained model route was requested after runtime smoke drift");
  }
  const sourceReviewIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceReviewRoute));
  const sourceValidationIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedSourceValidationRoute));
  const runtimeEvidenceIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedRuntimeEvidenceRoute));
  if (sourceReviewIndex >= 0 && sourceValidationIndex >= 0 && sourceReviewIndex > sourceValidationIndex) {
    failures.push("converted-trained source validation was requested before source review");
  }
  if (sourceValidationIndex >= 0 && runtimeEvidenceIndex >= 0 && sourceValidationIndex > runtimeEvidenceIndex) {
    failures.push("converted-trained runtime smoke was requested before source validation");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms eval evidence drift stops converted-trained loading before model bytes.
function assertConvertedTrainedEvalEvidenceDriftSmoke(
  result,
  modelKey,
  networkRequests,
  expectedError = "eval evidence checksum mismatch"
) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes(expectedError)) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained eval evidence drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained eval evidence drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedSourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  if (!networkIncludesPath(networkRequests, expectedSourceReviewRoute)) {
    failures.push("converted-trained source review route was not requested");
  }
  const expectedSourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  if (!networkIncludesPath(networkRequests, expectedSourceValidationRoute)) {
    failures.push("converted-trained source validation route was not requested");
  }
  const expectedEvalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  if (!networkIncludesPath(networkRequests, expectedEvalEvidenceRoute)) {
    failures.push("converted-trained eval evidence route was not requested");
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push("converted-trained model route was requested after eval evidence drift");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms admission sidecar drift stops converted-trained loading after eval and before model bytes.
function assertConvertedTrainedAdmissionDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("admission evidence field admission_status")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after converted-trained admission drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after converted-trained admission drift");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedSourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  if (!networkIncludesPath(networkRequests, expectedSourceManifestRoute)) {
    failures.push("converted-trained source manifest route was not requested");
  }
  const expectedSourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  if (!networkIncludesPath(networkRequests, expectedSourceReviewRoute)) {
    failures.push("converted-trained source review route was not requested");
  }
  const expectedSourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  if (!networkIncludesPath(networkRequests, expectedSourceValidationRoute)) {
    failures.push("converted-trained source validation route was not requested");
  }
  const expectedRuntimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  if (!networkIncludesPath(networkRequests, expectedRuntimeEvidenceRoute)) {
    failures.push("converted-trained runtime smoke route was not requested");
  }
  const expectedEvalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  if (!networkIncludesPath(networkRequests, expectedEvalEvidenceRoute)) {
    failures.push("converted-trained eval evidence route was not requested");
  }
  const expectedAdmissionRoute = `/evidence/${modelKey}/converted-trained.admission`;
  if (!networkIncludesPath(networkRequests, expectedAdmissionRoute)) {
    failures.push("converted-trained admission evidence route was not requested");
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push("converted-trained model route was requested after admission drift");
  }
  const evalEvidenceIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedEvalEvidenceRoute));
  const admissionEvidenceIndex = networkRequests.findIndex((requestUrl) => requestUrlPathEquals(requestUrl, expectedAdmissionRoute));
  if (evalEvidenceIndex >= 0 && admissionEvidenceIndex >= 0 && evalEvidenceIndex > admissionEvidenceIndex) {
    failures.push("converted-trained admission evidence was requested before eval evidence");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms selector receipt drift removes generated entries before browser model selection.
function assertSelectorOperatorReceiptDriftSmoke(
  result,
  networkRequests,
  rejectedModelKey = "multi-parent-sign-merge-q8"
) {
  assertSmoke(result, "tinylm16q8", networkRequests);
  const failures = [];
  const modelOptionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  if (modelOptionValues.includes(rejectedModelKey)) {
    failures.push("operator receipt drift registry entry was accepted");
  }
  if (!modelOptionValues.includes("tinylm16q8") || !modelOptionValues.includes("tinylm16q4")) {
    failures.push(`fallback model options were ${JSON.stringify(result.modelOptions)}`);
  }
  if (result.provenanceOperator !== "unavailable") {
    failures.push(`fallback provenance operator was ${result.provenanceOperator}`);
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
    failures.push("selector registry route was not requested");
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/tinylm16-q8.slm"))) {
    failures.push("fallback q8 model route was not requested");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Confirms generated selector drift prevents generated route intake.
function assertGeneratedSelectorOperatorReceiptDriftSmoke(result, modelKey, networkRequests) {
  assertSmoke(result, "tinylm16q8", networkRequests);
  const failures = [];
  const modelOptionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  const generatedModels = isGeneratedMultiParentModel(modelKey)
    ? combinedSelectorModelsFor(modelKey)
    : [
        "multi-parent-sign-merge-q4",
        "multi-parent-sign-merge-q8",
        "multi-parent-sign-merge-f32",
        "multi-parent-soup-q4",
        "multi-parent-soup-q8",
        "multi-parent-soup-f32"
    ];
  for (const generatedModel of generatedModels) {
    if (modelOptionValues.includes(generatedModel)) {
      failures.push(`generated selector drift entry was accepted: ${generatedModel}`);
    }
    const generatedRoutes = [
      expectedModelRoutes[generatedModel],
      expectedModulePlanRoutes[generatedModel],
      expectedAssemblyReceiptRoutes[generatedModel],
      expectedAdapterFamilyReceiptRoutes[generatedModel],
      ...(expectedAdapterStackRoutes[generatedModel] || [])
    ].filter(Boolean);
    for (const generatedRoute of generatedRoutes) {
      if (networkIncludesPath(networkRequests, generatedRoute)) {
        failures.push(`generated route was requested after selector drift: ${generatedRoute}`);
      }
    }
  }
  if (!modelOptionValues.includes("tinylm16q8") || !modelOptionValues.includes("tinylm16q4")) {
    failures.push(`fallback model options were ${JSON.stringify(result.modelOptions)}`);
  }
  if (result.provenanceOperator !== "unavailable") {
    failures.push(`fallback provenance operator was ${result.provenanceOperator}`);
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  if (!networkIncludesPath(networkRequests, "/models/tinylm16-q8.slm")) {
    failures.push("fallback q8 model route was not requested");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertSelectorBudgetSmoke(result, networkRequests) {
  assertSmoke(result, "tinylm16q8", networkRequests);
  const failures = [];
  const modelOptionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  if (modelOptionValues.includes("oversized-browser-parent")) {
    failures.push("oversized registry entry was accepted");
  }
  if (!modelOptionValues.includes("tinylm16q8") || !modelOptionValues.includes("tinylm16q4")) {
    failures.push(`fallback model options were ${JSON.stringify(result.modelOptions)}`);
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
    failures.push("selector registry route was not requested");
  }
  if (networkRequests.some((requestUrl) => requestUrl.includes("/models/oversized-browser-parent.slm"))) {
    failures.push("oversized model route was requested");
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/tinylm16-q8.slm"))) {
    failures.push("fallback q8 model route was not requested");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertSidecarBudgetContractSmoke(result, networkRequests) {
  assertSmoke(result, "tinylm16q8", networkRequests);
  const failures = [];
  const modelOptionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  if (modelOptionValues.includes("sidecar-budget-contract-parent")) {
    failures.push("sidecar-budget registry entry was accepted");
  }
  if (!modelOptionValues.includes("tinylm16q8") || !modelOptionValues.includes("tinylm16q4")) {
    failures.push(`fallback model options were ${JSON.stringify(result.modelOptions)}`);
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
    failures.push("selector registry route was not requested");
  }
  if (networkRequests.some((requestUrl) => requestUrl.includes("/models/sidecar-budget-contract-parent.slm"))) {
    failures.push("sidecar-budget model route was requested");
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/tinylm16-q8.slm"))) {
    failures.push("fallback q8 model route was not requested");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertRuntimeManifestDriftSmoke(result, networkRequests) {
  const failures = [];
  if (result.runtimeStatus !== "Boot failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.wasmState !== "waiting") {
    failures.push(`wasm state was ${result.wasmState}`);
  }
  if (result.modelState !== "boot error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("WASM runtime checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.generateDisabled !== true || result.resetDisabled !== true) {
    failures.push("runtime controls were enabled after manifest drift");
  }
  if (!networkIncludesPath(networkRequests, "/runtime/tinyrustlm.wasm.manifest")) {
    failures.push("runtime WASM manifest route was not requested");
  }
  if (!networkIncludesPath(networkRequests, "/runtime/tinyrustlm.wasm")) {
    failures.push("runtime WASM route was not requested");
  }
  if (networkRequests.some((requestUrl) => requestUrl.includes("/models/tinylm16-q8.slm"))) {
    failures.push("model route was requested after runtime manifest drift");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanDriftSmoke(result, modelKey, networkRequests, driftLabel, expectedErrorText) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes(expectedErrorText)) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push(`runtime controls were enabled after ${driftLabel}`);
  }
  if (result.modelSelectDisabled) {
    failures.push(`model selector was disabled after ${driftLabel}`);
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  const modulePlanRequestIndex = expectedModulePlanRoute
    ? networkRequests.findIndex((requestUrl) => requestUrl.includes(expectedModulePlanRoute))
    : -1;
  const modelRequestIndex = expectedModelRoute
    ? networkRequests.findIndex((requestUrl) => requestUrl.includes(expectedModelRoute))
    : -1;
  if (expectedModelRoute && modelRequestIndex > modulePlanRequestIndex) {
    failures.push(`generated model route was requested after ${driftLabel}`);
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanResourceDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan resource drift",
    "Module plan module plan adapter byte budget mismatch"
  );
}

function assertModulePlanRuntimeScratchDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan runtime scratch drift",
    "Module plan module plan runtime scratch byte budget mismatch"
  );
}

function assertModulePlanOutputLimitDriftSmoke(result, modelKey, networkRequests) {
  // Checks that output-limit drift stops at module-plan validation.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan output limit drift",
    "Module plan module plan output byte limit mismatch"
  );
}

function assertModulePlanPromptLimitDriftSmoke(result, modelKey, networkRequests) {
  // Checks that prompt-limit drift stops at module-plan validation.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan prompt limit drift",
    "Module plan module plan prompt byte limit mismatch"
  );
}

function assertModulePlanFetchCountDriftSmoke(result, modelKey, networkRequests) {
  // Checks that fetch-count drift stops before generated route assembly begins.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan fetch count drift",
    "Module plan module plan fetch count limit mismatch"
  );
}

function assertModulePlanPlannedFetchCountDriftSmoke(result, modelKey, networkRequests) {
  // Checks that planned-fetch drift stops before generated route assembly begins.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan planned fetch count drift",
    "Module plan module plan planned fetch count mismatch"
  );
}

function assertModulePlanRouteSetVersionDriftSmoke(result, modelKey, networkRequests) {
  // Checks that route-set version drift stops before generated route assembly begins.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan route set version drift",
    "Module plan route set version mismatch"
  );
}

function assertModulePlanRouteSetAlgorithmDriftSmoke(result, modelKey, networkRequests) {
  // Checks that route-set algorithm drift stops before generated route assembly begins.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan route set checksum algorithm drift",
    "Module plan route set checksum algorithm mismatch"
  );
}

function assertModulePlanRouteSetDriftSmoke(result, modelKey, networkRequests) {
  // Checks that route-set drift stops before generated route assembly begins.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan route set drift",
    "Module plan route set checksum mismatch"
  );
}

function assertModulePlanOperatorReceiptDriftSmoke(result, modelKey, networkRequests) {
  // Checks that module-plan/operator-receipt checksum drift stops before model fetches.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan operator receipt drift",
    "module plan operator receipt checksum mismatch"
  );
}

function assertModulePlanKvCacheDriftSmoke(result, modelKey, networkRequests) {
  // Verifies KV drift stops at module-plan validation before generated artifact fetches.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan KV cache drift",
    "Module plan KV cache page count mismatch"
  );
}

function assertModulePlanAdapterStackBudgetDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan adapter stack budget drift",
    "Module plan module plan adapter stack byte budget mismatch"
  );
}

function assertModulePlanTotalBudgetDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan total budget drift",
    "Module plan module plan total byte budget mismatch"
  );
}

function assertModulePlanTotalLimitDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan total limit drift",
    "Module plan module plan total byte budget limit mismatch"
  );
}

// Asserts receipt cardinality drift stops before generated model or adapter routes are fetched.
function assertModulePlanCountDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan count drift",
    "Module plan module count mismatch"
  );
  const failures = [];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family route was requested after module plan count drift: ${adapterFamilyRoute}`);
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan count drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan count drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanWasmMemoryDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan WASM memory drift",
    "Module plan WASM memory initial pages mismatch"
  );
}

function assertModulePlanWasmExportSetDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan WASM export-set drift",
    "Module plan WASM export set mismatch"
  );
}

function assertModulePlanWasmTransferDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan WASM transfer strategy drift",
    "Module plan WASM transfer strategy mismatch"
  );
}

function assertModulePlanModelReleaseDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan model release strategy drift",
    "Module plan model release strategy mismatch"
  );
}

function assertModulePlanRuntimeResetDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan runtime reset strategy drift",
    "Module plan runtime reset strategy mismatch"
  );
}

function assertModulePlanAdapterValidationDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan adapter validation strategy drift",
    "Module plan adapter validation strategy mismatch"
  );
}

function assertModulePlanAdapterValidationCountDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan adapter validation count drift",
    "Module plan adapter validation count mismatch"
  );
}

function assertModulePlanAdapterApplyCountDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan adapter apply count drift",
    "Module plan adapter apply count mismatch"
  );
}

function assertModulePlanWasmHeapDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan WASM heap drift",
    "Module plan WASM heap min bytes mismatch"
  );
}

function assertModulePlanContextTokenDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan context token drift",
    "Module plan context token limit mismatch"
  );
}

function assertModulePlanSamplerCapDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan sampler cap drift",
    "Module plan sampler candidate cap mismatch"
  );
}

function assertModulePlanTokenizerDriftSmoke(result, modelKey, networkRequests) {
  // Verifies tokenizer drift stops at module-plan validation before generated model fetches.
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan tokenizer drift",
    "Module plan tokenizer checksum mismatch"
  );
}

function assertModulePlanProfileDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan profile drift",
    "Module plan field module_plan_profile was"
  );
  const failures = [];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family route was requested after module plan profile drift: ${adapterFamilyRoute}`);
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan profile drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan profile drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanExecutionProfileDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan execution profile drift",
    "Module plan field module_plan_execution_profile was"
  );
  const failures = [];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family route was requested after module plan execution profile drift: ${adapterFamilyRoute}`);
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan execution profile drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan execution profile drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanFetchPolicyDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan fetch policy drift",
    "Module plan field module_plan_fetch_policy was"
  );
  const failures = [];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family route was requested after module plan fetch policy drift: ${adapterFamilyRoute}`);
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan fetch policy drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan fetch policy drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanOriginPolicyDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan origin policy drift",
    "Module plan field module_plan_origin_policy was"
  );
  const failures = [];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family route was requested after module plan origin policy drift: ${adapterFamilyRoute}`);
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan origin policy drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan origin policy drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanGraphDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan graph drift",
    "Module plan field module.0.path was"
  );
}

function assertModulePlanStackDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan stack drift",
    "Module plan field module.4.adapter_path was"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan stack drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan stack drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanRoleDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan role drift",
    "Module plan field module.4.role was"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan role drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan role drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanSlotDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan slot drift",
    "Module plan field module.4.assembly_slot was"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan slot drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan slot drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanPhaseDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan phase drift",
    "Module plan field module.4.phase was"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan phase drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan phase drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanByteDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan byte drift",
    "Module plan field module.0.byte_count was"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan byte drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan byte drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanChecksumDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan checksum drift",
    "module plan adapter module checksum mismatch"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan checksum drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan checksum drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertStepTokenSmoke(result, modelKey, networkRequests) {
  const failures = [];
  const quantization = expectedQuantization[modelKey];
  if (!quantization) {
    failures.push(`unknown expected model ${modelKey}`);
  }
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.readyStepDisabled) {
    failures.push("step-token control was enabled before generation context existed");
  }
  if (result.afterGenerateStepDisabled) {
    failures.push("step-token control stayed disabled after the first generation");
  }
  if (result.stepTokenDisabled) {
    failures.push("step-token control was disabled after stepping");
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("primary controls were unexpectedly disabled after stepping");
  }
  if (result.response !== "ee") {
    failures.push(`response was ${JSON.stringify(result.response)}`);
  }
  if (!Array.isArray(result.conversationItems) || result.conversationItems.length !== 2) {
    failures.push(`conversation item count was ${result.conversationItems ? result.conversationItems.length : "missing"}`);
  } else {
    if (result.conversationItems[0].role !== "User" || result.conversationItems[0].text !== "hi") {
      failures.push(`conversation user item was ${JSON.stringify(result.conversationItems[0])}`);
    }
    if (result.conversationItems[1].role !== "TinyRustLM" || result.conversationItems[1].text !== "ee" || result.conversationItems[1].isError) {
      failures.push(`conversation assistant item was ${JSON.stringify(result.conversationItems[1])}`);
    }
  }
  if (!String(result.console).includes("generate(max_new_tokens=1, temperature=0, top_k=1, top_p=1, seed=1) -> 0")) {
    failures.push("console did not include the initial generate call");
  }
  if (!String(result.console).includes("generate_next_token(temperature=0, top_k=1, top_p=1, seed=1) -> 0")) {
    failures.push("console did not include the step-token call");
  }
  if (!result.diagnostics || result.diagnostics.last_error !== "ok") {
    failures.push("diagnostics last_error was not ok");
  }
  if (result.diagnostics && result.diagnostics.generated_token_count !== 2) {
    failures.push(`generated token count was ${result.diagnostics.generated_token_count}`);
  }
  if (result.diagnostics && result.diagnostics.prompt_token_count !== 3) {
    failures.push(`prompt token count was ${result.diagnostics.prompt_token_count}`);
  }
  if (result.diagnostics && result.diagnostics.kv_cache_length !== 5) {
    failures.push(`kv cache length was ${result.diagnostics.kv_cache_length}`);
  }
  if (result.diagnostics && result.diagnostics.selected_next_token !== 101) {
    failures.push(`selected token was ${result.diagnostics.selected_next_token}`);
  }
  if (quantization && (!result.diagnostics || result.diagnostics.active_quantization_mode !== quantization)) {
    failures.push(`diagnostics did not report ${quantization} mode`);
  }
  if (result.benchPromptTokens !== "3 tokens") {
    failures.push(`benchmark prompt tokens were ${result.benchPromptTokens}`);
  }
  if (result.benchGeneratedTokens !== "2 tokens") {
    failures.push(`benchmark generated tokens were ${result.benchGeneratedTokens}`);
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanDependencyDriftSmoke(result, modelKey, networkRequests) {
  assertModulePlanDriftSmoke(
    result,
    modelKey,
    networkRequests,
    "module plan dependency drift",
    "Module plan field module.4.depends_on was"
  );
  const failures = [];
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after module plan dependency drift: ${stackRoute}`);
    }
  }
  const manifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of manifestRoutes) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after module plan dependency drift: ${manifestRoute}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAssemblyEvalCaseDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "assembly evidence rejected") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("assembly eval case evidence checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.assemblyState || "").includes("assembly eval case evidence checksum mismatch")) {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.adapterState !== "assembly evidence rejected") {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (!String(result.modulePlanTrace || "").includes("assembly evidence rejected")) {
    failures.push(`module plan trace was ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after assembly drift: ${result.modulePlanTrace}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after assembly eval-case drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after assembly eval-case drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== false) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was requested after eval-case drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was requested after assembly drift: ${adapterFamilyRoute}`);
  }
  for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after assembly drift: ${stackRoute}`);
    }
  }
  for (const manifestRoute of expectedAdapterManifestRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after assembly drift: ${manifestRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAssemblyEvidenceFileDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "assembly evidence rejected") {
    failures.push(`model state was ${result.modelState}`);
  }
  const errorState = String(result.errorState || "");
  if (!errorState.includes("assembly evidence") || !errorState.includes("checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  const assemblyState = String(result.assemblyState || "");
  if (!assemblyState.includes("assembly evidence") || !assemblyState.includes("checksum mismatch")) {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.adapterState !== "assembly evidence rejected") {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (!String(result.modulePlanTrace || "").includes("assembly evidence rejected")) {
    failures.push(`module plan trace was ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after assembly evidence-file drift: ${result.modulePlanTrace}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after assembly evidence-file drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after assembly evidence-file drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== false) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && !networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was not requested: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  const evidenceRoutes = expectedAssemblyEvidenceRoutes[modelKey] || [];
  const driftedEvidenceRoute = evidenceRoutes[0];
  if (!driftedEvidenceRoute || !networkIncludesPath(networkRequests, driftedEvidenceRoute)) {
    failures.push(`drifted assembly evidence route was not requested: ${driftedEvidenceRoute}`);
  }
  for (const evidenceRoute of evidenceRoutes.slice(1)) {
    if (networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`later assembly evidence route was requested after evidence-file drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was requested after assembly evidence-file drift: ${adapterFamilyRoute}`);
  }
  for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after assembly evidence-file drift: ${stackRoute}`);
    }
  }
  for (const manifestRoute of expectedAdapterManifestRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after assembly evidence-file drift: ${manifestRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAdapterFamilyReceiptDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.adapterState || "").includes("adapter family receipt checksum mismatch")) {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "browser-local-assembly-evidence") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (!String(result.modulePlanTrace || "").includes("assembly evidence verified")) {
    failures.push(`module plan trace did not reach assembly verification: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("adapter family verified")) {
    failures.push(`module plan trace reached adapter family verification after receipt drift: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after adapter-family receipt drift: ${result.modulePlanTrace}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("primary controls were disabled after adapter-family receipt drift");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled before generation context");
  }
  if (!result.adapterSelectDisabled || !result.applyDisabled) {
    failures.push("adapter controls were enabled after adapter-family receipt drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== true) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  if (String(result.console || "").includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!String(result.console || "").includes("adapter family receipt checksum mismatch")) {
    failures.push("console did not include adapter-family receipt checksum mismatch");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && !networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was not requested: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was not requested before adapter-family receipt drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (!adapterFamilyRoute || !networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was not requested: ${adapterFamilyRoute}`);
  }
  for (const manifestRoute of expectedAdapterManifestRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after adapter-family receipt drift: ${manifestRoute}`);
    }
  }
  for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after adapter-family receipt drift: ${stackRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAdapterManifestDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.adapterState || "").includes("adapter 1 manifest checksum mismatch")) {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "browser-local-assembly-evidence") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (!String(result.modulePlanTrace || "").includes("assembly evidence verified")) {
    failures.push(`module plan trace did not reach assembly verification: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("adapter family verified")) {
    failures.push(`module plan trace reached adapter family verification after manifest drift: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after adapter manifest drift: ${result.modulePlanTrace}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("primary controls were disabled after adapter manifest drift");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled before generation context");
  }
  if (!result.adapterSelectDisabled || !result.applyDisabled) {
    failures.push("adapter controls were enabled after adapter manifest drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== true) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  if (String(result.console || "").includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!String(result.console || "").includes("adapter 1 manifest checksum mismatch")) {
    failures.push("console did not include adapter manifest checksum mismatch");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && !networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was not requested: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was not requested before adapter manifest drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (!adapterFamilyRoute || !networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was not requested: ${adapterFamilyRoute}`);
  }
  const expectedManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  const selfManifestRoute = expectedManifestRoutes[0];
  const driftedManifestRoute = expectedManifestRoutes[1];
  if (!selfManifestRoute || !networkIncludesPath(networkRequests, selfManifestRoute)) {
    failures.push(`self adapter manifest route was not requested: ${selfManifestRoute}`);
  }
  if (!driftedManifestRoute || !networkIncludesPath(networkRequests, driftedManifestRoute)) {
    failures.push(`drifted adapter manifest route was not requested: ${driftedManifestRoute}`);
  }
  for (const manifestRoute of expectedManifestRoutes.slice(2)) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`later adapter manifest route was requested after adapter manifest drift: ${manifestRoute}`);
    }
  }
  for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after adapter manifest drift: ${stackRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Verifies source-backed ALR1 contract drift fails before adapter stack artifacts are fetched.
function assertSourceBackedAlr1ManifestDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.adapterState || "").includes("adapter_source_base_contract")) {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "browser-local-assembly-evidence") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (!String(result.modulePlanTrace || "").includes("assembly evidence verified")) {
    failures.push(`module plan trace did not reach assembly verification: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("adapter family verified")) {
    failures.push(`module plan trace reached adapter family verification after source-backed ALR1 drift: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after source-backed ALR1 drift: ${result.modulePlanTrace}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("primary controls were disabled after source-backed ALR1 drift");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled before generation context");
  }
  if (!result.adapterSelectDisabled || !result.applyDisabled) {
    failures.push("adapter controls were enabled after source-backed ALR1 drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== true) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  const consoleText = String(result.console || "");
  if (consoleText.includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!consoleText.includes("adapter_source_base_contract")) {
    failures.push("console did not include adapter_source_base_contract");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && !networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was not requested: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was not requested before source-backed ALR1 drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (!adapterFamilyRoute || !networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was not requested: ${adapterFamilyRoute}`);
  }
  const expectedManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const manifestRoute of expectedManifestRoutes) {
    if (!networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was not requested before source-backed ALR1 drift: ${manifestRoute}`);
    }
  }
  for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after source-backed ALR1 drift: ${stackRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAdapterArtifactDriftSmoke(result, modelKey, networkRequests) {
  assertAdapterStackArtifactDriftSmoke(result, modelKey, networkRequests, 0, "adapter artifact drift");
}

function assertAdapterStackPrefetchDriftSmoke(result, modelKey, networkRequests) {
  assertAdapterStackArtifactDriftSmoke(result, modelKey, networkRequests, 1, "adapter stack prefetch drift");
}

function assertAdapterStackRustValidateDriftSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Adapter load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("shape mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.adapterState || "").includes("shape mismatch")) {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "browser-local-assembly-evidence") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (!String(result.modulePlanTrace || "").includes("adapter family verified")) {
    failures.push(`module plan trace did not reach adapter-family verification: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("adapter stack applied")) {
    failures.push(`module plan trace reached adapter stack after Rust validation drift: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after Rust validation drift: ${result.modulePlanTrace}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("primary controls were disabled after Rust validation drift");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled before generation context");
  }
  if (result.adapterSelectDisabled || result.applyDisabled) {
    failures.push("adapter controls were disabled after Rust validation drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== true) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  const consoleText = String(result.console || "");
  if (!consoleText.includes("validate_adapter_delta")) {
    failures.push("console did not include validate_adapter_delta");
  }
  if (!consoleText.includes("shape mismatch")) {
    failures.push("console did not include shape mismatch");
  }
  if (consoleText.includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && !networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was not requested: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was not requested before Rust validation drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (!adapterFamilyRoute || !networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was not requested: ${adapterFamilyRoute}`);
  }
  for (const manifestRoute of expectedAdapterManifestRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was not requested before Rust validation drift: ${manifestRoute}`);
    }
  }
  for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was not requested before Rust validation drift: ${stackRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAdapterStackArtifactDriftSmoke(result, modelKey, networkRequests, driftedStackIndex, driftLabel) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Adapter load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("adapter artifact checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.adapterState || "").includes("adapter artifact checksum mismatch")) {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "browser-local-assembly-evidence") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (!String(result.modulePlanTrace || "").includes("adapter family verified")) {
    failures.push(`module plan trace did not reach adapter-family verification: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("adapter stack applied")) {
    failures.push(`module plan trace reached adapter stack after ${driftLabel}: ${result.modulePlanTrace}`);
  }
  if (String(result.modulePlanTrace || "").includes("ready")) {
    failures.push(`module plan trace reached ready after ${driftLabel}: ${result.modulePlanTrace}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push(`primary controls were disabled after ${driftLabel}`);
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled before generation context");
  }
  if (result.adapterSelectDisabled || result.applyDisabled) {
    failures.push(`adapter controls were disabled after ${driftLabel}`);
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== true) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  if (String(result.console || "").includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!String(result.console || "").includes("adapter artifact checksum mismatch")) {
    failures.push("console did not include adapter artifact checksum mismatch");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was not requested: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && !networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was not requested: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (!expectedAssemblyReceiptRoute || !networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was not requested: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was not requested before ${driftLabel}: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (!adapterFamilyRoute || !networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was not requested: ${adapterFamilyRoute}`);
  }
  for (const manifestRoute of expectedAdapterManifestRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was not requested before ${driftLabel}: ${manifestRoute}`);
    }
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  const driftedStackRoute = stackRoutes[driftedStackIndex];
  if (!driftedStackRoute || !networkIncludesPath(networkRequests, driftedStackRoute)) {
    failures.push(`drifted adapter stack route was not requested: ${driftedStackRoute}`);
  }
  for (const stackRoute of stackRoutes.slice(0, driftedStackIndex + 1)) {
    if (!networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was not requested before ${driftLabel}: ${stackRoute}`);
    }
  }
  for (const stackRoute of stackRoutes.slice(driftedStackIndex + 1)) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`later adapter stack route was requested after ${driftLabel}: ${stackRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModulePlanPayloadChecksumDriftSmoke(result, modelKey, networkRequests) {
  // Verifies coherent payload checksum drift remains bound by the module-plan checksum row.
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState || "").includes("module plan adapter module checksum mismatch")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.adapterState !== "model not loaded") {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "model not loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "unavailable") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (String(result.modulePlanTrace || "") !== "module plan adapter module checksum mismatch") {
    failures.push(`module plan trace was ${result.modulePlanTrace}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.stepTokenDisabled) {
    failures.push("runtime controls were enabled after payload checksum drift");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after payload checksum drift");
  }
  if (!result.adapterSelectDisabled || !result.applyDisabled) {
    failures.push("adapter controls were enabled after payload checksum drift");
  }
  if (!result.diagnostics || result.diagnostics.model_loaded !== false) {
    failures.push(`diagnostics model_loaded was ${JSON.stringify(result.diagnostics)}`);
  }
  const consoleText = String(result.console || "");
  if (consoleText.includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!networkIncludesPath(networkRequests, "/models/selector.registry")) {
    failures.push("selector registry route was not requested");
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!expectedModulePlanRoute || !networkIncludesPath(networkRequests, expectedModulePlanRoute)) {
    failures.push(`module plan route was not requested: ${expectedModulePlanRoute}`);
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
    failures.push(`generated model route was requested after payload checksum drift: ${expectedModelRoute}`);
  }
  const expectedManifestRoute = expectedModelRoute ? `${expectedModelRoute}.manifest` : "";
  if (expectedManifestRoute && networkIncludesPath(networkRequests, expectedManifestRoute)) {
    failures.push(`model manifest route was requested after payload checksum drift: ${expectedManifestRoute}`);
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (expectedAssemblyReceiptRoute && networkIncludesPath(networkRequests, expectedAssemblyReceiptRoute)) {
    failures.push(`assembly receipt route was requested after payload checksum drift: ${expectedAssemblyReceiptRoute}`);
  }
  for (const evidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, evidenceRoute)) {
      failures.push(`assembly evidence route was requested after payload checksum drift: ${evidenceRoute}`);
    }
  }
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (adapterFamilyRoute && networkIncludesPath(networkRequests, adapterFamilyRoute)) {
    failures.push(`adapter family receipt route was requested after payload checksum drift: ${adapterFamilyRoute}`);
  }
  for (const manifestRoute of expectedAdapterManifestRoutes[modelKey] || []) {
    if (networkIncludesPath(networkRequests, manifestRoute)) {
      failures.push(`adapter manifest route was requested after payload checksum drift: ${manifestRoute}`);
    }
  }
  const stackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  for (const stackRoute of stackRoutes) {
    if (networkIncludesPath(networkRequests, stackRoute)) {
      failures.push(`adapter stack route was requested after payload checksum drift: ${stackRoute}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertRuntimeAssemblyDiagnostics(diagnostics, expectedApplyCount, label, failures) {
  const source = diagnostics || {};
  if (source.adapter_apply_count !== expectedApplyCount) {
    failures.push(`${label} adapter apply count was ${source.adapter_apply_count}`);
  }
  if (expectedApplyCount === 0) {
    if (source.last_adapter_checksum !== "0x0000000000000000") {
      failures.push(`${label} adapter checksum was ${source.last_adapter_checksum}`);
    }
  } else if (!isNonZeroHex64(source.last_adapter_checksum)) {
    failures.push(`${label} adapter checksum was ${source.last_adapter_checksum}`);
  }
  if (!isNonZeroHex64(source.assembly_state_checksum)) {
    failures.push(`${label} assembly checksum was ${source.assembly_state_checksum}`);
  }
}

function assertModulePlanRuntimeResetBeforeAssembly(result, modelKey, failures) {
  // Keeps generated model loads from carrying prompt state into verified assembly/adapters.
  const consoleText = String(result.consoleBeforeGenerate || result.console || "");
  const resetIndex = consoleText.indexOf(`reset_context(${modelKey}) -> 0`);
  if (resetIndex < 0) {
    failures.push(`module plan runtime reset log was missing for ${modelKey}`);
    return;
  }
  const assemblyMarkers = [
    consoleText.indexOf("validate_adapter_delta"),
    consoleText.indexOf("apply_adapter_delta"),
    consoleText.indexOf("adapter_stack_applied")
  ].filter((index) => index >= 0);
  if (assemblyMarkers.length > 0 && resetIndex > Math.min(...assemblyMarkers)) {
    failures.push(`module plan runtime reset happened after assembly work for ${modelKey}`);
  }
}

function assertAdapterSidecarSmoke(result, modelKey, networkRequests, expectAutoAssembly, options = {}) {
  const failures = [];
  const checkExactModulePlanSummaries = options.checkExactModulePlanSummaries !== false;
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  const expectedLabels = expectedAdapterLabels[modelKey] || ["Tiny Fixture f32 self ADP1"];
  if (!Array.isArray(result.adapterOptions) || result.adapterOptions.length !== expectedLabels.length) {
    failures.push(`adapter options were ${JSON.stringify(result.adapterOptions)}`);
  } else {
    for (let index = 0; index < expectedLabels.length; index += 1) {
      if (result.adapterOptions[index].label !== expectedLabels[index]) {
        failures.push(`adapter option ${index} label was ${result.adapterOptions[index].label}`);
      }
    }
  }
  const expectedApplyIndex = expectedAdapterApplyIndexes[modelKey] || 0;
  if (result.selectedAdapterBeforeApply !== String(expectedApplyIndex)) {
    failures.push(`selected adapter index was ${result.selectedAdapterBeforeApply}`);
  }
  const modelOptionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  const combinedModelFamily = combinedSelectorModelsFor(modelKey);
  const hasCombinedGeneratedOptions = combinedModelFamily.every((option) => modelOptionValues.includes(option));
  if (hasCombinedGeneratedOptions && result.initialSelectedModel !== combinedModelFamily[0]) {
    failures.push(`combined selector default was ${result.initialSelectedModel}`);
  }
  if (result.adapterSelectDisabledBefore || result.applyDisabledBefore) {
    failures.push("adapter controls were disabled before apply");
  }
  if (result.generateDisabledAfterApply || result.applyDisabledAfterApply) {
    failures.push("primary adapter controls were disabled after apply");
  }
  if (result.adapterState !== "applied") {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  const expectedMode = expectedQuantization[modelKey] || "f32";
  if (expectAutoAssembly) {
    const consoleBeforeGenerate = String(result.consoleBeforeGenerate || "");
    const validateCalls = consoleBeforeGenerate.match(/validate_adapter_delta/g) || [];
    const applyCalls = String(result.consoleBeforeGenerate || "").match(/apply_adapter_delta/g) || [];
    const expectedStackRoutes = expectedAdapterStackRoutes[modelKey] || [];
    if (validateCalls.length < Math.max(1, expectedStackRoutes.length)) {
      failures.push("pre-generation console did not include validate_adapter_delta");
    }
    const observedValidateCount = Number.isInteger(result.validateCallsSincePreviousStep)
      ? result.validateCallsSincePreviousStep
      : validateCalls.length;
    if (expectedStackRoutes.length > 1 && observedValidateCount !== expectedModulePlanAdapterValidationCountValue) {
      failures.push(`pre-generation validate count was ${observedValidateCount}`);
    }
    if (applyCalls.length < Math.max(1, expectedStackRoutes.length)) {
      failures.push("pre-generation console did not include apply_adapter_delta");
    }
    const lastApply = consoleBeforeGenerate.lastIndexOf("apply_adapter_delta");
    const lastValidate = consoleBeforeGenerate.lastIndexOf("validate_adapter_delta");
    if (lastApply < 0 || lastValidate < 0 || lastValidate > lastApply) {
      failures.push("pre-generation adapter validation did not finish before apply");
    }
    if (expectedStackRoutes.length > 1 && !String(result.consoleBeforeGenerate || "").includes(`adapter_stack_applied(${expectedStackRoutes.length})`)) {
      failures.push("pre-generation console did not include adapter stack completion");
    }
    if (!result.autoAppliedBeforeGenerate) {
      failures.push(`auto assembly state before generation was ${result.adapterStateBeforeGenerate}`);
    }
    if (result.response !== "e") {
      failures.push(`response was ${JSON.stringify(result.response)}`);
    }
    if (result.stepDisabledAfterGenerate) {
      failures.push("step-token control was disabled after assembled generation");
    }
    const reset = result.diagnosticsBeforeGenerate || {};
    if (reset.last_error !== "ok" || reset.active_quantization_mode !== expectedMode) {
      failures.push(`auto-assembly diagnostics were ${JSON.stringify(reset)}`);
    }
    if (reset.generated_token_count !== 0 || reset.kv_cache_length !== 0 || reset.selected_next_token !== 0) {
      failures.push(`auto-assembly reset diagnostics were ${JSON.stringify(reset)}`);
    }
    assertRuntimeAssemblyDiagnostics(
      reset,
      expectedModulePlanAdapterApplyCountValue,
      "auto-assembly reset diagnostics",
      failures
    );
    const generated = result.afterGenerateDiagnostics || {};
    if (generated.generated_token_count !== 1 || generated.kv_cache_length < 1) {
      failures.push(`assembled generation diagnostics were ${JSON.stringify(generated)}`);
    }
    if (generated.active_quantization_mode !== expectedMode) {
      failures.push(`assembled generation quantization mode was ${generated.active_quantization_mode}`);
    }
    assertRuntimeAssemblyDiagnostics(
      generated,
      expectedModulePlanAdapterApplyCountValue,
      "assembled generation diagnostics",
      failures
    );
  } else {
    if (!String(result.console || "").includes("apply_adapter_delta")) {
      failures.push("console did not include apply_adapter_delta");
    }
    if (result.stepDisabledBeforeApply) {
      failures.push("step-token control was disabled before adapter apply");
    }
    if (!result.stepDisabledAfterApply) {
      failures.push("step-token control stayed enabled after adapter apply");
    }
    if (result.response !== "adapter applied") {
      failures.push(`response was ${JSON.stringify(result.response)}`);
    }
    const before = result.beforeApplyDiagnostics || {};
    const after = result.afterApplyDiagnostics || {};
    if (before.generated_token_count !== 1 || before.kv_cache_length < 1) {
      failures.push(`pre-apply diagnostics were ${JSON.stringify(before)}`);
    }
    if (after.last_error !== "ok") {
      failures.push(`post-apply last_error was ${after.last_error}`);
    }
    if (after.active_quantization_mode !== expectedMode) {
      failures.push(`post-apply quantization mode was ${after.active_quantization_mode}`);
    }
    if (after.generated_token_count !== 0 || after.kv_cache_length !== 0 || after.selected_next_token !== 0) {
      failures.push(`post-apply reset diagnostics were ${JSON.stringify(after)}`);
    }
    assertRuntimeAssemblyDiagnostics(after, 1, "post-apply diagnostics", failures);
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  const expectsEvalProof =
    isGeneratedMultiParentModel(modelKey) ||
    result.provenanceGenome !== "unavailable" ||
    result.provenanceSpecies !== "unavailable" ||
    result.provenanceNovelty !== "unavailable" ||
    result.provenancePopulation !== "unavailable" ||
    result.provenanceMateSelection !== "unavailable" ||
    result.provenanceSchedule !== "unavailable" ||
    result.provenancePhenotype !== "unavailable" ||
    result.provenanceArtifact !== "unavailable" ||
    result.provenanceFitness !== "unavailable" ||
    result.provenanceEvalCases !== "unavailable" ||
    result.provenanceEvalChecksum !== "unavailable";
  if (expectsEvalProof) {
    if (!isHex64(result.provenanceGenome)) {
      failures.push(`provenance genome was ${result.provenanceGenome}`);
    }
    if (!isSpeciesFitSummary(result.provenanceSpecies)) {
      failures.push(`provenance species was ${result.provenanceSpecies}`);
    }
    if (!isNoveltySummary(result.provenanceNovelty)) {
      failures.push(`provenance novelty was ${result.provenanceNovelty}`);
    }
    if (!isPopulationSummary(result.provenancePopulation)) {
      failures.push(`provenance population was ${result.provenancePopulation}`);
    }
    if (!isMateSelectionSummary(result.provenanceMateSelection)) {
      failures.push(`provenance mate selection was ${result.provenanceMateSelection}`);
    }
    if (
      isGeneratedMultiParentModel(modelKey) &&
      !String(result.provenanceMateSelection || "").startsWith("parent-pool-bound / 3 parents / ")
    ) {
      failures.push(`provenance mate selection route was ${result.provenanceMateSelection}`);
    }
    const expectedOperatorKind = expectedOperatorKindForModel(modelKey);
    if (
      isGeneratedMultiParentModel(modelKey) &&
      !isOperatorReceiptSummary(result.provenanceOperator, expectedOperatorKind)
    ) {
      failures.push(`provenance operator was ${result.provenanceOperator}`);
    }
    const expectedSchedule = expectedEvolutionScheduleForModel(modelKey);
    if (
      isGeneratedMultiParentModel(modelKey) &&
      !isEvolutionScheduleSummary(result.provenanceSchedule, expectedSchedule)
    ) {
      failures.push(`provenance schedule was ${result.provenanceSchedule}`);
    }
    if (!isPhenotypeEvidenceSummary(result.provenancePhenotype)) {
      failures.push(`provenance phenotype was ${result.provenancePhenotype}`);
    }
    if (!isHeritableArtifactSummary(result.provenanceArtifact)) {
      failures.push(`provenance artifact was ${result.provenanceArtifact}`);
    }
    if (!isFitnessVectorSummary(result.provenanceFitness)) {
      failures.push(`provenance fitness was ${result.provenanceFitness}`);
    }
    if (result.provenanceEvalCases !== "1 passed") {
      failures.push(`provenance eval cases were ${result.provenanceEvalCases}`);
    }
    if (!isHex64(result.provenanceEvalChecksum)) {
      failures.push(`provenance eval checksum was ${result.provenanceEvalChecksum}`);
    }
  } else if (
    result.provenanceGenome !== "unavailable" ||
    result.provenanceSpecies !== "unavailable" ||
    result.provenanceNovelty !== "unavailable" ||
    result.provenancePopulation !== "unavailable" ||
    result.provenanceMateSelection !== "unavailable" ||
    result.provenanceSchedule !== "unavailable" ||
    result.provenancePhenotype !== "unavailable" ||
    result.provenanceArtifact !== "unavailable" ||
    result.provenanceFitness !== "unavailable" ||
    result.provenanceEvalCases !== "unavailable" ||
    result.provenanceEvalChecksum !== "unavailable"
  ) {
    failures.push(
      `manual model eval proof was ${result.provenanceGenome}/${result.provenanceSpecies}/${result.provenanceNovelty}/${result.provenancePopulation}/${result.provenanceMateSelection}/${result.provenanceSchedule}/${result.provenancePhenotype}/${result.provenanceArtifact}/${result.provenanceFitness}/${result.provenanceEvalCases}/${result.provenanceEvalChecksum}`
    );
  }
  const expectedAdapterRoute = expectedAdapterRoutes[modelKey] || "/models/tiny-test-model-self.adp1";
  if (!networkIncludesPath(networkRequests, expectedAdapterRoute)) {
    failures.push("adapter sidecar route was not requested");
  }
  for (const expectedStackRoute of expectedAdapterStackRoutes[modelKey] || []) {
    if (!networkIncludesPath(networkRequests, expectedStackRoute)) {
      failures.push(`adapter stack route was not requested: ${expectedStackRoute}`);
    }
  }
  const expectedReceiptRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (expectedReceiptRoute && !networkRequests.some((requestUrl) => requestUrl.includes(expectedReceiptRoute))) {
    failures.push("adapter family receipt route was not requested");
  }
  const expectedAssemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  if (expectedAssemblyReceiptRoute) {
    if (!networkRequests.some((requestUrl) => requestUrl.includes(expectedAssemblyReceiptRoute))) {
      failures.push("assembly receipt route was not requested");
    }
    if (result.assemblyState !== "loaded") {
      failures.push(`assembly state was ${result.assemblyState}`);
    }
    if (result.assemblyKind !== "browser-local-assembly-evidence") {
      failures.push(`assembly kind was ${result.assemblyKind}`);
    }
    if (result.assemblyParents !== "3") {
      failures.push(`assembly parents were ${result.assemblyParents}`);
    }
    if (!/^0x[0-9a-fA-F]{16}$/.test(String(result.assemblyOperator || ""))) {
      failures.push(`assembly operator checksum was ${result.assemblyOperator}`);
    }
    if (!/^0x[0-9a-fA-F]{16}$/.test(String(result.assemblyLedger || ""))) {
      failures.push(`assembly ledger checksum was ${result.assemblyLedger}`);
    }
    if (result.assemblyNextGate !== "browser-selector-registry-route-binding") {
      failures.push(`assembly next gate was ${result.assemblyNextGate}`);
    }
    for (const expectedEvidenceRoute of expectedAssemblyEvidenceRoutes[modelKey] || []) {
      if (!networkRequests.some((requestUrl) => requestUrl.includes(expectedEvidenceRoute))) {
        failures.push(`assembly evidence route was not requested: ${expectedEvidenceRoute}`);
      }
    }
  }
  const expectedModulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (expectedModulePlanRoute && !networkRequests.some((requestUrl) => requestUrl.includes(expectedModulePlanRoute))) {
    failures.push("module plan route was not requested");
  }
  if (expectedModulePlanRoute) {
    if (result.modulePlanState !== "loaded") {
      failures.push(`module plan state was ${result.modulePlanState}`);
    }
    if (result.modulePlanKind !== "browser-local-module-plan") {
      failures.push(`module plan kind was ${result.modulePlanKind}`);
    }
    if (result.modulePlanResource !== "browser-constrained-local-assembly") {
      failures.push(`module plan resource was ${result.modulePlanResource}`);
    }
    if (result.modulePlanExecution !== expectedModulePlanExecutionProfile) {
      failures.push(`module plan execution profile was ${result.modulePlanExecution}`);
    }
    if (result.modulePlanFetch !== expectedModulePlanFetchPolicy) {
      failures.push(`module plan fetch policy was ${result.modulePlanFetch}`);
    }
    if (result.modulePlanOrigin !== expectedModulePlanOriginPolicy) {
      failures.push(`module plan origin policy was ${result.modulePlanOrigin}`);
    }
    if (result.modulePlanFetchLimit !== expectedModulePlanFetchLimit) {
      failures.push(`module plan fetch limit was ${result.modulePlanFetchLimit}`);
    }
    if (result.modulePlanPlannedFetchCount !== expectedModulePlanPlannedFetches) {
      failures.push(`module plan planned fetch count was ${result.modulePlanPlannedFetchCount}`);
    }
    if (result.modulePlanActualFetchCount !== expectedModulePlanPlannedFetches) {
      failures.push(`module plan actual fetch count was ${result.modulePlanActualFetchCount}`);
    }
    if (result.modulePlanRouteSetVersion !== expectedModulePlanRouteSetVersion) {
      failures.push(`module plan route set version was ${result.modulePlanRouteSetVersion}`);
    }
    if (result.modulePlanRouteSetChecksumAlgorithm !== expectedModulePlanRouteSetChecksumAlgorithm) {
      failures.push(`module plan route set checksum algorithm was ${result.modulePlanRouteSetChecksumAlgorithm}`);
    }
    if (!isNonZeroHex64(result.modulePlanRouteSetChecksum)) {
      failures.push(`module plan route set checksum was ${result.modulePlanRouteSetChecksum}`);
    }
    if (result.modulePlanActualRouteSetChecksum !== result.modulePlanRouteSetChecksum) {
      failures.push(`module plan actual route set checksum was ${result.modulePlanActualRouteSetChecksum}`);
    }
    if (result.modulePlanWasmPages !== expectedModulePlanWasmMemoryInitialPages) {
      failures.push(`module plan WASM pages was ${result.modulePlanWasmPages}`);
    }
    if (result.modulePlanWasmExportSet !== expectedModulePlanWasmExportSet) {
      failures.push(`module plan WASM ABI was ${result.modulePlanWasmExportSet}`);
    }
    if (result.modulePlanWasmTransferStrategy !== expectedModulePlanWasmTransferStrategy) {
      failures.push(`module plan WASM transfer strategy was ${result.modulePlanWasmTransferStrategy}`);
    }
    if (result.modulePlanModelReleaseStrategy !== expectedModulePlanModelReleaseStrategy) {
      failures.push(`module plan model release strategy was ${result.modulePlanModelReleaseStrategy}`);
    }
    if (result.modulePlanRuntimeResetStrategy !== expectedModulePlanRuntimeResetStrategy) {
      failures.push(`module plan runtime reset strategy was ${result.modulePlanRuntimeResetStrategy}`);
    }
    if (result.modulePlanAdapterValidationStrategy !== expectedModulePlanAdapterValidationStrategy) {
      failures.push(`module plan adapter validation strategy was ${result.modulePlanAdapterValidationStrategy}`);
    }
    if (result.modulePlanAdapterValidationCount !== expectedModulePlanAdapterValidationCount) {
      failures.push(`module plan adapter validation count was ${result.modulePlanAdapterValidationCount}`);
    }
    if (result.modulePlanAdapterApplyCount !== expectedModulePlanAdapterApplyCount) {
      failures.push(`module plan adapter apply count was ${result.modulePlanAdapterApplyCount}`);
    }
    assertModulePlanRuntimeResetBeforeAssembly(result, modelKey, failures);
    if (result.modulePlanWasmHeapMinBytes !== expectedModulePlanWasmHeapMinBytes) {
      failures.push(`module plan WASM heap floor was ${result.modulePlanWasmHeapMinBytes}`);
    }
    if (result.modulePlanContextTokens !== expectedModulePlanContextTokens) {
      failures.push(`module plan context tokens was ${result.modulePlanContextTokens}`);
    }
    if (result.modulePlanSamplerCap !== expectedModulePlanSamplerCap) {
      failures.push(`module plan sampler cap was ${result.modulePlanSamplerCap}`);
    }
    if (!isNonZeroHex64(result.modulePlanTokenizer)) {
      failures.push(`module plan tokenizer checksum was ${result.modulePlanTokenizer}`);
    }
    const expectedModuleCount = String(4 + (expectedAdapterStackRoutes[modelKey] || []).length);
    if (result.modulePlanModules !== expectedModuleCount) {
      failures.push(`module plan module count was ${result.modulePlanModules}`);
    }
    const expectedModelBudget = expectedModulePlanModelBudgets[modelKey];
    if (expectedModelBudget && result.modulePlanModelBudget !== expectedModelBudget) {
      failures.push(`module plan model budget was ${result.modulePlanModelBudget}`);
    }
    if (result.modulePlanAdapterBudget !== "1048576 bytes") {
      failures.push(`module plan adapter budget was ${result.modulePlanAdapterBudget}`);
    }
    if (result.modulePlanAdapterStackBudget !== expectedModulePlanAdapterStackBudget) {
      failures.push(`module plan adapter stack budget was ${result.modulePlanAdapterStackBudget}`);
    }
    if (result.modulePlanScratchBudget !== "65536 bytes") {
      failures.push(`module plan scratch budget was ${result.modulePlanScratchBudget}`);
    }
    if (result.modulePlanPromptLimit !== expectedModulePlanPromptLimit) {
      failures.push(`module plan prompt limit was ${result.modulePlanPromptLimit}`);
    }
    if (result.modulePlanOutputLimit !== "65536 bytes") {
      failures.push(`module plan output limit was ${result.modulePlanOutputLimit}`);
    }
    if (result.modulePlanKvCacheBudget !== expectedModulePlanKvCacheBudget) {
      failures.push(`module plan KV cache budget was ${result.modulePlanKvCacheBudget}`);
    }
    if (result.modulePlanKvCachePages !== expectedModulePlanKvCachePages) {
      failures.push(`module plan KV cache pages was ${result.modulePlanKvCachePages}`);
    }
    if (checkExactModulePlanSummaries) {
      const expectedTotalBudget = expectedModulePlanTotalBudgets[modelKey];
      if (expectedTotalBudget && result.modulePlanTotalBudget !== expectedTotalBudget) {
        failures.push(`module plan total budget was ${result.modulePlanTotalBudget}`);
      }
      const expectedTotalLimit = expectedModulePlanTotalLimits[modelKey];
      if (expectedTotalLimit && result.modulePlanTotalLimit !== expectedTotalLimit) {
        failures.push(`module plan total limit was ${result.modulePlanTotalLimit}`);
      }
      const expectedBytes = expectedModulePlanBytes[modelKey];
      if (expectedBytes && result.modulePlanBytes !== expectedBytes) {
        failures.push(`module plan bytes were ${result.modulePlanBytes}`);
      }
      const expectedChecksums = expectedModulePlanChecksums[modelKey];
      if (expectedChecksums && result.modulePlanChecksums !== expectedChecksums) {
        failures.push(`module plan checksums were ${result.modulePlanChecksums}`);
      }
    } else {
      if (!/^\d+ bytes$/.test(String(result.modulePlanTotalBudget || ""))) {
        failures.push(`module plan total budget was ${result.modulePlanTotalBudget}`);
      }
      if (!/^\d+ bytes$/.test(String(result.modulePlanTotalLimit || ""))) {
        failures.push(`module plan total limit was ${result.modulePlanTotalLimit}`);
      }
      if (!/^0: \d+ bytes, 1: \d+ bytes, 2: \d+ bytes, 3: \d+ bytes, 4: \d+ bytes, 5: \d+ bytes, 6: \d+ bytes$/.test(String(result.modulePlanBytes || ""))) {
        failures.push(`module plan bytes were ${result.modulePlanBytes}`);
      }
      if (!/^0: 0x[0-9a-fA-F]{16}, 1: 0x[0-9a-fA-F]{16}, 2: 0x[0-9a-fA-F]{16}, 3: 0x[0-9a-fA-F]{16}, 4: 0x[0-9a-fA-F]{16}, 5: 0x[0-9a-fA-F]{16}, 6: 0x[0-9a-fA-F]{16}$/.test(String(result.modulePlanChecksums || ""))) {
        failures.push(`module plan checksums were ${result.modulePlanChecksums}`);
      }
    }
    const expectedActualModuleBytes = modulePlanByteSummaryTotal(result.modulePlanBytes);
    if (!expectedActualModuleBytes) {
      failures.push(`module plan actual module bytes could not be derived from ${result.modulePlanBytes}`);
    } else if (result.modulePlanActualModuleBytes !== expectedActualModuleBytes) {
      failures.push(`module plan actual module bytes were ${result.modulePlanActualModuleBytes}`);
    }
    const expectedRenderedTotalBudget = modulePlanExpectedTotalBudget(result);
    if (!expectedRenderedTotalBudget) {
      failures.push(`module plan total budget could not be derived from ${result.modulePlanBytes}`);
    } else if (result.modulePlanTotalBudget !== expectedRenderedTotalBudget) {
      failures.push(`module plan total budget was ${result.modulePlanTotalBudget}`);
    }
    if (result.modulePlanActualModuleChecksums !== result.modulePlanChecksums) {
      failures.push(`module plan actual module checksums were ${result.modulePlanActualModuleChecksums}`);
    }
    if (result.modulePlanSlots !== expectedModulePlanSlots) {
      failures.push(`module plan slots were ${result.modulePlanSlots}`);
    }
    if (result.modulePlanRoles !== expectedModulePlanRoles) {
      failures.push(`module plan roles were ${result.modulePlanRoles}`);
    }
    if (result.modulePlanPhases !== expectedModulePlanPhases) {
      failures.push(`module plan phases were ${result.modulePlanPhases}`);
    }
    if (result.modulePlanDepends !== expectedModulePlanDependencies) {
      failures.push(`module plan dependencies were ${result.modulePlanDepends}`);
    }
    if (result.modulePlanTrace !== expectedModulePlanTrace) {
      failures.push(`module plan trace was ${result.modulePlanTrace}`);
    }
    const expectedModelRoute = expectedRouteForModel(modelKey);
    if (expectedModelRoute && result.modulePlanModel !== `..${expectedModelRoute}`) {
      failures.push(`module plan model route was ${result.modulePlanModel}`);
    }
    for (const expectedStackRoute of expectedAdapterStackRoutes[modelKey] || []) {
      if (!String(result.modulePlanStack || "").includes(`..${expectedStackRoute}`)) {
        failures.push(`module plan stack did not include ${expectedStackRoute}: ${result.modulePlanStack}`);
      }
    }
  }
  const expectedManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  for (const expectedManifestRoute of expectedManifestRoutes) {
    if (!networkRequests.some((requestUrl) => requestUrl.includes(expectedManifestRoute))) {
      failures.push(`adapter manifest route was not requested: ${expectedManifestRoute}`);
    }
  }
  const expectedModelRoute = expectedRouteForModel(modelKey);
  if (expectedModelRoute && !networkRequests.some((requestUrl) => requestUrl.includes(expectedModelRoute))) {
    failures.push("adapter model route was not requested");
  }
  if (isGeneratedMultiParentModel(modelKey) && !networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
    failures.push("selector registry route was not requested");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function combinedSelectorSequence(cycles) {
  const sequence = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const modelKey of combinedSelectorModels) {
      sequence.push(modelKey);
    }
  }
  return sequence;
}

function assertCombinedSelectorSequenceSmoke(result, networkRequests, expectedSequence, failures, options = {}) {
  const checkActualFetchBudget = options.checkActualFetchBudget !== false;
  if (result.initialSelectedModel !== combinedSelectorModels[0]) {
    failures.push(`combined selector default was ${result.initialSelectedModel}`);
  }
  const optionValues = Array.isArray(result.modelOptions)
    ? result.modelOptions.map((option) => option.value)
    : [];
  for (const modelKey of combinedSelectorModels) {
    if (!optionValues.includes(modelKey)) {
      failures.push(`combined selector option was missing: ${modelKey}`);
    }
  }
  if (optionValues.length !== combinedSelectorModels.length) {
    failures.push(`combined selector options were ${JSON.stringify(result.modelOptions)}`);
  }
  if (!Array.isArray(result.steps) || result.steps.length !== expectedSequence.length) {
    failures.push(`combined selector steps were ${JSON.stringify(result.steps)}`);
  } else {
    for (let index = 0; index < expectedSequence.length; index += 1) {
      const modelKey = expectedSequence[index];
      const step = result.steps[index];
      if (!step || step.modelKey !== modelKey) {
        failures.push(`combined selector step ${index} was ${JSON.stringify(step)}`);
        continue;
      }
      try {
        assertAdapterSidecarSmoke(step, modelKey, networkRequests, true, options);
      } catch (error) {
        failures.push(`${modelKey}: ${error.message}`);
      }
      const planRoute = expectedModulePlanRoutes[modelKey];
      const modelRoute = expectedRouteForModel(modelKey);
      const planIndex = networkPathIndex(networkRequests, planRoute);
      const modelIndex = networkPathIndex(networkRequests, modelRoute);
      if (planIndex < 0) {
        failures.push(`module plan route was not requested for ${modelKey}: ${planRoute}`);
      }
      if (modelIndex < 0) {
        failures.push(`model route was not requested for ${modelKey}: ${modelRoute}`);
      }
      if (planIndex >= 0 && modelIndex >= 0 && planIndex > modelIndex) {
        failures.push(`model bytes were requested before module plan for ${modelKey}`);
      }
      for (const stackRoute of expectedAdapterStackRoutes[modelKey] || []) {
        const stackIndex = networkPathIndex(networkRequests, stackRoute);
        if (stackIndex < 0) {
        failures.push(`adapter stack route was not requested for ${modelKey}: ${stackRoute}`);
        } else if (planIndex >= 0 && stackIndex < planIndex) {
          failures.push(`adapter stack route was requested before module plan for ${modelKey}: ${stackRoute}`);
        }
      }
    }
  }
  if (checkActualFetchBudget) {
    for (const modelKey of combinedSelectorModels) {
      const passes = expectedSequence.filter((expectedModel) => expectedModel === modelKey).length;
      if (passes > 0) {
        assertModulePlanActualFetchBudget(modelKey, networkRequests, passes, failures);
      }
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
}

function assertCombinedSelectorAssemblySmoke(result, networkRequests) {
  // Fresh all-root bundles regenerate receipt and evidence checksums, so prove the self-assembly shape.
  const failures = [];
  assertCombinedSelectorSequenceSmoke(result, networkRequests, combinedSelectorSequence(1), failures, {
    checkExactModulePlanSummaries: false
  });
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertCombinedSelectorOperatorFamilySmoke(result, networkRequests) {
  // Proves one selector registry can self-assemble both parent-pool operator families.
  const failures = [];
  assertCombinedSelectorSequenceSmoke(result, networkRequests, combinedSelectorSequence(1), failures, {
    checkExactModulePlanSummaries: false
  });
  const stepKeys = Array.isArray(result.steps) ? result.steps.map((step) => step.modelKey) : [];
  if (!stepKeys.some((modelKey) => modelKey.startsWith("multi-parent-sign-merge-"))) {
    failures.push("mixed selector did not assemble a sign-merge entry");
  }
  if (!stepKeys.some((modelKey) => modelKey.startsWith("multi-parent-soup-"))) {
    failures.push("mixed selector did not assemble a soup entry");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertCombinedSelectorOperatorFamilyCycleSmoke(result, networkRequests, cycles) {
  // Reuses the cycle proof across both parent-pool families in one selector lifetime.
  assertCombinedSelectorCycleSmoke(result, networkRequests, cycles);
  const failures = [];
  const stepKeys = Array.isArray(result.steps) ? result.steps.map((step) => step.modelKey) : [];
  const signMergeSteps = stepKeys.filter((modelKey) => modelKey.startsWith("multi-parent-sign-merge-")).length;
  const soupSteps = stepKeys.filter((modelKey) => modelKey.startsWith("multi-parent-soup-")).length;
  const expectedFamilySteps = 3 * cycles;
  if (signMergeSteps !== expectedFamilySteps) {
    failures.push(`sign-merge cycle steps were ${signMergeSteps}; expected ${expectedFamilySteps}`);
  }
  if (soupSteps !== expectedFamilySteps) {
    failures.push(`soup cycle steps were ${soupSteps}; expected ${expectedFamilySteps}`);
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertCombinedSelectorCycleSmoke(result, networkRequests, cycles) {
  const failures = [];
  const expectedSequence = combinedSelectorSequence(cycles);
  assertCombinedSelectorSequenceSmoke(result, networkRequests, expectedSequence, failures, {
    checkExactModulePlanSummaries: false
  });
  if (result.cycles !== cycles) {
    failures.push(`combined selector cycle count was ${result.cycles}`);
  }
  if (Array.isArray(result.expectedSequence) && result.expectedSequence.join("|") !== expectedSequence.join("|")) {
    failures.push(`combined selector expected sequence was ${JSON.stringify(result.expectedSequence)}`);
  }
  if (Array.isArray(result.steps)) {
    for (let index = 0; index < result.steps.length; index += 1) {
      const step = result.steps[index];
      const expectedModel = expectedSequence[index];
      if (!step || step.modelKey !== expectedModel) {
        continue;
      }
      const expectedStackCount = (expectedAdapterStackRoutes[expectedModel] || []).length;
      if (step.passIndex !== index) {
        failures.push(`${expectedModel} pass index was ${step.passIndex}`);
      }
      if (step.cycleIndex !== Math.floor(index / combinedSelectorModels.length)) {
        failures.push(`${expectedModel} cycle index was ${step.cycleIndex}`);
      }
      if (index === 0) {
        if (step.freeCallsSincePreviousStep !== 0) {
          failures.push(`${expectedModel} initial free delta was ${step.freeCallsSincePreviousStep}`);
        }
      } else {
        if (step.freeCallsSincePreviousStep !== 1) {
          failures.push(`${expectedModel} free delta was ${step.freeCallsSincePreviousStep}`);
        }
        if (step.lastFreeIndexSincePreviousStep < 0) {
          failures.push(`${expectedModel} did not record free_model before assembly`);
        }
        if (
          step.firstValidateIndexSincePreviousStep >= 0 &&
          step.lastFreeIndexSincePreviousStep > step.firstValidateIndexSincePreviousStep
        ) {
          failures.push(`${expectedModel} free_model was recorded after validation`);
        }
      }
      if (step.validateCallsSincePreviousStep !== expectedModulePlanAdapterValidationCountValue) {
        failures.push(`${expectedModel} validation delta was ${step.validateCallsSincePreviousStep}`);
      }
      if (step.applyCallsSincePreviousStep < expectedStackCount) {
        failures.push(`${expectedModel} apply delta was ${step.applyCallsSincePreviousStep}`);
      }
      if (step.stackCompletionsSincePreviousStep < 1) {
        failures.push(`${expectedModel} stack completion delta was ${step.stackCompletionsSincePreviousStep}`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function expectedSelfAssemblyRoutes(modelKey) {
  const modelRoute = expectedRouteForModel(modelKey);
  return [
    expectedModulePlanRoutes[modelKey],
    modelRoute,
    modelRoute ? `${modelRoute}.manifest` : null,
    expectedAssemblyReceiptRoutes[modelKey],
    ...(expectedAssemblyEvidenceRoutes[modelKey] || []),
    expectedAdapterFamilyReceiptRoutes[modelKey],
    ...(expectedAdapterManifestRoutes[modelKey] || []),
    ...(expectedAdapterStackRoutes[modelKey] || [])
  ].filter(Boolean);
}

// Counts actual generated self-assembly requests owned by one module-plan model key.
function modulePlanGovernedRequestCount(networkRequests, modelKey) {
  return networkRequests.filter((requestUrl) => {
    const pathname = requestUrlPath(requestUrl);
    return (
      pathname === `/models/${modelKey}.module-plan.receipt` ||
      pathname === `/models/${modelKey}.slm` ||
      pathname === `/models/${modelKey}.slm.manifest` ||
      pathname === `/models/${modelKey}.assembly.receipt` ||
      pathname === `/models/${modelKey}.adapter-family.receipt` ||
      pathname.startsWith(`/models/${modelKey}-`) ||
      pathname.startsWith(`/evidence/${modelKey}/`)
    );
  }).length;
}

// Binds the exact planned route count and 32-fetch envelope to observed generated routes.
function assertModulePlanActualFetchBudget(modelKey, networkRequests, passes, failures) {
  const expectedPerPass = expectedSelfAssemblyRoutes(modelKey).length;
  if (expectedPerPass !== expectedModulePlanActualFetches) {
    failures.push(`${modelKey} expected route fixture count was ${expectedPerPass}`);
  }
  const expectedTotal = expectedPerPass * passes;
  const plannedTotal = expectedModulePlanActualFetches * passes;
  if (expectedTotal !== plannedTotal) {
    failures.push(`${modelKey} planned governed request count was ${plannedTotal}; expected ${expectedTotal}`);
  }
  const observedTotal = modulePlanGovernedRequestCount(networkRequests, modelKey);
  if (observedTotal !== expectedTotal) {
    failures.push(`${modelKey} governed request count was ${observedTotal}; expected ${expectedTotal}`);
  }
  const allowedTotal = expectedModulePlanFetchLimitCount * passes;
  if (observedTotal > allowedTotal) {
    failures.push(`${modelKey} governed request count ${observedTotal} exceeded ${allowedTotal}`);
  }
}

function assertCombinedSelectorRouteSoakSmoke(result, networkRequests, cycles) {
  assertCombinedSelectorCycleSmoke(result, networkRequests, cycles);
  const failures = [];
  for (const modelKey of combinedSelectorModels) {
    for (const route of expectedSelfAssemblyRoutes(modelKey)) {
      const count = networkPathCount(networkRequests, route);
      if (count < cycles) {
        failures.push(`${modelKey} route ${route} was requested ${count} times for ${cycles} passes`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

// Checks that independent page lifetimes rebuild generated assembly from local receipts.
function assertCombinedSelectorReloadSoakSmoke(result, networkRequests, reloads) {
  const failures = [];
  if (result.reloads !== reloads) {
    failures.push(`combined selector reload count was ${result.reloads}`);
  }
  if (!Array.isArray(result.results) || result.results.length !== reloads) {
    failures.push(`combined selector reload results were ${JSON.stringify(result.results)}`);
  } else {
    for (let reloadIndex = 0; reloadIndex < reloads; reloadIndex += 1) {
      const pageResult = result.results[reloadIndex];
      if (!pageResult || pageResult.reloadIndex !== reloadIndex) {
        failures.push(`reload ${reloadIndex} result was ${JSON.stringify(pageResult)}`);
        continue;
      }
      assertCombinedSelectorSequenceSmoke(
        pageResult,
        networkRequests,
        combinedSelectorSequence(1),
        failures,
        { checkExactModulePlanSummaries: false, checkActualFetchBudget: false }
      );
    }
  }
  for (const modelKey of combinedSelectorModels) {
    assertModulePlanActualFetchBudget(modelKey, networkRequests, reloads, failures);
  }
  for (const route of ["/runtime/tinyrustlm.wasm.manifest", "/models/selector.registry"]) {
    const count = networkPathCount(networkRequests, route);
    if (count < reloads) {
      failures.push(`reload route ${route} was requested ${count} times for ${reloads} page lifetimes`);
    }
  }
  for (const modelKey of combinedSelectorModels) {
    for (const route of expectedSelfAssemblyRoutes(modelKey)) {
      const count = networkPathCount(networkRequests, route);
      if (count < reloads) {
        failures.push(`${modelKey} route ${route} was requested ${count} times for ${reloads} page lifetimes`);
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertCombinedSelectorOperatorFamilyReloadSoakSmoke(result, networkRequests, reloads) {
  // Extends reload proof across both parent-pool operator families in every page lifetime.
  assertCombinedSelectorReloadSoakSmoke(result, networkRequests, reloads);
  const failures = [];
  const pageResults = Array.isArray(result.results) ? result.results : [];
  for (let reloadIndex = 0; reloadIndex < pageResults.length; reloadIndex += 1) {
    const stepKeys = Array.isArray(pageResults[reloadIndex].steps)
      ? pageResults[reloadIndex].steps.map((step) => step.modelKey)
      : [];
    const signMergeSteps = stepKeys.filter((modelKey) => modelKey.startsWith("multi-parent-sign-merge-")).length;
    const soupSteps = stepKeys.filter((modelKey) => modelKey.startsWith("multi-parent-soup-")).length;
    if (signMergeSteps !== 3) {
      failures.push(`reload ${reloadIndex} sign-merge steps were ${signMergeSteps}`);
    }
    if (soupSteps !== 3) {
      failures.push(`reload ${reloadIndex} soup steps were ${soupSteps}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAdapterChecksumMismatchSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.runtimeStatus !== "Adapter load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.adapterState !== "adapter artifact checksum mismatch") {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.errorState !== "adapter artifact checksum mismatch") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.response !== "e") {
    failures.push(`response was ${JSON.stringify(result.response)}`);
  }
  if (String(result.console || "").includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!String(result.console || "").includes("adapter artifact checksum mismatch")) {
    failures.push("console did not include checksum mismatch");
  }
  const before = result.beforeApplyDiagnostics || {};
  const after = result.afterApplyDiagnostics || {};
  if (before.generated_token_count !== 1 || before.kv_cache_length < 1) {
    failures.push(`pre-apply diagnostics were ${JSON.stringify(before)}`);
  }
  if (after.generated_token_count !== 1 || after.kv_cache_length < 1) {
    failures.push(`post-failure diagnostics were ${JSON.stringify(after)}`);
  }
  if (result.stepDisabledAfterApply) {
    failures.push("step-token control was disabled after adapter load failure");
  }
  if (result.generateDisabledAfterApply || result.applyDisabledAfterApply) {
    failures.push("primary adapter controls were disabled after checksum mismatch");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  const expectedAdapterRoute = expectedAdapterRoutes[modelKey] || "/models/tiny-test-model-self.adp1";
  if (!networkIncludesPath(networkRequests, expectedAdapterRoute)) {
    failures.push("adapter sidecar route was not requested");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertAdapterManifestBudgetSmoke(result, modelKey, networkRequests) {
  const failures = [];
  if (result.selectedModel !== modelKey) {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!String(result.adapterState || "").includes("Adapter manifest byte budget exceeded")) {
    failures.push(`adapter state was ${result.adapterState}`);
  }
  if (result.assemblyState !== "loaded") {
    failures.push(`assembly state was ${result.assemblyState}`);
  }
  if (result.assemblyKind !== "browser-local-assembly-evidence") {
    failures.push(`assembly kind was ${result.assemblyKind}`);
  }
  if (result.generateDisabled) {
    failures.push("generate control was disabled after manifest budget rejection");
  }
  if (!result.adapterSelectDisabled || !result.applyDisabled) {
    failures.push("adapter controls were enabled after manifest budget rejection");
  }
  if (String(result.console || "").includes("apply_adapter_delta")) {
    failures.push("console included apply_adapter_delta");
  }
  if (!String(result.console || "").includes("Adapter manifest byte budget exceeded")) {
    failures.push("console did not include manifest budget rejection");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  const expectedManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  const sparseManifestRoute = expectedManifestRoutes[expectedManifestRoutes.length - 1];
  if (!sparseManifestRoute || !networkRequests.some((requestUrl) => requestUrl.includes(sparseManifestRoute))) {
    failures.push(`adapter sparse manifest route was not requested: ${sparseManifestRoute}`);
  }
  const expectedAdapterRoute = expectedAdapterRoutes[modelKey];
  if (expectedAdapterRoute && networkIncludesPath(networkRequests, expectedAdapterRoute)) {
    failures.push("adapter artifact route was requested after manifest budget rejection");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertStepHealthy(step) {
  const failures = [];
  if (step.runtimeStatus !== "Ready") {
    failures.push(`${step.label} runtime status was ${step.runtimeStatus}`);
  }
  if (step.errorState !== "none") {
    failures.push(`${step.label} error state was ${step.errorState}`);
  }
  if (step.generateDisabled || step.resetDisabled || step.modelSelectDisabled) {
    failures.push(`${step.label} controls were unexpectedly disabled`);
  }
  if (Object.prototype.hasOwnProperty.call(step, "stepTokenDisabled")) {
    const label = String(step.label || "");
    if (label.includes("generate") && step.stepTokenDisabled) {
      failures.push(`${step.label} step-token control was disabled after generation`);
    }
    if ((label.includes("ready") || label.includes("reset") || label === "reload-ready") && !step.stepTokenDisabled) {
      failures.push(`${step.label} step-token control was enabled without generation context`);
    }
  }
  if (!step.diagnostics || step.diagnostics.last_error !== "ok") {
    failures.push(`${step.label} diagnostics last_error was not ok`);
  }
  return failures;
}

function assertLoopSmoke(result, networkRequests) {
  const failures = [];
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const byLabel = new Map(steps.map((step) => [step.label, step]));
  for (const label of [
    "reload-ready",
    "q8-ready",
    "q8-generate-1",
    "q8-reset",
    "q8-generate-2",
    "q4-ready",
    "q4-generate-1",
    "q4-reset",
    "q4-generate-2"
  ]) {
    if (!byLabel.has(label)) {
      failures.push(`missing loop step ${label}`);
    }
  }
  for (const step of steps) {
    failures.push(...assertStepHealthy(step));
  }
  for (const label of ["q8-generate-1", "q8-generate-2"]) {
    const step = byLabel.get(label);
    if (step) {
      if (step.selectedModel !== "tinylm16q8") {
        failures.push(`${label} selected model was ${step.selectedModel}`);
      }
      if (step.response !== "e") {
        failures.push(`${label} response was ${JSON.stringify(step.response)}`);
      }
      if (step.diagnostics.active_quantization_mode !== "q8_0") {
        failures.push(`${label} quantization was ${step.diagnostics.active_quantization_mode}`);
      }
      if (step.diagnostics.selected_next_token !== 101) {
        failures.push(`${label} selected token was ${step.diagnostics.selected_next_token}`);
      }
    }
  }
  for (const label of ["q4-generate-1", "q4-generate-2"]) {
    const step = byLabel.get(label);
    if (step) {
      if (step.selectedModel !== "tinylm16q4") {
        failures.push(`${label} selected model was ${step.selectedModel}`);
      }
      if (step.response !== "e") {
        failures.push(`${label} response was ${JSON.stringify(step.response)}`);
      }
      if (step.diagnostics.active_quantization_mode !== "q4_0") {
        failures.push(`${label} quantization was ${step.diagnostics.active_quantization_mode}`);
      }
      if (step.diagnostics.selected_next_token !== 101) {
        failures.push(`${label} selected token was ${step.diagnostics.selected_next_token}`);
      }
    }
  }
  for (const label of ["q8-reset", "q4-reset"]) {
    const step = byLabel.get(label);
    if (step) {
      if (step.console !== "context reset") {
        failures.push(`${label} console was ${JSON.stringify(step.console)}`);
      }
      if (step.diagnostics.generated_token_count !== 0) {
        failures.push(`${label} generated count was ${step.diagnostics.generated_token_count}`);
      }
    }
  }
  for (const label of ["reload-ready", "q8-ready", "q4-ready"]) {
    const step = byLabel.get(label);
    if (step) {
      if (step.diagnostics.prompt_token_count !== 0) {
        failures.push(`${label} prompt count was ${step.diagnostics.prompt_token_count}`);
      }
      if (step.diagnostics.generated_token_count !== 0) {
        failures.push(`${label} generated count was ${step.diagnostics.generated_token_count}`);
      }
      if (step.diagnostics.kv_cache_length !== 0) {
        failures.push(`${label} kv cache length was ${step.diagnostics.kv_cache_length}`);
      }
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertModelErrorSmoke(result, networkRequests) {
  const failures = [];
  if (result.runtimeStatus !== "Model rejected") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState).startsWith("error 4")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "invalid model magic") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (!result.diagnostics || result.diagnostics.last_error !== "invalid model magic") {
    failures.push("diagnostics did not report invalid model magic");
  }
  if (result.diagnostics && result.diagnostics.model_loaded !== false) {
    failures.push("diagnostics reported model_loaded true");
  }
  if (!result.generateDisabled || !result.resetDisabled) {
    failures.push("generate/reset controls were not disabled after rejected model");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was not disabled after rejected model");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after rejected model");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

async function runPagePromptLimitSmoke(client) {
  const expression = `
    (async () => {
      const byId = (id) => document.getElementById(id);
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const parseDiagnostics = () => {
        try {
          return JSON.parse(byId("diagnostics").textContent);
        } catch {
          return null;
        }
      };
      for (let index = 0; index < 600; index += 1) {
        if (!byId("generateButton").disabled && byId("runtimeStatus").textContent === "Ready") {
          break;
        }
        await sleep(100);
      }
      byId("prompt").value = "a".repeat(4097);
      byId("generateButton").click();
      await sleep(100);
      return JSON.stringify({
        runtimeStatus: byId("runtimeStatus").textContent,
        modelState: byId("modelState").textContent,
        errorState: byId("errorState").textContent,
        response: byId("response").textContent,
        console: byId("console").textContent,
        diagnostics: parseDiagnostics(),
        stepTokenDisabled: byId("stepTokenButton").disabled,
        generateDisabled: byId("generateButton").disabled,
        resetDisabled: byId("resetButton").disabled,
        modelSelectDisabled: byId("modelSelect").disabled
      });
    })()
  `;
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 120000
  });
  return parseEvaluateValue(result);
}

function assertMissingModelSmoke(result, networkRequests) {
  const failures = [];
  if (result.runtimeStatus !== "Model load failed") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "fetch error") {
    failures.push(`model state was ${result.modelState}`);
  }
  if (!String(result.errorState).includes("Unable to fetch local .slm model (404)")) {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.selectedModel !== "tinylm16q8") {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (!result.generateDisabled || !result.resetDisabled) {
    failures.push("generate/reset controls were not disabled after missing model");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was not disabled after missing model");
  }
  if (result.modelSelectDisabled) {
    failures.push("model selector was disabled after missing model");
  }
  if (result.diagnostics && result.diagnostics.model_loaded !== false) {
    failures.push("diagnostics reported model_loaded true");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (!networkRequests.some((requestUrl) => requestUrl.includes("/models/tinylm16-q8.slm"))) {
    failures.push("missing model route was not requested");
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertContextErrorSmoke(result, networkRequests) {
  const failures = [];
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (result.errorState !== "context exceeded") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.response !== "context exceeded") {
    failures.push(`response was ${JSON.stringify(result.response)}`);
  }
  if (!String(result.console).includes("generate(max_new_tokens=1, temperature=0, top_k=1, top_p=1, seed=1) -> 11")) {
    failures.push(`console did not include context exceeded code: ${JSON.stringify(result.console)}`);
  }
  if (!result.diagnostics || result.diagnostics.last_error !== "context exceeded") {
    failures.push("diagnostics did not report context exceeded");
  }
  if (result.diagnostics && result.diagnostics.generated_token_count !== 0) {
    failures.push(`generated count was ${result.diagnostics.generated_token_count}`);
  }
  if (result.diagnostics && result.diagnostics.kv_cache_length !== 0) {
    failures.push(`kv cache length was ${result.diagnostics.kv_cache_length}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("controls were unexpectedly disabled after context error");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled after context error");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertPromptLimitSmoke(result, networkRequests) {
  const failures = [];
  if (result.runtimeStatus !== "Ready") {
    failures.push(`runtime status was ${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "prompt byte limit exceeded") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.response !== "prompt byte limit exceeded") {
    failures.push(`response was ${JSON.stringify(result.response)}`);
  }
  if (result.console !== "prompt byte limit exceeded") {
    failures.push(`console was ${JSON.stringify(result.console)}`);
  }
  if (result.diagnostics && result.diagnostics.prompt_token_count !== 0) {
    failures.push(`prompt tokens were ${result.diagnostics.prompt_token_count}`);
  }
  if (result.diagnostics && result.diagnostics.generated_token_count !== 0) {
    failures.push(`generated count was ${result.diagnostics.generated_token_count}`);
  }
  if (result.generateDisabled || result.resetDisabled || result.modelSelectDisabled) {
    failures.push("controls were unexpectedly disabled after prompt byte limit");
  }
  if (!result.stepTokenDisabled) {
    failures.push("step-token control was enabled after prompt byte limit");
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertEnduranceSmoke(result, networkRequests) {
  const failures = [];
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const cycles = Number(result.cycles || 0);
  if (cycles < 2) {
    failures.push(`cycle count was ${cycles}`);
  }
  if (steps.length !== cycles * 6) {
    failures.push(`expected ${cycles * 6} endurance steps, got ${steps.length}`);
  }
  for (const step of steps) {
    failures.push(...assertStepHealthy(step));
    if (step.label.includes("-generate")) {
      const expectedMode = step.label.includes("-q8-") ? "q8_0" : "q4_0";
      const expectedModel = step.label.includes("-q8-") ? "tinylm16q8" : "tinylm16q4";
      if (step.selectedModel !== expectedModel) {
        failures.push(`${step.label} selected model was ${step.selectedModel}`);
      }
      if (step.response !== "e") {
        failures.push(`${step.label} response was ${JSON.stringify(step.response)}`);
      }
      if (step.diagnostics.active_quantization_mode !== expectedMode) {
        failures.push(`${step.label} quantization was ${step.diagnostics.active_quantization_mode}`);
      }
      if (step.diagnostics.generated_token_count !== 1) {
        failures.push(`${step.label} generated count was ${step.diagnostics.generated_token_count}`);
      }
      if (step.diagnostics.selected_next_token !== 101) {
        failures.push(`${step.label} selected token was ${step.diagnostics.selected_next_token}`);
      }
    }
    if (step.label.includes("-reset")) {
      if (step.console !== "context reset") {
        failures.push(`${step.label} console was ${JSON.stringify(step.console)}`);
      }
      if (step.diagnostics.prompt_token_count !== 0) {
        failures.push(`${step.label} prompt count was ${step.diagnostics.prompt_token_count}`);
      }
      if (step.diagnostics.generated_token_count !== 0) {
        failures.push(`${step.label} generated count was ${step.diagnostics.generated_token_count}`);
      }
      if (step.diagnostics.kv_cache_length !== 0) {
        failures.push(`${step.label} kv cache length was ${step.diagnostics.kv_cache_length}`);
      }
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertPerformanceSmoke(result, networkRequests) {
  const failures = [];
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const maxTokens = Number(result.maxTokens || 0);
  const byLabel = new Map(steps.map((step) => [step.label, step]));
  if (maxTokens < 2) {
    failures.push(`maxTokens was ${maxTokens}`);
  }
  for (const label of [
    "q8-performance-ready",
    "q8-performance-generate",
    "q8-performance-reset",
    "q4-performance-ready",
    "q4-performance-generate",
    "q4-performance-reset"
  ]) {
    if (!byLabel.has(label)) {
      failures.push(`missing performance step ${label}`);
    }
  }
  for (const step of steps) {
    failures.push(...assertStepHealthy(step));
  }
  for (const label of ["q8-performance-generate", "q4-performance-generate"]) {
    const step = byLabel.get(label);
    if (!step) {
      continue;
    }
    const expectedModel = label.startsWith("q8") ? "tinylm16q8" : "tinylm16q4";
    const expectedMode = label.startsWith("q8") ? "q8_0" : "q4_0";
    const expectedResponse = "e".repeat(maxTokens);
    if (step.selectedModel !== expectedModel) {
      failures.push(`${label} selected model was ${step.selectedModel}`);
    }
    if (step.response !== expectedResponse) {
      failures.push(`${label} response was ${JSON.stringify(step.response)}`);
    }
    if (step.diagnostics.active_quantization_mode !== expectedMode) {
      failures.push(`${label} quantization was ${step.diagnostics.active_quantization_mode}`);
    }
    if (step.diagnostics.prompt_token_count !== 3) {
      failures.push(`${label} prompt tokens were ${step.diagnostics.prompt_token_count}`);
    }
    if (step.diagnostics.generated_token_count !== maxTokens) {
      failures.push(`${label} generated tokens were ${step.diagnostics.generated_token_count}`);
    }
    if (step.diagnostics.kv_cache_length !== maxTokens + 3) {
      failures.push(`${label} kv cache length was ${step.diagnostics.kv_cache_length}`);
    }
    if (step.diagnostics.selected_next_token !== 101) {
      failures.push(`${label} selected token was ${step.diagnostics.selected_next_token}`);
    }
    if (step.benchPromptTokensValue !== 3) {
      failures.push(`${label} benchmark prompt tokens were ${step.benchPromptTokens}`);
    }
    if (step.benchGeneratedTokensValue !== maxTokens) {
      failures.push(`${label} benchmark generated tokens were ${step.benchGeneratedTokens}`);
    }
    if (!(step.benchTokensPerSecondValue > 0)) {
      failures.push(`${label} benchmark token speed was ${step.benchTokensPerSecond}`);
    }
    if (!(step.benchScratchValue > 0)) {
      failures.push(`${label} scratch bytes were ${step.benchScratch}`);
    }
    if (!(step.elapsedMs > 0)) {
      failures.push(`${label} elapsedMs was ${step.elapsedMs}`);
    }
  }
  for (const label of ["q8-performance-reset", "q4-performance-reset"]) {
    const step = byLabel.get(label);
    if (!step) {
      continue;
    }
    if (step.console !== "context reset") {
      failures.push(`${label} console was ${JSON.stringify(step.console)}`);
    }
    if (step.diagnostics.prompt_token_count !== 0) {
      failures.push(`${label} prompt count was ${step.diagnostics.prompt_token_count}`);
    }
    if (step.diagnostics.generated_token_count !== 0) {
      failures.push(`${label} generated count was ${step.diagnostics.generated_token_count}`);
    }
    if (step.diagnostics.kv_cache_length !== 0) {
      failures.push(`${label} kv cache length was ${step.diagnostics.kv_cache_length}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertPerformanceSoak(result, networkRequests) {
  const failures = [];
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const cycles = Number(result.cycles || 0);
  const maxTokens = Number(result.maxTokens || 0);
  const expectedResponse = "e".repeat(maxTokens);
  const generationCounts = {
    q8: 0,
    q4: 0
  };
  const minSpeeds = {
    q8: Number.POSITIVE_INFINITY,
    q4: Number.POSITIVE_INFINITY
  };
  if (cycles < 2) {
    failures.push(`cycle count was ${cycles}`);
  }
  if (maxTokens < 2) {
    failures.push(`maxTokens was ${maxTokens}`);
  }
  if (steps.length !== cycles * 6) {
    failures.push(`expected ${cycles * 6} performance-soak steps, got ${steps.length}`);
  }
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    for (const mode of ["q8", "q4"]) {
      for (const phase of ["ready", "generate", "reset"]) {
        const label = `cycle-${cycle}-${mode}-performance-${phase}`;
        if (!steps.some((step) => step.label === label)) {
          failures.push(`missing performance-soak step ${label}`);
        }
      }
    }
  }
  for (const step of steps) {
    failures.push(...assertStepHealthy(step));
    const isQ8 = step.label.includes("-q8-");
    const expectedModel = isQ8 ? "tinylm16q8" : "tinylm16q4";
    const expectedMode = isQ8 ? "q8_0" : "q4_0";
    const key = isQ8 ? "q8" : "q4";
    if (step.selectedModel !== expectedModel) {
      failures.push(`${step.label} selected model was ${step.selectedModel}`);
    }
    if (step.diagnostics.active_quantization_mode !== expectedMode) {
      failures.push(`${step.label} quantization was ${step.diagnostics.active_quantization_mode}`);
    }
    if (step.label.includes("-generate")) {
      generationCounts[key] += 1;
      minSpeeds[key] = Math.min(minSpeeds[key], step.benchTokensPerSecondValue);
      if (step.response !== expectedResponse) {
        failures.push(`${step.label} response was ${JSON.stringify(step.response)}`);
      }
      if (step.diagnostics.prompt_token_count !== 3) {
        failures.push(`${step.label} prompt tokens were ${step.diagnostics.prompt_token_count}`);
      }
      if (step.diagnostics.generated_token_count !== maxTokens) {
        failures.push(`${step.label} generated tokens were ${step.diagnostics.generated_token_count}`);
      }
      if (step.diagnostics.kv_cache_length !== maxTokens + 3) {
        failures.push(`${step.label} kv cache length was ${step.diagnostics.kv_cache_length}`);
      }
      if (step.diagnostics.selected_next_token !== 101) {
        failures.push(`${step.label} selected token was ${step.diagnostics.selected_next_token}`);
      }
      if (step.benchPromptTokensValue !== 3) {
        failures.push(`${step.label} benchmark prompt tokens were ${step.benchPromptTokens}`);
      }
      if (step.benchGeneratedTokensValue !== maxTokens) {
        failures.push(`${step.label} benchmark generated tokens were ${step.benchGeneratedTokens}`);
      }
      if (!(step.benchTokensPerSecondValue > 0)) {
        failures.push(`${step.label} benchmark token speed was ${step.benchTokensPerSecond}`);
      }
      if (!(step.benchScratchValue > 0)) {
        failures.push(`${step.label} scratch bytes were ${step.benchScratch}`);
      }
      if (!(step.elapsedMs > 0)) {
        failures.push(`${step.label} elapsedMs was ${step.elapsedMs}`);
      }
    }
    if (step.label.includes("-reset")) {
      if (step.console !== "context reset") {
        failures.push(`${step.label} console was ${JSON.stringify(step.console)}`);
      }
      if (step.diagnostics.prompt_token_count !== 0) {
        failures.push(`${step.label} prompt count was ${step.diagnostics.prompt_token_count}`);
      }
      if (step.diagnostics.generated_token_count !== 0) {
        failures.push(`${step.label} generated count was ${step.diagnostics.generated_token_count}`);
      }
      if (step.diagnostics.kv_cache_length !== 0) {
        failures.push(`${step.label} kv cache length was ${step.diagnostics.kv_cache_length}`);
      }
    }
  }
  if (generationCounts.q8 !== cycles) {
    failures.push(`q8 generation count was ${generationCounts.q8}`);
  }
  if (generationCounts.q4 !== cycles) {
    failures.push(`q4 generation count was ${generationCounts.q4}`);
  }
  if (!(minSpeeds.q8 > 0)) {
    failures.push(`q8 minimum token speed was ${minSpeeds.q8}`);
  }
  if (!(minSpeeds.q4 > 0)) {
    failures.push(`q4 minimum token speed was ${minSpeeds.q4}`);
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertUiSnapshot(snapshot, phase, viewportName) {
  const failures = [];
  const requiredHeadings = [
    "Advanced Options",
    "Generation Presets",
    "Runtime Status",
    "Diagnostics",
    "Provenance",
    "Benchmark",
    "Adapter Sidecar",
    "Module Plan",
    "Run History / State Ledger"
  ];
  const requiredLabels = ["Prompt", "Max Tokens", "Temperature", "Top-K", "Top-P", "Seed", "Model", "Local .slm", "Hugging Face"];
  const requiredStarterCards = ["Summarize this article", "Explain code", "Rewrite text", "Generate JSON"];
  const requiredPresets = ["Balanced", "Creative", "Precise", "Code", "JSON"];
  const requiredOptions = [
    "TinyLM-16M q8_0",
    "TinyLM-16M q4_0",
    "TinyLM-16M f32",
    "Tiny Fixture f32",
    "Tiny Fixture tied-output f32",
    "Tiny Fixture q8_0",
    "Tiny Fixture q4_0",
    "Tiny Fixture BPE f32"
  ];
  const prefix = `${viewportName} ${phase}`;
  if (snapshot.title !== "TinyRustLM") {
    failures.push(`${prefix} title was ${snapshot.title}`);
  }
  if (snapshot.lang !== "en") {
    failures.push(`${prefix} lang was ${snapshot.lang}`);
  }
  if (snapshot.h1 !== "TinyRustLM") {
    failures.push(`${prefix} h1 was ${snapshot.h1}`);
  }
  if (snapshot.eyebrow !== "Private Rust/WASM") {
    failures.push(`${prefix} eyebrow was ${snapshot.eyebrow}`);
  }
  const localOnlyCopy = `${snapshot.privacyBadge} ${snapshot.notice} ${snapshot.footer}`;
  if (!localOnlyCopy.includes("Local browser inference") || !localOnlyCopy.includes("No prompts sent to a server")) {
    failures.push(`${prefix} privacy badge was ${snapshot.privacyBadge}`);
  }
  if (!localOnlyCopy.includes("TinyRustLM.com does not serve runnable model weights")) {
    failures.push(`${prefix} model-serving boundary was not visible`);
  }
  if (
    !snapshot.footer.includes("TinyRustLM.com") ||
    !snapshot.footer.includes("TinyRustLM") ||
    !snapshot.footer.includes("Rust/WASM")
  ) {
    failures.push(`${prefix} footer did not expose product, site, and Rust/WASM identity`);
  }
  if (!snapshot.hasLeftSidebar || !snapshot.hasMainWorkspace || !snapshot.hasAdvancedOptionsPanel) {
    failures.push(`${prefix} three-region dashboard flags were ${snapshot.hasLeftSidebar}/${snapshot.hasMainWorkspace}/${snapshot.hasAdvancedOptionsPanel}`);
  }
  for (const toolbarText of ["TinyLM-16M q8_0", "Loaded locally", "WASM ready", "8 max tokens", "Edit Model"]) {
    if (!snapshot.modelToolbar.includes(toolbarText)) {
      failures.push(`${prefix} model toolbar was missing ${toolbarText}`);
    }
  }
  for (const card of requiredStarterCards) {
    if (!snapshot.starterLabels.some((text) => text.includes(card))) {
      failures.push(`${prefix} missing starter card ${card}`);
    }
  }
  for (const preset of requiredPresets) {
    if (!snapshot.presetLabels.some((text) => text.includes(preset))) {
      failures.push(`${prefix} missing generation preset ${preset}`);
    }
  }
  for (const heading of requiredHeadings) {
    if (!snapshot.headings.some((text) => text.includes(heading))) {
      failures.push(`${prefix} missing heading ${heading}`);
    }
  }
  for (const label of requiredLabels) {
    if (!snapshot.labels.some((text) => text.includes(label))) {
      failures.push(`${prefix} missing label ${label}`);
    }
  }
  for (const option of requiredOptions) {
    if (!snapshot.modelOptions.includes(option)) {
      failures.push(`${prefix} missing model option ${option}`);
    }
  }
  if (snapshot.panelCount < 8) {
    failures.push(`${prefix} panel count was ${snapshot.panelCount}`);
  }
  if (snapshot.runtimeStatus !== "Ready") {
    failures.push(`${prefix} runtime status was ${snapshot.runtimeStatus}`);
  }
  if (snapshot.errorState !== "none") {
    failures.push(`${prefix} error state was ${snapshot.errorState}`);
  }
  if (snapshot.generateDisabled || snapshot.resetDisabled || snapshot.modelSelectDisabled) {
    failures.push(`${prefix} controls were unexpectedly disabled`);
  }
  if (phase === "ready") {
    if (!snapshot.clearChatDisabled) {
      failures.push(`${prefix} clear chat control was enabled before transcript content`);
    }
    if (!snapshot.stepTokenDisabled) {
      failures.push(`${prefix} step-token control was enabled before generation context`);
    }
    if (Array.isArray(snapshot.conversationItems) && snapshot.conversationItems.length !== 0) {
      failures.push(`${prefix} conversation was not empty before generation`);
    }
  }
  if (phase === "generated") {
    if (snapshot.clearChatDisabled) {
      failures.push(`${prefix} clear chat control stayed disabled after transcript content`);
    }
    if (snapshot.stepTokenDisabled) {
      failures.push(`${prefix} step-token control stayed disabled after generation`);
    }
    if (!Array.isArray(snapshot.conversationItems) || snapshot.conversationItems.length !== 2) {
      failures.push(`${prefix} conversation item count was ${snapshot.conversationItems ? snapshot.conversationItems.length : "missing"}`);
    } else {
      if (snapshot.conversationItems[0].role !== "You" || snapshot.conversationItems[0].text !== "hi") {
        failures.push(`${prefix} conversation user item was ${JSON.stringify(snapshot.conversationItems[0])}`);
      }
      if (snapshot.conversationItems[1].role !== "TinyRustLM" || snapshot.conversationItems[1].text !== "e" || snapshot.conversationItems[1].isError) {
        failures.push(`${prefix} conversation assistant item was ${JSON.stringify(snapshot.conversationItems[1])}`);
      }
    }
  }
  if (phase === "cleared") {
    if (!snapshot.clearChatDisabled) {
      failures.push(`${prefix} clear chat control stayed enabled after transcript clear`);
    }
    if (snapshot.stepTokenDisabled) {
      failures.push(`${prefix} step-token control was disabled after transcript clear`);
    }
    if (Array.isArray(snapshot.conversationItems) && snapshot.conversationItems.length !== 0) {
      failures.push(`${prefix} conversation was not empty after transcript clear`);
    }
  }
  if (snapshot.selectedModel !== "tinylm16q8") {
    failures.push(`${prefix} selected model was ${snapshot.selectedModel}`);
  }
  if (snapshot.temperatureValue !== "0" || snapshot.topKValue !== "1" || snapshot.topPValue !== "1" || snapshot.seedValue !== "1") {
    failures.push(`${prefix} sampling controls were ${snapshot.temperatureValue}/${snapshot.topKValue}/${snapshot.topPValue}/${snapshot.seedValue}`);
  }
  if (snapshot.scrollWidth > snapshot.viewportWidth + 1 || snapshot.bodyScrollWidth > snapshot.viewportWidth + 1) {
    failures.push(`${prefix} horizontal overflow ${snapshot.scrollWidth}/${snapshot.bodyScrollWidth} > ${snapshot.viewportWidth}`);
  }
  if (Array.isArray(snapshot.badRects) && snapshot.badRects.length > 0) {
    failures.push(`${prefix} zero-sized UI controls: ${JSON.stringify(snapshot.badRects)}`);
  }
  if (!snapshot.diagnosticsText.includes('"active_quantization_mode": "q8_0"')) {
    failures.push(`${prefix} diagnostics did not report q8_0`);
  }
  if (!snapshot.developerText.includes('"active_quantization_mode": "q8_0"')) {
    failures.push(`${prefix} developer panel did not mirror diagnostics`);
  }
  if (!snapshot.diagnostics || snapshot.diagnostics.sampling_temperature !== 0 || snapshot.diagnostics.sampling_top_k !== 1 || snapshot.diagnostics.sampling_top_p !== 1 || snapshot.diagnostics.sampling_seed !== 1) {
    failures.push(`${prefix} diagnostics sampling defaults were not greedy`);
  }
  if (snapshot.provenanceState !== "loaded") {
    failures.push(`${prefix} provenance state was ${snapshot.provenanceState}`);
  }
  if (snapshot.provenanceSourceKind !== "deterministic-smoke") {
    failures.push(`${prefix} provenance source was ${snapshot.provenanceSourceKind}`);
  }
  if (snapshot.provenanceSourceSnapshot !== "unavailable") {
    failures.push(`${prefix} provenance source snapshot was ${snapshot.provenanceSourceSnapshot}`);
  }
  if (snapshot.provenanceSourceId !== "unavailable") {
    failures.push(`${prefix} provenance source id was ${snapshot.provenanceSourceId}`);
  }
  if (snapshot.provenanceSourceShape !== "vocab=260,hidden=512,layers=4,heads=8,kv_heads=8,head_dim=64,ffn=2048,context=512") {
    failures.push(`${prefix} provenance source shape was ${snapshot.provenanceSourceShape}`);
  }
  if (snapshot.provenanceSourceReview !== "unavailable") {
    failures.push(`${prefix} provenance source review was ${snapshot.provenanceSourceReview}`);
  }
  if (snapshot.provenanceSourceReviewRoutes !== "unavailable") {
    failures.push(`${prefix} provenance source review routes were ${snapshot.provenanceSourceReviewRoutes}`);
  }
  if (snapshot.provenanceSourceReviewArtifacts !== "unavailable") {
    failures.push(`${prefix} provenance source review artifacts were ${snapshot.provenanceSourceReviewArtifacts}`);
  }
  if (snapshot.provenanceSourceTokenizerImport !== "unavailable") {
    failures.push(`${prefix} provenance source tokenizer import was ${snapshot.provenanceSourceTokenizerImport}`);
  }
  if (snapshot.provenanceSourceValidation !== "unavailable") {
    failures.push(`${prefix} provenance source validation was ${snapshot.provenanceSourceValidation}`);
  }
  if (snapshot.provenanceAdmission !== "accepted-for-runtime-smoke") {
    failures.push(`${prefix} provenance admission was ${snapshot.provenanceAdmission}`);
  }
  if (snapshot.provenanceQualityClaim !== "runtime-execution-smoke-only") {
    failures.push(`${prefix} provenance quality claim was ${snapshot.provenanceQualityClaim}`);
  }
  if (snapshot.provenanceTrainedClaim !== "not-claimed") {
    failures.push(`${prefix} provenance trained claim was ${snapshot.provenanceTrainedClaim}`);
  }
  if (snapshot.provenanceGenome !== "unavailable") {
    failures.push(`${prefix} provenance genome was ${snapshot.provenanceGenome}`);
  }
  if (snapshot.provenanceSpecies !== "unavailable") {
    failures.push(`${prefix} provenance species was ${snapshot.provenanceSpecies}`);
  }
  if (snapshot.provenanceNovelty !== "unavailable") {
    failures.push(`${prefix} provenance novelty was ${snapshot.provenanceNovelty}`);
  }
  if (snapshot.provenancePopulation !== "unavailable") {
    failures.push(`${prefix} provenance population was ${snapshot.provenancePopulation}`);
  }
  if (snapshot.provenanceMateSelection !== "unavailable") {
    failures.push(`${prefix} provenance mate selection was ${snapshot.provenanceMateSelection}`);
  }
  if (snapshot.provenanceOperator !== "unavailable") {
    failures.push(`${prefix} provenance operator was ${snapshot.provenanceOperator}`);
  }
  if (snapshot.provenanceSchedule !== "unavailable") {
    failures.push(`${prefix} provenance schedule was ${snapshot.provenanceSchedule}`);
  }
  if (snapshot.provenancePhenotype !== "unavailable") {
    failures.push(`${prefix} provenance phenotype was ${snapshot.provenancePhenotype}`);
  }
  if (snapshot.provenanceArtifact !== "unavailable") {
    failures.push(`${prefix} provenance artifact was ${snapshot.provenanceArtifact}`);
  }
  if (snapshot.provenanceFitness !== "unavailable") {
    failures.push(`${prefix} provenance fitness was ${snapshot.provenanceFitness}`);
  }
  if (snapshot.provenanceEvalCases !== "unavailable") {
    failures.push(`${prefix} provenance eval cases were ${snapshot.provenanceEvalCases}`);
  }
  if (snapshot.provenanceEvalChecksum !== "unavailable") {
    failures.push(`${prefix} provenance eval checksum was ${snapshot.provenanceEvalChecksum}`);
  }
  if (!String(snapshot.provenanceChecksum).startsWith("0x")) {
    failures.push(`${prefix} provenance checksum was ${snapshot.provenanceChecksum}`);
  }
  if (snapshot.provenanceNextGate !== "replace-with-trained-or-evaluated-model-before-product-quality-claim") {
    failures.push(`${prefix} provenance next gate was ${snapshot.provenanceNextGate}`);
  }
  if (snapshot.modulePlanState !== "none") {
    failures.push(`${prefix} module plan state was ${snapshot.modulePlanState}`);
  }
  if (snapshot.modulePlanStack !== "unavailable") {
    failures.push(`${prefix} module plan stack was ${snapshot.modulePlanStack}`);
  }
  if (snapshot.modulePlanModelBudget !== "unavailable") {
    failures.push(`${prefix} module plan model budget was ${snapshot.modulePlanModelBudget}`);
  }
  if (snapshot.modulePlanAdapterBudget !== "unavailable") {
    failures.push(`${prefix} module plan adapter budget was ${snapshot.modulePlanAdapterBudget}`);
  }
  if (snapshot.modulePlanAdapterStackBudget !== "unavailable") {
    failures.push(`${prefix} module plan adapter stack budget was ${snapshot.modulePlanAdapterStackBudget}`);
  }
  if (snapshot.modulePlanScratchBudget !== "unavailable") {
    failures.push(`${prefix} module plan scratch budget was ${snapshot.modulePlanScratchBudget}`);
  }
  if (snapshot.modulePlanPromptLimit !== "unavailable") {
    failures.push(`${prefix} module plan prompt limit was ${snapshot.modulePlanPromptLimit}`);
  }
  if (snapshot.modulePlanOutputLimit !== "unavailable") {
    failures.push(`${prefix} module plan output limit was ${snapshot.modulePlanOutputLimit}`);
  }
  if (snapshot.modulePlanKvCacheBudget !== "unavailable") {
    failures.push(`${prefix} module plan KV cache budget was ${snapshot.modulePlanKvCacheBudget}`);
  }
  if (snapshot.modulePlanKvCachePages !== "unavailable") {
    failures.push(`${prefix} module plan KV cache pages was ${snapshot.modulePlanKvCachePages}`);
  }
  if (snapshot.modulePlanTotalBudget !== "unavailable") {
    failures.push(`${prefix} module plan total budget was ${snapshot.modulePlanTotalBudget}`);
  }
  if (snapshot.modulePlanTotalLimit !== "unavailable") {
    failures.push(`${prefix} module plan total limit was ${snapshot.modulePlanTotalLimit}`);
  }
  if (snapshot.modulePlanExecution !== "unavailable") {
    failures.push(`${prefix} module plan execution profile was ${snapshot.modulePlanExecution}`);
  }
  if (snapshot.modulePlanFetch !== "unavailable") {
    failures.push(`${prefix} module plan fetch policy was ${snapshot.modulePlanFetch}`);
  }
  if (snapshot.modulePlanOrigin !== "unavailable") {
    failures.push(`${prefix} module plan origin policy was ${snapshot.modulePlanOrigin}`);
  }
  if (snapshot.modulePlanFetchLimit !== "unavailable") {
    failures.push(`${prefix} module plan fetch limit was ${snapshot.modulePlanFetchLimit}`);
  }
  if (snapshot.modulePlanPlannedFetchCount !== "unavailable") {
    failures.push(`${prefix} module plan planned fetch count was ${snapshot.modulePlanPlannedFetchCount}`);
  }
  if (snapshot.modulePlanActualFetchCount !== "unavailable") {
    failures.push(`${prefix} module plan actual fetch count was ${snapshot.modulePlanActualFetchCount}`);
  }
  if (snapshot.modulePlanRouteSetVersion !== "unavailable") {
    failures.push(`${prefix} module plan route set version was ${snapshot.modulePlanRouteSetVersion}`);
  }
  if (snapshot.modulePlanRouteSetChecksumAlgorithm !== "unavailable") {
    failures.push(`${prefix} module plan route set checksum algorithm was ${snapshot.modulePlanRouteSetChecksumAlgorithm}`);
  }
  if (snapshot.modulePlanRouteSetChecksum !== "unavailable") {
    failures.push(`${prefix} module plan route set checksum was ${snapshot.modulePlanRouteSetChecksum}`);
  }
  if (snapshot.modulePlanActualRouteSetChecksum !== "unavailable") {
    failures.push(`${prefix} module plan actual route set checksum was ${snapshot.modulePlanActualRouteSetChecksum}`);
  }
  if (snapshot.modulePlanWasmPages !== "unavailable") {
    failures.push(`${prefix} module plan WASM pages was ${snapshot.modulePlanWasmPages}`);
  }
  if (snapshot.modulePlanWasmExportSet !== "unavailable") {
    failures.push(`${prefix} module plan WASM ABI was ${snapshot.modulePlanWasmExportSet}`);
  }
  if (snapshot.modulePlanWasmTransferStrategy !== "unavailable") {
    failures.push(`${prefix} module plan WASM transfer strategy was ${snapshot.modulePlanWasmTransferStrategy}`);
  }
  if (snapshot.modulePlanModelReleaseStrategy !== "unavailable") {
    failures.push(`${prefix} module plan model release strategy was ${snapshot.modulePlanModelReleaseStrategy}`);
  }
  if (snapshot.modulePlanRuntimeResetStrategy !== "unavailable") {
    failures.push(`${prefix} module plan runtime reset strategy was ${snapshot.modulePlanRuntimeResetStrategy}`);
  }
  if (snapshot.modulePlanAdapterValidationStrategy !== "unavailable") {
    failures.push(`${prefix} module plan adapter validation strategy was ${snapshot.modulePlanAdapterValidationStrategy}`);
  }
  if (snapshot.modulePlanAdapterValidationCount !== "unavailable") {
    failures.push(`${prefix} module plan adapter validation count was ${snapshot.modulePlanAdapterValidationCount}`);
  }
  if (snapshot.modulePlanAdapterApplyCount !== "unavailable") {
    failures.push(`${prefix} module plan adapter apply count was ${snapshot.modulePlanAdapterApplyCount}`);
  }
  if (snapshot.modulePlanWasmHeapMinBytes !== "unavailable") {
    failures.push(`${prefix} module plan WASM heap floor was ${snapshot.modulePlanWasmHeapMinBytes}`);
  }
  if (snapshot.modulePlanContextTokens !== "unavailable") {
    failures.push(`${prefix} module plan context tokens was ${snapshot.modulePlanContextTokens}`);
  }
  if (snapshot.modulePlanSamplerCap !== "unavailable") {
    failures.push(`${prefix} module plan sampler cap was ${snapshot.modulePlanSamplerCap}`);
  }
  if (snapshot.modulePlanTokenizer !== "unavailable") {
    failures.push(`${prefix} module plan tokenizer was ${snapshot.modulePlanTokenizer}`);
  }
  if (snapshot.modulePlanBytes !== "unavailable") {
    failures.push(`${prefix} module plan bytes were ${snapshot.modulePlanBytes}`);
  }
  if (snapshot.modulePlanActualModuleBytes !== "unavailable") {
    failures.push(`${prefix} module plan actual module bytes were ${snapshot.modulePlanActualModuleBytes}`);
  }
  if (snapshot.modulePlanChecksums !== "unavailable") {
    failures.push(`${prefix} module plan checksums were ${snapshot.modulePlanChecksums}`);
  }
  if (snapshot.modulePlanActualModuleChecksums !== "unavailable") {
    failures.push(`${prefix} module plan actual module checksums were ${snapshot.modulePlanActualModuleChecksums}`);
  }
  if (snapshot.modulePlanSlots !== "unavailable") {
    failures.push(`${prefix} module plan slots were ${snapshot.modulePlanSlots}`);
  }
  if (snapshot.modulePlanRoles !== "unavailable") {
    failures.push(`${prefix} module plan roles were ${snapshot.modulePlanRoles}`);
  }
  if (snapshot.modulePlanPhases !== "unavailable") {
    failures.push(`${prefix} module plan phases were ${snapshot.modulePlanPhases}`);
  }
  if (snapshot.modulePlanDepends !== "unavailable") {
    failures.push(`${prefix} module plan dependencies were ${snapshot.modulePlanDepends}`);
  }
  if (snapshot.modulePlanTrace !== "unavailable") {
    failures.push(`${prefix} module plan trace was ${snapshot.modulePlanTrace}`);
  }
  if (!(snapshot.benchLoadMsValue > 0)) {
    failures.push(`${prefix} benchmark load value was ${snapshot.benchLoadMs}`);
  }
  return failures;
}

function assertUiAudit(result, networkRequests) {
  const failures = [];
  const viewports = [
    ["desktop", result.desktop],
    ["mobile", result.mobile]
  ];
  for (const [viewportName, audit] of viewports) {
    if (!audit || !audit.before || !audit.after || !audit.cleared) {
      failures.push(`${viewportName} audit was missing`);
      continue;
    }
    failures.push(...assertUiSnapshot(audit.before, "ready", viewportName));
    failures.push(...assertUiSnapshot(audit.after, "generated", viewportName));
    failures.push(...assertUiSnapshot(audit.cleared, "cleared", viewportName));
    if (audit.after.response !== "e") {
      failures.push(`${viewportName} generated response was ${JSON.stringify(audit.after.response)}`);
    }
    if (audit.cleared.response !== "e") {
      failures.push(`${viewportName} response changed after transcript clear: ${JSON.stringify(audit.cleared.response)}`);
    }
    if (!String(audit.after.console).includes("generate(max_new_tokens=1, temperature=0, top_k=1, top_p=1, seed=1) -> 0")) {
      failures.push(`${viewportName} console did not show successful generation`);
    }
    if (!audit.after.diagnostics || audit.after.diagnostics.last_error !== "ok") {
      failures.push(`${viewportName} diagnostics last_error was not ok`);
    }
    if (audit.after.diagnostics.generated_token_count !== 1) {
      failures.push(`${viewportName} generated token count was ${audit.after.diagnostics.generated_token_count}`);
    }
    if (audit.after.diagnostics.prompt_token_count !== 3) {
      failures.push(`${viewportName} prompt token count was ${audit.after.diagnostics.prompt_token_count}`);
    }
    if (audit.after.diagnostics.kv_cache_length !== 4) {
      failures.push(`${viewportName} kv cache length was ${audit.after.diagnostics.kv_cache_length}`);
    }
    if (audit.after.diagnostics.selected_next_token !== 101) {
      failures.push(`${viewportName} selected next token was ${audit.after.diagnostics.selected_next_token}`);
    }
    if (!String(audit.after.diagnostics.tokenizer_output || "").includes("104")) {
      failures.push(`${viewportName} tokenizer output did not include prompt byte tokens`);
    }
    if (!String(audit.after.diagnostics.logits_summary || "").includes("argmax=101")) {
      failures.push(`${viewportName} logits summary did not include argmax=101`);
    }
    if (!String(audit.after.diagnostics.top_k_candidates || "").includes("101:")) {
      failures.push(`${viewportName} top-k candidates did not include token 101`);
    }
    if (audit.after.benchPromptTokensValue !== 3) {
      failures.push(`${viewportName} benchmark prompt tokens were ${audit.after.benchPromptTokens}`);
    }
    if (audit.after.benchGeneratedTokensValue !== 1) {
      failures.push(`${viewportName} benchmark generated tokens were ${audit.after.benchGeneratedTokens}`);
    }
    if (!(audit.after.benchScratchValue > 0)) {
      failures.push(`${viewportName} benchmark scratch was ${audit.after.benchScratch}`);
    }
  }
  const allowedOrigin = new URL(appUrl).origin;
  for (const requestUrl of networkRequests) {
    if (!requestUrl.startsWith("http://") && !requestUrl.startsWith("https://")) {
      continue;
    }
    const origin = new URL(requestUrl).origin;
    if (origin !== allowedOrigin) {
      failures.push(`remote request observed: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertSourceOptionsSmoke(result, networkRequests) {
  const failures = [];
  const requiredLabels = ["Your Local Files", "Hugging Face", "P2P Exchange"];
  const requiredSetupLabels = ["Local .slm", "Hugging Face", "P2P import", "Advanced tools"];
  const requiredStarterCards = ["Summarize this article", "Explain code", "Rewrite text", "Generate JSON"];
  if (!result || !result.initial || !result.sidebarHf || !result.sidebarP2p || !result.sidebarLocal || !result.sidebarAdvanced || !result.external || !result.p2p || !result.local || !result.advanced) {
    failures.push("source-option result was incomplete");
  } else {
    if (result.initial.mode !== "simple") {
      failures.push(`initial mode was ${result.initial.mode}`);
    }
    if (result.initial.discoveryVisible) {
      failures.push("model source popover was open before the user requested it");
    }
    if (!result.initial.maxTokensVisible || !result.initial.advancedModelVisible || !result.initial.railVisible) {
      failures.push("advanced dashboard controls were not visible on desktop first load");
    }
    if (!result.initial.promptVisible || !result.initial.generateVisible) {
      failures.push("chat prompt and Generate were not visible in initial Simple Mode");
    }
    if (result.initial.starterCardCount < 4) {
      failures.push(`starter cards were missing in initial Simple Mode: ${result.initial.starterCardCount}`);
    }
    for (const label of requiredStarterCards) {
      if (!result.initial.starterLabels.some((text) => text.includes(label))) {
        failures.push(`missing starter action ${label}`);
      }
    }
    if (!result.initial.modeButtonLabels.some((text) => text.includes("Advanced Tools"))) {
      failures.push(`Advanced Tools button label was missing: ${JSON.stringify(result.initial.modeButtonLabels)}`);
    }
    for (const label of requiredLabels) {
      if (!result.initial.sourceLabels.some((text) => text.includes(label))) {
        failures.push(`missing source option ${label}`);
      }
    }
    for (const label of requiredSetupLabels) {
      if (!result.initial.setupLabels.some((text) => text.includes(label))) {
        failures.push(`missing sidebar setup action ${label}: ${JSON.stringify(result.initial.setupLabels)}`);
      }
    }
    if (result.sidebarHf.mode !== "simple" || result.sidebarHf.activeSource !== "huggingface" || !result.sidebarHf.discoveryVisible || !result.sidebarHf.hfVisible || !result.sidebarHf.setupPressed.includes("huggingface")) {
      failures.push(`sidebar Hugging Face setup state was ${JSON.stringify(result.sidebarHf)}`);
    }
    if (result.sidebarP2p.mode !== "simple" || result.sidebarP2p.activeSource !== "p2p" || !result.sidebarP2p.discoveryVisible || !result.sidebarP2p.p2pVisible || !result.sidebarP2p.setupPressed.includes("p2p")) {
      failures.push(`sidebar P2P setup state was ${JSON.stringify(result.sidebarP2p)}`);
    }
    if (result.sidebarLocal.mode !== "simple" || result.sidebarLocal.activeSource !== "local" || !result.sidebarLocal.discoveryVisible || !result.sidebarLocal.localVisible || !result.sidebarLocal.setupPressed.includes("local")) {
      failures.push(`sidebar local setup state was ${JSON.stringify(result.sidebarLocal)}`);
    }
    if (result.sidebarAdvanced.mode !== "advanced" || !result.sidebarAdvanced.railVisible || result.sidebarAdvanced.discoveryVisible) {
      failures.push(`sidebar advanced setup state was ${JSON.stringify(result.sidebarAdvanced)}`);
    }
    if (result.external.mode !== "simple" || result.external.activeSource !== "huggingface" || !result.external.discoveryVisible || !result.external.hfVisible) {
      failures.push(`external source state was ${JSON.stringify(result.external)}`);
    }
    if (result.p2p.activeSource !== "p2p" || !result.p2p.p2pVisible || result.p2p.hfVisible) {
      failures.push(`p2p source state was ${JSON.stringify(result.p2p)}`);
    }
    if (result.local.activeSource !== "local" || !result.local.localVisible || result.local.p2pVisible) {
      failures.push(`local source state was ${JSON.stringify(result.local)}`);
    }
    if (
      result.advanced.mode !== "advanced" ||
      !result.advanced.advancedModelVisible ||
      !result.advanced.maxTokensVisible ||
      !result.advanced.hfAdvancedVisible ||
      !result.advanced.catalogVisible ||
      !result.advanced.localImportVisible ||
      !result.advanced.railVisible
    ) {
      failures.push(`advanced source state was ${JSON.stringify(result.advanced)}`);
    }
  }
  for (const requestUrl of networkRequests) {
    if (requestUrl.includes("huggingface.co")) {
      failures.push(`Hugging Face search ran before explicit search: ${requestUrl}`);
    }
    if (requestUrl.includes("MiniModel.org") || requestUrl.includes("minimodel.org")) {
      failures.push(`MiniModel catalog loaded before explicit catalog load: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertHfSearchUiSmoke(result, networkRequests) {
  const failures = [];
  if (!result || typeof result !== "object") {
    failures.push("Hugging Face search result was missing");
  } else {
    if (result.initiallyOpen) {
      failures.push("model source popover was open before the user requested it");
    }
    if (!result.panelOpenImmediatelyAfterSearchClick || result.panelHiddenImmediatelyAfterSearchClick) {
      failures.push(`Search Metadata click immediately closed the source popover: ${JSON.stringify(result)}`);
    }
    if (!result.panelOpenImmediatelyAfterRefilterClick || result.panelHiddenImmediatelyAfterRefilterClick) {
      failures.push(`Repeated Search Metadata click closed the source popover: ${JSON.stringify(result)}`);
    }
    if (!result.panelOpenAfterSearch || result.panelHiddenAfterSearch) {
      failures.push(`Hugging Face search closed the source popover before handoff actions: ${JSON.stringify(result)}`);
    }
    if (!result.hfVisibleAfterSearch || result.localVisibleAfterSearch || result.p2pVisibleAfterSearch) {
      failures.push(`Hugging Face source panel state after search was ${JSON.stringify(result)}`);
    }
    if (!result.panelOpen || result.panelHidden) {
      failures.push(`Hugging Face handoff action closed the source popover: ${JSON.stringify(result)}`);
    }
    if (!result.hfVisible || result.localVisible || result.p2pVisible) {
      failures.push(`Hugging Face source panel state after handoff was ${JSON.stringify(result)}`);
    }
    if (result.resultCount !== 2 || result.advancedResultCount !== 2) {
      failures.push(`Hugging Face result counts were ${result.resultCount}/${result.advancedResultCount}`);
    }
    const resultText = [
      ...(Array.isArray(result.simpleTexts) ? result.simpleTexts : []),
      ...(Array.isArray(result.advancedTexts) ? result.advancedTexts : []),
      ...(Array.isArray(result.actionTexts) ? result.actionTexts : []),
      ...(Array.isArray(result.actionTextsAfterSearch) ? result.actionTextsAfterSearch : []),
      ...(Array.isArray(result.actionTextsAfterP2pDisable) ? result.actionTextsAfterP2pDisable : [])
    ].join(" ");
    const simpleActionTextAfterSearch = (Array.isArray(result.actionTextsAfterSearch) ? result.actionTextsAfterSearch : []).join(" ");
    const simpleActionTextAfterP2pDisable = (Array.isArray(result.actionTextsAfterP2pDisable) ? result.actionTextsAfterP2pDisable : []).join(" ");
    const primaryActionsAfterSearch = Array.isArray(result.primaryActionTextsAfterSearch) ? result.primaryActionTextsAfterSearch : [];
    const primaryActionsAfterP2pDisable = Array.isArray(result.primaryActionTextsAfterP2pDisable) ? result.primaryActionTextsAfterP2pDisable : [];
    if (!resultText.includes("Rust conversion required")) {
      failures.push(`unmatched Hugging Face result did not show Rust conversion required: ${resultText}`);
    }
    if (!resultText.includes("not compatible yet")) {
      failures.push(`unmatched Hugging Face result did not make compatibility state plain: ${resultText}`);
    }
    if (!String(result.p2pStatusAfterSearch || "").includes("P2P on") || result.p2pWarningVisibleAfterSearch) {
      failures.push(`P2P was not enabled by default for Hugging Face results: ${JSON.stringify(result)}`);
    }
    if (!simpleActionTextAfterSearch.includes("P2P Import")) {
      failures.push(`peer-ready Hugging Face result did not offer P2P Import while P2P was on: ${simpleActionTextAfterSearch}`);
    }
    if (!resultText.includes("P2P available") || !resultText.includes("P2P source listed")) {
      failures.push(`peer-ready Hugging Face result did not explain catalog peer availability: ${resultText}`);
    }
    if (!String(result.peerUrlStatusBeforeImport || "").includes("Enter the consenting peer URL once")) {
      failures.push(`manual peer URL should not be required before catalog-sourced P2P Import: ${result.peerUrlStatusBeforeImport}`);
    }
    if (!simpleActionTextAfterSearch.includes("Start Conversion")) {
      failures.push(`unmatched Hugging Face result did not offer Start Conversion: ${simpleActionTextAfterSearch}`);
    }
    if (!resultText.includes("Source file listed: model.safetensors")) {
      failures.push(`unmatched Hugging Face result did not surface the safetensors source file: ${resultText}`);
    }
    if (result.simpleSourceHintCountAfterSearch < 1 || result.advancedSourceHintCountAfterSearch < 1) {
      failures.push(`source-file hint drifted between simple and advanced Hugging Face rows: simple=${result.simpleSourceHintCountAfterSearch}, advanced=${result.advancedSourceHintCountAfterSearch}`);
    }
    if (primaryActionsAfterSearch.length !== 2 || !primaryActionsAfterSearch.includes("Start Conversion") || !primaryActionsAfterSearch.includes("P2P Import")) {
      failures.push(`simple Hugging Face primary actions with P2P on were ${JSON.stringify(primaryActionsAfterSearch)}`);
    }
    if (!Array.isArray(result.peerImportDownloadNames) || !result.peerImportDownloadNames.some((name) => String(name).endsWith(".minimodel-peer-import-request.json")) || !result.peerImportDownloadNames.some((name) => String(name).endsWith(".minimodel-peer-import.ps1"))) {
      failures.push(`P2P Import did not save peer import request and script: ${JSON.stringify(result.peerImportDownloadNames)}`);
    }
    let peerRequest = null;
    try {
      peerRequest = result.peerImportRequestText ? JSON.parse(result.peerImportRequestText) : null;
    } catch (error) {
      failures.push(`P2P import request was not JSON: ${error.message}`);
    }
    if (!peerRequest || peerRequest.request_kind !== "minimodel.peer_import_request.v0") {
      failures.push(`P2P import request kind was ${peerRequest && peerRequest.request_kind}`);
    } else {
      if (peerRequest.boundary.project_server_serves_model_bytes !== false || peerRequest.boundary.project_server_runs_model_bytes !== false) {
        failures.push(`P2P import request boundary allowed project server bytes/execution: ${JSON.stringify(peerRequest.boundary)}`);
      }
      if (peerRequest.model.artifact_sha256 !== "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef") {
        failures.push(`P2P import request artifact SHA-256 was ${peerRequest.model.artifact_sha256}`);
      }
      if (peerRequest.minimodel_metadata.peer_offer_sha256 !== "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd") {
        failures.push(`P2P import request peer offer SHA-256 was ${peerRequest.minimodel_metadata.peer_offer_sha256}`);
      }
      if (!Array.isArray(peerRequest.local_peer_piece_contract.rust_commands) || !peerRequest.local_peer_piece_contract.rust_commands.some((command) => command.includes("import-peer-request"))) {
        failures.push(`P2P import request did not include import-peer-request command: ${JSON.stringify(peerRequest.local_peer_piece_contract)}`);
      }
      if (peerRequest.local_peer_piece_contract.expected_peer_base_url !== "http://127.0.0.1:8123/") {
        failures.push(`P2P import request did not include the saved peer base URL: ${JSON.stringify(peerRequest.local_peer_piece_contract)}`);
      }
      if (!Array.isArray(peerRequest.local_peer_piece_contract.peer_side_commands) || !peerRequest.local_peer_piece_contract.peer_side_commands.some((command) => command.includes("serve-peer-pieces"))) {
        failures.push(`P2P import request did not include peer-side serve command: ${JSON.stringify(peerRequest.local_peer_piece_contract)}`);
      }
      if (!Array.isArray(peerRequest.local_peer_piece_contract.peer_side_commands) || !peerRequest.local_peer_piece_contract.peer_side_commands.some((command) => command.includes("prepare-peer-share"))) {
        failures.push(`P2P import request did not include peer-side prepare command: ${JSON.stringify(peerRequest.local_peer_piece_contract)}`);
      }
      if (peerRequest.local_peer_piece_contract.peer_side_commands.some((command) => command.includes("export-peer-pieces"))) {
        failures.push(`P2P import request exposed low-level export-peer-pieces command: ${JSON.stringify(peerRequest.local_peer_piece_contract)}`);
      }
    }
    const peerScriptText = String(result.peerImportScriptText || "");
    for (const required of [
      "import-peer-request",
      "serve-peer-pieces",
      "does not download model bytes from MiniModel.org",
      "metadata manifest",
      "Resolve-ExistingPath",
      "MINIMODEL_WORKSPACE",
      "$CandidateMiniModelWorkspaces",
      "$PeerImportRequest = Join-Path $PSScriptRoot",
      "$ManifestUrl",
      "$ImportDir = Join-Path $PSScriptRoot",
      "$ExpectedPeerBaseUrl",
      "MiniModel workspace:",
      "Peer import request:",
      "MiniModel manifest:",
      "Verified output directory:",
      "http://127.0.0.1:8123/"
    ]) {
      if (!peerScriptText.includes(required)) {
        failures.push(`P2P import script missing ${required}: ${peerScriptText}`);
      }
    }
    if (peerScriptText.includes("EDIT_ME\\\\MiniModel.org")) {
      failures.push(`P2P import script still required placeholder MiniModel workspace edit: ${peerScriptText}`);
    }
    if (!String(result.statusAfterP2pImport || "").includes("P2P import request saved") || !String(result.hfStatusAfterP2pImport || "").includes("P2P import request saved")) {
      failures.push(`P2P Import status was ${result.statusAfterP2pImport}/${result.hfStatusAfterP2pImport}`);
    }
    if (!String(result.p2pStatusAfterDisable || "").includes("P2P off") || !result.p2pWarningVisibleAfterDisable) {
      failures.push(`P2P disabled state did not show the list-level warning: ${JSON.stringify(result)}`);
    }
    if (result.p2pWarningCount !== 1) {
      failures.push(`P2P disabled warning should be list-level only, found ${result.p2pWarningCount}`);
    }
    if (!String(result.p2pWarningTextAfterDisable || "").includes("Local conversion can take a while")) {
      failures.push(`P2P disabled warning did not explain the conversion delay: ${result.p2pWarningTextAfterDisable}`);
    }
    if (simpleActionTextAfterP2pDisable.includes("P2P Import")) {
      failures.push(`P2P Import remained visible after disabling P2P: ${simpleActionTextAfterP2pDisable}`);
    }
    if (!simpleActionTextAfterP2pDisable.includes("Start Conversion")) {
      failures.push(`Start Conversion was not available after disabling P2P: ${simpleActionTextAfterP2pDisable}`);
    }
    if (primaryActionsAfterP2pDisable.length !== 2 || primaryActionsAfterP2pDisable.some((label) => label !== "Start Conversion")) {
      failures.push(`simple Hugging Face primary actions with P2P off were ${JSON.stringify(primaryActionsAfterP2pDisable)}`);
    }
    for (const removedSimpleAction of ["Choose converted .slm", "Save Conversion Request", "Save Rust Conversion Script"]) {
      if (simpleActionTextAfterSearch.includes(removedSimpleAction) || simpleActionTextAfterP2pDisable.includes(removedSimpleAction)) {
        failures.push(`simple Hugging Face result still showed ${removedSimpleAction}: ${simpleActionTextAfterSearch} / ${simpleActionTextAfterP2pDisable}`);
      }
    }
    if (resultText.includes("Import Local .slm")) {
      failures.push(`Hugging Face result still used fake import wording: ${resultText}`);
    }
    if (resultText.includes("Download tiny-ready.slm") || resultText.includes("/resolve/")) {
      failures.push(`Hugging Face result exposed a direct model-byte download affordance: ${resultText}`);
    }
    if (!String(result.statusAfterSearch || "").includes("2 external records") || !String(result.hfStatusAfterSearch || "").includes("2 external records")) {
      failures.push(`Hugging Face status after search was ${result.statusAfterSearch}/${result.hfStatusAfterSearch}`);
    }
    if (!String(result.status || "").includes("Rust conversion script saved") || !String(result.hfStatus || "").includes("Rust conversion script saved")) {
      failures.push(`Hugging Face status after Start Conversion was ${result.status}/${result.hfStatus}`);
    }
    if (!Array.isArray(result.conversionDownloadNames) || result.conversionDownloadNames.length < 2) {
      failures.push(`Start Conversion did not save both request and script: ${JSON.stringify(result.conversionDownloadNames)}`);
    }
    if (!String(result.conversionRequestName || "").endsWith(".minimodel-conversion-request.json")) {
      failures.push(`conversion request download name was ${result.conversionRequestName}`);
    }
    let conversionRequest = null;
    try {
      conversionRequest = JSON.parse(String(result.conversionRequestText || ""));
    } catch (error) {
      failures.push(`conversion request JSON was invalid: ${error.message} / ${result.conversionRequestText}`);
    }
    if (conversionRequest) {
      if (conversionRequest.request_kind !== "minimodel.huggingface_conversion_request.v0") {
        failures.push(`conversion request kind was ${conversionRequest.request_kind}`);
      }
      if (!conversionRequest.source || conversionRequest.source.model_id !== "example-org/tiny-source-model") {
        failures.push(`conversion request source model was ${JSON.stringify(conversionRequest.source)}`);
      }
      if (!conversionRequest.local_conversion || conversionRequest.local_conversion.suggested_source_safetensors_file !== "model.safetensors") {
        failures.push(`conversion request source file was ${JSON.stringify(conversionRequest.local_conversion)}`);
      }
      if (!conversionRequest.boundary || conversionRequest.boundary.project_server_runs_model_bytes !== false || conversionRequest.boundary.project_server_serves_model_bytes !== false) {
        failures.push(`conversion request boundary was ${JSON.stringify(conversionRequest.boundary)}`);
      }
      if (!String(conversionRequest.local_conversion.command_shape || "").includes("convert-huggingface-request")) {
        failures.push(`conversion request command shape did not use convert-huggingface-request: ${conversionRequest.local_conversion.command_shape}`);
      }
      if (!String(conversionRequest.local_conversion.peer_source_shape || "").includes("add-peer-source")) {
        failures.push(`conversion request peer source shape did not use add-peer-source: ${conversionRequest.local_conversion.peer_source_shape}`);
      }
      if (!String(conversionRequest.local_conversion.peer_source_announcement_shape || "").includes("write-peer-source-announcement")) {
        failures.push(`conversion request announcement shape did not use write-peer-source-announcement: ${conversionRequest.local_conversion.peer_source_announcement_shape}`);
      }
      if (!String(conversionRequest.local_conversion.peer_source_apply_shape || "").includes("apply-peer-source-announcements")) {
        failures.push(`conversion request announcement apply shape did not use apply-peer-source-announcements: ${conversionRequest.local_conversion.peer_source_apply_shape}`);
      }
      if (!String(conversionRequest.local_conversion.peer_source_batch_snapshot_shape || "").includes("write-catalog-snapshot-with-announcements")) {
        failures.push(`conversion request batch snapshot shape did not use write-catalog-snapshot-with-announcements: ${conversionRequest.local_conversion.peer_source_batch_snapshot_shape}`);
      }
    }
    const scriptText = String(result.conversionScriptText || "");
    if (!String(result.conversionScriptName || "").endsWith(".tinyrustlm-convert.ps1")) {
      failures.push(`conversion script download name was ${result.conversionScriptName}`);
    }
    for (const required of [
      "convert-huggingface-request",
      "prepare-peer-share",
      "add-peer-source",
      "write-peer-source-announcement",
      "apply-peer-source-announcements",
      "write-catalog-snapshot-with-announcements",
      "write-catalog-snapshot",
      "serve-peer-pieces",
      "Hugging Face metadata source-file candidates",
      "model.safetensors",
      "SuggestedSourceSafetensorsFileName",
      "$ConversionRequest",
      "$EmbeddedConversionRequestBase64",
      "Wrote embedded conversion request:",
      "[System.Convert]::FromBase64String",
      "Resolve-ExistingPath",
      "Resolve-GeneratedFile",
      "Resolve-GeneratedDirectory",
      "TINYRUSTLM_WORKSPACE",
      "MINIMODEL_WORKSPACE",
      "TINYRUSTLM_SOURCE_SAFETENSORS",
      "$CandidateTinyRustLMWorkspaces",
      "$CandidateMiniModelWorkspaces",
      "$SourceSafetensorsCandidates",
      "put the reviewed source file beside this script",
      "TinyRustLM workspace:",
      "MiniModel workspace:",
      "Source safetensors:",
      "$OutputSlm = Resolve-GeneratedFile",
      "$MiniModelCatalogEntry = Resolve-GeneratedFile",
      "$MiniModelManifest = Resolve-GeneratedFile",
      "$MiniModelPieceDir = Resolve-GeneratedDirectory",
      "tinyrustlm-conversion.receipt",
      "KnownPeerBaseUrl",
      "MiniModelCatalogEntryWithPeer",
      "MiniModelCatalogEntryForSnapshot",
      "MiniModelPeerSourceAnnouncement",
      "MiniModelCatalogSnapshot",
      "models.v0.json",
      "MiniModel manifest:",
      "MiniModel peer pieces:",
      "TinyRustLM.com"
    ]) {
      if (!scriptText.includes(required)) {
        failures.push(`conversion script missing ${required}: ${scriptText}`);
      }
    }
    if (scriptText.includes("$OutputSlm = Join-Path $WorkDir")) {
      failures.push("conversion script guessed the output .slm path instead of using Rust-produced output discovery");
    }
    if (scriptText.includes("Conversion request JSON not found beside this script")) {
      failures.push(`conversion script still fails when the sidecar request JSON is missing: ${scriptText}`);
    }
    for (const removedPlaceholder of ["EDIT_ME\\model.safetensors", "EDIT_ME\\\\SLMComposer.com", "EDIT_ME\\\\MiniModel.org"]) {
      if (scriptText.includes(removedPlaceholder)) {
        failures.push(`conversion script still required placeholder edit ${removedPlaceholder}: ${scriptText}`);
      }
    }
    for (const lowLevelCommand of ["inspect-safetensors", "plan-safetensors-source", "convert-safetensors-trained", "validate-manifest"]) {
      if (scriptText.includes(`-- ${lowLevelCommand}`)) {
        failures.push(`conversion script still made users run low-level ${lowLevelCommand}: ${scriptText}`);
      }
    }
    if (scriptText.includes("$PrepareArgs += $KnownPeerBaseUrl")) {
      failures.push(`conversion script passed peer URL into prepare-peer-share before add-peer-source: ${scriptText}`);
    }
    if (scriptText.includes("Invoke-WebRequest") || scriptText.includes("huggingface.co/api")) {
      failures.push(`conversion script attempted remote download/API behavior: ${scriptText}`);
    }
    const bodyText = String(result.bodyText || "");
    for (const fakeText of ["Example conversation", "Can you explain the benefits", "Market research s"]) {
      if (bodyText.includes(fakeText)) {
        failures.push(`first-run UI still contained fake conversation text ${fakeText}: ${bodyText}`);
      }
    }
  }
  const requests = networkRequests.filter((requestUrl) => requestUrl.startsWith("http://") || requestUrl.startsWith("https://"));
  if (!requests.some((requestUrl) => requestUrl.includes("huggingface.co/api/models"))) {
    failures.push(`Hugging Face API metadata request was not observed: ${JSON.stringify(requests)}`);
  }
  if (!requests.some((requestUrl) => requestUrl.toLowerCase().includes("minimodel.org/catalog/models.v0.json"))) {
    failures.push(`MiniModel catalog metadata request was not observed: ${JSON.stringify(requests)}`);
  }
  for (const requestUrl of requests) {
    if (requestUrl.includes("/resolve/")) {
      failures.push(`Hugging Face model bytes were requested: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertHfCatalogAnnouncementRouteSmoke(result, networkRequests) {
  const failures = [];
  try {
    assertHfSearchUiSmoke(result, networkRequests);
  } catch (error) {
    failures.push(error.message || String(error));
  }
  const requests = networkRequests.filter((requestUrl) => requestUrl.startsWith("http://") || requestUrl.startsWith("https://"));
  if (!requests.some((requestUrl) => requestUrl.toLowerCase().includes("minimodel.org/catalog/peer-source-announcements.v0.json"))) {
    failures.push(`catalog-declared peer-source announcement feed was not requested: ${JSON.stringify(requests)}`);
  }
  for (const requestUrl of requests) {
    if (requestUrl.toLowerCase().includes("minimodel.org/models/") || requestUrl.toLowerCase().includes("minimodel.org/catalog/models/")) {
      failures.push(`MiniModel model-byte route was requested: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertHfLocalCatalogSmoke(result, networkRequests) {
  const failures = [];
  if (!result || typeof result !== "object") {
    failures.push("local catalog Hugging Face result was missing");
  } else {
    if (!String(result.localCatalogStatus || "").includes("local MiniModel metadata entries from models.v0.json")) {
      failures.push(`local catalog status was ${result.localCatalogStatus}`);
    }
    if (!Array.isArray(result.catalogResults) || !result.catalogResults.some((text) => String(text).includes("Example Tiny Ready SLM"))) {
      failures.push(`local catalog result did not render the ready entry: ${JSON.stringify(result.catalogResults)}`);
    }
    if (!Array.isArray(result.primaryActionTexts) || !result.primaryActionTexts.includes("P2P Import")) {
      failures.push(`local catalog did not make the matching Hugging Face row P2P-ready: ${JSON.stringify(result.primaryActionTexts)}`);
    }
    const actionText = Array.isArray(result.actionTexts) ? result.actionTexts.join(" | ") : "";
    if (!actionText.includes("P2P source listed") || !actionText.includes("Rust reverify required")) {
      failures.push(`local catalog availability copy was missing: ${actionText}`);
    }
    if (!String(result.statusAfterSearch || "").includes("external records") || !String(result.hfStatusAfterSearch || "").includes("external records")) {
      failures.push(`Hugging Face status after local catalog search was ${result.statusAfterSearch}/${result.hfStatusAfterSearch}`);
    }
    if (!String(result.p2pStatusAfterImport || "").includes("P2P import request saved")) {
      failures.push(`P2P Import from local catalog did not save a request: ${result.p2pStatusAfterImport}`);
    }
    if (!result.panelOpen || !result.hfVisible) {
      failures.push(`local catalog Hugging Face flow closed or hid the source chooser: ${JSON.stringify(result)}`);
    }
    const peerRequest = result.peerImportRequestText ? JSON.parse(result.peerImportRequestText) : null;
    if (!peerRequest) {
      failures.push("local catalog P2P import request was not downloaded");
    } else {
      if (peerRequest.source.huggingface_model_id !== "example-org/tiny-ready-slm") {
        failures.push(`local catalog request source id was ${peerRequest.source.huggingface_model_id}`);
      }
      if (peerRequest.local_peer_piece_contract.expected_peer_base_url !== "http://127.0.0.1:8123/") {
        failures.push(`local catalog request peer URL was ${JSON.stringify(peerRequest.local_peer_piece_contract)}`);
      }
      if (peerRequest.boundary.project_server_serves_model_bytes !== false || peerRequest.boundary.project_server_runs_model_bytes !== false) {
        failures.push(`local catalog request boundary was ${JSON.stringify(peerRequest.boundary)}`);
      }
    }
    const peerScript = String(result.peerImportScriptText || "");
    for (const required of ["import-peer-request", "serve-peer-pieces", "http://127.0.0.1:8123/", "does not download model bytes"]) {
      if (!peerScript.includes(required)) {
        failures.push(`local catalog peer import script missing ${required}: ${peerScript}`);
      }
    }
    const bodyText = String(result.bodyText || "");
    if (bodyText.includes("Choose converted .slm") || bodyText.includes("Download tiny-ready.slm")) {
      failures.push(`local catalog path exposed stale/fake wording: ${bodyText}`);
    }
  }
  const requests = networkRequests.filter((requestUrl) => requestUrl.startsWith("http://") || requestUrl.startsWith("https://"));
  if (!requests.some((requestUrl) => requestUrl.includes("huggingface.co/api/models"))) {
    failures.push(`Hugging Face API metadata request was not observed: ${JSON.stringify(requests)}`);
  }
  for (const requestUrl of requests) {
    if (requestUrl.toLowerCase().includes("minimodel.org/catalog/models.v0.json")) {
      failures.push(`default MiniModel catalog was fetched despite local models.v0.json: ${requestUrl}`);
    }
    if (requestUrl.includes("/resolve/")) {
      failures.push(`Hugging Face model bytes were requested: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertHfPeerAnnouncementSmoke(result, networkRequests) {
  const failures = [];
  try {
    assertHfLocalCatalogSmoke(result, networkRequests);
  } catch (error) {
    failures.push(error.message || String(error));
  }
  if (!result || typeof result !== "object") {
    failures.push("peer announcement result was missing");
  } else {
    if (!String(result.announcementStatus || "").includes("1 peer-source announcement applied")) {
      failures.push(`peer announcement status was ${result.announcementStatus}`);
    }
    const beforeText = Array.isArray(result.catalogResults) ? result.catalogResults.join(" | ") : "";
    if (beforeText.includes("catalog peer listed")) {
      failures.push(`proof-ready catalog already listed a peer source before announcement: ${beforeText}`);
    }
    const afterText = Array.isArray(result.catalogResultsAfterAnnouncement)
      ? result.catalogResultsAfterAnnouncement.join(" | ")
      : "";
    if (!afterText.includes("catalog peer listed")) {
      failures.push(`peer announcement did not update catalog peer source copy: ${afterText}`);
    }
    const bodyText = String(result.bodyText || "");
    if (!bodyText.includes("Apply Peer Announcement")) {
      failures.push("peer announcement controls were not present in the UI");
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertShareMetadataSmoke(result, networkRequests) {
  const failures = [];
  const bundle = result && result.bundle ? result.bundle : {};
  const entry = bundle.catalog_entry || {};
  const offer = bundle.peer_offer || {};
  const chunks = offer.chunks || {};
  if (bundle.bundle_kind !== "minimodel.local_slm_share_metadata.v0") {
    failures.push(`bundle kind was ${bundle.bundle_kind}`);
  }
  if (!result.downloadNames || !result.downloadNames.some((name) => String(name).endsWith(".minimodel-share-metadata.json"))) {
    failures.push(`share metadata download name was ${JSON.stringify(result.downloadNames)}`);
  }
  if (!result.downloadNames || !result.downloadNames.some((name) => String(name).endsWith(".minimodel-share-kit.ps1"))) {
    failures.push(`share kit download name was ${JSON.stringify(result.downloadNames)}`);
  }
  if (entry.artifact_sha256 !== result.fixtureSha256 || offer.artifact_sha256 !== result.fixtureSha256) {
    failures.push(`artifact SHA-256 mismatch in share metadata: ${entry.artifact_sha256}/${offer.artifact_sha256}/${result.fixtureSha256}`);
  }
  if (entry.artifact_byte_count !== result.fixtureBytes || offer.artifact_byte_count !== result.fixtureBytes) {
    failures.push(`artifact bytes mismatch in share metadata: ${entry.artifact_byte_count}/${offer.artifact_byte_count}/${result.fixtureBytes}`);
  }
  if (entry.source_huggingface_model_id !== "example-org/tiny-source-model") {
    failures.push(`source Hugging Face id was ${entry.source_huggingface_model_id}`);
  }
  if (entry.project_server_serves_model_bytes !== false || entry.project_server_runs_model_bytes !== false) {
    failures.push("catalog entry did not preserve no-server model-byte boundary");
  }
  if (!bundle.boundary || bundle.boundary.peer_transfer_implemented !== false || bundle.boundary.project_server_serves_model_bytes !== false) {
    failures.push(`bundle boundary was ${JSON.stringify(bundle.boundary)}`);
  }
  if (offer.offer_status !== "metadata-ready-transfer-not-implemented" || !offer.transfer || offer.transfer.network_transfer_available !== false) {
    failures.push(`peer offer status was ${offer.offer_status}/${JSON.stringify(offer.transfer)}`);
  }
  if (chunks.algorithm !== "sha256-merkle-v0" || chunks.chunk_size !== 1048576 || chunks.chunk_count !== 1) {
    failures.push(`chunk metadata was ${JSON.stringify(chunks)}`);
  }
  if (!/^sha256:[0-9a-f]{64}$/i.test(chunks.merkle_root_sha256 || "")) {
    failures.push(`Merkle root was ${chunks.merkle_root_sha256}`);
  }
  if (!/^sha256:[0-9a-f]{64}$/i.test(chunks.chunk_list_sha256 || "")) {
    failures.push(`chunk list SHA-256 was ${chunks.chunk_list_sha256}`);
  }
  if (!Array.isArray(chunks.entries) || chunks.entries.length !== 1 || chunks.entries[0].sha256 !== result.fixtureSha256) {
    failures.push(`chunk entries were ${JSON.stringify(chunks.entries)}`);
  }
  if (!String(result.shareMetadataState || "").includes("P2P share kit saved locally")) {
    failures.push(`share metadata status was ${result.shareMetadataState}`);
  }
  const scriptText = String(result.shareKitScriptText || "");
  for (const required of [
    "prepare-peer-share",
    "serve-peer-pieces",
    "write-peer-source-announcement",
    "write-peer-source-announcement-feed",
    "write-catalog-snapshot-with-announcement-feed",
    "write-catalog-snapshot",
    "TINYRUSTLM_LOCAL_SLM",
    "ExpectedArtifactSha256",
    "Get-FileHash",
    "never uploads model bytes",
    "Do not upload peer pieces or .slm bytes to project servers"
  ]) {
    if (!scriptText.includes(required)) {
      failures.push(`share kit script missing ${required}: ${scriptText}`);
    }
  }
  if (!String(result.shareKitScriptType || "").startsWith("text/plain")) {
    failures.push(`share kit script type was ${result.shareKitScriptType}`);
  }
  for (const requestUrl of networkRequests) {
    if (requestUrl.includes("huggingface.co") || requestUrl.includes("MiniModel.org") || requestUrl.includes("minimodel.org")) {
      failures.push(`share metadata export made remote request: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertPublicLocalOnlySmoke(result, networkRequests) {
  const failures = [];
  if (result.hostname !== "tinyrustlm.com") {
    failures.push(`hostname was ${result.hostname}`);
  }
  if (result.title !== "TinyRustLM" || result.h1 !== "TinyRustLM") {
    failures.push(`public title/h1 were ${result.title}/${result.h1}`);
  }
  if (result.eyebrow !== "Private Rust/WASM") {
    failures.push(`public eyebrow was ${result.eyebrow}`);
  }
  if (!String(result.notice || "").includes("TinyRustLM.com does not serve runnable model weights")) {
    failures.push(`public notice was ${result.notice}`);
  }
  if (!String(result.footer || "").includes("Local .slm models only")) {
    failures.push(`public footer was ${result.footer}`);
  }
  if (result.wasmState !== "loaded") {
    failures.push(`public WASM state was ${result.wasmState}`);
  }
  if (result.runtimeStatus !== "Runtime ready") {
    failures.push(`public runtime status was ${result.runtimeStatus}`);
  }
  if (result.modelState !== "choose a local .slm file") {
    failures.push(`public model state was ${result.modelState}`);
  }
  if (result.errorState !== "none") {
    failures.push(`public error state was ${result.errorState}`);
  }
  if (result.provenanceState !== "choose a local .slm file") {
    failures.push(`public provenance state was ${result.provenanceState}`);
  }
  if (result.localModelState !== "waiting" || result.hfStatus !== "idle") {
    failures.push(`public local/HF state was ${result.localModelState}/${result.hfStatus}`);
  }
  if (result.catalogUrl !== "https://MiniModel.org/catalog/models.v0.json" || result.catalogStatus !== "idle") {
    failures.push(`public catalog state was ${result.catalogUrl}/${result.catalogStatus}`);
  }
  if (!result.generateDisabled || !result.resetDisabled || !result.modelSelectDisabled) {
    failures.push("public runtime controls were enabled before local import");
  }
  if (result.importLocalModelDisabled) {
    failures.push("public local import button was disabled");
  }
  const options = Array.isArray(result.modelOptions) ? result.modelOptions : [];
  if (options.length !== 1 || options[0].text !== "Choose a local .slm file" || options[0].value !== "") {
    failures.push(`public model options were ${JSON.stringify(options)}`);
  }
  for (const requestUrl of networkRequests) {
    if (requestUrl.includes("/models/")) {
      failures.push(`public model route was requested: ${requestUrl}`);
    }
    if (requestUrl.includes("huggingface.co")) {
      failures.push(`public external discovery ran before user action: ${requestUrl}`);
    }
    if (requestUrl.includes("MiniModel.org") || requestUrl.includes("minimodel.org")) {
      failures.push(`public catalog loaded before user action: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function assertCatalogLocalImportSmoke(result, networkRequests) {
  const failures = [];
  if (result.catalogUrl !== "https://MiniModel.org/catalog/models.v0.json") {
    failures.push(`catalog default URL was ${result.catalogUrl}`);
  }
  if (result.catalogStatus !== "TinyRustLM Fixture q8_0 selected") {
    failures.push(`catalog status was ${result.catalogStatus}`);
  }
  if (!Array.isArray(result.catalogResults) || result.catalogResults.length !== 1) {
    failures.push(`catalog results were ${JSON.stringify(result.catalogResults)}`);
  } else if (!String(result.catalogResults[0]).includes(result.fixtureSha256)) {
    failures.push(`catalog result did not include fixture SHA-256: ${result.catalogResults[0]}`);
  }
  if (result.wasmState !== "loaded" || result.runtimeStatus !== "Ready") {
    failures.push(`runtime state was ${result.wasmState}/${result.runtimeStatus}`);
  }
  if (!String(result.modelState || "").startsWith("loaded")) {
    failures.push(`model state was ${result.modelState}`);
  }
  if (result.errorState !== "none") {
    failures.push(`error state was ${result.errorState}`);
  }
  if (result.selectedModel !== "__local_slm_file") {
    failures.push(`selected model was ${result.selectedModel}`);
  }
  if (!String(result.selectedModelLabel || "").includes("TinyRustLM Fixture q8_0")) {
    failures.push(`selected model label was ${result.selectedModelLabel}`);
  }
  if (!String(result.localModelState || "").includes(result.fixtureSha256) || !String(result.localModelState || "").includes("loaded")) {
    failures.push(`local model state was ${result.localModelState}`);
  }
  if (result.provenanceState !== "local file") {
    failures.push(`provenance state was ${result.provenanceState}`);
  }
  if (result.provenanceSourceKind !== "deterministic-smoke") {
    failures.push(`provenance source kind was ${result.provenanceSourceKind}`);
  }
  if (result.provenanceSourceId !== "tinyrustlm/tiny-test-model-q8") {
    failures.push(`provenance source id was ${result.provenanceSourceId}`);
  }
  if (result.provenanceAdmission !== "accepted-for-runtime-smoke") {
    failures.push(`provenance admission was ${result.provenanceAdmission}`);
  }
  if (result.provenanceQualityClaim !== "runtime-execution-smoke-only") {
    failures.push(`quality claim was ${result.provenanceQualityClaim}`);
  }
  if (result.provenanceTrainedClaim !== "not-claimed") {
    failures.push(`trained claim was ${result.provenanceTrainedClaim}`);
  }
  if (result.provenanceChecksum !== "0xa338bbb579e3e971") {
    failures.push(`provenance checksum was ${result.provenanceChecksum}`);
  }
  if (result.provenanceNextGate !== "user-local-file-import-and-rust-wasm-validation") {
    failures.push(`provenance next gate was ${result.provenanceNextGate}`);
  }
  if (!String(result.response || "").trim()) {
    failures.push("response was empty");
  }
  if (!String(result.console || "").includes("generate(")) {
    failures.push("console did not include generation");
  }
  for (const requestUrl of networkRequests) {
    if (requestUrl.includes("MiniModel.org") || requestUrl.includes("minimodel.org")) {
      failures.push(`default catalog was fetched unexpectedly: ${requestUrl}`);
    }
    if (requestUrl.includes("huggingface.co")) {
      failures.push(`external discovery ran unexpectedly: ${requestUrl}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
}

function installMalformedModelInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/tinylm16-q8.slm")) {
      const malformed = Buffer.alloc(108);
      malformed.write("NOPE", 0, "ascii");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "application/octet-stream" },
          { name: "content-length", value: String(malformed.length) }
        ],
        body: malformed.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function installMissingModelInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/tinylm16-q8.slm")) {
      const body = Buffer.from("missing model for browser smoke", "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 404,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function installCorruptAdapterInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/tiny-test-model-self.adp1")) {
      const adapterPath = path.join(__dirname, "..", "models", "tiny-test-model-self.adp1");
      const body = Buffer.from(fs.readFileSync(adapterPath));
      body[body.length - 1] ^= 0xff;
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "application/octet-stream" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function installAdapterManifestBudgetInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("-sparse.asp1.manifest")) {
      const body = Buffer.alloc((64 * 1024) + 1, "a", "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function registryOperatorFixtureForMode(mode, candidateArtifactBytes = "17160000") {
  // Supplies compact selector entries for operator receipt provenance smokes.
  if (mode === "blend-operator-registry" || mode === "blend-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-blend-q8",
      displayName: "TinyLM-16M q8 blend candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-blend.operator",
      operatorChecksum: "0x00000000000000b4",
      operatorId: "blend-q8",
      operatorKind: "direct-parameter-weighted-average",
      candidateArtifactBytes
    };
  }
  if (mode === "delta-operator-registry" || mode === "delta-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-delta-q8",
      displayName: "TinyLM-16M q8 delta candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-delta.operator",
      operatorChecksum: "0x00000000000000b5",
      operatorId: "delta-q8",
      operatorKind: "direct-parameter-task-delta",
      candidateArtifactBytes
    };
  }
  if (mode === "sparse-delta-operator-registry" || mode === "sparse-delta-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-sparse-delta-q8",
      displayName: "TinyLM-16M q8 sparse-delta candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-sparse-delta.operator",
      operatorChecksum: "0x00000000000000b6",
      operatorId: "sparse-delta-q8",
      operatorKind: "sparse-direct-parameter-task-delta",
      candidateArtifactBytes
    };
  }
  if (mode === "dare-operator-registry" || mode === "dare-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-dare-q8",
      displayName: "TinyLM-16M q8 DARE candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-dare.operator",
      operatorChecksum: "0x00000000000000b7",
      operatorId: "dare-q8",
      operatorKind: "dropout-rescaled-task-delta",
      candidateArtifactBytes
    };
  }
  if (mode === "prune-operator-registry" || mode === "prune-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-prune-q8",
      displayName: "TinyLM-16M q8 prune candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-prune.operator",
      operatorChecksum: "0x00000000000000b1",
      operatorId: "prune-q8",
      operatorKind: "deterministic-magnitude-parameter-pruning",
      candidateArtifactBytes
    };
  }
  if (mode === "crossover-operator-registry" || mode === "crossover-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-crossover-q8",
      displayName: "TinyLM-16M q8 crossover candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-crossover.operator",
      operatorChecksum: "0x00000000000000b2",
      operatorId: "crossover-q8",
      operatorKind: "deterministic-direct-parameter-crossover",
      candidateArtifactBytes
    };
  }
  if (mode === "mutation-operator-registry" || mode === "mutation-operator-receipt-drift") {
    return {
      candidateId: "tinylm16-mutation-q8",
      displayName: "TinyLM-16M q8 mutation candidate",
      mateSelectionStatus: "admission-only",
      mateSelectionParentCount: "1",
      operatorPath: "tinyrustlm/models/tinylm16-q8-mutation.operator",
      operatorChecksum: "0x00000000000000b3",
      operatorId: "mutation-q8",
      operatorKind: "deterministic-bounded-parameter-mutation",
      candidateArtifactBytes
    };
  }
  return {
    candidateId: "multi-parent-sign-merge-q8",
    displayName: "Multi-parent sign-merge q8_0",
    mateSelectionStatus: "parent-pool-bound",
    mateSelectionParentCount: "3",
    operatorPath: "tinyrustlm/models/tinylm16-q8-federated.operator",
    operatorChecksum: "0x00000000000000b0",
    operatorId: "federated-local-update-q8",
    operatorKind: "federated-local-update-average",
    candidateArtifactBytes
  };
}

function expectedRegistryOperatorKindForModel(modelKey) {
  // Matches the operator kind expected from the compact selector fixture.
  if (modelKey === "tinylm16-blend-q8") {
    return "direct-parameter-weighted-average";
  }
  if (modelKey === "tinylm16-delta-q8") {
    return "direct-parameter-task-delta";
  }
  if (modelKey === "tinylm16-sparse-delta-q8") {
    return "sparse-direct-parameter-task-delta";
  }
  if (modelKey === "tinylm16-dare-q8") {
    return "dropout-rescaled-task-delta";
  }
  if (modelKey === "tinylm16-prune-q8") {
    return "deterministic-magnitude-parameter-pruning";
  }
  if (modelKey === "tinylm16-crossover-q8") {
    return "deterministic-direct-parameter-crossover";
  }
  if (modelKey === "tinylm16-mutation-q8") {
    return "deterministic-bounded-parameter-mutation";
  }
  if (modelKey === "multi-parent-sign-merge-q8" && smokeMode === "multi-parent-registry") {
    return "federated-local-update-average";
  }
  return "";
}

// Serves a compact registry fixture that exercises selector provenance and operator receipt rendering.
function installMultiParentRegistryInterceptor(client, fixture = registryOperatorFixtureForMode(smokeMode)) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/selector.registry")) {
      const body = Buffer.from([
        "tinyrustlm_selector_registry_version=1",
        "selector_id=browser-local-selector",
        "registry_scope=browser-local-model-selector",
        "registry_status=admitted-records-only",
        "selector_model_byte_budget=33554432",
        "selector_registry_text_byte_budget=262144",
        "manifest_text_byte_budget=65536",
        "receipt_text_byte_budget=131072",
        "evidence_text_byte_budget=131072",
        "entry_count=1",
        "admission_set_checksum=0x0000000000000049",
        `entry.0.candidate_id=${fixture.candidateId}`,
        `entry.0.display_name=${fixture.displayName}`,
        "entry.0.model_path=../models/tinylm16-q8.slm",
        "entry.0.manifest_path=../models/tinylm16-q8.slm.manifest",
        "entry.0.artifact_path=tinyrustlm/models/tinylm16-q8.slm",
        "entry.0.max_tokens=8",
        "entry.0.model_bytes=17160000",
        "entry.0.slm_checksum=0xa1442f3f180c542b",
        "entry.0.model_shape=vocab=260,hidden=512,layers=4,heads=8,kv_heads=8,head_dim=64,ffn=2048,context=512",
        "entry.0.quantization=q8_0",
        "entry.0.output_contract=separate-output-weight",
        "entry.0.genome_id=0x00000000000000a1",
        "entry.0.genome_strategy=selector-admission-genome-v1",
        "entry.0.genome_lineage_status=admission-bound",
        "entry.0.genome_lineage_checksum=0x00000000000000a2",
        "entry.0.species_id=0x00000000000000a3",
        "entry.0.species_strategy=selector-speciation-fit-v1",
        "entry.0.species_fit_status=browser-fit-bound",
        "entry.0.species_fit_checksum=0x00000000000000a4",
        "entry.0.novelty_id=0x00000000000000a6",
        "entry.0.novelty_strategy=selector-novelty-sketch-v1",
        "entry.0.novelty_status=behavior-sketch-bound",
        "entry.0.novelty_checksum=0x00000000000000a7",
        "entry.0.population_id=0x00000000000000a8",
        "entry.0.population_strategy=selector-population-review-route-v1",
        "entry.0.population_status=population-review-bound",
        "entry.0.population_checksum=0x00000000000000a9",
        "entry.0.mate_selection_id=0x00000000000000aa",
        "entry.0.mate_selection_strategy=selector-mate-selection-route-v1",
        `entry.0.mate_selection_status=${fixture.mateSelectionStatus}`,
        `entry.0.mate_selection_parent_count=${fixture.mateSelectionParentCount}`,
        "entry.0.mate_selection_checksum=0x00000000000000ab",
        "entry.0.operator_receipt_status=receipt-bound",
        `entry.0.operator_receipt_path=${fixture.operatorPath}`,
        `entry.0.operator_receipt_checksum=${fixture.operatorChecksum}`,
        `entry.0.operator_receipt_operator_id=${fixture.operatorId}`,
        `entry.0.operator_receipt_operator_kind=${fixture.operatorKind}`,
        "entry.0.operator_receipt_candidate_slm_checksum=0xa1442f3f180c542b",
        `entry.0.operator_receipt_candidate_artifact_bytes=${fixture.candidateArtifactBytes}`,
        "entry.0.phenotype_evidence_id=0x00000000000000ac",
        "entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1",
        "entry.0.phenotype_evidence_status=runtime-eval-bound",
        "entry.0.phenotype_evidence_checksum=0x00000000000000ad",
        "entry.0.heritable_artifact_id=0x00000000000000ae",
        "entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1",
        "entry.0.heritable_artifact_status=served-artifact-bound",
        "entry.0.heritable_artifact_checksum=0x00000000000000af",
        "entry.0.admission_checksum=0x0000000000000050",
        "entry.0.promotion_manifest_checksum=0x0000000000000051",
        "entry.0.provenance_manifest_checksum=0x0000000000000055",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000052",
        "entry.0.eval_manifest_checksum=0x0000000000000053",
        "entry.0.eval_case_evidence_checksum=0x0000000000000054",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
        "entry.0.fitness_vector_status=eval-bound",
        "entry.0.fitness_vector_checksum=0x00000000000000a5",
        "entry.0.selector_status=admitted",
        "entry.0.public_claim_status=bound-to-eval-scope",
        "required_next_gate=browser-loads-selector-registry-entry-models",
        ""
      ].join("\n"), "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

// Builds the manifest body for the converted-trained browser provenance smoke.
function convertedTrainedRegistryManifestText() {
  return [
    "tinyrustlm_slm_manifest_version=1",
    "model_path=tinyrustlm\\models\\converted-trained-q8.slm",
    "model_bytes=8832",
    "slm_version=1",
    "slm_checksum=0x481f1037d57ebcd3",
    "model_shape=vocab=260,hidden=8,layers=1,heads=2,kv_heads=2,head_dim=4,ffn=16,context=16",
    "tensor_count=12",
    "parameter_count=4824",
    "quantization=q8_0",
    "source_kind=converted-trained",
    "quality_claim=runtime-compatible-not-quality-verified",
    "trained_quality_claim=pending-evaluation",
    "admission_status=structure-accepted-quality-pending",
    "required_next_gate=task-eval-and-safety-review-before-assistant-quality-claim",
    ""
  ].join("\n");
}

// Builds the candidate-review report fetched before converted model bytes.
function convertedTrainedSourceReviewText() {
  return [
    "tinyrustlm_safetensors_candidate_review_version=1",
    "review_layout=safetensors-real-trained-candidate-review-v1",
    `source_model_id=${convertedTrainedSourceReviewModelId()}`,
    `source_model_sha=${convertedTrainedSourceReviewSha()}`,
    "source_config_checksum=0x00000000000000c1",
    "source_config_artifact_status=local-json-bound",
    "source_config_artifact_kind=config-json",
    "source_config_artifact_checksum=0x00000000000000c1",
    "source_config_artifact_bytes=128",
    "source_config_artifact_detail=model_type:llama;hidden_size:8",
    "source_tokenizer_checksum=0x00000000000000c2",
    "source_tokenizer_artifact_status=local-json-bound",
    "source_tokenizer_artifact_kind=tokenizer-json",
    "source_tokenizer_artifact_checksum=0x00000000000000c2",
    "source_tokenizer_artifact_bytes=256",
    "source_tokenizer_artifact_detail=tokenizer_version:1.0;model_type:BPE",
    "source_tokenizer_import_status=not-imported",
    "source_tokenizer_import_token_count=0",
    "source_tokenizer_import_merge_count=0",
    "source_tokenizer_import_checksum=0x0000000000000000",
    "source_license_route=docs/report-intake/2026-06-30/Safetensors Browser Runtime Guide.md",
    "source_license_artifact_status=local-text-bound",
    "source_license_artifact_kind=license-text",
    "source_license_artifact_checksum=0x00000000000000d1",
    "source_license_artifact_bytes=64",
    "source_license_artifact_detail=line_count:2",
    "reference_prompt_route=fixtures/browser-smoke-reference-prompt.txt",
    "reference_prompt_artifact_status=local-text-bound",
    "reference_prompt_artifact_kind=reference-prompt-text",
    "reference_prompt_artifact_checksum=0x00000000000000d2",
    "reference_prompt_artifact_bytes=8",
    "reference_prompt_artifact_detail=line_count:1",
    "reference_output_checksum=0x00000000000000e1",
    `eval_cases_route=${convertedTrainedEvalCasesRoute()}`,
    "eval_cases_artifact_status=local-text-bound",
    "eval_cases_artifact_kind=eval-cases-text",
    "eval_cases_artifact_checksum=0x00000000000000d3",
    "eval_cases_artifact_bytes=96",
    "eval_cases_artifact_detail=scope:browser-smoke;case_count:1",
    "target_model_shape=tiny-fixture",
    "required_next_gate=extract-raw-f32-tensors",
    ""
  ].join("\n");
}

// Names the reviewed source candidate shown in converted-trained browser provenance.
function convertedTrainedSourceReviewModelId() {
  return "local/browser-smoke-reviewed-fixture";
}

// Supplies a SHA-shaped source revision for browser source-review validation.
function convertedTrainedSourceReviewSha() {
  return "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

// Computes the review sidecar checksum reused by selector and source snapshot fixtures.
function convertedTrainedSourceReviewChecksum() {
  return textChecksumHex(convertedTrainedSourceReviewText());
}

// Builds a checksum-matched review sidecar whose source revision is not SHA-shaped.
function convertedTrainedSourceReviewShaDriftText() {
  return convertedTrainedSourceReviewText().replace(
    `source_model_sha=${convertedTrainedSourceReviewSha()}`,
    "source_model_sha=not-a-real-source-sha"
  );
}

// Builds a checksum-matched review sidecar whose tokenizer import rows are contradictory.
function convertedTrainedSourceReviewTokenizerImportDriftText() {
  return convertedTrainedSourceReviewText().replace(
    "source_tokenizer_import_checksum=0x0000000000000000",
    "source_tokenizer_import_checksum=0x0000000000000001"
  );
}

// Names the eval-case route that source review and eval sidecar must share.
function convertedTrainedEvalCasesRoute() {
  return "fixtures/browser-smoke-eval-cases.txt";
}

// Builds a checksum-matched review sidecar whose eval route differs from eval evidence.
function convertedTrainedSourceReviewEvalRouteDriftText() {
  return convertedTrainedSourceReviewText().replace(
    `eval_cases_route=${convertedTrainedEvalCasesRoute()}`,
    "eval_cases_route=fixtures/drifted-browser-smoke-eval-cases.txt"
  );
}

// Builds the reviewed trained-source manifest body fetched before converted model bytes.
function convertedTrainedSourceManifestText() {
  return [
    "tinyrustlm_trained_source_version=1",
    "model_family=tinyrustlm",
    "layout=raw-f32-tensor-files-v1",
    "model_shape=tiny-fixture",
    "tied_output=false",
    "tokenizer_template=byte",
    "vocab_size=260",
    "source_dtype=f32",
    "source_kind=trained-source-fixture",
    "source_id=tinyrustlm-local-source-fixture",
    "source_license=local-fixture-only",
    "source_dataset=tinyrustlm-local-conversion-fixture",
    "source_training_summary=Deterministic source-weight fixture for conversion path validation",
    "source_review_kind=safetensors-candidate-review",
    "source_review_status=validated-before-extraction",
    `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
    "source_review_required_next_gate=extract-raw-f32-tensors",
    "tensor_count=12",
    ""
  ].join("\n");
}

// Builds a checksum-matched source manifest whose identity disagrees with selector metadata.
function convertedTrainedSourceIdentityDriftManifestText() {
  return convertedTrainedSourceManifestText().replace(
    "source_id=tinyrustlm-local-source-fixture",
    "source_id=tinyrustlm-local-source-drift"
  );
}

// Builds a checksum-matched source manifest whose review checksum disagrees with selector metadata.
function convertedTrainedSourceReviewDriftManifestText() {
  return convertedTrainedSourceManifestText().replace(
    `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
    "source_review_checksum=0x00000000000000b2"
  );
}

// Builds a source snapshot that agrees with a checksum-matched but invalid review sidecar.
function convertedTrainedSourceReviewShaDriftManifestText() {
  return convertedTrainedSourceManifestText().replace(
    `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
    `source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewShaDriftText())}`
  );
}

// Builds a source snapshot that agrees with a tokenizer-import drift review sidecar.
function convertedTrainedSourceReviewTokenizerImportDriftManifestText() {
  return convertedTrainedSourceManifestText().replace(
    `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
    `source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewTokenizerImportDriftText())}`
  );
}

// Builds a source snapshot that agrees with a checksum-matched eval-route drift review sidecar.
function convertedTrainedSourceReviewEvalRouteDriftManifestText() {
  return convertedTrainedSourceManifestText().replace(
    `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
    `source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewEvalRouteDriftText())}`
  );
}

// Builds the validate-source sidecar body fetched before runtime, eval, and model bytes.
function convertedTrainedSourceValidationText() {
  return [
    "tinyrustlm_source_validation_version=1",
    "source_validation_gate=validate-source",
    "source_validation_status=pass",
    "source_validation_decision=accepted-for-conversion",
    "source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest",
    `source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
    "source_kind=trained-source-fixture",
    "source_id=tinyrustlm-local-source-fixture",
    "model_shape=tiny-fixture",
    "source_dtype=f32",
    "tied_output=false",
    "tensor_count=12",
    `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
    "required_next_gate=convert-raw-f32-source-to-slm",
    ""
  ].join("\n");
}

// Builds a checksum-matched validate-source sidecar with a rejected status field.
function convertedTrainedSourceValidationDriftText() {
  return convertedTrainedSourceValidationText().replace(
    "source_validation_status=pass",
    "source_validation_status=fail"
  );
}

// Builds validate-source evidence that follows the checksum-matched eval-route review drift.
function convertedTrainedSourceReviewEvalRouteDriftValidationText() {
  return convertedTrainedSourceValidationText()
    .replace(
      `source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
      `source_manifest_checksum=${textChecksumHex(convertedTrainedSourceReviewEvalRouteDriftManifestText())}`
    )
    .replace(
      `source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
      `source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewEvalRouteDriftText())}`
    );
}

// Builds the runtime-smoke sidecar body fetched before eval evidence and model bytes.
function convertedTrainedRuntimeEvidenceText() {
  return [
    "tinyrustlm_runtime_smoke_version=1",
    "gate=runtime-smoke",
    "source_kind=converted-trained",
    "model_path=tinyrustlm\\models\\converted-trained-q8.slm",
    `manifest_checksum=${textChecksumHex(convertedTrainedRegistryManifestText())}`,
    "slm_checksum=0x481f1037d57ebcd3",
    "model_shape=vocab=260,hidden=8,layers=1,heads=2,kv_heads=2,head_dim=4,ffn=16,context=16",
    "runtime_smoke_status=pass",
    "runtime_smoke_decision=accepted-for-runtime-smoke",
    "required_next_gate=promotion-eval-and-selector-admission",
    ""
  ].join("\n");
}

// Mutates runtime-smoke evidence while leaving the selector checksum pinned to the original text.
function convertedTrainedRuntimeEvidenceDriftText() {
  return `${convertedTrainedRuntimeEvidenceText()}runtime_smoke_drift=checksum-mismatch\n`;
}

// Builds the passed eval sidecar body fetched before converted model bytes.
function convertedTrainedEvalEvidenceText() {
  return [
    "tinyrustlm_eval_manifest_version=1",
    "gate=assistant-quality",
    "source_kind=converted-trained",
    `manifest_checksum=${textChecksumHex(convertedTrainedRegistryManifestText())}`,
    "slm_checksum=0x481f1037d57ebcd3",
    "model_shape=vocab=260,hidden=8,layers=1,heads=2,kv_heads=2,head_dim=4,ffn=16,context=16",
    "eval_status=pass",
    "task_eval_status=pass",
    "safety_review_status=pass",
    "quality_decision=accepted-for-assistant-quality",
    "quality_scope=tiny-fixture-runtime-eval-only",
    "evaluator=browser-smoke-fixture",
    `eval_dataset=${convertedTrainedEvalCasesRoute()}`,
    `eval_cases_route=${convertedTrainedEvalCasesRoute()}`,
    "eval_summary=Fixture converted-trained route check",
    "quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
    "case_count=1",
    "cases_passed=1",
    "cases_failed=0",
    "case.0.status=pass",
    "case.0.expected=e",
    "case.0.actual=e",
    "case.0.error=ok",
    ""
  ].join("\n");
}

// Builds the selector admission sidecar verified after runtime/eval evidence and before model bytes.
function convertedTrainedAdmissionText() {
  const sourceManifestText = convertedTrainedSourceManifestText();
  const sourceReviewText = convertedTrainedSourceReviewText();
  const sourceValidationText = convertedTrainedSourceValidationText();
  const runtimeEvidenceText = convertedTrainedRuntimeEvidenceText();
  const evalEvidenceText = convertedTrainedEvalEvidenceText();
  return [
    "tinyrustlm_selector_admission_version=1",
    "selector_id=browser-local-selector",
    "candidate_id=converted-trained-q8",
    "admission_path=../evidence/converted-trained-q8/converted-trained.admission",
    "admission_status=admitted-for-browser-selector",
    "promotion_status=runtime-smoke-and-eval-passed",
    "candidate_artifact_path=tinyrustlm/models/converted-trained-q8.slm",
    "candidate_artifact_bytes=8832",
    "candidate_slm_checksum=0x481f1037d57ebcd3",
    "candidate_model_shape=vocab=260,hidden=8,layers=1,heads=2,kv_heads=2,head_dim=4,ffn=16,context=16",
    "candidate_quantization=q8_0",
    "candidate_tokenizer_checksum=0x289d76790aca3acb",
    "source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest",
    `source_manifest_checksum=${textChecksumHex(sourceManifestText)}`,
    "source_review_path=../evidence/converted-trained-q8/converted-trained.source.review",
    `source_review_checksum=${textChecksumHex(sourceReviewText)}`,
    "source_validation_path=../evidence/converted-trained-q8/converted-trained.source.validation",
    `source_validation_checksum=${textChecksumHex(sourceValidationText)}`,
    "runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime",
    `runtime_smoke_manifest_checksum=${textChecksumHex(runtimeEvidenceText)}`,
    "eval_path=../evidence/converted-trained-q8/converted-trained.eval",
    `eval_manifest_checksum=${textChecksumHex(evalEvidenceText)}`,
    `eval_case_evidence_checksum=${evalCaseEvidenceChecksumFromText(evalEvidenceText)}`,
    "runtime_smoke_status=pass",
    "eval_status=pass",
    "quality_gate=assistant-quality",
    "quality_scope=tiny-fixture-runtime-eval-only",
    "quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
    `eval_dataset=${convertedTrainedEvalCasesRoute()}`,
    "cases_passed=1",
    "cases_failed=0",
    "promotion_decision=accepted-for-browser-selector",
    "browser_selector_status=admitted",
    "public_claim_status=bound-to-eval-scope",
    "required_next_gate=browser-selector-loads-only-admission-record-artifacts",
    ""
  ].join("\n");
}

// Mutates a checksum-matched admission field so the browser rejects the sidecar contract.
function convertedTrainedAdmissionDriftText() {
  return convertedTrainedAdmissionText().replace(
    "admission_status=admitted-for-browser-selector",
    "admission_status=pending-selector-admission"
  );
}

// Builds a compact selector registry that routes a local converted-trained q8 artifact.
function convertedTrainedRegistryText() {
  const sourceManifestText = convertedTrainedSourceManifestText();
  const sourceReviewText = convertedTrainedSourceReviewText();
  const sourceValidationText = convertedTrainedSourceValidationText();
  const runtimeEvidenceText = convertedTrainedRuntimeEvidenceText();
  const evalEvidenceText = convertedTrainedEvalEvidenceText();
  const admissionText = convertedTrainedAdmissionText();
  return [
    "tinyrustlm_selector_registry_version=1",
    "selector_id=browser-local-selector",
    "registry_scope=browser-local-model-selector",
    "registry_status=admitted-records-only",
    "selector_model_byte_budget=33554432",
    "selector_registry_text_byte_budget=262144",
    "manifest_text_byte_budget=65536",
    "receipt_text_byte_budget=131072",
    "evidence_text_byte_budget=131072",
    "entry_count=1",
    "admission_set_checksum=0x0000000000000071",
    "entry.0.candidate_id=converted-trained-q8",
    "entry.0.display_name=Converted trained-source q8_0",
    "entry.0.model_path=../models/converted-trained-q8.slm",
    "entry.0.manifest_path=../models/converted-trained-q8.slm.manifest",
    "entry.0.source_manifest_path=../evidence/converted-trained-q8/converted-trained.source.manifest",
    `entry.0.source_manifest_checksum=${textChecksumHex(sourceManifestText)}`,
    "entry.0.source_manifest_kind=trained-source-manifest",
    "entry.0.source_manifest_status=reviewed-source-snapshot",
    "entry.0.source_manifest_source_kind=trained-source-fixture",
    "entry.0.source_manifest_source_id=tinyrustlm-local-source-fixture",
    "entry.0.source_manifest_model_shape=tiny-fixture",
    "entry.0.source_review_kind=safetensors-candidate-review",
    "entry.0.source_review_path=../evidence/converted-trained-q8/converted-trained.source.review",
    "entry.0.source_review_status=validated-before-extraction",
    `entry.0.source_review_checksum=${textChecksumHex(sourceReviewText)}`,
    "entry.0.source_review_required_next_gate=extract-raw-f32-tensors",
    "entry.0.source_validation_path=../evidence/converted-trained-q8/converted-trained.source.validation",
    `entry.0.source_validation_checksum=${textChecksumHex(sourceValidationText)}`,
    "entry.0.artifact_path=tinyrustlm/models/converted-trained-q8.slm",
    "entry.0.max_tokens=8",
    "entry.0.model_bytes=8832",
    "entry.0.slm_checksum=0x481f1037d57ebcd3",
    "entry.0.tokenizer_checksum=0x289d76790aca3acb",
    "entry.0.model_shape=vocab=260,hidden=8,layers=1,heads=2,kv_heads=2,head_dim=4,ffn=16,context=16",
    "entry.0.quantization=q8_0",
    "entry.0.output_contract=separate-output-weight",
    "entry.0.genome_id=0x0000000000000171",
    "entry.0.genome_strategy=selector-admission-genome-v1",
    "entry.0.genome_lineage_status=admission-bound",
    "entry.0.genome_lineage_checksum=0x0000000000000172",
    "entry.0.species_id=0x0000000000000173",
    "entry.0.species_strategy=selector-speciation-fit-v1",
    "entry.0.species_fit_status=browser-fit-bound",
    "entry.0.species_fit_checksum=0x0000000000000174",
    "entry.0.novelty_id=0x0000000000000176",
    "entry.0.novelty_strategy=selector-novelty-sketch-v1",
    "entry.0.novelty_status=behavior-sketch-bound",
    "entry.0.novelty_checksum=0x0000000000000177",
    "entry.0.population_id=0x0000000000000178",
    "entry.0.population_strategy=selector-population-review-route-v1",
    "entry.0.population_status=population-review-bound",
    "entry.0.population_checksum=0x0000000000000179",
    "entry.0.mate_selection_id=0x000000000000017a",
    "entry.0.mate_selection_strategy=selector-mate-selection-route-v1",
    "entry.0.mate_selection_status=admission-only",
    "entry.0.mate_selection_parent_count=1",
    "entry.0.mate_selection_checksum=0x000000000000017b",
    "entry.0.phenotype_evidence_id=0x000000000000017c",
    "entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1",
    "entry.0.phenotype_evidence_status=runtime-eval-bound",
    "entry.0.phenotype_evidence_checksum=0x000000000000017d",
    "entry.0.heritable_artifact_id=0x000000000000017e",
    "entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1",
    "entry.0.heritable_artifact_status=served-artifact-bound",
    "entry.0.heritable_artifact_checksum=0x000000000000017f",
    "entry.0.admission_path=../evidence/converted-trained-q8/converted-trained.admission",
    `entry.0.admission_checksum=${textChecksumHex(admissionText)}`,
    "entry.0.promotion_manifest_checksum=0x0000000000000073",
    "entry.0.provenance_manifest_checksum=0x0000000000000077",
    "entry.0.runtime_smoke_path=../evidence/converted-trained-q8/converted-trained.runtime",
    `entry.0.runtime_smoke_manifest_checksum=${textChecksumHex(runtimeEvidenceText)}`,
    "entry.0.eval_path=../evidence/converted-trained-q8/converted-trained.eval",
    `entry.0.eval_manifest_checksum=${textChecksumHex(evalEvidenceText)}`,
    `entry.0.eval_case_evidence_checksum=${evalCaseEvidenceChecksumFromText(evalEvidenceText)}`,
    "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
    "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
    `entry.0.eval_dataset=${convertedTrainedEvalCasesRoute()}`,
    "entry.0.cases_passed=1",
    "entry.0.fitness_vector_status=eval-bound",
    "entry.0.fitness_vector_checksum=0x0000000000000175",
    "entry.0.selector_status=admitted",
    "entry.0.public_claim_status=bound-to-eval-scope",
    "required_next_gate=browser-loads-selector-registry-entry-models",
    ""
  ].join("\n");
}

// Recomputes the selector checksum for drifted source bytes while preserving the old source id.
function convertedTrainedSourceIdentityDriftRegistryText() {
  return convertedTrainedRegistryText().replace(
    `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
    `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceIdentityDriftManifestText())}`
  );
}

// Recomputes only the source manifest checksum for review-field drift.
function convertedTrainedSourceReviewDriftRegistryText() {
  return convertedTrainedRegistryText().replace(
    `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
    `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceReviewDriftManifestText())}`
  );
}

// Recomputes selector checksums for a review sidecar whose SHA-shaped source revision drifted.
function convertedTrainedSourceReviewShaDriftRegistryText() {
  return convertedTrainedRegistryText()
    .replace(
      `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
      `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceReviewShaDriftManifestText())}`
    )
    .replace(
      `entry.0.source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
      `entry.0.source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewShaDriftText())}`
    );
}

// Builds a compact selector registry whose source-review checksum follows tokenizer import drift.
function convertedTrainedSourceReviewTokenizerImportDriftRegistryText() {
  return convertedTrainedRegistryText()
    .replace(
      `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
      `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceReviewTokenizerImportDriftManifestText())}`
    )
    .replace(
      `entry.0.source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
      `entry.0.source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewTokenizerImportDriftText())}`
    );
}

// Builds a compact selector registry whose source-review checksum follows eval-route drift.
function convertedTrainedSourceReviewEvalRouteDriftRegistryText() {
  return convertedTrainedRegistryText()
    .replace(
      `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceManifestText())}`,
      `entry.0.source_manifest_checksum=${textChecksumHex(convertedTrainedSourceReviewEvalRouteDriftManifestText())}`
    )
    .replace(
      `entry.0.source_review_checksum=${convertedTrainedSourceReviewChecksum()}`,
      `entry.0.source_review_checksum=${textChecksumHex(convertedTrainedSourceReviewEvalRouteDriftText())}`
    )
    .replace(
      `entry.0.source_validation_checksum=${textChecksumHex(convertedTrainedSourceValidationText())}`,
      `entry.0.source_validation_checksum=${textChecksumHex(convertedTrainedSourceReviewEvalRouteDriftValidationText())}`
    );
}

// Omits selector-carried source review fields while the fetched source manifest still contains them.
function convertedTrainedSourceReviewOmittedRegistryText() {
  return convertedTrainedRegistryText()
    .split("\n")
    .filter((line) => !line.startsWith("entry.0.source_review_"))
    .join("\n");
}

// Recomputes selector validation checksum so the browser rejects the sidecar fields, not bytes.
function convertedTrainedSourceValidationDriftRegistryText() {
  return convertedTrainedRegistryText().replace(
    `entry.0.source_validation_checksum=${textChecksumHex(convertedTrainedSourceValidationText())}`,
    `entry.0.source_validation_checksum=${textChecksumHex(convertedTrainedSourceValidationDriftText())}`
  );
}

// Recomputes the selector checksum for an admission sidecar whose status drifts.
function convertedTrainedAdmissionDriftRegistryText() {
  return convertedTrainedRegistryText().replace(
    `entry.0.admission_checksum=${textChecksumHex(convertedTrainedAdmissionText())}`,
    `entry.0.admission_checksum=${textChecksumHex(convertedTrainedAdmissionDriftText())}`
  );
}

// Serves a local converted-trained model route by reusing the checked tiny q8 bytes with a converted-trained manifest.
function installConvertedTrainedRegistryInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.source.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.source.review")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.source.validation")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceValidationText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.eval")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.admission")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedAdmissionText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves drifted source evidence while leaving the selector registry checksum untouched.
function installConvertedTrainedSourceManifestDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(
          client,
          params.requestId,
          `${convertedTrainedSourceManifestText()}source_manifest_drift=checksum-mismatch\n`
        );
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves checksum-matched source bytes with a source id that differs from selector metadata.
function installConvertedTrainedSourceIdentityDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceIdentityDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceIdentityDriftManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.source.review")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.eval")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves checksum-matched source bytes whose review checksum differs from selector metadata.
function installConvertedTrainedSourceReviewDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewDriftManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.source.review")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.eval")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves a selector-matched source manifest but mutates the fetched review sidecar body.
function installConvertedTrainedSourceReviewSidecarDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewShaDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewShaDriftManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewShaDriftText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.eval")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves a selector-matched review sidecar with invalid tokenizer import evidence.
function installConvertedTrainedSourceReviewTokenizerImportDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewTokenizerImportDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewTokenizerImportDriftManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewTokenizerImportDriftText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.eval")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves a checksum-matched source review whose eval route disagrees with eval evidence.
function installConvertedTrainedSourceReviewEvalRouteDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  const sourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  const evalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewEvalRouteDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewEvalRouteDriftManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewEvalRouteDriftText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceValidationRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewEvalRouteDriftValidationText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, evalEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves source review evidence in the manifest but omits the selector-carried review route.
function installConvertedTrainedSourceReviewOmittedInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewOmittedRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.runtime")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/evidence/converted-trained-q8/converted-trained.eval")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves a checksum-matched validate-source sidecar whose status fails browser validation.
function installConvertedTrainedSourceValidationDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  const sourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  const runtimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  const evalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceValidationDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceValidationRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceValidationDriftText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, runtimeEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, evalEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves drifted runtime-smoke evidence while leaving the selector registry checksum untouched.
function installConvertedTrainedRuntimeEvidenceDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  const sourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  const runtimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  const evalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceValidationRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceValidationText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, runtimeEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceDriftText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, evalEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves drifted eval evidence while leaving the selector registry checksum untouched.
function installConvertedTrainedEvalEvidenceDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  const sourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  const runtimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  const evalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceValidationRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceValidationText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, runtimeEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, evalEvidenceRoute)) {
        await fulfillTextRequest(
          client,
          params.requestId,
          `${convertedTrainedEvalEvidenceText()}case_drift=checksum-mismatch\n`
        );
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves checksum-matched admission evidence with a rejected admission status.
function installConvertedTrainedAdmissionDriftInterceptor(client, modelKey) {
  const sourceManifestRoute = `/evidence/${modelKey}/converted-trained.source.manifest`;
  const sourceReviewRoute = `/evidence/${modelKey}/converted-trained.source.review`;
  const sourceValidationRoute = `/evidence/${modelKey}/converted-trained.source.validation`;
  const runtimeEvidenceRoute = `/evidence/${modelKey}/converted-trained.runtime`;
  const evalEvidenceRoute = `/evidence/${modelKey}/converted-trained.eval`;
  const admissionRoute = `/evidence/${modelKey}/converted-trained.admission`;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedAdmissionDriftRegistryText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRegistryManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceManifestText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceReviewRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceReviewText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, sourceValidationRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedSourceValidationText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, runtimeEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedRuntimeEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, evalEvidenceRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedEvalEvidenceText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, admissionRoute)) {
        await fulfillTextRequest(client, params.requestId, convertedTrainedAdmissionDriftText());
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/converted-trained-q8.slm")) {
        const sourceUrl = new URL("/models/tiny-test-model-q8.slm", requestUrl).toString();
        await fulfillBinaryRequest(client, params.requestId, await getBuffer(sourceUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Serves a selector registry whose operator receipt byte echo no longer matches the model entry.
function installSelectorOperatorReceiptDriftInterceptor(
  client,
  fixture = registryOperatorFixtureForMode(smokeMode, "17159999")
) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/selector.registry")) {
      const body = Buffer.from([
        "tinyrustlm_selector_registry_version=1",
        "selector_id=browser-local-selector",
        "registry_scope=browser-local-model-selector",
        "registry_status=admitted-records-only",
        "selector_model_byte_budget=33554432",
        "selector_registry_text_byte_budget=262144",
        "manifest_text_byte_budget=65536",
        "receipt_text_byte_budget=131072",
        "evidence_text_byte_budget=131072",
        "entry_count=1",
        "admission_set_checksum=0x0000000000000049",
        `entry.0.candidate_id=${fixture.candidateId}`,
        `entry.0.display_name=${fixture.displayName}`,
        "entry.0.model_path=../models/tinylm16-q8.slm",
        "entry.0.manifest_path=../models/tinylm16-q8.slm.manifest",
        "entry.0.artifact_path=tinyrustlm/models/tinylm16-q8.slm",
        "entry.0.max_tokens=8",
        "entry.0.model_bytes=17160000",
        "entry.0.slm_checksum=0xa1442f3f180c542b",
        "entry.0.model_shape=vocab=260,hidden=512,layers=4,heads=8,kv_heads=8,head_dim=64,ffn=2048,context=512",
        "entry.0.quantization=q8_0",
        "entry.0.output_contract=separate-output-weight",
        "entry.0.genome_id=0x00000000000000a1",
        "entry.0.genome_strategy=selector-admission-genome-v1",
        "entry.0.genome_lineage_status=admission-bound",
        "entry.0.genome_lineage_checksum=0x00000000000000a2",
        "entry.0.species_id=0x00000000000000a3",
        "entry.0.species_strategy=selector-speciation-fit-v1",
        "entry.0.species_fit_status=browser-fit-bound",
        "entry.0.species_fit_checksum=0x00000000000000a4",
        "entry.0.novelty_id=0x00000000000000a6",
        "entry.0.novelty_strategy=selector-novelty-sketch-v1",
        "entry.0.novelty_status=behavior-sketch-bound",
        "entry.0.novelty_checksum=0x00000000000000a7",
        "entry.0.population_id=0x00000000000000a8",
        "entry.0.population_strategy=selector-population-review-route-v1",
        "entry.0.population_status=population-review-bound",
        "entry.0.population_checksum=0x00000000000000a9",
        "entry.0.mate_selection_id=0x00000000000000aa",
        "entry.0.mate_selection_strategy=selector-mate-selection-route-v1",
        `entry.0.mate_selection_status=${fixture.mateSelectionStatus}`,
        `entry.0.mate_selection_parent_count=${fixture.mateSelectionParentCount}`,
        "entry.0.mate_selection_checksum=0x00000000000000ab",
        "entry.0.operator_receipt_status=receipt-bound",
        `entry.0.operator_receipt_path=${fixture.operatorPath}`,
        `entry.0.operator_receipt_checksum=${fixture.operatorChecksum}`,
        `entry.0.operator_receipt_operator_id=${fixture.operatorId}`,
        `entry.0.operator_receipt_operator_kind=${fixture.operatorKind}`,
        "entry.0.operator_receipt_candidate_slm_checksum=0xa1442f3f180c542b",
        `entry.0.operator_receipt_candidate_artifact_bytes=${fixture.candidateArtifactBytes}`,
        "entry.0.phenotype_evidence_id=0x00000000000000ac",
        "entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1",
        "entry.0.phenotype_evidence_status=runtime-eval-bound",
        "entry.0.phenotype_evidence_checksum=0x00000000000000ad",
        "entry.0.heritable_artifact_id=0x00000000000000ae",
        "entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1",
        "entry.0.heritable_artifact_status=served-artifact-bound",
        "entry.0.heritable_artifact_checksum=0x00000000000000af",
        "entry.0.admission_checksum=0x0000000000000050",
        "entry.0.promotion_manifest_checksum=0x0000000000000051",
        "entry.0.provenance_manifest_checksum=0x0000000000000055",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000052",
        "entry.0.eval_manifest_checksum=0x0000000000000053",
        "entry.0.eval_case_evidence_checksum=0x0000000000000054",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
        "entry.0.fitness_vector_status=eval-bound",
        "entry.0.fitness_vector_checksum=0x00000000000000a5",
        "entry.0.selector_status=admitted",
        "entry.0.public_claim_status=bound-to-eval-scope",
        "required_next_gate=browser-loads-selector-registry-entry-models",
        ""
      ].join("\n"), "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

// Serves generated roots with a caller-selected selector receipt mutation and static q8 fallback.
function installGeneratedSelectorOperatorReceiptDriftInterceptor(
  client,
  driftRegistryText = driftGeneratedSelectorOperatorReceiptBytes
) {
  const fallbackModelPath = path.join(__dirname, "..", "models", "tinylm16-q8.slm");
  const fallbackManifestPath = path.join(__dirname, "..", "models", "tinylm16-q8.slm.manifest");
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        const registryText = await getText(requestUrl);
        await fulfillTextRequest(
          client,
          params.requestId,
          driftRegistryText(registryText)
        );
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/tinylm16-q8.slm")) {
        await fulfillBinaryRequest(client, params.requestId, Buffer.from(fs.readFileSync(fallbackModelPath)));
        return;
      }
      if (requestUrlPathEquals(requestUrl, "/models/tinylm16-q8.slm.manifest")) {
        await fulfillTextRequest(client, params.requestId, fs.readFileSync(fallbackManifestPath, "utf8"));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installSelectorBudgetRegistryInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/selector.registry")) {
      const body = Buffer.from([
        "tinyrustlm_selector_registry_version=1",
        "selector_id=browser-local-selector",
        "registry_scope=browser-local-model-selector",
        "registry_status=admitted-records-only",
        "selector_model_byte_budget=33554432",
        "selector_registry_text_byte_budget=262144",
        "manifest_text_byte_budget=65536",
        "receipt_text_byte_budget=131072",
        "evidence_text_byte_budget=131072",
        "entry_count=1",
        "admission_set_checksum=0x0000000000000081",
        "entry.0.candidate_id=oversized-browser-parent",
        "entry.0.display_name=Oversized browser parent q4_0",
        "entry.0.model_path=../models/oversized-browser-parent.slm",
        "entry.0.manifest_path=../models/oversized-browser-parent.slm.manifest",
        "entry.0.artifact_path=tinyrustlm/models/oversized-browser-parent.slm",
        "entry.0.max_tokens=8",
        "entry.0.model_bytes=33554433",
        "entry.0.slm_checksum=0x0000000000000082",
        "entry.0.model_shape=vocab=260,hidden=512,layers=4,heads=8,kv_heads=8,head_dim=64,ffn=2048,context=512",
        "entry.0.quantization=q4_0",
        "entry.0.output_contract=separate-output-weight",
        "entry.0.genome_id=0x00000000000000b1",
        "entry.0.genome_strategy=selector-admission-genome-v1",
        "entry.0.genome_lineage_status=admission-bound",
        "entry.0.genome_lineage_checksum=0x00000000000000b2",
        "entry.0.species_id=0x00000000000000b3",
        "entry.0.species_strategy=selector-speciation-fit-v1",
        "entry.0.species_fit_status=browser-fit-bound",
        "entry.0.species_fit_checksum=0x00000000000000b4",
        "entry.0.novelty_id=0x00000000000000b6",
        "entry.0.novelty_strategy=selector-novelty-sketch-v1",
        "entry.0.novelty_status=behavior-sketch-bound",
        "entry.0.novelty_checksum=0x00000000000000b7",
        "entry.0.population_id=0x00000000000000b8",
        "entry.0.population_strategy=selector-population-review-route-v1",
        "entry.0.population_status=population-review-bound",
        "entry.0.population_checksum=0x00000000000000b9",
        "entry.0.mate_selection_id=0x00000000000000ba",
        "entry.0.mate_selection_strategy=selector-mate-selection-route-v1",
        "entry.0.mate_selection_status=parent-pool-bound",
        "entry.0.mate_selection_parent_count=3",
        "entry.0.mate_selection_checksum=0x00000000000000bb",
        "entry.0.phenotype_evidence_id=0x00000000000000bc",
        "entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1",
        "entry.0.phenotype_evidence_status=runtime-eval-bound",
        "entry.0.phenotype_evidence_checksum=0x00000000000000bd",
        "entry.0.heritable_artifact_id=0x00000000000000be",
        "entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1",
        "entry.0.heritable_artifact_status=served-artifact-bound",
        "entry.0.heritable_artifact_checksum=0x00000000000000bf",
        "entry.0.admission_checksum=0x0000000000000083",
        "entry.0.promotion_manifest_checksum=0x0000000000000084",
        "entry.0.provenance_manifest_checksum=0x0000000000000088",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000085",
        "entry.0.eval_manifest_checksum=0x0000000000000086",
        "entry.0.eval_case_evidence_checksum=0x0000000000000087",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
        "entry.0.fitness_vector_status=eval-bound",
        "entry.0.fitness_vector_checksum=0x00000000000000b5",
        "entry.0.selector_status=admitted",
        "entry.0.public_claim_status=bound-to-eval-scope",
        "required_next_gate=browser-loads-selector-registry-entry-models",
        ""
      ].join("\n"), "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function installSidecarBudgetContractRegistryInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/selector.registry")) {
      const body = Buffer.from([
        "tinyrustlm_selector_registry_version=1",
        "selector_id=browser-local-selector",
        "registry_scope=browser-local-model-selector",
        "registry_status=admitted-records-only",
        "selector_model_byte_budget=33554432",
        "selector_registry_text_byte_budget=262144",
        "manifest_text_byte_budget=65537",
        "receipt_text_byte_budget=131072",
        "evidence_text_byte_budget=131072",
        "entry_count=1",
        "admission_set_checksum=0x0000000000000091",
        "entry.0.candidate_id=sidecar-budget-contract-parent",
        "entry.0.display_name=Sidecar budget contract parent q4_0",
        "entry.0.model_path=../models/sidecar-budget-contract-parent.slm",
        "entry.0.manifest_path=../models/sidecar-budget-contract-parent.slm.manifest",
        "entry.0.artifact_path=tinyrustlm/models/sidecar-budget-contract-parent.slm",
        "entry.0.max_tokens=8",
        "entry.0.model_bytes=6592",
        "entry.0.slm_checksum=0x0000000000000092",
        "entry.0.model_shape=vocab=260,hidden=16,layers=1,heads=2,kv_heads=2,head_dim=8,ffn=32,context=32",
        "entry.0.quantization=q4_0",
        "entry.0.output_contract=separate-output-weight",
        "entry.0.genome_id=0x00000000000000c1",
        "entry.0.genome_strategy=selector-admission-genome-v1",
        "entry.0.genome_lineage_status=admission-bound",
        "entry.0.genome_lineage_checksum=0x00000000000000c2",
        "entry.0.species_id=0x00000000000000c3",
        "entry.0.species_strategy=selector-speciation-fit-v1",
        "entry.0.species_fit_status=browser-fit-bound",
        "entry.0.species_fit_checksum=0x00000000000000c4",
        "entry.0.novelty_id=0x00000000000000c6",
        "entry.0.novelty_strategy=selector-novelty-sketch-v1",
        "entry.0.novelty_status=behavior-sketch-bound",
        "entry.0.novelty_checksum=0x00000000000000c7",
        "entry.0.population_id=0x00000000000000c8",
        "entry.0.population_strategy=selector-population-review-route-v1",
        "entry.0.population_status=population-review-bound",
        "entry.0.population_checksum=0x00000000000000c9",
        "entry.0.mate_selection_id=0x00000000000000ca",
        "entry.0.mate_selection_strategy=selector-mate-selection-route-v1",
        "entry.0.mate_selection_status=parent-pool-bound",
        "entry.0.mate_selection_parent_count=3",
        "entry.0.mate_selection_checksum=0x00000000000000cb",
        "entry.0.phenotype_evidence_id=0x00000000000000cc",
        "entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1",
        "entry.0.phenotype_evidence_status=runtime-eval-bound",
        "entry.0.phenotype_evidence_checksum=0x00000000000000cd",
        "entry.0.heritable_artifact_id=0x00000000000000ce",
        "entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1",
        "entry.0.heritable_artifact_status=served-artifact-bound",
        "entry.0.heritable_artifact_checksum=0x00000000000000cf",
        "entry.0.admission_checksum=0x0000000000000093",
        "entry.0.promotion_manifest_checksum=0x0000000000000094",
        "entry.0.provenance_manifest_checksum=0x0000000000000098",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000095",
        "entry.0.eval_manifest_checksum=0x0000000000000096",
        "entry.0.eval_case_evidence_checksum=0x0000000000000097",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
        "entry.0.fitness_vector_status=eval-bound",
        "entry.0.fitness_vector_checksum=0x00000000000000c5",
        "entry.0.selector_status=admitted",
        "entry.0.public_claim_status=bound-to-eval-scope",
        "required_next_gate=browser-loads-selector-registry-entry-models",
        ""
      ].join("\n"), "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function installRuntimeManifestDriftInterceptor(client) {
  const runtimeWasmPath = path.join(__dirname, "..", "runtime", "tinyrustlm.wasm");
  const runtimeWasmBytes = fs.statSync(runtimeWasmPath).size;
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/runtime/tinyrustlm.wasm.manifest")) {
      const body = Buffer.from([
        "tinyrustlm_wasm_manifest_version=1",
        "runtime_kind=tinyrustlm-rust-wasm",
        "runtime_status=validated-local-runtime",
        "runtime_wasm_path=../runtime/tinyrustlm.wasm",
        `runtime_wasm_bytes=${runtimeWasmBytes}`,
        "runtime_wasm_checksum=0x0000000000000001",
        "required_next_gate=instantiate-wasm-runtime",
        ""
      ].join("\n"), "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

function installModulePlanDriftInterceptor(client, modelKey, driftReceiptText) {
  const modulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!modulePlanRoute) {
    throw new Error(`no module plan route is known for ${modelKey}`);
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrl.includes("/models/selector.registry")) {
        const registryText = await getText(requestUrl);
        const receiptUrl = new URL(modulePlanRoute, requestUrl).toString();
        const receiptText = await getText(receiptUrl);
        const driftedReceiptText = driftReceiptText(receiptText);
        const driftedRegistryText = updateRegistryModulePlanChecksum(
          registryText,
          modelKey,
          textChecksumHex(driftedReceiptText)
        );
        await fulfillTextRequest(client, params.requestId, driftedRegistryText);
        return;
      }
      if (requestUrl.includes(modulePlanRoute)) {
        const receiptText = await getText(requestUrl);
        await fulfillTextRequest(client, params.requestId, driftReceiptText(receiptText));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installModulePlanResourceDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanResourceEnvelope);
}

function installModulePlanRuntimeScratchDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanRuntimeScratchBudget);
}

function installModulePlanOutputLimitDriftInterceptor(client, modelKey) {
  // Routes output-limit drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanOutputByteLimit);
}

function installModulePlanPromptLimitDriftInterceptor(client, modelKey) {
  // Routes prompt-limit drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanPromptByteLimit);
}

function installModulePlanFetchCountDriftInterceptor(client, modelKey) {
  // Routes fetch-count drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanFetchCountLimit);
}

function installModulePlanPlannedFetchCountDriftInterceptor(client, modelKey) {
  // Routes planned-fetch drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanPlannedFetchCount);
}

function installModulePlanRouteSetVersionDriftInterceptor(client, modelKey) {
  // Routes route-set version drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanRouteSetVersion);
}

function installModulePlanRouteSetAlgorithmDriftInterceptor(client, modelKey) {
  // Routes route-set algorithm drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanRouteSetChecksumAlgorithm);
}

function installModulePlanRouteSetDriftInterceptor(client, modelKey) {
  // Routes route-set drift through the shared module-plan receipt interceptor.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanRouteSetChecksum);
}

function installModulePlanOperatorReceiptDriftInterceptor(client, modelKey) {
  // Routes operator-receipt drift through checksum-consistent module-plan interception.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanOperatorReceiptChecksum);
}

function installModulePlanKvCacheDriftInterceptor(client, modelKey) {
  // Wires the KV drift mutation into the shared module-plan interception path.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanKvCachePageCount);
}

function installModulePlanAdapterStackBudgetDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanAdapterStackBudget);
}

function installModulePlanTotalBudgetDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanTotalBudget);
}

function installModulePlanTotalLimitDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanTotalLimit);
}

// Hooks count drift into checksum-consistent module-plan receipt interception.
function installModulePlanCountDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanCount);
}

function installModulePlanWasmMemoryDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanWasmMemory);
}

function installModulePlanWasmExportSetDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanWasmExportSet);
}

function installModulePlanWasmTransferDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanWasmTransferStrategy);
}

function installModulePlanModelReleaseDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanModelReleaseStrategy);
}

function installModulePlanRuntimeResetDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanRuntimeResetStrategy);
}

function installModulePlanAdapterValidationDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanAdapterValidationStrategy);
}

function installModulePlanAdapterValidationCountDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanAdapterValidationCount);
}

function installModulePlanAdapterApplyCountDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanAdapterApplyCount);
}

function installModulePlanWasmHeapDriftInterceptor(client, modelKey) {
  // Routes the allocator floor through checksum-consistent module-plan interception.
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanWasmHeapMinBytes);
}

function installModulePlanContextTokenDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanContextTokenLimit);
}

function installModulePlanSamplerCapDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanSamplerCandidateCap);
}

function installModulePlanTokenizerDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanTokenizerChecksum);
}

function installModulePlanProfileDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanProfile);
}

function installModulePlanExecutionProfileDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanExecutionProfile);
}

function installModulePlanFetchPolicyDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanFetchPolicy);
}

function installModulePlanOriginPolicyDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanOriginPolicy);
}

function installModulePlanGraphDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanGraph);
}

function installModulePlanStackDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanStackMember);
}

function installModulePlanRoleDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanRole);
}

function installModulePlanSlotDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanSlot);
}

function installModulePlanPhaseDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanPhase);
}

function installModulePlanByteDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanByteCount);
}

function installModulePlanChecksumDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanChecksum);
}

function installModulePlanDependencyDriftInterceptor(client, modelKey) {
  installModulePlanDriftInterceptor(client, modelKey, driftModulePlanDependency);
}

function installAssemblyEvalCaseDriftInterceptor(client, modelKey) {
  const assemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  const modulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!assemblyReceiptRoute || !modulePlanRoute) {
    throw new Error(`no generated assembly route is known for ${modelKey}`);
  }
  async function driftedAssemblyText(requestUrl) {
    const receiptUrl = new URL(assemblyReceiptRoute, requestUrl).toString();
    return driftAssemblyEvalCaseEvidenceChecksum(await getText(receiptUrl));
  }
  async function driftedModulePlanText(requestUrl, assemblyChecksum) {
    const modulePlanUrl = new URL(modulePlanRoute, requestUrl).toString();
    return updateModulePlanAssemblyReceiptChecksum(await getText(modulePlanUrl), assemblyChecksum);
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrl.includes("/models/selector.registry")) {
        const registryText = await getText(requestUrl);
        const assemblyText = await driftedAssemblyText(requestUrl);
        const assemblyChecksum = textChecksumHex(assemblyText);
        const modulePlanText = await driftedModulePlanText(requestUrl, assemblyChecksum);
        let driftedRegistryText = updateRegistryAssemblyReceiptChecksum(
          registryText,
          modelKey,
          assemblyChecksum
        );
        driftedRegistryText = updateRegistryModulePlanChecksum(
          driftedRegistryText,
          modelKey,
          textChecksumHex(modulePlanText)
        );
        await fulfillTextRequest(client, params.requestId, driftedRegistryText);
        return;
      }
      if (requestUrl.includes(modulePlanRoute)) {
        const assemblyText = await driftedAssemblyText(requestUrl);
        const modulePlanText = await driftedModulePlanText(requestUrl, textChecksumHex(assemblyText));
        await fulfillTextRequest(client, params.requestId, modulePlanText);
        return;
      }
      if (requestUrl.includes(assemblyReceiptRoute)) {
        await fulfillTextRequest(client, params.requestId, await driftedAssemblyText(requestUrl));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installAssemblyEvidenceFileDriftInterceptor(client, modelKey) {
  const evidenceRoute = (expectedAssemblyEvidenceRoutes[modelKey] || [])[0];
  if (!evidenceRoute) {
    throw new Error(`no generated assembly evidence route is known for ${modelKey}`);
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrl.includes(evidenceRoute)) {
        const evidenceText = await getText(requestUrl);
        await fulfillTextRequest(client, params.requestId, driftAssemblyEvidenceFileText(evidenceText));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installAdapterFamilyReceiptDriftInterceptor(client, modelKey) {
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  if (!adapterFamilyRoute) {
    throw new Error(`no generated adapter-family receipt route is known for ${modelKey}`);
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrl.includes(adapterFamilyRoute)) {
        const receiptText = await getText(requestUrl);
        await fulfillTextRequest(client, params.requestId, driftAdapterFamilyReceiptText(receiptText));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installAdapterManifestDriftInterceptor(client, modelKey) {
  const adapterManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  const adapterManifestRoute = adapterManifestRoutes[1];
  if (!adapterManifestRoute) {
    throw new Error(`no generated family adapter manifest route is known for ${modelKey}`);
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrl.includes(adapterManifestRoute)) {
        const manifestText = await getText(requestUrl);
        await fulfillTextRequest(client, params.requestId, driftAdapterManifestText(manifestText));
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

// Installs a coherent ALR1 manifest drift that reaches the source-backed contract comparison.
function installSourceBackedAlr1ManifestDriftInterceptor(client, modelKey) {
  const adapterIndex = 3;
  const moduleIndex = 6;
  const adapterManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  const adapterManifestRoute = adapterManifestRoutes[adapterIndex];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  const assemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  const modulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!adapterManifestRoute || !adapterFamilyRoute || !assemblyReceiptRoute || !modulePlanRoute) {
    throw new Error(`generated source-backed ALR1 drift routes were incomplete for ${modelKey}`);
  }
  let driftPromise = null;
  // Builds every drifted text artifact from a single source contract mutation.
  async function buildDrift(requestUrl) {
    const manifestText = driftSourceBackedAlr1ManifestText(
      await getText(new URL(adapterManifestRoute, requestUrl).toString())
    );
    const manifestChecksum = textChecksumHex(manifestText);
    const adapterFamilyText = updateAdapterFamilyMemberManifestChecksum(
      await getText(new URL(adapterFamilyRoute, requestUrl).toString()),
      adapterIndex,
      manifestChecksum
    );
    const adapterFamilyChecksum = textChecksumHex(adapterFamilyText);
    const assemblyReceiptText = updateAssemblyAdapterFamilyReceiptChecksum(
      await getText(new URL(assemblyReceiptRoute, requestUrl).toString()),
      adapterFamilyChecksum
    );
    const assemblyReceiptChecksum = textChecksumHex(assemblyReceiptText);
    let modulePlanText = await getText(new URL(modulePlanRoute, requestUrl).toString());
    modulePlanText = updateModulePlanAssemblyReceiptChecksum(modulePlanText, assemblyReceiptChecksum);
    modulePlanText = updateModulePlanAdapterFamilyReceiptChecksum(modulePlanText, adapterFamilyChecksum);
    modulePlanText = updateModulePlanAdapterManifestChecksum(modulePlanText, moduleIndex, manifestChecksum);
    const modulePlanChecksum = textChecksumHex(modulePlanText);
    let registryText = await getText(new URL("/models/selector.registry", requestUrl).toString());
    registryText = updateRegistryAdapterManifestChecksum(
      registryText,
      modelKey,
      adapterIndex,
      manifestChecksum
    );
    registryText = updateRegistryAdapterFamilyReceiptChecksum(
      registryText,
      modelKey,
      adapterFamilyChecksum
    );
    registryText = updateRegistryAssemblyReceiptChecksum(
      registryText,
      modelKey,
      assemblyReceiptChecksum
    );
    registryText = updateRegistryModulePlanChecksum(
      registryText,
      modelKey,
      modulePlanChecksum
    );
    return {
      manifestText,
      adapterFamilyText,
      assemblyReceiptText,
      modulePlanText,
      registryText
    };
  }
  // Reuses one coherent drift bundle across all paused fetches in the smoke run.
  function driftFor(requestUrl) {
    if (!driftPromise) {
      driftPromise = buildDrift(requestUrl);
    }
    return driftPromise;
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).registryText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, modulePlanRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).modulePlanText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, assemblyReceiptRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).assemblyReceiptText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterFamilyRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).adapterFamilyText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).manifestText);
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installAdapterArtifactDriftInterceptor(client, modelKey) {
  installAdapterStackArtifactDriftInterceptor(client, modelKey, 0);
}

function installAdapterStackPrefetchDriftInterceptor(client, modelKey) {
  installAdapterStackArtifactDriftInterceptor(client, modelKey, 1);
}

function installAdapterStackRustValidateDriftInterceptor(client, modelKey) {
  const adapterIndex = 1;
  const stackIndex = 0;
  const moduleIndex = 4;
  const adapterStackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  const adapterManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  const adapterStackRoute = adapterStackRoutes[stackIndex];
  const adapterManifestRoute = adapterManifestRoutes[adapterIndex];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  const assemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  const modulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!adapterStackRoute || !adapterManifestRoute || !adapterFamilyRoute || !assemblyReceiptRoute || !modulePlanRoute) {
    throw new Error(`generated semantic adapter drift routes were incomplete for ${modelKey}`);
  }
  let driftPromise = null;
  async function buildDrift(requestUrl) {
    const artifactBytes = adapterIdentityDriftBytes(
      await getBuffer(new URL(adapterStackRoute, requestUrl).toString())
    );
    const artifactChecksum = adapterArtifactChecksumHex(artifactBytes);
    const manifestText = updateAdapterManifestArtifactChecksum(
      await getText(new URL(adapterManifestRoute, requestUrl).toString()),
      artifactChecksum
    );
    const manifestChecksum = textChecksumHex(manifestText);
    const adapterFamilyText = updateAdapterFamilyMemberChecksums(
      await getText(new URL(adapterFamilyRoute, requestUrl).toString()),
      adapterIndex,
      artifactChecksum,
      manifestChecksum
    );
    const adapterFamilyChecksum = textChecksumHex(adapterFamilyText);
    const assemblyReceiptText = updateAssemblyAdapterFamilyReceiptChecksum(
      await getText(new URL(assemblyReceiptRoute, requestUrl).toString()),
      adapterFamilyChecksum
    );
    const assemblyReceiptChecksum = textChecksumHex(assemblyReceiptText);
    let modulePlanText = await getText(new URL(modulePlanRoute, requestUrl).toString());
    modulePlanText = updateModulePlanAssemblyReceiptChecksum(modulePlanText, assemblyReceiptChecksum);
    modulePlanText = updateModulePlanAdapterFamilyReceiptChecksum(modulePlanText, adapterFamilyChecksum);
    modulePlanText = updateModulePlanAdapterStackChecksums(
      modulePlanText,
      moduleIndex,
      artifactChecksum,
      manifestChecksum
    );
    const modulePlanChecksum = textChecksumHex(modulePlanText);
    let registryText = await getText(new URL("/models/selector.registry", requestUrl).toString());
    registryText = updateRegistryAdapterChecksums(
      registryText,
      modelKey,
      adapterIndex,
      artifactChecksum,
      manifestChecksum
    );
    registryText = updateRegistryAdapterFamilyReceiptChecksum(
      registryText,
      modelKey,
      adapterFamilyChecksum
    );
    registryText = updateRegistryAssemblyReceiptChecksum(
      registryText,
      modelKey,
      assemblyReceiptChecksum
    );
    registryText = updateRegistryModulePlanChecksum(
      registryText,
      modelKey,
      modulePlanChecksum
    );
    return {
      artifactBytes,
      manifestText,
      adapterFamilyText,
      assemblyReceiptText,
      modulePlanText,
      registryText
    };
  }
  function driftFor(requestUrl) {
    if (!driftPromise) {
      driftPromise = buildDrift(requestUrl);
    }
    return driftPromise;
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).registryText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, modulePlanRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).modulePlanText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, assemblyReceiptRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).assemblyReceiptText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterFamilyRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).adapterFamilyText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).manifestText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterStackRoute)) {
        await fulfillBinaryRequest(client, params.requestId, (await driftFor(requestUrl)).artifactBytes);
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installModulePlanPayloadChecksumDriftInterceptor(client, modelKey) {
  const adapterIndex = 1;
  const stackIndex = 0;
  const moduleIndex = 4;
  const adapterStackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  const adapterManifestRoutes = expectedAdapterManifestRoutes[modelKey] || [];
  const adapterStackRoute = adapterStackRoutes[stackIndex];
  const adapterManifestRoute = adapterManifestRoutes[adapterIndex];
  const adapterFamilyRoute = expectedAdapterFamilyReceiptRoutes[modelKey];
  const assemblyReceiptRoute = expectedAssemblyReceiptRoutes[modelKey];
  const modulePlanRoute = expectedModulePlanRoutes[modelKey];
  if (!adapterStackRoute || !adapterManifestRoute || !adapterFamilyRoute || !assemblyReceiptRoute || !modulePlanRoute) {
    throw new Error(`generated payload checksum drift routes were incomplete for ${modelKey}`);
  }
  let driftPromise = null;
  // Builds a coherent payload drift while leaving module.N.checksum as the stale plan value.
  async function buildDrift(requestUrl) {
    const artifactBytes = Buffer.from(await getBuffer(new URL(adapterStackRoute, requestUrl).toString()));
    artifactBytes[artifactBytes.length - 1] ^= 0xff;
    const artifactChecksum = adapterArtifactChecksumHex(artifactBytes);
    const manifestText = updateAdapterManifestArtifactChecksum(
      await getText(new URL(adapterManifestRoute, requestUrl).toString()),
      artifactChecksum
    );
    const manifestChecksum = textChecksumHex(manifestText);
    const adapterFamilyText = updateAdapterFamilyMemberChecksums(
      await getText(new URL(adapterFamilyRoute, requestUrl).toString()),
      adapterIndex,
      artifactChecksum,
      manifestChecksum
    );
    const adapterFamilyChecksum = textChecksumHex(adapterFamilyText);
    const assemblyReceiptText = updateAssemblyAdapterFamilyReceiptChecksum(
      await getText(new URL(assemblyReceiptRoute, requestUrl).toString()),
      adapterFamilyChecksum
    );
    const assemblyReceiptChecksum = textChecksumHex(assemblyReceiptText);
    let modulePlanText = await getText(new URL(modulePlanRoute, requestUrl).toString());
    modulePlanText = updateModulePlanAssemblyReceiptChecksum(modulePlanText, assemblyReceiptChecksum);
    modulePlanText = updateModulePlanAdapterFamilyReceiptChecksum(modulePlanText, adapterFamilyChecksum);
    modulePlanText = updateModulePlanAdapterManifestChecksum(modulePlanText, moduleIndex, manifestChecksum);
    const modulePlanChecksum = textChecksumHex(modulePlanText);
    let registryText = await getText(new URL("/models/selector.registry", requestUrl).toString());
    registryText = updateRegistryAdapterChecksums(
      registryText,
      modelKey,
      adapterIndex,
      artifactChecksum,
      manifestChecksum
    );
    registryText = updateRegistryAdapterFamilyReceiptChecksum(
      registryText,
      modelKey,
      adapterFamilyChecksum
    );
    registryText = updateRegistryAssemblyReceiptChecksum(
      registryText,
      modelKey,
      assemblyReceiptChecksum
    );
    registryText = updateRegistryModulePlanChecksum(
      registryText,
      modelKey,
      modulePlanChecksum
    );
    return {
      artifactBytes,
      manifestText,
      adapterFamilyText,
      assemblyReceiptText,
      modulePlanText,
      registryText
    };
  }
  function driftFor(requestUrl) {
    if (!driftPromise) {
      driftPromise = buildDrift(requestUrl);
    }
    return driftPromise;
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, "/models/selector.registry")) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).registryText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, modulePlanRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).modulePlanText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, assemblyReceiptRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).assemblyReceiptText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterFamilyRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).adapterFamilyText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterManifestRoute)) {
        await fulfillTextRequest(client, params.requestId, (await driftFor(requestUrl)).manifestText);
        return;
      }
      if (requestUrlPathEquals(requestUrl, adapterStackRoute)) {
        await fulfillBinaryRequest(client, params.requestId, (await driftFor(requestUrl)).artifactBytes);
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installAdapterStackArtifactDriftInterceptor(client, modelKey, stackIndex) {
  const adapterStackRoutes = expectedAdapterStackRoutes[modelKey] || [];
  const adapterStackRoute = adapterStackRoutes[stackIndex];
  if (!adapterStackRoute) {
    throw new Error(`no generated adapter stack route is known for ${modelKey}`);
  }
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    (async () => {
      if (requestUrlPathEquals(requestUrl, adapterStackRoute)) {
        const body = Buffer.from(await getBuffer(requestUrl));
        body[body.length - 1] ^= 0xff;
        await fulfillBinaryRequest(client, params.requestId, body);
        return;
      }
      await continuePausedRequest(client, params.requestId);
    })().catch((error) => {
      console.error(error);
      continuePausedRequest(client, params.requestId).catch((continueError) => {
        console.error(continueError);
      });
    });
  });
}

function installQuantizedAdapterRegistryInterceptor(client) {
  client.on("Fetch.requestPaused", (params) => {
    const requestUrl = params.request && params.request.url ? params.request.url : "";
    if (requestUrl.includes("/models/selector.registry")) {
      const body = Buffer.from([
        "tinyrustlm_selector_registry_version=1",
        "selector_id=browser-local-selector",
        "registry_scope=browser-local-model-selector",
        "registry_status=admitted-records-only",
        "selector_model_byte_budget=33554432",
        "selector_registry_text_byte_budget=262144",
        "manifest_text_byte_budget=65536",
        "receipt_text_byte_budget=131072",
        "evidence_text_byte_budget=131072",
        "entry_count=1",
        "admission_set_checksum=0x0000000000000061",
        "entry.0.candidate_id=tinyq8",
        "entry.0.display_name=Tiny Fixture q8_0",
        "entry.0.model_path=../models/tiny-test-model-q8.slm",
        "entry.0.manifest_path=../models/tiny-test-model-q8.slm.manifest",
        "entry.0.artifact_path=tinyrustlm/models/tiny-test-model-q8.slm",
        "entry.0.max_tokens=8",
        "entry.0.model_bytes=8832",
        "entry.0.slm_checksum=0x6bde8aa244a5c10d",
        "entry.0.model_shape=vocab=260,hidden=16,layers=1,heads=2,kv_heads=2,head_dim=8,ffn=32,context=32",
        "entry.0.quantization=q8_0",
        "entry.0.output_contract=separate-output-weight",
        "entry.0.genome_id=0x00000000000000d1",
        "entry.0.genome_strategy=selector-admission-genome-v1",
        "entry.0.genome_lineage_status=admission-bound",
        "entry.0.genome_lineage_checksum=0x00000000000000d2",
        "entry.0.species_id=0x00000000000000d3",
        "entry.0.species_strategy=selector-speciation-fit-v1",
        "entry.0.species_fit_status=browser-fit-bound",
        "entry.0.species_fit_checksum=0x00000000000000d4",
        "entry.0.novelty_id=0x00000000000000d6",
        "entry.0.novelty_strategy=selector-novelty-sketch-v1",
        "entry.0.novelty_status=behavior-sketch-bound",
        "entry.0.novelty_checksum=0x00000000000000d7",
        "entry.0.population_id=0x00000000000000d8",
        "entry.0.population_strategy=selector-population-review-route-v1",
        "entry.0.population_status=population-review-bound",
        "entry.0.population_checksum=0x00000000000000d9",
        "entry.0.mate_selection_id=0x00000000000000da",
        "entry.0.mate_selection_strategy=selector-mate-selection-route-v1",
        "entry.0.mate_selection_status=admission-only",
        "entry.0.mate_selection_parent_count=1",
        "entry.0.mate_selection_checksum=0x00000000000000db",
        "entry.0.phenotype_evidence_id=0x00000000000000dc",
        "entry.0.phenotype_evidence_strategy=selector-phenotype-evidence-v1",
        "entry.0.phenotype_evidence_status=runtime-eval-bound",
        "entry.0.phenotype_evidence_checksum=0x00000000000000dd",
        "entry.0.heritable_artifact_id=0x00000000000000de",
        "entry.0.heritable_artifact_strategy=selector-heritable-artifact-v1",
        "entry.0.heritable_artifact_status=served-artifact-bound",
        "entry.0.heritable_artifact_checksum=0x00000000000000df",
        "entry.0.admission_checksum=0x0000000000000062",
        "entry.0.promotion_manifest_checksum=0x0000000000000063",
        "entry.0.provenance_manifest_checksum=0x0000000000000067",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000064",
        "entry.0.eval_manifest_checksum=0x0000000000000065",
        "entry.0.eval_case_evidence_checksum=0x0000000000000066",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
        "entry.0.fitness_vector_status=eval-bound",
        "entry.0.fitness_vector_checksum=0x00000000000000d5",
        "entry.0.selector_status=admitted",
        "entry.0.public_claim_status=bound-to-eval-scope",
        "entry.0.adapter_path=../models/tiny-test-model-q8-self.adp1",
        "entry.0.adapter_manifest_path=../models/tiny-test-model-q8-self.adp1.manifest",
        "entry.0.adapter_label=Tiny Fixture q8_0 self ADP1",
        "entry.0.adapter_apply_status=runtime-q8-q4-compatible-or-fuse-to-slm",
        "entry.0.adapter_artifact_checksum=0x8194a8a671285019",
        "entry.0.adapter_manifest_checksum=0x536f9b488db9822b",
        "required_next_gate=browser-loads-selector-registry-entry-models",
        ""
      ].join("\n"), "utf8");
      client.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "content-type", value: "text/plain; charset=utf-8" },
          { name: "content-length", value: String(body.length) }
        ],
        body: body.toString("base64")
      }).catch((error) => {
        console.error(error);
      });
      return;
    }
    client.send("Fetch.continueRequest", {
      requestId: params.requestId
    }).catch((error) => {
      console.error(error);
    });
  });
}

async function main() {
  const browser = findBrowser();
  const profile = path.join(os.tmpdir(), `tinyrustlm-browser-smoke-${process.pid}`);
  await removeProfile(profile);
  const browserArgs = [
    "--headless=new",
    "--disable-gpu",
    "--disable-application-cache",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-extensions",
    "--disable-sync",
    "--disk-cache-size=1",
    "--media-cache-size=1",
    "--no-default-browser-check",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`
  ];
  if (publicLocalOnlySmokeMode) {
    browserArgs.push("--host-resolver-rules=MAP tinyrustlm.com 127.0.0.1,MAP www.tinyrustlm.com 127.0.0.1");
  }
  browserArgs.push(appUrl);
  const browserProcess = childProcess.spawn(browser, browserArgs, {
    stdio: "ignore",
    windowsHide: true
  });
  try {
    const target = await waitForTarget();
    const socket = await connectWebSocket(target.webSocketDebuggerUrl);
    const client = cdpClient(socket);
    const networkRequests = [];
    client.on("Network.requestWillBeSent", (params) => {
      if (params.request && params.request.url) {
        networkRequests.push(params.request.url);
      }
    });
    await client.send("Page.enable", {});
    await client.send("Runtime.enable", {});
    await client.send("Network.enable", {});
    if (smokeMode === "model-error" || smokeMode === "missing-model" || convertedTrainedRegistrySmokeMode || convertedTrainedSourceManifestDriftSmokeMode || convertedTrainedSourceIdentityDriftSmokeMode || convertedTrainedSourceReviewDriftSmokeMode || convertedTrainedSourceReviewSidecarDriftSmokeMode || convertedTrainedSourceReviewTokenizerImportDriftSmokeMode || convertedTrainedSourceReviewEvalRouteDriftSmokeMode || convertedTrainedSourceReviewOmittedSmokeMode || convertedTrainedSourceValidationDriftSmokeMode || convertedTrainedRuntimeEvidenceDriftSmokeMode || convertedTrainedEvalEvidenceDriftSmokeMode || convertedTrainedAdmissionDriftSmokeMode || compactOperatorRegistrySmokeModes.has(smokeMode) || compactOperatorReceiptDriftSmokeModes.has(smokeMode) || generatedSelectorDriftSmokeModes.has(smokeMode) || smokeMode === "selector-budget" || smokeMode === "sidecar-budget-contract" || smokeMode === "runtime-manifest-drift" || smokeMode === "module-plan-profile-drift" || smokeMode === "module-plan-execution-profile-drift" || smokeMode === "module-plan-fetch-policy-drift" || smokeMode === "module-plan-origin-policy-drift" || smokeMode === "module-plan-wasm-memory-drift" || smokeMode === "module-plan-wasm-export-set-drift" || smokeMode === "module-plan-wasm-heap-drift" || smokeMode === "module-plan-context-token-drift" || smokeMode === "module-plan-sampler-cap-drift" || smokeMode === "module-plan-tokenizer-drift" || smokeMode === "module-plan-resource-drift" || smokeMode === "module-plan-runtime-scratch-drift" || smokeMode === "module-plan-output-limit-drift" || smokeMode === "module-plan-prompt-limit-drift" || smokeMode === "module-plan-fetch-count-drift" || smokeMode === "module-plan-planned-fetch-count-drift" || smokeMode === "module-plan-route-set-algorithm-drift" || smokeMode === "module-plan-route-set-version-drift" || smokeMode === "module-plan-route-set-drift" || smokeMode === "module-plan-operator-receipt-drift" || smokeMode === "module-plan-kv-cache-drift" || smokeMode === "module-plan-adapter-stack-budget-drift" || smokeMode === "module-plan-total-budget-drift" || smokeMode === "module-plan-total-limit-drift" || smokeMode === "module-plan-count-drift" || smokeMode === "module-plan-graph-drift" || smokeMode === "module-plan-stack-drift" || smokeMode === "module-plan-role-drift" || smokeMode === "module-plan-slot-drift" || smokeMode === "module-plan-phase-drift" || smokeMode === "module-plan-byte-drift" || smokeMode === "module-plan-checksum-drift" || smokeMode === "module-plan-dependency-drift" || smokeMode === "assembly-eval-case-drift" || smokeMode === "assembly-evidence-file-drift" || smokeMode === "adapter-family-receipt-drift" || smokeMode === "adapter-manifest-drift" || smokeMode === "source-backed-alr1-manifest-drift" || smokeMode === "adapter-artifact-drift" || smokeMode === "module-plan-payload-checksum-drift" || smokeMode === "adapter-stack-prefetch-drift" || smokeMode === "adapter-stack-rust-validate-drift" || smokeMode === "adapter-sidecar-registry-q8" || smokeMode === "adapter-sidecar-checksum-mismatch" || smokeMode === "adapter-manifest-budget") {
      if (smokeMode === "model-error") {
        installMalformedModelInterceptor(client);
      } else if (smokeMode === "missing-model") {
        installMissingModelInterceptor(client);
      } else if (smokeMode === "runtime-manifest-drift") {
        installRuntimeManifestDriftInterceptor(client);
      } else if (smokeMode === "module-plan-profile-drift") {
        installModulePlanProfileDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-execution-profile-drift") {
        installModulePlanExecutionProfileDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-fetch-policy-drift") {
        installModulePlanFetchPolicyDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-origin-policy-drift") {
        installModulePlanOriginPolicyDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-wasm-memory-drift") {
        installModulePlanWasmMemoryDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-wasm-export-set-drift") {
        installModulePlanWasmExportSetDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-wasm-heap-drift") {
        installModulePlanWasmHeapDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-context-token-drift") {
        installModulePlanContextTokenDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-sampler-cap-drift") {
        installModulePlanSamplerCapDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-tokenizer-drift") {
        installModulePlanTokenizerDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-resource-drift") {
        installModulePlanResourceDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-runtime-scratch-drift") {
        installModulePlanRuntimeScratchDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-output-limit-drift") {
        installModulePlanOutputLimitDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-prompt-limit-drift") {
        installModulePlanPromptLimitDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-fetch-count-drift") {
        installModulePlanFetchCountDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-planned-fetch-count-drift") {
        installModulePlanPlannedFetchCountDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-route-set-algorithm-drift") {
        installModulePlanRouteSetAlgorithmDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-route-set-version-drift") {
        installModulePlanRouteSetVersionDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-route-set-drift") {
        installModulePlanRouteSetDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-operator-receipt-drift") {
        installModulePlanOperatorReceiptDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-kv-cache-drift") {
        installModulePlanKvCacheDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-adapter-stack-budget-drift") {
        installModulePlanAdapterStackBudgetDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-total-budget-drift") {
        installModulePlanTotalBudgetDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-total-limit-drift") {
        installModulePlanTotalLimitDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-count-drift") {
        installModulePlanCountDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-graph-drift") {
        installModulePlanGraphDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-stack-drift") {
        installModulePlanStackDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-role-drift") {
        installModulePlanRoleDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-slot-drift") {
        installModulePlanSlotDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-phase-drift") {
        installModulePlanPhaseDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-byte-drift") {
        installModulePlanByteDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-checksum-drift") {
        installModulePlanChecksumDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-dependency-drift") {
        installModulePlanDependencyDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "assembly-eval-case-drift") {
        installAssemblyEvalCaseDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "assembly-evidence-file-drift") {
        installAssemblyEvidenceFileDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "adapter-family-receipt-drift") {
        installAdapterFamilyReceiptDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "adapter-manifest-drift") {
        installAdapterManifestDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "source-backed-alr1-manifest-drift") {
        installSourceBackedAlr1ManifestDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "adapter-artifact-drift") {
        installAdapterArtifactDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-payload-checksum-drift") {
        installModulePlanPayloadChecksumDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "adapter-stack-prefetch-drift") {
        installAdapterStackPrefetchDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "adapter-stack-rust-validate-drift") {
        installAdapterStackRustValidateDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "adapter-sidecar-checksum-mismatch") {
        installCorruptAdapterInterceptor(client);
      } else if (smokeMode === "adapter-manifest-budget") {
        installAdapterManifestBudgetInterceptor(client);
      } else if (smokeMode === "adapter-sidecar-registry-q8") {
        installQuantizedAdapterRegistryInterceptor(client);
      } else if (convertedTrainedRegistrySmokeMode) {
        installConvertedTrainedRegistryInterceptor(client);
      } else if (convertedTrainedSourceManifestDriftSmokeMode) {
        installConvertedTrainedSourceManifestDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceIdentityDriftSmokeMode) {
        installConvertedTrainedSourceIdentityDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceReviewDriftSmokeMode) {
        installConvertedTrainedSourceReviewDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceReviewSidecarDriftSmokeMode) {
        installConvertedTrainedSourceReviewSidecarDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceReviewTokenizerImportDriftSmokeMode) {
        installConvertedTrainedSourceReviewTokenizerImportDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceReviewEvalRouteDriftSmokeMode) {
        installConvertedTrainedSourceReviewEvalRouteDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceReviewOmittedSmokeMode) {
        installConvertedTrainedSourceReviewOmittedInterceptor(client, expectedModel);
      } else if (convertedTrainedSourceValidationDriftSmokeMode) {
        installConvertedTrainedSourceValidationDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedRuntimeEvidenceDriftSmokeMode) {
        installConvertedTrainedRuntimeEvidenceDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedEvalEvidenceDriftSmokeMode) {
        installConvertedTrainedEvalEvidenceDriftInterceptor(client, expectedModel);
      } else if (convertedTrainedAdmissionDriftSmokeMode) {
        installConvertedTrainedAdmissionDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "selector-budget") {
        installSelectorBudgetRegistryInterceptor(client);
      } else if (smokeMode === "sidecar-budget-contract") {
        installSidecarBudgetContractRegistryInterceptor(client);
      } else if (compactOperatorReceiptDriftSmokeModes.has(smokeMode)) {
        installSelectorOperatorReceiptDriftInterceptor(client);
      } else if (smokeMode === "generated-selector-operator-receipt-drift") {
        installGeneratedSelectorOperatorReceiptDriftInterceptor(client);
      } else if (smokeMode === "generated-selector-operator-kind-drift") {
        installGeneratedSelectorOperatorReceiptDriftInterceptor(
          client,
          driftGeneratedSelectorOperatorReceiptKind
        );
      } else if (smokeMode === "generated-selector-schedule-source-drift") {
        installGeneratedSelectorOperatorReceiptDriftInterceptor(
          client,
          driftGeneratedSelectorScheduleSource
        );
      } else if (smokeMode === "generated-selector-schedule-family-drift") {
        installGeneratedSelectorOperatorReceiptDriftInterceptor(
          client,
          driftGeneratedSelectorScheduleFamily
        );
      } else {
        installMultiParentRegistryInterceptor(client);
      }
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (hfSearchUiSmokeMode || hfLocalCatalogSmokeMode || hfPeerAnnouncementSmokeMode || hfCatalogAnnouncementRouteSmokeMode) {
      installHfSearchUiInterceptor(client);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (smokeMode === "module-plan-wasm-transfer-drift") {
      installModulePlanWasmTransferDriftInterceptor(client, expectedModel);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (smokeMode === "module-plan-model-release-drift") {
      installModulePlanModelReleaseDriftInterceptor(client, expectedModel);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (smokeMode === "module-plan-runtime-reset-drift") {
      installModulePlanRuntimeResetDriftInterceptor(client, expectedModel);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (smokeMode === "module-plan-adapter-validation-drift") {
      installModulePlanAdapterValidationDriftInterceptor(client, expectedModel);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (smokeMode === "module-plan-adapter-validation-count-drift") {
      installModulePlanAdapterValidationCountDriftInterceptor(client, expectedModel);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    if (smokeMode === "module-plan-adapter-apply-count-drift") {
      installModulePlanAdapterApplyCountDriftInterceptor(client, expectedModel);
      await client.send("Fetch.enable", {
        patterns: [
          {
            urlPattern: "*",
            requestStage: "Request"
          }
        ]
      });
    }
    let result = null;
    if (smokeMode === "loop") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageLoopSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertLoopSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "endurance") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageEnduranceSmoke(client, enduranceCycles);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertEnduranceSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "performance") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPagePerformanceSmoke(client, performanceTokens);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertPerformanceSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "performance-soak") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPagePerformanceSoak(client, performanceSoakCycles, performanceSoakTokens);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertPerformanceSoak(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "ui-audit") {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await client.send("Page.navigate", { url: appUrl });
      let desktop = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(1000);
          desktop = await runPageUiAudit(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true
      });
      await client.send("Page.navigate", { url: appUrl });
      let mobile = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(1000);
          mobile = await runPageUiAudit(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      result = { desktop, mobile, networkRequests };
      assertUiAudit(result, networkRequests);
    } else if (smokeMode === "source-options-ui") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageSourceOptionsSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertSourceOptionsSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "hf-search-ui") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageHfSearchUiSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertHfSearchUiSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (hfCatalogAnnouncementRouteSmokeMode) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageHfSearchUiSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertHfCatalogAnnouncementRouteSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (hfLocalCatalogSmokeMode) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageHfLocalCatalogSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertHfLocalCatalogSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (hfPeerAnnouncementSmokeMode) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageHfLocalCatalogSmoke(client, { peerAnnouncementOverlay: true });
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertHfPeerAnnouncementSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "share-metadata-ui") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageShareMetadataSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertShareMetadataSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "step-token") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageStepTokenSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertStepTokenSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "combined-selector-assembly" || smokeMode === "combined-selector-operator-family") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageCombinedSelectorAssemblySmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (smokeMode === "combined-selector-operator-family") {
        assertCombinedSelectorOperatorFamilySmoke(result, networkRequests);
      } else {
        assertCombinedSelectorAssemblySmoke(result, networkRequests);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "combined-selector-cycle" || smokeMode === "combined-selector-operator-family-cycle" || combinedSelectorRouteSoakMode) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageCombinedSelectorAssemblySmoke(client, combinedSelectorCycles);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (combinedSelectorRouteSoakMode) {
        assertCombinedSelectorRouteSoakSmoke(result, networkRequests, combinedSelectorCycles);
      } else if (smokeMode === "combined-selector-operator-family-cycle") {
        assertCombinedSelectorOperatorFamilyCycleSmoke(result, networkRequests, combinedSelectorCycles);
      } else {
        assertCombinedSelectorCycleSmoke(result, networkRequests, combinedSelectorCycles);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "combined-selector-reload-soak" || combinedSelectorOperatorFamilyReloadSoakMode) {
      result = await runCombinedSelectorReloadSoak(client, combinedSelectorReloads);
      if (combinedSelectorOperatorFamilyReloadSoakMode) {
        assertCombinedSelectorOperatorFamilyReloadSoakSmoke(result, networkRequests, combinedSelectorReloads);
      } else {
        assertCombinedSelectorReloadSoakSmoke(result, networkRequests, combinedSelectorReloads);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "adapter-sidecar" || smokeMode === "adapter-sidecar-registry-file" || smokeMode === "adapter-sidecar-registry-q8" || smokeMode === "adapter-sidecar-checksum-mismatch") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageAdapterSidecarSmoke(
            client,
            expectedModel,
            smokeMode === "adapter-sidecar-registry-file"
          );
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (smokeMode === "adapter-sidecar-checksum-mismatch") {
        assertAdapterChecksumMismatchSmoke(result, expectedModel, networkRequests);
      } else {
        assertAdapterSidecarSmoke(
          result,
          expectedModel,
          networkRequests,
          smokeMode === "adapter-sidecar-registry-file"
        );
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "adapter-manifest-budget") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageAdapterLoadStateSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertAdapterManifestBudgetSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "adapter-family-receipt-drift" || smokeMode === "adapter-manifest-drift" || smokeMode === "source-backed-alr1-manifest-drift" || smokeMode === "adapter-artifact-drift" || smokeMode === "module-plan-payload-checksum-drift" || smokeMode === "adapter-stack-prefetch-drift" || smokeMode === "adapter-stack-rust-validate-drift") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageAdapterLoadStateSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (smokeMode === "adapter-family-receipt-drift") {
        assertAdapterFamilyReceiptDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "adapter-manifest-drift") {
        assertAdapterManifestDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "source-backed-alr1-manifest-drift") {
        assertSourceBackedAlr1ManifestDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "adapter-stack-prefetch-drift") {
        assertAdapterStackPrefetchDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "adapter-stack-rust-validate-drift") {
        assertAdapterStackRustValidateDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-payload-checksum-drift") {
        assertModulePlanPayloadChecksumDriftSmoke(result, expectedModel, networkRequests);
      } else {
        assertAdapterArtifactDriftSmoke(result, expectedModel, networkRequests);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "selector-budget" || smokeMode === "sidecar-budget-contract" || compactOperatorReceiptDriftSmokeModes.has(smokeMode) || generatedSelectorDriftSmokeModes.has(smokeMode)) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageSmoke(
            client,
            generatedSelectorDriftSmokeModes.has(smokeMode) ? "tinylm16q8" : expectedModel
          );
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (smokeMode === "selector-budget") {
        assertSelectorBudgetSmoke(result, networkRequests);
      } else if (smokeMode === "sidecar-budget-contract") {
        assertSidecarBudgetContractSmoke(result, networkRequests);
      } else if (generatedSelectorDriftSmokeModes.has(smokeMode)) {
        assertGeneratedSelectorOperatorReceiptDriftSmoke(result, expectedModel, networkRequests);
      } else {
        assertSelectorOperatorReceiptDriftSmoke(
          result,
          networkRequests,
          registryOperatorFixtureForMode(smokeMode).candidateId
        );
      }
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceManifestDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceManifestDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceIdentityDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceIdentityDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceReviewDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceReviewDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceReviewSidecarDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceReviewDriftSmoke(
        result,
        expectedModel,
        networkRequests,
        "source review field source_model_sha",
        true
      );
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceReviewTokenizerImportDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceReviewDriftSmoke(
        result,
        expectedModel,
        networkRequests,
        "source review tokenizer import not-imported row had imported evidence",
        true
      );
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceReviewEvalRouteDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedEvalEvidenceDriftSmoke(
        result,
        expectedModel,
        networkRequests,
        "eval evidence route field eval_cases_route"
      );
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceReviewOmittedSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceReviewDriftSmoke(
        result,
        expectedModel,
        networkRequests,
        "source review identity missing from selector"
      );
      result.networkRequests = networkRequests;
    } else if (convertedTrainedSourceValidationDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedSourceValidationDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedRuntimeEvidenceDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedRuntimeEvidenceDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedEvalEvidenceDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedEvalEvidenceDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedAdmissionDriftSmokeMode) {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertConvertedTrainedAdmissionDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (convertedTrainedRegistryAnySmokeMode || compactOperatorRegistrySmokeModes.has(smokeMode) || smokeMode === "multi-parent-registry-file") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (convertedTrainedRegistryAnySmokeMode) {
        assertConvertedTrainedRegistrySmoke(result, expectedModel, networkRequests);
      } else {
        assertMultiParentRegistrySmoke(result, expectedModel, networkRequests);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "runtime-manifest-drift") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertRuntimeManifestDriftSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "assembly-eval-case-drift") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageAssemblyEvalCaseDriftSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertAssemblyEvalCaseDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "assembly-evidence-file-drift") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageAssemblyEvalCaseDriftSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertAssemblyEvidenceFileDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-wasm-transfer-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModulePlanWasmTransferDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-model-release-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModulePlanModelReleaseDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-runtime-reset-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModulePlanRuntimeResetDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-adapter-validation-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModulePlanAdapterValidationDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-adapter-validation-count-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModulePlanAdapterValidationCountDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-adapter-apply-count-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModulePlanAdapterApplyCountDriftSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "module-plan-profile-drift" || smokeMode === "module-plan-execution-profile-drift" || smokeMode === "module-plan-fetch-policy-drift" || smokeMode === "module-plan-origin-policy-drift" || smokeMode === "module-plan-wasm-memory-drift" || smokeMode === "module-plan-wasm-export-set-drift" || smokeMode === "module-plan-wasm-heap-drift" || smokeMode === "module-plan-context-token-drift" || smokeMode === "module-plan-sampler-cap-drift" || smokeMode === "module-plan-tokenizer-drift" || smokeMode === "module-plan-resource-drift" || smokeMode === "module-plan-runtime-scratch-drift" || smokeMode === "module-plan-output-limit-drift" || smokeMode === "module-plan-prompt-limit-drift" || smokeMode === "module-plan-fetch-count-drift" || smokeMode === "module-plan-planned-fetch-count-drift" || smokeMode === "module-plan-route-set-algorithm-drift" || smokeMode === "module-plan-route-set-version-drift" || smokeMode === "module-plan-route-set-drift" || smokeMode === "module-plan-operator-receipt-drift" || smokeMode === "module-plan-kv-cache-drift" || smokeMode === "module-plan-adapter-stack-budget-drift" || smokeMode === "module-plan-total-budget-drift" || smokeMode === "module-plan-total-limit-drift" || smokeMode === "module-plan-count-drift" || smokeMode === "module-plan-graph-drift" || smokeMode === "module-plan-stack-drift" || smokeMode === "module-plan-role-drift" || smokeMode === "module-plan-slot-drift" || smokeMode === "module-plan-phase-drift" || smokeMode === "module-plan-byte-drift" || smokeMode === "module-plan-checksum-drift" || smokeMode === "module-plan-dependency-drift") {
      networkRequests.length = 0;
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      if (smokeMode === "module-plan-profile-drift") {
        assertModulePlanProfileDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-execution-profile-drift") {
        assertModulePlanExecutionProfileDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-fetch-policy-drift") {
        assertModulePlanFetchPolicyDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-origin-policy-drift") {
        assertModulePlanOriginPolicyDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-wasm-memory-drift") {
        assertModulePlanWasmMemoryDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-wasm-export-set-drift") {
        assertModulePlanWasmExportSetDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-wasm-heap-drift") {
        assertModulePlanWasmHeapDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-context-token-drift") {
        assertModulePlanContextTokenDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-sampler-cap-drift") {
        assertModulePlanSamplerCapDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-tokenizer-drift") {
        assertModulePlanTokenizerDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-resource-drift") {
        assertModulePlanResourceDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-runtime-scratch-drift") {
        assertModulePlanRuntimeScratchDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-output-limit-drift") {
        assertModulePlanOutputLimitDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-prompt-limit-drift") {
        assertModulePlanPromptLimitDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-fetch-count-drift") {
        assertModulePlanFetchCountDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-planned-fetch-count-drift") {
        assertModulePlanPlannedFetchCountDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-route-set-algorithm-drift") {
        assertModulePlanRouteSetAlgorithmDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-route-set-version-drift") {
        assertModulePlanRouteSetVersionDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-route-set-drift") {
        assertModulePlanRouteSetDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-operator-receipt-drift") {
        assertModulePlanOperatorReceiptDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-kv-cache-drift") {
        assertModulePlanKvCacheDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-adapter-stack-budget-drift") {
        assertModulePlanAdapterStackBudgetDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-total-budget-drift") {
        assertModulePlanTotalBudgetDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-total-limit-drift") {
        assertModulePlanTotalLimitDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-count-drift") {
        assertModulePlanCountDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-graph-drift") {
        assertModulePlanGraphDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-stack-drift") {
        assertModulePlanStackDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-role-drift") {
        assertModulePlanRoleDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-slot-drift") {
        assertModulePlanSlotDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-phase-drift") {
        assertModulePlanPhaseDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-byte-drift") {
        assertModulePlanByteDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-checksum-drift") {
        assertModulePlanChecksumDriftSmoke(result, expectedModel, networkRequests);
      } else {
        assertModulePlanDependencyDriftSmoke(result, expectedModel, networkRequests);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "model-error") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageModelErrorSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertModelErrorSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "missing-model") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageMissingModelSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertMissingModelSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "context-error") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageContextErrorSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertContextErrorSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "prompt-limit") {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPagePromptLimitSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertPromptLimitSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (catalogLocalImportSmokeMode) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageCatalogLocalImportSmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertCatalogLocalImportSmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (publicLocalOnlySmokeMode) {
      await client.send("Page.reload", { ignoreCache: true });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPagePublicLocalOnlySmoke(client);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertPublicLocalOnlySmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await sleep(500);
          result = await runPageSmoke(client, expectedModel);
          break;
        } catch (error) {
          if (!error.message.includes("Execution context was destroyed") || attempt === 2) {
            throw error;
          }
        }
      }
      assertSmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    }
    console.log(JSON.stringify(result, null, 2));
    socket.close();
  } finally {
    killProcessTree(browserProcess);
    killProfileProcesses(profile);
    await waitForExit(browserProcess);
    try {
      await removeProfile(profile);
    } catch (error) {
      console.error(`notice: unable to remove temporary browser profile ${profile}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
