"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { TopicRow } from "@/lib/types";

/**
 * Discovery filters. State lives in the URL (?q=&topics=&medium=&session=)
 * so results are shareable and survive refresh; the server re-renders.
 */
export default function DiscoveryFilters({
  topics,
  showRecordingFilters,
}: {
  topics: TopicRow[];
  showRecordingFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [locQuery, setLocQuery] = useState(params.get("loc") ?? "");

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  function toggleTopic(id: string) {
    const current = new Set((params.get("topics") ?? "").split(",").filter(Boolean));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    update({ topics: current.size > 0 ? Array.from(current).join(",") : null });
  }

  const selectedTopics = new Set(
    (params.get("topics") ?? "").split(",").filter(Boolean)
  );
  const hasFilters =
    query !== "" ||
    locQuery !== "" ||
    selectedTopics.size > 0 ||
    params.get("medium") ||
    params.get("session");

  function clearAll() {
    setQuery("");
    setLocQuery("");
    update({ q: null, loc: null, topics: null, medium: null, session: null });
  }

  // Debounce the text searches so we don't re-render on every keystroke.
  const [debounce, setDebounce] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [locDebounce, setLocDebounce] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );
  function onQueryChange(value: string) {
    setQuery(value);
    if (debounce) clearTimeout(debounce);
    setDebounce(setTimeout(() => update({ q: value || null }), 500));
  }
  function onLocChange(value: string) {
    setLocQuery(value);
    if (locDebounce) clearTimeout(locDebounce);
    setLocDebounce(setTimeout(() => update({ loc: value || null }), 500));
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Search profiles</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search names, shows, expertise…"
          className="tap-target w-full rounded-xl bg-white px-4 text-navy-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-800"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Location
        </span>
        <input
          type="search"
          value={locQuery}
          onChange={(e) => onLocChange(e.target.value)}
          placeholder="Filter by city or state…"
          className="tap-target w-full rounded-xl bg-white px-4 text-navy-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-800"
        />
      </label>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Topics
        </p>
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
          role="group"
          aria-label="Filter by topic"
        >
          {topics.map((t) => {
            const active = selectedTopics.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTopic(t.id)}
                className={`tap-target shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition ${
                  active
                    ? "bg-navy-800 text-white ring-navy-800"
                    : "bg-white text-slate-700 ring-slate-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {showRecordingFilters && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Medium
            </span>
            <select
              value={params.get("medium") ?? ""}
              onChange={(e) => update({ medium: e.target.value || null })}
              className="tap-target w-full rounded-xl bg-white px-3 text-sm font-medium text-navy-900 ring-1 ring-slate-300"
            >
              <option value="">Any medium</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Session
            </span>
            <select
              value={params.get("session") ?? ""}
              onChange={(e) => update({ session: e.target.value || null })}
              className="tap-target w-full rounded-xl bg-white px-3 text-sm font-medium text-navy-900 ring-1 ring-slate-300"
            >
              <option value="">Any session</option>
              <option value="remote">Remote</option>
              <option value="in_person">In person</option>
            </select>
          </label>
        </div>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="tap-target text-sm font-semibold text-brand-dark underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
