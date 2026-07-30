"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  next: z.string().optional(),
});

export type AuthState = { error: string | null };

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };
  redirect(safeNext(parsed.data.next) ?? "/home");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  // With email confirmation ON, there is no session yet — tell the user to check
  // their inbox. With it OFF (prototype default), a session exists → onboarding.
  if (!data.session) {
    return { error: "Check your email to confirm your account, then sign in." };
  }
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Only allow same-origin relative redirects. */
function safeNext(next: string | undefined): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}
