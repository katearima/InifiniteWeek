import { afterEach, expect, test } from "bun:test";
import { EventMarkingConcept, NoMarkToRemove } from "../../src/concepts/EventMarking/EventMarking.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { expectOneWinner } from "../support/reusable/race.ts";
async function setup() { const db = await testDatabase(); return { db, c: new EventMarkingConcept<string, string>(db) }; }
test("intentions replace each other; queries sort and filter; other users remain independent", async () => {
  const { c, db } = await setup(); const user = "u";
  await c.mark({ user, event: "z", intent: "INTERESTED" });
  await c.mark({ user, event: "z", intent: "GOING" });
  await c.mark({ user, event: "z", intent: "GOING" });
  await c.mark({ user, event: "a", intent: "INTERESTED" });
  await c.mark({ user, event: "n", intent: "NOT_GOING" });
  await c.mark({ user: "a", event: "n", intent: "GOING" });
  expect(await c._getMyEvents({ user })).toEqual([{ event: "a", intent: "INTERESTED" }, { event: "z", intent: "GOING" }]);
  expect(await c._getInterestedEvents({ user })).toEqual([{ event: "a" }]);
  expect(await c._getGoingEvents({ user })).toEqual([{ event: "z" }]);
  expect(await c._getNotGoingEvents({ user })).toEqual([{ event: "n" }]);
  expect(await c._isMarked({ user, event: "n" })).toEqual({ marked: true });
  expect(await c._getMarksByEvent({ event: "n" })).toEqual([{ user: "a", intent: "GOING" }, { user: "u", intent: "NOT_GOING" }]);
  expect(await new EventMarkingConcept<string, string>(db)._getMyEvents({ user })).toEqual(await c._getMyEvents({ user }));
  await c.removeMark({ user, event: "n" });
  expect(await c._getMarksByEvent({ event: "n" })).toEqual([{ user: "a", intent: "GOING" }]);
  await expect(c.removeMark({ user, event: "n" })).rejects.toThrow(NoMarkToRemove);
});
test("clear removes every supplied intention atomically and is idempotent", async () => {
  const { c, db } = await setup(); const user = "u";
  for (const [event, intent] of [["a", "GOING"], ["b", "INTERESTED"], ["c", "NOT_GOING"], ["keep", "GOING"]] as const) await c.mark({ user, event, intent });
  await c.mark({ user: "other", event: "a", intent: "GOING" });
  const before = await db.collection("eventmarking.users").find().toArray();
  await c.clearMarks({ user, events: [] });
  expect(await db.collection("eventmarking.users").find().toArray()).toEqual(before);
  const snapshots: number[] = [];
  const clearing = c.clearMarks({ user, events: ["a", "b", "a", "c", "unknown"] });
  for (let i = 0; i < 12; i++) {
    const row = await db.collection<{ _id: string; marks: { event: string }[] }>("eventmarking.users").findOne({ _id: user });
    snapshots.push(row!.marks.filter(m => ["a", "b", "c"].includes(m.event)).length);
  }
  await clearing;
  expect(snapshots.every(count => count === 0 || count === 3)).toBe(true);
  await c.clearMarks({ user, events: ["a", "b", "c"] });
  expect(await c._getMyEvents({ user })).toEqual([{ event: "keep", intent: "GOING" }]);
  expect(await c._getNotGoingEvents({ user })).toEqual([]);
  expect(await c._getMyEvents({ user: "other" })).toEqual([{ event: "a", intent: "GOING" }]);
});
test("unknown identities are opaque; empty queries and refused removal change no state", async () => {
  const { c, db } = await setup(); const user = "missing";
  expect(await c._getMyEvents({ user })).toEqual([]);
  expect(await c._getInterestedEvents({ user })).toEqual([]);
  expect(await c._getGoingEvents({ user })).toEqual([]);
  expect(await c._getNotGoingEvents({ user })).toEqual([]);
  expect(await c._getMarksByEvent({ event: "unknown" })).toEqual([]);
  expect(await c._isMarked({ user, event: "unknown" })).toEqual({ marked: false });
  await expect(c.removeMark({ user, event: "unknown" })).rejects.toThrow(NoMarkToRemove);
  await c.clearMarks({ user, events: ["unknown"] });
  expect(await db.collection("eventmarking.users").countDocuments()).toBe(0);
});
test("concurrent initial creation keeps all marks; competing removals have one winner", async () => {
  const { c, db } = await setup(); const other = new EventMarkingConcept<string, string>(db);
  await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? c : other).mark({ user: "u", event: String(i), intent: "GOING" })));
  expect(await c._getMyEvents({ user: "u" })).toHaveLength(12);
  await expectOneWinner([c.removeMark({ user: "u", event: "0" }), other.removeMark({ user: "u", event: "0" })], NoMarkToRemove);
  await Promise.all([c.clearMarks({ user: "u", events: ["1", "2", "3"] }), other.mark({ user: "u", event: "keep", intent: "INTERESTED" })]);
  expect(await c._isMarked({ user: "u", event: "keep" })).toEqual({ marked: true });
  for (const event of ["1", "2", "3"]) expect(await c._isMarked({ user: "u", event })).toEqual({ marked: false });
});

// Register cleanup in each test file; Bun scopes imported hooks to their first file.
afterEach(cleanupDatabases);

test("competing intentions still leave exactly one current mark for a pair", async () => {
  const { c, db } = await setup(); const other = new EventMarkingConcept<string, string>(db);
  await Promise.all([c.mark({ user: "u", event: "e", intent: "GOING" }), other.mark({ user: "u", event: "e", intent: "INTERESTED" })]);
  const rows = await c._getMarksByEvent({ event: "e" });
  expect(rows).toHaveLength(1);
  expect(["GOING", "INTERESTED"]).toContain(rows[0]?.intent);
});
