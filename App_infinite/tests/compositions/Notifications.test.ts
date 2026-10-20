import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup, type Instances } from "./support.ts";
import { localDateTime, monthDays } from "../../web/calendar.ts";
cleanup();

function latch() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function fixture(configure?: (instances: Instances) => void) {
  const app = await setup(configure);
  const owner = await app.register("owner"), going = await app.register("going"), interested = await app.register("interested"), outsider = await app.register("outsider");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "Inbox", description: "", policy: "OPEN" }));
  for (const account of [going, interested]) ok(await app.api.groups.join({ session: account.session, group }));
  const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
  for (const account of [owner, going]) ok(await app.api.plans.mark({ session: account.session, event, intent: "GOING" }));
  ok(await app.api.plans.mark({ session: interested.session, event, intent: "INTERESTED" }));
  return { ...app, owner, going, interested, outsider, group, event };
}

test("only actual schedule/location changes and cancellation notify positive intentions once per recipient", async () => {
  const { api, owner, going, interested, outsider, event } = await fixture();
  ok(await api.events.revise({ session: owner.session, event, ...fields, title: "Renamed", description: "Details" }));
  expect(await api.notifications.list({ session: going.session })).toEqual({ notifications: [], unreadCount: 0 });
  const changed = { ...fields, start: "2000-01-01T09:00:00.000Z", location: "New room" };
  ok(await api.events.revise({ session: owner.session, event, ...changed }));
  for (const account of [going, interested]) {
    const inbox = ok(await api.notifications.list({ session: account.session }));
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.notifications).toMatchObject([{ event, message: "Event updated.", read: false, title: fields.title }]);
  }
  const notices = [going, interested];
  expect(new Set(await Promise.all(notices.map(async account => ok(await api.notifications.list({ session: account.session })).notifications[0]!.createdAt))).size).toBe(1);
  for (const account of [owner, outsider]) expect(await api.notifications.list({ session: account.session })).toEqual({ notifications: [], unreadCount: 0 });
  ok(await api.events.revise({ session: owner.session, event, ...changed }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(1);
  ok(await api.events.revise({ session: owner.session, event, ...changed, title: "Current title" }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications[0]!.title).toBe("Current title");
  ok(await api.events.remove({ session: owner.session, event }));
  const inbox = ok(await api.notifications.list({ session: going.session }));
  expect(inbox.unreadCount).toBe(2);
  expect(inbox.notifications).toHaveLength(2);
  expect(inbox.notifications.map(row => row.message)).toContain("Event canceled.");
  expect(await api.events.remove({ session: owner.session, event })).toEqual({ error: "EVENT_ALREADY_CANCELED" });
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(2);
});

test("successive event changes reach the inbox while Calendar retains only the latest schedule change", async () => {
  const { api, owner, going, interested, event } = await fixture();
  const first = { ...fields, start: "2000-01-02T10:00:00.000Z", end: "2000-01-02T11:00:00.000Z" };
  const latest = { ...fields, start: "2000-01-03T12:00:00.000Z", end: "2000-01-03T13:00:00.000Z" };
  for (const changed of [first, latest]) {
    ok(await api.events.revise({ session: owner.session, event, ...changed }));
  }
  // A location-only change and identical save must not replace the latest time history.
  const relocated = { ...latest, location: "New room" };
  ok(await api.events.revise({ session: owner.session, event, ...relocated }));
  ok(await api.events.revise({ session: owner.session, event, ...relocated }));
  for (const account of [going, interested]) {
    const inbox = ok(await api.notifications.list({ session: account.session }));
    expect(inbox.unreadCount).toBe(3);
    expect(inbox.notifications).toHaveLength(3);
    expect(new Set(inbox.notifications.map(row => row.notification)).size).toBe(3);
    expect(inbox.notifications.every(row => row.event === event && row.message === "Event updated.")).toBe(true);
    const plans = ok(await api.plans.list({ session: account.session })).events;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      event, start: latest.start, end: latest.end, location: relocated.location,
      timeChanged: true, previousStart: first.start, previousEnd: first.end,
    });
    const occupied = monthDays(new Date(2000, 0, 1), plans).filter(day => day.events.length);
    expect(occupied).toHaveLength(1);
    expect(occupied[0]!.events.map(row => row.event)).toEqual([event]);
    expect(occupied[0]!.key).toBe(localDateTime(new Date(latest.start)).slice(0, 10));
  }
  ok(await api.events.remove({ session: owner.session, event }));
  const inbox = ok(await api.notifications.list({ session: going.session }));
  expect(inbox.notifications).toHaveLength(4);
  expect(inbox.notifications.filter(row => row.message === "Event canceled.")).toHaveLength(1);
  const plans = ok(await api.plans.list({ session: going.session })).events;
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ canceled: true, previousStart: first.start, previousEnd: first.end });
});

