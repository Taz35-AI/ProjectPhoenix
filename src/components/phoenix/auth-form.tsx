"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { type AuthState } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending} aria-busy={pending}>
      {pending ? "One moment…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "signin" | "signup";
  action: Action;
  next?: string;
}) {
  const [state, formAction] = useFormState(action, { error: null });
  const isSignup = mode === "signup";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignup ? "Begin the journey" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Create your account. Your future self is waiting further down the path."
            : "Sign in to continue where you left off."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-ember">
              {state.error}
            </p>
          ) : null}

          <SubmitButton label={isSignup ? "Create account" : "Sign in"} />
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-ember hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/signup" className="text-ember hover:underline">
                Begin the journey
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
