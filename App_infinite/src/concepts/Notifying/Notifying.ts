import { type Collection, type Db, MongoServerError } from "mongodb";

export type Notification = string & { readonly __brand: "Notification" };
export type SubjectCollection<Subject> = Subject[];
export type TargetCollection = string[];
export class NotificationNotFound extends Error {}
export class NotificationAlreadyExists extends Error {}
interface Entry<Subject> { notification: Notification; subject: Subject; message: string; createdAt: Date; read: boolean; target?: string }
interface Inbox<User, Subject> { _id: User; revision: number; entries: Entry<Subject>[] }
export class NotifyingConcept<User extends string, Subject extends string> {
  private readonly inboxes: Collection<Inbox<User, Subject>>;
  constructor(database: Db, name = "Notifying") {
    this.inboxes = database.collection(`${name.toLowerCase()}.inboxes`);
  }
  async #transition(user: User, decide: (entries: Entry<Subject>[]) => Entry<Subject>[]) {
    for (;;) {
      const current = await this.inboxes.findOne({ _id: user });
      const entries = decide(current?.entries ?? []);
      if (!current) {
        if (!entries.length) return {};
        try {
          await this.inboxes.insertOne({ _id: user, revision: 0, entries });
          return {};
        } catch (error) {
          if (error instanceof MongoServerError && error.code === 11000) continue;
          throw error;
        }
      }
      const result = await this.inboxes.replaceOne({ _id: user, revision: current.revision },
        { revision: current.revision + 1, entries });
      if (result.matchedCount) return {};
    }
  }
  async send({ user, subject, message, notification, at, target = "" }: { user: User; subject: Subject; message: string; notification: Notification; at: Date; target?: string }) {
    await this.#transition(user, entries => {
      if (entries.some(entry => entry.notification === notification)) throw new NotificationAlreadyExists("This notification identity is already in use.");
      return [...entries, { notification, subject, message, createdAt: at, read: false, target }];
    });
    return { notification };
  }
  async markRead({ user, notification }: { user: User; notification: Notification }) {
    return this.#transition(user, entries => {
      if (!entries.some(entry => entry.notification === notification)) throw new NotificationNotFound("There is no such notification.");
      return entries.map(entry => entry.notification === notification ? { ...entry, read: true } : entry);
    });
  }
  async markAllRead({ user }: { user: User }) {
    return this.#transition(user, entries => entries.map(entry => ({ ...entry, read: true })));
  }
  async dismiss({ user, notification }: { user: User; notification: Notification }) {
    return this.#transition(user, entries => {
      if (!entries.some(entry => entry.notification === notification)) throw new NotificationNotFound("There is no such notification.");
      return entries.filter(entry => entry.notification !== notification);
    });
  }
  async clear({ user, subjects }: { user: User; subjects: SubjectCollection<Subject> }) {
    const clearing = new Set(subjects);
    if (!clearing.size) return {};
    return this.#transition(user, entries => entries.filter(entry => !clearing.has(entry.subject)));
  }
  async clearTargets({ targets }: { targets: TargetCollection }) {
    const selected = [...new Set(targets.filter(Boolean))];
    if (selected.length) {
      // Atomic per inbox. Increment the revision so concurrent CAS writers retry
      // against the cleaned inbox instead of restoring removed notifications.
      await this.inboxes.updateMany({ "entries.target": { $in: selected } },
        [{ $set: {
          entries: { $filter: { input: "$entries", as: "entry",
            cond: { $not: [{ $in: ["$$entry.target", { $literal: selected }] }] } } },
          revision: { $add: ["$revision", 1] },
        } }]);
    }
    return {};
  }
  async _getNotifications({ user }: { user: User }) {
    return ((await this.inboxes.findOne({ _id: user }))?.entries ?? []).map(entry => ({ ...entry, target: entry.target ?? "" })).sort((left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() || (left.notification < right.notification ? -1 : left.notification > right.notification ? 1 : 0));
  }
  async _getNotification({ user, notification }: { user: User; notification: Notification }) {
    const entry = (await this._getNotifications({ user })).find(row => row.notification === notification);
    if (!entry) return [];
    const { notification: _notification, ...details } = entry;
    return [details];
  }
}
