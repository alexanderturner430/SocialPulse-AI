const tfSpotify = require("../lib/tf-spotify");
const tf = require("@tensorflow/tfjs-node");

jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => ({ dispose: jest.fn(), dataSync: jest.fn(() => [0.5]) })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({}),
    predict: jest.fn(() => ({ dataSync: jest.fn(() => new Array(24).fill(0.1)) })),
    dispose: jest.fn(),
  })),
  layers: { dense: jest.fn() },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  randomUniform: jest.fn(() => ({ dispose: jest.fn() })),
  oneHot: jest.fn(() => ({ dispose: jest.fn() })),
  losses: { cosineDistance: jest.fn(() => ({ dataSync: jest.fn(() => [0.1]) })) },
}));

describe("tf-spotify", () => {
  test("analyzeTrackSentiment should return sentiment analysis", async () => {
    const features = { danceability: 0.8, energy: 0.9, valence: 0.7 };
    const result = await tfSpotify.analyzeTrackSentiment(features);
    expect(result).toHaveProperty("sentiment");
    expect(result).toHaveProperty("sentimentScore");
  });

  test("classifyGenre should return genre classification", async () => {
    const features = { danceability: 0.8, energy: 0.9 };
    const result = await tfSpotify.classifyGenre(features);
    expect(result).toHaveProperty("primaryGenre");
    expect(result).toHaveProperty("topGenres");
  });
});
