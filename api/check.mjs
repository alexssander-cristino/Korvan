import { getDb } from "../lib/server/db.mjs";
import { cronAuthorized, requireAdmin } from "../lib/server/auth.mjs";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a,b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
    normalized.startsWith("fea") || normalized.startsWith("feb") ||
    normalized.startsWith("ff") || normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

async function safeTarget(raw) {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
    const records = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!records.length || records.some(record => isPrivateAddress(record.address))) return false;
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
      const target = await safeTarget(system.base_url);
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
