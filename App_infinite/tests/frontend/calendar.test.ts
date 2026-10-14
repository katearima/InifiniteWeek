import { expect, test } from "bun:test";
import { monthDays, localDateTime } from "../../web/calendar.ts";
import type { EventRow } from "../../web/api.ts";
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
