import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("deployed client: preflight, credentials, mutations and rejected origins", async () => {
  const pool = { query: async () => ({ rows: [], rowCount: 0 }) };
  const server = createApp(pool, { origin: "http://localhost:5173/", limits: false }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/logout`;
  try {
    for (const origin of ["https://heychat-cliente-07u5oet.apps.unbroker.cloud", "http://localhost:5173"]) {
      const preflight = await fetch(url, { method: "OPTIONS", headers: { origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
      assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
      assert.match(preflight.headers.get("vary"), /Origin/);
      const mutation = await fetch(url, { method: "POST", headers: { origin } });
      assert.equal(mutation.status, 204);
      assert.equal(mutation.headers.get("access-control-allow-origin"), origin);
    }
    for (const origin of ["https://evil.example", "https://heychat-cliente-07u5oet.apps.unbroker.cloud.evil.example"]) {
      for (const method of ["OPTIONS", "POST"]) {
        const response = await fetch(url, { method, headers: { origin, "Access-Control-Request-Method": "POST" } });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get("access-control-allow-origin"), null);
      }
    }
    assert.equal((await fetch(url, { method: "POST" })).status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
