/**
 * Native booking helpers: timezone-safe slot generation from a profile's
 * painted availability grid, plus .ics calendar file generation.
 * Pure functions: safe to import in client components.
 */

export interface BookableSlot {
  /** UTC ISO instant the slot starts. */
  startUtc: string;
  /** Human label in the viewer's timezone, e.g. "Tue, Oct 7 · 2:00 PM EDT". */
  label: string;
}

function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) parts[p.type] = p.value;
  let hour = parseInt(parts.hour ?? "0", 10);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    parseInt(parts.year ?? "1970", 10),
    parseInt(parts.month ?? "1", 10) - 1,
    parseInt(parts.day ?? "1", 10),
    hour,
    parseInt(parts.minute ?? "0", 10),
    parseInt(parts.second ?? "0", 10)
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Interpret wall-clock components in `timeZone` as a UTC instant. */
function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: string | number,
  timeZone: string
): Date {
  let guess = new Date(
    Date.UTC(year, month - 1, day, hour, Number(minute))
  );
  const off = tzOffsetMinutes(timeZone, guess);
  guess = new Date(guess.getTime() - off * 60000);
  // One refinement pass for slots landing exactly on a DST transition.
  const off2 = tzOffsetMinutes(timeZone, guess);
  if (off2 !== off) {
    guess = new Date(guess.getTime() - (off2 - off) * 60000);
  }
  return guess;
}

export function formatInTz(isoUtc: string, timeZone: string): string {
  const d = new Date(isoUtc);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  const tzName =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${date} · ${time}${tzName ? ` ${tzName}` : ""}`;
}

/**
 * Expand the owner's painted availability grid into concrete bookable slots
 * over the next `daysOut` days, labelled in the viewer's timezone.
 * Availability shape: { mon: ["09:00", ...], ... }, hours in the owner's tz.
 * Slots are 1 hour; past slots (plus a 30-min buffer) are skipped.
 */
export function generateBookableSlots(
  availability: Record<string, string[]> | null | undefined,
  ownerTz: string | null | undefined,
  viewerTz: string,
  daysOut = 14,
  maxSlots = 60
): BookableSlot[] {
  if (!availability || !ownerTz) return [];
  const slots: BookableSlot[] = [];
  const now = Date.now();
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ownerTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekdayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ownerTz,
    weekday: "short",
  });

  for (let d = 0; d < daysOut && slots.length < maxSlots; d++) {
    const probe = new Date(now + d * 86400000);
    let ymd: string;
    try {
      ymd = dateFmt.format(probe);
    } catch {
      return slots;
    }
    const [y, m, dd] = ymd.split("-").map(Number);
    if (!y || !m || !dd) continue;
    let weekday: string;
    try {
      weekday = weekdayFmt.format(probe).toLowerCase().slice(0, 3);
    } catch {
      continue;
    }
    const daySlots = availability[weekday] ?? [];
    for (const t of daySlots) {
      const [hh, mm] = String(t).split(":").map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      let startUtc: Date;
      try {
        startUtc = wallTimeToUtc(y, m, dd, hh, mm, ownerTz);
      } catch {
        continue;
      }
      if (startUtc.getTime() <= now + 30 * 60000) continue;
      slots.push({
        startUtc: startUtc.toISOString(),
        label: formatInTz(startUtc.toISOString(), viewerTz),
      });
    }
  }
  return slots
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
    .slice(0, maxSlots);
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

const icsDt = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

/** Build a downloadable .ics calendar event for a confirmed booking. */
export function bookingToIcs(input: {
  title: string;
  description: string;
  startUtc: string;
  durationMinutes?: number;
}): string {
  const duration = input.durationMinutes ?? 60;
  const start = new Date(input.startUtc);
  const end = new Date(start.getTime() + duration * 60000);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@getonshows.com`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GetOnShows//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDt(new Date())}`,
    `DTSTART:${icsDt(start)}`,
    `DTEND:${icsDt(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
