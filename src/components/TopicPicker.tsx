"use client";

import { useMemo, useState } from "react";
import { addCustomTopic } from "@/lib/actions";
import { topicMatchesLabel } from "@/lib/topic-search";
import type { TopicRow } from "@/lib/types";

const MAX_CUSTOM_TOPICS = 3;

export default function TopicPicker({
  topics,
  customTopics: initialCustom,
  selected,
  onChange,
}: {
  topics: TopicRow[];
  customTopics: TopicRow[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [customTopics, setCustomTopics] = useState<TopicRow[]>(initialCustom);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const all = useMemo(() => [...topics, ...customTopics], [topics, customTopics]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) => topicMatchesLabel(t.label, q));
  }, [all, query]);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  }

  const customAttached = customTopics.filter((t) =>
    selected.includes(t.id)
  ).length;

  async function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (adding || newLabel.trim().length < 2) return;
    setAdding(true);
    setAddError("");
    const result = await addCustomTopic(newLabel);
    setAdding(false);
    if (result.ok) {
      setCustomTopics((prev) =>
        prev.some((t) => t.id === result.topic.id)
          ? prev
          : [...prev, result.topic]
      );
      if (!selected.includes(result.topic.id)) {
        onChange([...selected, result.topic.id]);
      }
      setNewLabel("");
    } else {
      setAddError(result.error);
    }
  }

  return (
    <div>
      <label htmlFor="topic-search" className="block text-sm font-semibold text-navy-900">
        What do you talk about?
      </label>
      <p className="mt-1 text-sm text-slate-600">
        Pick the topics that define your show or your expertise. Matches are
        built on these.
      </p>
      <input
        id="topic-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search topics…"
        aria-label="Search topics"
        className="tap-target mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400"
      />

      <div
        role="group"
        aria-label="Available topics"
        className="mt-4 flex flex-wrap gap-2"
      >
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500">
            No topics match that search. Add it as a custom topic below.
          </p>
        )}
        {filtered.map((t) => {
          const active = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              aria-pressed={active}
              className={`tap-target rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
                active
                  ? "bg-navy-800 text-white ring-navy-800"
                  : "bg-white text-slate-700 ring-slate-300 hover:ring-navy-800"
              }`}
            >
              {t.label}
              {t.is_custom && (
                <span className="sr-only"> (custom topic)</span>
              )}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleAddCustom} className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <label htmlFor="custom-topic" className="block text-sm font-semibold text-navy-900">
          Add a custom topic
        </label>
        <p className="mt-1 text-sm text-slate-600">
          Up to {MAX_CUSTOM_TOPICS} per profile ({customAttached} selected).
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id="custom-topic"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. retro video games"
            maxLength={40}
            className="tap-target min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={adding || newLabel.trim().length < 2}
            className="tap-target shrink-0 rounded-xl bg-navy-800 px-5 font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {addError && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {addError}
          </p>
        )}
      </form>

      {selected.length > 0 && (
        <p aria-live="polite" className="mt-3 text-sm font-medium text-navy-900">
          {selected.length} topic{selected.length === 1 ? "" : "s"} selected
        </p>
      )}
    </div>
  );
}
