import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HeroMatch from "@/components/landing/HeroMatch";
import Ticker from "@/components/landing/Ticker";
import Waveform from "@/components/landing/Waveform";
import Reveal from "@/components/landing/Reveal";
import ProfileGrid, {
  type ExampleProfile,
} from "@/components/landing/ProfileGrid";

export const metadata = {
  title: "GetOnShows: Get booked on podcasts. Book great guests.",
  description:
    "GetOnShows matches podcast hosts with guests worth interviewing, based on topics, expertise, format, and real compatibility. Free to join.",
};

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
    <div className="mx-auto max-w-2xl text-center">
      <Reveal>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand">
          {kicker}
        </p>
      </Reveal>
      <Reveal delay={100}>
        <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
          {title}
        </h2>
      </Reveal>
      {body && (
        <Reveal delay={200}>
          <p className="mt-3 text-lg text-white/60">{body}</p>
        </Reveal>
      )}
    </div>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const CARD_REASONS = [
  "AI & future of work",
  "Long-form conversation",
  "In-person · Toronto",
  "Guest has relevant published work",
];

const VALUE_PROPS = [
  {
    title: "Find relevant people",
    body: "Not massive directories. A short list of people who actually fit what you're making.",
    icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  },
  {
    title: "Understand the match",
    body: "See why someone fits (shared topics, format, availability) before you contact them.",
    icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18.75 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L22.5 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z",
  },
  {
    title: "Send thoughtful pitches",
    body: "Thoughtful first messages. No mass messaging, no inbox spam.",
    icon: "M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5",
  },
  {
    title: "Book however you already work",
    body: "Interested? Take it to your calendar, your email, whatever you prefer.",
    icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  },
];

const EXAMPLE_PROFILES: ExampleProfile[] = [
  {
    id: "besquare",
    kind: "Host",
    name: "BeSquare by pSquare",
    role: "Podcast",
    location: "Toronto",
    image: "/examples/besquare-cover.jpg",
    tags: ["AI", "Science", "Business"],
    hook: "What happens when AI stops being a tool and starts doing parts of your job?",
    matchId: "jane-smith",
    matchName: "Dr. Jane Smith",
    matchImage: "/examples/jane-smith.jpg",
  },
  {
    id: "jane-smith",
    kind: "Guest",
    name: "Dr. Jane Smith",
    role: "AI researcher",
    location: "Toronto",
    image: "/examples/jane-smith.jpg",
    tags: ["Machine learning", "Future of work", "AI agents"],
    hook: "Will AI replace knowledge workers, or make them dramatically more powerful?",
    matchId: "besquare",
    matchName: "BeSquare by pSquare",
    matchImage: "/examples/besquare-cover.jpg",
  },
  {
    id: "founder-files",
    kind: "Host",
    name: "The Founder Files",
    role: "Podcast",
    location: "Remote",
    image: "/examples/founder-files-cover.jpg",
    tags: ["Startups", "Venture capital"],
    hook: "Why do most startups die of indifference, not competition?",
    matchId: "david-okafor",
    matchName: "David Okafor",
    matchImage: "/examples/david-okafor.jpg",
  },
  {
    id: "marcus-chen",
    kind: "Guest",
    name: "Marcus Chen",
    role: "Chef & food writer",
    location: "Vancouver",
    image: "/examples/marcus-chen.jpg",
    tags: ["Food culture", "Restaurants"],
    hook: "What does running a kitchen teach you about running anything?",
    matchId: "besquare",
    matchName: "BeSquare by pSquare",
    matchImage: "/examples/besquare-cover.jpg",
  },
];

const SURPRISES = [
  {
    pairing: "A neuroscientist × a founder podcast",
    why: "Their research on decision-making could completely change a conversation about entrepreneurship.",
  },
  {
    pairing: "A Great Lakes researcher × a business show",
    why: "Their work reveals the economics behind shoreline development and water quality.",
  },
  {
    pairing: "A hospice nurse × a business show",
    why: "Nobody understands what people value at the end of life. That's a conversation about success no CEO interview can deliver.",
  },
];

