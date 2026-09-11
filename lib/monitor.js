const fs = require("node:fs");
const path = require("node:path");

const RETENTION_DAYS = 7;

let state = null;
let statePath = null;

function emptyState() {
  return { requests: [], payments: [], nextRequestId: 1, nextPaymentId: 1 };
}

function normalizeState(loaded, fallback) {
  const s = {
    requests: Array.isArray(loaded.requests) ? loaded.requests : fallback.requests,
    payments: Array.isArray(loaded.payments) ? loaded.payments : fallback.payments,
  };
  s.nextRequestId = highestId(s.requests, fallback.nextRequestId) + 1;
  s.nextPaymentId = highestId(s.payments, fallback.nextPaymentId) + 1;
  return s;
}

function highestId(rows, fallback) {
  let max = 0;
  for (const row of rows) {
    if (Number.isInteger(row.id) && row.id > max) max = row.id;
  }
  return Math.max(max, fallback - 1);
}

function init(options = {}) {
  statePath = options.path || path.join(process.cwd(), "data", "monitor.json");
  if (options.inMemory) statePath = ":memory:";

  state = emptyState();

  if (statePath !== ":memory:") {
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      if (fs.existsSync(statePath)) {
        state = normalizeState(JSON.parse(fs.readFileSync(statePath, "utf8")), state);
      }
    } catch (_) {
      state = emptyState();
    }
  }

  pruneOld(options.retentionDays || RETENTION_DAYS);
  return state;
}

function persist() {
  if (!state || statePath === ":memory:") return;
  fs.writeFileSync(statePath, JSON.stringify(state));
}

function pruneOld(retentionDays = RETENTION_DAYS) {
  if (!state) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const requestsBefore = state.requests.length;
  const paymentsBefore = state.payments.length;
  state.requests = state.requests.filter((r) => r.ts >= cutoff);
  state.payments = state.payments.filter((p) => p.ts >= cutoff);
  if (state.requests.length !== requestsBefore || state.payments.length !== paymentsBefore) {
    persist();
  }
}

function recordRequest({ kind, tool, status, latMs, error = null }) {
  if (!state) throw new Error("monitor not initialized");
  state.requests.push({
    id: state.nextRequestId++,
    ts: Date.now(),
    kind,
    tool,
    status,
    lat_ms: latMs ?? null,
    error: error ?? null,
  });
  persist();
}

function recordPayment({ tool, verify, settle, amount = null, tx = null, success }) {
  if (!state) throw new Error("monitor not initialized");
  state.payments.push({
    id: state.nextPaymentId++,
    ts: Date.now(),
    tool,
    verify: String(verify),
    settle: String(settle),
    amount: amount ?? null,
    tx: tx ?? null,
    success: success ? 1 : 0,
  });
  persist();
}

function getRequests(limit = 100) {
  if (!state) return [];
  return state.requests.slice().sort((a, b) => b.id - a.id).slice(0, limit);
}

function getPayments(limit = 100) {
  if (!state) return [];
  return state.payments.slice().sort((a, b) => b.id - a.id).slice(0, limit);
}

function getCounters() {
  if (!state) return { total: 0, paid: 0, unpaid: 0, error: 0, settled: 0, failedSettle: 0 };
  const counters = { total: state.requests.length, paid: 0, unpaid: 0, error: 0, settled: 0, failedSettle: 0 };
  for (const r of state.requests) {
    if (r.status === "paid") counters.paid++;
    else if (r.status === "unpaid") counters.unpaid++;
    else if (r.status === "error") counters.error++;
    else if (r.status === "settled") counters.settled++;
    else if (r.status === "failed-settle") counters.failedSettle++;
  }
  return counters;
}

function getSettleCounters() {
  if (!state) return { total: 0, success: 0, failed: 0 };
  let success = 0;
  for (const p of state.payments) {
    if (p.success === 1) success++;
  }
  return { total: state.payments.length, success, failed: state.payments.length - success };
}

function clearHistory() {
  if (!state) return;
  state.requests = [];
  state.payments = [];
  persist();
}

function getSnapshot(limit = 100) {
  return {
    counters: getCounters(),
    settles: getSettleCounters(),
    requests: getRequests(limit),
    payments: getPayments(limit),
  };
}

function close() {
  if (state) { persist(); state = null; }
}

module.exports = {
  init,
  recordRequest,
  recordPayment,
  getRequests,
  getPayments,
  getCounters,
  getSettleCounters,
  getSnapshot,
  clearHistory,
  close,
  RETENTION_DAYS,
};