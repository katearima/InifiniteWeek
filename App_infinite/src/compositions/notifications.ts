import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, is, no, now, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { canReadEvent, isMember } from "./access.ts";
import { inputs } from "./reusable/inputs.ts";
const { Sessioning, Notifying, EventPublishing, EventMarking, Commenting } = concepts;

export const recipients = view("notification recipients for (event) excluding (organizer)", ({ event, organizer }, { user }, { group, intent }) =>
  where(EventPublishing._getEventDetails({ event }).is({ group, organizer }),
    EventMarking._getMarksByEvent({ event }).is({ user, intent }), is.among(intent, ["GOING", "INTERESTED"]),
    no(EventPublishing._getEventDetails({ event }).is({ organizer: user })), isMember({ user, group }))).many();
const commentRecipients = view("recipients of comment (comment) on (event)", ({ event, comment }, { user }, { group }) => [
  where(EventPublishing._getEventDetails({ event }).is({ group }),
    EventMarking._getMarksByEvent({ event }).is({ user, intent: "GOING" }),
    Commenting._getComment({ comment }).is.not({ author: user }), isMember({ user, group })),
  where(EventPublishing._getEventDetails({ event }).is({ group, organizer: user }),
    no(EventMarking._getMarksByEvent({ event }).is({ user, intent: "GOING" })),
    Commenting._getComment({ comment }).is.not({ author: user }), isMember({ user, group })),
]).many();
const replyRecipient = view("author of (parent) to notify of reply (comment)", ({ parent, comment }, { user, event }) =>
  where(Commenting._getComment({ comment: parent }).is({ author: user, subject: event }),
    Commenting._getComment({ comment }).is.not({ author: user }), canReadEvent({ user, event }))).many();
const rows = former("inbox for (user)", ({ user }, { notification, event, message, createdAt, read, title, comment }) =>
  each(Notifying._getNotifications({ user }).is({ notification, subject: event, message, createdAt, read, target: comment }))
    .where(canReadEvent({ user, event }), EventPublishing._getEventDetails({ event }).is({ title }))
    .form({ notification, event, title, message, createdAt, read, comment }));
const unread = former("unread inbox total for (user)", ({ user }, { notification, event }) =>
  each(Notifying._getNotifications({ user }).is({ notification, subject: event, read: false }))
    .where(canReadEvent({ user, event })).count());
const List = endpoint("/notifications/list", ({ session, user }) => receive({ session })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(respond({ notifications: rows({ user }), unreadCount: unread({ user }) })), inputs());
const Read = endpoint("/notifications/read", ({ session, user, notification, event }) => receive({ session, notification })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(Notifying._getNotification({ user, notification }).is({ subject: event }), canReadEvent({ user, event }))
      .then(Notifying.markRead({ user, notification }).responds({})).then(respond({ notification })).named("owned"),
    where(no(Notifying._getNotification({ user, notification }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
    where(Notifying._getNotification({ user, notification }).is({ subject: event }), no(canReadEvent({ user, event })))
      .then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ notification: "text" }));
const Dismiss = endpoint("/notifications/dismiss", ({ session, user, notification, event }) => receive({ session, notification })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(Notifying._getNotification({ user, notification }).is({ subject: event }), canReadEvent({ user, event }))
      .then(Notifying.dismiss({ user, notification }).responds({})).then(respond({ notification })).named("owned"),
    where(no(Notifying._getNotification({ user, notification }))).then(respond({ error: "NOT_FOUND" })).named("missing"),
    where(Notifying._getNotification({ user, notification }).is({ subject: event }), no(canReadEvent({ user, event })))
      .then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ notification: "text" }));
const ReadAll = endpoint("/notifications/read-all", ({ session, user }) => receive({ session })
  .then(Sessioning.use({ session }).responds({ subject: user }))
  .then(Notifying.markAllRead({ user }).responds({})).then(respond({})), inputs());
const EventRevised = reaction(({ event, organizer, user, notification, at }) =>
  when(EventPublishing.revise({ user: organizer, event }).responds({ timeOrLocationChanged: true }))
    .where(recipients({ event, organizer }).is({ user }), now(at), compute(computations.newIdentity, {}, notification))
    .then(Notifying.send({ user, subject: event, message: "Event updated.", notification, at })));
const EventCanceled = reaction(({ event, organizer, user, notification, at }) =>
  when(EventPublishing.remove({ user: organizer, event }).responds({}))
    .where(recipients({ event, organizer }).is({ user }), now(at), compute(computations.newIdentity, {}, notification))
    .then(Notifying.send({ user, subject: event, message: "Event canceled.", notification, at })));
const CommentPosted = reaction(({ event, author, comment, user, notification, at }) =>
  when(Commenting.post({ author, subject: event }).responds({ comment }))
    .where(commentRecipients({ event, comment }).is({ user }), now(at), compute(computations.newIdentity, {}, notification))
    .then(Notifying.send({ user, subject: event, target: comment, message: "New comment.", notification, at })));
const CommentReplied = reaction(({ event, author, parent, comment, user, notification, at }) =>
  when(Commenting.reply({ author, parent }).responds({ comment }))
    .where(replyRecipient({ parent, comment }).is({ user, event }), now(at), compute(computations.newIdentity, {}, notification))
    .then(Notifying.send({ user, subject: event, target: comment, message: "New reply to your comment.", notification, at })));
export const composition = { recipients, commentRecipients, replyRecipient, rows, unread, List, Read, ReadAll, Dismiss, EventRevised, EventCanceled, CommentPosted, CommentReplied };
