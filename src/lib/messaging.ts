"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  ConversationRow,
  ConversationState,
  IntentAction,
  MessageRow,
  PitchContext,
  PitchPrefill,
  PitchQuotaStatus,
  ThreadData,
  ThreadParticipant,
  ThreadPreview,
} from "@/lib/types";

type SupabaseClient = ReturnType<typeof createClient>;

export interface ActionResult {
  ok: boolean;
  error?: string;
  conversationId?: string;
  existing?: boolean;
  bookingUrl?: string | null;
}

const VALID_INTENTS: IntentAction[] = ["interested", "passed", "booked"];

/** Allowed intent transitions per conversation state (server-enforced). */
const TRANSITIONS: Record<ConversationState, IntentAction[]> = {
  pitched: ["interested", "passed", "booked"],
  replied: ["interested", "passed", "booked"],
  interested: ["passed", "booked"],
  passed: [],
  booked: [],
};

const INTENT_LABEL: Record<IntentAction, string> = {
  interested: "Interested",
  passed: "Passed",
  booked: "Booked",
};

async function authed() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  return { supabase, user };
}

async function myProfileId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data as { id: string } | null)?.id ?? null);
}

async function profileUserId(
  supabase: SupabaseClient,
  profileId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();
  return ((data as { user_id: string } | null)?.user_id ?? null);
}

/** True when either user has blocked the other. Never reveals direction. */
async function blockedEitherWay(
  supabase: SupabaseClient,
  userIdA: string,
  userIdB: string
): Promise<boolean> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_user_id")
    .or(
      `and(blocker_user_id.eq.${userIdA},blocked_user_id.eq.${userIdB}),and(blocker_user_id.eq.${userIdB},blocked_user_id.eq.${userIdA})`
    )
    .limit(1);
  return (data ?? []).length > 0;
}

/** Analytics event. Exported so other server modules (publish, admin)
 *  log through the same path. Never carries message bodies. */
export async function logServerEvent(
  supabase: SupabaseClient,
  userId: string,
  name:
    | "signup"
    | "profile_published"
    | "match_opened"
    | "pitch_sent"
    | "message_replied"
    | "booking_marked"
    | "role_switched"
    | "admin_view",
  properties: Record<string, string | number | boolean>
): Promise<void> {
  try {
    await supabase.from("events").insert({ name, user_id: userId, properties });
  } catch {
    // Analytics must never break the user flow.
  }
}

async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  name: "pitch_sent" | "message_replied" | "booking_marked",
  properties: Record<string, string | number | boolean>
): Promise<void> {
  await logServerEvent(supabase, userId, name, properties);
}

interface ParticipantCheck {
  conversation: ConversationRow;
  myProfileId: string;
  otherProfileId: string;
}

/** Load a conversation and prove the caller is a participant. */
async function assertParticipant(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<ParticipantCheck> {
  const myPid = await myProfileId(supabase, userId);
  if (!myPid) throw new Error("Set up your profile first.");
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) throw new Error("Conversation not found.");
  const conv = data as ConversationRow;
  const mine =
    conv.host_profile_id === myPid || conv.guest_profile_id === myPid;
  if (!mine) throw new Error("Conversation not found.");
  return {
    conversation: conv,
    myProfileId: myPid,
    otherProfileId:
      conv.host_profile_id === myPid
        ? conv.guest_profile_id
        : conv.host_profile_id,
  };
}

async function buildParticipant(
  supabase: SupabaseClient,
  profileId: string
): Promise<ThreadParticipant> {
  const [{ data: p }, { data: host }, { data: guest }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    supabase
      .from("host_profiles")
      .select("show_name,booking_url")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("guest_profiles")
      .select("expertise,booking_url")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);
  const profile = (p ?? {}) as {
    user_id?: string;
    display_name?: string | null;
    photo_url?: string | null;
    title?: string | null;
  };
  const h = host as { show_name?: string | null; booking_url?: string | null } | null;
  const g = guest as { expertise?: string | null; booking_url?: string | null } | null;
  return {
    profileId,
    userId: profile.user_id ?? "",
    displayName: profile.display_name ?? "Member",
    photoUrl: profile.photo_url ?? null,
    headline: h?.show_name ?? g?.expertise ?? profile.title ?? "",
    bookingUrl: h?.booking_url ?? g?.booking_url ?? null,
    isHost: !!h?.show_name,
  };
}

