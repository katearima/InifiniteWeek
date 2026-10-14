# Authenticating

## Purpose

Let people come back to their account by proving who they are with a password.

*Prevents:* someone signs in with a password other than the one set for that user; someone replaces the password of an account that already has one; someone who reads the stored data learns a person's password.

## Principle

Ben sets a password when he signs up, and the next day he authenticates with it. Leo guesses at Ben's password and is refused with "The username or password is incorrect." Leo then tries to set a new password for Ben, and is refused with "This account already has a password."

## Types

```types
external User
  The person a password belongs to.

opaque Secret
  A password verifier derived with a random salt; the implementer chooses how to represent it.
```

## State

```state
a set of Users with
  a verifier Secret

Rule: Authenticating stores only a verifier derived from the password, never the password itself.
```

## Actions

```actions
set(user: User, password: String) : returns (user: User)
  where password is shorter than 8 or longer than 128 characters
  then
    refuses INVALID_PASSWORD "A password must have 8 to 128 characters."
  where user already has a verifier
  then
    refuses PASSWORD_SET "This account already has a password."
  where password is accepted and user has no verifier
  then
    add user with a verifier derived from password
    returns user

authenticate(user: User, password: String) : returns (user: User)
  where user has no verifier, or password does not match it
  then
    refuses INVALID_CREDENTIALS "The username or password is incorrect."
  where password matches the user's verifier
  then
    returns user
```

## Queries

```queries
_acceptable(password: String) : one (acceptable: Flag)
  Returns true when the password has 8 to 128 characters, and false otherwise.
```
