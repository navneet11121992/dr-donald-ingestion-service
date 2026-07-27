/**
 * Splits text into overlapping chunks by character count.
 * Character-based chunking is a simple, model-agnostic approximation of token count
 * (roughly 4 chars ≈ 1 token for English text) — good enough for most embedding pipelines
 * without pulling in a tokenizer dependency. Swap in a proper tokenizer (e.g. tiktoken)
 * if you need exact token-boundary control.
 *
 * @param {string} text
 * @param {number} chunkSize - target characters per chunk
 * @param {number} overlap - characters of overlap between consecutive chunks
 * @returns {string[]}
 */
function chunkText(text, chunkSize = 1000, overlap = 150) {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

  if (!cleaned) return [];
  if (overlap >= chunkSize) {
    throw new Error('overlap must be smaller than chunkSize');
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to break on a paragraph/sentence boundary near the target end,
    // rather than mid-word, for cleaner chunk boundaries.
    if (end < cleaned.length) {
      const lookback = cleaned.slice(start, end);
      const lastBreak = Math.max(
        lookback.lastIndexOf('\n\n'),
        lookback.lastIndexOf('. '),
        lookback.lastIndexOf('.\n')
      );
      // Only use the natural break if it's not too far back (avoid tiny chunks)
      if (lastBreak > chunkSize * 0.5) {
        end = start + lastBreak + 1;
      }
    }

    const piece = cleaned.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= cleaned.length) break;
    start = end - overlap;
  }

  return chunks;
}

module.exports = { chunkText };
