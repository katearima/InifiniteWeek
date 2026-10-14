import { expect, test } from "bun:test";
import type { InvocationResult, Invoker } from "@mit-sdg/sync-engine/boundary";
import type { ContractShape } from "@mit-sdg/sync-engine/client";
import { serializedInvoker } from "../../src/host/serialized.ts";
function latch() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
const success: InvocationResult = { ok: true, value: {} };
test("timeout ends caller waiting but exclusion lasts until the flow is idle", async () => {
  const entered = latch(), finishWork = latch(); const calls: string[] = [];
  const inner: Invoker<ContractShape> = { invoke: async path => { calls.push(path); entered.release(); return success; } };
  let first = true;
  const boundary = serializedInvoker({ invoker: inner, whenIdle: () => { if (first) { first = false; return finishWork.promise; } return Promise.resolve(); }, beginDrain: async () => {} });
  await boundary.invoker.invoke("/first", {}); await entered.promise;
  const second = boundary.invoker.invoke("/second", {}, { timeoutMs: 10 });
  expect(await second).toMatchObject({ ok: false, error: { code: "TIMED_OUT" } });
  expect(calls).toEqual(["/first"]);
  finishWork.release(); await boundary.whenIdle();
  await boundary.invoker.invoke("/third", {}); expect(calls).toEqual(["/first", "/third"]);
});
test("active timeout and abort do not admit queued requests until work finishes", async () => {
  const entered = latch(), release = latch(); let calls = 0;
  const boundary = serializedInvoker({ invoker: { invoke: async () => { calls++; entered.release(); await release.promise; return success; } }, whenIdle: async () => { await release.promise; }, beginDrain: async () => {} });
  const first = boundary.invoker.invoke("/first", {}, { timeoutMs: 10 });
  await entered.promise;
  const controller = new AbortController();
  const aborted = boundary.invoker.invoke("/queued", {}, { signal: controller.signal }); controller.abort();
  expect(await first).toMatchObject({ error: { code: "TIMED_OUT" } });
  expect(await aborted).toMatchObject({ error: { code: "ABORTED" } });
  expect(calls).toBe(1);
  release.release(); await boundary.whenIdle(); expect(calls).toBe(1);
});
test("drain completes admitted requests, refuses new ones, and waits for quiescence", async () => {
  const gate = latch(); let drained = false;
  const boundary = serializedInvoker({ invoker: { invoke: async () => { await gate.promise; return success; } }, whenIdle: async () => {}, beginDrain: async () => { drained = true; } });
  const accepted = boundary.invoker.invoke("/first", {}); const draining = boundary.beginDrain();
  expect(await boundary.invoker.invoke("/later", {})).toMatchObject({ error: { code: "UNAVAILABLE" } });
  expect(drained).toBe(false); gate.release(); await accepted; await draining; expect(drained).toBe(true);
});
test("unexpected invocation failures do not poison the queue, and queued inputs are snapshots", async () => {
  const gate = latch(); let calls = 0; let seen: unknown;
  const boundary = serializedInvoker({ invoker: { invoke: async (_path, input) => { if (++calls === 1) { await gate.promise; throw new Error("secret failure"); } seen = input; return success; } }, whenIdle: async () => {}, beginDrain: async () => {} });
  const first = boundary.invoker.invoke("/first", {});
  const input = { text: "before" }; const second = boundary.invoker.invoke("/second", input); input.text = "after";
  gate.release(); expect(await first).toEqual({ ok: false, error: { kind: "framework", code: "INTERNAL_ERROR" } });
  expect(await second).toEqual(success); expect(seen).toEqual({ text: "before" });
  expect(await boundary.invoker.invoke("/invalid", {}, { timeoutMs: 0 })).toMatchObject({ error: { code: "INVALID_INPUT" } });
});

test("failed idle confirmation closes admission instead of overlapping uncertain work", async () => {
  let calls = 0;
  const boundary = serializedInvoker({ invoker: { invoke: async () => { calls++; return success; } }, whenIdle: async () => { throw new Error("idle failed"); }, beginDrain: async () => {} });
  const first = boundary.invoker.invoke("/first", {}), queued = boundary.invoker.invoke("/queued", {});
  expect(await first).toEqual(success);
  expect(await queued).toMatchObject({ error: { code: "UNAVAILABLE" } });
  expect(calls).toBe(1);
  await expect(boundary.whenIdle()).rejects.toThrow("idle failed");
  await expect(boundary.beginDrain()).rejects.toThrow("idle failed");
});
