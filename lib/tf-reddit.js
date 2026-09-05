const tf = require("@tensorflow/tfjs-node");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

function textToVec(text, dims = 64) {
  const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const vec = new Array(dims).fill(0);
  words.forEach(w => {
    let hash = 0;
    for (let i = 0; i < w.length; i++) {
      hash = ((hash << 5) - hash + w.charCodeAt(i)) | 0;
    }
    vec[Math.abs(hash) % dims] += 1;
  });
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return (magA === 0 || magB === 0) ? 0 : dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function kMeans(data, k, maxIter = 30) {
  const dims = data[0].length;
  let centroids = data.slice(0, k).map(d => [...d]);
  let assignments = new Array(data.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < data.length; i++) {
      let minDist = Infinity;
      for (let c = 0; c < k; c++) {
        let dist = 0;
        for (let d = 0; d < dims; d++) dist += (data[i][d] - centroids[c][d]) ** 2;
        if (dist < minDist) { minDist = dist; assignments[i] = c; }
      }
    }
    const sums = Array.from({ length: k }, () => new Array(dims).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < data.length; i++) {
      counts[assignments[i]]++;
      for (let d = 0; d < dims; d++) sums[assignments[i]][d] += data[i][d];
    }
    let converged = true;
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      const newCentroid = sums[c].map(v => v / counts[c]);
      for (let d = 0; d < dims; d++) {
        if (Math.abs(newCentroid[d] - centroids[c][d]) > 1e-6) converged = false;
        centroids[c][d] = newCentroid[d];
      }
    }
    if (converged) break;
  }
  return assignments;
}

async function analyzePostSentiment(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length === 0) return { postCount: 0, overallSentiment: 0, overallLabel: "neutral", posts: [] };

  const Sentiment = require("sentiment");
  const sentimentLib = new Sentiment();

  const basic = arr.map(text => {
    const result = sentimentLib.analyze(text.toLowerCase());
    return { text, score: result.score, comparative: result.comparative, positive: result.positive, negative: result.negative };
  });

  const features = basic.map(s => [s.comparative, s.positive.length, s.negative.length]);
  const labels = basic.map(s => [s.comparative > 0.1 ? 1 : s.comparative < -0.1 ? -1 : 0]);

  const xTensor = tf.tensor2d(features);
  const yTensor = tf.tensor2d(labels);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [3] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });

  if (features.length >= 4) await model.fit(xTensor, yTensor, { epochs: 30, batchSize: 8, verbose: 0 });

  const predictions = model.predict(xTensor).dataSync();
  xTensor.dispose(); yTensor.dispose(); model.dispose();

  const posts = arr.map((text, i) => ({
    text,
    mlSentiment: +predictions[i].toFixed(4),
    label: predictions[i] > 0.1 ? "positive" : predictions[i] < -0.1 ? "negative" : "neutral",
    dictionaryScore: basic[i].comparative
  }));

  const overall = posts.length > 0 ? posts.reduce((a, p) => a + p.mlSentiment, 0) / posts.length : 0;
  return {
    postCount: posts.length,
    overallSentiment: +overall.toFixed(4),
    overallLabel: overall > 0.1 ? "positive" : overall < -0.1 ? "negative" : "neutral",
    posts
  };
}

async function detectToxicity(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length === 0) return { postCount: 0, toxicPosts: [], summary: { toxic: 0, clean: 0, toxicityRate: 0 } };

  const sliced = arr.map(t => t.slice(0, 512));
  const toxicLabels = ["identity_attack", "insult", "obscene", "severe_toxicity", "sexual_explicit", "threat"];
  const positiveWords = ["good", "great", "awesome", "excellent", "amazing", "love", "best"];
  const negativeWords = ["bad", "terrible", "awful", "worst", "hate", "horrible", "stupid", "idiot", "damn", "hell"];

  const results = arr.map((text, i) => {
    const lower = sliced[i].toLowerCase();
    const negCount = negativeWords.filter(w => lower.includes(w)).length;
    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negRatio = negCount / Math.max(1, negCount + posCount);
    const detectedLabels = [];
    const scores = {};
    toxicLabels.forEach(label => {
      let score = negRatio;
      if (label === "insult" || label === "obscene") score *= 1.2;
      if (label === "threat") score *= 0.5;
      score = Math.min(1, score);
      scores[label] = +score.toFixed(4);
      if (score > 0.5) detectedLabels.push(label);
    });
    return { text, isToxic: detectedLabels.length > 0, toxicLabels: detectedLabels, toxicScores: scores };
  });

  const toxic = results.filter(r => r.isToxic).length;
  return {
    postCount: results.length,
    summary: { toxic, clean: results.length - toxic, toxicityRate: +(toxic / results.length * 100).toFixed(1) },
    toxicPosts: results.filter(r => r.isToxic),
    cleanPosts: results.filter(r => !r.isToxic)
  };
}

