"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, MailOpen } from "lucide-react";

import { MatchHighlighter } from "@/components/actions/match-highlighter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  rangesFromKeywords,
  type MatchRange,
} from "@/lib/match-highlighter";
import { isPatternFieldValid } from "@/lib/custom-action-types/dialog-state";
import { cn } from "@/lib/utils";

const TEST_DEBOUNCE_MS = 300;

interface EmailBodyPreviewProps {
  emailId: string;
  /** Pattern regex live (optionnel) — debounce 300ms puis appel API test-regex. */
  pattern?: string | null;
  /** Liste de keywords à highlighter (optionnel) — match local instantané. */
  keywords?: string[] | null;
  className?: string;
}

interface BodyPayload {
  body: string;
  truncated: boolean;
  mimeType: "text/plain" | "text/html";
}

/**
 * Affiche le corps complet d'un email avec match highlighting :
 *  - si `pattern` (mode REGEX) → appel /api/custom-action-types/test-regex (debounce 300ms)
 *  - sinon si `keywords` (mode KEYWORDS) → highlight local
 *  - sinon affichage neutre
 *
 * Body fetch : /api/email/[id]/body (cache server TTL 5min, troncature 50KB,
 * sanitize DOMPurify pour HTML). Cf. ADR-006.
 */
export function EmailBodyPreview({
  emailId,
  pattern,
  keywords,
  className,
}: EmailBodyPreviewProps) {
  const [body, setBody] = useState<BodyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch du corps une fois au mount (per emailId)
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    setBody(null);

    (async () => {
      try {
        const res = await fetch(`/api/email/${emailId}/body`);
        if (aborted) return;
        if (res.status === 503) {
          setError("Token expiré, reconnectez votre boîte mail");
          return;
        }
        if (res.status === 502) {
          setError("Corps de l'email indisponible");
          return;
        }
        if (res.status === 404) {
          setError("Email introuvable");
          return;
        }
        if (!res.ok) {
          setError("Erreur lors du chargement");
          return;
        }
        const data = (await res.json()) as BodyPayload;
        if (!aborted) setBody(data);
      } catch {
        if (!aborted) setError("Erreur réseau");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [emailId]);

  // ─── Calcul des ranges ────────────────────────────────────────────────────
  // Pattern actif valide → appel API debounced. Sinon keywords locaux.
  const trimmedPattern = pattern?.trim() ?? "";
  const patternValid = useMemo(
    () => trimmedPattern.length > 0 && isPatternFieldValid(trimmedPattern),
    [trimmedPattern]
  );

  const [patternRanges, setPatternRanges] = useState<MatchRange[]>([]);
  const [patternError, setPatternError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!body || !patternValid) {
      setPatternRanges([]);
      setPatternError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runRegexTest(trimmedPattern, body.body);
    }, TEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedPattern, patternValid, body]);

  async function runRegexTest(p: string, text: string) {
    try {
      const res = await fetch("/api/custom-action-types/test-regex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: p, testText: [text] }),
      });
      if (res.status === 408) {
        setPatternError("Pattern trop complexe (timeout)");
        setPatternRanges([]);
        return;
      }
      if (!res.ok) {
        setPatternError("Erreur lors du test");
        return;
      }
      const data = await res.json();
      setPatternRanges(data.matches ?? []);
      setPatternError(null);
    } catch {
      setPatternError("Erreur réseau");
    }
  }

  const keywordRanges = useMemo(() => {
    if (patternValid || !body || !keywords || keywords.length === 0) return [];
    return rangesFromKeywords(body.body, keywords);
  }, [body, keywords, patternValid]);

  const displayRanges = patternValid ? patternRanges : keywordRanges;

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive",
          className
        )}
      >
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        {error}
      </div>
    );
  }

  if (!body) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1">
          <MailOpen className="size-3" />
          Corps de l&apos;email
          {body.truncated && (
            <span className="ml-1 normal-case text-amber-600 dark:text-amber-400">
              (tronqué à 50 KB)
            </span>
          )}
        </span>
        {displayRanges.length > 0 && (
          <span className="font-medium text-amber-700 dark:text-amber-300">
            {displayRanges.length} match{displayRanges.length > 1 ? "es" : ""}
          </span>
        )}
      </div>

      {patternError && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {patternError}
        </p>
      )}

      <div className="max-h-72 overflow-y-auto rounded-lg border bg-muted/30 p-3">
        <MatchHighlighter
          text={body.body}
          ranges={displayRanges}
          emptyHint="Email vide."
        />
      </div>
    </div>
  );
}
