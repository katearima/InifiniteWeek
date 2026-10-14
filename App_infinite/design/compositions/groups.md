# Groups

All endpoints follow [accounts](reusable/accounts.md) and derive user from the
session. Grouping owns group state and its OPEN/APPROVAL lifecycle. This module
adds the application-specific departure obligation involving events and marks.
All response arrays below are empty rather than absent when no rows match.

## Discovery and membership information

[List groups](reaction:groups.List) takes no input besides session and
returns {groups} using [group summaries](former:groups.summaries).
The former reads Grouping._getGroups and returns group, name, description, policy,
member, and pending for the caller, sorted by group identity. member comes from
_isMember; pending comes from _isPending for that caller. It never
exposes another person's request through public group summaries.

[Group details](reaction:groups.Details) takes group and returns {group}
using [a group summary](former:groups.summary) with the same fields.
A missing group returns NOT_FOUND. Details do not include event details or a
roster for nonmembers. Repeated discovery/detail reads return current state.

[Members](reaction:groups.Members) and
[pending requests](reaction:groups.Requests) take group. Unknown groups
return NOT_FOUND, nonmembers return NOT_GROUP_MEMBER. Members returns {members}
from [the roster](former:groups.members); Requests returns {requests}
from [the pending roster](former:groups.requests). Both return user and
username per row, using Registering._username, sorted by user identity. A missing
username for a referenced user is an integrity failure, not an omitted person.

```endpoints
groups.List at /groups/list
groups.Details at /groups/details
groups.Members at /groups/members
groups.Requests at /groups/requests
```

## Creating and joining

[Create](reaction:groups.Create) takes name, description, and policy
and asks Grouping.createGroup with the authenticated user. Return {group} after
creation and the creator's membership are established by that one owner action.
A repeated create makes another group; there is no implicit name uniqueness.

[Join](reaction:groups.Join) takes group and asks Grouping.join.
Return {group, status}, where status is JOINED or PENDING, only after its transition.
Unknown groups, existing membership, and an already-pending request propagate the
concept's respective refusals. OPEN creates membership; APPROVAL creates a request.

[Approve](reaction:groups.Approve) and
[reject](reaction:groups.Reject) take group and requester. The acting
user comes from the session; requester is the target user. Call Grouping.approve
or reject and return {group, requester} after completion. Grouping enforces current
member authority and pending-request existence. Repeat decisions refuse because
the request is gone; a membership/request read establishes current outcome after
a lost response. Concept refusals leave group state unchanged.

[Change policy](reaction:groups.ChangePolicy) takes group and policy,
calls Grouping.changePolicy, and returns {group, policy}. Existing members have
equal authority. Switching to OPEN admits all pending requesters and empties
requests in the same owner action; success follows the complete transition.
Repeating the current policy succeeds, as the concept specifies.

```endpoints
groups.Create at /groups/create
groups.Join at /groups/join
groups.Approve at /groups/approve
groups.Reject at /groups/reject
groups.ChangePolicy at /groups/policy
```

## Leaving and clearing plans

[Leave](reaction:groups.Leave) takes group. An unknown group returns
LEAVE_GROUP_NOT_FOUND and a nonmember returns LEAVE_NOT_MEMBER before mark cleanup.
If [the user organizes an uncanceled event](view:access.organizesActiveEvent)
in the group, return ACTIVE_EVENTS_PREVENT_LEAVING without changing marks or
membership. Cancel every such event before trying again; event dates are irrelevant.

Otherwise EventPublishing._getEventCollection returns the group's complete event
identity array, including canceled events, as one bound value. Pass it directly
to EventMarking.clearMarks for the caller. That action clears every intention for
these identities, including NOT_GOING. After it succeeds, call Grouping.leave.
Return {group} only after departure succeeds. No later reaction performs the same
cleanup, and no marks are restored on rejoining.

[The group's event rows](former:groups.eventRows) remains a reusable read that
forms {events: [{event}]} from _getEventsByGroup, including canceled events.
The departure action uses the collection query directly because action inputs
need bound values rather than unevaluated formers.

```endpoints
groups.Leave at /groups/leave
```

The endpoint holds the shared serialization boundary across checks, clearing,
and departure. No interleaved publish/mark/join can invalidate those checks.
clearMarks is an atomic owner transition and idempotent. If it fails before commit,
membership and marks remain; if its commit outcome is unknown, re-read/retry its
idempotent action. If clearing commits and leave then fails, marks stay cleared
and the user may remain a member. Surface a failure, not successful departure;
retry repeats the checks and safe clearing. If leave committed but its response
was lost, a retry can return LEAVE_NOT_MEMBER; rereading membership confirms it.
Process interruption has the same partial-state possibilities, with no background
cleanup or rollback promise. Last-member departure preserves Grouping's specified
OPEN transition and admission of pending requesters. Those users' marks are not
changed by the departing user's clearMarks.

## Projection implementation

Grouping._isPending provides the caller's boolean pending field. The prior
hasPendingRequest and groupEventIdentities computations are replaced by owned
query projections; neither query changes state or reads another concept.

## Explicit group deletion

[Delete](reaction:groups.Delete) takes group and derives user from session.
Refusal precedence is DELETE_GROUP_NOT_FOUND, DELETE_NOT_MEMBER,
DELETE_NOT_LAST_MEMBER, then ACTIVE_EVENTS_PREVENT_DELETION if the sole member
organizes any uncanceled event in this group. Dates do not exempt events.
After these checks, read EventPublishing._getEventCollection, clear all of the
caller's marks for those events using EventMarking.clearMarks, then call
Grouping.deleteGroup. Return {group} only after deletion finishes.
Pending requests are removed without admission. Existing events are retained
internally but become inaccessible because the group no longer exists. Former
members' marks were cleared on departure; the sole member's are cleared here.
The shared queue excludes interleaved join/publish/mark workflows. If clearing
fails, deletion does not run. If deletion fails after clearing, marks remain
cleared and retry is safe. A lost-response retry returns DELETE_GROUP_NOT_FOUND;
list/details reads confirm deletion. The Grouping action also enforces sole
membership atomically. Leaving remains a separate operation with its old behavior.
Deleting the default MIT Campus group persists across server restarts; only a
database reset provisions it again. No public route can restore a deleted group.

```endpoints
groups.Delete at /groups/delete
```
