"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ROOT_ENTRIES = ["index.js", "mcp-server.js", "rest-api.js", "worker.js", "tui.mjs"];
const SCAN_DIRS = ["lib", "scripts", "test"];
const SKIP = new Set(["node_modules", "data", "submissions"]);

let failed = false;
const failures = [];

function collectJs() {
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (SKIP.has(name)) continue;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(js|mjs|cjs)$/.test(name)) files.push(full);
    }
  };
  for (const f of ROOT_ENTRIES) {
    if (fs.existsSync(path.join(ROOT, f))) files.push(path.join(ROOT, f));
  }
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir));
  return files;
}

function checkSyntax(files) {
  console.log("\n[syntax] node --check on", files.length, "files");
  for (const file of files) {
    const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (res.status !== 0) {
      failed = true;
      failures.push(`syntax: ${path.relative(ROOT, file)}\n${res.stderr}`);
      console.log("  FAIL", path.relative(ROOT, file));
    }
  }
  if (!failed) console.log("  all files pass");
}

function checkPolyfill() {
  console.log("\n[polyfill] tfjs-* files prepend ./patch-tfjs");
  let checked = 0;
  for (const name of fs.readdirSync(path.join(ROOT, "lib"))) {
    if (!/^tf-.+\.js$/.test(name)) continue;
    checked++;
    const content = fs.readFileSync(path.join(ROOT, "lib", name), "utf8");
    if (!content.includes('require("./patch-tfjs")')) {
      failed = true;
      failures.push(`polyfill: lib/${name} is missing the patch-tfjs require`);
      console.log("  FAIL lib/" + name);
    }
  }
  console.log(`  ${checked} tf-* files checked${failed ? "" : " (all patched)"}`);
}

function checkToolDefinitions() {
  console.log("\n[tools] lib/tool-definitions.js integrity");
  const defs = require(path.join(ROOT, "lib", "tool-definitions.js"));
  const names = defs.map((t) => t.name);
  const unique = new Set(names);
  const problems = [];
  if (defs.length !== 168) problems.push(`expected 168 definitions, got ${defs.length}`);
  if (unique.size !== defs.length) {
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    problems.push(`duplicate names: ${[...new Set(dup)].join(", ")}`);
  }
  const bad = defs.filter((t) => !t.description || !t.inputSchema);
  if (bad.length) problems.push(`${bad.length} definitions missing description/inputSchema`);
  console.log(`  ${defs.length} definitions, ${unique.size} unique name(s)`);
  if (problems.length) {
    failed = true;
    problems.forEach((p) => failures.push("tools: " + p));
    problems.forEach((p) => console.log("  FAIL " + p));
  } else {
    console.log("  OK");
  }
}

function runTests() {
  console.log("\n[tests] jest");
  const res = spawnSync("npx", ["jest"], { cwd: ROOT, stdio: "inherit", encoding: "utf8", timeout: 600000 });
  const pass = res.status === 0;
  if (!pass) {
    failed = true;
    failures.push(`jest exited with code ${res.status}`);
  }
  return pass;
}

const files = collectJs();
checkSyntax(files);
checkPolyfill();
checkToolDefinitions();
const testsPass = runTests();

console.log("\n=== BUILD SUMMARY ===");
const ok = !failed;
console.log(`syntax      : ${ok ? "PASS" : "FAIL"}`);
console.log(`polyfill    : ${ok ? "PASS" : "FAIL"}`);
console.log(`tools       : ${ok ? "PASS" : "FAIL"}`);
console.log(`tests       : ${testsPass ? "PASS" : "FAIL"}`);
if (failures.length) {
  console.log("\nfailures:");
  for (const f of failures) console.log("  - " + f);
}
process.exit(ok && testsPass ? 0 : 1);