import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup } from "./support.ts";
cleanup();
async function fixture() {
  const app = await setup(); const owner = await app.register("owner"); const other = await app.register("other");
  const { group } = await app.instances.Grouping.createGroup({ user: owner.user, name: "MIT", description: "", policy: "OPEN" });
  return { ...app, owner, other, group };
}
test("member-only publication/discovery, owner edits, and private attendee identities", async () => {
  const { api, instances, owner, other, group } = await fixture();
  const { event } = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  expect(await api.events.details({ session: other.session, event })).toEqual({ error: "NOT_FOUND" });
  expect(await api.events.group({ session: other.session, group })).toEqual({ error: "NOT_FOUND" });
  expect(await api.events.explore({ session: other.session })).toEqual({ events: [] });
  expect(await api.events.publish({ session: other.session, group, ...fields })).toEqual({ error: "NOT_FOUND" });
  await instances.Grouping.join({ user: other.user, group });
  expect(ok(await api.events.details({ session: other.session, event })).event).toMatchObject({ event, organizerUsername: "owner", intent: null });
  expect(ok(await api.events.explore({ session: other.session })).events).toHaveLength(1);
  expect(await api.events.revise({ session: other.session, event, ...fields })).toEqual({ error: "NOT_EVENT_ORGANIZER" });
  expect(await api.events.remove({ session: other.session, event })).toEqual({ error: "NOT_EVENT_ORGANIZER" });
  expect(await api.events.attendees({ session: other.session, event })).toEqual({ error: "NOT_EVENT_ORGANIZER" });
  ok(await api.plans.mark({ session: other.session, event, intent: "NOT_GOING" }));
  expect(await api.events.attendees({ session: owner.session, event })).toEqual({ going: [], interested: [] });
  expect(ok(await api.events.details({ session: owner.session, event })).event.intent).toBeNull();
  ok(await api.plans.mark({ session: other.session, event, intent: "GOING" }));
  expect(await api.events.attendees({ session: owner.session, event })).toEqual({ going: [{ user: other.user, username: "other" }], interested: [] });
  ok(await api.events.revise({ session: owner.session, event, ...fields, title: "Changed" }));
  expect(ok(await api.events.details({ session: other.session, event })).event.title).toBe("Changed");
});
test("cancellation hides discovery, preserves saved plans, refuses changes, and permits removal", async () => {
  const { api, instances, owner, other, group } = await fixture();
  await instances.Grouping.join({ user: other.user, group });
  const { event } = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  ok(await api.plans.mark({ session: other.session, event, intent: "INTERESTED" }));
  expect(ok(await api.plans.list({ session: other.session })).events).toHaveLength(1);
  ok(await api.events.remove({ session: owner.session, event }));
  expect(await api.events.explore({ session: other.session })).toEqual({ events: [] });
  expect(await api.events.group({ session: other.session, group })).toEqual({ events: [] });
  expect(ok(await api.plans.list({ session: other.session })).events[0]).toMatchObject({ event, canceled: true, intent: "INTERESTED" });
  for (const intent of ["GOING", "NOT_GOING", "INTERESTED"] as const) expect(await api.plans.mark({ session: other.session, event, intent })).toEqual({ error: "EVENT_CANCELED" });
  expect(await api.events.revise({ session: owner.session, event, ...fields })).toEqual({ error: "EVENT_CANCELED_FOR_REVISION" });
  expect(await api.events.remove({ session: owner.session, event })).toEqual({ error: "EVENT_ALREADY_CANCELED" });
  ok(await api.plans.remove({ session: other.session, event }));
  expect(await api.plans.list({ session: other.session })).toEqual({ events: [] });
  expect(await api.plans.remove({ session: other.session, event })).toEqual({ error: "NO_MARK_TO_REMOVE" });
});
test("ordering spans groups and resolves equal dates by event identity, including past dates", async () => {
  const { api, instances, owner, group } = await fixture();
  const { group: second } = await instances.Grouping.createGroup({ user: owner.user, name: "Second", description: "", policy: "OPEN" });
  const a = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  const b = ok(await api.events.publish({ session: owner.session, group: second, ...fields }));
  const c = ok(await api.events.publish({ session: owner.session, group, ...fields, start: "1999-01-01T00:00:00.000Z" }));
  for (const { event } of [a, b, c]) ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  const expected = [c.event, ...[a.event, b.event].sort()];
  expect(ok(await api.events.explore({ session: owner.session })).events.map(row => row.event)).toEqual(expected);
  expect(ok(await api.plans.list({ session: owner.session })).events.map(row => row.event)).toEqual(expected);
});
test("corrupt organizer/attendee references fail rather than dropping rows", async () => {
  const { api, instances, database, owner, other, group } = await fixture();
  await instances.Grouping.join({ user: other.user, group });
  const { event } = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  ok(await api.plans.mark({ session: other.session, event, intent: "GOING" }));
  await database.collection("registering.users").deleteOne({ _id: other.user as never });
  expect(await api.events.attendees({ session: owner.session, event })).toMatchObject({ error: "INTERNAL_ERROR" });
  ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  await database.collection("registering.users").deleteOne({ _id: owner.user as never });
  expect(await api.events.details({ session: owner.session, event })).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(await api.events.explore({ session: owner.session })).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(await api.plans.list({ session: owner.session })).toMatchObject({ error: "INTERNAL_ERROR" });
});
test("saved missing event fails but inaccessible entries are excluded", async () => {
  const { api, instances, database, owner, other, group } = await fixture();
  await instances.Grouping.join({ user: other.user, group });
  const { event } = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  ok(await api.plans.mark({ session: other.session, event, intent: "GOING" }));
  await instances.Grouping.leave({ user: other.user, group }); // Corrupt fixture bypass, not a production admission path.
  expect(await api.plans.list({ session: other.session })).toEqual({ events: [] });
  await instances.Grouping.join({ user: other.user, group });
  await database.collection("eventpublishing.events").deleteOne({ _id: event as never });
  expect(await api.plans.list({ session: other.session })).toMatchObject({ error: "INTERNAL_ERROR" });
});
