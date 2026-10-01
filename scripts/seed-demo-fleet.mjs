#!/usr/bin/env node
// GetOnShows · Demo fleet seed (friends & family demo).
//
// Creates 66 realistic PUBLISHED profiles (26 hosts + 40 guests) with coherent
// topics, bios, availability grids, and module data so discovery, matching,
// and booking can be demoed with a full-looking directory.
//
//   DEMO DATA — every record uses an @getonshows.demo email. Remove with:
//     node scripts/seed-demo-fleet.mjs --remove
//
// Usage:
//   SUPABASE_URL=https://xyz.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/seed-demo-fleet.mjs
//
// Requires the service_role key (creates auth users via the admin API).
// Never commit real keys; pass them via environment only.
// New profiles are picked up automatically by the GPU embedding worker,
// so match scores appear once it processes the queue.

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
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// avail: [["tue", 9, 12], ...] → { tue: ["09:00","10:00","11:00"], ... }
// (slots are hourly, 08:00–19:00 per the availability migration)
function gridFrom(spec) {
  const grid = {};
  for (const [day, start, end] of spec) {
    const slots = [];
    for (let h = start; h < end && h < 20; h++) {
      slots.push(String(h).padStart(2, "0") + ":00");
    }
    if (slots.length) grid[day] = slots;
  }
  return grid;
}

const topicCache = {};
async function topicIdBySlug(slug) {
  if (topicCache[slug]) return topicCache[slug];
  const rows = await api(`${REST}/topics?slug=eq.${slug}&select=id`, { headers: restHeaders });
  if (!rows.length) throw new Error(`Topic slug not found: ${slug}`);
  topicCache[slug] = rows[0].id;
  return rows[0].id;
}

