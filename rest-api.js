const express = require("express");
const { randomUUID } = require("crypto");
const { mlQueue } = require("./lib/queue");

const app = express();
app.use(express.json());

// API versioning
const apiRouter = express.Router();

apiRouter.post("/tools/:toolName", async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;
  const jobId = randomUUID();

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

const PORT = 7300;
app.listen(PORT, () => {
  console.log(`REST API server running at http://localhost:${PORT}`);
});
