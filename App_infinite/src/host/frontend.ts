import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

/** Production assets only; all application requests still use the existing HTTP boundary. */
export async function withFrontend(api: (request: Request) => Promise<Response>, directory: string) {
  const root = await realpath(directory);
  const index = Bun.file(resolve(root, "index.html"));
  if (!(await index.exists())) throw new Error("Production frontend is missing. Run bun run build before start.");
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    if (pathname === "/health" || pathname === "/api" || pathname.startsWith("/api/")) return api(request);
    const headers = { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" };
    const missing = () => new Response(null, { status: 404, headers });
    if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    let path: string;
    try { path = decodeURIComponent(pathname); } catch { return missing(); }
    if (path.includes("\\") || path.includes("\0") || path.split("/").some(part => part.startsWith("."))) return missing();
    const target = resolve(root, `.${path}`);
    if (target !== root && !target.startsWith(root + sep)) return missing();
    let file = index;
    if (path !== "/") {
      try {
        const actual = await realpath(target);
        if (!actual.startsWith(root + sep)) return missing();
        file = Bun.file(actual);
        if (!(await file.exists())) return missing();
      } catch {
        // Navigation can load the SPA, but missing assets and source paths stay 404.
        if (path.startsWith("/assets/") || path.split("/").pop()!.includes(".") || !request.headers.get("accept")?.includes("text/html")) return missing();
      }
    }
    return new Response(request.method === "HEAD" ? null : file, { headers: { ...headers, "Content-Type": file.type, "Content-Length": String(file.size) } });
  };
}
