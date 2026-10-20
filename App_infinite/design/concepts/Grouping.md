# Grouping

## Purpose

Let people form communities and control who is recognized as a member through
open joining or approval by existing members.

**Prevents:** uncertainty about who belongs to a group, or admission without
member approval when the group requires it.

## Principle

A user creates a group and becomes its first member. Another user may then attempt to join the group. If the group's policy is OPEN, the user becomes a member immediately. If the policy is APPROVAL, the attempt creates a pending join request that an existing member can approve or reject. If the group is later changed to OPEN, all pending requesters become members and their requests are removed. Members may leave the group at any time. If the last member leaves, the group becomes OPEN. Any pending requesters then become members. If there are no pending requests, the group remains empty and can be joined by any user.

The sole remaining member may explicitly delete a group instead of leaving it. Deletion removes the group and all pending requests; it does not admit requesters.

## Types

```types
external User
  A person who creates a group, belongs to it, or requests membership.

JoiningPolicy is OPEN or APPROVAL
  OPEN permits direct joining; APPROVAL requires member approval while that policy remains in effect.

JoinStatus is JOINED or PENDING
  JOINED means membership was created. PENDING means a request was created awaiting approval.
```

## State

```state
a set of Groups with
  a name String
  a description String
  a picture String
  a policy JoiningPolicy
  a members set of User
  a joinRequests set of User

Rule: A group may have no members only when its policy is OPEN. Each user appears at most once in its members set.
Rule: A group's joinRequests contains the users awaiting membership approval, with each user appearing at most once. None of these users is already a member.
Rule: An OPEN group's joinRequests is empty.
Rule: All members have equal authority to approve or reject requests and change the joining policy.
Rule: Whenever a group becomes OPEN, all pending requesters become members and their requests are removed as part of the same action. Existing members remain unless explicitly leaving.
Rule: A refused action leaves the state unchanged.
Rule: All members have equal authority to change the group picture. Picture is initially empty. Empty means no picture; otherwise it is a JPEG data URL, at most 512 KiB decoded, with valid JPEG framing and frame dimensions of 1 through 1600 pixels on each axis. Existing records without a picture read as empty. Membership changes preserve the picture; deletion removes it.
```

## Actions

