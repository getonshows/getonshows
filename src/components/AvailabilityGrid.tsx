"use client";

import { Fragment, useRef } from "react";

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

function headerLabel(h: number): string {
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function spokenHour(h: number): string {
  const ap = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ap}`;
}

function isOn(value: AvailabilityValue, day: string, hour: number): boolean {
  return (value[day] ?? []).includes(slotKey(hour));
}

function withSlot(
  value: AvailabilityValue,
  day: string,
  hour: number,
  on: boolean
): AvailabilityValue {
  const sk = slotKey(hour);
  const cur = new Set(value[day] ?? []);
  if (on) cur.add(sk);
  else cur.delete(sk);
  const next = { ...value };
  if (cur.size === 0) delete next[day];
  else next[day] = Array.from(cur).sort();
  return next;
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

export default function AvailabilityGrid({
  value,
  onChange,
  id,
}: {
  value: AvailabilityValue;
  onChange: (v: AvailabilityValue) => void;
  id?: string;
}) {
  const painting = useRef<boolean | null>(null);

  function presetWeekdays() {
    const next: AvailabilityValue = {};
    for (const d of ["mon", "tue", "wed", "thu", "fri"]) {
      next[d] = [9, 10, 11, 12, 13, 14, 15, 16].map(slotKey);
    }
    onChange(next);
  }

  const total = Object.values(value).reduce((n, s) => n + s.length, 0);

  return (
    <div id={id}>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[620px] select-none gap-1"
          style={{ gridTemplateColumns: "3.5rem repeat(12, minmax(0, 1fr))" }}
          onPointerUp={() => (painting.current = null)}
          onPointerLeave={() => (painting.current = null)}
          role="group"
          aria-label="Weekly availability, 8 AM to 8 PM"
        >
          <span aria-hidden="true" />
          {AVAIL_HOURS.map((h) => (
            <span
              key={h}
              className="pb-1 text-center text-[11px] font-medium text-slate-500"
              aria-hidden="true"
            >
              {headerLabel(h)}
            </span>
          ))}
          {AVAIL_DAYS.map((d) => (
            <Fragment key={d.key}>
              <span
                key={`${d.key}-label`}
                className="flex items-center pr-1 text-xs font-semibold text-navy-900"
                aria-hidden="true"
              >
                {d.short}
              </span>
              {AVAIL_HOURS.map((h) => {
                const on = isOn(value, d.key, h);
                return (
                  <button
                    key={`${d.key}-${h}`}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${d.label} ${spokenHour(h)}${on ? ", selected" : ""}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const next = !on;
                      painting.current = next;
                      onChange(withSlot(value, d.key, h, next));
                    }}
                    onPointerEnter={() => {
                      if (painting.current !== null) {
                        onChange(withSlot(value, d.key, h, painting.current));
                      }
                    }}
                    className={`tap-target h-9 rounded-md ring-1 transition ${
                      on
                        ? "bg-brand ring-brand-dark"
                        : "bg-slate-100 ring-slate-200 hover:bg-slate-200"
                    }`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={presetWeekdays}
          className="tap-target rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-navy-900 hover:bg-slate-50"
        >
          Weekdays 9–5
        </button>
        <button
          type="button"
          onClick={() => onChange({})}
          className="tap-target rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-navy-900 hover:bg-slate-50"
        >
          Clear
        </button>
        <span className="text-xs text-slate-500" role="status">
          {total === 0
            ? "Tap or drag across the hours you're generally free."
            : `${total} hour${total === 1 ? "" : "s"} selected`}
        </span>
      </div>
    </div>
  );
}
