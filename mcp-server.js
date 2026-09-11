#!/usr/bin/env node
// Polyfill util.isNullOrUndefined removed in Node v24 (needed by tfjs-node)
const nodeUtil = require("node:util");
if (typeof nodeUtil.isNullOrUndefined !== "function") {
  nodeUtil.isNullOrUndefined = (val) => val === null || val === undefined;
}

require("dotenv").config();
const express = require("express");
const { randomUUID } = require("node:crypto");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");

const tfText = require("./lib/tf-text");
const tfImage = require("./lib/tf-image");
const tfMl = require("./lib/tf-ml");
const tfYoutube = require("./lib/tf-youtube");
const tfInstagram = require("./lib/tf-instagram");
const tfTiktok = require("./lib/tf-tiktok");
const tfTwitter = require("./lib/tf-twitter");
const tfFacebook = require("./lib/tf-facebook");
const tfDiscord = require("./lib/tf-discord");
const tfTwitch = require("./lib/tf-twitch");
const tfReddit = require("./lib/tf-reddit");
const tfLinkedin = require("./lib/tf-linkedin");
const tfThreads = require("./lib/tf-threads");
const tfBluesky = require("./lib/tf-bluesky");
const tfMastodon = require("./lib/tf-mastodon");
const tfGithub = require("./lib/tf-github");
const tfSpotify = require("./lib/tf-spotify");
const tfPinterest = require("./lib/tf-pinterest");
const x402 = require("./lib/x402");
const monitor = require("./lib/monitor");
const toolRegistry = require("./lib/tool-registry");

const app = express();

// Each MCP transport connection gets its own Server instance. The MCP SDK
// Protocol allows only a single connect() per Server, so a shared instance
// would reject every client after the first (HTTP 500 "Already connected").
function createMcpServer() {
  const s = new Server(
    { name: "tensorflow-social-mcp", version: "2.0.0" },
    { capabilities: { tools: {} } }
  );
  s.setRequestHandler(ListToolsRequestSchema, handleListTools);
  s.setRequestHandler(CallToolRequestSchema, handleCallTool);
  return s;
}

const toolDefinitions = require("./lib/tool-definitions");

let x402State;
try {
  x402State = x402.init(toolDefinitions);
  monitor.init();
} catch (err) {
  console.error("x402/init initialization failed:", err.message);
  console.error("MCP tool calls will require a PAY_TO_ADDRESS to be set.");
  process.exit(1);
}

async function handleListTools() {
  return { tools: toolDefinitions };
}