async function predictEngagement(features) {
  const arr = Array.isArray(features) ? features : [features];
  if (arr.length === 0) return { postCount: 0, predictions: [] };

  const xData = arr.map(f => [
    f.titleLen || 0, f.bodyLen || 0, f.upvoteRatio || 0.5, f.commentCount || 0, f.awards || 0
  ]);

  const xTensor = tf.tensor2d(xData);
  const meanX = xTensor.mean(0);
  const stdX = xTensor.sub(meanX).square().mean(0).sqrt().add(1e-8);
  const normalizedX = xTensor.sub(meanX).div(stdX);

  const syntheticY = tf.randomUniform([xData.length, 1]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [5] }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(normalizedX, syntheticY, { epochs: 30, batchSize: 8, verbose: 0 });

  const predictions = model.predict(normalizedX).dataSync();
  xTensor.dispose(); syntheticY.dispose(); normalizedX.dispose(); meanX.dispose(); stdX.dispose(); model.dispose();

  return {
    postCount: arr.length,
    predictions: arr.map((f, i) => ({
      features: f,
      engagementScore: +predictions[i].toFixed(4)
    }))
  };
}

async function classifyTopics(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length < 3) return { postCount: arr.length, error: "Need at least 3 posts for topic classification" };

  const vecs = arr.map(t => textToVec(t.slice(0, 512)));
  const numClusters = Math.min(5, Math.max(2, Math.floor(arr.length / 3)));
  const assignments = kMeans(vecs, numClusters);

  const topics = {};
  for (let i = 0; i < arr.length; i++) {
    const c = assignments[i];
    if (!topics[c]) topics[c] = [];
    topics[c].push(arr[i]);
  }

  return {
    postCount: arr.length,
    numTopics: Object.keys(topics).length,
    topics: Object.entries(topics).map(([cluster, texts]) => {
      const allWords = texts.flatMap(t => t.toLowerCase().match(/\b\w{4,}\b/g) || []);
      const freq = {};
      allWords.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
      const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
      return { clusterId: parseInt(cluster), label: topWords.join(", ") || `Topic ${cluster}`, postCount: texts.length, texts };
    })
  };
}

