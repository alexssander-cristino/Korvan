import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer, loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const routes = {
  "/api/auth": "/api/auth.mjs",
  "/api/health": "/api/health.mjs",
  "/api/overview": "/api/overview.mjs",
  "/api/systems": "/api/systems.mjs",
  "/api/system": "/api/system.mjs",
  "/api/events": "/api/events.mjs",
  "/api/check": "/api/check.mjs",
  "/api/ingest": "/api/ingest.mjs",
};

let vite;
const server = createHttpServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const modulePath = routes[url.pathname];
    if (!modulePath) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    try {
      let body;
      if (["POST", "PATCH", "PUT"].includes(req.method || "")) {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024 * 1024) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "payload_too_large" }));
            return;
          }
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        if (raw) {
          try { body = JSON.parse(raw); }
          catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_json" }));
            return;
          }
        }
      }
      const query = Object.fromEntries(url.searchParams.entries());
      const handlerModule = await vite.ssrLoadModule(modulePath);
      const adapter = {
        status(code) { res.statusCode = code; return this; },
        json(data) {
          if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(data));
          return this;
        },
        setHeader(name, value) { res.setHeader(name, value); },
      };
      await handlerModule.default({
        method: req.method,
        headers: req.headers,
        body,
        query,
        url: req.url,
      }, adapter);
      if (!res.writableEnded) res.end();
    } catch (error) {
      console.error("Local API error:", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      if (!res.writableEnded) res.end(JSON.stringify({ error: "internal_error" }));
    }
    return;
  }
  vite.middlewares(req, res, (error) => {
    if (error) {
      console.error(error);
      res.writeHead(500).end("Internal Server Error");
    } else if (!res.writableEnded) {
      res.writeHead(404).end("Not Found");
    }
  });
});

vite = await createViteServer({
  configFile: "vite.config.ts",
  appType: "spa",
  server: { middlewareMode: true, hmr: { server } },
});

const port = Number(process.env.PORT || 5173);
server.listen(port, "0.0.0.0", () => {
  console.log(`Prysm local server running at http://localhost:${port}`);
  console.log("Frontend + API enabled. Environment loaded from .env.local/.env files.");
});

const shutdown = async () => {
  await vite.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
