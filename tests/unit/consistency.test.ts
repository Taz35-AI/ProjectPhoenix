import { describe, it, expect } from "vitest";
import { computeConsistency, consistencyMessage } from "@/lib/domain/consistency";

function key(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(today: Date, n: number): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  return key(d);
}

describe("consistency", () => {
  const today = new Date("2026-07-30T12:00:00.000Z");

  it("reports full consistency when every recent day is active", () => {
    const active = new Set<string>();
    for (let i = 0; i < 30; i++) active.add(daysAgo(today, i));
    const s = computeConsistency(active, today);
    expect(s.sevenDay).toBe(1);
    expect(s.thirtyDay).toBe(1);
    expect(s.momentum).toBeGreaterThan(0.9);
    expect(s.returnedAfterGap).toBe(false);
  });

  it("recognises a return after a gap without shaming", () => {
    const active = new Set<string>([daysAgo(today, 0), daysAgo(today, 5), daysAgo(today, 6)]);
    const s = computeConsistency(active, today);
    expect(s.returnedAfterGap).toBe(true);
    expect(consistencyMessage(s)).toMatch(/returning today protects your momentum/i);
  });

  it("does not call a brand-new user (only today active) a 'comeback'", () => {
    const active = new Set<string>([daysAgo(today, 0)]);
    const s = computeConsistency(active, today);
    expect(s.returnedAfterGap).toBe(false);
    expect(consistencyMessage(s)).not.toMatch(/missed some days/i);
  });

  it("never produces a shaming message for an empty history", () => {
    const s = computeConsistency(new Set(), today);
    expect(s.momentum).toBe(0);
    expect(consistencyMessage(s)).not.toMatch(/lost|fail|behind/i);
  });
});
