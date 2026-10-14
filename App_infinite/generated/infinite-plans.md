<!-- Generated from the Infinite Plans assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Infinite Plans — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `set(user: User, password: String) : returns (user: User)`
  - Refuses `INVALID_PASSWORD`: A password must have 8 to 128 characters.
  - Refuses `PASSWORD_SET`: This account already has a password.
- `authenticate(user: User, password: String) : returns (user: User)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Queries

- `_acceptable(password: String) : one (acceptable: Flag)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [Infinite Plans Application Types](../design/types.md), line 11.
  - `User` is `Registering.User` — [Infinite Plans Application Types](../design/types.md), line 12.

### EventMarking

Defined in [EventMarking](../design/concepts/EventMarking.md), line 1.

#### Actions

- `mark(user: User, event: Event, intent: AttendanceIntent) : returns ()`
- `removeMark(user: User, event: Event) : returns ()`
  - Refuses `NO_MARK_TO_REMOVE`: There is no mark for this event to remove.
- `clearMarks(user: User, events: EventCollection) : returns ()`

#### Queries

- `_getMarksByEvent(event: Event) : many (user: User, intent: AttendanceIntent)`
- `_getMyEvents(user: User) : many (event: Event, intent: AttendanceIntent)`
- `_getInterestedEvents(user: User) : many (event: Event)`
- `_getGoingEvents(user: User) : many (event: Event)`
- `_getNotGoingEvents(user: User) : many (event: Event)`
- `_isMarked(user: User, event: Event) : one (marked: Flag)`

#### Instances

- `EventMarking` — instance of `EventMarking` — [Infinite Plans Application Types](../design/types.md), line 24.
  - `Event` is `EventPublishing.Event` — [Infinite Plans Application Types](../design/types.md), line 26.
  - `User` is `Registering.User` — [Infinite Plans Application Types](../design/types.md), line 25.

### EventPublishing

Defined in [EventPublishing](../design/concepts/EventPublishing.md), line 1.

#### Actions

- `publish(organizer: User, group: Group, title: String, description: String, start: DateTime, end: DateTime, location: String) : returns (event: Event)`
  - Refuses `INVALID_PUBLICATION_TIME`: The event must start before it ends.
- `revise(user: User, event: Event, title: String, description: String, start: DateTime, end: DateTime, location: String) : returns ()`
  - Refuses `EVENT_NOT_FOUND_FOR_REVISION`: There is no such event to revise.
  - Refuses `NOT_EVENT_ORGANIZER`: Only the event's organizer can revise it.
  - Refuses `EVENT_CANCELED_FOR_REVISION`: A canceled event cannot be revised.
  - Refuses `INVALID_REVISION_TIME`: The event must start before it ends.
- `remove(user: User, event: Event) : returns ()`
  - Refuses `EVENT_NOT_FOUND_FOR_REMOVAL`: There is no such event to remove.
  - Refuses `NOT_EVENT_ORGANIZER_FOR_REMOVAL`: Only the event's organizer can remove it.
  - Refuses `EVENT_ALREADY_CANCELED`: This event is already canceled.

#### Queries

- `_getEventDetails(event: Event) : optional (organizer: User, group: Group, title: String, description: String, start: DateTime, end: DateTime, location: String, canceled: Flag, timeChanged: Flag, previousStart: DateTime, previousEnd: DateTime)`
- `_getEventsByOrganizer(organizer: User) : many (event: Event)`
- `_getEventCollection(group: Group) : one (events: EventCollection)`
- `_getEventsByGroup(group: Group) : many (event: Event)`

#### Instances

- `EventPublishing` — instance of `EventPublishing` — [Infinite Plans Application Types](../design/types.md), line 20.
  - `Group` is `Grouping.Group` — [Infinite Plans Application Types](../design/types.md), line 22.
  - `User` is `Registering.User` — [Infinite Plans Application Types](../design/types.md), line 21.

### Grouping

Defined in [Grouping](../design/concepts/Grouping.md), line 1.

#### Actions

- `createGroup(user: User, name: String, description: String, policy: JoiningPolicy) : returns (group: Group)`
- `join(user: User, group: Group) : returns (status: JoinStatus)`
  - Refuses `JOIN_GROUP_NOT_FOUND`: There is no such group to join.
  - Refuses `JOIN_ALREADY_MEMBER`: You are already a member of this group.
  - Refuses `REQUEST_ALREADY_PENDING`: You already have a pending request for this group.
- `approve(group: Group, user: User, requester: User) : returns ()`
  - Refuses `APPROVE_GROUP_NOT_FOUND`: There is no such group.
  - Refuses `APPROVE_NOT_MEMBER`: Only a group member can approve a join request.
  - Refuses `APPROVE_REQUEST_NOT_FOUND`: There is no such pending request for this group.
- `reject(group: Group, user: User, requester: User) : returns ()`
  - Refuses `REJECT_GROUP_NOT_FOUND`: There is no such group.
  - Refuses `REJECT_NOT_MEMBER`: Only a group member can reject a join request.
  - Refuses `REJECT_REQUEST_NOT_FOUND`: There is no such pending request for this group.
- `leave(user: User, group: Group) : returns ()`
  - Refuses `LEAVE_GROUP_NOT_FOUND`: There is no such group to leave.
  - Refuses `LEAVE_NOT_MEMBER`: You are not a member of this group.
- `deleteGroup(user: User, group: Group) : returns ()`
  - Refuses `DELETE_GROUP_NOT_FOUND`: There is no such group to delete.
  - Refuses `DELETE_NOT_MEMBER`: Only a member can delete the group.
  - Refuses `DELETE_NOT_LAST_MEMBER`: Only the last member can delete the group.
- `changePolicy(user: User, group: Group, policy: JoiningPolicy) : returns ()`
  - Refuses `POLICY_GROUP_NOT_FOUND`: There is no such group.
  - Refuses `POLICY_NOT_MEMBER`: Only a group member can change its joining policy.

#### Queries

- `_getGroupDetails(group: Group) : optional (name: String, description: String, policy: JoiningPolicy)`
- `_getGroups() : many (group: Group, name: String, description: String, policy: JoiningPolicy)`
- `_getMembers(group: Group) : many (user: User)`
- `_isMember(user: User, group: Group) : one (member: Flag)`
- `_getGroupsByUser(user: User) : many (group: Group)`
- `_isOnlyMember(user: User, group: Group) : one (only: Flag)`
- `_isPending(user: User, group: Group) : one (pending: Flag)`
- `_getPendingRequests(group: Group) : many (user: User)`

