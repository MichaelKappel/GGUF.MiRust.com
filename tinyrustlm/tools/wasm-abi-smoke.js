#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { TextDecoder, TextEncoder } = require("util");

const root = path.resolve(__dirname, "..");
const wasmPath = process.argv[2] || path.join(root, "runtime", "tinyrustlm.wasm");
const modelPath = process.argv[3] || path.join(root, "models", "tinylm16-q8.slm");
const adapterModelPath = process.argv[4] || path.join(root, "models", "tiny-test-model.slm");

const ErrorCode = {
  Ok: 0,
  NullPointer: 1,
  InvalidLength: 2,
  InvalidUtf8: 3,
  ModelNotLoaded: 12
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
const U64_MASK = (1n << 64n) - 1n;
const FNV_PRIME = 0x100000001b3n;
const TOKENIZER_CHECKSUM_SEED = 0x746f6b656e697a65n;
const ADAPTER_HEADER_LEN = 64;
const ADAPTER_ENTRY_LEN = 64;
const ADAPTER_CHECKSUM_OFFSET = 56;

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

function isHex64(value) {
  return /^0x[0-9a-fA-F]{16}$/.test(String(value || ""));
}

function expectAssemblyDiagnostics(label, diagnostics, expectedApplyCount, expectLoadedState) {
  if (diagnostics.adapter_apply_count !== expectedApplyCount) {
    fail(`${label} adapter_apply_count was ${diagnostics.adapter_apply_count}`);
  }
  if (!isHex64(diagnostics.last_adapter_checksum)) {
    fail(`${label} last_adapter_checksum was ${JSON.stringify(diagnostics.last_adapter_checksum)}`);
  }
  if (!isHex64(diagnostics.assembly_state_checksum)) {
    fail(`${label} assembly_state_checksum was ${JSON.stringify(diagnostics.assembly_state_checksum)}`);
  }
  const zeroChecksum = "0x0000000000000000";
  if (expectedApplyCount === 0 && diagnostics.last_adapter_checksum !== zeroChecksum) {
    fail(`${label} last_adapter_checksum was ${diagnostics.last_adapter_checksum}`);
  }
  if (expectedApplyCount > 0 && diagnostics.last_adapter_checksum === zeroChecksum) {
    fail(`${label} last_adapter_checksum stayed zero`);
  }
  if (expectLoadedState && diagnostics.assembly_state_checksum === zeroChecksum) {
    fail(`${label} assembly_state_checksum stayed zero`);
  }
  if (!expectLoadedState && diagnostics.assembly_state_checksum !== zeroChecksum) {
    fail(`${label} assembly_state_checksum was ${diagnostics.assembly_state_checksum}`);
  }
}

function alignTo64(value) {
  return (value + 63) & ~63;
}

function readU32(bytes, offset) {
  return bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24);
}

function readU64(bytes, offset) {
  let value = 0n;
  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]);
  }
  return value;
}

function writeU32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeU64(bytes, offset, value) {
  let cursor = BigInt(value);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(cursor & 0xffn);
    cursor >>= 8n;
  }
}

function rotateLeft64(value, shift) {
  const bits = BigInt(shift);
  return (((value << bits) & U64_MASK) | (value >> (64n - bits))) & U64_MASK;
}

function mixU64(acc, value) {
  let cursor = BigInt(value);
  let mixed = acc;
  for (let index = 0; index < 8; index += 1) {
    mixed ^= cursor & 0xffn;
    mixed = (rotateLeft64(mixed, 11) * FNV_PRIME) & U64_MASK;
    cursor >>= 8n;
  }
  return mixed;
}

function sectionChecksum(bytes, seed) {
  let acc = seed;
  for (let index = 0; index < bytes.length; index += 1) {
    acc ^= BigInt(bytes[index]) + (BigInt(index) << 2n);
    acc = (rotateLeft64(acc, 9) * FNV_PRIME) & U64_MASK;
  }
  return acc;
}

function payloadChecksum(bytes) {
  let acc = 0x64656c7461663332n;
  for (let index = 0; index < bytes.length; index += 1) {
    acc ^= BigInt(bytes[index]) + (BigInt(index) << 1n);
    acc = (rotateLeft64(acc, 7) * FNV_PRIME) & U64_MASK;
  }
  return acc;
}

function adapterChecksum(bytes) {
  let acc = 0x6164617074657231n;
  for (let index = 0; index < bytes.length; index += 1) {
    const value = index >= ADAPTER_CHECKSUM_OFFSET && index < ADAPTER_CHECKSUM_OFFSET + 8
      ? 0
      : bytes[index];
    acc ^= BigInt(value) + (BigInt(index) << 3n);
    acc = (rotateLeft64(acc, 11) * FNV_PRIME) & U64_MASK;
  }
  return acc;
}

