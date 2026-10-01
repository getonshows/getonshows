"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logServerEvent } from "@/lib/messaging";
import { validatePublish, isUrl } from "@/lib/publish-validation";
import type {
  BuilderData,
  DraftInput,
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  Role,
  RoleOrUndecided,
  TopicRow,
  UserRow,
} from "@/lib/types";

const MAX_CUSTOM_TOPICS = 3;

type SupabaseClient = ReturnType<typeof createClient>;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function authed() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** The signup trigger normally creates this row; upsert defensively. */
async function ensureUserRow(
  supabase: SupabaseClient,
  user: { id: string; email?: string }
): Promise<UserRow> {
  const { data } = await supabase
    .from("users")
    .upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id" })
    .select()
    .single();
  if (!data) throw new Error("Could not load user record.");
  return data as UserRow;
}

async function getRole(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleOrUndecided> {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();
  return ((data as { role: RoleOrUndecided } | null)?.role ?? "undecided");
}

/** AUTH-adjacent: record the user's role choice after sign-in. */
export async function setRole(formData: FormData): Promise<void> {
  const { supabase, user } = await authed();
  const role = String(formData.get("role") ?? "");
  if (!["host", "guest", "dual"].includes(role)) {
    throw new Error("Choose host, guest, or both to continue.");
  }
  await ensureUserRow(supabase, user);
  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", user.id);
  if (error) throw new Error("Could not save your role. Please try again.");
  // Intent served its purpose — clear it.
  (await cookies()).delete("gos_intent");
  redirect("/profile/builder");
}

/**
 * Task 0: change role after onboarding. Modules, conversations, and pitches
 * are never deleted by a switch — they stay on file and remain accessible.
 * Switching to a role whose module was never started guides the user to the
 * builder (the profile page renders that nudge; no auto-redirect here).
 */
export async function switchRole(
  newRole: string
): Promise<{ ok: true; role: Role } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await authed();
    if (!["host", "guest", "dual"].includes(newRole)) {
      return { ok: false, error: "Choose host, guest, or both." };
    }
    const userRow = await ensureUserRow(supabase, user);
    const fromRole = userRow.role as RoleOrUndecided;
    if (fromRole === newRole) {
      return { ok: true, role: newRole as Role };
    }
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", user.id);
    if (error) throw error;
    await logServerEvent(supabase, user.id, "role_switched", {
      from_role: String(fromRole),
      to_role: newRole,
    });
    revalidatePath("/profile");
    revalidatePath("/discover");
    return { ok: true, role: newRole as Role };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not switch role.",
    };
  }
}