async function dispatchLegacyTool(name, args) {
  switch (name) {
    // === TF.js Core: Image ===
    case "analyze-image":
      return { content: [{ type: "text", text: JSON.stringify(await tfImage.classifyImage(args.imageUrl), null, 2) }] };
    case "detect-objects":
      return { content: [{ type: "text", text: JSON.stringify(await tfImage.detectObjects(args.imageUrl), null, 2) }] };
    case "detect-faces":
      return { content: [{ type: "text", text: JSON.stringify(await tfImage.detectFaces(args.imageUrl), null, 2) }] };
    case "classify-image":
      return { content: [{ type: "text", text: JSON.stringify(await tfImage.classifyImage(args.imageUrl), null, 2) }] };

    // === TF.js Core: Text ===
    case "analyze-text":
      return { content: [{ type: "text", text: JSON.stringify(await tfText.analyzeText(args.text), null, 2) }] };
    case "extract-keywords":
      return { content: [{ type: "text", text: JSON.stringify(await tfText.extractKeywords(args.text, args.numKeywords), null, 2) }] };
    case "detect-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfText.analyzeSentiment(args.text), null, 2) }] };
    case "detect-toxicity":
      return { content: [{ type: "text", text: JSON.stringify(await tfText.detectToxicity(args.text), null, 2) }] };
    case "embed-text":
      return { content: [{ type: "text", text: JSON.stringify(await tfText.embedText(args.text), null, 2) }] };
    case "answer-question":
      return { content: [{ type: "text", text: JSON.stringify(await tfText.answerQuestion(args.question, args.context), null, 2) }] };

    // === TF.js Core: ML ===
    case "predict-trend":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.predictTrend(args.dataPoints), null, 2) }] };
    case "forecast-data":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.forecastTimeSeries(args.dataPoints, args.periods), null, 2) }] };
    case "detect-anomalies":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.detectAnomalies(args.dataPoints), null, 2) }] };
    case "cluster-data":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.clusterData(args.dataPoints, args.k), null, 2) }] };
    case "reduce-dimensions":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.reduceDimensions(args.dataPoints, args.dimensions), null, 2) }] };
    case "regression":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.regression(args.dataPoints), null, 2) }] };
    case "train-model":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.trainModel(args.features, args.labels, args.epochs), null, 2) }] };
    case "ab-test":
      return { content: [{ type: "text", text: JSON.stringify(await tfMl.abTest(args.groupA, args.groupB), null, 2) }] };

    // === TF.js YouTube ===
    case "analyze-youtube-thumbnails":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.analyzeChannelThumbnails(args.imageUrls), null, 2) }] };
    case "classify-youtube-content":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.classifyVideoContent(args.texts), null, 2) }] };
    case "predict-youtube-views":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.predictVideoViews(args), null, 2) }] };
    case "youtube-comment-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.analyzeCommentSentiment(args.texts), null, 2) }] };
    case "youtube-channel-keywords":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.extractChannelKeywords(args.texts), null, 2) }] };
    case "youtube-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.detectChannelTrends(args.dataPoints), null, 2) }] };
    case "youtube-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.forecastChannelGrowth(args.dataPoints), null, 2) }] };
    case "youtube-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.detectViewAnomalies(args.dataPoints), null, 2) }] };
    case "youtube-thumbnail-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.compareVideoThumbnails(args.imageUrl1, args.imageUrl2), null, 2) }] };
    case "youtube-topic-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfYoutube.clusterVideoTopics(args.texts), null, 2) }] };

    // === TF.js Instagram ===
    case "analyze-instagram-images":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.analyzePostImages(args.imageUrls), null, 2) }] };
    case "predict-instagram-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.predictPostEngagement(args), null, 2) }] };
    case "classify-instagram-content":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.classifyPostContent(args.text), null, 2) }] };
    case "instagram-caption-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.analyzeCaptionSentiment(args.text), null, 2) }] };
    case "instagram-hashtag-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.extractHashtags(args.texts), null, 2) }] };
    case "instagram-visual-trends":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.detectVisualTrends(args.imageUrls), null, 2) }] };
    case "instagram-follower-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.forecastFollowerGrowth(args.dataPoints), null, 2) }] };
    case "instagram-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.detectEngagementAnomalies(args.dataPoints), null, 2) }] };
    case "instagram-post-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.comparePostVisuals(args.imageUrl1, args.imageUrl2), null, 2) }] };
    case "instagram-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfInstagram.clusterContentThemes(args.texts), null, 2) }] };

    // === TF.js TikTok ===
    case "analyze-tiktok-thumbnails":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.analyzeVideoThumbnails(args.imageUrls), null, 2) }] };
    case "predict-tiktok-virality":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.predictVirality(args), null, 2) }] };
    case "classify-tiktok-content":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.classifyVideoContent(args.texts), null, 2) }] };
    case "tiktok-content-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.analyzeContentSentiment(args.texts), null, 2) }] };
    case "tiktok-trending-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.extractTrendingTopics(args.texts), null, 2) }] };
    case "tiktok-view-patterns":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.detectViewPatterns(args.dataPoints), null, 2) }] };
    case "tiktok-follower-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.forecastFollowerGrowth(args.dataPoints), null, 2) }] };
    case "tiktok-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.detectEngagementAnomalies(args.dataPoints), null, 2) }] };
    case "tiktok-thumbnail-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.compareVideoThumbnails(args.imageUrl1, args.imageUrl2), null, 2) }] };
    case "tiktok-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfTiktok.clusterContentThemes(args.texts), null, 2) }] };

    // === TF.js Twitter ===
    case "twitter-content-keywords":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.analyzeKeywords(args.texts), null, 2) }] };
    case "predict-twitter-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.predictEngagement(args), null, 2) }] };
    case "classify-twitter-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.classifyTopics(args.texts), null, 2) }] };
    case "twitter-toxicity-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.detectToxicity(args.texts), null, 2) }] };
    case "twitter-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.analyzeSentiment(args.texts), null, 2) }] };
    case "twitter-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.extractKeywords(args.texts), null, 2) }] };
    case "twitter-follower-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.forecastFollowerGrowth(args.dataPoints), null, 2) }] };
    case "twitter-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.detectEngagementAnomalies(args.dataPoints), null, 2) }] };
    case "twitter-tweet-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.compareTweets(args.text1, args.text2), null, 2) }] };
    case "twitter-topic-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitter.clusterTopics(args.texts), null, 2) }] };

    // === TF.js Facebook ===
    case "analyze-facebook-content":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.analyzeContent(args), null, 2) }] };
    case "predict-facebook-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.predictEngagement(args), null, 2) }] };
    case "classify-facebook-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.classifyTopics(args.texts), null, 2) }] };
    case "facebook-comment-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.analyzeCommentSentiment(args.text), null, 2) }] };
    case "facebook-post-keywords":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.extractKeywords(args.texts), null, 2) }] };
    case "facebook-posting-trends":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.detectTrends(args.dataPoints), null, 2) }] };
    case "facebook-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.forecastGrowth(args.dataPoints), null, 2) }] };
    case "facebook-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.detectAnomalies(args.dataPoints), null, 2) }] };
    case "facebook-visual-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.compareVisuals(args.imageUrl1, args.imageUrl2), null, 2) }] };
    case "facebook-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfFacebook.clusterContent(args.texts), null, 2) }] };

    // === TF.js Discord ===
    case "discord-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.analyzeSentiment(args.texts), null, 2) }] };
    case "discord-toxicity-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.detectToxicity(args.texts), null, 2) }] };
    case "predict-discord-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.predictEngagement(args), null, 2) }] };
    case "classify-discord-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.classifyTopics(args.texts), null, 2) }] };
    case "discord-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.extractKeywords(args.texts), null, 2) }] };
    case "discord-activity-patterns":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.detectActivityPatterns(args.dataPoints), null, 2) }] };
    case "discord-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.forecastGrowth(args.dataPoints), null, 2) }] };
    case "discord-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.detectAnomalies(args.dataPoints), null, 2) }] };
    case "discord-channel-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.compareChannels(args.texts1, args.texts2), null, 2) }] };
    case "discord-member-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfDiscord.clusterMembers(args.data), null, 2) }] };

    // === TF.js Twitch ===
    case "analyze-twitch-content":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.analyzeContent(args.texts), null, 2) }] };
    case "predict-twitch-viewers":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.predictViewers(args), null, 2) }] };
    case "classify-twitch-games":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.classifyGames(args.texts), null, 2) }] };
    case "twitch-chat-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.analyzeChatSentiment(args.texts), null, 2) }] };
    case "twitch-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.extractKeywords(args.texts), null, 2) }] };
    case "twitch-viewer-trends":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.detectViewerTrends(args.dataPoints), null, 2) }] };
    case "twitch-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.forecastGrowth(args.dataPoints), null, 2) }] };
    case "twitch-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.detectAnomalies(args.dataPoints), null, 2) }] };
    case "twitch-clip-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.compareClips(args.text1, args.text2), null, 2) }] };
    case "twitch-stream-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfTwitch.clusterStreams(args.texts), null, 2) }] };

    // === TF.js Reddit ===
    case "reddit-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.analyzeSentiment(args.texts), null, 2) }] };
    case "reddit-toxicity-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.detectToxicity(args.texts), null, 2) }] };
    case "predict-reddit-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.predictEngagement(args), null, 2) }] };
    case "classify-reddit-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.classifyTopics(args.texts), null, 2) }] };
    case "reddit-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.extractKeywords(args.texts), null, 2) }] };
    case "reddit-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.detectTrends(args.dataPoints), null, 2) }] };
    case "reddit-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.forecastGrowth(args.dataPoints), null, 2) }] };
    case "reddit-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.detectAnomalies(args.dataPoints), null, 2) }] };
    case "reddit-post-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.comparePosts(args.text1, args.text2), null, 2) }] };
    case "reddit-community-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfReddit.clusterCommunity(args.texts), null, 2) }] };

    // === TF.js LinkedIn ===
    case "linkedin-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.analyzeSentiment(args.texts), null, 2) }] };
    case "predict-linkedin-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.predictEngagement(args), null, 2) }] };
    case "classify-linkedin-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.classifyTopics(args.texts), null, 2) }] };
    case "linkedin-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.extractKeywords(args.texts), null, 2) }] };
    case "linkedin-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.detectTrends(args.dataPoints), null, 2) }] };
    case "linkedin-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.forecastGrowth(args.dataPoints), null, 2) }] };
    case "linkedin-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.detectAnomalies(args.dataPoints), null, 2) }] };
    case "linkedin-post-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.comparePosts(args.text1, args.text2), null, 2) }] };
    case "linkedin-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.clusterContent(args.texts), null, 2) }] };
    case "linkedin-audience-segmentation":
      return { content: [{ type: "text", text: JSON.stringify(await tfLinkedin.segmentAudience(args), null, 2) }] };

    // === TF.js Threads ===
    case "threads-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.analyzeSentiment(args.texts), null, 2) }] };
    case "threads-toxicity-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.detectToxicity(args.texts), null, 2) }] };
    case "predict-threads-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.predictEngagement(args), null, 2) }] };
    case "classify-threads-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.classifyTopics(args.texts), null, 2) }] };
    case "threads-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.extractKeywords(args.texts), null, 2) }] };
    case "threads-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.detectTrends(args.dataPoints), null, 2) }] };
    case "threads-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.forecastGrowth(args.dataPoints), null, 2) }] };
    case "threads-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.detectAnomalies(args.dataPoints), null, 2) }] };
    case "threads-post-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.comparePosts(args.text1, args.text2), null, 2) }] };
    case "threads-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfThreads.clusterContent(args.texts), null, 2) }] };

    // === TF.js Bluesky ===
    case "bluesky-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.analyzeSentiment(args.texts), null, 2) }] };
    case "bluesky-toxicity-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.detectToxicity(args.texts), null, 2) }] };
    case "predict-bluesky-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.predictEngagement(args), null, 2) }] };
    case "classify-bluesky-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.classifyTopics(args.texts), null, 2) }] };
    case "bluesky-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.extractKeywords(args.texts), null, 2) }] };
    case "bluesky-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.detectTrends(args.dataPoints), null, 2) }] };
    case "bluesky-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.forecastGrowth(args.dataPoints), null, 2) }] };
    case "bluesky-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.detectAnomalies(args.dataPoints), null, 2) }] };
    case "bluesky-post-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.comparePosts(args.text1, args.text2), null, 2) }] };
    case "bluesky-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfBluesky.clusterContent(args.texts), null, 2) }] };

    // === TF.js Mastodon ===
    case "mastodon-sentiment-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.analyzeSentiment(args.texts), null, 2) }] };
    case "mastodon-toxicity-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.detectToxicity(args.texts), null, 2) }] };
    case "predict-mastodon-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.predictEngagement(args), null, 2) }] };
    case "classify-mastodon-topics":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.classifyTopics(args.texts), null, 2) }] };
    case "mastodon-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.extractKeywords(args.texts), null, 2) }] };
    case "mastodon-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.detectTrends(args.dataPoints), null, 2) }] };
    case "mastodon-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.forecastGrowth(args.dataPoints), null, 2) }] };
    case "mastodon-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.detectAnomalies(args.dataPoints), null, 2) }] };
    case "mastodon-status-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.compareStatuses(args.text1, args.text2), null, 2) }] };
    case "mastodon-content-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfMastodon.clusterContent(args.texts), null, 2) }] };

    // === TF.js GitHub ===
    case "github-issue-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.analyzeIssueSentiment(args.texts), null, 2) }] };
    case "classify-github-issues":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.classifyIssues(args.texts), null, 2) }] };
    case "github-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.extractKeywords(args.texts), null, 2) }] };
    case "github-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.detectTrends(args.dataPoints), null, 2) }] };
    case "github-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.forecastGrowth(args.dataPoints), null, 2) }] };
    case "github-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.detectAnomalies(args.dataPoints), null, 2) }] };
    case "github-repo-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.compareRepos(args.texts1, args.texts2), null, 2) }] };
    case "github-issue-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.clusterIssues(args.texts), null, 2) }] };
    case "predict-github-issue-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.predictIssueEngagement(args), null, 2) }] };
    case "github-contributor-patterns":
      return { content: [{ type: "text", text: JSON.stringify(await tfGithub.analyzeContributorPatterns(args), null, 2) }] };

    // === TF.js Spotify ===
    case "spotify-track-sentiment":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.analyzeTrackSentiment(args), null, 2) }] };
    case "spotify-genre-classification":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.classifyGenre(args), null, 2) }] };
    case "predict-spotify-popularity":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.predictPopularity(args), null, 2) }] };
    case "spotify-audio-keywords":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.extractAudioKeywords(args), null, 2) }] };
    case "spotify-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.detectTrends(args.dataPoints), null, 2) }] };
    case "spotify-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.forecastGrowth(args.dataPoints), null, 2) }] };
    case "spotify-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.detectAnomalies(args.dataPoints), null, 2) }] };
    case "spotify-track-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.compareTracks(args.track1, args.track2), null, 2) }] };
    case "spotify-playlist-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.clusterPlaylist(args.tracks), null, 2) }] };
    case "spotify-audio-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfSpotify.analyzeAudio(args), null, 2) }] };

    // === TF.js Pinterest ===
    case "analyze-pinterest-images":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.analyzeImages(args.imageUrls), null, 2) }] };
    case "predict-pinterest-engagement":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.predictEngagement(args), null, 2) }] };
    case "classify-pinterest-content":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.classifyContent(args.text), null, 2) }] };
    case "pinterest-keyword-extraction":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.extractKeywords(args.texts), null, 2) }] };
    case "pinterest-trend-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.detectTrends(args.dataPoints), null, 2) }] };
    case "pinterest-growth-forecast":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.forecastGrowth(args.dataPoints), null, 2) }] };
    case "pinterest-anomaly-detection":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.detectAnomalies(args.dataPoints), null, 2) }] };
    case "pinterest-pin-comparison":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.comparePins(args.text1, args.text2), null, 2) }] };
    case "pinterest-board-clustering":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.clusterBoards(args.boards), null, 2) }] };
    case "pinterest-audience-analysis":
      return { content: [{ type: "text", text: JSON.stringify(await tfPinterest.analyzeAudience(args.data), null, 2) }] };

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

