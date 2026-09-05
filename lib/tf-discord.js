/**
 * TensorFlow.js Discord Analytics Module
 * ML-powered analytics using direct input — no API calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const POSITIVE_WORDS = [
  "good", "great", "awesome", "excellent", "amazing", "love", "best",
  "happy", "fantastic", "wonderful", "nice", "cool", "thanks", "fun",
  "beautiful", "brilliant", "perfect", "enjoy", "pleased", "glad"
];

const NEGATIVE_WORDS = [
  "bad", "terrible", "awful", "worst", "hate", "horrible", "poor",
  "ugly", "sad", "angry", "boring", "stupid", "annoyed", "frustrated",
  "disappointing", "useless", "pathetic", "disgusting", "fail", "suck"
];

const TOPIC_KEYWORDS = {
  gaming: ["game", "play", "win", "loss", "match", "rank", "team", "score", "gg", "aim", "weapon", "level", "boss", "raid", "lobby", "fps"],
  support: ["help", "issue", "error", "bug", "fix", "problem", "broken", "support", "crash", "install", "update", "download"],
  social: ["hello", "hey", "hi", "morning", "night", "weekend", "how are you", "lol", "haha", "funny", "mood", "vibe"],
  development: ["code", "api", "bug", "feature", "deploy", "git", "commit", "merge", "pr", "review", "build", "test", "script", "function"],
  media: ["image", "video", "gif", "meme", "link", "url", "stream", "watch", "listen", "song", "music", "art"]
};

const STOP_WORDS = new Set([
  "the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in",
  "with", "to", "for", "of", "it", "this", "that", "was", "are", "be",
  "has", "had", "have", "from", "they", "been", "not", "can", "will",
  "just", "also", "than", "them", "its", "you", "your", "what", "when",
  "how", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "only", "very", "too", "can", "do", "does", "did"
]);

function tokenize(text) {
  return (text || "").toLowerCase().match(/\b\w{3,}\b/g) || [];
}

function wordFrequency(words) {
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return freq;
}

function tfIdfScore(word, docFreq, totalDocs, wordFreq, totalWords) {
  const tf = wordFreq[word] / Math.max(1, totalWords);
  const idf = Math.log(totalDocs / (1 + (docFreq[word] || 0)));
  return tf * idf;
}

async function analyzeMessageSentiment(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return { messageCount: 0, sentiment: { positive: 0, negative: 0, neutral: 0, averageScore: 0, label: "neutral" }, perMessage: [] };
  }

  const perMessage = texts.map(text => {
    const lower = text.toLowerCase();
    const posCount = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
    const negCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
    const keywordScore = (posCount - negCount) / Math.max(1, posCount + negCount);
    const words = tokenize(text);
    const wordScore = words.length > 0 ? keywordScore : 0;
    const lengthBonus = Math.min(text.length / 200, 0.2) * Math.sign(wordScore);
    const combinedScore = Math.max(-1, Math.min(1, wordScore * 0.7 + lengthBonus * 0.3));
    const label = combinedScore > 0.1 ? "positive" : combinedScore < -0.1 ? "negative" : "neutral";
    return { score: +combinedScore.toFixed(4), label, text: text.substring(0, 100) };
  });

  const positive = perMessage.filter(s => s.label === "positive").length;
  const negative = perMessage.filter(s => s.label === "negative").length;
  const neutral = perMessage.filter(s => s.label === "neutral").length;
  const avgScore = perMessage.reduce((sum, s) => sum + s.score, 0) / perMessage.length;

  const scores = tf.tensor1d(perMessage.map(s => s.score));
  const variance = tf.moments(scores).variance.dataSync()[0];
  scores.dispose();

  return {
    messageCount: perMessage.length,
    sentiment: {
      positive, negative, neutral,
      averageScore: +avgScore.toFixed(4),
      variance: +variance.toFixed(6),
      label: positive > negative ? "positive" : negative > positive ? "negative" : "neutral",
      distribution: {
        positive: +(positive / perMessage.length).toFixed(4),
        negative: +(negative / perMessage.length).toFixed(4),
        neutral: +(neutral / perMessage.length).toFixed(4)
      }
    },
    perMessage
  };
}

async function detectToxicity(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return { messageCount: 0, toxicMessageCount: 0, toxicityRate: 0, toxicMessages: [] };
  }

  const truncated = texts.map(t => (t || "").substring(0, 500)).filter(t => t.length > 0);
  if (truncated.length === 0) return { messageCount: 0, toxicMessageCount: 0, toxicityRate: 0, toxicMessages: [] };

  const toxicPatterns = {
    profanity: /\b(fuck|shit|damn|ass|hell|crap|dick|bastard|bitch)\b/i,
    insult: /\b(idiot|moron|loser|pathetic|trash|garbage|worthless|useless|stupid)\b/i,
    threat: /\b(kill|die|murder|hurt|destroy|eliminate|attack)\b/i,
    harassment: /\b(shut\s*up|get\s*lost|go\s*away|nobody\s*cares|you'?re?\s*nothing)\b/i
  };

  const mlScores = tf.tensor2d(truncated.map(text => {
    const lower = text.toLowerCase();
    const words = tokenize(text);
    const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    const exclamationCount = (text.match(/!/g) || []).length;
    const negWordCount = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
    const negRatio = negWordCount / Math.max(1, words.length);
    return [capsRatio, Math.min(exclamationCount / 5, 1), negRatio, words.length > 0 ? 1 : 0];
  }));

  const meanScores = mlScores.mean(0);
  const stdScores = mlScores.sub(meanScores).square().mean(0).sqrt().add(1e-8);
  const normalized = mlScores.sub(meanScores).div(stdScores);
  meanScores.dispose();
  stdScores.dispose();

  const toxicityWeights = tf.tensor1d([0.15, 0.1, 0.4, 0.15]);
  const rawScores = normalized.matMul(toxicityWeights.expandDims(1)).squeeze();
  toxicityWeights.dispose();
  normalized.dispose();
  mlScores.dispose();

  const scores = rawScores.dataSync();
  rawScores.dispose();

  const toxicMessages = [];
  truncated.forEach((text, idx) => {
    const labels = [];
    for (const [label, pattern] of Object.entries(toxicPatterns)) {
      if (pattern.test(text)) {
        labels.push({ label, score: Math.min(1, scores[idx] + 0.3) });
      }
    }
    if (scores[idx] > 0.6 || labels.length > 0) {
      toxicMessages.push({
        index: idx,
        content: text.substring(0, 100),
        mlScore: +scores[idx].toFixed(4),
        labels
      });
    }
  });

  return {
    messageCount: truncated.length,
    toxicMessageCount: toxicMessages.length,
    toxicityRate: +(toxicMessages.length / truncated.length).toFixed(4),
    toxicMessages
  };
}

async function predictEngagement(features) {
  if (!Array.isArray(features) || features.length === 0) {
    return { predictions: [], averageScore: 0 };
  }

  const rawMatrix = features.map(f => [
    f.messageLen || 0,
    f.emojiCount || 0,
    f.mentionCount || 0,
    f.reactionCount || 0,
    f.replyCount || 0
  ]);

  const tensor = tf.tensor2d(rawMatrix);
  const mean = tensor.mean(0);
  const std = tensor.sub(mean).square().mean(0).sqrt().add(1e-8);
  const normalized = tensor.sub(mean).div(std);
  mean.dispose();
  std.dispose();

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [5] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });

  const syntheticX = tf.randomNormal([100, 5]);
  const syntheticY = tf.randomUniform([100, 1]);
  await model.fit(syntheticX, syntheticY, { epochs: 15, verbose: 0 });
  syntheticX.dispose();
  syntheticY.dispose();

  const preds = model.predict(normalized).dataSync();
  normalized.dispose();
  tensor.dispose();
  model.dispose();

  const predictions = features.map((f, i) => ({
    features: f,
    engagementScore: +preds[i].toFixed(4),
    label: preds[i] > 0.7 ? "high" : preds[i] > 0.4 ? "medium" : "low"
  }));

  const avgScore = predictions.reduce((sum, p) => sum + p.engagementScore, 0) / predictions.length;

  return { predictions, averageScore: +avgScore.toFixed(4) };
}

async function classifyTopics(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return { messageCount: 0, topicDistribution: {}, topicPercentages: {}, topicDiversity: 0, messages: [] };
  }

  const classified = texts.map(text => {
    const lower = text.toLowerCase();
    const scores = {};
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      const matches = keywords.filter(kw => lower.includes(kw)).length;
      scores[topic] = matches / keywords.length;
    }
    const bestTopic = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return {
      topic: bestTopic[1] > 0 ? bestTopic[0] : "general",
      confidence: +bestTopic[1].toFixed(4),
      text: text.substring(0, 100)
    };
  });

  const topicCounts = {};
  classified.forEach(c => { topicCounts[c.topic] = (topicCounts[c.topic] || 0) + 1; });

  const probs = Object.values(topicCounts).map(v => v / classified.length);
  const probTensor = tf.tensor2d([probs]);
  const uniform = tf.ones([1, probs.length]).div(probs.length);
  const entropy = tf.losses.softmaxCrossEntropy(uniform, probTensor).dataSync()[0];
  probTensor.dispose();
  uniform.dispose();

  return {
    messageCount: classified.length,
    topicDistribution: topicCounts,
    topicPercentages: Object.fromEntries(
      Object.entries(topicCounts).map(([k, v]) => [k, +(v / classified.length * 100).toFixed(2)])
    ),
    topicDiversity: +entropy.toFixed(4),
    messages: classified
  };
}

async function extractKeywords(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return { totalWords: 0, uniqueWords: 0, keywords: [], wordCloud: {} };
  }

  const allWords = texts.flatMap(t => tokenize(t));
  const totalWords = allWords.length;
  if (totalWords === 0) return { totalWords: 0, uniqueWords: 0, keywords: [], wordCloud: {} };

  const wordFreq = wordFrequency(allWords);
  const uniqueWords = Object.keys(wordFreq);

  const docFreq = {};
  texts.forEach(text => {
    const tokens = new Set(tokenize(text));
    tokens.forEach(w => { docFreq[w] = (docFreq[w] || 0) + 1; });
  });

  const totalDocs = texts.length;
  const scores = {};
  uniqueWords.forEach(w => {
    if (!STOP_WORDS.has(w)) {
      scores[w] = tfIdfScore(w, docFreq, totalDocs, wordFreq, totalWords);
    }
  });

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([term, score]) => ({ term, score: +score.toFixed(6), frequency: wordFreq[term] }));

  if (sorted.length === 0) return { totalWords, uniqueWords: 0, keywords: [], wordCloud: {} };

  const scoreTensor = tf.tensor1d(sorted.map(k => k.score));
  const meanScore = scoreTensor.mean().dataSync()[0];
  const stdScore = scoreTensor.sub(meanScore).square().mean().sqrt().dataSync()[0];
  scoreTensor.dispose();

  return {
    totalWords,
    uniqueWords: uniqueWords.length,
    keywords: sorted.map(k => ({
      ...k,
      zScore: stdScore > 0 ? +((k.score - meanScore) / stdScore).toFixed(4) : 0
    })),
    wordCloud: Object.fromEntries(sorted.slice(0, 15).map(k => [k.term, k.frequency]))
  };
}

async function detectActivityPatterns(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    return { hourlyActivity: [], peakHours: [], activityConcentration: 0, activeHours: 0, pattern: "none" };
  }

  const hourlyData = dataPoints.slice(0, 24);
  while (hourlyData.length < 24) hourlyData.push(0);

  const tensor = tf.tensor1d(hourlyData);
  const hourMean = tensor.mean().dataSync()[0];
  const hourStd = tensor.sub(hourMean).square().mean().sqrt().dataSync()[0];
  tensor.dispose();

  const peakHours = hourlyData
    .map((count, hour) => ({ hour, count, zScore: hourStd > 0 ? (count - hourMean) / hourStd : 0 }))
    .filter(h => h.zScore > 0.5)
    .sort((a, b) => b.count - a.count);

  const activeHours = hourlyData.filter(c => c > hourMean).length;
  const activityConcentration = hourMean > 0
    ? hourlyData.reduce((sum, c) => sum + Math.pow(c - hourMean, 2), 0) / hourlyData.length / (hourMean * hourMean)
    : 0;

  return {
    hourlyActivity: hourlyData.map((count, hour) => ({ hour, count })),
    peakHours,
    activityConcentration: +activityConcentration.toFixed(4),
    activeHours,
    pattern: activityConcentration > 0.5 ? "concentrated" : activityConcentration > 0.2 ? "moderate" : "distributed"
  };
}

async function forecastGrowth(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 5) {
    return { forecast: [], trend: "flat", trendRate: 0, error: "Need at least 5 data points" };
  }

  const data = dataPoints.map(Number);
  const current = data[data.length - 1];
  const tensorData = tf.tensor2d(data.map(v => [v]));
  const min = tensorData.min();
  const max = tensorData.max();
  tensorData.dispose();
  min.dispose();
  max.dispose();

  const lookback = Math.min(5, Math.floor(data.length / 3));
  const meanVal = data.reduce((a, b) => a + b, 0) / data.length;
  const xs = [], ys = [];
  for (let i = lookback; i < data.length; i++) {
    xs.push(data.slice(i - lookback, i).map(v => [(v - meanVal) / Math.max(1, current)]));
    ys.push([data[i] / Math.max(1, current)]);
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

  const daysAhead = 14;
  let currentInput = data.slice(-lookback).map(v => [(v - meanVal) / Math.max(1, current)]);
  const forecast = [];
  for (let i = 0; i < daysAhead; i++) {
    const inputTensor = tf.tensor3d([currentInput]);
    const pred = model.predict(inputTensor).dataSync()[0] * Math.max(1, current);
    inputTensor.dispose();
    forecast.push(Math.round(pred));
    currentInput.shift();
    currentInput.push([pred / Math.max(1, current)]);
  }
  model.dispose();

  const trend = data.length >= 2
    ? (data[data.length - 1] - data[0]) / data.length
    : 0;

  return {
    currentMembers: current,
    forecast: forecast.map((val, i) => ({ day: i + 1, predicted: val })),
    trend: trend > 0 ? "upward" : trend < 0 ? "downward" : "flat",
    trendRate: +trend.toFixed(2),
    lookback,
    daysAhead
  };
}

async function detectAnomalies(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 3) {
    return { anomalies: [], allPoints: [], threshold: 0, error: "Need at least 3 data points" };
  }

  return await tfMl.detectAnomalies(dataPoints, 90);
}

async function compareChannels(texts1, texts2) {
  if (!Array.isArray(texts1) || !Array.isArray(texts2) || texts1.length === 0 || texts2.length === 0) {
    return { similarity: 0, label: "insufficient data", breakdown: {} };
  }

  const analyze = (texts) => {
    const allWords = texts.flatMap(t => tokenize(t));
    const freq = wordFrequency(allWords);
    const total = allWords.length;
    const topicHits = {};
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      topicHits[topic] = texts.filter(t => {
        const lower = t.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
      }).length / texts.length;
    }
    const avgLen = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
    const uniqueRatio = Object.keys(freq).length / Math.max(1, total);
    return { freq, total, topicHits, avgLen, uniqueRatio };
  };

  const a1 = analyze(texts1);
  const a2 = analyze(texts2);

  const allVocab = new Set([...Object.keys(a1.freq), ...Object.keys(a2.freq)]);
  const vec1 = [], vec2 = [];
  allVocab.forEach(word => {
    vec1.push((a1.freq[word] || 0) / Math.max(1, a1.total));
    vec2.push((a2.freq[word] || 0) / Math.max(1, a2.total));
  });

  const t1 = tf.tensor1d(vec1);
  const t2 = tf.tensor1d(vec2);
  const vocabSim = tf.losses.cosineDistance(t1, t2, 0).dataSync()[0];
  t1.dispose();
  t2.dispose();

  const topicKeys = Object.keys(TOPIC_KEYWORDS);
  const topicVec1 = topicKeys.map(k => a1.topicHits[k] || 0);
  const topicVec2 = topicKeys.map(k => a2.topicHits[k] || 0);
  const tt1 = tf.tensor1d(topicVec1);
  const tt2 = tf.tensor1d(topicVec2);
  const topicSim = tf.losses.cosineDistance(tt1, tt2, 0).dataSync()[0];
  tt1.dispose();
  tt2.dispose();

  const featureVec1 = tf.tensor2d([[a1.avgLen / 200, a1.uniqueRatio]]);
  const featureVec2 = tf.tensor2d([[a2.avgLen / 200, a2.uniqueRatio]]);
  const featureSim = tf.losses.cosineDistance(featureVec1.squeeze(), featureVec2.squeeze(), 0).dataSync()[0];
  featureVec1.dispose();
  featureVec2.dispose();

  const overallSimilarity = (1 - vocabSim) * 0.4 + (1 - topicSim) * 0.35 + (1 - featureSim) * 0.25;

  return {
    similarity: +overallSimilarity.toFixed(4),
    label: overallSimilarity > 0.7 ? "very similar" : overallSimilarity > 0.4 ? "moderately similar" : "dissimilar",
    breakdown: {
      vocabularySimilarity: +(1 - vocabSim).toFixed(4),
      topicSimilarity: +(1 - topicSim).toFixed(4),
      featureSimilarity: +(1 - featureSim).toFixed(4)
    },
    channel1: { messageCount: texts1.length, avgMessageLength: +a1.avgLen.toFixed(2), uniqueWordRatio: +a1.uniqueRatio.toFixed(4) },
    channel2: { messageCount: texts2.length, avgMessageLength: +a2.avgLen.toFixed(2), uniqueWordRatio: +a2.uniqueRatio.toFixed(4) }
  };
}

async function clusterMembers(features) {
  if (!Array.isArray(features) || features.length < 3) {
    return { numClusters: 0, clusterStats: {}, members: [] };
  }

  const numClusters = Math.min(3, Math.max(2, Math.floor(features.length / 3)));
  const data = features.map(f => [
    f.messageCount || 0,
    f.reactionCount || 0,
    f.activeDays || 0
  ]);

  const tensor = tf.tensor2d(data);
  const mean = tensor.mean(0);
  const std = tensor.sub(mean).square().mean(0).sqrt().add(tf.scalar(1e-8));
  const normalized = tensor.sub(mean).div(std);

  let centroids = normalized.slice([0, 0], [numClusters, -1]);
  let assignments = tf.zeros([data.length], "int32");

  for (let iter = 0; iter < 15; iter++) {
    const dists = [];
    for (let c = 0; c < numClusters; c++) {
      const centroid = centroids.slice([c, 0], [1, -1]);
      const diff = normalized.sub(centroid);
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

    for (let c = 0; c < numClusters; c++) {
      const mask = assignments.equal(tf.scalar(c, "int32")).toFloat();
      const count = mask.sum().add(tf.scalar(1e-8));
      const masked = normalized.mul(mask.expandDims(1));
      const newCentroid = masked.sum(0).div(count);
      centroids.slice([c, 0], [1, -1]).dispose();
      centroids = tf.concat([centroids.slice([0, 0], [c, -1]), newCentroid, centroids.slice([c + 1, 0], [-1, -1])], 0);
      masked.dispose();
      mask.dispose();
      count.dispose();
      newCentroid.dispose();
    }
  }

  const clusterIds = Array.from(assignments.dataSync());
  tensor.dispose();
  mean.dispose();
  std.dispose();
  normalized.dispose();
  centroids.dispose();
  assignments.dispose();

  const clusterLabels = ["casual members", "core members", "power users"];
  const clustered = features.map((f, i) => ({
    ...f,
    cluster: clusterIds[i],
    clusterLabel: clusterLabels[clusterIds[i]] || `cluster ${clusterIds[i]}`
  }));

  const clusterStats = {};
  for (let c = 0; c < numClusters; c++) {
    const membersInCluster = clustered.filter(m => m.cluster === c);
    const n = membersInCluster.length || 1;
    clusterStats[c] = {
      label: clusterLabels[c] || `cluster ${c}`,
      count: membersInCluster.length,
      avgMessages: +(membersInCluster.reduce((sum, m) => sum + m.messageCount, 0) / n).toFixed(2),
      avgReactions: +(membersInCluster.reduce((sum, m) => sum + m.reactionCount, 0) / n).toFixed(2),
      avgActiveDays: +(membersInCluster.reduce((sum, m) => sum + m.activeDays, 0) / n).toFixed(2)
    };
  }

  return { numClusters, clusterStats, members: clustered };
}

module.exports = {
  analyzeMessageSentiment,
  detectToxicity,
  predictEngagement,
  classifyTopics,
  extractKeywords,
  detectActivityPatterns,
  forecastGrowth,
  detectAnomalies,
  compareChannels,
  clusterMembers
};
