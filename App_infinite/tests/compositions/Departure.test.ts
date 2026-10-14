import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup } from "./support.ts";
cleanup();
test("cleanup failure retains membership; departure failure retains cleared marks; lost response is retryable", async () => {
  let fault: "clear" | "leave" | "after-leave" | null = null;
  const app = await setup(instances => {
    const clear = instances.EventMarking.clearMarks.bind(instances.EventMarking);
    instances.EventMarking.clearMarks = async function clearMarks(args) { if (fault === "clear") throw new Error("injected cleanup failure"); return clear(args); };
    const original = instances.Grouping.leave.bind(instances.Grouping);
    instances.Grouping.leave = async function leave(args) { if (fault === "leave") throw new Error("injected departure failure"); const result = await original(args); if (fault === "after-leave") throw new Error("lost committed response"); return result; };
  });
  const owner = await app.register("owner"), other = await app.register("other");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "MIT", description: "", policy: "OPEN" }));
  ok(await app.api.groups.join({ session: other.session, group }));
  const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
  ok(await app.api.plans.mark({ session: other.session, event, intent: "GOING" }));
  const leave = () => app.api.groups.leave({ session: other.session, group });
  const details = async () => ok(await app.api.groups.details({ session: other.session, group })).group;
  fault = "clear";
  expect(await leave()).toMatchObject({ error: "INTERNAL_ERROR" });
  expect((await details()).member).toBe(true);
  expect(ok(await app.api.plans.list({ session: other.session })).events).toHaveLength(1);
  fault = "leave";
  expect(await leave()).toMatchObject({ error: "INTERNAL_ERROR" });
  expect((await details()).member).toBe(true);
  expect(await app.api.plans.list({ session: other.session })).toEqual({ events: [] });
  fault = null; ok(await leave());
  expect((await details()).member).toBe(false);
  ok(await app.api.groups.join({ session: other.session, group }));
  fault = "after-leave";
  expect(await leave()).toMatchObject({ error: "INTERNAL_ERROR" });
  expect((await details()).member).toBe(false);
  fault = null;
  expect(await leave()).toEqual({ error: "LEAVE_NOT_MEMBER" });
});
function latch() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
test("publish accepted first commits before departure evaluates organized events", async () => {
  const entered = latch(), gate = latch();
  const app = await setup(instances => {
    const original = instances.EventPublishing.publish.bind(instances.EventPublishing);
    instances.EventPublishing.publish = async function publish(args) { entered.release(); await gate.promise; return original(args); };
  });
  const owner = await app.register("owner");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "MIT", description: "", policy: "OPEN" }));
  const publishing = app.api.events.publish({ session: owner.session, group, ...fields });
  await entered.promise;
  const leaving = app.api.groups.leave({ session: owner.session, group });
  const reading = app.api.events.group({ session: owner.session, group });
  gate.release(); const { event } = ok(await publishing);
  expect(await leaving).toEqual({ error: "ACTIVE_EVENTS_PREVENT_LEAVING" });
  expect(ok(await reading).events.map(row => row.event)).toEqual([event]);
});
test("departure accepted first blocks later publication after clearing and leaving", async () => {
  const entered = latch(), gate = latch();
  const app = await setup(instances => {
    const original = instances.EventMarking.clearMarks.bind(instances.EventMarking);
    instances.EventMarking.clearMarks = async function clearMarks(args) { entered.release(); await gate.promise; return original(args); };
  });
  const owner = await app.register("owner");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "MIT", description: "", policy: "OPEN" }));
  const leaving = app.api.groups.leave({ session: owner.session, group });
  await entered.promise;
  const publishing = app.api.events.publish({ session: owner.session, group, ...fields });
  gate.release(); ok(await leaving);
  expect(await publishing).toEqual({ error: "NOT_FOUND" });
  expect(await app.api.events.explore({ session: owner.session })).toEqual({ events: [] });
});
