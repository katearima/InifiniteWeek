# EventPublishing

## Purpose

Maintain one current description of an event associated with a group, so
people can refer back to the same event when its details change.

**Prevents:** earlier event details being mistaken for the current time,
location, or description, or a canceled event being mistaken for an active one.

## Principle

An organizer publishes an event associated with a group. Its details can be
retrieved using the event's identity. When the organizer revises its time or
location, retrieving that same event returns the updated details. A different
user who attempts to revise the event is refused, leaving its details unchanged.
When the organizer removes the event, it is marked canceled rather than deleted.
Its identity and last published details remain available with its canceled status.
Another user cannot remove the event. A canceled event cannot be revised or
removed again.

## Types

```types
opaque EventCollection
  A finite array of this concept's Event identities, including an empty array.

external User
  A person who publishes an event or requests a revision or removal.

external Group
  The group with which an event is associated.
```

## State

```state
a set of Events with
  an organizer User
  a group Group
  a title String
  a description String
  a start DateTime
  an end DateTime
  a location String
  a picture String
  a canceled Flag
  a timeChanged Flag
  a previousStart DateTime
  a previousEnd DateTime

Rule: Every event's start is before its end.
Rule: Trimming removes leading and trailing whitespace and line terminators (as JavaScript String.prototype.trim). Title, description, and location supplied to publish or revise are trimmed and must be within limits: trimmed title 1 to 160 characters, trimmed location 1 to 250, trimmed description at most 5000 (UTF-16 code units). Accepted values are stored trimmed.
Rule: Events stored before these limits are neither normalized nor rechecked; they read back unchanged. Because revise replaces all text fields, such an event can be revised whenever the supplied values are within limits, and supplied out-of-limit values refuse.
Rule: Every event is associated with exactly one group.
Rule: Removal marks an event canceled and retains its identity and details permanently.
Rule: Only the organizer may revise or remove an event. Canceled events cannot be revised or restored.
Rule: Before any time revision, timeChanged is false and previousStart/previousEnd equal the current times. After a time revision, they hold the times immediately before the latest change and timeChanged is true. Non-time edits and cancellation preserve this history.
Rule: A refused action leaves state unchanged.
Rule: Picture is initially empty. Empty means no cover; otherwise it is a JPEG data URL, at most 512 KiB decoded, with valid JPEG framing and frame dimensions of 1 through 1600 pixels on each axis. It is read separately from textual details. Existing records without a picture read as empty.
```

## Actions

```actions
publish(organizer: User, group: Group, title: String, description: String, start: DateTime, end: DateTime, location: String) : returns (event: Event)
  where start is before end and the trimmed details are within limits
  then
    add a new event with organizer, group, trimmed title, trimmed description, start, end, trimmed location, and canceled false
    set timeChanged false and previousStart/previousEnd to start/end
    returns event
  where start is not before end
  then
    refuses INVALID_PUBLICATION_TIME "The event must start before it ends."
  where start is before end and the trimmed details are not within limits
  then
    refuses INVALID_EVENT_DETAILS "An event needs a title of up to 160 characters and a location of up to 250, with a description of at most 5000."

revise(user: User, event: Event, title: String, description: String, start: DateTime, end: DateTime, location: String) : returns (timeOrLocationChanged: Flag)
  where event is not in Events
  then
    refuses EVENT_NOT_FOUND_FOR_REVISION "There is no such event to revise."
  where event is in Events and user is not its organizer
  then
    leave the event unchanged
    refuses NOT_EVENT_ORGANIZER "Only the event's organizer can revise it."
  where event is in Events and user is its organizer and its canceled is true
  then
    refuses EVENT_CANCELED_FOR_REVISION "A canceled event cannot be revised."
  where event is in Events and user is its organizer and its canceled is false and start is not before end
  then
    refuses INVALID_REVISION_TIME "The event must start before it ends."
  where event is in Events and user is its organizer and its canceled is false and start is before end and the trimmed details are not within limits
  then
    refuses INVALID_EVENT_DETAILS "An event needs a title of up to 160 characters and a location of up to 250, with a description of at most 5000."
  where event is in Events and user is its organizer and its canceled is false and start is before end and the trimmed details are within limits
  then
    set timeOrLocationChanged to whether start or end differs from its current value, or the trimmed supplied location differs from the trimmed current location, before revision
    if either supplied time differs from its current value, first copy the current start/end into previousStart/previousEnd and set timeChanged true
    otherwise preserve timeChanged and both previous times
    set the event's title, description, and location to the trimmed supplied values and its start and end to the supplied values
    leave the event's identity, organizer, and group unchanged
    returns timeOrLocationChanged

setPicture(user: User, event: Event, picture: String) : returns ()
  where event is not in Events
  then
    refuses EVENT_NOT_FOUND_FOR_REVISION "There is no such event to revise."
  where event exists and user is not its organizer
  then
    refuses NOT_EVENT_ORGANIZER "Only the event's organizer can revise it."
  where event exists and user is its organizer and event is canceled
  then
    refuses EVENT_CANCELED_FOR_REVISION "A canceled event cannot be revised."
  where event exists and user is its organizer and event is not canceled and picture is invalid
  then
    refuses INVALID_PICTURE "Choose a supported picture of at most 512 KiB after resizing."
  where event exists and user is its organizer and event is not canceled and picture is valid
  then
    replace picture, preserving all other event fields
    returns

remove(user: User, event: Event) : returns ()
  where event is not in Events
  then
    refuses EVENT_NOT_FOUND_FOR_REMOVAL "There is no such event to remove."
  where event is in Events and user is not its organizer
  then
    refuses NOT_EVENT_ORGANIZER_FOR_REMOVAL "Only the event's organizer can remove it."
  where event is in Events and user is its organizer and its canceled is true
  then
    refuses EVENT_ALREADY_CANCELED "This event is already canceled."
  where event is in Events and user is its organizer and its canceled is false
  then
    set the event's canceled to true
    retain its identity, organizer, group, title, description, start, end, and location
    returns

```

## Queries

```queries
_getPicture(event: Event) : optional (picture: String)
  Returns the cover, or an empty string when no cover exists, including for canceled events. Returns no row for an unknown event.

_getEventDetails(event: Event) : optional (organizer: User, group: Group, title: String, description: String, start: DateTime, end: DateTime, location: String, canceled: Flag, timeChanged: Flag, previousStart: DateTime, previousEnd: DateTime)
  Returns the event's organizer, group, details, and canceled status when event is in Events, including canceled events.
  Returns the latest time-change information. previousStart/previousEnd are meaningful as old times only when timeChanged is true.
  Returns no row when the event is unknown.

_getEventsByOrganizer(organizer: User) : many (event: Event)
  Returns every event in Events whose organizer is the supplied user, including canceled events.
  Returns no rows when that user organizes no events, including an unknown user.
  Orders rows by event start time ascending, then lexicographically by event identifier.

_getEventCollection(group: Group) : one (events: EventCollection)
  Returns all event identities associated with group as one array, including canceled events.
  Orders identities by event start time, then lexicographically by event identifier.
  Returns an empty array for unknown groups and groups with no events.

_getEventsByGroup(group: Group) : many (event: Event)
  Returns every event in Events associated with the supplied group, including canceled events.
  Returns no rows when that group has no events, including an unknown group.
  Orders rows by event start time ascending, then lexicographically by event identifier.
```
