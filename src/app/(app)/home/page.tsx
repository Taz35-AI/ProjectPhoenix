import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { firstFutureYouMessage } from "@/lib/ai/fallback";
import { TodaysMissions } from "@/components/phoenix/todays-missions";
import { Card, CardHeader } from "@/components/ui/card";
import { signOut } from "@/server/auth";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/home");

  const supabase = createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const todayKey = new Date().toISOString().slice(0, 10);
  const [{ data: future }, { data: goal }, { data: todaysMissions }] = await Promise.all([
    supabase.from("future_self_profiles").select("title, identity_traits").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("goals")
      .select("id, display_title, domain, dream_or_goal, realism")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("missions")
      .select("id, title, description, estimated_minutes, xp, mission_type")
      .eq("user_id", user.id)
      .eq("scheduled_for", todayKey)
      .order("created_at", { ascending: true }),
  ]);

  const missionsForToday = (todaysMissions ?? []).map((m) => ({
    id: m.id as string,
    title: m.title as string,
    description: (m.description as string | null) ?? null,
    estimatedMinutes: m.estimated_minutes as number,
    xp: m.xp as number,
    missionType: m.mission_type as string,
  }));

  const message = firstFutureYouMessage({
    goalTitle: goal?.display_title ?? null,
    traits: (future?.identity_traits as string[] | null) ?? [],
  });

  return (
    <main className="relative min-h-dvh">
      <div className="phoenix-horizon pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-widest text-ember">PHOENIX</span>
          <form action={signOut}>
            <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
          </form>
        </header>

        {/* Future You message */}
        <section className="animate-rise">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {future?.title ?? "Future You"}
          </p>
          <p className="mt-2 text-pretty text-lg leading-relaxed">{message}</p>
        </section>

        {/* Primary goal */}
        {goal ? (
          <Card className="animate-rise">
            <CardHeader>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Where we're headed</p>
              <p className="text-lg font-medium">{goal.display_title}</p>
              {goal.dream_or_goal === "dream" || goal.realism === "unrealistic_timeframe" ? (
                <p className="text-sm text-muted-foreground">
                  Held as a long-term dream — we build toward it with realistic steps, no promises.
                </p>
              ) : null}
            </CardHeader>
          </Card>
        ) : null}

        {/* Today's missions — AI-generated, safety-validated, interactive */}
        <TodaysMissions initial={missionsForToday} />

        <Link href="/reflection" className="text-center text-sm text-muted-foreground hover:text-foreground">
          Or reflect on your day →
        </Link>
      </div>
    </main>
  );
}
