const { trackVelocity } = require("../lib/velocity");

describe("velocity", () => {
  test("trackVelocity calculates velocity", () => {
    const history = {};
    const stats = { viewCount: 100 };
    
    // First call
    trackVelocity("v1", stats, history);
    expect(history["v1"]).toHaveLength(1);
    
    // Second call with time jump
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + (2 * 60 * 60 * 1000)); // 2 hours later
    const result = trackVelocity("v1", { viewCount: 200 }, history);
    
    expect(result).toBeCloseTo(50); // (200 - 100) / 2 hours
  });
});
