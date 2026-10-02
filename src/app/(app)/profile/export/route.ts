import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * DATA-01: "Download my data". Exports the signed-in user's account,
 * profiles, conversations + messages, pitches, intents, blocks they made,
 * and quota state as a single JSON download. Server-side, authenticated,
 * and scoped to the caller's own rows only.
 *
 * Deliberately excluded: who blocked this user (block direction is never
 * revealed), other users' private data, and retained abuse-report skeletons
 * (owner-held, documented in docs/RETENTION.md).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("id,email,role,status,source,created_at")
    .eq("id", user.id)
    .single();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileId = (profile as { id: string } | null)?.id ?? null;

  let hostModule = null;
  let guestModule = null;
  let topicLabels: string[] = [];
  if (profileId) {
    const [{ data: host }, { data: guest }, { data: pts }] = await Promise.all([
      supabase.from("host_profiles").select("*").eq("profile_id", profileId).maybeSingle(),
      supabase.from("guest_profiles").select("*").eq("profile_id", profileId).maybeSingle(),
      supabase
        .from("profile_topics")
        .select("topics(label)")
        .eq("profile_id", profileId),
    ]);
    hostModule = host ?? null;
    guestModule = guest ?? null;
    topicLabels = (((pts ?? []) as unknown as { topics: { label: string } | null }[]).map(
      (r) => r.topics?.label ?? ""
    )).filter(Boolean);
  }

  let conversations: unknown[] = [];
  if (profileId) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`host_profile_id.eq.${profileId},guest_profile_id.eq.${profileId}`)
      .order("created_at", { ascending: true });
    const rows = (convs ?? []) as Record<string, unknown>[];
    const convIds = rows.map((c) => c["id"] as string);
    let messages: Record<string, unknown>[] = [];
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_profile_id,body,kind,created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: true });
      messages = (msgs ?? []) as Record<string, unknown>[];
    }
    conversations = rows.map((c) => ({
      ...c,
      // Intent history is the conversation's state + state-change metadata.
      messages: messages.filter((m) => m["conversation_id"] === c["id"]),
    }));
  }

  const pitchesSent = (conversations as Record<string, unknown>[]).filter(
    (c) => c["pitched_by_profile_id"] === profileId
  );

  const { data: quota } = await supabase
    .from("pitch_quotas")
    .select("window_start,sent_count")
    .eq("user_id", user.id)
    .maybeSingle();

  // Blocks the user made. Blocked-by is excluded: direction is never revealed.
  const { data: blocksMade } = await supabase
    .from("blocks")
    .select("blocked_user_id,created_at")
    .eq("blocker_user_id", user.id);

  const { data: reportsFiled } = await supabase
    .from("reports")
    .select("target_user_id,reason,details,created_at")
    .eq("reporter_user_id", user.id);

  const payload = {
    exported_at: new Date().toISOString(),
    account: userRow ?? null,
    profile: profile ?? null,
    host_module: hostModule,
    guest_module: guestModule,
    topics: topicLabels,
    conversations,
    pitches_sent: pitchesSent,
    pitch_quota: quota ?? null,
    blocks_made: blocksMade ?? [],
    reports_filed: reportsFiled ?? [],
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="getonshows-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
