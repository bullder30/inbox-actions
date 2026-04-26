"use client";

import { splitByRanges, type MatchRange } from "@/lib/match-highlighter";
import { cn } from "@/lib/utils";

interface MatchHighlighterProps {
  text: string;
  ranges: MatchRange[];
  className?: string;
  emptyHint?: string;
}

/**
 * Rend un texte avec les plages `ranges` surlignées via `<mark>`.
 *
 * Utilisé par :
 *  - la zone de test inline du dialog Settings (UI Step 1/3 regex-power)
 *  - la preview live missing-action (UI Step 3/3)
 */
export function MatchHighlighter({
  text,
  ranges,
  className,
  emptyHint,
}: MatchHighlighterProps) {
  if (text.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {emptyHint ?? "Aucun texte à afficher."}
      </p>
    );
  }

  const segments = splitByRanges(text, ranges);

  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words font-mono text-xs leading-relaxed",
        className
      )}
    >
      {segments.map((seg, i) =>
        seg.kind === "match" ? (
          <mark
            key={i}
            className="rounded bg-amber-200/80 px-0.5 text-amber-950 dark:bg-amber-400/30 dark:text-amber-100"
          >
            {seg.value}
          </mark>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </div>
  );
}
