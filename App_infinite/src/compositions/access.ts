import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
const { Grouping, EventPublishing } = concepts;
export const isMember = view("(user) belongs to (group)", ({ user, group }) =>
  where(Grouping._isMember({ user, group }).is({ member: true }))).holds();
export const canReadEvent = view("(user) can read (event)", ({ user, event }, {}, { group }) =>
  where(EventPublishing._getEventDetails({ event }).is({ group }), isMember({ user, group }))).holds();
export const canManageEvent = view("(user) can manage (event)", ({ user, event }) =>
  where(canReadEvent({ user, event }), EventPublishing._getEventDetails({ event }).is({ organizer: user }))).holds();
export const canMarkEvent = view("(user) can mark (event)", ({ user, event }) =>
  where(canReadEvent({ user, event }), EventPublishing._getEventDetails({ event }).is({ canceled: false }))).holds();
export const organizesActiveEvent = view("(user) organizes an active event in (group)", ({ user, group }, {}, { event }) =>
  where(EventPublishing._getEventsByGroup({ group }).is({ event }), EventPublishing._getEventDetails({ event }).is({ organizer: user, canceled: false }))).holds();
export const composition = { isMember, canReadEvent, canManageEvent, canMarkEvent, organizesActiveEvent };
