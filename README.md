# Library Ingestion Service

Fetches a file from S3, extracts its text, splits it into overlapping chunks,
generates OpenAI embeddings, and stores the vectors in Qdrant. Also supports
de-ingestion (removing all chunks for a file) when it's deleted.

## Setup

```bash
npm install
cp .env.example .env
# fill in .env with your AWS, OpenAI, and Qdrant credentials
```

Qdrant must be reachable at `QDRANT_URL` (run it locally via Docker for testing:
`docker run -p 6333:6333 qdrant/qdrant`, or use Qdrant Cloud).

## Usage

### As a webhook server (recommended — matches the WordPress flow discussed)

```bash
npm start
```

This exposes:

- `POST /ingest` — body `{ "attachment_id": 123, "s3_key": "library/123-file.pdf" }`
- `POST /deingest` — body `{ "attachment_id": 123 }`
- `GET /health`

Both `/ingest` and `/deingest` require a header `X-Ingest-Secret` matching
`INGEST_WEBHOOK_SECRET` in `.env` — this is the shared secret your WordPress
`wp_remote_post()` calls should send so the endpoint can't be hit by anyone
who finds the URL.

The server responds `202 Accepted` immediately and does the actual work
afterward — this is intentional. Your WordPress-side cron job (the one
scheduled via `wp_schedule_single_event` / Action Scheduler in the earlier
plan) fires this with a short timeout and doesn't wait for ingestion to
finish, avoiding the timeout problem discussed earlier. If you want
WordPress to know when ingestion actually completes, add a callback from
this service back to a WordPress REST endpoint inside the `.then()` /
`.catch()` blocks in `server.js` (there's a commented placeholder for this).

### As a one-off CLI command

```bash
node ingest.js 123 "library/123-report.pdf"
```

### As a module in your own code

```js
const { ingestFile, deingestFile } = require('./ingest');

await ingestFile({ attachmentId: 123, s3Key: 'library/123-report.pdf' });
await deingestFile(123);
```

## How chunks are identified in Qdrant

Each point's ID is deterministically derived from `attachmentId` + chunk
index (via UUIDv5), and every point's payload includes `attachment_id` and
`s3_key`. This means:

- Re-running ingestion on the same file overwrites the same points instead
  of creating duplicates.
- De-ingestion works by deleting all points where `attachment_id` matches —
  see `deleteByAttachmentId()` in `lib/qdrant.js`.

## File support

`lib/extractText.js` currently handles `.pdf`, `.docx`, `.txt`, `.md`, `.csv`.
Anything else falls back to a raw UTF-8 decode, which will produce garbage
for other binary formats (images, spreadsheets, etc.) — add a dedicated
branch there if you need to support more types.

## Notes / things to configure for production

- **Embedding model dimension**: `text-embedding-3-small` = 1536 dims,
  `text-embedding-3-large` = 3072 dims. The Qdrant collection is created
  with whatever dimension your configured model returns — if you ever
  switch models, you'll need a new collection (mixing dimensions in one
  collection isn't supported).
- **Large files**: `pdf-parse` and `mammoth` load the whole file into memory.
  Fine for typical documents; for very large files (100s of MB) you'd want
  streaming extraction instead.
- **Retry/backoff** is implemented for OpenAI embedding calls (429s and 5xxs).
  Consider adding the same around the S3 fetch and Qdrant upsert for full
  resilience.
- **Chunking is character-based**, not token-based — a reasonable approximation
  without adding a tokenizer dependency. Swap in `tiktoken` if you need exact
  token-boundary chunking.
