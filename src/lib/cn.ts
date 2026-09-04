/**
 * Minimal class joiner. Deliberately not clsx + tailwind-merge: nothing here
 * needs conflict resolution, and CLAUDE.md asks that every dependency earn its
 * place on a small VPS.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
