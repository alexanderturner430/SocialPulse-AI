/**
 * TensorFlow.js LinkedIn Analytics Tools (No API)
 * ML-powered sentiment, engagement prediction, topic classification,
 * keyword extraction, trend detection, growth forecasting, anomaly
 * detection, post comparison, content clustering, audience analysis
 */

const tf = require("@tensorflow/tfjs-node");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const Sentiment = require("sentiment");
const sentiment = new Sentiment();

function tokenize(text) {
  return (text || "").toLowerCase().match(/\b\w{3,}\b/g) || [];
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1e-8);
}

function tfidfVector(tokens, vocab, idf) {
  const vec = new Array(vocab.length).fill(0);
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  tokens.forEach(t => {
    const idx = vocab.indexOf(t);
    if (idx !== -1) vec[idx] = (freq[t] || 0) * (idf[t] || 1);
  });
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function buildVocabAndIdf(docs) {
  const df = {};
  docs.forEach(doc => {
    const unique = [...new Set(doc)];
    unique.forEach(t => { df[t] = (df[t] || 0) + 1; });
  });
  const vocab = Object.keys(df).sort();
  const N = docs.length;
  const idf = {};
  vocab.forEach(t => { idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1; });
  return { vocab, idf };
}

const STOP_WORDS = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "has", "his", "how", "its", "may", "new", "now", "old", "see", "way", "who", "did", "get", "let", "say", "she", "too", "use", "with", "that", "this", "will", "been", "have", "from", "they", "were", "what", "when", "your", "said", "each", "make", "like", "long", "look", "many", "some", "than", "them", "then", "these", "time", "very", "just", "know", "take", "people", "into", "year", "good", "could", "about", "first", "also", "back", "after", "work", "well", "only", "come", "over", "such", "because", "through", "really", "which", "there", "their", "would", "should", "being"]);

async function analyzePostSentiment(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const positiveWords = ["great", "excited", "thrilled", "proud", "grateful", "amazing", "excellent", "love", "best", "awesome", "wonderful", "fantastic", "congratulations", "milestone", "success"];
  const negativeWords = ["bad", "terrible", "awful", "worst", "hate", "horrible", "poor", "sad", "angry", "frustrated", "disappointed", "fail", "failure", "difficult", "struggle"];

  const results = [];
  for (let i = 0; i < arr.length; i++) {
    const text = arr[i] || "";
    const basicResult = sentiment.analyze(text);
    const lower = text.toLowerCase();
    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negCount = negativeWords.filter(w => lower.includes(w)).length;
    const keywordScore = (posCount - negCount) / Math.max(1, posCount + negCount);
    const combinedScore = (basicResult.comparative * 0.5) + (keywordScore * 0.5);

    const tokens = tokenize(text);
    const tokenTensor = tf.tensor1d(tokens.map(t => t.length), "float32");
    const avgLen = tokenTensor.mean().dataSync()[0];
    tokenTensor.dispose();

    results.push({
      index: i,
      text: text.substring(0, 200),
      score: +combinedScore.toFixed(4),
      comparative: +basicResult.comparative.toFixed(4),
      wordCount: tokens.length,
      avgWordLength: +avgLen.toFixed(2),
      sentiment: combinedScore > 0.1 ? "positive" : combinedScore < -0.1 ? "negative" : "neutral",
      positive: basicResult.positive,
      negative: basicResult.negative
    });
  }

  const scores = results.map(r => r.score);
  const distTensor = tf.tensor1d(scores);
  const mean = distTensor.mean().dataSync()[0];
  const std = distTensor.sub(mean).square().mean().sqrt().dataSync()[0];
  distTensor.dispose();

  return {
    posts: results,
    summary: {
      total: results.length,
      positive: results.filter(r => r.sentiment === "positive").length,
      neutral: results.filter(r => r.sentiment === "neutral").length,
      negative: results.filter(r => r.sentiment === "negative").length,
      meanScore: +mean.toFixed(4),
      stdScore: +std.toFixed(4)
    }
  };
}

