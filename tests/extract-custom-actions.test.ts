/**
 * Tests pour `extractCustomActionsFromEmail` et l'extension de `extractActionsFromEmail`
 * — Phase 4 RED
 *
 * Couvre :
 *   - US-5 (détection auto, gating, dedup, snapshot)
 *   - AC-7 (snapshot label/color sur Action)
 *   - AC-8 (cron daily-sync charge customTypes per user — testé indirectement via signature)
 *   - AC-11 (dedup natif > custom)
 *
 * NB : la nouvelle fonction `extractCustomActionsFromEmail` n'existe pas encore,
 *      ni la signature étendue à 3 args de `extractActionsFromEmail`. RED phase.
 */

import { describe, expect, it } from "vitest";

import {
  extractActionsFromEmail,
  extractCustomActionsFromEmail,
  type EmailContext,
} from "@/lib/actions/extract-actions-regex";

// Type pour un type custom (forme attendue côté extracteur)
type CustomActionTypeData = {
  id: string;
  name: string;
  keywords: string[];
  color: string;
  isActive: boolean;
};

function ctx(body: string, opts: Partial<EmailContext> = {}): EmailContext {
  return {
    from: opts.from ?? "collegue@entreprise.com",
    subject: opts.subject ?? "Demande",
    body,
    receivedAt: opts.receivedAt ?? new Date("2026-04-25T10:00:00Z"),
  };
}

const reviewCodeType: CustomActionTypeData = {
  id: "ctype-review",
  name: "Review code",
  keywords: ["review", "PR"],
  color: "violet",
  isActive: true,
};

// ──────────────────────────────────────────────────────────────────────────────
// Détection auto
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — detection auto", () => {
  it("should_create_custom_action_when_keyword_matches_with_concrete_object", () => {
    // Arrange (US-5.1)
    const context = ctx("Bonjour, peux-tu faire la review de la PR #42 avant vendredi ? Merci.");

    // Act
    const actions = extractCustomActionsFromEmail(context, [reviewCodeType]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].type).toBe("CUSTOM");
  });

  it("should_snapshot_customTypeLabel_and_customTypeColor_on_extracted_action", () => {
    // Arrange (AC-7)
    const context = ctx("Peux-tu faire la review de la PR #42 avant vendredi ?");

    // Act
    const actions = extractCustomActionsFromEmail(context, [reviewCodeType]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const a = actions[0] as any;
    expect(a.customTypeId).toBe("ctype-review");
    expect(a.customTypeLabel).toBe("Review code");
    expect(a.customTypeColor).toBe("violet");
  });

  it("should_extract_dueDate_when_temporal_marker_present", () => {
    // Arrange
    const context = ctx("Peux-tu faire la review de la PR #42 avant vendredi ?");

    // Act
    const actions = extractCustomActionsFromEmail(context, [reviewCodeType]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0].dueDate).toBeInstanceOf(Date);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Anti-ambiguity gating
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — anti-ambiguity gating", () => {
  it("should_not_create_action_when_phrase_is_conditional", () => {
    // Arrange (US-5.2) — gating identique aux natifs : "si tu as le temps"
    const context = ctx("Si tu as le temps, tu pourrais review la PR ?");

    // Act
    const actions = extractCustomActionsFromEmail(context, [reviewCodeType]);

    // Assert
    expect(actions).toHaveLength(0);
  });

  it("should_not_create_action_when_no_keyword_matches", () => {
    // Arrange (US-5.3)
    const context = ctx("Bonjour, peux-tu valider le contrat ?");

    // Act
    const actions = extractCustomActionsFromEmail(context, [reviewCodeType]);

    // Assert
    expect(actions).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Performance & isActive
// ──────────────────────────────────────────────────────────────────────────────

describe("extractCustomActionsFromEmail — performance & isActive", () => {
  it("should_skip_extractor_when_customTypes_array_is_empty", () => {
    // Arrange (US-5.4) — early return prévu : pas de regex à compiler
    const context = ctx("Peux-tu faire la review de la PR #42 ?");

    // Act
    const actions = extractCustomActionsFromEmail(context, []);

    // Assert
    expect(actions).toEqual([]);
  });

  it("should_ignore_inactive_custom_types_when_filter_applied", () => {
    // Arrange (US-5.5)
    const inactive: CustomActionTypeData = { ...reviewCodeType, isActive: false };
    const context = ctx("Peux-tu faire la review de la PR #42 ?");

    // Act
    const actions = extractCustomActionsFromEmail(context, [inactive]);

    // Assert
    expect(actions).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Intégration avec extractActionsFromEmail (signature étendue)
// ──────────────────────────────────────────────────────────────────────────────

describe("extractActionsFromEmail — signature étendue", () => {
  it("should_keep_native_action_when_custom_keyword_collides_with_native_pattern", () => {
    // Arrange (AC-11 + US-5.6) — keyword "envoyer" custom collide avec pattern SEND natif
    const collidingType: CustomActionTypeData = {
      id: "ctype-envoi",
      name: "Envoi facture",
      keywords: ["envoyer", "facture"],
      color: "orange",
      isActive: true,
    };
    const context = ctx("Merci d'envoyer la facture demain.");

    // Act
    const actions = extractActionsFromEmail(context, [], [collidingType]);

    // Assert : on doit avoir UNE seule action, et c'est la native SEND qui prime
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("SEND");
  });

  it("should_extract_custom_action_when_passed_via_third_arg", () => {
    // Arrange — vérifie que la signature étendue route bien vers l'extracteur custom
    const context = ctx("Peux-tu faire la review de la PR #42 avant vendredi ?");

    // Act
    const actions = extractActionsFromEmail(context, [], [reviewCodeType]);

    // Assert
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const customActions = actions.filter((a) => a.type === "CUSTOM");
    expect(customActions.length).toBeGreaterThanOrEqual(1);
    const a = customActions[0] as any;
    expect(a.customTypeLabel).toBe("Review code");
    expect(a.customTypeColor).toBe("violet");
  });
});
