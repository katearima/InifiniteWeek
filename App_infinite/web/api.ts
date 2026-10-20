import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { InfinitePlansWireHttp as Wire } from "../generated/wire.ts";
export const api = createHttpClient<Wire>({ baseUrl: "/api" });
export type Account = Wire["/auth/me"]["output"];
export type Group = Wire["/groups/list"]["output"]["groups"][number];
export type EventRow = Wire["/events/details"]["output"]["event"];
export type Person = Wire["/groups/members"]["output"]["members"][number];
export type Intent = Wire["/plans/mark"]["input"]["intent"];
export type CommentRow = Wire["/comments/list"]["output"]["comments"][number];
export type NotificationRow = Wire["/notifications/list"]["output"]["notifications"][number];
export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export async function read<T>(request: Promise<T>, context = "complete that request"): Promise<Exclude<T, { error: unknown }>> {
  const result = await request;
  if (result && typeof result === "object" && "error" in result) {
    const code = String(result.error);
    const messages: Record<string, string> = {
      UNAUTHORIZED: "Please sign in to continue.",
      FORBIDDEN: "You do not have permission to do that. Refresh to check your access.",
      NOT_FOUND: "This item is unavailable. It may no longer be accessible to you.",
      CONFLICT: "That change conflicts with the current state. Refresh and try again.",
      INVALID_REQUEST: "Check the fields and try again.",
      NETWORK_ERROR: "Cannot reach the server. Check your connection, then try again.",
      INTERNAL_ERROR: `Could not ${context}. Refresh to check whether the change completed before trying again.`,
      TIMED_OUT: "The request took too long. Refresh to check whether it completed before trying again.",
    };
    throw new ApiError(code, messages[code] ?? `Could not ${context}. Please try again.`);
  }
  return result as Exclude<T, { error: unknown }>;
}
