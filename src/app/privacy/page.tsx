import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | GetOnShows",
  description:
    "How GetOnShows collects, uses, and protects your information.",
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "What we collect",
    body: [
      "Account information: your email address and name, provided when you sign up or sign in.",
      "Profile content: the information you add to your public profile, including your bio, photo, topics, location, availability, and (for hosts) show details.",
      "Messages and activity: pitches, replies, booking requests, and other messages you send through GetOnShows, plus basic usage events that help us understand how the product is used.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "To operate GetOnShows: creating your account, building your public profile, ranking your matches, and delivering the service.",
      "To communicate with you: sign-in links, notifications about pitches, replies, and booking activity, and (if you opt in) product updates.",
      "To improve the product: aggregated, anonymized usage patterns guide what we build next. We do not sell your personal information.",
    ],
  },
  {
    heading: "What is public",
    body: [
      "Anything you publish on your profile (name, photo, bio, topics, show details, availability) is visible to other GetOnShows members and, via your public profile link, to anyone on the internet. Messages and conversations are private to the participants.",
    ],
  },
  {
    heading: "Service providers",
    body: [
      "We use a small number of trusted providers to run GetOnShows: Supabase (database, authentication, and file storage) and Resend (transactional email). They process your data only to provide these services and are bound by their own privacy obligations.",
    ],
  },
  {
    heading: "Social sign-in",
    body: [
      "If you sign in with Google or Facebook, we receive your name, email address, and profile photo from that provider, as you approve on their consent screen. We do not receive your password and we do not post to your accounts.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We use cookies and browser storage for authentication (keeping you signed in), remembering your preferences such as your role intent, and basic analytics. You can clear them in your browser settings, though signing in requires them.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can download your data at any time from your profile, and you can permanently delete your account (including your profile, messages, and pitches) from the Delete my account section. Deletion is immediate and irreversible. To ask about, correct, or remove your information, contact us at the address below.",
    ],
  },
  {
    heading: "Data retention",
    body: [
      "We keep your information while your account is active. Deleted accounts are purged immediately. We may retain anonymized, aggregated data that cannot identify you.",
    ],
  },
  {
    heading: "Children",
    body: [
      "GetOnShows is not intended for children under 13, and we do not knowingly collect their information.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "If we make material changes to this policy, we will note the updated date below. Continued use of GetOnShows after changes take effect means you accept the revised policy.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about this policy or your data: privacy@getonshows.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <nav className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-sm font-semibold text-navy-800">
          ← GetOnShows
        </Link>
      </nav>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16">
        <h1 className="text-3xl font-bold text-navy-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">
          Effective October 2, 2026
        </p>
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-bold text-navy-900">{s.heading}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-600">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
