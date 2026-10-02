import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OneSheet from "@/components/OneSheet";
import type {
  GuestModuleRow,
  HostModuleRow,
  ProfileRow,
  TopicRow,
} from "@/lib/types";

export default async function ProfileViewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = (profile ?? null) as ProfileRow | null;
  if (!p || p.state !== "published") redirect("/profile/builder");

  const [{ data: host }, { data: guest }, { data: pts }] = await Promise.all([
    supabase.from("host_profiles").select("*").eq("profile_id", p.id).maybeSingle(),
    supabase.from("guest_profiles").select("*").eq("profile_id", p.id).maybeSingle(),
    supabase.from("profile_topics").select("topic_id").eq("profile_id", p.id),
  ]);

  const topicIds = ((pts ?? []) as { topic_id: string }[]).map((r) => r.topic_id);
  let topics: TopicRow[] = [];
  if (topicIds.length > 0) {
    const { data } = await supabase
      .from("topics")
      .select("id,label,slug,parent_id,is_custom")
      .in("id", topicIds)
      .order("label");
    topics = (data ?? []) as TopicRow[];
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link
        href="/profile"
        className="tap-target inline-flex items-center font-semibold text-brand-dark"
      >
        ← Back to profile
      </Link>
      <OneSheet
        profile={p}
        hostModule={(host ?? null) as HostModuleRow | null}
        guestModule={(guest ?? null) as GuestModuleRow | null}
        topics={topics}
      />
    </div>
  );
}
