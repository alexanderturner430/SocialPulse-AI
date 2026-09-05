const api = require("./api");
const { analyzeSentiment } = require("./sentiment");

async function fetchAndAnalyzeComments(videoId, db) {
  const insertCommentStmt = db.prepare(
    "INSERT OR IGNORE INTO comments (video_id, comment_id, text, sentiment_score) VALUES (?, ?, ?, ?)"
  );
  const getCommentsStmt = db.prepare("SELECT text, sentiment_score FROM comments WHERE video_id = ?");

  if (!api.isEnabled()) throw new Error("API key not configured.");
  
  const comments = await api.videoComments(videoId);
  
  comments.forEach(comment => {
    const sentiment = analyzeSentiment(comment.text);
    insertCommentStmt.run(videoId, comment.id, comment.text, sentiment);
  });
  
  return getCommentsStmt.all(videoId);
}

module.exports = { fetchAndAnalyzeComments };
