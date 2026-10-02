import { cookies } from "next/headers";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; error?: string }>;
}) {
  const { intent, error } = await searchParams;
  // Preserve the role-aware heading through error recovery: if the callback
  // bounced back without ?intent=, fall back to the gos_intent cookie that
  // LoginForm sets whenever it loads with an intent.
  const cookieStore = await cookies();
  const cookieIntent = cookieStore.get("gos_intent")?.value;
  const cleanIntent =
    intent === "host" || intent === "guest"
      ? intent
      : cookieIntent === "host" || cookieIntent === "guest"
        ? cookieIntent
        : null;
  const linkError = error === "link";
  return <LoginForm intent={cleanIntent} linkError={linkError} />;
}
