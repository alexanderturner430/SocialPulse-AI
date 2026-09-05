const tf = require("@tensorflow/tfjs-node");
const tfImage = require("../lib/tf-image");
const tfText = require("../lib/tf-text");
const tfMl = require("../lib/tf-ml");
const { 
  analyzeChannelThumbnails,
  classifyVideoContent,
  predictVideoViews,
  analyzeCommentSentiment,
  extractChannelKeywords,
  detectChannelTrends,
  forecastChannelGrowth,
  detectViewAnomalies,
  compareVideoThumbnails,
  clusterVideoTopics
} = require("../lib/tf-youtube");

jest.mock("@tensorflow/tfjs-node");
jest.mock("../lib/tf-image");
jest.mock("../lib/tf-text");
jest.mock("../lib/tf-ml");

describe("tf-youtube", () => {
  test("analyzeChannelThumbnails", async () => {
    tfImage.analyzeThumbnail.mockResolvedValue({ effectivenessScore: 0.8 });
    const result = await analyzeChannelThumbnails(["url1"]);
    expect(result.thumbnailCount).toBe(1);
    expect(result.averageEffectiveness).toBe(0.8);
  });
});
