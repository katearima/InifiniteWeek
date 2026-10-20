import { eventSortKey, requireEventGroup, eventDate, newIdentity, commentPermissions, eventSubjects, newCommentIdentity } from "./computations.ts";
import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { registering } from "./concepts/Registering/registry.ts";
import { authenticating } from "./concepts/Authenticating/registry.ts";
import { sessioning } from "./concepts/Sessioning/registry.ts";
import { grouping } from "./concepts/Grouping/registry.ts";
import { eventPublishing } from "./concepts/EventPublishing/registry.ts";
import { eventMarking } from "./concepts/EventMarking/registry.ts";
import { commenting } from "./concepts/Commenting/registry.ts";
import { notifying } from "./concepts/Notifying/registry.ts";

export const applicationConceptSet = conceptSet({
  Registering: registering,
  Authenticating: authenticating,
  Sessioning: sessioning,
  Grouping: grouping,
  EventPublishing: eventPublishing,
  EventMarking: eventMarking,
  Commenting: commenting,
  Notifying: notifying,
}, { eventSortKey, requireEventGroup, eventDate, newIdentity, commentPermissions, eventSubjects, newCommentIdentity });
export const { concepts, computations } = applicationConceptSet;
