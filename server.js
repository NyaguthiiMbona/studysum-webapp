const express = require('express');
const { Configuration, OpenAIApi } = require("openai");
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// CORS Support
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// AI Setup – Use Claude 3 Haiku or GPT-4o
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY || "EMPTY",
  basePath: "https://openrouter.ai/api/v1 "
});
const openai = new OpenAIApi(configuration);

// Utility: Split long text into chunks
function chunkText(text, maxTokens = 3000) {
  const words = text.split(" ");
  const chunks = [];
  let currentChunk = [];

  for (let word of words) {
    currentChunk.push(word);
    if (currentChunk.join(" ").length > maxTokens) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

// Helper: Summarize one chunk
async function summarizeChunk(chunk, subject) {
  const prompt = `Create a clear, structured summary of this ${subject} lecture:\n\n${chunk}`;
  const response = await openai.createCompletion({
    model: "anthropic/claude-3-haiku", // Great for long summaries
    prompt: prompt,
    max_tokens: 300,
    temperature: 0.5
  });

  return response.data.choices[0].text.trim();
}

// Main Endpoint
app.post('/summarize', async (req, res) => {
  const { text, subject } = req.body;

  if (!text || !subject) {
    return res.status(400).json({ error: "Text and subject are required." });
  }

  try {
    const chunks = chunkText(text, 3000); // ~3000 words per chunk
    const summaries = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPrompt = `Summarize part ${i + 1} of a long ${subject} lecture:\n\n${chunk}`;
      try {
        const summary = await summarizeChunk(chunk, subject);
        summaries.push(`### Part ${i + 1}\n\n${summary}`);
      } catch (err) {
        console.error(`Failed to summarize chunk ${i + 1}:`, err.message);
        summaries.push(`⚠️ Summary failed for part ${i + 1}.`);
      }
    }

    const fullSummary = summaries.join("\n\n---\n\n");
    res.json({ summary: fullSummary });
  } catch (error) {
    console.error("Error summarizing:", error);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
