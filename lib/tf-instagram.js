/**
 * TensorFlow.js Instagram Analytics Tools (10)
 * Pure ML analysis — accepts direct input, no API calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfImage = require("./tf-image");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const modelCache = {};

async function loadModel(name, loader) {
  if (!modelCache[name]) {
    console.log(`[tf-instagram] Loading model: ${name}...`);
    modelCache[name] = await loader();
    console.log(`[tf-instagram] Model loaded: ${name}`);
  }
  return modelCache[name];
}

async function analyzePostImages(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { error: "Provide an array of image URLs" };
  }
  const results = [];
  for (const url of imageUrls) {
    try {
      const classification = await tfImage.classifyImage(url);
      const objects = await tfImage.detectObjects(url);
      results.push({
        url,
        classifications: classification.slice(0, 3),
        objects: objects.slice(0, 5).map(o => ({ class: o.class, score: o.score }))
      });
    } catch (e) {
      results.push({ url, error: e.message });
    }
  }
  return { totalAnalyzed: results.length, images: results };
}

async function predictPostEngagement(features) {
  const { captionLen = 0, hashtagCount = 0, emojiCount = 0, likes = 0, comments = 0, shares = 0 } = features || {};
  const inputArr = [captionLen, hashtagCount, emojiCount, likes, comments, shares];
  const input = tf.tensor2d([inputArr]);
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
    features: { captionLen, hashtagCount, emojiCount, likes, comments, shares },
    predictedScore: +prediction.toFixed(4)
  };
}

async function classifyPostContent(text) {
  if (!text || typeof text !== "string") {
    return { error: "Provide a text string to classify" };
  }
  const categories = {
    lifestyle: ["life", "daily", "routine", "morning", "day", "home", "family", "friends"],
    fashion: ["fashion", "outfit", "style", "wear", "clothes", "look", "ootd", "dress"],
    food: ["food", "recipe", "cook", "eat", "restaurant", "delicious", "yummy", "meal"],
    travel: ["travel", "trip", "vacation", "explore", "adventure", "destination", "hotel", "beach"],
    fitness: ["fitness", "workout", "gym", "exercise", "health", "fit", "training", "muscle"],
    business: ["business", "entrepreneur", "startup", "hustle", "money", "income", "success", "brand"]
  };
  const result = await tfText.classifyText(text, categories);
  return { caption: text.slice(0, 200), ...result };
}

async function analyzeCaptionSentiment(text) {
  if (!text || typeof text !== "string") {
    return { error: "Provide a text string to analyze" };
  }
  const sentimentResult = await tfText.analyzeSentimentML(text);
  return { caption: text.slice(0, 200), sentiment: sentimentResult };
}

async function extractHashtags(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return { error: "Provide an array of text strings" };
  }
  const allText = texts.join(" ");
  if (!allText.trim()) return { totalTexts: texts.length, hashtags: [] };
  const hashtags = await tfText.extractKeywordsML(allText, 20);
  return { totalTexts: texts.length, hashtags };
}

async function detectVisualTrends(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { error: "Provide an array of image URLs" };
  }
  const allClassifications = [];
  const allObjects = [];
  for (const url of imageUrls) {
    try {
      const classification = await tfImage.classifyImage(url);
      const objects = await tfImage.detectObjects(url);
      allClassifications.push(...classification.slice(0, 3).map(c => c.className));
      allObjects.push(...objects.map(o => o.class));
    } catch (e) { /* skip failed images */ }
  }
  const classCounts = {};
  allClassifications.forEach(c => { classCounts[c] = (classCounts[c] || 0) + 1; });
  const objCounts = {};
  allObjects.forEach(o => { objCounts[o] = (objCounts[o] || 0) + 1; });
  const topClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topObjects = Object.entries(objCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    imagesAnalyzed: imageUrls.length,
    topClassifications: topClasses.map(([name, count]) => ({ name, count })),
    topObjects: topObjects.map(([name, count]) => ({ name, count }))
  };
}

async function forecastFollowerGrowth(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 10) {
    return { error: "Need at least 10 numeric data points" };
  }
  const forecast = await tfMl.forecastTimeSeries(dataPoints, 7);
  return { dataPoints: dataPoints.length, ...forecast };
}

async function detectEngagementAnomalies(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 5) {
    return { error: "Need at least 5 numeric data points" };
  }
  const anomalies = await tfMl.detectAnomalies(dataPoints);
  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  return {
    dataPoints: dataPoints.length,
    anomaliesDetected: anomalyCount,
    results: anomalies.map((a, i) => ({
      value: a.value,
      error: a.error,
      isAnomaly: a.isAnomaly,
      index: i
    }))
  };
}

async function comparePostVisuals(imageUrl1, imageUrl2) {
  if (!imageUrl1 || !imageUrl2) {
    return { error: "Provide two image URLs to compare" };
  }
  const similarity = await tfImage.compareImages(imageUrl1, imageUrl2);
  return { imageUrl1, imageUrl2, ...similarity };
}

async function clusterContentThemes(texts) {
  if (!Array.isArray(texts) || texts.length < 3) {
    return { error: "Need at least 3 text strings to cluster" };
  }
  const cleanTexts = texts.map(t => (t || "").trim() || "no content");
  const embeddings = await tfText.embedText(cleanTexts);
  const points = embeddings.map(e => [e.embedding[0] || 0, e.embedding[1] || 0]);
  const numClusters = Math.min(5, Math.floor(texts.length / 2));
  const clustered = await tfMl.clusterData(points, numClusters);
  return {
    textCount: texts.length,
    numClusters,
    clusters: clustered.map((c, i) => ({
      text: cleanTexts[i].slice(0, 80),
      cluster: c.cluster
    }))
  };
}

module.exports = {
  analyzePostImages,
  predictPostEngagement,
  classifyPostContent,
  analyzeCaptionSentiment,
  extractHashtags,
  detectVisualTrends,
  forecastFollowerGrowth,
  detectEngagementAnomalies,
  comparePostVisuals,
  clusterContentThemes
};
