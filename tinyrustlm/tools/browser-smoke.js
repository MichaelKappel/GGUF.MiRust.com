#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

const appUrl = process.argv[2] || "http://127.0.0.1:8080/app/";
const port = Number(process.argv[3] || 9223);
const smokeMode = process.argv[5] || "single";
const expectedModel = process.argv[4] || (smokeMode === "multi-parent-registry" ? "multi-parent-sign-merge-q8" : smokeMode === "adapter-sidecar-registry-q8" ? "tinyq8" : smokeMode === "adapter-manifest-budget" || smokeMode === "adapter-family-receipt-drift" || smokeMode === "adapter-manifest-drift" || smokeMode === "adapter-artifact-drift" || smokeMode === "adapter-stack-prefetch-drift" || smokeMode === "adapter-stack-rust-validate-drift" || smokeMode === "module-plan-profile-drift" || smokeMode === "module-plan-execution-profile-drift" || smokeMode === "module-plan-fetch-policy-drift" || smokeMode === "module-plan-origin-policy-drift" || smokeMode === "module-plan-resource-drift" || smokeMode === "module-plan-runtime-scratch-drift" || smokeMode === "module-plan-graph-drift" || smokeMode === "module-plan-stack-drift" || smokeMode === "module-plan-role-drift" || smokeMode === "module-plan-slot-drift" || smokeMode === "module-plan-phase-drift" || smokeMode === "module-plan-byte-drift" || smokeMode === "module-plan-checksum-drift" || smokeMode === "module-plan-dependency-drift" || smokeMode === "assembly-eval-case-drift" || smokeMode === "assembly-evidence-file-drift" || smokeMode === "combined-selector-assembly" || smokeMode === "combined-selector-cycle" || smokeMode === "combined-selector-route-soak" ? "multi-parent-sign-merge-q4" : smokeMode === "multi-parent-registry-file" || smokeMode === "adapter-sidecar-registry-file" ? "multi-parent-sign-merge-f32" : smokeMode === "adapter-sidecar" || smokeMode === "adapter-sidecar-checksum-mismatch" ? "tinyf32" : "tinylm16q8");
const enduranceCycles = Math.max(2, Math.min(20, Number.parseInt(process.argv[6] || "4", 10) || 4));
const performanceTokens = Math.max(2, Math.min(8, Number.parseInt(process.argv[6] || "4", 10) || 4));
const performanceSoakCycles = Math.max(2, Math.min(10, Number.parseInt(process.argv[6] || "3", 10) || 3));
const performanceSoakTokens = Math.max(2, Math.min(8, Number.parseInt(process.argv[7] || "4", 10) || 4));
const combinedSelectorDefaultCycles = smokeMode === "combined-selector-route-soak" ? "3" : "2";
const combinedSelectorMinCycles = smokeMode === "combined-selector-route-soak" ? 3 : 2;
const combinedSelectorCycles = Math.max(combinedSelectorMinCycles, Math.min(6, Number.parseInt(process.argv[6] || combinedSelectorDefaultCycles, 10) || Number.parseInt(combinedSelectorDefaultCycles, 10)));
const checksumMask64 = (1n << 64n) - 1n;
const checksumPrime64 = 0x100000001b3n;

const combinedSelectorModels = [
  "multi-parent-sign-merge-q4",
  "multi-parent-sign-merge-q8",
  "multi-parent-sign-merge-f32"
];

const expectedQuantization = {
  tinylm16q8: "q8_0",
  tinylm16q4: "q4_0",
  tinylm16f32: "f32",
  tinyf32: "f32",
  tinytied: "f32",
  tinyq8: "q8_0",
  tinyq4: "q4_0",
  tinybpe: "f32",
  "multi-parent-sign-merge-q8": "q8_0",
  "multi-parent-sign-merge-q4": "q4_0",
  "multi-parent-sign-merge-f32": "f32"
};

