import { notFound } from "next/navigation";
import { getThread } from "@/lib/messaging";
import ThreadView from "@/components/ThreadView";

export const metadata = { title: "Conversation · GetOnShows" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let thread;
  try {
    thread = await getThread(id);
  } catch {
    notFound();
  }
  return <ThreadView thread={thread} />;
}
