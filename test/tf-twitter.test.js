const tf = require("@tensorflow/tfjs-node");
const tfText = require("../lib/tf-text");
const tfMl = require("../lib/tf-ml");
const { 
  analyzeTweetContent,
  predictTweetEngagement,
  classifyTweetTopics,
  detectTweetToxicity,
  analyzeTweetSentiment,
  extractTweetKeywords,
  forecastFollowerGrowth,
  detectEngagementAnomalies,
  compareTweetSimilarity,
  clusterTweetTopics
} = require("../lib/tf-twitter");

jest.mock("@tensorflow/tfjs-node");
jest.mock("../lib/tf-text");
jest.mock("../lib/tf-ml");

describe("tf-twitter", () => {
  test("analyzeTweetContent", async () => {
    tfText.extractKeywordsML.mockResolvedValue(["a", "b"]);
    const result = await analyzeTweetContent(["tweet 1", "tweet 2"]);
    expect(result).toEqual({ tweetCount: 2, keywords: ["a", "b"] });
  });

  // Add more tests for other functions...
});
