"use client";

import { useState } from "react";
import {
  getInviteInfo,
  recordInviteShare,
  sendInviteEmail,
} from "@/lib/actions";
import CopyButton from "@/components/CopyButton";

type Tab = "email" | "sms" | "link";

/** Invite friends by email, text message, or shareable link. */
export default function InviteCard({
  initial,
}: {
  initial: { code: string; link: string; sentToday: number; limit: number };
}) {
  const [tab, setTab] = useState<Tab>("email");
  const [info, setInfo] = useState(initial);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setInfo(await getInviteInfo());
    } catch {
      /* quota display is best-effort */
    }
  }

  async function onSendEmail() {
    setBusy(true);
    setStatus(null);
    setError(null);
    const res = await sendInviteEmail(email);
    setBusy(false);
    if (res.ok) {
      setStatus(`Invite sent to ${email.trim()}.`);
      setEmail("");
      void refresh();
    } else {
      setError(res.error);
    }
  }

  function smsHref() {
    const digits = phone.replace(/[^\d+]/g, "");
    const body = encodeURIComponent(
      `Join me on GetOnShows, where podcast hosts find great guests (and vice versa): ${info.link}`
    );
    // ?&body= works on both iOS and Android.
    return `sms:${digits}?&body=${body}`;
  }

  async function onSmsTap() {
    setError(null);
    const digits = phone.replace(/[^\d+]/g, "");
    if (digits.replace("+", "").length < 7) {
      setError("Enter a valid phone number.");
      return;
    }
    await recordInviteShare("sms", phone);
    void refresh();
    window.location.href = smsHref();
  }

  async function onCopyLink() {
    await recordInviteShare("link");
    void refresh();
  }

  const remaining = Math.max(0, info.limit - info.sentToday);

  return (
    <section
      aria-labelledby="invite-heading"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <h2 id="invite-heading" className="text-lg font-semibold text-navy-900">
        Invite others
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Know a host or guest who belongs here? Send them your personal invite
        link.
      </p>

      <div
        role="tablist"
        aria-label="Invite method"
        className="mt-3 inline-flex rounded-full bg-slate-100 p-1 ring-1 ring-slate-200"
      >
        {(
          [
            ["email", "Email"],
            ["sms", "Text"],
            ["link", "Link"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setStatus(null);
              setError(null);
            }}
            className={`tap-target rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === value
                ? "bg-navy-800 text-white shadow"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "email" && (
          <div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Their email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                autoComplete="email"
                className="tap-target w-full rounded-xl bg-white px-4 text-navy-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-800"
              />
            </label>
            <button
              type="button"
              onClick={onSendEmail}
              disabled={busy || email.trim() === ""}
              className="tap-target mt-3 w-full rounded-xl bg-navy-800 py-3 text-sm font-semibold text-white transition hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              They get a sign-in link by email. {remaining} of {info.limit}{" "}
              invites left today.
            </p>
          </div>
        )}

        {tab === "sms" && (
          <div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Their phone number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                autoComplete="tel"
                className="tap-target w-full rounded-xl bg-white px-4 text-navy-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-800"
              />
            </label>
            <button
              type="button"
              onClick={onSmsTap}
              className="tap-target mt-3 w-full rounded-xl bg-navy-800 py-3 text-sm font-semibold text-white transition hover:bg-navy-900"
            >
              Open in Messages
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Opens your messaging app with the invite text ready to send.
            </p>
          </div>
        )}

        {tab === "link" && (
          <div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-slate-100 px-3 py-2 text-xs text-navy-900">
                {info.link}
              </code>
              <span onClick={onCopyLink}>
                <CopyButton text={info.link} />
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Anyone who joins through this link is credited to you.
            </p>
          </div>
        )}

        {status && (
          <p role="status" className="mt-3 text-sm font-medium text-green-800">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
