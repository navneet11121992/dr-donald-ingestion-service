require('dotenv').config();
const express = require('express');
const { ingestFile, deingestFile } = require('./ingest');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.INGEST_WEBHOOK_SECRET;

/**
 * Shared-secret auth so this endpoint isn't publicly callable by anyone who finds the URL.
 * WordPress should send this in an "X-Ingest-Secret" header on every request.
 */
function requireSecret(req, res, next) {
//   if (!WEBHOOK_SECRET) {
//     console.warn('[server] WARNING: INGEST_WEBHOOK_SECRET is not set — endpoint is unprotected!');
//     return next();
//   }

//   const provided = req.get('X-Ingest-Secret');
//   if (provided !== WEBHOOK_SECRET) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }
  next();
}

/**
 * POST /ingest
 * Body: { attachment_id, s3_key, filename? }
 * Called by WordPress after a file is confirmed uploaded to S3.
 * Responds immediately with 202 and processes in the background,
 * so the WordPress-side cron job doesn't wait on a long-running request.
 */
app.post('/ingest', (req, res) => {
    // res.status(200).json({ status: 'tested' });
  const { attachment_id, s3_key, filename } = req.body || {}; 

  console.log(req.body);
  console.log(attachment_id);
  console.log(s3_key);
  console.log(filename);

  if (!attachment_id || !s3_key) { 
    return res.status(400).json({ error: 'attachment_id and s3_key are required' });
  }

  // Acknowledge immediately — actual work continues after the response is sent
  res.status(202).json({ status: 'accepted', attachment_id });  

  ingestFile({ attachmentId: attachment_id, s3Key: s3_key, filename })
    .then((result) => {
      console.log(`[server] Ingestion complete for attachment ${attachment_id}`, result);
      // Optional: call back to WordPress here to update _ingestion_triggered / status meta
      // e.g. notifyWordPress(attachment_id, 'completed');
    })
    .catch((err) => {
      console.error(`[server] Ingestion failed for attachment ${attachment_id}:`, err.message);
      // Optional: notifyWordPress(attachment_id, 'failed', err.message);
    });
});

/**
 * POST /deingest
 * Body: { attachment_id }
 * Called by WordPress when a file/attachment is permanently deleted.
 */
app.post('/deingest', requireSecret, (req, res) => {
  const { attachment_id } = req.body || {};

  if (!attachment_id) {
    return res.status(400).json({ error: 'attachment_id is required' });
  }

  res.status(202).json({ status: 'accepted', attachment_id });

  deingestFile(attachment_id)
    .then(() => console.log(`[server] De-ingestion complete for attachment ${attachment_id}`))
    .catch((err) => {
        console.error(`[server] De-ingestion failed for attachment ${attachment_id}:`, err.message);
        console.error(err);
    });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[server] Ingestion service listening on port ${PORT}`);
});
