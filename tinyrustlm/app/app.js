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
  const registryModulePlanRuntimeScratchByteBudget = 64 * 1024;
  const runtimeWasmKind = "tinyrustlm-rust-wasm";
  const runtimeWasmStatus = "validated-local-runtime";
  const runtimeWasmNextGate = "instantiate-wasm-runtime";
  const selectorDefaultStrategy = "browser-frugal-quantized";
  const selectorModelByteBudget = 32 * 1024 * 1024;
  const selectorRegistryTextByteBudget = 256 * 1024;
  const manifestTextByteBudget = 64 * 1024;
  const receiptTextByteBudget = 128 * 1024;
  const evidenceTextByteBudget = 128 * 1024;
  const adapterFamilyReceiptStatus = "validated";
  const assemblyReceiptStatus = "validated";
  const assemblyReceiptStrategy = "multi-parent-sign-merge";
  const modulePlanReceiptStatus = "validated";
  const localFetchOptions = Object.freeze({ cache: "no-store" });
  const adapterManifestArtifactVersion = "1";
  const adapterManifestStatus = "artifact-written";
  const adapterManifestFormats = [
    {
      extension: ".adp1",
      artifactKinds: ["raw-f32-task-delta-v1"],
      dtypes: ["f32-delta"],
      defaultLabel: "ADP1 adapter",
      applyStatus: registryAdapterApplyStatus,
      quantizedApplyStatus: registryQuantizedAdapterApplyStatus
    },
    {
      extension: ".asp1",
      artifactKinds: ["sparse-f32-task-delta-v1"],
      dtypes: ["sparse-f32-delta"],
      defaultLabel: "ASP1 adapter",
      applyStatus: registryAdapterApplyStatus,
      quantizedApplyStatus: registryQuantizedAdapterApplyStatus
    },
    {
      extension: ".alr1",
      artifactKinds: ["low-rank-f32-task-delta-v1", "trained-source-low-rank-f32-v1"],
      dtypes: ["low-rank-f32-delta", "low-rank-f32-source-delta"],
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
  const assemblyEvidenceRoutes = [
    ["promotion_ledger_path", "promotion_ledger_checksum"],
    ["population_review_path", "population_review_checksum"],
    ["parent_pool_recipe_path", "parent_pool_recipe_checksum"],
    ["operator_receipt_path", "operator_receipt_checksum"],
    ["candidate_manifest_path", "candidate_manifest_checksum"],
    ["promotion_manifest_path", "promotion_manifest_checksum"],
    ["runtime_smoke_path", "runtime_smoke_manifest_checksum"],
    ["eval_path", "eval_manifest_checksum"],
    ["admission_path", "admission_checksum"]
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
    activeModelKey: "",
    modelLoaded: false,
    modelManifest: null,
    modulePlanReceipt: null,
    assemblyReceipt: null,
    modulePlanTrace: [],
    selectorRegistry: null,
    selectorDefaultModelKey: "",
    hasContext: false,
    messages: []
  };

  const el = {
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
    provenanceAdmission: document.getElementById("provenanceAdmission"),
    provenanceQualityClaim: document.getElementById("provenanceQualityClaim"),
    provenanceTrainedClaim: document.getElementById("provenanceTrainedClaim"),
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
    modulePlanModules: document.getElementById("modulePlanModules"),
    modulePlanModelBudget: document.getElementById("modulePlanModelBudget"),
    modulePlanAdapterBudget: document.getElementById("modulePlanAdapterBudget"),
    modulePlanScratchBudget: document.getElementById("modulePlanScratchBudget"),
    modulePlanBytes: document.getElementById("modulePlanBytes"),
    modulePlanChecksums: document.getElementById("modulePlanChecksums"),
    modulePlanSlots: document.getElementById("modulePlanSlots"),
    modulePlanRoles: document.getElementById("modulePlanRoles"),
    modulePlanPhases: document.getElementById("modulePlanPhases"),
    modulePlanDepends: document.getElementById("modulePlanDepends"),
    modulePlanTrace: document.getElementById("modulePlanTrace"),
    modulePlanModel: document.getElementById("modulePlanModel"),
    modulePlanStack: document.getElementById("modulePlanStack")
  };

  function setText(node, text, isError) {
    node.textContent = text;
    node.classList.toggle("error", Boolean(isError));
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

  function renderDiagnostics() {
    const diagnostics = readDiagnostics();
    el.diagnostics.textContent = diagnostics;
    el.developer.textContent = diagnostics;
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
  }

  function renderConversation() {
    el.conversation.replaceChildren();
    for (const message of state.messages) {
      const item = document.createElement("li");
      const role = document.createElement("div");
      const text = document.createElement("div");
      item.className = `message message-${message.role}`;
      item.classList.toggle("error", Boolean(message.isError));
      role.className = "message-role";
      text.className = "message-text";
      role.textContent = message.role === "user" ? "User" : "TinyRustLM";
      text.textContent = message.text;
      item.append(role, text);
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
      topK: clampInteger(el.topK.value, 1, 1024, 1),
      topP: clampNumber(el.topP.value, 0.01, 1, 1),
      seed: clampInteger(el.seed.value, 0, 4294967295, 1)
    };
    el.temperature.value = String(config.temperature);
    el.topK.value = String(config.topK);
    el.topP.value = String(config.topP);
    el.seed.value = String(config.seed);
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

  function manifestValue(fields, key) {
    return fields && fields[key] ? fields[key] : "unavailable";
  }

  function renderModelOptions(models) {
    const selected = el.modelSelect.value;
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
    const defaultKey = state.selectorDefaultModelKey;
    el.modelSelect.value = models[selected] ? selected : (models[defaultKey] ? defaultKey : firstKey);
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

  function isRegistryHex64(value) {
    return /^0x[0-9a-fA-F]{16}$/.test(value || "");
  }

  function rotateLeft64(value, bits) {
    return ((value << bits) | (value >> (64n - bits))) & checksumMask;
  }

  function textChecksumHex(text) {
    const bytes = state.encoder.encode(text);
    return bytesChecksumHex(bytes);
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

  function registryEvalEvidenceEntry(fields, prefix) {
    const checksum = fields[`${prefix}.eval_case_evidence_checksum`];
    const casesPassed = registryDecimalByteCount(fields[`${prefix}.cases_passed`]);
    if (!isRegistryHex64(checksum) || casesPassed === null) {
      return null;
    }
    return {
      checksum,
      casesPassed,
      qualityScope: fields[`${prefix}.quality_scope`] || "",
      qualityBoundary: fields[`${prefix}.quality_boundary`] || "",
      evalDataset: fields[`${prefix}.eval_dataset`] || ""
    };
  }

  function registryModulePlanEntry(fields, prefix, adapterFamily, assembly, modelBytes) {
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
      "module_plan_model_byte_budget",
      "module_plan_adapter_byte_budget",
      "module_plan_runtime_scratch_byte_budget",
      "module_plan_module_count"
    ];
    const hasModulePlan = keys.some((key) => fields[`${prefix}.${key}`]);
    if (!hasModulePlan) {
      return undefined;
    }
    const receiptPath = fields[`${prefix}.module_plan_path`];
    const receiptChecksum = fields[`${prefix}.module_plan_checksum`];
    const moduleCount = Number.parseInt(fields[`${prefix}.module_plan_module_count`] || "0", 10);
    const modelByteBudget = registryDecimalByteCount(fields[`${prefix}.module_plan_model_byte_budget`]);
    const adapterByteBudget = registryDecimalByteCount(fields[`${prefix}.module_plan_adapter_byte_budget`]);
    const runtimeScratchByteBudget = registryDecimalByteCount(
      fields[`${prefix}.module_plan_runtime_scratch_byte_budget`]
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
      runtimeScratchByteBudget === null ||
      runtimeScratchByteBudget !== registryModulePlanRuntimeScratchByteBudget
    ) {
      return null;
    }
    const expectedModuleCount = 4 + adapterFamily.autoApplyStackCount;
    if (!Number.isInteger(moduleCount) || moduleCount !== expectedModuleCount) {
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
      modelByteBudget,
      adapterByteBudget,
      runtimeScratchByteBudget,
      moduleCount
    };
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
      const evalEvidence = registryEvalEvidenceEntry(fields, prefix);
      if (!evalEvidence) {
        return null;
      }
      const modulePlan = registryModulePlanEntry(fields, prefix, adapterFamily, assembly, modelBytes);
      if (modulePlan === null) {
        return null;
      }
      models[candidateId] = {
        label: fields[`${prefix}.display_name`] || candidateId,
        path: modelPath,
        modelBytes,
        maxTokens,
        quantization,
        adapters,
        adapterFamily: adapterFamily || null,
        autoApplyPreferredAdapter: Boolean(adapterFamily),
        evalEvidence,
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

  function registryDecimalByteCount(value) {
    if (!value) {
      return null;
    }
    const bytes = Number.parseInt(value, 10);
    if (
      !Number.isSafeInteger(bytes) ||
      String(bytes) !== value ||
      bytes < 1
    ) {
      return null;
    }
    return bytes;
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

  async function loadSelectorRegistry() {
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
        return;
      }
      paths.models = registry.models;
      state.selectorRegistry = fields;
      state.selectorDefaultModelKey = registry.defaultModelKey || "";
      renderModelOptions(paths.models);
    } catch (_error) {
      state.selectorRegistry = null;
      state.selectorDefaultModelKey = "";
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

  function renderProvenance(status, fields, isError) {
    setText(el.provenanceState, status, isError);
    const model = paths.models[state.activeModelKey] || null;
    const evalEvidence = model && model.evalEvidence ? model.evalEvidence : null;
    el.provenanceSourceKind.textContent = manifestValue(fields, "source_kind");
    el.provenanceAdmission.textContent = manifestValue(fields, "admission_status");
    el.provenanceQualityClaim.textContent = manifestValue(fields, "quality_claim");
    el.provenanceTrainedClaim.textContent = manifestValue(fields, "trained_quality_claim");
    el.provenanceEvalCases.textContent = evalEvidence ? `${evalEvidence.casesPassed} passed` : "unavailable";
    el.provenanceEvalChecksum.textContent = evalEvidence ? evalEvidence.checksum : "unavailable";
    el.provenanceChecksum.textContent = manifestValue(fields, "slm_checksum");
    el.provenanceNextGate.textContent = manifestValue(fields, "required_next_gate");
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
    el.modulePlanModules.textContent = manifestValue(fields, "module_count");
    el.modulePlanModelBudget.textContent = modulePlanByteSummary(fields, "module_plan_model_byte_budget");
    el.modulePlanAdapterBudget.textContent = modulePlanByteSummary(fields, "module_plan_adapter_byte_budget");
    el.modulePlanScratchBudget.textContent = modulePlanByteSummary(
      fields,
      "module_plan_runtime_scratch_byte_budget"
    );
    el.modulePlanBytes.textContent = modulePlanModuleByteSummary(fields);
    el.modulePlanChecksums.textContent = modulePlanChecksumSummary(fields);
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
      for (const key of adapterFamilyIdentityKeys) {
        requireManifestEqual(fields, `${prefix}.${key}`, requireManifestField(fields, `family.${key}`));
      }
    }
    return fields;
  }

  function validateAdapterManifest(adapter, manifestText, receiptFields, index) {
    requireChecksumEqual(textChecksumHex(manifestText), adapter.manifestChecksum, `adapter ${index} manifest`);
    const fields = parseManifest(manifestText);
    const source = "Adapter manifest";
    const adapterFormat = adapterFormatForPath(adapter.path);
    if (!adapterFormat) {
      throw new Error("Adapter route format mismatch");
    }
    requireManifestEqual(fields, "tinyrustlm_adapter_artifact_version", adapterManifestArtifactVersion, source);
    requireManifestOneOf(fields, "adapter_artifact_kind", adapterFormat.artifactKinds, source);
    requireManifestEqual(fields, "adapter_status", adapterManifestStatus, source);
    requireManifestOneOf(fields, "adapter_dtype", adapterFormat.dtypes, source);
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
    return fields;
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
    const text = await fetchTextWithinBudget(
      model.adapterFamily.path,
      receiptTextByteBudget,
      "adapter-family receipt"
    );
    requireModulePlanTextByteCount(model, 3, text);
    const receiptFields = validateAdapterFamilyReceipt(model, text);
    const preferredIndex = adapterFamilyPreferredIndex(model, receiptFields);
    const autoApplyIndexes = adapterFamilyAutoApplyIndexes(model, receiptFields);
    const manifestFields = [];
    for (let index = 0; index < model.adapters.length; index += 1) {
      const adapter = model.adapters[index];
      const manifestText = await fetchTextWithinBudget(
        adapter.manifestPath,
        manifestTextByteBudget,
        "Adapter manifest"
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
    const runtimeScratchByteBudget = requireModulePlanByteBudget(
      fields,
      "module_plan_runtime_scratch_byte_budget",
      plan.runtimeScratchByteBudget
    );
    if (modelByteBudget !== model.modelBytes) {
      throw new Error("Module plan model byte budget mismatch");
    }
    if (model.adapterFamily && adapterByteBudget !== model.adapterFamily.autoApplyByteBudget) {
      throw new Error("Module plan adapter byte budget mismatch");
    }
    if (runtimeScratchByteBudget !== registryModulePlanRuntimeScratchByteBudget) {
      throw new Error("Module plan runtime scratch byte budget mismatch");
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
        requireModulePlanByteCount(
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

  function requireModulePlanTextByteCount(model, index, text) {
    if (model.modulePlanReceipt) {
      requireModulePlanActualByteCount(model.modulePlanReceipt, index, state.encoder.encode(text).length);
    }
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
    const text = await fetchTextWithinBudget(
      model.modulePlan.path,
      receiptTextByteBudget,
      "module plan"
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
    requireManifestEqual(fields, "assembly_strategy", assemblyReceiptStrategy, source);
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
    for (const [pathKey] of assemblyEvidenceRoutes) {
      const route = requireManifestField(fields, pathKey, "assembly receipt");
      if (!isSafeAssemblyEvidencePath(route)) {
        throw new Error(`Assembly receipt field ${pathKey} is invalid`);
      }
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

  async function verifyAssemblyEvidenceFiles(fields) {
    const evidence = [];
    for (const [pathKey, checksumKey] of assemblyEvidenceRoutes) {
      const route = requireManifestField(fields, pathKey, "assembly receipt");
      const expectedChecksum = requireManifestField(fields, checksumKey, "assembly receipt");
      const text = await fetchTextWithinBudget(route, evidenceTextByteBudget, "assembly evidence");
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
    const text = await fetchTextWithinBudget(
      model.assembly.path,
      receiptTextByteBudget,
      "assembly receipt"
    );
    requireModulePlanTextByteCount(model, 2, text);
    const fields = validateAssemblyReceipt(model, text);
    const evidence = await verifyAssemblyEvidenceFiles(fields);
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
    const manifestPath = `${model.path}.manifest`;
    try {
      const text = await fetchTextWithinBudget(
        manifestPath,
        manifestTextByteBudget,
        ".slm manifest"
      );
      requireModulePlanTextByteCount(model, 1, text);
      const fields = parseManifest(text);
      state.modelManifest = fields;
      renderProvenance("loaded", fields, false);
    } catch (error) {
      state.modelManifest = null;
      renderProvenance(errorMessage(error), null, true);
    }
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

  async function loadSelectedModel() {
    const loadId = state.modelLoadSequence + 1;
    state.modelLoadSequence = loadId;
    const selectedModel = paths.models[el.modelSelect.value] ? el.modelSelect.value : "tinylm16q8";
    const model = paths.models[selectedModel];
    const previousModelKey = state.activeModelKey;
    const releaseLoadedModel = state.modelLoaded === true;
    el.modelSelect.value = selectedModel;
    const modelPath = model.path;
    el.maxTokens.value = String(model.maxTokens);
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
      await loadModulePlanReceipt(model);
      const response = await fetch(modelPath, localFetchOptions);
      if (!response.ok) {
        throw new Error(`Unable to fetch local .slm model (${response.status})`);
      }
      modelBytes = new Uint8Array(await response.arrayBuffer());
      if (Number.isSafeInteger(model.modelBytes) && modelBytes.length !== model.modelBytes) {
        throw new Error("Selector model byte count mismatch");
      }
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
      if (model.modulePlan) {
        recordModulePlanTrace("model accepted");
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
      for (const verified of verifiedStack) {
        if (loadId !== state.modelLoadSequence) {
          return false;
        }
        validateAdapterWithRuntime(adapters[verified.index], verified.adapterBytes);
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
    if (applied > 1) {
      appendConsole(`adapter_stack_applied(${applied})`);
      setText(el.adapterState, "applied", false);
    }
    return applied > 0;
  }

  async function fetchAdapterBytes(adapter) {
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
    const adapterBytes = await fetchAdapterBytes(adapter);
    verifyAdapterBytes(model, selectedIndex, adapter, adapterBytes, isAutoAssembly, autoAssemblyBytes);
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
      adapterBytes = verifiedAdapterBytes || await fetchAdapterBytes(adapter);
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
      const initCode = state.exports.init_runtime();
      setText(el.wasmState, initCode === 0 ? "loaded" : `error ${initCode}`, initCode !== 0);
      if (initCode !== 0) {
        setText(el.runtimeStatus, "Runtime rejected", true);
        setText(el.errorState, readLastResult(), true);
        renderDiagnostics();
        return;
      }
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
    const bytes = state.encoder.encode(el.prompt.value);
    const ptr = allocCopy(bytes);
    const maxTokens = Math.max(1, Math.min(512, Number.parseInt(el.maxTokens.value, 10) || 1));
    el.maxTokens.value = String(maxTokens);
    let sampling = null;
    try {
      sampling = applySamplingConfig();
    } catch (error) {
      release(ptr, bytes.length);
      const text = errorMessage(error);
      setText(el.response, text, true);
      setText(el.errorState, text, true);
      el.console.textContent = text;
      appendMessage("user", el.prompt.value, false);
      appendMessage("assistant", text, true);
      renderDiagnostics();
      return;
    }
    const started = performance.now();
    const code = state.exports.generate(ptr, bytes.length, maxTokens);
    state.lastGenerateMs = Math.round(performance.now() - started);
    state.lastMeasuredTokens = 0;
    release(ptr, bytes.length);
    const text = readLastResult();
    state.hasContext = code === 0;
    setText(el.response, text, code !== 0);
    el.console.textContent = `generate(max_new_tokens=${maxTokens}, temperature=${sampling.temperature}, top_k=${sampling.topK}, top_p=${sampling.topP}, seed=${sampling.seed}) -> ${code} in ${state.lastGenerateMs} ms\n${text}`;
    setText(el.errorState, code === 0 ? "none" : text, code !== 0);
    appendMessage("user", el.prompt.value, false);
    appendMessage("assistant", text, code !== 0);
    renderDiagnostics();
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
      extendAssistantMessage(text);
    } else {
      setText(el.errorState, resultText, true);
      if (!el.response.textContent) {
        setText(el.response, resultText, true);
      }
      appendMessage("assistant", resultText, true);
    }
    renderDiagnostics();
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

  renderConversation();
  boot();
}());
