import type { EventRow } from "./api.ts";
export function localDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
export function monthDays(month: Date, events: EventRow[]) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  first.setDate(first.getDate() - (first.getDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first); date.setDate(date.getDate() + index);
    const next = new Date(date); next.setDate(next.getDate() + 1);
    return { key: localDateTime(date).slice(0, 10), date, current: date.getMonth() === month.getMonth(),
      events: events.filter(event => new Date(event.start) < next && new Date(event.end) > date) };
  });
}
