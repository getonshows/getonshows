/**
 * Availability grid primitives shared by server and client code.
 *
 * IMPORTANT: this module must stay free of "use client". It is imported by
 * server components (e.g. OneSheet) as well as the interactive grid.
 * (A previous bug: summarizeAvailability lived in the "use client"
 * AvailabilityGrid module, which made /profile/view throw at render time.)
 */

export const AVAIL_DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
] as const;

/** Hourly slot start hours: 8 AM through 7 PM (each slot is one hour). */
export const AVAIL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export type AvailabilityValue = Record<string, string[]>;

export function slotKey(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** "Mon–Fri · 9 AM–5 PM; Sat · 10 AM–12 PM", or null when empty. */
export function summarizeAvailability(
  value: AvailabilityValue | null | undefined
): string | null {
  if (!value) return null;
  const dayRanges: { key: string; short: string; text: string }[] = [];
  for (const d of AVAIL_DAYS) {
    const hours = (value[d.key] ?? [])
      .map((s) => parseInt(s.slice(0, 2), 10))
      .filter((h) => AVAIL_HOURS.includes(h))
      .sort((a, b) => a - b);
    if (hours.length === 0) continue;
    // Merge consecutive hours into ranges.
    const ranges: [number, number][] = [];
    let start = hours[0];
    let prev = hours[0];
    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === prev + 1) {
        prev = hours[i];
      } else {
        ranges.push([start, prev + 1]);
        start = hours[i];
        prev = hours[i];
      }
    }
    ranges.push([start, prev + 1]);
    const text = ranges
      .map(([s, e]) => {
        const sAp = s < 12 ? "AM" : "PM";
        const eAp = e <= 12 ? (e === 12 ? "PM" : "AM") : "PM";
        const sHr = s % 12 === 0 ? 12 : s % 12;
        const eHr = e % 12 === 0 ? 12 : e % 12;
        return sAp === eAp ? `${sHr}–${eHr} ${sAp}` : `${sHr} ${sAp}–${eHr} ${eAp}`;
      })
      .join(", ");
    dayRanges.push({ key: d.key, short: d.short, text });
  }
  if (dayRanges.length === 0) return null;
  // Group consecutive days sharing the same ranges.
  const groups: string[] = [];
  let gStart = 0;
  for (let i = 1; i <= dayRanges.length; i++) {
    const same =
      i < dayRanges.length &&
      dayRanges[i].text === dayRanges[gStart].text &&
      AVAIL_DAYS.findIndex((d) => d.key === dayRanges[i].key) ===
        AVAIL_DAYS.findIndex((d) => d.key === dayRanges[i - 1].key) + 1;
    if (!same) {
      const label =
        gStart === i - 1
          ? dayRanges[gStart].short
          : `${dayRanges[gStart].short}–${dayRanges[i - 1].short}`;
      groups.push(`${label} · ${dayRanges[gStart].text}`);
      gStart = i;
    }
  }
  return groups.join("; ");
}