function formatReset(dateIso: string): string {
  const d = new Date(dateIso);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Quota status without spending a slot (for the composer display). */
export async function getPitchQuota(): Promise<PitchQuotaStatus> {
  const { supabase } = await authed();
  const { data, error } = await supabase.rpc("pitch_quota", { consume: false });
  if (error || !data) {
    return { allowed: true, remaining: 3, limit: 3, resets_at: new Date().toISOString() };
  }
  return data as PitchQuotaStatus;
}

/**
 * Everything the pitch composer needs: eligibility, existing thread,
 * quota, and template prefill values.
 */
export async function getPitchContext(
  targetProfileId: string,
  asRole: "host" | "guest"
): Promise<PitchContext> {
  const { supabase, user } = await authed();

  const { data: mine } = await supabase
    .from("profiles")
    .select("id,display_name,title,state")
    .eq("user_id", user.id)
    .maybeSingle();
  const myProfile = mine as {
    id: string;
    display_name: string | null;
    title: string | null;
    state: string;
  } | null;
  if (!myProfile || myProfile.state !== "published") {
    return {
      canPitch: false,
      reason:
        "Publish your profile before pitching. It's what your pitch will be judged on.",
    };
  }

  // Role gate: pitching capacity follows the current role, not just the
  // modules on file (modules are preserved across role switches).
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const myRole = (userRow as { role: string } | null)?.role ?? "";
  if (asRole === "host" && myRole !== "host" && myRole !== "dual") {
    return {
      canPitch: false,
      reason: "Switch your role to host (or both) in Profile to pitch as a host.",
    };
  }
  if (asRole === "guest" && myRole !== "guest" && myRole !== "dual") {
    return {
      canPitch: false,
      reason: "Switch your role to guest (or both) in Profile to pitch as a guest.",
    };
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id,user_id,display_name,state")
    .eq("id", targetProfileId)
    .maybeSingle();
  const targetProfile = target as {
    id: string;
    user_id: string;
    display_name: string | null;
    state: string;
  } | null;
  if (
    !targetProfile ||
    targetProfile.state !== "published" ||
    targetProfile.id === myProfile.id
  ) {
    return { canPitch: false, reason: "This profile isn't available right now." };
  }
  if (await blockedEitherWay(supabase, user.id, targetProfile.user_id)) {
    return { canPitch: false, reason: "This profile isn't available right now." };
  }

  const [{ data: myHost }, { data: myGuest }, { data: targetHost }, { data: targetGuest }] =
    await Promise.all([
      supabase.from("host_profiles").select("show_name").eq("profile_id", myProfile.id).maybeSingle(),
      supabase.from("guest_profiles").select("profile_id").eq("profile_id", myProfile.id).maybeSingle(),
      supabase.from("host_profiles").select("show_name").eq("profile_id", targetProfile.id).maybeSingle(),
      supabase.from("guest_profiles").select("profile_id").eq("profile_id", targetProfile.id).maybeSingle(),
    ]);

  if (asRole === "host") {
    if (!myHost) {
      return { canPitch: false, reason: "You need a host profile to pitch as a host." };
    }
    if (!targetGuest) {
      return { canPitch: false, reason: "This profile isn't accepting guest pitches." };
    }
  } else {
    if (!myGuest) {
      return { canPitch: false, reason: "You need a guest profile to pitch as a guest." };
    }
    if (!targetHost) {
      return { canPitch: false, reason: "This profile isn't accepting host pitches." };
    }
  }

  // Idempotency: one thread per pair. Reuse it instead of duplicating.
  const hostPid = asRole === "host" ? myProfile.id : targetProfile.id;
  const guestPid = asRole === "host" ? targetProfile.id : myProfile.id;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id,archived")
    .eq("host_profile_id", hostPid)
    .eq("guest_profile_id", guestPid)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; archived: boolean };
    if (row.archived) {
      return { canPitch: false, reason: "You've already pitched this person." };
    }
    return { canPitch: true, existingConversationId: row.id };
  }

  const quota = await getPitchQuota();
  const prefill: PitchPrefill = {
    theirName: targetProfile.display_name ?? "there",
    showName: (targetHost as { show_name?: string | null } | null)?.show_name ?? "",
    myName: myProfile.display_name ?? "",
    myTitle: myProfile.title ?? "",
    myShowName: (myHost as { show_name?: string | null } | null)?.show_name ?? "",
  };
  return { canPitch: true, quota, prefill, targetProfileId, asRole };
}