#### Instances

- `Grouping` — instance of `Grouping` — [Infinite Plans Application Types](../design/types.md), line 17.
  - `User` is `Registering.User` — [Infinite Plans Application Types](../design/types.md), line 18.

### Registering

Defined in [Registering](../design/concepts/Registering.md), line 1.

#### Actions

- `register(username: String) : returns (user: User)`
  - Refuses `INVALID_USERNAME`: A username must have 3 to 32 letters, digits, underscores, or hyphens.
  - Refuses `USERNAME_TAKEN`: That username is taken.

#### Queries

- `_byUsername(username: String) : optional (user: User)`
- `_username(user: User) : optional (username: String)`

#### Instances

- `Registering` — instance of `Registering` — [Infinite Plans Application Types](../design/types.md), line 9.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `use(session: Session) : returns (subject: Subject)`
  - Refuses `NOT_SIGNED_IN`: Your session has ended. Sign in again.
- `end(session: Session) : returns (session: Session)`
  - Refuses `NOT_SIGNED_IN`: Your session has ended. Sign in again.

#### Instances

- `Sessioning` — instance of `Sessioning` — [Infinite Plans Application Types](../design/types.md), line 14.
  - `Subject` is `Registering.User` — [Infinite Plans Application Types](../design/types.md), line 15.

## Computations

- `eventDate(value: Json) : DateTime` — [Events](../design/compositions/events.md), line 101.
- `eventSortKey(start: DateTime, event: String) : String` — [Events](../design/compositions/events.md), line 27.
- `requireEventGroup(group: String) : String` — [Personal plans](../design/compositions/plans.md), line 61.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (user) belongs to (group)

Authored path: `access.isMember`.
- Covered by [Access policies](../design/compositions/access.md), line 9.

```view
(user) belongs to (group) — inputs (user, group); outputs (); bindings ()
  where Grouping._isMember (group, user) has (member: true)
```

### (user) can read (event)

Authored path: `access.canReadEvent`.
- Covered by [Access policies](../design/compositions/access.md), line 12.
- Covered by [Events](../design/compositions/events.md), line 11.
- Covered by [Personal plans](../design/compositions/plans.md), line 17.

```view
(user) can read (event) — inputs (user, event); outputs (); bindings (group)
  where
    EventPublishing._getEventDetails (event) has (group)
    view "(user) belongs to (group)" with (group, user)
```

### (user) can manage (event)

Authored path: `access.canManageEvent`.
- Covered by [Access policies](../design/compositions/access.md), line 17.
- Covered by [Events](../design/compositions/events.md), line 57.

```view
(user) can manage (event) — inputs (user, event); outputs (); bindings ()
  where
    view "(user) can read (event)" with (event, user)
    EventPublishing._getEventDetails (event) has (organizer: user)
```

### (user) can mark (event)

Authored path: `access.canMarkEvent`.
- Covered by [Access policies](../design/compositions/access.md), line 22.
- Covered by [Personal plans](../design/compositions/plans.md), line 11.

```view
(user) can mark (event) — inputs (user, event); outputs (); bindings ()
  where
    view "(user) can read (event)" with (event, user)
    EventPublishing._getEventDetails (event) has (canceled: false)
```

### (user) organizes an active event in (group)

Authored path: `access.organizesActiveEvent`.
- Covered by [Access policies](../design/compositions/access.md), line 27.
- Covered by [Groups](../design/compositions/groups.md), line 75.

```view
(user) organizes an active event in (group) — inputs (user, group); outputs (); bindings (event)
  where
    EventPublishing._getEventsByGroup (group) has (event)
    EventPublishing._getEventDetails (event) has (canceled: false, organizer: user)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### details of (event) for (user)

Authored path: `events.details`.
- Covered by [Events](../design/compositions/events.md), line 10.

```former
Former "details of (event) for (user)" — inputs (user, event); bindings (organizer, organizerUsername, group, title, description, start, end, location, canceled, timeChanged, previousStart, previousEnd, intent); promises exactly one record — forms:
  a record of
    where view "(user) can read (event)" with (event, user)
    where EventPublishing._getEventDetails (event) has (canceled, description, end, group, location, organizer, previousEnd, previousStart, start, timeChanged, title)
    where Registering._username (user: organizer) has (username: organizerUsername)
    canceled
    description
    end
    event
    group
    intent: the intent of the first EventMarking._getMarksByEvent (event) has (intent, user)
    location
    organizer
    organizerUsername
    previousEnd
    previousStart
    start
    timeChanged
    title
```

### event identities in (group)

Authored path: `groups.eventRows`.
- Covered by [Groups](../design/compositions/groups.md), line 86.

```former
Former "event identities in (group)" — inputs (group); bindings (event); promises exactly one record — forms:
  a record of
    events: each EventPublishing._getEventsByGroup (group) has (event)
      form a record of
        event
```

### events in (group) for (user)

Authored path: `events.groupRows`.
- Covered by [Events](../design/compositions/events.md), line 20.

```former
Former "events in (group) for (user)" — inputs (user, group); bindings (event, start, order); promises exactly one record — forms:
  each EventPublishing._getEventsByGroup (group) has (event)
    where view "(user) belongs to (group)" with (group, user)
    where whether EventPublishing._getEventDetails (event) has (start)
    where no EventPublishing._getEventDetails (event) has (canceled: true)
    where order is eventSortKey (event, start)
    arranged by order
    form a record of
      … former "details of (event) for (user)" with (event, user)
```

### explorable events for (user)

Authored path: `events.exploreRows`.
- Covered by [Events](../design/compositions/events.md), line 18.

```former
Former "explorable events for (user)" — inputs (user); bindings (group, event, start, order); promises exactly one record — forms:
  each Grouping._getGroupsByUser (user) has (group)
    where EventPublishing._getEventsByGroup (group) has (event)
    where whether EventPublishing._getEventDetails (event) has (start)
    where no EventPublishing._getEventDetails (event) has (canceled: true)
    where order is eventSortKey (event, start)
    arranged by order
    form a record of
      … former "details of (event) for (user)" with (event, user)
