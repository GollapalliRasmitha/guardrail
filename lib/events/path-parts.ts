// Paths in the events table: they may only wrap right after a "/" (never in the middle of a word), and a single
// very long segment is shortened in the middle ("eval-sti…name.php"). The full path is one tap away.

export const MAX_SEGMENT = 28;

export function pathParts(path: string, maxSegment = MAX_SEGMENT): { parts: string[]; shortened: boolean } {
  // "/api/auth/signin/" -> ["/", "api/", "auth/", "signin/"]: each piece ends with its slash.
  const parts = path.match(/[^/]*\/|[^/]+$/g) ?? [path];
  let shortened = false;
  const short = parts.map((part) => {
    if (part.length <= maxSegment) return part;
    shortened = true;
    const keep = maxSegment - 1; // room for the "…"
    const head = Math.ceil(keep / 2);
    return `${part.slice(0, head)}…${part.slice(part.length - (keep - head))}`;
  });
  return { parts: short, shortened };
}