test("inbox controls are recipient-owned and counts reflect individual read, all read, and dismissal", async () => {
  const { api, owner, going, interested, event } = await fixture();
  ok(await api.events.revise({ session: owner.session, event, ...fields, location: "New" }));
  const { notification } = ok(await api.notifications.list({ session: going.session })).notifications[0]!;
  expect(await api.notifications.read({ session: interested.session, notification })).toEqual({ error: "NOT_FOUND" });
  expect(await api.notifications.dismiss({ session: owner.session, notification })).toEqual({ error: "NOT_FOUND" });
  ok(await api.notifications.read({ session: going.session, notification }));
  ok(await api.notifications.read({ session: going.session, notification }));
  expect(ok(await api.notifications.list({ session: going.session })).unreadCount).toBe(0);
  expect(ok(await api.notifications.list({ session: interested.session })).unreadCount).toBe(1);
  ok(await api.events.remove({ session: owner.session, event }));
  ok(await api.notifications["read-all"]({ session: going.session }));
  expect(ok(await api.notifications.list({ session: going.session })).unreadCount).toBe(0);
  ok(await api.notifications.dismiss({ session: going.session, notification }));
  expect(await api.notifications.dismiss({ session: going.session, notification })).toEqual({ error: "NOT_FOUND" });
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(1);
});

