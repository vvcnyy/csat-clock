import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import feedback from "../api/feedback.ts";

// Node 24 can execute the API's erasable TypeScript directly.
export function createApiServer({ feedbackHandler = feedback } = {}) {
  const clients = new Map();
  const windowMs = 60_000;
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const reply = (status, body) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };
    const path = (req.url || "").split("?")[0];
    if (path === "/api/health" && req.method === "GET") return reply(200, { ok: true });
    if (path !== "/api/feedback") return reply(404, { error: "not_found" });
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return reply(405, { error: "method_not_allowed" });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
      return reply(415, { error: "json_required" });
    }

    // Only Caddy can reach this container; it overwrites this header with the peer IP.
    const client = String(req.headers["x-feedback-client-ip"] || req.socket.remoteAddress);
    const now = Date.now();
    for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
    const entry = clients.get(client) || { until: now + windowMs, count: 0 };
    if (entry.count >= 5 || (!clients.has(client) && clients.size >= 10_000)) {
      res.setHeader("Retry-After", "60");
      return reply(429, { error: "rate_limited" });
    }
    entry.count += 1;
    clients.set(client, entry);

    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) {
          reply(413, { error: "body_too_large" });
          return;
        }
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return reply(400, { error: "invalid_json" });
      }
      let status = 200;
      const adapter = {
        status(code) { status = code; return adapter; },
        json(data) { reply(status, data); },
      };
      await feedbackHandler({ method: req.method, body }, adapter);
    } catch {
      if (!res.headersSent) reply(500, { error: "internal_error" });
      else res.end();
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createApiServer();
  server.listen(Number(process.env.PORT || 3000), "0.0.0.0");
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
