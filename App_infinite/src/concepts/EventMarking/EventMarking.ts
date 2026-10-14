import { type Collection, type Db, MongoServerError } from "mongodb";
export type AttendanceIntent = "INTERESTED" | "GOING" | "NOT_GOING";
export type EventCollection<Event> = Event[];
export class NoMarkToRemove extends Error {}
interface Mark<Event> { event: Event; intent: AttendanceIntent }
interface MarksDocument<User, Event> { _id: User; revision: number; marks: Mark<Event>[] }
export class EventMarkingConcept<User extends string, Event extends string> {
  private readonly users: Collection<MarksDocument<User, Event>>;
  constructor(database: Db, name = "EventMarking") {
    this.users = database.collection(`${name.toLowerCase()}.users`);
  }
  // A user's entire mark set is one document, so clearing any collection commits atomically.
  async #transition(user: User, decide: (marks: Mark<Event>[]) => Mark<Event>[]) {
    for (;;) {
      const current = await this.users.findOne({ _id: user });
      const marks = decide(current?.marks ?? []);
      if (!current) {
        if (!marks.length) return {};
        try {
          await this.users.insertOne({ _id: user, revision: 0, marks });
          return {};
        } catch (error) {
          if (error instanceof MongoServerError && error.code === 11000) continue;
          throw error;
        }
      }
      const written = await this.users.replaceOne({ _id: user, revision: current.revision }, { revision: current.revision + 1, marks });
      if (written.matchedCount) return {};
    }
  }
  async mark({ user, event, intent }: { user: User; event: Event; intent: AttendanceIntent }) {
    return this.#transition(user, marks => [...marks.filter(mark => mark.event !== event), { event, intent }]);
  }
  async removeMark({ user, event }: { user: User; event: Event }) {
    return this.#transition(user, marks => {
      if (!marks.some(mark => mark.event === event)) throw new NoMarkToRemove("There is no mark for this event to remove.");
      return marks.filter(mark => mark.event !== event);
    });
  }
  async clearMarks({ user, events }: { user: User; events: EventCollection<Event> }) {
    const clearing = new Set(events);
    if (!clearing.size) return {};
    return this.#transition(user, marks => marks.filter(mark => !clearing.has(mark.event)));
  }
  async #marks(user: User) {
    return ((await this.users.findOne({ _id: user }))?.marks ?? []).sort((a, b) => a.event < b.event ? -1 : a.event > b.event ? 1 : 0);
  }
  async _getMarksByEvent({ event }: { event: Event }) {
    const rows = await this.users.find({ "marks.event": event }).sort({ _id: 1 }).toArray();
    return rows.map(row => ({ user: row._id, intent: row.marks.find(mark => mark.event === event)!.intent }));
  }
  async _getMyEvents({ user }: { user: User }) {
    return (await this.#marks(user)).filter(mark => mark.intent !== "NOT_GOING");
  }
  async _getInterestedEvents({ user }: { user: User }) {
    return (await this.#marks(user)).filter(mark => mark.intent === "INTERESTED").map(({ event }) => ({ event }));
  }
  async _getGoingEvents({ user }: { user: User }) {
    return (await this.#marks(user)).filter(mark => mark.intent === "GOING").map(({ event }) => ({ event }));
  }
  async _getNotGoingEvents({ user }: { user: User }) {
    return (await this.#marks(user)).filter(mark => mark.intent === "NOT_GOING").map(({ event }) => ({ event }));
  }
  async _isMarked({ user, event }: { user: User; event: Event }) {
    return { marked: (await this.#marks(user)).some(mark => mark.event === event) };
  }
}
