jest.mock("../lib/llm", () => ({ askLLM: jest.fn() }));
const mastodon = require("../lib/mastodon");
const { askLLM } = require("../lib/llm");

describe("mastodon", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.MASTODON_INSTANCE_URL = "https://test.mastodon.social";
    process.env.MASTODON_ACCESS_TOKEN = "test-token";
  });

  test("getAccount fetches account data", async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ id: "123", username: "testuser" }),
      status: 200
    });
    
    const data = await mastodon.getAccount("123");
    expect(data.username).toBe("testuser");
  });

  test("generateToot calls LLM", async () => {
    askLLM.mockResolvedValue(["toot1", "toot2"]);
    
    const result = await mastodon.generateToot("topic");
    expect(askLLM).toHaveBeenCalled();
    expect(result.toots.length).toBe(2);
  });
});
