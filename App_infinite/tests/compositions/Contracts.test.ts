import { expect, test } from "bun:test";
import config from "../../generated.config.ts";
import { routes } from "./expected.ts";
import { cleanup, setup } from "./support.ts";
cleanup();
const selected = routes;
test("selected endpoint inventory and required/default contracts match authored routes without database access", () => {
  const application = config.assemble();
  expect(Object.keys(application.publicInterface.routes).sort()).toEqual(Object.keys(selected).sort());
  expect(Object.keys(selected)).toHaveLength(25);
  for (const [path, required] of Object.entries(selected)) {
    const contract = application.publicInterface.routes[path]!;
    expect([...(contract.required ?? [])].sort()).toEqual([...required, ...(["/auth/register", "/auth/login"].includes(path) ? [] : ["session"])].sort());
    expect(contract.defaults ?? {}).toEqual({});
  }
});
test("all selected routes reject acting-user overrides and missing required fields before any action", async () => {
  let calls = 0;
  const app = await setup(instances => {
    const original = instances.Sessioning.use.bind(instances.Sessioning);
    instances.Sessioning.use = async function use(args) { calls++; return original(args); };
    const endSession = instances.Sessioning.end.bind(instances.Sessioning);
    instances.Sessioning.end = async function end(args) { calls++; return endSession(args); };
    const registerUser = instances.Registering.register.bind(instances.Registering);
    instances.Registering.register = async function register(args) { calls++; return registerUser(args); };
  });
  for (const [path, required] of Object.entries(selected)) {
    const input = Object.fromEntries(required.map(key => [key, key === "start" ? "2000-01-01T00:00:00.000Z" : key === "end" ? "2000-01-02T00:00:00.000Z" : key === "intent" ? "GOING" : key === "policy" ? "OPEN" : "value"]));
    expect(await app.invoker.invoke(path, { ...input, user: "forged" })).toMatchObject({ error: { code: "INVALID_INPUT" } });
    for (const key of required) {
      const omitted = { ...input }; delete omitted[key];
      expect(await app.invoker.invoke(path, omitted)).toMatchObject({ error: { code: "INVALID_INPUT" } });
    }
    if (!path.startsWith("/auth/register") && !path.startsWith("/auth/login")) {
      expect(await app.invoker.invoke(path, input)).toEqual({ ok: false, error: { kind: "domain", value: "NOT_SIGNED_IN" } });
    }
  }
  expect(calls).toBe(23); // Only the well-shaped missing-session calls reach Sessioning.
});

test("generated read-back contains the exact five views and eleven flat formers", async () => {
  const readback = await Bun.file(new URL("../../generated/infinite-plans.md", import.meta.url)).text();
  const paths = (section: string) => [...section.matchAll(/Authored path: `([^`]+)`/g)].map(match => match[1]).sort();
  expect(paths(readback.split("## Views\n")[1]!.split("## Formers\n")[0]!)).toEqual([
    "access.canManageEvent", "access.canMarkEvent", "access.canReadEvent", "access.isMember", "access.organizesActiveEvent",
  ].sort());
  expect(paths(readback.split("## Formers\n")[1]!.split("## Reactions\n")[0]!)).toEqual([
    "groups.summaries", "groups.summary", "groups.members", "groups.requests", "groups.eventRows",
    "events.details", "events.exploreRows", "events.groupRows", "events.going", "events.interested", "plans.savedEvents",
  ].sort());
});
