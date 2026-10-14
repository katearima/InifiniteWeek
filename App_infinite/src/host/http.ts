import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { infinitePlansPolicy } from "../http.ts";
import { createRuntime } from "./runtime.ts";

/** The same serialized runtime serves every HTTP workflow. */
export function createHttpApplication(
  resources: Parameters<typeof createRuntime>[0],
  options: NonNullable<Parameters<typeof createRuntime>[1]> & { publicOrigin: string; requestTimeoutMs?: number },
) {
  const timeoutMs = options.requestTimeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw new Error("Invalid HTTP request timeout");
  const { application, gateway, boundary, queue } = createRuntime(resources, options);
  const handleApi = createHttpHandler({ application, gateway, policy: infinitePlansPolicy(options.publicOrigin) });
  let draining = false;
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  return {
    async fetch(request: Request): Promise<Response> {
      const { pathname } = new URL(request.url);
      if (pathname === "/health") {
        if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } });
        if (draining) return json({ status: "unavailable" }, 503);
        try {
          await resources.database.command({ ping: 1 }, { timeoutMS: 3000 });
          return json({ status: "ok" });
        } catch { return json({ status: "unavailable" }, 503); }
      }
      if (pathname === "/api" || pathname.startsWith("/api/")) {
        if (draining) return json({ error: "INTERNAL_ERROR" }, 503);
        let admitted = false;
        const result = await queue.submit(() => { admitted = true; return handleApi(request); }, { signal: request.signal, timeoutMs });
        if (!admitted) void request.body?.cancel().catch(() => {});
        const code = !result.ok && result.error.kind === "framework" ? result.error.code : "INTERNAL_ERROR";
        const response = result.ok ? result.value : json({ error: "INTERNAL_ERROR" },
          code === "TIMED_OUT" ? 504 : code === "ABORTED" ? 499 : code === "UNAVAILABLE" ? 503 : 500);
        // Authenticated reads must not be cached by browsers or intermediaries.
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("X-Content-Type-Options", "nosniff");
        return response;
      }
      return json({ error: "NOT_FOUND" }, 404);
    },
    whenIdle: boundary.whenIdle,
    beginDrain() { draining = true; return boundary.beginDrain(); },
  };
}