async function dispatchTool(name, args) {
  const handler = toolRegistry[name];
  if (!handler) throw new Error(`Tool not found: ${name}`);
  const result = await handler(args);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function handleCallTool(request) {
  const { name, arguments: args } = request.params;

  const x402State = x402.getConfig();
  const { config, facilitatorClient } = x402State;
  const toolDef = toolDefinitions.find((t) => t.name === name);

  let paymentPayload = null;
  const metaPayment = request.params._meta && request.params._meta["x402/payment"];
  if (metaPayment && typeof metaPayment === "object") {
    paymentPayload = metaPayment;
  }

  if (!x402.isGateEnabled()) {
    try {
      const result = await dispatchTool(name, args);
      monitor.recordRequest({ kind: "mcp", tool: name, status: "paid" });
      return result;
    } catch (error) {
      monitor.recordRequest({ kind: "mcp", tool: name, status: "error", error: error.message });
      return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
    }
  }

  if (!paymentPayload) {
    monitor.recordRequest({ kind: "mcp", tool: name, status: "unpaid" });
    const paymentRequired = x402.buildPaymentRequired(
      name,
      toolDef ? toolDef.description : "ML analytics tool",
      config
    );
    return x402.mcpPaymentRequiredResult(paymentRequired);
  }

  const start = Date.now();
  try {
    const verifyResponse = await facilitatorClient.verify(
      paymentPayload,
      paymentPayload.accepted
    );
    if (verifyResponse && verifyResponse.isValid === false) {
      monitor.recordRequest({ kind: "mcp", tool: name, status: "unpaid", latMs: Date.now() - start });
      return x402.mcpPaymentRequiredResult(
        x402.buildPaymentRequired(
          name,
          toolDef ? toolDef.description : "ML analytics tool",
          config
        )
      );
    }

    const result = await dispatchTool(name, args);
    monitor.recordRequest({ kind: "mcp", tool: name, status: "paid", latMs: Date.now() - start });

    let settleResponse = null;
    try {
      settleResponse = await facilitatorClient.settle(
        paymentPayload,
        paymentPayload.accepted
      );
      monitor.recordPayment({
        tool: name,
        verify: "valid",
        settle: JSON.stringify(settleResponse),
        amount: paymentPayload.accepted && paymentPayload.accepted.amount,
        tx: settleResponse && settleResponse.transaction,
        success: !!(settleResponse && settleResponse.success !== false),
      });
    } catch (settleErr) {
      monitor.recordPayment({ tool: name, verify: "valid", settle: settleErr.message, amount: paymentPayload.accepted && paymentPayload.accepted.amount, success: false });
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: settleErr.message }) }],
        _meta: { "x402/payment-response": { success: false, errorReason: settleErr.message } },
      };
    }

    return x402.mcpPaymentResponseResult(result, settleResponse);
  } catch (error) {
    monitor.recordRequest({ kind: "mcp", tool: name, status: "error", latMs: Date.now() - start, error: error.message });
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
}