test("positive intention transitions preserve notices; Not Going/removal clear them and re-saving restores none", async () => {
  const { api, owner, going, interested, event } = await fixture();
  ok(await api.events.revise({ session: owner.session, event, ...fields, location: "New" }));
  ok(await api.plans.mark({ session: going.session, event, intent: "INTERESTED" }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(1);
  ok(await api.plans.mark({ session: going.session, event, intent: "NOT_GOING" }));
  expect(await api.notifications.list({ session: going.session })).toEqual({ notifications: [], unreadCount: 0 });
  ok(await api.plans.mark({ session: going.session, event, intent: "GOING" }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(0);
  ok(await api.plans.remove({ session: interested.session, event }));
  ok(await api.events.remove({ session: owner.session, event }));
  expect(ok(await api.notifications.list({ session: interested.session })).notifications).toHaveLength(0);
  expect(await api.plans.mark({ session: going.session, event, intent: "NOT_GOING" })).toEqual({ error: "EVENT_CANCELED" });
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(1);
  ok(await api.plans.remove({ session: going.session, event }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(0);
});

test("departure and group deletion clear relevant inboxes; inaccessible entries are hidden defensively", async () => {
  const { api, instances, owner, going, interested, event, group } = await fixture();
  ok(await api.events.remove({ session: owner.session, event }));
  const { notification } = ok(await api.notifications.list({ session: going.session })).notifications[0]!;
  ok(await api.groups.leave({ session: going.session, group }));
  expect(await instances.Notifying._getNotifications({ user: going.user })).toEqual([]);
  expect(await api.notifications.read({ session: going.session, notification })).toEqual({ error: "NOT_FOUND" });
  ok(await api.groups.join({ session: going.session, group }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(0);
  await instances.Grouping.leave({ user: interested.user, group });
  expect(await api.notifications.list({ session: interested.session })).toEqual({ notifications: [], unreadCount: 0 });
  const hidden = (await instances.Notifying._getNotifications({ user: interested.user }))[0]!;
  expect(await api.notifications.read({ session: interested.session, notification: hidden.notification })).toEqual({ error: "NOT_FOUND" });
  await instances.Grouping.join({ user: interested.user, group });
  ok(await api.groups.leave({ session: owner.session, group }));
  ok(await api.groups.leave({ session: going.session, group }));
  ok(await api.groups.delete({ session: interested.session, group }));
  expect(await instances.Notifying._getNotifications({ user: interested.user })).toEqual([]);
  expect(await api.comments.list({ session: interested.session, event })).toEqual({ error: "NOT_FOUND" });
});

test("delivery failure retains the event with no false success or duplicate notifications on identical retry", async () => {
  let calls = 0;
  const { api, instances, owner, going, interested, event } = await fixture(instances => {
    const originalSend = instances.Notifying.send.bind(instances.Notifying);
    instances.Notifying.send = async function send(input) {
      if (++calls === 2) throw new Error("delivery unavailable");
      return originalSend(input);
    };
  });
  const change = { session: owner.session, event, ...fields, location: "Changed despite failure" };
  expect(await api.events.revise(change)).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(ok(await api.events.details({ session: going.session, event })).event.location).toBe(change.location);
  const total = (await instances.Notifying._getNotifications({ user: going.user })).length + (await instances.Notifying._getNotifications({ user: interested.user })).length;
  expect(total).toBe(1);
  ok(await api.events.revise(change));
  expect(calls).toBe(2);
  expect((await instances.Notifying._getNotifications({ user: going.user })).length + (await instances.Notifying._getNotifications({ user: interested.user })).length).toBe(1);
});

test("notification cleanup failure preserves marks/membership; later failure leaves cleared notices", async () => {
  let failClear = true, failLeave = false;
  const { api, instances, owner, going, event, group } = await fixture(instances => {
    const originalClear = instances.Notifying.clear.bind(instances.Notifying), originalLeave = instances.Grouping.leave.bind(instances.Grouping);
    instances.Notifying.clear = async function clear(input) { if (failClear) throw new Error("unavailable"); return originalClear(input); };
    instances.Grouping.leave = async function leave(input) { if (failLeave) throw new Error("unavailable"); return originalLeave(input); };
  });
  ok(await api.events.revise({ session: owner.session, event, ...fields, location: "New" }));
  expect(await api.plans.remove({ session: going.session, event })).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(await api.groups.leave({ session: going.session, group })).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(await instances.EventMarking._isMarked({ user: going.user, event })).toEqual({ marked: true });
  expect(await instances.Grouping._isMember({ user: going.user, group })).toEqual({ member: true });
  expect(await instances.Notifying._getNotifications({ user: going.user })).toHaveLength(1);
  failClear = false; failLeave = true;
  expect(await api.groups.leave({ session: going.session, group })).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(await instances.Notifying._getNotifications({ user: going.user })).toEqual([]);
  expect(await instances.Grouping._isMember({ user: going.user, group })).toEqual({ member: true });
  failLeave = false;
  ok(await api.groups.leave({ session: going.session, group }));
});

test("timed-out event updates retain exclusion through delivery before queued departure clears notices", async () => {
  const entered = latch(), gate = latch();
  const { api, invoker, instances, owner, going, interested, event, group } = await fixture(instances => {
    const originalSend = instances.Notifying.send.bind(instances.Notifying);
    instances.Notifying.send = async function send(input) { entered.release(); await gate.promise; return originalSend(input); };
  });
  const updating = invoker.invoke("/events/revise", { session: owner.session, event, ...fields, location: "New room" }, { timeoutMs: 50 });
  try {
    await entered.promise;
    expect(await updating).toMatchObject({ ok: false, error: { code: "TIMED_OUT" } });
    let departed = false;
    const leaving = api.groups.leave({ session: going.session, group }).then(result => { departed = true; return result; });
    expect(await instances.Grouping._isMember({ user: going.user, group })).toEqual({ member: true });
    expect(departed).toBe(false);
    gate.release();
    ok(await leaving);
    expect(await instances.Notifying._getNotifications({ user: going.user })).toEqual([]);
    expect(ok(await api.notifications.list({ session: interested.session })).notifications).toHaveLength(1);
    expect(ok(await api.events.details({ session: owner.session, event })).event.location).toBe("New room");
  } finally { gate.release(); }
});

test("cancellation delivery failure retains canceled state and refuses a second cancellation", async () => {
  const { api, owner, going, event } = await fixture(instances => {
    instances.Notifying.send = async function send() { throw new Error("delivery unavailable"); };
  });
  expect(await api.events.remove({ session: owner.session, event })).toMatchObject({ error: "INTERNAL_ERROR" });
  expect(ok(await api.events.details({ session: going.session, event })).event.canceled).toBe(true);
  expect(await api.events.remove({ session: owner.session, event })).toEqual({ error: "EVENT_ALREADY_CANCELED" });
});

test("Not Going, unmarked members, and nonmember marks never receive event-change notices", async () => {
  const { api, instances, owner, going, interested, outsider, event, group } = await fixture();
  ok(await api.plans.mark({ session: going.session, event, intent: "NOT_GOING" }));
  ok(await api.plans.remove({ session: interested.session, event }));
  await instances.EventMarking.mark({ user: outsider.user, event, intent: "GOING" });
  ok(await api.events.revise({ session: owner.session, event, ...fields, location: "No recipients" }));
  for (const account of [going, interested, outsider]) expect(await instances.Notifying._getNotifications({ user: account.user })).toEqual([]);
  expect(await instances.Grouping._isMember({ user: outsider.user, group })).toEqual({ member: false });
});
