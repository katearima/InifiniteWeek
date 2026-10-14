import { afterEach, expect, test } from "bun:test";
import * as G from "../../src/concepts/Grouping/Grouping.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { expectOneWinner } from "../support/reusable/race.ts";
async function setup(policy: G.JoiningPolicy = "APPROVAL") {
  const db = await testDatabase();
  const c = new G.GroupingConcept<string>(db);
  const { group } = await c.createGroup({ user: "owner", name: "MIT", description: "students", policy });
  return { c, db, group };
}
test("approval, rejection, refusals preserve state, and open policy admits everyone pending", async () => {
  const { c, db, group } = await setup();
  expect(await c.join({ user: "bob", group })).toEqual({ status: "PENDING" });
  expect(await c.join({ user: "alice", group })).toEqual({ status: "PENDING" });
  expect(await c._getPendingRequests({ group })).toEqual([{ user: "alice" }, { user: "bob" }]);
  const before = await db.collection("grouping.groups").find().toArray();
  await expect(c.join({ user: "bob", group })).rejects.toThrow(G.RequestAlreadyPending);
  await expect(c.join({ user: "owner", group })).rejects.toThrow(G.JoinAlreadyMember);
  await expect(c.approve({ user: "outsider", group, requester: "bob" })).rejects.toThrow(G.ApproveNotMember);
  await expect(c.reject({ user: "outsider", group, requester: "bob" })).rejects.toThrow(G.RejectNotMember);
  await expect(c.changePolicy({ user: "outsider", group, policy: "OPEN" })).rejects.toThrow(G.PolicyNotMember);
  await expect(c.leave({ user: "outsider", group })).rejects.toThrow(G.LeaveNotMember);
  await expect(c.approve({ user: "owner", group, requester: "missing" })).rejects.toThrow(G.ApproveRequestNotFound);
  await expect(c.reject({ user: "owner", group, requester: "missing" })).rejects.toThrow(G.RejectRequestNotFound);
  expect(await db.collection("grouping.groups").find().toArray()).toEqual(before);
  await c.changePolicy({ user: "owner", group, policy: "APPROVAL" });
  expect(await c._getPendingRequests({ group })).toHaveLength(2);
  await c.approve({ user: "owner", group, requester: "alice" });
  await c.reject({ user: "alice", group, requester: "bob" });
  expect(await c._isMember({ user: "bob", group })).toEqual({ member: false });
  await c.join({ user: "bob", group });
  await c.changePolicy({ user: "alice", group, policy: "OPEN" });
  expect(await c._getMembers({ group })).toEqual([{ user: "alice" }, { user: "bob" }, { user: "owner" }]);
  expect(await c._getPendingRequests({ group })).toEqual([]);
  expect(await c.join({ user: "carol", group })).toEqual({ status: "JOINED" });
  await c.leave({ user: "owner", group });
  expect(await c._isMember({ user: "owner", group })).toEqual({ member: false });
});
test("last member departure opens the group and admits pending users, or retains an empty group", async () => {
  const { c, group } = await setup();
  await c.join({ user: "next", group });
  await c.leave({ user: "owner", group });
  expect(await c._getMembers({ group })).toEqual([{ user: "next" }]);
  expect(await c._getPendingRequests({ group })).toEqual([]);
  expect((await c._getGroupDetails({ group }))[0]?.policy).toBe("OPEN");
  await c.leave({ user: "next", group });
  expect(await c._getMembers({ group })).toEqual([]);
  expect(await c._getGroupDetails({ group })).toHaveLength(1);
  expect(await c.join({ user: "returning", group })).toEqual({ status: "JOINED" });
});
test("unknown groups have exact refusals and empty query answers", async () => {
  const { c } = await setup(); const group = "missing" as G.Group;
  for (const [call, refusal] of [
    [() => c.join({ user: "u", group }), G.JoinGroupNotFound],
    [() => c.approve({ user: "u", group, requester: "v" }), G.ApproveGroupNotFound],
    [() => c.reject({ user: "u", group, requester: "v" }), G.RejectGroupNotFound],
    [() => c.leave({ user: "u", group }), G.LeaveGroupNotFound],
    [() => c.changePolicy({ user: "u", group, policy: "OPEN" }), G.PolicyGroupNotFound],
  ] as const) await expect(call()).rejects.toThrow(refusal);
  expect(await c._getGroupDetails({ group })).toEqual([]);
  expect(await c._getMembers({ group })).toEqual([]);
  expect(await c._getPendingRequests({ group })).toEqual([]);
  expect(await c._isMember({ group, user: "u" })).toEqual({ member: false });
  expect(await c._getGroupsByUser({ user: "u" })).toEqual([]);
});
test("queries sort identities and a fresh instance reads persisted memberships", async () => {
  const { c, db, group } = await setup("OPEN");
  const { group: other } = await c.createGroup({ user: "owner", name: "Other", description: "", policy: "OPEN" });
  const sorted = [group, other].sort();
  expect((await c._getGroups({})).map(r => r.group)).toEqual(sorted);
  expect(await new G.GroupingConcept<string>(db)._getGroupsByUser({ user: "owner" })).toEqual(sorted.map(group => ({ group })));
});
test("concurrent duplicate join and competing approval/rejection each have one winner", async () => {
  const { c, db, group } = await setup(); const other = new G.GroupingConcept<string>(db);
  await expectOneWinner([c.join({ user: "u", group }), other.join({ user: "u", group })], G.RequestAlreadyPending);
  await expectOneWinner([c.approve({ user: "owner", group, requester: "u" }), other.reject({ user: "owner", group, requester: "u" })], G.ApproveRequestNotFound, G.RejectRequestNotFound);
  expect(await c._getPendingRequests({ group })).toEqual([]);
});
test("concurrent last-member departure and policy opening never lose pending members", async () => {
  const { c, db, group } = await setup();
  await Promise.all(["a", "b", "c"].map(user => c.join({ user, group })));
  const outcomes = await Promise.allSettled([c.leave({ user: "owner", group }), new G.GroupingConcept<string>(db).changePolicy({ user: "owner", group, policy: "OPEN" })]);
  expect(outcomes[0]?.status).toBe("fulfilled");
  if (outcomes[1]?.status === "rejected") expect(outcomes[1].reason).toBeInstanceOf(G.PolicyNotMember);
  expect(await c._getMembers({ group })).toEqual(["a", "b", "c"].map(user => ({ user })));
  expect(await c._getPendingRequests({ group })).toEqual([]);
});

// Register cleanup in each test file; Bun scopes imported hooks to their first file.
afterEach(cleanupDatabases);

test("concurrent OPEN joins add a member exactly once", async () => {
  const { c, db, group } = await setup("OPEN");
  await expectOneWinner([c.join({ user: "u", group }), new G.GroupingConcept<string>(db).join({ user: "u", group })], G.JoinAlreadyMember);
  expect(await c._getMembers({ group })).toEqual([{ user: "owner" }, { user: "u" }]);
});

test("pending status is a total boolean projection across request decisions", async () => {
  const { c, group } = await setup();
  expect(await c._isPending({ user: "bob", group })).toEqual({ pending: false });
  expect(await c._isPending({ user: "bob", group: "missing" as G.Group })).toEqual({ pending: false });
  await c.join({ user: "bob", group });
  expect(await c._isPending({ user: "bob", group })).toEqual({ pending: true });
  await c.approve({ user: "owner", group, requester: "bob" });
  expect(await c._isPending({ user: "bob", group })).toEqual({ pending: false });
});
