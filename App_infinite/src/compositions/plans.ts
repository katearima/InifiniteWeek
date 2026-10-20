import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, is, no, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { canReadEvent, canMarkEvent } from "./access.ts";
import { details } from "./events.ts";
import { inputs } from "./reusable/inputs.ts";
const { Sessioning, EventMarking, EventPublishing, Grouping, Notifying } = concepts;
const savedEvents = former("saved events for (user)", ({ user }, { event, group, referencedGroup, start, order }) =>
  each(EventMarking._getMyEvents({ user }).is({ event }))
    .where(whether(EventPublishing._getEventDetails({ event }).is({ group: referencedGroup, start })),
      compute(computations.requireEventGroup, { group: referencedGroup }, group),
      compute(computations.eventSortKey, { start, event }, order),
      no(Grouping._isMember({ user, group }).is({ member: false })))
    .arranged(order, "ascending").form({}).splicing(details({ user, event })));
const Mark = endpoint("/plans/mark", ({ session, user, event, intent, subjects }) => receive({ session, event, intent })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canMarkEvent({ user, event }), is.among(intent, ["GOING", "INTERESTED"]))
      .then(EventMarking.mark({ user, event, intent }).responds({})).then(respond({ event, intent })).named("save"),
    where(canMarkEvent({ user, event }), is.among(intent, ["NOT_GOING"]), compute(computations.eventSubjects, { event }, subjects))
      .then(Notifying.clear({ user, subjects }).responds({}))
      .then(EventMarking.mark({ user, event, intent }).responds({})).then(respond({ event, intent })).named("decline"),
    where(canReadEvent({ user, event }), no(canMarkEvent({ user, event }))).then(respond({ error: "EVENT_CANCELED" })).named("canceled"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text", intent: "intent" }));
const Remove = endpoint("/plans/remove", ({ session, user, event, subjects }) => receive({ session, event })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canReadEvent({ user, event }), EventMarking._isMarked({ user, event }).is({ marked: true }), compute(computations.eventSubjects, { event }, subjects))
      .then(Notifying.clear({ user, subjects }).responds({}))
      .then(EventMarking.removeMark({ user, event }).responds({})).then(respond({ event })).named("remove"),
    where(canReadEvent({ user, event }), EventMarking._isMarked({ user, event }).is({ marked: false }))
      .then(respond({ error: "NO_MARK_TO_REMOVE" })).named("absent"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text" }));
const MyPlans = endpoint("/plans/list", ({ session, user }) => receive({ session })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(respond({ events: savedEvents({ user }) })), inputs());
export const composition = { Mark, Remove, MyPlans, savedEvents };
