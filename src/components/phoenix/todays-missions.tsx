"use client";

import { useState, useTransition } from "react";
import { generateDailyMissions, type GeneratedMission } from "@/server/mission-plan";
import { MissionCard } from "@/components/phoenix/mission-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function TodaysMissions({ initial }: { initial: GeneratedMission[] }) {
  const [missions, setMissions] = useState<GeneratedMission[]>(initial);
  const [pending, start] = useTransition();

  function plan() {
    start(async () => {
      const res = await generateDailyMissions();
      setMissions(res.missions);
    });
  }

  if (missions.length === 0) {
    return (
      <Card className="border-ember/30">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-ember">Today</p>
            <p className="mt-1 text-lg font-medium">Ready when you are.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Future You will shape a few concrete, doable missions from your goal — safe and specific to today.
            </p>
          </div>
          <Button onClick={plan} disabled={pending} className="self-start">
            {pending ? "Shaping today's missions…" : "Plan today's missions"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {missions.map((m) => (
        <MissionCard
          key={m.id}
          mission={{ id: m.id, title: m.title, description: m.description, estimatedMinutes: m.estimatedMinutes, xp: m.xp }}
        />
      ))}
    </div>
  );
}
