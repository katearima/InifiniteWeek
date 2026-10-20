const pages = ["explore", "groups", "plans", "calendar", "group", "event", "notifications"];
export function parseRoute(hash: string) {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const [next = "", rawId = ""] = path.split("/");
  const page = pages.includes(next) ? next : "explore";
  let id = "";
  try { id = decodeURIComponent(rawId); } catch { /* Invalid identities fail normal access checks. */ }
  return { page, id, comment: page === "event" ? new URLSearchParams(query).get("comment") ?? "" : "" };
}
export function routeHash(page: string, id = "", comment = "") {
  return `#${page}${id ? `/${encodeURIComponent(id)}` : ""}${page === "event" && comment ? `?comment=${encodeURIComponent(comment)}` : ""}`;
}
