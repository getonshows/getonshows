import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function SectionHeading({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
        {kicker}
      </p>
      <h2 className="mt-2 text-2xl font-bold">{title}</h2>
      {body && <p className="mt-2 text-navy-100">{body}</p>}
    </div>
  );
}

const MATCH_REASONS = [
  "Shared topic: artificial intelligence",
  "Long-form conversational format",
  "Toronto-area recording",
  "Guest has published work on AI adoption",
  "Host recently recorded episodes about technology",
  "Both prefer in-person interviews",
];

const VALUE_PROPS = [
  {
    title: "Find relevant people",
    body: "Not massive directories. A short list of people who actually fit what you're making.",
  },
  {
    title: "Understand the match",
    body: "See why someone fits — shared topics, format, availability — before you contact them.",
  },
  {
    title: "Send thoughtful pitches",
    body: "Structured first messages, rate-limited. No mass messaging, no inbox spam.",
  },
  {
    title: "Book however you already work",
    body: "Interested? Take it to your calendar, your email, whatever you prefer.",
  },
];

const EXAMPLE_PROFILES = [
  {
    kind: "Host",
    name: "BeSquare by pSquare",
    meta: "Long-form conversation • In person & remote • Toronto",
    tags: ["Technology", "Business", "Science"],
  },
  {
    kind: "Guest",
    name: "Dr. Jane Smith",
    meta: "AI researcher • Toronto",
    tags: ["Machine learning", "Future of work", "AI agents"],
  },
  {
    kind: "Host",
    name: "The Founder Files",
    meta: "Weekly interview • Remote",
    tags: ["Startups", "Venture capital"],
  },
  {
    kind: "Guest",
    name: "Marcus Chen",
    meta: "Chef & food writer • Vancouver",
    tags: ["Food culture", "Restaurants"],
  },
];

