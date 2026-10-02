import Image from "next/image";
import Link from "next/link";
import type { Collaboration } from "@/lib/types";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** What the booking row is allowed to claim: a mutually-confirmed recording,
 * a confirmed future booking, or a unilateral claim. */
function statusChip(c: Collaboration): { label: string; classes: string } {
  if (c.completed_at) {
    return { label: "Recorded", classes: "bg-teal-100 text-teal-800" };
  }
  return { label: "Claimed", classes: "bg-amber-100 text-amber-800" };
}

/** Booked collaborations, with links to each collaborator's profile.
 * Listed from conversation state "booked": that means a booking was claimed
 * or confirmed, not that the recording happened. Copy must not claim a
 * completed recording. */
export default function Collaborations({
  items,
}: {
  items: Collaboration[];
}) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="collabs-heading"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <h2
        id="collabs-heading"
        className="text-lg font-semibold text-navy-900"
      >
        Bookings
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((c) => {
          const date = formatDate(c.booked_at);
          const chip = statusChip(c);
          return (
            <li key={c.profile_id}>
              <Link
                href={`/p/${c.profile_id}`}
                className="tap-target flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50"
              >
                {c.photo_url ? (
                  <Image
                    src={c.photo_url}
                    alt={`Photo of ${c.display_name ?? "collaborator"}`}
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-800 text-base font-bold text-white"
                  >
                    {(c.display_name ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-900">
                    {c.display_name ?? "Member"}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span
                      className={`h-2 w-2 rounded-full ${c.my_role === "host" ? "bg-brand" : "bg-navy-800"}`}
                      aria-hidden="true"
                    />
                    {c.my_role === "host" ? "Booked as host" : "Booked as guest"}
                    {date ? ` · ${date}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.classes}`}
                >
                  {chip.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