/** Send a pitch: creates the conversation + first message, atomically-ish. */
export async function sendPitch(input: {
  toProfileId: string;
  body: string;
  asRole: "host" | "guest";
}): Promise<ActionResult> {
  const { supabase, user } = await authed();
  const body = input.body.trim();
  if (body.length < 40) {
    return { ok: false, error: "Your pitch needs at least 40 characters. Say what the episode is about." };
  }
  if (body.length > 1500) {
    return { ok: false, error: "Keep your pitch under 1,500 characters." };
  }
  const leftover = Array.from(
    body.matchAll(/\[([^\[\]]{1,80})\]/g),
    (m) => m[1].trim()
  );
  if (leftover.length > 0) {
    return {
      ok: false,
      error: `Fill in the template prompts first: ${Array.from(new Set(leftover)).join(", ")}.`,
    };
  }

  // Re-check everything server-side; never trust the composer state.
  const ctx = await getPitchContext(input.toProfileId, input.asRole);
  if (!ctx.canPitch) {
    return { ok: false, error: ctx.reason ?? "You can't pitch this profile right now." };
  }
  if (ctx.existingConversationId) {
    return { ok: true, conversationId: ctx.existingConversationId, existing: true };
  }

  const { data: quotaData, error: quotaError } = await supabase.rpc("pitch_quota", {
    consume: true,
  });
  const quota = (quotaData ?? null) as PitchQuotaStatus | null;
  if (quotaError || !quota) {
    return { ok: false, error: "Couldn't check your pitch quota. Please try again." };
  }
  if (!quota.allowed) {
    return {
      ok: false,
      error: `You've used all ${quota.limit} pitches for this week. Your quota resets on ${formatReset(quota.resets_at)}.`,
    };
  }

  const { data: mine } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  const myPid = (mine as { id: string }).id;
  const hostPid = input.asRole === "host" ? myPid : input.toProfileId;
  const guestPid = input.asRole === "host" ? input.toProfileId : myPid;

  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({
      host_profile_id: hostPid,
      guest_profile_id: guestPid,
      state: "pitched",
      pitched_by_profile_id: myPid,
      state_changed_at: new Date().toISOString(),
      state_changed_by_profile_id: myPid,
    })
    .select("id")
    .single();
  if (convError || !conv) {
    return { ok: false, error: "Couldn't start the conversation. Please try again." };
  }
  const conversationId = (conv as { id: string }).id;

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_profile_id: myPid,
    body,
    kind: "text",
  });
  if (msgError) {
    await supabase.from("conversations").delete().eq("id", conversationId);
    return { ok: false, error: "Couldn't send your pitch. Please try again." };
  }
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  await logEvent(supabase, user.id, "pitch_sent", { role: input.asRole });
  return { ok: true, conversationId, existing: false };
}