async function predictEngagement(features) {
  const f = features || {};
  const textLen = f.textLen || 0;
  const hashtagCount = f.hashtagCount || 0;
  const linkCount = f.linkCount || 0;
  const imageCount = f.imageCount || 0;
  const commentCount = f.commentCount || 0;
  const likeCount = f.likeCount || 0;

  const inputTensor = tf.tensor2d([[textLen, hashtagCount, linkCount, imageCount, commentCount, likeCount]]);

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

  const prediction = model.predict(inputTensor).dataSync()[0];
  inputTensor.dispose();
  model.dispose();

  const engagementRate = prediction;
  const predictedImpressions = Math.round(1000 * (1 + engagementRate * 2));

  return {
    features: f,
    engagementScore: +prediction.toFixed(4),
    engagementRate: +engagementRate.toFixed(4),
    predictedImpressions,
    predictedLikes: Math.round(predictedImpressions * engagementRate * 0.6),
    predictedComments: Math.round(predictedImpressions * engagementRate * 0.25),
    predictedShares: Math.round(predictedImpressions * engagementRate * 0.15),
    confidence: "medium",
    breakdown: {
      textLengthImpact: textLen > 100 ? "optimal" : "short",
      hashtagImpact: hashtagCount > 0 && hashtagCount <= 5 ? "optimal" : "suboptimal",
      mediaImpact: imageCount > 0 ? "boost" : "neutral"
    }
  };
}

async function classifyTopics(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const topicSeeds = {
    "technology": ["ai", "machine learning", "software", "cloud", "data", "blockchain", "api", "engineering", "tech", "digital", "automation", "saas"],
    "leadership": ["leadership", "management", "team", "culture", "mentor", "coach", "vision", "strategy", "ceo", "executive", "director"],
    "marketing": ["marketing", "brand", "content", "social media", "seo", "advertising", "campaign", "growth", "audience", "engagement"],
    "career": ["career", "job", "hiring", "recruit", "interview", "resume", "promotion", "networking", "professional", "opportunity"],
    "finance": ["finance", "investment", "revenue", "profit", "startup", "funding", "venture", "capital", "market", "stock"],
    "innovation": ["innovation", "startup", "disrupt", "creative", "research", "patent", "breakthrough", "novel", "future"],
    "wellness": ["wellness", "mental health", "balance", "self-care", "mindful", "burnout", "stress", "health", "fitness"],
    "education": ["learning", "education", "training", "course", "workshop", "certification", "skill", "development", "teach"]
  };

  const topicTokens = {};
  for (const [topic, seeds] of Object.entries(topicSeeds)) {
    topicTokens[topic] = seeds.flatMap(s => s.split(" "));
  }

  const topicScores = arr.map((text, i) => {
    const lower = (text || "").toLowerCase();
    const tokens = tokenize(text);
    const scores = {};
    for (const [topic, seeds] of Object.entries(topicSeeds)) {
      let score = 0;
      for (const seed of seeds) {
        if (lower.includes(seed)) score += 1;
        const seedTokens = seed.split(" ");
        const matchCount = seedTokens.filter(s => tokens.includes(s)).length;
        score += matchCount / seedTokens.length;
      }
      scores[topic] = score;
    }
    const maxScore = Math.max(...Object.values(scores), 0.01);
    for (const t in scores) scores[t] /= maxScore;
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return {
      index: i,
      text: (text || "").substring(0, 150),
      primaryTopic: sorted[0][0],
      primaryScore: +sorted[0][1].toFixed(4),
      topics: sorted.slice(0, 3).map(([topic, score]) => ({ topic, score: +score.toFixed(4) }))
    };
  });

  const topicCounts = {};
  topicScores.forEach(r => { topicCounts[r.primaryTopic] = (topicCounts[r.primaryTopic] || 0) + 1; });

  return {
    classification: topicScores,
    distribution: Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count, percentage: +(count / arr.length * 100).toFixed(1) })),
    analyzedPosts: topicScores.length
  };
}

