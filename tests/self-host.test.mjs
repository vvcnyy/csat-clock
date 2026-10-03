import { test } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { once } from "node:events";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiServer } from "../server/index.mjs";

async function withServer(t, options = {}) {
  const server = createApiServer(options);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return (path, { method = "GET", body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: server.address().port, path, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("static files, cache headers, audio ranges and logs", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "csat-static-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "assets"));
  mkdirSync(join(dir, "sound"));
  writeFileSync(join(dir, "index.html"), "<html>clock</html>");
  writeFileSync(join(dir, "sw.js"), "// worker");
  writeFileSync(join(dir, "assets/app-123.js"), "// app");
  writeFileSync(join(dir, "sound/test.mp3"), "0123456789");
  const logs = [];
  const call = await withServer(t, { staticDir: dir, onAccess: entry => logs.push(entry) });
  const home = await call("/");
  assert.equal(home.status, 200);
  assert.equal(home.text, "<html>clock</html>");
  assert.equal(home.headers["cache-control"], "no-cache");
  assert.equal((await call("/", { method: "HEAD" })).text, "");
  assert.equal((await call("/sw.js")).headers["cache-control"], "no-store");
  assert.match((await call("/assets/app-123.js")).headers["cache-control"], /immutable/);
  assert.equal((await call("/assets/missing.js")).status, 404);
  const audio = await call("/sound/test.mp3", { headers: { Range: "bytes=0-3" } });
  assert.equal(audio.status, 206);
  assert.equal(audio.text, "0123");
  await call("/?private=not-logged");
  assert.equal(logs.at(-1).path, "/");
});

test("self-host API: health, unknown route, method and JSON validation", async (t) => {
  const call = await withServer(t);
  assert.equal((await call("/api/health")).status, 200);
  assert.equal((await call("/api/missing")).status, 404);
  assert.equal((await call("/api/feedback")).status, 405);
  assert.equal((await call("/api/feedback", { method: "POST", body: "hello" })).status, 415);
  assert.equal((await call("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
});

test("feedback retains full allowed text, forwards once, and limits repeated submissions", async (t) => {
  const oldWebhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  process.env.DISCORD_FEEDBACK_WEBHOOK_URL = "https://example.invalid/webhook";
  t.after(() => {
    if (oldWebhook === undefined) delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    else process.env.DISCORD_FEEDBACK_WEBHOOK_URL = oldWebhook;
  });
  const sent = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://example.invalid/webhook");
    sent.push(JSON.parse(options.body));
    return { ok: true };
  });
  const call = await withServer(t);
  const options = {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "의".repeat(2000), contact: "reply@example.com" }),
  };
  const response = await call("/api/feedback", options);
  assert.equal(response.status, 204);
  assert.equal(response.text, "");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(sent[0].embeds[0].description, "의".repeat(2000) + "\n\n회신 연락처: reply@example.com");
  assert.deepEqual(sent[0].allowed_mentions, { parse: [] });
  for (let i = 0; i < 4; i++) assert.equal((await call("/api/feedback", options)).status, 204);
  assert.equal((await call("/api/feedback", options)).status, 429);
  assert.equal(sent.length, 5);
});

test("feedback rejects non-object JSON and oversized bodies without forwarding", async (t) => {
  const oldWebhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  process.env.DISCORD_FEEDBACK_WEBHOOK_URL = "https://example.invalid/webhook";
  t.after(() => {
    if (oldWebhook === undefined) delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    else process.env.DISCORD_FEEDBACK_WEBHOOK_URL = oldWebhook;
  });
  t.mock.method(globalThis, "fetch", async () => { assert.fail("must not forward invalid feedback"); });
  const call = await withServer(t);
  const options = { method: "POST", headers: { "Content-Type": "application/json" } };
  assert.equal((await call("/api/feedback", { ...options, body: "null" })).status, 400);
  assert.equal((await call("/api/feedback", { ...options, body: JSON.stringify({ message: "a".repeat(17000) }) })).status, 413);
});