```

### going attendees of (event) for (user)

Authored path: `events.going`.
- Covered by [Events](../design/compositions/events.md), line 83.

```former
Former "going attendees of (event) for (user)" — inputs (user, event); bindings (person, username, group); promises exactly one record — forms:
  each EventMarking._getMarksByEvent (event) has (intent: "GOING", user: person)
    where view "(user) can manage (event)" with (event, user)
    where EventPublishing._getEventDetails (event) has (group)
    where view "(user) belongs to (group)" with (group, user: person)
    where whether Registering._username (user: person) has (username)
    form a record of
      user: person
      username
```

### summary of (group) for (user)

Authored path: `groups.summary`.
- Covered by [Groups](../design/compositions/groups.md), line 18.

```former
Former "summary of (group) for (user)" — inputs (group, user); bindings (name, description, policy, member, pending); promises exactly one record — forms:
  a record of
    where Grouping._getGroupDetails (group) has (description, name, policy)
    where Grouping._isMember (group, user) has (member)
    where Grouping._isPending (group, user) has (pending)
    description
    group
    member
    name
    pending
    policy
```

### group summaries for (user)

Authored path: `groups.summaries`.
- Covered by [Groups](../design/compositions/groups.md), line 11.

```former
Former "group summaries for (user)" — inputs (user); bindings (group); promises exactly one record — forms:
  each Grouping._getGroups () has (group)
    form a record of
      … former "summary of (group) for (user)" with (group, user)
```

### interested attendees of (event) for (user)

Authored path: `events.interested`.
- Covered by [Events](../design/compositions/events.md), line 84.

```former
Former "interested attendees of (event) for (user)" — inputs (user, event); bindings (person, username, group); promises exactly one record — forms:
  each EventMarking._getMarksByEvent (event) has (intent: "INTERESTED", user: person)
    where view "(user) can manage (event)" with (event, user)
    where EventPublishing._getEventDetails (event) has (group)
    where view "(user) belongs to (group)" with (group, user: person)
    where whether Registering._username (user: person) has (username)
    form a record of
      user: person
      username
```

### members of (group) for (user)

Authored path: `groups.members`.
- Covered by [Groups](../design/compositions/groups.md), line 25.

```former
Former "members of (group) for (user)" — inputs (user, group); bindings (person, username); promises exactly one record — forms:
  each Grouping._getMembers (group) has (user: person)
    where view "(user) belongs to (group)" with (group, user)
    where whether Registering._username (user: person) has (username)
    form a record of
      user: person
      username
```

### requests for (group) seen by (user)

Authored path: `groups.requests`.
- Covered by [Groups](../design/compositions/groups.md), line 26.

```former
Former "requests for (group) seen by (user)" — inputs (user, group); bindings (person, username); promises exactly one record — forms:
  each Grouping._getPendingRequests (group) has (user: person)
    where view "(user) belongs to (group)" with (group, user)
    where whether Registering._username (user: person) has (username)
    form a record of
      user: person
      username
```

### saved events for (user)

Authored path: `plans.savedEvents`.
- Covered by [Personal plans](../design/compositions/plans.md), line 30.

```former
Former "saved events for (user)" — inputs (user); bindings (event, group, referencedGroup, start, order); promises exactly one record — forms:
  each EventMarking._getMyEvents (user) has (event)
    where whether EventPublishing._getEventDetails (event) has (group: referencedGroup, start)
    where group is requireEventGroup (group: referencedGroup)
    where order is eventSortKey (event, start)
    where no Grouping._isMember (group, user) has (member: false)
    arranged by order
    form a record of
      … former "details of (event) for (user)" with (event, user)
```

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### accounts.Me

Authored path: `accounts.Me`.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 20.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 33.

```reaction
when RequestBoundary.request (path: "/auth/me", requestId, session)
then
  Sessioning.use (session)
```

### accounts.Me:known#2

Authored path: `accounts.Me`.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 20.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 33.

```reaction
when Sessioning.use (session, subject: user), asked by accounts.Me
where
  Registering._username (user) has (username)
  earlier, RequestBoundary.request (path: "/auth/me", requestId, session)
then
  RequestBoundary.respond (requestId, user, username)
```

### accounts.Me:missing#2

Authored path: `accounts.Me`.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 20.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 33.

```reaction
when Sessioning.use (session, subject: user), asked by accounts.Me
where
  no Registering._username (user)
  earlier, RequestBoundary.request (path: "/auth/me", requestId, session)
then
  RequestBoundary.respond (error: "NOT_SIGNED_IN", requestId)
```

### accounts.SignOut

Authored path: `accounts.SignOut`.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 26.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 34.

```reaction
when RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  Sessioning.end (session)
```

### accounts.SignOut#2

Authored path: `accounts.SignOut`.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 26.
- Covered by [Accounts](../design/compositions/reusable/accounts.md), line 34.

```reaction
when Sessioning.end (session), asked by accounts.SignOut
where
  earlier, RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  RequestBoundary.respond (requestId)
```

### events.Attendees

Authored path: `events.Attendees`.
- Covered by [Events](../design/compositions/events.md), line 80.
- Covered by [Events](../design/compositions/events.md), line 92.

```reaction
when RequestBoundary.request (event, path: "/events/attendees", requestId, session)
then
  Sessioning.use (session)
```

### events.Attendees:hidden#2

Authored path: `events.Attendees`.
- Covered by [Events](../design/compositions/events.md), line 80.
- Covered by [Events](../design/compositions/events.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by events.Attendees
where
  earlier, RequestBoundary.request (event, path: "/events/attendees", requestId, session)
  no view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### events.Attendees:other#2

Authored path: `events.Attendees`.
- Covered by [Events](../design/compositions/events.md), line 80.
- Covered by [Events](../design/compositions/events.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by events.Attendees
where
  earlier, RequestBoundary.request (event, path: "/events/attendees", requestId, session)
  view "(user) can read (event)" with (event, user)
  no view "(user) can manage (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_EVENT_ORGANIZER", requestId)
```

### events.Attendees:owner#2

