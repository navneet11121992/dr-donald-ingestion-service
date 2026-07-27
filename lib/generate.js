const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
function normalizeText(raw) {
  return raw
    .replace(/\s*\n\s*/g, ' ')  
    .replace(/\s{2,}/g, ' ')    
    .trim();
}

const generateReply = async ({ question, chunks }) => {
     
  const context = chunks
  .map((c, i) => `[${i + 1}] (score ${c.score.toFixed(3)})\n${normalizeText(c.text)}`)
  .join('\n\n');
console.log(context)
  const prompt = `You are a helpful assistant. Answer the question using ONLY the context below. If the answer isn't in the context, say you don't know.
context:
${context}
Question:
${question}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: prompt,
  });

  return response.text;
};

module.exports = { generateReply };