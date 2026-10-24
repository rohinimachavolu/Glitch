import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { configFromEnv, createLlmProxy } from "./llmProxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  const llm = configFromEnv();
  if (!llm.keys.length) console.warn("GROQ_API_KEY is not set: AI features will use local fallbacks");
  app.use(createLlmProxy(llm));

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
