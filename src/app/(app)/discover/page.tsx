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
  searchParams: SearchParams;
}) {
  const supabase = createClient();
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
      ? searchParams.view === "shows"
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
          body="Matching ranks other profiles against yours — your topics, format, and bio are what make the scores meaningful."
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
      !blockedUserIds.has(r.user_id)
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
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const filterTopicIds = new Set(
    (searchParams.topics ?? "").split(",").filter(Boolean)
  );
  const filterMedium = searchParams.medium ?? "";
  const filterSession = searchParams.session ?? "";

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
    limit: 20,
  });

  const anyEmbeddings = ranked.some((c) => c.usedEmbedding);
  const filtersActive =
    q !== "" || filterTopicIds.size > 0 || filterMedium !== "" || filterSession !== "";

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

      {ranked.length === 0 ? (
        <EmptyState
          title="No matches yet"
          body={
            filtersActive
              ? "No published profiles match those filters. Broaden them to see more."
              : "No published profiles on this side yet. Check back soon — or invite a podcaster you know."
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500" role="status">
            {ranked.length} {ranked.length === 1 ? "match" : "matches"}
            {anyEmbeddings
              ? " · ranked with AI similarity"
              : " · ranked by topics & fit"}
          </p>
          <div className="space-y-4">
            {ranked.map((m) => (
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
