import Link from "next/link";
import PitchButton from "@/components/PitchButton";
import RoleBadge, { roleFromModules } from "@/components/RoleBadge";
import type { RankedCandidate } from "@/lib/ranking";

const FORMAT_LABELS: Record<string, string> = {
  remote: "Remote",
  in_person: "In person",
  both: "Remote or in person",
};

/**
 * The score is a weighted heuristic, not a measurement: present it as a
 * band ("Strong match") with the number as supporting detail, never as a
 * precise claim.
 */
function bandFor(score: number): { label: string; classes: string } {
  if (score >= 85)
    return { label: "Strong match", classes: "bg-brand-light text-brand-dark" };
  if (score >= 70)
    return { label: "Good match", classes: "bg-teal-100 text-teal-800" };
  if (score >= 55)
    return { label: "Possible match", classes: "bg-sky/15 text-navy" };
  return { label: "New angle", classes: "bg-slate-100 text-slate-600" };
}

const MEDIUM_LABELS: Record<string, string> = {
  audio: "Audio",
  video: "Video",
  both: "Audio & video",
};

/**
 * One ranked discovery result: identity, top topics, format, score, reasons.
 * Tapping the card opens the full one-sheet; the footer actions pitch or view.
 */
export default function MatchCard({
  match,
  asRole,
}: {
  match: RankedCandidate;
  /** Role the viewer pitches as: "guest" when browsing shows, "host" when browsing guests. */
  asRole: "host" | "guest";
}) {
  const p = match.profile;
  const band = bandFor(match.score);
  const headline =
    match.hostModule?.show_name ??
    match.guestModule?.expertise ??
    p.title ??
    "";
  const formatBits: string[] = [];
  if (match.hostModule?.format) {
    formatBits.push(FORMAT_LABELS[match.hostModule.format] ?? "");
  }
  if (match.hostModule?.medium) {
    formatBits.push(MEDIUM_LABELS[match.hostModule.medium] ?? "");
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition hover:ring-navy-800">
      <Link
        href={`/discover/${p.id}?from=discover`}
        className="tap-target block p-5"
      >
        <div className="flex items-start gap-4">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photo_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy-100 text-xl font-bold text-navy-700"
          >
            {(p.display_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-navy-900">
            {p.display_name}
          </h2>
          {headline && (
            <p className="line-clamp-2 text-sm text-slate-600">{headline}</p>
          )}
          {p.location && (
            <p className="truncate text-sm text-slate-500">📍 {p.location}</p>
          )}
          <div className="mt-1.5">
            <RoleBadge
              role={roleFromModules(match.hostModule, match.guestModule)}
            />
          </div>
          {formatBits.length > 0 && (
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              {formatBits.filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div
          className={`shrink-0 rounded-xl px-3 py-2 text-center ${band.classes}`}
          aria-label={`${band.label}, score ${match.score} out of 100`}
          title={`Match score ${match.score}/100`}
        >
          <p className="whitespace-nowrap text-sm font-bold">{band.label}</p>
          <p className="text-[11px] font-semibold uppercase opacity-80">
            {match.score}
          </p>
        </div>
      </div>

      {match.topics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
          {match.topics.slice(0, 3).map((t) => (
            <li
              key={t.id}
              className="rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-900"
            >
              {t.label}
            </li>
          ))}
        </ul>
      )}

      {match.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {match.reasons.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-slate-700"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              />
              {r}
            </li>
          ))}
        </ul>
      )}
      </Link>
      <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
        <PitchButton
          targetProfileId={p.id}
          asRole={asRole}
          label={asRole === "guest" ? "Pitch as guest" : "Invite as guest"}
          className="flex-1"
        />
        <Link
          href={`/discover/${p.id}?from=discover`}
          className="tap-target rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-slate-50"
        >
          View
        </Link>
      </div>
    </article>
  );
}
