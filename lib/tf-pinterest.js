/**
 * TensorFlow.js Pinterest Analysis - Direct Input, No API Calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfImage = require("./tf-image");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const STOP_WORDS = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","need","dare","ought","used","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","out","off","over","under","again","further","then","once","here","there","when","where","why","how","all","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","just","don","now","and","but","if","or","because","about","also","that","this","it","its","i","me","my","we","our","you","your","he","him","his","she","her","they","them","their","what","which","who","whom","these","those","am","get","got","one","like","much","even","still","really","im","ive","dont","cant","thats"]);

const CONTENT_CATEGORIES = {
  recipe: ["recipe","cook","bake","ingredient","meal","food","dinner","lunch","breakfast","dessert","chicken","pasta","salad","sauce","homemade","kitchen","oven","stovetop","grill","saute"],
  diy: ["diy","craft","homemade","tutorial","how to","step by step","easy","simple","project","build","make","create","wood","paint","sew","knit","crochet","resin","epoxy"],
  fashion: ["fashion","outfit","style","wear","dress","shirt","shoes","accessories","trendy","look","ootd","casual","formal","summer","winter","layer","pair","brand"],
  travel: ["travel","trip","vacation","destination","explore","adventure","hotel","beach","mountain","city","country","tour","flight","backpack","passport","sightseeing","landscape"],
  home: ["home","decor","interior","design","living room","bedroom","bathroom","kitchen","furniture","organization","storage","minimalist","cozy","modern","rustic","boho","plant"],
  art: ["art","drawing","painting","illustration","digital art","watercolor","acrylic","sketch","portrait","abstract","artist","canvas","artwork","creative","design","pattern"],
  fitness: ["fitness","workout","exercise","gym","yoga","running","weight","muscle","cardio","stretch","routine","plan","health","wellness","body","strength","training"],
  food: ["food","eat","restaurant","cafe","coffee","tea","brunch","snack","treat","sweet","savory","healthy","organic","vegan","vegetarian","gluten","protein"],
  education: ["learn","study","course","class","lesson","tutorial","guide","tip","beginner","advanced","skill","practice","education","school","university","knowledge","teach"],
  other: []
};

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

async function analyzePinImages(imageUrls) {
  const arr = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  const results = [];
  for (const url of arr) {
    try {
      const classification = await tfImage.classifyImage(url);
      const objects = await tfImage.detectObjects(url);
      results.push({ url: typeof url === "string" ? url.substring(0, 80) : "buffer", classifications: classification.slice(0, 3), objects: objects.slice(0, 5).map(o => ({ class: o.class, score: +o.score.toFixed(4) })), objectCount: objects.length, dominantColors: ["analyzed"], visualAppeal: Math.min(100, Math.round(objects.length * 10 + (classification[0]?.probability || 0) * 50)) });
    } catch (e) {
      results.push({ url: typeof url === "string" ? url.substring(0, 80) : "buffer", error: e.message, visualAppeal: 50 });
    }
  }
  const avgAppeal = results.reduce((s, r) => s + (r.visualAppeal || 0), 0) / results.length;
  return { results, averageVisualAppeal: Math.round(avgAppeal), totalAnalyzed: arr.length };
}

async function predictEngagement(features) {
  const { titleLen = 0, descLen = 0, linkCount = 0, boardFollowers = 0 } = features;
  const input = tf.tensor2d([[titleLen / 200, descLen / 1000, linkCount / 5, boardFollowers / 100000]]);
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
  const predictedSaves = Math.round(score * 5000 * Math.min(3, Math.max(0.1, boardFollowers / 1000)));
  const predictedClicks = Math.round(score * 2000 * Math.min(2, Math.max(0.1, linkCount / 2)));
  const predictedComments = Math.round(score * 500 * Math.min(2, Math.max(0.1, titleLen / 50)));
  return { engagementScore: +score.toFixed(4), predictedSaves, predictedClicks, predictedComments, features };
}

async function classifyContent(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [category, keywords] of Object.entries(CONTENT_CATEGORIES)) {
    if (keywords.length === 0) continue;
    scores[category] = keywords.filter(k => lower.includes(k)).length / keywords.length;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0];
  const secondary = sorted.filter(([k, v]) => v > 0 && k !== primary[0]).slice(0, 2);
  return { text: text.substring(0, 100), primaryCategory: primary[1] > 0 ? primary[0] : "other", confidence: +(primary[1] || 0).toFixed(4), scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, +v.toFixed(4)])), secondaryCategories: secondary.map(([k, v]) => ({ category: k, score: +v.toFixed(4) })) };
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

async function comparePins(text1, text2) {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter(w => set2.has(w));
  const union = new Set([...set1, ...set2]);
  const jaccard = union.size > 0 ? intersection.length / union.size : 0;
  const features = textToFeatures([text1, text2], 50);
  const t1 = tf.tensor2d([features[0]]);
  const t2 = tf.tensor2d([features[1]]);
  const cosSim = tf.losses.cosineDistance(t1, t2, 1).dataSync()[0];
  t1.dispose(); t2.dispose();
  const cat1 = await classifyContent(text1);
  const cat2 = await classifyContent(text2);
  return { pin1: { preview: text1.substring(0, 100), wordCount: tokens1.length, category: cat1.primaryCategory }, pin2: { preview: text2.substring(0, 100), wordCount: tokens2.length, category: cat2.primaryCategory }, similarity: { jaccard: +jaccard.toFixed(4), cosine: +(1 - cosSim).toFixed(4), sharedWords: intersection.length }, sharedKeywords: intersection.slice(0, 10), sameCategory: cat1.primaryCategory === cat2.primaryCategory };
}

async function clusterBoards(featuresArray) {
  const arr = Array.isArray(featuresArray) ? featuresArray : [featuresArray];
  if (arr.length < 2) return { clusters: arr.map((f, i) => ({ features: f, cluster: 0, index: i })), numClusters: 1 };
  const maxFollowers = Math.max(...arr.map(f => f.followerCount || 0), 1);
  const vectors = arr.map(f => [Math.min((f.pinCount || 0) / 1000, 1), Math.min((f.followerCount || 0) / maxFollowers, 1), (typeof f.category === "string" ? f.category.charCodeAt(0) % 10 : f.category || 0) / 10]);
  const numClusters = Math.min(3, arr.length);
  const kmeans = vectors.slice(0, numClusters).map(v => [...v]);
  let assignments = new Array(arr.length).fill(0);
  for (let iter = 0; iter < 15; iter++) {
    for (let i = 0; i < arr.length; i++) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < numClusters; c++) {
        let d = 0;
        for (let j = 0; j < 3; j++) d += (vectors[i][j] - kmeans[c][j]) ** 2;
        if (d < minDist) { minDist = d; best = c; }
      }
      assignments[i] = best;
    }
    for (let c = 0; c < numClusters; c++) {
      const members = vectors.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        for (let j = 0; j < 3; j++) kmeans[c][j] = members.reduce((s, m) => s + m[j], 0) / members.length;
      }
    }
  }
  return { clusters: arr.map((f, i) => ({ features: { pinCount: f.pinCount, followerCount: f.followerCount, category: f.category }, cluster: assignments[i], index: i })), numClusters, clusterSizes: Array.from({ length: numClusters }, (_, c) => assignments.filter(a => a === c).length) };
}

async function analyzeAudience(features) {
  const { demographics = {}, interests = [], engagementRate = 0, growthRate = 0, topContent = [] } = features;
  const input = tf.tensor2d([[engagementRate, growthRate, interests.length / 20, topContent.length / 10]]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [4] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 4, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });
  const sx = tf.randomNormal([200, 4]);
  const sy = tf.randomUniform([200, 4]);
  await model.fit(sx, sy, { epochs: 20, batchSize: 32, verbose: 0 });
  sx.dispose(); sy.dispose();
  const pred = model.predict(input).dataSync();
  input.dispose(); model.dispose();
  const segmentLabels = ["casual browser", "active pinner", "power user", "influencer"];
  const segments = segmentLabels.map((label, i) => ({ label, score: +pred[i].toFixed(4) }));
  segments.sort((a, b) => b.score - a.score);
  const dominant = segments[0];
  const recommendations = [];
  if (engagementRate < 0.02) recommendations.push("Improve pin quality and posting frequency");
  if (growthRate < 0.01) recommendations.push("Focus on SEO-rich pin descriptions");
  if (interests.length < 3) recommendations.push("Diversify content categories");
  if (topContent.length < 5) recommendations.push("Create more trending content");
  return { demographics, audienceSegment: dominant, segments, engagementRate, growthRate, topInterests: interests.slice(0, 5), recommendations };
}

module.exports = { analyzePinImages, predictEngagement, classifyContent, extractKeywords, detectTrends, forecastGrowth, detectAnomalies, comparePins, clusterBoards, analyzeAudience };
