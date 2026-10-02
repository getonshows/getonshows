import Image from "next/image";
import Link from "next/link";
import IcsButton from "@/components/IcsButton";
import { formatInTz } from "@/lib/booking-utils";
import type { UpcomingBooking } from "@/lib/types";

/** Confirmed upcoming recordings, so nothing slips. Hidden when empty. */
export default function UpcomingBookings({
  items,
  viewerTimezone,
  viewerName,
}: {
  items: UpcomingBooking[];
  viewerTimezone: string;
  viewerName: string;
}) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="upcoming-heading"
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
    >
      <h2
        id="upcoming-heading"
        className="text-lg font-semibold text-navy-900"
      >
        Upcoming bookings
      </h2>
      <ul className="mt-3 space-y-3">
        {items.map((b) => (
          <li
            key={b.requestId}
            className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"
          >
            {b.otherPhotoUrl ? (
              <Image
                src={b.otherPhotoUrl}
                alt={`Photo of ${b.otherName}`}
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-800 text-base font-bold text-white"
              >
                {b.otherName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900">
                <Link
                  href={`/p/${b.otherProfileId}`}
                  className="hover:underline"
                >
                  {b.otherName}
                </Link>
              </p>
              <p className="text-xs text-slate-500">
                📅 {formatInTz(b.acceptedSlot, viewerTimezone)} ·{" "}
                {b.myRole === "host" ? "You host" : "You guest"}
              </p>
            </div>
            <IcsButton
              title={`Podcast recording: ${viewerName} x ${b.otherName}`}
              startUtc={b.acceptedSlot}
              otherName={b.otherName}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
