/**
 * Curated, real resources per domain — with approximate page counts so we can
 * compute a concrete pace (e.g. "read 9 pages/day to finish in 4 weeks").
 *
 * These are hand-picked well-known titles (factual references, not content).
 * Page counts are approximate and labelled as such. For sensitive domains
 * (mental wellbeing, relationships) we stay light and defer to professionals.
 */

export interface Resource {
  title: string;
  author: string;
  pages: number;
  kind: "book" | "program";
  why: string;
  free?: boolean;
}

const ATOMIC_HABITS: Resource = {
  title: "Atomic Habits",
  author: "James Clear",
  pages: 320,
  kind: "book",
  why: "The small, daily habits that make lasting change stick — the real engine behind any goal.",
};

const LIBRARY: Record<string, Resource[]> = {
  health: [ATOMIC_HABITS, { title: "Why We Sleep", author: "Matthew Walker", pages: 368, kind: "book", why: "Sleep is the quiet foundation of energy, appetite and recovery." }],
  nutrition: [ATOMIC_HABITS],
  fitness: [ATOMIC_HABITS],
  mental_wellbeing: [{ title: "The Happiness Trap", author: "Russ Harris", pages: 240, kind: "book", why: "A gentle, practical intro to acceptance — not a substitute for professional support." }],
  finance: [
    { title: "The Psychology of Money", author: "Morgan Housel", pages: 256, kind: "book", why: "How behaviour, not maths, drives wealth. The best starting point." },
    { title: "The Richest Man in Babylon", author: "George S. Clason", pages: 144, kind: "book", why: "Timeless saving principles in short, readable parables." },
    { title: "I Will Teach You To Be Rich", author: "Ramit Sethi", pages: 352, kind: "book", why: "A practical, step-by-step system for automating your money." },
  ],
  business: [
    { title: "The $100 Startup", author: "Chris Guillebeau", pages: 304, kind: "book", why: "Launching something small and profitable without big capital." },
    { title: "The Lean Startup", author: "Eric Ries", pages: 336, kind: "book", why: "Test ideas cheaply before betting everything on them." },
  ],
  career: [
    { title: "So Good They Can't Ignore You", author: "Cal Newport", pages: 304, kind: "book", why: "Build rare, valuable skills instead of chasing passion." },
    { title: "Deep Work", author: "Cal Newport", pages: 304, kind: "book", why: "Focus as a career superpower in a distracted world." },
  ],
  learning: [
    { title: "Atomic Habits", author: "James Clear", pages: 320, kind: "book", why: "How tiny, consistent habits compound into big change." },
    { title: "Make It Stick", author: "Brown, Roediger & McDaniel", pages: 336, kind: "book", why: "Evidence-based techniques for learning that lasts." },
  ],
  discipline: [
    { title: "Atomic Habits", author: "James Clear", pages: 320, kind: "book", why: "A practical framework for building discipline in small steps." },
    { title: "Deep Work", author: "Cal Newport", pages: 304, kind: "book", why: "Train sustained focus — the core of self-discipline." },
  ],
  confidence: [
    { title: "The Confidence Gap", author: "Russ Harris", pages: 272, kind: "book", why: "A gentle, practical approach to acting despite fear." },
  ],
  creativity: [
    { title: "The War of Art", author: "Steven Pressfield", pages: 190, kind: "book", why: "Beating resistance and doing the creative work daily." },
  ],
  running: [
    { title: "Couch to 5K", author: "NHS running plan", pages: 0, kind: "program", why: "A gradual 9-week walk/run plan that safely builds you to 5k.", free: true },
  ],
  organisation: [
    { title: "Getting Things Done", author: "David Allen", pages: 352, kind: "book", why: "A trusted system to get organised and clear your head." },
  ],
};

export function resourcesForDomain(domain: string): Resource[] {
  return LIBRARY[domain] ?? LIBRARY["discipline"]!; // habits are a safe universal default
}

export interface ReadingPlan {
  resource: Resource;
  days: number;
  pagesPerDay: number;
}

/**
 * Concrete pace to finish a book in `days`. For programs (pages=0) we return a
 * pagesPerDay of 0 and let the UI show the program cadence instead.
 */
export function readingPlan(resource: Resource, days: number): ReadingPlan {
  const d = Math.max(1, Math.round(days));
  const pagesPerDay = resource.pages > 0 ? Math.max(1, Math.ceil(resource.pages / d)) : 0;
  return { resource, days: d, pagesPerDay };
}

/** Pick a sensible reading horizon from the goal's timeframe (or ~4 weeks). */
export function horizonDays(targetDate: string | null, today: Date): number {
  if (!targetDate) return 28;
  const days = Math.round((Date.parse(targetDate) - today.getTime()) / 86_400_000);
  // Read the first book in the first third of the journey, min 2 weeks, max 8.
  return Math.min(56, Math.max(14, Math.round(days / 3)));
}
