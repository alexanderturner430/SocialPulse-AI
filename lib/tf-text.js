/**
 * TensorFlow.js NLP/Text Analysis Tools
 * Toxicity detection, sentiment, embeddings, QnA, text classification
 */

const tf = require("@tensorflow/tfjs-node");
const Sentiment = require("sentiment");

const sentiment = new Sentiment();
const modelCache = {};

async function loadModel(name, loader) {
  if (!modelCache[name]) {
    console.log(`[tf-text] Loading model: ${name}...`);
    modelCache[name] = await loader();
    console.log(`[tf-text] Model loaded: ${name}`);
  }
  return modelCache[name];
}

async function detectToxicity(text, threshold = 0.85) {
  const toxicity = require("@tensorflow-models/toxicity");
  const model = await loadModel("toxicity", () => toxicity.load(threshold));
  const predictions = await model.classify(text);
  return predictions.map(p => ({
    label: p.label,
    results: p.results.map(r => ({
      match: r.match,
      score: r.probabilities[1]
    }))
  }));
}

async function embedText(texts) {
  const use = require("@tensorflow-models/universal-sentence-encoder");
  const model = await loadModel("use", () => use.load());
  const arr = Array.isArray(texts) ? texts : [texts];
  const embeddings = await model.embed(arr);
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const vec = embeddings.slice([i, 0], [1, -1]).dataSync();
    result.push({ text: arr[i], embedding: Array.from(vec).slice(0, 20).map(v => +v.toFixed(6)), dimensions: vec.length });
  }
  embeddings.dispose();
  return result;
}

async function analyzeSentimentML(text) {
  const basicResult = sentiment.analyze(text);
  const use = require("@tensorflow-models/universal-sentence-encoder");
  const model = await loadModel("use", () => use.load());
  const embedding = await model.embed([text]);
  const vec = embedding.dataSync();
  embedding.dispose();
  const positiveWords = ["good", "great", "awesome", "excellent", "amazing", "love", "best", "happy", "fantastic", "wonderful"];
  const negativeWords = ["bad", "terrible", "awful", "worst", "hate", "horrible", "poor", "ugly", "sad", "angry"];
  const lower = text.toLowerCase();
  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  const keywordScore = (posCount - negCount) / Math.max(1, posCount + negCount);
  const combinedScore = (basicResult.comparative * 0.5) + (keywordScore * 0.5);
  return {
    score: combinedScore,
    comparative: basicResult.comparative,
    positive: basicResult.positive,
    negative: basicResult.negative,
    sentiment: combinedScore > 0.1 ? "positive" : combinedScore < -0.1 ? "negative" : "neutral"
  };
}

async function answerQuestion(question, context) {
  const qna = require("@tensorflow-models/qna");
  const model = await loadModel("qna", () => qna.load());
  const answers = await model.findAnswers(question, context);
  return answers.slice(0, 5).map(a => ({
    text: a.text,
    score: a.score,
    startIndex: a.startIndex,
    endIndex: a.endIndex
  }));
}

async function classifyText(text, categories) {
  const use = require("@tensorflow-models/universal-sentence-encoder");
  const knnClassifier = require("@tensorflow-models/knn-classifier");
  const model = await loadModel("use", () => use.load());
  const classifier = await loadModel("knn", () => knnClassifier.create());
  const catNames = Object.keys(categories);
  for (const cat of catNames) {
    const examples = categories[cat];
    if (examples && examples.length > 0) {
      const embeddings = await model.embed(examples);
      for (let i = 0; i < examples.length; i++) {
        const emb = embeddings.slice([i, 0], [1, -1]);
        classifier.addExample(emb, cat);
        emb.dispose();
      }
      embeddings.dispose();
    }
  }
  const textEmbedding = await model.embed([text]);
  const result = await classifier.predictClass(textEmbedding.slice([0, 0], [1, -1]));
  textEmbedding.dispose();
  return {
    label: result.label,
    confidences: result.confidences
  };
}

async function extractKeywordsML(text, topN = 10) {
  const use = require("@tensorflow-models/universal-sentence-encoder");
  const model = await loadModel("use", () => use.load());
  const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const uniqueWords = [...new Set(words)].slice(0, 100);
  const embeddings = await model.embed(uniqueWords);
  const wordScores = {};
  const textEmbedding = await model.embed([text]);
  const textVec = textEmbedding.dataSync();
  textEmbedding.dispose();
  for (let i = 0; i < uniqueWords.length; i++) {
    const wordVec = embeddings.slice([i, 0], [1, -1]).dataSync();
    let dotProduct = 0, magA = 0, magB = 0;
    for (let j = 0; j < textVec.length; j++) {
      dotProduct += textVec[j] * wordVec[j];
      magA += textVec[j] * textVec[j];
      magB += wordVec[j] * wordVec[j];
    }
    const similarity = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
    const frequency = words.filter(w => w === uniqueWords[i]).length;
    wordScores[uniqueWords[i]] = similarity * Math.log(1 + frequency);
  }
  embeddings.dispose();
  return Object.entries(wordScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, score]) => ({ term, score: +score.toFixed(4) }));
}

module.exports = {
  detectToxicity,
  embedText,
  analyzeSentimentML,
  answerQuestion,
  classifyText,
  extractKeywordsML
};