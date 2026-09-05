/**
 * Linear regression for view forecasting
 */

function forecastViews(history, daysAhead = 7) {
  if (history.length < 2) return null;

  // X = time (hours), Y = views
  const startTime = history[0].timestamp;
  const points = history.map(h => ({
    x: (h.timestamp - startTime) / (1000 * 60 * 60), // hours
    y: h.views
  }));

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  points.forEach(p => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Forecast: Y = slope * X + intercept
  const lastX = points[points.length - 1].x;
  const futureX = lastX + (daysAhead * 24);
  const forecast = slope * futureX + intercept;

  return {
    slope, // views per hour
    intercept,
    forecastAt7Days: Math.max(0, Math.round(forecast))
  };
}

module.exports = { forecastViews };
