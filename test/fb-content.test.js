jest.mock("../lib/llm", () => ({
  askLLM: jest.fn()
}));
jest.mock("../lib/fb-api", () => ({
  getPageInfo: jest.fn(),
  getPagePosts: jest.fn()
}));

const fbContent = require("../lib/fb-content");
const { askLLM } = require("../lib/llm");

describe("fb-content", () => {
  test("generateCaption", async () => {
    askLLM.mockResolvedValue('["caption1", "caption2"]');
    
    const result = await fbContent.generateCaption("test topic");
    expect(result.captions).toEqual(["caption1", "caption2"]);
  });
});
