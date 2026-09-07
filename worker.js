const { Worker } = require("bullmq");
const { connection } = require("./lib/queue");
const toolRegistry = require("./lib/tool-registry");
const logger = require("./lib/logger");

const worker = new Worker(
  "ml-inference",
  async (job) => {
    const { toolName, args, jobId } = job.data;
    logger.info({ jobId, toolName }, "Processing job");

    try {
      const handler = toolRegistry[toolName];
      if (!handler) throw new Error(`Tool ${toolName} not found`);

      const result = await handler(args);
      logger.info({ jobId }, "Job completed");
      return result;
    } catch (error) {
      logger.error({ jobId, error: error.message }, "Job failed");
      throw error; // Let BullMQ handle retry logic
    }
  },
  { connection }
);

logger.info("Worker process started...");
