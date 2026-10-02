import type {
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  Role,
  TopicRow,
} from "@/lib/types";
import RoleBadge, { roleFromModules } from "./RoleBadge";
import { summarizeAvailability } from "@/lib/availability";
import { normalizeUrl, isHostModuleComplete, isGuestModuleComplete } from "@/lib/publish-validation";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LinkList({ links }: { links: { label: string; url: string }[] }) {
  const usable = links.filter((l) => l.url.trim() !== "");
  if (usable.length === 0) return null;
  return (
    <ul className="space-y-2">
      {usable.map((l, i) => (
        <li key={i}>
          <a
            href={normalizeUrl(l.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-dark underline"
          >
            {l.label.trim() !== "" ? l.label : l.url}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Renders a published profile as a professional one-sheet:
 * identity, topics, modules, links; no dating-card vibes.
 */
export default function OneSheet({
  profile,
  hostModule,
  guestModule,
  topics,
  role,
  matchReasons,
  ratings,
}: {
  profile: ProfileRow;
  hostModule: HostModuleRow | null;
  guestModule: GuestModuleRow | null;
  topics: TopicRow[];
  /** Canonical users.role. When provided, the badge and visible sections
   * follow it; otherwise they are derived from the complete modules. */
  role?: Role | null;
  /** Why this profile matches the viewer (discovery only). */
  matchReasons?: string[];
  /** Compact rating summary shown under the name. */
  ratings?: {
    as_host: { avg: number; count: number } | null;
    as_guest: { avg: number; count: number } | null;
  } | null;
}) {
  const formatLabels: Record<string, string> = {
    remote: "Remote",
    in_person: "In person",
    both: "Remote or in person",
  };

  // Role sections: complete module AND included in the canonical role.
  const showHostSection =
    !role || role === "host" || role === "dual";
  const showGuestSection =
    !role || role === "guest" || role === "dual";
  const badgeRole: Role =
    role ??
    roleFromModules(
      isHostModuleComplete(hostModule) ? hostModule : null,
      isGuestModuleComplete(guestModule) ? guestModule : null
    );

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-navy-800 p-6 text-white">
        <div className="flex items-start gap-4">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photo_url}
              alt={`Photo of ${profile.display_name}`}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-white/20"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-navy-700 text-2xl font-bold text-navy-200"
            >
              {(profile.display_name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            {profile.title && (
              <p className="mt-1 text-navy-100">{profile.title}</p>
            )}
            {profile.location && (
              <p className="mt-1 text-sm text-navy-200">📍 {profile.location}</p>
            )}
            <div className="mt-2">
              <RoleBadge role={badgeRole} />
            </div>
            {ratings && (ratings.as_host || ratings.as_guest) && (
              <p className="mt-2 text-sm text-navy-100">
                <span className="text-amber-300">★</span>{" "}
                {[
                  ratings.as_host
                    ? `${ratings.as_host.avg.toFixed(1)} as host (${ratings.as_host.count})`
                    : null,
                  ratings.as_guest
                    ? `${ratings.as_guest.avg.toFixed(1)} as guest (${ratings.as_guest.count})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="mt-4 leading-relaxed text-navy-100">{profile.bio}</p>
        )}
      </header>

      {matchReasons && matchReasons.length > 0 && (
        <Section title="Why this match">
          <ul className="space-y-1.5">
            {matchReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                />
                {r}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {topics.length > 0 && (
        <Section title="Topics">
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li
                key={t.id}
                className="rounded-full bg-navy-100 px-3 py-1.5 text-sm font-medium text-navy-900"
              >
                {t.label}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {showHostSection && isHostModuleComplete(hostModule) && (
        <Section title="As a host">
          <dl className="space-y-3">
            {hostModule.show_name && (
              <div>
                <dt className="text-sm text-slate-500">Show</dt>
                <dd className="font-semibold text-navy-900">
                  {hostModule.show_url ? (
                    <a
                      href={normalizeUrl(hostModule.show_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-dark underline"
                    >
                      {hostModule.show_name}
                    </a>
                  ) : (
                    hostModule.show_name
                  )}
                </dd>
              </div>
            )}
            {hostModule.format && (
              <div>
                <dt className="text-sm text-slate-500">Format</dt>
                <dd className="font-medium text-navy-900">
                  {formatLabels[hostModule.format] ?? hostModule.format}
                  {hostModule.cadence ? ` · ${hostModule.cadence}` : ""}
                </dd>
              </div>
            )}
            {hostModule.guest_brief && (
              <div>
                <dt className="text-sm text-slate-500">
                  Conversations I want to have
                </dt>
                <dd className="whitespace-pre-line text-navy-900">
                  {hostModule.guest_brief}
                </dd>
              </div>
            )}
            {hostModule.guest_criteria && (
              <div>
                <dt className="text-sm text-slate-500">Looking for guests who…</dt>
                <dd className="whitespace-pre-line text-navy-900">
                  {hostModule.guest_criteria}
                </dd>
              </div>
            )}
            {hostModule.booking_url && (
              <div>
                <a
                  href={normalizeUrl(hostModule.booking_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target inline-flex items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark"
                >
                  Book a recording slot
                </a>
              </div>
            )}
          </dl>
        </Section>
      )}

      {showGuestSection && isGuestModuleComplete(guestModule) && (
        <Section title="As a guest">
          <dl className="space-y-3">
            {guestModule.expertise && (
              <div>
                <dt className="text-sm text-slate-500">Expertise</dt>
                <dd className="whitespace-pre-line text-navy-900">
                  {guestModule.expertise}
                </dd>
              </div>
            )}
            {guestModule.talking_points.length > 0 && (
              <div>
                <dt className="text-sm text-slate-500">Talking points</dt>
                <dd>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-navy-900">
                    {guestModule.talking_points.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {guestModule.proof_links.length > 0 && (
              <div>
                <dt className="text-sm text-slate-500">Proof</dt>
                <dd className="mt-1">
                  <LinkList links={guestModule.proof_links} />
                </dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      {(profile.links.length > 0 ||
        profile.timezone ||
        profile.availability_notes ||
        summarizeAvailability(profile.availability)) && (
        <Section title="Links & availability">
          <LinkList links={profile.links} />
          {profile.timezone && (
            <p className="mt-2 text-sm text-slate-600">
              Time zone: {profile.timezone}
            </p>
          )}
          {(() => {
            const summary = summarizeAvailability(profile.availability);
            return summary ? (
              <p className="mt-1 text-sm text-slate-600">
                Generally free: {summary}
              </p>
            ) : null;
          })()}
          {profile.availability_notes && (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
              {profile.availability_notes}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
