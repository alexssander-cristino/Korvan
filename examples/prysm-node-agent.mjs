/**
 * Minimal server-side reporter for Prysm.
 * Keep PRYSM_INGEST_TOKEN on the server. Never expose it in browser code.
 */
export function createPrysmReporter({ endpoint, systemKey, token }) {
  if (!endpoint || !systemKey || !token) {
    throw new Error("Prysm reporter requires endpoint, systemKey and token");
  }

  async function send({ eventType, status = "ok", message, durationMs, metadata = {} }) {
    try {
      const response = await fetch(new URL("/api/ingest", endpoint), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ systemKey, eventType, status, message, durationMs, metadata }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Prysm ingest returned HTTP ${response.status}`);
      }
      return true;
    } catch (error) {
      // Monitoring must never crash the application being monitored.
      console.error("[Prysm reporter]", error.message);
      return false;
    }
  }

  return {
    event: send,
    error(error, metadata = {}) {
      return send({
        eventType: "application.error",
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        metadata: {
          ...metadata,
          errorName: error instanceof Error ? error.name : "Error",
          stack: error instanceof Error ? error.stack?.slice(0, 5000) : undefined,
        },
      });
    },
    performance(eventType, durationMs, metadata = {}) {
      return send({ eventType, status: "ok", durationMs, metadata });
    },
    request({ method = "GET", route = "/", statusCode = 200, durationMs = 0, requestBytes = 0, responseBytes = 0 }) {
      const code = Number(statusCode);
      const status = code >= 500 ? "error" : code >= 400 ? "warning" : "ok";
      return send({
        eventType: "http.request",
        status,
        durationMs: Math.max(0, Math.round(durationMs)),
        metadata: {
          method: String(method).toUpperCase().slice(0, 10),
          route: String(route).split("?")[0].slice(0, 240),
          httpStatus: code,
          requestBytes: Math.max(0, Number(requestBytes) || 0),
          responseBytes: Math.max(0, Number(responseBytes) || 0),
        },
      });
    },
  };
}
