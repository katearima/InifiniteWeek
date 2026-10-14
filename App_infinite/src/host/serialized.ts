import type { ContractShape } from "@mit-sdg/sync-engine/client";
import type { Invoker, InvocationResult, InvokeOptions } from "@mit-sdg/sync-engine/boundary";

type Application = { invoker: Invoker<ContractShape>; whenIdle(): Promise<void>; beginDrain(): Promise<void> };
function failure(code: "INVALID_INPUT" | "TIMED_OUT" | "ABORTED" | "UNAVAILABLE" | "INTERNAL_ERROR"): Extract<InvocationResult, { ok: false }> {
  return { ok: false, error: { kind: "framework", code } };
}

/** One queue per assembly. Caller cancellation never releases accepted causal work. */
export function serializedExecutor(application: Pick<Application, "whenIdle" | "beginDrain">) {
  let tail: Promise<void> = Promise.resolve();
  let closing = false;
  let idleFailure: unknown;
  const executor = {
    submit<T>(work: () => Promise<T>, options: InvokeOptions = {}): Promise<InvocationResult<T>> {
      const timeoutMs = options.timeoutMs ?? 30_000;
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) return Promise.resolve(failure("INVALID_INPUT"));
      if (closing) return Promise.resolve(failure("UNAVAILABLE"));
      if (options.signal?.aborted) return Promise.resolve(failure("ABORTED"));
      const deadline = Date.now() + timeoutMs;
      let finished = false;
      let complete!: (result: InvocationResult<T>) => void;
      const answer = new Promise<InvocationResult<T>>(resolve => { complete = resolve; });
      const finish = (result: InvocationResult<T>) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        complete(result);
      };
      const abort = () => finish(failure("ABORTED"));
      const timer = setTimeout(() => finish(failure("TIMED_OUT")), timeoutMs);
      options.signal?.addEventListener("abort", abort, { once: true });
      tail = tail.then(async () => {
        if (finished) return; // Expired while queued: no concept action is admitted.
        if (idleFailure) { finish(failure("UNAVAILABLE")); return; }
        const remaining = deadline - Date.now();
        if (remaining <= 0) { finish(failure("TIMED_OUT")); return; }
        try {
          finish({ ok: true, value: await work() });
        } catch { finish(failure("INTERNAL_ERROR")); }
        finally {
          try { await application.whenIdle(); }
          catch (error) {
            // Without confirmed quiescence, never admit another accepted request.
            idleFailure = error || new Error("Assembly idle confirmation failed");
            closing = true;
          }
        }
      });
      return answer;
    },
  };
  return {
    ...executor,
    async whenIdle() { await tail; if (idleFailure) throw idleFailure; },
    async beginDrain() {
      closing = true;
      await tail;
      if (idleFailure) throw idleFailure;
      await application.beginDrain();
    },
  };
}

export function serializedInvoker(application: Application) {
  const queue = serializedExecutor(application);
  const invoker: Invoker<ContractShape> = {
    async invoke(path, input, options = {}) {
      let snapshot: unknown;
      try { snapshot = structuredClone(input); } catch { return failure("INVALID_INPUT"); }
      const result = await queue.submit(() => application.invoker.invoke(path, snapshot, options), options);
      return result.ok ? result.value : result;
    },
  };
  return { invoker, whenIdle: queue.whenIdle, beginDrain: queue.beginDrain };
}
