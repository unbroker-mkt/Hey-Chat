import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword, newToken, tokenHash } from "./auth.js";
const credentials = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,24}$/,
      "Usa de 3 a 24 letras, números o guiones bajos.",
    ),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128),
});
const uuid = z.string().uuid();
const cursor = z
  .string()
  .regex(/^\d{1,18}$/)
  .optional();
const fail = (status, message) => Object.assign(new Error(message), { status });
export function createApp(
  pool,
  {
    origin = process.env.CLIENT_ORIGIN || "http://localhost:5173",
    production = process.env.NODE_ENV === "production",
    limits = true,
  } = {},
) {
  const allowedOrigins = new Set([
    origin.replace(/\/$/, ""),
    "https://heychat-cliente-07u5oet.apps.unbroker.cloud",
  ]);
  const app = express();
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet(),
    cors({
      origin(requestOrigin, callback) {
        if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
          return callback(null, true);
        }
        callback(fail(403, "Origen no permitido."));
      },
      credentials: true,
    }),
    express.json({ limit: "16kb" }),
    cookieParser(),
  );
  // Use the same allowlist for CORS and cookie-authenticated mutations (CSRF).
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !allowedOrigins.has(req.get("origin"))
    )
      return next(fail(403, "Origen no permitido."));
    next();
  });
  if (limits)
    app.use(
      "/api",
      rateLimit({
        windowMs: 60000,
        limit: 180,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Demasiadas solicitudes. Intenta en un minuto." },
      }),
    );
  const authLimit = rateLimit({
    windowMs: 900000,
    limit: 30,
    skip: () => !limits,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera 15 minutos." },
  });
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: "/",
  };
  async function session(res, user) {
    const token = newToken();
    await pool.query("DELETE FROM sessions WHERE expires_at < now()");
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [tokenHash(token), user.id],
    );
    res.cookie("hey_session", token, { ...cookie, maxAge: 7 * 86400000 });
  }
  const protect = async (req, res, next) => {
    const token = req.cookies.hey_session;
    if (!token) throw fail(401, "Inicia sesión para continuar.");
    const { rows } = await pool.query(
      "SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [tokenHash(token)],
    );
    if (!rows[0]) throw fail(401, "Tu sesión expiró. Inicia sesión de nuevo.");
    req.user = rows[0];
    next();
  };
  const membership = async (req, res, next) => {
    const id = uuid.parse(req.params.id);
    const { rowCount } = await pool.query(
      "SELECT 1 FROM conversations WHERE id=$1 AND (user_a=$2 OR user_b=$2)",
      [id, req.user.id],
    );
    if (!rowCount) throw fail(404, "Conversación no encontrada.");
    next();
  };
  app.get("/api/health", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const { username, password } = credentials.parse(req.body);
    const user = { id: randomUUID(), username };
    await pool.query(
      "INSERT INTO users(id,username,password_hash) VALUES($1,$2,$3)",
      [user.id, username, await hashPassword(password)],
    );
    await session(res, user);
    res.status(201).json({ user });
  });
  // Equal-cost password verification for nonexistent usernames.
  const dummyHash = hashPassword(newToken());
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const { username, password } = credentials.parse(req.body);
    const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [
      username,
    ]);
    const valid = await verifyPassword(
      password,
      rows[0]?.password_hash || (await dummyHash),
    );
    if (!rows[0] || !valid)
      throw fail(401, "Usuario o contraseña incorrectos.");
    const user = { id: rows[0].id, username: rows[0].username };
    await session(res, user);
    res.json({ user });
  });
  app.post("/api/auth/logout", async (req, res) => {
    if (req.cookies.hey_session)
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(req.cookies.hey_session),
      ]);
    res.clearCookie("hey_session", cookie).sendStatus(204);
  });
  app.get("/api/auth/me", protect, (req, res) => res.json({ user: req.user }));
  app.get("/api/contacts", protect, async (req, res) => {
    const { rows } = await pool.query(
      "SELECT u.id,u.username FROM contacts c JOIN users u ON u.id=c.contact_id WHERE c.owner_id=$1 ORDER BY u.username",
      [req.user.id],
    );
    res.json({ contacts: rows });
  });
  app.post("/api/contacts", protect, async (req, res) => {
    const username = credentials.shape.username.parse(req.body.username);
    const { rows } = await pool.query(
      "SELECT id,username FROM users WHERE username=$1",
      [username],
    );
    if (!rows[0])
      throw fail(404, "No encontramos ese usuario. Revisa el nombre.");
    if (rows[0].id === req.user.id)
      throw fail(400, "¡Ese eres tú! Prueba con otro usuario.");
    await pool.query(
      "INSERT INTO contacts(owner_id,contact_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, rows[0].id],
    );
    res.status(201).json({ contact: rows[0] });
  });
  app.delete("/api/contacts/:id", protect, async (req, res) => {
    await pool.query(
      "DELETE FROM contacts WHERE owner_id=$1 AND contact_id=$2",
      [req.user.id, uuid.parse(req.params.id)],
    );
    res.sendStatus(204);
  });
  app.get("/api/conversations", protect, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.id, json_build_object('id',u.id,'username',u.username) AS contact,
      m.body AS last_message, COALESCE(m.created_at,c.created_at) AS updated_at
      FROM conversations c JOIN users u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END
      LEFT JOIN LATERAL (SELECT body,created_at FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) m ON true
      WHERE c.user_a=$1 OR c.user_b=$1 ORDER BY updated_at DESC`,
      [req.user.id],
    );
    res.json({ conversations: rows });
  });
  app.post("/api/conversations", protect, async (req, res) => {
    const contactId = uuid.parse(req.body.contactId);
    const { rowCount } = await pool.query(
      "SELECT 1 FROM contacts WHERE owner_id=$1 AND contact_id=$2",
      [req.user.id, contactId],
    );
    if (!rowCount)
      throw fail(400, "Primero agrega este usuario a tus contactos.");
    const [a, b] = [req.user.id, contactId].sort();
    const { rows } = await pool.query(
      "INSERT INTO conversations(id,user_a,user_b) VALUES($1,$2,$3) ON CONFLICT(user_a,user_b) DO UPDATE SET user_a=EXCLUDED.user_a RETURNING id",
      [randomUUID(), a, b],
    );
    res.status(201).json({ conversation: rows[0] });
  });
  app.get(
    "/api/conversations/:id/messages",
    protect,
    membership,
    async (req, res) => {
      const before = cursor.parse(req.query.before);
      const after = cursor.parse(req.query.after);
      if (before && after) throw fail(400, "Usa before o after, no ambos.");
      const { rows } = await pool.query(
        `SELECT id::text,id AS sort_id,sender_id,body,created_at FROM messages WHERE conversation_id=$1 ${before ? "AND id<$2" : after ? "AND id>$2" : ""} ORDER BY messages.id ${after ? "ASC" : "DESC"} LIMIT 100`,
        before || after ? [req.params.id, before || after] : [req.params.id],
      );
      if (!after) rows.reverse();
      res.json({
        messages: rows.map(({ sort_id, ...m }) => m),
        hasMore: rows.length === 100,
      });
    },
  );
  app.post(
    "/api/conversations/:id/messages",
    protect,
    membership,
    async (req, res) => {
      const body = z
        .string()
        .trim()
        .min(1)
        .max(4000, "El mensaje puede tener hasta 4000 caracteres.")
        .parse(req.body.body);
      const { rows } = await pool.query(
        "INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id::text,sender_id,body,created_at",
        [req.params.id, req.user.id, body],
      );
      res.status(201).json({ message: rows[0] });
    },
  );
  app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: err.issues[0].message });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Este nombre de usuario ya está en uso." });
    if (err.status)
      return res
        .status(err.status)
        .json({
          error:
            err.status === 413 ? "Solicitud demasiado grande." : err.message,
        });
    console.error("API error:", err.code || err.name);
    res.status(500).json({ error: "Ocurrió un problema. Intenta de nuevo." });
  });
  return app;
}
