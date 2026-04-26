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
/**
 * Parse la réponse de POST /api/custom-action-types/test-regex et convertit
 * les tuples `[start, end]` en `MatchRange { index, length }` consommables
 * par `splitByRanges` / `<MatchHighlighter />`.
 *
 * Format API (cf. AC-7) :
 *   { matches: [{ textIndex: 0, ranges: [[start, end], ...] }] }
 *
 * Le client envoie toujours un seul `testText`, on extrait donc `matches[0]`.
 * Robust aux réponses mal formées (retourne `[]` plutôt que de throw).
 */
export function parseTestRegexResponse(response: unknown): MatchRange[] {
  if (!response || typeof response !== "object") return [];
  const { matches } = response as { matches?: unknown };
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const first = matches[0] as { ranges?: unknown };
  if (!first || !Array.isArray(first.ranges)) return [];

  const out: MatchRange[] = [];
  for (const entry of first.ranges) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [start, end] = entry;
    if (typeof start !== "number" || typeof end !== "number") continue;
    if (end <= start) continue;
    out.push({ index: start, length: end - start });
  }
  return out;
}

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
