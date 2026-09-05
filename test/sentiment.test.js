const { analyzeSentiment } = require('../lib/sentiment');

describe('analyzeSentiment', () => {
  it('should return positive score for positive words', () => {
    expect(analyzeSentiment('This is great and amazing')).toBe(2);
  });

  it('should return negative score for negative words', () => {
    expect(analyzeSentiment('This is bad and boring')).toBe(-2);
  });

  it('should return 0 for neutral words', () => {
    expect(analyzeSentiment('This is neutral')).toBe(0);
  });
});