const sseTransports = new Map();

app.get("/mcp", async (req, res) => {
  const sseTransport = new SSEServerTransport("/mcp/messages", res);
  sseTransports.set(sseTransport.sessionId, sseTransport);
  const sessionServer = createMcpServer();
  await sessionServer.connect(sseTransport);
});

app.post("/mcp/messages", async (req, res) => {
  const sessionId = new URL(req.url, "http://localhost").searchParams.get("sessionId");
  const sseTransport = sessionId ? sseTransports.get(sessionId) : undefined;
  if (!sseTransport) return res.status(400).send("Bad Request: missing or invalid sessionId");
  await sseTransport.handlePostMessage(req, res);
});

const jsonParser = express.json({ limit: "2mb" });
const httpTransports = new Map();

app.post("/http", jsonParser, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let httpTransport = sessionId ? httpTransports.get(sessionId) : undefined;
  if (!httpTransport) {
    if (!isInitializeRequest(req.body)) {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Bad Request: missing or invalid session" },
        id: req.body?.id ?? null
      });
    }
    httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => httpTransports.set(id, httpTransport)
    });
    await createMcpServer().connect(httpTransport);
  }
  await httpTransport.handleRequest(req, res, req.body);
});

async function handleHttpSession(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  const httpTransport = sessionId ? httpTransports.get(sessionId) : undefined;
  if (!httpTransport) return res.status(404).json({ error: "Invalid or missing session ID." });
  await httpTransport.handleRequest(req, res);
}

