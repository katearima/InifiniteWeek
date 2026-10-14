import { afterEach, expect, test } from "bun:test";
import * as E from "../../src/concepts/EventPublishing/EventPublishing.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { expectOneWinner } from "../support/reusable/race.ts";
const details = { title: "Study", description: "Together", start: new Date("2000-01-01T10:00:00Z"), end: new Date("2000-01-01T11:00:00Z"), location: "MIT" };
async function setup() {
  const db = await testDatabase(); const c = new E.EventPublishingConcept<string, string>(db);
  const { event } = await c.publish({ ...details, organizer: "owner", group: "group" });
  return { db, c, event };
}
test("publication and revision preserve identity, group, organizer; cancellation retains details", async () => {
  const { c, db, event } = await setup();
  await c.revise({ ...details, title: "Updated", user: "owner", event });
  expect(await c._getEventDetails({ event })).toEqual([{ ...details, title: "Updated", organizer: "owner", group: "group", canceled: false, timeChanged: false, previousStart: details.start, previousEnd: details.end }]);
  await c.remove({ user: "owner", event });
  expect(await new E.EventPublishingConcept<string, string>(db)._getEventDetails({ event })).toEqual([{ ...details, title: "Updated", organizer: "owner", group: "group", canceled: true, timeChanged: false, previousStart: details.start, previousEnd: details.end }]);
  expect(await c._getEventsByGroup({ group: "group" })).toEqual([{ event }]);
  expect(await c._getEventsByOrganizer({ organizer: "owner" })).toEqual([{ event }]);
  await expect(c.remove({ user: "owner", event })).rejects.toThrow(E.EventAlreadyCanceled);
  await expect(c.revise({ ...details, user: "owner", event })).rejects.toThrow(E.EventCanceledForRevision);
});
test("refusal precedence and refused writes leave events unchanged", async () => {
  const { c, db, event } = await setup(); const missing = "missing" as E.Event;
  const before = await db.collection("eventpublishing.events").find().toArray();
  await expect(c.revise({ ...details, user: "other", event: missing })).rejects.toThrow(E.EventNotFoundForRevision);
  await expect(c.remove({ user: "other", event: missing })).rejects.toThrow(E.EventNotFoundForRemoval);
  await expect(c.revise({ ...details, start: details.end, user: "other", event })).rejects.toThrow(E.NotEventOrganizer);
  await expect(c.remove({ user: "other", event })).rejects.toThrow(E.NotEventOrganizerForRemoval);
  for (const start of [details.end, new Date("invalid"), new Date("2100-01-01")]) {
    await expect(c.publish({ ...details, start, organizer: "owner", group: "group" })).rejects.toThrow(E.InvalidPublicationTime);
    await expect(c.revise({ ...details, start, user: "owner", event })).rejects.toThrow(E.InvalidRevisionTime);
  }
  expect(await db.collection("eventpublishing.events").find().toArray()).toEqual(before);
  expect(await c._getEventDetails({ event: missing })).toEqual([]);
  expect(await c._getEventsByOrganizer({ organizer: "missing" })).toEqual([]);
  expect(await c._getEventsByGroup({ group: "missing" })).toEqual([]);
  await c.remove({ user: "owner", event });
  await expect(c.revise({ ...details, user: "other", event })).rejects.toThrow(E.NotEventOrganizer);
  await expect(c.remove({ user: "other", event })).rejects.toThrow(E.NotEventOrganizerForRemoval);
  await expect(c.revise({ ...details, start: details.end, user: "owner", event })).rejects.toThrow(E.EventCanceledForRevision);
});
test("past dates remain visible and query order is start then identity", async () => {
  const { c, event } = await setup();
  const { event: same } = await c.publish({ ...details, organizer: "owner", group: "group" });
  const { event: earlier } = await c.publish({ ...details, start: new Date("1999-01-01"), organizer: "owner", group: "group" });
  const expected = [earlier, ...[event, same].sort()].map(event => ({ event }));
  expect(await c._getEventsByGroup({ group: "group" })).toEqual(expected);
  expect(await c._getEventsByOrganizer({ organizer: "owner" })).toEqual(expected);
});
test("competing cancellations have one winner; revision cannot resurrect cancellation", async () => {
  const { c, db, event } = await setup(); const other = new E.EventPublishingConcept<string, string>(db);
  await expectOneWinner([c.remove({ user: "owner", event }), other.remove({ user: "owner", event })], E.EventAlreadyCanceled);
  const { event: next } = await c.publish({ ...details, organizer: "owner", group: "group" });
  const outcomes = await Promise.allSettled([c.revise({ ...details, title: "Changed", user: "owner", event: next }), other.remove({ user: "owner", event: next })]);
  expect(outcomes[1]?.status).toBe("fulfilled");
  if (outcomes[0]?.status === "rejected") expect(outcomes[0].reason).toBeInstanceOf(E.EventCanceledForRevision);
  expect((await c._getEventDetails({ event: next }))[0]?.canceled).toBe(true);
});

