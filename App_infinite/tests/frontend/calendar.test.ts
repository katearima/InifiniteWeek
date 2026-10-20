import { expect, test } from "bun:test";
import { monthDays, localDateTime, shiftDate, weekStart, timelineDays, timelineTracks, timelineWidth, daySegments, segmentStyle, segmentLabel, hourHeight } from "../../web/calendar.ts";
import type { EventRow } from "../../web/api.ts";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
const event = (start: Date, end: Date) => ({ start: start.toISOString(), end: end.toISOString(), canceled: true } as EventRow);
test("calendar starts on Monday, spans six weeks, and retains past canceled plans", () => {
  const rows = monthDays(new Date(2020, 1, 1), [event(new Date(2020, 1, 10, 12), new Date(2020, 1, 10, 13))]);
  expect(rows).toHaveLength(42); expect(rows[0]!.date.getDay()).toBe(1);
  expect(rows.find(r => r.key === "2020-02-10")!.events).toHaveLength(1);
});
test("multi-day events appear on overlapping days but not their midnight end day", () => {
  const rows = monthDays(new Date(2026, 9, 1), [event(new Date(2026, 9, 12, 18), new Date(2026, 9, 14))]);
  expect(rows.filter(r => r.events.length).map(r => r.key)).toEqual(["2026-10-12", "2026-10-13"]);
});
test("editor dates retain local wall time", () => {
  expect(localDateTime(new Date(2026, 9, 13, 18, 5))).toBe("2026-10-13T18:05");
});

test("Calendar renders the latest time change, then only cancellation when canceled", async () => {
  const html = await Bun.file(new URL("../../web/index.html", import.meta.url)).text();
  const template = html.match(/<section v-if="tab === 'calendar'"[\s\S]*?<\/section>/)?.[0];
  expect(template).toBeDefined();
  const plan = {
    ...event(new Date(2026, 9, 13, 12), new Date(2026, 9, 13, 13)),
    event: "changed-event", title: "Study", intent: "GOING", canceled: false, timeChanged: true,
    previousStart: "previous-start", previousEnd: "previous-end",
  } as EventRow;
  const render = () => renderToString(createSSRApp({
    template,
    components: { "app-icon": { render: () => null } },
    setup: () => ({
      tab: "calendar", saved: [plan], calendarView: "month", calendarHeading: "October 2026", hourHeight, timeZone: "Local time", today: "", loading: false, calendarHasEvents: true,
      calendar: monthDays(new Date(2026, 9, 1), [plan]),
      date: (value: string) => value,
      time: (value: string) => value,
      schedule: (start: string, end: string) => `${start} – ${end}`,
    }),
  }));
  const changed = await render();
  expect(changed.match(/<button class="[^"]*\bcalendar-event\b/g)).toHaveLength(1);
  expect(changed.match(/Latest time change/g)).toHaveLength(1);
  expect(changed).toContain("previous-start");
  expect(changed).toContain(`Now ${plan.start}`);
  plan.canceled = true;
  const canceled = await render();
  expect(canceled).toContain("Event canceled");
  expect(canceled).not.toContain("Latest time change");
  expect(canceled).not.toContain("previous-start");
  expect(canceled).toContain(plan.start);
});

