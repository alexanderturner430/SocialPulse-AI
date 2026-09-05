const fbApi = require("../lib/fb-api");

describe("fb-api", () => {
  beforeEach(() => {
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "test_token";
    global.fetch = jest.fn();
  });

  test("getPagePosts", async () => {
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ data: [] })
    });
    
    await fbApi.getPagePosts("page1");
    expect(global.fetch).toHaveBeenCalled();
  });
});
