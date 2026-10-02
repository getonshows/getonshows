"use server";

import { createClient } from "@/lib/supabase/server";

/** Submit (or update) your rating for the other party in a completed booking. */
export async function submitRating(
  conversationId: string,
  stars: number,
  comment: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { ok: false, error: "Pick a star rating from 1 to 5." };
  }
  const trimmed = comment.trim().slice(0, 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const myProfileId = (profile as { id: string } | null)?.id;
  if (!myProfileId) return { ok: false, error: "Build your profile first." };

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, host_profile_id, guest_profile_id, completed_at")
    .eq("id", conversationId)
    .maybeSingle();
  const c = conv as {
    id: string;
    host_profile_id: string;
    guest_profile_id: string;
    completed_at: string | null;
  } | null;
  if (!c) return { ok: false, error: "Conversation not found." };
  if (!c.completed_at) {
    return { ok: false, error: "You can rate once the recording is confirmed." };
  }
  const otherProfileId =
    c.host_profile_id === myProfileId
      ? c.guest_profile_id
      : c.guest_profile_id === myProfileId
        ? c.host_profile_id
        : null;
  if (!otherProfileId) {
    return { ok: false, error: "You're not part of this conversation." };
  }
  const ratedRole = c.host_profile_id === otherProfileId ? "host" : "guest";

  const { error } = await supabase.from("ratings").upsert(
    {
      conversation_id: conversationId,
      rater_profile_id: myProfileId,
      rated_profile_id: otherProfileId,
      rated_role: ratedRole,
      stars,
      comment: trimmed || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,rater_profile_id" }
  );
  if (error) return { ok: false, error: "Couldn't save your rating. Try again." };
  return { ok: true };
}

/** Your existing rating (if any) for a conversation. */
export async function getMyRating(
  conversationId: string
): Promise<{ stars: number; comment: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const myProfileId = (profile as { id: string } | null)?.id;
  if (!myProfileId) return null;
  const { data } = await supabase
    .from("ratings")
    .select("stars, comment")
    .eq("conversation_id", conversationId)
    .eq("rater_profile_id", myProfileId)
    .maybeSingle();
  return (data as { stars: number; comment: string | null } | null) ?? null;
}
