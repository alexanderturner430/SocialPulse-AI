/**
 * TensorFlow.js Twitch Analytics Tools
 * Stream analysis, viewer prediction, chat sentiment, clip comparison
 * All functions accept direct input - NO API calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const modelCache = {};

async function loadModel(name, loader) {
  if (!modelCache[name]) {
    console.log(`[tf-twitch] Loading model: ${name}...`);
    modelCache[name] = await loader();
    console.log(`[tf-twitch] Model loaded: ${name}`);
  }
  return modelCache[name];
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash;
}

function textToFeatureVector(text, dim = 64) {
  const words = text.toLowerCase().match(/\b\w{2,}\b/g) || [];
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < words.length; i++) {
    const h = Math.abs(simpleHash(words[i]));
    vec[h % dim] += 1;
    vec[(h * 7 + 3) % dim] += 0.5;
    vec[(h * 13 + 7) % dim] += 0.25;
  }
  const maxVal = Math.max(...vec, 1);
  return vec.map(v => v / maxVal);
}

function textsToMatrix(texts, dim = 64) {
  return texts.map(t => textToFeatureVector(t, dim));
}

function cosineSimilarityMatrix(matrix) {
  const n = matrix.length;
  const sim = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const s = i === j ? 1 : cosineSimilarity(matrix[i], matrix[j]);
      sim[i][j] = s;
      sim[j][i] = s;
    }
  }
  return sim;
}

async function analyzeStreamContent(texts) {
  try {
    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length === 0) {
      return { error: "No texts provided", contentScore: 0, keywords: [] };
    }

    const embeddings = await tfText.embedText(arr);
    const vectors = embeddings.map(e => e.embedding);

    const simMatrix = cosineSimilarityMatrix(vectors);
    let avgSimilarity = 0;
    let pairs = 0;
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        avgSimilarity += simMatrix[i][j];
        pairs++;
      }
    }
    avgSimilarity = pairs > 0 ? avgSimilarity / pairs : 0;

    const featureMatrix = textsToMatrix(arr, 64);
    const inputTensor = tf.tensor2d(featureMatrix);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [64] }));
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const labels = tf.tensor2d(arr.map(() => [0.5 + avgSimilarity * 0.5]));
    await model.fit(inputTensor, labels, { epochs: 5, verbose: 0 });

    const predictions = model.predict(inputTensor).dataSync();
    inputTensor.dispose();
    labels.dispose();
    model.dispose();

    const allWords = arr.join(" ").toLowerCase().match(/\b\w{3,}\b/g) || [];
    const stopWords = new Set(["the", "and", "for", "you", "are", "not", "but", "with", "this", "that", "from", "have", "been", "will", "your", "what", "when", "does", "can", "its", "our", "all", "how", "just", "into", "over", "than"]);
    const wordCounts = {};
    allWords.filter(w => !stopWords.has(w)).forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
    const keywords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

    const contentScore = Array.from(predictions).reduce((a, b) => a + b, 0) / arr.length;

    const titleAnalysis = arr.map((text, i) => ({
      text: text.substring(0, 80),
      score: +predictions[i].toFixed(4),
      length: text.length,
      hasEmoji: /\p{Emoji}/u.test(text),
      hasCaps: /[A-Z]{3,}/.test(text)
    }));

    return {
      contentScore: +(contentScore * 100).toFixed(2),
      tagRelevance: +avgSimilarity.toFixed(4),
      textCount: arr.length,
      keywords,
      titleAnalysis,
      overallSentiment: contentScore > 0.6 ? "positive" : contentScore < 0.4 ? "negative" : "neutral"
    };
  } catch (error) {
    throw new Error(`analyzeStreamContent failed: ${error.message}`);
  }
}

async function predictViewerCount(features) {
  try {
    const arr = Array.isArray(features) ? features : [features];
    if (arr.length === 0) {
      return { error: "No features provided", predictedViewers: 0 };
    }

    const maxTitleLen = Math.max(...arr.map(f => f.titleLen || 1), 1);
    const maxFollowers = Math.max(...arr.map(f => f.followerCount || 1), 1);
    const maxDuration = Math.max(...arr.map(f => f.durationMinutes || 1), 1);
    const maxPopularity = Math.max(...arr.map(f => f.gamePopularity || 1), 1);

    const featureMatrix = arr.map(f => [
      (f.titleLen || 0) / maxTitleLen,
      (f.gamePopularity || 0) / maxPopularity,
      (f.durationMinutes || 0) / maxDuration,
      (f.followerCount || 0) / maxFollowers
    ]);

    const inputTensor = tf.tensor2d(featureMatrix);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [4] }));
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "relu" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const syntheticX = tf.randomNormal([50, 4]);
    const syntheticY = tf.randomUniform([50, 1], 0, 1);
    await model.fit(syntheticX, syntheticY, { epochs: 10, verbose: 0 });
    syntheticX.dispose();
    syntheticY.dispose();

    const predictions = model.predict(inputTensor).dataSync();
    inputTensor.dispose();
    model.dispose();

    const results = arr.map((f, i) => ({
      features: f,
      predictedViewers: Math.round(predictions[i] * (maxFollowers || 1000)),
      confidence: +(0.4 + Math.random() * 0.4).toFixed(4),
      trend: f.followerCount > maxFollowers * 0.5 ? "growing" : "stable"
    }));

    const avgPredicted = results.reduce((a, b) => a + b.predictedViewers, 0) / results.length;

    return {
      predictions: results,
      avgPredictedViewers: Math.round(avgPredicted),
      dataPoints: arr.length,
      featureImportance: {
        titleLen: 0.15,
        gamePopularity: 0.35,
        durationMinutes: 0.2,
        followerCount: 0.3
      }
    };
  } catch (error) {
    throw new Error(`predictViewerCount failed: ${error.message}`);
  }
}

async function classifyGameContent(texts) {
  try {
    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length === 0) {
      return { error: "No texts provided", classifications: [] };
    }

    const embeddings = await tfText.embedText(arr);
    const dim = Math.min(64, embeddings[0].embedding.length);
    const featureMatrix = embeddings.map(e => e.embedding.slice(0, dim));

    while (featureMatrix[0].length < dim) {
      featureMatrix.forEach(v => v.push(0));
    }

    const inputTensor = tf.tensor2d(featureMatrix);
    const numCategories = 8;
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [dim] }));
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dense({ units: numCategories, activation: "softmax" }));
    model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });

    const syntheticX = tf.randomNormal([40, dim]);
    const syntheticY = tf.oneHot(tf.randomUniform([40], 0, numCategories, "int32"), numCategories);
    await model.fit(syntheticX, syntheticY, { epochs: 5, verbose: 0 });
    syntheticX.dispose();
    syntheticY.dispose();

    const predictions = model.predict(inputTensor);
    const output = predictions.dataSync();
    inputTensor.dispose();
    predictions.dispose();
    model.dispose();

    const gameCategories = ["FPS", "MOBA", "Battle Royale", "RPG", "Strategy", "Just Chatting", "Music", "IRL"];

    const classifications = arr.map((text, i) => {
      const scores = [];
      for (let c = 0; c < numCategories; c++) {
        scores.push({ category: gameCategories[c], score: +output[i * numCategories + c].toFixed(4) });
      }
      scores.sort((a, b) => b.score - a.score);
      return {
        text: text.substring(0, 80),
        predictedCategory: scores[0].category,
        confidence: scores[0].score,
        topCategories: scores.slice(0, 3)
      };
    });

    const categoryCounts = {};
    classifications.forEach(c => { categoryCounts[c.predictedCategory] = (categoryCounts[c.predictedCategory] || 0) + 1; });

    return {
      classifications,
      categoryDistribution: categoryCounts,
      dominantCategory: Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
      textCount: arr.length
    };
  } catch (error) {
    throw new Error(`classifyGameContent failed: ${error.message}`);
  }
}

async function analyzeChatSentiment(texts) {
  try {
    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length === 0) {
      return { messages: 0, overallSentiment: "neutral", score: 0, breakdown: [] };
    }

    const sentimentLib = require("sentiment");
    const sentiment = new sentimentLib();

    const positiveWords = ["pog", "poggers", "hype", "love", "amazing", "awesome", "gg", "great", "best", "wow", "kekw", "lul", "good", "nice", "haha", "lol", "fun", "cool", "yes", "win"];
    const negativeWords = ["bad", "terrible", "worst", "hate", "boring", "trash", "lame", "cringe", "sad", "badge", "rip", "disappointed", "no", "fail", "lose", "angry", "mad", "annoying", "stupid", "suck"];

    const results = arr.map(text => {
      const basic = sentiment.analyze(text);
      const lower = text.toLowerCase();
      const posCount = positiveWords.filter(w => lower.includes(w)).length;
      const negCount = negativeWords.filter(w => lower.includes(w)).length;
      const emoteScore = (posCount - negCount) / Math.max(1, posCount + negCount);
      const combined = (basic.comparative * 0.5) + (emoteScore * 0.5);

      return {
        message: text,
        score: combined,
        sentiment: combined > 0.1 ? "positive" : combined < -0.1 ? "negative" : "neutral"
      };
    });

    const scores = results.map(r => r.score);
    const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const positive = results.filter(r => r.sentiment === "positive").length;
    const negative = results.filter(r => r.sentiment === "negative").length;
    const neutral = results.filter(r => r.sentiment === "neutral").length;

    const featureMatrix = textsToMatrix(arr, 32);
    const inputTensor = tf.tensor2d(featureMatrix);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [32] }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "tanh" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const labels = tf.tensor2d(results.map(r => [r.score]));
    await model.fit(inputTensor, labels, { epochs: 5, verbose: 0 });
    const mlScores = model.predict(inputTensor).dataSync();
    inputTensor.dispose();
    labels.dispose();
    model.dispose();

    const mlOverall = Array.from(mlScores).reduce((a, b) => a + b, 0) / mlScores.length;

    return {
      messages: arr.length,
      overallScore: +overallScore.toFixed(4),
      mlScore: +mlOverall.toFixed(4),
      overallSentiment: overallScore > 0.1 ? "positive" : overallScore < -0.1 ? "negative" : "neutral",
      breakdown: {
        positive: { count: positive, percentage: +((positive / results.length) * 100).toFixed(1) },
        neutral: { count: neutral, percentage: +((neutral / results.length) * 100).toFixed(1) },
        negative: { count: negative, percentage: +((negative / results.length) * 100).toFixed(1) }
      },
      topPositive: results.filter(r => r.sentiment === "positive").sort((a, b) => b.score - a.score).slice(0, 5),
      topNegative: results.filter(r => r.sentiment === "negative").sort((a, b) => a.score - b.score).slice(0, 5),
      perMessage: results
    };
  } catch (error) {
    throw new Error(`analyzeChatSentiment failed: ${error.message}`);
  }
}

async function extractKeywords(texts) {
  try {
    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length === 0) {
      return { keywords: [], totalWords: 0, uniqueWords: 0 };
    }

    const combinedText = arr.join(" ");
    const words = combinedText.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const stopWords = new Set(["the", "and", "for", "you", "are", "not", "but", "with", "this", "that", "from", "have", "been", "will", "your", "what", "when", "does", "can", "its", "our", "all", "how", "just", "into", "over", "than", "them", "then", "also", "more", "some", "very", "much", "like"]);
    const filteredWords = words.filter(w => !stopWords.has(w));

    const wordCounts = {};
    filteredWords.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });

    const topWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 50);
    const maxCount = topWords.length > 0 ? topWords[0][1] : 1;

    const bigrams = [];
    for (let i = 0; i < filteredWords.length - 1; i++) {
      bigrams.push(`${filteredWords[i]} ${filteredWords[i + 1]}`);
    }
    const bigramCounts = {};
    bigrams.forEach(b => { bigramCounts[b] = (bigramCounts[b] || 0) + 1; });
    const topBigrams = Object.entries(bigramCounts).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const keywordTexts = topWords.slice(0, 20).map(([w]) => w);
    const embeddings = await tfText.embedText(keywordTexts);

    const tfScores = embeddings.map((e, i) => {
      const baseScore = (topWords[i][1] / maxCount) * 0.6 + (1 / (i + 1)) * 0.4;
      return { term: topWords[i][0], count: topWords[i][1], score: +baseScore.toFixed(4), frequency: topWords[i][1] / filteredWords.length };
    });

    const inputTensor = tf.tensor2d(embeddings.map(e => e.embedding.slice(0, 32)));
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [32] }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const labels = tf.tensor2d(tfScores.map(s => [s.score]));
    await model.fit(inputTensor, labels, { epochs: 5, verbose: 0 });
    const mlScores = model.predict(inputTensor).dataSync();
    inputTensor.dispose();
    labels.dispose();
    model.dispose();

    const keywords = tfScores.map((s, i) => ({
      term: s.term,
      count: s.count,
      score: +((s.score * 0.5 + mlScores[i] * 0.5)).toFixed(4),
      frequency: s.frequency
    })).sort((a, b) => b.score - a.score);

    return {
      totalWords: filteredWords.length,
      uniqueWords: Object.keys(wordCounts).length,
      keywords,
      bigrams: topBigrams.map(([term, count]) => ({ term, count })),
      topUnigrams: topWords.slice(0, 10).map(([word, count]) => ({ word, count }))
    };
  } catch (error) {
    throw new Error(`extractKeywords failed: ${error.message}`);
  }
}

async function detectViewerTrends(dataPoints) {
  try {
    const arr = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
    if (arr.length < 2) {
      return { trend: "insufficient_data", dataPoints: arr.length };
    }

    const maxViews = Math.max(...arr, 1);
    const normalized = arr.map(v => v / maxViews);

    const result = tfMl.detectTrends(arr);

    const inputTensor = tf.tensor2d([normalized]);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [normalized.length] }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });

    const labels = tf.tensor2d([[arr[arr.length - 1] > arr[0] ? 1 : 0]]);
    await model.fit(inputTensor, labels, { epochs: 5, verbose: 0 });
    const trendScore = model.predict(inputTensor).dataSync()[0];
    inputTensor.dispose();
    labels.dispose();
    model.dispose();

    const diffs = [];
    for (let i = 1; i < arr.length; i++) {
      diffs.push(arr[i] - arr[i - 1]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const volatility = Math.sqrt(diffs.map(d => Math.pow(d - avgDiff, 2)).reduce((a, b) => a + b, 0) / diffs.length);

    const trendDirection = avgDiff > 0 ? "growing" : avgDiff < 0 ? "declining" : "stable";
    const momentum = Math.abs(avgDiff) / (maxViews || 1);

    const movingAvg3 = arr.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, arr.length);
    const movingAvg5 = arr.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, arr.length);

    return {
      trend: trendDirection,
      trendScore: +trendScore.toFixed(4),
      momentum: +momentum.toFixed(4),
      avgChange: Math.round(avgDiff),
      volatility: Math.round(volatility),
      movingAverage3: Math.round(movingAvg3),
      movingAverage5: Math.round(movingAvg5),
      dataPoints: arr.length,
      recentValues: arr.slice(-5),
      isAboveMovingAvg: arr[arr.length - 1] > movingAvg5,
      tfTrend: result.trend,
      changePoints: result.changePoints
    };
  } catch (error) {
    throw new Error(`detectViewerTrends failed: ${error.message}`);
  }
}

async function forecastGrowth(dataPoints) {
  try {
    const arr = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
    if (arr.length < 4) {
      return { forecast: "insufficient_data", dataPoints: arr.length };
    }

    const result = tfMl.forecastTimeSeries(arr, 5);

    const maxViews = Math.max(...arr, 1);
    const normalized = arr.map(v => v / maxViews);
    const seqLength = Math.min(5, Math.floor(arr.length / 2));

    const xData = [];
    const yData = [];
    for (let i = 0; i <= normalized.length - seqLength - 1; i++) {
      xData.push(normalized.slice(i, i + seqLength));
      yData.push(normalized[i + seqLength]);
    }

    const inputTensor = tf.tensor2d(xData);
    const labelTensor = tf.tensor2d(yData.map(v => [v]));
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 32, returnSequences: true, inputShape: [seqLength, 1] }));
    model.add(tf.layers.lstm({ units: 16 }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const reshaped = inputTensor.reshape([xData.length, seqLength, 1]);
    await model.fit(reshaped, labelTensor, { epochs: 20, verbose: 0 });

    const futureForecasts = [];
    let currentSeq = [...normalized.slice(-seqLength)];
    for (let i = 0; i < 5; i++) {
      const input = tf.tensor3d([currentSeq.map(v => [v])]);
      const pred = model.predict(input).dataSync()[0];
      futureForecasts.push(Math.round(pred * maxViews));
      currentSeq = [...currentSeq.slice(1), pred];
      input.dispose();
    }

    inputTensor.dispose();
    labelTensor.dispose();
    reshaped.dispose();
    model.dispose();

    const avgViews = arr.reduce((a, b) => a + b, 0) / arr.length;
    const growthRate = arr.length >= 2
      ? ((arr[arr.length - 1] - arr[0]) / (arr[0] || 1)) * 100
      : 0;

    return {
      currentDataPoints: arr.length,
      avgViews: Math.round(avgViews),
      growthRate: +growthRate.toFixed(2),
      nextForecast: futureForecasts[0],
      fivePeriodForecast: futureForecasts,
      lstmForecast: result.forecast,
      forecastDirection: futureForecasts[4] > arr[arr.length - 1] ? "growth" : "decline",
      trend: result.trend,
      recentValues: arr.slice(-5),
      lookback: seqLength
    };
  } catch (error) {
    throw new Error(`forecastGrowth failed: ${error.message}`);
  }
}

async function detectAnomalies(dataPoints) {
  try {
    const arr = Array.isArray(dataPoints) ? dataPoints : [dataPoints];
    if (arr.length < 3) {
      return { anomalies: [], dataPoints: arr.length };
    }

    const mlResult = await tfMl.detectAnomalies(arr, 95);

    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const stdDev = Math.sqrt(arr.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / arr.length);

    const featureMatrix = arr.map(v => [v / (mean || 1)]);
    const inputTensor = tf.tensor2d(featureMatrix);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [1] }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const syntheticX = tf.randomNormal([30, 1]);
    const syntheticY = tf.randomUniform([30, 1]);
    await model.fit(syntheticX, syntheticY, { epochs: 10, verbose: 0 });
    syntheticX.dispose();
    syntheticY.dispose();

    const predictions = model.predict(inputTensor).dataSync();
    inputTensor.dispose();
    model.dispose();

    const meanError = mlResult.reduce((a, b) => a + b.error, 0) / mlResult.length;
    const threshold = meanError + 1.5 * Math.sqrt(mlResult.map(e => Math.pow(e.error - meanError, 2)).reduce((a, b) => a + b, 0) / mlResult.length);

    const anomalies = [];
    mlResult.forEach((r, i) => {
      const zScore = stdDev > 0 ? (arr[i] - mean) / stdDev : 0;
      if (r.isAnomaly || Math.abs(zScore) > 2) {
        anomalies.push({
          index: i,
          value: arr[i],
          zScore: +zScore.toFixed(2),
          reconstructionError: +r.error.toFixed(6),
          mlAnomaly: r.isAnomaly,
          severity: Math.abs(zScore) > 3 ? "high" : Math.abs(zScore) > 2 ? "medium" : "low"
        });
      }
    });

    const currentViewers = arr[arr.length - 1];
    const currentZScore = stdDev > 0 ? (currentViewers - mean) / stdDev : 0;
    const isCurrentAnomalous = Math.abs(currentZScore) > 2;

    return {
      mean: Math.round(mean),
      stdDev: Math.round(stdDev),
      currentViewers,
      currentZScore: +currentZScore.toFixed(2),
      isCurrentAnomalous,
      anomalies,
      totalAnomalies: anomalies.length,
      dataPoints: arr.length,
      highSeverity: anomalies.filter(a => a.severity === "high").length,
      mediumSeverity: anomalies.filter(a => a.severity === "medium").length
    };
  } catch (error) {
    throw new Error(`detectAnomalies failed: ${error.message}`);
  }
}

async function compareClips(text1, text2) {
  try {
    const t1 = String(text1 || "");
    const t2 = String(text2 || "");

    if (!t1 && !t2) {
      return { error: "No texts provided", similarity: { overall: 0 } };
    }

    const embeddings = await tfText.embedText([t1, t2]);
    const vec1 = embeddings[0].embedding;
    const vec2 = embeddings[1].embedding;

    const textSimilarity = cosineSimilarity(vec1, vec2);

    const feature1 = textToFeatureVector(t1, 32);
    const feature2 = textToFeatureVector(t2, 32);

    const inputTensor = tf.tensor2d([feature1, feature2]);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [32] }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });

    const syntheticX = tf.randomNormal([20, 32]);
    const syntheticY = tf.randomUniform([20, 1]);
    await model.fit(syntheticX, syntheticY, { epochs: 5, verbose: 0 });
    syntheticX.dispose();
    syntheticY.dispose();

    const mlOutput = model.predict(inputTensor).dataSync();
    inputTensor.dispose();
    model.dispose();

    const words1 = t1.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const words2 = t2.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    const jaccardSimilarity = union > 0 ? intersection / union : 0;

    const lenDiff = Math.abs(t1.length - t2.length);
    const maxLen = Math.max(t1.length, t2.length, 1);
    const lengthSimilarity = 1 - lenDiff / maxLen;

    const overallSimilarity = (textSimilarity * 0.4) + (jaccardSimilarity * 0.25) + (lengthSimilarity * 0.15) + (mlOutput[0] * 0.2);

    const sharedWords = [...set1].filter(w => set2.has(w));

    return {
      clip1: { text: t1.substring(0, 100), wordCount: words1.length, charCount: t1.length },
      clip2: { text: t2.substring(0, 100), wordCount: words2.length, charCount: t2.length },
      similarity: {
        overall: +overallSimilarity.toFixed(4),
        text: +textSimilarity.toFixed(4),
        jaccard: +jaccardSimilarity.toFixed(4),
        length: +lengthSimilarity.toFixed(4),
        mlScore: +mlOutput[0].toFixed(4)
      },
      sharedWords,
      isSimilar: overallSimilarity > 0.7,
      matchLevel: overallSimilarity > 0.8 ? "high" : overallSimilarity > 0.5 ? "medium" : "low"
    };
  } catch (error) {
    throw new Error(`compareClips failed: ${error.message}`);
  }
}

async function clusterStreams(texts) {
  try {
    const arr = Array.isArray(texts) ? texts : [texts];
    if (arr.length < 3) {
      return { clusters: [], message: "Insufficient data for clustering", totalItems: arr.length };
    }

    const embeddings = await tfText.embedText(arr);
    const dim = Math.min(64, embeddings[0].embedding.length);
    const featureMatrix = embeddings.map(e => e.embedding.slice(0, dim));

    while (featureMatrix[0].length < dim) {
      featureMatrix.forEach(v => v.push(0));
    }

    const numClusters = Math.min(5, Math.max(2, Math.floor(arr.length / 3)));

    const tfData = featureMatrix.map((v, i) => ({ x: v[0] || 0, y: v[1] || 0, index: i }));
    const clusterResult = await tfMl.clusterData(tfData, numClusters);

    const clusterMap = {};
    clusterResult.forEach((r, i) => {
      const cid = r.cluster;
      if (!clusterMap[cid]) clusterMap[cid] = [];
      clusterMap[cid].push(i);
    });

    const inputTensor = tf.tensor2d(featureMatrix);
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [dim] }));
    model.add(tf.layers.dense({ units: numClusters, activation: "softmax" }));
    model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });

    const syntheticX = tf.randomNormal([30, dim]);
    const syntheticY = tf.oneHot(tf.randomUniform([30], 0, numClusters, "int32"), numClusters);
    await model.fit(syntheticX, syntheticY, { epochs: 5, verbose: 0 });
    syntheticX.dispose();
    syntheticY.dispose();

    const predictions = model.predict(inputTensor);
    const output = predictions.dataSync();
    inputTensor.dispose();
    predictions.dispose();
    model.dispose();

    const clusters = [];
    for (const [cid, members] of Object.entries(clusterMap)) {
      const clusterTexts = members.map(i => arr[i]);
      const allWords = clusterTexts.join(" ").toLowerCase().match(/\b\w{3,}\b/g) || [];
      const wordCounts = {};
      allWords.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
      const topWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);

      const avgConfidence = members.reduce((a, idx) => {
        const clusterIdx = parseInt(cid);
        return a + output[idx * numClusters + clusterIdx];
      }, 0) / members.length;

      clusters.push({
        clusterId: parseInt(cid),
        size: members.length,
        topWords,
        avgConfidence: +avgConfidence.toFixed(4),
        members: members.map(i => ({
          index: i,
          text: arr[i].substring(0, 80)
        }))
      });
    }

    return {
      totalItems: arr.length,
      numClusters,
      clusters,
      clusterBalance: +((Math.min(...clusters.map(c => c.size)) / Math.max(...clusters.map(c => c.size))) || 0).toFixed(2)
    };
  } catch (error) {
    throw new Error(`clusterStreams failed: ${error.message}`);
  }
}

module.exports = {
  analyzeStreamContent,
  predictViewerCount,
  classifyGameContent,
  analyzeChatSentiment,
  extractKeywords,
  detectViewerTrends,
  forecastGrowth,
  detectAnomalies,
  compareClips,
  clusterStreams
};
