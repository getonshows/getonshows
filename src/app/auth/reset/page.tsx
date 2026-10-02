"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "saving" | "done" | "error";

/**
 * Password reset landing page. The recovery email links to
 * /auth/callback?next=/auth/reset, which exchanges the code for a session
 * and sends the user here to choose a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus("ready");
      } else {
        setStatus("error");
        setMessage(
          "This reset link is invalid or has expired. Request a new one from the sign-in page."
        );
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setStatus("saving");
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(
        "We couldn't update your password. The link may have expired, so request a new one from the sign-in page."
      );
      return;
    }
    setStatus("done");
    window.setTimeout(() => router.replace("/profile"), 1600);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Image
          src="/logo.png"
          alt="GetOnShows"
          width={220}
          height={140}
          priority
          className="mb-6"
        />
        <h1 className="mt-3 text-3xl font-bold text-navy-900">
          Choose a new password
        </h1>

        {status === "checking" && (
          <p className="mt-4 text-slate-600">Checking your reset link…</p>
        )}

        {status === "error" && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
            <p className="text-sm font-medium text-red-800">{message}</p>
            <Link
              href="/login"
              className="tap-target mt-2 inline-block text-sm font-semibold text-brand-dark underline"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-semibold text-navy-900"
              >
                New password
              </label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="tap-target mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={status === "saving"}
              className="tap-target w-full rounded-xl bg-navy-800 px-6 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        {status === "done" && (
          <div
            role="status"
            className="mt-4 rounded-xl bg-teal-50 p-4 ring-1 ring-teal-200"
          >
            <p className="text-sm font-medium text-teal-800">
              Password updated. Taking you to your profile…
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
