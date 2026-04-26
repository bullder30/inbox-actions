/**
 * Tests RED — UI Step 1/3 : helper d'état pour le dialog
 * `components/settings/custom-action-types-section.tsx`.
 *
 * Couvre :
 *  - US-1 (toggle KEYWORDS / REGEX)
 *  - US-2 (création regex)
 *  - US-7 (édition + change mode)
 *  - construction du payload POST/PATCH selon le mode
 *  - validation côté client (évite round-trip API pour erreurs locales)
 */

import { describe, expect, it } from "vitest";

import {
  buildCreatePayload,
  buildPatchPayload,
  initialDialogState,
  isPatternFieldValid,
  resetForMode,
  type DialogState,
  type EditingType,
} from "@/lib/custom-action-types/dialog-state";

describe("initialDialogState", () => {
  it("should_start_in_KEYWORDS_mode_with_default_color_for_creation", () => {
    const state = initialDialogState({ existingCount: 0, editingType: null });
    expect(state.mode).toBe("KEYWORDS");
    expect(state.name).toBe("");
    expect(state.keywords).toEqual([]);
    expect(state.regexPattern).toBe("");
    expect(state.isActive).toBe(true);
  });

  it("should_preselect_color_via_rotation_for_n_th_creation", () => {
    const a = initialDialogState({ existingCount: 0, editingType: null });
    const b = initialDialogState({ existingCount: 1, editingType: null });
    expect(a.color).not.toBe(b.color);
  });

  it("should_prefill_KEYWORDS_type_from_editingType", () => {
    const editing: EditingType = {
      id: "t1",
      name: "Devis",
      slug: "devis",
      keywords: ["devis", "proposition"],
      color: "amber",
      isActive: true,
      mode: "KEYWORDS",
      regexPattern: null,
      validated: true,
    };
    const state = initialDialogState({ existingCount: 5, editingType: editing });
    expect(state.mode).toBe("KEYWORDS");
    expect(state.name).toBe("Devis");
    expect(state.keywords).toEqual(["devis", "proposition"]);
    expect(state.regexPattern).toBe("");
    expect(state.color).toBe("amber");
  });

  it("should_prefill_REGEX_type_from_editingType", () => {
    const editing: EditingType = {
      id: "t2",
      name: "Facture",
      slug: "facture",
      keywords: [],
      color: "violet",
      isActive: true,
      mode: "REGEX",
      regexPattern: "FAC-\\d{4}-\\d+",
      validated: true,
    };
    const state = initialDialogState({ existingCount: 5, editingType: editing });
    expect(state.mode).toBe("REGEX");
    expect(state.regexPattern).toBe("FAC-\\d{4}-\\d+");
    expect(state.keywords).toEqual([]);
  });
});

describe("resetForMode", () => {
  it("should_clear_keywords_when_switching_KEYWORDS_to_REGEX", () => {
    const before: DialogState = {
      mode: "KEYWORDS",
      name: "Test",
      keywords: ["foo", "bar"],
      regexPattern: "",
      color: "blue",
      isActive: true,
    };
    const after = resetForMode(before, "REGEX");
    expect(after.mode).toBe("REGEX");
    expect(after.keywords).toEqual([]);
    expect(after.regexPattern).toBe("");
    // Champs neutres conservés
    expect(after.name).toBe("Test");
    expect(after.color).toBe("blue");
  });

  it("should_clear_regexPattern_when_switching_REGEX_to_KEYWORDS", () => {
    const before: DialogState = {
      mode: "REGEX",
      name: "Test",
      keywords: [],
      regexPattern: "FAC-\\d+",
      color: "blue",
      isActive: true,
    };
    const after = resetForMode(before, "KEYWORDS");
    expect(after.mode).toBe("KEYWORDS");
    expect(after.regexPattern).toBe("");
    expect(after.keywords).toEqual([]);
  });

  it("should_be_noop_when_mode_unchanged", () => {
    const before: DialogState = {
      mode: "KEYWORDS",
      name: "Test",
      keywords: ["foo", "barr"],
      regexPattern: "",
      color: "blue",
      isActive: true,
    };
    const after = resetForMode(before, "KEYWORDS");
    expect(after).toEqual(before);
  });
});

