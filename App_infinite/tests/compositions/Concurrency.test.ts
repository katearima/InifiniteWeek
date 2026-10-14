import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup } from "./support.ts";
cleanup();
function latch() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
test("accepted timed-out marking finishes before cancellation and queued reads", async () => {
  const entered = latch(), gate = latch();
  let hold = false;
  const app = await setup(instances => {
    const original = instances.EventMarking.mark.bind(instances.EventMarking);
    instances.EventMarking.mark = async function mark(args) { if (hold) { entered.release(); await gate.promise; } return original(args); };
  });
  const owner = await app.register("owner");
  const { group } = await app.instances.Grouping.createGroup({ user: owner.user, name: "MIT", description: "", policy: "OPEN" });
  const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
  hold = true;
  const mark = app.api.plans.mark({ session: owner.session, event, intent: "GOING" }, { timeoutMs: 100 });
  await entered.promise;
  const cancel = app.api.events.remove({ session: owner.session, event });
  const read = app.api.plans.list({ session: owner.session });
  expect(await mark).toMatchObject({ error: "TIMED_OUT" });
  expect(await app.instances.EventPublishing._getEventDetails({ event })).toMatchObject([{ canceled: false }]);
  gate.release(); ok(await cancel);
  expect(ok(await read).events).toMatchObject([{ event, intent: "GOING", canceled: true }]);
  expect(await app.api.plans.mark({ session: owner.session, event, intent: "INTERESTED" })).toEqual({ error: "EVENT_CANCELED" });
});
test("active abort preserves accepted work; queued expiry never logs out; drain waits", async () => {
  const entered = latch(), gate = latch(); let hold = false;
  const app = await setup(instances => {
    const original = instances.Sessioning.use.bind(instances.Sessioning);
    instances.Sessioning.use = async function use(args) { if (hold) { entered.release(); await gate.promise; } return original(args); };
  });
  const owner = await app.register("owner"); hold = true;
  const controller = new AbortController();
  const me = app.api.auth.me({ session: owner.session }, { signal: controller.signal });
  await entered.promise; controller.abort();
  expect(await me).toMatchObject({ error: "ABORTED" });
  expect(await app.api.auth.logout({ session: owner.session }, { timeoutMs: 20 })).toMatchObject({ error: "TIMED_OUT" });
  const read = app.api.auth.me({ session: owner.session });
  let drained = false;
  const draining = app.beginDrain().then(() => { drained = true; });
  expect(await app.api.auth.me({ session: owner.session })).toMatchObject({ error: "UNAVAILABLE" });
  expect(drained).toBe(false); hold = false; gate.release();
  expect(await read).toEqual({ user: owner.user, username: "owner" });
  await draining; expect(drained).toBe(true);
});
