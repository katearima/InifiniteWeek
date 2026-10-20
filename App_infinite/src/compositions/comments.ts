import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, no, now, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { canReadEvent, canManageEvent } from "./access.ts";
import { inputs } from "./reusable/inputs.ts";
const { Sessioning, Commenting, Registering, EventPublishing, Notifying } = concepts;

const canRead = view("(user) can read comment (comment)", ({ user, comment }, {}, { event }) =>
  where(Commenting._getComment({ comment }).is({ subject: event }), canReadEvent({ user, event }))).holds();
const canEdit = view("(user) can edit comment (comment)", ({ user, comment }) =>
  where(canRead({ user, comment }), Commenting._getComment({ comment }).is({ author: user }))).holds();
const canRemove = view("(user) can remove comment (comment)", ({ user, comment }, {}, { event }) => [
  where(canRead({ user, comment }), Commenting._getComment({ comment }).is({ author: user })),
  where(Commenting._getComment({ comment }).is({ subject: event }), canManageEvent({ user, event })),
]).holds();
const rows = former("comments on (event) for (user)", ({ user, event }, { comment, parent, author, username, text, createdAt, edited, editedAt, organizer, canEdit: editable, canRemove: removable }) =>
  each(Commenting._getComments({ subject: event }).is({ comment, parent, author, text, createdAt, edited, editedAt }))
    .where(canReadEvent({ user, event }), EventPublishing._getEventDetails({ event }).is({ organizer }),
      whether(Registering._username({ user: author }).is({ username })),
      compute(computations.commentPermissions, { user, author, organizer }, { canEdit: editable, canRemove: removable }))
    .form({ comment, parent, event, author, username, text, createdAt, edited, editedAt, canEdit: editable, canRemove: removable }));
const List = endpoint("/comments/list", ({ session, user, event }) => receive({ session, event })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canReadEvent({ user, event })).then(respond({ comments: rows({ user, event }) })).named("readable"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ event: "text" }));
const Post = endpoint("/comments/post", ({ session, user, event, text, comment, at }) => receive({ session, event, text })
  .where(now(at), compute(computations.newCommentIdentity, {}, comment))
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canReadEvent({ user, event }))
      .then(Commenting.post({ author: user, subject: event, text, comment, at }).responds({ comment }))
      .named("readable"),
    where(no(canReadEvent({ user, event }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ).afterFlowSettles().where(canReadEvent({ user, event })).then(respond({ comment })), inputs({ event: "text", text: "text" }));
const Reply = endpoint("/comments/reply", ({ session, user, comment, text, reply, at }) => receive({ session, comment, text })
  .where(now(at), compute(computations.newCommentIdentity, {}, reply))
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canRead({ user, comment }))
      .then(Commenting.reply({ author: user, parent: comment, text, comment: reply, at }).responds({ comment: reply }))
      .named("readable"),
    where(no(canRead({ user, comment }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ).afterFlowSettles().where(canRead({ user, comment })).then(respond({ comment: reply })), inputs({ comment: "text", text: "text" }));
const Edit = endpoint("/comments/edit", ({ session, user, comment, text, at }) => receive({ session, comment, text })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canEdit({ user, comment }), now(at)).then(Commenting.revise({ user, comment, text, at }).responds({}))
      .then(respond({ comment })).named("author"),
    where(canRead({ user, comment }), no(canEdit({ user, comment }))).then(respond({ error: "NOT_COMMENT_AUTHOR" })).named("other"),
    where(no(canRead({ user, comment }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ comment: "text", text: "text" }));
const Remove = endpoint("/comments/remove", ({ session, user, comment, targets }) => receive({ session, comment })
  .then(Sessioning.use({ session }).responds({ subject: user })).then(
    where(canRemove({ user, comment }), Commenting._removalTargets({ comment }).is({ comments: targets }))
      .then(Notifying.clearTargets({ targets }).responds({}))
      .then(Commenting.remove({ comment }).responds({})).then(respond({ comment })).named("allowed"),
    where(canRead({ user, comment }), no(canRemove({ user, comment }))).then(respond({ error: "NOT_COMMENT_MODERATOR" })).named("other"),
    where(no(canRead({ user, comment }))).then(respond({ error: "NOT_FOUND" })).named("hidden"),
  ), inputs({ comment: "text" }));
export const composition = { canRead, canEdit, canRemove, rows, List, Post, Reply, Edit, Remove };
