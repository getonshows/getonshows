"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PITCH_CHAR_LIMIT,
  PITCH_TEMPLATES,
  renderTemplate,
  unfilledPrompts,
  type PitchDirection,
} from "@/lib/pitch-templates";
import {
  getPitchContext,
  getPitchQuota,
  sendPitch,
} from "@/lib/messaging";
import type { PitchContext, PitchQuotaStatus } from "@/lib/types";

/** "Pitch" button for Discover cards / profile pages. Owns the composer modal. */
export default function PitchButton({
  targetProfileId,
  asRole,
  label = "Pitch",
  className = "",
}: {
  targetProfileId: string;
  asRole: "host" | "guest";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`tap-target rounded-xl bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800/90 ${className}`}
      >
        {label}
      </button>
      {open && (
        <PitchComposer
          targetProfileId={targetProfileId}
          asRole={asRole}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PitchComposer({
  targetProfileId,
  asRole,
  onClose,
}: {
  targetProfileId: string;
  asRole: "host" | "guest";
  onClose: () => void;
}) {
  const router = useRouter();
  const direction: PitchDirection =
    asRole === "guest" ? "guest-to-host" : "host-to-guest";
  const templates = PITCH_TEMPLATES.filter((t) => t.direction === direction);

  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<PitchContext | null>(null);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<PitchQuotaStatus | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    getPitchContext(targetProfileId, asRole)
      .then((c) => {
        if (!alive) return;
        setCtx(c);
        setQuota(c.quota ?? null);
        if (c.canPitch && c.prefill) {
          const t = templates[0];
          if (t) setBody(renderTemplate(t.body, c.prefill));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setCtx({ canPitch: false, reason: "Couldn't load the composer. Please try again." });
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move keyboard focus into the composer once it's ready, so keyboard
  // users don't start behind the modal.
  useEffect(() => {
    if (!loading && ctx?.canPitch) {
      textareaRef.current?.focus();
    }
  }, [loading, ctx]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const template = templates.find((t) => t.id === templateId);

  function pickTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t || !ctx?.prefill) return;
    setTemplateId(id);
    setBody(renderTemplate(t.body, ctx.prefill));
    setTouched(false);
    setError(null);
  }

  async function handleSend() {
    setError(null);
    setSending(true);
    try {
      const res = await sendPitch({ toProfileId: targetProfileId, body, asRole });
      if (!res.ok) {
        setError(res.error ?? "Couldn't send your pitch.");
        // Refresh the quota display so the sender sees the reset date.
        getPitchQuota().then(setQuota).catch(() => {});
        setSending(false);
        return;
      }
      onClose();
      router.push(`/inbox/${res.conversationId}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSending(false);
    }
  }

  const prompts = unfilledPrompts(body);
  const overLimit = body.length > PITCH_CHAR_LIMIT;
  const canSend =
    !sending && body.trim().length > 0 && !overLimit && prompts.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-800/50 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Send a pitch"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-serif text-lg font-semibold text-navy">
            {asRole === "guest" ? "Pitch yourself as a guest" : "Invite them as a guest"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pitch composer"
            className="tap-target rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3 py-6" aria-label="Loading">
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : !ctx?.canPitch ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-600">{ctx?.reason}</p>
              {ctx?.existingConversationId && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/inbox/${ctx.existingConversationId}`);
                  }}
                  className="tap-target mt-4 rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Open conversation
                </button>
              )}
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="tap-target mt-2 rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500"
                >
                  Close
                </button>
              </div>
            </div>
          ) : ctx?.existingConversationId ? (
            <div className="py-8 text-center">
              <p className="text-2xl">💬</p>
              <p className="mt-2 text-sm font-medium text-navy">
                You already have a conversation with this person.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/inbox/${ctx.existingConversationId}`);
                }}
                className="tap-target mt-4 rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Open conversation
              </button>
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="tap-target mt-2 rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {quota && (
                <p className="mb-3 rounded-xl bg-sky/10 px-3 py-2 text-xs text-navy">
                  You have <strong>{quota.remaining}</strong> of {quota.limit} pitches
                  left today
                  {quota.remaining === 0 && ", quota resets soon"}.
                </p>
              )}

              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTemplate(t.id)}
                    className={`tap-target shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                      t.id === templateId
                        ? "border-navy bg-navy-800 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              {template && (
                <p className="mb-3 text-xs text-slate-500">{template.hint}</p>
              )}

              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setTouched(true);
                }}
                rows={12}
                maxLength={PITCH_CHAR_LIMIT + 100}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none"
                placeholder="Write your pitch…"
                aria-label="Pitch message"
              />

              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span
                  className={
                    prompts.length > 0 && touched
                      ? "font-medium text-coral"
                      : "text-slate-500"
                  }
                >
                  {prompts.length > 0
                    ? `${prompts.length} prompt${prompts.length === 1 ? "" : "s"} to fill: ${prompts.slice(0, 2).join(", ")}${prompts.length > 2 ? "…" : ""}`
                    : "All prompts filled ✓"}
                </span>
                <span
                  className={overLimit ? "font-semibold text-coral" : "text-slate-500"}
                >
                  {body.length}/{PITCH_CHAR_LIMIT}
                </span>
              </div>

              {error && (
                <p role="alert" className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-xs font-medium text-coral">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {ctx?.canPitch && !ctx.existingConversationId && !loading && (
          <div className="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="tap-target w-full rounded-xl bg-navy-800 py-3 text-sm font-semibold text-white transition hover:bg-navy-800/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send pitch"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
