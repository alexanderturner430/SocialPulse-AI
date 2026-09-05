const { getProfile, getPosts } = require("../lib/threads");

jest.mock("node-fetch");
const fetch = require("node-fetch");

describe("threads", () => {
  beforeEach(() => {
    process.env.THREADS_ACCESS_TOKEN = "test-token";
    process.env.THREADS_USER_ID = "test-user";
    jest.clearAllMocks();
  });

  test("getProfile fetches user profile", async () => {
    const mockData = { id: "test-user", username: "testuser" };
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData)
      })
    );

    const profile = await getProfile();
    expect(profile.id).toBe("test-user");
  });
});
