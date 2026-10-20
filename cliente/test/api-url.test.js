import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeApiUrl } from "../src/api-url.js";

test("deployed API requests use /api/auth/me with either URL configuration", () => {
  const host = "https://hey-chat-07u5oet.apps.unbroker.cloud";
  for (const input of [host, `${host}/`, `${host}/api`, `${host}/api/`, ` ${host}/api/// `]) {
    assert.equal(`${normalizeApiUrl(input)}/auth/me`, `${host}/api/auth/me`);
  }
});

test("default, relative and nested API base URLs retain their intended prefix", () => {
  for (const input of [undefined, "", "  "]) {
    assert.equal(normalizeApiUrl(input), "http://localhost:3001/api");
  }
  assert.equal(normalizeApiUrl("/api/"), "/api");
  assert.equal(normalizeApiUrl("https://example.com/service/"), "https://example.com/service/api");
});