const FAQS = [
  {
    q: "What kinds of podcasts are on GetOnShows?",
    a: "Independent shows across technology, business, science, culture, food, and more: hosts looking for guests who will make a great episode, and guests with something worth hearing.",
  },
  {
    q: "Will my email be exposed?",
    a: "No. Your email address is never shown publicly. Conversations happen inside GetOnShows, and you share contact details only with people you choose.",
  },
  {
    q: "Will I get spammed with pitches?",
    a: "No. There is no mass messaging. You only hear from people whose profile genuinely fits what you're looking for.",
  },
  {
    q: "Is this another pay-to-pitch platform?",
    a: "No. Joining is free, and there is never a fee to send or receive a pitch.",
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/profile");

  // Invite banner: resolve ?ref=CODE to the inviter's name.
  let inviterName: string | null = null;
  const cleanRef = (ref ?? "").trim().slice(0, 80);
  if (cleanRef) {
    const { data } = await supabase.rpc("resolve_invite", { code: cleanRef });
    inviterName = (data as string | null) ?? null;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-navy-900 text-white">
      {/* Hero: the match, alive */}
      <header className="relative overflow-hidden">
        <nav
          aria-label="Main"
          className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5"
        >
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt="GetOnShows"
              width={36}
              height={24}
              priority
            />
            <span className="text-lg font-extrabold tracking-tight text-white">
              GetOnShows
            </span>
          </Link>
          <Link
            href="/login"
            className="tap-target rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20"
          >
            Log in
          </Link>
        </nav>
        {inviterName && (
          <p
            role="status"
            className="relative z-10 mx-auto mt-2 w-fit max-w-6xl rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/25"
          >
            ✉️ {inviterName} invited you to GetOnShows
          </p>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
          <div className="absolute -left-24 top-48 h-64 w-64 rounded-full bg-[#FF8A5C]/10 blur-3xl" />
          <div className="absolute -right-24 top-72 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-16 text-center sm:pt-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            Find podcasts{" "}
            <span className="bg-gradient-to-r from-[#FFB59E] via-[#FF7A59] to-brand bg-clip-text text-transparent">
              worth appearing on.
            </span>
            <br />
            Find guests{" "}
            <span className="bg-gradient-to-r from-[#FFB59E] via-[#FF7A59] to-brand bg-clip-text text-transparent">
              worth interviewing.
            </span>
          </h1>

          <HeroMatch />

          <div className="mx-auto mt-10 grid max-w-lg gap-3 sm:grid-cols-2">
            <Link
              href="/login?intent=guest"
              className="tap-target inline-flex items-center justify-center rounded-xl bg-brand px-6 font-bold text-white transition hover:bg-brand-dark"
            >
              Find podcasts
            </Link>
            <Link
              href="/login?intent=host"
              className="tap-target inline-flex items-center justify-center rounded-xl bg-white/10 px-6 font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20"
            >
              Find guests
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/50">
            Free to join. No credit card.
          </p>
        </div>
      </header>

      <Ticker />

      <main className="flex-1">
        {/* The match card: the star of the brand */}
        <section
          aria-labelledby="match-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24"
        >
          <SectionHeading
            kicker="How matching works"
            title="Every match explains itself."
            body="No black box. Every introduction shows exactly why these two people should talk, and what they'd talk about."
          />

          <Reveal delay={150} className="mt-12">
            <div className="relative mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_90px_-24px_rgba(255,90,54,0.4)] sm:p-10">
              <p
                id="match-heading"
                className="text-center text-xs font-extrabold uppercase tracking-[0.3em] text-brand"
              >
                Strong match
              </p>

              <div className="mt-8 flex items-start justify-between gap-4">
                <div className="flex flex-1 flex-col items-center text-center">
                  <Image
                    src="/examples/besquare-cover.jpg"
                    alt="BeSquare podcast artwork"
                    width={192}
                    height={192}
                    className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/20 sm:h-24 sm:w-24"
                  />
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                    Host
                  </p>
                  <p className="font-bold">BeSquare</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    AI · Science · Business
                  </p>
                </div>
                <div className="flex flex-1 flex-col items-center text-center">
                  <Image
                    src="/examples/jane-smith.jpg"
                    alt="Dr. Jane Smith"
                    width={192}
                    height={192}
                    className="h-20 w-20 rounded-full object-cover ring-1 ring-white/20 sm:h-24 sm:w-24"
                  />
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                    Guest
                  </p>
                  <p className="font-bold">Dr. Jane Smith</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    AI researcher · Toronto
                  </p>
                </div>
              </div>

              <div className="my-7 flex items-center gap-3 sm:gap-4">
                <Waveform bars={28} className="h-7 min-w-0 flex-1 text-brand/60" />
                <span className="shrink-0 rounded-full border border-brand/50 bg-brand/15 px-4 py-1.5 text-lg font-extrabold text-brand">
                  92%
                </span>
                <Waveform bars={28} className="h-7 min-w-0 flex-1 text-brand/60" />
              </div>

              <ul className="space-y-2.5" aria-label="Why this is a strong match">
                {CARD_REASONS.map((r, i) => (
                  <Reveal key={r} as="li" delay={i * 130}>
                    <span className="flex items-center gap-3 text-sm text-white/85 sm:text-base">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15">
                        <Check className="h-3.5 w-3.5 text-brand" />
                      </span>
                      {r}
                    </span>
                  </Reveal>
                ))}
              </ul>

              <div className="mt-7 rounded-2xl bg-navy-950/70 p-5 ring-1 ring-white/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
                  Potential conversation
                </p>
                <p className="mt-2 text-lg font-bold leading-snug">
                  “What AI can actually do in 2026, without the hype.”
                </p>
              </div>

              <div className="mt-7 text-center">
                <Link
                  href="/login?intent=guest"
                  className="group/btn tap-target inline-flex items-center justify-center rounded-xl bg-brand px-8 py-3.5 font-bold text-white transition hover:bg-brand-dark"
                >
                  <span className="grid">
                    <span className="col-start-1 row-start-1 transition-opacity duration-200 group-hover/btn:opacity-0">
                      Find my matches
                    </span>
                    <span className="col-start-1 row-start-1 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/btn:opacity-100">
                      Show me who I should talk to →
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Value props */}
        <section
          aria-labelledby="better-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20"
        >
          <div id="better-heading">
            <SectionHeading
              kicker="How it's different"
              title="Better than searching and guessing"
              body="Directories hand you endless lists, and hours of guessing who might say yes. GetOnShows identifies people who are actually a strong fit, and explains exactly why."
            />
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            {VALUE_PROPS.map((v, i) => (
              <Reveal key={v.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25">
                  <div className="inline-flex rounded-xl bg-brand/15 p-2.5">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-6 w-6 text-brand"
                      aria-hidden="true"
                    >
                      <path
                        d={v.icon}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{v.title}</h3>
                  <p className="mt-1.5 text-white/60">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Host promise */}
        <section
          aria-labelledby="host-promise-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20"
        >
          <div id="host-promise-heading">
            <SectionHeading
              kicker="For hosts"
              title="Stop searching for guests."
              body="Tell us the conversations you want to have: the topics, the expertise, the stories. GetOnShows does the searching, and shows you exactly why each person fits."
            />
          </div>
          <Reveal delay={150} className="mt-10">
            <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-brand">
                  Your brief
                </p>
              </div>
              <p className="mt-3 text-lg italic leading-relaxed text-white/85">
                “I&apos;m looking for founders and researchers with contrarian
                takes on AI, climate tech, and the future of work. Prefer
                remote conversations, around 45 minutes.”
              </p>
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="flex items-center gap-4">
                  <Image
                    src="/examples/david-okafor.jpg"
                    alt="David Okafor"
                    width={128}
                    height={128}
                    className="h-16 w-16 rounded-full object-cover ring-1 ring-white/15"
                  />
                  <div className="min-w-0">
                    <p className="text-lg font-bold">David Okafor</p>
                    <span className="mt-1 inline-block whitespace-nowrap rounded-full border border-brand/40 bg-brand/10 px-3 py-0.5 text-sm font-bold text-brand">
                      Strong match
                    </span>
                  </div>
                </div>
                <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                  Why he fits
                </h3>
                <p className="mt-1.5 text-white/75">
                  Climate-tech founder, has spoken publicly about carbon
                  markets, comfortable with debate, suited to 45-minute remote
                  conversation.
                </p>
                <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                  Potential episode
                </h3>
                <p className="mt-1.5 text-xl font-bold leading-snug">
                  “Carbon Offsets Are Broken. Here&apos;s What Actually Works.”
                </p>
                <div className="mt-5 rounded-2xl bg-navy-950/70 p-5 ring-1 ring-white/10">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                    Suggested opening message
                  </h3>
                  <p className="mt-2 italic leading-relaxed text-white/80">
                    “Hi David, I&apos;m recording an episode on what actually
                    works in carbon markets, beyond the greenwashing debate.
                    Your contrarian take and founder experience would be
                    perfect. Open to a 45-minute remote conversation next
                    week?”
                  </p>
                </div>
              </div>
              <Link
                href="/login?intent=host"
                className="tap-target mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 py-3.5 font-bold text-white transition hover:bg-brand-dark"
              >
                Find guests
              </Link>
            </div>
          </Reveal>
        </section>

        {/* Surprise: the discovery value */}
        <section
          aria-labelledby="surprise-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24"
        >
          <div id="surprise-heading">
            <SectionHeading
              kicker="The discovery engine"
              title="You wouldn't have searched for them."
              body="Google finds who you're already looking for. GetOnShows finds the person you didn't know you should be looking for."
            />
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SURPRISES.map((s, i) => (
              <Reveal key={s.pairing} delay={i * 130}>
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-brand/40">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-brand">
                    Unexpected match
                  </p>
                  <p className="mt-3 text-lg font-bold leading-snug">
                    {s.pairing}
                  </p>
                  <Waveform
                    bars={24}
                    className="my-5 h-5 w-full text-brand/40"
                  />
                  <p className="text-sm font-bold text-white/80">Why?</p>
                  <p className="mt-1.5 leading-relaxed text-white/60">{s.why}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Example profiles */}
        <section
          aria-labelledby="profiles-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20"
        >
          <div id="profiles-heading">
            <SectionHeading
              kicker="The network"
              title="Here's what a GetOnShows profile looks like."
              body="Real people, real conversations. Hover a profile to see who they'd match with."
            />
          </div>
          <Reveal delay={150} className="mt-10">
            <ProfileGrid profiles={EXAMPLE_PROFILES} />
          </Reveal>
        </section>

        {/* Trust */}
        <section
          aria-labelledby="trust-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20"
        >
          <div id="trust-heading">
            <SectionHeading
              kicker="Why trust it"
              title="Built for real conversations, not follower chasing"
              body="GetOnShows is where independent podcasters, experts, and creators find each other. Real profiles, real people. No scraped directories, no fake listings, no noise."
            />
          </div>
          <Reveal delay={150}>
            <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
              {[
                "No credit card",
                "No public email address",
                "No mass messaging",
                "Every pitch tied to a genuine match",
                "No audience-size leaderboard",
              ].map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80"
                >
                  <Check className="h-4 w-4 text-brand" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* FAQ */}
        <section
          aria-labelledby="faq-heading"
          className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20"
        >
          <div id="faq-heading">
            <SectionHeading kicker="Questions" title="FAQ" />
          </div>
          <dl className="mx-auto mt-8 max-w-2xl space-y-3">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 80}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <dt className="font-bold">{f.q}</dt>
                  <dd className="mt-1.5 text-white/60">{f.a}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-4">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-10 text-center shadow-[0_0_110px_-24px_rgba(255,90,54,0.5)] sm:p-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <div className="absolute -bottom-24 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
              </div>
              <div className="relative">
                <h2 className="text-3xl font-extrabold sm:text-4xl">
                  Find your next great conversation
                </h2>
                <p className="mx-auto mt-3 max-w-md text-lg text-white/60">
                  Create your profile, see who fits, and start conversations
                  worth having.
                </p>
                <Link
                  href="/login"
                  className="tap-target mt-8 inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-brand px-10 py-4 text-lg font-bold text-white transition hover:bg-brand-dark"
                >
                  Get started, it&apos;s free
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-center text-sm text-white/35">
        <p>Built first for independent podcasters, experts, and creators.</p>
        <p className="mt-2">
          <Link href="/privacy" className="underline hover:text-white/60">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}
