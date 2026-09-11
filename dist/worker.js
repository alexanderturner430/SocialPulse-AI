const { Worker } = require("bullmq");
const { connection } = require("./lib/queue");
const toolRegistry = require("./lib/tool-registry");

const worker = new Worker(
  "ml-inference",
  async (job) => {
    const { toolName, args, jobId } = job.data;
    console.log(`Processing job ${jobId} for tool ${toolName}`);

    try {
      const handler = toolRegistry[toolName];
      if (!handler) throw new Error(`Tool ${toolName} not found`);

      const result = await handler(args);
      console.log(`Job ${jobId} completed`);
      return result;
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      throw error; // Let BullMQ handle retry logic
    }
  },
  { connection }
);

console.log("Worker process started...");
