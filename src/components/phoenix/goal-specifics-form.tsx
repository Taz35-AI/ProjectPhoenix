"use client";

import { useState, useTransition } from "react";
import { fieldsForDomain, type SpecField } from "@/lib/goals/specifics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Structured capture for a goal's specifics. All plan-driving inputs are
 * numbers/choices/dates — never free text — so the roadmap is exact.
 */
export function GoalSpecificsForm({
  domain,
  initial,
  submitLabel = "Save the specifics",
  onSubmit,
  onSkip,
}: {
  domain: string;
  initial?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onSkip?: () => void;
}) {
  const fields = fieldsForDomain(domain);
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function missingRequired(): SpecField | null {
    for (const f of fields) {
      if (!f.optional && !(values[f.key] ?? "").trim()) return f;
    }
    return null;
  }

  function submit() {
    const missing = missingRequired();
    if (missing) {
      setError(`Please fill in: ${missing.label}`);
      return;
    }
    setError(null);
    start(async () => {
      await onSubmit(values);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">
            {f.label}
            {f.unit ? <span className="ml-1 text-xs">({f.unit})</span> : null}
          </label>

          {f.type === "choice" ? (
            <div className="flex flex-wrap gap-2">
              {f.options?.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={values[f.key] === o.value}
                  onClick={() => set(f.key, o.value)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm transition-colors",
                    values[f.key] === o.value
                      ? "border-ember bg-ember/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : (
            <Input
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              inputMode={f.type === "number" ? "decimal" : undefined}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              min={f.min}
              max={f.max}
            />
          )}
        </div>
      ))}

      {error ? <p className="text-sm text-ember">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Building your path…" : submitLabel}
        </Button>
        {onSkip ? (
          <button onClick={onSkip} disabled={pending} className="text-sm text-muted-foreground hover:text-foreground">
            Skip for now
          </button>
        ) : null}
      </div>
    </div>
  );
}
