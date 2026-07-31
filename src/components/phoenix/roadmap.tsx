"use client";

import { useState, useTransition } from "react";
import { buildRoadmap, type RoadmapMilestone } from "@/server/roadmap";
import { Button } from "@/components/ui/button";

export function Roadmap({ initial, initialNote }: { initial: RoadmapMilestone[]; initialNote: string | null }) {
  const [milestones, setMilestones] = useState<RoadmapMilestone[]>(initial);
  const [note, setNote] = useState<string | null>(initialNote);
  const [pending, start] = useTransition();

  function build() {
    start(async () => {
      const r = await buildRoadmap();
      setMilestones(r.milestones);
      setNote(r.note);
    });
  }

  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Your path</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn your goal into an exact, dated set of milestones.
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={build} disabled={pending}>
          {pending ? "Mapping it out…" : "Build my roadmap"}
        </Button>
      </div>
    );
  }

  const nextIdx = milestones.findIndex((m) => !m.achievedAt);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Your path</p>
        <button onClick={build} disabled={pending} className="text-xs text-muted-foreground hover:text-foreground">
          {pending ? "…" : "Rebuild"}
        </button>
      </div>

      <ol className="mt-4 flex flex-col gap-4 border-l border-border pl-5">
        {milestones.map((m, i) => {
          const isNext = i === nextIdx;
          return (
            <li key={m.id} className="relative">
              <span
                className={
                  "absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border text-[9px] " +
                  (m.achievedAt
                    ? "border-ember bg-ember text-ember-foreground"
                    : isNext
                      ? "border-ember bg-ember/20 text-ember"
                      : "border-border bg-card text-muted-foreground")
                }
              >
                {m.achievedAt ? "✓" : m.sortOrder}
              </span>
              <p className={"text-sm " + (isNext ? "font-medium text-foreground" : "text-muted-foreground")}>
                {m.title}
              </p>
              {m.targetDate ? (
                <p className="text-xs text-muted-foreground">
                  target ~{new Date(m.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {note ? <p className="mt-4 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