Authored path: `events.Attendees`.
- Covered by [Events](../design/compositions/events.md), line 80.
- Covered by [Events](../design/compositions/events.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by events.Attendees
where
  earlier, RequestBoundary.request (event, path: "/events/attendees", requestId, session)
  view "(user) can manage (event)" with (event, user)
then
  RequestBoundary.respond (going: former "going attendees of (event) for (user)" with (event, user), interested: former "interested attendees of (event) for (user)" with (event, user), requestId)
```

### events.Details

Authored path: `events.Details`.
- Covered by [Events](../design/compositions/events.md), line 37.
- Covered by [Events](../design/compositions/events.md), line 44.

```reaction
when RequestBoundary.request (event, path: "/events/details", requestId, session)
then
  Sessioning.use (session)
```

### events.Details:hidden#2

Authored path: `events.Details`.
- Covered by [Events](../design/compositions/events.md), line 37.
- Covered by [Events](../design/compositions/events.md), line 44.

```reaction
when Sessioning.use (session, subject: user), asked by events.Details
where
  earlier, RequestBoundary.request (event, path: "/events/details", requestId, session)
  no view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### events.Details:readable#2

Authored path: `events.Details`.
- Covered by [Events](../design/compositions/events.md), line 37.
- Covered by [Events](../design/compositions/events.md), line 44.

```reaction
when Sessioning.use (session, subject: user), asked by events.Details
where
  earlier, RequestBoundary.request (event, path: "/events/details", requestId, session)
  view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (event: former "details of (event) for (user)" with (event, user), requestId)
```

### events.Explore

Authored path: `events.Explore`.
- Covered by [Events](../design/compositions/events.md), line 33.
- Covered by [Events](../design/compositions/events.md), line 42.

```reaction
when RequestBoundary.request (path: "/events/explore", requestId, session)
then
  Sessioning.use (session)
```

### events.Explore#2

Authored path: `events.Explore`.
- Covered by [Events](../design/compositions/events.md), line 33.
- Covered by [Events](../design/compositions/events.md), line 42.

```reaction
when Sessioning.use (session, subject: user), asked by events.Explore
where
  earlier, RequestBoundary.request (path: "/events/explore", requestId, session)
then
  RequestBoundary.respond (events: former "explorable events for (user)" with (user), requestId)
```

### events.GroupEvents

Authored path: `events.GroupEvents`.
- Covered by [Events](../design/compositions/events.md), line 35.
- Covered by [Events](../design/compositions/events.md), line 43.

```reaction
when RequestBoundary.request (group, path: "/events/group", requestId, session)
then
  Sessioning.use (session)
```

### events.GroupEvents:hidden#2

Authored path: `events.GroupEvents`.
- Covered by [Events](../design/compositions/events.md), line 35.
- Covered by [Events](../design/compositions/events.md), line 43.

```reaction
when Sessioning.use (session, subject: user), asked by events.GroupEvents
where
  earlier, RequestBoundary.request (group, path: "/events/group", requestId, session)
  no view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### events.GroupEvents:member#2

Authored path: `events.GroupEvents`.
- Covered by [Events](../design/compositions/events.md), line 35.
- Covered by [Events](../design/compositions/events.md), line 43.

```reaction
when Sessioning.use (session, subject: user), asked by events.GroupEvents
where
  earlier, RequestBoundary.request (group, path: "/events/group", requestId, session)
  view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (events: former "events in (group) for (user)" with (group, user), requestId)
```

### events.Publish

Authored path: `events.Publish`.
- Covered by [Events](../design/compositions/events.md), line 49.
- Covered by [Events](../design/compositions/events.md), line 73.

```reaction
when RequestBoundary.request (description, end, group, location, path: "/events/publish", requestId, session, start, title)
then
  Sessioning.use (session)
```

### events.Publish:hidden#2

Authored path: `events.Publish`.
- Covered by [Events](../design/compositions/events.md), line 49.
- Covered by [Events](../design/compositions/events.md), line 73.

```reaction
when Sessioning.use (session, subject: user), asked by events.Publish
where
  earlier, RequestBoundary.request (description, end, group, location, path: "/events/publish", requestId, session, start, title)
  no view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### events.Publish:member#2

Authored path: `events.Publish`.
- Covered by [Events](../design/compositions/events.md), line 49.
- Covered by [Events](../design/compositions/events.md), line 73.

```reaction
when Sessioning.use (session, subject: user), asked by events.Publish
where
  earlier, RequestBoundary.request (description, end, group, location, path: "/events/publish", requestId, session, start, title)
  view "(user) belongs to (group)" with (group, user)
  startDate is eventDate (value: start)
  endDate is eventDate (value: end)
then
  EventPublishing.publish (description, end: endDate, group, location, organizer: user, start: startDate, title)
```

### events.Publish:member#3

Authored path: `events.Publish`.
- Covered by [Events](../design/compositions/events.md), line 49.
- Covered by [Events](../design/compositions/events.md), line 73.

```reaction
when EventPublishing.publish (description, end: endDate, group, location, organizer: user, start: startDate, title, event), asked by events.Publish:member#2
where
  earlier, RequestBoundary.request (description, end, group, location, path: "/events/publish", requestId, session, start, title)
then
  RequestBoundary.respond (event, requestId)
```

### events.Remove

Authored path: `events.Remove`.
- Covered by [Events](../design/compositions/events.md), line 64.
- Covered by [Events](../design/compositions/events.md), line 75.

```reaction
when RequestBoundary.request (event, path: "/events/remove", requestId, session)
then
  Sessioning.use (session)
```

### events.Remove:hidden#2

Authored path: `events.Remove`.
- Covered by [Events](../design/compositions/events.md), line 64.
- Covered by [Events](../design/compositions/events.md), line 75.

```reaction
when Sessioning.use (session, subject: user), asked by events.Remove
where
  earlier, RequestBoundary.request (event, path: "/events/remove", requestId, session)
  no view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### events.Remove:other#2

Authored path: `events.Remove`.
- Covered by [Events](../design/compositions/events.md), line 64.
- Covered by [Events](../design/compositions/events.md), line 75.

```reaction
when Sessioning.use (session, subject: user), asked by events.Remove
where
  earlier, RequestBoundary.request (event, path: "/events/remove", requestId, session)
  view "(user) can read (event)" with (event, user)
  no view "(user) can manage (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_EVENT_ORGANIZER", requestId)
```

### events.Remove:owner#2

Authored path: `events.Remove`.
- Covered by [Events](../design/compositions/events.md), line 64.
- Covered by [Events](../design/compositions/events.md), line 75.

```reaction
when Sessioning.use (session, subject: user), asked by events.Remove
where
  earlier, RequestBoundary.request (event, path: "/events/remove", requestId, session)
  view "(user) can manage (event)" with (event, user)
then
  EventPublishing.remove (event, user)
