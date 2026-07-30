import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureSession } from "@/server/onboarding";
import { OnboardingWizard } from "@/components/phoenix/onboarding-wizard";

export const metadata = { title: "Your first chapter" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const snapshot = await ensureSession();
  if (snapshot.completed) redirect("/home");

  return <OnboardingWizard snapshot={snapshot} />;
}