const FAQS = [
  {
    q: "Are there actually podcasts here?",
    a: "Yes. GetOnShows is in private pilot with real independent podcasters — hosts and guests who are actively recording. Early members help shape how matching, pitching, and discovery work.",
  },
  {
    q: "Will my email be exposed?",
    a: "No. Your email address is never shown publicly. Conversations happen inside GetOnShows, and you share contact details only with people you choose.",
  },
  {
    q: "Will I get spammed with pitches?",
    a: "No. There is no mass messaging — pitches are structured and rate-limited, and you only hear from people whose profile fits what you're looking for.",
  },
  {
    q: "Is this another pay-to-pitch platform?",
    a: "No. It's free during the private beta, and there is no fee to send or receive pitches.",
  },
  {
    q: "How does matching work?",
    a: "We look at topic overlap, expertise, show format, location, availability, and what each person is actually looking for — not follower counts. Every suggestion explains itself.",
  },
  {
    q: "What kinds of shows are here?",
    a: "Independent podcasts across technology, business, science, culture, food, and more. Built first for independent podcasters, experts, and creators.",
  },
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/profile");

  return (
    <div className="flex min-h-dvh flex-col bg-navy-900 text-white">
      {/* Hero */}
      <header className="mx-auto w-full max-w-2xl px-6 pb-12 pt-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          GetOnShows
        </p>
        <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-navy-800 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-navy-100 ring-1 ring-white/15">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-brand" />
          Private beta — join the founding community
        </p>
        <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
          Get on the right podcasts.
          <br />
          Or find the right guest for yours.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-navy-100">
          GetOnShows helps podcast hosts and interesting people discover each
          other based on topics, expertise, format, and real compatibility —
          not follower counts.
        </p>
        <div className="mx-auto mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
          <Link
            href="/login?intent=guest"
            className="tap-target inline-flex items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white transition hover:bg-brand-dark"
          >
            Find podcasts for me
          </Link>
          <Link
            href="/login?intent=host"
            className="tap-target inline-flex items-center justify-center rounded-xl bg-white/10 px-6 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20"
          >
            Find guests for my show
          </Link>
        </div>
        <p className="mt-4 text-sm text-navy-200">
          Free during private beta. No credit card.
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        {/* Match example */}
        <section aria-labelledby="match-heading" className="mt-4">
          <SectionHeading
            kicker="See it work"
            title="Every match explains itself"
          />
          <div className="mt-4 rounded-2xl bg-navy-800 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <p
                id="match-heading"
                className="text-sm font-bold uppercase tracking-[0.15em] text-brand"
              >
                92% match
              </p>
              <p className="text-xs text-navy-300">Illustrative example</p>
            </div>
            <p className="mt-2 text-lg font-semibold">
              BeSquare by pSquare <span aria-hidden="true">↔</span> Dr. Jane
              Smith
            </p>
            <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.15em] text-navy-300">
              Why this is a strong match
            </h3>
            <ul className="mt-2 space-y-1.5">
              {MATCH_REASONS.map((r) => (
                <li key={r} className="flex items-start gap-2 text-navy-100">
                  <span aria-hidden="true" className="font-bold text-brand">
                    ✓
                  </span>
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl bg-navy-900/60 p-4 ring-1 ring-white/10">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-navy-300">
                Suggested conversation
              </h3>
              <p className="mt-1 italic text-navy-100">
                “What happens when AI stops being a tool and starts doing
                parts of your job?”
              </p>
            </div>
            <Link
              href="/login"
              className="tap-target mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white transition hover:bg-brand-dark"
            >
              Find your matches
            </Link>
          </div>
        </section>

        {/* Value props */}
        <section aria-labelledby="better-heading" className="mt-14">
          <div id="better-heading">
            <SectionHeading
              kicker="Why GetOnShows"
              title="Better than cold outreach"
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {VALUE_PROPS.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl bg-navy-800 p-5 ring-1 ring-white/10"
              >
                <h3 className="font-semibold">{v.title}</h3>
                <p className="mt-1 text-sm text-navy-100">{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How matching works */}
        <section aria-labelledby="how-heading" className="mt-14">
          <div id="how-heading">
            <SectionHeading
              kicker="How matching works"
              title="Discover your strongest matches"
              body="We look at topic overlap, expertise, show format, location, availability, and what each person is actually looking for — not follower counts, fame, or money. Every suggestion shows its work, so you know exactly why it fits."
            />
          </div>
        </section>

        {/* Example profiles */}
        <section aria-labelledby="profiles-heading" className="mt-14">
          <div id="profiles-heading">
            <SectionHeading
              kicker="The network"
              title="Example profiles"
              body="A taste of who's here. Illustrative examples — real profiles are visible to members."
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EXAMPLE_PROFILES.map((p) => (
              <article
                key={p.name}
                className="rounded-2xl bg-navy-800 p-5 ring-1 ring-white/10"
              >
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
                  {p.kind}
                </p>
                <h3 className="mt-1 font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-navy-200">{p.meta}</p>
                <p className="mt-2 text-sm text-navy-100">
                  {p.tags.join(" • ")}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section aria-labelledby="trust-heading" className="mt-14">
          <div id="trust-heading">
            <SectionHeading
              kicker="Why trust it"
              title="Built for real conversations, not follower chasing"
              body="We're building this with real independent podcasters. GetOnShows is currently in private pilot — early members help shape how matching, pitching, and discovery work."
            />
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {[
              "No credit card",
              "No public email address",
              "No mass messaging",
              "No audience-size leaderboard",
            ].map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-2 rounded-full bg-navy-800 px-4 py-2 text-sm font-medium text-navy-100 ring-1 ring-white/15"
              >
                <span aria-hidden="true" className="font-bold text-brand">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="mt-14">
          <div id="faq-heading">
            <SectionHeading kicker="Questions" title="FAQ" />
          </div>
          <dl className="mt-4 space-y-3">
            {FAQS.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl bg-navy-800 p-5 ring-1 ring-white/10"
              >
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 text-sm text-navy-100">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Final CTA */}
        <section
          aria-labelledby="cta-heading"
          className="mt-14 rounded-2xl bg-navy-800 p-8 text-center ring-1 ring-white/10"
        >
          <h2 id="cta-heading" className="text-2xl font-bold">
            Join the founding community
          </h2>
          <p className="mx-auto mt-2 max-w-md text-navy-100">
            Create your profile, see who fits, and start conversations worth
            having.
          </p>
          <Link
            href="/login"
            className="tap-target mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white transition hover:bg-brand-dark sm:w-auto"
          >
            Get started — free during private beta
          </Link>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-2xl px-6 pb-10 text-center text-sm text-navy-300">
        <p>Built first for independent podcasters, experts, and creators.</p>
      </footer>
    </div>
  );
}
