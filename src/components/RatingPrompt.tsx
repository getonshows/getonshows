"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyRating, submitRating } from "@/lib/ratings";

/** Rate the other party after both sides confirmed the recording. */
export default function RatingPrompt({
  conversationId,
  otherName,
  otherRole,
}: {
  conversationId: string;
  otherName: string;
  otherRole: "host" | "guest";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<{
    stars: number;
    comment: string | null;
  } | null>(null);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    getMyRating(conversationId).then((r) => {
      if (!live) return;
      setExisting(r);
      if (r) {
        setStars(r.stars);
        setComment(r.comment ?? "");
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [conversationId]);

  async function save() {
    if (stars < 1 || stars > 5) {
      setError("Tap the stars to pick a rating.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitRating(conversationId, stars, comment);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setExisting({ stars, comment: comment.trim() || null });
    router.refresh();
  }

  if (loading) return null;

  if (saved || existing) {
    return (
      <div className="mx-auto mt-3 max-w-xs rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
        <p className="text-sm font-semibold text-amber-900">
          You rated {otherName} {"★".repeat(existing?.stars ?? stars)}
          {"☆".repeat(5 - (existing?.stars ?? stars))}
        </p>
        {!saved && (
          <button
            type="button"
            onClick={() => setExisting(null)}
            className="mt-1 text-xs font-semibold text-amber-700 underline"
          >
            Update my rating
          </button>
        )}
        {saved && (
          <p className="mt-1 text-xs text-amber-700">
            Thanks! Your rating is live on their profile.
          </p>
        )}
      </div>
    );
  }

  const active = hover || stars;

  return (
    <div className="mx-auto mt-3 max-w-xs rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-sm font-semibold text-navy-900">
        How was {otherName} as {otherRole === "host" ? "a host" : "a guest"}?
      </p>
      <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="tap-target px-1 text-3xl"
          >
            <span className={n <= active ? "text-amber-400" : "text-slate-300"}>
              ★
            </span>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="What stood out? (optional)"
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-coral">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="tap-target mt-2 w-full rounded-xl bg-navy-800 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-900 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Submit rating"}
      </button>
    </div>
  );
}
