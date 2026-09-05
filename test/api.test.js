const { isEnabled, searchVideos, videoDetails } = require("../lib/api");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("api", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
    jest.clearAllMocks();
  });

  test("isEnabled returns true if API key is set", () => {
    expect(isEnabled()).toBe(true);
  });

  test("isEnabled returns false if API key is not set", () => {
    delete process.env.YOUTUBE_API_KEY;
    expect(isEnabled()).toBe(false);
  });

  test("searchVideos returns correctly mapped items", async () => {
    const mockData = {
      items: [
        {
          id: { videoId: "123" },
          snippet: { title: "Test Video", channelTitle: "Test Channel" }
        }
      ]
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData)
      })
    );

    const result = await searchVideos("test");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Video");
  });
});
