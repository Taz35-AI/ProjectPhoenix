import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { clientEnv } from "@/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase session on every request and enforces coarse route
 * protection. Fine-grained data access is still governed by RLS in the DB —
 * this is a UX gate, not the security boundary.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = clientEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = ["/login", "/signup", "/reset"].some((p) => path.startsWith(p));
  const isProtected = ["/home", "/onboarding", "/missions", "/reflection", "/future-you", "/goals", "/timeline", "/progress", "/chapters", "/weekly-review", "/settings"].some(
    (p) => path.startsWith(p),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return response;
}
