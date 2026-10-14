import { MongoServerError, type Db } from "mongodb";
import type { Group, GroupDocument } from "../concepts/Grouping/Grouping.ts";

export const MIT_CAMPUS_GROUP = "00000000-0000-4000-8000-000000000001" as Group;

/** Run before assembling/serving the app; never reset an existing group's state. */
export async function initializeDefaultGroups(database: Db): Promise<void> {
  const groups = database.collection<GroupDocument<string>>("grouping.groups");
  try {
    await groups.updateOne({ _id: MIT_CAMPUS_GROUP }, {
      $setOnInsert: {
        name: "MIT Campus",
        description: "A place for the MIT community to share events and make plans together.",
        policy: "OPEN",
        members: [],
        joinRequests: [],
        revision: 0,
      },
    }, { upsert: true });
  } catch (error) {
    // Another initializer may win the unique _id race. Other failures must stop startup.
    if (!(error instanceof MongoServerError && error.code === 11000 && await groups.findOne({ _id: MIT_CAMPUS_GROUP }))) throw error;
  }
}
