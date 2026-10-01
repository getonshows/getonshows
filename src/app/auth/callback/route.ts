import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Completes the Supabase auth flow (magic link and OAuth both land here
 * with a `code`). Routes brand-new users to onboarding, everyone else home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const,
          path: "/",
        },
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // Read-only in some contexts; middleware keeps the session fresh.
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch {
              // See above.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let dest = next;
      if (user) {
        const { data: row } = await supabase
          .from("users")
          .select("role,source")
          .eq("id", user.id)
          .single();
        const role = (row as { role: string; source: string | null } | null)?.role;
        if (!role || role === "undecided") dest = "/onboarding";

        // Acquisition source: the landing page stores ?utm_source (or ?ref)
        // in the gos_source cookie; stamp it on the user row once, and emit
        // the signup funnel event exactly once per user.
        const sourceCookie = cookieStore.get("gos_source")?.value?.slice(0, 80);
        if (sourceCookie) {
          const current = (row as { source: string | null } | null)?.source;
          if (!current) {
            await supabase
              .from("users")
              .update({ source: sourceCookie })
              .eq("id", user.id)
              .is("source", null);
          }
        }
        const { count } = await supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("name", "signup");
        if ((count ?? 0) === 0) {
          // Best-effort: analytics must never break sign-in.
          await supabase.from("events").insert({
            name: "signup",
            user_id: user.id,
            properties: {},
          });
        }
      }
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  // No code, or the exchange failed (expired/reused link): recoverable.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