const expectedModelLabels = {
  "multi-parent-sign-merge-q8": "multi-parent-sign-merge-q8 q8_0",
  "multi-parent-sign-merge-q4": "multi-parent-sign-merge-q4 q4_0",
  "multi-parent-sign-merge-f32": "multi-parent-sign-merge-f32 f32"
};

const expectedModelRoutes = {
  tinyq8: "/models/tiny-test-model-q8.slm",
  tinyq4: "/models/tiny-test-model-q4.slm",
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.slm",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.slm",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.slm"
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
  ]
};

const expectedAdapterRoutes = {
  tinyf32: "/models/tiny-test-model-self.adp1",
  tinyq8: "/models/tiny-test-model-q8-self.adp1",
  tinyq4: "/models/tiny-test-model-q4-self.adp1",
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8-sparse.asp1",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4-sparse.asp1",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32-sparse.asp1"
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
  ]
};

const expectedAdapterFamilyReceiptRoutes = {
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.adapter-family.receipt",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.adapter-family.receipt",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.adapter-family.receipt"
};

const expectedAssemblyReceiptRoutes = {
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.assembly.receipt",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.assembly.receipt",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.assembly.receipt"
};

const expectedModulePlanRoutes = {
  "multi-parent-sign-merge-q8": "/models/multi-parent-sign-merge-q8.module-plan.receipt",
  "multi-parent-sign-merge-q4": "/models/multi-parent-sign-merge-q4.module-plan.receipt",
  "multi-parent-sign-merge-f32": "/models/multi-parent-sign-merge-f32.module-plan.receipt"
};

const expectedModulePlanExecutionProfile = "single-threaded-wasm-local-v1";
const expectedModulePlanFetchPolicy = "local-no-store-v1";
const expectedModulePlanOriginPolicy = "same-origin-loopback-local-v1";

const expectedModulePlanModelBudgets = {
  "multi-parent-sign-merge-q8": "8832 bytes",
  "multi-parent-sign-merge-q4": "6592 bytes",
  "multi-parent-sign-merge-f32": "20352 bytes"
};

const expectedModulePlanBytes = {
  "multi-parent-sign-merge-q8": "0: 8832 bytes, 1: 587 bytes, 2: 1896 bytes, 3: 5713 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes",
  "multi-parent-sign-merge-q4": "0: 6592 bytes, 1: 587 bytes, 2: 1896 bytes, 3: 5713 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes",
  "multi-parent-sign-merge-f32": "0: 20352 bytes, 1: 588 bytes, 2: 1909 bytes, 3: 5713 bytes, 4: 20224 bytes, 5: 832 bytes, 6: 1088 bytes"
};

const expectedModulePlanChecksums = {
  "multi-parent-sign-merge-q8": "0: 0x0132bc82d5a0d7d6, 1: 0xe2f959d384c2cfd2, 2: 0xde55e079d490dcc8, 3: 0x681dd0efc1155024, 4: 0x8194a8a671285019, 5: 0x6fa5d29bee9b7cfb, 6: 0x1ed9d08142edfda9",
  "multi-parent-sign-merge-q4": "0: 0x1a6808e3098d1ce0, 1: 0x094ea75f275c01fd, 2: 0x5371e6eba8b27489, 3: 0x4ef0f4fa3d169108, 4: 0x0bd71e0020bc6ebf, 5: 0x69638218a1dd1eb6, 6: 0xcaf46ccfc262fad2",
  "multi-parent-sign-merge-f32": "0: 0x8a0e6c4c01998199, 1: 0x0b1e4c9880ae9cf8, 2: 0x797c4637c787595c, 3: 0x70f0f7ee1f0c5c3f, 4: 0xe9669ade4571fd42, 5: 0x34008cedc028ed5c, 6: 0x1c64143141c223b5"
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

const expectedAssemblyEvidenceRoutes = {
  "multi-parent-sign-merge-q8": multiParentEvidenceRoutes("multi-parent-sign-merge-q8"),
  "multi-parent-sign-merge-q4": multiParentEvidenceRoutes("multi-parent-sign-merge-q4"),
  "multi-parent-sign-merge-f32": multiParentEvidenceRoutes("multi-parent-sign-merge-f32")
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
  ]
};

