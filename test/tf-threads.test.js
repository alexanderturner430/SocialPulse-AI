const tfThreads = require("../lib/tf-threads");
const tf = require("@tensorflow/tfjs-node");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => ({ dispose: jest.fn() })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({}),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.8]) })),
    dispose: jest.fn(),
  })),
  layers: { dense: jest.fn() },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  randomUniform: jest.fn(() => ({ dispose: jest.fn() })),
}));

jest.mock("../lib/tf-text", () => ({
  analyzeSentimentML: jest.fn().mockResolvedValue({ sentiment: "positive", score: 0.5, positive: [], negative: [] }),
  detectToxicity: jest.fn().mockResolvedValue([
    { label: "toxic", results: [{ match: false, probabilities: [0.9, 0.1] }] }
  ])
}));

describe("tf-threads", () => {
  test("analyzePostSentiment should return sentiment analysis", async () => {
    const result = await tfThreads.analyzePostSentiment(["Great post"]);
    expect(result.average).toBe(0.5);
    expect(result.overall).toBe("positive");
  });

  test("predictEngagement should return engagement score", async () => {
    const features = { textLen: 100, emojiCount: 1, likeCount: 10, replyCount: 2 };
    const result = await tfThreads.predictEngagement(features);
    expect(result).toHaveProperty("engagementScore");
    expect(result).toHaveProperty("predictedLikes");
  });
});
