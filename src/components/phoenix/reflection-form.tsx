"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitReflection, type ReflectionResponse } from "@/server/reflection";
import { MOODS } from "@/lib/domain/mood";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ReflectionForm() {
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [response, setResponse] = useState<ReflectionResponse | null>(null);

  function submit() {
    if (body.trim().length < 2) return;
    start(async () => {
      const res = await submitReflection({ body, mood: mood ?? undefined });
      setResponse(res);
    });
  }

  if (response) return <ResponseView response={response} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">How did today really go?</h1>
        <p className="mt-2 text-muted-foreground">No performance. Just the truth of your day.</p>
      </div>

      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Today I…" autoFocus className="min-h-[160px]" />

      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted-foreground">How are you feeling? (optional — you choose)</span>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mood === m.value}
              onClick={() => setMood(mood === m.value ? null : m.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                mood === m.value ? "border-ember bg-ember/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={submit} disabled={pending || body.trim().length < 2} className="self-start">
        {pending ? "Future You is reading…" : "Send to Future You"}
      </Button>
    </div>
  );
}

function ResponseView({ response }: { response: ReflectionResponse }) {
  if (response.kind === "crisis") {
    return (
      <Card className="animate-rise">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">A moment of pause</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-pretty leading-relaxed">{response.message}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {response.resources?.map((r) => (
              <li key={r.name} className="flex justify-between gap-4 border-t border-border pt-2">
                <span className="text-muted-foreground">{r.region}</span>
                <span className="text-right font-medium">
                  {r.name} — {r.contact}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Phoenix isn't a crisis service. Please reach out to real, human support — you deserve it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Future You</p>
        <p className="mt-2 text-pretty text-lg leading-relaxed">{response.message}</p>
      </div>

      {response.progressObserved && response.progressObserved.length > 0 ? (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">What I noticed</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {response.progressObserved.map((p, i) => (
              <li key={i}>· {p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {response.nextAction ? (
        <div className="rounded-xl border border-ember/30 bg-ember/5 p-4">
          <p className="text-xs uppercase tracking-wider text-ember">Tomorrow</p>
          <p className="mt-1 text-sm">{response.nextAction}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {response.xpAwarded > 0 ? <span>+{response.xpAwarded} XP for showing up honestly</span> : null}
        {response.limitReached ? <span>· Daily AI limit reached — this is a grounded standby reply</span> : null}
      </div>

      <Link href="/home" className="text-sm text-ember hover:underline">
        ← Back home
      </Link>
    </div>
  );
}
