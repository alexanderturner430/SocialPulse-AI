const reddit = require("../lib/reddit");

global.fetch = jest.fn();
process.env.REDDIT_CLIENT_ID = "cid";
process.env.REDDIT_CLIENT_SECRET = "csec";

describe("reddit", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test("getPost returns formatted post data", async () => {
    // Mock access token fetch and then the post fetch
    fetch
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({ access_token: "token", expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue([{
          data: { children: [{ data: { id: "p1", title: "Test", created_utc: 1000, permalink: "/r/sub/comments/p1" } }] }
        }])
      });

    const post = await reddit.getPost("p1", "sub");
    expect(post.id).toBe("p1");
    expect(post.title).toBe("Test");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
