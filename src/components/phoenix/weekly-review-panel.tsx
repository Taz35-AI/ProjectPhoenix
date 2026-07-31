"use client";

import { useState, useTransition } from "react";
import { generateWeeklyReview, type WeeklyReviewResult } from "@/server/weekly-review";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function WeeklyReviewPanel({
  initial,
  goalTitle,
}: {
  initial: WeeklyReviewResult | null;
  goalTitle: string | null;
}) {
  const [result, setResult] = useState<WeeklyReviewResult | null>(initial);
  const [pending, start] = useTransition();

  function generate() {
    start(async () => setResult(await generateWeeklyReview(goalTitle)));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Weekly review</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your week, read honestly.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={generate} disabled={pending}>
          {pending ? "Reading…" : result ? "Refresh" : "Generate"}
        </Button>
      </header>

      {!result ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Generate this week's review. The numbers are calculated from what you actually did; Future You
            interprets them — and any suggested change is a proposal you choose to accept.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Deterministic stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat value={result.stats.missionsCompleted} label="Completed" />
            <Stat value={`${result.stats.activeDays}/7`} label="Active days" />
            <Stat value={result.stats.xpThisWeek} label="XP" />
          </div>

          {/* Future You message */}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Future You</p>
            <p className="mt-2 text-pretty leading-relaxed">{result.review.message}</p>
          </div>

          {result.review.wins.length > 0 ? <List title="Wins" items={result.review.wins} /> : null}
          {result.review.missed.length > 0 ? <List title="Missed" items={result.review.missed} /> : null}

          <Block title="Pattern" body={result.review.pattern} />
          <Block title="Reality check" body={result.review.realityCheck} />

          <Card className="border-ember/30">
            <CardHeader>
              <p className="text-xs uppercase tracking-wider text-ember">Suggested adjustment (your call)</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{result.review.adjustment}</p>
              <p className="text-muted-foreground">Next-week focus: {result.review.suggestedFocus}</p>
            </CardContent>
          </Card>

          {result.source === "fallback" ? (
            <p className="text-xs text-muted-foreground">
              This is a grounded standby review (AI unavailable or daily limit reached).
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {items.map((it, i) => (
          <li key={i}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  );
}
