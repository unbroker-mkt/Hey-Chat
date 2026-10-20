import multer from "multer";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

const fail = (status, message) => Object.assign(new Error(message), { status });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 2, fieldSize: 16000 },
}).single("file");
const documents = new Map([
  ["pdf", "application/pdf"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [
    "pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
]);
export async function prepareFile(file) {
  if (!file?.buffer?.length)
    throw fail(400, "Selecciona un archivo que no esté vacío.");
  const name =
    file.originalname.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 180) ||
    "archivo";
  const type = await fileTypeFromBuffer(file.buffer);
  if (["image/jpeg", "image/png", "image/webp"].includes(type?.mime)) {
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 40_000_000,
        failOn: "error",
      });
      const meta = await image.metadata();
      if (meta.pages > 1) throw new Error("animated");
      const optimized = await image
        .rotate()
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      // Always re-encode on the server to validate pixels and remove metadata.
      return {
        buffer: optimized.data,
        name: name.replace(/\.[^.]*$/, "") + ".webp",
        mime: "image/webp",
        width: optimized.info.width,
        height: optimized.info.height,
      };
    } catch {
      throw fail(
        400,
        "Imagen inválida, animada o demasiado grande. Usa JPG, PNG o WebP de hasta 40 megapíxeles.",
      );
    }
  }
  if (type && documents.get(type.ext) === type.mime)
    return { buffer: file.buffer, name, mime: type.mime };
  if (!type && /\.(txt|csv)$/i.test(name)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
    } catch {
      throw fail(400, "El documento de texto debe usar UTF-8.");
    }
    if (file.buffer.includes(0))
      throw fail(400, "El documento no contiene texto válido.");
    return {
      buffer: file.buffer,
      name,
      mime: /\.csv$/i.test(name) ? "text/csv" : "text/plain",
    };
  }
  throw fail(
    400,
    "Formato no permitido. Usa JPG, PNG, WebP, PDF, DOCX, XLSX, PPTX, TXT o CSV.",
  );
}
export function attachmentRoutes(app, { pool, protect, membership, storage }) {
  app.post(
    "/api/conversations/:id/attachments",
    protect,
    membership,
    (req, res, next) => {
      upload(req, res, (error) => {
        if (error)
          return next(
            fail(
              error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
              error.code === "LIMIT_FILE_SIZE"
                ? "El archivo supera los 20 MB."
                : "Envía un solo archivo y un texto de hasta 4000 caracteres.",
            ),
          );
        next();
      });
    },
    async (req, res) => {
      const body = z
        .string()
        .trim()
        .max(4000)
        .parse(req.body.body || "");
      const requestId = z.string().uuid().parse(req.body.requestId);
      const existing = await pool.query(
        "SELECT id::text,sender_id,body,created_at,attachment,conversation_id FROM messages WHERE sender_id=$1 AND client_request_id=$2",
        [req.user.id, requestId],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].conversation_id !== req.params.id)
          throw fail(409, "Esta subida ya pertenece a otra conversación.");
        return res.json({ message: existing.rows[0] });
      }
      const prepared = await prepareFile(req.file);
      const id = randomUUID();
      const key = `attachments/${req.params.id}/${id}`;
      const attachment = {
        id,
        name: prepared.name,
        mime: prepared.mime,
        size: prepared.buffer.length,
        width: prepared.width,
        height: prepared.height,
      };
      try {
        await storage.put(key, prepared.buffer, prepared.mime);
      } catch (error) {
        if (error.status) throw error;
        console.error("R2 upload failed:", error.name);
        throw fail(502, "No se pudo subir el archivo. Intenta de nuevo.");
      }
      let result;
      try {
        result = await pool.query(
          "INSERT INTO messages(conversation_id,sender_id,body,attachment,attachment_key,client_request_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(sender_id,client_request_id) DO NOTHING RETURNING id::text,sender_id,body,created_at,attachment",
          [req.params.id, req.user.id, body, attachment, key, requestId],
        );
      } catch (error) {
        await storage
          .remove(key)
          .catch((e) => console.error("R2 cleanup failed:", e.name));
        throw error;
      }
      if (!result.rows.length) {
        await storage
          .remove(key)
          .catch((e) => console.error("R2 cleanup failed:", e.name));
        result = await pool.query(
          "SELECT id::text,sender_id,body,created_at,attachment,conversation_id FROM messages WHERE sender_id=$1 AND client_request_id=$2",
          [req.user.id, requestId],
        );
        if (result.rows[0].conversation_id !== req.params.id)
          throw fail(409, "Esta subida ya pertenece a otra conversación.");
      }
      res.status(201).json({ message: result.rows[0] });
    },
  );
  app.get("/api/attachments/:id", protect, async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { rows } = await pool.query(
      "SELECT m.attachment,m.attachment_key FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.attachment->>'id'=$1 AND (c.user_a=$2 OR c.user_b=$2)",
      [id, req.user.id],
    );
    if (!rows[0]) throw fail(404, "Archivo no encontrado.");
    const { attachment, attachment_key } = rows[0];
    let object;
    try {
      object = await storage.get(attachment_key);
    } catch (error) {
      console.error("R2 download failed:", error.name);
      throw fail(502, "No se pudo recuperar el archivo. Intenta de nuevo.");
    }
    res.set({
      "Content-Type": attachment.mime,
      "Content-Length": String(attachment.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${attachment.mime === "image/webp" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
    });
    try {
      await pipeline(object.Body, res);
    } catch {
      if (!res.destroyed) res.destroy();
    }
  });
}
