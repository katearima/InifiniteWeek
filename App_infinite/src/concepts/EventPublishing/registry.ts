import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/EventPublishing.md" with { type: "text" };
import type { Db } from "mongodb";
import { InvalidPicture } from "../../picture.ts";
import type { User } from "../Registering/Registering.ts";
import type { Group } from "../Grouping/Grouping.ts";
import { EventPublishingConcept, InvalidPublicationTime, EventNotFoundForRevision, NotEventOrganizer, EventCanceledForRevision, InvalidRevisionTime, EventNotFoundForRemoval, NotEventOrganizerForRemoval, EventAlreadyCanceled, InvalidEventDetails } from "./EventPublishing.ts";
class EventPublishing extends EventPublishingConcept<User, Group> {}
export const eventPublishing = registerConcept({
  class: EventPublishing, spec,
  refusals: {
    INVALID_PICTURE: InvalidPicture,
    INVALID_PUBLICATION_TIME: InvalidPublicationTime,
    EVENT_NOT_FOUND_FOR_REVISION: EventNotFoundForRevision,
    NOT_EVENT_ORGANIZER: NotEventOrganizer,
    EVENT_CANCELED_FOR_REVISION: EventCanceledForRevision,
    INVALID_REVISION_TIME: InvalidRevisionTime,
    EVENT_NOT_FOUND_FOR_REMOVAL: EventNotFoundForRemoval,
    NOT_EVENT_ORGANIZER_FOR_REMOVAL: NotEventOrganizerForRemoval,
    EVENT_ALREADY_CANCELED: EventAlreadyCanceled,
    INVALID_EVENT_DETAILS: InvalidEventDetails,
  },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new EventPublishing(database, name) },
});
