# Accounts

Registering owns user identities and usernames. Every protected endpoint first
passes its session credential to Sessioning.use and uses the returned subject
as its acting user. A caller cannot select another acting user in request input.
A missing, unknown, idle-expired, or expired session returns NOT_SIGNED_IN before
protected work begins. Session use can refresh lastUsed even when later work
refuses; that refresh is not rolled back.

The HTTP boundary carries session credentials in an HttpOnly cookie, issues it
only after successful signup/login, and clears it on logout, including an
already-invalid session. Configure the expected browser origin and production
secure-cookie policy. Session credentials and passwords must not appear in
ordinary logs or JavaScript-readable response data. Signup/login return the session
to the trusted HTTP adapter only: it consumes that field to issue the cookie and
removes the session field from the browser-facing JSON body. The browser receives user; the HTTP cookie policy consumes both session and
expiresAt when issuing the cookie. Neither is included in browser-facing JSON. These transport settings do
not change the endpoint identities below.

[Current account](reaction:accounts.Me) takes only the
session, uses it, reads Registering._username, and returns {user, username}.
If the session refers to an unknown registered user, refuse NOT_SIGNED_IN rather
than returning a partial account or leaving the request unanswered. Repeating
this read returns current identity and refreshes session usage.

[Sign out](reaction:accounts.SignOut) takes only the session,
asks Sessioning.end, and returns {} after that action succeeds. An invalid or
already-ended session returns NOT_SIGNED_IN; the browser still clears its cookie.
Other sessions belonging to the user are unaffected. If the response is lost,
repeating logout can report NOT_SIGNED_IN and still leaves the browser signed out.

```endpoints
accounts.Me at /auth/me
accounts.SignOut at /auth/logout
```

## Shared request and execution contract

Required input fields must be present with their declared shapes; malformed
requests return INVALID_INPUT before concept actions. Identity inputs are opaque
strings. Enum values must match the concept enumeration. Times must be valid
instants; no endpoint applies a past/upcoming cutoff. No endpoint offers a user
impersonation input. Target users such as a membership requester are different
from the authenticated actor.

Unless stated otherwise, expected concept refusals propagate as domain results;
an unexpected failure produces a framework failure, not success. Public HTTP
error categories must preserve the distinctions explicitly required by each
contract while hiding unexpected internals. Every mutation responds only after
its stated required effects finish. Repeated reads are permitted; repeated
creates are not automatically deduplicated. A caller must inspect current state
before retrying a create after a lost response. No cross-concept rollback,
exactly-once delivery, or cancellation of accepted work is promised.

The MVP runs one application process and one assembly. Its boundary serializes
all groups, events, and plans requests, including reads, across authentication,
policy checks, required actions, and completion of the accepted flow. Waiting
for a response timing out does not release this exclusion while accepted work
continues. Every browser, local client, and maintenance mutation uses this same
boundary; raw concept objects are not an alternate application API. This is an
explicit host requirement, not a guarantee supplied by sync-engine assembly.
It prevents leaving, cancellation, and marking from interleaving between policy
checks and effects. Multiple writers/processes require a new coordination design.
Within concepts, membership/organizer checks and unique-state transitions remain
owner-enforced. Read responses are snapshots; later revocation cannot erase data
already delivered to a browser. Clients reload affected views after mutations.

The paired documents define the complete selected endpoint, view, former, and
computation inventory for this phase. Required coordination belongs to endpoints,
except the two explicitly selected synchronous event-notification reactions;
their endpoints wait for all accepted work before success. There are no separate
cleanup reactions. In-app notifications and comments
share this boundary. External identity providers and external notification
delivery are not selected. Executable registration and generated wire
contracts will be added only after these declarations are implemented.

## Declaration naming

Composition identities use one module name followed by the declaration name,
for example events.Remove, groups.Approve, and plans.MyPlans. Views and formers
follow the same flat convention. The reusable source/design folder is file
organization only: its modules are installed as accounts and passwords, giving
accounts.Me and passwords.SignIn. No reading, writing, membership, or other
intermediate group is part of the assembled declaration path.

## Implemented HTTP contract

The application declares session as a required internal transport input on every
protected route. HTTP supplies its cookie value or null; the typed local client
also supplies null when the caller omits session. Browser bodies cannot override
the cookie. These adapters preserve NOT_SIGNED_IN for missing credentials.

All 38 routes are POST/JSON under /api, with a 768 KiB body limit to accommodate
bounded picture uploads. Picture reads and writes use the same authenticated
serialized boundary as other workflows. The HTTP policy maps expected refusals to
INVALID_REQUEST (400), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), or
CONFLICT (409). Unknown/inaccessible events remain identical NOT_FOUND responses;
unexpected failures are opaque INTERNAL_ERROR. Origin checks apply to login,
registration, logout, and every protected route. Only the configured public
origin is accepted when Origin is present; deliberately credentialed non-browser
clients may omit it. CORS is not enabled. Every API response is no-store.

Before queue admission, the host buffers each API request body with the same
768 KiB limit and a 30-second total request deadline. Incomplete bodies never
occupy the workflow queue. Oversized or unreadable bodies return INVALID_REQUEST
(400); body timeout returns opaque INTERNAL_ERROR (504), and caller abort returns
499. Body reading and queue waiting share the deadline. Shutdown cancels pending
body reads and refuses them with 503 before any concept action is admitted.

The host runs one queue across fully received HTTP requests through accepted-flow completion.
An aborted/timed-out waiter does not cancel accepted work or free the queue.
Shutdown stops admission, drains accepted work, and closes MongoDB. /health is
an infrastructure ping, not an application-state read; it returns 503 when the
database is unavailable or the host is draining.

After explicit signup or login succeeds, Vue replaces the route with #explore,
clears prior route/discussion/search state, and loads Explore. Failed authentication
keeps the form and current route. Ordinary authenticated reloads retain deep links.
