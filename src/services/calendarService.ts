import type { CalendarType, CalendarEvent } from "@/types";

export async function fetchCalendarData(
  type: CalendarType,
  from: string,
  to: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from, to });
  const res = await fetch(`/api/calendar/${type}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type} calendar`);
  return res.json();
}
