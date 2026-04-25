/**
 * Tests pour `lib/actions/regex-executor.ts` — Phase 4 RED (regex-power)
 *
 * Couvre :
 *   - ADR-005 (anti-ReDoS 2 couches : safe-regex gate + vm timeout 200ms)
 *   - AC-1 (pattern dangereux ReDoS rejeté à la création)
 *   - AC-6 (timeout runtime 200ms → skip + scan continue)
 *
 * NB : Le fichier `lib/actions/regex-executor.ts` n'existe pas encore — RED phase.
 *      L'import échoue à la résolution → tous les tests de ce fichier sont RED.
 */

import { describe, expect, it } from "vitest";

import {
  isPatternSafe,
  safelyExecuteRegex,
} from "@/lib/actions/regex-executor";

// ──────────────────────────────────────────────────────────────────────────────
// isPatternSafe (wrapper safe-regex)
// ──────────────────────────────────────────────────────────────────────────────

describe("isPatternSafe", () => {
  it("should_return_true_when_pattern_is_simple", () => {
    // Arrange
    const pattern = "FAC-\\d{4}-\\d+";

    // Act
    const result = isPatternSafe(pattern);

    // Assert
    expect(result).toBe(true);
  });

  it("should_return_false_when_pattern_has_polynomial_backtracking_starstar", () => {
    // Arrange — `(.*)*` est l'archétype du pattern à risque polynomial
    const pattern = "(.*)*";

    // Act
    const result = isPatternSafe(pattern);

    // Assert
    expect(result).toBe(false);
  });

  it("should_return_false_when_pattern_has_polynomial_backtracking_plusplus", () => {
    // Arrange — `(a+)+` est le second archétype reconnu par safe-regex
    const pattern = "(a+)+";

    // Act
    const result = isPatternSafe(pattern);

    // Assert
    expect(result).toBe(false);
  });

  it("should_return_true_when_pattern_uses_lookbehind", () => {
    // Arrange — V8 Node 18+ supporte les lookbehind, safe-regex doit les accepter
    const pattern = "(?<=foo)bar";

    // Act
    const result = isPatternSafe(pattern);

    // Assert
    expect(result).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// safelyExecuteRegex (wrapper vm + timeout)
// ──────────────────────────────────────────────────────────────────────────────

describe("safelyExecuteRegex", () => {
  it("should_return_matches_with_index_and_length_when_pattern_matches", () => {
    // Arrange
    const pattern = "FAC-\\d{4}-\\d+";
    const text = "Voir FAC-2024-0042 jointe";

    // Act
    const result = safelyExecuteRegex(pattern, text, 200);

    // Assert
    expect(result.timedOut).toBe(false);
    expect(result.matches).toEqual([
      expect.objectContaining({ index: 5, length: 13 }),
    ]);
  });

  it("should_return_empty_matches_when_no_match", () => {
    // Arrange
    const pattern = "FAC-\\d{4}-\\d+";
    const text = "rien à voir ici";

    // Act
    const result = safelyExecuteRegex(pattern, text, 200);

    // Assert
    expect(result.timedOut).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("should_return_timedOut_true_when_pattern_exceeds_timeout", () => {
    // Arrange — pattern catastrophique (ReDoS) + texte conçu pour l'exploser
    // safe-regex peut faux-négativer ce pattern, mais le timeout vm doit kicker.
    const pattern = "(a+)+b";
    const text = "a".repeat(35) + "c";

    // Act
    const result = safelyExecuteRegex(pattern, text, 50);

    // Assert
    expect(result.timedOut).toBe(true);
    expect(result.matches).toEqual([]);
  });

  it("should_handle_global_flag_iteratively_with_multiple_matches", () => {
    // Arrange
    const pattern = "FAC-\\d{4}-\\d+";
    const text = "FAC-2025-1 et FAC-2025-2 sont en attente";

    // Act
    const result = safelyExecuteRegex(pattern, text, 200);

    // Assert
    expect(result.timedOut).toBe(false);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({ index: 0, length: 10 })
    );
    expect(result.matches[1]).toEqual(
      expect.objectContaining({ index: 14, length: 10 })
    );
  });
});
