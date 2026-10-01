import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setRole } from "@/lib/actions";

const ROLES = [
  {
    value: "host",
    title: "I'm a host",
    body: "Find guests who fit an upcoming episode and will show up prepared.",
  },
  {
    value: "guest",
    title: "I'm a guest",
    body: "Find shows where your expertise creates a useful episode.",
  },
  {
    value: "dual",
    title: "Both",
    body: "You host a show and appear as a guest. Manage one profile, two roles.",
  },
] as const;

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (row && (row as { role: string }).role !== "undecided") {
    redirect("/profile");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          GetOnShows
        </p>
        <h1 className="mt-3 text-3xl font-bold text-navy-900">
          What brings you here?
        </h1>
        <p className="mt-2 text-slate-600">
          This shapes your profile and the matches you&apos;ll see. You can
          change it later.
        </p>

        <form action={setRole} className="mt-8 space-y-4">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="submit"
              name="role"
              value={r.value}
              className="tap-target block w-full rounded-2xl border border-slate-200 bg-white p-5 text-left ring-brand transition hover:border-brand focus-visible:outline-2"
            >
              <span className="block text-lg font-semibold text-navy-900">
                {r.title}
              </span>
              <span className="mt-1 block text-slate-600">{r.body}</span>
            </button>
          ))}
        </form>
      </main>
    </div>
  );
}
