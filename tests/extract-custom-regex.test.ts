/**
 * Tests pour l'extension de `extractCustomActionsFromEmail` en mode REGEX
 * — Phase 4 RED (regex-power)
 *
 * Couvre :
 *   - US-5.1 (détection nominale)
 *   - US-5.2 (validated:false ignoré)
 *   - US-5.3 (isActive:false ignoré)
 *   - US-5.4 (timeout runtime → skip + scan continue)
 *   - US-5.5 (gating anti-ambiguïté partagé)
 *   - US-5.6 (backward compat KEYWORDS)
 *   - AC-5, AC-6 (extracteur filter validated, sandbox runtime)
 *   - AC-11 (dedup natif vs custom — continuité custom-actions)
 *
 * NB : L'extension de la signature `CustomActionTypeData` (mode + regexPattern + validated)
 *      n'existe pas encore — RED phase.
 *
 *      Pour le timeout runtime : on mocke `safelyExecuteRegex` pour retourner
 *      `{ matches: [], timedOut: true }` directement, ce qui simule un faux
 *      négatif safe-regex sans avoir à crafter un pattern réellement explosif.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Mocks au niveau module — placés AVANT l'import de l'extracteur
// ──────────────────────────────────────────────────────────────────────────────

// Comportement par défaut : exécution réelle simplifiée (RegExp.exec).
// Les tests qui ont besoin du timeout overrideront via vi.mocked(...).mockImplementationOnce.
vi.mock("@/lib/actions/regex-executor", () => ({
  isPatternSafe: vi.fn(() => true),
  safelyExecuteRegex: vi.fn(
    (pattern: string, text: string, _timeoutMs?: number) => {
      try {
        const re = new RegExp(pattern, "gi");
        const matches: Array<{ index: number; length: number }> = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          matches.push({ index: m.index, length: m[0].length });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
        return { matches, timedOut: false };
      } catch {
        return { matches: [], timedOut: false };
      }
    }
  ),
}));

import {
  extractActionsFromEmail,
  extractCustomActionsFromEmail,
  type CustomActionTypeData,
  type EmailContext,
} from "@/lib/actions/extract-actions-regex";
import { safelyExecuteRegex } from "@/lib/actions/regex-executor";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function ctx(body: string, opts: Partial<EmailContext> = {}): EmailContext {
  return {
    from: opts.from ?? "collegue@entreprise.com",
    subject: opts.subject ?? "Demande",
    body,
    receivedAt: opts.receivedAt ?? new Date("2026-04-25T10:00:00Z"),
  };
}

// Type custom étendu (mode + regexPattern + validated). On caste car la
// définition TS n'a pas encore les champs ; ce sera ajouté en Phase 5.
type CustomTypeRegex = CustomActionTypeData & {
  mode: "KEYWORDS" | "REGEX";
  regexPattern: string | null;
  validated: boolean;
};

const factureType = {
  id: "ctype-fac",
  name: "Facture client",
  keywords: [],
  color: "amber",
  isActive: true,
  mode: "REGEX" as const,
  regexPattern: "FAC-\\d{4}-\\d+",
  validated: true,
} satisfies CustomTypeRegex as unknown as CustomActionTypeData;

const reviewKeywordsType = {
  id: "ctype-rev",
  name: "Review code",
  keywords: ["review", "PR"],
  color: "violet",
  isActive: true,
  mode: "KEYWORDS" as const,
  regexPattern: null,
  validated: true,
} satisfies CustomTypeRegex as unknown as CustomActionTypeData;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// Détection regex
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — mode REGEX detection", () => {
  it("should_extract_action_when_regex_pattern_matches_and_concrete", () => {
    // Arrange (US-5.1)
    const context = ctx(
      "Bonjour, voir FAC-2024-0042 jointe avant vendredi. Merci."
    );

    // Act
    const actions = extractCustomActionsFromEmail(context, [factureType]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].type).toBe("CUSTOM");
  });

  it("should_snapshot_label_and_color_on_extracted_action", () => {
    // Arrange
    const context = ctx(
      "Voir FAC-2024-0042 avant vendredi pour validation."
    );

    // Act
    const actions = extractCustomActionsFromEmail(context, [factureType]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const a = actions[0] as any;
    expect(a.customTypeId).toBe("ctype-fac");
    expect(a.customTypeLabel).toBe("Facture client");
    expect(a.customTypeColor).toBe("amber");
  });

  it("should_apply_anti_ambiguity_gating_to_regex_matches", () => {
    // Arrange (US-5.5) — phrase conditionnelle "si tu as le temps" → no action
    const context = ctx(
      "Si tu as le temps, jette un œil à FAC-2024-0042."
    );

    // Act
    const actions = extractCustomActionsFromEmail(context, [factureType]);

    // Assert
    expect(actions).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Filtres validated / isActive
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — filters", () => {
  it("should_skip_type_when_validated_false", () => {
    // Arrange (US-5.2, AC-5) — type avec validated=false ne doit pas matcher.
    // Garde-fou supplémentaire : même si la query DB filtre, l'extracteur ne
    // doit pas exécuter un pattern non validé (défense en profondeur).
    const unvalidated = {
      ...factureType,
      validated: false,
    } as unknown as CustomActionTypeData;
    const context = ctx("Voir FAC-2024-0042 avant vendredi.");

    // Act
    const actions = extractCustomActionsFromEmail(context, [unvalidated]);

    // Assert
    expect(actions).toHaveLength(0);
  });

  it("should_skip_type_when_isActive_false", () => {
    // Arrange (US-5.3)
    const inactive = {
      ...factureType,
      isActive: false,
    } as unknown as CustomActionTypeData;
    const context = ctx("Voir FAC-2024-0042 avant vendredi.");

    // Act
    const actions = extractCustomActionsFromEmail(context, [inactive]);

    // Assert
    expect(actions).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Timeout runtime (sandbox vm)
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — runtime timeout", () => {
  it("should_skip_email_when_runtime_timeout_occurs", () => {
    // Arrange (US-5.4, AC-6) — on simule un timeout vm sur le 1er appel,
    // puis comportement normal sur les suivants. Avec UN seul type passé,
    // on s'attend à : aucune action créée pour cet email + pas de crash.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(safelyExecuteRegex).mockReturnValueOnce({
      matches: [],
      timedOut: true,
    });
    const context = ctx("Voir FAC-2024-0042 avant vendredi.");

    // Act — ne doit pas throw
    const actions = extractCustomActionsFromEmail(context, [factureType]);

    // Assert
    expect(actions).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("should_continue_scanning_other_types_when_one_times_out", () => {
    // Arrange — premier type timeout, second type matche normalement.
    // Le scan global ne doit PAS être arrêté par le timeout du premier.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(safelyExecuteRegex).mockReturnValueOnce({
      matches: [],
      timedOut: true,
    });
    // Le 2e type est en KEYWORDS donc n'utilise pas safelyExecuteRegex
    // (utilise compileKeywordsRegex existant).
    const context = ctx(
      "Peux-tu faire la review de la PR #42 avant vendredi ?"
    );

    // Act
    const actions = extractCustomActionsFromEmail(context, [
      factureType,
      reviewKeywordsType,
    ]);

    // Assert : malgré le timeout sur le type REGEX, le type KEYWORDS produit son action
    const customActions = actions.filter((a) => a.type === "CUSTOM");
    expect(customActions.length).toBeGreaterThanOrEqual(1);
    expect(customActions.some((a: any) => a.customTypeId === "ctype-rev")).toBe(
      true
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Backward compat KEYWORDS
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — backward compat", () => {
  it("should_keep_keywords_mode_backward_compatible", () => {
    // Arrange (US-5.6, AC-13) — un type en mode KEYWORDS doit continuer à
    // produire les mêmes actions qu'avant regex-power. On ne doit PAS appeler
    // safelyExecuteRegex pour ce type.
    const context = ctx(
      "Peux-tu faire la review de la PR #42 avant vendredi ?"
    );

    // Act
    const actions = extractCustomActionsFromEmail(context, [
      reviewKeywordsType,
    ]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].type).toBe("CUSTOM");
    expect(safelyExecuteRegex).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Dédup natif vs custom-regex (continuité AC-11)
// ──────────────────────────────────────────────────────────────────────────────

describe("extractActionsFromEmail — dedup native vs custom REGEX", () => {
  it("should_dedup_native_vs_regex_match_on_same_sentence", () => {
    // Arrange (continuité AC-11 custom-actions) — un type REGEX qui matche
    // sur la même phrase qu'une action native ne crée pas une seconde action.
    const sendCollidingType = {
      id: "ctype-coll",
      name: "Envoi facture",
      keywords: [],
      color: "orange",
      isActive: true,
      mode: "REGEX" as const,
      regexPattern: "facture",
      validated: true,
    } as unknown as CustomActionTypeData;

    const context = ctx("Merci d'envoyer la facture demain.");

    // Act
    const actions = extractActionsFromEmail(context, [], [sendCollidingType]);

    // Assert : on garde l'action native SEND, on n'ajoute pas de doublon CUSTOM
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
  });
});
