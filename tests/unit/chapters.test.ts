import { describe, it, expect } from "vitest";
import { chapterForProgress, journeyProgress, CHAPTERS } from "@/lib/domain/chapters";

describe("chapters", () => {
  it("starts in The Awakening", () => {
    expect(chapterForProgress(0).current.slug).toBe("awakening");
  });

  it("advances with completed missions and never regresses", () => {
    expect(chapterForProgress(1).current.id).toBe(2);
    expect(chapterForProgress(4).current.id).toBe(3);
    expect(chapterForProgress(10).current.id).toBe(4);
    // beyond the last live chapter, stays there
    expect(chapterForProgress(999).current.id).toBe(CHAPTERS.length);
  });

  it("reports missions remaining to the next chapter", () => {
    const s = chapterForProgress(2); // in chapter 2, next enters at 4
    expect(s.next?.id).toBe(3);
    expect(s.missionsToNext).toBe(2);
  });

  it("journey progress is monotonic and bounded 0..1", () => {
    const a = journeyProgress(0);
    const b = journeyProgress(3);
    const c = journeyProgress(10);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(c).toBeGreaterThanOrEqual(b);
  });
});
