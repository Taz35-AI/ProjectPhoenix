import { redirect } from "next/navigation";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Journey timeline" };

const PAGE_SIZE = 30;

const ICONS: Record<string, string> = {
  onboarding_completed: "◆",
  goal_created: "◇",
  mission_completed: "✓",
  comeback: "↩",
  chapter_started: "✦",
  weekly_review: "▤",
};

export default async function TimelinePage({ searchParams }: { searchParams: { page?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/timeline");

  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  const supabase = createSupabaseServerClient();
  const { data: events } = await supabase
    .from("timeline_events")
    .select("id, event_type, summary, occurred_at")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const rows = events ?? [];

  return (
    <main className="relative min-h-dvh">
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
        <header>
          <h1 className="text-2xl font-semibold">Your journey</h1>
          <p className="mt-1 text-sm text-muted-foreground">Only what actually happened — no invented milestones.</p>
        </header>

        {rows.length === 0 ? (
          <p className="text-muted-foreground">Nothing here yet. Your first moves will appear as you make them.</p>
        ) : (
          <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
            {rows.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs text-ember">
                  {ICONS[e.event_type as string] ?? "·"}
                </span>
                <p className="text-sm">{e.summary}</p>
                <time className="text-xs text-muted-foreground" dateTime={e.occurred_at as string}>
                  {new Date(e.occurred_at as string).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ol>
        )}

        <div className="flex justify-between text-sm">
          {page > 0 ? (
            <a href={`/timeline?page=${page - 1}`} className="text-ember hover:underline">
              ← Newer
            </a>
          ) : (
            <span />
          )}
          {rows.length === PAGE_SIZE ? (
            <a href={`/timeline?page=${page + 1}`} className="text-ember hover:underline">
              Older →
            </a>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}