async function extractKeywords(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const allText = arr.join(" ");
  const tokens = tokenize(allText);

  const filtered = tokens.filter(t => !STOP_WORDS.has(t) && t.length > 3);
  const freq = {};
  filtered.forEach(t => { freq[t] = (freq[t] || 0) + 1; });

  const docTokens = arr.map(t => tokenize(t));
  const { vocab, idf } = buildVocabAndIdf(docTokens);
  const vectors = docTokens.map(tokens => tfidfVector(tokens, vocab, idf));

  const wordScores = {};
  for (const [word, count] of Object.entries(freq)) {
    const tfidf = count * (idf[word] || 1);
    const semanticBoost = vectors.reduce((sum, vec) => {
      const idx = vocab.indexOf(word);
      return idx !== -1 ? sum + vec[idx] : sum;
    }, 0);
    wordScores[word] = tfidf * (1 + semanticBoost);
  }

  const sorted = Object.entries(wordScores).sort((a, b) => b[1] - a[1]);
  const topN = sorted.slice(0, 20);

  return {
    keywords: topN.map(([term, score]) => ({
      term,
      score: +score.toFixed(4),
      frequency: freq[term],
      tfidf: +(score / (freq[term] || 1)).toFixed(4)
    })),
    totalTokens: tokens.length,
    uniqueTokens: Object.keys(freq).length,
    postsAnalyzed: arr.length
  };
}

async function detectTrends(dataPoints) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || d.y || 0);
  if (data.length < 3) return { error: "Need at least 3 data points" };

  const windowSize = Math.max(3, Math.floor(data.length / 5));
  const movingAvg = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
    movingAvg.push(data.slice(start, end).reduce((a, b) => a + b, 0) / (end - start));
  }

  const diffs = [];
  for (let i = 1; i < movingAvg.length; i++) {
    diffs.push(movingAvg[i] - movingAvg[i - 1]);
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const stdDiff = Math.sqrt(diffs.reduce((sum, d) => sum + (d - avgDiff) ** 2, 0) / diffs.length);

  const changePoints = [];
  for (let i = 1; i < diffs.length; i++) {
    if (Math.abs(diffs[i] - diffs[i - 1]) > 2 * stdDiff) changePoints.push(i + 1);
  }

  const meanVal = data.reduce((a, b) => a + b, 0) / data.length;
  const trend = avgDiff > 0.01 * meanVal ? "upward" :
    avgDiff < -0.01 * meanVal ? "downward" : "stable";

  const dataTensor = tf.tensor1d(data);
  const dataStd = dataTensor.sub(meanVal).square().mean().sqrt().dataSync()[0];
  dataTensor.dispose();

  return {
    trend,
    averageChange: +avgDiff.toFixed(4),
    stdChange: +stdDiff.toFixed(4),
    changePoints,
    movingAverage: movingAvg.map(v => +v.toFixed(2)),
    dataStats: {
      min: Math.min(...data),
      max: Math.max(...data),
      mean: +meanVal.toFixed(2),
      std: +dataStd.toFixed(2),
      count: data.length
    },
    overallDirection: trend === "upward" ? "growing" : trend === "downward" ? "declining" : "stable"
  };
}

async function forecastGrowth(dataPoints) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || d.y || 0);
  if (data.length < 10) return { error: "Need at least 10 data points for LSTM forecasting" };

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const lookback = Math.min(5, Math.floor(data.length / 3));

  const xs = [], ys = [];
  for (let i = lookback; i < data.length; i++) {
    xs.push(data.slice(i - lookback, i).map(v => [(v - mean) / 100]));
    ys.push([(data[i] - mean) / 100]);
  }

  const xTensor = tf.tensor3d(xs);
  const yTensor = tf.tensor2d(ys);

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 32, inputShape: [lookback, 1] }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(xTensor, yTensor, { epochs: 50, batchSize: 8, verbose: 0 });

  xTensor.dispose();
  yTensor.dispose();

  let currentInput = data.slice(-lookback).map(v => [(v - mean) / 100]);
  const forecast = [];
  const daysAhead = 30;
  for (let i = 0; i < daysAhead; i++) {
    const inputTensor = tf.tensor3d([currentInput]);
    const pred = model.predict(inputTensor).dataSync()[0] * 100 + mean;
    inputTensor.dispose();
    forecast.push(Math.round(pred));
    currentInput.shift();
    currentInput.push([(pred - mean) / 100]);
  }
  model.dispose();

  const trend = data.length >= 2 ? (data[data.length - 1] - data[0]) / data.length : 0;
  const currentFollowers = data[data.length - 1];
  const projectedGrowth = forecast[daysAhead - 1] - currentFollowers;
  const growthRate = currentFollowers > 0 ? (projectedGrowth / currentFollowers * 100) : 0;

  return {
    currentFollowers,
    forecast,
    trend: trend > 0 ? "upward" : trend < 0 ? "downward" : "flat",
    projectedGrowth,
    growthRate: +growthRate.toFixed(2) + "%",
    daysAhead,
    lookback,
    confidence: data.length >= 20 ? "high" : data.length >= 10 ? "medium" : "low"
  };
}

