(function () {
  "use strict";

  const paths = {
    wasm: "../runtime/tinyrustlm.wasm",
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
        maxTokens: 16
      },
      tinytied: {
        label: "Tiny Fixture tied-output f32",
        path: "../models/tiny-test-model-tied.slm",
        maxTokens: 16
      },
      tinyq8: {
        label: "Tiny Fixture q8_0",
        path: "../models/tiny-test-model-q8.slm",
        maxTokens: 16
      },
      tinyq4: {
        label: "Tiny Fixture q4_0",
        path: "../models/tiny-test-model-q4.slm",
        maxTokens: 16
      },
      tinybpe: {
        label: "Tiny Fixture BPE f32",
        path: "../models/tiny-test-model-bpe.slm",
        maxTokens: 16
      }
    }
  };

  const state = {
    instance: null,
    exports: null,
    encoder: new TextEncoder(),
    decoder: new TextDecoder(),
    modelLoadMs: 0,
    lastGenerateMs: 0,
    lastMeasuredTokens: 0,
    modelLoadSequence: 0,
    modelManifest: null,
    selectorRegistry: null,
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
    provenanceChecksum: document.getElementById("provenanceChecksum"),
    provenanceNextGate: document.getElementById("provenanceNextGate")
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
    el.modelSelect.value = models[selected] ? selected : firstKey;
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

  function registryModelEntries(fields) {
    if (!fields || fields.tinyrustlm_selector_registry_version !== "1") {
      return null;
    }
    if (fields.registry_status !== "admitted-records-only") {
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
      models[candidateId] = {
        label: fields[`${prefix}.display_name`] || candidateId,
        path: modelPath,
        maxTokens
      };
    }
    return models;
  }

  async function loadSelectorRegistry() {
    try {
      const response = await fetch(paths.registry);
      if (!response.ok) {
        return;
      }
      const fields = parseManifest(await response.text());
      const models = registryModelEntries(fields);
      if (!models) {
        return;
      }
      paths.models = models;
      state.selectorRegistry = fields;
      renderModelOptions(paths.models);
    } catch (_error) {
      state.selectorRegistry = null;
    }
  }

  function renderProvenance(status, fields, isError) {
    setText(el.provenanceState, status, isError);
    el.provenanceSourceKind.textContent = manifestValue(fields, "source_kind");
    el.provenanceAdmission.textContent = manifestValue(fields, "admission_status");
    el.provenanceQualityClaim.textContent = manifestValue(fields, "quality_claim");
    el.provenanceTrainedClaim.textContent = manifestValue(fields, "trained_quality_claim");
    el.provenanceChecksum.textContent = manifestValue(fields, "slm_checksum");
    el.provenanceNextGate.textContent = manifestValue(fields, "required_next_gate");
  }

  async function loadModelManifest(model) {
    const manifestPath = `${model.path}.manifest`;
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) {
        throw new Error(`Unable to fetch local .slm manifest (${response.status})`);
      }
      const fields = parseManifest(await response.text());
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
  }

  async function loadSelectedModel() {
    const loadId = state.modelLoadSequence + 1;
    state.modelLoadSequence = loadId;
    const selectedModel = paths.models[el.modelSelect.value] ? el.modelSelect.value : "tinylm16q8";
    const model = paths.models[selectedModel];
    el.modelSelect.value = selectedModel;
    const modelPath = model.path;
    el.maxTokens.value = String(model.maxTokens);
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    setInteractive(false);
    el.response.textContent = "";
    el.console.textContent = "";
    state.modelManifest = null;
    renderProvenance("waiting for accepted model", null, false);
    setText(el.runtimeStatus, "Loading local model");
    setText(el.modelState, "loading");
    const started = performance.now();
    let modelBytes = null;
    try {
      const response = await fetch(modelPath);
      if (!response.ok) {
        throw new Error(`Unable to fetch local .slm model (${response.status})`);
      }
      modelBytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (loadId !== state.modelLoadSequence) {
        return false;
      }
      state.modelLoadMs = Math.round(performance.now() - started);
      state.lastGenerateMs = 0;
      state.hasContext = false;
      state.lastMeasuredTokens = 0;
      setText(el.modelState, "fetch error", true);
      setText(el.runtimeStatus, "Model load failed", true);
      setText(el.errorState, errorMessage(error), true);
      renderProvenance("model not loaded", null, true);
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
    state.hasContext = false;
    state.lastMeasuredTokens = 0;
    setText(el.modelState, loadCode === 0 ? `loaded (${state.modelLoadMs} ms)` : `error ${loadCode}`, loadCode !== 0);
    setText(el.runtimeStatus, loadCode === 0 ? "Ready" : "Model rejected", loadCode !== 0);
    setText(el.errorState, loadCode === 0 ? "none" : readLastResult(), loadCode !== 0);
    if (loadCode === 0) {
      renderProvenance("loading local manifest", null, false);
      await loadModelManifest(model);
    } else {
      renderProvenance("model rejected", null, true);
    }
    setControls(loadCode === 0, true);
    renderDiagnostics();
    return loadCode === 0;
  }

  async function boot() {
    try {
      setText(el.runtimeStatus, "Loading runtime");
      setInteractive(false);
      const wasmBytes = await fetch(paths.wasm).then((response) => {
        if (!response.ok) {
          throw new Error("Unable to fetch WASM runtime");
        }
        return response.arrayBuffer();
      });
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
