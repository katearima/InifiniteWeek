import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, no, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { canReadEvent, canMarkEvent } from "./access.ts";
import { details } from "./events.ts";
import { inputs } from "./reusable/inputs.ts";
const { Sessioning, EventMarking, EventPublishing, Grouping } = concepts;
const savedEvents = former("saved events for (user)", ({ user }, { event, group, referencedGroup, start, order }) =>
  each(EventMarking._getMyEvents({ user }).is({ event }))
    .where(whether(EventPublishing._getEventDetails({ event }).is({ group: referencedGroup, start })),
      compute(computations.requireEventGroup, { group: referencedGroup }, group),
      compute(computations.eventSortKey, { start, event }, order),
      no(Grouping._isMember({ user, group }).is({ member: false })))
    .arranged(order, "ascending").form({}).splicing(details({ user, event })));
const Mark = endpoint("/plans/mark", ({ session, user, event, intent }) => receive({ session, event, intent })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canMarkEvent({ user, event })).then(EventMarking.mark({ user, event, intent }).responds({})).then(respond({ event, intent })).named("mark"),
    where(canReadEvent({ user, event }), no(canMarkEvent({ user, event }))).then(respond({ error: "EVENT_CANCELED" })).named("canceled"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text", intent: "intent" }));
const Remove = endpoint("/plans/remove", ({ session, user, event }) => receive({ session, event })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canReadEvent({ user, event })).then(EventMarking.removeMark({ user, event }).responds({})).then(respond({ event })).named("remove"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text" }));
const MyPlans = endpoint("/plans/list", ({ session, user }) => receive({ session })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(respond({ events: savedEvents({ user }) })), inputs());
export const composition = { Mark, Remove, MyPlans, savedEvents };
