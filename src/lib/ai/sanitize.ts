/**
 * Strips technical identifiers (UUIDs, "Timeline ID: …") and markdown markers
 * from conversational AI output. A safety net so internal ids never reach the
 * user even if the model ignores the prompt.
 */
export function sanitizeConversation(text: string): string {
  return text
    .replace(/\(?\s*(timeline\s*)?id\s*[:=]\s*[0-9a-f-]{6,}\s*\)?/gi, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1") // strip **bold** / *italic* markers
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