describe("isPatternFieldValid", () => {
  it("should_reject_empty_pattern", () => {
    expect(isPatternFieldValid("")).toBe(false);
    expect(isPatternFieldValid("   ")).toBe(false);
  });

  it("should_reject_pattern_above_max_length", () => {
    expect(isPatternFieldValid("a".repeat(201))).toBe(false);
  });

  it("should_accept_valid_pattern_within_limits", () => {
    expect(isPatternFieldValid("FAC-\\d{4}-\\d+")).toBe(true);
    expect(isPatternFieldValid("a".repeat(200))).toBe(true);
  });

  it("should_reject_pattern_with_invalid_syntax", () => {
    // parenthèse manquante
    expect(isPatternFieldValid("FAC-(\\d+")).toBe(false);
  });

  it("should_reject_polynomial_backtracking_pattern_to_avoid_round_trip_api", () => {
    expect(isPatternFieldValid("(a+)+")).toBe(false);
  });
});

describe("buildCreatePayload", () => {
  it("should_build_KEYWORDS_payload_without_regex_fields", () => {
    const state: DialogState = {
      mode: "KEYWORDS",
      name: "Devis ",
      keywords: ["devis", "proposition"],
      regexPattern: "",
      color: "amber",
      isActive: true,
    };
    const payload = buildCreatePayload(state);
    expect(payload).toEqual({
      mode: "KEYWORDS",
      name: "Devis",
      keywords: ["devis", "proposition"],
      color: "amber",
    });
    expect("regexPattern" in payload).toBe(false);
  });

  it("should_build_REGEX_payload_without_keywords_field", () => {
    const state: DialogState = {
      mode: "REGEX",
      name: "Facture",
      keywords: [],
      regexPattern: "FAC-\\d{4}-\\d+",
      color: "violet",
      isActive: true,
    };
    const payload = buildCreatePayload(state);
    expect(payload).toEqual({
      mode: "REGEX",
      name: "Facture",
      regexPattern: "FAC-\\d{4}-\\d+",
      color: "violet",
    });
    expect("keywords" in payload).toBe(false);
  });
});

describe("buildPatchPayload", () => {
  it("should_include_isActive_in_KEYWORDS_patch", () => {
    const state: DialogState = {
      mode: "KEYWORDS",
      name: "Devis",
      keywords: ["devis"],
      regexPattern: "",
      color: "amber",
      isActive: false,
    };
    const payload = buildPatchPayload(state);
    expect(payload).toMatchObject({
      mode: "KEYWORDS",
      name: "Devis",
      keywords: ["devis"],
      color: "amber",
      isActive: false,
    });
  });

  it("should_include_isActive_in_REGEX_patch_and_omit_keywords", () => {
    const state: DialogState = {
      mode: "REGEX",
      name: "Facture",
      keywords: [],
      regexPattern: "FAC-\\d+",
      color: "violet",
      isActive: true,
    };
    const payload = buildPatchPayload(state);
    expect(payload).toMatchObject({
      mode: "REGEX",
      regexPattern: "FAC-\\d+",
      color: "violet",
      isActive: true,
    });
    expect("keywords" in payload).toBe(false);
  });

  it("should_trim_name_in_payload", () => {
    const state: DialogState = {
      mode: "KEYWORDS",
      name: "   Devis   ",
      keywords: ["devis"],
      regexPattern: "",
      color: "amber",
      isActive: true,
    };
    expect(buildCreatePayload(state).name).toBe("Devis");
    expect(buildPatchPayload(state).name).toBe("Devis");
  });
});
