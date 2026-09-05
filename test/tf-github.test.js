const { analyzeIssueSentiment } = require("../lib/tf-github");
const tfText = require("../lib/tf-text");

jest.mock("../lib/tf-text", () => ({
  analyzeSentimentML: jest.fn().mockResolvedValue({ sentiment: "positive", score: 0.5, positive: 0.5, negative: 0 })
}));

describe("tf-github", () => {
  test("analyzeIssueSentiment returns sentiment analysis", async () => {
    const result = await analyzeIssueSentiment(["good issue"]);
    expect(result.count).toBe(1);
    expect(result.average).toBe(0.5);
  });
});
