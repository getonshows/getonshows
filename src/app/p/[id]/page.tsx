import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OneSheet from "@/components/OneSheet";
import { computeBadges } from "@/lib/badges";
import Collaborations from "@/components/Collaborations";
import RatingsSummary, { type RatingSummary } from "@/components/RatingsSummary";
import type {
  Collaboration,
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  Role,
  TopicRow,
} from "@/lib/types";

const SITE_URL = "https://www.getonshows.com";

/**
 * Rich unfurls for shared profiles: name, headline, and photo travel with
 * the link into iMessage, Facebook, and anywhere else it gets pasted.
 * Unpublished profiles fall back to the generic site title.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name,title,bio,photo_url")
    .eq("id", id)
    .eq("state", "published")
    .maybeSingle();
  const p = (data ?? null) as {
    display_name: string | null;
    title: string | null;
    bio: string | null;
    photo_url: string | null;
  } | null;
  if (!p) return { title: "GetOnShows" };
  const name = p.display_name ?? "Member";
  const title = `${name} | GetOnShows`;
  const description = (
    p.title ??
    p.bio ??
    "Find this member on GetOnShows, the podcast guest and host matchmaker."
  ).slice(0, 160);
  const images = p.photo_url ? [{ url: p.photo_url }] : [];
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/p/${id}`,
      type: "profile",
      images,
    },
    twitter: {
      card: images.length > 0 ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

/**
 * Public profile page. This is the share/QR destination: anyone with the
 * link sees the published one-sheet, earned badges, and an invite to join.
 * No sign-in required.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("state", "published")
    .maybeSingle();
  const p = (profile ?? null) as ProfileRow | null;
  if (!p) notFound();

  const [{ data: host }, { data: guest }, { data: pts }, { data: stats }, { data: collabs }, { data: roleData }, { data: ratingsData }] =
    await Promise.all([
      supabase
        .from("host_profiles")
        .select("*")
        .eq("profile_id", p.id)
        .maybeSingle(),
      supabase
        .from("guest_profiles")
        .select("*")
        .eq("profile_id", p.id)
        .maybeSingle(),
      supabase.from("profile_topics").select("topic_id").eq("profile_id", p.id),
      supabase.rpc("profile_public_stats", { pid: p.id }),
      supabase.rpc("profile_collaborations", { pid: p.id }),
      supabase.rpc("profile_role", { pid: p.id }),
      supabase.rpc("profile_ratings", { pid: p.id }),
    ]);
  const hostModule = (host ?? null) as HostModuleRow | null;
  const guestModule = (guest ?? null) as GuestModuleRow | null;
  const canonicalRole =
    roleData === "host" || roleData === "guest" || roleData === "dual"
      ? (roleData as Role)
      : null;

  const topicIds = ((pts ?? []) as { topic_id: string }[]).map(
    (r) => r.topic_id
  );
  let topics: TopicRow[] = [];
  if (topicIds.length > 0) {
    const { data } = await supabase
      .from("topics")
      .select("id,label,slug,parent_id,is_custom")
      .in("id", topicIds)
      .order("label");
    topics = (data ?? []) as TopicRow[];
  }

  const s = (stats ?? null) as {
    bookings: number;
    bookings_upcoming: number;
    bookings_completed: number;
    pitches: number;
    published: boolean;
  } | null;
  const badges = computeBadges({
    published: true,
    pitchesSent: s?.pitches ?? 0,
    bookings: s?.bookings ?? 0,
  }).filter((b) => b.earned);
  const collaborations = ((collabs ?? []) as Collaboration[]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-paper">
      <nav
        aria-label="Main"
        className="flex items-center justify-between px-4 py-4"
      >
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="GetOnShows"
            width={120}
            height={77}
            priority
          />
        </Link>
        <Link
          href="/login"
          className="tap-target rounded-xl bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-900"
        >
          Log in
        </Link>
      </nav>
      <main className="flex-1 space-y-5 px-4 pb-10">
        <OneSheet
          profile={p}
          hostModule={hostModule}
          guestModule={guestModule}
          topics={topics}
          role={canonicalRole}
        />

        {badges.length > 0 && (
          <section
            aria-label="Achievements"
            className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Achievements
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {badges.map((b) => (
                <li
                  key={b.id}
                  title={b.description}
                  className="rounded-full border border-brand bg-brand-light/40 px-3 py-1.5 text-xs font-semibold text-navy-900"
                >
                  ★ {b.label}
                </li>
              ))}
            </ul>
            {(s?.bookings_completed ?? 0) > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                {s?.bookings_completed}{" "}
                {s?.bookings_completed === 1 ? "booking" : "bookings"}{" "}
                completed on GetOnShows.
              </p>
            )}
            {(s?.bookings_upcoming ?? 0) > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                {s?.bookings_upcoming}{" "}
                {s?.bookings_upcoming === 1 ? "upcoming booking" : "upcoming bookings"}{" "}
                on GetOnShows.
              </p>
            )}
          </section>
        )}

        <Collaborations items={collaborations} />

        <RatingsSummary ratings={(ratingsData ?? null) as RatingSummary | null} />

        <section className="rounded-2xl bg-navy-800 p-6 text-center text-white">
          <h2 className="text-xl font-bold">
            Want to reach out to {p.display_name?.split(" ")[0] ?? "them"}?
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Join GetOnShows to send a pitch, or browse more people worth
            talking to.
          </p>
          <Link
            href="/login"
            className="tap-target mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 py-3 font-bold text-white hover:bg-brand-dark"
          >
            Join free
          </Link>
        </section>
      </main>
    </div>
  );
}
