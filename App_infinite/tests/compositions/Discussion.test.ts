import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup, type Instances } from "./support.ts";
cleanup();

async function fixture(configure?: (instances: Instances) => void) {
  const app = await setup(configure);
  const owner = await app.register("owner"), member = await app.register("member"), other = await app.register("other");
  const { group } = ok(await app.api.groups.create({ session: owner.session, name: "Discussion", description: "", policy: "OPEN" }));
  ok(await app.api.groups.join({ session: member.session, group }));
  const { event } = ok(await app.api.events.publish({ session: owner.session, group, ...fields }));
  return { ...app, owner, member, other, group, event };
}

test("discussion checks event access, author edits, and organizer moderation", async () => {
  const { api, owner, member, other, group, event } = await fixture();
  expect(await api.comments.list({ session: member.session, event })).toEqual({ comments: [] });
  const { comment } = ok(await api.comments.post({ session: member.session, event, text: "  <script>alert(1)</script>\nMeet here  " }));
  for (const session of [other.session, undefined]) {
    expect(await api.comments.list({ session, event })).toEqual({ error: session ? "NOT_FOUND" : "NOT_SIGNED_IN" });
  }
  expect(await api.comments.post({ session: other.session, event, text: "hidden" })).toEqual({ error: "NOT_FOUND" });
  expect(await api.comments.edit({ session: other.session, comment, text: "hidden" })).toEqual({ error: "NOT_FOUND" });
  expect(await api.comments.remove({ session: other.session, comment })).toEqual({ error: "NOT_FOUND" });
  ok(await api.groups.join({ session: other.session, group }));
  expect(await api.comments.edit({ session: owner.session, comment, text: "organizer edit" })).toEqual({ error: "NOT_COMMENT_AUTHOR" });
  expect(await api.comments.remove({ session: other.session, comment })).toEqual({ error: "NOT_COMMENT_MODERATOR" });
  expect(ok(await api.comments.list({ session: member.session, event })).comments[0]).toMatchObject({ author: member.user, username: "member", text: "<script>alert(1)</script>\nMeet here", canEdit: true, canRemove: true });
  expect(ok(await api.comments.list({ session: owner.session, event })).comments[0]).toMatchObject({ canEdit: false, canRemove: true });
  expect(ok(await api.comments.list({ session: other.session, event })).comments[0]).toMatchObject({ canEdit: false, canRemove: false });
  ok(await api.comments.edit({ session: member.session, comment, text: "Changed" }));
  const edited = ok(await api.comments.list({ session: member.session, event })).comments[0]!;
  ok(await api.comments.edit({ session: member.session, comment, text: " Changed " }));
  expect(ok(await api.comments.list({ session: member.session, event })).comments[0]).toEqual(edited);
  ok(await api.comments.remove({ session: owner.session, comment }));
  expect(await api.comments.remove({ session: owner.session, comment })).toEqual({ error: "NOT_FOUND" });
});

test("canceled events keep discussions open; departure retains comments and rejoining restores controls", async () => {
  const { api, owner, member, event, group } = await fixture();
  ok(await api.events.remove({ session: owner.session, event }));
  const { comment } = ok(await api.comments.post({ session: member.session, event, text: "Still discussing" }));
  ok(await api.comments.edit({ session: member.session, comment, text: "After cancellation" }));
  ok(await api.groups.leave({ session: member.session, group }));
  expect(await api.comments.edit({ session: member.session, comment, text: "Cannot" })).toEqual({ error: "NOT_FOUND" });
  expect(await api.comments.list({ session: member.session, event })).toEqual({ error: "NOT_FOUND" });
  expect(ok(await api.comments.list({ session: owner.session, event })).comments).toHaveLength(1);
  ok(await api.groups.join({ session: member.session, group }));
  expect(ok(await api.comments.list({ session: member.session, event })).comments[0]).toMatchObject({ canEdit: true, canRemove: true });
  ok(await api.comments.remove({ session: member.session, comment }));
  expect(await api.comments.list({ session: member.session, event })).toEqual({ comments: [] });
});

