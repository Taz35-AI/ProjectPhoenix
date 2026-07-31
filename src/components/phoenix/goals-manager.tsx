"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { classifyGoal, type ClassifyResult } from "@/server/goals";
import { createApprovedGoal, updateGoalTitle, setGoalStatus, setPrimaryGoal } from "@/server/goal-manage";
import { saveGoalSpecifics } from "@/server/goal-specifics";
import { GoalSpecificsForm } from "@/components/phoenix/goal-specifics-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface GoalRow {
  id: string;
  displayTitle: string;
  domain: string;
  dreamOrGoal: string;
  status: string;
  priority: number;
}

export function GoalsManager({
  goals,
  context,
}: {
  goals: GoalRow[];
  context: { focusAreas: string[]; identityTraits: string[] };
}) {
  const active = goals.filter((g) => g.status === "active").sort((a, b) => a.priority - b.priority);
  const others = goals.filter((g) => g.status !== "active");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Your goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep the list small on purpose — a clear primary focus beats ten half-goals.
        </p>
      </header>

      <AddGoal context={context} canAdd={active.length < 5} />

      {active.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Active</p>
          {active.map((g, i) => (
            <GoalItem key={g.id} goal={g} isPrimary={i === 0} />
          ))}
        </section>
      ) : null}

      {others.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Paused & archived</p>
          {others.map((g) => (
            <GoalItem key={g.id} goal={g} isPrimary={false} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function GoalItem({ goal, isPrimary }: { goal: GoalRow; isPrimary: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showSpecifics, setShowSpecifics] = useState(false);
  const [title, setTitle] = useState(goal.displayTitle);

  function act(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <div className="flex flex-1 gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button
                size="sm"
                onClick={() =>
                  act(async () => {
                    await updateGoalTitle(goal.id, title);
                    setEditing(false);
                  })
                }
                disabled={pending}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {isPrimary ? (
                  <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ember">
                    Primary
                  </span>
                ) : null}
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{goal.domain.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-1 font-medium">{goal.displayTitle}</p>
            </div>
          )}
        </div>

        {showSpecifics ? (
          <div className="rounded-xl border border-ember/30 bg-ember/5 p-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-ember">Set the specifics → exact roadmap</p>
            <GoalSpecificsForm
              domain={goal.domain}
              submitLabel="Save & rebuild my path"
              onSubmit={async (values) => {
                await saveGoalSpecifics(goal.id, values);
                setShowSpecifics(false);
                router.refresh();
              }}
              onSkip={() => setShowSpecifics(false)}
            />
          </div>
        ) : null}

        {!editing && !showSpecifics ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href={`/goals/${goal.id}`} className="font-medium text-ember hover:underline">
              View plan →
            </Link>
            <button onClick={() => setShowSpecifics(true)} className="text-ember hover:underline">
              Set the specifics
            </button>
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
              Edit
            </button>
            {goal.status === "active" && !isPrimary ? (
              <button onClick={() => act(() => setPrimaryGoal(goal.id))} disabled={pending} className="text-ember hover:underline">
                Make primary
              </button>
            ) : null}
            {goal.status === "active" ? (
              <button onClick={() => act(() => setGoalStatus(goal.id, "paused"))} disabled={pending} className="text-muted-foreground hover:text-foreground">
                Pause
              </button>
            ) : (
              <button onClick={() => act(() => setGoalStatus(goal.id, "active"))} disabled={pending} className="text-ember hover:underline">
                Resume
              </button>
            )}
            {goal.status !== "archived" ? (
              <button onClick={() => act(() => setGoalStatus(goal.id, "archived"))} disabled={pending} className="text-muted-foreground hover:text-foreground">
                Archive
              </button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AddGoal({ context, canAdd }: { context: { focusAreas: string[]; identityTraits: string[] }; canAdd: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function classify() {
    if (text.trim().length < 3) return;
    setError(null);
    start(async () => {
      const r = await classifyGoal(text, context);
      setResult(r);
      setTitle(r.classification.cleanedGoalTitle);
    });
  }

  function add() {
    if (!result) return;
    start(async () => {
      try {
        await createApprovedGoal({
          rawInput: text,
          displayTitle: title.trim() || result.classification.cleanedGoalTitle,
          domain: result.classification.domain,
          dreamOrGoal: result.classification.dreamOrGoal,
          realism: result.classification.realismAssessment,
        });
        setText("");
        setResult(null);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add goal.");
      }
    });
  }

  if (!canAdd) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          You're at 5 active goals — a healthy limit. Pause or archive one to add another.
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        + Add a goal
      </Button>
    );
  }

  return (
    <Card className="border-ember/30">
      <CardHeader>
        <p className="text-sm font-medium">Add a goal</p>
        <p className="text-xs text-muted-foreground">Future You will turn it into a realistic, controllable path.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!result ? (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Read 24 books this year · Save £5,000 · Run a 5k" autoFocus />
            <div className="flex gap-3">
              <Button onClick={classify} disabled={pending || text.trim().length < 3}>
                {pending ? "Thinking it through…" : "Continue"}
              </Button>
              <button onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-4">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Future You's reading</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className={cn("rounded-full border border-border px-2 py-0.5")}>{result.classification.dreamOrGoal}</span>
                <span className={cn("rounded-full border border-border px-2 py-0.5")}>{result.classification.domain.replace(/_/g, " ")}</span>
                <span className={cn("rounded-full border border-border px-2 py-0.5")}>{result.classification.realismAssessment.replace(/_/g, " ")}</span>
              </div>
              {result.classification.clarificationQuestion ? (
                <p className="text-sm"><span className="text-ember">One question: </span>{result.classification.clarificationQuestion}</p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-ember">{error}</p> : null}
            <div className="flex gap-3">
              <Button onClick={add} disabled={pending}>
                {pending ? "Adding…" : "Add this goal"}
              </Button>
              <button onClick={() => setResult(null)} className="text-sm text-muted-foreground hover:text-foreground">
                Rewrite
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
