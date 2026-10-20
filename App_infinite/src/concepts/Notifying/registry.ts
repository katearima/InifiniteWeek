import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Notifying.md" with { type: "text" };
import type { Db } from "mongodb";
import type { User } from "../Registering/Registering.ts";
import type { Event } from "../EventPublishing/EventPublishing.ts";
import { NotifyingConcept, NotificationNotFound, NotificationAlreadyExists } from "./Notifying.ts";
class Notifying extends NotifyingConcept<User, Event> {}
export const notifying = registerConcept({
  class: Notifying, spec,
  refusals: { NOTIFICATION_NOT_FOUND: NotificationNotFound, NOTIFICATION_ALREADY_EXISTS: NotificationAlreadyExists },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new Notifying(database, name) },
});
