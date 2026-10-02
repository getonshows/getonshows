import Image from "next/image";
import Link from "next/link";
import type { Collaboration } from "@/lib/types";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Past booked collaborations, with links to each collaborator's profile. */
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
        Past collaborations
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((c) => {
          const date = formatDate(c.booked_at);
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
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">
                    {c.display_name ?? "Member"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.my_role === "host" ? "You hosted" : "You guested"}
                    {date ? ` · ${date}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
