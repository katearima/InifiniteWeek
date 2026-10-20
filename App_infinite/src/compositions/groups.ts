import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { isMember, organizesActiveEvent } from "./access.ts";
import { inputs } from "./reusable/inputs.ts";
const { Registering, Sessioning, Grouping, EventPublishing, EventMarking, Notifying } = concepts;

export const summary = former("summary of (group) for (user)", ({ group, user }, { name, description, policy, member, pending }) =>
  where(
    Grouping._getGroupDetails({ group }).is({ name, description, policy }),
    Grouping._isMember({ user, group }).is({ member }),
    Grouping._isPending({ user, group }).is({ pending }),
  ).form({ group, name, description, policy, member, pending }));
const summaries = former("group summaries for (user)", ({ user }, { group }) =>
  each(Grouping._getGroups({}).is({ group })).form({}).splicing(summary({ user, group })));
const members = former("members of (group) for (user)", ({ user, group }, { person, username }) =>
  each(Grouping._getMembers({ group }).is({ user: person }))
    .where(isMember({ user, group }), whether(Registering._username({ user: person }).is({ username })))
    .form({ user: person, username }));
const requests = former("requests for (group) seen by (user)", ({ user, group }, { person, username }) =>
  each(Grouping._getPendingRequests({ group }).is({ user: person }))
    .where(isMember({ user, group }), whether(Registering._username({ user: person }).is({ username })))
    .form({ user: person, username }));
const eventRows = former("event identities in (group)", ({ group }, { event }) =>
  form({ events: each(EventPublishing._getEventsByGroup({ group }).is({ event })).form({ event }) }));

const List = endpoint("/groups/list", ({ session, user }) => receive({ session })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(respond({ groups: summaries({ user }) })), inputs());
const Details = endpoint("/groups/details", ({ session, user, group }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(Grouping._getGroupDetails({ group })).then(respond({ group: summary({ user, group }) })).named("found"),
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
  ), inputs({ group: "text" }));
const Members = endpoint("/groups/members", ({ session, user, group }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(isMember({ user, group })).then(respond({ members: members({ user, group }) })).named("member"),
    where(Grouping._getGroupDetails({ group }), no(isMember({ user, group }))).then(respond({ error: "NOT_GROUP_MEMBER" })).named("outsider"),
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
  ), inputs({ group: "text" }));
const Requests = endpoint("/groups/requests", ({ session, user, group }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(isMember({ user, group })).then(respond({ requests: requests({ user, group }) })).named("member"),
    where(Grouping._getGroupDetails({ group }), no(isMember({ user, group }))).then(respond({ error: "NOT_GROUP_MEMBER" })).named("outsider"),
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
  ), inputs({ group: "text" }));
const Create = endpoint("/groups/create", ({ session, user, name, description, policy, group }) => receive({ session, name, description, policy })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(Grouping.createGroup({ user, name, description, policy }).responds({ group })).then(respond({ group })),
  inputs({ name: "text", description: "text", policy: "policy" }));
const Join = endpoint("/groups/join", ({ session, user, group, status }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(Grouping.join({ user, group }).responds({ status })).then(respond({ group, status })), inputs({ group: "text" }));
const Approve = endpoint("/groups/approve", ({ session, user, group, requester }) => receive({ session, group, requester })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(Grouping.approve({ user, group, requester }).responds({})).then(respond({ group, requester })), inputs({ group: "text", requester: "text" }));
const Reject = endpoint("/groups/reject", ({ session, user, group, requester }) => receive({ session, group, requester })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(Grouping.reject({ user, group, requester }).responds({})).then(respond({ group, requester })), inputs({ group: "text", requester: "text" }));
const ChangePolicy = endpoint("/groups/policy", ({ session, user, group, policy }) => receive({ session, group, policy })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(Grouping.changePolicy({ user, group, policy }).responds({})).then(respond({ group, policy })), inputs({ group: "text", policy: "policy" }));
const Leave = endpoint("/groups/leave", ({ session, user, group, events }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "LEAVE_GROUP_NOT_FOUND" })).named("missing"),
    where(Grouping._getGroupDetails({ group }), no(isMember({ user, group }))).then(respond({ error: "LEAVE_NOT_MEMBER" })).named("outsider"),
    where(isMember({ user, group }), organizesActiveEvent({ user, group })).then(respond({ error: "ACTIVE_EVENTS_PREVENT_LEAVING" })).named("organizer"),
    where(isMember({ user, group }), no(organizesActiveEvent({ user, group })),
      EventPublishing._getEventCollection({ group }).is({ events }))
      .then(Notifying.clear({ user, subjects: events }).responds({}))
      .then(EventMarking.clearMarks({ user, events }).responds({}))
      .then(Grouping.leave({ user, group }).responds({})).then(respond({ group })).named("leave"),
  ), inputs({ group: "text" }));
const Delete = endpoint("/groups/delete", ({ session, user, group, events }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "DELETE_GROUP_NOT_FOUND" })).named("missing"),
    where(Grouping._getGroupDetails({ group }), no(isMember({ user, group }))).then(respond({ error: "DELETE_NOT_MEMBER" })).named("outsider"),
    where(isMember({ user, group }), Grouping._isOnlyMember({ user, group }).is({ only: false })).then(respond({ error: "DELETE_NOT_LAST_MEMBER" })).named("shared"),
    where(Grouping._isOnlyMember({ user, group }).is({ only: true }), organizesActiveEvent({ user, group })).then(respond({ error: "ACTIVE_EVENTS_PREVENT_DELETION" })).named("organizer"),
    where(Grouping._isOnlyMember({ user, group }).is({ only: true }), no(organizesActiveEvent({ user, group })), EventPublishing._getEventCollection({ group }).is({ events }))
      .then(Notifying.clear({ user, subjects: events }).responds({}))
      .then(EventMarking.clearMarks({ user, events }).responds({}))
      .then(Grouping.deleteGroup({ user, group }).responds({})).then(respond({ group })).named("delete"),
  ), inputs({ group: "text" }));
const Picture = endpoint("/groups/picture", ({ session, user, group, picture }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(Grouping._getPicture({ group }).is({ picture })).then(respond({ picture })).named("found"),
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
  ), inputs({ group: "text" }));
const SetPicture = endpoint("/groups/set-picture", ({ session, user, group, picture }) => receive({ session, group, picture })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(isMember({ user, group })).then(Grouping.setPicture({ user, group, picture }).responds({})).then(respond({ group })).named("member"),
    where(Grouping._getGroupDetails({ group }), no(isMember({ user, group }))).then(respond({ error: "NOT_GROUP_MEMBER" })).named("outsider"),
    where(no(Grouping._getGroupDetails({ group }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
  ), inputs({ group: "text", picture: "text" }));
export const composition = { Picture, SetPicture, Delete, List, Details, Members, Requests, Create, Join, Approve, Reject, ChangePolicy, Leave, summaries, summary, members, requests, eventRows };
