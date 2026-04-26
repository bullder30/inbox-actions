/**
 * Tests RED — UI Step 2/3 : helpers du picker templates regex métier.
 *
 * Couvre US-6 (sélection template métier) :
 *  - groupement par catégorie pour render Popover
 *  - application sur le state du dialog (pattern + color + name si vide)
 */

import { describe, expect, it } from "vitest";

import {
  applyTemplateToState,
  groupTemplatesByCategory,
} from "@/lib/regex-template-picker";
import { REGEX_TEMPLATES } from "@/lib/regex-templates";
import type { DialogState } from "@/lib/custom-action-types/dialog-state";

const sampleTemplate = REGEX_TEMPLATES.find((t) => t.name === "Facture FAC-XXXX")!;

describe("groupTemplatesByCategory", () => {
  it("should_group_all_templates_by_category", () => {
    const grouped = groupTemplatesByCategory(REGEX_TEMPLATES);
    expect(Object.keys(grouped).sort()).toEqual(["Compta", "IT", "Juridique", "RH"]);
  });

  it("should_include_every_template_exactly_once", () => {
    const grouped = groupTemplatesByCategory(REGEX_TEMPLATES);
    const flat = Object.values(grouped).flat();
    expect(flat).toHaveLength(REGEX_TEMPLATES.length);
    const names = flat.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should_preserve_template_order_within_a_category", () => {
    const grouped = groupTemplatesByCategory(REGEX_TEMPLATES);
    const comptaNames = grouped.Compta?.map((t) => t.name);
    expect(comptaNames?.[0]).toBe("Facture FAC-XXXX");
    expect(comptaNames?.[1]).toBe("Devis DEV-XXXX");
  });

  it("should_handle_empty_input", () => {
    expect(groupTemplatesByCategory([])).toEqual({});
  });
});

describe("applyTemplateToState", () => {
  const baseState: DialogState = {
    mode: "REGEX",
    name: "",
    keywords: [],
    regexPattern: "old-pattern",
    color: "blue",
    isActive: true,
  };

  it("should_overwrite_pattern_and_color_with_template_values", () => {
    const next = applyTemplateToState(baseState, sampleTemplate);
    expect(next.regexPattern).toBe("FAC-\\d{4}-\\d+");
    expect(next.color).toBe("amber");
  });

  it("should_force_mode_to_REGEX_even_when_state_was_KEYWORDS", () => {
    const next = applyTemplateToState(
      { ...baseState, mode: "KEYWORDS", keywords: ["foo"] },
      sampleTemplate
    );
    expect(next.mode).toBe("REGEX");
    expect(next.keywords).toEqual([]);
  });

  it("should_prefill_name_only_when_state_name_is_empty", () => {
    const next = applyTemplateToState(baseState, sampleTemplate);
    expect(next.name).toBe("Facture FAC-XXXX");
  });

  it("should_preserve_user_provided_name", () => {
    const next = applyTemplateToState({ ...baseState, name: "Mon nom" }, sampleTemplate);
    expect(next.name).toBe("Mon nom");
  });

  it("should_preserve_user_provided_name_with_only_whitespace_treated_as_empty", () => {
    const next = applyTemplateToState({ ...baseState, name: "   " }, sampleTemplate);
    expect(next.name).toBe("Facture FAC-XXXX");
  });

  it("should_preserve_isActive_flag", () => {
    const next = applyTemplateToState({ ...baseState, isActive: false }, sampleTemplate);
    expect(next.isActive).toBe(false);
  });
});