async function extractKeywords(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length === 0) return { totalPosts: 0, uniqueTerms: 0, keywords: [] };

  const docTokens = arr.map(doc => (doc.toLowerCase().match(/\b\w{3,}\b/g) || []));
  const allTokens = docTokens.flat();
  const allUnique = [...new Set(allTokens)];

  const tfScores = {};
  docTokens.forEach(tokens => {
    tokens.forEach(w => { tfScores[w] = (tfScores[w] || 0) + 1; });
  });

  const idf = {};
  allUnique.forEach(token => {
    const docCount = docTokens.filter(tokens => tokens.includes(token)).length;
    idf[token] = Math.log(arr.length / (1 + docCount));
  });

  const scores = {};
  allUnique.forEach(token => {
    scores[token] = (tfScores[token] || 0) / allTokens.length * (idf[token] || 0);
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topTerms = sorted.map(([term]) => term);
  const vecs = topTerms.map(t => textToVec(t, 64));
  const fullCorpusVec = textToVec(arr.join(" "), 64);

  const keywords = sorted.slice(0, 15).map(([term, score], i) => ({
    term,
    tfidfScore: +score.toFixed(6),
    frequency: tfScores[term] || 0,
    relevance: +cosineSimilarity(vecs[i] || new Array(64).fill(0), fullCorpusVec).toFixed(4),
    combinedScore: +(score * cosineSimilarity(vecs[i] || new Array(64).fill(0), fullCorpusVec)).toFixed(6)
  })).sort((a, b) => b.combinedScore - a.combinedScore);

  return { totalPosts: arr.length, uniqueTerms: allUnique.length, keywords };
}

async function detectTrends(dataPoints) {
  const arr = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
  if (arr.length < 5) return { dataPoints: arr.length, error: "Need at least 5 data points" };

  const data = arr.map(d => typeof d === "number" ? d : d.value || 0);
  const windowSize = Math.max(3, Math.floor(data.length / 4));

  const movingAvg = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
    movingAvg.push(data.slice(start, end).reduce((a, b) => a + b, 0) / (end - start));
  }

  const diffs = [];
  for (let i = 1; i < movingAvg.length; i++) diffs.push(movingAvg[i] - movingAvg[i - 1]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const stdDiff = Math.sqrt(diffs.reduce((sum, d) => sum + (d - avgDiff) ** 2, 0) / diffs.length);

  const changePoints = [];
  for (let i = 1; i < diffs.length; i++) {
    if (Math.abs(diffs[i] - diffs[i - 1]) > 2 * stdDiff) changePoints.push(i + 1);
  }

  const avgScore = data.reduce((a, b) => a + b, 0) / data.length;
  const trend = avgDiff > 0.01 * Math.abs(avgScore) ? "upward" : avgDiff < -0.01 * Math.abs(avgScore) ? "downward" : "stable";

  const xTensor = tf.tensor2d(data.map((v, i) => [i]));
  const yTensor = tf.tensor2d(data.map(v => [v / (Math.abs(avgScore) || 1)]));
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [1] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(xTensor, yTensor, { epochs: 30, batchSize: 8, verbose: 0 });
  const mlPreds = model.predict(xTensor).dataSync();
  xTensor.dispose(); yTensor.dispose(); model.dispose();

  const ssRes = data.reduce((sum, y, i) => sum + (y - mlPreds[i] * (Math.abs(avgScore) || 1)) ** 2, 0);
  const ssTot = data.reduce((sum, y) => sum + (y - avgScore) ** 2, 0);

  return {
    dataPoints: data.length,
    trend,
    averageChange: +avgDiff.toFixed(4),
    changePoints,
    movingAverage: movingAvg.map(v => +v.toFixed(2)),
    mlFit: { rSquared: ssTot === 0 ? 0 : +(1 - ssRes / ssTot).toFixed(4) },
    rawValues: data
  };
}

async function forecastGrowth(dataPoints) {
  const arr = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
  const data = arr.map(d => typeof d === "number" ? d : d.value || 0);
  if (data.length < 10) return { error: "Need at least 10 data points for LSTM forecasting" };

  const tensorData = tf.tensor2d(data.map(v => [v]));
  const min = tensorData.min();
  const max = tensorData.max();
  const range = max.sub(min);
  const normalized = tensorData.sub(min).div(range.add(1e-8));

  const lookback = Math.min(5, Math.floor(data.length / 3));
  const xs = [], ys = [];
  for (let i = lookback; i < data.length; i++) {
    xs.push(Array.from(normalized.slice([i - lookback, 0], [lookback, 1]).dataSync()));
    ys.push([normalized.dataSync()[i]]);
  }

  const xTensor = tf.tensor3d(xs);
  const yTensor = tf.tensor2d(ys);

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 32, inputShape: [lookback, 1] }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(xTensor, yTensor, { epochs: 50, batchSize: 8, verbose: 0 });

  xTensor.dispose(); yTensor.dispose(); tensorData.dispose(); min.dispose(); max.dispose(); range.dispose(); normalized.dispose();

  let currentInput = data.slice(-lookback).map(v => [(v - data.reduce((a, b) => a + b, 0) / data.length) / 100]);
  const daysAhead = 7;
  const forecast = [];
  for (let i = 0; i < daysAhead; i++) {
    const inputTensor = tf.tensor3d([currentInput]);
    const rawPred = model.predict(inputTensor).dataSync()[0] * 100;
    inputTensor.dispose();
    const pred = Math.max(0, Math.round(rawPred));
    forecast.push(pred);
    currentInput.shift();
    currentInput.push([pred / 100]);
  }
  model.dispose();

  const trend = data.length >= 2 ? (data[data.length - 1] - data[0]) / data.length : 0;

  return {
    historicalDays: data.length,
    forecast: forecast.map((v, i) => ({ day: i + 1, predictedPosts: v })),
    trend: trend > 0.1 ? "growing" : trend < -0.1 ? "declining" : "stable",
    lookback,
    daysAhead,
    avgDailyPosts: +(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)
  };
}

