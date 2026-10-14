# EventMarking

## Purpose

Help people keep track of events they are considering or planning
to attend by remembering their current attendance intentions.

**Prevents:** forgetting an event they considered attending, or
mistaking an earlier intention for their current plan.

## Principle

A user marks an event INTERESTED and later retrieves it with that intention
still recorded. When the user decides to attend, they change the mark to
GOING, replacing INTERESTED. If their plans change again, they can record
NOT_GOING. They can also remove their mark, leaving no recorded intention
for that event. Removing a mark does not delete the event, and changing one
user's mark does not affect another user's marks. A user can also clear all
their marks for an explicit collection of events in one operation. Repeating
that clearing succeeds without affecting other events or other users.

## Types

```types
external User
  The person whose attendance intention is recorded.

external Event
  The event the intention concerns.

opaque EventCollection
  A finite collection of external Event identities supplied by the caller, represented as an array of identities. It may be empty or contain duplicates.

AttendanceIntent is INTERESTED or GOING or NOT_GOING
  INTERESTED means possible attendance, GOING means planned attendance,
  and NOT_GOING means a decision not to attend.
```

## State

```state
a set of Marks with
  a user User
  an event Event
  an intent AttendanceIntent
  unique user and event

Rule: Each mark records only the user's current intention, not a history of earlier intentions.
Rule: A mark expresses an intention. It does not reserve a place or verify attendance.
Rule: Clearing a supplied collection of events is one atomic state transition; an empty collection succeeds without changing state.
```

## Actions

```actions
mark(user: User, event: Event, intent: AttendanceIntent) : returns ()
  where no mark exists for user and event
  then
    add a new mark with user, event, and intent
    returns
  where a mark exists for user and event
  then
    set that mark's intent to intent, including when it already equals intent
    returns

removeMark(user: User, event: Event) : returns ()
  where a mark exists for user and event
  then
    remove that mark
    returns
  where no mark exists for user and event
  then
    refuses NO_MARK_TO_REMOVE "There is no mark for this event to remove."

clearMarks(user: User, events: EventCollection) : returns ()
  where true
  then
    atomically remove all marks whose user is user and whose event is in events, regardless of intention
    leave other users' marks and marks for events outside events unchanged
    treat duplicate event identities, unknown event identities, and absent marks as having no additional effect
    returns

```

## Queries

```queries
_getMarksByEvent(event: Event) : many (user: User, intent: AttendanceIntent)
  Returns every user's current mark for event, including NOT_GOING.
  Returns no rows when no marks refer to event, including an identity with no recorded marks.
  Treats event as an opaque identity and does not check event existence or cancellation.
  Orders rows lexicographically by user identifier.

_getMyEvents(user: User) : many (event: Event, intent: AttendanceIntent)
  Returns the user's marks whose intent is GOING or INTERESTED.
  Returns no rows when there are no matching marks.
  Orders rows lexicographically by event identifier.

_getInterestedEvents(user: User) : many (event: Event)
  Returns events for which the user has an INTERESTED mark.
  Returns no rows when there are no matching marks.
  Orders rows lexicographically by event identifier.

_getGoingEvents(user: User) : many (event: Event)
  Returns events for which the user has a GOING mark.
  Returns no rows when there are no matching marks.
  Orders rows lexicographically by event identifier.

_getNotGoingEvents(user: User) : many (event: Event)
  Returns events for which the user has a NOT_GOING mark.
  Returns no rows when there are no matching marks.
  Orders rows lexicographically by event identifier.

_isMarked(user: User, event: Event) : one (marked: Flag)
  Returns true when a mark exists for user and event, including a NOT_GOING mark.
  Returns false when no such mark exists, including for identities with no recorded marks.
```
