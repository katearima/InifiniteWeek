import { createApp, ref, computed, reactive, onMounted, onUnmounted, nextTick } from "vue/dist/vue.esm-browser.prod.js";
import { api as defaultApi, read, ApiError, type Account, type Group, type EventRow, type Person, type Intent, type CommentRow, type NotificationRow } from "./api.ts";
import { monthDays, localDateTime, startOfDay, shiftDate, calendarTitle, timelineDays, timelineTracks, timelineWidth, segmentStyle, segmentLabel, hourHeight, type CalendarView } from "./calendar.ts";
import { Icon } from "./icons.ts";
import { preparePicture } from "./pictures.ts";
import { discussionRows, replyCount } from "./discussion.ts";
import { parseRoute, routeHash } from "./navigation.ts";

export function createAppOptions(api = defaultApi) {
  return {
  components: { "app-icon": Icon },
  setup() {
    const me = ref<Account | null>(null), checked = ref(false), loading = ref(false), busy = ref(false);
    const error = ref(""), notice = ref(""), search = ref(""), tab = ref("explore"), routeId = ref("");
    const authMode = ref<"login" | "register">("login"), username = ref(""), password = ref("");
    const groups = ref<Group[]>([]), events = ref<EventRow[]>([]), saved = ref<EventRow[]>([]);
    const group = ref<Group | null>(null), event = ref<EventRow | null>(null), members = ref<Person[]>([]), requests = ref<Person[]>([]);
    const attendees = ref<{ going: Person[]; interested: Person[] }>({ going: [], interested: [] });
    const comments = ref<CommentRow[]>([]), notifications = ref<NotificationRow[]>([]), unreadCount = ref(0);
    const commentText = ref(""), editingComment = ref(""), commentEditText = ref(""), pendingComment = ref<CommentRow | null>(null);
    const replyingTo = ref(""), replyText = ref(""), highlightedComment = ref("");
    const threadedComments = computed(() => discussionRows(comments.value));
    const pendingReplyCount = computed(() => replyCount(comments.value, pendingComment.value));
    let pendingCommentFocus = false, focusMissed = false, editTarget = "";
    const modal = ref<"group" | "event" | "picture" | "leave" | "cancel" | "delete" | "comment-delete" | null>(null), editing = ref(false), dialog = ref<HTMLDialogElement | null>(null);
    const eventPictures = ref<Record<string, string>>({}), groupPictures = ref<Record<string, string>>({});
    const pictureDraft = ref(""), pictureBusy = ref(false), pictureError = ref(""), pictureLoadError = ref("");
    const pictureInput = ref<HTMLInputElement | null>(null);
    let pictureVersion = 0;
    const groupForm = reactive({ name: "", description: "", policy: "OPEN" as "OPEN" | "APPROVAL" });
    const eventForm = reactive({ group: "", title: "", description: "", location: "", start: "", end: "" });
    const calendarDate = ref(startOfDay(new Date())), calendarView = ref<CalendarView>("month");
    const calendarScroller = ref<HTMLElement | null>(null);
    const calendarHours = Array.from({ length: 24 }, (_, hour) => ({ hour, label: new Date(2026, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" }) }));
    let version = 0;
    const myGroups = computed(() => groups.value.filter(g => g.member));
    const matches = (text: string) => text.toLowerCase().includes(search.value.trim().toLowerCase());
    const visibleGroups = computed(() => groups.value.filter(g => matches(`${g.name} ${g.description}`)));
    const groupSections = computed(() => [
      { id: "your-groups", title: "Your groups", description: "The communities you’ve joined.",
        groups: visibleGroups.value.filter(g => g.member), empty: "You haven’t joined any groups yet. Explore a community below or create your own." },
      { id: "explore-groups", title: "Explore groups", description: "Find a new community to make plans with.",
        groups: visibleGroups.value.filter(g => !g.member), empty: "There are no other groups to explore right now." },
    ]);
    const visibleEvents = computed(() => (tab.value === "plans" || tab.value === "calendar" ? saved.value : events.value).filter(e => matches(`${e.title} ${e.description} ${groupName(e.group)} ${e.location}`)));
    const calendar = computed(() => monthDays(calendarDate.value, visibleEvents.value));
    const calendarHeading = computed(() => calendarTitle(calendarDate.value, calendarView.value));
    const timeline = computed(() => timelineDays(calendarDate.value, calendarView.value === "week" ? "week" : "day", visibleEvents.value));
    const calendarTracks = computed(() => timelineTracks(timeline.value, calendarView.value));
    const calendarWidth = computed(() => timelineWidth(timeline.value, calendarView.value));
    const calendarHasEvents = computed(() => calendarView.value === "month" ? calendar.value.some(cell => cell.events.length) : timeline.value.some(cell => cell.segments.length));
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ");
    const today = ref(localDateTime(new Date()).slice(0, 10));
    const title = computed(() => ({ explore: "Explore events", groups: "Find your people", plans: "My events", calendar: "Your calendar", notifications: "Your notifications", group: group.value?.name ?? "Group", event: "Event details" })[tab.value] ?? "Explore events");
    const subtitle = computed(() => ({ explore: "Good plans start with your communities.", groups: "Join a community. See what’s happening together.", plans: "The plans you’re going to, and the ones you’re considering.", calendar: "A little space for everything you’re looking forward to.", notifications: "Event changes, new comments, and replies to you.", group: group.value?.description ?? "", event: "All the details, in one place." })[tab.value] ?? "");
    function groupName(id: string) { return groups.value.find(g => g.group === id)?.name ?? "Your group"; }
    const date = (value: string) => new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const time = (value: string) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const schedule = (start: string, end: string) => `${date(start)} · ${time(start)} – ${date(start) === date(end) ? '' : date(end) + ' · '}${time(end)}`;
    const month = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short" });
    const day = (value: string) => new Date(value).getDate();
    const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();
    function clearDiscussion() { comments.value = []; commentText.value = ""; editingComment.value = ""; commentEditText.value = ""; replyingTo.value = ""; replyText.value = ""; highlightedComment.value = ""; pendingCommentFocus = false; }
    function reset() { version++; me.value = null; groups.value = []; events.value = []; saved.value = []; group.value = null; event.value = null; members.value = []; requests.value = []; attendees.value = { going: [], interested: [] }; notifications.value = []; unreadCount.value = 0; eventPictures.value = {}; groupPictures.value = {}; pictureLoadError.value = ""; clearDiscussion(); closeModal(); calendarView.value = "month"; calendarDate.value = startOfDay(new Date()); }
    function fail(cause: unknown) {
      if (cause instanceof ApiError && cause.code === "UNAUTHORIZED" && me.value) reset();
      error.value = cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
    }
    async function refresh() {
      const ticket = ++version; loading.value = true; error.value = ""; focusMissed = false;
      pictureLoadError.value = ""; today.value = localDateTime(new Date()).slice(0, 10);
      try {
        const account = await api.auth.me({});
        if (ticket !== version) return;
        if ("error" in account) {
          if (account.error === "UNAUTHORIZED") { reset(); return; }
          await read(Promise.resolve(account), "check your session"); return;
        }
        if (me.value && me.value.user !== account.user) {
          // Another tab signed in as someone else; drop this account's drafts and views first.
          reset(); search.value = ""; notice.value = `You're now signed in as ${account.username}.`;
          return await refresh();
        }
        me.value = account;
        const [allGroups, plans, inbox] = await Promise.all([read(api.groups.list({})), read(api.plans.list({})), read(api.notifications.list({}))]);
        if (ticket !== version) return;
        groups.value = allGroups.groups; saved.value = plans.events; notifications.value = inbox.notifications; unreadCount.value = inbox.unreadCount;
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
          const discussion = await read(api.comments.list({ event: result.event.event }));
          if (ticket !== version) return;
          comments.value = discussion.comments;
          if (result.event.organizer === account.user) {
            const people = await read(api.events.attendees({ event: result.event.event }));
            if (ticket === version) attendees.value = people;
          } else attendees.value = { going: [], interested: [] };
        }
        if (ticket === version) await refreshPictures(ticket);
        if (ticket === version && tab.value === "event" && pendingCommentFocus) {
          // Initial reloads must render the authenticated page before locating its bubble.
          checked.value = true;
          await nextTick();
          if (ticket !== version) return;
          pendingCommentFocus = false;
          const bubble = document.getElementById(`comment-${highlightedComment.value}`);
          if (bubble) {
            bubble.focus({ preventScroll: true });
            bubble.scrollIntoView({ block: "center", behavior: "auto" });
          } else notice.value = "This comment is no longer available.";
        }
      } catch (cause) {
        if (ticket !== version) return;
        // Only a destination that is gone clears the page; transient failures keep what is shown.
        if (cause instanceof ApiError && (cause.code === "NOT_FOUND" || cause.code === "FORBIDDEN")) {
          group.value = null; event.value = null; events.value = []; comments.value = []; closeModal();
        }
        fail(cause);
      }
      finally { if (ticket === version || !me.value) { loading.value = false; checked.value = true; } }
    }
    async function route() {
      const destination = parseRoute(location.hash);
      tab.value = destination.page;
      routeId.value = destination.id; search.value = ""; notice.value = ""; events.value = []; group.value = null; event.value = null; members.value = []; requests.value = []; attendees.value = { going: [], interested: [] }; closeModal();
      clearDiscussion();
      highlightedComment.value = destination.comment;
      pendingCommentFocus = !!destination.comment;
      await refresh();
      if (tab.value === "calendar") await scrollCalendarMorning();
    }
    async function go(page: string, id = "", comment = "") {
      const hash = routeHash(page, id, comment);
      if (location.hash !== hash) history.pushState(null, "", hash);
      await route();
    }
    async function authenticate() {
      busy.value = true; error.value = "";
      try {
        if (authMode.value === "login") await read(api.auth.login({ username: username.value, password: password.value }), "sign in");
        else await read(api.auth.register({ username: username.value, password: password.value }), "create your account");
        password.value = "";
        history.replaceState(null, "", "#explore");
        await route();
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
    async function act(work: () => Promise<unknown>, message: string | (() => string), conflict?: string) {
      if (busy.value) return;
      busy.value = true; error.value = ""; notice.value = "";
      try { await work(); closeModal(); notice.value = typeof message === "function" ? message() : message; await refresh(); }
      catch (cause) { if (cause instanceof ApiError && cause.code === "CONFLICT" && conflict) error.value = conflict; else fail(cause); }
      finally { busy.value = false; }
    }
    function clearPictureDraft() {
      pictureVersion++; pictureDraft.value = ""; pictureBusy.value = false; pictureError.value = "";
      if (pictureInput.value) pictureInput.value.value = "";
    }
    function closeModal() {
      dialog.value?.close(); modal.value = null; pendingComment.value = null; clearPictureDraft();
      if (focusMissed && me.value && !busy.value) void refresh(); // Run the focus refresh this dialog postponed.
    }
    async function openModal(kind: NonNullable<typeof modal.value>) {
      clearPictureDraft(); error.value = ""; modal.value = kind; await nextTick(); dialog.value?.showModal();
    }
    function newGroup() { Object.assign(groupForm, { name: "", description: "", policy: "OPEN" }); void openModal("group"); }
    async function createGroup() {
      if (pictureBusy.value || pictureError.value) return;
      const picture = pictureDraft.value;
      let message = "Your group is ready. Invite someone to join.";
      await act(async () => {
        const result = await read(api.groups.create({ ...groupForm, name: groupForm.name.trim(), description: groupForm.description.trim() }), "create the group");
        if (picture && !await uploadCreatedPicture("group", result.group, picture)) message = "Your group was created. Its picture update could not be confirmed. Check its current picture before retrying.";
        go("group", result.group);
      }, () => message);
    }
    function newEvent(existing?: EventRow) {
      editing.value = !!existing; editTarget = existing?.event ?? "";
      const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(18, 0, 0, 0);
      Object.assign(eventForm, existing ? { ...existing, start: localDateTime(new Date(existing.start)), end: localDateTime(new Date(existing.end)) } : { group: group.value?.member ? group.value.group : myGroups.value[0]?.group ?? "", title: "", description: "", location: "", start: localDateTime(start), end: localDateTime(new Date(start.getTime() + 3600000)) });
      void openModal("event");
    }
    async function saveEvent() {
      if (pictureBusy.value || pictureError.value) return;
      const picture = pictureDraft.value;
      let message = editing.value ? "Event updated." : "Your event is published.";
      const start = new Date(eventForm.start), end = new Date(eventForm.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) { error.value = "Choose valid dates with the end after the start."; return; }
      const selected = myGroups.value.find(g => g.group === eventForm.group);
      if (!selected) { error.value = "Join a group before publishing an event."; return; }
      const fields = { title: eventForm.title.trim(), description: eventForm.description.trim(), location: eventForm.location.trim(), start: start.toISOString(), end: end.toISOString() };
      await act(async () => {
        if (editing.value) await read(api.events.revise({ event: editTarget as EventRow["event"], ...fields }), "update the event");
        else {
          const result = await read(api.events.publish({ group: selected.group, ...fields }), "publish the event");
          if (picture && !await uploadCreatedPicture("event", result.event, picture)) message = "Your event was published. Its cover update could not be confirmed. Check its current cover before retrying.";
          go("event", result.event);
        }
      }, () => message);
    }
    async function refreshPictures(ticket: number) {
      const groupIds = tab.value === "groups" ? groups.value.map(row => row.group) : group.value ? [group.value.group] : [];
      const eventIds = event.value ? [event.value.event] : ["explore", "group"].includes(tab.value) ? events.value.map(row => row.event) : tab.value === "plans" ? saved.value.map(row => row.event) : [];
      const jobs = [...groupIds.map(id => ({ kind: "group", id })), ...eventIds.map(id => ({ kind: "event", id }))];
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
        while (ticket === version) {
          const job = jobs[next++];
          if (!job) return;
          try {
            const result = job.kind === "group" ? await read(api.groups.picture({ group: job.id as Group["group"] })) : await read(api.events.picture({ event: job.id as EventRow["event"] }));
            if (ticket === version) (job.kind === "group" ? groupPictures.value : eventPictures.value)[job.id] = result.picture;
          } catch (cause) {
            if (ticket !== version) return;
            if (cause instanceof ApiError && cause.code === "UNAUTHORIZED") { fail(cause); return; }
            delete (job.kind === "group" ? groupPictures.value : eventPictures.value)[job.id];
            pictureLoadError.value = "Some pictures could not be loaded. Refresh this view to try again.";
          }
        }
      }));
    }
    async function selectPicture(input: Event) {
      const file = (input.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const ticket = ++pictureVersion;
      pictureBusy.value = true; pictureError.value = "";
      try { const prepared = await preparePicture(file); if (ticket === pictureVersion) pictureDraft.value = prepared; }
      catch (cause) { if (ticket === pictureVersion) pictureError.value = cause instanceof Error ? cause.message : "Could not prepare this picture."; }
      finally { if (ticket === pictureVersion) pictureBusy.value = false; }
    }
    async function editPicture() {
      const current = event.value ? eventPictures.value[event.value.event] : group.value ? groupPictures.value[group.value.group] : undefined;
      if (current === undefined) return;
      await openModal("picture"); pictureDraft.value = current;
    }
    async function uploadCreatedPicture(kind: "event" | "group", id: string, picture: string) {
      try {
        if (kind === "event") await read(api.events["set-picture"]({ event: id as EventRow["event"], picture }), "save the cover picture");
        else await read(api.groups["set-picture"]({ group: id as Group["group"], picture }), "save the group picture");
        return true;
      } catch { return false; }
    }
    async function savePicture() {
      if (busy.value || pictureBusy.value || pictureError.value) return;
      const selectedEvent = event.value, selectedGroup = group.value, picture = pictureDraft.value;
      if (!selectedEvent && !selectedGroup) return;
      busy.value = true; error.value = ""; notice.value = "";
      let confirmed = false;
      try {
        if (selectedEvent) await read(api.events["set-picture"]({ event: selectedEvent.event, picture }), "save the cover picture");
        else await read(api.groups["set-picture"]({ group: selectedGroup!.group, picture }), "save the group picture");
        confirmed = true;
      } catch (cause) { if (cause instanceof ApiError && cause.code === "UNAUTHORIZED") fail(cause); }
      finally {
        closeModal(); await refresh(); busy.value = false;
        if (confirmed) notice.value = picture ? "Picture updated." : "Picture removed.";
        else error.value = "Picture update could not be confirmed. Check the current picture before retrying. If it hasn't loaded, refresh this view first.";
      }
    }
    const unavailable = () => { closeModal(); error.value = "This item is no longer available. Refresh to check its current state."; };
    const join = (g: Group) => act(() => read(api.groups.join({ group: g.group }), "join the group"), g.policy === "OPEN" ? "You’ve joined the group." : "Your request has been sent.", "You’ve already joined or requested to join. Refresh to see your status.");
    const decide = (person: Person, approve: boolean) => !group.value ? unavailable() : act(() => read(approve ? api.groups.approve({ group: group.value!.group, requester: person.user }) : api.groups.reject({ group: group.value!.group, requester: person.user })), approve ? "Request approved." : "Request declined.");
    const changePolicy = () => !group.value ? unavailable() : act(() => read(api.groups.policy({ group: group.value!.group, policy: group.value!.policy === "OPEN" ? "APPROVAL" : "OPEN" })), "Joining policy updated.");
    const leave = () => !group.value ? unavailable() : act(() => read(api.groups.leave({ group: group.value!.group }), "leave the group"), "You left the group. Its events were removed from your plans.", "Cancel every uncanceled event you organize in this group before leaving. Event dates do not change this requirement.");
    const deleteGroup = () => !group.value ? unavailable() : act(async () => {
      await read(api.groups.delete({ group: group.value!.group }), "delete the group");
      go("groups");
    }, "Group deleted. Its events are no longer accessible.", "Only the last member can delete this group. Cancel every uncanceled event you organize here first, then refresh and try again.");
    const mark = (intent: Intent) => !event.value ? unavailable() : act(() => read(api.plans.mark({ event: event.value!.event, intent }), "save your response"), intent === "NOT_GOING" ? "Response saved. This event is no longer in My Events." : "Your plans are updated.", "This event has been canceled. You can still remove your response.");
    const removeMark = () => !event.value ? unavailable() : act(() => read(api.plans.remove({ event: event.value!.event }), "remove your response"), "Your response was removed.");
    const cancelEvent = () => !event.value ? unavailable() : act(() => read(api.events.remove({ event: event.value!.event }), "cancel the event"), "Event canceled. Existing saved plans retain the cancellation notice.", "This event has already been canceled. Refresh to see its status.");
    function editComment(row: CommentRow) { cancelReply(); editingComment.value = row.comment; commentEditText.value = row.text; }
    function cancelCommentEdit() { editingComment.value = ""; commentEditText.value = ""; }
    function startReply(row: CommentRow) { cancelCommentEdit(); replyingTo.value = row.comment; replyText.value = ""; }
    function cancelReply() { replyingTo.value = ""; replyText.value = ""; }
    async function postReply(row: CommentRow) {
      if (!replyText.value.trim()) return;
      const text = replyText.value;
      await act(async () => { await read(api.comments.reply({ comment: row.comment, text }), "post your reply"); cancelReply(); }, "Reply posted.");
    }
    async function postComment() {
      if (!event.value || !commentText.value.trim()) return;
      const selected = event.value.event, text = commentText.value;
      await act(async () => { await read(api.comments.post({ event: selected, text }), "post your comment"); commentText.value = ""; }, "Comment posted.");
    }
    async function saveComment(row: CommentRow) {
      if (!commentEditText.value.trim()) return;
      await act(async () => { await read(api.comments.edit({ comment: row.comment, text: commentEditText.value }), "edit your comment"); cancelCommentEdit(); }, "Comment updated.");
    }
    function confirmCommentRemoval(row: CommentRow) { pendingComment.value = row; void openModal("comment-delete"); }
    async function removeComment() {
      const selected = pendingComment.value;
      if (!selected) return;
      await act(async () => { await read(api.comments.remove({ comment: selected.comment }), "delete the comment"); cancelCommentEdit(); cancelReply(); }, selected.parent ? "Reply deleted." : "Comment and its replies deleted.");
    }
    const markNotificationRead = (row: NotificationRow) => act(() => read(api.notifications.read({ notification: row.notification }), "mark the notification read"), "");
    const markAllRead = () => act(() => read(api.notifications["read-all"]({}), "mark notifications read"), "All notifications marked read.");
    const dismissNotification = (row: NotificationRow) => act(() => read(api.notifications.dismiss({ notification: row.notification }), "dismiss the notification"), "Notification dismissed.");
    const openNotification = (row: NotificationRow) => act(async () => {
      try { await read(api.notifications.read({ notification: row.notification }), "open the notification"); }
      catch (cause) { if (cause instanceof ApiError && cause.code === "NOT_FOUND") await refresh(); throw cause; }
      await go("event", row.event, row.comment);
    }, () => notice.value);
    async function scrollCalendarMorning() {
      await nextTick();
      if (tab.value === "calendar" && calendarView.value !== "month" && calendarScroller.value) calendarScroller.value.scrollTop = 8 * hourHeight;
    }
    async function setCalendarView(view: CalendarView) {
      if (view === calendarView.value) return;
      calendarView.value = view; await scrollCalendarMorning();
    }
    async function openCalendarDay(date: Date) {
      calendarDate.value = startOfDay(date); calendarView.value = "day"; await scrollCalendarMorning();
    }
    function shiftCalendar(offset: number) { calendarDate.value = shiftDate(calendarDate.value, calendarView.value, offset); }
    function calendarToday() { calendarDate.value = startOfDay(new Date()); }
    function firstPlan() { if (saved.value[0]) calendarDate.value = startOfDay(new Date(saved.value[0].start)); }
    function focus() {
      if (!me.value) return;
      if (busy.value || modal.value) focusMissed = true;
      else void refresh();
    }
    onMounted(() => { void route(); window.addEventListener("hashchange", route); window.addEventListener("focus", focus); });
    onUnmounted(() => { window.removeEventListener("hashchange", route); window.removeEventListener("focus", focus); });
    return { me, checked, loading, busy, error, notice, search, tab, authMode, username, password, groups, events, saved, group, event, members, requests, attendees, modal, editing, dialog, groupForm, eventForm, myGroups, visibleGroups, groupSections, visibleEvents, calendar, calendarHeading, calendarDate, calendarView, calendarScroller, calendarHours, timeline, calendarTracks, calendarWidth, calendarHasEvents, hourHeight, segmentStyle, segmentLabel, setCalendarView, openCalendarDay, shiftCalendar, calendarToday, timeZone, today, title, subtitle, groupName, date, time, schedule, month, day, initials, refresh, go, authenticate, signOut, closeModal, openModal, newGroup, createGroup, newEvent, saveEvent, join, decide, changePolicy, leave, deleteGroup, mark, removeMark, cancelEvent, firstPlan, comments, notifications, unreadCount, commentText, editingComment, commentEditText, pendingComment, editComment, cancelCommentEdit, postComment, saveComment, confirmCommentRemoval, removeComment, markNotificationRead, markAllRead, dismissNotification, openNotification, threadedComments, pendingReplyCount, replyingTo, replyText, highlightedComment, startReply, cancelReply, postReply, eventPictures, groupPictures, pictureDraft, pictureBusy, pictureError, pictureLoadError, pictureInput, selectPicture, clearPictureDraft, editPicture, savePicture };
  },
  };
}
if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#app")!;
  const template = root.innerHTML;
  const app = createApp(createAppOptions());
  app.mount(root);
  // Restore the authored DOM template before Bun re-evaluates this module.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => { app.unmount(); root.innerHTML = template; });
    import.meta.hot.accept(() => window.location.reload());
  }
}

