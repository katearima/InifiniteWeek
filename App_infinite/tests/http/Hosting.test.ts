import { afterEach, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import { createHttpApplication } from "../../src/host/http.ts";
import { applicationConceptSet } from "../../src/concepts.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { InfinitePlansWireHttp } from "../../generated/wire.ts";
const hosts: ReturnType<typeof createHttpApplication>[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(async () => {
  for (const host of hosts.splice(0)) await host.beginDrain();
  for (const server of servers.splice(0)) await server.stop(true);
  await cleanupDatabases();
});
import { routes } from "../compositions/expected.ts";
const origin = "http://localhost:3000";
const fields = { title: "Study", description: "MIT", start: "2000-01-01T10:00:00.000Z", end: "2000-01-01T11:00:00.000Z", location: "Library" };
async function setup(configure?: (instances: ReturnType<typeof applicationConceptSet.implementations>) => void, requestTimeoutMs?: number) {
  const database = await testDatabase();
  const instances = applicationConceptSet.implementations("mongo", { database }); configure?.(instances);
  const host = createHttpApplication({ database }, { publicOrigin: origin, instances, requestTimeoutMs }); hosts.push(host);
  const post = (path: string, body: unknown = {}, cookie = "", extra: HeadersInit = {}, signal?: AbortSignal) => host.fetch(new Request(`${origin}/api${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie, ...extra }, body: JSON.stringify(body), signal,
  }));
  const signup = async (username: string) => {
    const response = await post("/auth/register", { username, password: "correct-password" });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    const value = await response.json() as { user: string };
    expect(Object.keys(value)).toEqual(["user"]);
    return { cookie, user: value.user };
  };
  return { host, database, instances, post, signup };
}
test("HTTP signup/login/logout use secure cookies and omit issued secrets", async () => {
  const { post } = await setup();
  const response = await post("/auth/register", { username: "maya", password: "correct-password" });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie")!;
  for (const attribute of ["__Host-infiniteplans-session=", "HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Expires="]) expect(setCookie).toContain(attribute);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json(); expect(Object.keys(body)).toEqual(["user"]);
  const cookie = setCookie.split(";")[0]!;
  expect(await (await post("/auth/me", {}, cookie)).json()).toEqual({ user: body.user, username: "maya" });
  expect((await post("/auth/register", { username: "maya", password: "correct-password" })).status).toBe(409);
  for (const username of ["maya", "unknown"]) {
    const denied = await post("/auth/login", { username, password: "incorrect-password" });
    expect(denied.status).toBe(401); expect(await denied.json()).toEqual({ error: "UNAUTHORIZED" });
  }
  const login = await post("/auth/login", { username: "maya", password: "correct-password" });
  expect(login.status).toBe(200); expect(Object.keys(await login.json())).toEqual(["user"]);
  const logout = await post("/auth/logout", {}, cookie);
  expect(logout.status).toBe(200); expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  const me = await post("/auth/me", {}, cookie); expect(me.status).toBe(401);
  expect(me.headers.get("set-cookie")).toContain("Max-Age=0");
});
test("cookie identity wins over body credentials; hostile origins and user overrides are rejected", async () => {
  const { post, signup } = await setup(); const maya = await signup("maya"), other = await signup("other");
  const token = decodeURIComponent(other.cookie.split("=")[1]!);
  expect(await (await post("/auth/me", { session: token }, maya.cookie)).json()).toEqual({ user: maya.user, username: "maya" });
  expect((await post("/auth/me", { session: token })).status).toBe(401);
  expect((await post("/auth/me", { user: other.user }, maya.cookie)).status).toBe(400);
  for (const path of ["/auth/me", "/auth/logout", "/auth/login", "/auth/register"]) {
    const response = await post(path, { username: "newuser", password: "correct-password" }, maya.cookie, { Origin: "https://hostile.example" });
    expect(response.status).toBe(403); expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  }
  expect((await post("/auth/me", {}, maya.cookie)).status).toBe(200);
});
test("HTTP group/event journey enforces membership, dates, ownership, and cancellation", async () => {
  const { post, signup } = await setup(); const owner = await signup("owner"), other = await signup("other");
  const { group } = await (await post("/groups/create", { name: "MIT", description: "", policy: "APPROVAL" }, owner.cookie)).json();
  const published = await post("/events/publish", { group, ...fields }, owner.cookie);
  expect(published.status).toBe(200); const { event } = await published.json();
  for (const id of [event, "unknown"]) {
    const response = await post("/events/details", { event: id }, other.cookie);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "NOT_FOUND" });
  }
  expect((await post("/groups/join", { group }, other.cookie)).status).toBe(200);
  expect((await post("/groups/approve", { group, requester: other.user }, owner.cookie)).status).toBe(200);
  const details = await post("/events/details", { event }, other.cookie);
  expect((await details.json()).event.start).toBe(fields.start);
  expect((await post("/events/revise", { event, ...fields }, other.cookie)).status).toBe(403);
  expect((await post("/events/publish", { group, ...fields, start: fields.end, end: fields.start }, owner.cookie)).status).toBe(400);
  expect((await post("/events/publish", { group, ...fields, start: "tomorrow" }, owner.cookie)).status).toBe(400);
  expect((await post("/plans/mark", { event, intent: "GOING" }, other.cookie)).status).toBe(200);
  expect((await post("/events/remove", { event }, owner.cookie)).status).toBe(200);
  expect((await post("/plans/mark", { event, intent: "INTERESTED" }, other.cookie)).status).toBe(409);
  expect((await (await post("/plans/list", {}, other.cookie)).json()).events[0]).toMatchObject({ event, canceled: true });
  expect((await post("/groups/leave", { group }, other.cookie)).status).toBe(200);
  expect(await (await post("/plans/list", {}, other.cookie)).json()).toEqual({ events: [] });
});
test("expired cookies clear and unexpected action faults remain opaque", async () => {
  let fail = false;
  const { database, signup, post } = await setup(instances => {
    const original = instances.Grouping.createGroup.bind(instances.Grouping);
    instances.Grouping.createGroup = async function createGroup(args) { if (fail) throw new Error("private database credential"); return original(args); };
  });
  const account = await signup("maya"); fail = true;
  const response = await post("/groups/create", { name: "MIT", description: "", policy: "OPEN" }, account.cookie);
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "INTERNAL_ERROR" });
  expect(response.headers.get("set-cookie")).toBeNull();
  await database.collection("sessioning.sessions").updateMany({}, { $set: { expiresAt: new Date(0) } });
  const expired = await post("/auth/me", {}, account.cookie);
  expect(expired.status).toBe(401); expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
});
test("health and request framing: unavailable database, malformed JSON, limits and methods", async () => {
  const { host } = await setup();
  const health = await host.fetch(new Request(`${origin}/health`)); expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  expect((await host.fetch(new Request(`${origin}/api/auth/me`))).status).toBe(400);
  expect((await host.fetch(new Request(`${origin}/api/unknown`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }))).status).toBe(404);
  expect((await host.fetch(new Request(`${origin}/api/auth/me`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status).toBe(400);
  expect((await host.fetch(new Request(`${origin}/api/auth/me`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ long: "x".repeat(70_000) }) }))).status).toBe(400);
  const unreachable = new MongoClient("mongodb://127.0.0.1:1", { serverSelectionTimeoutMS: 50 });
  const unhealthy = createHttpApplication({ database: unreachable.db("health") }, { publicOrigin: origin });
  try { expect((await unhealthy.fetch(new Request(`${origin}/health`))).status).toBe(503); }
  finally { await unhealthy.beginDrain(); await unreachable.close(); }
});
test("real Bun listener serves the generated typed HTTP client", async () => {
  const { host } = await setup();
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: host.fetch }); servers.push(server);
  const api = createHttpClient<InfinitePlansWireHttp>({ baseUrl: `${server.url}api` });
  expect(await api.auth.me({})).toEqual({ error: "UNAUTHORIZED" });
  const result = await api.auth.register({ username: "network", password: "correct-password" });
  expect(result).toHaveProperty("user"); expect(result).not.toHaveProperty("session");
  expect((await fetch(new URL("health", server.url))).status).toBe(200);
});

function latch() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
test("HTTP timeout preserves accepted work and serializes subsequent cancellation", async () => {
  const entered = latch(), gate = latch();
  const { post, signup, instances } = await setup(instances => {
    const originalMark = instances.EventMarking.mark.bind(instances.EventMarking);
    instances.EventMarking.mark = async function mark(args) { entered.release(); await gate.promise; return originalMark(args); };
  }, 1000);
  const owner = await signup("owner");
  const { group } = await (await post("/groups/create", { name: "MIT", description: "", policy: "OPEN" }, owner.cookie)).json();
  const { event } = await (await post("/events/publish", { group, ...fields }, owner.cookie)).json();
  const marking = post("/plans/mark", { event, intent: "GOING" }, owner.cookie);
  await entered.promise;
  try {
    expect((await marking).status).toBe(504);
    const canceling = post("/events/remove", { event }, owner.cookie);
    expect(await instances.EventPublishing._getEventDetails({ event })).toMatchObject([{ canceled: false }]);
    gate.release(); expect((await canceling).status).toBe(200);
    const saved = await (await post("/plans/list", {}, owner.cookie)).json();
    expect(saved.events).toMatchObject([{ event, canceled: true, intent: "GOING" }]);
  } finally { gate.release(); }
});
test("HTTP abort and drain keep accepted work exclusive and discard queued aborted work", async () => {
  const entered = latch(), gate = latch(); let hold = false;
  const { host, post, signup } = await setup(instances => {
    const original = instances.Sessioning.use.bind(instances.Sessioning);
    instances.Sessioning.use = async function use(args) { if (hold) { entered.release(); await gate.promise; } return original(args); };
  });
  const owner = await signup("owner"); hold = true;
  const active = new AbortController(), queued = new AbortController();
  const me = post("/auth/me", {}, owner.cookie, {}, active.signal); await entered.promise;
  const logout = post("/auth/logout", {}, owner.cookie, {}, queued.signal);
  active.abort(); queued.abort();
  expect((await me).status).toBe(499); expect((await logout).status).toBe(499);
  const read = post("/auth/me", {}, owner.cookie);
  let drained = false; const draining = host.beginDrain().then(() => { drained = true; });
  try {
    expect((await post("/auth/me", {}, owner.cookie)).status).toBe(503);
    expect((await host.fetch(new Request(`${origin}/health`))).status).toBe(503);
    expect(drained).toBe(false); hold = false; gate.release();
    expect((await read).status).toBe(200); await draining; expect(drained).toBe(true);
  } finally { hold = false; gate.release(); }
});

test("all protected HTTP routes bind absent credentials and reject acting-user overrides", async () => {
  const { post } = await setup();
  for (const [path, fields] of Object.entries(routes)) {
    const input = Object.fromEntries(fields.map(key => [key, key === "start" ? "2000-01-01T00:00:00.000Z" : key === "end" ? "2000-01-02T00:00:00.000Z" : key === "policy" ? "OPEN" : key === "intent" ? "GOING" : "example-value"]));
    expect((await post(path, { ...input, user: "forged" })).status).toBe(400);
    if (!["/auth/login", "/auth/register"].includes(path)) {
      const result = await post(path, input);
      expect(result.status).toBe(401); expect(await result.json()).toEqual({ error: "UNAUTHORIZED" });
    }
  }
});
// The browser contract must never require or return transport-owned credentials.
type Assert<T extends true> = T;
type NoCookieInputs = Assert<{
  [P in keyof InfinitePlansWireHttp]: InfinitePlansWireHttp[P]["input"] extends Record<string, never> ? true : "session" extends keyof InfinitePlansWireHttp[P]["input"] ? false : true
}[keyof InfinitePlansWireHttp]>;
type NoIssuedSecrets = Assert<Extract<keyof InfinitePlansWireHttp["/auth/register"]["output"], "session" | "expiresAt"> extends never ? true : false>;

test("main entrypoint starts HTTP and exits cleanly on SIGTERM", async () => {
  const database = await testDatabase();
  const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = reservation.port!; await reservation.stop(true);
  const mongoUrl = new URL(process.env.MONGODB_TEST_URL!); mongoUrl.pathname = `/${database.databaseName}`;
  const child = Bun.spawn([process.execPath, "src/main.ts"], {
    cwd: new URL("../..", import.meta.url).pathname,
    env: { ...process.env, MONGODB_URL: mongoUrl.toString(), HOST: "127.0.0.1", PORT: String(port), PUBLIC_ORIGIN: `http://localhost:${port}` },
    stdout: "pipe", stderr: "pipe",
  });
  try {
    const reader = child.stdout.getReader(); const first = await reader.read(); reader.releaseLock();
    expect(new TextDecoder().decode(first.value)).toContain("Infinite Plans API listening");
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    child.kill("SIGTERM"); expect(await child.exited).toBe(0);
  } finally { if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; } }
}, 10_000);

