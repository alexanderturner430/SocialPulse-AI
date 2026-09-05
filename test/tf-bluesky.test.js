const tfBluesky = require("../lib/tf-bluesky");

// Mock tensorflow
jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({
      dataSync: jest.fn(() => [0.5])
    })),
    dispose: jest.fn()
  })),
  layers: { dense: jest.fn() },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  randomUniform: jest.fn(() => ({ dispose: jest.fn() }))
}));

// Mock internal dependencies
jest.mock("../lib/tf-text", () => ({
  analyzeSentimentML: jest.fn(() => ({ sentiment: "positive", score: 0.5, positive: 0.8, negative: 0.1 })),
  detectToxicity: jest.fn(() => [])
}));

describe("tf-bluesky", () => {
  test("analyzePostSentiment analyzes sentiment", async () => {
    const result = await tfBluesky.analyzePostSentiment(["test post"]);
    expect(result.count).toBe(1);
    expect(result.overall).toBe("positive");
  });
});
