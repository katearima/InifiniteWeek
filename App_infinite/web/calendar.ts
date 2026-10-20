import type { EventRow } from "./api.ts";
export type CalendarView = "day" | "week" | "month";
export const hourHeight = 96;
const dayHeight = 24 * hourHeight;
const minimumEventHeight = 44;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
export function shiftDate(date: Date, view: CalendarView, direction: number) {
  const next = startOfDay(date);
  if (view === "month") {
    next.setDate(1);
    next.setMonth(next.getMonth() + direction);
    next.setDate(Math.min(date.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  } else next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
  return next;
}
export function weekStart(date: Date) {
  const first = startOfDay(date);
  first.setDate(first.getDate() - (first.getDay() + 6) % 7);
  return first;
}
export function calendarTitle(date: Date, view: CalendarView) {
  if (view === "month") return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (view === "day") return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const first = weekStart(date), last = shiftDate(first, "day", 6);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).formatRange(first, last);
}
export function localDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
export function monthDays(month: Date, events: EventRow[]) {
  const first = weekStart(new Date(month.getFullYear(), month.getMonth(), 1));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first); date.setDate(date.getDate() + index);
    const next = new Date(date); next.setDate(next.getDate() + 1);
    return { key: localDateTime(date).slice(0, 10), date, current: date.getMonth() === month.getMonth(),
      events: events.filter(event => new Date(event.start) < next && new Date(event.end) > date) };
  });
}

export interface CalendarSegment {
  event: EventRow;
  start: Date;
  end: Date;
  continuesBefore: boolean;
  continuesAfter: boolean;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Clip to local day boundaries, then assign non-obscuring lanes to visible blocks. */
export function daySegments(date: Date, events: EventRow[]): CalendarSegment[] {
  const first = startOfDay(date), next = shiftDate(first, "day", 1);
  const minutes = (value: Date) => value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
  const segments: CalendarSegment[] = [];
  for (const event of events) {
    const originalStart = new Date(event.start), originalEnd = new Date(event.end);
    if (!(originalStart < next && originalEnd > first && originalEnd > originalStart)) continue;
    const start = new Date(Math.max(+first, +originalStart)), end = new Date(Math.min(+next, +originalEnd));
    const startMinute = minutes(start);
    let endMinute = +end === +next ? 1440 : minutes(end);
    // Fall-back can repeat the same hour. Keep those real intervals visible;
    // accessible labels include zone offsets so the repeated times are distinct.
    if (endMinute <= startMinute) endMinute = Math.min(1440, startMinute + (+end - +start) / 60_000);
    const top = Math.min(startMinute / 60 * hourHeight, dayHeight - minimumEventHeight);
    const height = Math.min(dayHeight - top, Math.max(minimumEventHeight, endMinute / 60 * hourHeight - top));
    segments.push({ event, start, end, top, height, lane: 0, lanes: 1,
      continuesBefore: originalStart < first, continuesAfter: originalEnd > next });
  }
  segments.sort((a, b) => a.top - b.top || b.height - a.height || a.event.event.localeCompare(b.event.event));
  let group: CalendarSegment[] = [], laneEnds: number[] = [], bottom = -1;
  const finish = () => { for (const segment of group) segment.lanes = laneEnds.length; };
  for (const segment of segments) {
    if (segment.top >= bottom) { finish(); group = []; laneEnds = []; bottom = -1; }
    let lane = laneEnds.findIndex(end => end <= segment.top);
    if (lane < 0) lane = laneEnds.length;
    segment.lane = lane;
    laneEnds[lane] = segment.top + segment.height;
    bottom = Math.max(bottom, laneEnds[lane]!);
    group.push(segment);
  }
  finish();
  return segments;
}

export function timelineDays(date: Date, view: "day" | "week", events: EventRow[]) {
  const first = view === "week" ? weekStart(date) : startOfDay(date);
  return Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => {
    const day = shiftDate(first, "day", index);
    return { date: day, key: localDateTime(day).slice(0, 10), segments: daySegments(day, events) };
  });
}

function laneWidth(day: ReturnType<typeof timelineDays>[number]) {
  return Math.max(144, ...day.segments.map(segment => segment.lanes * 104));
}
export function timelineTracks(days: ReturnType<typeof timelineDays>, view: CalendarView) {
  // Dense weeks widen only the crowded day, keeping each lane readable.
  return `var(--timeline-gutter) ${days.map(day => view === "day" ? "minmax(0, 1fr)"
    : `minmax(${laneWidth(day)}px, 1fr)`).join(" ")}`;
}
export function timelineWidth(days: ReturnType<typeof timelineDays>, view: CalendarView) {
  return view === "week" ? `calc(var(--timeline-gutter) + ${days.reduce((width, day) => width + laneWidth(day), 0)}px)` : "100%";
}
export function segmentStyle(segment: CalendarSegment) {
  return { top: `${segment.top}px`, height: `${segment.height}px`,
    left: `calc(${segment.lane / segment.lanes * 100}% + 2px)`,
    width: `calc(${100 / segment.lanes}% - 4px)` };
}
export function segmentLabel(segment: CalendarSegment) {
  const event = segment.event;
  const format = (value: string) => new Date(value).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  return [event.title, event.intent === "GOING" ? "Going" : "Interested",
    `${format(event.start)} – ${format(event.end)}`,
    event.canceled ? "Event canceled" : event.timeChanged ? `Latest time change. Previously ${format(event.previousStart)} – ${format(event.previousEnd)}` : "",
    segment.continuesBefore ? "Continues from previous day" : "",
    segment.continuesAfter ? "Continues into next day" : "",
    "Open event details"].filter(Boolean).join(". ");
}
