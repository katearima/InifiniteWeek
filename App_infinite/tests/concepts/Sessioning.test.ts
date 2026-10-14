import { afterEach, describe, expect, test } from "bun:test";
import { NotSignedIn, type Session, SessioningConcept } from "../../src/concepts/Sessioning/Sessioning.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { expectOneWinner } from "../support/reusable/race.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

async function setup() {
  const database = await testDatabase();
  // Starts at the real time so the database's expiry sweep never removes a session mid-test.
  const started = new Date();
  let now = started;
  const clock = () => now;
  const advance = (milliseconds: number) => (now = new Date(now.getTime() + milliseconds));
  return { sessioning: new SessioningConcept(database, "Sessioning", clock), database, started, advance };
}

describe("Sessioning", () => {
  test("its principle: Maya stays signed in until she signs out, leaves a session unused for a week, or reaches 90 days", async () => {
    const { sessioning, started, advance } = await setup();

    const { session: laptop, expiresAt } = await sessioning.start({ subject: "maya" });
    expect(expiresAt).toEqual(new Date(started.getTime() + 90 * DAY));
    expect(await sessioning.use({ session: laptop })).toEqual({ subject: "maya" });

    const { session: browser } = await sessioning.start({ subject: "maya" });
    expect(await sessioning.use({ session: browser })).toEqual({ subject: "maya" });
    expect(await sessioning.end({ session: browser })).toEqual({ session: browser });
    await expect(sessioning.use({ session: browser })).rejects.toThrow(NotSignedIn);

    const { session: library } = await sessioning.start({ subject: "maya" });
    for (let day = 1; day < 90; day += 1) {
      advance(DAY);
      expect(await sessioning.use({ session: laptop })).toEqual({ subject: "maya" });
      if (day === 7) {
        const refusal = sessioning.use({ session: library });
        await expect(refusal).rejects.toThrow(NotSignedIn);
        await expect(refusal).rejects.toThrow("Your session has ended. Sign in again.");
      }
    }

    advance(DAY);
    await expect(sessioning.use({ session: laptop })).rejects.toThrow(NotSignedIn);
  });

  test("a session's identity is 32 random bytes in base64url", async () => {
    const { sessioning } = await setup();
    const { session: first } = await sessioning.start({ subject: "maya" });
    const { session: second } = await sessioning.start({ subject: "maya" });
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  test("every use sets lastUsed to now, so the week of idleness counts from the latest use", async () => {
    const { sessioning, database, started, advance } = await setup();
    const sessions = database.collection<{ _id: string; lastUsed: Date }>("sessioning.sessions");
    const { session } = await sessioning.start({ subject: "maya" });

    advance(MINUTE);
    await sessioning.use({ session });
    expect((await sessions.findOne({ _id: session }))?.lastUsed).toEqual(new Date(started.getTime() + MINUTE));

    advance(7 * DAY - MINUTE);
    expect(await sessioning.use({ session })).toEqual({ subject: "maya" });
    advance(7 * DAY - MINUTE);
    expect(await sessioning.use({ session })).toEqual({ subject: "maya" });
    advance(7 * DAY);
    await expect(sessioning.use({ session })).rejects.toThrow(NotSignedIn);
  });

  test("a refused use or end changes no session", async () => {
    const { sessioning, database, advance } = await setup();
    const sessions = database.collection("sessioning.sessions");
    const { session: idle } = await sessioning.start({ subject: "maya" });
    const { session: forgotten } = await sessioning.start({ subject: "sam" });
    const before = await sessions.find().sort({ _id: 1 }).toArray();

    advance(7 * DAY);
    await expect(sessioning.use({ session: idle })).rejects.toThrow(NotSignedIn);
    await expect(sessioning.end({ session: forgotten })).rejects.toThrow(NotSignedIn);
    await expect(sessioning.end({ session: idle })).rejects.toThrow(NotSignedIn);
    expect(await sessions.find().sort({ _id: 1 }).toArray()).toEqual(before);
  });

  test("Sessioning refuses to use or end an unknown or ended session", async () => {
    const { sessioning } = await setup();
    await expect(sessioning.use({ session: "missing" as Session })).rejects.toThrow(NotSignedIn);
    await expect(sessioning.end({ session: "missing" as Session })).rejects.toThrow(NotSignedIn);

    const { session } = await sessioning.start({ subject: "maya" });
    await sessioning.end({ session });
    await expect(sessioning.end({ session })).rejects.toThrow(NotSignedIn);
    await expect(sessioning.use({ session })).rejects.toThrow(NotSignedIn);
  });

  test("of two ends of one session at once, Sessioning accepts one and refuses the other with NOT_SIGNED_IN", async () => {
    const { sessioning } = await setup();
    const { session } = await sessioning.start({ subject: "maya" });
    await expectOneWinner([sessioning.end({ session }), sessioning.end({ session })], NotSignedIn);
  });
});

test("expiry boundaries refuse use and end even while expired documents remain", async () => {
  const { sessioning, advance } = await setup();
  const { session: idleUse } = await sessioning.start({ subject: "idle" });
  const { session: idleEnd } = await sessioning.start({ subject: "idle" });
  const { session: absoluteUse } = await sessioning.start({ subject: "active" });
  const { session: absoluteEnd } = await sessioning.start({ subject: "active" });
  advance(7 * DAY - 1);
  await sessioning.use({ session: absoluteUse }); await sessioning.use({ session: absoluteEnd });
  advance(1);
  await expect(sessioning.use({ session: idleUse })).rejects.toThrow(NotSignedIn);
  await expect(sessioning.end({ session: idleEnd })).rejects.toThrow(NotSignedIn);
  for (let day = 7; day < 89; day++) {
    advance(DAY); await sessioning.use({ session: absoluteUse }); await sessioning.use({ session: absoluteEnd });
  }
  advance(DAY - 1);
  await sessioning.use({ session: absoluteUse }); await sessioning.use({ session: absoluteEnd });
  advance(1);
  await expect(sessioning.use({ session: absoluteUse })).rejects.toThrow(NotSignedIn);
  await expect(sessioning.end({ session: absoluteEnd })).rejects.toThrow(NotSignedIn);
});

// Register cleanup in each test file; Bun scopes imported hooks to their first file.
afterEach(cleanupDatabases);
