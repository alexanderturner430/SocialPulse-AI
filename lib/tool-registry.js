const tfText = require("./tf-text");
const tfImage = require("./tf-image");
const tfMl = require("./tf-ml");
const tfYoutube = require("./tf-youtube");
const tfInstagram = require("./tf-instagram");
const tfTiktok = require("./tf-tiktok");
const tfTwitter = require("./tf-twitter");
const tfFacebook = require("./tf-facebook");
const tfDiscord = require("./tf-discord");
const tfTwitch = require("./tf-twitch");
const tfReddit = require("./tf-reddit");
const tfLinkedin = require("./tf-linkedin");
const tfThreads = require("./tf-threads");
const tfBluesky = require("./tf-bluesky");
const tfMastodon = require("./tf-mastodon");
const tfGithub = require("./tf-github");
const tfSpotify = require("./tf-spotify");
const tfPinterest = require("./tf-pinterest");

const toolRegistry = {
  // === TF.js CORE ===
  "analyze-image": async (args) => await tfImage.classifyImage(args.imageUrl),
  "detect-objects": async (args) => await tfImage.detectObjects(args.imageUrl),
  "detect-faces": async (args) => await tfImage.detectFaces(args.imageUrl),
  "classify-image": async (args) => await tfImage.classifyImage(args.imageUrl, args.labels),
  "analyze-text": async (args) => await tfText.classifyText(args.text),
  "extract-keywords": async (args) => await tfText.extractKeywordsML(args.text, args.numKeywords),
  "detect-sentiment": async (args) => await tfText.analyzeSentimentML(args.text),
  "detect-toxicity": async (args) => await tfText.detectToxicity(args.text),
  "embed-text": async (args) => await tfText.embedText(args.text),
  "answer-question": async (args) => await tfText.answerQuestion(args.question, args.context),
  "predict-trend": async (args) => await tfMl.detectTrends(args.dataPoints),
  "forecast-data": async (args) => await tfMl.forecastTimeSeries(args.dataPoints, args.periods),
  "detect-anomalies": async (args) => await tfMl.detectAnomalies(args.dataPoints),
  "cluster-data": async (args) => await tfMl.clusterData(args.dataPoints, args.k),
  "reduce-dimensions": async (args) => await tfMl.reduceDimensions(args.dataPoints, args.dimensions),
  "regression": async (args) => {
    const data = args.dataPoints;
    if (Array.isArray(data[0])) {
      return await tfMl.regressionAnalysis(data.map(p => p[0]), data.map(p => p[1]));
    }
    return await tfMl.regressionAnalysis(data.map((_, i) => i), data);
  },
  "train-model": async (args) => await tfMl.predictEngagement(args.features),
  "ab-test": async (args) => tfMl.analyzeABTest(args.groupA, args.groupB),

  // === TF.js YOUTUBE ===
  "analyze-youtube-thumbnails": async (args) => await tfYoutube.analyzeChannelThumbnails(args.imageUrls),
  "classify-youtube-content": async (args) => await tfYoutube.classifyVideoContent(args.texts),
  "predict-youtube-views": async (args) => await tfYoutube.predictVideoViews(args),
  "youtube-comment-sentiment": async (args) => await tfYoutube.analyzeCommentSentiment(args.texts),
  "youtube-channel-keywords": async (args) => await tfYoutube.extractChannelKeywords(args.texts),
  "youtube-trend-detection": async (args) => await tfYoutube.detectChannelTrends(args.dataPoints),
  "youtube-forecast": async (args) => await tfYoutube.forecastChannelGrowth(args.dataPoints),
  "youtube-anomaly-detection": async (args) => await tfYoutube.detectViewAnomalies(args.dataPoints),
  "youtube-thumbnail-comparison": async (args) => await tfYoutube.compareVideoThumbnails(args.imageUrl1, args.imageUrl2),
  "youtube-topic-clustering": async (args) => await tfYoutube.clusterVideoTopics(args.texts),

  // === TF.js INSTAGRAM ===
  "analyze-instagram-images": async (args) => await tfInstagram.analyzePostImages(args.imageUrls),
  "predict-instagram-engagement": async (args) => await tfInstagram.predictPostEngagement(args),
  "classify-instagram-content": async (args) => await tfInstagram.classifyPostContent(args.text),
  "instagram-caption-sentiment": async (args) => await tfInstagram.analyzeCaptionSentiment(args.text),
  "instagram-hashtag-extraction": async (args) => await tfInstagram.extractHashtags(args.texts),
  "instagram-visual-trends": async (args) => await tfInstagram.detectVisualTrends(args.imageUrls),
  "instagram-follower-forecast": async (args) => await tfInstagram.forecastFollowerGrowth(args.dataPoints),
  "instagram-anomaly-detection": async (args) => await tfInstagram.detectEngagementAnomalies(args.dataPoints),
  "instagram-post-comparison": async (args) => await tfInstagram.comparePostVisuals(args.imageUrl1, args.imageUrl2),
  "instagram-content-clustering": async (args) => await tfInstagram.clusterContentThemes(args.texts),

  // === TF.js TIKTOK ===
  "analyze-tiktok-thumbnails": async (args) => await tfTiktok.analyzeVideoThumbnails(args.imageUrls),
  "predict-tiktok-virality": async (args) => await tfTiktok.predictVirality(args),
  "classify-tiktok-content": async (args) => await tfTiktok.classifyVideoContent(args.texts),
  "tiktok-content-sentiment": async (args) => await tfTiktok.analyzeContentSentiment(args.texts),
  "tiktok-trending-topics": async (args) => await tfTiktok.extractTrendingTopics(args.texts),
  "tiktok-view-patterns": async (args) => await tfTiktok.detectViewPatterns(args.dataPoints),
  "tiktok-follower-forecast": async (args) => await tfTiktok.forecastFollowerGrowth(args.dataPoints),
  "tiktok-anomaly-detection": async (args) => await tfTiktok.detectEngagementAnomalies(args.dataPoints),
  "tiktok-thumbnail-comparison": async (args) => await tfTiktok.compareVideoThumbnails(args.imageUrl1, args.imageUrl2),
  "tiktok-content-clustering": async (args) => await tfTiktok.clusterVideoContent(args.texts),

  // === TF.js TWITTER ===
  "twitter-content-keywords": async (args) => await tfTwitter.analyzeTweetContent(args.texts),
  "predict-twitter-engagement": async (args) => await tfTwitter.predictTweetEngagement(args),
  "classify-twitter-topics": async (args) => await tfTwitter.classifyTweetTopics(args.texts),
  "twitter-toxicity-detection": async (args) => await tfTwitter.detectTweetToxicity(args.texts),
  "twitter-sentiment-analysis": async (args) => await tfTwitter.analyzeTweetSentiment(args.texts),
  "twitter-keyword-extraction": async (args) => await tfTwitter.extractTweetKeywords(args.texts),
  "twitter-follower-forecast": async (args) => await tfTwitter.forecastFollowerGrowth(args.dataPoints),
  "twitter-anomaly-detection": async (args) => await tfTwitter.detectEngagementAnomalies(args.dataPoints),
  "twitter-tweet-comparison": async (args) => await tfTwitter.compareTweetSimilarity(args.text1, args.text2),
  "twitter-topic-clustering": async (args) => await tfTwitter.clusterTweetTopics(args.texts),

  // === TF.js FACEBOOK ===
  "analyze-facebook-content": async (args) => await tfFacebook.analyzePostContent(args.message, args.imageUrl),
  "predict-facebook-engagement": async (args) => await tfFacebook.predictPostEngagement(args),
  "classify-facebook-topics": async (args) => await tfFacebook.classifyPostTopics(args.texts),
  "facebook-comment-sentiment": async (args) => await tfFacebook.analyzeCommentSentiment(args.text),
  "facebook-post-keywords": async (args) => await tfFacebook.extractPostKeywords(args.texts),
  "facebook-posting-trends": async (args) => await tfFacebook.detectPostingTrends(args.dataPoints),
  "facebook-growth-forecast": async (args) => await tfFacebook.forecastPageGrowth(args.dataPoints),
  "facebook-anomaly-detection": async (args) => await tfFacebook.detectEngagementAnomalies(args.dataPoints),
  "facebook-visual-comparison": async (args) => await tfFacebook.comparePostVisuals(args.imageUrl1, args.imageUrl2),
  "facebook-content-clustering": async (args) => await tfFacebook.clusterPostContent(args.texts),

  // === TF.js DISCORD ===
  "discord-sentiment-analysis": async (args) => await tfDiscord.analyzeMessageSentiment(args.texts),
  "discord-toxicity-detection": async (args) => await tfDiscord.detectToxicity(args.texts),
  "predict-discord-engagement": async (args) => await tfDiscord.predictEngagement(args),
  "classify-discord-topics": async (args) => await tfDiscord.classifyTopics(args.texts),
  "discord-keyword-extraction": async (args) => await tfDiscord.extractKeywords(args.texts),
  "discord-activity-patterns": async (args) => await tfDiscord.detectActivityPatterns(args.dataPoints),
  "discord-growth-forecast": async (args) => await tfDiscord.forecastGrowth(args.dataPoints),
  "discord-anomaly-detection": async (args) => await tfDiscord.detectAnomalies(args.dataPoints),
  "discord-channel-comparison": async (args) => await tfDiscord.compareChannels(args.texts1, args.texts2),
  "discord-member-clustering": async (args) => await tfDiscord.clusterMembers(args),

  // === TF.js TWITCH ===
  "analyze-twitch-content": async (args) => await tfTwitch.analyzeStreamContent(args.texts),
  "predict-twitch-viewers": async (args) => await tfTwitch.predictViewerCount(args),
  "classify-twitch-games": async (args) => await tfTwitch.classifyGameContent(args.texts),
  "twitch-chat-sentiment": async (args) => await tfTwitch.analyzeChatSentiment(args.texts),
  "twitch-keyword-extraction": async (args) => await tfTwitch.extractKeywords(args.texts),
  "twitch-viewer-trends": async (args) => await tfTwitch.detectViewerTrends(args.dataPoints),
  "twitch-growth-forecast": async (args) => await tfTwitch.forecastGrowth(args.dataPoints),
  "twitch-anomaly-detection": async (args) => await tfTwitch.detectAnomalies(args.dataPoints),
  "twitch-clip-comparison": async (args) => await tfTwitch.compareClips(args.text1, args.text2),
  "twitch-stream-clustering": async (args) => await tfTwitch.clusterStreams(args.texts),

  // === TF.js REDDIT ===
  "reddit-sentiment-analysis": async (args) => await tfReddit.analyzePostSentiment(args.texts),
  "reddit-toxicity-detection": async (args) => await tfReddit.detectToxicity(args.texts),
  "predict-reddit-engagement": async (args) => await tfReddit.predictEngagement(args),
  "classify-reddit-topics": async (args) => await tfReddit.classifyTopics(args.texts),
  "reddit-keyword-extraction": async (args) => await tfReddit.extractKeywords(args.texts),
  "reddit-trend-detection": async (args) => await tfReddit.detectTrends(args.dataPoints),
  "reddit-growth-forecast": async (args) => await tfReddit.forecastGrowth(args.dataPoints),
  "reddit-anomaly-detection": async (args) => await tfReddit.detectAnomalies(args.dataPoints),
  "reddit-post-comparison": async (args) => await tfReddit.comparePosts(args.text1, args.text2),
  "reddit-community-clustering": async (args) => await tfReddit.clusterCommunity(args.texts),

  // === TF.js LINKEDIN ===
  "linkedin-sentiment-analysis": async (args) => await tfLinkedin.analyzePostSentiment(args.texts),
  "predict-linkedin-engagement": async (args) => await tfLinkedin.predictEngagement(args),
  "classify-linkedin-topics": async (args) => await tfLinkedin.classifyTopics(args.texts),
  "linkedin-keyword-extraction": async (args) => await tfLinkedin.extractKeywords(args.texts),
  "linkedin-trend-detection": async (args) => await tfLinkedin.detectTrends(args.dataPoints),
  "linkedin-growth-forecast": async (args) => await tfLinkedin.forecastGrowth(args.dataPoints),
  "linkedin-anomaly-detection": async (args) => await tfLinkedin.detectAnomalies(args.dataPoints),
  "linkedin-post-comparison": async (args) => await tfLinkedin.comparePosts(args.text1, args.text2),
  "linkedin-content-clustering": async (args) => await tfLinkedin.clusterContent(args.texts),
  "linkedin-audience-segmentation": async (args) => await tfLinkedin.analyzeAudience(args),

  // === TF.js THREADS ===
  "threads-sentiment-analysis": async (args) => await tfThreads.analyzePostSentiment(args.texts),
  "threads-toxicity-detection": async (args) => await tfThreads.detectToxicity(args.texts),
  "predict-threads-engagement": async (args) => await tfThreads.predictEngagement(args),
  "classify-threads-topics": async (args) => await tfThreads.classifyTopics(args.texts),
  "threads-keyword-extraction": async (args) => await tfThreads.extractKeywords(args.texts),
  "threads-trend-detection": async (args) => await tfThreads.detectTrends(args.dataPoints),
  "threads-growth-forecast": async (args) => await tfThreads.forecastGrowth(args.dataPoints),
  "threads-anomaly-detection": async (args) => await tfThreads.detectAnomalies(args.dataPoints),
  "threads-post-comparison": async (args) => await tfThreads.comparePosts(args.text1, args.text2),
  "threads-content-clustering": async (args) => await tfThreads.clusterContent(args.texts),

  // === TF.js BLUESKY ===
  "bluesky-sentiment-analysis": async (args) => await tfBluesky.analyzePostSentiment(args.texts),
  "bluesky-toxicity-detection": async (args) => await tfBluesky.detectToxicity(args.texts),
  "predict-bluesky-engagement": async (args) => await tfBluesky.predictEngagement(args),
  "classify-bluesky-topics": async (args) => await tfBluesky.classifyTopics(args.texts),
  "bluesky-keyword-extraction": async (args) => await tfBluesky.extractKeywords(args.texts),
  "bluesky-trend-detection": async (args) => await tfBluesky.detectTrends(args.dataPoints),
  "bluesky-growth-forecast": async (args) => await tfBluesky.forecastGrowth(args.dataPoints),
  "bluesky-anomaly-detection": async (args) => await tfBluesky.detectAnomalies(args.dataPoints),
  "bluesky-post-comparison": async (args) => await tfBluesky.comparePosts(args.text1, args.text2),
  "bluesky-content-clustering": async (args) => await tfBluesky.clusterContent(args.texts),

  // === TF.js MASTODON ===
  "mastodon-sentiment-analysis": async (args) => await tfMastodon.analyzeStatusSentiment(args.texts),
  "mastodon-toxicity-detection": async (args) => await tfMastodon.detectToxicity(args.texts),
  "predict-mastodon-engagement": async (args) => await tfMastodon.predictEngagement(args),
  "classify-mastodon-topics": async (args) => await tfMastodon.classifyTopics(args.texts),
  "mastodon-keyword-extraction": async (args) => await tfMastodon.extractKeywords(args.texts),
  "mastodon-trend-detection": async (args) => await tfMastodon.detectTrends(args.dataPoints),
  "mastodon-growth-forecast": async (args) => await tfMastodon.forecastGrowth(args.dataPoints),
  "mastodon-anomaly-detection": async (args) => await tfMastodon.detectAnomalies(args.dataPoints),
  "mastodon-status-comparison": async (args) => await tfMastodon.compareStatuses(args.text1, args.text2),
  "mastodon-content-clustering": async (args) => await tfMastodon.clusterContent(args.texts),

  // === TF.js GITHUB ===
  "github-issue-sentiment": async (args) => await tfGithub.analyzeIssueSentiment(args.texts),
  "classify-github-issues": async (args) => await tfGithub.classifyIssueTopics(args.texts),
  "github-keyword-extraction": async (args) => await tfGithub.extractKeywords(args.texts),
  "github-trend-detection": async (args) => await tfGithub.detectTrends(args.dataPoints),
  "github-growth-forecast": async (args) => await tfGithub.forecastGrowth(args.dataPoints),
  "github-anomaly-detection": async (args) => await tfGithub.detectAnomalies(args.dataPoints),
  "github-repo-comparison": async (args) => await tfGithub.compareRepos(args.texts1, args.texts2),
  "github-issue-clustering": async (args) => await tfGithub.clusterIssues(args.texts),
  "predict-github-issue-engagement": async (args) => await tfGithub.predictIssueEngagement(args),
  "github-contributor-patterns": async (args) => await tfGithub.analyzeContributorPatterns(args),

  // === TF.js SPOTIFY ===
  "spotify-track-sentiment": async (args) => await tfSpotify.analyzeTrackSentiment(args),
  "spotify-genre-classification": async (args) => await tfSpotify.classifyGenre(args),
  "predict-spotify-popularity": async (args) => await tfSpotify.predictPopularity(args),
  "spotify-audio-keywords": async (args) => await tfSpotify.extractAudioKeywords(args),
  "spotify-trend-detection": async (args) => await tfSpotify.detectTrends(args.dataPoints),
  "spotify-growth-forecast": async (args) => await tfSpotify.forecastGrowth(args.dataPoints),
  "spotify-anomaly-detection": async (args) => await tfSpotify.detectAnomalies(args.dataPoints),
  "spotify-track-comparison": async (args) => await tfSpotify.compareTracks(args.track1, args.track2),
  "spotify-playlist-clustering": async (args) => await tfSpotify.clusterPlaylist(args.tracks),
  "spotify-audio-analysis": async (args) => await tfSpotify.analyzeAudioFeatures(args),

  // === TF.js PINTEREST ===
  "analyze-pinterest-images": async (args) => await tfPinterest.analyzePinImages(args.imageUrls),
  "predict-pinterest-engagement": async (args) => await tfPinterest.predictEngagement(args),
  "classify-pinterest-content": async (args) => await tfPinterest.classifyContent(args.text),
  "pinterest-keyword-extraction": async (args) => await tfPinterest.extractKeywords(args.texts),
  "pinterest-trend-detection": async (args) => await tfPinterest.detectTrends(args.dataPoints),
  "pinterest-growth-forecast": async (args) => await tfPinterest.forecastGrowth(args.dataPoints),
  "pinterest-anomaly-detection": async (args) => await tfPinterest.detectAnomalies(args.dataPoints),
  "pinterest-pin-comparison": async (args) => await tfPinterest.comparePins(args.text1, args.text2),
  "pinterest-board-clustering": async (args) => await tfPinterest.clusterBoards(args.boards),
  "pinterest-audience-analysis": async (args) => await tfPinterest.analyzeAudience(args),
};

module.exports = toolRegistry;
