import type {
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  TopicRow,
} from "./types";

// ---------------------------------------------------------------------------
// Hybrid ranked discovery (Sprint 2, spec §07).
//
// Score = 0.50 × topic_similarity
//       + 0.20 × format_fit
//       + 0.15 × language_time_fit
//       + 0.10 × activity_recency
//       + 0.05 × profile_quality
//
// topic_similarity uses pgvector cosine similarity when both profiles have
// embeddings (written by workers/embedder/), and falls back to shared-tag
// overlap otherwise, so discovery works on day one with no AI running.
// Every result carries up to three human-readable reasons traceable to
// stored profile fields. Audience size is never a ranking signal.
// ---------------------------------------------------------------------------

export interface Candidate {
  profile: ProfileRow;
  hostModule: HostModuleRow | null;
  guestModule: GuestModuleRow | null;
  topics: TopicRow[];
}

export interface RankedCandidate extends Candidate {
  /** 0–100, higher is a better fit. */
  score: number;
  /** Up to three evidence-based reasons, best first. */
  reasons: string[];
  /** True when an embedding contributed to the topic score. */
  usedEmbedding: boolean;
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return (value as unknown[]).every((v) => typeof v === "number")
      ? (value as number[])
      : null;
  }
  if (typeof value === "string") {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) && arr.every((v) => typeof v === "number")
        ? arr
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Cosine similarity; bge embeddings are L2-normalized so this is a dot product. */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

/**
 * Format fit heuristic, documented: this is a remote-first pilot, so hosts
 * that record remotely (or either way) fit more guests. Guests carry no
 * format preference in the schema, so they get a neutral score.
 */
function formatFit(c: Candidate): number {
  const format = c.hostModule?.format;
  if (!format) return 0.7;
  if (format === "both") return 1.0;
  if (format === "remote") return 0.9;
  return 0.5; // in_person only
}

function tzOffsetMinutes(tz: string, at: Date): number | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(at).map((p) => [p.type, p.value])
    );
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute)
    );
    return (asUTC - at.getTime()) / 60000;
  } catch {
    return null;
  }
}

/** Time-zone compatibility from IANA zone names; neutral when unknown. */
function timeFit(viewerTz: string | null, candidateTz: string | null): number {
  if (!viewerTz || !candidateTz) return 0.5;
  const at = new Date("2026-06-01T12:00:00Z"); // fixed date: DST-stable comparison
  const a = tzOffsetMinutes(viewerTz, at);
  const b = tzOffsetMinutes(candidateTz, at);
  if (a === null || b === null) return 0.5;
  const hours = Math.abs(a - b) / 60;
  if (hours === 0) return 1.0;
  if (hours <= 3) return 0.7;
  if (hours <= 6) return 0.4;
  return 0.2;
}

function recencyFit(updatedAt: string | null): number {
  if (!updatedAt) return 0.5;
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
  if (Number.isNaN(days)) return 0.5;
  if (days < 7) return 1.0;
  if (days < 30) return 0.7;
  if (days < 90) return 0.4;
  return 0.2;
}

function formatHourDiff(viewerTz: string, candidateTz: string): string | null {
  const at = new Date("2026-06-01T12:00:00Z");
  const a = tzOffsetMinutes(viewerTz, at);
  const b = tzOffsetMinutes(candidateTz, at);
  if (a === null || b === null) return null;
  const hours = Math.abs(a - b) / 60;
  if (hours === 0) return "Same time zone as you";
  if (hours <= 6) return `Only ${Math.round(hours)}h from your time zone`;
  return null;
}

const FORMAT_LABELS: Record<string, string> = {
  remote: "Records remotely",
  in_person: "Records in person",
  both: "Remote or in-person recording",
};

export function rankCandidates(args: {
  viewerProfile: ProfileRow;
  viewerTopics: TopicRow[];
  candidates: Candidate[];
  limit?: number;
}): RankedCandidate[] {
  const { viewerProfile, viewerTopics, candidates, limit = 20 } = args;
  const viewerTopicIds = new Set(viewerTopics.map((t) => t.id));
  const viewerTopicLabels = new Map(viewerTopics.map((t) => [t.id, t.label]));
  const viewerEmb = parseEmbedding(viewerProfile.embedding);

  const ranked: RankedCandidate[] = [];

  for (const c of candidates) {
    if (c.profile.id === viewerProfile.id) continue;
    if (c.profile.state !== "published") continue;

    const sharedIds = c.topics
      .map((t) => t.id)
      .filter((id) => viewerTopicIds.has(id));
    const sharedLabels = sharedIds
      .map((id) => viewerTopicLabels.get(id) ?? "")
      .filter(Boolean);

    // Topic similarity: embedding cosine when both sides have one,
    // otherwise shared-tag overlap (cold-start fallback).
    const candEmb = parseEmbedding(c.profile.embedding);
    let topicSim: number;
    let usedEmbedding = false;
    let cos = 0;
    if (viewerEmb && candEmb) {
      cos = cosine(viewerEmb, candEmb);
      topicSim = (cos + 1) / 2;
      usedEmbedding = true;
    } else {
      topicSim = Math.min(
        1,
        sharedIds.length / Math.max(1, viewerTopicIds.size)
      );
    }

    const fFit = formatFit(c);
    const tFit = timeFit(viewerProfile.timezone, c.profile.timezone);
    const rFit = recencyFit(c.profile.updated_at);
    const qFit = Math.max(0, Math.min(1, (c.profile.completeness ?? 0) / 100));

    const score = Math.round(
      100 * (0.5 * topicSim + 0.2 * fFit + 0.15 * tFit + 0.1 * rFit + 0.05 * qFit)
    );

    // Reasons: evidence-based, best first, max three. Each reason traces to
    // a stored field that fed the score, so a high score always has a
    // concrete explanation (never just "same time zone").
    const reasons: string[] = [];
    if (sharedLabels.length > 0) {
      const shown = sharedLabels.slice(0, 2).join(" & ");
      const extra =
        sharedLabels.length > 2 ? ` +${sharedLabels.length - 2} more` : "";
      reasons.push(`You both cover ${shown}${extra}`);
    } else if (usedEmbedding && cos >= 0.72) {
      // No shared tags, but the embedding similarity drove the score: name
      // the candidate's actual topics so the reason is verifiable.
      const theirTopics = c.topics
        .slice(0, 2)
        .map((t) => t.label)
        .filter(Boolean);
      reasons.push(
        theirTopics.length > 0
          ? `Close to your focus: they cover ${theirTopics.join(" & ")}`
          : "Closely related focus areas"
      );
    }
    const fmt = c.hostModule?.format;
    if (fmt && (fmt === "remote" || fmt === "both")) {
      reasons.push(FORMAT_LABELS[fmt]);
    }
    if (viewerProfile.timezone && c.profile.timezone) {
      const tzReason = formatHourDiff(
        viewerProfile.timezone,
        c.profile.timezone
      );
      if (tzReason) reasons.push(tzReason);
    }

    ranked.push({
      ...c,
      score,
      reasons: reasons.slice(0, 3),
      usedEmbedding,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const au = a.profile.updated_at ?? "";
    const bu = b.profile.updated_at ?? "";
    if (bu !== au) return bu < au ? -1 : 1;
    return a.profile.id < b.profile.id ? -1 : 1;
  });

  return ranked.slice(0, limit);
}
