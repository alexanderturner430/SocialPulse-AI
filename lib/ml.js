/**
 * Minimalist TF-IDF / Keyword extraction logic
 */

function tokenize(text) {
  return text.toLowerCase().match(/\b\w{3,}\b/g) || [];
}

function computeTF(tokens) {
  const tf = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  // Normalize by total tokens
  Object.keys(tf).forEach(token => {
    tf[token] = tf[token] / tokens.length;
  });
  return tf;
}

function extractKeywords(documents, topN = 10) {
  const docs = documents.map(doc => ({
    tokens: tokenize(doc),
    tf: {}
  }));
  
  // Compute TF
  docs.forEach(doc => {
    doc.tf = computeTF(doc.tokens);
  });

  // Compute IDF
  const idf = {};
  const numDocs = docs.length;
  const allTokens = new Set(docs.flatMap(d => Object.keys(d.tf)));
  
  allTokens.forEach(token => {
    let count = 0;
    docs.forEach(doc => {
      if (doc.tf[token]) count++;
    });
    idf[token] = Math.log(numDocs / (1 + count));
  });

  // Compute TF-IDF
  const scores = {};
  docs.forEach(doc => {
    Object.keys(doc.tf).forEach(token => {
      const tfidf = doc.tf[token] * idf[token];
      scores[token] = (scores[token] || 0) + tfidf;
    });
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, score]) => ({ term, score }));
}

function computeVector(documents) {
  const allTerms = new Set();
  const docsTokens = documents.map(doc => {
    const tokens = tokenize(doc);
    tokens.forEach(t => allTerms.add(t));
    return tokens;
  });
  
  const tf = docsTokens.map(tokens => computeTF(tokens));
  const vector = {};
  allTerms.forEach(term => {
    let count = 0;
    tf.forEach(t => { if (t[term]) count++; });
    const idf = Math.log(documents.length / (1 + count));
    vector[term] = tf.reduce((sum, t) => sum + (t[term] || 0), 0) * idf;
  });
  return vector;
}

function cosineSimilarity(vecA, vecB) {
  const terms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dotProduct = 0, magA = 0, magB = 0;
  terms.forEach(term => {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  });
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

module.exports = { extractKeywords, computeVector, cosineSimilarity };
