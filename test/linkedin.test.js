jest.mock("../lib/llm", () => ({ askLLM: jest.fn() }));
const linkedin = require("../lib/linkedin");
const { askLLM } = require("../lib/llm");

describe("linkedin", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.LINKEDIN_ACCESS_TOKEN = "test-token";
    process.env.LINKEDIN_PERSON_URN = "urn:li:person:123";
  });

  test("getProfile fetches profile data", async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ id: "123", firstName: "John", lastName: "Doe" }),
      status: 200
    });
    
    const data = await linkedin.getProfile();
    expect(data.firstName).toBe("John");
  });

  test("generatePost calls LLM", async () => {
    askLLM.mockResolvedValue(["post1", "post2"]);
    
    const result = await linkedin.generatePost("topic");
    expect(askLLM).toHaveBeenCalled();
    expect(result.posts.length).toBe(2);
  });
});
