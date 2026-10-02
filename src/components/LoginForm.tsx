"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";
type PwStatus = "idle" | "working" | "error" | "confirm";
type PwMode = "signin" | "signup";

function rememberIntent(intent: string | null) {
  if (intent === "host" || intent === "guest") {
    document.cookie = `gos_intent=${intent}; path=/; max-age=3600; SameSite=Lax`;
  }
}

export default function LoginForm({
  intent,
  linkError = false,
}: {
  intent: string | null;
  /** True when the auth callback bounced back because the link failed. */
  linkError?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [errorKind, setErrorKind] = useState<"otp" | "google">("otp");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const [showPassword, setShowPassword] = useState(false);
  const [pwMode, setPwMode] = useState<PwMode>("signin");
  const [pwEmail, setPwEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<PwStatus>("idle");
  const [pwMessage, setPwMessage] = useState("");
  const [pwResendConfirm, setPwResendConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resetMessage, setResetMessage] = useState("");

  /** Carry the typed email across the magic-link / password boundary. */
  function enterPasswordMode() {
    setPwEmail((cur) => cur || email);
    setResetStatus("idle");
    setResetMessage("");
    setShowPassword(true);
  }
  function leavePasswordMode() {
    setEmail((cur) => cur || pwEmail);
    setShowPassword(false);
  }

  function friendlyOtpError(
    error: { message: string },
    action: "send" | "resend"
  ): string {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("too many"))
      return "Too many links sent in a short time. Wait a minute, then try again.";
    return action === "resend"
      ? "We couldn't resend that link. Check the email address and try again."
      : "We couldn't send that link. Check the email address and try again.";
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    rememberIntent(intent);
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
      setErrorKind("otp");
      setMessage(friendlyOtpError(error, "send"));
    } else {
      setStatus("sent");
      setCooldown(60);
    }
  }

  async function resendMagicLink() {
    if (cooldown > 0 || resending) return;
    const supabase = createClient();
    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setResending(false);
    if (error) {
      setStatus("error");
      setErrorKind("otp");
      setMessage(friendlyOtpError(error, "resend"));
    } else {
      setStatus("sent");
      setCooldown(60);
    }
  }

  async function resendSignupEmail() {
    if (cooldown > 0 || resending) return;
    const supabase = createClient();
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pwEmail.trim(),
    });
    setResending(false);
    if (error) {
      setPwStatus("error");
      setPwMessage("We couldn't resend that link. Try again in a minute.");
    } else {
      setCooldown(60);
    }
  }

  async function sendPasswordReset() {
    const target = pwEmail.trim();
    if (!target) {
      setResetStatus("error");
      setResetMessage("Enter your email address above first.");
      return;
    }
    const supabase = createClient();
    setResetStatus("sending");
    setResetMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    if (error) {
      setResetStatus("error");
      setResetMessage(
        "We couldn't send that reset link. Check the email address and try again."
      );
    } else {
      setResetStatus("sent");
    }
  }

  async function signInWithGoogle() {
    rememberIntent(intent);
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
      setErrorKind("google");
      setMessage(
        "Google sign-in didn't start. Check your connection and try again."
      );
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

  function friendlyAuthError(error: { message: string }): {
    text: string;
    resendConfirm: boolean;
  } {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed"))
      return {
        text: "This email is not confirmed yet. Check your inbox for the confirmation link, including spam, or resend it below.",
        resendConfirm: true,
      };
    if (msg.includes("invalid login credentials"))
      return {
        text: "Incorrect email or password. Try again, or use the Google button above for one-tap sign-in.",
        resendConfirm: false,
      };
    if (msg.includes("user already registered") || msg.includes("already exists"))
      return {
        text: "An account with this email already exists. Switch to the Sign in tab and try again.",
        resendConfirm: false,
      };
    if (msg.includes("password"))
      return {
        text: "Password must be at least 6 characters.",
        resendConfirm: false,
      };
    return {
      text: "We could not sign you in. Check your connection and try again, or use the Google button above.",
      resendConfirm: false,
    };
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    rememberIntent(intent);
    const supabase = createClient();
    setPwStatus("working");
    setPwMessage("");
    setPwResendConfirm(false);
    if (pwMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: pwEmail.trim(),
        password,
      });
      if (error) {
        const friendly = friendlyAuthError(error);
        setPwStatus("error");
        setPwMessage(friendly.text);
        setPwResendConfirm(friendly.resendConfirm);
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
        const friendly = friendlyAuthError(error);
        setPwStatus("error");
        setPwMessage(friendly.text);
        setPwResendConfirm(friendly.resendConfirm);
        return;
      }
      if (data.session) {
        await routeAfterPasswordAuth();
      } else {
        setPwStatus("confirm");
      }
    }
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
          {intent === "host"
            ? "Find guests for your podcast"
            : intent === "guest"
              ? "Find podcasts to appear on"
              : "Join GetOnShows"}
        </h1>
        <p className="mt-2 text-slate-600">
          {intent === "host"
            ? "Create your profile and get matched by topic, style, and audience."
            : intent === "guest"
              ? "Create your profile and get discovered by the right hosts."
              : "Create your profile and find your next great conversation."}
        </p>

        {linkError && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <p className="text-sm font-semibold text-amber-900">
              That sign-in link didn&apos;t work.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Links expire quickly and work only once. Enter your email below
              for a fresh link, or continue with Google instead.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={status === "sending"}
          className="tap-target relative mt-8 w-full rounded-xl border-2 border-navy-800 bg-white px-6 font-semibold text-navy-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          Continue with Google
          <span className="absolute -top-3 right-4 rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
            Fastest
          </span>
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          One tap, no waiting on an email.
        </p>

        {!showPassword && (
          <>
            <div className="my-6 flex items-center gap-3 text-sm text-slate-500">
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
              or
              <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            </div>

            {status === "sent" ? (
          <div
            role="status"
            className="rounded-2xl bg-brand-light p-5 ring-1 ring-brand/30"
          >
            <h2 className="font-semibold text-navy-900">Check your inbox</h2>
            <p className="mt-1 text-slate-700">
              We sent a sign-in link to <strong>{email.trim()}</strong>. It
              expires soon and works once. Open it on this device. Don&apos;t
              see it? Check your spam or promotions folder.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={resendMagicLink}
                disabled={cooldown > 0 || resending}
                className="tap-target font-semibold text-brand-dark underline disabled:text-slate-400 disabled:no-underline"
              >
                {resending
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend link (${cooldown}s)`
                    : "Resend link"}
              </button>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="tap-target font-semibold text-brand-dark underline"
              >
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-4">
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
              <p className="mt-1 text-xs text-slate-500">
                Use an inbox you can open on this device right now.
              </p>
            </div>
            {status === "error" && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200"
              >
                <p className="text-sm font-medium text-red-800">{message}</p>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="tap-target mt-1 text-sm font-semibold text-brand-dark underline"
                >
                  {errorKind === "google"
                    ? "Try Google again"
                    : "Skip the wait, continue with Google instead"}
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="tap-target w-full rounded-xl bg-navy-800 px-6 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Continue with email"}
            </button>
          </form>
        )}
          </>
        )}

        <div className="mt-8 border-t border-slate-200 pt-6">
          {!showPassword ? (
            <button
              type="button"
              onClick={enterPasswordMode}
              className="tap-target w-full text-center text-sm font-semibold text-brand-dark underline"
            >
              Prefer a password? Sign in with a password instead
            </button>
          ) : (
            <section aria-label="Email and password">
              <h2 className="mb-3 text-lg font-semibold text-navy-900">
                {pwMode === "signin"
                  ? "Sign in with your password"
                  : "Create your account with a password"}
              </h2>
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
                  <h2 className="font-semibold text-navy-900">
                    Check your inbox
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    We sent a confirmation link to{" "}
                    <strong>{pwEmail.trim()}</strong>. Click it, then sign in
                    with your new password. Don&apos;t see it? Check your spam
                    or promotions folder.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <button
                      type="button"
                      onClick={resendSignupEmail}
                      disabled={cooldown > 0 || resending}
                      className="tap-target text-sm font-semibold text-brand-dark underline disabled:text-slate-400 disabled:no-underline"
                    >
                      {resending
                        ? "Sending…"
                        : cooldown > 0
                          ? `Resend link (${cooldown}s)`
                          : "Resend link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPwMode("signin");
                        setPwStatus("idle");
                      }}
                      className="tap-target text-sm font-semibold text-brand-dark underline"
                    >
                      Back to sign in
                    </button>
                  </div>
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
                        pwMode === "signin"
                          ? "current-password"
                          : "new-password"
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
                    {pwMode === "signin" && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={sendPasswordReset}
                          disabled={resetStatus === "sending"}
                          className="tap-target text-sm font-semibold text-brand-dark underline disabled:text-slate-400 disabled:no-underline"
                        >
                          {resetStatus === "sending"
                            ? "Sending…"
                            : "Forgot password?"}
                        </button>
                      </div>
                    )}
                    {resetStatus === "sent" && (
                      <p
                        role="status"
                        className="mt-2 text-sm font-medium text-teal-700"
                      >
                        We sent a password reset link to{" "}
                        <strong>{pwEmail.trim()}</strong>. It expires soon.
                      </p>
                    )}
                    {resetStatus === "error" && (
                      <p role="alert" className="mt-2 text-sm text-red-700">
                        {resetMessage}
                      </p>
                    )}
                  </div>
                  {pwStatus === "error" && (
                    <div
                      role="alert"
                      className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200"
                    >
                      <p className="text-sm font-medium text-red-800">
                        {pwMessage}
                      </p>
                      {pwResendConfirm ? (
                        <button
                          type="button"
                          onClick={resendSignupEmail}
                          disabled={cooldown > 0 || resending}
                          className="tap-target mt-1 text-sm font-semibold text-brand-dark underline disabled:text-slate-400 disabled:no-underline"
                        >
                          {resending
                            ? "Sending…"
                            : cooldown > 0
                              ? `Resend confirmation (${cooldown}s)`
                              : "Resend confirmation email"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={signInWithGoogle}
                          className="tap-target mt-1 text-sm font-semibold text-brand-dark underline"
                        >
                          Skip the wait, continue with Google instead
                        </button>
                      )}
                    </div>
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
              <button
                type="button"
                onClick={leavePasswordMode}
                className="tap-target mt-4 w-full text-center text-sm font-semibold text-slate-500 underline"
              >
                Back to email link
              </button>
            </section>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
