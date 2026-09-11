require("dotenv").config();
const express = require("express");
const { randomUUID } = require("crypto");
const { mlQueue } = require("./lib/queue");
const x402 = require("./lib/x402");
const monitor = require("./lib/monitor");
const toolDefinitions = require("./lib/tool-definitions");

const app = express();
app.use(express.json());

const x402State = x402.init(toolDefinitions);
monitor.init();

// Reject unpaid tool calls with an HTTP 402 + x402 challenge. Only the routes
// registered by x402.init() (POST /api/v1/tools/:name) are gated; job polling
// (GET /api/v1/jobs/:jobId) stays open so a paid job can be polled for free.
function monitorMiddleware(original) {
  return (req, res, next) => {
    const onFinish = () => {
      if (res.statusCode === 402) {
        const toolName = req.params && req.params.toolName;
        if (toolName) monitor.recordRequest({ kind: "rest", tool: toolName, status: "unpaid" });
      }
    };
    res.on("finish", onFinish);
    return original(req, res, next);
  };
}
app.use(monitorMiddleware(x402State.middleware));

// API versioning
const apiRouter = express.Router();

apiRouter.post("/tools/:toolName", async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;
  const jobId = randomUUID();

  // The x402 middleware has already verified + settled payment at this point.
  monitor.recordRequest({ kind: "rest", tool: toolName, status: "paid", latMs: 0 });

  // Enqueue job
  await mlQueue.add(
    "inference",
    { toolName, args, jobId },
    { jobId, removeOnComplete: { age: 300 }, removeOnFail: { age: 300 } }
  );

  res.status(202).json({ jobId, message: "Job enqueued" });
});

apiRouter.get("/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const job = await mlQueue.getJob(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const state = await job.getState();
  if (state === "completed") return res.json({ status: "completed", result: job.returnvalue });
  if (state === "failed") return res.status(500).json({ status: "failed", error: job.failedReason });
  res.json({ status: state });
});

app.use("/api/v1", apiRouter);

// === x402 status & control endpoints (localhost-only TUI integration) ===
const SERVER_START_TIME = Date.now();
const SERVER_PORT = parseInt(process.env.PORT, 10) || 7300;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopbackRequest(req) {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress);
}

app.get("/x402/status", (req, res) => {
  res.json({
    server: {
      pid: process.pid,
      port: SERVER_PORT,
      uptimeMs: Date.now() - SERVER_START_TIME,
      startedAt: SERVER_START_TIME,
      tools: toolDefinitions.length,
    },
    x402: x402.getStatus(),
    monitor: monitor.getSnapshot(50),
  });
});

app.post("/x402/control", (req, res) => {
  if (!isLoopbackRequest(req)) {
    return res.status(403).json({ ok: false, error: "x402 controls are available only from localhost" });
  }
  const { action, value } = req.body || {};
  try {
    switch (action) {
      case "toggle-gate":
        return res.json({ ok: true, x402: x402.setGateEnabled(!x402.isGateEnabled()) });
      case "set-gate":
        return res.json({ ok: true, x402: x402.setGateEnabled(!!value) });
      case "set-price":
        return res.json({ ok: true, x402: x402.setPrice(parseFloat(value)) });
      case "clear-history":
        monitor.clearHistory();
        return res.json({ ok: true, monitor: monitor.getSnapshot(50) });
      default:
        return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.use((err, req, res, _next) => { console.error("Server error:", err); res.status(500).json({ error: "Internal server error" }); });

const PORT = SERVER_PORT;
app.listen(PORT, () => {
  console.log(`REST API server running at http://localhost:${PORT}`);
});