/** Post a reply inside a thread. The first reply flips pitched → replied. */
export async function sendMessage(input: {
  conversationId: string;
  body: string;
}): Promise<ActionResult> {
  const { supabase, user } = await authed();
  const body = input.body.trim();
  if (body.length === 0) return { ok: false, error: "Write a message first." };
  if (body.length > 2000) return { ok: false, error: "Keep messages under 2,000 characters." };

  const { conversation, myProfileId } = await assertParticipant(
    supabase,
    user.id,
    input.conversationId
  );
  if (conversation.archived) {
    return { ok: false, error: "This conversation is archived." };
  }
  const otherUserId = await profileUserId(
    supabase,
    conversation.host_profile_id === myProfileId
      ? conversation.guest_profile_id
      : conversation.host_profile_id
  );
  if (otherUserId && (await blockedEitherWay(supabase, user.id, otherUserId))) {
    return { ok: false, error: "This conversation is unavailable." };
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_profile_id: myProfileId,
    body,
    kind: "text",
  });
  if (error) return { ok: false, error: "Couldn't send your message. Please try again." };

  const now = new Date().toISOString();
  const updates: Record<string, string | null> = { last_message_at: now };
  if (
    conversation.state === "pitched" &&
    conversation.pitched_by_profile_id !== myProfileId
  ) {
    updates.state = "replied";
    updates.state_changed_at = now;
    updates.state_changed_by_profile_id = myProfileId;
    await logEvent(supabase, user.id, "message_replied", {});
  }
  await supabase.from("conversations").update(updates).eq("id", conversation.id);
  return { ok: true, conversationId: conversation.id };
}

/** Set intent on a thread. Invalid transitions fail here, server-side. */
export async function setIntent(input: {
  conversationId: string;
  intent: IntentAction;
}): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!VALID_INTENTS.includes(input.intent)) {
    return { ok: false, error: "Unknown intent." };
  }
  const { conversation, myProfileId, otherProfileId } = await assertParticipant(
    supabase,
    user.id,
    input.conversationId
  );
  if (conversation.archived) {
    return { ok: false, error: "This conversation is archived." };
  }
  if (!TRANSITIONS[conversation.state].includes(input.intent)) {
    return {
      ok: false,
      error: `You can't mark this conversation as ${INTENT_LABEL[input.intent]} right now.`,
    };
  }

  const now = new Date().toISOString();
  const updates: Record<string, string | boolean | null> = {
    state: input.intent,
    state_changed_at: now,
    state_changed_by_profile_id: myProfileId,
  };
  if (input.intent === "passed") updates.archived = true;
  if (input.intent === "booked") updates.booking_claimed_by = myProfileId;
  const { error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", conversation.id);
  if (error) return { ok: false, error: "Couldn't update the conversation. Please try again." };

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", myProfileId)
    .maybeSingle();
  const myName = (me as { display_name?: string | null } | null)?.display_name ?? "Someone";
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_profile_id: myProfileId,
    body: `${myName} marked this conversation as ${INTENT_LABEL[input.intent]}.`,
    kind: "system",
  });

  let bookingUrl: string | null = null;
  if (input.intent === "booked") {
    const other = await buildParticipant(supabase, otherProfileId);
    bookingUrl = other.bookingUrl;
    await logEvent(supabase, user.id, "booking_marked", {});
  }
  return { ok: true, conversationId: conversation.id, bookingUrl };
}

/** Mark a thread read (upsert the read watermark). */
export async function markThreadRead(conversationId: string): Promise<void> {
  const { supabase, user } = await authed();
  await assertParticipant(supabase, user.id, conversationId);
  await supabase.from("conversation_reads").upsert(
    {
      conversation_id: conversationId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,user_id" }
  );
}

/** Block a user: hides them from discovery, bans new messages both ways, archives shared threads. */
export async function blockUser(targetUserId: string): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (targetUserId === user.id) return { ok: false, error: "You can't block yourself." };
  const { data: target } = await supabase
    .from("users")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found." };

  await supabase.from("blocks").upsert(
    { blocker_user_id: user.id, blocked_user_id: targetUserId },
    { onConflict: "blocker_user_id,blocked_user_id", ignoreDuplicates: true }
  );

  const myPid = await myProfileId(supabase, user.id);
  const theirPid = await myProfileId(supabase, targetUserId);
  if (myPid && theirPid) {
    await supabase
      .from("conversations")
      .update({ archived: true })
      .or(
        `and(host_profile_id.eq.${myPid},guest_profile_id.eq.${theirPid}),and(host_profile_id.eq.${theirPid},guest_profile_id.eq.${myPid})`
      );
  }
  return { ok: true };
}

