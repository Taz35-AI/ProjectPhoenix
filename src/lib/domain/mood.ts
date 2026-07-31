/**
 * The fixed set of moods a user may select. Mood is ALWAYS chosen by the user —
 * the AI never infers or writes it. Kept small and non-clinical.
 */
export const MOODS = [
  { value: "steady", label: "Steady", emoji: "🌤️" },
  { value: "hopeful", label: "Hopeful", emoji: "🌅" },
  { value: "tired", label: "Tired", emoji: "🌙" },
  { value: "low", label: "Low", emoji: "🌫️" },
  { value: "frustrated", label: "Frustrated", emoji: "⛈️" },
  { value: "proud", label: "Proud", emoji: "✨" },
] as const;

export type MoodValue = (typeof MOODS)[number]["value"];
