# Notifying

## Purpose

Remember recipient-owned inbox entries and whether their recipient read them.

**Prevents:** forgetting a notice or treating another person's acknowledgement
as the recipient's own.

## Principle

The application sends Maya a notice referring to a subject. It appears unread
in her inbox, independent of other inboxes. Maya marks it read, then dismisses
it. Reading it again before dismissal changes nothing. Others cannot read or
dismiss it on her behalf. Clearing notices for supplied subjects affects neither
her other notices nor anyone else's inbox. When a destination is removed, the trusted application clears notices for its target from all inboxes.

## Types

```types
external User
  The recipient of an inbox entry.

external Subject
  An opaque reference interpreted and authorized by the caller.

opaque TargetCollection
  A finite array of opaque target strings; empty arrays and duplicates are harmless.

opaque SubjectCollection
  A finite array of external Subject identities; empty arrays and duplicates are harmless.
```

## State

```state
a set of Notifications with
  a user User
  a subject Subject
  a target String
  a message String
  a createdAt DateTime
  a read Flag

Rule: Each send creates a distinct recipient-owned entry, initially unread, with no expiry.
Rule: Unknown and foreign identities have the same refusal for reading or dismissal.
Rule: Bulk clearing one user's supplied subjects and marking all their entries read are atomic transitions.
Rule: Target is an opaque destination within a subject, interpreted by the caller. Missing or omitted targets read as empty, meaning the subject itself.
Rule: Target cleanup is atomic per inbox, not across users; storage failure can leave partial cleanup, and repeating cleanup is safe. Empty target strings are ignored.
Rule: Expected refusals leave state unchanged.
```

## Actions

```actions
send(user: User, subject: Subject, message: String, notification: Notification, at: DateTime, target?: String) : returns (notification: Notification)
  where user's inbox already has notification
  then
    refuses NOTIFICATION_ALREADY_EXISTS "This notification identity is already in use."
  where user's inbox does not have notification
  then
    add notification with user, subject, message, target or empty when omitted, createdAt equal to at, and read false
    returns notification

markRead(user: User, notification: Notification) : returns ()
  where notification does not exist or belongs to another user
  then
    refuses NOTIFICATION_NOT_FOUND "There is no such notification."
  where notification belongs to user
  then
    set read true, including when already true
    returns

markAllRead(user: User) : returns ()
  where true
  then
    atomically set read true on all user's current entries, including an empty inbox
    returns

dismiss(user: User, notification: Notification) : returns ()
  where notification does not exist or belongs to another user
  then
    refuses NOTIFICATION_NOT_FOUND "There is no such notification."
  where notification belongs to user
  then
    permanently remove notification
    returns

clearTargets(targets: TargetCollection) : returns ()
  where true
  then
    remove entries with a nonempty target in targets from every user's inbox, atomically per inbox
    preserve unrelated entries and ignore duplicates, empty strings, and absent targets
    returns

clear(user: User, subjects: SubjectCollection) : returns ()
  where true
  then
    atomically remove user's entries whose subject is in subjects
    ignore empty arrays, duplicate subjects, and absent entries
    returns
```

## Queries

```queries
_getNotifications(user: User) : many (notification: Notification, subject: Subject, message: String, createdAt: DateTime, read: Flag, target: String)
  Returns only user's entries, ordered by createdAt descending then identity ascending; no rows for an empty inbox or unknown user.

_getNotification(user: User, notification: Notification) : optional (subject: Subject, message: String, createdAt: DateTime, read: Flag, target: String)
  Returns the entry only when it belongs to user; otherwise returns no row.
```
