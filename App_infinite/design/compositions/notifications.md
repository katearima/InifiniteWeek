# In-app notifications

All endpoints follow [accounts](reusable/accounts.md) and its shared serialized
boundary. Notifying owns inbox state; composition owns access and recipients.
No public endpoint accepts an actor or creates notices directly.

[Event revised](reaction:notifications.EventRevised) owns required sends after
successful EventPublishing.revise with timeOrLocationChanged true.
[Event canceled](reaction:notifications.EventCanceled) owns required sends after
successful EventPublishing.remove. These intentionally separate outcome-triggered
reactions fan out to recipients within accepted work, never in the background.
Event endpoints acknowledge success only after the flow settles; delivery
failure prevents success. No send is duplicated inside an endpoint. Each send
receives a fresh identity and the single instant bound to its flow.

[Recipients](view:notifications.recipients) takes event and organizer and emits
user rows from EventMarking._getMarksByEvent with GOING or INTERESTED, excluding
organizer and requiring current membership in the event's group. Each user
occurs once; NOT_GOING is never disclosed.

After an actual start/end/location revision, identified by EventPublishing.revise's
timeOrLocationChanged output, events.Revise sends one "Event updated." entry per
recipient. A combined change produces one entry; title/description-only edits
and unchanged saves send none. After cancellation, events.Remove sends one
"Event canceled." entry per recipient. Serialization keeps recipient membership
and intentions stable. Zero recipients succeeds; sends finish before success.
Successive actual changes keep separate inbox entries. Calendar continues to
show one event at its current schedule with only the latest time-change interval;
cancellation replaces that calendar notice without deleting older inbox entries.
Delivery failure returns failure, retains the event mutation, and may leave
partial delivery. Crashes can lose notices. No restart recovery or automatic
retry is promised; identical revision retries send none and repeated cancellation
refuses. Inspect current state after an uncertain response.

[Rows](former:notifications.rows) takes user, reads their entries, requires
access.canReadEvent for each, and forms notification, event, current title,
message, createdAt, read, and comment (the opaque target, empty for event notices), preserving concept order. Inaccessible entries
are omitted. [Unread total](former:notifications.unread) counts the same
authorized entries with read false, including zero.
[List](reaction:notifications.List) takes session and returns
{notifications, unreadCount}. [Read](reaction:notifications.Read) takes
notification, requires ownership and current event access, calls Notifying.markRead,
and returns {notification}. [Dismiss](reaction:notifications.Dismiss) has the
same inputs/checks, calls Notifying.dismiss, and returns {notification}.
Unknown, foreign, and inaccessible entries return NOT_FOUND. Read is repeatable;
repeated dismissal returns NOT_FOUND. [Read all](reaction:notifications.ReadAll)
takes session, calls Notifying.markAllRead, and returns {} after success,
including an empty inbox; only the caller's entries change.

GOING/INTERESTED transitions preserve notices. plans.Mark with NOT_GOING and
plans.Remove clear the caller's event notices before changing intentions, after
all existing authorization/cancellation/absent-mark checks. groups.Leave and
groups.Delete clear notices for their full event collection before mark cleanup
and membership removal. Clearing is atomic per user and idempotent. Failure
prevents later effects; later failure may leave notices cleared while marks or
membership remain. Retry follows existing refusal rules. Rejoining or saving
again restores no cleared entries. Comment edits and deletions generate no notices.

[Event subject collection](computation:eventSubjects) wraps the workflow's event
identity for Notifying.clear without reading state.

```computations
eventSubjects(event: String) : Json
  Returns a one-element array containing event, without reading state.
```

Vue shows an unread badge, read/read-all/dismiss controls, and event links.
Opening a link marks its entry read before navigation. Refresh on view opening,
window focus, and successful mutations. No polling, push, email, expiry,
historical snapshots, membership notices, or backfill are selected.

```endpoints
notifications.List at /notifications/list
notifications.Read at /notifications/read
notifications.ReadAll at /notifications/read-all
notifications.Dismiss at /notifications/dismiss
```

## Comment destinations

[Comment recipients](view:notifications.commentRecipients) takes event and comment
and serves top-level comments only. It selects current group members marked GOING
and the event organizer while the organizer is a current member, whatever the
organizer's own intention. The comment author is always excluded. A GOING organizer
is selected once, not twice. Other INTERESTED, NOT_GOING, and unmarked users, and
nonmembers, are excluded. Existing time/location/cancellation policy is unchanged.

[Reply recipient](view:notifications.replyRecipient) takes the replied-to parent
comment and the new reply. It emits the parent's author with the parent's event
when that author is not the reply's author and can currently read the event
(access.canReadEvent). The author's attendance intention does not matter.
Replying to a reply selects that reply's author, not the thread root's. Nobody
else is selected: GOING members and the organizer are not notified of replies
unless they wrote the replied-to comment.

[Comment posted](reaction:notifications.CommentPosted) handles successful
Commenting.post and sends "New comment." with the event subject and comment target
to each comment recipient.
[Comment replied](reaction:notifications.CommentReplied) handles successful
Commenting.reply, binding the parent supplied to that action, and sends
"New reply to your comment." with the event subject and the new reply as target to
the reply recipient, if any. Each sends one entry per eligible recipient with fresh identity/flow time.
Expected creation refusals send none. Accepted work waits for delivery; storage
failure can leave a persisted comment and partial notices, with no automatic retry.

Targets are optional opaque strings in Notifying, normalized to empty for legacy
and event-only entries. Composition interprets nonempty targets as comments.
comments.Remove clears targets across inboxes before deleting the comment/thread;
cleanup is idempotent and atomic per inbox, not across all recipients. Other
entries are preserved. No public cleanup-by-target endpoint is exposed.

A comment notification's Open comment control marks it read then navigates to
#event/<event>?comment=<comment>. After authorized loading and rendering, Vue
scrolls to and focuses/highlights the exact bubble, including same-event navigation.
Missing/deleted targets show an unavailable message; lost membership still hides
the event. Stale notification read failures refresh the inbox and report unavailable.
Going-to-Interested keeps prior entries and stops future top-level comment alerts
for non-organizers; replies to one's own comments still arrive. Delivery is read
on demand; no polling or push. The client reloads the inbox and unread count
together with the current view's data on navigation, successful actions, window
focus, and an explicit Refresh control shown on the inbox and event pages; on the
event page, Refresh also reloads the event details, discussion, and attendees. A
window-focus refresh skipped because a dialog was open or an action was running is
remembered and runs once when that dialog closes.
