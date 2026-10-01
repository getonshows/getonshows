import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/profile");

  return (
    <div className="flex min-h-dvh flex-col bg-navy-900 text-white">
      <header className="mx-auto w-full max-w-xl px-6 pb-10 pt-14">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          GetOnShows
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight">
          Get booked on podcasts. Find guests worth hearing.
        </h1>
        <p className="mt-4 text-lg text-navy-100">
          A lean matchmaking app for podcast hosts and guests: build a credible
          profile, see ranked fits with reasons, and send pitches that show
          their work — without turning anyone&apos;s inbox into spam.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="tap-target inline-flex items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white transition hover:bg-brand-dark"
          >
            Get started — it&apos;s free
          </Link>
          <p className="text-sm text-navy-200">
            Sign in with email or Google. No password, no spam, no audience-size
            leaderboard.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-16">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-navy-300">
          How it works
        </h2>
        <ol className="mt-4 space-y-4">
          {[
            {
              title: "Create a credible profile",
              body: "Host, guest, or both. Topics, format, proof links — the evidence that earns a reply.",
            },
            {
              title: "See ranked matches",
              body: "Every suggestion explains itself: shared topics, matching format, why it fits.",
            },
            {
              title: "Pitch, then book off-platform",
              body: "Structured first messages with rate limits. Interested? Book on your own calendar link.",
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl bg-navy-800 p-5 ring-1 ring-white/10"
            >
              <p className="text-sm font-semibold text-brand">
                Step {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-navy-100">{step.body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="mx-auto w-full max-w-xl px-6 pb-10 text-sm text-navy-300">
        <p>
          Currently in private pilot. Built for independent podcasters — not
          celebrity booking.
        </p>
      </footer>
    </div>
  );
}
