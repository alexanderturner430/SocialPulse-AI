import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import * as api from "./http.mjs";

export const TABS = ["Status", "History", "Tools", "Controls", "Log"];

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function StatusPanel({ snapshot }) {
  if (!snapshot) return React.createElement(Text, { color: "yellow" }, "Server not responding...");
  const s = snapshot.server || {};
  const x = snapshot.x402 || {};
  const mc = snapshot.monitor || {};
  const counters = mc.counters || {};
  const settles = mc.settles || {};
  const rows = [
    ["PID", String(s.pid)],
    ["Port", String(s.port)],
    ["Uptime", fmtUptime(s.uptimeMs || 0)],
    ["Tools", String(s.tools)],
    ["Gate", x.gateEnabled ? "ENABLED (payment req)" : "DISABLED (open)"],
    ["Price", `$${Number(x.priceUsd).toFixed(4)} (${x.priceAtomic} atomic)`],
    ["Network", x.network],
    ["Asset", x.asset],
    ["Requests", `${counters.total || 0} (${counters.paid || 0} paid/${counters.unpaid || 0} unpaid/${counters.error || 0} err)`],
    ["Settles", `${settles.success || 0} ok / ${settles.failed || 0} fail`],
  ];
  return React.createElement(
    Box,
    { flexDirection: "row", flexWrap: "wrap" },
    rows.map(([k, v]) =>
      React.createElement(
        Box,
        { key: k, flexDirection: "column", minWidth: 12, marginRight: 3, marginBottom: 1 },
        React.createElement(Text, { color: "gray" }, k),
        React.createElement(
          Text,
          {
            color: k === "Gate" ? (x.gateEnabled ? "green" : "red") : "cyan",
            bold: k === "Gate" || k === "Price",
            wrap: "wrap",
          },
          v
        )
      )
    )
  );
}

function HistoryPanel({ snapshot }) {
  if (!snapshot) return React.createElement(Text, { color: "yellow" }, "Waiting for data...");
  const mon = snapshot.monitor || {};
  const reqs = mon.requests || [];
  const pays = mon.payments || [];

  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { color: "green", bold: true }, `Requests (${reqs.length})`),
    reqs.length === 0
      ? React.createElement(Text, { color: "gray" }, "  (none)")
      : reqs.slice(0, 40).map((r) =>
          React.createElement(
            Box,
            { key: r.id },
            React.createElement(Text, { color: "gray", width: 9 }, fmtTime(r.ts)),
            React.createElement(Text, { color: "yellow", width: 5 }, r.kind),
            React.createElement(Text, { color: "white", width: 26, wrap: "truncate" }, r.tool),
            React.createElement(
              Text,
              { color: r.status === "paid" ? "green" : r.status === "error" ? "red" : "yellow", width: 10 },
              r.status
            ),
            React.createElement(Text, { color: "gray" }, r.lat_ms != null ? `${r.lat_ms}ms` : "-")
          )
        ),
    React.createElement(Text, { color: "green", bold: true }, `\nPayments (${pays.length})`),
    pays.length === 0
      ? React.createElement(Text, { color: "gray" }, "  (none)")
      : pays.slice(0, 40).map((p) =>
          React.createElement(
            Box,
            { key: p.id },
            React.createElement(Text, { color: "gray", width: 9 }, fmtTime(p.ts)),
            React.createElement(Text, { color: "white", width: 26, wrap: "truncate" }, p.tool),
            React.createElement(Text, { color: "cyan", width: 8 }, p.verify),
            React.createElement(
              Text,
              { color: p.success ? "green" : "red", width: 6 },
              p.success ? "OK" : "FAIL"
            ),
            React.createElement(Text, { color: "gray" }, p.amount != null ? String(p.amount) : "-")
          )
        )
  );
}

