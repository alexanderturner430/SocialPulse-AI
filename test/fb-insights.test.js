jest.mock("../lib/fb-api", () => ({
  getPageInsights: jest.fn(),
  getPageId: jest.fn().mockReturnValue("page1"),
  getPageInfo: jest.fn(),
  getPagePosts: jest.fn()
}));
jest.mock("../lib/tf-text", () => ({
  analyzeSentimentML: jest.fn()
}));

const fbInsights = require("../lib/fb-insights");
const fbApi = require("../lib/fb-api");

describe("fb-insights", () => {
  test("getAudienceDemographics", async () => {
    fbApi.getPageInsights.mockResolvedValue({
      data: [{ values: [{ value: { "18-24": 10 } }] }]
    });

    const result = await fbInsights.getAudienceDemographics("page1");
    expect(result.genderAge).toEqual({ "18-24": 10 });
  });
});
