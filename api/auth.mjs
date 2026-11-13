import crypto from "node:crypto";
import { clearSessionCookie, createSessionToken, isAuthenticated, setSessionCookie } from "../lib/server/auth.mjs";

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  return Boolean(host && new URL(origin).host === host);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ authenticated: isAuthenticated(req) });
  if (req.method === "DELETE") {
    clearSessionCookie(res);
    return res.status(200).json({ authenticated: false });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!sameOrigin(req)) return res.status(403).json({ error: "origin_not_allowed" });
  const configured = process.env.PRYSM_ADMIN_PASSWORD;
  if (!configured || !process.env.PRYSM_SESSION_SECRET) return res.status(503).json({ error: "auth_not_configured" });
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const a = Buffer.from(password);
  const b = Buffer.from(configured);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "invalid_credentials" });
  try {
    setSessionCookie(res, createSessionToken());
    return res.status(200).json({ authenticated: true });
  } catch {
    return res.status(503).json({ error: "auth_not_configured" });
  }
}
