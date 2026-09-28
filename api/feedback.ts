type Request = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

declare const process: { env: Record<string, string | undefined> };

type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
};

const MAX_MESSAGE_LENGTH = 2000;

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const webhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!webhook) return res.status(503).json({ error: "feedback_not_configured" });

  let payload: { message?: unknown; contact?: unknown } = {};
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : (req.body as typeof payload) ?? {};
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({ error: "invalid_feedback" });
  }
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const contact = typeof payload.contact === "string" ? payload.contact.trim() : "";
  if (!message || message.length > MAX_MESSAGE_LENGTH || contact.length > 200) {
    return res.status(400).json({ error: "invalid_feedback" });
  }

  // Discord content is limited to 2,000 characters; an embed allows the full form.
  const description = `${message}${contact ? `\n\n회신 연락처: ${contact}` : ""}`;
  try {
    const discordResponse = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: "수능시계 의견", description }],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!discordResponse.ok) return res.status(502).json({ error: "discord_rejected" });
    return res.status(204).json({});
  } catch {
    return res.status(502).json({ error: "discord_unreachable" });
  }
}
