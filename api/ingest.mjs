import { neon } from "@neondatabase/serverless";

function unauthorized(res) {
  return res.status(401).json({ error: "unauthorized" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const expected = process.env.KORVAN_INGEST_TOKEN;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided || provided !== expected) return unauthorized(res);

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: "database_not_configured" });
  }

  const { systemKey, eventType, status, message, durationMs, metadata } = req.body ?? {};
  if (typeof systemKey !== "string" || !/^[a-z0-9_-]{2,64}$/i.test(systemKey)) {
    return res.status(400).json({ error: "invalid_system_key" });
  }
  if (typeof eventType !== "string" || eventType.length > 80) {
    return res.status(400).json({ error: "invalid_event_type" });
  }
  if (status !== undefined && !["ok", "warning", "error"].includes(status)) {
    return res.status(400).json({ error: "invalid_status" });
  }
  if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600000)) {
    return res.status(400).json({ error: "invalid_duration" });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      INSERT INTO telemetry_events (system_key, event_type, status, message, duration_ms, metadata)
      VALUES (
        ${systemKey},
        ${eventType},
        ${status ?? "ok"},
        ${typeof message === "string" ? message.slice(0, 2000) : null},
        ${durationMs ?? null},
        ${JSON.stringify(metadata && typeof metadata === "object" ? metadata : {})}::jsonb
      )
      RETURNING id, created_at
    `;
    return res.status(201).json({ accepted: true, event: rows[0] });
  } catch (error) {
    console.error("Korvan ingest failed", error);
    return res.status(500).json({ error: "ingest_failed" });
  }
}