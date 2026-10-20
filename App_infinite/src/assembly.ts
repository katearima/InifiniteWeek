import { composition as accounts } from "./compositions/reusable/accounts.ts";
import { composition as passwords } from "./compositions/reusable/passwords.ts";
import { composition as access } from "./compositions/access.ts";
import { composition as events } from "./compositions/events.ts";
import { composition as groups } from "./compositions/groups.ts";
import { composition as plans } from "./compositions/plans.ts";
import { composition as comments } from "./compositions/comments.ts";
import { composition as notifications } from "./compositions/notifications.ts";
import { assemble, type LogSink } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { applicationConceptSet } from "./concepts.ts";

/** Raw assembly for generation and controlled fixtures; hosts use createLocalApplication. */
export function assembleApplication(resources: { database: Db }, options: { instances?: ReturnType<typeof applicationConceptSet.implementations>; logSink?: LogSink } = {}) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: options.instances ?? applicationConceptSet.implementations("mongo", resources),
    logSink: options.logSink,
    redaction: { fields: ["password", "session", "verifier", "picture"] },
    composition: { accounts, passwords, access, groups, events, plans, comments, notifications },
  });
}
