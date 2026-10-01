#!/usr/bin/env python3
"""GetOnShows embedding worker (Sprint 2).

Polls Supabase for profiles with embedding_status='pending', computes a
384-dim embedding with BAAI/bge-small-en-v1.5 locally (CPU or your GPU),
and writes it back. Runs on YOUR hardware — the Next.js app never calls
into this machine. All connections are outbound from here to Supabase,
so this keeps working when the app is hosted on Vercel.

Usage:
    python embedder.py --once            # single pass, then exit
    python embedder.py --loop           # poll forever (systemd-friendly)
    python embedder.py --loop --interval 120

Config via environment (see .env.example):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (required)
    EMBEDDING_MODEL  (default BAAI/bge-small-en-v1.5)
    BATCH_SIZE       (default 10)
    POLL_INTERVAL_SECONDS (default 60)
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("embedder")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "10"))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "60"))
MAX_FAILURES = 3  # consecutive failures before a profile is parked as 'error'

if not SUPABASE_URL or not SERVICE_KEY:
    log.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).")
    sys.exit(2)

session = requests.Session()
session.headers.update(
    {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
)
REST = f"{SUPABASE_URL}/rest/v1"

_model = None


def get_model():
    """Lazy-load so --help and config errors don't pay the torch import cost."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        log.info("Loading embedding model %s ...", MODEL_NAME)
        _model = SentenceTransformer(MODEL_NAME)
        device = getattr(_model, "device", "unknown")
        log.info("Model ready on %s.", device)
    return _model


def as_object(value):
    """PostgREST returns to-one relations as an object; be defensive."""
    if isinstance(value, list):
        return value[0] if value else {}
    return value or {}


def build_matching_document(row: dict) -> str:
    """Spec §07: normalized topics, bio, show description, guest criteria,
    talking points — the text the embedding represents."""
    parts = []
    topics = [
        t["topics"]["label"]
        for t in row.get("profile_topics", [])
        if isinstance(t.get("topics"), dict) and t["topics"].get("label")
    ]
    if topics:
        parts.append("Topics: " + ", ".join(topics))
    if row.get("display_name"):
        parts.append(f"Name: {row['display_name']}")
    if row.get("title"):
        parts.append(f"Headline: {row['title']}")
    if row.get("bio"):
        parts.append(f"Bio: {row['bio']}")
    host = as_object(row.get("host_profiles"))
    if host.get("show_name"):
        parts.append(f"Show: {host['show_name']}")
    if host.get("guest_criteria"):
        parts.append(f"Looking for guests who: {host['guest_criteria']}")
    if host.get("guest_brief"):
        parts.append(f"Conversations this host wants: {host['guest_brief']}")
    guest = as_object(row.get("guest_profiles"))
    if guest.get("expertise"):
        parts.append(f"Expertise: {guest['expertise']}")
    if guest.get("talking_points"):
        parts.append("Talking points: " + "; ".join(guest["talking_points"]))
    if row.get("availability_notes"):
        parts.append(f"Availability: {row['availability_notes']}")
    avail_summary = summarize_availability(row.get("availability"))
    if avail_summary:
        parts.append(f"Generally free: {avail_summary}")
    return "\n".join(parts)


DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_SHORT = {"mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu",
             "fri": "Fri", "sat": "Sat", "sun": "Sun"}
VALID_SLOT = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def summarize_availability(raw) -> str | None:
    """Mirror of the web summarizeAvailability(): 'Mon–Fri · 9 AM–5 PM'."""
    if not isinstance(raw, dict):
        return None
    day_ranges = []
    for day in DAY_ORDER:
        slots = raw.get(day)
        if not isinstance(slots, list):
            continue
        hours = sorted({int(s[:2]) for s in slots
                        if isinstance(s, str) and VALID_SLOT.match(s)
                        and 8 <= int(s[:2]) <= 19})
        if not hours:
            continue
        ranges = []
        start = prev = hours[0]
        for h in hours[1:]:
            if h == prev + 1:
                prev = h
            else:
                ranges.append((start, prev + 1))
                start = prev = h
        ranges.append((start, prev + 1))

        def fmt(h):
            ap = "AM" if h < 12 else "PM"
            hr = h % 12 or 12
            return hr, ap

        parts = []
        for s, e in ranges:
            s_hr, s_ap = fmt(s)
            e_hr, e_ap = fmt(e)
            if s_ap == e_ap:
                parts.append(f"{s_hr}–{e_hr} {s_ap}")
            else:
                parts.append(f"{s_hr} {s_ap}–{e_hr} {e_ap}")
        day_ranges.append((day, ", ".join(parts)))
    if not day_ranges:
        return None
    groups = []
    g_start = 0
    for i in range(1, len(day_ranges) + 1):
        same = (
            i < len(day_ranges)
            and day_ranges[i][1] == day_ranges[g_start][1]
            and DAY_ORDER.index(day_ranges[i][0]) == DAY_ORDER.index(day_ranges[i - 1][0]) + 1
        )
        if not same:
            label = (DAY_SHORT[day_ranges[g_start][0]] if g_start == i - 1
                     else f"{DAY_SHORT[day_ranges[g_start][0]]}–{DAY_SHORT[day_ranges[i - 1][0]]}")
            groups.append(f"{label} · {day_ranges[g_start][1]}")
            g_start = i
    return "; ".join(groups)


