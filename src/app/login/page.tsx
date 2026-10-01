import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const cleanIntent = intent === "host" || intent === "guest" ? intent : null;
  return <LoginForm intent={cleanIntent} />;
}
