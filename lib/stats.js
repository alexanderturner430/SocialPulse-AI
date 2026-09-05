function recordStats(videoId, viewCount, db) {
  const recordStmt = db.prepare("INSERT INTO video_stats (video_id, timestamp, view_count) VALUES (?, ?, ?)");
  recordStmt.run(videoId, Date.now(), viewCount);
}

function getStatsHistory(videoId, db) {
  const getHistoryStmt = db.prepare("SELECT timestamp, view_count FROM video_stats WHERE video_id = ? ORDER BY timestamp ASC");
  return getHistoryStmt.all(videoId);
}

module.exports = { recordStats, getStatsHistory };
