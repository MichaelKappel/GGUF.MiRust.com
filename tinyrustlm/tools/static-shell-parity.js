#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const rootIndexPath = path.join(root, "index.html");
const appIndexPath = path.join(root, "app", "index.html");

function readShell(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  } catch (error) {
    throw new Error(`Unable to read ${filePath}: ${error.message}`);
  }
}

function normalizeRootShell(html) {
  return html
    .replace(/href="\.\/app\/app\.css/g, 'href="./app.css')
    .replace(/src="\.\/app\/app\.js/g, 'src="./app.js');
}

function firstMismatch(left, right) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const max = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < max; index++) {
    const leftLine = leftLines[index] || "";
    const rightLine = rightLines[index] || "";
    if (leftLine !== rightLine) {
      return {
        line: index + 1,
        root: leftLine,
        app: rightLine
      };
    }
  }
  return null;
}

function main() {
  const rootShell = normalizeRootShell(readShell(rootIndexPath));
  const appShell = readShell(appIndexPath);
  const mismatch = firstMismatch(rootShell, appShell);
  if (mismatch) {
    process.stderr.write(`TinyRustLM root/app shell drift at line ${mismatch.line}\n`);
    process.stderr.write(`root: ${mismatch.root}\n`);
    process.stderr.write(`app:  ${mismatch.app}\n`);
    process.exit(1);
  }
  process.stdout.write("TinyRustLM root/app shell parity passed\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