app.get("/http", handleHttpSession);
app.delete("/http", handleHttpSession);

app.get("/health", (req, res) => { res.json({ status: "ok", tools: toolDefinitions.length, version: "2.0.0" }); });

// === REST API (compatible with /api/v1/tools/:toolName) ===
const jobs = new Map();

function runTool(name, args) {
  if (!toolRegistry[name]) throw new Error(`Tool not found: ${name}`);
  return toolRegistry[name](args);
}

function monitorMiddleware(original) {
  return (req, res, next) => {
    const onFinish = () => {
      if (res.statusCode === 402) {
        const toolName = req.params && req.params.toolName;
        if (toolName) monitor.recordRequest({ kind: "rest", tool: toolName, status: "unpaid" });
      }
    };
    res.on("finish", onFinish);
    return original(req, res, next);
  };
}
app.use(monitorMiddleware(x402State.middleware));

app.post("/api/v1/tools/:toolName", jsonParser, async (req, res) => {
  const { toolName } = req.params;
  if (!toolRegistry[toolName]) {
    return res.status(404).json({ error: `Tool not found: ${toolName}` });
  }
  const jobId = randomUUID();
  jobs.set(jobId, { status: "pending", tool: toolName, createdAt: Date.now() });

  (async () => {
    try {
      const start = Date.now();
      const result = await runTool(toolName, req.body);
      jobs.set(jobId, { ...jobs.get(jobId), status: "completed", result, completedAt: Date.now() });
      monitor.recordRequest({ kind: "rest", tool: toolName, status: "paid", latMs: Date.now() - start });
    } catch (err) {
      jobs.set(jobId, { ...jobs.get(jobId), status: "failed", error: err.message, completedAt: Date.now() });
      monitor.recordRequest({ kind: "rest", tool: toolName, status: "error", error: err.message });
    }
  })();

  res.json({ jobId, message: "Job enqueued" });
});

