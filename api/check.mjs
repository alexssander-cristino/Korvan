import { getDb } from "../lib/server/db.mjs";
import { cronAuthorized, requireAdmin } from "../lib/server/auth.mjs";

function safeTarget(raw) {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return url.toString();
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const cron = cronAuthorized(req);
  if (req.method !== "POST" && !(req.method === "GET" && cron)) {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!cron && !requireAdmin(req, res)) return;
  try {
    const sql = getDb();
    const systems = await sql`SELECT system_key, name, base_url FROM monitored_systems WHERE enabled = TRUE AND base_url IS NOT NULL ORDER BY name LIMIT 100`;
    const results = await Promise.all(systems.map(async (system) => {
      const target = safeTarget(system.base_url);
      const started = Date.now();
      let status = "error";
      let message = target ? "Falha ao conectar" : "URL bloqueada por segurança";
      let httpStatus = null;
      if (target) {
        try {
          let response = await fetch(target, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Prysm-Monitor/1.0" } });
          if ([405, 501].includes(response.status)) {
            if (response.body) await response.body.cancel();
            response = await fetch(target, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Prysm-Monitor/1.0" } });
          }
          httpStatus = response.status;
          status = response.ok ? "ok" : "error";
          message = `HTTP ${response.status}`;
          if (response.body) await response.body.cancel();
        } catch (error) {
          message = error.name === "TimeoutError" ? "Timeout após 10 segundos" : "Falha de conexão, DNS ou redirecionamento";
        }
      }
      const durationMs = Date.now() - started;
      await sql`INSERT INTO telemetry_events (system_key, event_type, status, message, duration_ms, metadata)
        VALUES (${system.system_key}, 'http.check', ${status}, ${message}, ${durationMs}, ${JSON.stringify({ httpStatus, checkedUrl: target || system.base_url })}::jsonb)`;
      return { systemKey: system.system_key, name: system.name, status, httpStatus, durationMs, message };
    }));
    return res.status(200).json({ checked: results.length, results, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Prysm check failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "check_failed" });
  }
}
