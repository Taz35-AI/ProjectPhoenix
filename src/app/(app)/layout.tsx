import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/phoenix/bottom-nav";

/**
 * Shell for all authenticated screens: coarse auth gate + persistent nav.
 * The real security boundary is RLS in the database; this is UX routing.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav />
    </div>
  );
}
