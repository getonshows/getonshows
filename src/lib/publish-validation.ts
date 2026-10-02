import type {
  GuestModuleRow,
  HostModuleRow,
  Role,
} from "@/lib/types";

export function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return v;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) ? v : `https://${v}`;
}

export function isUrl(value: string): boolean {
  try {
    const u = new URL(normalizeUrl(value));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Whether a role section is complete enough to show publicly. A module row
 * exists as soon as the builder saves a draft, so "row exists" is not the
 * same as "ready to display". Incomplete sections stay hidden on the
 * public one-sheet instead of rendering empty.
 */
export function isHostModuleComplete(host: HostModuleRow | null): host is HostModuleRow {
  return !!(
    host?.show_name?.trim() &&
    host?.format &&
    host?.guest_criteria?.trim() &&
    host?.guest_brief?.trim()
  );
}

export function isGuestModuleComplete(guest: GuestModuleRow | null): guest is GuestModuleRow {
  return !!(
    guest?.expertise?.trim() &&
    guest?.talking_points?.some((t) => t.trim() !== "")
  );
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
    if (host?.show_url?.trim() && !isUrl(host.show_url)) {
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
    if (links.some((l) => l.url?.trim() && !isUrl(l.url))) {
      missing.push("Proof link (must be a valid URL)");
    }
    if (guest?.booking_url?.trim() && !isUrl(guest.booking_url)) {
      missing.push("Guest booking link (must be a valid URL)");
    }
  }
  return missing;
}
