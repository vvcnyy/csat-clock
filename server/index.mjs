import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { isIP } from "node:net";
import sirv from "sirv";
import { createStream } from "rotating-file-stream";
import { runSoundSync } from "../scripts/sync-sounds.mjs";
import feedback from "../api/feedback.ts";

// Node 24 can execute the API's erasable TypeScript directly.
export function clientAddress(req, hops = 0) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map(ip => ip.trim()).filter(Boolean);
  const chain = [...forwarded, req.socket.remoteAddress];
  const address = chain[Math.max(0, chain.length - 1 - hops)];
  return isIP(address || "") ? address : req.socket.remoteAddress;
}

export function createApiServer({ feedbackHandler = feedback, staticDir, onAccess = () => {}, trustProxyHops = 0 } = {}) {
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) throw new Error("Invalid TRUST_PROXY_HOPS");
  const serve = staticDir ? sirv(staticDir, { etag: true, single: false, setHeaders(res, path) {
    res.setHeader("Cache-Control", path === "/sw.js" ? "no-store" :
      path.startsWith("/assets/") ? "public, max-age=31536000, immutable" :
      path.startsWith("/sound/") ? "public, max-age=3600" : "no-cache");
  } }) : null;
  const clients = new Map();
  const windowMs = 60_000;
  const server = createServer(async (req, res) => {
    const started = performance.now();
    const client = clientAddress(req, trustProxyHops);
    res.once("finish", () => onAccess({ time: new Date().toISOString(), method: req.method,
      path: (req.url || "").split("?")[0], status: res.statusCode,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      client, userAgent: req.headers["user-agent"] || "" }));
    res.setHeader("Cache-Control", "no-store");
    const reply = (status, body) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(status === 204 ? undefined : JSON.stringify(body));
    };
    const path = (req.url || "").split("?")[0];
    if (path === "/api/health" && req.method === "GET") return reply(200, { ok: true });
    if (path !== "/api/feedback") {
      if (serve && !path.startsWith("/api/") && ["GET", "HEAD"].includes(req.method)) {
        return serve(req, res, () => reply(404, { error: "not_found" }));
      }
      return reply(404, { error: "not_found" });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return reply(405, { error: "method_not_allowed" });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
      return reply(415, { error: "json_required" });
    }

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
  try {
    await runSoundSync();
    const logDir = resolve(process.env.LOG_DIR || "logs");
    mkdirSync(logDir, { recursive: true });
    const log = createStream("access.jsonl", { path: logDir, size: "20M", interval: "1d", maxFiles: 14, compress: "gzip" });
    log.on("error", () => console.error("Access log write failed; check LOG_DIR permissions"));
    const server = createApiServer({ staticDir: resolve("dist"),
      trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0),
      onAccess(entry) { const line = JSON.stringify(entry); console.log(line); log.write(line + "\n"); },
    });
    server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () => console.log("Application listening on port " + server.address().port));
    const stop = () => {
      server.close(() => log.end(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } catch (error) {
    console.error(`Application startup failed (${error?.name || "Error"}); check R2 configuration and server settings.`);
    process.exitCode = 1;
  }
}
