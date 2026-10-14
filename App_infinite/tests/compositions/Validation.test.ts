import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup } from "./support.ts";
cleanup();
test("malformed event dates and enums run no concepts; valid reverse dates reach the owner", async () => {
  let calls = 0;
  const app = await setup(instances => {
    const original = instances.Sessioning.use.bind(instances.Sessioning);
    instances.Sessioning.use = async function use(args) { calls++; return original(args); };
  });
  const owner = await app.register("owner");
  const { group } = await app.instances.Grouping.createGroup({ user: owner.user, name: "MIT", description: "", policy: "OPEN" });
  const base = { session: owner.session, group, ...fields };
  for (const start of ["tomorrow", "2000-02-30T00:00:00.000Z", "2000-01-01", 0, null, new Date(NaN)]) {
    expect(await app.invoker.invoke("/events/publish", { ...base, start })).toMatchObject({ error: { code: "INVALID_INPUT" } });
  }
  expect(await app.invoker.invoke("/events/publish", { ...base, user: owner.user })).toMatchObject({ error: { code: "INVALID_INPUT" } });
  expect(await app.invoker.invoke("/plans/mark", { session: owner.session, event: "missing", intent: "MAYBE" })).toMatchObject({ error: { code: "INVALID_INPUT" } });
  expect(calls).toBe(0);
  expect(await app.api.events.publish({ ...base, start: base.end, end: base.start })).toEqual({ error: "INVALID_PUBLICATION_TIME" });
  expect(calls).toBe(1);
  const native = await app.invoker.invoke("/events/publish", { ...base, start: new Date(base.start), end: new Date(base.end) });
  expect(native.ok).toBe(true);
  const { event } = ok(await app.api.events.publish(base));
  expect(ok(await app.api.events.details({ session: owner.session, event })).event.start).toBe(fields.start);
});
test("unknown and inaccessible events share refusals for all protected operations", async () => {
  const app = await setup(); const owner = await app.register("owner"), stranger = await app.register("stranger");
  const { group } = await app.instances.Grouping.createGroup({ user: owner.user, name: "MIT", description: "", policy: "OPEN" });
  const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
  for (const id of [event, "missing" as typeof event]) {
    const input = { session: stranger.session, event: id };
    expect(await app.api.events.details(input)).toEqual({ error: "NOT_FOUND" });
    expect(await app.api.events.attendees(input)).toEqual({ error: "NOT_FOUND" });
    expect(await app.api.events.remove(input)).toEqual({ error: "NOT_FOUND" });
    expect(await app.api.events.revise({ ...input, ...fields })).toEqual({ error: "NOT_FOUND" });
    expect(await app.api.plans.mark({ ...input, intent: "GOING" })).toEqual({ error: "NOT_FOUND" });
    expect(await app.api.plans.remove(input)).toEqual({ error: "NOT_FOUND" });
  }
});
