import { describe, it, expect } from "vitest";
import { sanitizeConversation } from "@/lib/ai/sanitize";

describe("sanitizeConversation", () => {
  it("removes 'Timeline ID: …' leaks", () => {
    const out = sanitizeConversation("You started your journey (Timeline ID: 3e27627c) and kept going.");
    expect(out).not.toMatch(/timeline id/i);
    expect(out).not.toMatch(/3e27627c/);
    expect(out).toMatch(/You started your journey/);
  });

  it("removes bare UUIDs", () => {
    const out = sanitizeConversation("Ref 3e27627c-f8e4-4ce8-93a9-0517a051f515 here");
    expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it("strips markdown emphasis markers", () => {
    expect(sanitizeConversation("this is *your* life, not **numbers**")).toBe("this is your life, not numbers");
  });

  it("leaves clean prose untouched", () => {
    const s = "Back when you started, you doubted this. Look how far you've come.";
    expect(sanitizeConversation(s)).toBe(s);
  });
});
