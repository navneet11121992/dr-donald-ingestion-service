require('dotenv').config();

const { fetchFileFromS3 } = require('./lib/s3');
const { extractText } = require('./lib/extractText');
const { chunkText } = require('./lib/chunk');
const { getEmbeddings } = require('./lib/embeddings');
const { ensureCollection, upsertChunks, deleteByAttachmentId } = require('./lib/qdrant');

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '150', 10); 

/**
 * Full ingestion pipeline: S3 -> extract -> chunk -> embed -> upsert into Qdrant.
 *
 * @param {object} params
 * @param {number} params.attachmentId - WordPress attachment ID
 * @param {string} params.s3Key - S3 object key, e.g. "library/123-report.pdf"
 * @param {string} [params.filename] - original filename, used to pick the right text extractor.
 *   Falls back to the basename of s3Key if not provided.
 */
async function ingestFile({ attachmentId, s3Key, filename }) {
  if (!attachmentId || !s3Key) {
    throw new Error('attachmentId and s3Key are required');
  }

  const resolvedFilename = filename || s3Key.split('/').pop();

  console.log(`[ingest] Fetching s3://${process.env.S3_BUCKET}/${s3Key}`);
  const { buffer } = await fetchFileFromS3(s3Key);

  console.log(`[ingest] Extracting text from ${resolvedFilename}`);
  const text = await extractText(buffer, resolvedFilename);

  if (!text || !text.trim()) {
    throw new Error(`No text could be extracted from ${resolvedFilename} — file may be empty, scanned/image-only, or an unsupported format`);
  }

  console.log(`[ingest] Chunking text (${text.length} chars)`);
  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  if (chunks.length === 0) {
    throw new Error('Chunking produced zero chunks — check chunk size/overlap settings');
  }

  console.log(`[ingest] Generating embeddings for ${chunks.length} chunk(s)`);
  const vectors = await getEmbeddings(chunks);

  console.log(`[ingest] Ensuring Qdrant collection exists (vector size: ${vectors[0].length})`);
  await ensureCollection(vectors[0].length);

  console.log(`[ingest] Upserting ${chunks.length} point(s) into Qdrant`);
  const upserted = await upsertChunks({ attachmentId, s3Key, chunks, vectors });

  console.log(`[ingest] Done. ${upserted} chunk(s) ingested for attachment ${attachmentId}.`);
  return { attachmentId, s3Key, chunksIngested: upserted };
}

/**
 * Removes all ingested chunks for a given attachment (de-ingestion).
 * @param {number} attachmentId
 */
async function deingestFile(attachmentId) {
  if (!attachmentId) throw new Error('attachmentId is required');

  console.log(`[deingest] Removing all chunks for attachment ${attachmentId}`);
  await deleteByAttachmentId(attachmentId);
  console.log(`[deingest] Done.`);
  return { attachmentId, status: 'deleted' };
}

module.exports = { ingestFile, deingestFile };

// --- CLI usage: node ingest.js <attachmentId> <s3Key> [filename] ---
if (require.main === module) {
  const [, , attachmentIdArg, s3KeyArg, filenameArg] = process.argv;

  if (!attachmentIdArg || !s3KeyArg) {
    console.error('Usage: node ingest.js <attachmentId> <s3Key> [filename]');
    process.exit(1);
  }

  ingestFile({
    attachmentId: parseInt(attachmentIdArg, 10),
    s3Key: s3KeyArg,
    filename: filenameArg,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ingest] Failed:', err.message);
      process.exit(1);
    });
}