```actions
createGroup(user: User, name: String, description: String, policy: JoiningPolicy) : returns (group: Group)
  where true
  then
    add a new group with name, description, and policy, whose members contain only user and whose joinRequests is empty
    returns group

join(user: User, group: Group) : returns (status: JoinStatus)
  where group is not in Groups
  then
    refuses JOIN_GROUP_NOT_FOUND "There is no such group to join."
  where group is in Groups and user is a member of group
  then
    refuses JOIN_ALREADY_MEMBER "You are already a member of this group."
  where group is in Groups and user is not a member and its policy is OPEN
  then
    add user to the group's members
    set status to JOINED
    returns status
  where group is in Groups and user is not a member and its policy is APPROVAL and user is in the group's joinRequests
  then
    refuses REQUEST_ALREADY_PENDING "You already have a pending request for this group."
  where group is in Groups and user is not a member and its policy is APPROVAL and user is not in the group's joinRequests
  then
    add user to the group's joinRequests without adding user to its members
    set status to PENDING
    returns status

approve(group: Group, user: User, requester: User) : returns ()
  where group is not in Groups
  then
    refuses APPROVE_GROUP_NOT_FOUND "There is no such group."
  where group is in Groups and user is not a member of group
  then
    refuses APPROVE_NOT_MEMBER "Only a group member can approve a join request."
  where group is in Groups and user is a member and requester is not in the group's joinRequests
  then
    refuses APPROVE_REQUEST_NOT_FOUND "There is no such pending request for this group."
  where group is in Groups and user is a member and requester is in the group's joinRequests
  then
    add requester to the group's members
    remove requester from the group's joinRequests
    returns

reject(group: Group, user: User, requester: User) : returns ()
  where group is not in Groups
  then
    refuses REJECT_GROUP_NOT_FOUND "There is no such group."
  where group is in Groups and user is not a member of group
  then
    refuses REJECT_NOT_MEMBER "Only a group member can reject a join request."
  where group is in Groups and user is a member and requester is not in the group's joinRequests
  then
    refuses REJECT_REQUEST_NOT_FOUND "There is no such pending request for this group."
  where group is in Groups and user is a member and requester is in the group's joinRequests
  then
    remove requester from the group's joinRequests without changing its members
    returns

leave(user: User, group: Group) : returns ()
  where group is not in Groups
  then
    refuses LEAVE_GROUP_NOT_FOUND "There is no such group to leave."
  where group is in Groups and user is not a member of group
  then
    refuses LEAVE_NOT_MEMBER "You are not a member of this group."
  where group is in Groups and user is its only member
  then
    remove user from the group's members
    set the group's policy to OPEN
    add every user in the group's joinRequests to its members
    empty the group's joinRequests
    keep the group even if it has no members
    returns
  where group is in Groups and user is a member and at least one other member remains
  then
    remove user from the group's members
    returns

deleteGroup(user: User, group: Group) : returns ()
  where group is not in Groups
  then
    refuses DELETE_GROUP_NOT_FOUND "There is no such group to delete."
  where group is in Groups and user is not a member
  then
    refuses DELETE_NOT_MEMBER "Only a member can delete the group."
  where group is in Groups and user is a member and another member remains
  then
    refuses DELETE_NOT_LAST_MEMBER "Only the last member can delete the group."
  where group is in Groups and user is its only member
  then
    remove group from Groups, including all its membership and pending requests
    returns

setPicture(user: User, group: Group, picture: String) : returns ()
  where group is not in Groups
  then
    refuses PICTURE_GROUP_NOT_FOUND "There is no such group."
  where group exists and user is not a member
  then
    refuses PICTURE_NOT_MEMBER "Only a group member can change its picture."
  where group exists and user is a member and picture is invalid
  then
    refuses INVALID_PICTURE "Choose a supported picture of at most 512 KiB after resizing."
  where group exists and user is a member and picture is valid
  then
    replace picture, preserving all other group fields
    returns

changePolicy(user: User, group: Group, policy: JoiningPolicy) : returns ()
  where group is not in Groups
  then
    refuses POLICY_GROUP_NOT_FOUND "There is no such group."
  where group is in Groups and user is not a member of group
  then
    refuses POLICY_NOT_MEMBER "Only a group member can change its joining policy."
  where group is in Groups and user is a member of group and policy is OPEN
  then
    set the group's policy to OPEN
    add every user in the group's joinRequests to its members, preserving existing members
    empty the group's joinRequests
    returns
  where group is in Groups and user is a member of group and policy is APPROVAL
  then
    set the group's policy to APPROVAL, including when it already equals APPROVAL
    leave memberships and pending requests unchanged
    returns
```

## Queries

```queries
_getPicture(group: Group) : optional (picture: String)
  Returns the group picture or an empty string when absent. Returns no row for unknown or deleted groups.

_getGroupDetails(group: Group) : optional (name: String, description: String, policy: JoiningPolicy)
  Returns the group's name, description, and current joining policy.
  Returns no row when group is unknown.

_getGroups() : many (group: Group, name: String, description: String, policy: JoiningPolicy)
  Returns all groups with their current details, or no rows when no groups exist.
  Orders rows lexicographically by group identifier.

_getMembers(group: Group) : many (user: User)
  Returns the group's members, or no rows when group is unknown or has no members.
  Orders rows lexicographically by user identifier.

_isMember(user: User, group: Group) : one (member: Flag)
  Returns true when user belongs to group, and false otherwise, including when group is unknown.

_getGroupsByUser(user: User) : many (group: Group)
  Returns the groups whose members contain user, or no rows when user belongs to none.
  Orders rows lexicographically by group identifier.

_isOnlyMember(user: User, group: Group) : one (only: Flag)
  Returns true exactly when group exists and user is its sole member; false otherwise.

_isPending(user: User, group: Group) : one (pending: Flag)
  Returns true when user is in the group's joinRequests, and false otherwise, including when group is unknown.

_getPendingRequests(group: Group) : many (user: User)
  Returns each user in the group's joinRequests.
  Returns no rows when group is unknown or has no pending requests.
  Orders rows lexicographically by user identifier.

```
