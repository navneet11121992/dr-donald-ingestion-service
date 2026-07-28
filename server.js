require('dotenv').config();
const express = require('express');
const { ingestFile, deingestFile } = require('./ingest');
const {getEmbeddings} = require("./lib/embeddings");
const {searchChunks} = require("./lib/qdrant");
const {generateReply} = require("./lib/generate");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.INGEST_WEBHOOK_SECRET;


function requireSecret(req, res, next) {
  if (!WEBHOOK_SECRET) {
    console.warn('[server] WARNING: INGEST_WEBHOOK_SECRET is not set — endpoint is unprotected!');
    return next();
  }

  const provided = req.get('X-Ingest-Secret');
  console.log(`[server] Provided secret: ${provided}, Expected secret: ${WEBHOOK_SECRET}`);
  if (provided !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}







app.post('/ingest', requireSecret, (req, res) => {
	let response = {};
	let statusCode = 202; // default to accepted
	const { attachment_id, s3_key, filename } = req.body || {}; 

	// console.log(req.body);
	// console.log(attachment_id);
	// console.log(s3_key);
	// console.log(filename);

	if (!attachment_id || !s3_key) { 
		return res.status(400).json({ error: 'attachment_id and s3_key are required' });
	}

	// Acknowledge immediately — actual work continues after the response is sent
	// res.status(202).json({ status: 'accepted', attachment_id });  

	console.log(`[server] Starting ingestion for attachment ${attachment_id}, s3://${process.env.S3_BUCKET}/${s3_key}`);

	ingestFile({ attachmentId: attachment_id, s3Key: s3_key, filename })
		.then((result) => {
			response = result;
			statusCode = 200;
			console.log(`[server] Ingestion complete for attachment ${attachment_id}`, result);

			res.status(statusCode).json(response);
		// Optional: call back to WordPress here to update _ingestion_triggered / status meta
		// e.g. notifyWordPress(attachment_id, 'completed');
		})
		.catch((err) => {
			console.error(`[server] Ingestion failed for attachment ${attachment_id}:`, err.message);
			console.error(err);
			response = err;
			statusCode = 500;
			res.status(statusCode).json(response);
			
		// Optional: notifyWordPress(attachment_id, 'failed', err.message);
	});
	
	
	
	
});









app.post('/deingest', requireSecret, (req, res) => {
	const { attachment_id } = req.body || {};

	if (!attachment_id) {
		return res.status(400).json({ error: 'attachment_id is required' });
	}

	// res.status(202).json({ status: 'accepted', attachment_id });
	console.log(`[server] Starting de-ingestion for attachment ${attachment_id}`);
	deingestFile(attachment_id)
		.then((response) => {
			console.log(`[server] De-ingestion complete for attachment ${attachment_id}`);
			res.status(200).json(response);
			})
	.catch((err) => {
		console.error(`[server] De-ingestion failed for attachment ${attachment_id}:`, err.message);
		console.error(err);
		res.status(500).json({ error: err.message });
	});
});





app.post('/chat', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }
  // try {
    const [vector] = await getEmbeddings([question], 'RETRIEVAL_QUERY'); // array in, first vector out
    const results = await searchChunks({ vector });                      // pass as { vector }
    // call the gemini Model for the Reply
    if(!results){
      throw res.status(500).json({message: "Search result not found"})
    }
     const LLMreply = await generateReply({ question, chunks: results });

    return res.status(200).json({ LLMreply });
  // } catch (error) {
  //   return res.status(500).json({ error: `Something went wrong: ${error}` });
  // }
});










app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[server] Ingestion service listening on port ${PORT}`);
});
