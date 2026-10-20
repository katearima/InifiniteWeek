import { afterEach, expect, test } from "bun:test";
import { GroupingConcept, PictureNotMember, PictureGroupNotFound } from "../../src/concepts/Grouping/Grouping.ts";
import { EventPublishingConcept, NotEventOrganizer, EventCanceledForRevision } from "../../src/concepts/EventPublishing/EventPublishing.ts";
import { InvalidPicture, validatePicture, pictureByteLimit } from "../../src/picture.ts";
import { testDatabase, cleanupDatabases } from "../support/reusable/mongo.ts";
import { samplePicture, pictureWithBytes } from "../support/picture.ts";
afterEach(cleanupDatabases);

test("picture validation accepts bounded JPEG and rejects URLs, active content, malformed framing, oversized bytes and dimensions", () => {
  expect(() => validatePicture("")).not.toThrow();
  expect(() => validatePicture(samplePicture)).not.toThrow();
  expect(() => validatePicture(pictureWithBytes(pictureByteLimit))).not.toThrow();
  expect(() => validatePicture(pictureWithBytes(pictureByteLimit + 1))).toThrow(InvalidPicture);
  const bytes = Buffer.from(samplePicture.split(",")[1]!, "base64");
  const oversizedDimensions = Buffer.from(bytes);
  const frame = oversizedDimensions.indexOf(Buffer.from([0xff, 0xc0]));
  expect(frame).toBeGreaterThan(0);
  oversizedDimensions.writeUInt16BE(1601, frame + 5);
  for (const picture of ["https://example.com/picture.jpg", "data:image/svg+xml,<svg/>", "data:text/html,<script/>",
    "data:image/jpeg;base64,???", samplePicture + " ", samplePicture.slice(0, -4),
    `data:image/jpeg;base64,${oversizedDimensions.toString("base64")}`,
    `data:image/jpeg;base64,${Buffer.alloc(pictureByteLimit + 1).toString("base64")}`]) {
    expect(() => validatePicture(picture)).toThrow(InvalidPicture);
  }
});

test("group picture authority, persistence, replacement, idempotent clearing and deletion", async () => {
  const database = await testDatabase(), groups = new GroupingConcept<string>(database);
  const { group } = await groups.createGroup({ user: "owner", name: "Photos", description: "", policy: "OPEN" });
  expect(await groups._getPicture({ group })).toEqual([{ picture: "" }]);
  await expect(groups.setPicture({ user: "outsider", group, picture: samplePicture })).rejects.toThrow(PictureNotMember);
  await groups.join({ user: "member", group });
  await groups.setPicture({ user: "member", group, picture: samplePicture });
  expect(await new GroupingConcept<string>(database)._getPicture({ group })).toEqual([{ picture: samplePicture }]);
  await expect(groups.setPicture({ user: "owner", group, picture: "bad" })).rejects.toThrow(InvalidPicture);
  expect(await groups._getPicture({ group })).toEqual([{ picture: samplePicture }]);
  await groups.changePolicy({ user: "owner", group, policy: "APPROVAL" });
  await groups.leave({ user: "member", group });
  await expect(groups.setPicture({ user: "member", group, picture: "" })).rejects.toThrow(PictureNotMember);
  expect(await groups._getPicture({ group })).toEqual([{ picture: samplePicture }]);
  for (let count = 0; count < 2; count++) await groups.setPicture({ user: "owner", group, picture: "" });
  expect(await groups._getPicture({ group })).toEqual([{ picture: "" }]);
  await groups.setPicture({ user: "owner", group, picture: samplePicture });
  await groups.deleteGroup({ user: "owner", group });
  expect(await groups._getPicture({ group })).toEqual([]);
  await expect(groups.setPicture({ user: "owner", group, picture: samplePicture })).rejects.toThrow(PictureGroupNotFound);
  expect((await database.collection("grouping.groups").findOne({ _id: group as never }))?.picture).toBe("");
});

test("event covers preserve metadata and history, serialize owner transitions and survive cancellation", async () => {
  const database = await testDatabase(), events = new EventPublishingConcept<string, string>(database);
  const fields = { title: "Photos", description: "", start: new Date("2000-01-01"), end: new Date("2000-01-02"), location: "MIT" };
  const { event } = await events.publish({ organizer: "owner", group: "group", ...fields });
  expect(await events._getPicture({ event })).toEqual([{ picture: "" }]);
  await expect(events.setPicture({ user: "other", event, picture: samplePicture })).rejects.toThrow(NotEventOrganizer);
  await events.setPicture({ user: "owner", event, picture: samplePicture });
  expect(await new EventPublishingConcept<string, string>(database)._getPicture({ event })).toEqual([{ picture: samplePicture }]);
  const details = await events._getEventDetails({ event });
  expect(details[0]).not.toHaveProperty("picture");
  await events.setPicture({ user: "owner", event, picture: samplePicture });
  expect(await events._getEventDetails({ event })).toEqual(details);
  await expect(events.setPicture({ user: "owner", event, picture: "bad" })).rejects.toThrow(InvalidPicture);
  expect(await events._getPicture({ event })).toEqual([{ picture: samplePicture }]);
  await Promise.all([
    events.revise({ user: "owner", event, ...fields, title: "Changed", start: new Date("2000-01-01T01:00:00Z") }),
    events.setPicture({ user: "owner", event, picture: "" }),
  ]);
  expect(await events._getPicture({ event })).toEqual([{ picture: "" }]);
  expect((await events._getEventDetails({ event }))[0]).toMatchObject({ title: "Changed", timeChanged: true, previousStart: fields.start });
  await events.setPicture({ user: "owner", event, picture: samplePicture });
  await events.remove({ user: "owner", event });
  await expect(events.setPicture({ user: "owner", event, picture: "" })).rejects.toThrow(EventCanceledForRevision);
  expect(await events._getPicture({ event })).toEqual([{ picture: samplePicture }]);
});
