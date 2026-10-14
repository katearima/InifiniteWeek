// Adapted from ConceptBox; see LICENSES/ConceptBox.txt.
import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Registering.md" with { type: "text" };
import type { Db } from "mongodb";
import { InvalidUsername, RegisteringConcept, UsernameTaken } from "./Registering.ts";

export const registering = registerConcept({
  class: RegisteringConcept,
  spec,
  refusals: {
    INVALID_USERNAME: InvalidUsername,
    USERNAME_TAKEN: UsernameTaken,
  },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new RegisteringConcept(database, name) },
});
