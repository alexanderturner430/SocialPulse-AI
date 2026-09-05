/**
 * TensorFlow.js GitHub Analysis - Direct Input, No API Calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfImage = require("./tf-image");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const STOP_WORDS = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","need","dare","ought","used","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","out","off","over","under","again","further","then","once","here","there","when","where","why","how","all","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","just","don","now","and","but","if","or","because","about","also","that","this","it","its","i","me","my","we","our","you","your","he","him","his","she","her","they","them","their","what","which","who","whom","these","those","am","get","got","one","like","much","even","still","really","im","ive","dont","cant","thats","re","ll","ve"]);

function tokenize(text) {
  return (text || "").toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
}

function textToFeatures(texts, vocabSize = 100) {
  const wordFreq = {};
  texts.forEach(t => tokenize(t).forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; }));
  const vocab = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, vocabSize).map(e => e[0]);
  const wordIndex = {};
  vocab.forEach((w, i) => { wordIndex[w] = i; });
  return texts.map(t => {
    const vec = new Array(vocabSize).fill(0);
    const tokens = tokenize(t);
    tokens.forEach(w => { if (wordIndex[w] !== undefined) vec[wordIndex[w]]++; });
    const len = tokens.length || 1;
    return vec.map(v => v / len);
  });
}

async function analyzeIssueSentiment(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const results = [];
  for (const text of arr) {
    const analysis = await tfText.analyzeSentimentML(text);
    results.push({ text: text.substring(0, 80), sentiment: analysis.sentiment, score: analysis.score, positive: analysis.positive, negative: analysis.negative });
  }
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
  return { results, average: avg, overall: avg > 0.1 ? "positive" : avg < -0.1 ? "negative" : "neutral", count: arr.length };
}

async function classifyIssueTopics(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const topicKeywords = {
    bug: ["bug","error","crash","fix","broken","issue","fail","exception","undefined","null","nullpointer","regression"],
    feature: ["feature","request","add","implement","support","enhancement","new","proposal","suggestion","would be nice"],
    documentation: ["docs","documentation","readme","example","tutorial","guide","update","clarify","typo"],
    performance: ["performance","slow","speed","optimize","memory","latency","fast","cache","benchmark"],
    security: ["security","vulnerability","cve","exploit","auth","permission","access","token","leak","xss","injection"],
    devops: ["deploy","ci","cd","docker","kubernetes","pipeline","build","release","infrastructure","ci/cd"]
  };
  const results = arr.map(text => {
    const lower = text.toLowerCase();
    const scores = {};
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      scores[topic] = keywords.filter(k => lower.includes(k)).length / keywords.length;
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return { text: text.substring(0, 80), topic: best[1] > 0 ? best[0] : "general", confidence: +(best[1] || 0).toFixed(4), scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, +v.toFixed(4)])) };
  });
  const topicCounts = {};
  results.forEach(r => { topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1; });
  return { results, topicCounts, totalAnalyzed: arr.length };
}

async function extractKeywords(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  const combined = arr.join(" ");
  const words = combined.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = {};
  words.forEach(w => { if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const maxFreq = top[0]?.[1] || 1;
  const keywords = top.map(([term, count]) => ({ term, count, score: +(count / maxFreq).toFixed(4) }));
  const tfidf = [];
  const docCount = arr.length;
  for (const [term] of top) {
    const docsWithTerm = arr.filter(t => t.toLowerCase().includes(term)).length;
    const idf = Math.log(docCount / (1 + docsWithTerm));
    const tfVal = (freq[term] || 0) / words.length;
    tfidf.push({ term, tfidf: +(tfVal * idf).toFixed(4), count: freq[term] });
  }
  tfidf.sort((a, b) => b.tfidf - a.tfidf);
  return { keywords: keywords.slice(0, 10), tfidf: tfidf.slice(0, 10), totalWords: words.length, uniqueWords: Object.keys(freq).length };
}

async function detectTrends(dataPoints) {
  return tfMl.detectTrends(dataPoints);
}

async function forecastGrowth(dataPoints) {
  return tfMl.forecastTimeSeries(dataPoints, 7);
}

async function detectAnomalies(dataPoints) {
  return tfMl.detectAnomalies(dataPoints);
}

async function compareRepos(texts1, texts2) {
  const combined1 = texts1.join(" ");
  const combined2 = texts2.join(" ");
  const tokens1 = tokenize(combined1);
  const tokens2 = tokenize(combined2);
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter(w => set2.has(w));
  const union = new Set([...set1, ...set2]);
  const jaccard = union.size > 0 ? intersection.length / union.size : 0;
  const features = textToFeatures([combined1, combined2], 50);
  const t1 = tf.tensor2d([features[0]]);
  const t2 = tf.tensor2d([features[1]]);
  const cosSim = tf.losses.cosineDistance(t1, t2, 1).dataSync()[0];
  t1.dispose(); t2.dispose();
  const sent1 = await tfText.analyzeSentimentML(combined1);
  const sent2 = await tfText.analyzeSentimentML(combined2);
  return { repo1: { description: combined1.substring(0, 100), wordCount: tokens1.length, sentiment: sent1.sentiment, score: sent1.score }, repo2: { description: combined2.substring(0, 100), wordCount: tokens2.length, sentiment: sent2.sentiment, score: sent2.score }, similarity: { jaccard: +jaccard.toFixed(4), cosine: +(1 - cosSim).toFixed(4), sharedKeywords: intersection.length }, commonTerms: intersection.slice(0, 10) };
}

async function clusterIssues(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (arr.length < 2) return { clusters: arr.map((t, i) => ({ text: t.substring(0, 80), cluster: 0, index: i })), numClusters: 1 };
  const numClusters = Math.min(4, arr.length);
  const features = textToFeatures(arr, 50);
  const kmeans = [];
  for (let c = 0; c < numClusters; c++) kmeans.push([...features[c]]);
  let assignments = new Array(arr.length).fill(0);
  for (let iter = 0; iter < 15; iter++) {
    for (let i = 0; i < arr.length; i++) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < numClusters; c++) {
        let d = 0;
        for (let j = 0; j < Math.min(features[i].length, 10); j++) d += (features[i][j] - (kmeans[c][j] || 0)) ** 2;
        if (d < minDist) { minDist = d; best = c; }
      }
      assignments[i] = best;
    }
    for (let c = 0; c < numClusters; c++) {
      const members = features.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        for (let j = 0; j < kmeans[c].length; j++) kmeans[c][j] = members.reduce((s, m) => s + (m[j] || 0), 0) / members.length;
      }
    }
  }
  return { clusters: arr.map((t, i) => ({ text: t.substring(0, 80), cluster: assignments[i], index: i })), numClusters, clusterSizes: Array.from({ length: numClusters }, (_, c) => assignments.filter(a => a === c).length) };
}

async function predictIssueEngagement(features) {
  const { titleLen = 0, bodyLen = 0, labelCount = 0, commentCount = 0 } = features;
  const input = tf.tensor2d([[titleLen / 200, bodyLen / 5000, labelCount / 10, commentCount / 500]]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [4] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });
  const sx = tf.randomNormal([200, 4]);
  const sy = tf.randomUniform([200, 1]);
  await model.fit(sx, sy, { epochs: 20, batchSize: 32, verbose: 0 });
  sx.dispose(); sy.dispose();
  const score = model.predict(input).dataSync()[0];
  input.dispose(); model.dispose();
  const predictedComments = Math.round(score * 500 * Math.min(2, Math.max(0.1, commentCount / 50)));
  const predictedReactions = Math.round(score * 1000 * Math.min(2, Math.max(0.1, labelCount / 3)));
  return { engagementScore: +score.toFixed(4), predictedComments, predictedReactions, features };
}

async function analyzeContributorPatterns(features) {
  const arr = Array.isArray(features) ? features : [features];
  if (arr.length === 0) return { patterns: [], summary: { totalContributors: 0 } };
  const normalized = arr.map(f => [f.commits / 1000, f.additions / 100000, f.deletions / 50000, f.activeDays / 365]);
  const tensor = tf.tensor2d(normalized);
  const mean = tensor.mean(0);
  const std = tensor.sub(mean).square().mean(0).sqrt().add(1e-8);
  const standardized = tensor.sub(mean).div(std);
  const clusterCount = Math.min(3, arr.length);
  const centroids = standardized.slice([0, 0], [clusterCount, -1]).clone();
  let assignments = new Array(arr.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < arr.length; i++) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < clusterCount; c++) {
        let d = 0;
        for (let j = 0; j < 4; j++) d += (standardized.dataSync()[i * 4 + j] - centroids.dataSync()[c * 4 + j]) ** 2;
        if (d < minDist) { minDist = d; best = c; }
      }
      assignments[i] = best;
    }
  }
  const patterns = arr.map((f, i) => {
    const total = f.commits + f.additions + f.deletions;
    const commitRatio = total > 0 ? f.commits / total : 0;
    return { commits: f.commits, additions: f.additions, deletions: f.deletions, activeDays: f.activeDays, commitsPerDay: f.activeDays > 0 ? +(f.commits / f.activeDays).toFixed(2) : 0, additionsPerDay: f.activeDays > 0 ? +(f.additions / f.activeDays).toFixed(2) : 0, commitRatio: +commitRatio.toFixed(4), cluster: assignments[i], productivityScore: +((f.commits * 0.3 + f.additions * 0.0001 + f.deletions * 0.00005 + f.activeDays * 0.5) / 10).toFixed(4) };
  });
  const summary = { totalContributors: arr.length, avgCommits: +(arr.reduce((s, f) => s + f.commits, 0) / arr.length).toFixed(1), avgAdditions: +(arr.reduce((s, f) => s + f.additions, 0) / arr.length).toFixed(1), avgDeletions: +(arr.reduce((s, f) => s + f.deletions, 0) / arr.length).toFixed(1), avgActiveDays: +(arr.reduce((s, f) => s + f.activeDays, 0) / arr.length).toFixed(1) };
  tensor.dispose(); mean.dispose(); std.dispose(); standardized.dispose(); centroids.dispose();
  return { patterns, summary };
}

module.exports = { analyzeIssueSentiment, classifyIssueTopics, extractKeywords, detectTrends, forecastGrowth, detectAnomalies, compareRepos, clusterIssues, predictIssueEngagement, analyzeContributorPatterns };
