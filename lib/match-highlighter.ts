/**
 * Helper pur pour découper un texte en segments alternés text/match
 * selon des plages [index, length] retournées par l'API test-regex
 * et le sandbox vm (cf. `lib/actions/regex-executor.ts`).
 *
 * Utilisé par `<MatchHighlighter />` pour rendre `<mark>` sur les matches.
 *
 * Robustesse :
 *  - tri par index (input arbitraire toléré)
 *  - skip ranges length=0 (ex. assertions zero-width)
 *  - clamp si range dépasse la fin du texte
 *  - drop des ranges qui chevauchent le précédent (premier match gagnant)
 */

export interface MatchRange {
  index: number;
  length: number;
}

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "match"; value: string };

export function splitByRanges(text: string, ranges: MatchRange[]): Segment[] {
  if (text.length === 0) return [];

  const sorted = [...ranges]
    .filter((r) => r.length > 0 && r.index < text.length)
    .sort((a, b) => a.index - b.index);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const range of sorted) {
    if (range.index < cursor) continue; // overlap → drop

    if (range.index > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, range.index) });
    }

    const end = Math.min(range.index + range.length, text.length);
    segments.push({ kind: "match", value: text.slice(range.index, end) });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }

  return segments;
}
