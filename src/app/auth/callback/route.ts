import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation callback. Exchanges the `code` for a session,
 * then routes to onboarding (new users) or the destination. Works inside
 * Capacitor because it relies on cookies set server-side, not URL fragments.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${dest}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
