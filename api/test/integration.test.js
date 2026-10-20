import { test } from "node:test";
import assert from "node:assert/strict";
import { createPool, migrate } from "../src/db.js";
import { createApp } from "../src/app.js";
import { hashPassword, verifyPassword } from "../src/auth.js";
test("password hashes use independent salts and verify correctly", async () => {
  const a = await hashPassword("password123"),
    b = await hashPassword("password123");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("password123", a), true);
  assert.equal(await verifyPassword("incorrect", a), false);
});
test(
  "Postgres: auth, contacts, message access, pagination, persistence and logout",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL);
    await Promise.all([migrate(pool), migrate(pool)]);
    const server = createApp(pool, {
      origin: "http://localhost:5173",
      limits: false,
    }).listen(0, "127.0.0.1");
    await new Promise((r) => server.on("listening", r));
    const base = `http://127.0.0.1:${server.address().port}/api`,
      suffix = Date.now().toString(36);
    const ids = [];
    async function call(
      path,
      { method = "GET", body, cookie, origin = "http://localhost:5173" } = {},
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          origin,
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        data: response.status === 204 ? null : await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }
    try {
      assert.equal((await call("/conversations")).status, 401);
      assert.equal(
        (
          await call("/auth/register", {
            method: "POST",
            body: { username: "bad", password: "short" },
          })
        ).status,
        400,
      );
      const people = [];
      for (const name of ["alice", "bob", "eve"]) {
        const p = await call("/auth/register", {
          method: "POST",
          body: { username: name + suffix, password: "password123" },
        });
        assert.equal(p.status, 201);
        people.push(p);
        ids.push(p.data.user.id);
      }
      const [a, b, e] = people;
      assert.equal(
        (await call("/auth/me", { cookie: a.cookie })).data.user.id,
        a.data.user.id,
      );
      assert.equal(
        (
          await call("/auth/register", {
            method: "POST",
            body: { username: "alice" + suffix, password: "password123" },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await call("/auth/login", {
            method: "POST",
            body: { username: "alice" + suffix, password: "wrongpass" },
          })
        ).status,
        401,
      );
      const login = await call("/auth/login", {
        method: "POST",
        body: {
          username: ("ALICE" + suffix).toUpperCase(),
          password: "password123",
        },
      });
      assert.equal(login.status, 200);
      assert.equal(
        (
          await call("/contacts", {
            method: "POST",
            cookie: a.cookie,
            body: { username: "bob" + suffix },
            origin: "https://evil.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await call("/contacts", {
            method: "POST",
            cookie: a.cookie,
            body: { username: "alice" + suffix },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("/contacts", {
            method: "POST",
            cookie: a.cookie,
            body: { username: "missing" + suffix },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await call("/contacts", {
            method: "POST",
            cookie: a.cookie,
            body: { username: "bob" + suffix },
          })
        ).status,
        201,
      );
      assert.equal(
        (await call("/contacts", { cookie: a.cookie })).data.contacts.length,
        1,
      );
      const c = await call("/conversations", {
        method: "POST",
        cookie: a.cookie,
        body: { contactId: b.data.user.id },
      });
      assert.equal(c.status, 201);
      const cid = c.data.conversation.id;
      const again = await call("/conversations", {
        method: "POST",
        cookie: a.cookie,
        body: { contactId: b.data.user.id },
      });
      assert.equal(again.data.conversation.id, cid);
      const url = `/conversations/${cid}/messages`;
      assert.equal((await call(url, { cookie: e.cookie })).status, 404);
      assert.equal(
        (
          await call(url, {
            method: "POST",
            cookie: e.cookie,
            body: { body: "intruder" },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await call(url, {
            method: "POST",
            cookie: a.cookie,
            body: { body: " " },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call(url, {
            method: "POST",
            cookie: a.cookie,
            body: { body: "x".repeat(4001) },
          })
        ).status,
        400,
      );
      const first = await call(url, {
        method: "POST",
        cookie: a.cookie,
        body: { body: "Hola Bob 👋" },
      });
      assert.equal(first.status, 201);
      const reply = await call(url, {
        method: "POST",
        cookie: b.cookie,
        body: { body: "¡Hola Alice!" },
      });
      assert.equal(reply.status, 201);
      assert.equal(
        (await call("/conversations", { cookie: b.cookie })).data
          .conversations[0].contact.id,
        a.data.user.id,
      );
      const read = await call(url, { cookie: b.cookie });
      assert.deepEqual(
        read.data.messages.map((m) => m.body),
        ["Hola Bob 👋", "¡Hola Alice!"],
      );
      assert.equal(
        (
          await call(url + `?after=${first.data.message.id}`, {
            cookie: a.cookie,
          })
        ).data.messages[0].body,
        "¡Hola Alice!",
      );
      assert.equal(
        (
          await call(url + `?before=${reply.data.message.id}`, {
            cookie: a.cookie,
          })
        ).data.messages.length,
        1,
      );
      assert.equal(
        (await call(url + "?after=invalid", { cookie: a.cookie })).status,
        400,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*) FROM messages WHERE conversation_id=$1",
            [cid],
          )
        ).rows[0].count,
        "2",
      );
      await pool.query(
        "INSERT INTO messages(conversation_id,sender_id,body) SELECT $1,$2,'mensaje ' || n FROM generate_series(1,105) n",
        [cid, a.data.user.id],
      );
      const page = await call(url, { cookie: b.cookie });
      assert.equal(page.data.messages.length, 100);
      assert.equal(page.data.hasMore, true);
      assert.equal(page.data.messages.at(-1).body, "mensaje 105");
      const prior = await call(url + `?before=${page.data.messages[0].id}`, {
        cookie: b.cookie,
      });
      assert.equal(prior.data.messages.length, 7);
      assert.equal(prior.data.hasMore, false);
      assert.equal(
        (
          await call("/contacts/" + b.data.user.id, {
            method: "DELETE",
            cookie: a.cookie,
          })
        ).status,
        204,
      );
      assert.equal(
        (await call("/contacts", { cookie: a.cookie })).data.contacts.length,
        0,
      );
      assert.equal((await call(url, { cookie: a.cookie })).status, 200);
      assert.equal(
        (await call("/auth/logout", { method: "POST", cookie: a.cookie }))
          .status,
        204,
      );
      assert.equal((await call("/auth/me", { cookie: a.cookie })).status, 401);
      assert.equal(
        (await call("/auth/me", { cookie: login.cookie })).status,
        200,
      );
    } finally {
      await pool.query(
        "DELETE FROM conversations WHERE user_a=ANY($1::uuid[]) OR user_b=ANY($1::uuid[])",
        [ids],
      );
      await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [ids]);
      await new Promise((r) => server.close(r));
      await pool.end();
    }
  },
);
