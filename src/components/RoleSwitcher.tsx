"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchRole } from "@/lib/actions";

const OPTIONS = [
  {
    value: "host",
    label: "Host",
    blurb: "You run a show and browse guests to invite.",
  },
  {
    value: "guest",
    label: "Guest",
    blurb: "You appear on shows and browse shows to pitch.",
  },
  {
    value: "dual",
    label: "Both",
    blurb: "Unlocks the Guests / Shows toggle on Discover.",
  },
] as const;

/**
 * Task 0: role switching. Server-validated; switching never deletes
 * profiles, conversations, or pitches — they stay on file and accessible.
 */
export default function RoleSwitcher({
  currentRole,
}: {
  currentRole: "host" | "guest" | "dual";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onSwitch(value: "host" | "guest" | "dual") {
    if (value === currentRole || pending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await switchRole(value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(
        value === "dual"
          ? "You're now both — the Guests / Shows toggle is live on Discover."
          : `You're now a ${value}. Your existing profiles, threads, and pitches are untouched.`
      );
      router.refresh();
    });
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Your role" className="mt-3 space-y-2">
        {OPTIONS.map((opt) => {
          const active = opt.value === currentRole;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending || active}
              onClick={() => onSwitch(opt.value)}
              className={`tap-target w-full rounded-xl border p-4 text-left transition ${
                active
                  ? "border-brand bg-brand-light/40 ring-1 ring-brand"
                  : "border-slate-300 bg-white hover:border-slate-400"
              } disabled:cursor-default`}
            >
              <span className="flex items-center justify-between">
                <span className="font-semibold text-navy-900">{opt.label}</span>
                {active && (
                  <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
                    Current
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {opt.blurb}
              </span>
            </button>
          );
        })}
      </div>
      {pending && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          Switching role…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm font-medium text-green-800">
          {notice}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Switching never deletes anything. Your profiles, conversation threads,
        and pitches stay exactly where they are.
      </p>
    </div>
  );
}
