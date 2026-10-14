import { MongoClient } from "mongodb";
import { RegisteringConcept } from "../src/concepts/Registering/Registering.ts";
import { AuthenticatingConcept } from "../src/concepts/Authenticating/Authenticating.ts";
import { SessioningConcept } from "../src/concepts/Sessioning/Sessioning.ts";
import { GroupingConcept } from "../src/concepts/Grouping/Grouping.ts";
import { EventPublishingConcept } from "../src/concepts/EventPublishing/EventPublishing.ts";
import { EventMarkingConcept } from "../src/concepts/EventMarking/EventMarking.ts";

// Explicit integration check: restarts only this Compose project's mongo service.
const url = process.env.MONGODB_TEST_URL;
if (!url) throw new Error("Set MONGODB_TEST_URL to this project's local Compose MongoDB.");
const name = `infiniteplans_restart_${crypto.randomUUID().replaceAll("-", "")}`;
let client = new MongoClient(url);
try {
  await client.connect(); const db = client.db(name);
  const { user } = await new RegisteringConcept(db).register({ username: "restart" });
  await new AuthenticatingConcept(db).set({ user, password: "restart-password" });
  const { session } = await new SessioningConcept(db).start({ subject: user });
  const { group } = await new GroupingConcept(db).createGroup({ user, name: "Restart", description: "", policy: "OPEN" });
  const { event } = await new EventPublishingConcept(db).publish({ organizer: user, group, title: "Restart", description: "", start: new Date("2000-01-01"), end: new Date("2000-01-02"), location: "MIT" });
  await new EventMarkingConcept(db).mark({ user, event, intent: "GOING" });
  await client.close();
  client = new MongoClient(url, { serverSelectionTimeoutMS: 30000 });
  const restart = Bun.spawn(["podman", "compose", "restart", "mongo"], { cwd: new URL("..", import.meta.url).pathname, stdout: "inherit", stderr: "inherit" });
  if (await restart.exited !== 0) throw new Error("MongoDB restart failed");
  await client.connect(); const restored = client.db(name);
  function equal(actual: unknown, expected: unknown) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Persistence assertion failed");
  }
  equal(await new RegisteringConcept(restored)._byUsername({ username: "restart" }), [{ user }]);
  equal(await new AuthenticatingConcept(restored).authenticate({ user, password: "restart-password" }), { user });
  equal(await new SessioningConcept(restored).use({ session }), { subject: user });
  equal(await new GroupingConcept(restored)._isMember({ user, group }), { member: true });
  equal((await new EventPublishingConcept(restored)._getEventDetails({ event }))[0]?.title, "Restart");
  equal(await new EventMarkingConcept(restored)._getMyEvents({ user }), [{ event, intent: "GOING" }]);
  console.log("All six concepts retained state after MongoDB restart.");
} finally {
  try { await client.db(name).dropDatabase(); } finally { await client.close(); }
}
