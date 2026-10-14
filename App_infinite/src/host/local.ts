import { createLocalClient } from "@mit-sdg/sync-engine/client";
import type { InfinitePlansWire } from "../../generated/wire.ts";
import { createGateway, type Invoker } from "@mit-sdg/sync-engine/boundary";
import { createRuntime } from "./runtime.ts";

type OptionalSession<T> = "session" extends keyof T ? Omit<T, "session"> & { session?: T["session"] } : T;
export type InfinitePlansLocal = {
  [P in keyof InfinitePlansWire]: Omit<InfinitePlansWire[P], "input"> & { input: OptionalSession<InfinitePlansWire[P]["input"]> }
};
/** Create once per process; missing local credentials normalize to null. */
export function createLocalApplication(...args: Parameters<typeof createRuntime>) {
  const { application, boundary } = createRuntime(...args);
  const gateway = createGateway<InfinitePlansLocal>({ application: { ...boundary, publicInterface: application.publicInterface } });
  const invoker: Invoker<InfinitePlansLocal> = {
    invoke(path, input, options) {
      const normalized = application.publicInterface.routes[path]?.required?.includes("session") ? { session: null, ...input } : input;
      return gateway.invoke(path, normalized, options);
    },
  };
  return { ...boundary, api: createLocalClient<InfinitePlansLocal>({ invoker }), publicInterface: application.publicInterface };
}
