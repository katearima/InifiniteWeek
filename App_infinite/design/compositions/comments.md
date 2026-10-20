# Event comments

All endpoints follow [accounts](reusable/accounts.md), derive the actor from
the session, and share its serialized boundary.

[Can read](view:comments.canRead) takes user and comment, obtains its subject
as event from Commenting._getComment, and requires access.canReadEvent.
[Can edit](view:comments.canEdit) additionally requires authorship.
[Can remove](view:comments.canRemove) requires canRead plus authorship or
access.canManageEvent. Author-only revision is concept-enforced; deletion
authority is composition-owned because EventPublishing owns organizer identity.
Raw concept methods are not public application APIs.

Composition supplies identities and instants; concepts never read clocks or
generate identities. [Fresh comment identity](computation:newCommentIdentity) supplies a UUID
for each new comment. Notifications use newIdentity. Composition binds the flow's single instant
for post/edit/delivery timestamps. Neither is client-authorable input.

```computations
newIdentity() : String
  Returns a freshly generated UUID without reading concept state.

newCommentIdentity() : String
  Returns a freshly generated Comment identity without reading concept state.

commentPermissions(user: String, author: String, organizer: String) : Json
  Returns canEdit when user equals author, and canRemove when user equals author or organizer. Reads no state.
```

[Permission flags](computation:commentPermissions) derives row controls only
from the already authorized caller, author, and organizer identities.

[Rows](former:comments.rows) takes user and event and forms comment, event,
author, username, parent, text, createdAt, edited, editedAt, canEdit, and canRemove from
Commenting._getComments, after membership authorization, preserving its order.
Missing usernames are integrity failures. Display editedAt only when edited.

[List](reaction:comments.List) takes event, requires access.canReadEvent, and
returns {comments} from rows, including an empty array.
[Post](reaction:comments.Post) takes event and text, requires the same access,
calls Commenting.post with the session user, and returns {comment}.
[Reply](reaction:comments.Reply) takes comment and text, requires canRead, and
calls Commenting.reply with the session user, a fresh identity and flow time.
Replying to a reply targets the same root. Returns {comment} for the new reply.
Missing/inaccessible targets return NOT_FOUND. Roots have empty parent strings;
reply rows expose their root identity. Vue groups replies beneath their roots,
oldest first within each thread, in rounded, indented plain-text bubbles.

[Edit](reaction:comments.Edit) takes comment and text, requires canRead then
canEdit, calls Commenting.revise with the session user, and returns {comment}.
[Remove](reaction:comments.Remove) takes comment, requires canRead then
canRemove, reads Commenting._removalTargets, clears those target notifications
across all inboxes with Notifying.clearTargets, then calls Commenting.remove.
Returns {comment} only after deletion and cleanup complete. Root removal deletes
all replies; reply removal deletes only that reply. The confirmation explicitly
warns that root deletion removes other authors' replies as well. Notification
cleanup failure prevents deletion; deletion failure may leave notifications and
some replies removed. The root is removed last so failed child deletion can be
retried. No cross-concept or multi-document rollback is promised.
Readable non-author edits return NOT_COMMENT_AUTHOR; unauthorized readable
removals return NOT_COMMENT_MODERATOR. Unknown and inaccessible identities
return NOT_FOUND before revealing author/event information. Blank/overlong text
returns INVALID_COMMENT_TEXT. Trim outer whitespace and preserve inner whitespace;
render escaped plain text.

Identical edits are successful no-ops. Repeated posts create new identities;
do not automatically retry after a lost response; inspect the discussion first.
Repeated removal returns NOT_FOUND. Departures retain authored comments; current
membership is required even for authors. Rejoining restores author controls.
Canceled events permit all comment operations. Deleted groups make retained
comments inaccessible. Replies use one level; reactions and attachments are not selected.

```endpoints
comments.List at /comments/list
comments.Post at /comments/post
comments.Reply at /comments/reply
comments.Edit at /comments/edit
comments.Remove at /comments/remove
```

Successful posts and replies trigger the required [comment notifications](notifications.md)
before success. Delivery failure may leave the comment and partial notices;
inspect the discussion before manually retrying, because repeated posts/replies
create distinct identities. Host serialization covers creation, fan-out, thread
reads, target cleanup, and deletion, including accepted work after client timeout.
