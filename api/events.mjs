import { getDb } from "../lib/server/db.mjs";
import { requireAdmin } from "../lib/server/auth.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const sql = getDb();
    const key = typeof req.query?.systemKey === "string" ? req.query.systemKey : null;
    const status = typeof req.query?.status === "string" && ["ok", "warning", "error"].includes(req.query.status) ? req.query.status : null;
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit || "50", 10) || 50));
    const events = await sql`SELECT id, system_key, event_type, status, message, duration_ms, metadata, created_at
      FROM telemetry_events
      WHERE (${key}::text IS NULL OR system_key = ${key})
        AND (${status}::text IS NULL OR status = ${status})
      ORDER BY created_at DESC LIMIT ${limit}`;
    return res.status(200).json({ events });
  } catch (error) {
    console.error("Prysm events failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "events_failed" });
  }
}
