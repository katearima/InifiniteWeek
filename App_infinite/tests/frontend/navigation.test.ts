import { afterEach, expect, test } from "bun:test";
import { createRenderer } from "vue/dist/vue.esm-browser.prod.js";
import { createAppOptions } from "../../web/app.ts";
import type { api, EventRow, NotificationRow } from "../../web/api.ts";
import { localDateTime, hourHeight } from "../../web/calendar.ts";

// Exercise the real app state and Vue render scheduling without a DOM dependency.
// The renderer exposes a bubble only after the authenticated page has rendered.
const originalGlobals = new Map(["window", "document", "location", "history"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.(); unmount = undefined;
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
async function harness(hash: string, signedIn = false, plans: EventRow[] = []) {
  const calls: string[] = [], replaced: string[] = [], focused: string[] = [], scrolled: string[] = [];
  const location = { hash };
  let failAuthentication = false, rendered = new Set<string>();
  let model!: ReturnType<ReturnType<typeof createAppOptions>["setup"]>;
  const comments = ["root", "reply"].map(comment => ({ comment, parent: comment === "root" ? "" : "root", text: comment }));
  const globals = {
    location,
    window: { addEventListener() {}, removeEventListener() {} },
    history: {
      replaceState(_state: unknown, _title: string, next: string) { replaced.push(next); location.hash = next; },
      pushState(_state: unknown, _title: string, next: string) { location.hash = next; },
    },
    document: { getElementById(id: string) {
      return rendered.has(id) ? { focus() { focused.push(id); }, scrollIntoView() { scrolled.push(id); } } : null;
    } },
  };
  const request = async (path: string) => {
      calls.push(path);
      let value: unknown;
      if (path === "/auth/login" || path === "/auth/register") {
        if (failAuthentication) value = { error: "UNAUTHORIZED" };
        else { signedIn = true; value = { user: "member" }; }
      } else if (path === "/auth/me") value = signedIn ? { user: "member", username: "Maya" } : { error: "UNAUTHORIZED" };
      else if (path === "/groups/list") value = { groups: [] };
      else if (path === "/plans/list") value = { events: plans };
      else if (path === "/events/explore") value = { events: [] };
      else if (path === "/notifications/list") value = { notifications: [], unreadCount: 0 };
      else if (path === "/notifications/read") value = {};
      else if (path === "/events/details") value = { event: { event: "event", organizer: "owner" } };
      else if (path === "/comments/list") value = { comments };
      else if (path === "/events/picture") value = { picture: "" };
      else throw new Error(`Unexpected request ${path}`);
      return value;
  };
  const fakeApi: Record<string, Record<string, () => Promise<unknown>>> = {};
  for (const path of ["/auth/login", "/auth/register", "/auth/me", "/groups/list", "/plans/list", "/events/explore",
    "/notifications/list", "/notifications/read", "/events/details", "/comments/list", "/events/picture"]) {
    const [, namespace, action] = path.split("/");
    (fakeApi[namespace!] ??= {})[action!] = () => request(path);
  }
  const appOptions = createAppOptions(fakeApi as unknown as typeof api);
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const renderer = createRenderer<object, object>({
    createElement: () => ({}), createComment: () => ({}), createText: () => ({}),
    insert() {}, remove() {}, patchProp() {}, setText() {}, setElementText() {},
    parentNode: () => null, nextSibling: () => null,
  });
  const app = renderer.createApp({
    setup() { model = appOptions.setup(); return {}; },
    render() {
      rendered = new Set(model.checked.value && model.event.value
        ? model.comments.value.map(row => `comment-${row.comment}`) : []);
      return null;
    },
  });
  app.mount({}); unmount = () => app.unmount();
  const deadline = Date.now() + 1000;
  while (!model.checked.value && Date.now() < deadline) await Bun.sleep(1);
  expect(model.checked.value).toBe(true);
  return { model, location, calls, replaced, focused, scrolled, rejectAuthentication() { failAuthentication = true; } };
}

for (const mode of ["login", "register"] as const) {
  test(`${mode} replaces a stale route with Explore and clears route-specific state`, async () => {
    const { model, location, calls, replaced } = await harness("#event/event?comment=reply");
    model.authMode.value = mode; model.username.value = "Maya"; model.password.value = "password-2026";
    model.search.value = "stale"; model.replyText.value = "unfinished";
    await model.authenticate();
    expect(location.hash).toBe("#explore");
    expect(replaced).toEqual(["#explore"]);
    expect(calls).toContain(`/auth/${mode}`);
    expect(calls).toContain("/events/explore");
    expect(model.tab.value).toBe("explore");
    expect(model.search.value).toBe("");
    expect(model.replyText.value).toBe("");
    expect(model.highlightedComment.value).toBe("");
    expect(model.event.value).toBeNull();
  });
}
test("failed authentication preserves the form and route", async () => {
  const { model, location, replaced, rejectAuthentication } = await harness("#notifications");
  rejectAuthentication();
  await model.authenticate();
  expect(location.hash).toBe("#notifications");
  expect(replaced).toEqual([]);
  expect(model.me.value).toBeNull();
  expect(model.error.value).toBe("That username and password don’t match.");
});
test("authenticated reload focuses after rendering; same-event notifications move to the exact reply", async () => {
  const { model, location, replaced, focused, scrolled, calls } = await harness("#event/event?comment=root", true);
  expect(location.hash).toBe("#event/event?comment=root");
  expect(replaced).toEqual([]);
  expect(focused).toEqual(["comment-root"]);
  expect(model.notice.value).toBe("");
  await model.openNotification({ notification: "alert", event: "event", comment: "reply" } as NotificationRow);
  expect(location.hash).toBe("#event/event?comment=reply");
  expect(focused).toEqual(["comment-root", "comment-reply"]);
  expect(scrolled).toEqual(focused);
  expect(model.highlightedComment.value).toBe("reply");
  expect(calls.lastIndexOf("/notifications/read")).toBeLessThan(calls.lastIndexOf("/comments/list"));
  await model.go("event", "event", "deleted");
  expect(model.notice.value).toBe("This comment is no longer available.");
  expect(focused).toEqual(["comment-root", "comment-reply"]);
});
test("calendar controls preserve date/view across navigation, filter plans, and scroll only on view entry", async () => {
  const plans = [{ event: "event", title: "Study", description: "", location: "", group: "group", intent: "GOING",
    start: new Date(2026, 0, 31, 9).toISOString(), end: new Date(2026, 0, 31, 10).toISOString() }] as EventRow[];
  const { model, location } = await harness("#calendar", true, plans);
  expect(model.calendarView.value).toBe("month");
  expect(localDateTime(model.calendarDate.value).slice(0, 10)).toBe(localDateTime(new Date()).slice(0, 10));
  model.firstPlan();
  expect(localDateTime(model.calendarDate.value)).toBe("2026-01-31T00:00");
  model.shiftCalendar(1);
  expect(localDateTime(model.calendarDate.value)).toBe("2026-02-28T00:00");
  const scroller = { scrollTop: 0 } as HTMLElement;
  model.calendarScroller.value = scroller;
  await model.setCalendarView("week");
  expect(scroller.scrollTop).toBe(8 * hourHeight);
  expect(localDateTime(model.calendarDate.value)).toBe("2026-02-28T00:00");
  model.shiftCalendar(-1);
  expect(localDateTime(model.calendarDate.value)).toBe("2026-02-21T00:00");
  model.firstPlan();
  expect(model.calendarView.value).toBe("week");
  expect(model.timeline.value.flatMap(day => day.segments)).toHaveLength(1);
  model.search.value = "no match";
  expect(model.calendarHasEvents.value).toBe(false);
  model.search.value = "study";
  expect(model.calendarHasEvents.value).toBe(true);
  scroller.scrollTop = 123;
  await model.refresh();
  expect(scroller.scrollTop).toBe(123);
  await model.openCalendarDay(new Date(2026, 0, 31));
  expect(model.calendarView.value).toBe("day");
  expect(model.timeline.value).toHaveLength(1);
  await model.go("event", "event");
  expect(location.hash).toBe("#event/event");
  await model.go("calendar");
  expect(model.calendarView.value).toBe("day");
  expect(localDateTime(model.calendarDate.value)).toBe("2026-01-31T00:00");
  model.shiftCalendar(1);
  expect(localDateTime(model.calendarDate.value)).toBe("2026-02-01T00:00");
  model.calendarToday();
  expect(localDateTime(model.calendarDate.value).slice(0, 10)).toBe(localDateTime(new Date()).slice(0, 10));
});
