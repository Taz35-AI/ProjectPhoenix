import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { ReflectionForm } from "@/components/phoenix/reflection-form";

export const metadata = { title: "Evening reflection" };

export default async function ReflectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/reflection");

  return (
    <main className="relative min-h-dvh">
      <div className="phoenix-horizon pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <ReflectionForm />
      </div>
    </main>
  );
}
