const { getProfile } = require("../lib/tiktok");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("tiktok", () => {
  beforeEach(() => {
    process.env.TIKTOK_ACCESS_TOKEN = "test-token";
    jest.clearAllMocks();
  });

  test("getProfile fetches user profile", async () => {
    const mockData = {
        data: {
            user: {
                open_id: "u1",
                username: "testuser",
                nickname: "Test User",
                avatar_larger: { url_list: ["url"] },
                follower_count: 10,
                following_count: 5,
                heart_count: 100,
                video_count: 2,
                is_verified: false,
                signature: "bio"
            }
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
