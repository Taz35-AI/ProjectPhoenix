import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { loadBlueprint } from "@/lib/goals/blueprint";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Your plan" };

function fmtDate(d: string | null): string | null {
  return d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;
}

export default async function GoalBlueprintPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bp = await loadBlueprint(params.id);
  if (!bp) redirect("/goals");

  return (
    <main className="relative min-h-dvh">
      <div className="phoenix-horizon pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <Link href="/goals" className="text-sm text-muted-foreground hover:text-foreground">
          ← Goals
        </Link>

        {/* Header */}
        <header>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Your course of action</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{bp.title}</h1>
          {bp.currentState && bp.targetState ? (
            <p className="mt-2 text-muted-foreground">
              From <span className="text-foreground">{bp.currentState}</span> to{" "}
              <span className="text-foreground">{bp.targetState}</span>
              {bp.targetDate ? <> by <span className="text-foreground">{fmtDate(bp.targetDate)}</span></> : null}.
            </p>
          ) : null}
        </header>

        {/* Why + identity */}
        {(bp.why || bp.identityTraits.length > 0) && (
          <Card>
            <CardHeader>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Why this matters</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {bp.why ? <p className="text-pretty leading-relaxed">“{bp.why}”</p> : null}
              {bp.identityTraits.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  You're becoming someone{" "}
                  <span className="text-foreground">{bp.identityTraits.join(", ")}</span>.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* How it fits you (uses "what feels hardest") */}
        {bp.obstacleAdaptations.length > 0 ? (
          <Card className="border-ember/30">
            <CardHeader>
              <p className="text-xs uppercase tracking-wider text-ember">Built around you</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {bp.obstacleAdaptations.map((a, i) => (
                <p key={i} className="text-sm">
                  {a}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Milestone roadmap */}
        {bp.milestones.length > 0 ? (
          <section>
            <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">The path</p>
            <ol className="flex flex-col gap-4 border-l border-border pl-5">
              {bp.milestones.map((m, i) => (
                <li key={i} className="relative">
                  <span
                    className={
                      "absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border text-[9px] " +
                      (m.achieved ? "border-ember bg-ember text-ember-foreground" : "border-border bg-card text-muted-foreground")
                    }
                  >
                    {m.achieved ? "✓" : i + 1}
                  </span>
                  <p className="text-sm">{m.title}</p>
                  {m.targetDate ? <p className="text-xs text-muted-foreground">target ~{fmtDate(m.targetDate)}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Reading / learning plan with a concrete pace */}
        {bp.readingPlans.length > 0 ? (
          <section className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Learn as you go</p>
            {bp.readingPlans.map((rp, i) => (
              <Card key={i}>
                <CardContent className="flex flex-col gap-2 pt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{rp.resource.title}</p>
                    {rp.resource.free ? <span className="text-[10px] uppercase tracking-wider text-ember">free</span> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rp.resource.author}
                    {rp.resource.pages > 0 ? ` · ~${rp.resource.pages} pages` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{rp.resource.why}</p>
                  {rp.pagesPerDay > 0 ? (
                    <p className="text-sm">
                      <span className="text-ember">Your pace: </span>
                      read <span className="font-medium">{rp.pagesPerDay} pages a day</span> to finish in about {rp.days} days.
                    </p>
                  ) : (
                    <p className="text-sm">
                      <span className="text-ember">Your pace: </span>follow one session at a time — no rushing ahead.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">Book suggestions are starting points — any similar one works. Borrow from a library if you can.</p>
          </section>
        ) : null}

        {/* Daily anchors */}
        {bp.dailyAnchors.length > 0 ? (
          <section>
            <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Daily anchors</p>
            <ul className="flex flex-col gap-2">
              {bp.dailyAnchors.map((a, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 text-sm">
                  <span className="text-ember">•</span>
                  {a}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Link href="/home" className="text-center text-sm text-ember hover:underline">
          Start today →
        </Link>
      </div>
    </main>
  );
}
