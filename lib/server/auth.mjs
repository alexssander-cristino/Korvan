import crypto from "node:crypto";

const COOKIE = "prysm_session";
const MAX_AGE = 60 * 60 * 12;

function secret() {
  return process.env.PRYSM_SESSION_SECRET || "";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createSessionToken() {
  if (!secret()) throw new Error("session_secret_not_configured");
  const payload = Buffer.from(JSON.stringify({ sub: "owner", exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return payload + "." + sign(payload);
}

export function verifySessionToken(token) {
  if (!token || !secret()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.sub === "owner" && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isAuthenticated(req) {
  const cookie = req.headers.cookie || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  try { return verifySessionToken(token ? decodeURIComponent(token) : ""); }
  catch { return false; }
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure}`);
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

export function requireAdmin(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

export function cronAuthorized(req) {
  const expected = process.env.PRYSM_CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-cron-secret"];
  return Boolean(expected && provided && safeEqual(expected, provided));
}