function ControlsPanel({ status, busy, gateDisabled }) {
  const gate = status && status.x402 ? status.x402.gateEnabled : false;
  const keys = [
    ["g", "Toggle payment gate " + (gate ? "OFF (open)" : "ON (require payment)")],
    ["p", "Change price (enter USD amount)"],
    ["c", "Clear request/payment history"],
  ];
  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(Text, { color: "green", bold: true }, "Runtime settings (in-memory, reset on restart)"),
    keys.map(([k, label]) =>
      React.createElement(
        Box,
        { key: k },
        React.createElement(Text, { color: "cyan", bold: true }, ` [${k}] `),
        React.createElement(Text, null, label)
      )
    ),
    React.createElement(Text, { marginTop: 1, color: "green", bold: true }, "Server process"),
    React.createElement(
      Box,
      null,
      React.createElement(Text, { color: "cyan", bold: true }, " [r] "),
      React.createElement(Text, null, "Restart server")
    ),
    busy && React.createElement(Text, { color: "yellow" }, "\nWorking...")
  );
}

function ToolsPanel({ tools, sel, argsText, output, running }) {
  if (!tools.length) return React.createElement(Text, { color: "yellow" }, "Loading tools...");
  const start = Math.max(0, sel - 6);
  const visible = tools.slice(start, start + 14);
  return React.createElement(
    Box,
    { flexDirection: "column" },
    React.createElement(
      Box,
      null,
      React.createElement(Text, { color: "green", bold: true }, `Tool ${sel + 1}/${tools.length} `),
      React.createElement(Text, { color: "gray" }, "  [up/down] nav  [j/k]=10  [enter] run")
    ),
    visible.map((t, i) =>
      React.createElement(
        Box,
        { key: t.name },
        React.createElement(Text, { color: sel === start + i ? "green" : "gray" }, sel === start + i ? "> " : "  "),
        React.createElement(Text, { color: sel === start + i ? "green" : "white" }, t.name)
      )
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { color: "cyan" }, "args (JSON): "),
      React.createElement(Text, null, argsText)
    ),
    running && React.createElement(Text, { color: "yellow" }, "\nRunning tool..."),
    output &&
      React.createElement(
        Box,
        { flexDirection: "column", marginTop: 1 },
        React.createElement(
          Text,
          { color: output.error ? "red" : "green", bold: true },
          output.error ? "Error (HTTP " + (output.httpStatus || "") + ")": "Output"
        ),
        React.createElement(
          Box,
          null,
          React.createElement(Text, { wrap: "wrap" }, output.formatted)
        )
      )
  );
}

function LogPanel({ lines }) {
  const visible = lines.slice(-80);
  if (!visible.length) return React.createElement(Text, { color: "gray" }, "No log output yet.");
  return React.createElement(
    Box,
    { flexDirection: "column" },
    visible.map((l, i) =>
      React.createElement(Text, { key: i, color: l.kind === "stderr" ? "yellow" : "gray", wrap: "wrap" }, l.text)
    )
  );
}

