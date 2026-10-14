import { afterAll, expect, test } from "bun:test";
import { initializeDefaultGroups, MIT_CAMPUS_GROUP } from "../../src/host/bootstrap.ts";
import { GroupingConcept } from "../../src/concepts/Grouping/Grouping.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";

afterAll(cleanupDatabases);

test("fresh database gets exactly one joinable campus group, even with concurrent initialization", async () => {
  const database = await testDatabase();
  await Promise.all(Array.from({ length: 12 }, () => initializeDefaultGroups(database)));
  const groups = new GroupingConcept<string>(database);
  expect(await groups._getGroups({})).toEqual([{
    group: MIT_CAMPUS_GROUP, name: "MIT Campus", policy: "OPEN",
    description: "A place for the MIT community to share events and make plans together.",
  }]);
  expect(await groups._getMembers({ group: MIT_CAMPUS_GROUP })).toEqual([]);
  expect(await groups.join({ user: "first-user", group: MIT_CAMPUS_GROUP })).toEqual({ status: "JOINED" });
});

test("restarting preserves campus membership, requests, policy and revision", async () => {
  const database = await testDatabase();
  await initializeDefaultGroups(database);
  const groups = new GroupingConcept<string>(database);
  await groups.join({ user: "member", group: MIT_CAMPUS_GROUP });
  await groups.changePolicy({ user: "member", group: MIT_CAMPUS_GROUP, policy: "APPROVAL" });
  await groups.join({ user: "requester", group: MIT_CAMPUS_GROUP });
  await groups.createGroup({ user: "member", name: "Other group", description: "", policy: "OPEN" });
  const before = await database.collection("grouping.groups").find().sort({ _id: 1 }).toArray();
  await initializeDefaultGroups(database);
  expect(await database.collection("grouping.groups").find().sort({ _id: 1 }).toArray()).toEqual(before);
});
