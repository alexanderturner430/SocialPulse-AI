const tfMl = require("../lib/tf-ml");

const mockTensor = {
  dispose: jest.fn(),
  min: jest.fn(() => mockTensor),
  max: jest.fn(() => mockTensor),
  sub: jest.fn(() => mockTensor),
  div: jest.fn(() => mockTensor),
  dataSync: jest.fn(() => [0.1, 0.2])
};

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => mockTensor),
  input: jest.fn(),
  layers: { dense: jest.fn(() => ({ apply: jest.fn(() => ({})) })) },
  model: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.1, 0.2]), dispose: jest.fn() })),
    dispose: jest.fn()
  })),
  losses: { meanSquaredError: jest.fn(() => ({ dataSync: jest.fn(() => new Array(10).fill(0.1)) })) },
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn(),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => [0.1]) })),
    dispose: jest.fn()
  })),
  tensor3d: jest.fn(() => ({ dispose: jest.fn() })),
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  scalar: jest.fn(),
  keep: jest.fn(),
  zeros: jest.fn(() => ({ dispose: jest.fn() }))
}));

describe("tf-ml", () => {
  test("detectAnomalies detects anomalies", async () => {
    const result = await tfMl.detectAnomalies([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.length).toBe(10);
  });
});
