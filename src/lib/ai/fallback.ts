/**
 * Deterministic, high-quality fallback copy. Used when AI is unavailable, the
 * user hit a usage limit, is offline, or output failed validation. These still
 * reference the user's real stored goal — never generic filler, never invented
 * facts, never guaranteed outcomes.
 */

export function firstFutureYouMessage(params: {
  goalTitle: string | null;
  traits: string[];
}): string {
  const trait = params.traits[0];
  const identity = trait ? ` The kind of ${trait.toLowerCase()} person you said you want to be — that's who we're building toward.` : "";
  const goal = params.goalTitle
    ? ` We're not going to fix everything at once. We start with one honest move toward "${params.goalTitle}".`
    : " We start small, and we start honest.";
  return (
    "Hey. I'm not here because everything became perfect — I'm here because you stopped waiting for the perfect moment and started." +
    goal +
    identity +
    " Do the first small thing today, and let that be enough."
  );
}

/** Grounded evening-reflection reply used when AI is off/over-limit/offline. */
export function eveningReflectionFallback(params: {
  goalTitle: string | null;
  consistencyLine: string | null;
}): { message: string; nextAction: string } {
  const goal = params.goalTitle ? ` toward "${params.goalTitle}"` : "";
  const consistency = params.consistencyLine ? ` ${params.consistencyLine}` : "";
  return {
    message:
      "Thanks for showing up and being honest tonight." +
      consistency +
      " I'm not going to dress this up — some days move the needle a little, some barely at all, and both still count as long as you keep returning. Tomorrow we make one more honest move" +
      goal +
      ".",
    nextAction: "Rest tonight. Tomorrow, do the smallest version of your next step — that's enough.",
  };
}

/** Deterministic weekly-review interpretation used when AI is off/over-limit. */
export function weeklyReviewFallback(params: {
  missionsCompleted: number;
  activeDays: number;
  reflections: number;
  goalTitle: string | null;
}): {
  wins: string[];
  missed: string[];
  pattern: string;
  realityCheck: string;
  adjustment: string;
  suggestedFocus: string;
  message: string;
} {
  const wins: string[] = [];
  if (params.missionsCompleted > 0) wins.push(`${params.missionsCompleted} mission${params.missionsCompleted === 1 ? "" : "s"} completed`);
  if (params.reflections > 0) wins.push(`${params.reflections} honest reflection${params.reflections === 1 ? "" : "s"}`);
  if (params.activeDays > 0) wins.push(`Showed up on ${params.activeDays} day${params.activeDays === 1 ? "" : "s"}`);

  return {
    wins: wins.length ? wins : ["You're still here — that counts"],
    missed: params.activeDays < 3 ? ["A quieter week than planned — that's information, not failure"] : [],
    pattern:
      params.activeDays >= 4 ? "You're building a rhythm of showing up." : "The week was uneven — consistency is the next thing to build.",
    realityCheck: "Progress isn't linear. What matters is returning, not a perfect week.",
    adjustment: "Consider making next week's missions even smaller, so showing up is almost effortless.",
    suggestedFocus: params.goalTitle ? `One repeatable step toward "${params.goalTitle}".` : "One small, repeatable step.",
    message:
      "This is a grounded standby review. You did real things this week, and the point was never a perfect scoreboard — it's that you kept moving toward who you're becoming. Next week, we make it easy to show up again.",
  };
}

/**
 * Concrete fallback missions per domain, used when AI is unavailable/over-limit.
 * Deliberately specific — not "be mindful", but "do this exact small thing".
 */
export function fallbackMissionsFor(domain: string): {
  title: string;
  description: string;
  missionType: "primary" | "maintenance" | "reflection";
  estimatedMinutes: number;
  difficulty: "gentle" | "moderate";
}[] {
  switch (domain) {
    case "health":
    case "fitness":
    case "nutrition":
      return [
        { title: "Walk for 20 minutes", description: "A brisk walk — after a meal is ideal. Movement you can repeat daily.", missionType: "primary", estimatedMinutes: 20, difficulty: "gentle" },
        { title: "Note what you ate today", description: "Add a quick note here with each meal and snack. No judgement — just awareness.", missionType: "maintenance", estimatedMinutes: 5, difficulty: "gentle" },
        { title: "Add a protein source to each meal", description: "Eggs, chicken, fish, beans, or yoghurt — protein keeps you full.", missionType: "maintenance", estimatedMinutes: 2, difficulty: "gentle" },
      ];
    case "running":
      return [
        { title: "20-minute easy walk/run", description: "Alternate 1 min gentle jog, 2 min walk. Keep it comfortable — no pain.", missionType: "primary", estimatedMinutes: 20, difficulty: "gentle" },
        { title: "5 minutes of post-run stretching", description: "Calves, hamstrings, hips. Protect the body that carries you.", missionType: "maintenance", estimatedMinutes: 5, difficulty: "gentle" },
      ];
    case "learning":
      return [
        { title: "15 minutes of focused practice", description: "One concept or exercise, distractions away. Small and consistent wins.", missionType: "primary", estimatedMinutes: 15, difficulty: "gentle" },
        { title: "Note one thing you learned", description: "Add a quick note here — teaching yourself in a line locks it in.", missionType: "reflection", estimatedMinutes: 3, difficulty: "gentle" },
      ];
    case "finance":
    case "business":
    case "career":
      return [
        { title: "Spend 15 minutes on your highest-leverage task", description: "The one thing that actually moves things forward — not busywork.", missionType: "primary", estimatedMinutes: 15, difficulty: "gentle" },
        { title: "Note today's key number", description: "Income, spend, or one key metric — jot it here. What gets tracked gets managed.", missionType: "maintenance", estimatedMinutes: 5, difficulty: "gentle" },
      ];
    default:
      return [
        { title: "Take one concrete step toward your goal", description: "Pick the smallest visible action and do it now.", missionType: "primary", estimatedMinutes: 10, difficulty: "gentle" },
        { title: "Two honest minutes", description: "Write two sentences about where you are today.", missionType: "reflection", estimatedMinutes: 2, difficulty: "gentle" },
      ];
  }
}

export function missionReason(goalTitle: string | null): string {
  return goalTitle
    ? `A small, repeatable step toward "${goalTitle}". Consistency beats intensity.`
    : "A small, repeatable step. Consistency beats intensity.";
}
