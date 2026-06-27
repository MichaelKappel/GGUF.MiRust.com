#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const appUrl = process.argv[2] || "http://127.0.0.1:8080/app/";
const port = Number(process.argv[3] || 9223);
const expectedModel = process.argv[4] || "tinylm16q8";
const smokeMode = process.argv[5] || "single";
const enduranceCycles = Math.max(2, Math.min(20, Number.parseInt(process.argv[6] || "4", 10) || 4));
const performanceTokens = Math.max(2, Math.min(8, Number.parseInt(process.argv[6] || "4", 10) || 4));
const performanceSoakCycles = Math.max(2, Math.min(10, Number.parseInt(process.argv[6] || "3", 10) || 3));
const performanceSoakTokens = Math.max(2, Math.min(8, Number.parseInt(process.argv[7] || "4", 10) || 4));

const expectedQuantization = {
  tinylm16q8: "q8_0",
  tinylm16q4: "q4_0",
  tinylm16f32: "f32",
  tinyf32: "f32",
  tinytied: "f32",
  tinyq8: "q8_0",
  tinyq4: "q4_0",
  tinybpe: "f32"
};

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTarget() {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const targets = JSON.parse(await get(endpoint));
      const appTarget = targets.find((target) => target.url && target.url.includes("/app/"));
      if (appTarget) {
        return appTarget;
      }
      if (targets[0]) {
        return targets[0];
      }
    } catch (_error) {
      await sleep(100);
    }
  }
  throw new Error("Timed out waiting for a browser debugging target");
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
}

async function runPageModelErrorSmoke(client) {
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
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
  return JSON.parse(result.result.value);
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
      const textList = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.textContent.trim());
      const badRects = () => Array.from(document.querySelectorAll(".topbar,.notice,.panel,.footnote,button,textarea,select,input"))
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
          footer: byId("appFooter") ? byId("appFooter").textContent.replace(/\\s+/g, " ").trim() : "",
          headings: textList(".panel h2"),
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
          provenanceAdmission: byId("provenanceAdmission").textContent,
          provenanceQualityClaim: byId("provenanceQualityClaim").textContent,
          provenanceTrainedClaim: byId("provenanceTrainedClaim").textContent,
          provenanceChecksum: byId("provenanceChecksum").textContent,
          provenanceNextGate: byId("provenanceNextGate").textContent,
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
          panelCount: document.querySelectorAll(".panel").length,
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
  return JSON.parse(result.result.value);
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

function assertSmoke(result, modelKey) {
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
    "Conversation",
    "Response",
    "Model Loading",
    "Model Provenance",
    "Benchmark",
    "Runtime Diagnostics",
    "Token Generation Console",
    "Developer Mode"
  ];
  const requiredLabels = ["Prompt", "Max Tokens", "Temperature", "Top K", "Top P", "Seed", "Model"];
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
  if (snapshot.eyebrow !== "GGUF.MiRust.com") {
    failures.push(`${prefix} eyebrow was ${snapshot.eyebrow}`);
  }
  if (snapshot.notice !== "All inference runs locally in this browser. Prompts are not sent to a server.") {
    failures.push(`${prefix} local-only notice was ${snapshot.notice}`);
  }
  if (!snapshot.footer.includes("TinyRustLM") || !snapshot.footer.includes("GGUF.MiRust.com") || !snapshot.footer.includes("Rust/WASM")) {
    failures.push(`${prefix} footer did not expose product, site, and Rust/WASM identity`);
  }
  for (const heading of requiredHeadings) {
    if (!snapshot.headings.includes(heading)) {
      failures.push(`${prefix} missing heading ${heading}`);
    }
  }
  for (const label of requiredLabels) {
    if (!snapshot.labels.includes(label)) {
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
      if (snapshot.conversationItems[0].role !== "User" || snapshot.conversationItems[0].text !== "hi") {
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
  if (snapshot.provenanceAdmission !== "accepted-for-runtime-smoke") {
    failures.push(`${prefix} provenance admission was ${snapshot.provenanceAdmission}`);
  }
  if (snapshot.provenanceQualityClaim !== "runtime-execution-smoke-only") {
    failures.push(`${prefix} provenance quality claim was ${snapshot.provenanceQualityClaim}`);
  }
  if (snapshot.provenanceTrainedClaim !== "not-claimed") {
    failures.push(`${prefix} provenance trained claim was ${snapshot.provenanceTrainedClaim}`);
  }
  if (!String(snapshot.provenanceChecksum).startsWith("0x")) {
    failures.push(`${prefix} provenance checksum was ${snapshot.provenanceChecksum}`);
  }
  if (snapshot.provenanceNextGate !== "replace-with-trained-or-evaluated-model-before-product-quality-claim") {
    failures.push(`${prefix} provenance next gate was ${snapshot.provenanceNextGate}`);
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

async function main() {
  const browser = findBrowser();
  const profile = path.join(os.tmpdir(), `tinyrustlm-browser-smoke-${process.pid}`);
  await removeProfile(profile);
  const browserProcess = childProcess.spawn(browser, [
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
    `--user-data-dir=${profile}`,
    appUrl
  ], {
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
    if (smokeMode === "model-error" || smokeMode === "missing-model") {
      if (smokeMode === "model-error") {
        installMalformedModelInterceptor(client);
      } else {
        installMissingModelInterceptor(client);
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
      assertSmoke(result, expectedModel);
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
      console.error(`warning: unable to remove temporary browser profile ${profile}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
