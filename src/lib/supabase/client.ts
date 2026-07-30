"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/env";

/** Browser Supabase client (anon key, RLS-scoped). */
export function createSupabaseBrowserClient() {
  const env = clientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