const expectedAdapterApplyIndexes = {
  tinyf32: 0,
  "multi-parent-sign-merge-q8": 2,
  "multi-parent-sign-merge-q4": 2,
  "multi-parent-sign-merge-f32": 2
};

function multiParentEvidenceRoutes(modelKey) {
  return [
    `/evidence/${modelKey}/population.ledger`,
    `/evidence/${modelKey}/population.review`,
    `/evidence/${modelKey}/parent-pool.recipe`,
    `/evidence/${modelKey}/sign-merge.operator`,
    `/evidence/${modelKey}/sign-merge.candidate`,
    `/evidence/${modelKey}/sign-merge.promotion`,
    `/evidence/${modelKey}/sign-merge.runtime`,
    `/evidence/${modelKey}/sign-merge.eval`,
    `/evidence/${modelKey}/sign-merge.multi.admission`
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

function hex64(value) {
  return `0x${value.toString(16).padStart(16, "0")}`;
}

function isHex64(value) {
  return /^0x[0-9a-fA-F]{16}$/.test(String(value || ""));
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

function updateAssemblyAdapterFamilyReceiptChecksum(receiptText, checksum) {
  return replaceLineValue(receiptText, "adapter_family_receipt_checksum", checksum);
}

function updateAdapterFamilyMemberChecksums(receiptText, adapterIndex, artifactChecksum, manifestChecksum) {
  let updated = replaceLineValue(receiptText, `adapter.${adapterIndex}.artifact_checksum`, artifactChecksum);
  updated = replaceLineValue(updated, `adapter.${adapterIndex}.manifest_checksum`, manifestChecksum);
  return updated;
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
        modulePlanModules: byId("modulePlanModules").textContent,
        modulePlanModelBudget: byId("modulePlanModelBudget").textContent,
        modulePlanAdapterBudget: byId("modulePlanAdapterBudget").textContent,
        modulePlanScratchBudget: byId("modulePlanScratchBudget").textContent,
        modulePlanBytes: byId("modulePlanBytes").textContent,
        modulePlanChecksums: byId("modulePlanChecksums").textContent,
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

async function runPageCombinedSelectorAssemblySmoke(client, cycles) {
  const cycleCount = Math.max(1, Math.min(6, Number.parseInt(String(cycles || 1), 10) || 1));
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
          const ready = byId("modelSelect").value === modelKey &&
            byId("generateButton") &&
            !byId("generateButton").disabled &&
            byId("runtimeStatus").textContent === "Ready";
          const assembled = byId("adapterState") && byId("adapterState").textContent === "applied";
          if (ready && assembled) {
            return true;
          }
          await sleep(100);
        }
        return false;
      };
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
          modulePlanModules: byId("modulePlanModules").textContent,
          modulePlanModelBudget: byId("modulePlanModelBudget").textContent,
          modulePlanAdapterBudget: byId("modulePlanAdapterBudget").textContent,
          modulePlanScratchBudget: byId("modulePlanScratchBudget").textContent,
          modulePlanBytes: byId("modulePlanBytes").textContent,
          modulePlanChecksums: byId("modulePlanChecksums").textContent,
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
        modulePlanState: byId("modulePlanState").textContent,
        modulePlanExecution: byId("modulePlanExecution").textContent,
        modulePlanFetch: byId("modulePlanFetch").textContent,
        modulePlanOrigin: byId("modulePlanOrigin").textContent,
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
          modulePlanModules: byId("modulePlanModules").textContent,
          modulePlanModelBudget: byId("modulePlanModelBudget").textContent,
          modulePlanAdapterBudget: byId("modulePlanAdapterBudget").textContent,
          modulePlanScratchBudget: byId("modulePlanScratchBudget").textContent,
          modulePlanBytes: byId("modulePlanBytes").textContent,
          modulePlanChecksums: byId("modulePlanChecksums").textContent,
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
  if (expectedModelRoute && networkIncludesPath(networkRequests, expectedModelRoute)) {
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
  const hasCombinedGeneratedOptions = [
    "multi-parent-sign-merge-f32",
    "multi-parent-sign-merge-q8",
    "multi-parent-sign-merge-q4"
  ].every((option) => modelOptionValues.includes(option));
  if (hasCombinedGeneratedOptions && result.initialSelectedModel !== "multi-parent-sign-merge-q4") {
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
      expectedStackRoutes.length,
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
      expectedStackRoutes.length,
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
    modelKey.startsWith("multi-parent-sign-merge-") ||
    result.provenanceEvalCases !== "unavailable" ||
    result.provenanceEvalChecksum !== "unavailable";
  if (expectsEvalProof) {
    if (result.provenanceEvalCases !== "1 passed") {
      failures.push(`provenance eval cases were ${result.provenanceEvalCases}`);
    }
    if (!isHex64(result.provenanceEvalChecksum)) {
      failures.push(`provenance eval checksum was ${result.provenanceEvalChecksum}`);
    }
  } else if (result.provenanceEvalCases !== "unavailable" || result.provenanceEvalChecksum !== "unavailable") {
    failures.push(`manual model eval proof was ${result.provenanceEvalCases}/${result.provenanceEvalChecksum}`);
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
    if (result.modulePlanScratchBudget !== "65536 bytes") {
      failures.push(`module plan scratch budget was ${result.modulePlanScratchBudget}`);
    }
    if (checkExactModulePlanSummaries) {
      const expectedBytes = expectedModulePlanBytes[modelKey];
      if (expectedBytes && result.modulePlanBytes !== expectedBytes) {
        failures.push(`module plan bytes were ${result.modulePlanBytes}`);
      }
      const expectedChecksums = expectedModulePlanChecksums[modelKey];
      if (expectedChecksums && result.modulePlanChecksums !== expectedChecksums) {
        failures.push(`module plan checksums were ${result.modulePlanChecksums}`);
      }
    } else {
      if (!/^0: \d+ bytes, 1: \d+ bytes, 2: \d+ bytes, 3: \d+ bytes, 4: \d+ bytes, 5: \d+ bytes, 6: \d+ bytes$/.test(String(result.modulePlanBytes || ""))) {
        failures.push(`module plan bytes were ${result.modulePlanBytes}`);
      }
      if (!/^0: 0x[0-9a-fA-F]{16}, 1: 0x[0-9a-fA-F]{16}, 2: 0x[0-9a-fA-F]{16}, 3: 0x[0-9a-fA-F]{16}, 4: 0x[0-9a-fA-F]{16}, 5: 0x[0-9a-fA-F]{16}, 6: 0x[0-9a-fA-F]{16}$/.test(String(result.modulePlanChecksums || ""))) {
        failures.push(`module plan checksums were ${result.modulePlanChecksums}`);
      }
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
  if (modelKey.startsWith("multi-parent-sign-merge-") && !networkRequests.some((requestUrl) => requestUrl.includes("/models/selector.registry"))) {
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
  if (result.initialSelectedModel !== "multi-parent-sign-merge-q4") {
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
  const failures = [];
  assertCombinedSelectorSequenceSmoke(result, networkRequests, combinedSelectorSequence(1), failures);
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
      if (step.validateCallsSincePreviousStep < expectedStackCount) {
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
    "Assembly Evidence",
    "Module Plan",
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
  if (snapshot.modulePlanScratchBudget !== "unavailable") {
    failures.push(`${prefix} module plan scratch budget was ${snapshot.modulePlanScratchBudget}`);
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
  if (snapshot.modulePlanBytes !== "unavailable") {
    failures.push(`${prefix} module plan bytes were ${snapshot.modulePlanBytes}`);
  }
  if (snapshot.modulePlanChecksums !== "unavailable") {
    failures.push(`${prefix} module plan checksums were ${snapshot.modulePlanChecksums}`);
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

function installMultiParentRegistryInterceptor(client) {
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
        "entry.0.candidate_id=multi-parent-sign-merge-q8",
        "entry.0.display_name=Multi-parent sign-merge q8_0",
        "entry.0.model_path=../models/tinylm16-q8.slm",
        "entry.0.manifest_path=../models/tinylm16-q8.slm.manifest",
        "entry.0.artifact_path=tinyrustlm/models/tinylm16-q8.slm",
        "entry.0.max_tokens=8",
        "entry.0.model_bytes=17160000",
        "entry.0.slm_checksum=0xa1442f3f180c542b",
        "entry.0.model_shape=vocab=260,hidden=512,layers=4,heads=8,kv_heads=8,head_dim=64,ffn=2048,context=512",
        "entry.0.quantization=q8_0",
        "entry.0.output_contract=separate-output-weight",
        "entry.0.admission_checksum=0x0000000000000050",
        "entry.0.promotion_manifest_checksum=0x0000000000000051",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000052",
        "entry.0.eval_manifest_checksum=0x0000000000000053",
        "entry.0.eval_case_evidence_checksum=0x0000000000000054",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
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
        "entry.0.admission_checksum=0x0000000000000083",
        "entry.0.promotion_manifest_checksum=0x0000000000000084",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000085",
        "entry.0.eval_manifest_checksum=0x0000000000000086",
        "entry.0.eval_case_evidence_checksum=0x0000000000000087",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
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
        "entry.0.admission_checksum=0x0000000000000093",
        "entry.0.promotion_manifest_checksum=0x0000000000000094",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000095",
        "entry.0.eval_manifest_checksum=0x0000000000000096",
        "entry.0.eval_case_evidence_checksum=0x0000000000000097",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
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
        "entry.0.admission_checksum=0x0000000000000062",
        "entry.0.promotion_manifest_checksum=0x0000000000000063",
        "entry.0.runtime_smoke_manifest_checksum=0x0000000000000064",
        "entry.0.eval_manifest_checksum=0x0000000000000065",
        "entry.0.eval_case_evidence_checksum=0x0000000000000066",
        "entry.0.quality_scope=tiny-fixture-runtime-eval-only",
        "entry.0.quality_boundary=fixture-runtime-and-eval-plumbing-not-product-assistant-quality",
        "entry.0.eval_dataset=tinyrustlm/tests/fixtures/assistant-quality-eval-cases.txt",
        "entry.0.cases_passed=1",
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
    if (smokeMode === "model-error" || smokeMode === "missing-model" || smokeMode === "multi-parent-registry" || smokeMode === "selector-budget" || smokeMode === "sidecar-budget-contract" || smokeMode === "runtime-manifest-drift" || smokeMode === "module-plan-profile-drift" || smokeMode === "module-plan-execution-profile-drift" || smokeMode === "module-plan-fetch-policy-drift" || smokeMode === "module-plan-origin-policy-drift" || smokeMode === "module-plan-resource-drift" || smokeMode === "module-plan-runtime-scratch-drift" || smokeMode === "module-plan-graph-drift" || smokeMode === "module-plan-stack-drift" || smokeMode === "module-plan-role-drift" || smokeMode === "module-plan-slot-drift" || smokeMode === "module-plan-phase-drift" || smokeMode === "module-plan-byte-drift" || smokeMode === "module-plan-checksum-drift" || smokeMode === "module-plan-dependency-drift" || smokeMode === "assembly-eval-case-drift" || smokeMode === "assembly-evidence-file-drift" || smokeMode === "adapter-family-receipt-drift" || smokeMode === "adapter-manifest-drift" || smokeMode === "adapter-artifact-drift" || smokeMode === "adapter-stack-prefetch-drift" || smokeMode === "adapter-stack-rust-validate-drift" || smokeMode === "adapter-sidecar-registry-q8" || smokeMode === "adapter-sidecar-checksum-mismatch" || smokeMode === "adapter-manifest-budget") {
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
      } else if (smokeMode === "module-plan-resource-drift") {
        installModulePlanResourceDriftInterceptor(client, expectedModel);
      } else if (smokeMode === "module-plan-runtime-scratch-drift") {
        installModulePlanRuntimeScratchDriftInterceptor(client, expectedModel);
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
      } else if (smokeMode === "adapter-artifact-drift") {
        installAdapterArtifactDriftInterceptor(client, expectedModel);
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
      } else if (smokeMode === "selector-budget") {
        installSelectorBudgetRegistryInterceptor(client);
      } else if (smokeMode === "sidecar-budget-contract") {
        installSidecarBudgetContractRegistryInterceptor(client);
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
    } else if (smokeMode === "combined-selector-assembly") {
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
      assertCombinedSelectorAssemblySmoke(result, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "combined-selector-cycle" || smokeMode === "combined-selector-route-soak") {
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
      if (smokeMode === "combined-selector-route-soak") {
        assertCombinedSelectorRouteSoakSmoke(result, networkRequests, combinedSelectorCycles);
      } else {
        assertCombinedSelectorCycleSmoke(result, networkRequests, combinedSelectorCycles);
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
    } else if (smokeMode === "adapter-family-receipt-drift" || smokeMode === "adapter-manifest-drift" || smokeMode === "adapter-artifact-drift" || smokeMode === "adapter-stack-prefetch-drift" || smokeMode === "adapter-stack-rust-validate-drift") {
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
      } else if (smokeMode === "adapter-stack-prefetch-drift") {
        assertAdapterStackPrefetchDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "adapter-stack-rust-validate-drift") {
        assertAdapterStackRustValidateDriftSmoke(result, expectedModel, networkRequests);
      } else {
        assertAdapterArtifactDriftSmoke(result, expectedModel, networkRequests);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "selector-budget" || smokeMode === "sidecar-budget-contract") {
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
      if (smokeMode === "selector-budget") {
        assertSelectorBudgetSmoke(result, networkRequests);
      } else {
        assertSidecarBudgetContractSmoke(result, networkRequests);
      }
      result.networkRequests = networkRequests;
    } else if (smokeMode === "multi-parent-registry" || smokeMode === "multi-parent-registry-file") {
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
      assertMultiParentRegistrySmoke(result, expectedModel, networkRequests);
      result.networkRequests = networkRequests;
    } else if (smokeMode === "runtime-manifest-drift") {
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
    } else if (smokeMode === "module-plan-profile-drift" || smokeMode === "module-plan-execution-profile-drift" || smokeMode === "module-plan-fetch-policy-drift" || smokeMode === "module-plan-origin-policy-drift" || smokeMode === "module-plan-resource-drift" || smokeMode === "module-plan-runtime-scratch-drift" || smokeMode === "module-plan-graph-drift" || smokeMode === "module-plan-stack-drift" || smokeMode === "module-plan-role-drift" || smokeMode === "module-plan-slot-drift" || smokeMode === "module-plan-phase-drift" || smokeMode === "module-plan-byte-drift" || smokeMode === "module-plan-checksum-drift" || smokeMode === "module-plan-dependency-drift") {
      networkRequests.length = 0;
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
      if (smokeMode === "module-plan-profile-drift") {
        assertModulePlanProfileDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-execution-profile-drift") {
        assertModulePlanExecutionProfileDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-fetch-policy-drift") {
        assertModulePlanFetchPolicyDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-origin-policy-drift") {
        assertModulePlanOriginPolicyDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-resource-drift") {
        assertModulePlanResourceDriftSmoke(result, expectedModel, networkRequests);
      } else if (smokeMode === "module-plan-runtime-scratch-drift") {
        assertModulePlanRuntimeScratchDriftSmoke(result, expectedModel, networkRequests);
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
