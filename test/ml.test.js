const { extractKeywords, computeVector, cosineSimilarity } = require("../lib/ml");

describe("ml", () => {
  test("extractKeywords returns keywords", () => {
    const docs = ["this is a test", "this is another test", "test document"];
    const keywords = extractKeywords(docs);
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);
  });
  
  test("cosineSimilarity returns similarity score", () => {
    const vecA = { a: 1, b: 2 };
    const vecB = { a: 2, b: 1 };
    const sim = cosineSimilarity(vecA, vecB);
    expect(typeof sim).toBe("number");
    expect(sim).toBeGreaterThan(0);
  });
});
