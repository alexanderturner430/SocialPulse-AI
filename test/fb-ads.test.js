const fbAds = require("../lib/fb-ads");
const fbApi = require("../lib/fb-api");

jest.mock("../lib/fb-api");

describe("fb-ads", () => {
  test("getAdPerformance fetches insights", async () => {
    fbApi.graphRequest.mockResolvedValue({
      data: [{
        campaign_name: "Test Campaign",
        impressions: "100",
        clicks: "10"
      }]
    });

    const performance = await fbAds.getAdPerformance("ad123");
    expect(performance.campaignName).toBe("Test Campaign");
    expect(performance.metrics.impressions).toBe(100);
  });
});
