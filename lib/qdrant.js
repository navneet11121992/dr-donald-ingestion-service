const { QdrantClient } = require('@qdrant/js-client-rest');
const { v5: uuidv5 } = require('uuid'); // moved to top

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

const COLLECTION = process.env.QDRANT_COLLECTION || 'library_documents';
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // moved to top too

// async function ensureCollection(vectorSize) {
//   const collections = await client.getCollections();
//   const exists = collections.collections.some((c) => c.name === COLLECTION);

//   if (exists) return;

//   await client.createCollection(COLLECTION, {
//     vectors: {
//       size: vectorSize,
//       distance: 'Cosine',
//     },
//   });

//   await client.createPayloadIndex(COLLECTION, {
//     field_name: 'attachment_id',
//     field_schema: 'integer',
//   });
// }



async function ensureCollection(vectorSize) {
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION);

  if (!exists) {
    await client.createCollection(COLLECTION, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });
  }

  // Always ensure the index exists, whether the collection is new or not
  await client.createPayloadIndex(COLLECTION, {
    field_name: 'attachment_id',
    field_schema: 'keyword',
  });
}

async function upsertChunks({ attachmentId, s3Key, chunks, vectors }) {
  const points = chunks.map((text, i) => ({
    id: uuidv5(`${attachmentId}-${i}`, NAMESPACE),
    vector: vectors[i],
    payload: {
      attachment_id: attachmentId,
      s3_key: s3Key,
      chunk_index: i,
      text,
    },
  }));

  await client.upsert(COLLECTION, {
    wait: true,
    points,
  });

  return points.length;
}

async function deleteByAttachmentId(attachmentId) {
  await client.delete(COLLECTION, {
    wait: true,
    filter: {
      must: [{ key: 'attachment_id', match: { value: String(attachmentId) } }],
    },
  });
}


async function searchChunks({ vector, limit = 5 }) {
  console.log('query vector length:', vector?.length); // temporary debug

  const result = await client.query(COLLECTION, {
    query: vector,
    limit,
    with_payload: true,
  });

  return result.points.map((p) => ({
    id: p.id,
    score: p.score,
    text: p.payload.text,
    attachmentId: p.payload.attachment_id,
    s3Key: p.payload.s3_key,
    chunkIndex: p.payload.chunk_index,
  }));
}
module.exports = { ensureCollection, upsertChunks, deleteByAttachmentId, searchChunks, COLLECTION };