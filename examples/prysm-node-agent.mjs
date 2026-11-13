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
  };
}