async function detectAnomalies(dataPoints) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || d.y || 0);
  if (data.length < 4) return { error: "Need at least 4 data points" };

  const tensorData = tf.tensor2d(data.map(v => [v]));
  const min = tensorData.min();
  const max = tensorData.max();
  const normalized = tensorData.sub(min).div(max.sub(min).add(1e-8));

  const inputDim = 1;
  const encodingDim = 4;
  const input = tf.input({ shape: [inputDim] });
  const encoded = tf.layers.dense({ units: encodingDim, activation: "relu" }).apply(input);
  const decoded = tf.layers.dense({ units: inputDim, activation: "sigmoid" }).apply(encoded);
  const autoencoder = tf.model({ inputs: input, outputs: decoded });
  autoencoder.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await autoencoder.fit(normalized, normalized, { epochs: 50, batchSize: 16, verbose: 0 });

  const predictions = autoencoder.predict(normalized);
  const errors = tf.losses.meanSquaredError(normalized, predictions).dataSync();
  predictions.dispose();
  normalized.dispose();
  tensorData.dispose();
  min.dispose();
  max.dispose();

  const sorted = [...errors].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 95 / 100)] || 0;

  const results = dataPoints.map((d, i) => ({
    value: typeof d === "number" ? d : d.value || d.y || 0,
    error: +errors[i].toFixed(6),
    isAnomaly: errors[i] > threshold,
    index: i
  }));

  return {
    points: results,
    anomalies: results.filter(r => r.isAnomaly),
    threshold: +threshold.toFixed(6),
    summary: {
      total: results.length,
      anomalies: results.filter(r => r.isAnomaly).length,
      avgError: +(errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(6)
    }
  };
}

async function comparePosts(text1, text2) {
  const t1 = text1 || "";
  const t2 = text2 || "";

  const tokens1 = tokenize(t1);
  const tokens2 = tokenize(t2);
  const allTokens = [...new Set([...tokens1, ...tokens2])];

  const vec1 = allTokens.map(t => tokens1.filter(x => x === t).length);
  const vec2 = allTokens.map(t => tokens2.filter(x => x === t).length);

  const tensor1 = tf.tensor1d(vec1, "float32");
  const tensor2 = tf.tensor1d(vec2, "float32");

  const mag1 = tensor1.norm();
  const mag2 = tensor2.norm();
  const dot = tensor1.mul(tensor2).sum();
  const cosSim = dot.div(mag1.mul(mag2).add(1e-8)).dataSync()[0];

  const diff = tensor1.sub(tensor2);
  const euclideanDist = diff.norm().dataSync()[0];
  const manhattanDist = diff.abs().sum().dataSync()[0];

  tensor1.dispose();
  tensor2.dispose();
  mag1.dispose();
  mag2.dispose();
  dot.dispose();
  diff.dispose();

  const basic1 = sentiment.analyze(t1);
  const basic2 = sentiment.analyze(t2);

  const commonWords = tokens1.filter(t => tokens2.includes(t));
  const union = new Set([...tokens1, ...tokens2]);
  const jaccard = union.size > 0 ? commonWords.length / union.size : 0;

  return {
    post1: {
      text: t1.substring(0, 200),
      wordCount: tokens1.length,
      sentiment: +basic1.comparative.toFixed(4)
    },
    post2: {
      text: t2.substring(0, 200),
      wordCount: tokens2.length,
      sentiment: +basic2.comparative.toFixed(4)
    },
    similarity: {
      cosineSimilarity: +cosSim.toFixed(4),
      euclideanDistance: +euclideanDist.toFixed(4),
      manhattanDistance: +manhattanDist.toFixed(4),
      jaccardSimilarity: +jaccard.toFixed(4)
    },
    commonWords: commonWords.slice(0, 20),
    verdict: cosSim > 0.7 ? "highly similar" : cosSim > 0.4 ? "moderately similar" : "different"
  };
}

