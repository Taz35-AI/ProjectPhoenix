"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding/steps";
import { saveStep } from "@/server/onboarding";
import { classifyGoal, approveGoalAndFinish, type ClassifyResult } from "@/server/goals";
import { saveGoalSpecifics } from "@/server/goal-specifics";
import { GoalSpecificsForm } from "@/components/phoenix/goal-specifics-form";
import { DEFAULT_CRISIS_RESOURCES, crisisMessage } from "@/lib/safety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { OnboardingSnapshot } from "@/server/onboarding";

export function OnboardingWizard({ snapshot }: { snapshot: OnboardingSnapshot }) {
  const router = useRouter();
  const steps = ONBOARDING_STEPS;
  const startIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === snapshot.currentStep),
  );
  const [index, setIndex] = useState(startIndex === -1 ? 0 : startIndex);
  const [answers, setAnswers] = useState<Record<string, unknown>>(snapshot.answers);
  const [saving, startSaving] = useTransition();

  const step = steps[index]!;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  function setAnswer(id: string, value: unknown) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function goNext() {
    const next = steps[index + 1]?.id ?? "primary_goal";
    startSaving(async () => {
      await saveStep(snapshot.sessionId, step.id, answers[step.id] ?? null, next);
      setIndex((i) => Math.min(i + 1, steps.length - 1));
    });
  }
  function goBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="phoenix-horizon pointer-events-none absolute inset-0 opacity-70" aria-hidden />

      {/* Progress */}
      <div className="relative z-10 px-6 pt-6">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          {index > 0 ? (
            <button onClick={goBack} className="text-sm text-muted-foreground hover:text-foreground" aria-label="Go back">
              ← Back
            </button>
          ) : (
            <span className="text-sm font-semibold tracking-widest text-ember">PHOENIX</span>
          )}
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-ember transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1}/{steps.length}
          </span>
        </div>
      </div>

      {/* Step body */}
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        <div key={step.id} className="animate-rise">
          <StepView
            step={step}
            value={answers[step.id]}
            onChange={(v) => setAnswer(step.id, v)}
            answers={answers}
            saving={saving}
            onNext={goNext}
            onFinish={(goalId) => router.push(`/home?welcome=1&goal=${goalId}`)}
            sessionId={snapshot.sessionId}
          />
        </div>
      </div>
    </div>
  );
}

function StepView(props: {
  step: OnboardingStep;
  value: unknown;
  onChange: (v: unknown) => void;
  answers: Record<string, unknown>;
  saving: boolean;
  onNext: () => void;
  onFinish: (goalId: string) => void;
  sessionId: string;
}) {
  const { step } = props;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold leading-tight">{step.title}</h1>
        {step.subtitle ? <p className="text-pretty text-muted-foreground">{step.subtitle}</p> : null}
      </div>

      {step.kind === "intro" && (
        <Button size="lg" onClick={props.onNext} disabled={props.saving} className="self-start">
          {step.cta ?? "Continue"}
        </Button>
      )}

      {step.kind === "text" && <TextStep {...props} />}
      {(step.kind === "single" || step.kind === "multi") && <ChoiceStep {...props} />}
      {step.kind === "goal" && <GoalStep {...props} />}
    </div>
  );
}

