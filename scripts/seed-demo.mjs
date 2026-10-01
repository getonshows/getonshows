#!/usr/bin/env node
// GetOnShows · Sprint 2 demo seed.
//
// Creates ~6 realistic PUBLISHED profiles (3 hosts, 3 guests across varied
// topics) so discovery, filters, and match reasons can be demoed immediately.
//
//   DEMO DATA — every record uses an @getonshows.demo email. Remove with:
//     node scripts/seed-demo.mjs --remove
//
// Usage:
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/seed-demo.mjs
//
// Requires the service_role key (creates auth users via the admin API).
// Never commit real keys; pass them via environment only.

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEMO_DOMAIN = "@getonshows.demo";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(2);
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const restHeaders = { ...adminHeaders, Prefer: "return=representation" };
const AUTH = `${SUPABASE_URL}/auth/v1/admin`;
const REST = `${SUPABASE_URL}/rest/v1`;

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${options.method ?? "GET"} ${url} → ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Demo personas (clearly fake emails, realistic content)
// ---------------------------------------------------------------------------

const HOSTS = [
  {
    email: `demo-host-1${DEMO_DOMAIN}`,
    displayName: "Maya Chen",
    title: "Host of The Founder Files · ex-operator",
    bio: "Maya spent eight years as an operator at two venture-backed startups before launching The Founder Files, a weekly interview show about the zero-to-one journey. She digs into the decisions founders rarely talk about: early hires, pricing mistakes, and the months before product-market fit.",
    timezone: "America/New_York",
    availabilityNotes: "Records Tue–Thu, 10am–3pm ET.",
    links: [{ label: "Show site", url: "https://example.com/founder-files" }],
    topics: ["startups", "entrepreneurship", "artificial-intelligence"],
    host: {
      show_name: "The Founder Files",
      show_url: "https://example.com/founder-files",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Founders (or early employees) with a hard-won lesson from the zero-to-one phase. You should be able to name one decision that changed your company's trajectory and explain your reasoning.",
      booking_url: "https://example.com/founder-files/book",
      recent_episode_url: "https://example.com/founder-files/ep42",
    },
  },
  {
    email: `demo-host-2${DEMO_DOMAIN}`,
    displayName: "Devon Park",
    title: "Host of Deep Tech Today",
    bio: "Devon is a software engineer turned podcaster covering AI infrastructure, developer tools, and applied research. Deep Tech Today is audio-first and technical — listeners are engineers and ML practitioners who want depth, not hype.",
    timezone: "America/Los_Angeles",
    availabilityNotes: "Records Friday mornings PT.",
    links: [{ label: "Show site", url: "https://example.com/deep-tech-today" }],
    topics: ["software-technology", "artificial-intelligence", "product-management"],
    host: {
      show_name: "Deep Tech Today",
      show_url: "https://example.com/deep-tech-today",
      format: "remote",
      medium: "audio",
      cadence: "Weekly",
      episode_length_minutes: 60,
      guest_criteria:
        "Engineers, researchers, or PMs who have shipped AI or infrastructure products. Come ready to go deep on architecture and trade-offs — surface-level takes don't land with this audience.",
      booking_url: "",
      recent_episode_url: "https://example.com/deep-tech-today/ep18",
    },
  },
  {
    email: `demo-host-3${DEMO_DOMAIN}`,
    displayName: "Priya Nair",
    title: "Host of Well & Wealthy",
    bio: "Priya is a certified financial planner and wellness coach. Her show explores the overlap between money and wellbeing: how financial stress affects health, and how small systems improve both. Conversations are warm, practical, and jargon-free.",
    timezone: "Europe/London",
    availabilityNotes: "Records Mon/Wed, afternoons GMT.",
    links: [{ label: "Show site", url: "https://example.com/well-wealthy" }],
    topics: ["health-wellness", "finance-investing", "personal-development"],
    host: {
      show_name: "Well & Wealthy",
      show_url: "https://example.com/well-wealthy",
      format: "both",
      medium: "video",
      cadence: "Biweekly",
      episode_length_minutes: 40,
      guest_criteria:
        "Practitioners at the intersection of health and money: coaches, planners, therapists, or researchers with actionable frameworks. No get-rich-quick pitches.",
      booking_url: "https://example.com/well-wealthy/book",
      recent_episode_url: "https://example.com/well-wealthy/ep09",
    },
  },
];

