require('dotenv').config();
const env = require('./lib/config/env');
const express = require('express');
const { ingestFile, deingestFile } = require('./ingest');
const { getEmbeddings } = require('./lib/embeddings');
const { searchChunks } = require('./lib/qdrant');
const { generateReply } = require('./lib/generate');
const { requireSecret , asyncHandler } = require('./lib/middleware/middleware');
const { errorHandler } = require('./lib/middleware/errorHandler');
const { ApiError } = require('./lib/utils/apiErrors');
const {chatLimiter} = require('./lib/middleware/rateLimiter');
const cors = require('cors');



const app = express();
app.use(cors({
  origin: function (origin, callback) {
    callback(null, origin);
  },
  credentials: true,
}));

app.use(express.json());

// Catch malformed JSON bodies -> 400 instead of a generic 500
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return next(new ApiError(400, 'Invalid JSON in request body'));
  }
  next(err);
});

const PORT = env.PORT;



app.post('/ingest', requireSecret, asyncHandler(async (req, res) => {
  const { attachment_id, s3_key, filename } = req.body || {};

  if (!attachment_id || !s3_key) {
    throw new ApiError(400, 'attachment_id and s3_key are required');
  }

  console.log(`[server] Starting ingestion for attachment ${attachment_id}, s3://${process.env.S3_BUCKET}/${s3_key}`);

  const result = await ingestFile({ attachmentId: attachment_id, s3Key: s3_key, filename });

  console.log(`[server] Ingestion complete for attachment ${attachment_id}`, result);
  res.status(200).json(result);
}));

app.post('/deingest', requireSecret, asyncHandler(async (req, res) => {
  const { attachment_id } = req.body || {};

  if (!attachment_id) {
    throw new ApiError(400, 'attachment_id is required');
  }

  console.log(`[server] Starting de-ingestion for attachment ${attachment_id}`);
  const result = await deingestFile(attachment_id);

  console.log(`[server] De-ingestion complete for attachment ${attachment_id}`);
  res.status(200).json(result);
}));

app.post('/chat', chatLimiter, requireSecret, asyncHandler(async (req, res) => {
  const { question } = req.body || {};

  if (typeof question !== 'string') {
    throw new ApiError(400, 'A non-empty question is required.');
  };
  
  if(question.trim().length === 0 || question.trim().length > 1000){
      throw new ApiError(400, 'Question must be between 1 and 1000 characters.');
  }

  const [vector] = await getEmbeddings([question], 'RETRIEVAL_QUERY');
  if (!vector) {
    throw new ApiError(502, 'Failed to generate embeddings for the question.');
  }

  const chunks = await searchChunks({ vector });
  if (chunks.length === 0) {
    return res.status(200).json({
      reply: "I couldn't find any relevant information to answer that question.",
      chunks: [],
    });
  }

  const reply = await generateReply({ question, chunks });
  return res.status(200).json({ reply });
}));



app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404 for unknown routes
app.use((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
});

// Central error handler — MUST be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] Ingestion service listening on port ${PORT}`);
});