import { describe, it, expect } from "vitest";
import { stripThink } from "@/lib/ai/providers/openai-compatible";

describe("stripThink (reasoning-model hardening)", () => {
  it("removes a paired <think> block", () => {
    expect(stripThink("<think>plan the reply</think>Hello there.")).toBe("Hello there.");
  });

  it("removes a leading trace ending in </think> with no opening tag", () => {
    expect(stripThink("reasoning... </think>Take one small step.")).toBe("Take one small step.");
  });

  it("leaves ordinary text untouched", () => {
    expect(stripThink("Just a normal grounded message.")).toBe("Just a normal grounded message.");
  });
});
