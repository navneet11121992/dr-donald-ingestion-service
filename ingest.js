// require('dotenv').config();

// const { fetchFileFromS3 } = require('./lib/s3');
// const { extractText } = require('./lib/extractText');
// const { chunkText } = require('./lib/chunk');
// const { getEmbeddings } = require('./lib/embeddings');
// const { ensureCollection, upsertChunks, deleteByAttachmentId } = require('./lib/qdrant');
// const {ApiError} = require('./lib/utils/apiErrors');


// const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000', 10);
// const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '150', 10); 

// async function ingestFile({ attachmentId, s3Key, filename }) {
//   if (!attachmentId || !s3Key) {
//     throw new ApiError(500,'attachmentId and s3Key are required');
//   }

//   const resolvedFilename = filename || s3Key.split('/').pop();

//   console.log(`[ingest] Fetching s3://${process.env.S3_BUCKET}/${s3Key}`);
//   const { buffer } = await fetchFileFromS3(s3Key);

//   console.log(`[ingest] Extracting text from ${resolvedFilename}`);
//   const text = await extractText(buffer, resolvedFilename);

//   if (!text || !text.trim()) {
//     throw new ApiError(`No text could be extracted from ${resolvedFilename} — file may be empty, scanned/image-only, or an unsupported format`);
//   }

//   console.log(`[ingest] Chunking text (${text.length} chars)`);
//   const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

//   if (chunks.length === 0) {
//     throw new ApiError('Chunking produced zero chunks — check chunk size/overlap settings');
//   }

//   console.log(`[ingest] Generating embeddings for ${chunks.length} chunk(s)`);
//   const vectors = await getEmbeddings(chunks);

//   console.log(`[ingest] Ensuring Qdrant collection exists (vector size: ${vectors[0].length})`);
//   await ensureCollection(vectors[0].length);

//   console.log(`[ingest] Upserting ${chunks.length} point(s) into Qdrant`);
//   const upserted = await upsertChunks({ attachmentId, s3Key, chunks, vectors });

//   console.log(`[ingest] Done. ${upserted} chunk(s) ingested for attachment ${attachmentId}.`);
//   return { attachmentId, s3Key, chunksIngested: upserted };
// }

// /**
//  * Removes all ingested chunks for a given attachment (de-ingestion).
//  * @param {number} attachmentId
//  */
// async function deingestFile(attachmentId) {
//   if (!attachmentId) throw new ApiError('attachmentId is required');

//   console.log(`[deingest] Removing all chunks for attachment ${attachmentId}`);
//   await deleteByAttachmentId(attachmentId);
//   console.log(`[deingest] Done.`);
//   return { attachmentId, status: 'deleted' };
// }

// module.exports = { ingestFile, deingestFile };


require('dotenv').config();

const { fetchFileFromS3 } = require('./lib/s3');
const { extractText } = require('./lib/extractText');
const { chunkText } = require('./lib/chunk');
const { getEmbeddings } = require('./lib/embeddings');
const { ensureCollection, upsertChunks, deleteByAttachmentId } = require('./lib/qdrant');
const { ApiError } = require('./lib/utils/apiErrors');

const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '150', 10);

async function ingestFile({ attachmentId, s3Key, filename }) {
	// Bad input from the caller -> 400
	if (!attachmentId || !s3Key) {
		throw new ApiError(400, 'attachmentId and s3Key are required');
	}

	const resolvedFilename = filename || s3Key.split('/').pop();

	console.log(`[ingest] Fetching s3://${process.env.S3_BUCKET}/${s3Key}`);
	const { buffer } = await fetchFileFromS3(s3Key);

	console.log(`[ingest] Extracting text from ${resolvedFilename}`);
	const text = await extractText(buffer, resolvedFilename);

	if (!text || !text.trim()) {
		// 422: request was fine, but the file content can't be processed
		throw new ApiError(
		422,
		`No text could be extracted from ${resolvedFilename} — file may be empty, scanned/image-only, or an unsupported format`
		);
	}

	console.log(`[ingest] Chunking text (${text.length} chars)`);
	const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

	if (chunks.length === 0) {
		throw new ApiError(500, 'Chunking produced zero chunks — check chunk size/overlap settings');
	}

	console.log(`[ingest] Generating embeddings for ${chunks.length} chunk(s)`);
	const vectors = await getEmbeddings(chunks);

	// Guard before reading vectors[0].length so we don't crash with a confusing error
	if (!Array.isArray(vectors) || vectors.length === 0 || !vectors[0] || !vectors[0].length) {
		throw new ApiError(500, 'Embedding generation failed — no vectors were returned');
	}

	console.log(`[ingest] Ensuring Qdrant collection exists (vector size: ${vectors[0].length})`);
	await ensureCollection(vectors[0].length);

	console.log(`[ingest] Upserting ${chunks.length} point(s) into Qdrant`);
	const upserted = await upsertChunks({ attachmentId, s3Key, chunks, vectors });

	console.log(`[ingest] Done. ${upserted} chunk(s) ingested for attachment ${attachmentId}.`);
	return { attachmentId, s3Key, chunksIngested: upserted };
}


async function deingestFile(attachmentId) {
	if (!attachmentId) {
		throw new ApiError(400, 'attachmentId is required');
	}

	console.log(`[deingest] Removing all chunks for attachment ${attachmentId}`);
	await deleteByAttachmentId(attachmentId);
	console.log(`[deingest] Done.`);
	return { attachmentId, status: 'deleted' };
}

module.exports = { ingestFile, deingestFile };
