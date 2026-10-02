import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logServerEvent } from "@/lib/messaging";

export const dynamic = "force-dynamic";

interface StageCount {
  stage: string;
  users: number;
}

interface SourceCount {
  source: string;
  signups: number;
}

const STAGE_LABELS: Record<string, string> = {
  signup: "Signed up",
  profile_published: "Published profile",
  match_opened: "Opened a match",
  pitch_sent: "Sent a pitch",
  message_replied: "Got a reply",
  booking_marked: "Marked booked",
  recording_completed: "Confirmed recording",
};

const BUILDER_STEP_LABELS: Record<string, string> = {
  basics: "Basics",
  topics: "Topics",
  show: "Your show",
  story: "Your story",
  review: "Review and publish",
};

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

/**
 * ALL #6: minimal owner-only funnel. Counts per stage and stage-to-stage
 * conversion for the last 30 days, via the funnel_counts() SECURITY DEFINER
 * function (aggregates only; no row-level data leaves the database).
 * Non-allowlisted users get a 404. Every view is logged to the event trail.
 */
export default async function FunnelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) notFound();

  await logServerEvent(supabase, user.id, "admin_view", { page: "funnel" });

  const { data, error } = await supabase.rpc("funnel_counts");
  const funnel = (data ?? { stages: [], by_source: [], builder: [] }) as {
    since: string;
    stages: StageCount[];
    by_source: SourceCount[];
    builder: { step: string; users: number }[];
  };

  const stages = funnel.stages ?? [];
  const bySource = (funnel.by_source ?? []).sort((a, b) => b.signups - a.signups);
  const builderSteps = funnel.builder ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Funnel</h1>
        <p className="mt-1 text-sm text-slate-600">
          Distinct users per stage, last 30 days. Counts reconcile with the
          events table; no message bodies, ever.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
          Couldn't load funnel counts. The database function may not be applied yet.
        </p>
      )}

      <section aria-label="Funnel stages" className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th scope="col" className="px-4 py-3 font-semibold text-navy-900">Stage</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy-900">Users</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy-900">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => {
              const prev = i > 0 ? stages[i - 1].users : null;
              const conv =
                prev !== null && prev > 0
                  ? `${Math.round((s.users / prev) * 100)}%`
                  : i === 0
                    ? "-"
                    : "n/a";
              return (
                <tr key={s.stage} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-900">
                    {STAGE_LABELS[s.stage] ?? s.stage}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.users}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{conv}</td>
                </tr>
              );
            })}
            {stages.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No events in the last 30 days yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section aria-label="Profile builder drop-off" className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-navy-900">
          Profile builder
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th scope="col" className="px-4 py-3 font-semibold text-navy-900">Step</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy-900">Users</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-navy-900">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {builderSteps.map((s, i) => {
              const prev = i > 0 ? builderSteps[i - 1].users : null;
              const conv =
                prev !== null && prev > 0
                  ? `${Math.round((s.users / prev) * 100)}%`
                  : i === 0
                    ? "-"
                    : "n/a";
              return (
                <tr key={s.step} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-900">
                    {BUILDER_STEP_LABELS[s.step] ?? s.step}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.users}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{conv}</td>
                </tr>
              );
            })}
            {builderSteps.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No builder activity in the last 30 days yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          The show and story steps only apply to matching roles, so a dip at
          those steps is expected rather than abandonment.
        </p>
      </section>

      <section aria-label="Signups by source" className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-navy-900">
          Signups by source
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {bySource.map((r) => (
              <tr key={r.source} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-navy-900">{r.source}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.signups}</td>
              </tr>
            ))}
            {bySource.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500">
                  No signups in the last 30 days yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-slate-500">
        Source is captured from ?utm_source= (or ?ref=) on first visit and
        stamped on every event. Stages count distinct users; a user counts
        once per stage.
      </p>
    </div>
  );
}
