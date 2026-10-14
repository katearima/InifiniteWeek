import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup } from "./support.ts";
import { initializeDefaultGroups, MIT_CAMPUS_GROUP } from "../../src/host/bootstrap.ts";
cleanup();

test("deletion requires sole membership, canceled events, and clears marks and requests", async () => {
  const app = await setup();
  const owner = await app.register("owner"), other = await app.register("other");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "Test", description: "", policy: "OPEN" }));
  expect(await app.api.groups.delete({ group })).toEqual({ error: "NOT_SIGNED_IN" });
  expect(await app.api.groups.delete({ session: other.session, group })).toEqual({ error: "DELETE_NOT_MEMBER" });
  ok(await app.api.groups.join({ session: other.session, group }));
  expect(await app.api.groups.delete({ session: owner.session, group })).toEqual({ error: "DELETE_NOT_LAST_MEMBER" });
  ok(await app.api.groups.leave({ session: other.session, group }));
  const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
  ok(await app.api.plans.mark({ session: owner.session, event, intent: "NOT_GOING" }));
  expect(await app.api.groups.delete({ session: owner.session, group })).toEqual({ error: "ACTIVE_EVENTS_PREVENT_DELETION" });
  expect(await app.instances.EventMarking._isMarked({ user: owner.user, event })).toEqual({ marked: true });
  ok(await app.api.events.remove({ session: owner.session, event }));
  ok(await app.api.groups.policy({ session: owner.session, group, policy: "APPROVAL" }));
  ok(await app.api.groups.join({ session: other.session, group }));
  ok(await app.api.groups.delete({ session: owner.session, group }));
  expect(ok(await app.api.groups.list({ session: owner.session })).groups).toEqual([]);
  expect(await app.api.groups.details({ session: owner.session, group })).toEqual({ error: "NOT_FOUND" });
  expect(await app.api.groups.delete({ session: owner.session, group })).toEqual({ error: "DELETE_GROUP_NOT_FOUND" });
  expect(await app.api.groups.join({ session: other.session, group })).toEqual({ error: "JOIN_GROUP_NOT_FOUND" });
  expect(await app.api.events.details({ session: owner.session, event })).toEqual({ error: "NOT_FOUND" });
  expect(await app.instances.Grouping._getMembers({ group })).toEqual([]);
  expect(await app.instances.Grouping._getPendingRequests({ group })).toEqual([]);
  expect(await app.instances.EventMarking._isMarked({ user: owner.user, event })).toEqual({ marked: false });
});

test("deleted default group stays absent after bootstrap", async () => {
  const app = await setup(); const owner = await app.register("owner");
  await initializeDefaultGroups(app.database);
  ok(await app.api.groups.join({ session: owner.session, group: MIT_CAMPUS_GROUP }));
  ok(await app.api.groups.delete({ session: owner.session, group: MIT_CAMPUS_GROUP }));
  await initializeDefaultGroups(app.database);
  expect(ok(await app.api.groups.list({ session: owner.session })).groups).toEqual([]);
});

test("concurrent concept join/delete cannot delete a newly shared group", async () => {
  const app = await setup(); const owner = await app.register("owner"), other = await app.register("other");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "Race", description: "", policy: "OPEN" }));
  const [deletion, join] = await Promise.allSettled([
    app.instances.Grouping.deleteGroup({ user: owner.user, group }),
    app.instances.Grouping.join({ user: other.user, group }),
  ]);
  expect([deletion, join].filter(r => r.status === "fulfilled")).toHaveLength(1);
  if (join.status === "fulfilled") expect(await app.instances.Grouping._getMembers({ group })).toHaveLength(2);
  else expect(await app.instances.Grouping._getGroupDetails({ group })).toEqual([]);
});

for (const failure of ["clear", "delete"] as const) {
  test(`${failure} failure preserves documented partial effects and supports retry`, async () => {
    let inject = false;
    const app = await setup(instances => {
      const clear = instances.EventMarking.clearMarks.bind(instances.EventMarking);
      const remove = instances.Grouping.deleteGroup.bind(instances.Grouping);
      instances.EventMarking.clearMarks = async function clearMarks(args) {
        if (inject && failure === "clear") throw new Error("Injected failure");
        return clear(args);
      };
      instances.Grouping.deleteGroup = async function deleteGroup(args) {
        if (inject && failure === "delete") throw new Error("Injected failure");
        return remove(args);
      };
    });
    const owner = await app.register("owner");
    const { group } = ok(await app.api.groups.create({ session: owner.session, name: "Fault", description: "", policy: "OPEN" }));
    const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
    ok(await app.api.plans.mark({ session: owner.session, event, intent: "GOING" }));
    ok(await app.api.events.remove({ session: owner.session, event }));
    inject = true;
    expect(await app.api.groups.delete({ session: owner.session, group })).toHaveProperty("error");
    expect(await app.instances.Grouping._isMember({ user: owner.user, group })).toEqual({ member: true });
    expect(await app.instances.EventMarking._isMarked({ user: owner.user, event })).toEqual({ marked: failure === "clear" });
    inject = false;
    ok(await app.api.groups.delete({ session: owner.session, group }));
  });
}