app.get("/api/v1/jobs/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status === "pending") return res.json({ status: "pending" });
  if (job.status === "failed") return res.status(500).json({ status: "failed", error: job.error });
  res.json({ status: "completed", tool: job.tool, result: job.result });
});

// Synchronous endpoint - returns result immediately
app.post("/api/v1/tools/:toolName/sync", jsonParser, async (req, res) => {
  const { toolName } = req.params;
  if (!toolRegistry[toolName]) {
    return res.status(404).json({ error: `Tool not found: ${toolName}` });
  }
  const start = Date.now();
  try {
    const result = await runTool(toolName, req.body);
    monitor.recordRequest({ kind: "rest", tool: toolName, status: "paid", latMs: Date.now() - start });
    res.json({ status: "completed", tool: toolName, result });
  } catch (err) {
    monitor.recordRequest({ kind: "rest", tool: toolName, status: "error", latMs: Date.now() - start, error: err.message });
    res.status(500).json({ status: "failed", tool: toolName, error: err.message });
  }
});

app.get("/api/v1/tools", (req, res) => {
  res.json({
    tools: toolDefinitions.map(t => ({ name: t.name, description: t.description })),
    total: toolDefinitions.length
  });
});

// Cleanup old jobs every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);

// === x402 discovery documents (freely fetchable so indexers/probes can find us) ===
const fs = require("node:fs");
const path = require("node:path");

