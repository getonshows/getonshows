import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rankCandidates, type Candidate } from "@/lib/ranking";
import DiscoveryFilters from "@/components/DiscoveryFilters";
import MatchCard from "@/components/MatchCard";
import type {
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  Role,
  TopicRow,
} from "@/lib/types";

interface SearchParams {
  q?: string;
  topics?: string;
  medium?: string;
  session?: string;
  view?: string;
  loc?: string;
}

interface ProfileJoinRow extends ProfileRow {
  host_profiles: HostModuleRow | null;
  guest_profiles: GuestModuleRow | null;
  profile_topics: { topic_id: string }[];
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <h2 className="text-lg font-bold text-navy-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = ((userRow as { role: string } | null)?.role ?? "undecided") as
    | Role
    | "undecided";
  if (role === "undecided") redirect("/onboarding");

  // Dual-role users toggle which side of the marketplace they browse.
  const viewing: "guests" | "shows" =
    role === "dual"
      ? sp.view === "shows"
        ? "shows"
        : "guests"
      : role === "host"
        ? "guests"
        : "shows";

  // Viewer's own profile: excluded from results, used for ranking.
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const viewer = (ownProfile ?? null) as ProfileRow | null;

  const { data: topicRows } = await supabase
    .from("topics")
    .select("id,label,slug,parent_id,is_custom")
    .eq("is_custom", false)
    .order("label", { ascending: true });
  const topics = (topicRows ?? []) as TopicRow[];
  const topicById = new Map(topics.map((t) => [t.id, t]));

