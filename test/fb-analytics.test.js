jest.mock("../lib/fb-api", () => ({
  getPostDetails: jest.fn(),
  getPostInsights: jest.fn(),
  getPagePosts: jest.fn()
}));

const fbAnalytics = require("../lib/fb-analytics");
const fbApi = require("../lib/fb-api");

describe("fb-analytics", () => {
  test("analyzePost", async () => {
    fbApi.getPostDetails.mockResolvedValue({ id: "p1", message: "hello" });
    fbApi.getPostInsights.mockResolvedValue({
      data: [
        { name: "post_impressions", values: [{ value: 100 }] },
        { name: "post_engaged_users", values: [{ value: 10 }] }
      ]
    });

    const result = await fbAnalytics.analyzePost("p1");
    expect(result.id).toBe("p1");
    expect(result.metrics.impressions).toBe(100);
  });
});
