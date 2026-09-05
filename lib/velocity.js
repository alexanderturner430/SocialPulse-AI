/**
 * View velocity tracking logic
 */

function trackVelocity(videoId, stats, history) {
  const now = Date.now();
  const snapshot = {
    timestamp: now,
    views: parseInt(stats.viewCount, 10)
  };

  if (!history[videoId]) {
    history[videoId] = [];
  }
  
  history[videoId].push(snapshot);
  
  // Keep last 10 snapshots
  if (history[videoId].length > 10) {
    history[videoId].shift();
  }

  // Calculate velocity: (newest - oldest) / (time_delta_hours)
  if (history[videoId].length < 2) return 0;
  
  const oldest = history[videoId][0];
  const newest = history[videoId][history[videoId].length - 1];
  
  const timeDeltaHours = (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60);
  if (timeDeltaHours === 0) return 0;
  
  return (newest.views - oldest.views) / timeDeltaHours;
}

module.exports = { trackVelocity };
