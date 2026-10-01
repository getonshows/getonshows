import { loadBuilderData } from "@/lib/actions";
import ProfileBuilder from "@/components/ProfileBuilder";

export default async function BuilderPage() {
  const data = await loadBuilderData();
  return <ProfileBuilder data={data} />;
}
