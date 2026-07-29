const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const {ApiError} = require('./utils/apiErrors');

const env = require('./config/env')

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});


async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}


async function fetchFileFromS3(key, bucket = env.S3_BUCKET) {
  if (!bucket) throw new ApiError(500,'S3 bucket not specified (set S3_BUCKET env var or pass explicitly)');
  if (!key) throw new ApiError(500,'S3 key is required');

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
