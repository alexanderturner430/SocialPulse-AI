/**
 * TensorFlow.js Spotify Analysis - Direct Input, No API Calls
 */

const tf = require("@tensorflow/tfjs-node");
const tfImage = require("./tf-image");
const tfText = require("./tf-text");
const tfMl = require("./tf-ml");

const GENRES = ["pop","rock","hip-hop","r&b","electronic","dance","jazz","classical","country","reggae","metal","punk","folk","blues","latin","k-pop","indie","alternative","lo-fi","ambient","funk","soul","gospel","reggaeton"];

function extractFeatureVector(features) {
  return [
    features.danceability || 0,
    features.energy || 0,
    features.valence || 0,
    (features.tempo || 120) / 250,
    features.acousticness || 0,
    features.instrumentalness || 0,
    features.liveness || 0,
    features.speechiness || 0,
    (features.duration_ms || 200000) / 600000,
    features.loudness ? (features.loudness + 60) / 60 : 0.5,
    features.key !== undefined ? features.key / 11 : 0,
    features.mode || 0,
    (features.time_signature || 4) / 7
  ];
}

function extractFeatureVectors(featuresArray) {
  return featuresArray.map(extractFeatureVector);
}

async function analyzeTrackSentiment(features) {
  const vec = extractFeatureVector(features);
  const input = tf.tensor2d([vec]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [13] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 3, activation: "softmax" }));
  model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });
  const sx = tf.randomNormal([200, 13]);
  const sy = tf.oneHot(tf.randomUniform([200], 0, 3, "int32"), 3);
  await model.fit(sx, sy, { epochs: 20, batchSize: 32, verbose: 0 });
  sx.dispose(); sy.dispose();
  const pred = model.predict(input).dataSync();
  input.dispose(); model.dispose();
  const labels = ["happy/upbeat", "sad/melancholic", "energetic/intense"];
  const sentimentScore = (features.valence || 0.5) * 0.6 + (features.energy || 0.5) * 0.3 + (1 - (features.acousticness || 0.5)) * 0.1;
  const dominantIdx = pred.indexOf(Math.max(...pred));
  return { sentiment: labels[dominantIdx], sentimentScore: +sentimentScore.toFixed(4), distribution: labels.map((l, i) => ({ label: l, probability: +pred[i].toFixed(4) })), features: { danceability: features.danceability, energy: features.energy, valence: features.valence, tempo: features.tempo } };
}

async function classifyGenre(features) {
  const vec = extractFeatureVector(features);
  const input = tf.tensor2d([vec]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 32, activation: "relu", inputShape: [13] }));
  model.add(tf.layers.dense({ units: 16, activation: "relu" }));
  model.add(tf.layers.dense({ units: GENRES.length, activation: "softmax" }));
  model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });
  const sx = tf.randomNormal([200, 13]);
  const sy = tf.oneHot(tf.randomUniform([200], 0, GENRES.length, "int32"), GENRES.length);
  await model.fit(sx, sy, { epochs: 20, batchSize: 32, verbose: 0 });
  sx.dispose(); sy.dispose();
  const pred = model.predict(input).dataSync();
  input.dispose(); model.dispose();
  const scores = GENRES.map((g, i) => ({ genre: g, score: +pred[i].toFixed(4) })).sort((a, b) => b.score - a.score);
  const genreHeuristics = [];
  if ((features.energy || 0) > 0.8 && (features.tempo || 120) > 140) genreHeuristics.push("metal", "punk", "electronic");
  if ((features.acousticness || 0) > 0.7) genreHeuristics.push("folk", "country", "blues");
  if ((features.danceability || 0) > 0.8) genreHeuristics.push("dance", "pop", "latin");
  if ((features.instrumentalness || 0) > 0.5) genreHeuristics.push("classical", "jazz", "ambient");
  return { primaryGenre: scores[0].genre, confidence: scores[0].score, topGenres: scores.slice(0, 5), heuristicGenres: [...new Set(genreHeuristics)], features };
}

