/**
 * TensorFlow.js X/Twitter Analytics Tools (10)
 * All functions accept DIRECT INPUT - no API calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

// 1. Analyze tweet content themes
async function analyzeTweetContent(texts) {
  const allText = texts.join(" ");
  const keywords = await tfText.extractKeywordsML(allText, 20);
  return { tweetCount: texts.length, keywords };
}

// 2. Predict tweet engagement based on features
async function predictTweetEngagement(features) {
  if (!features || features.length < 3) return { error: "Need at least 3 data points" };
  const inputFeatures = features.map(f => [
    f.textLen || 0,
    f.hashtagCount || 0,
    f.mentionCount || 0,
    f.linkCount || 0,
    f.questionCount || 0,
    f.exclamationCount || 0
  ]);
  const labels = features.map(f => [
    ((f.likes || 0) + (f.retweets || 0) + (f.replies || 0)) /
    Math.max(1, (f.likes || 0) + (f.retweets || 0) + (f.replies || 0) + 100)
  ]);
  const xTensor = tf.tensor2d(inputFeatures);
  const yTensor = tf.tensor2d(labels);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [6] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });
  await model.fit(xTensor, yTensor, { epochs: 20, verbose: 0 });
  xTensor.dispose();
  yTensor.dispose();
  const predictions = features.map((f, i) => {
    const input = tf.tensor2d([inputFeatures[i]]);
    const pred = model.predict(input).dataSync()[0];
    input.dispose();
    return {
      index: i,
      textLen: f.textLen, hashtagCount: f.hashtagCount,
      likes: f.likes, retweets: f.retweets, replies: f.replies,
      predictedScore: +pred.toFixed(4)
    };
  });
  model.dispose();
  predictions.sort((a, b) => b.predictedScore - a.predictedScore);
  return { dataCount: features.length, predictions: predictions.slice(0, 10) };
}

// 3. Classify tweets by topic
async function classifyTweetTopics(texts) {
  const categories = {
    tech: ["ai", "tech", "code", "programming", "software", "startup", "data", "machine learning"],
    news: ["news", "breaking", "report", "update", "announce", "today", "latest", "politics"],
    opinion: ["think", "believe", "opinion", "agree", "disagree", "hot take", "unpopular", "honestly"],
    promotion: ["buy", "check out", "link", "discount", "sale", "offer", "free", "giveaway"],
    personal: ["life", "day", "mood", "feeling", "morning", "night", "weekend", "vibes"]
  };
  const results = [];
  for (const text of texts) {
    try {
      const result = await tfText.classifyText(text, categories);
      results.push({ text: text.slice(0, 100), topic: result.label, confidences: result.confidences });
    } catch (e) {
      results.push({ text: text.slice(0, 100), error: e.message });
    }
  }
  const distribution = {};
  results.forEach(r => { if (r.topic) distribution[r.topic] = (distribution[r.topic] || 0) + 1; });
  return { tweetCount: results.length, distribution, tweets: results };
}

// 4. Detect toxicity in tweets
async function detectTweetToxicity(texts) {
  const results = [];
  for (const text of texts) {
    try {
      const toxicity = await tfText.detectToxicity(text);
      const isToxic = toxicity.some(t => t.results.some(r => r.match));
      results.push({
        text: text.slice(0, 100), isToxic,
        labels: toxicity.filter(t => t.results.some(r => r.match)).map(t => t.label)
      });
    } catch (e) {
      results.push({ text: text.slice(0, 100), error: e.message });
    }
  }
  const toxicCount = results.filter(r => r.isToxic).length;
  return {
    tweetCount: results.length, toxicCount,
    toxicRate: +(toxicCount / results.length * 100).toFixed(1),
    tweets: results
  };
}

// 5. ML sentiment analysis on tweets
async function analyzeTweetSentiment(texts) {
  const results = [];
  for (const text of texts) {
    try {
      const sentiment = await tfText.analyzeSentimentML(text);
      results.push({ text: text.slice(0, 100), ...sentiment });
    } catch (e) {
      results.push({ text: text.slice(0, 100), error: e.message });
    }
  }
  const pos = results.filter(r => r.sentiment === "positive").length;
  const neg = results.filter(r => r.sentiment === "negative").length;
  const neu = results.filter(r => r.sentiment === "neutral").length;
  return {
    tweetCount: results.length,
    distribution: { positive: pos, negative: neg, neutral: neu },
    overall: pos > neg ? "positive" : neg > pos ? "negative" : "neutral",
    tweets: results
  };
}

// 6. Extract keywords from tweets
async function extractTweetKeywords(texts) {
  const allText = texts.join(" ");
  const keywords = await tfText.extractKeywordsML(allText, 20);
  return { tweetCount: texts.length, keywords };
}

// 7. Forecast follower growth from numeric engagement data
async function forecastFollowerGrowth(dataPoints) {
  if (!dataPoints || dataPoints.length < 10) return { error: "Need at least 10 data points" };
  const forecast = await tfMl.forecastTimeSeries(dataPoints, 7);
  return { dataPoints: dataPoints.length, ...forecast };
}

// 8. Detect anomalies in numeric engagement data
async function detectEngagementAnomalies(dataPoints) {
  if (!dataPoints || dataPoints.length < 3) return { error: "Need at least 3 data points" };
  const anomalies = await tfMl.detectAnomalies(dataPoints);
  const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
  return {
    dataPoints: dataPoints.length, anomaliesDetected: anomalyCount,
    results: anomalies
  };
}

// 9. Compare tweet similarity using embeddings
async function compareTweetSimilarity(text1, text2) {
  const embeddings = await tfText.embedText([text1, text2]);
  const vec1 = embeddings[0].embedding;
  const vec2 = embeddings[1].embedding;
  let dotProduct = 0, magA = 0, magB = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magA += vec1[i] * vec1[i];
    magB += vec2[i] * vec2[i];
  }
  const similarity = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  return {
    text1: text1.slice(0, 100), text2: text2.slice(0, 100),
    similarity: +similarity.toFixed(4),
    isSimilar: similarity > 0.7
  };
}

// 10. Cluster tweets by topic using embeddings
async function clusterTweetTopics(texts) {
  if (!texts || texts.length < 3) return { error: "Need at least 3 tweets" };
  const embeddings = await tfText.embedText(texts);
  const points = embeddings.map(e => [e.embedding[0] || 0, e.embedding[1] || 0]);
  const numClusters = Math.min(5, Math.floor(texts.length / 2));
  const clustered = await tfMl.clusterData(points, numClusters);
  return {
    tweetCount: texts.length, numClusters,
    clusters: clustered.map((c, i) => ({
      text: texts[i]?.slice(0, 80),
      cluster: c.cluster
    }))
  };
}

module.exports = {
  analyzeTweetContent,
  predictTweetEngagement,
  classifyTweetTopics,
  detectTweetToxicity,
  analyzeTweetSentiment,
  extractTweetKeywords,
  forecastFollowerGrowth,
  detectEngagementAnomalies,
  compareTweetSimilarity,
  clusterTweetTopics
};
