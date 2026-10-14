import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, no, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { canReadEvent, canManageEvent, isMember } from "./access.ts";
import { inputs } from "./reusable/inputs.ts";
const { Registering, Sessioning, Grouping, EventPublishing, EventMarking } = concepts;
export const details = former("details of (event) for (user)", ({ user, event }, { organizer, organizerUsername, group, title, description, start, end, location, canceled, timeChanged, previousStart, previousEnd, intent }) =>
  where(canReadEvent({ user, event }),
    EventPublishing._getEventDetails({ event }).is({ organizer, group, title, description, start, end, location, canceled, timeChanged, previousStart, previousEnd }),
    Registering._username({ user: organizer }).is({ username: organizerUsername }),
  ).form({ event, organizer, organizerUsername, group, title, description, start, end, location, canceled, timeChanged, previousStart, previousEnd,
    intent: each(EventMarking._getMarksByEvent({ event }).is({ user, intent })).first(intent),
  }));
const exploreRows = former("explorable events for (user)", ({ user }, { group, event, start, order }) =>
  each(Grouping._getGroupsByUser({ user }).is({ group }))
    .where(EventPublishing._getEventsByGroup({ group }).is({ event }),
      whether(EventPublishing._getEventDetails({ event }).is({ start })),
      no(EventPublishing._getEventDetails({ event }).is({ canceled: true })),
      compute(computations.eventSortKey, { start, event }, order))
    .arranged(order, "ascending").form({}).splicing(details({ user, event })));
const groupRows = former("events in (group) for (user)", ({ user, group }, { event, start, order }) =>
  each(EventPublishing._getEventsByGroup({ group }).is({ event }))
    .where(isMember({ user, group }), whether(EventPublishing._getEventDetails({ event }).is({ start })),
      no(EventPublishing._getEventDetails({ event }).is({ canceled: true })),
      compute(computations.eventSortKey, { start, event }, order))
    .arranged(order, "ascending").form({}).splicing(details({ user, event })));
const going = former("going attendees of (event) for (user)", ({ user, event }, { person, username, group }) =>
  each(EventMarking._getMarksByEvent({ event }).is({ user: person, intent: "GOING" }))
    .where(canManageEvent({ user, event }), EventPublishing._getEventDetails({ event }).is({ group }), isMember({ user: person, group }),
      whether(Registering._username({ user: person }).is({ username })))
    .form({ user: person, username }));
const interested = former("interested attendees of (event) for (user)", ({ user, event }, { person, username, group }) =>
  each(EventMarking._getMarksByEvent({ event }).is({ user: person, intent: "INTERESTED" }))
    .where(canManageEvent({ user, event }), EventPublishing._getEventDetails({ event }).is({ group }), isMember({ user: person, group }),
      whether(Registering._username({ user: person }).is({ username })))
    .form({ user: person, username }));
const Explore = endpoint("/events/explore", ({ session, user }) => receive({ session })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(respond({ events: exploreRows({ user }) })), inputs());
const GroupEvents = endpoint("/events/group", ({ session, user, group }) => receive({ session, group })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(isMember({ user, group })).then(respond({ events: groupRows({ user, group }) })).named("member"),
    where(no(isMember({ user, group }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ group: "text" }));
const Details = endpoint("/events/details", ({ session, user, event }) => receive({ session, event })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canReadEvent({ user, event })).then(respond({ event: details({ user, event }) })).named("readable"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text" }));
const Publish = endpoint("/events/publish", ({ session, user, group, title, description, start, end, location, event, startDate, endDate }) => receive({ session, group, title, description, start, end, location })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(isMember({ user, group }), compute(computations.eventDate, { value: start }, startDate), compute(computations.eventDate, { value: end }, endDate)).then(EventPublishing.publish({ organizer: user, group, title, description, start: startDate, end: endDate, location }).responds({ event }))
      .then(respond({ event })).named("member"),
    where(no(isMember({ user, group }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ group: "text", title: "text", description: "text", start: "date", end: "date", location: "text" }));
const Revise = endpoint("/events/revise", ({ session, user, event, title, description, start, end, location, startDate, endDate }) => receive({ session, event, title, description, start, end, location })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canManageEvent({ user, event }), compute(computations.eventDate, { value: start }, startDate), compute(computations.eventDate, { value: end }, endDate)).then(EventPublishing.revise({ user, event, title, description, start: startDate, end: endDate, location }).responds({}))
      .then(respond({ event })).named("owner"),
    where(canReadEvent({ user, event }), no(canManageEvent({ user, event }))).then(respond({ error: "NOT_EVENT_ORGANIZER" })).named("other"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text", title: "text", description: "text", start: "date", end: "date", location: "text" }));
const Remove = endpoint("/events/remove", ({ session, user, event }) => receive({ session, event })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canManageEvent({ user, event })).then(EventPublishing.remove({ user, event }).responds({})).then(respond({ event })).named("owner"),
    where(canReadEvent({ user, event }), no(canManageEvent({ user, event }))).then(respond({ error: "NOT_EVENT_ORGANIZER" })).named("other"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text" }));
const Attendees = endpoint("/events/attendees", ({ session, user, event }) => receive({ session, event })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canManageEvent({ user, event })).then(respond({ going: going({ user, event }), interested: interested({ user, event }) })).named("owner"),
    where(canReadEvent({ user, event }), no(canManageEvent({ user, event }))).then(respond({ error: "NOT_EVENT_ORGANIZER" })).named("other"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text" }));
export const composition = { Explore, GroupEvents, Details, Publish, Revise, Remove, Attendees, details, exploreRows, groupRows, going, interested };
