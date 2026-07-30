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

export function missionReason(goalTitle: string | null): string {
  return goalTitle
    ? `A small, repeatable step toward "${goalTitle}". Consistency beats intensity.`
    : "A small, repeatable step. Consistency beats intensity.";
}
