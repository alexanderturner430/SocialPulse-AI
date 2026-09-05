const tfMastodon = require("../lib/tf-mastodon");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => ({ dispose: jest.fn() })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) })),
    dispose: jest.fn()
  })),
  layers: { dense: jest.fn() },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  randomUniform: jest.fn(() => ({ dispose: jest.fn() })),
  losses: { cosineDistance: jest.fn(() => ({ dataSync: jest.fn(() => [0.1]) })) }
}));

jest.mock("../lib/tf-image", () => ({}));
jest.mock("../lib/tf-text", () => ({
  analyzeSentimentML: jest.fn(() => ({ sentiment: "positive", score: 0.5 })),
  detectToxicity: jest.fn(() => [])
}));
jest.mock("../lib/tf-ml", () => ({
  detectTrends: jest.fn(),
  forecastTimeSeries: jest.fn(),
  detectAnomalies: jest.fn()
}));

describe("tf-mastodon", () => {
  test("analyzeStatusSentiment analyzes sentiment", async () => {
    const result = await tfMastodon.analyzeStatusSentiment(["test status"]);
    expect(result.count).toBe(1);
    expect(result.overall).toBe("positive");
  });

  test("predictEngagement predicts engagement", async () => {
    const result = await tfMastodon.predictEngagement({ textLen: 100 });
    expect(result.engagementScore).toBe(0.5);
  });
});