function parseSlmForAdapter(modelBytes) {
  const tokenizerOffset = Number(readU64(modelBytes, 64));
  const tokenizerLength = Number(readU64(modelBytes, 72));
  const directoryOffset = Number(readU64(modelBytes, 80));
  const tensorCount = readU32(modelBytes, 88);
  const tensors = [];
  for (let index = 0; index < tensorCount; index += 1) {
    const entry = directoryOffset + index * 64;
    const rank = readU32(modelBytes, entry + 12);
    const dims = [
      readU32(modelBytes, entry + 16),
      readU32(modelBytes, entry + 20),
      readU32(modelBytes, entry + 24),
      readU32(modelBytes, entry + 28)
    ];
    const elementCount = dims.slice(0, rank).reduce((acc, dim) => acc * dim, 1);
    tensors.push({
      nameHash: readU64(modelBytes, entry),
      dtype: readU32(modelBytes, entry + 8),
      rank,
      dims,
      byteLength: readU64(modelBytes, entry + 40),
      blockSize: readU32(modelBytes, entry + 56),
      elementCount
    });
  }
  return {
    flags: readU32(modelBytes, 16),
    tokenizer: modelBytes.slice(tokenizerOffset, tokenizerOffset + tokenizerLength),
    tensors
  };
}

function parameterCount(tensors) {
  return tensors.reduce((acc, tensor) => acc + BigInt(tensor.elementCount), 0n);
}

function tensorLayoutChecksum(tensors) {
  const sorted = [...tensors].sort((left, right) => (left.nameHash < right.nameHash ? -1 : 1));
  let acc = 0x74656e736f722d6cn;
  for (const tensor of sorted) {
    acc = mixU64(acc, tensor.nameHash);
    acc = mixU64(acc, BigInt(tensor.dtype));
    acc = mixU64(acc, BigInt(tensor.rank));
    for (const dim of tensor.dims) {
      acc = mixU64(acc, BigInt(dim));
    }
    acc = mixU64(acc, BigInt(tensor.blockSize));
    acc = mixU64(acc, tensor.byteLength);
  }
  return acc;
}

