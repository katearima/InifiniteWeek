import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/EventMarking.md" with { type: "text" };
import type { Db } from "mongodb";
import type { User } from "../Registering/Registering.ts";
import type { Event } from "../EventPublishing/EventPublishing.ts";
import { EventMarkingConcept, NoMarkToRemove } from "./EventMarking.ts";
class EventMarking extends EventMarkingConcept<User, Event> {}
export const eventMarking = registerConcept({
  class: EventMarking, spec,
  refusals: {
    NO_MARK_TO_REMOVE: NoMarkToRemove,
  },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new EventMarking(database, name) },
});
