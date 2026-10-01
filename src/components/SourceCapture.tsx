"use client";

import { useEffect } from "react";

/**
 * Captures the acquisition source (?utm_source=, ?ref=, or ?source=) into a
 * 30-day `gos_source` cookie. The auth callback reads it after the magic-link
 * round-trip (which crosses email, so URL params alone would not survive)
 * and stamps it on the user row; the events trigger then stamps it on every
 * analytics event. Never overwritten once set: first touch wins.
 */
export default function SourceCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = (
        params.get("utm_source") ??
        params.get("ref") ??
        params.get("source") ??
        ""
      ).trim();
      if (!raw) return;
      if (/(^|;\s*)gos_source=/.test(document.cookie)) return;
      const value = raw.slice(0, 80).replace(/[^a-zA-Z0-9._-]/g, "");
      if (!value) return;
      const expires = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toUTCString();
      document.cookie =
        `gos_source=${value}; Expires=${expires}; Path=/; SameSite=Lax` +
        (window.location.protocol === "https:" ? "; Secure" : "");
    } catch {
      // Source capture must never break the page.
    }
  }, []);
  return null;
}
