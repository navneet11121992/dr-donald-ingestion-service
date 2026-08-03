require("dotenv/config");
const { z } = require("zod");

const schema = z
  .object({
    // Server
    PORT: z.coerce.number().default(4000),

    // AWS
    AWS_REGION: z.string().min(1, "AWS_REGION is required"),
    AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
    S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),

    // Gemini
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),

    // Qdrant
    QDRANT_URL: z.string().url(),
    QDRANT_API_KEY: z.string().min(1, "QDRANT_API_KEY is required"),
    QDRANT_COLLECTION: z.string().default("pdf_chunks"),

    // Chunking
    CHUNK_SIZE: z.coerce.number().int().positive().default(1000),
    CHUNK_OVERLAP: z.coerce.number().int().min(0).default(150),

    // Ingest webhook
    INGEST_WEBHOOK_SECRET: z.string().min(1, "INGEST_WEBHOOK_SECRET is required"),

    // OCR Handling
    OCR_SCALE : z.coerce.number().default(2.0)
  })
  .refine((d) => d.CHUNK_OVERLAP < d.CHUNK_SIZE, {
    message: "CHUNK_OVERLAP must be less than CHUNK_SIZE",
  });

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment variables:", result.error.format());
  result.error.issues.forEach((i) =>
    console.error(`  - ${i.path[0]}: ${i.message}`),
  );
  console.error("");
  process.exit(1);
}
const env = result.data;
module.exports = env;