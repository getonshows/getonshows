"use client";

import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/actions";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
const CLIENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Profile photo upload (Sprint 2). Uploads straight to the `profile-photos`
 * storage bucket via the uploadPhoto server action, which enforces type and
 * size server-side too. Reports the public URL back for draft persistence.
 */
export default function PhotoUpload({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!CLIENT_TYPES.includes(file.type)) {
      setError("Photo must be a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo must be smaller than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const result = await uploadPhoto(fd);
      if (result.ok) {
        onUploaded(result.url);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not upload that photo. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt="Your profile photo"
            className="h-20 w-20 rounded-2xl object-cover ring-1 ring-slate-300"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy-100 text-2xl font-bold text-navy-400"
          >
            ?
          </div>
        )}
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="tap-target rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
          >
            {uploading
              ? "Uploading…"
              : currentUrl
                ? "Change photo"
                : "Upload photo"}
          </button>
          <p className="mt-1.5 text-xs text-slate-500">
            JPG, PNG, or WebP · up to 5 MB
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Choose a profile photo"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
