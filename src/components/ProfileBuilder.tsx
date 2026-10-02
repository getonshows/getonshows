"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveDraft, publishProfile } from "@/lib/actions";
import { validatePublish } from "@/lib/publish-validation";
import TopicPicker from "@/components/TopicPicker";
import PhotoUpload from "@/components/PhotoUpload";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import {
  summarizeAvailability,
  type AvailabilityValue,
} from "@/lib/availability";
import type {
  BuilderData,
  DraftInput,
  GuestModuleInput,
  HostModuleInput,
  InterviewFormat,
  RecordingMedium,
  Role,
} from "@/lib/types";

type Step = "basics" | "topics" | "show" | "story" | "review";

const STEP_TITLES: Record<Step, string> = {
  basics: "The basics",
  topics: "Topics",
  show: "Your show",
  story: "Your story",
  review: "Review & publish",
};

const TIMEZONES: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC" },
  { value: "America/Toronto", label: "Eastern (Toronto / New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Vancouver", label: "Pacific (Vancouver)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "Kolkata" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

const AVAIL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const AVAIL_SLOT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse the stored JSONB availability back into the grid shape. */
function parseAvailability(raw: unknown): AvailabilityValue {
  if (typeof raw !== "object" || raw === null) return {};
  const out: AvailabilityValue = {};
  for (const day of AVAIL_DAYS) {
    const slots = (raw as Record<string, unknown>)[day];
    if (!Array.isArray(slots)) continue;
    const clean = Array.from(
      new Set(
        slots
          .filter((s): s is string => typeof s === "string" && AVAIL_SLOT_RE.test(s))
          .map((s) => s.slice(0, 5))
      )
    ).sort();
    if (clean.length > 0) out[day] = clean.slice(0, 12);
  }
  return out;
}

const EMPTY_LINK = { label: "", url: "" };

function stepsForRole(role: Role): Step[] {
  const steps: Step[] = ["basics", "topics"];
  if (role === "host" || role === "dual") steps.push("show");
  if (role === "guest" || role === "dual") steps.push("story");
  steps.push("review");
  return steps;
}

function initialDraft(data: BuilderData): DraftInput {
  const p = data.profile;
  const h = data.hostModule;
  const g = data.guestModule;
  const links = Array.isArray(p?.links) ? p!.links : [];
  const proofLinks = Array.isArray(g?.proof_links) ? g!.proof_links : [];
  const talkingPoints = Array.isArray(g?.talking_points) ? g!.talking_points : [];
  const pad = (arr: string[], n: number) =>
    [...arr.slice(0, n), ...Array(Math.max(0, n - arr.length)).fill("")];
  const padLinks = (
    arr: { label: string; url: string }[],
    n: number
  ): { label: string; url: string }[] => [
    ...arr.slice(0, n).map((l) => ({ label: l.label ?? "", url: l.url ?? "" })),
    ...Array(Math.max(0, n - arr.length)).fill(EMPTY_LINK),
  ];
  return {
    displayName: p?.display_name ?? "",
    title: p?.title ?? "",
    bio: p?.bio ?? "",
    photoUrl: p?.photo_url ?? "",
    links: padLinks(links, 3),
    timezone: p?.timezone ?? "",
    location: p?.location ?? "",
    availabilityNotes: p?.availability_notes ?? "",
    availability: parseAvailability(p?.availability),
    host: {
      showName: h?.show_name ?? "",
      showUrl: h?.show_url ?? "",
      format: (h?.format ?? "") as HostModuleInput["format"],
      medium: (h?.medium ?? "") as HostModuleInput["medium"],
      cadence: h?.cadence ?? "",
      episodeLengthMinutes: h?.episode_length_minutes?.toString() ?? "",
      guestCriteria: h?.guest_criteria ?? "",
      guestBrief: h?.guest_brief ?? "",
      bookingUrl: h?.booking_url ?? "",
      recentEpisodeUrl: h?.recent_episode_url ?? "",
    },
    guest: {
      expertise: g?.expertise ?? "",
      talkingPoints: pad(talkingPoints, 5),
      proofLinks: padLinks(proofLinks, 3),
      bookingUrl: g?.booking_url ?? "",
    },
    topicIds: data.topicIds,
  };
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-navy-900">
        {label}
        {required && (
          <span aria-hidden="true" className="text-brand-dark"> *</span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && <p className="mt-0.5 text-sm text-slate-600">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputClass =
  "tap-target w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

function TextArea({
  count,
  min,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  count?: boolean;
  min?: number;
}) {
  const len = (props.value as string | undefined)?.length ?? 0;
  return (
    <div>
      <textarea {...props} rows={5} className={`${inputClass} py-3`} />
      {count && (
        <p className="mt-1 text-sm text-slate-500" aria-live="polite">
          {len} characters
          {min ? ` (at least ${min} to publish)` : ""}
        </p>
      )}
    </div>
  );
}

function LinkRows({
  links,
  onChange,
  legend,
}: {
  links: { label: string; url: string }[];
  onChange: (links: { label: string; url: string }[]) => void;
  legend: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={l.label}
              onChange={(e) => {
                const next = links.map((x, j) =>
                  j === i ? { ...x, label: e.target.value } : x
                );
                onChange(next);
              }}
              placeholder="Label"
              aria-label={`${legend} ${i + 1} label`}
              maxLength={60}
              className={`${inputClass} w-1/3`}
            />
            <input
              type="url"
              inputMode="url"
              value={l.url}
              onChange={(e) => {
                const next = links.map((x, j) =>
                  j === i ? { ...x, url: e.target.value } : x
                );
                onChange(next);
              }}
              placeholder="https://…"
              aria-label={`${legend} ${i + 1} URL`}
              maxLength={500}
              className={`${inputClass} w-2/3`}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ProfileBuilder({ data }: { data: BuilderData }) {
  const router = useRouter();
  const role = data.role;
  const steps = useMemo(() => stepsForRole(role), [role]);

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<DraftInput>(() => initialDraft(data));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [completeness, setCompleteness] = useState(
    data.profile?.completeness ?? 0
  );
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishMissing, setPublishMissing] = useState<string[]>([]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savingRef = useRef(false);
  const queuedRef = useRef(false);
  const mountedRef = useRef(false);

  const step: Step = steps[stepIndex];

  const set = <K extends keyof DraftInput>(key: K, value: DraftInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setHost = (patch: Partial<HostModuleInput>) =>
    setDraft((d) => ({ ...d, host: { ...d.host!, ...patch } }));

  const setGuest = (patch: Partial<GuestModuleInput>) =>
    setDraft((d) => ({ ...d, guest: { ...d.guest!, ...patch } }));

  const payload = useMemo<DraftInput>(
    () => ({
      ...draft,
      host: role === "host" || role === "dual" ? draft.host : null,
      guest: role === "guest" || role === "dual" ? draft.guest : null,
    }),
    [draft, role]
  );

  const doSave = async () => {
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const result = await saveDraft(payload);
      if (result.ok) {
        setCompleteness(result.completeness);
        setLastSaved(new Date());
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      savingRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void doSave();
      }
    }
  };

  // PRO-01: autosave after every step (debounced).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      void doSave();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  async function goTo(index: number) {
    setPublishMissing([]);
    setPublishError("");
    await doSave();
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const missing = useMemo(
    () =>
      validatePublish(
        role,
        { display_name: draft.displayName, bio: draft.bio },
        draft.host
          ? {
              profile_id: "",
              show_name: draft.host.showName,
              show_url: draft.host.showUrl,
              format: (draft.host.format || null) as InterviewFormat | null,
              medium: (draft.host.medium || null) as RecordingMedium | null,
              cadence: draft.host.cadence,
              episode_length_minutes: null,
              guest_criteria: draft.host.guestCriteria,
              guest_brief: draft.host.guestBrief,
              booking_url: draft.host.bookingUrl,
              recent_episode_url: draft.host.recentEpisodeUrl,
            }
          : null,
        draft.guest
          ? {
              profile_id: "",
              expertise: draft.guest.expertise,
              talking_points: draft.guest.talkingPoints,
              proof_links: draft.guest.proofLinks,
              booking_url: draft.guest.bookingUrl,
            }
          : null,
        draft.topicIds
      ),
    [role, draft]
  );

  async function handlePublish() {
    setPublishing(true);
    setPublishError("");
    await doSave();
    const result = await publishProfile();
    setPublishing(false);
    if (result.ok) {
      router.push("/profile");
    } else if (result.missing) {
      setPublishMissing(result.missing);
    } else {
      setPublishError(result.error ?? "Could not publish. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">
            {STEP_TITLES[step]}
          </h1>
        </div>
        <Link
          href="/profile"
          className="tap-target shrink-0 font-semibold text-brand-dark underline"
        >
          Save & exit
        </Link>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label="Builder progress"
      >
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <p aria-live="polite" className="mt-2 text-sm text-slate-500">
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" &&
          lastSaved &&
          `Draft saved ${lastSaved.toLocaleTimeString()}`}
        {saveStatus === "error" && "Couldn't save. Check your connection."}
        {saveStatus === "idle" && "Changes save automatically."}
      </p>

      <div className="mt-6 space-y-6">
        {step === "basics" && (
          <>
            <Field label="Your name" required hint="Your real name or the display name you book under.">
              <TextInput
                type="text"
                value={draft.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="e.g. Jordan Lee"
                maxLength={120}
                autoComplete="name"
              />
            </Field>
            <Field label="Headline" hint="One line under your name. Who you are and what you do.">
              <TextInput
                type="text"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Host of The Founder Files · ex-operator"
                maxLength={120}
              />
            </Field>
            <Field label="Bio" required hint="What should a stranger know before booking you?">
              <TextArea
                value={draft.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="Two or three sentences about your background, what you talk about, and who listens…"
                maxLength={4000}
                count
                min={40}
              />
            </Field>
            <Field label="Photo" hint="A square headshot. Uploaded to your private photo folder.">
              <PhotoUpload
                currentUrl={draft.photoUrl}
                onUploaded={(url) => set("photoUrl", url)}
              />
            </Field>
            <Field label="Time zone" hint="So booking conversations start in the right place.">
              <select
                value={TIMEZONES.some((t) => t.value === draft.timezone) || draft.timezone === "" ? draft.timezone : "__custom"}
                onChange={(e) =>
                  set("timezone", e.target.value === "__custom" ? draft.timezone : e.target.value)
                }
                className="tap-target mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900"
                aria-label="Time zone"
              >
                <option value="">Choose a time zone…</option>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
                {draft.timezone !== "" &&
                  !TIMEZONES.some((t) => t.value === draft.timezone) && (
                    <option value="__custom">{draft.timezone}</option>
                  )}
              </select>
            </Field>
            <Field label="Location" hint="City and state/province, so people nearby can find you.">
              <TextInput
                type="text"
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Toronto, ON"
                maxLength={120}
                autoComplete="address-level2"
              />
            </Field>
            <div>
              <h2 className="text-sm font-semibold text-navy-900">Links</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Your home base: website, newsletter, social profile.
              </p>
              <div className="mt-1.5">
                <LinkRows
                  links={draft.links}
                  onChange={(links) => set("links", links)}
                  legend="Profile links"
                />
              </div>
            </div>
            <Field
              label="Weekly availability"
              hint="Mark the hours you're generally free for recordings, 8 AM–8 PM. Optional. The notes below add context."
            >
              <AvailabilityGrid
                value={draft.availability}
                onChange={(v) => set("availability", v)}
              />
            </Field>
            <Field label="Availability notes" hint="Anything about your schedule worth knowing up front.">
              <TextArea
                value={draft.availabilityNotes}
                onChange={(e) => set("availabilityNotes", e.target.value)}
                placeholder="e.g. Weekday mornings ET work best; two weeks lead time."
                maxLength={1000}
              />
            </Field>
          </>
        )}

        {step === "topics" && (
          <TopicPicker
            topics={data.topics}
            customTopics={data.customTopics}
            selected={draft.topicIds}
            onChange={(ids) => set("topicIds", ids)}
          />
        )}

        {step === "show" && draft.host && (
          <>
            <Field label="Show name" required>
              <TextInput
                type="text"
                value={draft.host.showName}
                onChange={(e) => setHost({ showName: e.target.value })}
                placeholder="e.g. The Founder Files"
                maxLength={160}
              />
            </Field>
            <Field label="Show URL" hint="Where a guest would listen or learn more. Optional.">
              <TextInput
                type="url"
                inputMode="url"
                value={draft.host.showUrl}
                onChange={(e) => setHost({ showUrl: e.target.value })}
                placeholder="https://…"
                maxLength={500}
              />
            </Field>
            <fieldset>
              <legend className="text-sm font-semibold text-navy-900">
                Interview format <span aria-hidden="true" className="text-brand-dark">*</span>
                <span className="sr-only"> (required)</span>
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Interview format">
                {(
                  [
                    ["remote", "Remote"],
                    ["in_person", "In person"],
                    ["both", "Both"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={draft.host!.format === value}
                    onClick={() => setHost({ format: value })}
                    className={`tap-target rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition ${
                      draft.host!.format === value
                        ? "bg-navy-800 text-white ring-navy-800"
                        : "bg-white text-slate-700 ring-slate-300 hover:ring-navy-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-navy-900">
                Recording medium
              </legend>
              <p className="mt-1 text-xs text-slate-500">
                Guests use this to filter for audio-only or video shows.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Recording medium">
                {(
                  [
                    ["audio", "Audio"],
                    ["video", "Video"],
                    ["both", "Both"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={draft.host!.medium === value}
                    onClick={() =>
                      setHost({ medium: draft.host!.medium === value ? "" : value })
                    }
                    className={`tap-target rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition ${
                      draft.host!.medium === value
                        ? "bg-navy-800 text-white ring-navy-800"
                        : "bg-white text-slate-700 ring-slate-300 hover:ring-navy-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cadence" hint="How often you publish.">
                <TextInput
                  type="text"
                  value={draft.host.cadence}
                  onChange={(e) => setHost({ cadence: e.target.value })}
                  placeholder="Weekly"
                  maxLength={60}
                />
              </Field>
              <Field label="Episode length" hint="Typical minutes.">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={600}
                  value={draft.host.episodeLengthMinutes}
                  onChange={(e) => setHost({ episodeLengthMinutes: e.target.value })}
                  placeholder="45"
                />
              </Field>
            </div>
            <Field
              label="Guest criteria"
              required
              hint="Who is a great guest for your show, and who isn't?"
            >
              <TextArea
                value={draft.host.guestCriteria}
                onChange={(e) => setHost({ guestCriteria: e.target.value })}
                placeholder="e.g. Operators with 5+ years in the trenches; no pitches for products."
                maxLength={2000}
                count
              />
            </Field>
            <Field
              label="Conversations you want to have"
              required
              hint="Describe the episodes you want to make. GetOnShows matches you with guests who fit."
            >
              <TextArea
                value={draft.host.guestBrief}
                onChange={(e) => setHost({ guestBrief: e.target.value })}
                placeholder="e.g. I'm looking for people near Toronto with unusual expertise, meaningful personal stories, new research or strong ideas around AI, science, business and society. Prefer in-person conversations."
                maxLength={2000}
                count
              />
            </Field>
            <Field label="Booking URL" hint="Your calendar link, shown after someone expresses interest.">
              <TextInput
                type="url"
                inputMode="url"
                value={draft.host.bookingUrl}
                onChange={(e) => setHost({ bookingUrl: e.target.value })}
                placeholder="https://cal.com/…"
                maxLength={500}
              />
            </Field>
            <Field label="Recent episode URL" hint="One strong episode that shows your format.">
              <TextInput
                type="url"
                inputMode="url"
                value={draft.host.recentEpisodeUrl}
                onChange={(e) => setHost({ recentEpisodeUrl: e.target.value })}
                placeholder="https://…"
                maxLength={500}
              />
            </Field>
          </>
        )}

        {step === "story" && draft.guest && (
          <>
            <Field
              label="Expertise / story"
              required
              hint="What do you know that a podcast audience would learn from?"
            >
              <TextArea
                value={draft.guest.expertise}
                onChange={(e) => setGuest({ expertise: e.target.value })}
                placeholder="e.g. I ran support at a startup through 10x growth; I talk about keeping humans in the loop…"
                maxLength={2000}
                count
              />
            </Field>
            <fieldset>
              <legend className="text-sm font-semibold text-navy-900">
                Talking points <span aria-hidden="true" className="text-brand-dark">*</span>
                <span className="sr-only"> (at least one required)</span>
              </legend>
              <p className="mt-0.5 text-sm text-slate-600">
                Concrete angles a host could build an episode around.
              </p>
              <div className="mt-1.5 space-y-2">
                {draft.guest.talkingPoints.map((t, i) => (
                  <TextInput
                    key={i}
                    type="text"
                    value={t}
                    onChange={(e) => {
                      const next = draft.guest!.talkingPoints.map((x, j) =>
                        j === i ? e.target.value : x
                      );
                      setDraft((d) => ({
                        ...d,
                        guest: { ...d.guest!, talkingPoints: next },
                      }));
                    }}
                    placeholder={`Talking point ${i + 1}`}
                    aria-label={`Talking point ${i + 1}`}
                    maxLength={300}
                  />
                ))}
              </div>
            </fieldset>
            <div>
              <h2 className="text-sm font-semibold text-navy-900">
                Proof links
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Evidence you deliver: talks, articles, past appearances.
              </p>
              <div className="mt-1.5">
                <LinkRows
                  links={draft.guest.proofLinks}
                  onChange={(proofLinks) =>
                    setDraft((d) => ({
                      ...d,
                      guest: { ...d.guest!, proofLinks },
                    }))
                  }
                  legend="Proof links"
                />
              </div>
            </div>
            <Field
              label="Booking URL"
              hint="Your calendar link, shown to hosts after they express interest."
            >
              <TextInput
                type="url"
                inputMode="url"
                value={draft.guest.bookingUrl}
                onChange={(e) => setGuest({ bookingUrl: e.target.value })}
                placeholder="https://cal.com/…"
                maxLength={500}
              />
            </Field>
          </>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  Profile completeness
                </span>
                <span className="font-semibold text-navy-900">{completeness}%</span>
              </div>
              <div
                className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={completeness}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${completeness}%` }}
                />
              </div>

            {(() => {
              const summary = summarizeAvailability(draft.availability);
              return (
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Time zone</dt>
                    <dd className="text-navy-900">
                      {draft.timezone
                        ? (TIMEZONES.find((t) => t.value === draft.timezone)?.label ?? draft.timezone)
                        : "-"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-slate-500">Availability</dt>
                    <dd className="text-navy-900">{summary ?? "-"}</dd>
                  </div>
                </dl>
              );
            })()}
            </div>

            {missing.length > 0 ? (
              <section
                aria-labelledby="missing-heading"
                className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
              >
                <h2 id="missing-heading" className="text-lg font-semibold text-navy-900">
                  Before you publish
                </h2>
                <p className="mt-1 text-slate-600">
                  A few required details are still missing:
                </p>
                <ul className="mt-3 space-y-2">
                  {missing.map((m) => (
                    <li key={m} className="flex items-start gap-2 text-slate-700">
                      <span aria-hidden="true" className="mt-0.5 font-bold text-brand-dark">•</span>
                      {m}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => goTo(0)}
                  className="tap-target mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
                >
                  Go back and fill them in
                </button>
              </section>
            ) : (
              <section className="scroll-mb-28 rounded-2xl bg-brand-light p-5 ring-1 ring-brand/30">
                <h2 className="text-lg font-semibold text-navy-900">
                  Ready to publish
                </h2>
                <p className="mt-1 text-slate-700">
                  Your profile meets every requirement. Publishing makes it
                  visible in discovery.
                </p>
              </section>
            )}

            {publishMissing.length > 0 && (
              <div role="alert" className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-200">
                <h2 className="font-semibold text-red-800">
                  Still missing a few things
                </h2>
                <ul className="mt-2 list-disc pl-5 text-red-700">
                  {publishMissing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {publishError && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {publishError}
              </p>
            )}

            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="tap-target w-full rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {publishing ? "Publishing…" : "Publish my profile"}
            </button>
            <p className="text-center text-sm text-slate-500">
              Your profile stays a draft (invisible to others) until you
              publish.
            </p>
          </div>
        )}
      </div>

      {step !== "review" && (
        <div className="mt-8 flex scroll-mb-28 gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => goTo(stepIndex - 1)}
              className="tap-target rounded-xl border border-slate-300 bg-white px-6 font-semibold text-navy-900 hover:bg-slate-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(stepIndex + 1)}
            className="tap-target flex-1 rounded-xl bg-navy-800 px-6 font-semibold text-white hover:bg-navy-900"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
