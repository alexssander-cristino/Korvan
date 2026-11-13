import { neon } from "@neondatabase/serverless";

export function getDb() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("database_not_configured");
    error.statusCode = 503;
    throw error;
  }
  return neon(process.env.DATABASE_URL);
}

export function jsonError(res, status, error) {
  return res.status(status).json({ error });
}
