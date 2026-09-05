const { analyzeCaptionSentiment } = require("../lib/tf-instagram");
const tfText = require("../lib/tf-text");

jest.mock("../lib/tf-text", () => ({
  analyzeSentimentML: jest.fn().mockResolvedValue({ sentiment: "positive" })
}));

describe("tf-instagram", () => {
  test("analyzeCaptionSentiment returns sentiment", async () => {
    const result = await analyzeCaptionSentiment("nice pic");
    expect(result.sentiment.sentiment).toBe("positive");
  });
});
