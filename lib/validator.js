const { z } = require("zod");

// Helper schemas
const textsSchema = z.object({ texts: z.array(z.string()) });
const dataPointsSchema = z.object({ dataPoints: z.array(z.number()) });
const textSchema = z.object({ text: z.string() });
const imageUrlsSchema = z.object({ imageUrls: z.array(z.string().url()) });

const schemas = {
  // === TF.js Core: Image ===
  "analyze-image": z.object({ imageUrl: z.string().url() }),
  "detect-objects": z.object({ imageUrl: z.string().url() }),
  "detect-faces": z.object({ imageUrl: z.string().url() }),
  "classify-image": z.object({ imageUrl: z.string().url(), labels: z.array(z.string()) }),

  // === TF.js Core: Text ===
  "analyze-text": textSchema,
  "extract-keywords": z.object({ text: z.string(), numKeywords: z.number().optional() }),
  "detect-sentiment": textSchema,
  "detect-toxicity": textSchema,
  "embed-text": textSchema,
  "answer-question": z.object({ question: z.string(), context: z.string() }),

  // === TF.js Core: ML ===
  "predict-trend": dataPointsSchema,
  "forecast-data": z.object({ dataPoints: z.array(z.number()), periods: z.number() }),
  "detect-anomalies": dataPointsSchema,
  "cluster-data": z.object({ dataPoints: z.array(z.array(z.number())), k: z.number() }),
  "reduce-dimensions": z.object({ dataPoints: z.array(z.array(z.number())), dimensions: z.number() }),
  "regression": z.object({ dataPoints: z.array(z.array(z.number())) }),
  "train-model": z.object({ features: z.array(z.array(z.number())), labels: z.array(z.number()), epochs: z.number() }),
  "ab-test": z.object({ groupA: z.array(z.number()), groupB: z.array(z.number()) }),

  // === TF.js YouTube ===
  "analyze-youtube-thumbnails": imageUrlsSchema,
  "classify-youtube-content": textsSchema,
  "predict-youtube-views": z.object({ titleLen: z.number(), descLen: z.number(), hasNumbers: z.boolean(), hasEmoji: z.boolean(), wordCount: z.number(), likes: z.number(), comments: z.number() }),
  "youtube-comment-sentiment": textsSchema,
  "youtube-channel-keywords": textsSchema,
  "youtube-trend-detection": dataPointsSchema,
  "youtube-forecast": dataPointsSchema,
  "youtube-anomaly-detection": dataPointsSchema,
  "youtube-thumbnail-comparison": z.object({ imageUrl1: z.string().url(), imageUrl2: z.string().url() }),
  "youtube-topic-clustering": textsSchema,

  // === TF.js Instagram ===
  "analyze-instagram-images": imageUrlsSchema,
  "predict-instagram-engagement": z.object({ captionLen: z.number(), hashtagCount: z.number(), emojiCount: z.number(), likes: z.number(), comments: z.number(), shares: z.number() }),
  "classify-instagram-content": textSchema,
  "instagram-caption-sentiment": textSchema,
  "instagram-hashtag-extraction": textsSchema,
  "instagram-visual-trends": imageUrlsSchema,
  "instagram-follower-forecast": dataPointsSchema,
  "instagram-anomaly-detection": dataPointsSchema,
  "instagram-post-comparison": z.object({ imageUrl1: z.string().url(), imageUrl2: z.string().url() }),
  "instagram-content-clustering": textsSchema,

  // === TF.js TikTok ===
  "analyze-tiktok-thumbnails": imageUrlsSchema,
  "predict-tiktok-virality": z.object({ titleLen: z.number(), descLen: z.number(), duration: z.number(), hashtagCount: z.number(), emojiCount: z.number(), views: z.number(), likes: z.number(), comments: z.number(), shares: z.number() }),
  "classify-tiktok-content": textsSchema,
  "tiktok-content-sentiment": textsSchema,
  "tiktok-trending-topics": textsSchema,
  "tiktok-view-patterns": dataPointsSchema,
  "tiktok-follower-forecast": dataPointsSchema,
  "tiktok-anomaly-detection": dataPointsSchema,
  "tiktok-thumbnail-comparison": z.object({ imageUrl1: z.string().url(), imageUrl2: z.string().url() }),
  "tiktok-content-clustering": textsSchema,

  // === TF.js Twitter ===
  "twitter-content-keywords": textsSchema,
  "predict-twitter-engagement": z.object({ textLen: z.number(), hashtagCount: z.number(), mentionCount: z.number(), linkCount: z.number(), questionCount: z.number(), exclamationCount: z.number(), likes: z.number(), retweets: z.number(), replies: z.number() }),
  "classify-twitter-topics": textsSchema,
  "twitter-toxicity-detection": textsSchema,
  "twitter-sentiment-analysis": textsSchema,
  "twitter-keyword-extraction": textsSchema,
  "twitter-follower-forecast": dataPointsSchema,
  "twitter-anomaly-detection": dataPointsSchema,
  "twitter-tweet-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "twitter-topic-clustering": textsSchema,

  // === TF.js Facebook ===
  "analyze-facebook-content": z.object({ message: z.string(), imageUrl: z.string().url().optional() }),
  "predict-facebook-engagement": z.object({ messageLen: z.number(), hashtagCount: z.number(), emojiCount: z.number(), linkCount: z.number(), wordCount: z.number(), impressions: z.number() }),
  "classify-facebook-topics": textsSchema,
  "facebook-comment-sentiment": textSchema,
  "facebook-post-keywords": textsSchema,
  "facebook-posting-trends": dataPointsSchema,
  "facebook-growth-forecast": dataPointsSchema,
  "facebook-anomaly-detection": dataPointsSchema,
  "facebook-visual-comparison": z.object({ imageUrl1: z.string().url(), imageUrl2: z.string().url() }),
  "facebook-content-clustering": textsSchema,

  // === TF.js Discord ===
  "discord-sentiment-analysis": textsSchema,
  "discord-toxicity-detection": textsSchema,
  "predict-discord-engagement": z.object({ messageLen: z.number(), emojiCount: z.number(), mentionCount: z.number(), reactionCount: z.number(), replyCount: z.number() }),
  "classify-discord-topics": textsSchema,
  "discord-keyword-extraction": textsSchema,
  "discord-activity-patterns": dataPointsSchema,
  "discord-growth-forecast": dataPointsSchema,
  "discord-anomaly-detection": dataPointsSchema,
  "discord-channel-comparison": z.object({ texts1: z.array(z.string()), texts2: z.array(z.string()) }),
  "discord-member-clustering": z.object({ data: z.array(z.object({ messageCount: z.number(), reactionCount: z.number(), activeDays: z.number() })) }),

  // === TF.js Twitch ===
  "analyze-twitch-content": textsSchema,
  "predict-twitch-viewers": z.object({ titleLen: z.number(), gamePopularity: z.number(), durationMinutes: z.number(), followerCount: z.number() }),
  "classify-twitch-games": textsSchema,
  "twitch-chat-sentiment": textsSchema,
  "twitch-keyword-extraction": textsSchema,
  "twitch-viewer-trends": dataPointsSchema,
  "twitch-growth-forecast": dataPointsSchema,
  "twitch-anomaly-detection": dataPointsSchema,
  "twitch-clip-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "twitch-stream-clustering": textsSchema,

  // === TF.js Reddit ===
  "reddit-sentiment-analysis": textsSchema,
  "reddit-toxicity-detection": textsSchema,
  "predict-reddit-engagement": z.object({ titleLen: z.number(), bodyLen: z.number(), upvoteRatio: z.number(), commentCount: z.number(), awards: z.number() }),
  "classify-reddit-topics": textsSchema,
  "reddit-keyword-extraction": textsSchema,
  "reddit-trend-detection": dataPointsSchema,
  "reddit-growth-forecast": dataPointsSchema,
  "reddit-anomaly-detection": dataPointsSchema,
  "reddit-post-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "reddit-community-clustering": textsSchema,

  // === TF.js LinkedIn ===
  "linkedin-sentiment-analysis": textsSchema,
  "predict-linkedin-engagement": z.object({ textLen: z.number(), hashtagCount: z.number(), linkCount: z.number(), imageCount: z.number(), commentCount: z.number(), likeCount: z.number() }),
  "classify-linkedin-topics": textsSchema,
  "linkedin-keyword-extraction": textsSchema,
  "linkedin-trend-detection": dataPointsSchema,
  "linkedin-growth-forecast": dataPointsSchema,
  "linkedin-anomaly-detection": dataPointsSchema,
  "linkedin-post-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "linkedin-content-clustering": textsSchema,
  "linkedin-audience-segmentation": z.object({ data: z.array(z.object({ industry: z.string(), seniority: z.string(), companySize: z.string() })) }),

  // === TF.js Threads ===
  "threads-sentiment-analysis": textsSchema,
  "threads-toxicity-detection": textsSchema,
  "predict-threads-engagement": z.object({ textLen: z.number(), emojiCount: z.number(), likeCount: z.number(), replyCount: z.number() }),
  "classify-threads-topics": textsSchema,
  "threads-keyword-extraction": textsSchema,
  "threads-trend-detection": dataPointsSchema,
  "threads-growth-forecast": dataPointsSchema,
  "threads-anomaly-detection": dataPointsSchema,
  "threads-post-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "threads-content-clustering": textsSchema,

  // === TF.js Bluesky ===
  "bluesky-sentiment-analysis": textsSchema,
  "bluesky-toxicity-detection": textsSchema,
  "predict-bluesky-engagement": z.object({ textLen: z.number(), wordCount: z.number(), likeCount: z.number(), repostCount: z.number(), replyCount: z.number() }),
  "classify-bluesky-topics": textsSchema,
  "bluesky-keyword-extraction": textsSchema,
  "bluesky-trend-detection": dataPointsSchema,
  "bluesky-growth-forecast": dataPointsSchema,
  "bluesky-anomaly-detection": dataPointsSchema,
  "bluesky-post-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "bluesky-content-clustering": textsSchema,

  // === TF.js Mastodon ===
  "mastodon-sentiment-analysis": textsSchema,
  "mastodon-toxicity-detection": textsSchema,
  "predict-mastodon-engagement": z.object({ textLen: z.number(), boostCount: z.number(), favouriteCount: z.number(), replyCount: z.number() }),
  "classify-mastodon-topics": textsSchema,
  "mastodon-keyword-extraction": textsSchema,
  "mastodon-trend-detection": dataPointsSchema,
  "mastodon-growth-forecast": dataPointsSchema,
  "mastodon-anomaly-detection": dataPointsSchema,
  "mastodon-status-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "mastodon-content-clustering": textsSchema,

  // === TF.js GitHub ===
  "github-issue-sentiment": textsSchema,
  "classify-github-issues": textsSchema,
  "github-keyword-extraction": textsSchema,
  "github-trend-detection": dataPointsSchema,
  "github-growth-forecast": dataPointsSchema,
  "github-anomaly-detection": dataPointsSchema,
  "github-repo-comparison": z.object({ texts1: z.array(z.string()), texts2: z.array(z.string()) }),
  "github-issue-clustering": textsSchema,
  "predict-github-issue-engagement": z.object({ titleLen: z.number(), bodyLen: z.number(), labelCount: z.number(), commentCount: z.number() }),
  "github-contributor-patterns": z.object({ data: z.array(z.object({ commits: z.number(), additions: z.number(), deletions: z.number(), activeDays: z.number() })) }),

  // === TF.js Spotify ===
  "spotify-track-sentiment": z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number(), durationMs: z.number() }),
  "spotify-genre-classification": z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() }),
  "predict-spotify-popularity": z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() }),
  "spotify-audio-keywords": z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() }),
  "spotify-trend-detection": dataPointsSchema,
  "spotify-growth-forecast": dataPointsSchema,
  "spotify-anomaly-detection": dataPointsSchema,
  "spotify-track-comparison": z.object({ track1: z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() }), track2: z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() }) }),
  "spotify-playlist-clustering": z.object({ tracks: z.array(z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() })) }),
  "spotify-audio-analysis": z.object({ danceability: z.number(), energy: z.number(), valence: z.number(), tempo: z.number(), loudness: z.number(), speechiness: z.number(), acousticness: z.number(), instrumentalness: z.number(), liveness: z.number() }),

  // === TF.js Pinterest ===
  "analyze-pinterest-images": imageUrlsSchema,
  "predict-pinterest-engagement": z.object({ titleLen: z.number(), descLen: z.number(), linkCount: z.number(), boardFollowers: z.number() }),
  "classify-pinterest-content": textSchema,
  "pinterest-keyword-extraction": textsSchema,
  "pinterest-trend-detection": dataPointsSchema,
  "pinterest-growth-forecast": dataPointsSchema,
  "pinterest-anomaly-detection": dataPointsSchema,
  "pinterest-pin-comparison": z.object({ text1: z.string(), text2: z.string() }),
  "pinterest-board-clustering": z.object({ boards: z.array(z.object({ pinCount: z.number(), followerCount: z.number(), category: z.string() })) }),
  "pinterest-audience-analysis": z.object({ data: z.array(z.object({ ageRange: z.string(), gender: z.string(), location: z.string(), interests: z.array(z.string()) })) }),
};

function validateToolInput(toolName, args) {
  const schema = schemas[toolName];
  if (!schema) return { success: true, data: args };
  
  const result = schema.safeParse(args);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') 
    };
  }
  return { success: true, data: result.data };
}

module.exports = { validateToolInput };