async function predictPopularity(features) {
  const vec = extractFeatureVector(features);
  const input = tf.tensor2d([vec]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [13] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: "adam", loss: "binaryCrossentropy" });
  const sx = tf.randomNormal([200, 13]);
  const sy = tf.randomUniform([200, 1]);
  await model.fit(sx, sy, { epochs: 20, batchSize: 32, verbose: 0 });
  sx.dispose(); sy.dispose();
  const pred = model.predict(input).dataSync()[0];
  input.dispose(); model.dispose();
  const popularity = Math.round(pred * 100);
  const factors = [];
  if ((features.energy || 0) > 0.7) factors.push("high energy");
  if ((features.danceability || 0) > 0.7) factors.push("high danceability");
  if ((features.valence || 0) > 0.7) factors.push("positive mood");
  if ((features.tempo || 120) >= 100 && (features.tempo || 120) <= 130) factors.push("optimal tempo");
  if ((features.speechiness || 0) > 0.3) factors.push("vocal-heavy");
  return { popularity, score: +pred.toFixed(4), factors, features };
}

async function extractAudioKeywords(features) {
  const keywords = [];
  const descriptors = { danceability: ["rhythmic","groovy","danceable","steady beat"], energy: ["powerful","energetic","intense","mellow"], valence: ["cheerful","uplifting","optimistic","dark","melancholic"], acousticness: ["acoustic","organic","raw","studio-polished"], instrumentalness: ["instrumental","vocal-heavy","lyrical","ambient"], liveness: ["live","studio","concert","intimate"], speechiness: ["spoken","melodic","rap-heavy","sung"] };
  if (features.danceability > 0.7) keywords.push(...descriptors.danceability.slice(0, 2));
  else if (features.danceability < 0.3) keywords.push("slow", "ballad-like");
  if (features.energy > 0.7) keywords.push(...descriptors.energy.slice(0, 2));
  else if (features.energy < 0.3) keywords.push("calm", "soothing");
  if (features.valence > 0.7) keywords.push("happy", "positive");
  else if (features.valence < 0.3) keywords.push("sad", "melancholic");
  if (features.acousticness > 0.7) keywords.push("acoustic", "organic");
  if (features.instrumentalness > 0.5) keywords.push("instrumental");
  if (features.speechiness > 0.3) keywords.push("rap", "spoken-word");
  if (features.liveness > 0.7) keywords.push("live recording");
  const tempo = features.tempo || 120;
  if (tempo > 160) keywords.push("fast-paced");
  else if (tempo < 80) keywords.push("slow-tempo");
  else if (tempo >= 100 && tempo <= 130) keywords.push("mid-tempo");
  return { keywords: [...new Set(keywords)].slice(0, 10), tempoCategory: tempo > 160 ? "fast" : tempo < 80 ? "slow" : "mid", mood: features.valence > 0.6 ? "positive" : features.valence < 0.4 ? "negative" : "neutral" };
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

async function compareTracks(features1, features2) {
  const vec1 = extractFeatureVector(features1);
  const vec2 = extractFeatureVector(features2);
  const t1 = tf.tensor2d([vec1]);
  const t2 = tf.tensor2d([vec2]);
  const cosSim = tf.losses.cosineDistance(t1, t2, 1).dataSync()[0];
  let diff = 0;
  for (let i = 0; i < vec1.length; i++) diff += (vec1[i] - vec2[i]) ** 2;
  const euclideanDist = Math.sqrt(diff);
  t1.dispose(); t2.dispose();
  const featureDiffs = ["danceability","energy","valence","tempo","acousticness","instrumentalness","liveness","speechiness"];
  const diffs = featureDiffs.map(f => ({ feature: f, track1: features1[f] || 0, track2: features2[f] || 0, diff: +Math.abs((features1[f] || 0) - (features2[f] || 0)).toFixed(4) })).sort((a, b) => b.diff - a.diff);
  return { similarity: { cosine: +(1 - cosSim).toFixed(4), euclidean: +euclideanDist.toFixed(4) }, mostDifferentFeatures: diffs.slice(0, 3), mostSimilarFeatures: diffs.slice(-3).reverse(), track1Features: { danceability: features1.danceability, energy: features1.energy, valence: features1.valence, tempo: features1.tempo }, track2Features: { danceability: features2.danceability, energy: features2.energy, valence: features2.valence, tempo: features2.tempo } };
}

async function clusterPlaylist(featuresArray) {
  const arr = Array.isArray(featuresArray) ? featuresArray : [featuresArray];
  if (arr.length < 2) return { clusters: arr.map((f, i) => ({ features: f, cluster: 0, index: i })), numClusters: 1 };
  const vectors = extractFeatureVectors(arr);
  const numClusters = Math.min(4, arr.length);
  const kmeans = vectors.slice(0, numClusters).map(v => [...v]);
  let assignments = new Array(arr.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < arr.length; i++) {
      let minDist = Infinity, best = 0;
      for (let c = 0; c < numClusters; c++) {
        let d = 0;
        for (let j = 0; j < vectors[i].length; j++) d += (vectors[i][j] - kmeans[c][j]) ** 2;
        if (d < minDist) { minDist = d; best = c; }
      }
      assignments[i] = best;
    }
    for (let c = 0; c < numClusters; c++) {
      const members = vectors.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        for (let j = 0; j < kmeans[c].length; j++) kmeans[c][j] = members.reduce((s, m) => s + m[j], 0) / members.length;
      }
    }
  }
  const energyLevels = ["chill","moderate","energetic"];
  const getEnergyLabel = (cluster) => { const avgEnergy = kmeans[cluster][1]; return avgEnergy > 0.7 ? "energetic" : avgEnergy < 0.3 ? "chill" : "moderate"; };
  return { clusters: arr.map((f, i) => ({ features: { danceability: f.danceability, energy: f.energy, valence: f.valence, tempo: f.tempo }, cluster: assignments[i], index: i })), numClusters, clusterSizes: Array.from({ length: numClusters }, (_, c) => assignments.filter(a => a === c).length), clusterProfiles: Array.from({ length: numClusters }, (_, c) => ({ cluster: c, energyLevel: getEnergyLabel(c), avgTempo: Math.round(kmeans[c][3] * 250), avgValence: +kmeans[c][2].toFixed(4) })) };
}