export function App({ logs, onRestart }) {
  const { exit } = useApp();
  const [tab, setTab] = useState(0);
  const [snapshot, setSnapshot] = useState(null);
  const [tools, setTools] = useState([]);
  const [sel, setSel] = useState(0);
  const [argsText, setArgsText] = useState("{}");
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [prompting, setPrompting] = useState(null);
  const [buf, setBuf] = useState("");

  const refresh = (apply) =>
    api.getStatus().then(({ ok, data }) => { if (ok) setSnapshot(data); }).catch(() => {});

  useEffect(() => {
    refresh();
    api.listTools().then((t) => t.length && setTools(t)).catch(() => {});
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((input, key) => {
    if (prompting) {
      if (key.escape) { setPrompting(null); setBuf(""); return; }
      if (key.return) {
        const val = parseFloat(buf);
        setPrompting(null); setBuf("");
        if (!Number.isFinite(val) || val <= 0) return;
        setBusy(true);
        api.control("set-price", val).then(refresh).catch(() => {}).finally(() => setBusy(false));
        return;
      }
      if (key.backspace) { setBuf((b) => b.slice(0, -1)); return; }
      if (/[0-9.]/.test(input)) setBuf((b) => b + input);
      return;
    }

    // Tab switches
    if (input === "\t") { setTab((t) => (t + 1) % TABS.length); return; }
    if (key.leftArrow) { setTab((t) => (t - 1 + TABS.length) % TABS.length); return; }
    if (key.rightArrow) { setTab((t) => (t + 1) % TABS.length); return; }
    if (input >= "1" && input <= "5") { setTab(Number(input) - 1); return; }
    if (key.escape) { exit(); return; }
    if (input === "q") { exit(); return; }

    // Tab-scoped keys
    if (tab === 2) {
      if (key.upArrow) setSel((s) => Math.max(0, s - 1));
      if (key.downArrow) setSel((s) => Math.min(tools.length - 1, s + 1));
      if (input === "j") setSel((s) => Math.min(tools.length - 1, s + 10));
      if (input === "k") setSel((s) => Math.max(0, s - 10));
      if (key.pageUp) setSel((s) => Math.max(0, s - 10));
      if (key.pageDown) setSel((s) => Math.min(tools.length - 1, s + 10));
      if (input === "\n" || input === " ") {
        let parsed = {};
        try { parsed = JSON.parse(argsText || "{}"); }
        catch (e) { setOutput({ error: true, formatted: "Invalid JSON args: " + e.message }); return; }
        setRunning(true); setOutput(null);
        api.callTool(tools[sel].name, parsed)
          .then((res) => {
            if (res.ok) setOutput({ error: false, formatted: JSON.stringify(res.data, null, 2), httpStatus: res.status });
            else if (res.status === 402) setOutput({ error: true, formatted: "HTTP 402 Payment Required. Turn gate OFF on Controls, or send a valid x402 payment.", httpStatus: 402 });
            else setOutput({ error: true, formatted: "HTTP " + res.status + ": " + (res.data && res.data.error ? res.data.error : JSON.stringify(res.data)), httpStatus: res.status });
          })
          .catch((e) => setOutput({ error: true, formatted: "Network error: " + e.message }))
          .finally(() => setRunning(false));
      }
    }
    if (tab === 3) {
      if (input === "g") {
        setBusy(true);
        api.control("toggle-gate").then(refresh).catch(() => {}).finally(() => setBusy(false));
      }
      if (input === "p") setPrompting({ prompt: "Enter USD price per call" });
      if (input === "c") {
        setBusy(true);
        api.control("clear-history").then(refresh).catch(() => {}).finally(() => setBusy(false));
      }
      if (input === "r") {
        if (onRestart) onRestart();
      }
    }
  });

  const panels = {
    0: React.createElement(StatusPanel, { snapshot }),
    1: React.createElement(HistoryPanel, { snapshot }),
    2: React.createElement(ToolsPanel, { tools, sel, argsText, output, running }),
    3: React.createElement(ControlsPanel, { status: snapshot, busy }),
    4: React.createElement(LogPanel, { lines: logs }),
  };

  return React.createElement(
    Box,
    { flexDirection: "column", padding: 1 },
    React.createElement(
      Box,
      null,
      React.createElement(Text, { color: "blue", bold: true }, "TensorFlow Social MCP — x402 TUI")
    ),
    React.createElement(
      Box,
      { marginTop: 1, flexDirection: "column" },
      React.createElement(Tabs, { tab, setTab })
    ),
    React.createElement(
      Box,
      { marginTop: 1, borderStyle: "single", borderColor: "blue", padding: 1 },
      panels[tab]
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { color: "gray" }, " [tab]/[arrows] switch  [q] quit")
    ),
    prompting &&
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Text, { color: "cyan", bold: true }, prompting.prompt + ": "),
        React.createElement(Text, null, buf)
      )
  );
}

// eslint-disable-next-line react/no-unused-prop-types
function Tabs({ tab, setTab }) {
  return React.createElement(
    Box,
    null,
    TABS.map((t, i) =>
      React.createElement(
        Box,
        { key: t, marginRight: 1 },
        React.createElement(
          Text,
          { color: tab === i ? "green" : "gray", bold: tab === i, underline: tab === i },
          `${i + 1}:${t}`
        )
      )
    )
  );
}
