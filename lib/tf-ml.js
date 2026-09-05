/**
 * TensorFlow.js Statistical ML Tools
 * Anomaly detection, time series forecasting, clustering, regression, PCA
 */

const tf = require("@tensorflow/tfjs-node");

async function detectAnomalies(dataPoints, thresholdPercentile = 95) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || d.y || 0);
  const tensorData = tf.tensor2d(data.map(v => [v]));
  const min = tensorData.min();
  const max = tensorData.max();
  const normalized = tensorData.sub(min).div(max.sub(min));
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
  const threshold = sorted[Math.floor(sorted.length * thresholdPercentile / 100)] || 0;
  return dataPoints.map((d, i) => ({
    value: typeof d === "number" ? d : d.value || d.y || 0,
    error: typeof errors[i] === "number" ? +errors[i].toFixed(6) : 0,
    isAnomaly: (errors[i] || 0) > threshold,
    index: i
  }));
}

async function forecastTimeSeries(dataPoints, daysAhead = 7) {
  const data = dataPoints.map(d => typeof d === "number" ? d : d.value || d.y || 0);
  if (data.length < 10) return { error: "Need at least 10 data points for LSTM forecasting" };
  const tensorData = tf.tensor2d(data.map(v => [v]));
  const min = tensorData.min();
  const max = tensorData.max();
  const normalized = tensorData.sub(min).div(max.sub(min));
  const lookback = Math.min(5, Math.floor(data.length / 3));
  const xs = [], ys = [];
  for (let i = lookback; i < data.length; i++) {
    xs.push(data.slice(i - lookback, i).map(v => [(v - data.slice(0).reduce((a, b) => a + b, 0) / data.length) / 100]));
    ys.push([(data[i]) / 100]);
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
  tensorData.dispose();
  min.dispose();
  max.dispose();
  let currentInput = data.slice(-lookback).map(v => [(v - data.slice(0).reduce((a, b) => a + b, 0) / data.length) / 100]);
  const forecast = [];
  for (let i = 0; i < daysAhead; i++) {
    const inputTensor = tf.tensor3d([currentInput]);
    const pred = model.predict(inputTensor).dataSync()[0] * 100;
    inputTensor.dispose();
    forecast.push(Math.round(pred));
    currentInput.shift();
    currentInput.push([pred / 100]);
  }
  model.dispose();
  const trend = data.length >= 2 ? (data[data.length - 1] - data[0]) / data.length : 0;
  return { forecast, trend: trend > 0 ? "upward" : trend < 0 ? "downward" : "flat", lookback, daysAhead };
}

async function clusterData(dataPoints, numClusters = 3) {
  const data = dataPoints.map(d => Array.isArray(d) ? d : [d.x || 0, d.y || 0]);
  const tensor = tf.tensor2d(data);
  const centroids = tf.randomNormal([numClusters, data[0].length]);
  let assignments = tf.zeros([data.length]);
  for (let iter = 0; iter < 20; iter++) {
    const dists = [];
    for (let c = 0; c < numClusters; c++) {
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
    for (let c = 0; c < numClusters; c++) {
      const mask = assignments.equal(tf.scalar(c, "int32"));
      const maskFloat = mask.toFloat();
      const count = maskFloat.sum();
      const countSafe = count.add(tf.scalar(1e-8));
      const masked = tensor.mul(maskFloat.expandDims(1));
      const newCentroid = masked.sum(0).div(countSafe);
      centroids.slice([c, 0], [1, -1]).dispose();
      tf.keep(newCentroid);
    }
  }
  const clusterIds = Array.from(assignments.dataSync());
  tensor.dispose();
  centroids.dispose();
  assignments.dispose();
  return dataPoints.map((d, i) => ({
    point: d,
    cluster: clusterIds[i]
  }));
}

async function regressionAnalysis(xValues, yValues) {
  const xs = tf.tensor2d(xValues.map(v => [v]));
  const ys = tf.tensor2d(yValues.map(v => [v]));
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 8, activation: "relu", inputShape: [1] }));
  model.add(tf.layers.dense({ units: 4, activation: "relu" }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });
  await model.fit(xs, ys, { epochs: 100, batchSize: 32, verbose: 0 });
  const predictions = model.predict(xs).dataSync();
  xs.dispose();
  ys.dispose();
  const ssRes = yValues.reduce((sum, y, i) => sum + (y - predictions[i]) ** 2, 0);
  const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
  const ssTot = yValues.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  model.dispose();
  return { rSquared: +rSquared.toFixed(4), predictions: Array.from(predictions).map(v => +v.toFixed(4)), n: xValues.length };
}