test("blank and oversized comments fail without changes; duplicate posts are distinct and notify Going members", async () => {
  const { api, owner, member, event } = await fixture();
  ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  for (const text of [" ", "x".repeat(2001)]) expect(await api.comments.post({ session: member.session, event, text })).toEqual({ error: "INVALID_COMMENT_TEXT" });
  const first = ok(await api.comments.post({ session: member.session, event, text: "x".repeat(2000) }));
  const second = ok(await api.comments.post({ session: member.session, event, text: "x".repeat(2000) }));
  expect(first.comment).not.toBe(second.comment);
  expect(await api.comments.edit({ session: member.session, comment: first.comment, text: "\n" })).toEqual({ error: "INVALID_COMMENT_TEXT" });
  expect(ok(await api.comments.list({ session: member.session, event })).comments).toHaveLength(2);
  expect(ok(await api.notifications.list({ session: owner.session })).notifications).toHaveLength(2);
});

test("posting and departure serialize in both orders without restoring access or removing authored comments", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const { api, owner, member, event, group } = await fixture(instances => {
    const originalPost = instances.Commenting.post.bind(instances.Commenting);
    instances.Commenting.post = async function post(input) { entered(); await gate; return originalPost(input); };
  });
  const posting = api.comments.post({ session: member.session, event, text: "Accepted before departure" });
  try {
    await started;
    const leaving = api.groups.leave({ session: member.session, group });
    release();
    const { comment } = ok(await posting);
    ok(await leaving);
    expect(ok(await api.comments.list({ session: owner.session, event })).comments).toMatchObject([{ comment }]);
    expect(await api.comments.list({ session: member.session, event })).toEqual({ error: "NOT_FOUND" });
    ok(await api.groups.join({ session: member.session, group }));
    const departing = api.groups.leave({ session: member.session, group });
    const denied = api.comments.post({ session: member.session, event, text: "Too late" });
    ok(await departing);
    expect(await denied).toEqual({ error: "NOT_FOUND" });
    expect(ok(await api.comments.list({ session: owner.session, event })).comments).toHaveLength(1);
  } finally { release(); }
});

test("top-level comments notify Going members and the organizer once, never their author", async () => {
  const { api, instances, register, owner, member, other, event, group } = await fixture();
  const going = await register("going"), interested = await register("interested"), notGoing = await register("notgoing");
  for (const account of [going, interested, notGoing]) ok(await api.groups.join({ session: account.session, group }));
  ok(await api.plans.mark({ session: going.session, event, intent: "GOING" }));
  ok(await api.plans.mark({ session: interested.session, event, intent: "INTERESTED" }));
  ok(await api.plans.mark({ session: notGoing.session, event, intent: "NOT_GOING" }));
  await instances.EventMarking.mark({ user: other.user, event, intent: "GOING" }); // Nonmember defense.
  const root = ok(await api.comments.post({ session: member.session, event, text: "Question" })).comment;
  const firstInbox = ok(await api.notifications.list({ session: owner.session })); // Unmarked organizer.
  expect(firstInbox.notifications).toMatchObject([{ event, comment: root, message: "New comment.", read: false }]);
  expect(firstInbox.unreadCount).toBe(1);
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toMatchObject([{ comment: root, message: "New comment." }]);
  for (const account of [member, interested, notGoing, other]) {
    expect(await instances.Notifying._getNotifications({ user: account.user })).toEqual([]);
  }
  ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  const second = ok(await api.comments.post({ session: member.session, event, text: "Again" })).comment;
  expect(ok(await api.notifications.list({ session: owner.session })).notifications.filter(row => row.comment === second)).toHaveLength(1);
  ok(await api.comments.post({ session: owner.session, event, text: "From the organizer" }));
  expect(ok(await api.notifications.list({ session: owner.session })).notifications).toHaveLength(2);
  ok(await api.comments.edit({ session: member.session, comment: root, text: "Edited question" }));
  expect(ok(await api.notifications.list({ session: going.session })).notifications).toHaveLength(3);
});

