import type { Collection, Db } from "mongodb";
import { validatePicture } from "../../picture.ts";

export type Group = string & { readonly __brand: "Group" };
export type JoiningPolicy = "OPEN" | "APPROVAL";
export type JoinStatus = "JOINED" | "PENDING";
export class JoinGroupNotFound extends Error {}
export class JoinAlreadyMember extends Error {}
export class RequestAlreadyPending extends Error {}
export class ApproveGroupNotFound extends Error {}
export class ApproveNotMember extends Error {}
export class ApproveRequestNotFound extends Error {}
export class RejectGroupNotFound extends Error {}
export class RejectNotMember extends Error {}
export class RejectRequestNotFound extends Error {}
export class LeaveGroupNotFound extends Error {}
export class LeaveNotMember extends Error {}
export class PolicyGroupNotFound extends Error {}
export class PolicyNotMember extends Error {}
export class DeleteGroupNotFound extends Error {}
export class DeleteNotMember extends Error {}
export class DeleteNotLastMember extends Error {}
export class PictureGroupNotFound extends Error {}
export class PictureNotMember extends Error {}
export interface GroupDocument<User> {
  _id: Group; name: string; description: string; policy: JoiningPolicy;
  members: User[]; joinRequests: User[]; revision: number; deleted?: boolean;
  picture?: string;
}

