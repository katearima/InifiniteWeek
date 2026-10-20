import { afterEach, expect, test } from "bun:test";
import { NotifyingConcept, NotificationNotFound, NotificationAlreadyExists, type Notification } from "../../src/concepts/Notifying/Notifying.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
afterEach(cleanupDatabases);
const first = new Date("2026-01-01T10:00:00Z"), later = new Date("2026-01-01T11:00:00Z");
const identity = (value: string) => value as Notification;

test("inbox principle: recipient-only read, repeat read, read all, and dismissal", async () => {
  const inbox = new NotifyingConcept<string, string>(await testDatabase());
  const notification = identity("notice");
  await inbox.send({ user: "maya", subject: "event", message: "Event updated.", notification, at: first });
  expect(await inbox._getNotifications({ user: "other" })).toEqual([]);
  expect(await inbox._getNotification({ user: "other", notification })).toEqual([]);
  for (const user of ["other", "unknown"]) {
    await expect(inbox.markRead({ user, notification })).rejects.toThrow(NotificationNotFound);
    await expect(inbox.dismiss({ user, notification })).rejects.toThrow(NotificationNotFound);
  }
  await inbox.markRead({ user: "maya", notification });
  await inbox.markRead({ user: "maya", notification });
  expect(await inbox._getNotification({ user: "maya", notification })).toMatchObject([{ read: true, createdAt: first }]);
  await inbox.dismiss({ user: "maya", notification });
  await expect(inbox.dismiss({ user: "maya", notification })).rejects.toThrow(NotificationNotFound);
  await inbox.markAllRead({ user: "maya" });
  expect(await inbox._getNotifications({ user: "maya" })).toEqual([]);
});

test("atomic inbox cleanup preserves unrelated subjects and users; stable ordering and persistence", async () => {
  const database = await testDatabase();
  const inbox = new NotifyingConcept<string, string>(database), reopened = new NotifyingConcept<string, string>(database);
  for (const [name, subject, at] of [["z", "event", first], ["a", "event", first], ["new", "other-event", later]] as const) {
    await inbox.send({ user: "maya", subject, message: "update", notification: identity(name), at });
  }
  const other = identity("other-user");
  await inbox.send({ user: "other", subject: "event", message: "update", notification: other, at: first });
  expect((await reopened._getNotifications({ user: "maya" })).map(row => row.notification)).toEqual(["new", "a", "z"].map(identity));
  await reopened.clear({ user: "maya", subjects: [] });
  await reopened.markAllRead({ user: "maya" });
  expect((await inbox._getNotifications({ user: "maya" })).every(row => row.read)).toBe(true);
  expect(await inbox._getNotifications({ user: "other" })).toMatchObject([{ notification: other, read: false }]);
  await inbox.clear({ user: "maya", subjects: ["event", "event", "unknown"] });
  await inbox.clear({ user: "maya", subjects: ["event"] });
  expect(await reopened._getNotifications({ user: "maya" })).toMatchObject([{ notification: "new" }]);
  expect(await reopened._getNotifications({ user: "other" })).toHaveLength(1);
});

test("concurrent inbox transitions across instances do not lose entries or bypass duplicate refusal", async () => {
  const database = await testDatabase();
  const inbox = new NotifyingConcept<string, string>(database), reopened = new NotifyingConcept<string, string>(database);
  await Promise.all(Array.from({ length: 10 }, (_, index) => (index % 2 ? inbox : reopened)
    .send({ user: "maya", subject: "event", message: "update", notification: identity(String(index)), at: first })));
  expect(await inbox._getNotifications({ user: "maya" })).toHaveLength(10);
  await expect(inbox.send({ user: "maya", subject: "other", message: "overwrite", notification: identity("0"), at: later })).rejects.toThrow(NotificationAlreadyExists);
  await Promise.all([inbox.clear({ user: "maya", subjects: ["event"] }), reopened.send({ user: "maya", subject: "keep", message: "new", notification: identity("keep"), at: later })]);
  expect(await inbox._getNotifications({ user: "maya" })).toMatchObject([{ notification: "keep", read: false }]);
});

test("target cleanup removes notices across users, preserves event notices, and tolerates legacy data and repetition", async () => {
  const db = await testDatabase(), inbox = new NotifyingConcept<string, string>(db);
  for (const user of ["maya", "ben"]) {
    await inbox.send({ user, subject: "event", message: "Comment", target: "root", notification: identity("comment"), at: first });
    await inbox.send({ user, subject: "event", message: "Reply", target: "reply", notification: identity("reply"), at: first });
    await inbox.send({ user, subject: "event", message: "Updated", notification: identity("event"), at: first });
    await inbox.send({ user, subject: "other", message: "Other", target: "keep", notification: identity("keep"), at: first });
  }
  await db.collection("notifying.inboxes").updateMany({}, { $unset: { "entries.2.target": "" } });
  expect((await inbox._getNotification({ user: "maya", notification: identity("event") }))[0]?.target).toBe("");
  const before = await db.collection("notifying.inboxes").find().toArray();
  await inbox.clearTargets({ targets: [""] });
  expect(await db.collection("notifying.inboxes").find().toArray()).toEqual(before);
  await Promise.all([
    inbox.clearTargets({ targets: ["root", "root", "reply", "missing"] }),
    new NotifyingConcept<string, string>(db).send({ user: "maya", subject: "other", message: "Concurrent", target: "new", notification: identity("new"), at: later }),
  ]);
  await inbox.clearTargets({ targets: ["root", "reply"] });
  expect((await inbox._getNotifications({ user: "maya" })).map(row => row.target).sort()).toEqual(["", "keep", "new"]);
  expect((await inbox._getNotifications({ user: "ben" })).map(row => row.target).sort()).toEqual(["", "keep"]);
});

test("foreign operations and duplicate sends leave the original inbox unchanged", async () => {
  const db = await testDatabase(), inbox = new NotifyingConcept<string, string>(db);
  const notification = identity("notice");
  await inbox.send({ user: "maya", subject: "event", target: "comment", message: "Original", notification, at: first });
  const before = await db.collection("notifying.inboxes").find().toArray();
  await expect(inbox.markRead({ user: "ben", notification })).rejects.toThrow(NotificationNotFound);
  await expect(inbox.dismiss({ user: "ben", notification })).rejects.toThrow(NotificationNotFound);
  await expect(inbox.send({ user: "maya", subject: "other", target: "other", message: "Overwrite", notification, at: later })).rejects.toThrow(NotificationAlreadyExists);
  expect(await db.collection("notifying.inboxes").find().toArray()).toEqual(before);
});
