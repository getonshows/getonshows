"use client";

import { useState } from "react";
import { respondBooking } from "@/lib/messaging";
import { formatInTz } from "@/lib/booking-utils";
import type { BookingRequestRow } from "@/lib/types";

export type BookingRequestView = BookingRequestRow & {
  proposedByMe: boolean;
  proposerName: string;
};

/** One booking request, rendered inside the conversation thread. */
export default function BookingRequestCard({
  request,
  onChanged,
}: {
  request: BookingRequestView;
  onChanged: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

  async function act(
    action: "accept" | "decline" | "cancel",
    slotIso?: string
  ) {
    setActing(true);
    setError(null);
    const res = await respondBooking(request.id, action, slotIso);
    setActing(false);
    if (res.ok) onChanged();
    else setError(res.error ?? "Couldn't update the request.");
  }

  const label = (iso: string) => formatInTz(iso, viewerTz);

  if (request.status === "accepted" && request.accepted_slot) {
    return (
      <div className="rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-200">
        <p className="text-sm font-semibold text-teal-900">
          📅 Booked for {label(request.accepted_slot)}
        </p>
      </div>
    );
  }

  if (request.status !== "pending") {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">
          Time request{" "}
          {request.status === "declined" ? "declined" : "withdrawn"}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-navy-900">
        🕐 {request.proposerName} proposed{" "}
        {request.slots.length === 1 ? "a time" : "times"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {request.slots.map((s) => (
          <span
            key={s}
            className="rounded-full bg-slate-100 px-3.5 py-2 text-sm font-medium text-navy-900 ring-1 ring-slate-200"
          >
            {label(s)}
          </span>
        ))}
      </div>

      {!request.proposedByMe ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">
            Tap a time to accept it, or decline.
          </p>
          <div className="flex flex-wrap gap-2">
            {request.slots.map((s) => (
              <button
                key={s}
                type="button"
                disabled={acting}
                onClick={() => act("accept", s)}
                aria-label={`Accept ${label(s)}`}
                className="tap-target rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                Accept {label(s)}
              </button>
            ))}
            <button
              type="button"
              disabled={acting}
              onClick={() => act("decline")}
              className="tap-target rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">Waiting for their reply…</p>
          <button
            type="button"
            disabled={acting}
            onClick={() => act("cancel")}
            className="tap-target rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
