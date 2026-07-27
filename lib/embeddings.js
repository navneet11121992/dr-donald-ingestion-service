const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs/request, but keep batches modest for reliability


// import { GoogleGenAI } from "@google/genai";
const { GoogleGenAI } = require("@google/genai");

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-embedding-001"; // Google's current embedding model
/**
 * Generates embeddings for an array of text chunks, batching requests
 * to stay within request size limits and make retries cheaper.
 * @param {string[]} chunks
 * @returns {Promise<number[][]>} embeddings, in the same order as input chunks
 */
// async function getEmbeddings(chunks) {
//   const embeddings = [];

//   for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
//     const batch = chunks.slice(i, i + BATCH_SIZE);

//     const response = await withRetry(() =>
//       openai.embeddings.create({
//         model: MODEL,
//         input: batch,
//       })
//     );

//     // response.data is returned in the same order as the input array
//     for (const item of response.data) {
//       embeddings.push(item.embedding);
//     }
//   }

//   return embeddings;
// }

async function getEmbeddings(chunks) {
  const embeddings = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const response = await withRetry(() =>
      genai.models.embedContent({
        model: MODEL,
        contents: batch, // array of strings, same order preserved in response
        // config: { outputDimensionality: 768 }, // optional: shrink vector size
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

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return withRetry(fn, retries - 1, delayMs * 2);
  }
}

module.exports = { getEmbeddings, EMBEDDING_MODEL: MODEL };
