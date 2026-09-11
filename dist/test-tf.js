const { analyzeSentimentML } = require("./lib/tf-text");

async function run() {
  try {
    console.log("Running sentiment analysis...");
    const result = await analyzeSentimentML("I love using this new API!");
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
