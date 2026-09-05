const tfLinkedIn = require("../lib/tf-linkedin");
const tf = require("@tensorflow/tfjs-node");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor1d: jest.fn(() => ({
    mean: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) })),
    sub: jest.fn(() => ({ square: jest.fn(() => ({ mean: jest.fn(() => ({ sqrt: jest.fn(() => ({ dataSync: jest.fn(() => [0.1]) })) })) })) })),
    dispose: jest.fn(),
    norm: jest.fn(() => ({ dispose: jest.fn() })),
    mul: jest.fn(() => ({ sum: jest.fn(() => ({ div: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) })) })) }))
  })),
  tensor2d: jest.fn(() => ({
    dispose: jest.fn(),
    mean: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) }))
  })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.5]) })),
    dispose: jest.fn()
  })),
  layers: { dense: jest.fn(), lstm: jest.fn() },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  randomUniform: jest.fn(() => ({ dispose: jest.fn() })),
  input: jest.fn(),
  model: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.1]) })),
    dispose: jest.fn()
  })),
  zeros: jest.fn(() => ({ dispose: jest.fn() })),
  scalar: jest.fn()
}));

describe("tf-linkedin", () => {
  test("analyzePostSentiment analyzes sentiment", async () => {
    const result = await tfLinkedIn.analyzePostSentiment(["great post", "bad post"]);
    expect(result.summary.total).toBe(2);
  });

  test("predictEngagement predicts engagement", async () => {
    const result = await tfLinkedIn.predictEngagement({ textLen: 100 });
    expect(result.engagementScore).toBe(0.5);
  });
});
