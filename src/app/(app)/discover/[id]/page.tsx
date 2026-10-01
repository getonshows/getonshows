import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logServerEvent } from "@/lib/messaging";
import OneSheet from "@/components/OneSheet";
import PitchButton from "@/components/PitchButton";
import SafetyActions from "@/components/SafetyActions";
import type {
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  Role,
  TopicRow,
} from "@/lib/types";

/** Public one-sheet for a published profile found in discovery. */
export default async function DiscoverProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .eq("state", "published")
    .maybeSingle();
  const p = (profile ?? null) as ProfileRow | null;
  if (!p) notFound();

  // Blocked profiles (either direction) are invisible here too.
  const { data: blockHit } = await supabase
    .from("blocks")
    .select("blocker_user_id")
    .or(
      `and(blocker_user_id.eq.${user.id},blocked_user_id.eq.${p.user_id}),and(blocker_user_id.eq.${p.user_id},blocked_user_id.eq.${user.id})`
    )
    .limit(1);
  if ((blockHit ?? []).length > 0) notFound();

  // Funnel: one-sheet opened from Discover (never for self-views).
  // Fire-and-forget: analytics must not break the page.
  if (searchParams.from === "discover" && p.user_id !== user.id) {
    void logServerEvent(supabase, user.id, "match_opened", {
      target_profile_id: p.id,
    });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = ((userRow as { role: string } | null)?.role ?? "guest") as Role;

  const [{ data: host }, { data: guest }, { data: pts }] = await Promise.all([
    supabase.from("host_profiles").select("*").eq("profile_id", p.id).maybeSingle(),
    supabase.from("guest_profiles").select("*").eq("profile_id", p.id).maybeSingle(),
    supabase.from("profile_topics").select("topic_id").eq("profile_id", p.id),
  ]);
  const hostModule = (host ?? null) as HostModuleRow | null;
  const guestModule = (guest ?? null) as GuestModuleRow | null;

  // Pitch direction: hosts invite guests, guests pitch shows.
  const asRole: "host" | "guest" | null =
    guestModule && role !== "guest"
      ? "host"
      : hostModule && role !== "host"
        ? "guest"
        : null;

  const topicIds = ((pts ?? []) as { topic_id: string }[]).map((r) => r.topic_id);
  let topics: TopicRow[] = [];
  if (topicIds.length > 0) {
    const { data } = await supabase
      .from("topics")
      .select("id,label,slug,parent_id,is_custom")
      .in("id", topicIds)
      .order("label");
    topics = (data ?? []) as TopicRow[];
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link
        href="/discover"
        className="tap-target inline-flex items-center font-semibold text-brand-dark"
      >
        ← Back to Discover
      </Link>
      <OneSheet
        profile={p}
        hostModule={hostModule}
        guestModule={guestModule}
        topics={topics}
      />
      {asRole && p.user_id !== user.id && (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <PitchButton
            targetProfileId={p.id}
            asRole={asRole}
            label={asRole === "guest" ? "Pitch yourself as a guest" : "Invite as a guest"}
            className="w-full py-3 text-base"
          />
          <p className="mt-2 text-xs text-slate-500">
            3 pitches per week. Make each one count.
          </p>
        </div>
      )}
      {p.user_id !== user.id && (
        <SafetyActions targetUserId={p.user_id} targetName={p.display_name ?? "Member"} />
      )}
    </div>
  );
}
