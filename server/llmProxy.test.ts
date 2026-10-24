import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";
import { configFromEnv, createLlmProxy } from "./llmProxy";

/** Drive the middleware with a fake request and collect the JSON response. */
async function call(handler: ReturnType<typeof createLlmProxy>, url: string, body: unknown, ip = "1.1.1.1") {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  Object.assign(req, { url, method: "POST", headers: { "x-forwarded-for": ip }, socket: { remoteAddress: ip } });
  let status = 0, out = "";
  await new Promise<void>((resolve) => {
    const res = { writeHead: (s: number) => { status = s; }, end: (b: string) => { out = b; resolve(); } } as unknown as ServerResponse;
    handler(req, res, () => resolve());
  });
  return { status, body: out ? JSON.parse(out) : null };
}

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const limited = () => new Response('{"error":{"message":"Rate limit. Please try again in 0.01s"}}', { status: 429 });
const cfg = (over: Partial<ReturnType<typeof configFromEnv>> = {}) => ({ ...configFromEnv({ GROQ_API_KEY: "k1" }), ...over });

describe("LLM proxy failsafe", () => {
  it("falls back to the second model when the first is rate-limited", async () => {
    const calls: { key: string; model: string }[] = [];
    const fetchMock = vi.fn(async (_u: string, init: { body: string; headers: Record<string, string> }) => {
      calls.push({ key: init.headers.Authorization, model: JSON.parse(init.body).model });
      return calls.length === 1 ? limited() : ok('{"reply":"hi"}');
    });
    const h = createLlmProxy(cfg(), fetchMock as unknown as typeof fetch);
    const r = await call(h, "/api/llm/chat", { messages: [{ role: "user", content: "hi" }] });
    expect(r).toEqual({ status: 200, body: { content: '{"reply":"hi"}' } });
    expect(calls[0].model).toBe("openai/gpt-oss-120b");
    expect(calls[1].model).toBe("openai/gpt-oss-20b");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body).reasoning_effort).toBe("low");
  });

  it("rotates across multiple API keys before giving up on a model", async () => {
    const keys: string[] = [];
    const fetchMock = vi.fn(async (_u: string, init: { headers: Record<string, string> }) => {
      keys.push(init.headers.Authorization);
      return keys.length === 1 ? limited() : ok("x");
    });
    const h = createLlmProxy(cfg({ keys: ["a", "b"] }), fetchMock as unknown as typeof fetch);
    expect((await call(h, "/api/llm/chat", { messages: [{ role: "user", content: "hi" }] })).status).toBe(200);
    expect(keys).toEqual(["Bearer a", "Bearer b"]);
  });

  it("waits out a short limit once, then returns 503 so the client uses local fallbacks", async () => {
    const h = createLlmProxy(cfg(), vi.fn(async () => limited()) as unknown as typeof fetch);
    const r = await call(h, "/api/llm/chat", { messages: [{ role: "user", content: "hi" }] });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe("rate_limited");
  });

  it("passes Groq's json_validate_failed error through for the client to recover", async () => {
    const err = { error: { code: "json_validate_failed", failed_generation: "What kind of pasta?" } };
    const h = createLlmProxy(cfg(), vi.fn(async () => new Response(JSON.stringify(err), { status: 400 })) as unknown as typeof fetch);
    expect(await call(h, "/api/llm/chat", { messages: [{ role: "user", content: "pasta" }] })).toEqual({ status: 400, body: err });
  });

  it("limits requests per IP", async () => {
    const h = createLlmProxy(cfg({ perIpPerMinute: 2 }), vi.fn(async () => ok("x")) as unknown as typeof fetch);
    const msg = { messages: [{ role: "user", content: "hi" }] };
    await call(h, "/api/llm/chat", msg, "9.9.9.9");
    await call(h, "/api/llm/chat", msg, "9.9.9.9");
    expect((await call(h, "/api/llm/chat", msg, "9.9.9.9")).status).toBe(429);
    expect((await call(h, "/api/llm/chat", msg, "8.8.8.8")).status).toBe(200);
  });

  it("reports 503 instead of crashing when no key is configured", async () => {
    const h = createLlmProxy(configFromEnv({}), vi.fn() as unknown as typeof fetch);
    expect((await call(h, "/api/llm/chat", { messages: [{ role: "user", content: "hi" }] })).status).toBe(503);
  });
});