export async function signOut(): Promise<void> {
  const { supabase } = await authed();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Builder data loading
// ---------------------------------------------------------------------------

export async function loadBuilderData(): Promise<BuilderData> {
  const { supabase, user } = await authed();
  const userRow = await ensureUserRow(supabase, user);
  const role = userRow.role;
  if (role === "undecided") redirect("/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileRow = (profile ?? null) as ProfileRow | null;

  let hostModule: HostModuleRow | null = null;
  let guestModule: GuestModuleRow | null = null;
  let topicIds: string[] = [];

  if (profileRow) {
    const [{ data: host }, { data: guest }, { data: pts }] = await Promise.all([
      supabase.from("host_profiles").select("*").eq("profile_id", profileRow.id).maybeSingle(),
      supabase.from("guest_profiles").select("*").eq("profile_id", profileRow.id).maybeSingle(),
      supabase.from("profile_topics").select("topic_id").eq("profile_id", profileRow.id),
    ]);
    hostModule = (host ?? null) as HostModuleRow | null;
    guestModule = (guest ?? null) as GuestModuleRow | null;
    topicIds = ((pts ?? []) as { topic_id: string }[]).map((r) => r.topic_id);
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("id,label,slug,parent_id,is_custom")
    .order("label", { ascending: true });

  const allTopics = ((topics ?? []) as TopicRow[]).filter((t) => !t.is_custom);
  const customTopics = ((topics ?? []) as TopicRow[]).filter((t) => t.is_custom);

  return {
    userId: user.id,
    email: user.email ?? "",
    role: role as Role,
    profile: profileRow,
    hostModule,
    guestModule,
    topicIds,
    topics: allTopics,
    customTopics,
  };
}

export interface ProfileHomeData {
  userRow: UserRow;
  profile: ProfileRow | null;
  hasHostModule: boolean;
  hasGuestModule: boolean;
  topicCount: number;
}

export async function loadProfileHome(): Promise<ProfileHomeData> {
  const { supabase, user } = await authed();
  const userRow = await ensureUserRow(supabase, user);
  if (userRow.role === "undecided") redirect("/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileRow = (profile ?? null) as ProfileRow | null;

  let hasHostModule = false;
  let hasGuestModule = false;
  let topicCount = 0;
  if (profileRow) {
    const [{ count: h }, { count: g }, { count: t }] = await Promise.all([
      supabase.from("host_profiles").select("profile_id", { count: "exact", head: true }).eq("profile_id", profileRow.id),
      supabase.from("guest_profiles").select("profile_id", { count: "exact", head: true }).eq("profile_id", profileRow.id),
      supabase.from("profile_topics").select("profile_id", { count: "exact", head: true }).eq("profile_id", profileRow.id),
    ]);
    hasHostModule = (h ?? 0) > 0;
    hasGuestModule = (g ?? 0) > 0;
    topicCount = t ?? 0;
  }

  return { userRow, profile: profileRow, hasHostModule, hasGuestModule, topicCount };
}

// ---------------------------------------------------------------------------
// Draft persistence (PRO-01)
// ---------------------------------------------------------------------------

function toLinkArray(
  links: { label: string; url: string }[]
): { label: string; url: string }[] {
  return links
    .map((l) => ({ label: l.label.trim().slice(0, 60), url: l.url.trim().slice(0, 500) }))
    .filter((l) => l.label !== "" || l.url !== "");
}

const AVAIL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const AVAIL_SLOT = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Keep only known day keys and HH:MM slots; cap at the full grid size. */
function sanitizeAvailability(
  input: unknown
): Record<string, string[]> {
  if (typeof input !== "object" || input === null) return {};
  const out: Record<string, string[]> = {};
  for (const day of AVAIL_DAYS) {
    const slots = (input as Record<string, unknown>)[day];
    if (!Array.isArray(slots)) continue;
    const clean = Array.from(
      new Set(
        slots
          .filter((s): s is string => typeof s === "string" && AVAIL_SLOT.test(s))
          .map((s) => s.slice(0, 5))
      )
    ).sort();
    if (clean.length > 0) out[day] = clean.slice(0, 12);
  }
  return out;
}

function computeCompleteness(
  input: DraftInput,
  role: Role
): number {
  const checks: boolean[] = [
    input.displayName.trim().length >= 2,
    input.bio.trim().length >= 40,
    input.photoUrl.trim() !== "",
    input.topicIds.length > 0,
    input.links.some((l) => l.url.trim() !== ""),
    input.timezone.trim() !== "",
  ];
  if (role === "host" || role === "dual") {
    const h = input.host;
    checks.push(
      !!h && h.showName.trim() !== "",
      !!h && h.showUrl.trim() !== "" && isUrl(h.showUrl),
      !!h && h.format !== "",
      !!h && h.guestCriteria.trim() !== ""
    );
  }
  if (role === "guest" || role === "dual") {
    const g = input.guest;
    checks.push(
      !!g && g.expertise.trim() !== "",
      !!g && g.talkingPoints.some((t) => t.trim() !== ""),
      !!g && g.proofLinks.some((l) => l.url.trim() !== "" && isUrl(l.url))
    );
  }
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

async function ensureProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRow> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as ProfileRow;
  const { data, error } = await supabase
    .from("profiles")
    .insert({ user_id: userId, state: "draft" })
    .select()
    .single();
  if (error || !data) throw new Error("Could not create your profile draft.");
  return data as ProfileRow;
}

/** PRO-01: persist the builder draft. Autosaves after every step. */
export async function saveDraft(
  input: DraftInput
): Promise<{ ok: true; completeness: number } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await authed();
    const role = await getRole(supabase, user.id);
    if (role === "undecided") return { ok: false, error: "Choose a role first." };

    const profile = await ensureProfile(supabase, user.id);
    const completeness = computeCompleteness(input, role);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: input.displayName.trim().slice(0, 120) || null,
        title: input.title.trim().slice(0, 120) || null,
        bio: input.bio.trim().slice(0, 4000) || null,
        photo_url: input.photoUrl.trim().slice(0, 500) || null,
        links: toLinkArray(input.links),
        timezone: input.timezone.trim().slice(0, 80) || null,
        availability_notes: input.availabilityNotes.trim().slice(0, 1000) || null,
        availability: sanitizeAvailability(input.availability),
        completeness,
      })
      .eq("id", profile.id);
    if (profileError) throw profileError;

    const wantsHost = role === "host" || role === "dual";
    const wantsGuest = role === "guest" || role === "dual";

    // Modules are preserved even when the current role doesn't use them:
    // switching roles never deletes profile data. Inactive modules are
    // simply left untouched so a switch back restores them.
    if (wantsHost && input.host) {
      const h = input.host;
      const { error } = await supabase.from("host_profiles").upsert(
        {
          profile_id: profile.id,
          show_name: h.showName.trim().slice(0, 160) || null,
          show_url: h.showUrl.trim().slice(0, 500) || null,
          format: h.format === "" ? null : h.format,
          medium: h.medium === "" ? null : h.medium,
          cadence: h.cadence.trim().slice(0, 60) || null,
          episode_length_minutes: h.episodeLengthMinutes.trim() === "" ? null : Number(h.episodeLengthMinutes) || null,
          guest_criteria: h.guestCriteria.trim().slice(0, 2000) || null,
          booking_url: h.bookingUrl.trim().slice(0, 500) || null,
          recent_episode_url: h.recentEpisodeUrl.trim().slice(0, 500) || null,
        },
        { onConflict: "profile_id" }
      );
      if (error) throw error;
    }

    if (wantsGuest && input.guest) {
      const g = input.guest;
      const { error } = await supabase.from("guest_profiles").upsert(
        {
          profile_id: profile.id,
          expertise: g.expertise.trim().slice(0, 2000) || null,
          talking_points: g.talkingPoints.map((t) => t.trim().slice(0, 300)).filter(Boolean),
          proof_links: toLinkArray(g.proofLinks),
          booking_url: g.bookingUrl.trim().slice(0, 500) || null,
        },
        { onConflict: "profile_id" }
      );
      if (error) throw error;
    }

    // Topics: keep only ids that exist; cap custom tags.
    const uniqueIds = Array.from(new Set(input.topicIds));
    if (uniqueIds.length > 0) {
      const { data: found } = await supabase
        .from("topics")
        .select("id,is_custom")
        .in("id", uniqueIds);
      const rows = ((found ?? []) as { id: string; is_custom: boolean }[]);
      const valid = new Set(rows.map((r) => r.id));
      const customCount = rows.filter((r) => r.is_custom && uniqueIds.includes(r.id)).length;
      if (customCount > MAX_CUSTOM_TOPICS) {
        return { ok: false, error: `You can add up to ${MAX_CUSTOM_TOPICS} custom topics.` };
      }
      const finalIds = uniqueIds.filter((id) => valid.has(id));
      await supabase.from("profile_topics").delete().eq("profile_id", profile.id);
      if (finalIds.length > 0) {
        const { error } = await supabase
          .from("profile_topics")
          .insert(finalIds.map((topic_id) => ({ profile_id: profile.id, topic_id })));
        if (error) throw error;
      }
    } else {
      await supabase.from("profile_topics").delete().eq("profile_id", profile.id);
    }

    return { ok: true, completeness };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save your draft.",
    };
  }
}