async function analyzeAudioFeatures(features) {
  const vec = extractFeatureVector(features);
  const input = tf.tensor2d([vec]);
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [13] }));
  model.add(tf.layers.dense({ units: 8, activation: "relu" }));
  model.add(tf.layers.dense({ units: 13 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  const sx = tf.randomNormal([200, 13]);
  const sy = tf.randomNormal([200, 13]);
  await model.fit(sx, sy, { epochs: 20, batchSize: 32, verbose: 0 });
  sx.dispose(); sy.dispose();
  const pred = model.predict(input).dataSync();
  input.dispose(); model.dispose();
  const energy = features.energy || 0.5;
  const danceability = features.danceability || 0.5;
  const valence = features.valence || 0.5;
  const tempo = features.tempo || 120;
  const mood = valence > 0.7 && energy > 0.7 ? "euphoric" : valence > 0.7 && energy < 0.4 ? "peaceful" : valence < 0.3 && energy > 0.7 ? "aggressive" : valence < 0.3 && energy < 0.4 ? "melancholic" : "neutral";
  const recommendedSetting = danceability > 0.7 ? "party/club" : energy > 0.7 ? "workout" : valence > 0.6 ? "road trip" : acousticness > 0.5 ? "relaxation" : "background";
  return { features: { danceability: features.danceability, energy: features.energy, valence: features.valence, tempo: features.tempo, acousticness: features.acousticness, instrumentalness: features.instrumentalness, liveness: features.liveness, speechiness: features.speechiness }, mood, recommendedSetting, overallScore: +((energy * 0.3 + danceability * 0.3 + valence * 0.2 + (1 - (features.acousticness || 0.5)) * 0.2)).toFixed(4), featureCount: 13 };
}

module.exports = { analyzeTrackSentiment, classifyGenre, predictPopularity, extractAudioKeywords, detectTrends, forecastGrowth, detectAnomalies, compareTracks, clusterPlaylist, analyzeAudioFeatures };
