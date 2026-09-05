const OpenAI = require("openai");

// Configure client for the local LLM server
const client = new OpenAI({
  baseURL: "http://0.0.0.0:4300/v1",
  apiKey: process.env.OPENAI_API_KEY || "dummy-key",
});

async function askLLM(prompt, systemPrompt = "You are a helpful assistant.") {
  try {
    const response = await client.chat.completions.create({
      model: "default", // Assuming 'default' or a standard model name
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("LLM Error:", error);
    throw error;
  }
}

module.exports = { askLLM };
