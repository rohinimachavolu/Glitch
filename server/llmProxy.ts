/**
 * Glitch — server-side Groq proxy
 * The browser never sees the API key: it POSTs to /api/llm/* and this module calls Groq.
 * Used by the Express server in production and mounted into Vite in dev (see vite.config.ts).
 *
 * Failsafe chain when Groq is rate-limited or down:
 *   1. skip (key, model) pairs still cooling down from an earlier 429
 *   2. try every key (GROQ_API_KEYS) on the primary model, then on the fallback model
 *   3. if everything is busy and Groq asks for a short wait, wait once and retry
 *   4. otherwise return 503 — the client then uses its local, non-AI fallbacks
 * A per-IP limit keeps one visitor from draining the shared quota.
 */
import type { IncomingMessage, ServerResponse } from "http";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const MAX_BODY_BYTES = 8 * 1024 * 1024; // food photos arrive as base64 data URLs

export interface LlmConfig {
  keys: string[];
  textModel: string;
  fallbackModel: string;
  visionModel: string;
  /** Requests per IP per minute; 0 disables the limit */
  perIpPerMinute: number;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): LlmConfig {
  // VITE_* names are still accepted so existing local .env files keep working
  const keys = (env.GROQ_API_KEYS || env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && !k.startsWith("your_"));
  return {
    keys,
    textModel: env.GROQ_TEXT_MODEL || env.VITE_GROQ_TEXT_MODEL || "openai/gpt-oss-120b",
    // Separate per-model quota on Groq, used when the main model is rate-limited
    fallbackModel: env.GROQ_FALLBACK_MODEL || env.VITE_GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b",
    visionModel: env.GROQ_VISION_MODEL || env.VITE_GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
    perIpPerMinute: Number(env.LLM_RATE_LIMIT_PER_MIN ?? 40),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seconds Groq asks us to wait on a 429 (header or "try again in 4.2s" in the body). */
export function retryAfterSeconds(res: Response, body: string): number {
  const h = Number(res.headers.get("retry-after"));
  if (Number.isFinite(h) && h > 0) return h;
  const m = body.match(/try again in ([0-9.]+)s/i);
  return m ? Number(m[1]) : 10;
}

interface ChatRequest {
  messages: unknown[];
  json?: boolean;
  maxTokens?: number;
  /** Background jobs start on the fallback model so the main model's quota stays free for live chat */
  background?: boolean;
  /** Live chat: if every model is busy, wait out Groq's suggested delay (≤20 s) once more instead of failing */
  patient?: boolean;
}

type Outcome = { status: number; body: unknown };

export function createLlmProxy(cfg: LlmConfig, fetchImpl: typeof fetch = fetch) {
  /** "key|model" → epoch ms when it may be used again */
  const cooldown = new Map<string, number>();
  const hits = new Map<string, { windowStart: number; count: number }>();

  function rateLimited(ip: string): boolean {
    if (!cfg.perIpPerMinute) return false;
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.windowStart > 60_000) {
      hits.set(ip, { windowStart: now, count: 1 });
      if (hits.size > 5000) hits.clear(); // keep memory bounded on a long-lived instance
      return false;
    }
    h.count += 1;
    return h.count > cfg.perIpPerMinute;
  }

  /** Try each model × key in order; returns the first non-429 response or the soonest retry time. */
  async function attempt(models: string[], build: (model: string) => object): Promise<{ res?: Response; text?: string; waitSec: number }> {
    let waitSec = Infinity;
    let last: { res: Response; text: string } | undefined;
    for (const model of models) {
      for (const key of cfg.keys) {
        const id = `${key}|${model}`;
        const until = cooldown.get(id) ?? 0;
        if (until > Date.now()) { waitSec = Math.min(waitSec, (until - Date.now()) / 1000); continue; }
        let res: Response;
        try {
          res = await fetchImpl(`${GROQ_BASE}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify(build(model)),
          });
        } catch {
          continue; // network blip: try the next key/model
        }
        const text = await res.text();
        if (res.status === 429) {
          const s = retryAfterSeconds(res, text);
          cooldown.set(id, Date.now() + s * 1000);
          waitSec = Math.min(waitSec, s);
          continue;
        }
        // Bad key or Groq outage on this pair: move on, but remember the error in case nothing works
        if (res.status === 401 || res.status === 403 || res.status >= 500) { last = { res, text }; continue; }
        return { res, text, waitSec: 0 };
      }
    }
    return { res: last?.res, text: last?.text, waitSec };
  }

  async function complete(models: string[], build: (model: string) => object, maxWaitSec: number): Promise<Outcome> {
    if (!cfg.keys.length) return { status: 503, body: { error: { message: "GROQ_API_KEY is not set on the server" } } };
    let r = await attempt(models, build);
    if (!r.res && r.waitSec <= maxWaitSec) {
      await sleep(r.waitSec * 1000 + 250);
      r = await attempt(models, build);
    }
    if (!r.res) return { status: 503, body: { error: { code: "rate_limited", message: "All models are busy, try again shortly" } } };
    if (!r.res.ok) {
      // Pass Groq's error through untouched; the client reads json_validate_failed from it
      let body: unknown = { error: { message: r.text } };
      try { body = JSON.parse(r.text ?? ""); } catch { /* not JSON */ }
      return { status: r.res.status >= 500 ? 502 : r.res.status, body };
    }
    const data = JSON.parse(r.text ?? "{}");
    return { status: 200, body: { content: data.choices?.[0]?.message?.content ?? "" } };
  }

  async function chat(req: ChatRequest): Promise<Outcome> {
    if (!Array.isArray(req.messages) || !req.messages.length) return { status: 400, body: { error: { message: "messages required" } } };
    const models = req.background ? [cfg.fallbackModel, cfg.textModel] : [cfg.textModel, cfg.fallbackModel];
    const maxTokens = Math.min(Math.max(Number(req.maxTokens) || 1200, 50), 4000);
    return complete(models, (model) => ({
      model,
      messages: req.messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      ...(req.json !== false ? { response_format: { type: "json_object" } } : {}),
    }), req.patient ? 20 : 6);
  }

  async function vision(req: { image?: string; prompt?: string }): Promise<Outcome> {
    if (typeof req.image !== "string" || !req.image.startsWith("data:image/") || typeof req.prompt !== "string") {
      return { status: 400, body: { error: { message: "image (data URL) and prompt required" } } };
    }
    return complete([cfg.visionModel], (model) => ({
      model,
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: req.image } }, { type: "text", text: req.prompt }] }],
      temperature: 0.2,
      max_tokens: 2000,
    }), 6);
  }

  /** Node-style middleware: handles /api/llm/* and /api/health, calls next() for anything else. */
  return async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = (req.url ?? "").split("?")[0];
    const send = (o: Outcome) => {
      res.writeHead(o.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(o.body));
    };
    if (url === "/api/health") return send({ status: 200, body: { ok: true, llm: cfg.keys.length > 0 } });
    if (url !== "/api/llm/chat" && url !== "/api/llm/vision") return next();
    if (req.method !== "POST") return send({ status: 405, body: { error: { message: "POST only" } } });

    const fwd = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0].trim() || req.socket.remoteAddress || "?";
    if (rateLimited(ip)) return send({ status: 429, body: { error: { code: "rate_limited", message: "Too many requests, slow down a little" } } });

    let payload: Record<string, unknown>;
    try {
      payload = await readJson(req);
    } catch (e) {
      return send({ status: 400, body: { error: { message: String((e as Error).message) } } });
    }
    try {
      send(url === "/api/llm/chat" ? await chat(payload as unknown as ChatRequest) : await vision(payload));
    } catch (e) {
      console.error("LLM proxy error:", e);
      send({ status: 502, body: { error: { message: "Upstream error" } } });
    }
  };
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error("Request too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