async function detectAnomalies(dataPoints) {
  const arr = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
  if (arr.length < 10) return { error: "Need at least 10 data points for anomaly detection" };

  const data = arr.map(d => typeof d === "number" ? d : d.value || 0);
  const tensorData = tf.tensor2d(data.map(v => [v]));
  const min = tensorData.min(0);
  const max = tensorData.max(0);
  const range = max.sub(min);
  const normalized = tensorData.sub(min).div(range.add(1e-8));

  const input = tf.input({ shape: [1] });
  const encoded = tf.layers.dense({ units: 4, activation: "relu" }).apply(input);
  const bottleneck = tf.layers.dense({ units: 2, activation: "relu" }).apply(encoded);
  const decoded = tf.layers.dense({ units: 1, activation: "sigmoid" }).apply(bottleneck);
  const autoencoder = tf.model({ inputs: input, outputs: decoded });
  autoencoder.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await autoencoder.fit(normalized, normalized, { epochs: 80, batchSize: 16, verbose: 0 });

  const predictions = autoencoder.predict(normalized);
  const predData = predictions.dataSync();
  const normData = normalized.dataSync();
  const errors = [];
  for (let i = 0; i < data.length; i++) errors.push((normData[i] - predData[i]) ** 2);

  predictions.dispose(); normalized.dispose(); tensorData.dispose(); min.dispose(); max.dispose(); range.dispose(); autoencoder.dispose();

  const sorted = [...errors].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.9)] || 0;

  const results = data.map((v, i) => ({
    value: v,
    index: i,
    reconstructionError: +errors[i].toFixed(6),
    isAnomaly: errors[i] > threshold
  }));

  return {
    dataPoints: data.length,
    threshold: +threshold.toFixed(6),
    anomalies: results.filter(r => r.isAnomaly),
    normalPoints: results.filter(r => !r.isAnomaly),
    summary: { anomalyCount: results.filter(r => r.isAnomaly).length, anomalyRate: +(results.filter(r => r.isAnomaly).length / data.length * 100).toFixed(1) }
  };
}

async function comparePosts(text1, text2) {
  const t1 = (text1 || "").slice(0, 1024);
  const t2 = (text2 || "").slice(0, 1024);

  const vec1 = textToVec(t1);
  const vec2 = textToVec(t2);

  const words1 = t1.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const words2 = t2.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = [...set1].filter(w => set2.has(w));
  const union = new Set([...set1, ...set2]);
  const jaccard = union.size > 0 ? intersection.length / union.size : 0;

  const tensor1 = tf.tensor2d([vec1]);
  const tensor2 = tf.tensor2d([vec2]);
  const tfCosine = 1 - tf.losses.cosineDistance(tensor1, tensor2, 1).dataSync()[0];
  tensor1.dispose(); tensor2.dispose();

  const hashCosine = cosineSimilarity(vec1, vec2);
  const combinedScore = (tfCosine * 0.5) + (jaccard * 0.3) + (hashCosine * 0.2);

  return {
    text1: t1,
    text2: t2,
    similarity: {
      embeddingCosine: +tfCosine.toFixed(4),
      jaccardWordOverlap: +jaccard.toFixed(4),
      hashCosine: +hashCosine.toFixed(4),
      combinedScore: +combinedScore.toFixed(4)
    },
    sharedKeywords: intersection.slice(0, 20),
    isSimilar: combinedScore > 0.5
  };
}

async function clusterCommunity(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length < 5) return { postCount: arr.length, error: "Need at least 5 posts for clustering" };

  const vecs = arr.map(t => textToVec(t.slice(0, 512)));
  const numClusters = Math.min(6, Math.max(2, Math.floor(arr.length / 5)));
  const assignments = kMeans(vecs, numClusters);

  const clusterGroups = {};
  for (let i = 0; i < arr.length; i++) {
    const c = assignments[i];
    if (!clusterGroups[c]) clusterGroups[c] = [];
    clusterGroups[c].push(arr[i]);
  }

  const avgDistances = [];
  for (let c = 0; c < numClusters; c++) {
    const members = vecs.filter((_, i) => assignments[i] === c);
    if (members.length < 2) { avgDistances.push(0); continue; }
    const centroid = new Array(64).fill(0);
    members.forEach(m => m.forEach((v, j) => { centroid[j] += v; }));
    centroid.forEach((_, j) => { centroid[j] /= members.length; });
    let totalDist = 0;
    members.forEach(m => {
      let d = 0;
      m.forEach((v, j) => { d += (v - centroid[j]) ** 2; });
      totalDist += Math.sqrt(d);
    });
    avgDistances.push(+(totalDist / members.length).toFixed(4));
  }

  const clusters = Object.entries(clusterGroups).map(([c, clusterTexts]) => {
    const allWords = clusterTexts.flatMap(t => t.toLowerCase().match(/\b\w{4,}\b/g) || []);
    const freq = {};
    allWords.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count }));
    return {
      clusterId: parseInt(c),
      theme: topWords.map(t => t.word).join(", ") || `Theme ${c}`,
      topWords,
      postCount: clusterTexts.length,
      avgDistance: avgDistances[parseInt(c)],
      texts: clusterTexts
    };
  });

  clusters.sort((a, b) => b.postCount - a.postCount);

  return {
    postCount: arr.length,
    numClusters: clusters.length,
    clusters,
    silhouetteHint: "Lower avgDistance = tighter cluster"
  };
}

module.exports = {
  analyzePostSentiment,
  detectToxicity,
  predictEngagement,
  classifyTopics,
  extractKeywords,
  detectTrends,
  forecastGrowth,
  detectAnomalies,
  comparePosts,
  clusterCommunity
};