const REPORT_REASONS = ["spam", "harassment", "fake_profile", "inappropriate", "other"] as const;

/** File a moderation report. */
export async function reportUser(input: {
  targetUserId: string;
  reason: string;
  details?: string;
  conversationId?: string;
}): Promise<ActionResult> {
  const { supabase, user } = await authed();
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
    return { ok: false, error: "Choose a reason for the report." };
  }
  if (input.targetUserId === user.id) {
    return { ok: false, error: "You can't report yourself." };
  }
  const { error } = await supabase.from("reports").insert({
    reporter_user_id: user.id,
    target_user_id: input.targetUserId,
    reason: input.reason,
    details: (input.details ?? "").trim().slice(0, 2000) || null,
    created_by: user.id,
    conversation_id: input.conversationId ?? null,
  });
  if (error) return { ok: false, error: "Couldn't file the report. Please try again." };
  return { ok: true };
}

/** Inbox threads, newest first, with unread counts and intent badges. */
export async function getInboxThreads(): Promise<ThreadPreview[]> {
  const { supabase, user } = await authed();
  const myPid = await myProfileId(supabase, user.id);
  if (!myPid) return [];

  const { data: convs } = await supabase
    .from("conversations")
    .select("*")
    .or(`host_profile_id.eq.${myPid},guest_profile_id.eq.${myPid}`)
    .eq("archived", false)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const conversations = ((convs ?? []) as ConversationRow[]);
  if (conversations.length === 0) return [];

  const convIds = conversations.map((c) => c.id);
  const [{ data: reads }, { data: msgs }] = await Promise.all([
    supabase.from("conversation_reads").select("conversation_id,last_read_at").in("conversation_id", convIds).eq("user_id", user.id),
    supabase
      .from("messages")
      .select("conversation_id,body,created_at,sender_profile_id")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const readAt = new Map(
    ((reads ?? []) as { conversation_id: string; last_read_at: string }[]).map((r) => [
      r.conversation_id,
      r.last_read_at,
    ])
  );
  const messages = (msgs ?? []) as {
    conversation_id: string;
    body: string;
    created_at: string;
    sender_profile_id: string;
  }[];

  const previews: ThreadPreview[] = [];
  for (const c of conversations) {
    const otherPid = c.host_profile_id === myPid ? c.guest_profile_id : c.host_profile_id;
    const other = await buildParticipant(supabase, otherPid);
    const cMessages = messages.filter((m) => m.conversation_id === c.id);
    const last = cMessages[0] ?? null;
    const watermark = readAt.get(c.id);
    const unreadCount = cMessages.filter(
      (m) =>
        m.sender_profile_id !== myPid &&
        (!watermark || m.created_at > watermark)
    ).length;
    previews.push({
      conversation: c,
      other,
      lastMessage: last
        ? { body: last.body, created_at: last.created_at, sender_profile_id: last.sender_profile_id }
        : null,
      unreadCount,
      myProfileId: myPid,
    });
  }
  return previews;
}

/** Full thread for the thread view. Marks the thread read on view. */
export async function getThread(conversationId: string): Promise<ThreadData> {
  const { supabase, user } = await authed();
  const { conversation, myProfileId, otherProfileId } = await assertParticipant(
    supabase,
    user.id,
    conversationId
  );
  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(500);
  const other = await buildParticipant(supabase, otherProfileId);
  const { data: me } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", myProfileId)
    .maybeSingle();

  await markThreadRead(conversation.id);
  return {
    conversation,
    messages: ((msgs ?? []) as MessageRow[]),
    other,
    myProfileId,
    myDisplayName:
      (me as { display_name?: string | null } | null)?.display_name ?? "You",
  };
}

/** Total unread messages across threads (nav badge). */
export async function getUnreadCount(): Promise<number> {
  const threads = await getInboxThreads();
  return threads.reduce((n, t) => n + t.unreadCount, 0);
}
