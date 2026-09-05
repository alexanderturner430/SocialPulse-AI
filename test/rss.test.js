const rss = require("../lib/rss");

global.fetch = jest.fn();

describe("rss", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test("uploadsPlaylistId returns correctly formatted id", () => {
    expect(rss.uploadsPlaylistId("UC12345", "all")).toBe("UU12345");
  });

  test("fetchFeed fetches and parses feed", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue("<xml><title>Feed</title><entry><yt:videoId>v1</yt:videoId><title>Video</title></entry></xml>")
    });

    const feed = await rss.fetchFeed({ channel_id: "UC12345" });
    expect(feed.title).toBe("Feed");
    expect(feed.videos[0].id).toBe("v1");
  });
});
