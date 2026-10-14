import { eventSortKey, requireEventGroup, eventDate } from "./computations.ts";
import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { registering } from "./concepts/Registering/registry.ts";
import { authenticating } from "./concepts/Authenticating/registry.ts";
import { sessioning } from "./concepts/Sessioning/registry.ts";
import { grouping } from "./concepts/Grouping/registry.ts";
import { eventPublishing } from "./concepts/EventPublishing/registry.ts";
import { eventMarking } from "./concepts/EventMarking/registry.ts";

export const applicationConceptSet = conceptSet({
  Registering: registering,
  Authenticating: authenticating,
  Sessioning: sessioning,
  Grouping: grouping,
  EventPublishing: eventPublishing,
  EventMarking: eventMarking,
}, { eventSortKey, requireEventGroup, eventDate });
export const { concepts, computations } = applicationConceptSet;
