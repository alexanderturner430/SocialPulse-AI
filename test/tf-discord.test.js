const { analyzeMessageSentiment } = require("../lib/tf-discord");
const tf = require("@tensorflow/tfjs-node");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor1d: jest.fn().mockReturnValue({ 
    dataSync: () => [0.1], 
    dispose: jest.fn() 
  }),
  moments: jest.fn().mockReturnValue({ 
    variance: { dataSync: () => [0.1] } 
  }),
}));

describe("tf-discord", () => {
  test("analyzeMessageSentiment returns sentiment analysis", async () => {
    const result = await analyzeMessageSentiment(["great", "bad"]);
    expect(result.messageCount).toBe(2);
    expect(result.sentiment.averageScore).toBeDefined();
  });
});
