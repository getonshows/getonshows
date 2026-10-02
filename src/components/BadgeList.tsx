import type { Badge } from "@/lib/badges";

const EARNED_STYLE = "border-brand bg-brand-light/40 text-navy-900";
const LOCKED_STYLE = "border-slate-200 bg-slate-50 text-slate-400";

export default function BadgeList({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned);
  return (
    <section
      aria-labelledby="badges-heading"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <h2 id="badges-heading" className="text-lg font-semibold text-navy-900">
        Achievements
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {earned.length === 0
          ? "Earn badges as you pitch, get replies, and book conversations."
          : `${earned.length} of ${badges.length} earned.`}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {badges.map((b) => (
          <li
            key={b.id}
            title={b.description}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              b.earned ? EARNED_STYLE : LOCKED_STYLE
            }`}
          >
            {b.earned ? "★ " : ""}
            {b.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
