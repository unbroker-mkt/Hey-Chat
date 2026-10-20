import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import sharp from "sharp";
import { prepareFile } from "../src/attachments.js";
import { createApp } from "../src/app.js";
import { createPool, migrate } from "../src/db.js";

test("images are resized, metadata stripped and converted to WebP; unsafe files rejected", async () => {
  const buffer = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#a55be7" },
  })
    .jpeg({ quality: 100 })
    .withMetadata()
    .toBuffer();
  const result = await prepareFile({ buffer, originalname: "photo.jpg" });
  assert.equal(result.mime, "image/webp");
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1280);
  assert.ok(result.buffer.length < buffer.length);
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.exif, undefined);
  await assert.rejects(
    prepareFile({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      originalname: "fake.jpg",
    }),
    { status: 400 },
  );
  await assert.rejects(
    prepareFile({ buffer: Buffer.alloc(0), originalname: "empty.txt" }),
    { status: 400 },
  );
  await assert.rejects(
    prepareFile({
      buffer: Buffer.from([255, 254, 0, 1]),
      originalname: "fake.txt",
    }),
    { status: 400 },
  );
  assert.equal(
    (
      await prepareFile({
        buffer: Buffer.from("hola"),
        originalname: "hola.txt",
      })
    ).mime,
    "text/plain",
  );
});

test(
  "attachments: private uploads, downloads, history, retries, size and storage failures",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL);
    await migrate(pool);
    const objects = new Map();
    let storageFail = false;
    const storage = {
      async put(key, body) {
        if (storageFail) throw new Error("offline");
        objects.set(key, body);
      },
      async get(key) {
        return { Body: Readable.from(objects.get(key)) };
      },
      async remove(key) {
        objects.delete(key);
      },
    };
    const server = createApp(pool, {
      origin: "http://localhost:5173",
      limits: false,
      storage,
    }).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`,
      ids = [];
    async function json(path, body, cookie) {
      const response = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }
    async function send(
      conversation,
      cookie,
      buffer,
      name = "note.txt",
      requestId = randomUUID(),
    ) {
      const form = new FormData();
      form.append("body", "");
      form.append("requestId", requestId);
      form.append("file", new Blob([buffer]), name);
      const response = await fetch(
        base + `/conversations/${conversation}/attachments`,
        {
          method: "POST",
          headers: {
            Origin: "http://localhost:5173",
            ...(cookie ? { cookie } : {}),
          },
          body: form,
        },
      );
      return { status: response.status, data: await response.json() };
    }
    try {
      const users = [];
      for (const prefix of ["sender", "receiver", "stranger"]) {
        const user = await json("/auth/register", {
          username: prefix + randomUUID().slice(0, 8),
          password: "password123",
        });
        assert.equal(user.status, 201);
        ids.push(user.data.user.id);
        users.push(user);
      }
      const [a, b, c] = users;
      await json("/contacts", { username: b.data.user.username }, a.cookie);
      const conversation = (
        await json("/conversations", { contactId: b.data.user.id }, a.cookie)
      ).data.conversation.id;
      const contents = Buffer.from("Un documento privado de prueba.");
      assert.equal((await send(conversation, null, contents)).status, 401);
      assert.equal((await send(conversation, c.cookie, contents)).status, 404);
      const requestId = randomUUID();
      const sent = await send(
        conversation,
        a.cookie,
        contents,
        "nota.txt",
        requestId,
      );
      assert.equal(sent.status, 201);
      assert.equal(sent.data.message.attachment.size, contents.length);
      assert.equal(
        (await send(conversation, a.cookie, contents, "nota.txt", requestId))
          .data.message.id,
        sent.data.message.id,
      );
      assert.equal(objects.size, 1);
      const downloadPath =
        base + "/attachments/" + sent.data.message.attachment.id;
      assert.equal((await fetch(downloadPath)).status, 401);
      assert.equal(
        (await fetch(downloadPath, { headers: { cookie: c.cookie } })).status,
        404,
      );
      const downloaded = await fetch(downloadPath, {
        headers: { cookie: b.cookie },
      });
      assert.equal(downloaded.status, 200);
      assert.match(
        downloaded.headers.get("content-disposition"),
        /^attachment;/,
      );
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), contents);
      const image = await sharp({
        create: {
          width: 2400,
          height: 1200,
          channels: 3,
          background: "#7c43e8",
        },
      })
        .png()
        .toBuffer();
      const photo = await send(conversation, a.cookie, image, "photo.png");
      assert.equal(photo.status, 201);
      assert.equal(photo.data.message.attachment.mime, "image/webp");
      const received = await fetch(
        base + "/attachments/" + photo.data.message.attachment.id,
        { headers: { cookie: b.cookie } },
      );
      assert.equal(received.headers.get("content-type"), "image/webp");
      const decoded = await sharp(
        Buffer.from(await received.arrayBuffer()),
      ).metadata();
      assert.equal(decoded.width, 1920);
      const history = await json(
        `/conversations/${conversation}/messages`,
        null,
        b.cookie,
      );
      assert.equal(history.data.messages.length, 2);
      assert.ok(history.data.messages.every((m) => m.attachment));
      assert.equal(
        (await json("/conversations", null, b.cookie)).data.conversations[0]
          .last_message,
        "photo.webp",
      );
      assert.equal(
        (
          await send(
            conversation,
            a.cookie,
            Buffer.from("<html>bad</html>"),
            "fake.png",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await send(
            conversation,
            a.cookie,
            Buffer.alloc(20 * 1024 * 1024 + 1),
            "large.txt",
          )
        ).status,
        413,
      );
      storageFail = true;
      assert.equal((await send(conversation, a.cookie, contents)).status, 502);
      assert.equal(
        (await json(`/conversations/${conversation}/messages`, null, b.cookie))
          .data.messages.length,
        2,
      );
    } finally {
      await pool.query(
        "DELETE FROM conversations WHERE user_a=ANY($1::uuid[]) OR user_b=ANY($1::uuid[])",
        [ids],
      );
      await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [ids]);
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }
  },
);
