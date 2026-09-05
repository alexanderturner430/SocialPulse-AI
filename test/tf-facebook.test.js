const { analyzePostContent } = require("../lib/tf-facebook");
const tfImage = require("../lib/tf-image");

jest.mock("../lib/tf-image", () => ({
  analyzeThumbnail: jest.fn().mockResolvedValue({ classifications: [] })
}));

describe("tf-facebook", () => {
  test("analyzePostContent analyzes content", async () => {
    const data = { message: "hello #world", imageUrl: "http://test.com/img.jpg" };
    const result = await analyzePostContent(data);
    expect(result.features.hashtagCount).toBe(1);
    expect(tfImage.analyzeThumbnail).toHaveBeenCalledWith("http://test.com/img.jpg");
  });
});
