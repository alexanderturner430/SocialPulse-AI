const autocannon = require('autocannon');

const endpoints = [
  {
    name: 'Sentiment Analysis',
    url: 'http://localhost:6350/api/v1/tools/detect-sentiment/sync',
    body: JSON.stringify({ text: "This is a test message to stress the sentiment analysis tool." })
  },
  {
    name: 'Toxicity Detection',
    url: 'http://localhost:6350/api/v1/tools/detect-toxicity/sync',
    body: JSON.stringify({ text: "This is a test message to stress the toxicity tool." })
  },
  {
    name: 'Image Analysis',
    url: 'http://localhost:6350/api/v1/tools/analyze-image/sync',
    body: JSON.stringify({ imageUrl: "https://example.com/test.jpg" })
  }
];

async function runTests() {
  for (const endpoint of endpoints) {
    console.log(`--- Running test for: ${endpoint.name} ---`);
    const instance = autocannon({
      url: endpoint.url,
      connections: 5,
      duration: 15,
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: endpoint.body
    });
    
    autocannon.track(instance, { renderProgressBar: true });
    
    // Wait for the instance to finish
    await new Promise((resolve) => instance.on('done', resolve));
    console.log(`--- Finished test for: ${endpoint.name} ---\n`);
  }
}

runTests();
