/** A sortable key for one row, not a transformation of a collected former. */
export function eventSortKey({ start, event }: { start: Date; event: string }): string {
  if (!(start instanceof Date) || !Number.isFinite(start.getTime())) throw new Error("Invalid event reference");
  // Shift the entire valid Date range to nonnegative integers before padding.
  return `${(BigInt(start.getTime()) + 8640000000000000n).toString().padStart(17, "0")}:${event}`;
}

/** Make the required reference a dependency of membership filtering. */
export function requireEventGroup({ group }: { group: string }): string {
  if (typeof group !== "string" || !group) throw new Error("Missing event reference");
  return group;
}

/** Decode a validated local/JSON date without consulting a clock or state. */
export function eventDate({ value }: { value: string | Date }): Date {
  return new Date(value);
}
