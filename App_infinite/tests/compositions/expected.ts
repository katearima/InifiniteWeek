/** Hand-maintained specification inventory, independent of generated code. */
export const routes = {
  "/auth/register": ["username", "password"], "/auth/login": ["username", "password"],
  "/auth/me": [], "/auth/logout": [],
  "/groups/list": [], "/groups/details": ["group"], "/groups/members": ["group"], "/groups/requests": ["group"],
  "/groups/create": ["name", "description", "policy"], "/groups/join": ["group"],
  "/groups/approve": ["group", "requester"], "/groups/reject": ["group", "requester"],
  "/groups/delete": ["group"], "/groups/policy": ["group", "policy"], "/groups/leave": ["group"],
  "/events/explore": [], "/events/group": ["group"], "/events/details": ["event"],
  "/events/publish": ["group", "title", "description", "start", "end", "location"],
  "/events/revise": ["event", "title", "description", "start", "end", "location"],
  "/events/remove": ["event"], "/events/attendees": ["event"],
  "/plans/mark": ["event", "intent"], "/plans/remove": ["event"], "/plans/list": [],
} as const;
