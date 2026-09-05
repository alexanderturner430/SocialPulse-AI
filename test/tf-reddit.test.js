const tfReddit = require("../lib/tf-reddit");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => ({
    mean: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) })),
    sub: jest.fn(() => ({ div: jest.fn(() => ({ dispose: jest.fn() })) })),
    dispose: jest.fn()
  })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) })),
    dispose: jest.fn()
  })),
  layers: { dense: jest.fn() },
  randomUniform: jest.fn(() => ({ dispose: jest.fn() })),
  tensor3d: jest.fn(() => ({ dispose: jest.fn() }))
}));

jest.mock("../lib/tf-text", () => ({}));
jest.mock("../lib/tf-ml", () => ({
  detectTrends: jest.fn(),
  forecastTimeSeries: jest.fn(),
  detectAnomalies: jest.fn()
}));

describe("tf-reddit", () => {
  test("analyzePostSentiment analyzes sentiment", async () => {
    const result = await tfReddit.analyzePostSentiment(["test post"]);
    expect(result.postCount).toBe(1);
  });
});
