const { GoogleGenAI } = require("@google/genai");
const env = require('./config/env')
const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

function normalizeText(raw) {
  return raw
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const generateReply = async ({ question, chunks }) => {
  // Use only the top 3 most relevant chunks
  const topChunks = chunks.slice(0, 3);

  const context = topChunks
    .map(
      (chunk, index) =>
        `[${index + 1}] (score ${chunk.score.toFixed(3)})\n${normalizeText(
          chunk.text,
        )}`,
    )
    .join("\n\n");

  // console.log("========= CONTEXT =========");
  // console.log(context);
  // console.log("===========================");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",

    config: {
      systemInstruction: `
        You are a RAG assistant.

        Use only the provided context to answer the question.

        Rules:
        - Answer only what is asked.
        - Prefer the highest-scoring relevant chunk.
        - Use additional chunks only if needed to complete the answer.
        - Do not add, infer, or assume information beyond the context.
        - Preserve the original meaning of the context.
        - If the answer is not explicitly in the context, reply exactly:
        "I don't know based on the provided context."
        - Keep the answer concise (1–3 sentences unless more detail is required).`,
    },

    contents: `
  Context:
  ${context}

  Question:
  ${question}

  Answer:
  `,
  });

  return response.text.trim();
};

module.exports = { generateReply };
