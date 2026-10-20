import { afterEach, expect, test } from "bun:test";
import { type Db, MongoClient } from "mongodb";
import { RegisteringConcept } from "../../src/concepts/Registering/Registering.ts";
import { AuthenticatingConcept } from "../../src/concepts/Authenticating/Authenticating.ts";
import { SessioningConcept } from "../../src/concepts/Sessioning/Sessioning.ts";
import { GroupingConcept } from "../../src/concepts/Grouping/Grouping.ts";
import { EventPublishingConcept } from "../../src/concepts/EventPublishing/EventPublishing.ts";
import { EventMarkingConcept } from "../../src/concepts/EventMarking/EventMarking.ts";
import { CommentingConcept, type Comment } from "../../src/concepts/Commenting/Commenting.ts";
import { NotifyingConcept, type Notification } from "../../src/concepts/Notifying/Notifying.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { samplePicture } from "../support/picture.ts";

test("all constructors only acquire collection handles and never perform database operations", () => {
  let handles = 0;
  const db = { collection: () => { handles++; return new Proxy({}, { get() { throw new Error("Unexpected database operation"); } }); } } as unknown as Db;
  new RegisteringConcept(db); new AuthenticatingConcept(db); new SessioningConcept(db);
  new GroupingConcept(db); new EventPublishingConcept(db); new EventMarkingConcept(db);
  new CommentingConcept(db); new NotifyingConcept(db);
  expect(handles).toBe(8);
});
test("registration and session index initialization retries after failure", async () => {
  for (const kind of ["register", "session"] as const) {
    let attempts = 0; let inserts = 0;
    const db = { collection: () => ({
      createIndex: async () => { if (++attempts === 1) throw new Error("index unavailable"); },
      insertOne: async () => { inserts++; },
    }) } as unknown as Db;
    const registering = new RegisteringConcept(db); const sessioning = new SessioningConcept<string>(db);
    const action = () => kind === "register" ? registering.register({ username: "maya" }) : sessioning.start({ subject: "maya" });
    await expect(action()).rejects.toThrow("index unavailable");
    expect(inserts).toBe(0);
    await action(); await action();
    expect(attempts).toBe(kind === "register" ? 3 : 2); expect(inserts).toBe(2);
  }
});
test("a fresh MongoDB client reads all eight concepts persisted by other instances", async () => {
  const db = await testDatabase();
  const { user } = await new RegisteringConcept(db).register({ username: "persist" });
  await new AuthenticatingConcept(db).set({ user, password: "persistent-password" });
  const { session } = await new SessioningConcept(db).start({ subject: user });
  const { group } = await new GroupingConcept(db).createGroup({ user, name: "Persist", description: "", policy: "OPEN" });
  const { event } = await new EventPublishingConcept(db).publish({ organizer: user, group, title: "Persist", description: "", start: new Date("2000-01-01"), end: new Date("2000-01-02"), location: "MIT" });
  await new EventMarkingConcept(db).mark({ user, event, intent: "GOING" });
  await new GroupingConcept(db).setPicture({ user, group, picture: samplePicture });
  await new EventPublishingConcept(db).setPicture({ user, event, picture: samplePicture });
  const comment = crypto.randomUUID() as Comment, notification = crypto.randomUUID() as Notification, at = new Date();
  await new CommentingConcept(db).post({ author: user, subject: event, comment, text: "Persisted discussion", at });
  await new NotifyingConcept(db).send({ user, subject: event, notification, message: "Event updated.", at });
  const client = new MongoClient(process.env.MONGODB_TEST_URL!);
  try {
    await client.connect(); const reopened = client.db(db.databaseName);
    expect(await new RegisteringConcept(reopened)._byUsername({ username: "persist" })).toEqual([{ user }]);
    expect(await new AuthenticatingConcept(reopened).authenticate({ user, password: "persistent-password" })).toEqual({ user });
    expect(await new SessioningConcept(reopened).use({ session })).toEqual({ subject: user });
    expect(await new GroupingConcept(reopened)._isMember({ user, group })).toEqual({ member: true });
    expect(await new EventPublishingConcept(reopened)._getEventDetails({ event })).toHaveLength(1);
    expect(await new GroupingConcept(reopened)._getPicture({ group })).toEqual([{ picture: samplePicture }]);
    expect(await new EventPublishingConcept(reopened)._getPicture({ event })).toEqual([{ picture: samplePicture }]);
    expect(await new EventMarkingConcept(reopened)._getMyEvents({ user })).toEqual([{ event, intent: "GOING" }]);
    expect(await new CommentingConcept(reopened)._getComments({ subject: event })).toMatchObject([{ comment, text: "Persisted discussion" }]);
    expect(await new NotifyingConcept(reopened)._getNotifications({ user })).toMatchObject([{ notification, read: false }]);
  } finally { await client.close(); }
});

// Register cleanup in each test file; Bun scopes imported hooks to their first file.
afterEach(cleanupDatabases);

test("failed group/event/mark writes preserve the previous state and propagate the storage failure", async () => {
  const db = await testDatabase();
  // Real reads, but reject the replacement before it reaches MongoDB.
  const failing = { collection: (name: string) => {
    const real = db.collection(name);
    return new Proxy(real, { get(target, property) {
      if (property === "replaceOne") return async () => { throw new Error("injected write failure"); };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  } } as unknown as Db;
  const groups = new GroupingConcept<string>(db);
  const { group } = await groups.createGroup({ user: "u", name: "Test", description: "", policy: "APPROVAL" });
  await groups.join({ user: "pending", group });
  const events = new EventPublishingConcept<string, string>(db);
  const { event } = await events.publish({ organizer: "u", group, title: "Test", description: "", start: new Date("2000-01-01"), end: new Date("2000-01-02"), location: "MIT" });
  const marks = new EventMarkingConcept<string, string>(db);
  await marks.mark({ user: "u", event, intent: "NOT_GOING" });
  await expect(new GroupingConcept<string>(failing).changePolicy({ user: "u", group, policy: "OPEN" })).rejects.toThrow("injected write failure");
  await expect(new EventPublishingConcept<string, string>(failing).remove({ user: "u", event })).rejects.toThrow("injected write failure");
  await expect(new EventMarkingConcept<string, string>(failing).clearMarks({ user: "u", events: [event] })).rejects.toThrow("injected write failure");
  expect((await groups._getGroupDetails({ group }))[0]?.policy).toBe("APPROVAL");
  expect(await groups._getPendingRequests({ group })).toEqual([{ user: "pending" }]);
  expect((await events._getEventDetails({ event }))[0]?.canceled).toBe(false);
  expect(await marks._getNotGoingEvents({ user: "u" })).toEqual([{ event }]);
});
