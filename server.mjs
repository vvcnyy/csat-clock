import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 3000);
const root = join(import.meta.dirname, "dist");
const trustProxy = process.env.TRUST_PROXY === "true";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8" };

function json(res, status, body) {
  const data = status === 204 ? "" : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

async function feedback(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return json(res, 405, { error: "method_not_allowed" }); }
  const webhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!webhook) return json(res, 503, { error: "feedback_not_configured" });
  let raw = "";
  try {
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) return json(res, 413, { error: "payload_too_large" }); }
    const payload = JSON.parse(raw || "{}");
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const contact = typeof payload.contact === "string" ? payload.contact.trim() : "";
    if (!message || message.length > 2000 || contact.length > 200) return json(res, 400, { error: "invalid_feedback" });
    const content = `📩 수능시계 의견\n${message}${contact ? `\n\n회신 연락처: ${contact}` : ""}`;
    let result;
    try {
      result = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    } catch {
      return json(res, 502, { error: "discord_unreachable" });
    }
    return result.ok ? json(res, 204, {}) : json(res, 502, { error: "discord_rejected" });
  } catch { return json(res, 400, { error: "invalid_json" }); }
}

async function staticFile(req, res, pathname) {
  let relative;
  try { relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, ""); } catch { return json(res, 400, { error: "invalid_path" }); }
  let file = join(root, relative || "index.html");
  if (!file.startsWith(`${root}/`)) return json(res, 400, { error: "invalid_path" });
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); await stat(file); } catch { file = join(root, "index.html"); }
  const suffix = extname(file).toLowerCase();
  const noCache = file.endsWith("/sw.js") || file.endsWith("/site.webmanifest");
  res.writeHead(200, { "Content-Type": types[suffix] || "application/octet-stream", "Cache-Control": noCache ? "no-store" : file.includes("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600", "X-Content-Type-Options": "nosniff" });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

function clientIp(req) {
  if (trustProxy) {
    const cloudflareIp = req.headers["cf-connecting-ip"];
    if (typeof cloudflareIp === "string" && cloudflareIp) return cloudflareIp;
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const url = req.url?.split("?", 1)[0] || "/";
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), ip: clientIp(req), method: req.method, path: url, status: res.statusCode, durationMs: Date.now() - startedAt }));
  });
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/health") return json(res, 200, { status: "ok" });
    if (url.pathname === "/api/feedback") return feedback(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "method_not_allowed" });
    return staticFile(req, res, url.pathname);
  } catch { return json(res, 500, { error: "internal_server_error" }); }
});

server.listen(port, "0.0.0.0", () => console.log(`Listening on ${port}`));
