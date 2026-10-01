export default function InboxLoading() {
  return (
    <div aria-label="Loading inbox" className="space-y-2.5">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm"
        >
          <div className="h-12 w-12 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
