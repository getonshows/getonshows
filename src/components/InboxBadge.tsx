"use client";

import { useEffect, useState } from "react";
import { getUnreadCount } from "@/lib/messaging";

/** Unread-message badge for the Inbox nav tab. Refreshes every 30s. */
export default function InboxBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getUnreadCount()
        .then((n) => {
          if (alive) setCount(n);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread messages`}
      className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
