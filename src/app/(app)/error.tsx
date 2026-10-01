"use client";

/**
 * Route-level failure state for the authenticated app. Catches render/data
 * failures (e.g. the database is unreachable) and offers a retry instead of
 * a dead end. Per the resilience audit: every screen explains recovery.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div
        role="alert"
        className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200"
      >
        <h1 className="text-xl font-bold text-navy-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We couldn't load this screen. Your data is safe — this is usually a
          connection hiccup.
        </p>
        <button
          type="button"
          onClick={reset}
          className="tap-target mt-5 inline-flex w-full items-center justify-center rounded-xl bg-navy-800 px-6 font-semibold text-white hover:bg-navy-900"
        >
          Try again
        </button>
        <a
          href="/discover"
          className="tap-target mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
        >
          Back to Discover
        </a>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-500">Ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
