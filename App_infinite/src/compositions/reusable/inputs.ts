import type { EndpointOptions, EndpointValidator } from "@mit-sdg/sync-engine/boundary";

type Field = "text" | "date" | "policy" | "intent";
/** Explicit endpoint shapes also reject caller-supplied acting identities. */
export function inputs(fields: Record<string, Field> = {}, authenticated = true): EndpointOptions {
  const allowed = new Set([...Object.keys(fields), ...(authenticated ? ["session"] : [])]);
  return {
    input: { required: [...Object.keys(fields), ...(authenticated ? ["session"] : [])] },
    validators: {
      input: value => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
        const row = value as Record<string, unknown>;
        if (Object.keys(row).some(key => !allowed.has(key))) return { ok: false };
        if (authenticated && row.session !== null && typeof row.session !== "string") return { ok: false };
        for (const [key, kind] of Object.entries(fields)) {
          const v = row[key];
          if (kind === "date") { const date = v instanceof Date ? v : typeof v === "string" ? new Date(v) : null;
            if (!date || !Number.isFinite(date.getTime()) || (typeof v === "string" && date.toISOString() !== v)) return { ok: false }; }
          else if (typeof v !== "string") return { ok: false };
          else if (kind === "policy" && v !== "OPEN" && v !== "APPROVAL") return { ok: false };
          else if (kind === "intent" && !["GOING", "INTERESTED", "NOT_GOING"].includes(v)) return { ok: false };
        }
        return { ok: true };
      },
      output: completeReferences,
    },
  };
}
/** Optional reads retain nulls so corrupted references cannot silently omit people. */
const completeReferences: EndpointValidator = value => {
  function valid(node: unknown, key = ""): boolean {
    if (["username", "organizerUsername", "organizer", "group", "event", "user"].includes(key) && node === null) return false;
    if (Array.isArray(node)) return node.every(item => valid(item));
    if (node && typeof node === "object" && !(node instanceof Date)) return Object.entries(node).every(([k, v]) => valid(v, k));
    return true;
  }
  return { ok: valid(value) };
};
