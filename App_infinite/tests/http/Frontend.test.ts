import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withFrontend } from "../../src/host/frontend.ts";

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
test("production serving confines assets to dist and preserves API/health responses", async () => {
  const folder = await mkdtemp(join(tmpdir(), "infiniteplans-assets-")); folders.push(folder);
  const dist = join(folder, "dist"); await mkdir(join(dist, "assets"), { recursive: true });
  await Bun.write(join(dist, "index.html"), "<!doctype html><title>Infinite Plans</title>");
  await Bun.write(join(dist, "assets", "app.js"), "console.log('ready')");
  await Bun.write(join(folder, "secret.txt"), "private");
  await symlink(join(folder, "secret.txt"), join(dist, "leak.txt"));
  const handler = await withFrontend(async () => Response.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } }), dist);
  const get = (path: string, init?: RequestInit) => handler(new Request(`http://localhost${path}`, init));
  expect(await (await get("/")).text()).toContain("Infinite Plans");
  expect(await (await get("/assets/app.js")).text()).toContain("ready");
  expect((await get("/assets/app.js")).headers.get("content-type")).toContain("javascript");
  const head = await get("/", { method: "HEAD" });
  expect(await head.text()).toBe(""); expect(Number(head.headers.get("content-length"))).toBeGreaterThan(0);
  expect((await get("/events/example", { headers: { Accept: "text/html" } })).status).toBe(200);
  for (const path of ["/.env", "/%2e%2e%2fsecret.txt", "/leak.txt", "/src/main.ts", "/assets/missing.js", "/%ZZ", "/%00"]) {
    expect((await get(path, { headers: { Accept: "text/html" } })).status).toBe(404);
  }
  for (const path of ["/api", "/api/missing", "/health"]) {
    const response = await get(path, { headers: { Accept: "text/html" } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "NOT_FOUND" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect((await get("/", { method: "POST" })).status).toBe(405);
});
