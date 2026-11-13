import { getDb } from "../lib/server/db.mjs";
import { requireAdmin } from "../lib/server/auth.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const sql = getDb();
    const [systems, stats, activity, hourly, requestHourly, requestSummary, topRoutes] = await Promise.all([
      sql`SELECT id, system_key, name, description, base_url, enabled, created_at FROM monitored_systems ORDER BY created_at ASC`,
      sql`SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS checks_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status = 'error')::int AS errors_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status = 'warning')::int AS warnings_24h,
        ROUND(AVG(duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'))::int AS avg_latency_ms,
        ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'))::int AS p95_latency_ms
      FROM telemetry_events WHERE event_type = 'http.check'`,
      sql`SELECT id, system_key, event_type, status, message, duration_ms, created_at FROM telemetry_events ORDER BY created_at DESC LIMIT 8`,
      sql`SELECT system_key, date_trunc('hour', created_at) AS hour,
        COUNT(*)::int AS checks,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
        ROUND(AVG(duration_ms))::int AS avg_latency_ms,
        MAX(duration_ms)::int AS max_latency_ms
        FROM telemetry_events
        WHERE event_type = 'http.check' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY system_key, date_trunc('hour', created_at)
        ORDER BY system_key, hour ASC`,
      sql`SELECT system_key, date_trunc('hour', created_at) AS hour,
        COUNT(*)::int AS requests,
        COUNT(*) FILTER (WHERE CASE WHEN metadata->>'httpStatus' ~ '^[0-9]{3}$' THEN (metadata->>'httpStatus')::int BETWEEN 200 AND 299 ELSE FALSE END)::int AS status_2xx,
        COUNT(*) FILTER (WHERE CASE WHEN metadata->>'httpStatus' ~ '^[0-9]{3}$' THEN (metadata->>'httpStatus')::int BETWEEN 300 AND 399 ELSE FALSE END)::int AS status_3xx,
        COUNT(*) FILTER (WHERE CASE WHEN metadata->>'httpStatus' ~ '^[0-9]{3}$' THEN (metadata->>'httpStatus')::int BETWEEN 400 AND 499 ELSE FALSE END)::int AS status_4xx,
        COUNT(*) FILTER (WHERE CASE WHEN metadata->>'httpStatus' ~ '^[0-9]{3}$' THEN (metadata->>'httpStatus')::int BETWEEN 500 AND 599 ELSE FALSE END)::int AS status_5xx,
        ROUND(AVG(duration_ms))::int AS avg_latency_ms,
        ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95_latency_ms,
        COALESCE(SUM(CASE WHEN metadata->>'requestBytes' ~ '^[0-9]{1,12}$' THEN (metadata->>'requestBytes')::bigint ELSE 0 END),0)::bigint AS request_bytes,
        COALESCE(SUM(CASE WHEN metadata->>'responseBytes' ~ '^[0-9]{1,12}$' THEN (metadata->>'responseBytes')::bigint ELSE 0 END),0)::bigint AS response_bytes
        FROM telemetry_events
        WHERE event_type = 'http.request' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY system_key, date_trunc('hour', created_at)
        ORDER BY system_key, hour ASC`,
      sql`SELECT system_key,
        COUNT(*)::int AS requests_24h,
        ROUND(AVG(duration_ms))::int AS avg_latency_ms,
        ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95_latency_ms,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors_24h,
        COALESCE(SUM(CASE WHEN metadata->>'requestBytes' ~ '^[0-9]{1,12}$' THEN (metadata->>'requestBytes')::bigint ELSE 0 END),0)::bigint AS request_bytes,
        COALESCE(SUM(CASE WHEN metadata->>'responseBytes' ~ '^[0-9]{1,12}$' THEN (metadata->>'responseBytes')::bigint ELSE 0 END),0)::bigint AS response_bytes
        FROM telemetry_events
        WHERE event_type = 'http.request' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY system_key`,
      sql`SELECT system_key, COALESCE(metadata->>'route','(rota não informada)') AS route, COUNT(*)::int AS requests
        FROM telemetry_events
        WHERE event_type = 'http.request' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY system_key, COALESCE(metadata->>'route','(rota não informada)')
        ORDER BY system_key, requests DESC
        LIMIT 50`
    ]);
    const uptime = await sql`SELECT system_key,
      ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'ok') / NULLIF(COUNT(*), 0), 2) AS uptime_24h,
      ROUND(AVG(duration_ms))::int AS avg_latency_ms,
      (array_agg(status ORDER BY created_at DESC))[1] AS last_status,
      MAX(created_at) AS last_check
      FROM telemetry_events WHERE event_type = 'http.check' AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY system_key`;
    return res.status(200).json({ systems, stats: stats[0], uptime, activity, hourly, requestHourly, requestSummary, topRoutes });
  } catch (error) {
    console.error("Prysm overview failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "overview_failed" });
  }
}