const tfTwitch = require("../lib/tf-twitch");
const tf = require("@tensorflow/tfjs-node");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => ({ dispose: jest.fn() })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({}),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => new Float32Array([0.8])) })),
    dispose: jest.fn(),
  })),
  layers: { dense: jest.fn() },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  randomUniform: jest.fn(() => ({ dispose: jest.fn() })),
}));

jest.mock("../lib/tf-text", () => ({
  embedText: jest.fn().mockResolvedValue([
    { embedding: new Array(64).fill(0.1) },
    { embedding: new Array(64).fill(0.1) }
  ])
}));

describe("tf-twitch", () => {
  test("analyzeStreamContent should return content analysis", async () => {
    const result = await tfTwitch.analyzeStreamContent(["Great stream"]);
    expect(result).toHaveProperty("contentScore");
    expect(result.textCount).toBe(1);
  });

  test("predictViewerCount should return viewer prediction", async () => {
    const features = { titleLen: 10, gamePopularity: 100, durationMinutes: 60, followerCount: 1000 };
    const result = await tfTwitch.predictViewerCount(features);
    expect(result).toHaveProperty("avgPredictedViewers");
    expect(result.dataPoints).toBe(1);
  });
});
