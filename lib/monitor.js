const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const RETENTION_DAYS = 7;

let db = null;
let dbPath = null;

function init(options = {}) {
  dbPath = options.path || path.join(process.cwd(), "data", "monitor.db");
  if (options.inMemory) dbPath = ":memory:";

  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }

  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      tool TEXT NOT NULL,
      status TEXT NOT NULL,
      lat_ms INTEGER,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      tool TEXT NOT NULL,
      verify TEXT NOT NULL,
      settle TEXT NOT NULL,
      amount TEXT,
      tx TEXT,
      success INTEGER NOT NULL
    );
  `);

  pruneOld(options.retentionDays || RETENTION_DAYS);
  return db;
}

function pruneOld(retentionDays = RETENTION_DAYS) {
  if (!db) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM requests WHERE ts < ?").run(cutoff);
  db.prepare("DELETE FROM payments WHERE ts < ?").run(cutoff);
}

function recordRequest({ kind, tool, status, latMs, error = null }) {
  if (!db) throw new Error("monitor not initialized");
  db.prepare(
    "INSERT INTO requests (ts, kind, tool, status, lat_ms, error) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(Date.now(), kind, tool, status, latMs ?? null, error ?? null);
}

function recordPayment({ tool, verify, settle, amount = null, tx = null, success }) {
  if (!db) throw new Error("monitor not initialized");
  db.prepare(
    "INSERT INTO payments (ts, tool, verify, settle, amount, tx, success) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(Date.now(), tool, String(verify), String(settle), amount ?? null, tx ?? null, success ? 1 : 0);
}

function getRequests(limit = 100) {
  if (!db) return [];
  return db.prepare("SELECT * FROM requests ORDER BY id DESC LIMIT ?").all(limit);
}

function getPayments(limit = 100) {
  if (!db) return [];
  return db.prepare("SELECT * FROM payments ORDER BY id DESC LIMIT ?").all(limit);
}

function getCounters() {
  if (!db) return { total: 0, paid: 0, unpaid: 0, error: 0, settled: 0, failedSettle: 0 };
  const r = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
      SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error,
      SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) AS settled,
      SUM(CASE WHEN status = 'failed-settle' THEN 1 ELSE 0 END) AS failedSettle
    FROM requests
  `).get();
  return {
    total: r.total || 0,
    paid: r.paid || 0,
    unpaid: r.unpaid || 0,
    error: r.error || 0,
    settled: r.settled || 0,
    failedSettle: r.failedSettle || 0,
  };
}

function getSettleCounters() {
  if (!db) return { total: 0, success: 0, failed: 0 };
  const r = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
    FROM payments
  `).get();
  return { total: r.total || 0, success: r.success || 0, failed: r.failed || 0 };
}

function clearHistory() {
  if (!db) return;
  db.prepare("DELETE FROM requests").run();
  db.prepare("DELETE FROM payments").run();
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
  if (db) { try { db.close(); } catch (_) {} db = null; }
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