async function ensureUser(email, role) {
  const existing = await api(
    `${REST}/users?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: restHeaders }
  );
  if (existing.length > 0) return existing[0].id;
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
        availability_notes: persona.availNotes,
        availability: gridFrom(persona.avail),
        state: "published",
        completeness: 92,
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
  return persona.displayName;
}

async function removeFleet() {
  const users = await api(
    `${REST}/users?email=like.fleet-*${encodeURIComponent(DEMO_DOMAIN)}&select=id,email`,
    { headers: restHeaders }
  );
  if (users.length === 0) {
    console.log("No fleet demo users found. Nothing to remove.");
    return;
  }
  for (const u of users) {
    await api(`${AUTH}/users/${u.id}`, { method: "DELETE", headers: adminHeaders });
    await api(`${REST}/users?id=eq.${u.id}`, { method: "DELETE", headers: restHeaders });
    console.log(`  removed: ${u.email}`);
  }
  console.log(`Removed ${users.length} fleet demo user(s).`);
}

// ---------------------------------------------------------------------------
// GUESTS (40)
// ---------------------------------------------------------------------------

const GUESTS = [
  {
    email: `fleet-guest-01${DEMO_DOMAIN}`,
    displayName: "Nadia Rahman",
    title: "ML platform lead · ex-fintech",
    bio: "Nadia leads ML platform at a payments company processing $40B a year. Before that she spent four years at a research lab working on model evaluation. She writes a monthly memo on what breaks when research models meet fraud, chargebacks, and regulators.",
    timezone: "America/Toronto",
    avail: [["tue", 9, 12], ["thu", 9, 12]],
    availNotes: "Tue/Thu mornings ET",
    links: [{ label: "Writing", url: "https://example.com/nadia-ml" }],
    topics: ["artificial-intelligence", "software-technology", "product-management"],
    guest: {
      expertise:
        "Shipping ML in regulated environments. Nadia's team cut false-positive fraud declines by 31% while passing two SOC 2 audits.",
      talking_points: [
        "Why evals are a product problem, not a research problem",
        "ML under regulators: what auditors actually ask for",
        "The unglamorous work between a demo and a deployment",
      ],
      proof_links: [
        { label: "Talk: ML in production", url: "https://example.com/nadia-talk" },
        { label: "Eval checklist", url: "https://example.com/nadia-evals" },
      ],
    },
  },
  {
    email: `fleet-guest-02${DEMO_DOMAIN}`,
    displayName: "Marcus Webb",
    title: "Founder, voice-AI startup · 2x founder",
    bio: "Marcus is building his second company, this time in voice AI for customer support. His first startup, a scheduling tool, was acquired in 2022. He's candid about the gap between AI demos and AI products — his team threw away three architectures before finding one that held up on real calls.",
    timezone: "America/New_York",
    avail: [["mon", 10, 13], ["wed", 10, 13]],
    availNotes: "Mon/Wed late mornings ET",
    links: [{ label: "Company", url: "https://example.com/marcus-voice" }],
    topics: ["artificial-intelligence", "startups", "entrepreneurship"],
    guest: {
      expertise:
        "Voice AI in production. Marcus's platform now handles 2M+ customer calls a month across 40 support teams.",
      talking_points: [
        "What we threw away: three architectures that failed on real calls",
        "Latency budgets: the 800ms line between magic and annoying",
        "Selling AI to support leaders who've been burned before",
      ],
      proof_links: [
        { label: "Founder story", url: "https://example.com/marcus-story" },
      ],
    },
  },
  {
    email: `fleet-guest-03${DEMO_DOMAIN}`,
    displayName: "Dr. Elena Vasquez",
    title: "AI safety researcher",
    bio: "Elena is a research scientist focused on evaluation of advanced AI systems. She previously worked on robotics perception at an autonomous-vehicle company. She speaks plainly about capabilities, limits, and what the evidence actually shows — no hype, no doom.",
    timezone: "America/Los_Angeles",
    avail: [["tue", 13, 16], ["fri", 10, 12]],
    availNotes: "Tue afternoons / Fri mornings PT",
    links: [{ label: "Papers", url: "https://example.com/elena-papers" }],
    topics: ["artificial-intelligence", "software-technology", "personal-development"],
    guest: {
      expertise:
        "AI evaluation and risk assessment. Elena has led red-teaming studies cited in two national AI safety reports.",
      talking_points: [
        "What 'AI safety' work actually looks like day to day",
        "Reading capability claims with a researcher's skepticism",
        "From self-driving cars to language models: lessons that transferred",
      ],
      proof_links: [
        { label: "Keynote: measuring the unmeasurable", url: "https://example.com/elena-keynote" },
      ],
    },
  },
  {
    email: `fleet-guest-04${DEMO_DOMAIN}`,
    displayName: "Tom Becker",
    title: "Staff engineer · data platforms",
    bio: "Tom has spent a decade building data infrastructure at companies from 50 to 5,000 people. He's the person teams call when the pipeline works but nobody knows why. His newsletter on data engineering trade-offs has 18,000 subscribers.",
    timezone: "America/Chicago",
    avail: [["wed", 9, 12], ["fri", 9, 11]],
    availNotes: "Wed/Fri mornings CT",
    links: [{ label: "Newsletter", url: "https://example.com/tom-data" }],
    topics: ["software-technology", "product-management", "career-growth"],
    guest: {
      expertise:
        "Data platforms at scale. Tom rebuilt a 4PB warehouse migration with zero downtime and lived to write about it.",
      talking_points: [
        "The data stack is fine — your ownership model is broken",
        "Migrating a warehouse without a maintenance window",
        "Staff engineer lessons: influence without authority",
      ],
      proof_links: [
        { label: "Migration write-up", url: "https://example.com/tom-migration" },
      ],
    },
  },
  {
    email: `fleet-guest-05${DEMO_DOMAIN}`,
    displayName: "Aisha Bello",
    title: "AI product manager · copilots",
    bio: "Aisha is a senior PM building AI copilots for sales teams. She joined as the first PM and grew the product from beta to $8M ARR. Before product she was a management consultant, which she says taught her to ask better questions and write shorter docs.",
    timezone: "America/New_York",
    avail: [["tue", 11, 14], ["thu", 11, 14]],
    availNotes: "Tue/Thu midday ET",
    links: [{ label: "Essays", url: "https://example.com/aisha-pm" }],
    topics: ["artificial-intelligence", "product-management", "sales"],
    guest: {
      expertise:
        "AI product management. Aisha shipped 14 model-powered features and learned which ones users actually kept.",
      talking_points: [
        "PMing AI: what changes and what really doesn't",
        "The features users kept vs. the ones that demoed well",
        "Pricing AI when your costs move every quarter",
      ],
      proof_links: [
        { label: "Talk: shipping copilots", url: "https://example.com/aisha-talk" },
      ],
    },
  },
  {
    email: `fleet-guest-06${DEMO_DOMAIN}`,
    displayName: "Kenji Tanaka",
    title: "Robotics founder · ex-warehouse automation",
    bio: "Kenji spent six years automating warehouses before founding a robotics startup for small manufacturers. He talks about hardware the way software people talk about APIs — and he's refreshingly honest about how long physical things take.",
    timezone: "America/Los_Angeles",
    avail: [["mon", 14, 17]],
    availNotes: "Monday afternoons PT",
    links: [{ label: "Company", url: "https://example.com/kenji-robotics" }],
    topics: ["artificial-intelligence", "startups", "entrepreneurship"],
    guest: {
      expertise:
        "Robotics for small manufacturers. Kenji's robots now run in 60+ factories that couldn't afford automation before.",
      talking_points: [
        "Hardware timelines: why 'move fast' breaks on physics",
        "Selling robots to people who've never bought one",
        "What warehouse automation taught me about AI hype",
      ],
      proof_links: [
        { label: "Factory tour video", url: "https://example.com/kenji-tour" },
      ],
    },
  },
  {
    email: `fleet-guest-07${DEMO_DOMAIN}`,
    displayName: "Priya Sharma",
    title: "LLM security researcher",
    bio: "Priya researches prompt injection and data exfiltration in LLM applications. She previously did application security at a bank. Her demos are memorable — she once got a customer-service bot to reveal its system prompt live on stage, with permission.",
    timezone: "Europe/London",
    avail: [["wed", 14, 17], ["thu", 10, 12]],
    availNotes: "Wed afternoons / Thu mornings GMT",
    links: [{ label: "Research", url: "https://example.com/priya-sec" }],
    topics: ["artificial-intelligence", "software-technology", "startups"],
    guest: {
      expertise:
        "Securing LLM applications. Priya's testing framework is used by 200+ teams before they ship AI features.",
      talking_points: [
        "Live demo: breaking (and fixing) an AI assistant",
        "The threat model most AI startups are missing",
        "Security reviews for AI features that don't slow shipping",
      ],
      proof_links: [
        { label: "Injection test suite", url: "https://example.com/priya-tests" },
        { label: "Conference talk", url: "https://example.com/priya-conf" },
      ],
    },
  },
  {
    email: `fleet-guest-08${DEMO_DOMAIN}`,
    displayName: "David Osei",
    title: "DevTools founder · open source",
    bio: "David maintains an open-source developer tool with 40,000 GitHub stars and turned it into a venture-backed company. He writes honestly about the weird economics of open source — beloved by millions, paid by dozens.",
    timezone: "America/Denver",
    avail: [["tue", 10, 13], ["fri", 13, 15]],
    availNotes: "Tue mornings / Fri afternoons MT",
    links: [{ label: "Project", url: "https://example.com/david-oss" }],
    topics: ["software-technology", "startups", "entrepreneurship"],
    guest: {
      expertise:
        "Open-source businesses. David converted a popular OSS project into $3M ARR without alienating the community.",
      talking_points: [
        "Monetizing open source without losing the community",
        "What 40k stars taught me about what developers want",
        "The enterprise sales motion for a bottoms-up product",
      ],
      proof_links: [
        { label: "OSS monetization essay", url: "https://example.com/david-essay" },
      ],
    },
  },
  {
    email: `fleet-guest-09${DEMO_DOMAIN}`,
    displayName: "Dr. Sarah Lindqvist",
    title: "Physician · applied AI in clinics",
    bio: "Sarah is a family physician who leads AI adoption at a 300-doctor practice network. She straddles two worlds — seeing patients three days a week and evaluating clinical AI tools the other two. Her perspective on what actually helps in an exam room is rare.",
    timezone: "America/Chicago",
    avail: [["mon", 12, 14], ["wed", 12, 14]],
    availNotes: "Mon/Wed midday CT",
    links: [{ label: "Clinic", url: "https://example.com/sarah-clinic" }],
    topics: ["artificial-intelligence", "health-wellness", "leadership"],
    guest: {
      expertise:
        "Clinical AI adoption. Sarah's network cut documentation time by 40% across 300 physicians.",
      talking_points: [
        "AI in the exam room: what helps vs. what distracts",
        "Getting 300 doctors to change how they work",
        "The liability questions nobody wants to ask",
      ],
      proof_links: [
        { label: "Grand rounds talk", url: "https://example.com/sarah-rounds" },
      ],
    },
  },
  {
    email: `fleet-guest-10${DEMO_DOMAIN}`,
    displayName: "James Park",
    title: "Engineering manager · platform teams",
    bio: "James manages platform engineering at a mid-size SaaS company after a decade as an IC. He writes about the transition with unusual candor — including the year he was, in his words, 'a terrible manager learning in public.'",
    timezone: "America/Los_Angeles",
    avail: [["thu", 10, 13]],
    availNotes: "Thursday mornings PT",
    links: [{ label: "Blog", url: "https://example.com/james-em" }],
    topics: ["software-technology", "leadership", "career-growth"],
    guest: {
      expertise:
        "Engineering leadership. James grew a platform team from 4 to 35 while cutting deploy times from days to minutes.",
      talking_points: [
        "My first year as a terrible manager",
        "Platform teams: product thinking for infrastructure",
        "1:1s that aren't status meetings",
      ],
      proof_links: [
        { label: "Manager README", url: "https://example.com/james-readme" },
      ],
    },
  },
  {
    email: `fleet-guest-11${DEMO_DOMAIN}`,
    displayName: "Fatima Al-Sayed",
    title: "MLOps consultant",
    bio: "Fatima is an independent consultant who helps companies get ML models out of notebooks and into production. She's worked with 30+ teams and has strong opinions about feature stores, most of them negative.",
    timezone: "Europe/London",
    avail: [["tue", 9, 12], ["thu", 14, 16]],
    availNotes: "Tue mornings / Thu afternoons GMT",
    links: [{ label: "Consulting", url: "https://example.com/fatima-mlops" }],
    topics: ["artificial-intelligence", "software-technology", "career-growth"],
    guest: {
      expertise:
        "ML operations. Fatima has shepherded 50+ models to production across fintech, retail, and logistics.",
      talking_points: [
        "Your feature store is probably overkill",
        "The 6-month gap between trained and deployed",
        "Consulting lessons: patterns across 30 teams",
      ],
      proof_links: [
        { label: "MLOps field notes", url: "https://example.com/fatima-notes" },
      ],
    },
  },
  {
    email: `fleet-guest-12${DEMO_DOMAIN}`,
    displayName: "Chris Novak",
    title: "Indie hacker · $2M ARR solo",
    bio: "Chris runs a profitable SaaS business solo — $2M ARR, no employees, no funding. He documents everything: revenue, churn, the weeks he barely works. His story is the counter-narrative to venture-scale-or-bust.",
    timezone: "America/Denver",
    avail: [["wed", 10, 13], ["fri", 10, 12]],
    availNotes: "Wed/Fri mornings MT",
    links: [{ label: "Build in public", url: "https://example.com/chris-indie" }],
    topics: ["startups", "entrepreneurship", "software-technology"],
    guest: {
      expertise:
        "Solo SaaS. Chris grew to $2M ARR with zero employees and a 4-day work week.",
      talking_points: [
        "The solo playbook: what I'd do differently",
        "Saying no to venture money (twice)",
        "Boring businesses, extraordinary margins",
      ],
      proof_links: [
        { label: "Revenue dashboard", url: "https://example.com/chris-revenue" },
      ],
    },
  },
  {
    email: `fleet-guest-13${DEMO_DOMAIN}`,
    displayName: "Rachel Kim",
    title: "DTC founder · skincare",
    bio: "Rachel founded a skincare brand in her kitchen that now does $12M a year. She talks frankly about inventory disasters, the TikTok spike that nearly broke the company, and why she still answers customer emails.",
    timezone: "America/Los_Angeles",
    avail: [["tue", 13, 16]],
    availNotes: "Tuesday afternoons PT",
    links: [{ label: "Brand", url: "https://example.com/rachel-skin" }],
    topics: ["entrepreneurship", "marketing", "startups"],
    guest: {
      expertise:
        "DTC growth. Rachel scaled from kitchen batches to $12M with no outside funding.",
      talking_points: [
        "The viral spike that almost killed us",
        "Inventory: the silent killer of DTC brands",
        "Why I still answer customer email at $12M",
      ],
      proof_links: [
        { label: "Founder interview", url: "https://example.com/rachel-interview" },
      ],
    },
  },
  {
    email: `fleet-guest-14${DEMO_DOMAIN}`,
    displayName: "Daniel Ross",
    title: "B2B sales coach · ex-Oracle",
    bio: "Daniel spent 12 years in enterprise sales before becoming a coach for early-stage founders who hate selling. His clients have closed $50M+ in aggregate. He's direct, funny, and allergic to sales jargon.",
    timezone: "America/New_York",
    avail: [["mon", 9, 12], ["thu", 9, 11]],
    availNotes: "Mon/Thu mornings ET",
    links: [{ label: "Coaching", url: "https://example.com/daniel-sales" }],
    topics: ["sales", "startups", "entrepreneurship"],
    guest: {
      expertise:
        "Founder-led sales. Daniel's clients average a 3x improvement in close rates within two quarters.",
      talking_points: [
        "Discovery calls that don't feel like interrogations",
        "The follow-up system that closes deals",
        "Why founders outsell salespeople (at first)",
      ],
      proof_links: [
        { label: "Sales teardown", url: "https://example.com/daniel-teardown" },
      ],
    },
  },
  {
    email: `fleet-guest-15${DEMO_DOMAIN}`,
    displayName: "Mei Lin",
    title: "Content-led growth marketer",
    bio: "Mei led content at two startups from 0 to 1M monthly organic visitors. She believes most content marketing fails because it's written for Google instead of buyers. Her playbooks are tactical and numbers-heavy.",
    timezone: "America/Toronto",
    avail: [["wed", 10, 13], ["fri", 10, 12]],
    availNotes: "Wed/Fri mornings ET",
    links: [{ label: "Playbooks", url: "https://example.com/mei-content" }],
    topics: ["marketing", "sales", "startups"],
    guest: {
      expertise:
        "Organic growth. Mei's content engines drove 60% of pipeline at her last two companies.",
      talking_points: [
        "Write for buyers, not algorithms",
        "The 90-day content sprint that actually compounds",
        "Attribution without lying to yourself",
      ],
      proof_links: [
        { label: "Growth case study", url: "https://example.com/mei-case" },
      ],
    },
  },
  {
    email: `fleet-guest-16${DEMO_DOMAIN}`,
    displayName: "Robert Hayes",
    title: "Fractional CFO · 40+ startups",
    bio: "Robert is a fractional CFO who's worked with over 40 startups from pre-seed to Series C. He translates finance into founder language and has strong views on when you actually need a CFO (later than you think).",
    timezone: "America/Chicago",
    avail: [["tue", 14, 17]],
    availNotes: "Tuesday afternoons CT",
    links: [{ label: "Practice", url: "https://example.com/robert-cfo" }],
    topics: ["finance-investing", "startups", "entrepreneurship"],
    guest: {
      expertise:
        "Startup finance. Robert has guided 12 companies through successful fundraises totaling $200M+.",
      talking_points: [
        "You don't need a CFO yet — here's what you need instead",
        "The metrics investors actually read in your deck",
        "Burn multiples: the number that predicts survival",
      ],
      proof_links: [
        { label: "Fundraise guide", url: "https://example.com/robert-guide" },
      ],
    },
  },
  {
    email: `fleet-guest-17${DEMO_DOMAIN}`,
    displayName: "Angela Torres",
    title: "Multifamily investor · 400 units",
    bio: "Angela went from house-hacking a duplex to owning 400 rental units in eight years, all while working full-time as a nurse. She teaches buy-and-hold investing without the guru hype — just math, tenants, and patience.",
    timezone: "America/Denver",
    avail: [["sat", 9, 12]],
    availNotes: "Saturday mornings MT",
    links: [{ label: "Education", url: "https://example.com/angela-invest" }],
    topics: ["real-estate", "finance-investing", "personal-development"],
    guest: {
      expertise:
        "Buy-and-hold real estate. Angela built a 400-unit portfolio starting with a $15k down payment.",
      talking_points: [
        "House-hack to 400 units: the actual math",
        "Tenant screening that prevents 90% of problems",
        "Investing while working full-time: systems over hustle",
      ],
      proof_links: [
        { label: "Portfolio breakdown", url: "https://example.com/angela-math" },
      ],
    },
  },
  {
    email: `fleet-guest-18${DEMO_DOMAIN}`,
    displayName: "Jonathan Pryce",
    title: "Executive coach · tech leaders",
    bio: "Jonathan coaches VPs and C-suite executives at high-growth tech companies. A former COO himself, he works on the stuff that doesn't fit in a management book: power dynamics, board relationships, and leading when you're exhausted.",
    timezone: "America/New_York",
    avail: [["fri", 9, 12]],
    availNotes: "Friday mornings ET",
    links: [{ label: "Coaching", url: "https://example.com/jonathan-coach" }],
    topics: ["leadership", "career-growth", "mental-health"],
    guest: {
      expertise:
        "Executive leadership. Jonathan has coached 150+ senior leaders through hypergrowth, layoffs, and IPOs.",
      talking_points: [
        "The loneliness of the VP seat",
        "Managing your board like a product",
        "Leading well when you're running on empty",
      ],
      proof_links: [
        { label: "Leadership essay", url: "https://example.com/jonathan-essay" },
      ],
    },
  },
  {
    email: `fleet-guest-19${DEMO_DOMAIN}`,
    displayName: "Sofia Marchetti",
    title: "Career pivot strategist",
    bio: "Sofia helps professionals in their 30s and 40s change industries without starting over. She pivoted herself from corporate law to tech at 38. Her framework maps transferable skills employers actually pay for.",
    timezone: "Europe/London",
    avail: [["wed", 10, 13], ["thu", 15, 17]],
    availNotes: "Wed mornings / Thu afternoons GMT",
    links: [{ label: "Programs", url: "https://example.com/sofia-pivot" }],
    topics: ["career-growth", "personal-development", "leadership"],
    guest: {
      expertise:
        "Career transitions. Sofia has guided 800+ professionals into new industries with an average 20% pay increase.",
      talking_points: [
        "Pivoting at 38: from law to tech",
        "Transferable skills employers actually pay for",
        "The narrative resume: telling your story, not listing jobs",
      ],
      proof_links: [
        { label: "Pivot framework", url: "https://example.com/sofia-framework" },
      ],
    },
  },
  {
    email: `fleet-guest-20${DEMO_DOMAIN}`,
    displayName: "Greg Hoffman",
    title: "Pricing consultant · SaaS",
    bio: "Greg is a pricing consultant who's repriced 60+ SaaS products. He says most companies leave 20-30% of revenue on the table with timid packaging. His teardowns are blunt and backed by willingness-to-pay data.",
    timezone: "America/Chicago",
    avail: [["tue", 10, 13]],
    availNotes: "Tuesday mornings CT",
    links: [{ label: "Teardowns", url: "https://example.com/greg-pricing" }],
    topics: ["sales", "marketing", "finance-investing"],
    guest: {
      expertise:
        "SaaS pricing and packaging. Greg's repricing projects average a 24% ARR lift within a year.",
      talking_points: [
        "You're undercharging: the data behind timid pricing",
        "Packaging beats discounting, every time",
        "How to run a pricing change without churning everyone",
      ],
      proof_links: [
        { label: "Pricing teardown", url: "https://example.com/greg-teardown" },
      ],
    },
  },
];

GUESTS.push(
  {
    email: `fleet-guest-21${DEMO_DOMAIN}`,
    displayName: "Hannah Cole",
    title: "Email marketing specialist · e-commerce",
    bio: "Hannah runs email for e-commerce brands doing $1M–$50M a year. She's sent over 2,000 campaigns and has opinions about every popup you've ever closed. Her flows consistently drive 35%+ of client revenue.",
    timezone: "America/New_York",
    avail: [["mon", 11, 14], ["wed", 11, 13]],
    availNotes: "Mon/Wed midday ET",
    links: [{ label: "Agency", url: "https://example.com/hannah-email" }],
    topics: ["marketing", "sales", "entrepreneurship"],
    guest: {
      expertise:
        "E-commerce email. Hannah's flows average 38% of total revenue for her clients.",
      talking_points: [
        "The 5 flows that print money (and the 10 that don't)",
        "Popups people don't hate: timing and targeting",
        "Segmentation beyond 'opened last email'",
      ],
      proof_links: [
        { label: "Flow audit", url: "https://example.com/hannah-audit" },
      ],
    },
  },
  {
    email: `fleet-guest-22${DEMO_DOMAIN}`,
    displayName: "Victor Adeyemi",
    title: "Operations consultant · scaling teams",
    bio: "Victor helps companies go from 20 to 200 employees without the wheels coming off. A former chief of staff at two unicorns, he specializes in the operating cadence — meetings, metrics, and decision-making — that makes scale survivable.",
    timezone: "America/Toronto",
    avail: [["thu", 10, 13]],
    availNotes: "Thursday mornings ET",
    links: [{ label: "Advisory", url: "https://example.com/victor-ops" }],
    topics: ["leadership", "startups", "product-management"],
    guest: {
      expertise:
        "Scaling operations. Victor designed operating systems for companies now worth $5B+ combined.",
      talking_points: [
        "The meeting cadence that scales to 200 people",
        "Metrics that matter at each stage",
        "Chief of staff: the most misunderstood role in startups",
      ],
      proof_links: [
        { label: "Operating playbook", url: "https://example.com/victor-playbook" },
      ],
    },
  },
  {
    email: `fleet-guest-23${DEMO_DOMAIN}`,
    displayName: "Dr. Amara Okonkwo",
    title: "Sleep scientist",
    bio: "Amara is a sleep researcher studying shift workers — nurses, pilots, first responders. Her lab's work on light exposure and sleep timing has changed scheduling policy at three hospital systems. She practices what she studies, mostly.",
    timezone: "America/Chicago",
    avail: [["tue", 13, 16], ["fri", 9, 11]],
    availNotes: "Tue afternoons / Fri mornings CT",
    links: [{ label: "Lab", url: "https://example.com/amara-sleep" }],
    topics: ["health-wellness", "mental-health", "personal-development"],
    guest: {
      expertise:
        "Sleep science. Amara's shift-work protocols reduced nurse fatigue incidents by 40% in pilot hospitals.",
      talking_points: [
        "What shift workers taught us about everyone's sleep",
        "Light: the most underused sleep tool",
        "Why '8 hours' is the wrong target",
      ],
      proof_links: [
        { label: "Research summary", url: "https://example.com/amara-research" },
      ],
    },
  },
  {
    email: `fleet-guest-24${DEMO_DOMAIN}`,
    displayName: "Mike Delaney",
    title: "Strength coach · lifters over 40",
    bio: "Mike coaches lifters over 40 — desk workers reclaiming strength, not athletes chasing records. His no-nonsense programs have helped 3,000+ clients get strong without getting hurt. He hates burpees and isn't shy about it.",
    timezone: "America/Denver",
    avail: [["mon", 9, 11], ["wed", 9, 11], ["fri", 9, 11]],
    availNotes: "Mon/Wed/Fri mornings MT",
    links: [{ label: "Coaching", url: "https://example.com/mike-strong" }],
    topics: ["fitness", "health-wellness", "personal-development"],
    guest: {
      expertise:
        "Strength training for 40+. Mike's clients average a 2x strength gain in their first year, injury-free.",
      talking_points: [
        "Strong after 40: what's different (and what isn't)",
        "The minimum effective dose of lifting",
        "Why your program should be boring",
      ],
      proof_links: [
        { label: "Client results", url: "https://example.com/mike-results" },
      ],
    },
  },
  {
    email: `fleet-guest-25${DEMO_DOMAIN}`,
    displayName: "Dr. Lena Fischer",
    title: "Sports dietitian",
    bio: "Lena is a registered dietitian working with endurance athletes, from first-time marathoners to Olympians. She debunks nutrition fads with lab data and has a gift for making fueling strategies actually stick.",
    timezone: "Europe/London",
    avail: [["tue", 10, 13]],
    availNotes: "Tuesday mornings GMT",
    links: [{ label: "Practice", url: "https://example.com/lena-fuel" }],
    topics: ["nutrition", "fitness", "health-wellness"],
    guest: {
      expertise:
        "Sports nutrition. Lena has fueled 25 Olympians and 500+ marathoners to personal bests.",
      talking_points: [
        "Fueling myths that won't die",
        "The 80/20 of race-day nutrition",
        "RED-S: the under-fueling epidemic in endurance sports",
      ],
      proof_links: [
        { label: "Fueling guide", url: "https://example.com/lena-guide" },
      ],
    },
  },
  {
    email: `fleet-guest-26${DEMO_DOMAIN}`,
    displayName: "Dr. James Wright",
    title: "Therapist · burnout & founders",
    bio: "James is a clinical psychologist who works primarily with founders and executives burning out. He previously worked in crisis intervention. His approach is practical — fewer insights, more experiments.",
    timezone: "America/Los_Angeles",
    avail: [["thu", 13, 16]],
    availNotes: "Thursday afternoons PT",
    links: [{ label: "Practice", url: "https://example.com/james-therapy" }],
    topics: ["mental-health", "personal-development", "leadership"],
    guest: {
      expertise:
        "Burnout recovery. James has treated 400+ high-achievers and studies what actually restores them.",
      talking_points: [
        "Burnout isn't a vacation deficiency",
        "The identity trap: when you are your company",
        "Experiments over insights: a practical recovery model",
      ],
      proof_links: [
        { label: "Burnout essay", url: "https://example.com/james-essay" },
      ],
    },
  },
  {
    email: `fleet-guest-27${DEMO_DOMAIN}`,
    displayName: "Yuki Mori",
    title: "Mindfulness teacher · ex-finance",
    bio: "Yuki spent a decade in investment banking before burning out spectacularly and retraining as a mindfulness teacher. She now teaches evidence-based practices to skeptical professionals — no incense required.",
    timezone: "Asia/Singapore",
    avail: [["wed", 9, 12]],
    availNotes: "Wednesday mornings SGT",
    links: [{ label: "Courses", url: "https://example.com/yuki-mindful" }],
    topics: ["mental-health", "personal-development", "health-wellness"],
    guest: {
      expertise:
        "Mindfulness for skeptics. Yuki's corporate programs show measurable stress reduction in 6 weeks.",
      talking_points: [
        "From banking to breathing: my burnout story",
        "Mindfulness without the mysticism",
        "The 10-minute practice that survives a busy calendar",
      ],
      proof_links: [
        { label: "Program outcomes", url: "https://example.com/yuki-outcomes" },
      ],
    },
  },
  {
    email: `fleet-guest-28${DEMO_DOMAIN}`,
    displayName: "Carlos Mendez",
    title: "Physical therapist · runners",
    bio: "Carlos is a PT specializing in runners — from couch-to-5K to ultramarathoners. He's treated 5,000+ runners and believes most running injuries are training errors, not bad luck. His return-to-run protocols are used by clinics in 12 countries.",
    timezone: "America/New_York",
    avail: [["tue", 9, 12], ["sat", 9, 11]],
    availNotes: "Tue mornings / Sat mornings ET",
    links: [{ label: "Clinic", url: "https://example.com/carlos-run" }],
    topics: ["fitness", "health-wellness", "personal-development"],
    guest: {
      expertise:
        "Running injury rehab. Carlos's protocols have returned 5,000+ runners to pain-free training.",
      talking_points: [
        "Your injury is a training error, not bad luck",
        "The return-to-run framework clinics actually use",
        "Strength training for runners who hate gyms",
      ],
      proof_links: [
        { label: "Rehab protocols", url: "https://example.com/carlos-protocols" },
      ],
    },
  },
  {
    email: `fleet-guest-29${DEMO_DOMAIN}`,
    displayName: "Dr. Rachel Green",
    title: "Habit researcher & coach",
    bio: "Rachel has a PhD in behavioral science and coaches people through habit change — not with willpower, but with environment design. Her clients include executives, athletes, and new parents running on fumes.",
    timezone: "America/Chicago",
    avail: [["mon", 13, 16], ["wed", 13, 15]],
    availNotes: "Mon/Wed afternoons CT",
    links: [{ label: "Coaching", url: "https://example.com/rachel-habits" }],
    topics: ["personal-development", "mental-health", "health-wellness"],
    guest: {
      expertise:
        "Behavior change. Rachel's environment-design method has a 70% 6-month adherence rate vs. 20% industry average.",
      talking_points: [
        "Willpower is a terrible strategy",
        "Design your environment, don't fight it",
        "Habit stacking for people with no time",
      ],
      proof_links: [
        { label: "Habit audit", url: "https://example.com/rachel-audit" },
      ],
    },
  },
  {
    email: `fleet-guest-30${DEMO_DOMAIN}`,
    displayName: "Dr. Priya Desai",
    title: "OB-GYN · midlife women's health",
    bio: "Priya is an OB-GYN focused on perimenopause and midlife health — the decade medicine underserves most. She combines clinical practice with public education, reaching 200,000+ women with evidence-based guidance.",
    timezone: "America/Toronto",
    avail: [["thu", 10, 13]],
    availNotes: "Thursday mornings ET",
    links: [{ label: "Education", url: "https://example.com/priya-midlife" }],
    topics: ["health-wellness", "personal-development", "mental-health"],
    guest: {
      expertise:
        "Midlife women's health. Priya's clinic has treated 10,000+ women through perimenopause.",
      talking_points: [
        "Perimenopause: the decade medicine forgot",
        "What the evidence says about HRT",
        "Advocating for yourself in a 7-minute appointment",
      ],
      proof_links: [
        { label: "Patient guide", url: "https://example.com/priya-guide" },
      ],
    },
  },
  {
    email: `fleet-guest-31${DEMO_DOMAIN}`,
    displayName: "Sam Whitfield",
    title: "Breathwork facilitator",
    bio: "Sam is a former paramedic who discovered breathwork during his own PTSD recovery. He now facilitates sessions for veterans, first responders, and executives — practical nervous-system tools, zero mysticism.",
    timezone: "Australia/Sydney",
    avail: [["fri", 9, 12]],
    availNotes: "Friday mornings AEDT",
    links: [{ label: "Sessions", url: "https://example.com/sam-breath" }],
    topics: ["mental-health", "health-wellness", "personal-development"],
    guest: {
      expertise:
        "Nervous-system regulation. Sam has facilitated 1,000+ sessions for high-stress professionals.",
      talking_points: [
        "From paramedic to breathwork: my recovery story",
        "Your nervous system has a manual — here's page one",
        "Breathwork for people who roll their eyes at breathwork",
      ],
      proof_links: [
        { label: "Practice intro", url: "https://example.com/sam-intro" },
      ],
    },
  },
  {
    email: `fleet-guest-32${DEMO_DOMAIN}`,
    displayName: "Nina Kowalski",
    title: "Newsletter writer · 60k readers",
    bio: "Nina writes a weekly newsletter on the business of creativity with 60,000 subscribers. She spent a decade as a magazine editor before going independent. Her open rates are the envy of the industry — she'll tell you exactly why.",
    timezone: "America/New_York",
    avail: [["tue", 11, 14]],
    availNotes: "Tuesday midday ET",
    links: [{ label: "Newsletter", url: "https://example.com/nina-letter" }],
    topics: ["writing-publishing", "creativity", "entrepreneurship"],
    guest: {
      expertise:
        "Newsletter businesses. Nina grew to 60k subscribers and $400k/year with no ads.",
      talking_points: [
        "The subject lines behind a 58% open rate",
        "From magazine editor to independent: the business model",
        "Writing consistently for 5 years: systems over inspiration",
      ],
      proof_links: [
        { label: "Growth breakdown", url: "https://example.com/nina-growth" },
      ],
    },
  },
  {
    email: `fleet-guest-33${DEMO_DOMAIN}`,
    displayName: "Omar Haddad",
    title: "Comedy writer · late-night TV",
    bio: "Omar has written for two late-night shows and tours stand-up on weekends. He teaches comedy writing to non-comedians — marketers, founders, teachers — who want to be funnier on purpose.",
    timezone: "America/Los_Angeles",
    avail: [["wed", 14, 17]],
    availNotes: "Wednesday afternoons PT",
    links: [{ label: "Tour dates", url: "https://example.com/omar-comedy" }],
    topics: ["comedy", "creativity", "writing-publishing"],
    guest: {
      expertise:
        "Comedy writing. Omar's jokes have aired to 3M+ nightly viewers.",
      talking_points: [
        "The joke-writing formula anyone can learn",
        "Bombing on stage: what failure teaches fast",
        "Why founders should study stand-up",
      ],
      proof_links: [
        { label: "Stand-up set", url: "https://example.com/omar-set" },
      ],
    },
  },
  {
    email: `fleet-guest-34${DEMO_DOMAIN}`,
    displayName: "Isabelle Marchand",
    title: "Documentary filmmaker",
    bio: "Isabelle directs documentaries about overlooked communities — her latest premiered at a major festival and was acquired for streaming. She spent five years as a news camerawoman in conflict zones before moving to long-form.",
    timezone: "Europe/London",
    avail: [["thu", 10, 13]],
    availNotes: "Thursday mornings GMT",
    links: [{ label: "Films", url: "https://example.com/isabelle-films" }],
    topics: ["creativity", "podcasting-media", "personal-development"],
    guest: {
      expertise:
        "Documentary storytelling. Isabelle's films have 12 festival selections and a streaming acquisition.",
      talking_points: [
        "Earning trust with vulnerable subjects",
        "From news to documentary: slowing down to see",
        "The edit: where the story actually gets written",
      ],
      proof_links: [
        { label: "Festival trailer", url: "https://example.com/isabelle-trailer" },
      ],
    },
  },
  {
    email: `fleet-guest-35${DEMO_DOMAIN}`,
    displayName: "Ben Carter",
    title: "Podcast producer · 200+ episodes",
    bio: "Ben has produced 200+ podcast episodes across true crime, business, and comedy. He knows what makes listeners stay past minute two — and what makes them leave. His production company works with independent creators and brands.",
    timezone: "America/Chicago",
    avail: [["fri", 10, 13]],
    availNotes: "Friday mornings CT",
    links: [{ label: "Studio", url: "https://example.com/ben-audio" }],
    topics: ["podcasting-media", "creativity", "entrepreneurship"],
    guest: {
      expertise:
        "Podcast production. Ben's shows average 3x the industry completion rate.",
      talking_points: [
        "The first 2 minutes decide everything",
        "Editing: what to cut that everyone keeps",
        "Producing for independents vs. brands",
      ],
      proof_links: [
        { label: "Production reel", url: "https://example.com/ben-reel" },
      ],
    },
  },
  {
    email: `fleet-guest-36${DEMO_DOMAIN}`,
    displayName: "Dr. Grace Liu",
    title: "Nonfiction author · decision science",
    bio: "Grace is a former professor who wrote a bestselling book on how high-stakes decisions get made. She left academia to write full-time and now speaks about the research on judgment, luck, and regret.",
    timezone: "America/New_York",
    avail: [["mon", 10, 13]],
    availNotes: "Monday mornings ET",
    links: [{ label: "Book", url: "https://example.com/grace-book" }],
    topics: ["writing-publishing", "personal-development", "leadership"],
    guest: {
      expertise:
        "Decision science. Grace's book spent 20 weeks on bestseller lists and is taught in 40 MBA programs.",
      talking_points: [
        "Good decisions, bad outcomes: separating luck from skill",
        "The pre-mortem: 30 minutes that save projects",
        "Why I left tenure to write",
      ],
      proof_links: [
        { label: "Book site", url: "https://example.com/grace-book" },
        { label: "University talk", url: "https://example.com/grace-talk" },
      ],
    },
  },
  {
    email: `fleet-guest-37${DEMO_DOMAIN}`,
    displayName: "Diego Fuentes",
    title: "Illustrator · visual storyteller",
    bio: "Diego is an illustrator whose visual essays have 2M+ followers across platforms. He draws complex ideas — economics, psychology, history — in a style a 12-year-old could follow. Brands pay him $15k+ per piece.",
    timezone: "America/Mexico_City",
    avail: [["tue", 10, 13]],
    availNotes: "Tuesday mornings CT",
    links: [{ label: "Portfolio", url: "https://example.com/diego-draws" }],
    topics: ["creativity", "writing-publishing", "entrepreneurship"],
    guest: {
      expertise:
        "Visual communication. Diego's essays average 500k views and he's fully independent.",
      talking_points: [
        "Drawing ideas a 12-year-old can follow",
        "The business of being an independent illustrator",
        "Visuals beat threads: the attention data",
      ],
      proof_links: [
        { label: "Viral essay", url: "https://example.com/diego-essay" },
      ],
    },
  },
  {
    email: `fleet-guest-38${DEMO_DOMAIN}`,
    displayName: "Alicia Grant",
    title: "Music producer · creator economy",
    bio: "Alicia produced records for indie artists for 15 years before building a sample business that now serves 100,000+ creators. She straddles old and new music industry — and has thoughts on both.",
    timezone: "America/Los_Angeles",
    avail: [["thu", 14, 17]],
    availNotes: "Thursday afternoons PT",
    links: [{ label: "Catalog", url: "https://example.com/alicia-sounds" }],
    topics: ["creativity", "entrepreneurship", "podcasting-media"],
    guest: {
      expertise:
        "Creator businesses. Alicia's sample company does $2M/year with a team of five.",
      talking_points: [
        "From studio to startup: the music industry pivot",
        "Selling to creators: what actually converts",
        "AI and music: a producer's honest take",
      ],
      proof_links: [
        { label: "Producer interview", url: "https://example.com/alicia-interview" },
      ],
    },
  },
  {
    email: `fleet-guest-39${DEMO_DOMAIN}`,
    displayName: "Dr. Henry Osei",
    title: "Behavioral economist",
    bio: "Henry studies why smart people make dumb money decisions. A former central bank researcher, he now advises fintech apps on product design. His talks blend experiments, stories, and the occasional magic trick.",
    timezone: "America/New_York",
    avail: [["wed", 10, 13]],
    availNotes: "Wednesday mornings ET",
    links: [{ label: "Research", url: "https://example.com/henry-econ" }],
    topics: ["finance-investing", "personal-development", "entrepreneurship"],
    guest: {
      expertise:
        "Behavioral finance. Henry's product experiments have lifted savings rates by 25% at partner fintechs.",
      talking_points: [
        "Why smart people make dumb money moves",
        "Designing apps that nudge better decisions",
        "From central banking to startups",
      ],
      proof_links: [
        { label: "Conference keynote", url: "https://example.com/henry-keynote" },
      ],
    },
  },
  {
    email: `fleet-guest-40${DEMO_DOMAIN}`,
    displayName: "Laura Bennett",
    title: "Former journalist · media literacy",
    bio: "Laura spent 18 years as an investigative reporter before leaving to teach media literacy. She trains students, executives, and retirees to spot manipulation — and her workshops are famously un-boring.",
    timezone: "America/Washington",
    avail: [["fri", 11, 14]],
    availNotes: "Friday midday ET",
    links: [{ label: "Workshops", url: "https://example.com/laura-media" }],
    topics: ["podcasting-media", "writing-publishing", "personal-development"],
    guest: {
      expertise:
        "Media literacy. Laura has trained 20,000+ people to navigate misinformation.",
      talking_points: [
        "18 years of investigations: what I learned about truth",
        "Spotting manipulation in 30 seconds",
        "Why media literacy is a leadership skill now",
      ],
      proof_links: [
        { label: "Investigation archive", url: "https://example.com/laura-work" },
      ],
    },
  }
);

// ---------------------------------------------------------------------------
// HOSTS (26)
// ---------------------------------------------------------------------------

const HOSTS = [
  {
    email: `fleet-host-01${DEMO_DOMAIN}`,
    displayName: "Jake Morrison",
    title: "Host of Zero to One Hundred",
    bio: "Jake interviews founders about the messy middle — the stretch between launch and scale that nobody posts about. A former startup operator himself, he asks the questions founders dodge at conferences. 180 episodes and counting.",
    timezone: "America/Toronto",
    avail: [["tue", 10, 14], ["thu", 10, 14]],
    availNotes: "Records Tue/Thu midday ET",
    links: [{ label: "Show site", url: "https://example.com/zero-to-one-hundred" }],
    topics: ["startups", "entrepreneurship", "leadership"],
    host: {
      show_name: "Zero to One Hundred",
      show_url: "https://example.com/zero-to-one-hundred",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Founders with $1M+ in revenue or 20+ employees who can talk honestly about a near-death moment. No pitch decks, no PR answers — I want the decision you almost got wrong.",
      booking_url: "https://example.com/zero-to-one-hundred/book",
      recent_episode_url: "https://example.com/zero-to-one-hundred/ep180",
    },
  },
  {
    email: `fleet-host-02${DEMO_DOMAIN}`,
    displayName: "Dr. Anita Rao",
    title: "Host of The AI Builder",
    bio: "Anita is a former ML researcher who now hosts long-form conversations with people shipping AI products. Her show is technical but human — architecture diagrams welcome, hype not. Listeners are engineers, PMs, and founders.",
    timezone: "America/New_York",
    avail: [["wed", 10, 13], ["fri", 10, 12]],
    availNotes: "Records Wed/Fri mornings ET",
    links: [{ label: "Show site", url: "https://example.com/ai-builder" }],
    topics: ["artificial-intelligence", "software-technology", "product-management"],
    host: {
      show_name: "The AI Builder",
      show_url: "https://example.com/ai-builder",
      format: "remote",
      medium: "audio",
      cadence: "Weekly",
      episode_length_minutes: 60,
      guest_criteria:
        "Engineers, researchers, or PMs who have shipped an AI feature to real users. Come prepared to discuss trade-offs, failures, and what you'd do differently — surface-level takes don't land here.",
      booking_url: "",
      recent_episode_url: "https://example.com/ai-builder/ep64",
    },
  },
  {
    email: `fleet-host-03${DEMO_DOMAIN}`,
    displayName: "Chris Dalton",
    title: "Host of Pipeline",
    bio: "Chris spent 15 years in B2B sales leadership before starting Pipeline, a show about what actually moves revenue. He interviews sales leaders, founders, and the occasional skeptic about tactics that survive contact with real buyers.",
    timezone: "America/Chicago",
    avail: [["mon", 9, 12], ["wed", 9, 11]],
    availNotes: "Records Mon/Wed mornings CT",
    links: [{ label: "Show site", url: "https://example.com/pipeline-show" }],
    topics: ["sales", "marketing", "startups"],
    host: {
      show_name: "Pipeline",
      show_url: "https://example.com/pipeline-show",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 40,
      guest_criteria:
        "Sales leaders or founders with a repeatable motion and real numbers. I want tactics with attribution, not philosophy. Bonus if you've failed publicly and can say why.",
      booking_url: "https://example.com/pipeline-show/book",
      recent_episode_url: "https://example.com/pipeline-show/ep91",
    },
  },
  {
    email: `fleet-host-04${DEMO_DOMAIN}`,
    displayName: "Emily Zhang",
    title: "Host of Compound",
    bio: "Emily is a former portfolio manager who interviews investors, founders, and economists about how money actually works. Compound is calm, rigorous, and allergic to hot takes — the show for people who read footnotes.",
    timezone: "America/New_York",
    avail: [["tue", 13, 16]],
    availNotes: "Records Tuesday afternoons ET",
    links: [{ label: "Show site", url: "https://example.com/compound-show" }],
    topics: ["finance-investing", "entrepreneurship", "personal-development"],
    host: {
      show_name: "Compound",
      show_url: "https://example.com/compound-show",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 55,
      guest_criteria:
        "Investors, operators, or researchers with a differentiated view and the data to back it. I do my homework — guests should expect precise questions, not softball intros.",
      booking_url: "",
      recent_episode_url: "https://example.com/compound-show/ep48",
    },
  },
  {
    email: `fleet-host-05${DEMO_DOMAIN}`,
    displayName: "Marcus Bell",
    title: "Host of Doors & Deals",
    bio: "Marcus owns 120 rental units and interviews real estate investors about deals — the numbers, the mistakes, the tenants. No Lamborghinis, no 'passive income' fantasies. Just underwriting, management, and patience.",
    timezone: "America/Denver",
    avail: [["sat", 9, 13]],
    availNotes: "Records Saturday mornings MT",
    links: [{ label: "Show site", url: "https://example.com/doors-deals" }],
    topics: ["real-estate", "finance-investing", "entrepreneurship"],
    host: {
      show_name: "Doors & Deals",
      show_url: "https://example.com/doors-deals",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 50,
      guest_criteria:
        "Investors with 10+ units or 3+ flips who'll share real numbers. Bring a deal breakdown — purchase, rehab, rents, and what went wrong. Gurus selling courses need not apply.",
      booking_url: "https://example.com/doors-deals/book",
      recent_episode_url: "https://example.com/doors-deals/ep112",
    },
  },
  {
    email: `fleet-host-06${DEMO_DOMAIN}`,
    displayName: "Sarah Kim",
    title: "Host of The Manager's Chair",
    bio: "Sarah coaches new managers by day and interviews experienced leaders by night. Her show digs into the human side of management — hard conversations, hiring mistakes, and the loneliness of being the boss.",
    timezone: "America/Los_Angeles",
    avail: [["thu", 10, 13]],
    availNotes: "Records Thursday mornings PT",
    links: [{ label: "Show site", url: "https://example.com/managers-chair" }],
    topics: ["leadership", "career-growth", "mental-health"],
    host: {
      show_name: "The Manager's Chair",
      show_url: "https://example.com/managers-chair",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 45,
      guest_criteria:
        "People who've managed teams of 5+ through something hard — a layoff, a turnaround, hypergrowth. I want stories with stakes and lessons, not frameworks from a slide deck.",
      booking_url: "",
      recent_episode_url: "https://example.com/managers-chair/ep37",
    },
  },
  {
    email: `fleet-host-07${DEMO_DOMAIN}`,
    displayName: "David Chen",
    title: "Host of Second Act",
    bio: "David interviews people who changed careers after 35 — lawyers turned chefs, bankers turned builders. He made his own pivot from consulting to media at 41, so the questions come from lived experience.",
    timezone: "America/Toronto",
    avail: [["wed", 11, 14], ["fri", 10, 12]],
    availNotes: "Records Wed/Fri midday ET",
    links: [{ label: "Show site", url: "https://example.com/second-act" }],
    topics: ["career-growth", "personal-development", "entrepreneurship"],
    host: {
      show_name: "Second Act",
      show_url: "https://example.com/second-act",
      format: "both",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 40,
      guest_criteria:
        "Career changers 35+ who are at least 2 years into the new path and can speak to the transition honestly — the money dip, the identity wobble, and whether it was worth it.",
      booking_url: "https://example.com/second-act/book",
      recent_episode_url: "https://example.com/second-act/ep76",
    },
  },
  {
    email: `fleet-host-08${DEMO_DOMAIN}`,
    displayName: "Dr. Maya Patel",
    title: "Host of The Long Game",
    bio: "Maya is a preventive-medicine physician who interviews researchers and clinicians about living longer and better. The show translates studies into practice without the wellness-industry nonsense.",
    timezone: "America/Chicago",
    avail: [["mon", 12, 15]],
    availNotes: "Records Monday midday CT",
    links: [{ label: "Show site", url: "https://example.com/long-game" }],
    topics: ["health-wellness", "fitness", "nutrition"],
    host: {
      show_name: "The Long Game",
      show_url: "https://example.com/long-game",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 60,
      guest_criteria:
        "Clinicians, researchers, or practitioners with evidence-based views on longevity, metabolic health, or behavior change. I push back on hype — bring your citations.",
      booking_url: "",
      recent_episode_url: "https://example.com/long-game/ep88",
    },
  },
  {
    email: `fleet-host-09${DEMO_DOMAIN}`,
    displayName: "Tom Richards",
    title: "Host of Barbell & Beyond 40",
    bio: "Tom is a 52-year-old strength coach who interviews athletes, coaches, and everyday lifters about training for life after 40. Practical, funny, and allergic to fitness fads.",
    timezone: "America/Denver",
    avail: [["tue", 9, 12], ["thu", 9, 11]],
    availNotes: "Records Tue/Thu mornings MT",
    links: [{ label: "Show site", url: "https://example.com/barbell-beyond" }],
    topics: ["fitness", "health-wellness", "personal-development"],
    host: {
      show_name: "Barbell & Beyond 40",
      show_url: "https://example.com/barbell-beyond",
      format: "remote",
      medium: "audio",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Coaches, athletes 40+, or clinicians who work with aging athletes. Practical programming talk welcome; miracle supplements and 6-week transformations are not.",
      booking_url: "https://example.com/barbell-beyond/book",
      recent_episode_url: "https://example.com/barbell-beyond/ep95",
    },
  },
  {
    email: `fleet-host-10${DEMO_DOMAIN}`,
    displayName: "Dr. Elena Brooks",
    title: "Host of Evidence Plate",
    bio: "Elena is a dietitian with a PhD who interviews nutrition researchers about what the evidence actually says. The show is where nutrition science meets real life — no fear-mongering, no miracle foods.",
    timezone: "Europe/London",
    avail: [["wed", 10, 13]],
    availNotes: "Records Wednesday mornings GMT",
    links: [{ label: "Show site", url: "https://example.com/evidence-plate" }],
    topics: ["nutrition", "health-wellness", "fitness"],
    host: {
      show_name: "Evidence Plate",
      show_url: "https://example.com/evidence-plate",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 50,
      guest_criteria:
        "Nutrition researchers, dietitians, or physicians who can discuss studies accurately and translate them for non-scientists. I fact-check everything — come correct.",
      booking_url: "",
      recent_episode_url: "https://example.com/evidence-plate/ep42",
    },
  },
  {
    email: `fleet-host-11${DEMO_DOMAIN}`,
    displayName: "James O'Connor",
    title: "Host of Mind at Work",
    bio: "James interviews psychologists, founders, and executives about mental health in high-pressure careers. He started the show after his own burnout in finance — conversations are candid and stigma-free.",
    timezone: "America/New_York",
    avail: [["fri", 10, 13]],
    availNotes: "Records Friday mornings ET",
    links: [{ label: "Show site", url: "https://example.com/mind-at-work" }],
    topics: ["mental-health", "leadership", "personal-development"],
    host: {
      show_name: "Mind at Work",
      show_url: "https://example.com/mind-at-work",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Mental health professionals, or leaders willing to talk openly about their own struggles and what helped. Vulnerability required; platitudes rejected.",
      booking_url: "https://example.com/mind-at-work/book",
      recent_episode_url: "https://example.com/mind-at-work/ep103",
    },
  },
  {
    email: `fleet-host-12${DEMO_DOMAIN}`,
    displayName: "Lisa Tran",
    title: "Host of Designed Life",
    bio: "Lisa interviews authors, researchers, and practitioners about intentional living — habits, attention, and designing a life on purpose. A former product designer, she brings systems thinking to personal growth.",
    timezone: "America/Los_Angeles",
    avail: [["tue", 13, 16]],
    availNotes: "Records Tuesday afternoons PT",
    links: [{ label: "Show site", url: "https://example.com/designed-life" }],
    topics: ["personal-development", "creativity", "mental-health"],
    host: {
      show_name: "Designed Life",
      show_url: "https://example.com/designed-life",
      format: "remote",
      medium: "audio",
      cadence: "Weekly",
      episode_length_minutes: 40,
      guest_criteria:
        "People with a tested framework for living better — authors, researchers, coaches with real client results. I want actionable systems, not inspiration quotes.",
      booking_url: "",
      recent_episode_url: "https://example.com/designed-life/ep129",
    },
  },
  {
    email: `fleet-host-13${DEMO_DOMAIN}`,
    displayName: "Robert Chang",
    title: "Host of Draft & Revise",
    bio: "Robert is a novelist who interviews writers about craft — the sentences, the structure, the rewrites. Guests range from debut authors to Pulitzer winners. The show is beloved by MFA programs and writing groups.",
    timezone: "America/New_York",
    avail: [["thu", 11, 14]],
    availNotes: "Records Thursday midday ET",
    links: [{ label: "Show site", url: "https://example.com/draft-revise" }],
    topics: ["writing-publishing", "creativity", "personal-development"],
    host: {
      show_name: "Draft & Revise",
      show_url: "https://example.com/draft-revise",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 55,
      guest_criteria:
        "Published authors (trad or indie with 10k+ readers) who love talking craft, not just promoting. Editors and agents with strong opinions also welcome.",
      booking_url: "https://example.com/draft-revise/book",
      recent_episode_url: "https://example.com/draft-revise/ep58",
    },
  },
];

HOSTS.push(
  {
    email: `fleet-host-14${DEMO_DOMAIN}`,
    displayName: "Dana Whitaker",
    title: "Host of Mic Drop Comedy",
    bio: "Dana is a stand-up comic with 12 years on stage who interviews comedians about the craft of being funny. The show goes deep on writing, bombing, and the business of making people laugh for a living.",
    timezone: "America/Chicago",
    avail: [["wed", 14, 17]],
    availNotes: "Records Wednesday afternoons CT",
    links: [{ label: "Show site", url: "https://example.com/mic-drop-comedy" }],
    topics: ["comedy", "creativity", "podcasting-media"],
    host: {
      show_name: "Mic Drop Comedy",
      show_url: "https://example.com/mic-drop-comedy",
      format: "both",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 50,
      guest_criteria:
        "Working comics, comedy writers, or improv teachers with stage time and stories. I want craft talk — how the bit was built — plus your worst bomb story. Everyone has one.",
      booking_url: "https://example.com/mic-drop-comedy/book",
      recent_episode_url: "https://example.com/mic-drop-comedy/ep84",
    },
  },
  {
    email: `fleet-host-15${DEMO_DOMAIN}`,
    displayName: "Kevin Osei",
    title: "Host of Creator Ledger",
    bio: "Kevin covers the business of being a creator — revenue streams, burnout, and the platforms in between. A former YouTuber with 500k subscribers himself, he asks about money without flinching.",
    timezone: "America/Los_Angeles",
    avail: [["mon", 13, 16], ["fri", 13, 15]],
    availNotes: "Records Mon/Fri afternoons PT",
    links: [{ label: "Show site", url: "https://example.com/creator-ledger" }],
    topics: ["creativity", "entrepreneurship", "podcasting-media"],
    host: {
      show_name: "Creator Ledger",
      show_url: "https://example.com/creator-ledger",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Full-time creators willing to share real revenue numbers and what's actually working. No 'just be authentic' advice — I want the spreadsheet behind the success.",
      booking_url: "",
      recent_episode_url: "https://example.com/creator-ledger/ep71",
    },
  },
  {
    email: `fleet-host-16${DEMO_DOMAIN}`,
    displayName: "Priya Raman",
    title: "Host of Bootstrapped",
    bio: "Priya interviews founders building profitable companies without venture capital. She bootstrapped her own SaaS to $3M ARR, so she knows the specific joys and miseries of the path — profitable, unsexy, free.",
    timezone: "America/Toronto",
    avail: [["tue", 10, 13]],
    availNotes: "Records Tuesday mornings ET",
    links: [{ label: "Show site", url: "https://example.com/bootstrapped-show" }],
    topics: ["startups", "entrepreneurship", "finance-investing"],
    host: {
      show_name: "Bootstrapped",
      show_url: "https://example.com/bootstrapped-show",
      format: "remote",
      medium: "audio",
      cadence: "Weekly",
      episode_length_minutes: 40,
      guest_criteria:
        "Founders of profitable, non-VC-backed companies doing $500k+ revenue. I want the real trade-offs: growth rate, lifestyle, and the moments you almost took the money.",
      booking_url: "https://example.com/bootstrapped-show/book",
      recent_episode_url: "https://example.com/bootstrapped-show/ep117",
    },
  },
  {
    email: `fleet-host-17${DEMO_DOMAIN}`,
    displayName: "Alex Foster",
    title: "Host of Shipped",
    bio: "Alex is a VP of Product who interviews PMs and founders about product decisions — the launches, the kills, and the metrics that mattered. Conversations are tactical and jargon-light.",
    timezone: "America/New_York",
    avail: [["thu", 10, 13]],
    availNotes: "Records Thursday mornings ET",
    links: [{ label: "Show site", url: "https://example.com/shipped-show" }],
    topics: ["product-management", "startups", "software-technology"],
    host: {
      show_name: "Shipped",
      show_url: "https://example.com/shipped-show",
      format: "remote",
      medium: "video",
      cadence: "Biweekly",
      episode_length_minutes: 45,
      guest_criteria:
        "PMs or founders who've shipped consequential products and can walk through a real decision — the data, the debate, the outcome. Case studies beat opinions.",
      booking_url: "",
      recent_episode_url: "https://example.com/shipped-show/ep53",
    },
  },
  {
    email: `fleet-host-18${DEMO_DOMAIN}`,
    displayName: "Dr. Sam Adeleke",
    title: "Host of Data Stories",
    bio: "Sam is a data science leader who interviews practitioners about analytics that changed decisions. The show bridges the gap between dashboards and boardrooms — always with a real story attached.",
    timezone: "Europe/London",
    avail: [["fri", 10, 13]],
    availNotes: "Records Friday mornings GMT",
    links: [{ label: "Show site", url: "https://example.com/data-stories" }],
    topics: ["software-technology", "product-management", "finance-investing"],
    host: {
      show_name: "Data Stories",
      show_url: "https://example.com/data-stories",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 50,
      guest_criteria:
        "Data scientists, analysts, or execs with a story where analysis changed a real decision. Bring the context, the pushback you got, and what happened next.",
      booking_url: "https://example.com/data-stories/book",
      recent_episode_url: "https://example.com/data-stories/ep46",
    },
  },
  {
    email: `fleet-host-19${DEMO_DOMAIN}`,
    displayName: "Rachel Stein",
    title: "Host of Her Seat at the Table",
    bio: "Rachel interviews women in executive leadership about power, negotiation, and leading authentically. A former Fortune 500 VP herself, she creates the conversations she wished she'd heard at 30.",
    timezone: "America/Chicago",
    avail: [["wed", 10, 13]],
    availNotes: "Records Wednesday mornings CT",
    links: [{ label: "Show site", url: "https://example.com/her-seat" }],
    topics: ["leadership", "career-growth", "entrepreneurship"],
    host: {
      show_name: "Her Seat at the Table",
      show_url: "https://example.com/her-seat",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Women in VP+ roles or founders with meaningful scale. I want honest talk about negotiation, sponsorship, and the trade-offs nobody mentions on panels.",
      booking_url: "",
      recent_episode_url: "https://example.com/her-seat/ep92",
    },
  },
  {
    email: `fleet-host-20${DEMO_DOMAIN}`,
    displayName: "Tom Alvarez",
    title: "Host of The Working Parent",
    bio: "Tom interviews parents navigating ambitious careers and family life — the logistics, the guilt, and the systems that work. He's a father of three and a startup exec, recording between school runs.",
    timezone: "America/Denver",
    avail: [["tue", 13, 15], ["thu", 13, 15]],
    availNotes: "Records Tue/Thu early afternoons MT",
    links: [{ label: "Show site", url: "https://example.com/working-parent" }],
    topics: ["personal-development", "career-growth", "mental-health"],
    host: {
      show_name: "The Working Parent",
      show_url: "https://example.com/working-parent",
      format: "remote",
      medium: "audio",
      cadence: "Weekly",
      episode_length_minutes: 35,
      guest_criteria:
        "Parents with demanding careers willing to be specific — childcare setups, calendar systems, the fights about dishes. Practical over perfect.",
      booking_url: "https://example.com/working-parent/book",
      recent_episode_url: "https://example.com/working-parent/ep108",
    },
  },
  {
    email: `fleet-host-21${DEMO_DOMAIN}`,
    displayName: "Nina Petrova",
    title: "Host of Between Drafts",
    bio: "Nina is a literary agent who interviews authors about the business of books — advances, marketing, and the parts of publishing nobody explains. Essential listening for aspiring authors.",
    timezone: "America/New_York",
    avail: [["mon", 11, 14]],
    availNotes: "Records Monday midday ET",
    links: [{ label: "Show site", url: "https://example.com/between-drafts" }],
    topics: ["writing-publishing", "creativity", "entrepreneurship"],
    host: {
      show_name: "Between Drafts",
      show_url: "https://example.com/between-drafts",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 50,
      guest_criteria:
        "Published authors, agents, or editors who'll demystify the business — advances, royalties, what marketing actually moves books. Aspiring authors are my audience; help them.",
      booking_url: "",
      recent_episode_url: "https://example.com/between-drafts/ep39",
    },
  },
  {
    email: `fleet-host-22${DEMO_DOMAIN}`,
    displayName: "Greg Sandoval",
    title: "Host of Press Pass",
    bio: "Greg spent 20 years in newsrooms before starting Press Pass, interviewing journalists about how stories get made. In an era of media distrust, the show is a window into the craft and ethics of reporting.",
    timezone: "America/Washington",
    avail: [["thu", 13, 16]],
    availNotes: "Records Thursday afternoons ET",
    links: [{ label: "Show site", url: "https://example.com/press-pass" }],
    topics: ["podcasting-media", "writing-publishing", "personal-development"],
    host: {
      show_name: "Press Pass",
      show_url: "https://example.com/press-pass",
      format: "remote",
      medium: "video",
      cadence: "Biweekly",
      episode_length_minutes: 55,
      guest_criteria:
        "Journalists, editors, or producers with a story about a story — how an investigation came together, what got cut, and the ethical calls along the way.",
      booking_url: "https://example.com/press-pass/book",
      recent_episode_url: "https://example.com/press-pass/ep61",
    },
  },
  {
    email: `fleet-host-23${DEMO_DOMAIN}`,
    displayName: "Coach Ray Daniels",
    title: "Host of The Competitive Edge",
    bio: "Ray is a former D1 strength coach who interviews athletes and coaches about performance psychology and training. High-energy, practical, and focused on the mental game as much as the physical.",
    timezone: "America/Chicago",
    avail: [["fri", 9, 12]],
    availNotes: "Records Friday mornings CT",
    links: [{ label: "Show site", url: "https://example.com/competitive-edge" }],
    topics: ["fitness", "mental-health", "leadership"],
    host: {
      show_name: "The Competitive Edge",
      show_url: "https://example.com/competitive-edge",
      format: "remote",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 40,
      guest_criteria:
        "Athletes, coaches, or sports psychologists with insights on performance under pressure. I want training details and mindset tools my listeners can use Monday morning.",
      booking_url: "",
      recent_episode_url: "https://example.com/competitive-edge/ep77",
    },
  },
  {
    email: `fleet-host-24${DEMO_DOMAIN}`,
    displayName: "Dr. Fiona Gallagher",
    title: "Host of Secure Stack",
    bio: "Fiona is a former CISO who interviews security leaders about breaches, budgets, and boardrooms. The show treats security as a business discipline — technical enough for practitioners, clear enough for executives.",
    timezone: "America/New_York",
    avail: [["tue", 14, 17]],
    availNotes: "Records Tuesday afternoons ET",
    links: [{ label: "Show site", url: "https://example.com/secure-stack" }],
    topics: ["software-technology", "leadership", "startups"],
    host: {
      show_name: "Secure Stack",
      show_url: "https://example.com/secure-stack",
      format: "remote",
      medium: "audio",
      cadence: "Biweekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Security leaders (CISO, VP Eng, founders) who've handled incidents or built security programs. War stories with lessons welcome; FUD and product pitches are not.",
      booking_url: "https://example.com/secure-stack/book",
      recent_episode_url: "https://example.com/secure-stack/ep44",
    },
  },
  {
    email: `fleet-host-25${DEMO_DOMAIN}`,
    displayName: "Maria Santos",
    title: "Host of Rooted",
    bio: "Maria interviews immigrants and first-generation professionals about building careers and businesses in a new country. Warm, story-driven conversations about identity, ambition, and belonging.",
    timezone: "America/Toronto",
    avail: [["wed", 13, 16]],
    availNotes: "Records Wednesday afternoons ET",
    links: [{ label: "Show site", url: "https://example.com/rooted-show" }],
    topics: ["personal-development", "entrepreneurship", "career-growth"],
    host: {
      show_name: "Rooted",
      show_url: "https://example.com/rooted-show",
      format: "both",
      medium: "video",
      cadence: "Weekly",
      episode_length_minutes: 45,
      guest_criteria:
        "Immigrants or first-gen professionals with a compelling journey — career pivots, businesses built from scratch, or navigating two cultures at work. Story first, credentials second.",
      booking_url: "",
      recent_episode_url: "https://example.com/rooted-show/ep69",
    },
  },
  {
    email: `fleet-host-26${DEMO_DOMAIN}`,
    displayName: "Steve Nakamura",
    title: "Host of The Long Interview",
    bio: "Steve hosts unhurried, 90-minute conversations with interesting people — scientists, artists, founders, chefs. No segments, no gimmicks, just depth. The show's motto: everyone is interesting if you ask long enough.",
    timezone: "America/Los_Angeles",
    avail: [["sat", 10, 14]],
    availNotes: "Records Saturday mornings PT",
    links: [{ label: "Show site", url: "https://example.com/long-interview" }],
    topics: ["creativity", "personal-development", "podcasting-media"],
    host: {
      show_name: "The Long Interview",
      show_url: "https://example.com/long-interview",
      format: "remote",
      medium: "audio",
      cadence: "Monthly",
      episode_length_minutes: 75,
      guest_criteria:
        "People with 20+ years of craft in any field who love talking about it in depth. I do 3+ hours of research per guest — expect the deepest conversation you've had about your work.",
      booking_url: "https://example.com/long-interview/book",
      recent_episode_url: "https://example.com/long-interview/ep28",
    },
  }
);

// ---------------------------------------------------------------------------

async function main() {
  if (process.argv.includes("--remove")) {
    await removeFleet();
    return;
  }
  console.log(`Seeding demo fleet: ${HOSTS.length} hosts + ${GUESTS.length} guests (DEMO DATA — remove with --remove)...`);
  let n = 0;
  for (const h of HOSTS) {
    const id = await ensureUser(h.email, "host");
    await seedProfile(id, h, "host");
    n++;
    if (n % 10 === 0) console.log(`  ...${n} done`);
  }
  for (const g of GUESTS) {
    const id = await ensureUser(g.email, "guest");
    await seedProfile(id, g, "guest");
    n++;
    if (n % 10 === 0) console.log(`  ...${n} done`);
  }
  console.log(`Done. ${n} demo profiles published and queued for embedding.`);
  console.log("Match scores appear once the GPU embedding worker processes the queue.");
}

main().catch((e) => {
  console.error("Fleet seed failed:", e.message);
  process.exit(1);
});
