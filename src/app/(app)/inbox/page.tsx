import Link from "next/link";
import { getInboxThreads } from "@/lib/messaging";
import { IntentBadge } from "@/components/ThreadView";

export const metadata = { title: "Inbox · GetOnShows" };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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
            className="tap-target mt-5 inline-block rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
          >
            Browse Discover
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {threads.map((t) => (
            <li key={t.conversation.id}>
              <Link
                href={`/inbox/${t.conversation.id}`}
                className="tap-target flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm transition hover:shadow"
              >
                <span className="relative shrink-0">
                  {t.other.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.other.photoUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-base font-semibold text-white">
                      {t.other.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  {t.unreadCount > 0 && (
                    <span
                      aria-label={`${t.unreadCount} unread`}
                      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-white"
                    >
                      {t.unreadCount > 9 ? "9+" : t.unreadCount}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${
                        t.unreadCount > 0
                          ? "font-bold text-navy"
                          : "font-semibold text-navy"
                      }`}
                    >
                      {t.other.displayName}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {timeAgo(t.lastMessage?.created_at ?? t.conversation.created_at)}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-sm ${
                      t.unreadCount > 0 ? "font-medium text-navy" : "text-slate-500"
                    }`}
                  >
                    {t.lastMessage
                      ? t.lastMessage.sender_profile_id === t.myProfileId
                        ? `You: ${t.lastMessage.body}`
                        : t.lastMessage.body
                      : "Say hello 👋"}
                  </span>
                  <span className="mt-1.5 block">
                    <IntentBadge state={t.conversation.state} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