test("replies notify only the replied-to author, whatever their intention", async () => {
  const { api, instances, register, owner, member, event, group } = await fixture();
  const going = await register("going");
  ok(await api.groups.join({ session: going.session, group }));
  ok(await api.plans.mark({ session: going.session, event, intent: "GOING" }));
  ok(await api.plans.mark({ session: member.session, event, intent: "INTERESTED" }));
  const root = ok(await api.comments.post({ session: member.session, event, text: "Question" })).comment;
  const before = (await instances.Notifying._getNotifications({ user: going.user })).length;
  const reply = ok(await api.comments.reply({ session: owner.session, comment: root, text: "Answer" })).comment;
  expect(ok(await api.notifications.list({ session: member.session })).notifications)
    .toMatchObject([{ event, comment: reply, message: "New reply to your comment.", read: false }]);
  expect(await instances.Notifying._getNotifications({ user: going.user })).toHaveLength(before);
  const ownerBefore = (await instances.Notifying._getNotifications({ user: owner.user })).length;
  const nested = ok(await api.comments.reply({ session: going.session, comment: reply, text: "Thanks" })).comment;
  const discussion = ok(await api.comments.list({ session: member.session, event })).comments;
  expect(discussion.find(row => row.comment === root)?.parent).toBe("");
  for (const id of [reply, nested]) expect(discussion.find(row => row.comment === id)?.parent).toBe(root);
  const ownerInbox = await instances.Notifying._getNotifications({ user: owner.user });
  expect(ownerInbox).toHaveLength(ownerBefore + 1);
  expect(ownerInbox.filter(row => row.target === nested)).toMatchObject([{ message: "New reply to your comment." }]);
  expect(ok(await api.notifications.list({ session: member.session })).notifications).toHaveLength(1);
  ok(await api.comments.reply({ session: member.session, comment: root, text: "Talking to myself" }));
  expect(ok(await api.notifications.list({ session: member.session })).notifications).toHaveLength(1);
  ok(await api.events.remove({ session: owner.session, event }));
  ok(await api.comments.reply({ session: owner.session, comment: root, text: "After cancellation" }));
  expect(ok(await api.notifications.list({ session: member.session })).notifications.filter(row => row.message === "New reply to your comment.")).toHaveLength(2);
});

test("departed authors receive no reply notices; Not Going still clears reply notices", async () => {
  const { api, instances, register, owner, member, event, group } = await fixture();
  const leaver = await register("leaver");
  ok(await api.groups.join({ session: leaver.session, group }));
  const mine = ok(await api.comments.post({ session: leaver.session, event, text: "Before leaving" })).comment;
  const yours = ok(await api.comments.post({ session: member.session, event, text: "Staying" })).comment;
  ok(await api.groups.leave({ session: leaver.session, group }));
  ok(await api.comments.reply({ session: owner.session, comment: mine, text: "Too late" }));
  expect(await instances.Notifying._getNotifications({ user: leaver.user })).toEqual([]);
  ok(await api.comments.reply({ session: owner.session, comment: yours, text: "Answer" }));
  expect(ok(await api.notifications.list({ session: member.session })).notifications).toHaveLength(1);
  ok(await api.plans.mark({ session: member.session, event, intent: "NOT_GOING" }));
  expect(ok(await api.notifications.list({ session: member.session })).notifications).toEqual([]);
});

test("reply permissions and validation refuse without comments or notices; thread deletion clears only its targets", async () => {
  const { api, register, owner, member, other, event, group } = await fixture();
  const observer = await register("observer");
  ok(await api.groups.join({ session: observer.session, group }));
  for (const account of [owner, observer]) ok(await api.plans.mark({ session: account.session, event, intent: "GOING" }));
  const root = ok(await api.comments.post({ session: member.session, event, text: "Root" })).comment;
  const before = await api.comments.list({ session: owner.session, event });
  const inbox = await api.notifications.list({ session: owner.session });
  expect(await api.comments.reply({ session: other.session, comment: root, text: "Hidden" })).toEqual({ error: "NOT_FOUND" });
  expect(await api.comments.reply({ session: member.session, comment: "missing" as typeof root, text: "Missing" })).toEqual({ error: "NOT_FOUND" });
  for (const text of [" ", "x".repeat(2001)]) {
    expect(await api.comments.reply({ session: member.session, comment: root, text })).toEqual({ error: "INVALID_COMMENT_TEXT" });
  }
  expect(await api.comments.list({ session: owner.session, event })).toEqual(before);
  expect(await api.notifications.list({ session: owner.session })).toEqual(inbox);
  const reply = ok(await api.comments.reply({ session: owner.session, comment: root, text: "Answer" })).comment;
  const another = ok(await api.comments.reply({ session: member.session, comment: reply, text: "Thanks" })).comment;
  expect(await api.comments.edit({ session: member.session, comment: reply, text: "Not mine" })).toEqual({ error: "NOT_COMMENT_AUTHOR" });
  expect(await api.comments.remove({ session: observer.session, comment: root })).toEqual({ error: "NOT_COMMENT_MODERATOR" });
  ok(await api.comments.remove({ session: owner.session, comment: reply }));
  expect(ok(await api.comments.list({ session: owner.session, event })).comments.map(row => row.comment).sort()).toEqual([root, another].sort());
  expect(ok(await api.notifications.list({ session: observer.session })).notifications.map(row => row.comment)).toEqual([root]);
  const keep = ok(await api.comments.post({ session: member.session, event, text: "Unrelated" })).comment;
  ok(await api.events.revise({ session: owner.session, event, ...fields, location: "New room" }));
  ok(await api.comments.remove({ session: member.session, comment: root }));
  expect(ok(await api.comments.list({ session: owner.session, event })).comments).toMatchObject([{ comment: keep }]);
  const remaining = ok(await api.notifications.list({ session: observer.session })).notifications;
  expect(remaining.map(row => row.comment).sort()).toEqual(["", keep].sort());
  expect(await api.comments.reply({ session: member.session, comment: another, text: "Gone" })).toEqual({ error: "NOT_FOUND" });
  const deletedNotice = ok(inbox).notifications[0]!;
  expect(await api.notifications.read({ session: owner.session, notification: deletedNotice.notification })).toEqual({ error: "NOT_FOUND" });
});

