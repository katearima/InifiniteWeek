# Commenting

## Purpose

Maintain an authored plain-text discussion about an opaque subject.

**Prevents:** losing a discussion or attributing an edited message to someone
who did not write it.

## Principle

Maya posts about a subject. Others read the discussion in posting order and reply beneath it. A reply to a reply stays under the same root. Maya
corrects her text without changing its author or posting time; another person
cannot edit it. A trusted application moderator removes the comment. A removed root and all its replies no longer appear; another post creates a new identity.

Reply and thread-removal workflows must be serialized by the application host,
including reads and notification cleanup. Cascade deletion is not transactional:
a storage failure may leave some replies deleted, with the root retained for retry.
A lost final acknowledgement may mean deletion completed; inspect current state.

## Types

```types
external User
  The author of a comment.

external Subject
  An opaque reference whose existence and access policy belong to the caller.

opaque CommentCollection
  A finite array of Comment identities, including an empty array.
```

## State

```state
a set of Comments with
  an author User
  a subject Subject
  a parent String
  a text String
  a createdAt DateTime
  an edited Flag
  an editedAt DateTime

Rule: Text is trimmed, nonempty plain text of at most 2000 UTF-16 code units.
Rule: Only the author can revise. Identity, author, subject, and creation time never change.
Rule: Initially edited is false and editedAt equals createdAt. An actual edit sets edited true and editedAt to that edit's time.
Rule: Parent is empty for roots, otherwise the root comment identity. Legacy comments without parent are roots. Replies always share the root subject and occupy one level. Parent never changes.
Rule: Removal permanently deletes a reply alone or a root and all its replies. The trusted caller owns permission to remove it.
Rule: Expected refusals leave state unchanged.
```

## Actions

```actions
post(author: User, subject: Subject, text: String, comment: Comment, at: DateTime) : returns (comment: Comment)
  where comment is already in Comments
  then
    refuses COMMENT_ALREADY_EXISTS "This comment identity is already in use."
  where comment is not in Comments and trimmed text is empty or longer than 2000 UTF-16 code units
  then
    refuses INVALID_COMMENT_TEXT "Write a comment of 1 to 2000 characters."
  where comment is not in Comments and trimmed text is nonempty and at most 2000 UTF-16 code units
  then
    create comment with author, subject, empty parent, trimmed text, createdAt equal to at, edited false, and editedAt equal to at
    returns comment

reply(author: User, parent: Comment, text: String, comment: Comment, at: DateTime) : returns (comment: Comment)
  where comment is already in Comments
  then
    refuses COMMENT_ALREADY_EXISTS "This comment identity is already in use."
  where parent or its root is not in Comments
  then
    refuses COMMENT_NOT_FOUND "There is no such comment."
  where trimmed text is empty or longer than 2000 UTF-16 code units
  then
    refuses INVALID_COMMENT_TEXT "Write a comment of 1 to 2000 characters."
  where parent and its root exist and text is valid and comment is unused
  then
    create comment with author, the root's subject, parent equal to the root identity, trimmed text, createdAt and editedAt equal to at, and edited false
    returns comment

revise(user: User, comment: Comment, text: String, at: DateTime) : returns ()
  where comment is not in Comments
  then
    refuses COMMENT_NOT_FOUND "There is no such comment."
  where comment exists and user is not its author
  then
    refuses NOT_COMMENT_AUTHOR "Only the author can edit this comment."
  where comment exists and user is its author and trimmed text is invalid
  then
    refuses INVALID_COMMENT_TEXT "Write a comment of 1 to 2000 characters."
  where comment exists and user is its author and trimmed text is valid
  then
    if trimmed text differs, replace text and set edited true and editedAt to at
    otherwise preserve every field
    returns

remove(comment: Comment) : returns ()
  where comment is not in Comments
  then
    refuses COMMENT_NOT_FOUND "There is no such comment."
  where comment is in Comments
  then
    if comment is a root, delete its replies first, then delete comment
    otherwise delete only comment
    returns
```

## Queries

```queries
_removalTargets(comment: Comment) : one (comments: CommentCollection)
  Returns the comment followed by its replies ordered by identity when it is a root, only the comment for a reply, or an empty array when unknown. Reads state without changing it.

_getComment(comment: Comment) : optional (author: User, subject: Subject, text: String, createdAt: DateTime, edited: Flag, editedAt: DateTime, parent: String)
  Returns the comment, or no row for unknown or removed identities.

_getComments(subject: Subject) : many (comment: Comment, author: User, text: String, createdAt: DateTime, edited: Flag, editedAt: DateTime, parent: String)
  Returns comments ordered by createdAt ascending, then identity ascending; returns no rows when empty.
  Does not check subject existence or access.
```
