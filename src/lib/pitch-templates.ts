/**
 * Built-in pitch templates (Sprint 3).
 *
 * Per the spec, a template prompts the sender to name the episode angle,
 * why it fits, and a proof link. Curly-brace tokens are resolved from
 * profile data; [bracketed] tokens are fill-ins the sender must replace —
 * sending is blocked until every bracket is filled.
 */

export type PitchDirection = "guest-to-host" | "host-to-guest";

export interface PitchTemplate {
  id: string;
  direction: PitchDirection;
  title: string;
  hint: string;
  body: string;
}

export const PITCH_CHAR_LIMIT = 1500;
export const REPLY_CHAR_LIMIT = 2000;

export const PITCH_TEMPLATES: PitchTemplate[] = [
  {
    id: "guest-angle",
    direction: "guest-to-host",
    title: "Episode angle",
    hint: "Lead with the specific topic you'd bring to their show.",
    body: `Hi {theirName},

I'd love to be a guest on {showName} to talk about [episode angle — the specific topic or story I'd bring].

Why it's a fit: [1–2 sentences on why your audience will care].

A bit about me: {myName}, {myTitle}. Proof I can deliver: [link to a past episode, talk, or article].

Would you be open to a 15-minute chat next week?

— {myName}`,
  },
  {
    id: "guest-story",
    direction: "guest-to-host",
    title: "Story-led",
    hint: "Hook them with a personal story, then the lesson.",
    body: `Hi {theirName},

[The specific problem your audience struggles with] — I learned this the hard way when [brief personal story hook].

I'm {myName} ({myTitle}), and I'd love to share [the lesson or framework] with your {showName} listeners.

Recent proof: [link to episode, talk, or press].

Open to exploring this?

— {myName}`,
  },
  {
    id: "host-invite",
    direction: "host-to-guest",
    title: "Guest invitation",
    hint: "A warm, direct invite tied to their expertise.",
    body: `Hi {theirName},

I'm {myName}, host of {myShowName} — [one line on what the show covers].

I'd love to have you on to talk about [specific topic tied to their expertise]. Your work on [their notable project or idea] would resonate strongly with our listeners.

Interested? Just reply and we'll find a time — or grab a slot here: [your booking link].

— {myName}`,
  },
  {
    id: "host-topic",
    direction: "host-to-guest",
    title: "Topic-specific invite",
    hint: "Reference something concrete from their profile.",
    body: `Hi {theirName},

Your perspective on [topic] stood out to me — especially [something specific from their profile].

I'm putting together an episode of {myShowName} on [episode angle], and you'd be a perfect guest for it.

Would you be up for a 30-minute recording sometime in the next two weeks?

— {myName}, host of {myShowName}`,
  },
];

/** Fill {tokens} from values; [bracketed] fill-ins are left for the sender. */
export function renderTemplate(
  body: string,
  values: Record<"theirName" | "showName" | "myName" | "myTitle" | "myShowName", string>
): string {
  return body.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? values[key as keyof typeof values] : ""
  );
}

/** Names of [bracketed] fill-ins still present in the text. */
export function unfilledPrompts(body: string): string[] {
  const found = new Set<string>();
  for (const m of Array.from(body.matchAll(/\[([^\[\]]{1,80})\]/g))) {
    found.add(m[1].trim());
  }
  return Array.from(found);
}
