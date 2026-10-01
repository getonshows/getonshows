import type {
  GuestModuleRow,
  HostModuleRow,
  Role,
} from "@/lib/types";

export function isUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * PRO-02 publish gate. Returns a list of human-readable missing fields;
 * an empty list means the profile may be published. Runs identically on
 * the client (live guidance) and the server (enforcement).
 */
export function validatePublish(
  role: Role,
  profile: { display_name: string | null; bio: string | null },
  host: HostModuleRow | null,
  guest: GuestModuleRow | null,
  topicIds: string[]
): string[] {
  const missing: string[] = [];
  if (!profile.display_name || profile.display_name.trim().length < 2) {
    missing.push("Your name");
  }
  if (!profile.bio || profile.bio.trim().length < 40) {
    missing.push("Bio (at least 40 characters)");
  }
  if (topicIds.length === 0) {
    missing.push("At least one topic");
  }
  if (role === "host" || role === "dual") {
    if (!host?.show_name?.trim()) missing.push("Show name");
    if (!host?.show_url?.trim() || !isUrl(host.show_url)) {
      missing.push("Show URL (must be a valid link)");
    }
    if (!host?.format) missing.push("Interview format (remote, in-person, or both)");
    if (!host?.guest_criteria?.trim()) missing.push("Guest criteria");
    if (!host?.guest_brief?.trim())
      missing.push("Conversations you want to have");
    if (host?.booking_url?.trim() && !isUrl(host.booking_url)) {
      missing.push("Host booking link (must be a valid URL)");
    }
  }
  if (role === "guest" || role === "dual") {
    if (!guest?.expertise?.trim()) missing.push("Expertise / story");
    if (!guest || !guest.talking_points.some((t) => t.trim() !== "")) {
      missing.push("At least one talking point");
    }
    const links = guest?.proof_links ?? [];
    if (!links.some((l) => l.url && isUrl(l.url))) {
      missing.push("At least one proof link (valid URL)");
    }
    if (guest?.booking_url?.trim() && !isUrl(guest.booking_url)) {
      missing.push("Guest booking link (must be a valid URL)");
    }
  }
  return missing;
}
