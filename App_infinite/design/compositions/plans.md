# Personal plans

The cleanup ordering in [notifications](notifications.md) extends Mark for
NOT_GOING and Remove: validate existing permissions/refusals, clear that user's
notices for the event, then change/remove the mark. Failure during cleanup
prevents marking; later failure leaves notices cleared. GOING/INTERESTED
transitions preserve notices. Re-saving restores no cleared entries.

All endpoints follow [accounts](reusable/accounts.md), take their acting user
from the session, and share its serialized execution boundary. EventMarking owns
intentions; EventPublishing owns event details and cancellation. No copy of
cancellation state is stored in marks.

[Set intention](reaction:plans.Mark) takes event and intent, restricted to
INTERESTED, GOING, or NOT_GOING. First require readable event details; unknown or
inaccessible events return NOT_FOUND. Then require
[mark permission](view:access.canMarkEvent); a readable canceled event
returns EVENT_CANCELED before any mark changes. Call EventMarking.mark and return
{event, intent} after success. Repeating the same intention succeeds; another
intention replaces the existing choice. There is no extra NOT_GOING record/history.

[Remove intention](reaction:plans.Remove) takes event, requires
[read permission](view:access.canReadEvent), and calls
EventMarking.removeMark for the authenticated user. Cancellation does not prevent
removal. Unknown/inaccessible events return NOT_FOUND; an absent mark returns
NO_MARK_TO_REMOVE. Return {event} after success. A retry after successful removal
can return NO_MARK_TO_REMOVE; this is distinct from storing NOT_GOING. Departure's
bulk cleanup uses clearMarks and can remove all intentions without this endpoint.

```endpoints
plans.Mark at /plans/mark
plans.Remove at /plans/remove
```

[My plans](reaction:plans.MyPlans) takes only session and returns {events}
using [saved events](former:plans.savedEvents). The former starts from
EventMarking._getMyEvents for the authenticated user, requires current membership
through canReadEvent, and combines each mark with EventPublishing details and
Registering's organizer username. Each row contains event, group, organizer,
organizerUsername, title, description, start, end, location, canceled, and intent.
Missing owned event details/username is an integrity failure; inaccessible group
entries are excluded without revealing details. Empty plans yields an empty array.
Order rows using [event order](computation:eventSortKey) from events.md, preserving
intent and cancellation fields.

```endpoints
plans.MyPlans at /plans/list
```

My Events and Calendar consume this same result; no separate calendar concept or
endpoint is selected. Both show GOING and INTERESTED and omit NOT_GOING and absent
marks. Both retain saved canceled events and display "Event canceled" above their
details. Dates only determine ordering and calendar placement: no current-date
filter exists. Cancellation leaves marks unchanged, while removing a mark removes
its entry from both views. Departure permanently clears all group-event marks;
rejoining does not restore them. Reads are repeatable snapshots. The frontend
reloads affected data after mutations and when opening a view; live push updates
are outside scope. If the cancellation response is lost, the next read still
shows the committed canceled state.

[Require the event group reference](computation:requireEventGroup) checks the
optional event-details result before membership filtering. Its output supplies
the membership query's group, so missing event details must fault before a row
can be excluded as inaccessible. This dependency does not rely on condition order.

```computations
requireEventGroup(group: String) : String
  Returns the supplied nonempty group identity. A missing or malformed value throws an integrity failure. Reads no concept state.
```

## Time-change notice

Event detail rows also include timeChanged, previousStart, and previousEnd from
EventPublishing. All event projections share these fields, including saved plans.
The previous interval is displayed only when timeChanged is true; it describes
the schedule immediately before the latest actual time change, not per-user
unread state. Title/description/location-only edits and identical retries preserve
it. Cancellation retains the history, with cancellation presented first.
Calendar placement and sorting continue to use the current start/end only.
Older stored events have timeChanged false until their next time revision.
