import { getDb } from "../lib/server/db.mjs";
import { requireAdmin } from "../lib/server/auth.mjs";

function validUrl(value) {
  if (value === null || value === "") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : false;
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!requireAdmin(req, res)) return;
  try {
    const sql = getDb();
    if (req.method === "GET") {
      const rows = await sql`SELECT id, system_key, name, description, base_url, enabled, created_at FROM monitored_systems ORDER BY created_at ASC`;
      return res.status(200).json({ systems: rows });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "method_not_allowed" });
    }
    const { name, systemKey, description = "", baseUrl = "" } = req.body ?? {};
    const key = typeof systemKey === "string" ? systemKey.trim().toLowerCase() : "";
    const url = validUrl(baseUrl);
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) return res.status(400).json({ error: "invalid_name" });
    if (!/^[a-z0-9_-]{2,64}$/.test(key)) return res.status(400).json({ error: "invalid_system_key" });
    if (url === false) return res.status(400).json({ error: "invalid_base_url" });
    if (typeof description !== "string" || description.length > 500) return res.status(400).json({ error: "invalid_description" });
    const rows = await sql`INSERT INTO monitored_systems (system_key, name, description, base_url)
      VALUES (${key}, ${name.trim()}, ${description.trim()}, ${url})
      RETURNING id, system_key, name, description, base_url, enabled, created_at`;
    return res.status(201).json({ system: rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "system_key_exists" });
    console.error("Prysm systems failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "systems_failed" });
  }
}
