import { getDb } from "../lib/server/db.mjs";
import { cronAuthorized, requireAdmin } from "../lib/server/auth.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!cronAuthorized(req) && !requireAdmin(req, res)) return;
  try {
    const sql = getDb();
    const systems = await sql`SELECT system_key, name, base_url FROM monitored_systems WHERE enabled = TRUE AND base_url IS NOT NULL ORDER BY name`;
    const results = await Promise.all(systems.map(async (system) => {
      const started = Date.now();
      let status = "error";
      let message = "Falha ao conectar";
      let httpStatus = null;
      try {
        const response = await fetch(system.base_url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Prysm-Monitor/1.0" } });
        httpStatus = response.status;
        status = response.ok ? "ok" : "error";
        message = `HTTP ${response.status}`;
        if (response.body) await response.body.cancel();
      } catch (error) {
        message = error.name === "TimeoutError" ? "Timeout após 10 segundos" : "Falha de conexão ou DNS";
      }
      const durationMs = Date.now() - started;
      await sql`INSERT INTO telemetry_events (system_key, event_type, status, message, duration_ms, metadata)
        VALUES (${system.system_key}, 'http.check', ${status}, ${message}, ${durationMs}, ${JSON.stringify({ httpStatus, checkedUrl: system.base_url })}::jsonb)`;
      return { systemKey: system.system_key, name: system.name, status, httpStatus, durationMs, message };
    }));
    return res.status(200).json({ checked: results.length, results, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Prysm check failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "check_failed" });
  }
}