test("HTTP group deletion enforces membership and last-member authority", async () => {
  const { post, signup } = await setup();
  const owner = await signup("owner"), other = await signup("other");
  const { group } = await (await post("/groups/create", { name: "Delete me", description: "", policy: "OPEN" }, owner.cookie)).json();
  expect((await post("/groups/delete", { group })).status).toBe(401);
  expect((await post("/groups/delete", { group }, other.cookie)).status).toBe(403);
  await post("/groups/join", { group }, other.cookie);
  expect((await post("/groups/delete", { group }, owner.cookie)).status).toBe(409);
  await post("/groups/leave", { group }, other.cookie);
  expect((await post("/groups/delete", { group }, owner.cookie)).status).toBe(200);
  expect((await post("/groups/delete", { group }, owner.cookie)).status).toBe(404);
});

test("members receive the latest time-change notice in details, discovery, and saved plans", async () => {
  const { post, signup } = await setup();
  const owner = await signup("chani"), guest = await signup("keti");
  const { group } = await (await post("/groups/create", { name: "Career", description: "", policy: "OPEN" }, owner.cookie)).json();
  await post("/groups/join", { group }, guest.cookie);
  const { event } = await (await post("/events/publish", { group, ...fields }, owner.cookie)).json();
  await post("/plans/mark", { event, intent: "GOING" }, guest.cookie);
  expect((await (await post("/events/details", { event }, guest.cookie)).json()).event.timeChanged).toBe(false);
  const shifted = { ...fields, start: "2000-01-01T11:00:00.000Z", end: "2000-01-01T12:00:00.000Z" };
  expect((await post("/events/revise", { event, ...shifted }, owner.cookie)).status).toBe(200);
  const expected = { event, timeChanged: true, previousStart: fields.start, previousEnd: fields.end, start: shifted.start, end: shifted.end };
  expect((await (await post("/events/details", { event }, guest.cookie)).json()).event).toMatchObject(expected);
  for (const path of ["/events/explore", "/events/group", "/plans/list"]) {
    const response = await post(path, path === "/events/group" ? { group } : {}, guest.cookie);
    expect(response.status).toBe(200);
    expect((await response.json()).events[0]).toMatchObject(expected);
  }
  await post("/events/revise", { event, ...shifted, title: "New title" }, owner.cookie);
  expect((await (await post("/plans/list", {}, guest.cookie)).json()).events[0]).toMatchObject(expected);
  await post("/events/remove", { event }, owner.cookie);
  expect((await (await post("/plans/list", {}, guest.cookie)).json()).events[0]).toMatchObject({ ...expected, canceled: true });
});