// Register cleanup in each test file; Bun scopes imported hooks to their first file.
afterEach(cleanupDatabases);

test("event collection is one ordered array including canceled events and empty groups", async () => {
  const { c, event } = await setup();
  const { event: earlier } = await c.publish({ ...details, start: new Date("1999-01-01"), organizer: "owner", group: "group" });
  await c.remove({ user: "owner", event });
  expect(await c._getEventCollection({ group: "group" })).toEqual({ events: [earlier, event] });
  expect(await c._getEventCollection({ group: "missing" })).toEqual({ events: [] });
});

test("latest actual time change is atomic, persistent, and survives other edits and cancellation", async () => {
  const { c, db, event } = await setup();
  const shifted = { ...details, start: new Date("2000-01-01T11:00:00Z"), end: new Date("2000-01-01T12:00:00Z") };
  await c.revise({ ...shifted, user: "owner", event });
  const expected = { timeChanged: true, previousStart: details.start, previousEnd: details.end };
  expect((await c._getEventDetails({ event }))[0]).toMatchObject(expected);
  await c.revise({ ...shifted, title: "New title", user: "owner", event });
  expect((await c._getEventDetails({ event }))[0]).toMatchObject(expected);
  await expect(c.revise({ ...details, user: "other", event })).rejects.toThrow(E.NotEventOrganizer);
  await expect(c.revise({ ...details, start: details.end, user: "owner", event })).rejects.toThrow(E.InvalidRevisionTime);
  expect((await c._getEventDetails({ event }))[0]).toMatchObject(expected);
  // An end-only change also replaces the latest previous interval.
  await c.revise({ ...shifted, end: new Date("2000-01-01T13:00:00Z"), user: "owner", event });
  await c.remove({ user: "owner", event });
  expect((await new E.EventPublishingConcept<string, string>(db)._getEventDetails({ event }))[0]).toMatchObject({
    timeChanged: true, previousStart: shifted.start, previousEnd: shifted.end, canceled: true,
  });
});

test("legacy events read safely and acquire history on their next time change", async () => {
  const { c, db, event } = await setup();
  await db.collection("eventpublishing.events").updateOne({ _id: event as never }, { $unset: { timeChanged: "", previousStart: "", previousEnd: "" } });
  expect((await c._getEventDetails({ event }))[0]).toMatchObject({ timeChanged: false, previousStart: details.start, previousEnd: details.end });
  await c.revise({ ...details, end: new Date("2000-01-01T12:00:00Z"), user: "owner", event });
  expect((await c._getEventDetails({ event }))[0]).toMatchObject({ timeChanged: true, previousStart: details.start, previousEnd: details.end });
});

test("concurrent time revisions retain the immediately preceding committed interval", async () => {
  const { c, event } = await setup();
  const a = { ...details, start: new Date("2000-01-01T12:00:00Z"), end: new Date("2000-01-01T13:00:00Z") };
  const b = { ...details, start: new Date("2000-01-01T14:00:00Z"), end: new Date("2000-01-01T15:00:00Z") };
  await Promise.all([c.revise({ ...a, user: "owner", event }), c.revise({ ...b, user: "owner", event })]);
  const result = (await c._getEventDetails({ event }))[0]!;
  const previous = result.start.getTime() === a.start.getTime() ? b : a;
  expect(result).toMatchObject({ timeChanged: true, previousStart: previous.start, previousEnd: previous.end });
});
