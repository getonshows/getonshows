"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";
type PwStatus = "idle" | "working" | "error" | "confirm";
type PwMode = "signin" | "signup";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const [pwMode, setPwMode] = useState<PwMode>("signin");
  const [pwEmail, setPwEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<PwStatus>("idle");
  const [pwMessage, setPwMessage] = useState("");

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setStatus("sending");
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(
        "We couldn't send that link. Check the email address and try again."
      );
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    setStatus("sending");
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage("Google sign-in failed to start. Please try again.");
    }
  }

  /** Mirror of /auth/callback routing + funnel bookkeeping, for password auth. */
  async function routeAfterPasswordAuth() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let dest = "/profile";
    if (user) {
      const { data: row } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = (row as { role: string | null } | null)?.role;
      if (!role || role === "undecided") dest = "/onboarding";
      try {
        const m = document.cookie.match(/(?:^|; )gos_source=([^;]*)/);
        const source = m ? decodeURIComponent(m[1]).slice(0, 80) : null;
        if (source) {
          await supabase
            .from("users")
            .update({ source })
            .eq("id", user.id)
            .is("source", null);
        }
        const { count } = await supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("name", "signup");
        if ((count ?? 0) === 0) {
          await supabase
            .from("events")
            .insert({ name: "signup", user_id: user.id, properties: {} });
        }
      } catch {
        // Analytics must never break sign-in.
      }
    }
    window.location.href = dest;
  }

  function friendlyAuthError(error: { message: string }): string {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials"))
      return "Incorrect email or password. Try again or create an account.";
    if (msg.includes("user already registered") || msg.includes("already exists"))
      return "An account with this email already exists — sign in instead.";
    if (msg.includes("password"))
      return "Password must be at least 6 characters.";
    if (msg.includes("email not confirmed"))
      return "Please confirm your email first — check your inbox for the link.";
    return "Something went wrong. Please try again.";
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    setPwStatus("working");
    setPwMessage("");
    if (pwMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: pwEmail.trim(),
        password,
      });
      if (error) {
        setPwStatus("error");
        setPwMessage(friendlyAuthError(error));
        return;
      }
      await routeAfterPasswordAuth();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: pwEmail.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setPwStatus("error");
        setPwMessage(friendlyAuthError(error));
        return;
      }
      if (data.session) {
        await routeAfterPasswordAuth();
      } else {
        // Email confirmation required — link is on its way.
        setPwStatus("confirm");
      }
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          GetOnShows
        </p>
        <h1 className="mt-3 text-3xl font-bold text-navy-900">
          Welcome back
        </h1>
        <p className="mt-2 text-slate-600">
          Sign in to build your profile and find your next great conversation.
        </p>

        {status === "sent" ? (
          <div
            role="status"
            className="mt-8 rounded-2xl bg-brand-light p-5 ring-1 ring-brand/30"
          >
            <h2 className="font-semibold text-navy-900">Check your inbox</h2>
            <p className="mt-1 text-slate-700">
              We sent a sign-in link to <strong>{email.trim()}</strong>. It
              expires soon and works once — open it on this device.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="tap-target mt-3 font-semibold text-brand-dark underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-navy-900"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="tap-target mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            {status === "error" && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="tap-target w-full rounded-xl bg-navy-800 px-6 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          or
          <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={status === "sending"}
          className="tap-target w-full rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          or
          <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        </div>

        <section
          aria-label="Email and password"
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div
            role="tablist"
            aria-label="Password mode"
            className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {(["signin", "signup"] as PwMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={pwMode === m}
                onClick={() => {
                  setPwMode(m);
                  setPwStatus("idle");
                  setPwMessage("");
                }}
                className={`tap-target rounded-lg px-4 text-sm font-semibold transition ${
                  pwMode === m
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-slate-500 hover:text-navy-900"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {pwStatus === "confirm" ? (
            <div role="status" className="mt-4">
              <h2 className="font-semibold text-navy-900">Check your inbox</h2>
              <p className="mt-1 text-sm text-slate-600">
                We sent a confirmation link to{" "}
                <strong>{pwEmail.trim()}</strong>. Click it, then sign in with
                your new password.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPwMode("signin");
                  setPwStatus("idle");
                }}
                className="tap-target mt-3 text-sm font-semibold text-brand-dark underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={submitPassword} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="pw-email"
                  className="block text-sm font-semibold text-navy-900"
                >
                  Email address
                </label>
                <input
                  id="pw-email"
                  name="pw-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={pwEmail}
                  onChange={(e) => setPwEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="tap-target mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label
                  htmlFor="pw-password"
                  className="block text-sm font-semibold text-navy-900"
                >
                  Password
                </label>
                <input
                  id="pw-password"
                  name="pw-password"
                  type="password"
                  autoComplete={
                    pwMode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    pwMode === "signin"
                      ? "Your password"
                      : "At least 6 characters"
                  }
                  className="tap-target mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              {pwStatus === "error" && (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {pwMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={pwStatus === "working"}
                className="tap-target w-full rounded-xl bg-navy-800 px-6 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
              >
                {pwStatus === "working"
                  ? "Please wait…"
                  : pwMode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>
          )}
        </section>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
