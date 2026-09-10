jest.mock("../lib/api", () => ({
  isEnabled: jest.fn(),
  videoComments: jest.fn()
}));
jest.mock("../lib/sentiment");

const { fetchAndAnalyzeComments } = require("../lib/comments");
const api = require("../lib/api");
const { analyzeSentiment } = require("../lib/sentiment");
const db = require("../lib/db");

describe("comments", () => {
  test("fetchAndAnalyzeComments fetches, analyzes, and saves comments", async () => {
    api.isEnabled.mockReturnValue(true);
    api.videoComments.mockResolvedValue([
      { id: "c1", text: "great video" },
      { id: "c2", text: "bad video" }
    ]);
    analyzeSentiment.mockReturnValue(0.8);
    
    // Mocking the statements
    const insertStmt = { run: jest.fn() };
    const getStmt = { all: jest.fn().mockReturnValue([]) };
    
    // Create a mock DB object
    const mockDb = {
      prepare: jest.fn()
        .mockReturnValueOnce(insertStmt)
        .mockReturnValueOnce(getStmt)
    };

    await fetchAndAnalyzeComments("v1", mockDb);
    
    expect(api.videoComments).toHaveBeenCalledWith("v1");
    expect(analyzeSentiment).toHaveBeenCalledTimes(2);
    expect(insertStmt.run).toHaveBeenCalledTimes(2);
    expect(getStmt.all).toHaveBeenCalledWith("v1");
  });
});
