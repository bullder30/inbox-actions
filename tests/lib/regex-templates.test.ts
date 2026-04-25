/**
 * Tests pour `lib/regex-templates.ts` — Phase 4 RED (regex-power)
 *
 * Couvre :
 *   - US-6 (templates métier prédéfinis)
 *   - AC-14 (chaque template valide safe-regex)
 *
 * NB : Le fichier `lib/regex-templates.ts` n'existe pas encore — RED phase.
 */

import { describe, expect, it } from "vitest";

import { isPatternSafe } from "@/lib/actions/regex-executor";
import { REGEX_TEMPLATES } from "@/lib/regex-templates";

const KNOWN_CATEGORIES = ["Compta", "Juridique", "IT", "RH"] as const;

describe("REGEX_TEMPLATES catalogue", () => {
  it("should_export_at_least_10_templates", () => {
    // Arrange — catalogue importé statiquement

    // Act
    const count = REGEX_TEMPLATES.length;

    // Assert
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it("should_have_all_templates_pass_safe_regex", () => {
    // Arrange
    const unsafe: string[] = [];

    // Act — on collecte les templates qui échouent (sans branchement de test)
    REGEX_TEMPLATES.forEach((tpl) => {
      if (!isPatternSafe(tpl.pattern)) unsafe.push(tpl.name);
    });

    // Assert
    expect(unsafe).toEqual([]);
  });

  it("should_have_each_template_with_required_fields", () => {
    // Arrange
    const requiredKeys = ["name", "pattern", "color", "category"];

    // Act
    const missingFields = REGEX_TEMPLATES.flatMap((tpl) =>
      requiredKeys
        .filter((k) => (tpl as Record<string, unknown>)[k] === undefined || (tpl as Record<string, unknown>)[k] === null || (tpl as Record<string, unknown>)[k] === "")
        .map((k) => `${tpl.name ?? "?"}: ${k}`)
    );

    // Assert
    expect(missingFields).toEqual([]);
  });

  it("should_have_categories_among_4_known_values", () => {
    // Arrange
    const known = new Set<string>(KNOWN_CATEGORIES);

    // Act
    const invalidCategories = REGEX_TEMPLATES
      .filter((tpl) => !known.has(tpl.category))
      .map((tpl) => `${tpl.name}=${tpl.category}`);

    // Assert
    expect(invalidCategories).toEqual([]);
  });

  it("should_have_unique_template_names", () => {
    // Arrange
    const counts = new Map<string, number>();
    REGEX_TEMPLATES.forEach((tpl) => {
      counts.set(tpl.name, (counts.get(tpl.name) ?? 0) + 1);
    });

    // Act
    const duplicates = Array.from(counts.entries())
      .filter(([, n]) => n > 1)
      .map(([name]) => name);

    // Assert
    expect(duplicates).toEqual([]);
  });

  it("should_compile_each_pattern_to_valid_RegExp", () => {
    // Arrange
    const invalid: string[] = [];

    // Act — un pattern invalide jette à new RegExp()
    REGEX_TEMPLATES.forEach((tpl) => {
      try {
        new RegExp(tpl.pattern, "gi");
      } catch {
        invalid.push(tpl.name);
      }
    });

    // Assert
    expect(invalid).toEqual([]);
  });
});