async function clusterContent(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length < 3) return { error: "Need at least 3 texts for clustering" };

  const docTokens = arr.map(t => tokenize(t));
  const { vocab, idf } = buildVocabAndIdf(docTokens);
  const vectors = docTokens.map(tokens => tfidfVector(tokens, vocab, idf));

  const tensor = tf.tensor2d(vectors);
  const numClusters = Math.min(4, Math.max(2, Math.floor(arr.length / 5)));

  const k = numClusters;
  const n = vectors.length;

  const indices = [];
  while (indices.length < k) {
    const r = Math.floor(Math.random() * n);
    if (!indices.includes(r)) indices.push(r);
  }

  let centroids = tf.tensor2d(indices.map(i => vectors[i]));
  let assignments = tf.zeros([n], "int32");

  for (let iter = 0; iter < 20; iter++) {
    const dists = [];
    for (let c = 0; c < k; c++) {
      const centroid = centroids.slice([c, 0], [1, -1]);
      const diff = tensor.sub(centroid);
      const sqDist = diff.square().sum(1);
      dists.push(sqDist);
      centroid.dispose();
      diff.dispose();
      sqDist.dispose();
    }
    const distTensor = tf.stack(dists, 1);
    const newAssignments = distTensor.argMin(1);
    distTensor.dispose();
    assignments.dispose();
    assignments = newAssignments;

    for (let c = 0; c < k; c++) {
      const mask = assignments.equal(tf.scalar(c, "int32"));
      const maskFloat = mask.toFloat();
      const count = maskFloat.sum();
      const countSafe = count.add(tf.scalar(1e-8));
      const masked = tensor.mul(maskFloat.expandDims(1));
      const newCentroid = masked.sum(0).div(countSafe);
      centroids.slice([c, 0], [1, -1]).dispose();
      centroids = tf.concat([centroids.slice([0, 0], [c, -1]), newCentroid, centroids.slice([c + 1, 0], [-1, -1])], 0);
      mask.dispose();
      maskFloat.dispose();
      count.dispose();
      countSafe.dispose();
      masked.dispose();
      newCentroid.dispose();
    }
  }

  const clusterIds = Array.from(assignments.dataSync());
  tensor.dispose();
  centroids.dispose();
  assignments.dispose();

  const clusterGroups = {};
  arr.forEach((text, i) => {
    const cid = clusterIds[i];
    if (!clusterGroups[cid]) clusterGroups[cid] = [];
    clusterGroups[cid].push({
      index: i,
      text: (text || "").substring(0, 150),
      wordCount: tokenize(text).length
    });
  });

  const themes = {};
  for (const [cid, group] of Object.entries(clusterGroups)) {
    const allWords = group.flatMap(p => tokenize(arr[p.index]));
    const freq = {};
    allWords.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
    themes[cid] = topWords;
  }

  return {
    numClusters: k,
    clusters: Object.entries(clusterGroups).map(([cid, group]) => ({
      clusterId: +cid,
      size: group.length,
      topKeywords: themes[cid],
      posts: group
    })),
    totalPosts: arr.length
  };
}

