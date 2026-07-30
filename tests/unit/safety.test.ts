import { describe, it, expect } from "vitest";
import { screenUserInput, screenAIOutput } from "@/lib/safety";

describe("safety pre-filter", () => {
  it("flags crisis input and blocks the AI", () => {
    const r = screenUserInput("honestly I want to kill myself");
    expect(r.severity).toBe("crisis");
    expect(r.blockAI).toBe(true);
    expect(r.categories).toContain("suicide");
  });

  it("flags elevated risk (extreme diet) without blocking the whole app", () => {
    const r = screenUserInput("I'm going to eat 400 calories a day until I lose it");
    expect(r.severity).toBe("elevated");
    expect(r.blockAI).toBe(false);
    expect(r.categories).toContain("extreme_diet");
  });

  it("passes ordinary goal text as safe", () => {
    const r = screenUserInput("I want to run a 5k and read more books");
    expect(r.severity).toBe("none");
    expect(r.blockAI).toBe(false);
  });
});

describe("safety post-filter", () => {
  it("catches guaranteed-outcome language in AI output", () => {
    const { flags } = screenAIOutput("You will definitely become a millionaire, guaranteed.");
    expect(flags).toContain("guaranteed_outcome");
  });

  it("catches unsafe advice and diagnosis", () => {
    expect(screenAIOutput("just skip meals and starve").flags).toContain("unsafe_advice");
    expect(screenAIOutput("you have depression").flags).toContain("diagnosis");
  });

  it("passes grounded output", () => {
    const { flags } = screenAIOutput("This is the direction we're building toward. One honest move today.");
    expect(flags).toHaveLength(0);
  });
});
