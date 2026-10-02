"use client";

import { bookingToIcs } from "@/lib/booking-utils";

/** Download a .ics calendar file for a confirmed booking. */
export default function IcsButton({
  title,
  startUtc,
  otherName,
}: {
  title: string;
  startUtc: string;
  otherName: string;
}) {
  function download() {
    const ics = bookingToIcs({
      title,
      description: `Booked with ${otherName} via GetOnShows.`,
      startUtc,
      durationMinutes: 60,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "getonshows-booking.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="tap-target inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-navy-900 transition hover:bg-slate-50"
    >
      📅 Add to calendar
    </button>
  );
}