```

### events.Remove:owner#3

Authored path: `events.Remove`.
- Covered by [Events](../design/compositions/events.md), line 64.
- Covered by [Events](../design/compositions/events.md), line 75.

```reaction
when EventPublishing.remove (event, user), asked by events.Remove:owner#2
where
  earlier, RequestBoundary.request (event, path: "/events/remove", requestId, session)
then
  RequestBoundary.respond (event, requestId)
```

### events.Revise

Authored path: `events.Revise`.
- Covered by [Events](../design/compositions/events.md), line 56.
- Covered by [Events](../design/compositions/events.md), line 74.

```reaction
when RequestBoundary.request (description, end, event, location, path: "/events/revise", requestId, session, start, title)
then
  Sessioning.use (session)
```

### events.Revise:hidden#2

Authored path: `events.Revise`.
- Covered by [Events](../design/compositions/events.md), line 56.
- Covered by [Events](../design/compositions/events.md), line 74.

```reaction
when Sessioning.use (session, subject: user), asked by events.Revise
where
  earlier, RequestBoundary.request (description, end, event, location, path: "/events/revise", requestId, session, start, title)
  no view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### events.Revise:other#2

Authored path: `events.Revise`.
- Covered by [Events](../design/compositions/events.md), line 56.
- Covered by [Events](../design/compositions/events.md), line 74.

```reaction
when Sessioning.use (session, subject: user), asked by events.Revise
where
  earlier, RequestBoundary.request (description, end, event, location, path: "/events/revise", requestId, session, start, title)
  view "(user) can read (event)" with (event, user)
  no view "(user) can manage (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_EVENT_ORGANIZER", requestId)
```

### events.Revise:owner#2

Authored path: `events.Revise`.
- Covered by [Events](../design/compositions/events.md), line 56.
- Covered by [Events](../design/compositions/events.md), line 74.

```reaction
when Sessioning.use (session, subject: user), asked by events.Revise
where
  earlier, RequestBoundary.request (description, end, event, location, path: "/events/revise", requestId, session, start, title)
  view "(user) can manage (event)" with (event, user)
  startDate is eventDate (value: start)
  endDate is eventDate (value: end)
then
  EventPublishing.revise (description, end: endDate, event, location, start: startDate, title, user)
```

### events.Revise:owner#3

Authored path: `events.Revise`.
- Covered by [Events](../design/compositions/events.md), line 56.
- Covered by [Events](../design/compositions/events.md), line 74.

```reaction
when EventPublishing.revise (description, end: endDate, event, location, start: startDate, title, user), asked by events.Revise:owner#2
where
  earlier, RequestBoundary.request (description, end, event, location, path: "/events/revise", requestId, session, start, title)
then
  RequestBoundary.respond (event, requestId)
```

### groups.Approve

Authored path: `groups.Approve`.
- Covered by [Groups](../design/compositions/groups.md), line 49.
- Covered by [Groups](../design/compositions/groups.md), line 66.

```reaction
when RequestBoundary.request (group, path: "/groups/approve", requestId, requester, session)
then
  Sessioning.use (session)
```

### groups.Approve#2

Authored path: `groups.Approve`.
- Covered by [Groups](../design/compositions/groups.md), line 49.
- Covered by [Groups](../design/compositions/groups.md), line 66.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Approve
where
  earlier, RequestBoundary.request (group, path: "/groups/approve", requestId, requester, session)
then
  Grouping.approve (group, requester, user)
```

### groups.Approve#3

Authored path: `groups.Approve`.
- Covered by [Groups](../design/compositions/groups.md), line 49.
- Covered by [Groups](../design/compositions/groups.md), line 66.

```reaction
when Grouping.approve (group, requester, user), asked by groups.Approve#2
where
  earlier, RequestBoundary.request (group, path: "/groups/approve", requestId, requester, session)
then
  RequestBoundary.respond (group, requestId, requester)
```

### groups.ChangePolicy

Authored path: `groups.ChangePolicy`.
- Covered by [Groups](../design/compositions/groups.md), line 57.
- Covered by [Groups](../design/compositions/groups.md), line 68.

```reaction
when RequestBoundary.request (group, path: "/groups/policy", policy, requestId, session)
then
  Sessioning.use (session)
```

### groups.ChangePolicy#2

Authored path: `groups.ChangePolicy`.
- Covered by [Groups](../design/compositions/groups.md), line 57.
- Covered by [Groups](../design/compositions/groups.md), line 68.

```reaction
when Sessioning.use (session, subject: user), asked by groups.ChangePolicy
where
  earlier, RequestBoundary.request (group, path: "/groups/policy", policy, requestId, session)
then
  Grouping.changePolicy (group, policy, user)
```

### groups.ChangePolicy#3

Authored path: `groups.ChangePolicy`.
- Covered by [Groups](../design/compositions/groups.md), line 57.
- Covered by [Groups](../design/compositions/groups.md), line 68.

```reaction
when Grouping.changePolicy (group, policy, user), asked by groups.ChangePolicy#2
where
  earlier, RequestBoundary.request (group, path: "/groups/policy", policy, requestId, session)
then
  RequestBoundary.respond (group, policy, requestId)
```

### groups.Create

Authored path: `groups.Create`.
- Covered by [Groups](../design/compositions/groups.md), line 39.
- Covered by [Groups](../design/compositions/groups.md), line 64.

```reaction
when RequestBoundary.request (description, name, path: "/groups/create", policy, requestId, session)
then
  Sessioning.use (session)
```

### groups.Create#2

Authored path: `groups.Create`.
- Covered by [Groups](../design/compositions/groups.md), line 39.
- Covered by [Groups](../design/compositions/groups.md), line 64.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Create
where
  earlier, RequestBoundary.request (description, name, path: "/groups/create", policy, requestId, session)
then
  Grouping.createGroup (description, name, policy, user)
```

### groups.Create#3

Authored path: `groups.Create`.
- Covered by [Groups](../design/compositions/groups.md), line 39.
- Covered by [Groups](../design/compositions/groups.md), line 64.

```reaction
when Grouping.createGroup (description, name, policy, user, group), asked by groups.Create#2
where
  earlier, RequestBoundary.request (description, name, path: "/groups/create", policy, requestId, session)
then
  RequestBoundary.respond (group, requestId)
```

### groups.Delete

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when RequestBoundary.request (group, path: "/groups/delete", requestId, session)
then
  Sessioning.use (session)
