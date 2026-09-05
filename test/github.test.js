jest.mock("../lib/llm", () => ({ askLLM: jest.fn() }));
const github = require("../lib/github");
const { askLLM } = require("../lib/llm");

describe("github", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("getRepo fetches repo data", async () => {
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ id: 1, name: "test-repo", full_name: "owner/test-repo" }),
      status: 200
    });
    
    const data = await github.getRepo("owner", "test-repo");
    expect(data.name).toBe("test-repo");
  });

  test("generateIssue calls LLM", async () => {
    askLLM.mockResolvedValue({ title: "Fix bug", body: "Details" });
    
    const result = await github.generateIssue("owner", "repo", "topic");
    expect(askLLM).toHaveBeenCalled();
    expect(result.issue.title).toBe("Fix bug");
  });
});
