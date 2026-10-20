import type { Collection, Db } from "mongodb";
import { validatePicture } from "../../picture.ts";
export type Event = string & { readonly __brand: "Event" };
export type EventCollection = Event[];
export class InvalidPublicationTime extends Error {}
export class EventNotFoundForRevision extends Error {}
export class NotEventOrganizer extends Error {}
export class EventCanceledForRevision extends Error {}
export class InvalidRevisionTime extends Error {}
export class EventNotFoundForRemoval extends Error {}
export class NotEventOrganizerForRemoval extends Error {}
export class EventAlreadyCanceled extends Error {}
interface Details { title: string; description: string; start: Date; end: Date; location: string }
interface EventDocument<User, Group> extends Details {
  _id: Event; organizer: User; group: Group; canceled: boolean; revision: number;
  timeChanged?: boolean; previousStart?: Date; previousEnd?: Date;
  picture?: string;
}
function validTime(start: Date, end: Date) {
  return start instanceof Date && end instanceof Date && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < end;
}
export class EventPublishingConcept<User extends string, Group extends string> {
  private readonly events: Collection<EventDocument<User, Group>>;
  constructor(database: Db, name = "EventPublishing") {
    this.events = database.collection(`${name.toLowerCase()}.events`);
  }
  async publish({ organizer, group, title, description, start, end, location }: Details & { organizer: User; group: Group }) {
    if (!validTime(start, end)) throw new InvalidPublicationTime("The event must start before it ends.");
    const event = crypto.randomUUID() as Event;
    await this.events.insertOne({ _id: event, organizer, group, title, description, start, end, location, canceled: false, revision: 0, timeChanged: false, previousStart: start, previousEnd: end });
    return { event };
  }
  async #transition<Result>(event: Event, decide: (row: EventDocument<User, Group> | null) => { row: EventDocument<User, Group>; result: Result }): Promise<Result> {
    for (;;) {
      const { row, result } = decide(await this.events.findOne({ _id: event }));
      const revision = row.revision;
      row.revision += 1;
      if ((await this.events.replaceOne({ _id: event, revision }, row)).matchedCount) return result;
    }
  }
  async revise({ user, event, title, description, start, end, location }: Details & { user: User; event: Event }) {
    return this.#transition(event, row => {
      if (!row) throw new EventNotFoundForRevision("There is no such event to revise.");
      if (row.organizer !== user) throw new NotEventOrganizer("Only the event's organizer can revise it.");
      if (row.canceled) throw new EventCanceledForRevision("A canceled event cannot be revised.");
      if (!validTime(start, end)) throw new InvalidRevisionTime("The event must start before it ends.");
      const moved = row.start.getTime() !== start.getTime() || row.end.getTime() !== end.getTime();
      return { result: { timeOrLocationChanged: moved || row.location !== location }, row: { ...row, title, description, start, end, location,
        ...(moved ? { timeChanged: true, previousStart: row.start, previousEnd: row.end } : {}),
      } };
    });
  }
  async setPicture({ user, event, picture }: { user: User; event: Event; picture: string }) {
    return this.#transition(event, row => {
      if (!row) throw new EventNotFoundForRevision("There is no such event to revise.");
      if (row.organizer !== user) throw new NotEventOrganizer("Only the event's organizer can revise it.");
      if (row.canceled) throw new EventCanceledForRevision("A canceled event cannot be revised.");
      validatePicture(picture);
      return { row: { ...row, picture }, result: {} };
    });
  }
  async _getPicture({ event }: { event: Event }) {
    const row = await this.events.findOne({ _id: event }, { projection: { picture: 1 } });
    return row ? [{ picture: row.picture ?? "" }] : [];
  }
  async remove({ user, event }: { user: User; event: Event }) {
    return this.#transition(event, row => {
      if (!row) throw new EventNotFoundForRemoval("There is no such event to remove.");
      if (row.organizer !== user) throw new NotEventOrganizerForRemoval("Only the event's organizer can remove it.");
      if (row.canceled) throw new EventAlreadyCanceled("This event is already canceled.");
      return { row: { ...row, canceled: true }, result: {} };
    });
  }
  async _getEventDetails({ event }: { event: Event }) {
    const row = await this.events.findOne({ _id: event }, { projection: { picture: 0 } });
    if (!row) return [];
    const { _id, revision, picture, ...details } = row;
    // Old documents have no change history until their next actual time revision.
    return [{ ...details, timeChanged: row.timeChanged ?? false,
      previousStart: row.previousStart ?? row.start, previousEnd: row.previousEnd ?? row.end }];
  }
  async _getEventsByOrganizer({ organizer }: { organizer: User }) {
    return (await this.events.find({ organizer }, { projection: { _id: 1 } }).sort({ start: 1, _id: 1 }).toArray()).map(row => ({ event: row._id }));
  }
  async _getEventCollection({ group }: { group: Group }): Promise<{ events: EventCollection }> {
    const rows = await this.events.find({ group }, { projection: { _id: 1 } }).sort({ start: 1, _id: 1 }).toArray();
    return { events: rows.map(row => row._id) };
  }
  async _getEventsByGroup({ group }: { group: Group }) {
    return (await this.events.find({ group }, { projection: { _id: 1 } }).sort({ start: 1, _id: 1 }).toArray()).map(row => ({ event: row._id }));
  }
}