```

### groups.Delete:delete#2

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Delete
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
  Grouping._isOnlyMember (group, user) has (only: true)
  no view "(user) organizes an active event in (group)" with (group, user)
  EventPublishing._getEventCollection (group) has (events)
then
  EventMarking.clearMarks (events, user)
```

### groups.Delete:delete#3

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when EventMarking.clearMarks (events, user), asked by groups.Delete:delete#2
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
then
  Grouping.deleteGroup (group, user)
```

### groups.Delete:delete#4

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when Grouping.deleteGroup (group, user), asked by groups.Delete:delete#3
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
then
  RequestBoundary.respond (group, requestId)
```

### groups.Delete:missing#2

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Delete
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
  no Grouping._getGroupDetails (group)
then
  RequestBoundary.respond (error: "DELETE_GROUP_NOT_FOUND", requestId)
```

### groups.Delete:organizer#2

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Delete
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
  Grouping._isOnlyMember (group, user) has (only: true)
  view "(user) organizes an active event in (group)" with (group, user)
then
  RequestBoundary.respond (error: "ACTIVE_EVENTS_PREVENT_DELETION", requestId)
```

### groups.Delete:outsider#2

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Delete
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
  Grouping._getGroupDetails (group)
  no view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (error: "DELETE_NOT_MEMBER", requestId)
```

### groups.Delete:shared#2

Authored path: `groups.Delete`.
- Covered by [Groups](../design/compositions/groups.md), line 116.
- Covered by [Groups](../design/compositions/groups.md), line 135.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Delete
where
  earlier, RequestBoundary.request (group, path: "/groups/delete", requestId, session)
  view "(user) belongs to (group)" with (group, user)
  Grouping._isOnlyMember (group, user) has (only: false)
then
  RequestBoundary.respond (error: "DELETE_NOT_LAST_MEMBER", requestId)
```

### groups.Details

Authored path: `groups.Details`.
- Covered by [Groups](../design/compositions/groups.md), line 17.
- Covered by [Groups](../design/compositions/groups.md), line 32.

```reaction
when RequestBoundary.request (group, path: "/groups/details", requestId, session)
then
  Sessioning.use (session)
```

### groups.Details:found#2

Authored path: `groups.Details`.
- Covered by [Groups](../design/compositions/groups.md), line 17.
- Covered by [Groups](../design/compositions/groups.md), line 32.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Details
where
  earlier, RequestBoundary.request (group, path: "/groups/details", requestId, session)
  Grouping._getGroupDetails (group)
then
  RequestBoundary.respond (group: former "summary of (group) for (user)" with (group, user), requestId)
```

### groups.Details:missing#2

Authored path: `groups.Details`.
- Covered by [Groups](../design/compositions/groups.md), line 17.
- Covered by [Groups](../design/compositions/groups.md), line 32.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Details
where
  earlier, RequestBoundary.request (group, path: "/groups/details", requestId, session)
  no Grouping._getGroupDetails (group)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### groups.Join

Authored path: `groups.Join`.
- Covered by [Groups](../design/compositions/groups.md), line 44.
- Covered by [Groups](../design/compositions/groups.md), line 65.

```reaction
when RequestBoundary.request (group, path: "/groups/join", requestId, session)
then
  Sessioning.use (session)
```

### groups.Join#2

Authored path: `groups.Join`.
- Covered by [Groups](../design/compositions/groups.md), line 44.
- Covered by [Groups](../design/compositions/groups.md), line 65.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Join
where
  earlier, RequestBoundary.request (group, path: "/groups/join", requestId, session)
then
  Grouping.join (group, user)
```

### groups.Join#3

Authored path: `groups.Join`.
- Covered by [Groups](../design/compositions/groups.md), line 44.
- Covered by [Groups](../design/compositions/groups.md), line 65.

```reaction
when Grouping.join (group, user, status), asked by groups.Join#2
where
  earlier, RequestBoundary.request (group, path: "/groups/join", requestId, session)
then
  RequestBoundary.respond (group, requestId, status)
```

### groups.Leave

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when RequestBoundary.request (group, path: "/groups/leave", requestId, session)
then
  Sessioning.use (session)
```

### groups.Leave:leave#2

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Leave
where
  earlier, RequestBoundary.request (group, path: "/groups/leave", requestId, session)
  view "(user) belongs to (group)" with (group, user)
  no view "(user) organizes an active event in (group)" with (group, user)
  EventPublishing._getEventCollection (group) has (events)
then
  EventMarking.clearMarks (events, user)
```

### groups.Leave:leave#3

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when EventMarking.clearMarks (events, user), asked by groups.Leave:leave#2
where
  earlier, RequestBoundary.request (group, path: "/groups/leave", requestId, session)
then
  Grouping.leave (group, user)
```

### groups.Leave:leave#4

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when Grouping.leave (group, user), asked by groups.Leave:leave#3
where
  earlier, RequestBoundary.request (group, path: "/groups/leave", requestId, session)
then
  RequestBoundary.respond (group, requestId)
```

### groups.Leave:missing#2

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Leave
where
  earlier, RequestBoundary.request (group, path: "/groups/leave", requestId, session)
  no Grouping._getGroupDetails (group)
then
  RequestBoundary.respond (error: "LEAVE_GROUP_NOT_FOUND", requestId)
```

### groups.Leave:organizer#2

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Leave
where
  earlier, RequestBoundary.request (group, path: "/groups/leave", requestId, session)
  view "(user) belongs to (group)" with (group, user)
  view "(user) organizes an active event in (group)" with (group, user)
then
  RequestBoundary.respond (error: "ACTIVE_EVENTS_PREVENT_LEAVING", requestId)
```

### groups.Leave:outsider#2

Authored path: `groups.Leave`.
- Covered by [Groups](../design/compositions/groups.md), line 73.
- Covered by [Groups](../design/compositions/groups.md), line 92.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Leave
where
  earlier, RequestBoundary.request (group, path: "/groups/leave", requestId, session)
  Grouping._getGroupDetails (group)
  no view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (error: "LEAVE_NOT_MEMBER", requestId)
```

### groups.List

Authored path: `groups.List`.
- Covered by [Groups](../design/compositions/groups.md), line 10.
- Covered by [Groups](../design/compositions/groups.md), line 31.

```reaction
when RequestBoundary.request (path: "/groups/list", requestId, session)
then
  Sessioning.use (session)
