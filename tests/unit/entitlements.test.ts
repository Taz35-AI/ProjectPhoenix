import { describe, it, expect } from "vitest";
import { entitlementsFor, canUseAIReflection } from "@/lib/entitlements";

describe("entitlements", () => {
  it("gives higher tiers strictly more daily messages and tokens", () => {
    const free = entitlementsFor("free");
    const phoenix = entitlementsFor("phoenix");
    const plus = entitlementsFor("phoenix_plus");
    expect(phoenix.dailyAIMessages).toBeGreaterThan(free.dailyAIMessages);
    expect(plus.dailyAIMessages).toBeGreaterThan(phoenix.dailyAIMessages);
    expect(plus.monthlyTokenAllowance).toBeGreaterThan(phoenix.monthlyTokenAllowance);
    expect(plus.maxLetterTokens).toBeGreaterThan(phoenix.maxLetterTokens);
  });

  it("defaults unknown tiers to free (never over-grants)", () => {
    // @ts-expect-error testing runtime guard
    expect(entitlementsFor("enterprise").tier).toBe("free");
  });

  it("free tier still gets a real AI reflection experience in the prototype", () => {
    expect(canUseAIReflection(entitlementsFor("free"))).toBe(true);
  });
});
