"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { sendFutureYouMessage, type ChatMessage } from "@/server/conversation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Remind me why I started",
  "I broke my momentum",
  "I feel like giving up",
  "Show me progress I'm ignoring",
  "Help me make my goal realistic",
  "What should I focus on this week?",
  "Give me an honest answer",
  "Help me recover after a bad day",
];

export function FutureYouChat({ initial }: { initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [resources, setResources] = useState<{ region: string; name: string; contact: string }[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const body = text.trim();
    if (!body || pending) return;
    setInput("");
    setResources(null);
    setMessages((m) => [...m, { role: "user", content: body }]);
    start(async () => {
      const res = await sendFutureYouMessage(body);
      setMessages((m) => [...m, { role: "assistant", content: res.message }]);
      if (res.kind === "crisis" && res.resources) setResources(res.resources);
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/85 px-6 py-4 backdrop-blur-md">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Talk with</p>
          <h1 className="text-lg font-semibold text-ember">Future You</h1>
        </div>
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">
          Done
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
        {messages.length === 0 ? (
          <div className="animate-rise rounded-2xl border border-border bg-card/50 p-5">
            <p className="text-pretty leading-relaxed">
              I'm the version of you who kept going. I remember why we started, and I've been paying attention. What's
              on your mind?
            </p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-ember text-ember-foreground"
                  : "border border-border bg-card/60 text-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {resources ? (
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <ul className="flex flex-col gap-2 text-sm">
              {resources.map((r) => (
                <li key={r.name} className="flex justify-between gap-4 border-t border-border pt-2 first:border-0 first:pt-0">
                  <span className="text-muted-foreground">{r.region}</span>
                  <span className="text-right font-medium">
                    {r.name} — {r.contact}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
              Future You is thinking…
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {/* Suggestions + composer */}
      <div className="sticky bottom-0 border-t border-border bg-background/90 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md">
        <div className="mx-auto w-full max-w-xl">
          {messages.length < 6 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={pending}
                  className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ember hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Talk to Future You…"
              className="min-h-[48px] max-h-40 flex-1 resize-none"
              rows={1}
            />
            <Button onClick={() => send(input)} disabled={pending || !input.trim()} size="icon" className="h-12 w-12 shrink-0">
              ↑
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