```

### groups.List#2

Authored path: `groups.List`.
- Covered by [Groups](../design/compositions/groups.md), line 10.
- Covered by [Groups](../design/compositions/groups.md), line 31.

```reaction
when Sessioning.use (session, subject: user), asked by groups.List
where
  earlier, RequestBoundary.request (path: "/groups/list", requestId, session)
then
  RequestBoundary.respond (groups: former "group summaries for (user)" with (user), requestId)
```

### groups.Members

Authored path: `groups.Members`.
- Covered by [Groups](../design/compositions/groups.md), line 22.
- Covered by [Groups](../design/compositions/groups.md), line 33.

```reaction
when RequestBoundary.request (group, path: "/groups/members", requestId, session)
then
  Sessioning.use (session)
```

### groups.Members:member#2

Authored path: `groups.Members`.
- Covered by [Groups](../design/compositions/groups.md), line 22.
- Covered by [Groups](../design/compositions/groups.md), line 33.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Members
where
  earlier, RequestBoundary.request (group, path: "/groups/members", requestId, session)
  view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (members: former "members of (group) for (user)" with (group, user), requestId)
```

### groups.Members:missing#2

Authored path: `groups.Members`.
- Covered by [Groups](../design/compositions/groups.md), line 22.
- Covered by [Groups](../design/compositions/groups.md), line 33.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Members
where
  earlier, RequestBoundary.request (group, path: "/groups/members", requestId, session)
  no Grouping._getGroupDetails (group)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### groups.Members:outsider#2

Authored path: `groups.Members`.
- Covered by [Groups](../design/compositions/groups.md), line 22.
- Covered by [Groups](../design/compositions/groups.md), line 33.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Members
where
  earlier, RequestBoundary.request (group, path: "/groups/members", requestId, session)
  Grouping._getGroupDetails (group)
  no view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (error: "NOT_GROUP_MEMBER", requestId)
```

### groups.Reject

Authored path: `groups.Reject`.
- Covered by [Groups](../design/compositions/groups.md), line 50.
- Covered by [Groups](../design/compositions/groups.md), line 67.

```reaction
when RequestBoundary.request (group, path: "/groups/reject", requestId, requester, session)
then
  Sessioning.use (session)
```

### groups.Reject#2

Authored path: `groups.Reject`.
- Covered by [Groups](../design/compositions/groups.md), line 50.
- Covered by [Groups](../design/compositions/groups.md), line 67.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Reject
where
  earlier, RequestBoundary.request (group, path: "/groups/reject", requestId, requester, session)
then
  Grouping.reject (group, requester, user)
```

### groups.Reject#3

Authored path: `groups.Reject`.
- Covered by [Groups](../design/compositions/groups.md), line 50.
- Covered by [Groups](../design/compositions/groups.md), line 67.

```reaction
when Grouping.reject (group, requester, user), asked by groups.Reject#2
where
  earlier, RequestBoundary.request (group, path: "/groups/reject", requestId, requester, session)
then
  RequestBoundary.respond (group, requestId, requester)
```

### groups.Requests

Authored path: `groups.Requests`.
- Covered by [Groups](../design/compositions/groups.md), line 23.
- Covered by [Groups](../design/compositions/groups.md), line 34.

```reaction
when RequestBoundary.request (group, path: "/groups/requests", requestId, session)
then
  Sessioning.use (session)
```

### groups.Requests:member#2

Authored path: `groups.Requests`.
- Covered by [Groups](../design/compositions/groups.md), line 23.
- Covered by [Groups](../design/compositions/groups.md), line 34.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Requests
where
  earlier, RequestBoundary.request (group, path: "/groups/requests", requestId, session)
  view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (requestId, requests: former "requests for (group) seen by (user)" with (group, user))
```

### groups.Requests:missing#2

Authored path: `groups.Requests`.
- Covered by [Groups](../design/compositions/groups.md), line 23.
- Covered by [Groups](../design/compositions/groups.md), line 34.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Requests
where
  earlier, RequestBoundary.request (group, path: "/groups/requests", requestId, session)
  no Grouping._getGroupDetails (group)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### groups.Requests:outsider#2

Authored path: `groups.Requests`.
- Covered by [Groups](../design/compositions/groups.md), line 23.
- Covered by [Groups](../design/compositions/groups.md), line 34.

```reaction
when Sessioning.use (session, subject: user), asked by groups.Requests
where
  earlier, RequestBoundary.request (group, path: "/groups/requests", requestId, session)
  Grouping._getGroupDetails (group)
  no view "(user) belongs to (group)" with (group, user)
then
  RequestBoundary.respond (error: "NOT_GROUP_MEMBER", requestId)
```

### passwords.Register:accepted

Authored path: `passwords.Register`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 8.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 36.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
where
  Authenticating._acceptable (password) has (acceptable: true)
then
  Registering.register (username)
```

### passwords.Register:accepted#2

Authored path: `passwords.Register`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 8.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 36.

```reaction
when Registering.register (username, user), asked by passwords.Register:accepted
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  Authenticating.set (password, user)
```

### passwords.Register:accepted#3

Authored path: `passwords.Register`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 8.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 36.

```reaction
when Authenticating.set (password, user), asked by passwords.Register:accepted#2
then
  Sessioning.start (subject: user)
```

### passwords.Register:accepted#4

Authored path: `passwords.Register`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 8.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 36.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by passwords.Register:accepted#3
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### passwords.Register:refused

Authored path: `passwords.Register`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 8.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 36.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
where
  Authenticating._acceptable (password) has (acceptable: false)
then
  RequestBoundary.respond (error: "INVALID_PASSWORD", requestId)
```

### passwords.SignIn:known

Authored path: `passwords.SignIn`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 27.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 37.

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
where
  Registering._byUsername (username) has (user)
then
  Authenticating.authenticate (password, user)
```

### passwords.SignIn:known#2

Authored path: `passwords.SignIn`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 27.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 37.

```reaction
when Authenticating.authenticate (password, user), asked by passwords.SignIn:known
then
  Sessioning.start (subject: user)
```

### passwords.SignIn:known#3

