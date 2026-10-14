# Infinite Plans Application Types

Registering owns user identities. Authentication, sessions, groups,
event publishing, and attendance marking all refer to those same users.

Grouping owns group identities, and EventPublishing owns event identities.

```instances
instantiate Registering

instantiate Authenticating with
  User is Registering.User

instantiate Sessioning with
  Subject is Registering.User

instantiate Grouping with
  User is Registering.User

instantiate EventPublishing with
  User is Registering.User
  Group is Grouping.Group

instantiate EventMarking with
  User is Registering.User
  Event is EventPublishing.Event
```
