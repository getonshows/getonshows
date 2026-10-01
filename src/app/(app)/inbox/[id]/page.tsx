import { notFound } from "next/navigation";
import { getThread } from "@/lib/messaging";
import ThreadView from "@/components/ThreadView";

export const metadata = { title: "Conversation · GetOnShows" };

export default async function ThreadPage({
  params,
}: {
  params: { id: string };
}) {
  let thread;
  try {
    thread = await getThread(params.id);
  } catch {
    notFound();
  }
  return <ThreadView thread={thread} />;
}