Authored path: `passwords.SignIn`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 27.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 37.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by passwords.SignIn:known#2
where
  earlier, RequestBoundary.request (password, path: "/auth/login", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### passwords.SignIn:unknown

Authored path: `passwords.SignIn`.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 27.
- Covered by [Password sign-in](../design/compositions/reusable/passwords.md), line 37.

```reaction
when RequestBoundary.request (password, path: "/auth/login", requestId, username)
where
  no Registering._byUsername (username)
then
  RequestBoundary.respond (error: "INVALID_CREDENTIALS", requestId)
```

### plans.Mark

Authored path: `plans.Mark`.
- Covered by [Personal plans](../design/compositions/plans.md), line 8.
- Covered by [Personal plans](../design/compositions/plans.md), line 25.

```reaction
when RequestBoundary.request (event, intent, path: "/plans/mark", requestId, session)
then
  Sessioning.use (session)
```

### plans.Mark:canceled#2

Authored path: `plans.Mark`.
- Covered by [Personal plans](../design/compositions/plans.md), line 8.
- Covered by [Personal plans](../design/compositions/plans.md), line 25.

```reaction
when Sessioning.use (session, subject: user), asked by plans.Mark
where
  earlier, RequestBoundary.request (event, intent, path: "/plans/mark", requestId, session)
  view "(user) can read (event)" with (event, user)
  no view "(user) can mark (event)" with (event, user)
then
  RequestBoundary.respond (error: "EVENT_CANCELED", requestId)
```

### plans.Mark:hidden#2

Authored path: `plans.Mark`.
- Covered by [Personal plans](../design/compositions/plans.md), line 8.
- Covered by [Personal plans](../design/compositions/plans.md), line 25.

```reaction
when Sessioning.use (session, subject: user), asked by plans.Mark
where
  earlier, RequestBoundary.request (event, intent, path: "/plans/mark", requestId, session)
  no view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### plans.Mark:mark#2

Authored path: `plans.Mark`.
- Covered by [Personal plans](../design/compositions/plans.md), line 8.
- Covered by [Personal plans](../design/compositions/plans.md), line 25.

```reaction
when Sessioning.use (session, subject: user), asked by plans.Mark
where
  earlier, RequestBoundary.request (event, intent, path: "/plans/mark", requestId, session)
  view "(user) can mark (event)" with (event, user)
then
  EventMarking.mark (event, intent, user)
```

### plans.Mark:mark#3

Authored path: `plans.Mark`.
- Covered by [Personal plans](../design/compositions/plans.md), line 8.
- Covered by [Personal plans](../design/compositions/plans.md), line 25.

```reaction
when EventMarking.mark (event, intent, user), asked by plans.Mark:mark#2
where
  earlier, RequestBoundary.request (event, intent, path: "/plans/mark", requestId, session)
then
  RequestBoundary.respond (event, intent, requestId)
```

### plans.MyPlans

Authored path: `plans.MyPlans`.
- Covered by [Personal plans](../design/compositions/plans.md), line 29.
- Covered by [Personal plans](../design/compositions/plans.md), line 41.

```reaction
when RequestBoundary.request (path: "/plans/list", requestId, session)
then
  Sessioning.use (session)
```

### plans.MyPlans#2

Authored path: `plans.MyPlans`.
- Covered by [Personal plans](../design/compositions/plans.md), line 29.
- Covered by [Personal plans](../design/compositions/plans.md), line 41.

```reaction
when Sessioning.use (session, subject: user), asked by plans.MyPlans
where
  earlier, RequestBoundary.request (path: "/plans/list", requestId, session)
then
  RequestBoundary.respond (events: former "saved events for (user)" with (user), requestId)
```

### plans.Remove

Authored path: `plans.Remove`.
- Covered by [Personal plans](../design/compositions/plans.md), line 16.
- Covered by [Personal plans](../design/compositions/plans.md), line 26.

```reaction
when RequestBoundary.request (event, path: "/plans/remove", requestId, session)
then
  Sessioning.use (session)
```

### plans.Remove:hidden#2

Authored path: `plans.Remove`.
- Covered by [Personal plans](../design/compositions/plans.md), line 16.
- Covered by [Personal plans](../design/compositions/plans.md), line 26.

```reaction
when Sessioning.use (session, subject: user), asked by plans.Remove
where
  earlier, RequestBoundary.request (event, path: "/plans/remove", requestId, session)
  no view "(user) can read (event)" with (event, user)
then
  RequestBoundary.respond (error: "NOT_FOUND", requestId)
```

### plans.Remove:remove#2

Authored path: `plans.Remove`.
- Covered by [Personal plans](../design/compositions/plans.md), line 16.
- Covered by [Personal plans](../design/compositions/plans.md), line 26.

```reaction
when Sessioning.use (session, subject: user), asked by plans.Remove
where
  earlier, RequestBoundary.request (event, path: "/plans/remove", requestId, session)
  view "(user) can read (event)" with (event, user)
then
  EventMarking.removeMark (event, user)
```

### plans.Remove:remove#3

Authored path: `plans.Remove`.
- Covered by [Personal plans](../design/compositions/plans.md), line 16.
- Covered by [Personal plans](../design/compositions/plans.md), line 26.

```reaction
when EventMarking.removeMark (event, user), asked by plans.Remove:remove#2
where
  earlier, RequestBoundary.request (event, path: "/plans/remove", requestId, session)
then
  RequestBoundary.respond (event, requestId)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/auth/login` — requires `username`, `password`
- `/auth/logout` — requires `session`
- `/auth/me` — requires `session`
- `/auth/register` — requires `username`, `password`
- `/events/attendees` — requires `event`, `session`
- `/events/details` — requires `event`, `session`
- `/events/explore` — requires `session`
- `/events/group` — requires `group`, `session`
- `/events/publish` — requires `group`, `title`, `description`, `start`, `end`, `location`, `session`
- `/events/remove` — requires `event`, `session`
- `/events/revise` — requires `event`, `title`, `description`, `start`, `end`, `location`, `session`
- `/groups/approve` — requires `group`, `requester`, `session`
- `/groups/create` — requires `name`, `description`, `policy`, `session`
- `/groups/delete` — requires `group`, `session`
- `/groups/details` — requires `group`, `session`
- `/groups/join` — requires `group`, `session`
- `/groups/leave` — requires `group`, `session`
- `/groups/list` — requires `session`
- `/groups/members` — requires `group`, `session`
- `/groups/policy` — requires `group`, `policy`, `session`
- `/groups/reject` — requires `group`, `requester`, `session`
- `/groups/requests` — requires `group`, `session`
- `/plans/list` — requires `session`
- `/plans/mark` — requires `event`, `intent`, `session`
- `/plans/remove` — requires `event`, `session`
