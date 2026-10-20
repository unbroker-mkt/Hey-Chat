import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
// Deployment environment takes precedence; local secrets are never committed.
dotenv.config({
  path: fileURLToPath(new URL("../../.env.r2", import.meta.url)),
  quiet: true,
});
let client;
function connection() {
  for (const key of [
    "R2_ENDPOINT",
    "R2_BUCKET",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ]) {
    if (!process.env[key])
      throw Object.assign(
        new Error("El almacenamiento de archivos no está configurado."),
        { status: 503 },
      );
  }
  client ||= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}
export const storage = {
  async put(key, body, contentType) {
    await connection().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  },
  async get(key) {
    return connection().send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    );
  },
  async remove(key) {
    await connection().send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
    );
  },
};