/** Add a custom topic tag (capped per profile). Returns the topic row. */
export async function addCustomTopic(
  label: string
): Promise<{ ok: true; topic: TopicRow } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await authed();
    const clean = label.trim().slice(0, 40);
    if (clean.length < 2) return { ok: false, error: "Topic names need at least 2 characters." };
    const slug = `custom-${slugify(clean)}`;
    if (!slugify(clean)) return { ok: false, error: "That topic name is not usable." };

    const profile = await ensureProfile(supabase, user.id);
    const { data: existing } = await supabase
      .from("profile_topics")
      .select("topic_id, topics!inner(is_custom)")
      .eq("profile_id", profile.id);
    const existingRows = (existing ?? []) as unknown as {
      topics: { is_custom: boolean } | null;
    }[];
    const customAttached = existingRows.filter((r) => r.topics?.is_custom).length;
    if (customAttached >= MAX_CUSTOM_TOPICS) {
      return { ok: false, error: `You can add up to ${MAX_CUSTOM_TOPICS} custom topics.` };
    }

    const { data, error } = await supabase
      .from("topics")
      .upsert(
        { label: clean, slug, is_custom: true, created_by: user.id },
        { onConflict: "slug" }
      )
      .select("id,label,slug,parent_id,is_custom")
      .single();
    if (error || !data) throw new Error("Could not add that topic.");
    return { ok: true, topic: data as TopicRow };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not add that topic.",
    };
  }
}

// ---------------------------------------------------------------------------
// Publish gate (PRO-02) lives in @/lib/publish-validation so the client can
// reuse it for live guidance. The server enforces it in publishProfile.
// ---------------------------------------------------------------------------

