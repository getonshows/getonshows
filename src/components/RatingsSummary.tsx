import Image from "next/image";

export interface RatingSummary {
  as_host: { avg: number; count: number } | null;
  as_guest: { avg: number; count: number } | null;
  reviews: {
    rater_name: string | null;
    rater_photo: string | null;
    stars: number;
    comment: string | null;
    rated_role: string;
    created_at: string;
  }[];
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-400" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(Math.round(n))}
      {"☆".repeat(5 - Math.round(n))}
    </span>
  );
}

/** Aggregate ratings + recent reviews for a profile. */
export default function RatingsSummary({ ratings }: { ratings: RatingSummary | null }) {
  if (!ratings) return null;
  const parts: { label: string; avg: number; count: number }[] = [];
  if (ratings.as_host) parts.push({ label: "as host", ...ratings.as_host });
  if (ratings.as_guest) parts.push({ label: "as guest", ...ratings.as_guest });
  if (parts.length === 0 && ratings.reviews.length === 0) return null;

  return (
    <section
      aria-label="Ratings"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Ratings
      </h2>
      {parts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {parts.map((p) => (
            <p key={p.label} className="text-sm text-navy-900">
              <Stars n={p.avg} />{" "}
              <span className="font-bold">{p.avg.toFixed(1)}</span>{" "}
              <span className="text-slate-500">
                {p.label} · {p.count} {p.count === 1 ? "rating" : "ratings"}
              </span>
            </p>
          ))}
        </div>
      )}
      {ratings.reviews.length > 0 && (
        <ul className="mt-4 space-y-3">
          {ratings.reviews.map((r, i) => (
            <li key={i} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2">
                {r.rater_photo ? (
                  <Image
                    src={r.rater_photo}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                    {(r.rater_name ?? "?").charAt(0)}
                  </span>
                )}
                <p className="text-xs font-semibold text-navy-900">
                  {r.rater_name ?? "A member"}
                  <span className="ml-1 font-normal text-slate-500">
                    rated them {r.rated_role === "host" ? "as host" : "as guest"}
                  </span>
                </p>
                <span className="ml-auto text-xs text-amber-400">
                  {"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}
                </span>
              </div>
              {r.comment && (
                <p className="mt-1 text-sm text-slate-600">“{r.comment}”</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
