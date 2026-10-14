import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Grouping.md" with { type: "text" };
import type { Db } from "mongodb";
import type { User } from "../Registering/Registering.ts";

import { GroupingConcept, DeleteGroupNotFound, DeleteNotMember, DeleteNotLastMember, JoinGroupNotFound, JoinAlreadyMember, RequestAlreadyPending, ApproveGroupNotFound, ApproveNotMember, ApproveRequestNotFound, RejectGroupNotFound, RejectNotMember, RejectRequestNotFound, LeaveGroupNotFound, LeaveNotMember, PolicyGroupNotFound, PolicyNotMember } from "./Grouping.ts";
class Grouping extends GroupingConcept<User> {}
export const grouping = registerConcept({
  class: Grouping, spec,
  refusals: {
    DELETE_GROUP_NOT_FOUND: DeleteGroupNotFound,
    DELETE_NOT_MEMBER: DeleteNotMember,
    DELETE_NOT_LAST_MEMBER: DeleteNotLastMember,
    JOIN_GROUP_NOT_FOUND: JoinGroupNotFound,
    JOIN_ALREADY_MEMBER: JoinAlreadyMember,
    REQUEST_ALREADY_PENDING: RequestAlreadyPending,
    APPROVE_GROUP_NOT_FOUND: ApproveGroupNotFound,
    APPROVE_NOT_MEMBER: ApproveNotMember,
    APPROVE_REQUEST_NOT_FOUND: ApproveRequestNotFound,
    REJECT_GROUP_NOT_FOUND: RejectGroupNotFound,
    REJECT_NOT_MEMBER: RejectNotMember,
    REJECT_REQUEST_NOT_FOUND: RejectRequestNotFound,
    LEAVE_GROUP_NOT_FOUND: LeaveGroupNotFound,
    LEAVE_NOT_MEMBER: LeaveNotMember,
    POLICY_GROUP_NOT_FOUND: PolicyGroupNotFound,
    POLICY_NOT_MEMBER: PolicyNotMember,
  },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new Grouping(database, name) },
});
