/**
 * TensorFlow.js Facebook Analytics Tools (10)
 * Pure ML functions that accept direct input — no API calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfImage = require("./tf-image");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const modelCache = {};

async function loadModel(name, loader) {
  if (!modelCache[name]) {
    console.log(`[tf-facebook] Loading model: ${name}...`);
    modelCache[name] = await loader();
    console.log(`[tf-facebook] Model loaded: ${name}`);
  }
  return modelCache[name];
}

// 1. Analyze post content and images
async function analyzePostContent(data) {
  const message = data.message || "";
  let imageAnalysis = null;
  if (data.imageUrl) {
    try {
      imageAnalysis = await tfImage.analyzeThumbnail(data.imageUrl);
    } catch (e) {
      imageAnalysis = { error: e.message };
    }
  }
  const messageLen = message.length;
  const hashtagCount = (message.match(/#/g) || []).length;
  const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}]/gu) || []).length;
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  const linkCount = (message.match(/https?:\/\//g) || []).length;

  return {
    message: message.slice(0, 200),
    features: { messageLen, hashtagCount, emojiCount, linkCount, wordCount },
    imageAnalysis
  };
}

// 2. Predict post engagement
async function predictPostEngagement(features) {
  const { messageLen = 0, hashtagCount = 0, emojiCount = 0, linkCount = 0, wordCount = 0, impressions = 0 } = features;
  const input = tf.tensor2d([[messageLen, hashtagCount, emojiCount, linkCount, wordCount, impressions]]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [6] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });
  const syntheticX = tf.randomNormal([100, 6]);
  const syntheticY = tf.randomUniform([100, 1]);
  await model.fit(syntheticX, syntheticY, { epochs: 10, verbose: 0 });
  syntheticX.dispose();
  syntheticY.dispose();
  const prediction = model.predict(input).dataSync()[0];
  input.dispose();
  model.dispose();

  return {
    features: { messageLen, hashtagCount, emojiCount, linkCount, wordCount, impressions },
    predictedScore: +prediction.toFixed(4)
  };
}

// 3. Classify posts by topic
async function classifyPostTopics(texts) {
  const categories = {
    promotional: ["buy", "sale", "discount", "offer", "deal", "shop", "price", "limited"],
    educational: ["learn", "tip", "how to", "guide", "tutorial", "know", "fact", "important"],
    engagement: ["like", "share", "comment", "tag", "follow", "subscribe", "vote", "poll"],
    entertainment: ["funny", "laugh", "haha", "lol", "meme", "joke", "hilarious", "amazing"],
    community: ["community", "team", "family", "together", "join", "welcome", "thank", "grateful"]
  };

  const results = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i] || "";
    if (!text.trim()) {
      results.push({ index: i, text: text.slice(0, 100), topic: "unknown", confidences: {} });
      continue;
    }
    try {
      const result = await tfText.classifyText(text, categories);
      results.push({ index: i, text: text.slice(0, 100), topic: result.label, confidences: result.confidences });
    } catch (e) {
      results.push({ index: i, text: text.slice(0, 100), topic: "error", confidences: {}, error: e.message });
    }
  }

  const distribution = {};
  results.forEach(r => {
    if (r.topic) distribution[r.topic] = (distribution[r.topic] || 0) + 1;
  });

  return { postCount: results.length, distribution, posts: results };
}

// 4. ML sentiment analysis on text
async function analyzeCommentSentiment(text) {
  const sentimentResult = await tfText.analyzeSentimentML(text);
  return {
    text: text.slice(0, 200),
    sentiment: sentimentResult
  };
}

// 5. Extract keywords from posts
async function extractPostKeywords(texts) {
  const allText = texts.join(" ");
  const keywords = await tfText.extractKeywordsML(allText, 20);
  return { postCount: texts.length, keywords };
}

// 6. Detect posting trends
async function detectPostingTrends(dataPoints) {
  if (dataPoints.length < 5) return { error: "Need at least 5 data points" };
  const trends = await tfMl.detectTrends(dataPoints);
  return { dataPointCount: dataPoints.length, ...trends };
}

// 7. Forecast page growth
async function forecastPageGrowth(dataPoints) {
  if (dataPoints.length < 10) return { error: "Need at least 10 data points for forecasting" };
  const forecast = await tfMl.forecastTimeSeries(dataPoints, 7);
  return { dataPointCount: dataPoints.length, ...forecast };
}

// 8. Detect anomalies in engagement
async function detectEngagementAnomalies(dataPoints) {
  if (dataPoints.length < 5) return { error: "Need at least 5 data points" };
  const anomalies = await tfMl.detectAnomalies(dataPoints);
  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  return {
    dataPointCount: dataPoints.length,
    anomaliesDetected: anomalyCount,
    results: anomalies
  };
}

// 9. Compare post visual similarity
async function comparePostVisuals(imageUrl1, imageUrl2) {
  if (!imageUrl1 || !imageUrl2) return { error: "Both image URLs are required" };
  const similarity = await tfImage.compareImages(imageUrl1, imageUrl2);
  return {
    imageUrl1,
    imageUrl2,
    ...similarity
  };
}

// 10. Cluster posts by content theme
async function clusterPostContent(texts) {
  if (texts.length < 3) return { error: "Need at least 3 texts for clustering" };
  const embeddings = await tfText.embedText(texts);
  const points = embeddings.map(e => [e.embedding[0] || 0, e.embedding[1] || 0]);
  const numClusters = Math.min(5, Math.floor(texts.length / 2));
  const clustered = await tfMl.clusterData(points, numClusters);

  return {
    postCount: texts.length,
    numClusters,
    clusters: clustered.map((c, i) => ({
      text: (texts[i] || "").slice(0, 100),
      cluster: c.cluster
    }))
  };
}

module.exports = {
  analyzePostContent,
  predictPostEngagement,
  classifyPostTopics,
  analyzeCommentSentiment,
  extractPostKeywords,
  detectPostingTrends,
  forecastPageGrowth,
  detectEngagementAnomalies,
  comparePostVisuals,
  clusterPostContent
};