const GUESTS = [
  {
    email: `demo-guest-1${DEMO_DOMAIN}`,
    displayName: "Alex Rivera",
    title: "ML researcher turned founder",
    bio: "Alex spent five years in applied ML research before founding a startup building evaluation tooling for LLM apps. They write about what actually breaks when language models meet production traffic.",
    timezone: "America/Chicago",
    availabilityNotes: "Weekday afternoons CT work best.",
    links: [{ label: "Blog", url: "https://example.com/alex-writes" }],
    topics: ["artificial-intelligence", "startups", "software-technology"],
    guest: {
      expertise:
        "Evaluating and shipping LLM features. Alex's team built eval harnesses now used by over two million developers.",
      talking_points: [
        "Why most LLM evals measure the wrong thing",
        "From research prototype to production: the unglamorous middle",
        "Pricing AI features without losing money",
      ],
      proof_links: [
        { label: "Eval harness launch post", url: "https://example.com/alex-evals" },
        { label: "Talk: LLMs in prod", url: "https://example.com/alex-talk" },
      ],
    },
  },
  {
    email: `demo-guest-2${DEMO_DOMAIN}`,
    displayName: "Sam Okafor",
    title: "B2B growth marketer",
    bio: "Sam has led growth at three B2B SaaS companies from seed to Series B. He specializes in founder-led sales motions and turning customer conversations into pipeline without a big ad budget.",
    timezone: "America/New_York",
    availabilityNotes: "Mornings ET preferred.",
    links: [{ label: "Newsletter", url: "https://example.com/sam-newsletter" }],
    topics: ["marketing", "sales", "startups"],
    guest: {
      expertise:
        "Early-stage B2B growth. Sam took two startups from $0 to $1M ARR on founder-led sales and partnerships.",
      talking_points: [
        "The first 10 customers: a repeatable playbook",
        "Why your demo-to-close rate is a messaging problem",
        "Partnerships as a channel before you can afford ads",
      ],
      proof_links: [
        { label: "Growth teardown", url: "https://example.com/sam-teardown" },
      ],
    },
  },
  {
    email: `demo-guest-3${DEMO_DOMAIN}`,
    displayName: "Jordan Lee",
    title: "Executive coach for new managers",
    bio: "Jordan coaches first-time managers at fast-growing companies. A former engineering manager, they focus on the identity shift from maker to multiplier — and the burnout that comes with getting it wrong.",
    timezone: "Pacific/Auckland",
    availabilityNotes: "Flexible; book 1 week ahead.",
    links: [{ label: "Coaching site", url: "https://example.com/jordan-coaches" }],
    topics: ["leadership", "career-growth", "mental-health"],
    guest: {
      expertise:
        "New-manager transitions. Jordan has coached 200+ first-time managers through their first year leading teams.",
      talking_points: [
        "The maker-to-manager identity shift",
        "Burnout signals managers miss in themselves",
        "Feedback that actually changes behavior",
      ],
      proof_links: [
        { label: "Manager field guide", url: "https://example.com/jordan-guide" },
      ],
    },
  },
];

// ---------------------------------------------------------------------------

async function topicIdBySlug(slug) {
  const rows = await api(
    `${REST}/topics?slug=eq.${slug}&select=id`,
    { headers: restHeaders }
  );
  if (!rows.length) throw new Error(`Topic slug not found: ${slug}`);
  return rows[0].id;
}

async function ensureUser(email, role) {
  const existing = await api(
    `${REST}/users?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: restHeaders }
  );
  if (existing.length > 0) {
    console.log(`  exists: ${email}`);
    return existing[0].id;
  }
  const created = await api(`${AUTH}/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, email_confirm: true }),
  });
  await api(`${REST}/users?id=eq.${created.id}`, {
    method: "PATCH",
    headers: restHeaders,
    body: JSON.stringify({ role }),
  });
  console.log(`  created: ${email} (${role})`);
  return created.id;
}

async function seedProfile(userId, persona, role) {
  const existing = await api(
    `${REST}/profiles?user_id=eq.${userId}&select=id`,
    { headers: restHeaders }
  );
  let profileId;
  if (existing.length > 0) {
    profileId = existing[0].id;
  } else {
    const rows = await api(`${REST}/profiles`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({
        user_id: userId,
        display_name: persona.displayName,
        title: persona.title,
        bio: persona.bio,
        photo_url: null,
        links: persona.links,
        timezone: persona.timezone,
        availability_notes: persona.availabilityNotes,
        state: "published",
        completeness: 95,
      }),
    });
    profileId = rows[0].id;
  }

  if (persona.host) {
    await api(`${REST}/host_profiles`, {
      method: "POST",
      headers: { ...restHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ profile_id: profileId, ...persona.host }),
    });
  }
  if (persona.guest) {
    await api(`${REST}/guest_profiles`, {
      method: "POST",
      headers: { ...restHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ profile_id: profileId, ...persona.guest }),
    });
  }
  await api(`${REST}/profile_topics?profile_id=eq.${profileId}`, {
    method: "DELETE",
    headers: restHeaders,
  });
  for (const slug of persona.topics) {
    const topicId = await topicIdBySlug(slug);
    await api(`${REST}/profile_topics`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({ profile_id: profileId, topic_id: topicId }),
    });
  }
  console.log(`  profile ready: ${persona.displayName} (${role})`);
}

async function removeDemo() {
  const users = await api(
    `${REST}/users?email=like.*${encodeURIComponent(DEMO_DOMAIN)}&select=id,email`,
    { headers: restHeaders }
  );
  if (users.length === 0) {
    console.log("No demo users found. Nothing to remove.");
    return;
  }
  for (const u of users) {
    await api(`${AUTH}/users/${u.id}`, { method: "DELETE", headers: adminHeaders });
    await api(`${REST}/users?id=eq.${u.id}`, { method: "DELETE", headers: restHeaders });
    console.log(`  removed: ${u.email}`);
  }
  console.log(`Removed ${users.length} demo user(s).`);
}

async function main() {
  if (process.argv.includes("--remove")) {
    await removeDemo();
    return;
  }
  console.log("Seeding demo profiles (DEMO DATA — remove with --remove)...");
  for (const h of HOSTS) {
    const id = await ensureUser(h.email, "host");
    await seedProfile(id, h, "host");
  }
  for (const g of GUESTS) {
    const id = await ensureUser(g.email, "guest");
    await seedProfile(id, g, "guest");
  }
  console.log("Done. 6 demo profiles published and queued for embedding.");
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
