import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyDelta, type Attribute, type AttributeDeltas } from "@/lib/domain/attributes";
import { chapterForProgress, CHAPTERS } from "@/lib/domain/chapters";
import { xpFor } from "@/lib/domain/xp";

/**
 * Server-side progression helpers. NOT server actions — plain functions called
 * from the daily-loop actions (mission completion, reflection). Keeping them
 * here means attribute/chapter rules live in one place.
 */

/** Reads current attributes, applies deltas with diminishing returns, logs events. */
export async function applyAttributeDeltas(userId: string, deltas: AttributeDeltas, reason: string) {
  const keys = Object.keys(deltas) as Attribute[];
  if (keys.length === 0) return;

  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("character_attributes")
    .select("attribute, value")
    .eq("user_id", userId)
    .in("attribute", keys);

  const current = new Map<string, number>((rows ?? []).map((r) => [r.attribute as string, Number(r.value)]));

  for (const attr of keys) {
    const delta = deltas[attr] ?? 0;
    if (delta === 0) continue;
    const next = applyDelta(current.get(attr) ?? 0, delta);
    await supabase
      .from("character_attributes")
      .upsert({ user_id: userId, attribute: attr, value: next }, { onConflict: "user_id,attribute" });
    await supabase.from("attribute_events").insert({ user_id: userId, attribute: attr, delta, reason });
  }
}

export interface ChapterAdvance {
  enteredChapterId: number;
  title: string;
  entryMessage: string;
}

/**
 * Recomputes the user's chapter from completed-mission count and advances if a
 * threshold was crossed. Awards chapter XP and writes a timeline entry once per
 * new chapter. Never regresses. Returns the newly entered chapter, if any.
 */
export async function syncChapterProgress(userId: string): Promise<ChapterAdvance | null> {
  const supabase = createSupabaseServerClient();

  const { count } = await supabase
    .from("mission_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");
  const completed = count ?? 0;

  const target = chapterForProgress(completed).current;

  const { data: progressRows } = await supabase
    .from("user_chapter_progress")
    .select("chapter_id")
    .eq("user_id", userId);
  const started = new Set((progressRows ?? []).map((r) => Number(r.chapter_id)));

  const highestStarted = started.size ? Math.max(...started) : 0;
  if (target.id <= highestStarted) return null;

  let advance: ChapterAdvance | null = null;
  for (let id = highestStarted + 1; id <= target.id; id++) {
    const def = CHAPTERS.find((c) => c.id === id);
    if (!def) continue;

    // Mark the previous chapter complete.
    if (id > 1) {
      await supabase
        .from("user_chapter_progress")
        .update({ completed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("chapter_id", id - 1)
        .is("completed_at", null);
      const xp = xpFor("chapter_completed");
      await supabase.from("xp_transactions").insert({ user_id: userId, amount: xp.amount, reason: `chapter_${id - 1}_completed` });
    }

    await supabase
      .from("user_chapter_progress")
      .upsert({ user_id: userId, chapter_id: id }, { onConflict: "user_id,chapter_id" });
    await supabase.from("timeline_events").insert({
      user_id: userId,
      event_type: "chapter_started",
      summary: `Entered Chapter ${id}: ${def.title}`,
      tags: ["chapter"],
    });
    advance = { enteredChapterId: id, title: def.title, entryMessage: def.entryMessage };
  }
  return advance;
}
