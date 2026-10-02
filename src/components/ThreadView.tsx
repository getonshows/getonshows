"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { REPLY_CHAR_LIMIT } from "@/lib/pitch-templates";
import { blockUser, sendMessage, setIntent } from "@/lib/messaging";
import type { IntentAction, ThreadData } from "@/lib/types";
import ReportDialog from "@/components/ReportDialog";

const STATE_META: Record<string, { label: string; classes: string }> = {
  pitched: { label: "Pitched", classes: "bg-amber-100 text-amber-800" },
  replied: { label: "Replied", classes: "bg-sky/15 text-navy" },
  interested: { label: "Interested", classes: "bg-green-100 text-green-800" },
  passed: { label: "Passed", classes: "bg-slate-200 text-slate-600" },
  booked: { label: "Booked ✓", classes: "bg-teal-100 text-teal-800" },
};

export function IntentBadge({ state }: { state: string }) {
  const meta = STATE_META[state] ?? STATE_META.pitched;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ThreadView({ thread }: { thread: ThreadData }) {
  const router = useRouter();
  const { conversation, messages, other, myProfileId, myDisplayName } = thread;
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmPass, setConfirmPass] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Poll for new messages every 5s (documented choice over Realtime: simpler,
  // no extra socket, and fine at pilot scale). Pause when tab is hidden.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSend() {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const res = await sendMessage({ conversationId: conversation.id, body: text });
    if (res.ok) {
      setReply("");
      router.refresh();
    } else {
      setError(res.error ?? "Couldn't send your message.");
    }
    setSending(false);
  }

  async function handleIntent(intent: IntentAction) {
    setActing(true);
    setError(null);
    const res = await setIntent({ conversationId: conversation.id, intent });
    if (res.ok) {
      if (intent === "booked" && res.bookingUrl) {
        window.open(res.bookingUrl, "_blank", "noopener,noreferrer");
      }
      setConfirmPass(false);
      router.refresh();
    } else {
      setError(res.error ?? "Couldn't update the conversation.");
    }
    setActing(false);
  }

  async function handleBlock() {
    setBlocking(true);
    const res = await blockUser(other.userId);
    if (res.ok) {
      router.push("/inbox");
      router.refresh();
    } else {
      setError(res.error ?? "Couldn't block this user.");
      setBlocking(false);
      setConfirmBlock(false);
    }
  }

  const state = conversation.state;
  const canSetIntent = ["pitched", "replied"].includes(state);
  const canBook = state === "interested";
  const archived = conversation.archived;
  const replyLen = reply.length;

  return (
    <div className="flex min-h-[70dvh] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <Link
          href="/inbox"
          aria-label="Back to inbox"
          className="tap-target -ml-2 rounded-full p-2 text-slate-500 hover:bg-slate-100"
        >
          ←
        </Link>
        <Link
          href={`/discover/${other.profileId}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {other.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={other.photoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-semibold text-white">
              {other.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy">
              {other.displayName}
            </span>
            {other.headline && (
              <span className="block truncate text-xs text-slate-500">
                {other.headline}
              </span>
            )}
          </span>
        </Link>
        <IntentBadge state={state} />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            className="tap-target rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="tap-target block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Report user
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmBlock(true);
                  }}
                  className="tap-target block w-full px-4 py-2.5 text-left text-sm font-medium text-coral hover:bg-coral/5"
                >
                  Block user
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto py-5" aria-live="polite">
        {messages.map((m) =>
          m.kind === "system" ? (
            <p
              key={m.id}
              className="mx-auto max-w-[90%] rounded-full bg-slate-100 px-4 py-1.5 text-center text-xs italic text-slate-500"
            >
              {m.body}
            </p>
          ) : (
            <div
              key={m.id}
              className={`flex ${m.sender_profile_id === myProfileId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.sender_profile_id === myProfileId
                    ? "rounded-br-md bg-navy-800 text-white"
                    : "rounded-bl-md bg-white text-navy shadow-sm ring-1 ring-slate-100"
                }`}
              >
                {m.sender_profile_id !== myProfileId && (
                  <p className="mb-0.5 text-xs font-semibold text-slate-500">
                    {other.displayName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className={`mt-1 text-right text-[11px] ${
                    m.sender_profile_id === myProfileId
                      ? "text-white/60"
                      : "text-slate-500"
                  }`}
                >
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Intent bar */}
      {!archived && (canSetIntent || canBook) && (
        <div className="border-t border-slate-100 pt-3">
          {canSetIntent && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={acting}
                onClick={() => handleIntent("interested")}
                className="tap-target flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                Interested
              </button>
              {confirmPass ? (
                <>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleIntent("passed")}
                    className="tap-target flex-1 rounded-xl bg-coral py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Confirm pass
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPass(false)}
                    className="tap-target rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPass(true)}
                  className="tap-target flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Pass
                </button>
              )}
            </div>
          )}
          {canBook && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={acting}
                onClick={() => handleIntent("booked")}
                className="tap-target flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {acting
                  ? "Booking…"
                  : other.isHost
                    ? "Book this show"
                    : "Book this guest"}
              </button>
              {confirmPass ? (
                <>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleIntent("passed")}
                    className="tap-target flex-1 rounded-xl bg-coral py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Confirm pass
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPass(false)}
                    className="tap-target rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPass(true)}
                  className="tap-target rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Pass
                </button>
              )}
            </div>
          )}
          <p className="mt-1.5 text-center text-xs text-slate-500">
            {canBook
              ? "Booking claims the spot and opens their booking link to pick a time."
              : "Mark Interested when you're ready — that's what unlocks booking. Passing archives this thread."}
          </p>
        </div>
      )}
      {state === "booked" && (
        <div className="border-t border-slate-100 pt-3 text-center">
          <p className="text-xs font-medium text-teal-700">
            🎙️ This booking is claimed.
          </p>
          {other.bookingUrl ? (
            <a
              href={other.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target mt-2 inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Open their booking link
            </a>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              They haven't added a booking link — arrange the time in chat.
            </p>
          )}
        </div>
      )}
      {archived && state === "passed" && (
        <p className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
          You passed on this thread. It's archived.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-coral/10 px-3 py-2 text-xs font-medium text-coral">
          {error}
        </p>
      )}

      {/* Reply box */}
      {!archived ? (
        <div className="sticky bottom-24 mt-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              maxLength={REPLY_CHAR_LIMIT + 50}
              placeholder={`Reply to ${other.displayName}…`}
              aria-label="Reply"
              className="max-h-32 flex-1 resize-none rounded-xl px-3 py-2.5 text-sm text-navy placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || reply.trim().length === 0 || replyLen > REPLY_CHAR_LIMIT}
              className="tap-target shrink-0 rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800/90 disabled:opacity-40"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
          {replyLen > REPLY_CHAR_LIMIT && (
            <p className="px-3 pb-1 text-xs text-coral">
              Keep replies under {REPLY_CHAR_LIMIT} characters.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-500">
          This conversation is archived and read-only.
        </p>
      )}

      {/* Block confirmation */}
      {confirmBlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-800/50 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm block"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmBlock(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="font-serif text-lg font-semibold text-navy">
              Block {other.displayName}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              They won't be able to find your profile or message you, and this
              conversation will be archived. You can manage blocks later from
              your profile.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmBlock(false)}
                className="tap-target flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlock}
                disabled={blocking}
                className="tap-target flex-1 rounded-xl bg-coral py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {blocking ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <ReportDialog
          targetUserId={other.userId}
          targetName={other.displayName}
          conversationId={conversation.id}
          onClose={() => setReportOpen(false)}
        />
      )}

      {/* Screen-reader context for who's who */}
      <span className="sr-only">
        You are chatting as {myDisplayName}.
      </span>
    </div>
  );
}
