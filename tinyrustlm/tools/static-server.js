#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const port = Number(process.argv[3] || 8080);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".slm": "application/octet-stream",
  ".md": "text/plain; charset=utf-8"
};

function send(request, response, code, body, type) {
  response.writeHead(code, {
    "content-type": type || "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(body);
}

function redirect(request, response, location) {
  response.writeHead(302, {
    "location": location,
    "content-type": "text/plain; charset=utf-8",
    "content-length": request.method === "HEAD" ? 0 : Buffer.byteLength("redirect\n")
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end("redirect\n");
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(request, response, 405, "method not allowed");
    return;
  }
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/") {
    redirect(request, response, "/app/");
    return;
  }
  let relative = decodeURIComponent(url.pathname);
  if (relative.endsWith("/")) {
    relative += "index.html";
  }
  const file = path.resolve(path.join(root, relative));
  if (!file.startsWith(root)) {
    send(request, response, 403, "forbidden");
    return;
  }
  fs.stat(file, (error, stats) => {
    if (error) {
      send(request, response, 404, "not found");
      return;
    }
    if (!stats.isFile()) {
      send(request, response, 404, "not found");
      return;
    }
    response.writeHead(200, {
      "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "content-length": stats.size
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(file).pipe(response);
  });
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    process.stderr.write(`Port ${port} is already in use on 127.0.0.1.\n`);
    process.exit(2);
  }
  process.stderr.write(`TinyRustLM static server failed: ${error ? error.message : "unknown error"}\n`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`TinyRustLM static server listening at http://127.0.0.1:${port}/app/\n`);
});