def fetch_pending(limit: int) -> list:
    select = (
        "id,display_name,title,bio,availability_notes,availability,"
        "host_profiles(show_name,guest_criteria,guest_brief),"
        "guest_profiles(expertise,talking_points),"
        "profile_topics(topics(label))"
    )
    r = session.get(
        f"{REST}/profiles",
        params={
            "embedding_status": "eq.pending",
            "state": "eq.published",
            "select": select,
            "order": "updated_at.asc",
            "limit": limit,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def mark_done(profile_id: str, embedding: list) -> None:
    # pgvector accepts the bracket string literal for vector input.
    payload = {
        "embedding": "[" + ",".join(f"{x:.6f}" for x in embedding) + "]",
        "embedding_status": "done",
        "embedding_model": MODEL_NAME,
        "embedding_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    r = session.patch(
        f"{REST}/profiles", params={"id": f"eq.{profile_id}"}, json=payload, timeout=30
    )
    r.raise_for_status()


def mark_error(profile_id: str, reason: str) -> None:
    log.warning("Parking profile %s as error: %s", profile_id, reason)
    r = session.patch(
        f"{REST}/profiles",
        params={"id": f"eq.{profile_id}"},
        json={"embedding_status": "error"},
        timeout=30,
    )
    r.raise_for_status()


def run_once(failures: dict) -> int:
    """One polling pass. Returns the number of profiles embedded."""
    try:
        pending = fetch_pending(BATCH_SIZE)
    except Exception as e:  # noqa: BLE001 — keep the loop alive
        log.error("Failed to fetch pending profiles: %s", e)
        return 0
    if not pending:
        log.info("No pending profiles.")
        return 0

    model = get_model()
    done = 0
    for row in pending:
        pid = row["id"]
        try:
            doc = build_matching_document(row)
            if not doc.strip():
                raise ValueError("empty matching document")
            vec = model.encode(doc, normalize_embeddings=True).tolist()
            mark_done(pid, vec)
            failures.pop(pid, None)
            done += 1
            log.info("Embedded profile %s (%d chars).", pid, len(doc))
        except Exception as e:  # noqa: BLE001 — one bad profile must not kill the batch
            count = failures.get(pid, 0) + 1
            failures[pid] = count
            log.error("Failed to embed %s (attempt %d): %s", pid, count, e)
            if count >= MAX_FAILURES:
                try:
                    mark_error(pid, str(e))
                except Exception as e2:  # noqa: BLE001
                    log.error("Could not park %s as error: %s", pid, e2)
                failures.pop(pid, None)
    return done


def main() -> None:
    parser = argparse.ArgumentParser(description="GetOnShows embedding worker")
    parser.add_argument("--once", action="store_true", help="single pass, then exit")
    parser.add_argument("--loop", action="store_true", help="poll forever")
    parser.add_argument(
        "--interval",
        type=int,
        default=POLL_INTERVAL,
        help="seconds between polls in --loop mode",
    )
    args = parser.parse_args()
    if not args.once and not args.loop:
        args.once = True

    failures: dict = {}
    log.info(
        "Worker starting (model=%s, batch=%d).", MODEL_NAME, BATCH_SIZE
    )
    if args.once:
        n = run_once(failures)
        log.info("Done. Embedded %d profile(s).", n)
        return

    log.info("Loop mode: polling every %d seconds.", args.interval)
    while True:
        n = run_once(failures)
        if n:
            log.info("Pass complete: %d embedded.", n)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