const plan = (id: string, start: Date, end: Date) => ({
  ...event(start, end), event: id, title: id, description: "", location: "", group: "group",
  intent: "GOING", canceled: false, timeChanged: false,
} as EventRow);
test("day/week navigation crosses years and clamps months while preserving the selected day", () => {
  expect(localDateTime(weekStart(new Date(2027, 0, 3)))).toBe("2026-12-28T00:00");
  expect(localDateTime(shiftDate(new Date(2026, 11, 31), "day", 1))).toBe("2027-01-01T00:00");
  expect(localDateTime(shiftDate(new Date(2026, 11, 31), "week", 1))).toBe("2027-01-07T00:00");
  expect(localDateTime(shiftDate(new Date(2026, 0, 31), "month", 1))).toBe("2026-02-28T00:00");
  expect(localDateTime(shiftDate(new Date(2024, 2, 31), "month", -1))).toBe("2024-02-29T00:00");
  expect(timelineDays(new Date(2027, 0, 3), "week", []).map(day => day.key))
    .toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
});
test("hourly segments clip overnight events and exclude the midnight end date", () => {
  const overnight = plan("overnight", new Date(2026, 9, 12, 23), new Date(2026, 9, 14));
  const days = timelineDays(new Date(2026, 9, 12), "week", [overnight]);
  expect(days.map(day => day.segments.length)).toEqual([1, 1, 0, 0, 0, 0, 0]);
  expect(days[0]!.segments[0]).toMatchObject({ top: 23 * hourHeight, height: hourHeight, continuesBefore: false, continuesAfter: true });
  expect(days[1]!.segments[0]).toMatchObject({ top: 0, height: 24 * hourHeight, continuesBefore: true, continuesAfter: false });
  expect(days[1]!.segments[0]!.start).toEqual(new Date(2026, 9, 13));
  expect(days[1]!.segments[0]!.end).toEqual(new Date(2026, 9, 14));
});
test("overlap groups use stable lanes; nested events reuse lanes and adjacent groups use full width", () => {
  const date = new Date(2026, 9, 12);
  const at = (hour: number, minute = 0) => new Date(2026, 9, 12, hour, minute);
  const events = [plan("long", at(9), at(12)), plan("a", at(9), at(10)), plan("b", at(9), at(10)),
    plan("nested", at(10), at(11)), plan("adjacent", at(12), at(13))];
  const rows = daySegments(date, events);
  expect(rows.map(row => [String(row.event.event), row.lane, row.lanes]))
    .toEqual([["long", 0, 3], ["a", 1, 3], ["b", 2, 3], ["nested", 1, 3], ["adjacent", 0, 1]]);
  expect(daySegments(date, [...events].reverse())).toEqual(rows);
  expect(segmentStyle(rows[4]!)).toMatchObject({ width: "calc(100% - 4px)", left: "calc(0% + 2px)" });
  const week = timelineDays(date, "week", events);
  expect(timelineWidth(week, "week")).toBe("calc(var(--timeline-gutter) + 1176px)");
  expect(timelineTracks(week, "week")).toContain("minmax(312px, 1fr) minmax(144px, 1fr)");
  expect(timelineWidth(timelineDays(date, "day", events), "day")).toBe("100%");
});
test("short and late-night blocks stay clickable without covering neighboring blocks", () => {
  const at = (hour: number, minute = 0) => new Date(2026, 9, 12, hour, minute);
  const rows = daySegments(at(0), [plan("quick", at(9), at(9, 1)), plan("next", at(9, 2), at(9, 3)),
    plan("late", at(23, 59), new Date(2026, 9, 13))]);
  expect(rows.map(row => row.height)).toEqual([44, 44, 44]);
  expect(rows[0]!.lane).not.toBe(rows[1]!.lane);
  expect(rows[2]!.top + rows[2]!.height).toBe(24 * hourHeight);
});
test("local day boundaries handle DST and repeated-hour events remain visible", async () => {
  const script = `
    import assert from "node:assert/strict";
    import { timelineDays, daySegments, shiftDate, localDateTime, segmentLabel } from ${JSON.stringify(new URL("../../web/calendar.ts", import.meta.url).href)};
    const spring = new Date(2026, 2, 8), fall = new Date(2026, 10, 1);
    assert.equal((+shiftDate(spring, "day", 1) - +spring) / 3600000, 23);
    assert.equal((+shiftDate(fall, "day", 1) - +fall) / 3600000, 25);
    assert.equal(localDateTime(shiftDate(spring, "week", 1)), "2026-03-15T00:00");
    assert.equal(new Set(timelineDays(spring, "week", []).map(d => d.key)).size, 7);
    const event = { event:"dst", title:"Repeated hour", intent:"GOING", start:"2026-11-01T01:45:00-04:00", end:"2026-11-01T01:15:00-05:00" };
    const rows = daySegments(fall, [event]);
    assert.equal(rows.length, 1); assert.ok(rows[0].height >= 44);
    assert.ok(segmentLabel(rows[0]).includes("EDT")); assert.ok(segmentLabel(rows[0]).includes("EST"));
  `;
  const process = Bun.spawn([Bun.which("bun") ?? Bun.argv[0]!, "--eval", script], { env: { ...Bun.env, TZ: "America/New_York" }, stdout: "pipe", stderr: "pipe" });
  const stderr = await new Response(process.stderr).text();
  expect(await process.exited, stderr).toBe(0);
});

test("Day and Week render accessible hourly blocks, current status, and period empty states", async () => {
  const html = await Bun.file(new URL("../../web/index.html", import.meta.url)).text();
  const template = html.match(/<section v-if="tab === 'calendar'"[\s\S]*?<\/section>/)![0];
  const selected = new Date(2026, 9, 12);
  const changed = { ...plan("Study <now>", new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10)), timeChanged: true,
    previousStart: new Date(2026, 9, 12, 8).toISOString(), previousEnd: new Date(2026, 9, 12, 9).toISOString() };
  for (const view of ["day", "week"] as const) {
    const state = {
      tab: "calendar", calendarView: view, calendarHeading: "October 12", saved: [changed], loading: false, search: "",
      calendarHasEvents: true, hourHeight, timeZone: "Local", today: "", calendarHours: [{hour: 9, label:"9 AM"}],
      timeline: timelineDays(selected, view, [changed]), calendarTracks: timelineTracks(timelineDays(selected, view, [changed]), view), calendarWidth: timelineWidth(timelineDays(selected, view, [changed]), view), segmentStyle, segmentLabel,
      date: (value: string) => value, time: (value: string) => value,
    };
    const render = () => renderToString(createSSRApp({template, setup: () => state, components: {"app-icon": {render: () => null}}}));
    let rendered = await render();
    expect(rendered).toContain('aria-label="Calendar view"');
    expect(rendered).toContain("timeline-event");
    expect(rendered).toContain("Study &lt;now&gt;");
    expect(rendered).toContain("Latest time change");
    expect(rendered).toContain(`aria-label="Previous ${view}"`);
    changed.canceled = true;
    rendered = await render();
    expect(rendered).toContain("Event canceled");
    expect(rendered).not.toContain("Latest time change");
    changed.canceled = false;
    state.timeline = timelineDays(selected, view, []); state.calendarHasEvents = false; state.search = "missing";
    expect(await render()).toContain(`No events match your search in this ${view}.`);
  }
});
