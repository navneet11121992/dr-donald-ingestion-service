
const env = require('./config/env')
const { GoogleGenAI } = require("@google/genai");

const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const MODEL = "gemini-embedding-001"; 

const BATCH_SIZE = 100; 
async function getEmbeddings(chunks, taskType = 'RETRIEVAL_DOCUMENT') {
  const embeddings = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const response = await withRetry(() =>
      genai.models.embedContent({
        model: MODEL,
        contents: batch, // array of strings, same order preserved in response
         config: taskType, // optional: shrink vector size
      })
    );

    // response.embeddings is returned in the same order as input array
    for (const item of response.embeddings) {
      embeddings.push(item.values);
    }
  }

  return embeddings;
}

/**
 * Basic retry with exponential backoff for transient errors (rate limits, network blips).
 */
async function withRetry(fn, retries = 4, delayMs = 1000) {
	try {
		return await fn();
	} catch (err) {
		const isRetryable = err?.status === 429 || err?.status >= 500 || err?.code === 'ECONNRESET';
		if (retries <= 0 || !isRetryable) throw err;
		console.log('System will retry for it after one second.');
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		return withRetry(fn, retries - 1, delayMs * 2);
	}
}

module.exports = { getEmbeddings, EMBEDDING_MODEL: MODEL };


