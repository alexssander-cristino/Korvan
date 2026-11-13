import { getDb } from "../lib/server/db.mjs";
import { requireAdmin } from "../lib/server/auth.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const sql = getDb();
    const [systems, stats, activity] = await Promise.all([
      sql`SELECT id, system_key, name, description, base_url, enabled, created_at FROM monitored_systems ORDER BY created_at ASC`,
      sql`SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS checks_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status = 'error')::int AS errors_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status = 'warning')::int AS warnings_24h,
        ROUND(AVG(duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'))::int AS avg_latency_ms,
        ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'))::int AS p95_latency_ms
      FROM telemetry_events WHERE event_type = 'http.check'`,
      sql`SELECT id, system_key, event_type, status, message, duration_ms, created_at FROM telemetry_events ORDER BY created_at DESC LIMIT 8`
    ]);
    const uptime = await sql`SELECT system_key,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'ok') / NULLIF(COUNT(*), 0), 2) AS uptime_24h,
      ROUND(AVG(duration_ms))::int AS avg_latency_ms,
      (array_agg(status ORDER BY created_at DESC))[1] AS last_status,
      MAX(created_at) AS last_check
      FROM telemetry_events WHERE event_type = 'http.check' AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY system_key`;
    return res.status(200).json({ systems, stats: stats[0], uptime, activity });
  } catch (error) {
    console.error("Prysm overview failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "overview_failed" });
  }
}
