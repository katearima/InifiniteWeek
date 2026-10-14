# Registering

## Purpose

Let people choose a username that others can find them by.

*Prevents:* two people end up with the same username.

## Principle

Maya registers the username `maya`. When Sam types `maya`, Registering returns Maya's user, and her username appears beside the files she shares with him. Ben tries to register `maya` too, and is refused with "That username is taken.", so he registers `ben`.

## Types

```types
```

## State

```state
a set of Users with
  a unique username String
```

## Actions

```actions
register(username: String) : returns (user: User)
  where username is not 3 to 32 ASCII letters, digits, underscores, or hyphens
  then
    refuses INVALID_USERNAME "A username must have 3 to 32 letters, digits, underscores, or hyphens."
  where some user has username
  then
    refuses USERNAME_TAKEN "That username is taken."
  where username is accepted and no user has username
  then
    add a new user with username
    returns user
```

## Queries

```queries
_byUsername(username: String) : optional (user: User)
  Returns the user with exactly this username, or no row when nobody has it.

_username(user: User) : optional (username: String)
  Returns the user's username, or no row for an unknown user.
```
