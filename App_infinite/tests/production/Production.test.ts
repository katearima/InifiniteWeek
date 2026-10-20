import { afterAll, expect, test } from "bun:test";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { samplePicture } from "../support/picture.ts";

afterAll(cleanupDatabases);
test("root build/start serve the production app and preserve accounts, plans and pictures across restart", async () => {
  const repository = new URL("../../../", import.meta.url).pathname;
  const build = Bun.spawn([process.execPath, "run", "build"], { cwd: repository, stdout: "pipe", stderr: "pipe" });
  const [code, output, errors] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()]);
  if (code !== 0) throw new Error(`Production build failed: ${output}\n${errors}`);
  const database = await testDatabase();
  const mongoUrl = new URL(process.env.MONGODB_TEST_URL!); mongoUrl.pathname = `/${database.databaseName}`;
  const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = reservation.port!; await reservation.stop(true);
  const origin = `http://localhost:${port}`;
  const start = async () => {
    const child = Bun.spawn([process.execPath, "run", "start"], {
      cwd: repository,
      env: { ...process.env, NODE_ENV: "production", MONGODB_URL: mongoUrl.toString(), HOST: "0.0.0.0", PORT: String(port), PUBLIC_ORIGIN: origin },
      stdout: "ignore", stderr: "pipe",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Production server exited: ${await new Response(child.stderr).text()}`);
      try { if ((await fetch(`${origin}/health`)).ok) return child; } catch {}
      await Bun.sleep(50);
    }
    child.kill("SIGKILL"); await child.exited; throw new Error("Production server did not become healthy");
  };
  const stop = async (child: Awaited<ReturnType<typeof start>>) => {
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    try { expect(await child.exited).toBe(0); } finally { clearTimeout(timer); }
  };
  let child = await start();
  try {
    const html = await (await fetch(origin)).text();
    expect(html).toContain('id="app"'); expect(html).not.toContain('src="./app.ts"');
    const script = html.match(/src="([^"]+\.js)"/)?.[1]; expect(script).toBeDefined();
    const asset = await fetch(new URL(script!, origin)); expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect((await fetch(`${origin}/.env`)).status).toBe(404);
    expect((await fetch(`${origin}/api/unknown`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(404);
    let cookie = "";
    const post = async (path: string, body: unknown = {}) => {
      const response = await fetch(`${origin}/api${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify(body) });
      if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}: ${await response.text()}`);
      const issued = response.headers.get("set-cookie"); if (issued) cookie = issued.split(";")[0]!;
      return response.json();
    };
    await post("/auth/register", { username: "production", password: "preview-password" });
    const { group } = await post("/groups/create", { name: "Production check", description: "", policy: "OPEN" });
    const { event } = await post("/events/publish", { group, title: "Production event", description: "", start: "2000-01-01T10:00:00.000Z", end: "2000-01-01T11:00:00.000Z", location: "MIT" });
    await post("/events/set-picture", { event, picture: samplePicture });
    await post("/plans/mark", { event, intent: "GOING" });
    await stop(child);
    child = await start();
    expect((await post("/auth/me")).username).toBe("production");
    expect((await post("/plans/list")).events[0]).toMatchObject({ event, title: "Production event" });
    expect(await post("/events/picture", { event })).toEqual({ picture: samplePicture });
    await post("/auth/logout");
    await post("/auth/login", { username: "production", password: "preview-password" });
  } finally { if (child.exitCode === null) await stop(child); }
}, 30_000);
