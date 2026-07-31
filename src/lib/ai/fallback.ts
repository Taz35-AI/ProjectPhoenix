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

export function missionReason(goalTitle: string | null): string {
  return goalTitle
    ? `A small, repeatable step toward "${goalTitle}". Consistency beats intensity.`
    : "A small, repeatable step. Consistency beats intensity.";
}
