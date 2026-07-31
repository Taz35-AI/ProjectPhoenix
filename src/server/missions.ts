"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { xpFor, type XpReason } from "@/lib/domain/xp";
import {
  deltasForMissionCompletion,
  deltasForComeback,
  scaleDeltas,
} from "@/lib/domain/attributes";
import { applyAttributeDeltas, syncChapterProgress, type ChapterAdvance } from "@/lib/progression/apply";

export type CompletionStatus = "completed" | "partial" | "skipped" | "postponed";

export interface CompleteMissionInput {
  missionId: string;
  status: CompletionStatus;
  note?: string;
  durationMinutes?: number;
  quantity?: number;
  /** ALWAYS user-selected. The app never infers mood. */
  mood?: string;
  energy?: number;
}

export interface CompleteMissionResult {
  xpAwarded: number;
  returnedAfterAbsence: boolean;
  status: CompletionStatus;
  chapterAdvance: ChapterAdvance | null;
}

export async function completeMission(input: CompleteMissionInput): Promise<CompleteMissionResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, xp, goal_id, focus_area, mission_type")
    .eq("id", input.missionId)
    .maybeSingle();
  if (!mission) throw new Error("Mission not found");

  // Guard: a mission can only be recorded ONCE. Prevents re-completing on reload
  // from re-awarding XP / attributes / timeline entries.
  const { data: existingResult } = await supabase
    .from("mission_results")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("mission_id", mission.id)
    .maybeSingle();
  if (existingResult) {
    return {
      xpAwarded: 0,
      returnedAfterAbsence: false,
      status: existingResult.status as CompletionStatus,
      chapterAdvance: null,
    };
  }

  // Return-after-absence: was the most recent check-in >= 2 days before today?
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const { data: lastCheckin } = await supabase
    .from("daily_check_ins")
    .select("check_in_date")
    .eq("user_id", user.id)
    .lt("check_in_date", todayKey)
    .order("check_in_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let returnedAfterAbsence = false;
  if (lastCheckin) {
    const gap = daysBetween(lastCheckin.check_in_date as string, todayKey);
    returnedAfterAbsence = gap >= 2;
  }

  // 1) record result
  const { error: resultErr } = await supabase.from("mission_results").insert({
    user_id: user.id,
    mission_id: mission.id,
    status: input.status,
    note: input.note ?? null,
    duration_minutes: input.durationMinutes ?? null,
    quantity: input.quantity ?? null,
  });
  if (resultErr) throw resultErr;

  // 2) mood (user-selected only)
  if (input.mood) {
    await supabase.from("mood_entries").insert({
      user_id: user.id,
      mood: input.mood,
      energy: input.energy ?? null,
    });
  }

  // 3) mark the day active (idempotent) — feeds consistency
  if (input.status === "completed" || input.status === "partial") {
    await supabase.from("daily_check_ins").upsert(
      { user_id: user.id, check_in_date: todayKey },
      { onConflict: "user_id,check_in_date" },
    );
  }

  // 4) deterministic XP — the app owns this, never the AI
  let xpAwarded = 0;
  const awards: { reason: XpReason; amount: number }[] = [];
  if (input.status === "completed") awards.push(xpFor("mission_completed"));
  else if (input.status === "partial") awards.push(xpFor("mission_partial"));
  if (returnedAfterAbsence) awards.push(xpFor("returned_after_absence"));

  for (const a of awards) {
    xpAwarded += a.amount;
    await supabase.from("xp_transactions").insert({ user_id: user.id, amount: a.amount, reason: a.reason });
  }

  // 5) timeline (only meaningful events)
  if (input.status === "completed") {
    await supabase.from("timeline_events").insert({
      user_id: user.id,
      event_type: "mission_completed",
      summary: `Completed: ${mission.title}`,
      goal_id: mission.goal_id,
      tags: ["mission"],
    });
  }
  if (returnedAfterAbsence) {
    await supabase.from("timeline_events").insert({
      user_id: user.id,
      event_type: "comeback",
      summary: "Returned after some time away — momentum protected.",
      tags: ["comeback"],
    });
  }

  // 6) deterministic character attributes (never decrease on a miss)
  const domain = (mission.focus_area as string | null) ?? "other";
  const type = (mission.mission_type as string | null) ?? "primary";
  if (input.status === "completed") {
    await applyAttributeDeltas(user.id, deltasForMissionCompletion(domain, type), `Completed: ${mission.title}`);
  } else if (input.status === "partial") {
    await applyAttributeDeltas(user.id, scaleDeltas(deltasForMissionCompletion(domain, type), 0.5), `Partly done: ${mission.title}`);
  }
  if (returnedAfterAbsence) {
    await applyAttributeDeltas(user.id, deltasForComeback(), "Returned after time away");
  }

  // 7) advance chapters if a threshold was crossed
  const chapterAdvance = input.status === "completed" ? await syncChapterProgress(user.id) : null;

  revalidatePath("/home");
  return { xpAwarded, returnedAfterAbsence, status: input.status, chapterAdvance };
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.UTC(+aIso.slice(0, 4), +aIso.slice(5, 7) - 1, +aIso.slice(8, 10));
  const b = Date.UTC(+bIso.slice(0, 4), +bIso.slice(5, 7) - 1, +bIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
