/**
 * Analytics logic for posting patterns
 */

function analyzeUploadPatterns(items) {
  const dayDistribution = new Array(7).fill(0);
  const hourDistribution = new Array(24).fill(0);
  let totalInterval = 0;
  let count = 0;

  const dates = items
    .map(item => new Date(item.published))
    .sort((a, b) => a - b);

  dates.forEach((date, i) => {
    dayDistribution[date.getDay()]++;
    hourDistribution[date.getHours()]++;

    if (i > 0) {
      totalInterval += (date - dates[i - 1]);
      count++;
    }
  });

  return {
    dayDistribution,
    hourDistribution,
    averageIntervalHours: count > 0 ? (totalInterval / count) / (1000 * 60 * 60) : 0
  };
}

module.exports = { analyzeUploadPatterns };
