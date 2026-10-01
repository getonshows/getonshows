"use client";

import { useState } from "react";
import { reportUser } from "@/lib/messaging";

const REASONS = [
  { id: "spam", label: "Spam or unsolicited promotion" },
  { id: "harassment", label: "Harassment or abusive messages" },
  { id: "fake_profile", label: "Fake or misleading profile" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "other", label: "Something else" },
];

/** Report-a-user dialog. Used from threads and profile pages. */
export default function ReportDialog({
  targetUserId,
  targetName,
  conversationId,
  onClose,
}: {
  targetUserId: string;
  targetName: string;
  conversationId?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    const res = await reportUser({
      targetUserId,
      reason,
      details,
      conversationId,
    });
    if (res.ok) {
      setDone(true);
    } else {
      setError(res.error ?? "Couldn't file the report.");
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Report ${targetName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        {done ? (
          <div className="py-4 text-center">
            <p className="text-3xl">✓</p>
            <h2 className="mt-2 font-serif text-lg font-semibold text-navy">
              Report received
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Thanks — we'll review {targetName}'s profile and take action if
              needed.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="tap-target mt-5 w-full rounded-xl bg-navy py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-lg font-semibold text-navy">
              Report {targetName}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Reports are reviewed by our team. The person won't know you reported them.
            </p>
            <div className="mt-4 space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`tap-target flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition ${
                    reason === r.id
                      ? "border-navy bg-sky/10 font-medium text-navy"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-navy"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Anything we should know? (optional)"
              aria-label="Report details"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none"
            />
            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-coral">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="tap-target flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!reason || sending}
                className="tap-target flex-1 rounded-xl bg-navy py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {sending ? "Sending…" : "Submit report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
