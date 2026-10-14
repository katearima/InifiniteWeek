# Access policies

All inputs to these views come from an already authenticated request. The views
read concept state; they never write it or trust a request-supplied acting user.
Apply the [serialized request contract](reusable/accounts.md#shared-request-and-execution-contract)
so checks and effects cannot race with another application workflow. These views
are application policy, not additional copies of membership or event ownership.

[Is a member](view:access.isMember) takes user and group and holds
exactly when Grouping._isMember returns member true. Unknown groups do not match.

[Can read an event](view:access.canReadEvent) takes user and event and
holds when EventPublishing._getEventDetails returns its group and isMember holds.
Cancellation does not revoke this permission. The creator has no membership
exception and must rejoin after leaving to see or manage their own events.

[Can manage an event](view:access.canManageEvent) takes user and event
and holds when canReadEvent holds and its organizer is the user. This condition
also controls attendee reads. EventPublishing.revise/remove still enforce their
own organizer-only rule; composition does not replace that owner check.

[Can mark an event](view:access.canMarkEvent) takes user and event and
holds when canReadEvent holds and its canceled flag is false. Any intention,
including NOT_GOING, requires this condition. A canceled event's existing mark
may be removed; removal does not require canMarkEvent.

[Organizes an active group event](view:access.organizesActiveEvent)
takes user and group and holds when _getEventsByGroup and _getEventDetails find
at least one event in that group organized by user with canceled false. Dates
play no part: every uncanceled event blocks its organizer from leaving.

Unknown and inaccessible event IDs both return NOT_FOUND from event and marking
endpoints, before revealing details or cancellation state. An accessible canceled
event can produce EVENT_CANCELED when marking is attempted. An accessible event
owned by someone else can produce NOT_EVENT_ORGANIZER for management/attendee
requests. Group discovery is available to all authenticated users, but group
event lists, rosters, and pending-request lists require membership.

Each predicate answers a condition, not a response list. Every aggregate former
also applies the corresponding policy; a direct details endpoint and a list must
never disagree about whether a nonmember can see event details.
