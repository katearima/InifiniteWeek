import { createGateway, type Invoker } from "@mit-sdg/sync-engine/boundary";
import type { ContractShape } from "@mit-sdg/sync-engine/client";
import type { InfinitePlansWire } from "../../generated/wire.ts";
import { assembleApplication } from "../assembly.ts";
import { serializedExecutor } from "./serialized.ts";

/** Internal host wiring. All public invocation paths must use this one queue. */
export function createRuntime(...args: Parameters<typeof assembleApplication>) {
  const application = assembleApplication(...args);
  const gateway = createGateway<InfinitePlansWire>({ application });
  const queue = serializedExecutor(application);
  const invoker: Invoker<ContractShape> = {
    async invoke(path, input, options = {}) {
      let snapshot: unknown;
      try { snapshot = structuredClone(input); }
      catch { return { ok: false, error: { kind: "framework", code: "INVALID_INPUT" } }; }
      if (application.publicInterface.routes[path]?.required?.includes("session") && snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && !("session" in snapshot)) {
        snapshot = { ...snapshot, session: null };
      }
      const result = await queue.submit(() => application.invoker.invoke(path, snapshot, options), options);
      return result.ok ? result.value : result;
    },
  };
  return { application, gateway, queue, boundary: { invoker, whenIdle: queue.whenIdle, beginDrain: queue.beginDrain } };
}
