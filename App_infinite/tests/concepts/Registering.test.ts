import { afterEach, describe, expect, test } from "bun:test";
import {
  InvalidUsername,
  RegisteringConcept,
  type User,
  UsernameTaken,
} from "../../src/concepts/Registering/Registering.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
import { expectOneWinner } from "../support/reusable/race.ts";

async function setup() {
  return { registering: new RegisteringConcept(await testDatabase()) };
}

describe("Registering", () => {
  test("its principle: Sam finds Maya by her username, and Ben registers another when hers is taken", async () => {
    const { registering } = await setup();

    const { user: maya } = await registering.register({ username: "maya" });
    expect(await registering._byUsername({ username: "maya" })).toEqual([{ user: maya }]);
    expect(await registering._username({ user: maya })).toEqual([{ username: "maya" }]);

    const taken = registering.register({ username: "maya" });
    await expect(taken).rejects.toThrow(UsernameTaken);
    await expect(taken).rejects.toThrow("That username is taken.");
    const { user: ben } = await registering.register({ username: "ben" });
    expect(ben).not.toBe(maya);
  });

  test("a username must have 3 to 32 ASCII letters, digits, underscores, or hyphens", async () => {
    const { registering } = await setup();
    for (const username of ["ma", "x".repeat(33), "maya lee", "maya!", ""]) {
      await expect(registering.register({ username })).rejects.toThrow(InvalidUsername);
    }
    for (const username of ["abc", "x".repeat(32), "maya_lee-2"]) {
      await registering.register({ username });
    }
  });

  test("usernames are case-sensitive, so `Maya` is a different username from `maya`", async () => {
    const { registering } = await setup();
    const { user: maya } = await registering.register({ username: "maya" });
    const { user: other } = await registering.register({ username: "Maya" });
    expect(other).not.toBe(maya);
  });

  test("of two registrations of one username at once, one succeeds and the other is refused with USERNAME_TAKEN", async () => {
    const { registering } = await setup();
    await expectOneWinner(
      [registering.register({ username: "maya" }), registering.register({ username: "maya" })],
      UsernameTaken,
    );
  });

  test("_username and _byUsername return no row for an unknown user or username", async () => {
    const { registering } = await setup();
    expect(await registering._username({ user: "missing" as User })).toEqual([]);
    expect(await registering._byUsername({ username: "nobody" })).toEqual([]);
  });
});

// Register cleanup in each test file; Bun scopes imported hooks to their first file.
afterEach(cleanupDatabases);

test("same instance restores the unique index after its collection is dropped", async () => {
  const db = await testDatabase();
  const registering = new RegisteringConcept(db);
  await registering.register({ username: "before_reset" });
  await db.collection("registering.users").drop();
  await expectOneWinner([
    registering.register({ username: "Keti" }), registering.register({ username: "Keti" }),
  ], UsernameTaken);
  expect(await db.collection("registering.users").countDocuments({ username: "Keti" })).toBe(1);
  expect((await db.collection("registering.users").indexes()).some(i => i.name === "username_1" && i.unique)).toBe(true);
});

test("a removed username index is restored before another account can be inserted", async () => {
  const db = await testDatabase(); const registering = new RegisteringConcept(db);
  const { user } = await registering.register({ username: "Keti" });
  await db.collection("registering.users").dropIndex("username_1");
  await expect(registering.register({ username: "Keti" })).rejects.toThrow(UsernameTaken);
  expect(await registering._byUsername({ username: "Keti" })).toEqual([{ user }]);
  await registering.register({ username: "keti" });
});

test("preexisting duplicate data refuses further registration without deleting accounts", async () => {
  const db = await testDatabase(); const registering = new RegisteringConcept(db);
  await db.collection("registering.users").insertMany([{ username: "Keti" }, { username: "Keti" }]);
  await expect(registering.register({ username: "Keti" })).rejects.toThrow(UsernameTaken);
  await expect(registering.register({ username: "new_user" })).rejects.toThrow();
  expect(await db.collection("registering.users").countDocuments()).toBe(2);
});
