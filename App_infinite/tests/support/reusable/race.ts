import { expect } from "bun:test";

type Refusal = new (message?: string) => Error;

/** Awaits attempts started together: exactly one succeeds, and every other one rejects with one of `refusals`. */
export async function expectOneWinner(attempts: Promise<unknown>[], ...refusals: Refusal[]): Promise<void> {
  const outcomes = await Promise.allSettled(attempts);
  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") expect(refusals).toContain(outcome.reason.constructor);
  }
}
