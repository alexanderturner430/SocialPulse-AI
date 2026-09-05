/**
 * TensorFlow.js TikTok Analytics Tools (10)
 * Pure ML analysis — no API calls, all functions accept direct input
 */

const tf = require("@tensorflow/tfjs-node");
const tfImage = require("./tf-image");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const modelCache = {};

async function loadModel(name, loader) {
  if (!modelCache[name]) {
    console.log(`[tf-tiktok] Loading model: ${name}...`);
    modelCache[name] = await loader();
    console.log(`[tf-tiktok] Model loaded: ${name}`);
  }
  return modelCache[name];
}

// 1. Analyze video cover images/thumbnails
async function analyzeVideoThumbnails(imageUrls) {
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const results = [];
  for (const url of urls) {
    try {
      const analysis = await tfImage.analyzeThumbnail(url);
      results.push({ url, ...analysis });
    } catch (e) {
      results.push({ url, error: e.message });
    }
  }
  return { count: results.length, thumbnails: results };
}

// 2. Predict viral potential based on direct content features
async function predictVirality(features) {
  if (!features || features.length === 0) return { error: "No features provided" };

  const rawX = features.map(f => [
    f.titleLen || 0,
    f.descLen || 0,
    f.duration || 0,
    f.hashtagCount || 0,
    f.emojiCount || 0
  ]);

  const labels = features.map(f => {
    const engagement = ((f.likes || 0) + (f.comments || 0) + (f.shares || 0)) / Math.max(1, f.views || 1);
    return [Math.min(1, engagement * 10)];
  });

  const xTensor = tf.tensor2d(rawX);
  const yTensor = tf.tensor2d(labels);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [5] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });
  await model.fit(xTensor, yTensor, { epochs: 20, verbose: 0 });
  xTensor.dispose();
  yTensor.dispose();

  const predictions = rawX.map((row, i) => {
    const input = tf.tensor2d([row]);
    const pred = model.predict(input).dataSync()[0];
    input.dispose();
    return { index: i, ...features[i], viralityScore: +pred.toFixed(4) };
  });
  model.dispose();
  predictions.sort((a, b) => b.viralityScore - a.viralityScore);
  return { count: features.length, predictions };
}

// 3. Classify video content type from text titles/descriptions
async function classifyVideoContent(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const categories = {
    dance: ["dance", "dancing", "choreography", "moves", "viral dance", "trending"],
    comedy: ["funny", "comedy", "laugh", "joke", "prank", "humor", "hilarious"],
    educational: ["learn", "tutorial", "how to", "tip", "trick", "educational", "did you know"],
    lifestyle: ["daily", "routine", "vlog", "day in my life", "morning", "get ready"],
    food: ["recipe", "cook", "food", "restaurant", "eat", "yummy", "chef"],
    beauty: ["makeup", "beauty", "skincare", "hair", "tutorial", "glow up", "routine"]
  };
  const results = [];
  for (const text of arr) {
    const trimmed = (text || "").trim();
    if (!trimmed) continue;
    try {
      const result = await tfText.classifyText(trimmed, categories);
      results.push({ text: trimmed.slice(0, 100), category: result.label, confidences: result.confidences });
    } catch (e) {
      results.push({ text: trimmed.slice(0, 100), error: e.message });
    }
  }
  const distribution = {};
  results.forEach(r => { if (r.category) distribution[r.category] = (distribution[r.category] || 0) + 1; });
  return { count: results.length, distribution, videos: results };
}

// 4. ML sentiment analysis on direct text input
async function analyzeContentSentiment(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const results = [];
  for (const text of arr) {
    const trimmed = (text || "").trim();
    if (!trimmed) continue;
    try {
      const sentimentResult = await tfText.analyzeSentimentML(trimmed);
      results.push({ text: trimmed.slice(0, 100), ...sentimentResult });
    } catch (e) {
      results.push({ text: trimmed.slice(0, 100), error: e.message });
    }
  }
  const pos = results.filter(r => r.sentiment === "positive").length;
  const neg = results.filter(r => r.sentiment === "negative").length;
  const neu = results.filter(r => r.sentiment === "neutral").length;
  return {
    count: results.length,
    distribution: { positive: pos, negative: neg, neutral: neu },
    overall: pos > neg ? "positive" : neg > pos ? "negative" : "neutral",
    videos: results
  };
}

// 5. Extract trending topics/keywords from direct text input
async function extractTrendingTopics(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const allText = arr.join(" ").trim();
  if (!allText) return { topics: [] };
  const keywords = await tfText.extractKeywordsML(allText, 20);
  return { textCount: arr.length, topics: keywords };
}

// 6. Detect patterns in view counts using statistical ML
async function detectViewPatterns(dataPoints) {
  const views = dataPoints.map(d => typeof d === "number" ? d : d.value || 0);
  if (views.length < 5) return { error: "Need at least 5 data points" };
  const trends = await tfMl.detectTrends(views);
  const anomalies = await tfMl.detectAnomalies(views);
  return {
    count: views.length,
    viewStats: {
      min: Math.min(...views),
      max: Math.max(...views),
      avg: Math.round(views.reduce((a, b) => a + b, 0) / views.length)
    },
    trends,
    anomalies: anomalies.map((a, i) => ({ index: i, views: a.value, isAnomaly: a.isAnomaly }))
  };
}

// 7. Forecast follower growth from direct numeric data points
async function forecastFollowerGrowth(dataPoints) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || 0);
  if (data.length < 10) return { error: "Need at least 10 data points for forecasting" };
  const forecast = await tfMl.forecastTimeSeries(data, 7);
  return { dataPoints: data.length, ...forecast };
}

// 8. Detect anomalies in engagement metrics from direct numeric data
async function detectEngagementAnomalies(dataPoints) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || 0);
  if (data.length < 5) return { error: "Need at least 5 data points" };
  const anomalies = await tfMl.detectAnomalies(data);
  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  return {
    count: data.length,
    anomaliesDetected: anomalyCount,
    results: anomalies.map((a, i) => ({ index: i, engagement: a.value, isAnomaly: a.isAnomaly }))
  };
}

// 9. Compare visual similarity of two image URLs
async function compareVideoThumbnails(imageUrl1, imageUrl2) {
  if (!imageUrl1 || !imageUrl2) return { error: "Both image URLs are required" };
  const similarity = await tfImage.compareImages(imageUrl1, imageUrl2);
  return { imageUrl1, imageUrl2, ...similarity };
}

// 10. Cluster videos by content using embeddings
async function clusterVideoContent(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length < 3) return { error: "Need at least 3 texts to cluster" };
  const embeddings = await tfText.embedText(arr);
  const points = embeddings.map(e => [e.embedding[0] || 0, e.embedding[1] || 0]);
  const numClusters = Math.min(5, Math.floor(arr.length / 2));
  const clustered = await tfMl.clusterData(points, numClusters);
  return {
    textCount: arr.length,
    numClusters,
    clusters: clustered.map((c, i) => ({
      text: arr[i]?.slice(0, 100),
      cluster: c.cluster
    }))
  };
}

module.exports = {
  analyzeVideoThumbnails,
  predictVirality,
  classifyVideoContent,
  analyzeContentSentiment,
  extractTrendingTopics,
  detectViewPatterns,
  forecastFollowerGrowth,
  detectEngagementAnomalies,
  compareVideoThumbnails,
  clusterVideoContent
};
