import { expect, test } from "bun:test";
import { cleanup, ok, setup } from "./support.ts";
cleanup();
test("empty database signup/login/me/logout and invalid credentials", async () => {
  const { api, register } = await setup();
  expect(await api.auth.me({})).toEqual({ error: "NOT_SIGNED_IN" });
  expect(await api.auth.register({ username: "maya", password: "short" })).toEqual({ error: "INVALID_PASSWORD" });
  const maya = await register("maya");
  expect(await api.auth.me({ session: maya.session })).toEqual({ user: maya.user, username: "maya" });
  expect(await api.auth.register({ username: "maya", password: "another-pass" })).toEqual({ error: "USERNAME_TAKEN" });
  expect(await api.auth.login({ username: "maya", password: "wrong-pass" })).toEqual({ error: "INVALID_CREDENTIALS" });
  expect(await api.auth.login({ username: "unknown", password: "wrong-pass" })).toEqual({ error: "INVALID_CREDENTIALS" });
  const login = ok(await api.auth.login({ username: "maya", password: "correct-password" }));
  expect(await api.auth.logout({ session: maya.session })).toEqual({});
  expect(await api.auth.logout({ session: maya.session })).toEqual({ error: "NOT_SIGNED_IN" });
  expect(await api.auth.me({ session: login.session })).toEqual({ user: maya.user, username: "maya" });
});
test("expired sessions and unknown registered subjects are refused", async () => {
  const { api, database, instances, register } = await setup();
  const maya = await register("maya");
  await database.collection("sessioning.sessions").updateOne({ _id: maya.session as never }, { $set: { expiresAt: new Date(0) } });
  expect(await api.auth.me({ session: maya.session })).toEqual({ error: "NOT_SIGNED_IN" });
  const { session } = await instances.Sessioning.start({ subject: "missing" as typeof maya.user });
  expect(await api.auth.me({ session })).toEqual({ error: "NOT_SIGNED_IN" });
});
test("malformed and impersonation inputs run no session action", async () => {
  let calls = 0;
  const { invoker } = await setup(instances => { const originalUse = instances.Sessioning.use.bind(instances.Sessioning); instances.Sessioning.use = async function use(args) { calls++; return originalUse(args); }; });
  for (const input of [{ session: 42 }, { session: "x", user: "forged" }, { session: "x", other: true }]) {
    expect(await invoker.invoke("/auth/me", input)).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  }
  expect(calls).toBe(0);
});
test("password-setup failure reserves username; session-start failure recovers through login", async () => {
  let failPassword = true, failSession = false;
  const { api } = await setup(instances => {
    const originalSet = instances.Authenticating.set.bind(instances.Authenticating);
    instances.Authenticating.set = async function set(args) { if (failPassword) throw new Error("injected password fault"); return originalSet(args); };
    const originalStart = instances.Sessioning.start.bind(instances.Sessioning);
    instances.Sessioning.start = async function start(args) { if (failSession) throw new Error("injected session fault"); return originalStart(args); };
  });
  expect(await api.auth.register({ username: "broken", password: "correct-password" })).toMatchObject({ error: "INTERNAL_ERROR" });
  failPassword = false;
  expect(await api.auth.register({ username: "broken", password: "correct-password" })).toEqual({ error: "USERNAME_TAKEN" });
  expect(await api.auth.login({ username: "broken", password: "correct-password" })).toEqual({ error: "INVALID_CREDENTIALS" });
  failSession = true;
  expect(await api.auth.register({ username: "recover", password: "correct-password" })).toMatchObject({ error: "INTERNAL_ERROR" });
  failSession = false;
  expect(ok(await api.auth.login({ username: "recover", password: "correct-password" })).session).toBeString();
});

test("audit output redacts passwords and session credentials", async () => {
  const entries: unknown[] = [];
  const app = await setup(undefined, { logSink: { append(entry) { entries.push(entry); } } });
  const account = await app.register("private");
  ok(await app.api.auth.me({ session: account.session }));
  await app.whenIdle();
  const audit = JSON.stringify(entries);
  expect(entries.length).toBeGreaterThan(0);
  expect(audit).not.toContain("correct-password");
  expect(audit).not.toContain(account.session);
  expect(audit).not.toContain("$argon2id$");
});
