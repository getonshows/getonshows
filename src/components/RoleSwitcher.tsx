"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchRole } from "@/lib/actions";

const OPTIONS = [
  { value: "host", label: "Host" },
  { value: "guest", label: "Guest" },
  { value: "dual", label: "Both" },
] as const;

/**
 * Task 0: role switching. Server-validated; switching never deletes
 * profiles, conversations, or pitches: they stay on file and accessible.
 * Rendered as a compact segmented tab control.
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
          ? "You're now both. The Guests / Shows toggle is live on Discover."
          : `You're now a ${value}. Your existing profiles, threads, and pitches are untouched.`
      );
      router.refresh();
    });
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Your role"
        className="mt-3 inline-flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200"
      >
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
              className={`tap-target rounded-full px-5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-navy-800 text-white shadow"
                  : "text-slate-600 hover:text-navy-900"
              } disabled:cursor-default`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {pending && (
        <p role="status" className="mt-2 text-sm text-slate-600">
          Switching role…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm font-medium text-green-800">
          {notice}
        </p>
      )}
    </div>
  );
}
