import crypto from "node:crypto";
import { getDb } from "../lib/server/db.mjs";

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const expected = process.env.PRYSM_INGEST_TOKEN;
  const provided = req.headers.authorization?.replace(/^Bearer\\s+/i, "");
  if (!expected || !sameSecret(expected, provided)) return res.status(401).json({ error: "unauthorized" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { systemKey, eventType, status = "ok", message, durationMs, metadata = {} } = body;
  if (typeof systemKey !== "string" || !/^[a-z0-9_-]{2,64}$/i.test(systemKey)) return res.status(400).json({ error: "invalid_system_key" });
  if (typeof eventType !== "string" || !/^[a-zA-Z0-9._:-]{2,80}$/.test(eventType)) return res.status(400).json({ error: "invalid_event_type" });
  if (!["ok", "warning", "error"].includes(status)) return res.status(400).json({ error: "invalid_status" });
  if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600000)) return res.status(400).json({ error: "invalid_duration" });
  if (message !== undefined && (typeof message !== "string" || message.length > 2000)) return res.status(400).json({ error: "invalid_message" });
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || Buffer.byteLength(JSON.stringify(metadata)) > 8000) return res.status(400).json({ error: "invalid_metadata" });

  try {
    const sql = getDb();
    const rows = await sql`INSERT INTO telemetry_events (system_key, event_type, status, message, duration_ms, metadata)
      VALUES (${systemKey.toLowerCase()}, ${eventType}, ${status}, ${message ?? null}, ${durationMs ?? null}, ${JSON.stringify(metadata)}::jsonb)
      RETURNING id, created_at`;
    return res.status(201).json({ accepted: true, event: rows[0] });
  } catch (error) {
    if (error.code === "23503") return res.status(404).json({ error: "unknown_system" });
    console.error("Prysm ingest failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "ingest_failed" });
  }
}
