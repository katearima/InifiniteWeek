import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import spec from "@design/concepts/Commenting.md" with { type: "text" };
import type { Db } from "mongodb";
import type { User } from "../Registering/Registering.ts";
import type { Event } from "../EventPublishing/EventPublishing.ts";
import { CommentingConcept, InvalidCommentText, CommentNotFound, NotCommentAuthor, CommentAlreadyExists } from "./Commenting.ts";
class Commenting extends CommentingConcept<User, Event> {}
export const commenting = registerConcept({
  class: Commenting, spec,
  refusals: { INVALID_COMMENT_TEXT: InvalidCommentText, COMMENT_NOT_FOUND: CommentNotFound,
    NOT_COMMENT_AUTHOR: NotCommentAuthor, COMMENT_ALREADY_EXISTS: CommentAlreadyExists },
  floors: { mongo: ({ database }: { database: Db }, name: string) => new Commenting(database, name) },
});
