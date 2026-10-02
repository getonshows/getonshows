"use client";

import { useState } from "react";
import { setEmailNotifications } from "@/lib/actions";

/** Opt in/out of transactional emails: pitches, replies, booking activity. */
export default function NotificationSettings({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setSaving(true);
    try {
      await setEmailNotifications(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Email notifications"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">
            Email notifications
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Get an email when someone pitches you, replies, or proposes
            booking times.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Email notifications"
          onClick={toggle}
          disabled={saving}
          className={`tap-target relative h-8 w-14 shrink-0 rounded-full transition ${
            on ? "bg-brand" : "bg-slate-300"
          } ${saving ? "opacity-60" : ""}`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
              on ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
