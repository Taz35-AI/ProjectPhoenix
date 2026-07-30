import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { clientEnv } from "@/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client bound to the request's auth cookies. Uses the
 * ANON key — every query is therefore subject to RLS as the logged-in user.
 * The service-role key is never used here.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const env = clientEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `set` throws in Server Components (read-only cookies). The
          // middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Convenience: the current user or null. */
export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
