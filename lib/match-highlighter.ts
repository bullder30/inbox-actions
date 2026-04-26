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

/**
 * Calcule les ranges des occurrences de `keywords` dans `text` (case-insensitive,
 * délimité par word boundaries pour éviter les sub-string matches).
 *
 * Utilisé par `<EmailBodyPreview />` quand un type custom KEYWORDS est sélectionné
 * et qu'on veut surligner les mots-clés sur le corps de l'email.
 *
 * Les caractères regex spéciaux dans les keywords sont échappés (anti-injection).
 */
export function rangesFromKeywords(text: string, keywords: string[]): MatchRange[] {
  if (text.length === 0 || keywords.length === 0) return [];

  const ranges: MatchRange[] = [];
  for (const raw of keywords) {
    const kw = raw.trim();
    if (kw.length === 0) continue;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word boundaries conditionnelles : \b ne fonctionne qu'entre word-char
    // et non-word-char. Si le keyword commence/finit par un caractère non-word
    // (ex. "C++"), on l'omet sur ce côté pour éviter un faux négatif.
    const lhs = /^\w/.test(kw) ? "\\b" : "";
    const rhs = /\w$/.test(kw) ? "\\b" : "";
    const re = new RegExp(`${lhs}${escaped}${rhs}`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ index: m.index, length: m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return ranges;
}
