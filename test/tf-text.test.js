const tfText = require("../lib/tf-text");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(),
  sequential: jest.fn(),
}));

jest.mock("@tensorflow-models/toxicity", () => ({
  load: jest.fn().mockResolvedValue({
    classify: jest.fn().mockResolvedValue([
      { label: "toxic", results: [{ match: true, probabilities: [0.1, 0.9] }] }
    ])
  })
}));

jest.mock("@tensorflow-models/universal-sentence-encoder", () => ({
  load: jest.fn().mockResolvedValue({
    embed: jest.fn().mockResolvedValue({
      dataSync: jest.fn(() => new Float32Array(512)),
      dispose: jest.fn()
    })
  })
}));

jest.mock("sentiment", () => {
  return jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockReturnValue({ comparative: 0.5, positive: [], negative: [] })
  }));
});

describe("tf-text", () => {
  test("detectToxicity should detect toxic text", async () => {
    const result = await tfText.detectToxicity("This is bad");
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].label).toBe("toxic");
  });

  test("analyzeSentimentML should return sentiment score", async () => {
    const result = await tfText.analyzeSentimentML("This is great");
    expect(result).toHaveProperty("score");
    expect(result.sentiment).toBe("positive");
  });
});