test("cleanup failure prevents thread deletion; later deletion failure leaves notices cleared and permits retry", async () => {
  let failCleanup = true, failRemoval = false;
  const { api, owner, member, event } = await fixture(instances => {
    const clear = instances.Notifying.clearTargets.bind(instances.Notifying);
    const originalRemove = instances.Commenting.remove.bind(instances.Commenting);
    instances.Notifying.clearTargets = async function clearTargets(input) {
      if (failCleanup) throw new Error("cleanup unavailable");
      return clear(input);
    };
    instances.Commenting.remove = async function remove(input) {
      if (failRemoval) throw new Error("deletion unavailable");
      return originalRemove(input);
    };
  });
  ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  const root = ok(await api.comments.post({ session: member.session, event, text: "Root" })).comment;
  ok(await api.comments.reply({ session: member.session, comment: root, text: "Reply" }));
  expect(await api.comments.remove({ session: member.session, comment: root })).toEqual({ error: "INTERNAL_ERROR" });
  expect(ok(await api.comments.list({ session: owner.session, event })).comments).toHaveLength(2);
  expect(ok(await api.notifications.list({ session: owner.session })).notifications).toHaveLength(1);
  failCleanup = false; failRemoval = true;
  expect(await api.comments.remove({ session: member.session, comment: root })).toEqual({ error: "INTERNAL_ERROR" });
  expect(ok(await api.comments.list({ session: owner.session, event })).comments).toHaveLength(2);
  expect(ok(await api.notifications.list({ session: owner.session })).notifications).toHaveLength(0);
  failRemoval = false;
  ok(await api.comments.remove({ session: member.session, comment: root }));
  expect(ok(await api.comments.list({ session: owner.session, event })).comments).toEqual([]);
});

test("reply and root deletion serialize through delivery; reversing order refuses the reply", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const { api, owner, member, event } = await fixture(instances => {
    const originalReply = instances.Commenting.reply.bind(instances.Commenting);
    instances.Commenting.reply = async function reply(input) { entered(); await gate; return originalReply(input); };
  });
  ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  const root = ok(await api.comments.post({ session: member.session, event, text: "Root" })).comment;
  const replying = api.comments.reply({ session: member.session, comment: root, text: "Accepted" });
  try {
    await started;
    const removing = api.comments.remove({ session: member.session, comment: root });
    release();
    ok(await replying); ok(await removing);
    expect(await api.comments.list({ session: owner.session, event })).toEqual({ comments: [] });
    expect(await api.notifications.list({ session: owner.session })).toEqual({ notifications: [], unreadCount: 0 });
    const next = ok(await api.comments.post({ session: member.session, event, text: "Next" })).comment;
    const deletion = api.comments.remove({ session: member.session, comment: next });
    const denied = api.comments.reply({ session: member.session, comment: next, text: "Too late" });
    ok(await deletion);
    expect(await denied).toEqual({ error: "NOT_FOUND" });
  } finally { release(); }
});

test("comment delivery failure retains the post and reports failure instead of false success", async () => {
  const { api, owner, member, event } = await fixture(instances => {
    instances.Notifying.send = async function send() { throw new Error("delivery unavailable"); };
  });
  ok(await api.plans.mark({ session: owner.session, event, intent: "GOING" }));
  expect(await api.comments.post({ session: member.session, event, text: "Persisted" })).toEqual({ error: "INTERNAL_ERROR" });
  expect(ok(await api.comments.list({ session: owner.session, event })).comments).toMatchObject([{ text: "Persisted" }]);
});
