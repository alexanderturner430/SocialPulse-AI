#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { App } from "./tui/components.mjs";
import { setBase } from "./tui/http.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;

let BASE = `http://127.0.0.1:${process.env.PORT || 9151}`;
if (process.env.TUI_BASE) BASE = process.env.TUI_BASE;
setBase(BASE);

// Load .env manually (dependency-free, ESM-safe).
function loadEnvFile() {
  const p = join(root, ".env");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (val.includes("#")) {
      val = val.split("#")[0].trim();
    }
    out[m[1]] = val.trim();
  }
  return out;
}

const envFromFile = loadEnvFile();
function childEnv() {
  return { ...process.env, ...envFromFile };
}

let child = null;
let logs = [];

function pushLog(kind, text) {
  const trimmed = String(text).replace(/\s+$/, "");
  if (!trimmed) return;
  for (const line of trimmed.split("\n")) {
    if (line.trim()) logs.push({ kind, text: line, ts: Date.now() });
  }
  if (logs.length > 3000) logs = logs.slice(-3000);
}

function startServer() {
  if (child) return;
  const env = childEnv();
  if (!env.PAY_TO_ADDRESS) {
    pushLog("stderr", "[TUI] PAY_TO_ADDRESS is not set (x402 is required).");
    pushLog("stderr", "[TUI] Add PAY_TO_ADDRESS to .env or export it in this shell, then press [r].");
    return;
  }
  pushLog("stdout", `[TUI] Starting server on port ${env.PORT || 9151}...`);
  child = spawn("node", ["mcp-server.js"], { cwd: root, env });
  child.stdout.on("data", (d) => pushLog("stdout", d.toString()));
  child.stderr.on("data", (d) => pushLog("stderr", d.toString()));
  child.on("exit", (code, signal) => {
    pushLog("stderr", `[TUI] Server exited (code=${code} signal=${signal})`);
    child = null;
  });
  child.on("error", (err) => {
    pushLog("stderr", `[TUI] Failed to start server: ${err.message}`);
    child = null;
  });
}

function stopServer() {
  if (!child) {
    pushLog("stdout", "[TUI] No managed server running.");
    return;
  }
  const c = child;
  child = null;
  pushLog("stdout", "[TUI] Stopping server (SIGTERM)...");
  const killer = setTimeout(() => { if (c && c.exitCode == null) c.kill("SIGKILL"); }, 3000);
  killer.unref();
  c.kill("SIGTERM");
}

function restartServer() {
  if (child) stopServer();
  pushLog("stdout", "[TUI] Restarting server...");
  setTimeout(startServer, 900);
}

render(React.createElement(App, { logs, onRestart: restartServer }));

// Liveness heartbeat for the Log panel.
let wasUp = null;
setInterval(async () => {
  try {
    await fetch(BASE + "/x402/status", { signal: AbortSignal.timeout(1200) });
    if (wasUp === false) pushLog("stdout", "[TUI] Server reachable.");
    wasUp = true;
  } catch {
    if (wasUp !== false) pushLog("stderr", "[TUI] Server not reachable.");
    wasUp = false;
  }
}, 2500);

startServer();

function shutdown() {
  if (child) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
