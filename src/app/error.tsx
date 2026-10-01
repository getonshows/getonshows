"use client";

/**
 * Route-level failure state for the public screens (landing, login,
 * onboarding). Same recovery contract as the authenticated boundary.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div
          role="alert"
          className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200"
        >
          <h1 className="text-xl font-bold text-navy-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We couldn't load this page. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="tap-target mt-5 w-full rounded-xl bg-navy-800 px-6 font-semibold text-white hover:bg-navy-900"
          >
            Try again
          </button>
          {error.digest && (
            <p className="mt-4 text-xs text-slate-500">Ref: {error.digest}</p>
          )}
        </div>
      </main>
    </div>
  );
}
