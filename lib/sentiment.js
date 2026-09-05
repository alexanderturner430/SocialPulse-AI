/**
 * Minimalist sentiment analysis
 */

const positiveWords = new Set(["great", "love", "awesome", "good", "amazing", "useful", "thanks"]);
const negativeWords = new Set(["bad", "hate", "terrible", "useless", "confusing", "wrong", "boring"]);

function analyzeSentiment(text) {
  const tokens = text.toLowerCase().match(/\b\w+\b/g) || [];
  let score = 0;
  tokens.forEach(token => {
    if (positiveWords.has(token)) score++;
    if (negativeWords.has(token)) score--;
  });
  return score;
}

module.exports = { analyzeSentiment };
