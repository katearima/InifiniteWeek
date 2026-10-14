import { createApp, ref, computed, reactive, onMounted, onUnmounted, nextTick } from "vue/dist/vue.esm-browser.prod.js";
import { api, read, ApiError, type Account, type Group, type EventRow, type Person, type Intent } from "./api.ts";
import { monthDays, localDateTime } from "./calendar.ts";
import { Icon } from "./icons.ts";

const root = document.querySelector<HTMLElement>("#app")!;
const template = root.innerHTML;
const app = createApp({
  components: { "app-icon": Icon },
  setup() {
    const me = ref<Account | null>(null), checked = ref(false), loading = ref(false), busy = ref(false);
    const error = ref(""), notice = ref(""), search = ref(""), tab = ref("explore"), routeId = ref("");
    const authMode = ref<"login" | "register">("login"), username = ref(""), password = ref("");
    const groups = ref<Group[]>([]), events = ref<EventRow[]>([]), saved = ref<EventRow[]>([]);
    const group = ref<Group | null>(null), event = ref<EventRow | null>(null), members = ref<Person[]>([]), requests = ref<Person[]>([]);
    const attendees = ref<{ going: Person[]; interested: Person[] }>({ going: [], interested: [] });
    const modal = ref<"group" | "event" | "leave" | "cancel" | "delete" | null>(null), editing = ref(false), dialog = ref<HTMLDialogElement | null>(null);
    const groupForm = reactive({ name: "", description: "", policy: "OPEN" as "OPEN" | "APPROVAL" });
    const eventForm = reactive({ group: "", title: "", description: "", location: "", start: "", end: "" });
    const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    let version = 0;
    const myGroups = computed(() => groups.value.filter(g => g.member));
    const matches = (text: string) => text.toLowerCase().includes(search.value.trim().toLowerCase());
    const visibleGroups = computed(() => groups.value.filter(g => matches(`${g.name} ${g.description}`)));
    const visibleEvents = computed(() => (tab.value === "plans" || tab.value === "calendar" ? saved.value : events.value).filter(e => matches(`${e.title} ${e.description} ${groupName(e.group)} ${e.location}`)));
    const calendar = computed(() => monthDays(calendarMonth.value, visibleEvents.value));
    const monthTitle = computed(() => calendarMonth.value.toLocaleDateString(undefined, { month: "long", year: "numeric" }));
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ");
    const today = localDateTime(new Date()).slice(0, 10);
    const title = computed(() => ({ explore: "Explore events", groups: "Find your people", plans: "My events", calendar: "Your calendar", group: group.value?.name ?? "Group", event: "Event details" })[tab.value] ?? "Explore events");
    const subtitle = computed(() => ({ explore: "Good plans start with your communities.", groups: "Join a community. See what’s happening together.", plans: "The plans you’re going to, and the ones you’re considering.", calendar: "A little space for everything you’re looking forward to.", group: group.value?.description ?? "", event: "All the details, in one place." })[tab.value] ?? "");
    function groupName(id: string) { return groups.value.find(g => g.group === id)?.name ?? "Your group"; }
    const date = (value: string) => new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const time = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const schedule = (start: string, end: string) => `${date(start)} · ${time(start)} – ${date(start) === date(end) ? '' : date(end) + ' · '}${time(end)}`;
    const month = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short" });
    const day = (value: string) => new Date(value).getDate();
    const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();
    function reset() { version++; me.value = null; groups.value = []; events.value = []; saved.value = []; group.value = null; event.value = null; members.value = []; requests.value = []; attendees.value = { going: [], interested: [] }; closeModal(); }
    function fail(cause: unknown) {
      if (cause instanceof ApiError && cause.code === "UNAUTHORIZED" && me.value) reset();
      error.value = cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
    }
    async function refresh() {
      const ticket = ++version; loading.value = true; error.value = "";
      try {
        const account = await api.auth.me({});
        if (ticket !== version) return;
        if ("error" in account) {
          if (account.error === "UNAUTHORIZED") { reset(); return; }
          await read(Promise.resolve(account), "check your session"); return;
        }
        me.value = account;
        const [allGroups, plans] = await Promise.all([read(api.groups.list({})), read(api.plans.list({}))]);
        if (ticket !== version) return;
        groups.value = allGroups.groups; saved.value = plans.events;
        if (tab.value === "explore") {
          const result = await read(api.events.explore({})); if (ticket === version) events.value = result.events;
        } else if (tab.value === "group") {
          const selected = allGroups.groups.find(g => g.group === routeId.value);
          if (!selected) throw new ApiError("NOT_FOUND", "This group is unavailable.");
          group.value = selected;
          if (selected.member) {
            const [rows, roster, pending] = await Promise.all([read(api.events.group({ group: selected.group })), read(api.groups.members({ group: selected.group })), read(api.groups.requests({ group: selected.group }))]);
            if (ticket !== version) return;
            events.value = rows.events; members.value = roster.members; requests.value = pending.requests;
          } else { events.value = []; members.value = []; requests.value = []; }
        } else if (tab.value === "event") {
          // Route identities are untrusted input; authorization is enforced by the API.
          const result = await read(api.events.details({ event: routeId.value as EventRow["event"] }));
          if (ticket !== version) return;
          event.value = result.event;
          if (result.event.organizer === account.user) {
            const people = await read(api.events.attendees({ event: result.event.event }));
            if (ticket === version) attendees.value = people;
          } else attendees.value = { going: [], interested: [] };
        }
      } catch (cause) { if (ticket === version) { group.value = null; event.value = null; events.value = []; fail(cause); } }
      finally { if (ticket === version || !me.value) { loading.value = false; checked.value = true; } }
    }
    async function route() {
      const [next, id = ""] = location.hash.slice(1).split("/");
      tab.value = ["explore", "groups", "plans", "calendar", "group", "event"].includes(next ?? "") ? next! : "explore";
      routeId.value = id; search.value = ""; events.value = []; group.value = null; event.value = null; members.value = []; requests.value = []; attendees.value = { going: [], interested: [] }; closeModal();
      await refresh();
    }
    function go(page: string, id = "") {
      const hash = `#${page}${id ? `/${id}` : ""}`;
      if (location.hash === hash) void route(); else location.hash = hash;
    }
    async function authenticate() {
      busy.value = true; error.value = "";
      try {
        if (authMode.value === "login") await read(api.auth.login({ username: username.value, password: password.value }), "sign in");
        else await read(api.auth.register({ username: username.value, password: password.value }), "create your account");
        password.value = ""; await refresh();
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === "UNAUTHORIZED") error.value = "That username and password don’t match.";
        else if (cause instanceof ApiError && cause.code === "CONFLICT") error.value = "That username is already taken. Choose another, or sign in.";
        else fail(cause);
      } finally { busy.value = false; }
    }
    async function signOut() {
      busy.value = true;
      try { const result = await api.auth.logout({}); if ("error" in result && result.error !== "UNAUTHORIZED") await read(Promise.resolve(result), "sign out"); reset(); notice.value = ""; password.value = ""; }
      catch (cause) { fail(cause); } finally { busy.value = false; }
    }
    async function act(work: () => Promise<unknown>, message: string, conflict?: string) {
      if (busy.value) return;
      busy.value = true; error.value = ""; notice.value = "";
      try { await work(); closeModal(); notice.value = message; await refresh(); }
      catch (cause) { if (cause instanceof ApiError && cause.code === "CONFLICT" && conflict) error.value = conflict; else fail(cause); }
      finally { busy.value = false; }
    }
    function closeModal() { dialog.value?.close(); modal.value = null; }
    async function openModal(kind: NonNullable<typeof modal.value>) {
      error.value = ""; modal.value = kind; await nextTick(); dialog.value?.showModal();
    }
    function newGroup() { Object.assign(groupForm, { name: "", description: "", policy: "OPEN" }); void openModal("group"); }
    async function createGroup() {
      await act(async () => { const result = await read(api.groups.create({ ...groupForm }), "create the group"); go("group", result.group); }, "Your group is ready. Invite someone to join.");
    }
    function newEvent(existing?: EventRow) {
      editing.value = !!existing;
      const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(18, 0, 0, 0);
      Object.assign(eventForm, existing ? { ...existing, start: localDateTime(new Date(existing.start)), end: localDateTime(new Date(existing.end)) } : { group: group.value?.member ? group.value.group : myGroups.value[0]?.group ?? "", title: "", description: "", location: "", start: localDateTime(start), end: localDateTime(new Date(start.getTime() + 3600000)) });
      void openModal("event");
    }
    async function saveEvent() {
      const start = new Date(eventForm.start), end = new Date(eventForm.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) { error.value = "Choose valid dates with the end after the start."; return; }
      const selected = myGroups.value.find(g => g.group === eventForm.group);
      if (!selected) { error.value = "Join a group before publishing an event."; return; }
      const fields = { title: eventForm.title.trim(), description: eventForm.description.trim(), location: eventForm.location.trim(), start: start.toISOString(), end: end.toISOString() };
      await act(async () => {
        if (editing.value && event.value) await read(api.events.revise({ event: event.value.event, ...fields }), "update the event");
        else { const result = await read(api.events.publish({ group: selected.group, ...fields }), "publish the event"); go("event", result.event); }
      }, editing.value ? "Event updated." : "Your event is published.");
    }
    const join = (g: Group) => act(() => read(api.groups.join({ group: g.group }), "join the group"), g.policy === "OPEN" ? "You’ve joined the group." : "Your request has been sent.", "You’ve already joined or requested to join. Refresh to see your status.");
    const decide = (person: Person, approve: boolean) => group.value && act(() => read(approve ? api.groups.approve({ group: group.value!.group, requester: person.user }) : api.groups.reject({ group: group.value!.group, requester: person.user })), approve ? "Request approved." : "Request declined.");
    const changePolicy = () => group.value && act(() => read(api.groups.policy({ group: group.value!.group, policy: group.value!.policy === "OPEN" ? "APPROVAL" : "OPEN" })), "Joining policy updated.");
    const leave = () => group.value && act(() => read(api.groups.leave({ group: group.value!.group }), "leave the group"), "You left the group. Its events were removed from your plans.", "Cancel every uncanceled event you organize in this group before leaving. Event dates do not change this requirement.");
    const deleteGroup = () => group.value && act(async () => {
      await read(api.groups.delete({ group: group.value!.group }), "delete the group");
      go("groups");
    }, "Group deleted. Its events are no longer accessible.", "Only the last member can delete this group. Cancel every uncanceled event you organize here first, then refresh and try again.");
    const mark = (intent: Intent) => event.value && act(() => read(api.plans.mark({ event: event.value!.event, intent }), "save your response"), intent === "NOT_GOING" ? "Response saved. This event is no longer in My Events." : "Your plans are updated.", "This event has been canceled. You can still remove your response.");
    const removeMark = () => event.value && act(() => read(api.plans.remove({ event: event.value!.event }), "remove your response"), "Your response was removed.");
    const cancelEvent = () => event.value && act(() => read(api.events.remove({ event: event.value!.event }), "cancel the event"), "Event canceled. Existing saved plans retain the cancellation notice.", "This event has already been canceled. Refresh to see its status.");
    function shiftMonth(offset: number) { calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + offset, 1); }
    function firstPlan() { if (saved.value[0]) { const d = new Date(saved.value[0].start); calendarMonth.value = new Date(d.getFullYear(), d.getMonth(), 1); } }
    function focus() { if (me.value && !busy.value && !modal.value) void refresh(); }
    onMounted(() => { void route(); window.addEventListener("hashchange", route); window.addEventListener("focus", focus); });
    onUnmounted(() => { window.removeEventListener("hashchange", route); window.removeEventListener("focus", focus); });
    return { me, checked, loading, busy, error, notice, search, tab, authMode, username, password, groups, events, saved, group, event, members, requests, attendees, modal, editing, dialog, groupForm, eventForm, myGroups, visibleGroups, visibleEvents, calendar, monthTitle, timeZone, today, title, subtitle, groupName, date, time, schedule, month, day, initials, refresh, go, authenticate, signOut, closeModal, openModal, newGroup, createGroup, newEvent, saveEvent, join, decide, changePolicy, leave, deleteGroup, mark, removeMark, cancelEvent, shiftMonth, firstPlan };
  },
});
app.mount(root);
// Restore the authored DOM template before Bun re-evaluates this module.
if (import.meta.hot) {
  import.meta.hot.dispose(() => { app.unmount(); root.innerHTML = template; });
  import.meta.hot.accept(() => window.location.reload());
}

