const bluesky = require("../lib/bluesky");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("bluesky", () => {
  beforeEach(() => {
    process.env.BLUESKY_HANDLE = "test.bsky.social";
    process.env.BLUESKY_APP_PASSWORD = "test-password";
    jest.clearAllMocks();
  });

  test("getProfile fetches profile successfully", async () => {
    const mockProfile = {
      did: "did:plc:123",
      handle: "test.bsky.social",
      displayName: "Test User"
    };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve(mockProfile)
      })
    );

    const profile = await bluesky.getProfile();
    expect(profile.handle).toBe("test.bsky.social");
    expect(profile.displayName).toBe("Test User");
  });
});
