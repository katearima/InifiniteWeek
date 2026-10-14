# Password sign-in

Reuse Conceptbox's separation of accounts from password authentication. Username
identity belongs to Registering, verifiers to Authenticating, and sessions to
Sessioning. Usernames are exact and case-sensitive under Registering's existing
rules; passwords are passed unchanged and are never stored as plaintext.

[Sign up](reaction:passwords.Register) takes username and
password, with no session required. First ask Authenticating._acceptable. A false
answer returns INVALID_PASSWORD before any account is created. Otherwise call
Registering.register, Authenticating.set for the returned user, and
Sessioning.start for that user, in that order. Return {user, session, expiresAt}
only after all three actions succeed. The HTTP boundary installs the session
cookie as described in [accounts](accounts.md).

Invalid usernames and duplicate usernames propagate Registering's refusals.
An existing username is never reused as a password-setup target. A repeated
successful signup returns USERNAME_TAKEN; it cannot replace the existing password.
Expected validation failures precede account creation. Unexpected failures later
in the chain may leave earlier state: registration without a password reserves
the username and requires developer repair; password setup without session
issuance can recover through ordinary login. There is no automatic rollback or
public passwordless-account claiming endpoint. Do not promise that every partial
signup can be repaired by retrying. A successful signup whose response is lost
can likewise recover through login.

[Sign in](reaction:passwords.SignIn) takes username and password,
with no session required. Read Registering._byUsername, then authenticate the
returned user and start a session. Return {user, session, expiresAt} after session
creation. An unknown username explicitly returns INVALID_CREDENTIALS, as does
an incorrect password or a user with no verifier. Never silently drop the unknown
username branch. Each successful retry may create another independent session;
if issuance fails, previously established accounts/verifiers remain unchanged.

```endpoints
passwords.Register at /auth/register
passwords.SignIn at /auth/login
```

Demo provisioning, if used, supplies predefined accounts through the same concept
operations; it is not a public endpoint and does not introduce another identity
owner. Public signup is part of this MVP. Password recovery and MIT login are not.
