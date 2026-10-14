# Events

All endpoints authenticate as described in [accounts](reusable/accounts.md) and
run inside its shared serialization boundary. Every event belongs to a group.
All events are assumed upcoming: validate dates and start-before-end, but never
filter or refuse an event because the wall clock has passed its dates.

## Response reads

[Event details](former:events.details) takes user and event, requires
[read permission](view:access.canReadEvent), and forms event, organizer,
organizerUsername, group, title, description, start, end, location, and canceled.
It also includes the caller's own intent as a nullable field, obtained by matching
only that user in EventMarking._getMarksByEvent. No mark means intent null.
Another user's intention is never included here. Unknown identity/username
in a supposedly valid owned reference is an integrity failure.

[Explore rows](former:events.exploreRows) starts with
Grouping._getGroupsByUser, reads events for each group, obtains details, and
excludes canceled events. [Group rows](former:events.groupRows) does the
same for one supplied group after membership is established. Each forms an array of event rows, returned by its endpoint as {events}
with the detail fields above. Zero matches produces an empty array. These reads
are ordered by [event order](computation:eventSortKey), which is also reused by
personal plans. Canceled details remain available individually and in saved plans.

```computations
eventSortKey(start: DateTime, event: String) : String
  Returns a lexicographically sortable key for one event row: start instant ascending, then event identity. Used by each(...).arranged(...) before forming response arrays. Reads no state and does not filter by current time.
```

## Discovery and details

[Explore](reaction:events.Explore) takes only session and returns {events}
from exploreRows in event order. It cannot enumerate nonmember groups' events.
[Group events](reaction:events.GroupEvents) takes group, refuses NOT_FOUND
for an unknown or nonmember group, and returns {events} from groupRows in event
order. [Details](reaction:events.Details) takes event and returns {event}
from details. Unknown or inaccessible events return NOT_FOUND. Accessible canceled
events still return details. All these reads can be repeated without domain changes.

```endpoints
events.Explore at /events/explore
events.GroupEvents at /events/group
events.Details at /events/details
```

## Publishing, editing, and cancellation

[Publish](reaction:events.Publish) takes group, title, description, start,
end, and location. Require membership in an existing group, otherwise return
NOT_FOUND. Call EventPublishing.publish with the session user as organizer and
return {event} after success. The owner enforces start-before-end and its refusal
propagates. Every successful repeated publish creates a new event; do not blindly
retry after a lost response. Refresh the group listing to inspect the outcome.

[Revise](reaction:events.Revise) takes event and all editable fields:
title, description, start, end, location. [Manage permission](view:access.canManageEvent)
is required. Deny unknown/inaccessible events with NOT_FOUND, and a readable event
owned by another user with NOT_EVENT_ORGANIZER. Call EventPublishing.revise with
the session user; its canceled-event/date refusals propagate. Return {event} only
after success. Group and organizer cannot be changed. Repeating the same valid
revision succeeds with the same resulting details.

[Remove](reaction:events.Remove) takes event and uses the same access
and organizer checks, then asks EventPublishing.remove with the authenticated
user. Return {event} after cancellation commits. Unknown/inaccessible requests
return NOT_FOUND; readable non-owned requests return NOT_EVENT_ORGANIZER. Owner
refusals, including EVENT_ALREADY_CANCELED, propagate. Repeating a completed
cancellation returns that refusal; details can confirm the current status.
Removal retains event details and marks and does not trigger mark cleanup.

```endpoints
events.Publish at /events/publish
events.Revise at /events/revise
events.Remove at /events/remove
```

## Creator-only attendees

[Attendees](reaction:events.Attendees) takes event. Require current group
membership and organizer ownership even for a canceled event. Unknown/inaccessible
events return NOT_FOUND; readable non-owned events return NOT_EVENT_ORGANIZER.
Return {going, interested} using [going attendees](former:events.going)
and [interested attendees](former:events.interested). Each reads
EventMarking._getMarksByEvent, selects its one intention, requires the person to
still be a group member, and returns user and Registering username in user-identity
order. Empty lists are explicit. Never return NOT_GOING people or a count of them.
Missing usernames are integrity failures, not silently dropped rows. Repeated
reads return current attendance; the endpoint changes no attendance state.

```endpoints
events.Attendees at /events/attendees
```

[Decode event dates](computation:eventDate) converts each validated canonical ISO
string or native Date into a Date before publishing or revising. Synchronous input
validation rejects malformed/nonfinite dates before any concept action. The
concept retains responsibility for start-before-end refusals.

```computations
eventDate(value: Json) : DateTime
  Returns a Date with the supplied validated timestamp. Reads no state or clock.
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
