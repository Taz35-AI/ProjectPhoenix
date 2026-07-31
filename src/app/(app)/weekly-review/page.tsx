import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { WeeklyReviewPanel } from "@/components/phoenix/weekly-review-panel";
import type { WeeklyReviewResult } from "@/server/weekly-review";

export const metadata = { title: "Weekly review" };

export default async function WeeklyReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/weekly-review");

  const supabase = createSupabaseServerClient();
  const [{ data: latest }, { data: goal }] = await Promise.all([
    supabase
      .from("weekly_reviews")
      .select("stats, interpretation, source")
      .eq("user_id", user.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("display_title")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const initial: WeeklyReviewResult | null = latest
    ? {
        stats: latest.stats as WeeklyReviewResult["stats"],
        review: latest.interpretation as WeeklyReviewResult["review"],
        source: (latest.source as "ai" | "fallback") ?? "ai",
      }
    : null;

  return (
    <main className="relative min-h-dvh">
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <WeeklyReviewPanel initial={initial} goalTitle={goal?.display_title ?? null} />
      </div>
    </main>
  );
}
