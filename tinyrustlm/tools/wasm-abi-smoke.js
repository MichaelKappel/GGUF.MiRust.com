#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { TextDecoder, TextEncoder } = require("util");

const root = path.resolve(__dirname, "..");
const wasmPath = process.argv[2] || path.join(root, "runtime", "tinyrustlm.wasm");
const modelPath = process.argv[3] || path.join(root, "models", "tinylm16-q8.slm");

const ErrorCode = {
  Ok: 0,
  NullPointer: 1,
  InvalidLength: 2,
  InvalidUtf8: 3,
  ModelNotLoaded: 12
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

function fail(message) {
  throw new Error(message);
}

function memory(exports) {
  return new Uint8Array(exports.memory.buffer);
}

function readString(exports, ptr, len) {
  return decoder.decode(memory(exports).slice(ptr, ptr + len));
}

function readLastResult(exports) {
  return readString(exports, exports.last_result_ptr(), exports.last_result_len());
}

function readDiagnostics(exports) {
  return JSON.parse(readString(exports, exports.get_diagnostics_ptr(), exports.get_diagnostics_len()));
}

function allocCopy(exports, bytes) {
  const ptr = exports.alloc(bytes.length);
  if (!ptr) {
    fail(`alloc(${bytes.length}) returned null`);
  }
  memory(exports).set(bytes, ptr);
  return ptr;
}

function release(exports, ptr, len) {
  if (ptr) {
    exports.dealloc(ptr, len);
  }
}

function expectCode(label, actual, expected) {
  if (actual !== expected) {
    fail(`${label} returned ${actual}, expected ${expected}`);
  }
}

function expectLastError(exports, label, expectedCode, expectedMessage) {
  expectCode(label, expectedCode.actual, expectedCode.expected);
  const result = readLastResult(exports);
  if (result !== expectedMessage) {
    fail(`${label} result was ${JSON.stringify(result)}, expected ${JSON.stringify(expectedMessage)}`);
  }
  const diagnostics = readDiagnostics(exports);
  if (diagnostics.last_error !== expectedMessage) {
    fail(`${label} diagnostics last_error was ${JSON.stringify(diagnostics.last_error)}`);
  }
  if (diagnostics.model_loaded !== true) {
    fail(`${label} diagnostics lost the loaded model state`);
  }
}

function generateBytes(exports, label, bytes, maxNewTokens, expectedCode, expectedMessage) {
  const ptr = allocCopy(exports, bytes);
  try {
    const actual = exports.generate(ptr, bytes.length, maxNewTokens);
    expectLastError(exports, label, { actual, expected: expectedCode }, expectedMessage);
  } finally {
    release(exports, ptr, bytes.length);
  }
}

async function main() {
  const wasmBytes = fs.readFileSync(wasmPath);
  const modelBytes = fs.readFileSync(modelPath);
  const instance = await WebAssembly.instantiate(wasmBytes, {});
  const exports = instance.instance.exports;

  expectCode("init_runtime", exports.init_runtime(), ErrorCode.Ok);
  const modelPtr = allocCopy(exports, modelBytes);
  try {
    expectCode("load_model", exports.load_model(modelPtr, modelBytes.length), ErrorCode.Ok);
  } finally {
    release(exports, modelPtr, modelBytes.length);
  }

  generateBytes(
    exports,
    "invalid utf-8 prompt",
    Uint8Array.from([0xc3, 0x28]),
    1,
    ErrorCode.InvalidUtf8,
    "invalid utf-8"
  );

  expectLastError(
    exports,
    "null prompt pointer",
    { actual: exports.generate(0, 1, 1), expected: ErrorCode.NullPointer },
    "null pointer"
  );

  const oneByte = allocCopy(exports, Uint8Array.from([0x68]));
  try {
    expectLastError(
      exports,
      "zero prompt length",
      { actual: exports.generate(oneByte, 0, 1), expected: ErrorCode.InvalidLength },
      "invalid length"
    );
  } finally {
    release(exports, oneByte, 1);
  }

  generateBytes(
    exports,
    "zero max_new_tokens",
    encoder.encode("hi"),
    0,
    ErrorCode.InvalidLength,
    "invalid length"
  );

  expectLastError(
    exports,
    "invalid sampling config",
    { actual: exports.set_sampling_config(1.0, 0, 1.0, 1), expected: ErrorCode.InvalidLength },
    "invalid length"
  );

  expectCode("restore greedy sampling", exports.set_sampling_config(0.0, 1, 1.0, 1), ErrorCode.Ok);

  const recoveryPtr = allocCopy(exports, encoder.encode("hi"));
  try {
    expectCode("recovery generate", exports.generate(recoveryPtr, 2, 1), ErrorCode.Ok);
  } finally {
    release(exports, recoveryPtr, 2);
  }
  const recoveryText = readLastResult(exports);
  if (recoveryText !== "e") {
    fail(`recovery result was ${JSON.stringify(recoveryText)}, expected "e"`);
  }
  const recoveryDiagnostics = readDiagnostics(exports);
  if (recoveryDiagnostics.last_error !== "ok") {
    fail(`recovery diagnostics last_error was ${JSON.stringify(recoveryDiagnostics.last_error)}`);
  }
  if (recoveryDiagnostics.selected_next_token !== 101) {
    fail(`recovery selected token was ${recoveryDiagnostics.selected_next_token}`);
  }
  if (recoveryDiagnostics.active_quantization_mode !== "q8_0") {
    fail(`recovery quantization was ${JSON.stringify(recoveryDiagnostics.active_quantization_mode)}`);
  }
  if (recoveryDiagnostics.sampling_temperature !== 0 || recoveryDiagnostics.sampling_top_k !== 1 || recoveryDiagnostics.sampling_top_p !== 1 || recoveryDiagnostics.sampling_seed !== 1) {
    fail(`recovery sampling config was ${JSON.stringify({
      temperature: recoveryDiagnostics.sampling_temperature,
      topK: recoveryDiagnostics.sampling_top_k,
      topP: recoveryDiagnostics.sampling_top_p,
      seed: recoveryDiagnostics.sampling_seed
    })}`);
  }

  expectCode("generate_next_token", exports.generate_next_token(), ErrorCode.Ok);
  const stepText = readLastResult(exports);
  if (stepText !== "e") {
    fail(`generate_next_token result was ${JSON.stringify(stepText)}, expected "e"`);
  }
  const stepDiagnostics = readDiagnostics(exports);
  if (stepDiagnostics.last_error !== "ok") {
    fail(`generate_next_token diagnostics last_error was ${JSON.stringify(stepDiagnostics.last_error)}`);
  }
  if (stepDiagnostics.generated_token_count !== 2) {
    fail(`generate_next_token generated count was ${stepDiagnostics.generated_token_count}`);
  }
  if (stepDiagnostics.kv_cache_length !== 5) {
    fail(`generate_next_token kv cache length was ${stepDiagnostics.kv_cache_length}`);
  }
  if (stepDiagnostics.selected_next_token !== 101) {
    fail(`generate_next_token selected token was ${stepDiagnostics.selected_next_token}`);
  }
  if (stepDiagnostics.model_loaded !== true) {
    fail("generate_next_token diagnostics lost model_loaded state");
  }

  expectCode("free_model", exports.free_model(), ErrorCode.Ok);
  const freeText = readLastResult(exports);
  if (freeText !== "model freed") {
    fail(`free_model result was ${JSON.stringify(freeText)}, expected "model freed"`);
  }
  const freeDiagnostics = readDiagnostics(exports);
  if (freeDiagnostics.last_error !== "ok") {
    fail(`free_model diagnostics last_error was ${JSON.stringify(freeDiagnostics.last_error)}`);
  }
  if (freeDiagnostics.model_loaded !== false) {
    fail(`free_model model_loaded was ${freeDiagnostics.model_loaded}`);
  }
  if (freeDiagnostics.active_quantization_mode !== "none") {
    fail(`free_model quantization was ${JSON.stringify(freeDiagnostics.active_quantization_mode)}`);
  }

  expectCode("post-free generate_next_token", exports.generate_next_token(), ErrorCode.ModelNotLoaded);
  const postFreeText = readLastResult(exports);
  if (postFreeText !== "model not loaded") {
    fail(`post-free generate_next_token result was ${JSON.stringify(postFreeText)}, expected "model not loaded"`);
  }
  const postFreeDiagnostics = readDiagnostics(exports);
  if (postFreeDiagnostics.last_error !== "model not loaded") {
    fail(`post-free diagnostics last_error was ${JSON.stringify(postFreeDiagnostics.last_error)}`);
  }
  if (postFreeDiagnostics.model_loaded !== false) {
    fail(`post-free model_loaded was ${postFreeDiagnostics.model_loaded}`);
  }

  console.log(JSON.stringify({
    wasm: path.relative(process.cwd(), wasmPath),
    model: path.relative(process.cwd(), modelPath),
    invalidUtf8: "passed",
    nullPointer: "passed",
    invalidLength: "passed",
    invalidSamplingConfig: "passed",
    recovery: recoveryText,
    generateNextToken: stepText,
    freeModel: freeText,
    postFreeGenerateNextToken: postFreeText,
    diagnostics: {
      recovery_last_error: recoveryDiagnostics.last_error,
      recovery_selected_next_token: recoveryDiagnostics.selected_next_token,
      step_generated_token_count: stepDiagnostics.generated_token_count,
      step_kv_cache_length: stepDiagnostics.kv_cache_length,
      active_quantization_mode: postFreeDiagnostics.active_quantization_mode,
      post_free_last_error: postFreeDiagnostics.last_error
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
