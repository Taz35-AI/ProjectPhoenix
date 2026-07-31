"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeMission, type CompletionStatus } from "@/server/missions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Mission {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  xp: number;
}

export function MissionCard({ mission }: { mission: Mission }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [done, setDone] = useState<null | { status: CompletionStatus; xp: number; comeback: boolean }>(null);

  function complete(status: CompletionStatus) {
    start(async () => {
      const res = await completeMission({ missionId: mission.id, status, note: note.trim() || undefined });
      setDone({ status, xp: res.xpAwarded, comeback: res.returnedAfterAbsence });
      router.refresh();
    });
  }

  if (done) {
    return (
      <Card className="animate-rise border-ember/30">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-ember">
            {done.status === "completed" ? "Done — one honest move made" : done.status === "partial" ? "Partial counts too" : "Noted"}
          </p>
          <p className="text-lg font-medium">{mission.title}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {done.xp > 0 ? <p className="text-sm text-muted-foreground">+{done.xp} XP</p> : null}
          {done.comeback ? (
            <p className="text-sm text-ember">You returned after time away — your momentum is protected.</p>
          ) : null}
          <Button variant="secondary" className="self-start" onClick={() => router.push("/reflection")}>
            Reflect on today →
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-rise border-ember/30">
      <CardHeader>
        <p className="text-xs uppercase tracking-wider text-ember">Today · one honest move</p>
        <p className="text-lg font-medium">{mission.title}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mission.description ? <p className="text-sm text-muted-foreground">{mission.description}</p> : null}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>~{mission.estimatedMinutes} min</span>
          <span>+{mission.xp} XP</span>
        </div>

        {showNote ? (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Log it here — what you ate, did, or noticed…"
            className="min-h-[80px]"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setShowNote(true)}
            className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            + Add a note / log it here
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => complete("completed")} disabled={pending}>
            {pending ? "Saving…" : "Mark complete"}
          </Button>
          <Button variant="secondary" onClick={() => complete("partial")} disabled={pending}>
            Did part of it
          </Button>
          <button
            onClick={() => complete("skipped")}
            disabled={pending}
            className={cn("text-sm text-muted-foreground hover:text-foreground", pending && "opacity-50")}
          >
            Not today
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
