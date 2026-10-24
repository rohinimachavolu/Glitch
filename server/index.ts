import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "12mb" })); // large limit for base64 food images

  // ── Subconscious LLM proxy (keeps the API key server-side) ──
  const SUB_KEY = process.env.SUBCONSCIOUS_API_KEY;
  const SUB_BASE = process.env.SUBCONSCIOUS_BASE_URL || "https://api.subconscious.dev/v1";
  app.post("/api/llm", async (req, res) => {
    if (!SUB_KEY) return res.status(501).json({ error: "LLM not configured on server" });
    try {
      const r = await fetch(`${SUB_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUB_KEY}` },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    } catch {
      return res.status(502).json({ error: "LLM proxy failed" });
    }
  });

  // ── WHOOP OAuth token exchange (keeps the client secret off the browser) ──
  // Client secret is read from the environment, never shipped to the frontend.
  const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID;
  const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;

  app.post("/api/whoop/token", async (req, res) => {
    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
      return res.status(501).json({ error: "WHOOP not configured on server" });
    }
    const { code, redirect_uri } = req.body ?? {};
    if (!code || !redirect_uri) return res.status(400).json({ error: "missing code/redirect_uri" });
    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
      });
      const r = await fetch(WHOOP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "whoop token exchange failed" });
    }
  });

  app.post("/api/whoop/refresh", async (req, res) => {
    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
      return res.status(501).json({ error: "WHOOP not configured on server" });
    }
    const { refresh_token } = req.body ?? {};
    if (!refresh_token) return res.status(400).json({ error: "missing refresh_token" });
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
        scope: "offline",
      });
      const r = await fetch(WHOOP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = await r.json();
      return res.status(r.ok ? 200 : r.status).json(data);
    } catch (err) {
      return res.status(502).json({ error: "whoop refresh failed" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
