"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { blockUser } from "@/lib/messaging";
import ReportDialog from "@/components/ReportDialog";

/** Block + Report controls for the public profile page. */
export default function SafetyActions({
  targetUserId,
  targetName,
}: {
  targetUserId: string;
  targetName: string;
}) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBlock() {
    setBlocking(true);
    const res = await blockUser(targetUserId);
    if (res.ok) {
      // Refresh first so the inbox cache is invalidated before we navigate
      // away; otherwise the blocked thread can linger in the router cache.
      router.refresh();
      router.push("/discover");
    } else {
      setError(res.error ?? "Couldn't block this user.");
      setBlocking(false);
      setConfirmBlock(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="tap-target rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-600"
        >
          Report
        </button>
        <span className="text-slate-200">·</span>
        {confirmBlock ? (
          <>
            <button
              type="button"
              onClick={handleBlock}
              disabled={blocking}
              className="tap-target rounded-lg px-3 py-2 font-semibold text-coral hover:bg-coral/5 disabled:opacity-50"
            >
              {blocking ? "Blocking…" : "Confirm block"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmBlock(false)}
              className="tap-target rounded-lg px-3 py-2 text-slate-500 hover:text-slate-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmBlock(true)}
            className="tap-target rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-coral"
          >
            Block
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs font-medium text-coral">
          {error}
        </p>
      )}
      {reportOpen && (
        <ReportDialog
          targetUserId={targetUserId}
          targetName={targetName}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}
