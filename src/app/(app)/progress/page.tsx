import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";
import { loadProgression } from "@/lib/progression/read";
import { JourneyPath } from "@/components/phoenix/journey-path";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/progress");

  const p = await loadProgression();
  if (!p) redirect("/onboarding");

  const supabase = createSupabaseServerClient();
  const { data: future } = await supabase
    .from("future_self_profiles")
    .select("identity_traits")
    .eq("user_id", user.id)
    .maybeSingle();
  const identityTraits = (future?.identity_traits as string[] | null) ?? [];

  const building = p.attributes.filter((a) => a.value > 0);
  const dormant = p.attributes.filter((a) => a.value === 0);
  const xpPct = Math.round((p.intoLevel / p.nextLevelAt) * 100);

  return (
    <main className="relative min-h-dvh">
      <div className="phoenix-horizon pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <header>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Chapter {p.chapter.current.id}</p>
          <h1 className="text-2xl font-semibold">{p.chapter.current.title}</h1>
          {p.chapter.missionsToNext !== null && p.chapter.next ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {p.chapter.missionsToNext === 0
                ? `Ready to enter ${p.chapter.next.title}.`
                : `${p.chapter.missionsToNext} more completed ${p.chapter.missionsToNext === 1 ? "mission" : "missions"} to reach ${p.chapter.next.title}.`}
            </p>
          ) : null}
        </header>

        <JourneyPath progress={p.journey} />

        {/* Level + XP */}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Level {p.level}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{p.totalXp} XP total</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-ember" style={{ width: `${xpPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{p.consistencyLine}</p>
          </CardContent>
        </Card>

        <Link href="/weekly-review" className="text-sm text-ember hover:underline">
          See this week's review →
        </Link>

        {/* Consistency */}
        <div className="grid grid-cols-2 gap-4">
          <Stat label="7-day consistency" value={`${Math.round(p.consistency.sevenDay * 100)}%`} />
          <Stat label="30-day consistency" value={`${Math.round(p.consistency.thirtyDay * 100)}%`} />
        </div>

        {/* Attributes — honest: character grows only where you actually act */}
        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Who you're becoming</p>
            {identityTraits.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                You said you want to become:{" "}
                <span className="text-foreground">{identityTraits.join(", ")}</span>.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              These grow only from what you actually do — nothing here is invented.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {building.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing built yet. Complete your first mission and this comes to life.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wider text-ember">Building</p>
                {building.map((a) => (
                  <div key={a.attribute} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span>{a.label}</span>
                      <span className="tabular-nums text-muted-foreground">{a.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-ember/80 transition-all"
                        style={{ width: `${a.value}%` }}
                        role="progressbar"
                        aria-valuenow={a.value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={a.label}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dormant.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Not started yet</p>
                <p className="text-xs text-muted-foreground">
                  These stay at zero until you set goals and take action in these areas — no fake progress.
                </p>
                <div className="flex flex-wrap gap-2">
                  {dormant.map((a) => (
                    <span key={a.attribute} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
