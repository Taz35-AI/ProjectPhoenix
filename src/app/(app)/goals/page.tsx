import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { GoalsManager, type GoalRow } from "@/components/phoenix/goals-manager";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/goals");

  const supabase = createSupabaseServerClient();
  const [{ data: goals }, { data: future }, { data: focus }] = await Promise.all([
    supabase
      .from("goals")
      .select("id, display_title, domain, dream_or_goal, status, priority")
      .eq("user_id", user.id)
      .order("status", { ascending: true })
      .order("priority", { ascending: true }),
    supabase.from("future_self_profiles").select("identity_traits").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_focus_areas").select("life_area_id").eq("user_id", user.id),
  ]);

  const rows: GoalRow[] = (goals ?? []).map((g) => ({
    id: g.id as string,
    displayTitle: g.display_title as string,
    domain: g.domain as string,
    dreamOrGoal: g.dream_or_goal as string,
    status: g.status as string,
    priority: g.priority as number,
  }));

  const context = {
    focusAreas: (focus ?? []).map((f) => f.life_area_id as string),
    identityTraits: (future?.identity_traits as string[] | null) ?? [],
  };

  return (
    <main className="relative min-h-dvh">
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <GoalsManager goals={rows} context={context} />
      </div>
    </main>
  );
}
