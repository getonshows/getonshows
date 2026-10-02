import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type NotifyKind =
  | "pitch"
  | "reply"
  | "booking_proposed"
  | "booking_accepted";

const SITE_URL = "https://www.getonshows.com";
const FROM = "GetOnShows <noreply@getonshows.com>";

// Demo fleet addresses are synthetic; never send real email to them.
const DEMO_DOMAIN = "@getonshows.demo";

// Skip the email when the recipient has the thread open right now: they
// already saw it, and rapid back-and-forth chat would become email spam.
const ACTIVE_READER_WINDOW_MS = 5 * 60 * 1000;

interface PeerContact {
  peer_user_id: string;
  peer_email: string;
  peer_email_notifications: boolean;
  peer_last_read_at: string | null;
}

function emailHtml(args: { heading: string; body: string; cta: { label: string; href: string } }): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f2440;">
  <h2 style="margin:0 0 12px;font-size:22px;color:#0f2440;">${args.heading}</h2>
  <div style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155;">${args.body}</div>
  <a href="${args.cta.href}" style="display:inline-block;background:#FF5A36;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;">${args.cta.label}</a>
  <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">You are receiving this because email notifications are on for your account. <a href="${SITE_URL}/profile" style="color:#64748b;">Manage them in your profile settings</a>.</p>
</div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // Not configured: notifications stay silent, never break the flow.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.warn("[notify] resend rejected email", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    // Best-effort: a notification must never break messaging.
    console.warn("[notify] failed to send email", err);
  }
}

/**
 * Email the other participant of a conversation about new activity.
 * Never throws. Skips when the recipient opted out, is a demo address,
 * or is actively reading the thread right now.
 */
export async function notifyPeer(args: {
  supabase: SupabaseClient;
  conversationId: string;
  kind: NotifyKind;
  actorName: string;
  detail?: string;
}): Promise<void> {
  try {
    const { data } = await args.supabase.rpc("conversation_peer_contact", {
      cid: args.conversationId,
    });
    const peer = ((data ?? []) as PeerContact[])[0] ?? null;
    if (!peer || !peer.peer_email) return;
    if (!peer.peer_email_notifications) return;
    if (peer.peer_email.toLowerCase().endsWith(DEMO_DOMAIN)) return;
    if (
      args.kind !== "pitch" &&
      peer.peer_last_read_at &&
      Date.now() - new Date(peer.peer_last_read_at).getTime() < ACTIVE_READER_WINDOW_MS
    ) {
      return;
    }

    const actor = esc(args.actorName);
    const inboxUrl = `${SITE_URL}/inbox/${args.conversationId}`;
    let subject: string;
    let html: string;

    if (args.kind === "pitch") {
      subject = `New pitch from ${args.actorName} on GetOnShows`;
      const snippet = args.detail ? `<p style="margin:16px 0 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #FF5A36;border-radius:0 8px 8px 0;font-style:italic;">${esc(args.detail)}</p>` : "";
      html = emailHtml({
        heading: `${actor} pitched you`,
        body: `<p style="margin:0;">Someone wants you on their show, or wants to be on yours. Read the pitch and reply while it is fresh.</p>${snippet}`,
        cta: { label: "Read the pitch", href: inboxUrl },
      });
    } else if (args.kind === "reply") {
      subject = `New reply from ${args.actorName} on GetOnShows`;
      html = emailHtml({
        heading: `${actor} replied`,
        body: `<p style="margin:0;">Your conversation is moving. Open it to keep the momentum going.</p>`,
        cta: { label: "Open conversation", href: inboxUrl },
      });
    } else if (args.kind === "booking_proposed") {
      subject = `${args.actorName} proposed times for your recording`;
      html = emailHtml({
        heading: "Recording times proposed",
        body: `<p style="margin:0;">${actor} proposed ${args.detail ?? "some times"} for your recording. Pick the one that works and the booking is confirmed.</p>`,
        cta: { label: "Review times", href: inboxUrl },
      });
    } else {
      subject = `Booking confirmed with ${args.actorName}`;
      html = emailHtml({
        heading: "Booking confirmed",
        body: `<p style="margin:0;">${actor} confirmed your recording${args.detail ? ` for <strong>${esc(args.detail)}</strong>` : ""}. Add it to your calendar from the conversation.</p>`,
        cta: { label: "View booking", href: inboxUrl },
      });
    }

    await sendEmail(peer.peer_email, subject, html);
  } catch (err) {
    console.warn("[notify] peer lookup failed", err);
  }
}
