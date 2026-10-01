"use client";

import { Fragment, useRef } from "react";
import {
  AVAIL_DAYS,
  AVAIL_HOURS,
  slotKey,
  type AvailabilityValue,
} from "@/lib/availability";

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
