export interface Badge {
  id: string;
  label: string;
  description: string;
  earned: boolean;
}

export interface BadgeInput {
  published: boolean;
  pitchesSent: number;
  bookings: number;
}

/** Derived achievements. No stored state: computed from live counts. */
export function computeBadges(input: BadgeInput): Badge[] {
  return [
    {
      id: "published",
      label: "Published",
      description: "Profile is live in discovery",
      earned: input.published,
    },
    {
      id: "first-outreach",
      label: "First outreach",
      description: "Sent a first pitch",
      earned: input.pitchesSent >= 1,
    },
    {
      id: "connector",
      label: "Connector",
      description: "Sent 10 pitches",
      earned: input.pitchesSent >= 10,
    },
    {
      id: "booked",
      label: "Booked",
      description: "Booked a first conversation",
      earned: input.bookings >= 1,
    },
    {
      id: "in-demand",
      label: "In demand",
      description: "Booked 5 conversations",
      earned: input.bookings >= 5,
    },
  ];
}
