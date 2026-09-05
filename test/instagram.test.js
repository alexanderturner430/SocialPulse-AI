jest.mock("../lib/llm", () => ({ askLLM: jest.fn() }));
const instagram = require("../lib/instagram");
const { askLLM } = require("../lib/llm");

describe("instagram", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.INSTAGRAM_ACCESS_TOKEN = "test-token";
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "test-id";
  });

  test("getProfile fetches profile data", async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ id: "123", username: "testuser" }),
      status: 200
    });
    
    const data = await instagram.getProfile();
    expect(data.username).toBe("testuser");
  });

  test("generateCaption calls LLM", async () => {
    askLLM.mockResolvedValue(["cap1", "cap2"]);
    
    const result = await instagram.generateCaption("topic");
    expect(askLLM).toHaveBeenCalled();
    expect(result.captions.length).toBe(2);
  });
});