  if (!viewer) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <h1 className="text-2xl font-bold text-navy-900">Discover</h1>
        <EmptyState
          title="Build your profile first"
          body="Matching ranks other profiles against yours: your topics, format, and bio are what make the scores meaningful."
          action={
            <Link
              href="/profile/builder"
              className="tap-target inline-flex items-center justify-center rounded-xl bg-navy-800 px-6 py-3 font-semibold text-white hover:bg-navy-900"
            >
              Build my profile
            </Link>
          }
        />
      </div>
    );
  }

  // Blocked users (either direction) never appear in discovery.
  const { data: blockRows } = await supabase
    .from("blocks")
    .select("blocker_user_id,blocked_user_id")
    .or(`blocker_user_id.eq.${user.id},blocked_user_id.eq.${user.id}`);
  const blockedUserIds = new Set(
    ((blockRows ?? []) as { blocker_user_id: string; blocked_user_id: string }[]).map(
      (b) => (b.blocker_user_id === user.id ? b.blocked_user_id : b.blocker_user_id)
    )
  );

  // Profiles the viewer has already contacted (a conversation exists with
  // them on either side) never appear in Discover again. They live in the inbox.
  const { data: convoRows } = await supabase
    .from("conversations")
    .select("host_profile_id, guest_profile_id")
    .or(`host_profile_id.eq.${viewer.id},guest_profile_id.eq.${viewer.id}`);
  const contactedProfileIds = new Set(
    ((convoRows ?? []) as { host_profile_id: string; guest_profile_id: string }[]).map(
      (c) => (c.host_profile_id === viewer.id ? c.guest_profile_id : c.host_profile_id)
    )
  );

  // Profiles already shown to this viewer, with when they were last shown.
  // Browsing (no filters) prefers unseen profiles and backfills the
  // longest-unseen ones only when fresh faces run out.
  const { data: impressionRows } = await supabase
    .from("discovery_impressions")
    .select("profile_id, viewed_at")
    .eq("viewer_user_id", user.id);
  const seenAt = new Map(
    ((impressionRows ?? []) as { profile_id: string; viewed_at: string }[]).map(
      (r) => [r.profile_id, r.viewed_at]
    )
  );

  // Candidates: published profiles carrying the complementary module.
  const { data: rows } = await supabase
    .from("profiles")
    .select("*, host_profiles(*), guest_profiles(*), profile_topics(topic_id)")
    .eq("state", "published")
    .neq("user_id", user.id)
    .limit(200);
  const allRows = ((rows ?? []) as ProfileJoinRow[]).filter(
    (r) =>
      (viewing === "guests" ? r.guest_profiles : r.host_profiles) &&
      !blockedUserIds.has(r.user_id) &&
      !contactedProfileIds.has(r.id)
  );

  const { data: viewerPts } = await supabase
    .from("profile_topics")
    .select("topic_id")
    .eq("profile_id", viewer.id);
  const viewerTopicIds = ((viewerPts ?? []) as { topic_id: string }[]).map(
    (r) => r.topic_id
  );
  const viewerTopics = viewerTopicIds
    .map((id) => topicById.get(id))
    .filter((t): t is TopicRow => !!t);

  // Filters from the URL.
  const q = (sp.q ?? "").trim().toLowerCase();
  const filterTopicIds = new Set(
    (sp.topics ?? "").split(",").filter(Boolean)
  );
  const filterMedium = sp.medium ?? "";
  const filterSession = sp.session ?? "";
  const filterLoc = (sp.loc ?? "").trim().toLowerCase();

  const candidates: Candidate[] = [];
  for (const r of allRows) {
    const cTopics = r.profile_topics
      .map((pt) => topicById.get(pt.topic_id))
      .filter((t): t is TopicRow => !!t);

    if (filterTopicIds.size > 0) {
      const shares = cTopics.some((t) => filterTopicIds.has(t.id));
      if (!shares) continue;
    }
    if (viewing === "shows") {
      // Unspecified medium/format never excludes a show.
      const medium = r.host_profiles?.medium ?? null;
      if (
        filterMedium &&
        medium !== null &&
        medium !== "both" &&
        medium !== filterMedium
      ) {
        continue;
      }
      const format = r.host_profiles?.format ?? null;
      if (
        filterSession &&
        format !== null &&
        format !== "both" &&
        format !== filterSession
      ) {
        continue;
      }
    }
    if (q) {
      const haystack = [
        r.display_name,
        r.title,
        r.bio,
        r.location,
        r.host_profiles?.show_name,
        r.host_profiles?.guest_criteria,
        r.guest_profiles?.expertise,
        ...(r.guest_profiles?.talking_points ?? []),
        ...cTopics.map((t) => t.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    if (filterLoc && !(r.location ?? "").toLowerCase().includes(filterLoc)) {
      continue;
    }

    candidates.push({
      profile: r,
      hostModule: r.host_profiles,
      guestModule: r.guest_profiles,
      topics: cTopics,
    });
  }

  const ranked = rankCandidates({
    viewerProfile: viewer,
    viewerTopics,
    candidates,
    limit: 200,
  });

  const anyEmbeddings = ranked.some((c) => c.usedEmbedding);
  const filtersActive =
    q !== "" ||
    filterTopicIds.size > 0 ||
    filterMedium !== "" ||
    filterSession !== "" ||
    filterLoc !== "";

  // Freshness: when browsing (no filters/search), unseen profiles come first.
  // Seen profiles backfill oldest-first only when unseen faces run out, so the
  // page never goes empty but repeat logins feel new. Filtered searches are
  // intentional lookups, so they show every match.
  let visible = ranked.slice(0, 20);
  let backfilled = false;
  if (!filtersActive) {
    const unseen = ranked.filter((m) => !seenAt.has(m.profile.id));
    const seen = ranked
      .filter((m) => seenAt.has(m.profile.id))
      .sort(
        (a, b) =>
          +new Date(seenAt.get(a.profile.id)!) -
          +new Date(seenAt.get(b.profile.id)!)
      );
    backfilled = unseen.length < 20 && seen.length > 0;
    visible = [...unseen, ...seen].slice(0, 20);
  }

  // Record what was shown so the next visit rotates to new faces.
  if (visible.length > 0) {
    await supabase.from("discovery_impressions").upsert(
      visible.map((m) => ({
        viewer_user_id: user.id,
        profile_id: m.profile.id,
        viewed_at: new Date().toISOString(),
      })),
      { onConflict: "viewer_user_id,profile_id" }
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Discover</h1>
        {role === "dual" && (
          <div
            className="flex rounded-xl bg-white p-1 ring-1 ring-slate-300"
            role="group"
            aria-label="Choose who to browse"
          >
            {(
              [
                ["guests", "Guests"],
                ["shows", "Shows"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/discover?view=${value}`}
                aria-current={viewing === value ? "true" : undefined}
                className={`tap-target rounded-lg px-4 py-2 text-sm font-semibold ${
                  viewing === value
                    ? "bg-navy-800 text-white"
                    : "text-slate-600"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Suspense>
        <DiscoveryFilters
          topics={topics}
          showRecordingFilters={viewing === "shows"}
        />
      </Suspense>

      {visible.length === 0 ? (
        <EmptyState
          title="No matches yet"
          body={
            filtersActive
              ? "No published profiles match those filters. Broaden them to see more."
              : "No published profiles on this side yet. Check back soon, or invite a podcaster you know."
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500" role="status">
            {visible.length} {visible.length === 1 ? "match" : "matches"}
            {anyEmbeddings
              ? " · ranked with AI similarity"
              : " · ranked by topics & fit"}
            {!filtersActive && !backfilled && " · fresh picks"}
            {!filtersActive && backfilled && " · fresh picks first"}
          </p>
          <div className="space-y-4">
            {visible.map((m) => (
              <MatchCard
                key={m.profile.id}
                match={m}
                asRole={viewing === "guests" ? "host" : "guest"}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