export async function publishProfile(): Promise<
  { ok: true } | { ok: false; missing?: string[]; error?: string }
> {
  try {
    const { supabase, user } = await authed();
    const role = await getRole(supabase, user.id);
    if (role === "undecided") return { ok: false, error: "Choose a role first." };

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return { ok: false, error: "Save a draft before publishing." };
    const p = profile as ProfileRow;

    const [{ data: host }, { data: guest }, { data: pts }] = await Promise.all([
      supabase.from("host_profiles").select("*").eq("profile_id", p.id).maybeSingle(),
      supabase.from("guest_profiles").select("*").eq("profile_id", p.id).maybeSingle(),
      supabase.from("profile_topics").select("topic_id").eq("profile_id", p.id),
    ]);

    const missing = validatePublish(
      role,
      p,
      (host ?? null) as HostModuleRow | null,
      (guest ?? null) as GuestModuleRow | null,
      ((pts ?? []) as { topic_id: string }[]).map((r) => r.topic_id)
    );
    if (missing.length > 0) return { ok: false, missing };

    const { error } = await supabase
      .from("profiles")
      .update({ state: "published" })
      .eq("id", p.id)
      .in("state", ["draft", "paused"]);
    if (error) throw error;
    await logServerEvent(supabase, user.id, "profile_published", {
      role: String(role),
      from_state: p.state,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not publish your profile.",
    };
  }
}

export async function pauseProfile(): Promise<void> {
  const { supabase, user } = await authed();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/profile/builder");
  await supabase
    .from("profiles")
    .update({ state: "paused" })
    .eq("id", (profile as { id: string }).id)
    .eq("state", "published");
  redirect("/profile");
}

export async function resumeProfile(): Promise<void> {
  const { supabase, user } = await authed();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/profile/builder");
  await supabase
    .from("profiles")
    .update({ state: "published" })
    .eq("id", (profile as { id: string }).id)
    .eq("state", "paused");
  redirect("/profile");
}

// ---------------------------------------------------------------------------
// Photo upload (Sprint 2): real uploads to the profile-photos storage bucket.
// RLS allows each user to write only their own folder ({uid}/...).
// ---------------------------------------------------------------------------

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Verify the file's magic bytes match its claimed image type. The MIME
 *  type comes from the client and is trivially spoofable. */
async function hasValidImageSignature(
  file: File,
  ext: string
): Promise<boolean> {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (ext === "jpg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === "png") {
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (ext === "webp") {
    return (
      buf[0] === 0x52 && // "RIFF"
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 && // "WEBP"
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    );
  }
  return false;
}

/** Upload a profile photo. Returns the public URL and stores it on the draft. */
export async function uploadPhoto(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { supabase, user } = await authed();
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a photo to upload." };
    }
    const ext = ALLOWED_PHOTO_TYPES[file.type];
    if (!ext) {
      return { ok: false, error: "Photo must be a JPG, PNG, or WebP image." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: "Photo must be smaller than 5 MB." };
    }
    if (!(await hasValidImageSignature(file, ext))) {
      return {
        ok: false,
        error: "That file doesn't look like a real image. Try a different photo.",
      };
    }

    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("profile-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-photos").getPublicUrl(path);

    // Persist on the draft so a reload keeps the photo.
    const profile = await ensureProfile(supabase, user.id);
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ photo_url: publicUrl })
      .eq("id", profile.id);
    if (saveError) throw saveError;

    return { ok: true, url: publicUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not upload that photo.",
    };
  }
}

// ---------------------------------------------------------------------------
// DATA-01: account deletion — immediate hard purge.
// purge_user_data() (SECURITY DEFINER, Sprint 4 migration) snapshots abuse
// reports into retained_reports, deletes profile photos from storage, then
// deletes the auth.users row — cascading through users -> profiles ->
// modules, conversations + messages, blocks, quotas, reads, and events —
// and writes the completed deletion_requests audit row. See docs/RETENTION.md
// for exactly what is deleted immediately vs retained and why.
// ---------------------------------------------------------------------------

export async function requestDeletion(): Promise<void> {
  const { supabase, user } = await authed();
  const { error } = await supabase.rpc("purge_user_data");
  if (error) {
    throw new Error(
      "Could not delete your account right now. Please try again."
    );
  }
  // The auth user is gone; signOut may fail against the deleted session —
  // either way the user is logged out and we leave.
  try {
    await supabase.auth.signOut();
  } catch {
    /* already signed out by the purge */
  }
  redirect("/");
}
