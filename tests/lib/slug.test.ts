/**
 * Tests pour `nameToSlug` — Phase 4 RED
 *
 * Couvre :
 * - AC-2 (slug deterministic)
 * - Edge cases section 4.1 (caractères spéciaux uniquement, accents, etc.)
 *
 * NB : `@/lib/slug` n'existe pas encore — c'est attendu (RED phase).
 */

import { describe, expect, it } from "vitest";

import { nameToSlug } from "@/lib/slug";

describe("nameToSlug — happy path", () => {
  it("should_generate_lowercase_underscore_when_simple_name", () => {
    // Arrange
    const input = "Review Code";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("review_code");
  });

  it("should_handle_uppercase_when_acronyms", () => {
    // Arrange
    const input = "PR Review";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("pr_review");
  });
});

describe("nameToSlug — diacritics", () => {
  it("should_remove_diacritics_when_accented_name", () => {
    // Arrange
    const input = "Dépôt greffe";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("depot_greffe");
  });
});

describe("nameToSlug — whitespace handling", () => {
  it("should_handle_multiple_spaces_when_input_has_padding", () => {
    // Arrange
    const input = "  Daily   stand-up  ";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("daily_stand_up");
  });

  it("should_trim_underscores_when_borders", () => {
    // Arrange
    const input = "___test___";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("test");
  });
});

describe("nameToSlug — special characters", () => {
  it("should_collapse_special_chars_when_punctuation", () => {
    // Arrange
    const input = "Review-Code/PR!";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("review_code_pr");
  });

  it("should_return_empty_when_only_special_chars", () => {
    // Arrange
    const input = "!!!";

    // Act
    const slug = nameToSlug(input);

    // Assert
    expect(slug).toBe("");
  });
});