function buildZeroAdapter(modelBytes) {
  const parsed = parseSlmForAdapter(modelBytes);
  const dataOffset = alignTo64(ADAPTER_HEADER_LEN + parsed.tensors.length * ADAPTER_ENTRY_LEN);
  let cursor = dataOffset;
  const payloads = [];
  for (const tensor of parsed.tensors) {
    cursor = alignTo64(cursor);
    const byteLength = tensor.elementCount * 4;
    payloads.push({ offset: cursor, bytes: new Uint8Array(byteLength), tensor });
    cursor += byteLength;
  }
  const bytes = new Uint8Array(cursor);
  bytes.set(Buffer.from("ADP1"), 0);
  writeU32(bytes, 4, 1);
  writeU32(bytes, 8, ADAPTER_HEADER_LEN);
  writeU32(bytes, 12, parsed.tensors.length);
  writeU32(bytes, 16, parsed.flags);
  writeU32(bytes, 20, ADAPTER_ENTRY_LEN);
  writeU64(bytes, 24, parameterCount(parsed.tensors));
  writeU64(bytes, 32, tensorLayoutChecksum(parsed.tensors));
  writeU64(bytes, 40, sectionChecksum(parsed.tokenizer, TOKENIZER_CHECKSUM_SEED));
  writeU64(bytes, 48, BigInt(dataOffset));
  writeU64(bytes, ADAPTER_CHECKSUM_OFFSET, 0n);
  payloads.forEach((payload, index) => {
    const entry = ADAPTER_HEADER_LEN + index * ADAPTER_ENTRY_LEN;
    const tensor = payload.tensor;
    writeU64(bytes, entry, tensor.nameHash);
    writeU32(bytes, entry + 8, tensor.rank);
    writeU32(bytes, entry + 12, tensor.dims[0]);
    writeU32(bytes, entry + 16, tensor.dims[1]);
    writeU32(bytes, entry + 20, tensor.dims[2]);
    writeU32(bytes, entry + 24, tensor.dims[3]);
    writeU32(bytes, entry + 28, 0);
    writeU64(bytes, entry + 32, BigInt(payload.offset));
    writeU64(bytes, entry + 40, BigInt(payload.bytes.length));
    writeU64(bytes, entry + 48, BigInt(tensor.elementCount));
    writeU64(bytes, entry + 56, payloadChecksum(payload.bytes));
    bytes.set(payload.bytes, payload.offset);
  });
  writeU64(bytes, ADAPTER_CHECKSUM_OFFSET, adapterChecksum(bytes));
  return bytes;
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
  const adapterModelBytes = fs.readFileSync(adapterModelPath);
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
  expectAssemblyDiagnostics("recovery", recoveryDiagnostics, 0, true);
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

  const adapterModelPtr = allocCopy(exports, adapterModelBytes);
  try {
    expectCode("load adapter model", exports.load_model(adapterModelPtr, adapterModelBytes.length), ErrorCode.Ok);
  } finally {
    release(exports, adapterModelPtr, adapterModelBytes.length);
  }
  const adapterBytes = buildZeroAdapter(adapterModelBytes);
  if (typeof exports.validate_adapter_delta !== "function") {
    fail("validate_adapter_delta export was missing");
  }
  const validateAdapterPtr = allocCopy(exports, adapterBytes);
  try {
    expectCode("validate_adapter_delta", exports.validate_adapter_delta(validateAdapterPtr, adapterBytes.length), ErrorCode.Ok);
  } finally {
    release(exports, validateAdapterPtr, adapterBytes.length);
  }
  const validateAdapterText = readLastResult(exports);
  if (validateAdapterText !== "adapter validated") {
    fail(`validate_adapter_delta result was ${JSON.stringify(validateAdapterText)}, expected "adapter validated"`);
  }
  const validateAdapterDiagnostics = readDiagnostics(exports);
  if (validateAdapterDiagnostics.last_error !== "ok") {
    fail(`validate_adapter_delta diagnostics last_error was ${JSON.stringify(validateAdapterDiagnostics.last_error)}`);
  }
  if (validateAdapterDiagnostics.model_loaded !== true || validateAdapterDiagnostics.active_quantization_mode !== "f32") {
    fail(`validate_adapter_delta model state was ${JSON.stringify({
      modelLoaded: validateAdapterDiagnostics.model_loaded,
      activeQuantizationMode: validateAdapterDiagnostics.active_quantization_mode
    })}`);
  }
  expectAssemblyDiagnostics("validate_adapter_delta", validateAdapterDiagnostics, 0, true);
  const adapterPtr = allocCopy(exports, adapterBytes);
  try {
    expectCode("apply_adapter_delta", exports.apply_adapter_delta(adapterPtr, adapterBytes.length), ErrorCode.Ok);
  } finally {
    release(exports, adapterPtr, adapterBytes.length);
  }
  const adapterText = readLastResult(exports);
  if (adapterText !== "adapter applied") {
    fail(`apply_adapter_delta result was ${JSON.stringify(adapterText)}, expected "adapter applied"`);
  }
  const adapterDiagnostics = readDiagnostics(exports);
  if (adapterDiagnostics.last_error !== "ok") {
    fail(`apply_adapter_delta diagnostics last_error was ${JSON.stringify(adapterDiagnostics.last_error)}`);
  }
  if (adapterDiagnostics.model_loaded !== true || adapterDiagnostics.active_quantization_mode !== "f32") {
    fail(`apply_adapter_delta model state was ${JSON.stringify({
      modelLoaded: adapterDiagnostics.model_loaded,
      activeQuantizationMode: adapterDiagnostics.active_quantization_mode
    })}`);
  }
  if (adapterDiagnostics.generated_token_count !== 0 || adapterDiagnostics.kv_cache_length !== 0 || adapterDiagnostics.selected_next_token !== 0) {
    fail(`apply_adapter_delta reset state was ${JSON.stringify({
      generatedTokenCount: adapterDiagnostics.generated_token_count,
      kvCacheLength: adapterDiagnostics.kv_cache_length,
      selectedNextToken: adapterDiagnostics.selected_next_token
    })}`);
  }
  expectAssemblyDiagnostics("apply_adapter_delta", adapterDiagnostics, 1, true);

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
  expectAssemblyDiagnostics("free_model", freeDiagnostics, 0, false);

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
    adapterValidate: validateAdapterText,
    adapterApply: adapterText,
    freeModel: freeText,
    postFreeGenerateNextToken: postFreeText,
    diagnostics: {
      recovery_last_error: recoveryDiagnostics.last_error,
      recovery_selected_next_token: recoveryDiagnostics.selected_next_token,
      step_generated_token_count: stepDiagnostics.generated_token_count,
      step_kv_cache_length: stepDiagnostics.kv_cache_length,
      adapter_validate_active_quantization_mode: validateAdapterDiagnostics.active_quantization_mode,
      adapter_active_quantization_mode: adapterDiagnostics.active_quantization_mode,
      adapter_apply_count: adapterDiagnostics.adapter_apply_count,
      assembly_state_checksum: adapterDiagnostics.assembly_state_checksum,
      active_quantization_mode: postFreeDiagnostics.active_quantization_mode,
      post_free_last_error: postFreeDiagnostics.last_error
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
