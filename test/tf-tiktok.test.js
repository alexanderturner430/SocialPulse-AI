const tfTikTok = require("../lib/tf-tiktok");
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
}));

jest.mock("../lib/tf-image", () => ({
  analyzeThumbnail: jest.fn().mockResolvedValue({ brightness: 0.5 })
}));

jest.mock("../lib/tf-text", () => ({
  classifyText: jest.fn().mockResolvedValue({ label: "dance", confidences: {} }),
  analyzeSentimentML: jest.fn().mockResolvedValue({ sentiment: "positive" }),
  extractKeywordsML: jest.fn().mockResolvedValue([])
}));

describe("tf-tiktok", () => {
  test("analyzeVideoThumbnails should return thumbnail analysis", async () => {
    const result = await tfTikTok.analyzeVideoThumbnails(["http://test.com/img.jpg"]);
    expect(result.count).toBe(1);
    expect(result.thumbnails[0].brightness).toBe(0.5);
  });

  test("predictVirality should return virality score", async () => {
    const features = [{ titleLen: 10, descLen: 20, duration: 30, hashtagCount: 2, emojiCount: 1 }];
    const result = await tfTikTok.predictVirality(features);
    expect(result.count).toBe(1);
    expect(result.predictions[0].viralityScore).toBe(0.8);
  });
});