const OPENAPI_PATH = path.join(__dirname, "openapi.json");
const OPENAPI_YAML_PATH = path.join(__dirname, "openapi.yaml");

function publicOrigin(req) {
  return process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
}

function annotatedOpenApi() {
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(OPENAPI_PATH, "utf8"));
  } catch (err) {
    return null;
  }
  const cfg = x402.getConfig().config;
  const { payTo, priceUsd, network } = cfg;
  const paymentInfo = {
    protocols: [
      {
        network: network.caip2,
        payTo,
        scheme: "exact",
      },
    ],
    price: { mode: "fixed", currency: "USD", amount: {
      value: priceUsd,
      currency: "USD",
      atomic: String(Math.round(priceUsd * 10 ** x402.USDC_DECIMALS)),
    }},
  };
  for (const p in spec.paths || {}) {
    const op = spec.paths[p] && spec.paths[p].post;
    if (!op) continue;
    op["x-payment-info"] = paymentInfo;
    op.responses = op.responses || {};
    op.responses["402"] = {
      description: "Payment Required - x402 challenge",
      headers: {
        "Payment-Required": {
          description: "Base64-encoded x402 PaymentRequired object",
          schema: { type: "string" },
        },
      },
    };
  }
  spec.info = spec.info || {};
  spec.info["x-guidance"] =
    "TensorFlow.js Social MCP resource server. 168 ML analytics tools, each payable " +
    "via x402 (Solana devnet USDC). POST to /api/v1/tools/{name}/sync with an x402 " +
    "payment; unauthenticated calls receive an HTTP 402 challenge.";
  return spec;
}

