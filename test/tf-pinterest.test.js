const tfPinterest = require("../lib/tf-pinterest");

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

jest.mock("../lib/tf-image", () => ({
  classifyImage: jest.fn(() => []),
  detectObjects: jest.fn(() => [])
}));
jest.mock("../lib/tf-text", () => ({}));
jest.mock("../lib/tf-ml", () => ({
  detectTrends: jest.fn(),
  forecastTimeSeries: jest.fn(),
  detectAnomalies: jest.fn()
}));

describe("tf-pinterest", () => {
  test("analyzePinImages analyzes images", async () => {
    const result = await tfPinterest.analyzePinImages(["test-url"]);
    expect(result.totalAnalyzed).toBe(1);
  });

  test("predictEngagement predicts engagement", async () => {
    const result = await tfPinterest.predictEngagement({ titleLen: 10 });
    expect(result.engagementScore).toBe(0.5);
  });
});
