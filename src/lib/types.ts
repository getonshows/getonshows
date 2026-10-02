export type Role = "host" | "guest" | "dual";
export type RoleOrUndecided = Role | "undecided";
export type ProfileState = "draft" | "published" | "paused" | "deleted";
export type InterviewFormat = "remote" | "in_person" | "both";

export interface UserRow {
  id: string;
  email: string;
  role: RoleOrUndecided;
  status: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  links: { label: string; url: string }[];
  timezone: string | null;
  availability_notes: string | null;
  availability: Record<string, string[]> | null;
  location: string | null;
  state: ProfileState;
  completeness: number;
  updated_at: string | null;
  embedding: number[] | null;
  embedding_status: "pending" | "done" | "error" | null;
  embedding_model: string | null;
  embedding_updated_at: string | null;
}

export type RecordingMedium = "audio" | "video" | "both";

export interface HostModuleRow {
  profile_id: string;
  show_name: string | null;
  show_url: string | null;
  format: InterviewFormat | null;
  medium: RecordingMedium | null;
  cadence: string | null;
  episode_length_minutes: number | null;
  guest_criteria: string | null;
  guest_brief: string | null;
  booking_url: string | null;
  recent_episode_url: string | null;
}

export interface GuestModuleRow {
  profile_id: string;
  expertise: string | null;
  talking_points: string[];
  proof_links: { label: string; url: string }[];
  booking_url: string | null;
}

export interface TopicRow {
  id: string;
  label: string;
  slug: string;
  parent_id: string | null;
  is_custom: boolean;
}

export interface HostModuleInput {
  showName: string;
  showUrl: string;
  format: "" | InterviewFormat;
  medium: "" | RecordingMedium;
  cadence: string;
  episodeLengthMinutes: string;
  guestCriteria: string;
  guestBrief: string;
  bookingUrl: string;
  recentEpisodeUrl: string;
}

export interface GuestModuleInput {
  expertise: string;
  talkingPoints: string[];
  proofLinks: { label: string; url: string }[];
  bookingUrl: string;
}

/** Shape of the profile builder form, sent to the saveDraft server action. */
export interface DraftInput {
  displayName: string;
  title: string;
  bio: string;
  photoUrl: string;
  links: { label: string; url: string }[];
  timezone: string;
  location: string;
  availabilityNotes: string;
  /** Weekly grid: { "mon": ["09:00", ...], ... }. Slots hourly, 08:00–19:00. */
  availability: Record<string, string[]>;
  host: HostModuleInput | null;
  guest: GuestModuleInput | null;
  topicIds: string[];
}

export interface BuilderData {
  userId: string;
  email: string;
  role: Role;
  profile: ProfileRow | null;
  hostModule: HostModuleRow | null;
  guestModule: GuestModuleRow | null;
  topicIds: string[];
  topics: TopicRow[];
  customTopics: TopicRow[];
}

// ---------------------------------------------------------------------------
// Sprint 3: messaging
// ---------------------------------------------------------------------------

export type ConversationState =
  | "pitched"
  | "replied"
  | "interested"
  | "passed"
  | "booked";

export type IntentAction = "interested" | "passed" | "booked";

export interface ConversationRow {
  id: string;
  host_profile_id: string;
  guest_profile_id: string;
  state: ConversationState;
  pitched_by_profile_id: string | null;
  archived: boolean;
  last_message_at: string | null;
  booking_claimed_by: string | null;
  booking_confirmed: boolean;
  state_changed_at: string | null;
  state_changed_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  kind: "text" | "system";
  created_at: string;
}

export interface ThreadParticipant {
  profileId: string;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  headline: string;
  bookingUrl: string | null;
  isHost: boolean;
}

export interface ThreadPreview {
  conversation: ConversationRow;
  other: ThreadParticipant;
  lastMessage: {
    body: string;
    created_at: string;
    sender_profile_id: string;
  } | null;
  unreadCount: number;
  myProfileId: string;
}

export interface ThreadData {
  conversation: ConversationRow;
  messages: MessageRow[];
  other: ThreadParticipant;
  myProfileId: string;
  myDisplayName: string;
}

export interface PitchQuotaStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  resets_at: string;
  error?: string;
}

export interface PitchPrefill {
  theirName: string;
  showName: string;
  myName: string;
  myTitle: string;
  myShowName: string;
}

export interface PitchContext {
  canPitch: boolean;
  reason?: string;
  existingConversationId?: string | null;
  quota?: PitchQuotaStatus;
  prefill?: PitchPrefill;
  targetProfileId?: string;
  asRole?: "host" | "guest";
}

export interface Collaboration {
  profile_id: string;
  display_name: string | null;
  photo_url: string | null;
  my_role: "host" | "guest";
  booked_at: string | null;
}
