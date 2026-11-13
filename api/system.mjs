import { getDb } from "../lib/server/db.mjs";
import { requireAdmin } from "../lib/server/auth.mjs";

function validUrl(value) {
  if (value === null || value === "") return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : false; }
  catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!requireAdmin(req, res)) return;
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "invalid_id" });
  try {
    const sql = getDb();
    if (req.method === "PATCH") {
      const { name, description = "", baseUrl = "", enabled = true } = req.body ?? {};
      const url = validUrl(baseUrl);
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120 || url === false || typeof description !== "string" || description.length > 500 || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "invalid_system" });
      }
      const rows = await sql`UPDATE monitored_systems SET name = ${name.trim()}, description = ${description.trim()}, base_url = ${url}, enabled = ${enabled}, updated_at = NOW() WHERE id = ${id} RETURNING id, system_key, name, description, base_url, enabled, created_at`;
      return rows.length ? res.status(200).json({ system: rows[0] }) : res.status(404).json({ error: "not_found" });
    }
    if (req.method === "DELETE") {
      const rows = await sql`DELETE FROM monitored_systems WHERE id = ${id} RETURNING id`;
      return rows.length ? res.status(200).json({ deleted: true }) : res.status(404).json({ error: "not_found" });
    }
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (error) {
    console.error("Prysm system mutation failed", error);
    return res.status(error.statusCode || 500).json({ error: error.message === "database_not_configured" ? error.message : "system_mutation_failed" });
  }
}
