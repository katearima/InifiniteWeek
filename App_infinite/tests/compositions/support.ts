import { afterEach } from "bun:test";
import { applicationConceptSet } from "../../src/concepts.ts";
import { createLocalApplication } from "../../src/host/local.ts";
import { cleanupDatabases, testDatabase } from "../support/reusable/mongo.ts";
export type Instances = ReturnType<typeof applicationConceptSet.implementations>;
const runtimes: ReturnType<typeof createLocalApplication>[] = [];
export async function setup(configure?: (instances: Instances) => void, options: Parameters<typeof createLocalApplication>[1] = {}) {
  const database = await testDatabase();
  const instances = applicationConceptSet.implementations("mongo", { database });
  configure?.(instances);
  const runtime = createLocalApplication({ database }, { ...options, instances }); runtimes.push(runtime);
  async function register(username: string) { return ok(await runtime.api.auth.register({ username, password: "correct-password" })); }
  return { ...runtime, database, instances, register };
}
export function cleanup() { afterEach(async () => { for (const runtime of runtimes.splice(0)) await runtime.beginDrain(); await cleanupDatabases(); }); }
export function ok<T>(result: T): Exclude<T, { error: unknown }> {
  if (result && typeof result === "object" && "error" in result) throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
  return result as Exclude<T, { error: unknown }>;
}
export const fields = { title: "Study", description: "Together", start: "2000-01-01T10:00:00.000Z", end: "2000-01-01T11:00:00.000Z", location: "MIT" };
