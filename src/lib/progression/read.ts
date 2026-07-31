import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ATTRIBUTE_LABELS, ATTRIBUTES, type Attribute } from "@/lib/domain/attributes";
import { levelFromXp } from "@/lib/domain/xp";
import { computeConsistency, consistencyMessage, type ConsistencySnapshot } from "@/lib/domain/consistency";
import { chapterForProgress, journeyProgress, type ChapterState } from "@/lib/domain/chapters";

export interface ProgressionView {
  totalXp: number;
  level: number;
  intoLevel: number;
  nextLevelAt: number;
  attributes: { attribute: Attribute; label: string; value: number }[];
  consistency: ConsistencySnapshot;
  consistencyLine: string;
  completedMissions: number;
  chapter: ChapterState;
  journey: number;
}

export async function loadProgression(): Promise<ProgressionView | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: xpRows }, { data: attrRows }, { data: checkins }, { count: completed }] = await Promise.all([
    supabase.from("xp_transactions").select("amount").eq("user_id", user.id),
    supabase.from("character_attributes").select("attribute, value").eq("user_id", user.id),
    supabase
      .from("daily_check_ins")
      .select("check_in_date")
      .eq("user_id", user.id)
      .order("check_in_date", { ascending: false })
      .limit(30),
    supabase
      .from("mission_results")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
  ]);

  const totalXp = (xpRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const lvl = levelFromXp(totalXp);

  const valueByAttr = new Map<string, number>((attrRows ?? []).map((r) => [r.attribute as string, Number(r.value)]));
  const attributes = ATTRIBUTES.map((attribute) => ({
    attribute,
    label: ATTRIBUTE_LABELS[attribute],
    value: Math.round(valueByAttr.get(attribute) ?? 0),
  }));

  const activeDays = new Set((checkins ?? []).map((c) => c.check_in_date as string));
  const consistency = computeConsistency(activeDays, new Date());
  const completedMissions = completed ?? 0;

  return {
    totalXp,
    level: lvl.level,
    intoLevel: lvl.intoLevel,
    nextLevelAt: lvl.nextLevelAt,
    attributes,
    consistency,
    consistencyLine: consistencyMessage(consistency),
    completedMissions,
    chapter: chapterForProgress(completedMissions),
    journey: journeyProgress(completedMissions),
  };
}