function TextStep({ step, value, onChange, saving, onNext }: React.ComponentProps<typeof StepView>) {
  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex flex-col gap-4">
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={step.placeholder}
        autoFocus
      />
      <div className="flex items-center gap-3">
        <Button onClick={onNext} disabled={saving || (!step.optional && text.trim().length === 0)}>
          Continue
        </Button>
        {step.optional ? (
          <button onClick={onNext} className="text-sm text-muted-foreground hover:text-foreground">
            Skip
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceStep({ step, value, onChange, saving, onNext }: React.ComponentProps<typeof StepView>) {
  const multi = step.kind === "multi";
  const selected = useMemo(() => (Array.isArray(value) ? (value as string[]) : typeof value === "string" ? [value] : []), [value]);
  const [other, setOther] = useState("");

  function toggle(v: string) {
    if (!multi) {
      onChange(v);
      return;
    }
    const has = selected.includes(v);
    if (has) onChange(selected.filter((s) => s !== v));
    else if (selected.length < (step.max ?? 99)) onChange([...selected, v]);
  }

  function addOther() {
    const t = other.trim();
    if (!t) return;
    if (multi) onChange([...selected, t]);
    else onChange(t);
    setOther("");
  }

  const canContinue = selected.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {step.options?.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                on
                  ? "border-ember bg-ember/15 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {step.allowOther ? (
        <div className="flex gap-2">
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Something else…" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOther())} />
          <Button type="button" variant="secondary" onClick={addOther}>
            Add
          </Button>
        </div>
      ) : null}

      {multi && step.max ? (
        <p className="text-xs text-muted-foreground">
          {selected.length}/{step.max} selected
        </p>
      ) : null}

      <Button onClick={onNext} disabled={saving || !canContinue} className="self-start">
        Continue
      </Button>
    </div>
  );
}

function GoalStep(props: React.ComponentProps<typeof StepView>) {
  const { step, value, onChange, answers, sessionId, onFinish } = props;
  const initial = typeof value === "string" ? value : typeof answers["one_year"] === "string" ? "" : "";
  const [text, setText] = useState(initial);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function runClassify() {
    if (text.trim().length < 3) return;
    onChange(text);
    startTransition(async () => {
      const focusAreas = Array.isArray(answers["focus_areas"]) ? (answers["focus_areas"] as string[]) : [];
      const identityTraits = Array.isArray(answers["identity"]) ? (answers["identity"] as string[]) : [];
      const r = await classifyGoal(text, { focusAreas, identityTraits });
      setResult(r);
      setTitle(r.classification.cleanedGoalTitle);
    });
  }

  async function createGoal(): Promise<string> {
    const { goalId } = await approveGoalAndFinish({
      sessionId,
      rawInput: text,
      answers,
      approved: {
        displayTitle: title.trim() || result!.classification.cleanedGoalTitle,
        domain: result!.classification.domain,
        dreamOrGoal: result!.classification.dreamOrGoal,
        realism: result!.classification.realismAssessment,
      },
    });
    return goalId;
  }

  function approveWithSpecifics(values: Record<string, string>) {
    startTransition(async () => {
      const goalId = await createGoal();
      await saveGoalSpecifics(goalId, values);
      onFinish(goalId);
    });
  }

  function approveSkip() {
    startTransition(async () => {
      const goalId = await createGoal();
      onFinish(goalId);
    });
  }

  // Crisis: no gamification, no approval — surface real help.
  if (result?.safety.severity === "crisis") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-6">
        <p className="text-pretty">{crisisMessage()}</p>
        <ul className="flex flex-col gap-2 text-sm">
          {DEFAULT_CRISIS_RESOURCES.map((r) => (
            <li key={r.name} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{r.region}</span>
              <span className="text-right font-medium">{r.name} — {r.contact}</span>
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => setResult(null)}>
          Set a gentler goal instead
        </Button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={step.placeholder} autoFocus />
        <Button onClick={runClassify} disabled={pending || text.trim().length < 3} className="self-start">
          {pending ? "Thinking it through…" : step.cta ?? "Continue"}
        </Button>
      </div>
    );
  }

  const c = result.classification;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Future You's reading</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg" aria-label="Goal title" />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge>{labelDreamGoal(c.dreamOrGoal)}</Badge>
          <Badge tone={realismTone(c.realismAssessment)}>{labelRealism(c.realismAssessment)}</Badge>
          <Badge>{c.domain.replace(/_/g, " ")}</Badge>
        </div>

        {c.realismAssessment === "unrealistic_timeframe" || c.dreamOrGoal === "dream" ? (
          <p className="text-sm text-muted-foreground">
            We'll keep this as a long-term dream and build a realistic first step toward it — not a promise, a direction.
          </p>
        ) : null}

        {c.clarificationQuestion ? (
          <p className="text-pretty text-sm">
            <span className="text-ember">One question: </span>
            {c.clarificationQuestion}
          </p>
        ) : null}

        {c.suggestedMeasurableIndicators.length ? (
          <div className="text-sm">
            <span className="text-muted-foreground">You could track: </span>
            {c.suggestedMeasurableIndicators.join(" · ")}
          </div>
        ) : null}
      </div>

      {/* Structured specifics → an exact, dated path (no free-text guessing) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ember/30 bg-ember/5 p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-ember">Let's make it exact</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A few numbers so your path has real milestones — not guesswork.
          </p>
        </div>
        <GoalSpecificsForm
          domain={c.domain}
          submitLabel="Build my path"
          onSubmit={approveWithSpecifics}
          onSkip={approveSkip}
        />
      </div>

      <button onClick={() => setResult(null)} disabled={pending} className="self-start text-sm text-muted-foreground hover:text-foreground">
        Rewrite my goal
      </button>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "good" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1",
        tone === "warn" && "border-ember/50 bg-ember/10 text-ember",
        tone === "good" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        tone === "neutral" && "border-border text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function labelDreamGoal(v: string) {
  return { dream: "Long-term dream", vision: "Vision", goal: "Goal", milestone: "Milestone", identity: "Identity" }[v] ?? v;
}
function labelRealism(v: string) {
  return {
    realistic: "Realistic",
    ambitious: "Ambitious",
    unclear: "Needs detail",
    unrealistic_timeframe: "Timeframe needs a rethink",
    unsafe: "Let's make this safe",
  }[v] ?? v;
}
function realismTone(v: string): "neutral" | "warn" | "good" {
  if (v === "realistic") return "good";
  if (v === "unrealistic_timeframe" || v === "unsafe") return "warn";
  return "neutral";
}
