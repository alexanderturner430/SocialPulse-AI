const { getProfile } = require("../lib/twitter");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("twitter", () => {
  beforeEach(() => {
    process.env.TWITTER_BEARER_TOKEN = "token";
    jest.clearAllMocks();
  });

  test("getProfile fetches user profile", async () => {
    const mockData = {
        data: {
            id: "u1",
            username: "testuser",
            name: "Test User",
            public_metrics: {
                followers_count: 10,
                following_count: 5,
                tweet_count: 100,
                like_count: 50
            },
            verified: false
        }
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData)
      })
    );

    const profile = await getProfile("testuser");
    expect(profile.username).toBe("testuser");
  });
});
