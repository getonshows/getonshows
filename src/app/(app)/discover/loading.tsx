function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-100" />
        </div>
        <div className="h-14 w-16 rounded-xl bg-slate-100" />
      </div>
      <div className="mt-3 h-4 w-3/4 rounded bg-slate-100" />
    </div>
  );
}

export default function DiscoverLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-5" aria-label="Loading matches">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-12 animate-pulse rounded-xl bg-white ring-1 ring-slate-200" />
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
