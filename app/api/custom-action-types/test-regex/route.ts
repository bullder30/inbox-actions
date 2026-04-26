/**
 * POST /api/custom-action-types/test-regex
 *
 * Endpoint de la zone de test pour validation visuelle (Settings + missing-action).
 * Cf. ADR-007 (server-side execution) + AC-7 (ranges [start, end]) + AC-8 (408 timeout).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  isPatternSafe,
  safelyExecuteRegex,
} from "@/lib/actions/regex-executor";
import { MAX_REGEX_PATTERN_LENGTH } from "@/lib/custom-action-types/validation";

export const dynamic = "force-dynamic";

const MAX_TEST_TEXT_ENTRIES = 10;
const MAX_TEST_TEXT_BYTES = 5000;
const TEST_TIMEOUT_MS = 100; // plus court qu'extracteur car interactif

const bodySchema = z
  .object({
    pattern: z.string().min(1).max(MAX_REGEX_PATTERN_LENGTH),
    testText: z
      .array(z.string().max(MAX_TEST_TEXT_BYTES))
      .min(1)
      .max(MAX_TEST_TEXT_ENTRIES),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { pattern, testText } = parsed.data;

    // Validation syntaxe + safe-regex (couche 1)
    try {
      new RegExp(pattern, "gi");
    } catch (err) {
      return NextResponse.json(
        {
          error: "Pattern syntax invalide",
          reason: "syntax_invalid",
          details: err instanceof Error ? err.message : "Invalid regex syntax",
        },
        { status: 422 }
      );
    }

    if (!isPatternSafe(pattern)) {
      return NextResponse.json(
        { error: "Pattern dangereux", reason: "polynomial_backtracking" },
        { status: 422 }
      );
    }

    // Exécution sandbox (couche 2)
    const matches: Array<{ textIndex: number; ranges: Array<[number, number]> }> = [];

    for (let i = 0; i < testText.length; i++) {
      const text = testText[i];
      const result = safelyExecuteRegex(pattern, text, TEST_TIMEOUT_MS);

      if (result.timedOut) {
        return NextResponse.json(
          {
            error: `Pattern trop complexe (timeout ${TEST_TIMEOUT_MS}ms)`,
            textIndex: i,
          },
          { status: 408 }
        );
      }

      const ranges = result.matches.map(
        (m): [number, number] => [m.index, m.index + m.length]
      );
      matches.push({ textIndex: i, ranges });
    }

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("[TestRegex] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
