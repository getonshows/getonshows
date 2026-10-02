"use client";

import { useEffect, useMemo, useState } from "react";
import { getBookingAvailability, proposeBooking } from "@/lib/messaging";
import {
  generateBookableSlots,
  type BookableSlot,
} from "@/lib/booking-utils";

/** Pick up to 3 times from the other person's availability. */
export default function BookingPicker({
  conversationId,
  onClose,
  onSent,
}: {
  conversationId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [theirName, setTheirName] = useState("them");
  const [noAvailability, setNoAvailability] = useState(false);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getBookingAvailability(conversationId)
      .then((info) => {
        if (!alive) return;
        if (!info || !info.availability || !info.timezone) {
          setNoAvailability(true);
        } else {
          const viewerTz =
            Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
          setTheirName(info.displayName);
          setSlots(
            generateBookableSlots(info.availability, info.timezone, viewerTz)
          );
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setNoAvailability(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [conversationId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    const groups: { day: string; slots: BookableSlot[] }[] = [];
    const byDay = new Map<string, BookableSlot[]>();
    for (const s of slots) {
      const day = s.label.split(" · ")[0];
      const arr = byDay.get(day) ?? [];
      arr.push(s);
      byDay.set(day, arr);
    }
    for (const [day, daySlots] of byDay) groups.push({ day, slots: daySlots });
    return groups;
  }, [slots]);

  function toggle(iso: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else if (next.size < 3) next.add(iso);
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    const res = await proposeBooking(conversationId, Array.from(selected));
    setSending(false);
    if (res.ok) {
      onSent();
      onClose();
    } else {
      setError(res.error ?? "Couldn't send the request.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-800/50 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Pick a time"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-navy-900">
            Pick a time
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3 py-6" aria-label="Loading">
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : noAvailability ? (
            <p className="py-8 text-center text-sm text-slate-600">
              {theirName} hasn&apos;t set availability yet. Propose a time in
              chat instead.
            </p>
          ) : grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No open slots in the next 2 weeks. Try proposing a time in chat.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">
                {theirName}&rsquo;s availability, shown in your timezone. Pick
                up to 3.
              </p>
              <div className="space-y-4">
                {grouped.map((g) => (
                  <div key={g.day}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {g.day}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.slots.map((s) => {
                        const active = selected.has(s.startUtc);
                        const time = s.label.split(" · ")[1] ?? s.label;
                        return (
                          <button
                            key={s.startUtc}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(s.startUtc)}
                            className={`tap-target rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                              active
                                ? "bg-teal-600 text-white ring-teal-600"
                                : "bg-white text-slate-700 ring-slate-300 hover:ring-slate-400"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        {!loading && !noAvailability && grouped.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="tap-target w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending
                ? "Sending…"
                : selected.size === 0
                  ? "Select up to 3 times"
                  : `Send ${selected.size} time${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
