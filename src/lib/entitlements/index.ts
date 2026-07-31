/**
 * Central entitlement service. Subscription conditions live HERE, not scattered
 * through components. A tier maps to concrete limits; feature checks read from
 * this one table so pricing changes are a single edit.
 */

export type Tier = "free" | "phoenix" | "phoenix_plus";

export interface Entitlements {
  tier: Tier;
  /** Max AI-backed messages (Future You replies, reflections) per UTC day. */
  dailyAIMessages: number;
  /** Soft monthly token allowance for cost control. */
  monthlyTokenAllowance: number;
  /** Whether AI evening reflections are enabled (vs template-only). */
  aiReflections: boolean;
  /** Whether the free-form Future You conversation is available. */
  futureYouChat: boolean;
  /** Max output tokens for a Future You letter (longer on higher tiers). */
  maxLetterTokens: number;
}

const TABLE: Record<Tier, Entitlements> = {
  free: {
    tier: "free",
    // Generous for a prototype so the experience feels unrestricted while
    // still keeping a real cap in place. Tighten before public launch.
    dailyAIMessages: 25,
    monthlyTokenAllowance: 500_000,
    aiReflections: true,
    futureYouChat: true,
    maxLetterTokens: 900,
  },
  phoenix: {
    tier: "phoenix",
    dailyAIMessages: 200,
    monthlyTokenAllowance: 8_000_000,
    aiReflections: true,
    futureYouChat: true,
    maxLetterTokens: 1200,
  },
  phoenix_plus: {
    tier: "phoenix_plus",
    dailyAIMessages: 1000,
    monthlyTokenAllowance: 30_000_000,
    aiReflections: true,
    futureYouChat: true,
    maxLetterTokens: 1600,
  },
};

export function entitlementsFor(tier: Tier): Entitlements {
  return TABLE[tier] ?? TABLE.free;
}

/**
 * NOTE: for a smooth prototype we let FREE users get AI reflections within their
 * small daily cap (so the core experience is real without paying). Flip
 * `aiReflections` above to gate it strictly behind Phoenix later.
 */
export function canUseAIReflection(e: Entitlements): boolean {
  return e.aiReflections || e.tier === "free";
}
