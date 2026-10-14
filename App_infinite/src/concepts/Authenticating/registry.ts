// Adapted from ConceptBox; see LICENSES/ConceptBox.txt.
import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Authenticating.md" with { type: "text" };
import type { Db } from "mongodb";
import type { User } from "../Registering/Registering.ts";
import { AuthenticatingConcept, InvalidCredentials, InvalidPassword, PasswordSet } from "./Authenticating.ts";

class Authenticating extends AuthenticatingConcept<User> {}

export const authenticating = registerConcept({
  class: Authenticating,
  spec,
  refusals: {
    INVALID_PASSWORD: InvalidPassword,
    PASSWORD_SET: PasswordSet,
    INVALID_CREDENTIALS: InvalidCredentials,
  },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new Authenticating(database, name) },
});
