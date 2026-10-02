import type { Role } from "@/lib/types";

/**
 * Small role indicator: a colored dot plus label, used everywhere a person
 * appears (match cards, one-sheets, public profiles, identity cards).
 * Host = brand coral, guest = navy. Dual shows both dots.
 */
export default function RoleBadge({
  role,
  className = "",
}: {
  role: Role | "dual";
  className?: string;
}) {
  if (role === "dual") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-navy-900 ring-1 ring-slate-200 ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
        <span className="h-2 w-2 rounded-full bg-navy-800" aria-hidden="true" />
        Host &amp; Guest
      </span>
    );
  }
  const isHost = role === "host";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${
        isHost ? "bg-brand" : "bg-navy-800"
      } ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-white/90" aria-hidden="true" />
      {isHost ? "Host" : "Guest"}
    </span>
  );
}

/** Role of a profile from its modules (both modules = dual). */
export function roleFromModules(
  hostModule: unknown,
  guestModule: unknown
): Role | "dual" {
  if (hostModule && guestModule) return "dual";
  if (hostModule) return "host";
  return "guest";
}