/** Owns membership and admission, independently of event and account state. */
export class GroupingConcept<User extends string> {
  private readonly groups: Collection<GroupDocument<User>>;
  constructor(database: Db, name = "Grouping") {
    this.groups = database.collection(`${name.toLowerCase()}.groups`);
  }
  async createGroup({ user, name, description, policy }: { user: User; name: string; description: string; policy: JoiningPolicy }) {
    const group = crypto.randomUUID() as Group;
    await this.groups.insertOne({ _id: group, name, description, policy, members: [user], joinRequests: [], revision: 0 });
    return { group };
  }
  // Every decision is made from one snapshot. If it changed, recheck authority and all branches.
  async #transition<Result>(group: Group, decide: (row: GroupDocument<User> | null) => { row: GroupDocument<User>; result: Result }): Promise<Result> {
    for (;;) {
      const current = await this.groups.findOne({ _id: group, deleted: { $ne: true } });
      const { row, result } = decide(current);
      const revision = row.revision;
      row.revision += 1;
      const written = await this.groups.replaceOne({ _id: group, revision }, row);
      if (written.matchedCount) return result;
    }
  }
  async join({ user, group }: { user: User; group: Group }) {
    return this.#transition(group, row => {
      if (!row) throw new JoinGroupNotFound("There is no such group to join.");
      if (row.members.includes(user)) throw new JoinAlreadyMember("You are already a member of this group.");
      if (row.policy === "OPEN") {
        row.members.push(user);
        return { row, result: { status: "JOINED" as JoinStatus } };
      }
      if (row.joinRequests.includes(user)) throw new RequestAlreadyPending("You already have a pending request for this group.");
      row.joinRequests.push(user);
      return { row, result: { status: "PENDING" as JoinStatus } };
    });
  }
  async approve({ group, user, requester }: { group: Group; user: User; requester: User }) {
    return this.#transition(group, row => {
      if (!row) throw new ApproveGroupNotFound("There is no such group.");
      if (!row.members.includes(user)) throw new ApproveNotMember("Only a group member can approve a join request.");
      if (!row.joinRequests.includes(requester)) throw new ApproveRequestNotFound("There is no such pending request for this group.");
      row.members.push(requester);
      row.joinRequests = row.joinRequests.filter(value => value !== requester);
      return { row, result: {} };
    });
  }
  async reject({ group, user, requester }: { group: Group; user: User; requester: User }) {
    return this.#transition(group, row => {
      if (!row) throw new RejectGroupNotFound("There is no such group.");
      if (!row.members.includes(user)) throw new RejectNotMember("Only a group member can reject a join request.");
      if (!row.joinRequests.includes(requester)) throw new RejectRequestNotFound("There is no such pending request for this group.");
      row.joinRequests = row.joinRequests.filter(value => value !== requester);
      return { row, result: {} };
    });
  }
  async leave({ user, group }: { user: User; group: Group }) {
    return this.#transition(group, row => {
      if (!row) throw new LeaveGroupNotFound("There is no such group to leave.");
      if (!row.members.includes(user)) throw new LeaveNotMember("You are not a member of this group.");
      row.members = row.members.filter(value => value !== user);
      if (!row.members.length) {
        row.policy = "OPEN";
        row.members = row.joinRequests;
        row.joinRequests = [];
      }
      return { row, result: {} };
    });
  }
  async deleteGroup({ user, group }: { user: User; group: Group }) {
    return this.#transition(group, row => {
      if (!row) throw new DeleteGroupNotFound("There is no such group to delete.");
      if (!row.members.includes(user)) throw new DeleteNotMember("Only a member can delete the group.");
      if (row.members.length !== 1) throw new DeleteNotLastMember("Only the last member can delete the group.");
      // Keep the identity as a tombstone so startup provisioning cannot restore it.
      return { row: { ...row, deleted: true, picture: "", members: [], joinRequests: [], policy: "OPEN" }, result: {} };
    });
  }
  async _isOnlyMember({ user, group }: { user: User; group: Group }) {
    const row = await this.groups.findOne({ _id: group, deleted: { $ne: true } }, { projection: { members: 1 } });
    return { only: !!row && row.members.length === 1 && row.members[0] === user };
  }
  async changePolicy({ user, group, policy }: { user: User; group: Group; policy: JoiningPolicy }) {
    return this.#transition(group, row => {
      if (!row) throw new PolicyGroupNotFound("There is no such group.");
      if (!row.members.includes(user)) throw new PolicyNotMember("Only a group member can change its joining policy.");
      row.policy = policy;
      if (policy === "OPEN") {
        row.members = [...new Set([...row.members, ...row.joinRequests])];
        row.joinRequests = [];
      }
      return { row, result: {} };
    });
  }
  async setPicture({ user, group, picture }: { user: User; group: Group; picture: string }) {
    return this.#transition(group, row => {
      if (!row) throw new PictureGroupNotFound("There is no such group.");
      if (!row.members.includes(user)) throw new PictureNotMember("Only a group member can change its picture.");
      validatePicture(picture);
      return { row: { ...row, picture }, result: {} };
    });
  }
  async _getPicture({ group }: { group: Group }) {
    const row = await this.groups.findOne({ _id: group, deleted: { $ne: true } }, { projection: { picture: 1 } });
    return row ? [{ picture: row.picture ?? "" }] : [];
  }
  async _getGroupDetails({ group }: { group: Group }) {
    const row = await this.groups.findOne({ _id: group, deleted: { $ne: true } }, { projection: { name: 1, description: 1, policy: 1 } });
    return row ? [{ name: row.name, description: row.description, policy: row.policy }] : [];
  }
  async _getGroups(_input: Record<string, never>) {
    return (await this.groups.find({ deleted: { $ne: true } }, { projection: { name: 1, description: 1, policy: 1 } }).sort({ _id: 1 }).toArray()).map(row => ({ group: row._id, name: row.name, description: row.description, policy: row.policy }));
  }
  async _getMembers({ group }: { group: Group }) {
    const row = await this.groups.findOne({ _id: group, deleted: { $ne: true } }, { projection: { members: 1 } });
    return (row?.members ?? []).sort().map(user => ({ user }));
  }
  async _isMember({ user, group }: { user: User; group: Group }) {
    return { member: (await this.groups.findOne({ _id: group, members: user, deleted: { $ne: true } }, { projection: { _id: 1 } })) !== null };
  }
  async _getGroupsByUser({ user }: { user: User }) {
    return (await this.groups.find({ members: user, deleted: { $ne: true } }, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray()).map(row => ({ group: row._id }));
  }
  async _isPending({ user, group }: { user: User; group: Group }) {
    return { pending: (await this.groups.findOne({ _id: group, joinRequests: user, deleted: { $ne: true } }, { projection: { _id: 1 } })) !== null };
  }
  async _getPendingRequests({ group }: { group: Group }) {
    const row = await this.groups.findOne({ _id: group, deleted: { $ne: true } }, { projection: { joinRequests: 1 } });
    return (row?.joinRequests ?? []).sort().map(user => ({ user }));
  }
}
