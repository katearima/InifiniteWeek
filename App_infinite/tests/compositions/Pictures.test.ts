import { expect, test } from "bun:test";
import { cleanup, fields, ok, setup } from "./support.ts";
import { samplePicture } from "../support/picture.ts";
cleanup();

test("picture APIs preserve event privacy and group discovery; membership controls edits and no notices are sent", async () => {
  const { api } = await setup();
  const owner = ok(await api.auth.register({ username: "owner", password: "correct-password" }));
  const member = ok(await api.auth.register({ username: "member", password: "correct-password" }));
  const outsider = ok(await api.auth.register({ username: "outsider", password: "correct-password" }));
  const { group } = ok(await api.groups.create({ session: owner.session, name: "Pictures", description: "", policy: "OPEN" }));
  const { event } = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  expect(await api.events.picture({ session: owner.session, event })).toEqual({ picture: "" });
  ok(await api.groups.join({ session: member.session, group }));
  ok(await api.groups["set-picture"]({ session: member.session, group, picture: samplePicture }));
  expect(await api.groups.picture({ session: outsider.session, group })).toEqual({ picture: samplePicture });
  expect(await api.groups["set-picture"]({ session: outsider.session, group, picture: "" })).toEqual({ error: "NOT_GROUP_MEMBER" });
  expect(await api.events.picture({ session: outsider.session, event })).toEqual({ error: "NOT_FOUND" });
  expect(await api.events["set-picture"]({ session: outsider.session, event, picture: samplePicture })).toEqual({ error: "NOT_FOUND" });
  expect(await api.events["set-picture"]({ session: member.session, event, picture: samplePicture })).toEqual({ error: "NOT_EVENT_ORGANIZER" });
  ok(await api.plans.mark({ session: member.session, event, intent: "GOING" }));
  ok(await api.events["set-picture"]({ session: owner.session, event, picture: samplePicture }));
  expect(await api.events.picture({ session: member.session, event })).toEqual({ picture: samplePicture });
  expect(await api.notifications.list({ session: member.session })).toEqual({ notifications: [], unreadCount: 0 });
  ok(await api.groups.leave({ session: member.session, group }));
  expect(await api.events.picture({ session: member.session, event })).toEqual({ error: "NOT_FOUND" });
  expect(await api.groups["set-picture"]({ session: member.session, group, picture: "" })).toEqual({ error: "NOT_GROUP_MEMBER" });
  ok(await api.groups.join({ session: member.session, group }));
  expect(await api.events.picture({ session: member.session, event })).toEqual({ picture: samplePicture });
  ok(await api.events.remove({ session: owner.session, event }));
  expect(await api.events["set-picture"]({ session: owner.session, event, picture: "" })).toEqual({ error: "EVENT_CANCELED_FOR_REVISION" });
  expect(await api.events.picture({ session: member.session, event })).toEqual({ picture: samplePicture });
  ok(await api.groups.leave({ session: member.session, group }));
  ok(await api.groups.delete({ session: owner.session, group }));
  expect(await api.groups.picture({ session: owner.session, group })).toEqual({ error: "NOT_FOUND" });
  expect(await api.events.picture({ session: owner.session, event })).toEqual({ error: "NOT_FOUND" });
});

test("a failed upload keeps the created resource; a lost acknowledgement requires reading the committed picture", async () => {
  let failBefore = true;
  const { api } = await setup(instances => {
    const original = instances.EventPublishing.setPicture.bind(instances.EventPublishing);
    instances.EventPublishing.setPicture = async function setPicture(input) {
      if (failBefore) throw new Error("storage unavailable");
      await original(input);
      throw new Error("acknowledgement lost");
    };
  });
  const owner = ok(await api.auth.register({ username: "owner", password: "correct-password" }));
  const { group } = ok(await api.groups.create({ session: owner.session, name: "Photos", description: "", policy: "OPEN" }));
  const { event } = ok(await api.events.publish({ session: owner.session, group, ...fields }));
  const input = { session: owner.session, event, picture: samplePicture };
  expect(await api.events["set-picture"](input)).toEqual({ error: "INTERNAL_ERROR" });
  expect(await api.events.picture({ session: owner.session, event })).toEqual({ picture: "" });
  expect(ok(await api.events.details({ session: owner.session, event })).event.title).toBe(fields.title);
  failBefore = false;
  expect(await api.events["set-picture"](input)).toEqual({ error: "INTERNAL_ERROR" });
  expect(await api.events.picture({ session: owner.session, event })).toEqual({ picture: samplePicture });
  expect(ok(await api.events.group({ session: owner.session, group })).events).toHaveLength(1);
});