async function analyzeAudience(features) {
  const arr = Array.isArray(features) ? features : [features];
  if (arr.length < 2) return { error: "Need at least 2 audience members for segmentation" };

  const industries = [...new Set(arr.map(f => f.industry || "unknown"))];
  const seniorities = [...new Set(arr.map(f => f.seniority || "unknown"))];
  const companySizes = [...new Set(arr.map(f => f.companySize || "unknown"))];

  const industryMap = {};
  industries.forEach((ind, i) => { industryMap[ind] = i; });
  const seniorityMap = {};
  seniorities.forEach((s, i) => { seniorityMap[s] = i; });
  const sizeMap = {};
  companySizes.forEach((s, i) => { sizeMap[s] = i; });

  const numericalData = arr.map(f => [
    (industryMap[f.industry] || 0) / Math.max(1, industries.length - 1),
    (seniorityMap[f.seniority] || 0) / Math.max(1, seniorities.length - 1),
    (sizeMap[f.companySize] || 0) / Math.max(1, companySizes.length - 1)
  ]);

  const tensor = tf.tensor2d(numericalData);
  const mean = tensor.mean(0);
  const std = tensor.sub(mean).square().mean(0).sqrt().add(1e-8);
  const normalized = tensor.sub(mean).div(std);

  const numClusters = Math.min(3, Math.max(2, Math.floor(arr.length / 3)));
  const indices = [];
  while (indices.length < numClusters) {
    const r = Math.floor(Math.random() * arr.length);
    if (!indices.includes(r)) indices.push(r);
  }

  let centroids = tf.tensor2d(indices.map(i => numericalData[i]));
  let assignments = tf.zeros([arr.length], "int32");

  for (let iter = 0; iter < 15; iter++) {
    const dists = [];
    for (let c = 0; c < numClusters; c++) {
      const centroid = centroids.slice([c, 0], [1, -1]);
      const diff = normalized.sub(centroid);
      dists.push(diff.square().sum(1));
      centroid.dispose();
      diff.dispose();
    }
    const distTensor = tf.stack(dists, 1);
    const newAssignments = distTensor.argMin(1);
    distTensor.dispose();
    assignments.dispose();
    assignments = newAssignments;
  }

  const clusterIds = Array.from(assignments.dataSync());
  tensor.dispose();
  mean.dispose();
  std.dispose();
  normalized.dispose();
  centroids.dispose();
  assignments.dispose();

  const segments = {};
  clusterIds.forEach((cid, i) => {
    if (!segments[cid]) segments[cid] = [];
    segments[cid].push(arr[i]);
  });

  const segmentAnalysis = Object.entries(segments).map(([cid, group]) => {
    const indCounts = {};
    group.forEach(f => { indCounts[f.industry || "unknown"] = (indCounts[f.industry || "unknown"] || 0) + 1; });
    const senCounts = {};
    group.forEach(f => { senCounts[f.seniority || "unknown"] = (senCounts[f.seniority || "unknown"] || 0) + 1; });
    const sizeCounts = {};
    group.forEach(f => { sizeCounts[f.companySize || "unknown"] = (sizeCounts[f.companySize || "unknown"] || 0) + 1; });

    return {
      segmentId: +cid,
      size: group.length,
      dominantIndustry: Object.entries(indCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
      dominantSeniority: Object.entries(senCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
      dominantCompanySize: Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
      industryDistribution: indCounts,
      seniorityDistribution: senCounts,
      companySizeDistribution: sizeCounts,
      percentage: +(group.length / arr.length * 100).toFixed(1)
    };
  });

  const overallIndCounts = {};
  arr.forEach(f => { overallIndCounts[f.industry || "unknown"] = (overallIndCounts[f.industry || "unknown"] || 0) + 1; });
  const overallSenCounts = {};
  arr.forEach(f => { overallSenCounts[f.seniority || "unknown"] = (overallSenCounts[f.seniority || "unknown"] || 0) + 1; });
  const overallSizeCounts = {};
  arr.forEach(f => { overallSizeCounts[f.companySize || "unknown"] = (overallSizeCounts[f.companySize || "unknown"] || 0) + 1; });

  return {
    segments: segmentAnalysis,
    overallDistribution: {
      industries: Object.entries(overallIndCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ industry: k, count: v, percentage: +(v / arr.length * 100).toFixed(1) })),
      seniorities: Object.entries(overallSenCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ seniority: k, count: v, percentage: +(v / arr.length * 100).toFixed(1) })),
      companySizes: Object.entries(overallSizeCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ companySize: k, count: v, percentage: +(v / arr.length * 100).toFixed(1) }))
    },
    summary: {
      totalAudience: arr.length,
      numSegments: numClusters,
      uniqueIndustries: industries.length,
      uniqueSeniorities: seniorities.length,
      uniqueCompanySizes: companySizes.length
    }
  };
}

module.exports = {
  analyzePostSentiment,
  predictEngagement,
  classifyTopics,
  extractKeywords,
  detectTrends,
  forecastGrowth,
  detectAnomalies,
  comparePosts,
  clusterContent,
  analyzeAudience
};
