# Infinite Plans Application Types

Registering owns user identities. Authentication, sessions, groups,
event publishing, attendance marking, commenting, and notifying all refer to
those same users. Commenting and Notifying use EventPublishing.Event as their
opaque Subject; membership and event access stay in composition.

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

instantiate Commenting with
  User is Registering.User
  Subject is EventPublishing.Event

instantiate Notifying with
  User is Registering.User
  Subject is EventPublishing.Event
```
