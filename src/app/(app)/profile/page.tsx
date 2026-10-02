import Image from "next/image";
import Link from "next/link";
import {
  loadProfileHome,
  loadProfileStats,
  loadCollaborations,
  pauseProfile,
  resumeProfile,
  requestDeletion,
  signOut,
} from "@/lib/actions";
import { computeBadges } from "@/lib/badges";
import RoleSwitcher from "@/components/RoleSwitcher";
import BadgeList from "@/components/BadgeList";
import Collaborations from "@/components/Collaborations";
import ShareProfile from "@/components/ShareProfile";

function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    host: "Host",
    guest: "Guest",
    dual: "Host + Guest",
  };
  return (
    <span className="inline-block rounded-full bg-navy-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
      {labels[role] ?? role}
    </span>
  );
}

function StateCard({
  state,
  completeness,
}: {
  state: string;
  completeness: number;
}) {
  if (state === "draft") {
    return (
      <section aria-labelledby="draft-heading" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 id="draft-heading" className="text-lg font-semibold text-navy-900">
          Your profile is a draft
        </h2>
        <p className="mt-1 text-slate-600">
          Only you can see it. Publish it to appear in discovery.
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Completeness</span>
            <span className="font-semibold text-navy-900">{completeness}%</span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={completeness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completeness"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${completeness}%` }} />
          </div>
        </div>
        <Link
          href="/profile/builder"
          className="tap-target mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark"
        >
          Continue building
        </Link>
      </section>
    );
  }

  if (state === "published") {
    return (
      <section aria-labelledby="live-heading" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 id="live-heading" className="text-lg font-semibold text-navy-900">
          Your profile is live
        </h2>
        <p className="mt-1 text-slate-600">
          It appears in discovery. Pause it any time to hide it without losing
          your work.
        </p>
        <div className="mt-4">
          <form action={pauseProfile}>
            <button
              type="submit"
              className="tap-target w-full rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
            >
              Pause profile
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (state === "paused") {
    return (
      <section aria-labelledby="paused-heading" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 id="paused-heading" className="text-lg font-semibold text-navy-900">
          Your profile is paused
        </h2>
        <p className="mt-1 text-slate-600">
          Hidden from discovery. Your drafts and history are kept.
        </p>
        <form action={resumeProfile} className="mt-4">
          <button
            type="submit"
            className="tap-target w-full rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark"
          >
            Resume profile
          </button>
        </form>
      </section>
    );
  }

  return null;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center ring-1 ring-slate-200">
      <p className="text-2xl font-extrabold text-navy-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default async function ProfileHomePage() {
  const { userRow, profile, hasHostModule, hasGuestModule, topicCount } =
    await loadProfileHome();
  const stats = await loadProfileStats();
  const collaborations = await loadCollaborations();

  // Task 0 edge: after switching to a role whose module was never started,
  // guide to the builder (link, never an auto-redirect).
  const needsHostModule =
    (userRow.role === "host" || userRow.role === "dual") && !hasHostModule;
  const needsGuestModule =
    (userRow.role === "guest" || userRow.role === "dual") && !hasGuestModule;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = adminEmails.includes((userRow.email ?? "").toLowerCase());

  const badges = computeBadges({
    published: profile?.state === "published",
    pitchesSent: stats.pitchesSent,
    bookings: stats.bookings,
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section
        aria-labelledby="identity-heading"
        className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
      >
        <div className="flex items-center gap-4">
          {profile?.photo_url ? (
            <Image
              src={profile.photo_url}
              alt={`Photo of ${profile.display_name ?? "you"}`}
              width={72}
              height={72}
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy-800 text-2xl font-bold text-white"
            >
              {(profile?.display_name ?? userRow.email ?? "?")
                .slice(0, 1)
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1
              id="identity-heading"
              className="truncate text-2xl font-bold text-navy-900"
            >
              {profile?.display_name ?? "Your profile"}
            </h1>
            {profile?.title && (
              <p className="truncate text-sm text-slate-600">{profile.title}</p>
            )}
            <div className="mt-1.5">
              <RoleBadge role={userRow.role} />
            </div>
          </div>
        </div>
        {profile?.bio && (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {profile.bio}
          </p>
        )}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your role
          </p>
          <RoleSwitcher currentRole={userRow.role as "host" | "guest" | "dual"} />
        </div>
        <div className="mt-4 flex gap-2">
          {profile && (
            <Link
              href="/profile/view"
              className="tap-target inline-flex flex-1 items-center justify-center rounded-xl bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-900"
            >
              View one-sheet
            </Link>
          )}
          <Link
            href="/profile/builder"
            className="tap-target inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
          >
            Edit profile
          </Link>
        </div>
      </section>

      {(needsHostModule || needsGuestModule) && (
        <section
          aria-label="Finish your profile"
          className="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200"
        >
          <h2 className="text-lg font-semibold text-navy-900">
            {needsHostModule && needsGuestModule
              ? "Finish both sides of your profile"
              : needsHostModule
                ? "Finish your host side"
                : "Finish your guest side"}
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            You switched roles. Your existing data is safe. Complete the{" "}
            {needsHostModule && needsGuestModule
              ? "host and guest modules"
              : needsHostModule
                ? "host module"
                : "guest module"}{" "}
            to publish in this role.
          </p>
          <Link
            href="/profile/builder"
            className="tap-target mt-4 inline-flex w-full items-center justify-center rounded-xl bg-navy-800 px-6 font-semibold text-white hover:bg-navy-900"
          >
            Open the profile builder
          </Link>
        </section>
      )}

      <section aria-label="Your outreach activity" className="grid grid-cols-3 gap-3">
        <StatCard label="Outreach sent" value={stats.pitchesSent} />
        <StatCard label="Pitches left today" value={stats.quotaRemaining} />
        <StatCard label="Bookings" value={stats.bookings} />
      </section>

      <BadgeList badges={badges} />

      <Collaborations items={collaborations} />

      {profile?.state === "published" && (
        <ShareProfile
          profileId={profile.id}
          displayName={profile.display_name ?? "Member"}
        />
      )}

      {profile ? (
        <StateCard state={profile.state} completeness={profile.completeness} />
      ) : (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-navy-900">
            Start your profile
          </h2>
          <p className="mt-1 text-slate-600">
            A credible card is the price of admission to good matches.
          </p>
          <Link
            href="/profile/builder"
            className="tap-target mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark"
          >
            Build my profile
          </Link>
        </section>
      )}

      {profile && (
        <section aria-labelledby="modules-heading" className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 id="modules-heading" className="text-lg font-semibold text-navy-900">
            Profile modules
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            {(userRow.role === "host" || userRow.role === "dual") && (
              <div className="flex justify-between">
                <dt className="text-slate-600">Host module</dt>
                <dd className="font-semibold text-navy-900">
                  {hasHostModule ? "Started" : "Not started"}
                </dd>
              </div>
            )}
            {(userRow.role === "guest" || userRow.role === "dual") && (
              <div className="flex justify-between">
                <dt className="text-slate-600">Guest module</dt>
                <dd className="font-semibold text-navy-900">
                  {hasGuestModule ? "Started" : "Not started"}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-600">Topics</dt>
              <dd className="font-semibold text-navy-900">{topicCount} selected</dd>
            </div>
          </dl>
          <Link
            href="/profile/builder"
            className="tap-target mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
          >
            Edit profile
          </Link>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-navy-900">Account</h2>
        <p className="mt-1 text-sm text-slate-600">{userRow.email}</p>
        {isAdmin && (
          <Link
            href="/admin/funnel"
            className="tap-target mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
          >
            Owner funnel dashboard
          </Link>
        )}
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="tap-target w-full rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
        <details className="mt-4 rounded-xl bg-slate-50 p-4">
          <summary className="tap-target cursor-pointer font-semibold text-red-700">
            Delete my account
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            This immediately and permanently deletes your account: your
            profile, conversations, messages, pitches, and blocks. Abuse
            reports involving your account are kept as ID-only records for 12
            months (see the data policy). This cannot be undone.
          </p>
          <form action={requestDeletion} className="mt-3 scroll-mb-28">
            <button
              type="submit"
              className="tap-target w-full scroll-mb-28 rounded-xl bg-red-700 px-6 font-semibold text-white hover:bg-red-800"
            >
              Yes, delete everything
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
