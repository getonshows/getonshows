"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IntentBadge } from "@/components/ThreadView";
import type { ThreadPreview } from "@/lib/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type Direction = "all" | "incoming" | "outgoing";
type StatusFilter = "all" | "pitched" | "replied" | "interested" | "booked" | "passed";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pitched", label: "Pitched" },
  { value: "replied", label: "Replied" },
  { value: "interested", label: "Interested" },
  { value: "booked", label: "Booked" },
  { value: "passed", label: "Passed" },
];

/**
 * Inbox thread list with visible search, direction (incoming/outgoing),
 * and status controls. Filtering is client-side over the loaded threads.
 */
export default function InboxList({ threads }: { threads: ThreadPreview[] }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<Direction>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (direction === "incoming" && t.conversation.pitched_by_profile_id === t.myProfileId) {
        return false;
      }
      if (direction === "outgoing" && t.conversation.pitched_by_profile_id !== t.myProfileId) {
        return false;
      }
      if (status !== "all" && t.conversation.state !== status) return false;
      if (q) {
        const haystack =
          `${t.other.displayName} ${t.lastMessage?.body ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [threads, query, direction, status]);

  const hasFilters = query.trim() !== "" || direction !== "all" || status !== "all";

  return (
    <div>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="sr-only">Search conversations</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search names or messages…"
            className="tap-target w-full rounded-xl bg-white px-4 text-navy-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-800"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Direction"
            className="inline-flex rounded-xl bg-slate-100 p-1"
          >
            {(
              [
                { value: "all", label: "All" },
                { value: "incoming", label: "Incoming" },
                { value: "outgoing", label: "Outgoing" },
              ] as { value: Direction; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={direction === opt.value}
                onClick={() => setDirection(opt.value)}
                className={`tap-target rounded-lg px-3.5 text-sm font-semibold transition ${
                  direction === opt.value
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-slate-500 hover:text-navy-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="tap-target rounded-xl bg-white px-3 text-sm font-semibold text-navy-900 ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-800"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDirection("all");
                setStatus("all");
              }}
              className="tap-target text-sm font-semibold text-brand-dark underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">🔍</p>
          <h2 className="mt-3 font-serif text-lg font-semibold text-navy">
            No conversations match
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
            Try a different search or clear the filters.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {filtered.map((t) => (
            <li key={t.conversation.id}>
              <Link
                href={`/inbox/${t.conversation.id}`}
                className="tap-target flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm transition hover:shadow"
              >
                <span className="relative shrink-0">
                  {t.other.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.other.photoUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-800 text-base font-semibold text-white">
                      {t.other.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {t.unreadCount > 0 && (
                    <span
                      aria-label={`${t.unreadCount} unread`}
                      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-white"
                    >
                      {t.unreadCount > 9 ? "9+" : t.unreadCount}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${
                        t.unreadCount > 0
                          ? "font-bold text-navy"
                          : "font-semibold text-navy"
                      }`}
                    >
                      {t.other.displayName}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {timeAgo(t.lastMessage?.created_at ?? t.conversation.created_at)}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-sm ${
                      t.unreadCount > 0 ? "font-medium text-navy" : "text-slate-500"
                    }`}
                  >
                    {t.lastMessage
                      ? t.lastMessage.sender_profile_id === t.myProfileId
                        ? `You: ${t.lastMessage.body}`
                        : t.lastMessage.body
                      : "Say hello 👋"}
                  </span>
                  <span className="mt-1.5 block">
                    <IntentBadge
                      state={t.conversation.state}
                      claimed={
                        t.conversation.state === "booked" &&
                        !t.conversation.agreed_at
                      }
                    />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