async function reduceDimensions(dataMatrix, targetDimensions = 2) {
  const tensor = tf.tensor2d(dataMatrix);
  const mean = tensor.mean(0);
  const centered = tensor.sub(mean);
  const cov = centered.transpose().matMul(centered).div(tf.scalar(dataMatrix.length - 1));
  const { values, vectors } = tf.linalg.eig(cov);
  const vals = Array.from(values.dataSync());
  const sorted = vals.map((v, i) => ({ value: v, index: i })).sort((a, b) => b.value - a.value);
  const topIndices = sorted.slice(0, targetDimensions).map(s => s.index);
  const projected = centered.matMul(vectors.slice([0, topIndices[0]], [-1, 1]));
  let result = Array.from(projected.dataSync()).map(v => [v]);
  for (let d = 1; d < targetDimensions; d++) {
    const col = centered.matMul(vectors.slice([0, topIndices[d]], [-1, 1]));
    const colArr = Array.from(col.dataSync());
    result = result.map((r, i) => [...r, colArr[i]]);
    col.dispose();
  }
  tensor.dispose();
  mean.dispose();
  centered.dispose();
  cov.dispose();
  values.dispose();
  vectors.dispose();
  projected.dispose();
  return { reduced: result, explainedVariance: sorted.slice(0, targetDimensions).map(s => +(s.value / vals.reduce((a, b) => a + b, 0)).toFixed(4)) };
}

async function predictEngagement(features) {
  const { likes, shares, comments, impressions, age, timeOfDay } = features;
  const input = tf.tensor2d([[likes || 0, shares || 0, comments || 0, impressions || 1, age || 0, timeOfDay || 12]]);
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
  return { engagementScore: +prediction.toFixed(4), features };
}

async function detectTrends(timeSeriesData) {
  const data = timeSeriesData.map(d => typeof d === "number" ? d : d.value || d.y || 0);
  const windowSize = Math.max(3, Math.floor(data.length / 5));
  const movingAvg = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
    const window = data.slice(start, end);
    movingAvg.push(window.reduce((a, b) => a + b, 0) / window.length);
  }
  const diffs = [];
  for (let i = 1; i < movingAvg.length; i++) diffs.push(movingAvg[i] - movingAvg[i - 1]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const stdDiff = Math.sqrt(diffs.reduce((sum, d) => sum + (d - avgDiff) ** 2, 0) / diffs.length);
  const changePoints = [];
  for (let i = 1; i < diffs.length; i++) {
    if (Math.abs(diffs[i] - diffs[i - 1]) > 2 * stdDiff) changePoints.push(i + 1);
  }
  const trend = avgDiff > 0.01 * (data.reduce((a, b) => a + b, 0) / data.length) ? "upward" :
    avgDiff < -0.01 * (data.reduce((a, b) => a + b, 0) / data.length) ? "downward" : "stable";
  return { trend, averageChange: +avgDiff.toFixed(4), changePoints, movingAverage: movingAvg.map(v => +v.toFixed(2)) };
}

function analyzeABTest(groupA, groupB) {
  const meanA = groupA.reduce((a, b) => a + b, 0) / groupA.length;
  const meanB = groupB.reduce((a, b) => a + b, 0) / groupB.length;
  const varA = groupA.reduce((sum, v) => sum + (v - meanA) ** 2, 0) / (groupA.length - 1);
  const varB = groupB.reduce((sum, v) => sum + (v - meanB) ** 2, 0) / (groupB.length - 1);
  const se = Math.sqrt(varA / groupA.length + varB / groupB.length);
  const tStat = se === 0 ? 0 : (meanB - meanA) / se;
  const df = groupA.length + groupB.length - 2;
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
  const lift = meanA === 0 ? 0 : (meanB - meanA) / meanA * 100;
  return {
    groupA: { mean: +meanA.toFixed(4), std: +Math.sqrt(varA).toFixed(4), n: groupA.length },
    groupB: { mean: +meanB.toFixed(4), std: +Math.sqrt(varB).toFixed(4), n: groupB.length },
    tStatistic: +tStat.toFixed(4),
    pValue: +pValue.toFixed(6),
    significant: pValue < 0.05,
    lift: +lift.toFixed(2) + "%",
    winner: pValue < 0.05 ? (meanB > meanA ? "B" : "A") : "no significant difference"
  };
}

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

module.exports = {
  detectAnomalies,
  forecastTimeSeries,
  clusterData,
  regressionAnalysis,
  reduceDimensions,
  predictEngagement,
  detectTrends,
  analyzeABTest
};