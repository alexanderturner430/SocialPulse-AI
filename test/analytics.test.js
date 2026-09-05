const { analyzeUploadPatterns } = require('../lib/analytics');

describe('analyzeUploadPatterns', () => {
  it('should correctly analyze upload patterns', () => {
    const items = [
      { published: '2023-01-01T10:00:00Z' },
      { published: '2023-01-01T12:00:00Z' }
    ];
    const result = analyzeUploadPatterns(items);
    expect(result.dayDistribution).toBeDefined();
    expect(result.hourDistribution).toBeDefined();
    expect(result.averageIntervalHours).toBe(2);
  });
});
