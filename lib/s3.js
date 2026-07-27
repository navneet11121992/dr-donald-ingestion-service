const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Streams an object body into a single Buffer.
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Fetches a file from S3 and returns its raw buffer + content type.
 * @param {string} key - S3 object key, e.g. "library/123-report.pdf"
 * @param {string} [bucket] - defaults to S3_BUCKET env var
 */
async function fetchFileFromS3(key, bucket = process.env.S3_BUCKET) {
  if (!bucket) throw new Error('S3 bucket not specified (set S3_BUCKET env var or pass explicitly)');
  if (!key) throw new Error('S3 key is required');

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);

  const buffer = await streamToBuffer(response.Body);

  return {
    buffer,
    contentType: response.ContentType || null,
    contentLength: response.ContentLength || buffer.length,
  };
}

module.exports = { fetchFileFromS3 };
