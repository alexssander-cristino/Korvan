export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    service: "prysm-api",
    version: "0.2.0",
    timestamp: new Date().toISOString(),
  });
}