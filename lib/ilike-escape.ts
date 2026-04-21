/** Escape `%`, `_`, and `\` for PostgREST `ilike` patterns (matches athletes search). */
export function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