app.get("/openapi.json", (req, res) => {
  const spec = annotatedOpenApi();
  if (!spec) return res.status(404).json({ error: "openapi.json not found" });
  res.set("Content-Type", "application/json");
  res.json(spec);
});

app.get("/openapi.yaml", (req, res) => {
  if (!fs.existsSync(OPENAPI_YAML_PATH)) return res.status(404).json({ error: "openapi.yaml not found" });
  res.set("Content-Type", "application/yaml");
  res.send(fs.readFileSync(OPENAPI_YAML_PATH, "utf8"));
});

app.get("/.well-known/x402", (req, res) => {
  const origin = publicOrigin(req);
  const resources = [];
  const routes = x402.getConfig().routes;
  for (const routeKey in routes) {
    // routeKey is like "POST /api/v1/tools/analyze-image/sync"
    const m = routeKey.match(/^(\w+) (\S+)$/);
    if (!m) continue;
    resources.push(`${m[1]} ${origin}${m[2]}`);
  }
  res.set("Content-Type", "application/json");
  res.json({
    version: 1,
    x402Version: 2,
    resources,
  });
});

// === x402 status & control endpoints (localhost-only TUI integration) ===
const SERVER_START_TIME = Date.now();
const SERVER_PORT = parseInt(process.env.PORT, 10) || 6350;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopbackRequest(req) {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress);
}

app.get("/x402/status", (req, res) => {
  res.json({
    server: {
      pid: process.pid,
      port: SERVER_PORT,
      uptimeMs: Date.now() - SERVER_START_TIME,
      startedAt: SERVER_START_TIME,
      tools: toolDefinitions.length,
    },
    x402: x402.getStatus(),
    monitor: monitor.getSnapshot(50),
  });
});

app.post("/x402/control", jsonParser, (req, res) => {
  if (!isLoopbackRequest(req)) {
    return res.status(403).json({ ok: false, error: "x402 controls are available only from localhost" });
  }
  const { action, value } = req.body || {};
  try {
    switch (action) {
      case "toggle-gate":
        return res.json({ ok: true, x402: x402.setGateEnabled(!x402.isGateEnabled()) });
      case "set-gate":
        return res.json({ ok: true, x402: x402.setGateEnabled(!!value) });
      case "set-price":
        return res.json({ ok: true, x402: x402.setPrice(parseFloat(value)) });
      case "clear-history":
        monitor.clearHistory();
        return res.json({ ok: true, monitor: monitor.getSnapshot(50) });
      default:
        return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

const PORT = SERVER_PORT;
app.use((err, req, res, _next) => { console.error("Server error:", err); res.status(500).json({ error: "Internal server error" }); });
app.listen(PORT, () => {
  console.log(`TensorFlow Social Media AI MCP server running at http://localhost:${PORT}/mcp (SSE) and http://localhost:${PORT}/http (streamable)`);
  console.log(`Total tools: ${toolDefinitions.length}`);
});
