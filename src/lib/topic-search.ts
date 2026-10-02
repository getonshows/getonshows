/**
 * Topic search matching: substring on the label plus initials, so "AI"
 * finds "Artificial Intelligence", "PM" finds "Product Management", etc.
 * Shared by the profile builder's TopicPicker and any other topic search.
 */

function initialsOf(label: string): string {
  return label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

/** True when the raw query matches the topic label by substring or initials. */
export function topicMatchesLabel(label: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const l = label.toLowerCase();
  if (l.includes(q)) return true;
  const initials = initialsOf(label);
  return initials.length > 1 && initials === q;
}
