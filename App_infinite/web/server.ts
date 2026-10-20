// Run one copy via bun run dev; stop any previous start process first.
import homepage from "./index.html";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";
function proxy(request: Request) {
  const url = new URL(request.url);
  return fetch(new Request(new URL(url.pathname + url.search, backend), request), { redirect: "manual" })
    .catch(() => Response.json({ error: "INTERNAL_ERROR" }, { status: 503 }));
}
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8080),
  routes: { "/": homepage, "/api/*": proxy, "/health": proxy },
});
console.log(`InfiniteWeek frontend listening on ${server.url} (open http://localhost:${server.port})`);
