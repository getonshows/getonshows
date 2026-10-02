import Link from "next/link";
import { getInboxThreads } from "@/lib/messaging";
import InboxList from "@/components/InboxList";

export const metadata = { title: "Inbox · GetOnShows" };

export default async function InboxPage() {
  const threads = await getInboxThreads();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-navy">Inbox</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your pitches and replies, newest first.
      </p>

      {threads.length === 0 ? (
        <div className="mt-10 rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">📮</p>
          <h2 className="mt-3 font-serif text-lg font-semibold text-navy">
            No conversations yet
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
            Find a great match on Discover and send your first pitch. Replies
            land here.
          </p>
          <Link
            href="/discover"
            className="tap-target mt-5 inline-block rounded-xl bg-navy-800 px-6 py-3 text-sm font-semibold text-white"
          >
            Browse Discover
          </Link>
        </div>
      ) : (
        <InboxList threads={threads} />
      )}
    </div>
  );
}
