/**
 * Tests RED (Phase 4) pour le helper de rendu d'un badge d'Action
 * (5 types natifs + CUSTOM avec snapshots).
 *
 * Module de prod attendu : `@/lib/actions/action-display`
 */

import { describe, expect, it } from "vitest";
import { getActionTypeDisplay } from "@/lib/actions/action-display";

describe("getActionTypeDisplay — types natifs", () => {
  it("should_return_envoyer_label_when_type_SEND", () => {
    const display = getActionTypeDisplay({ type: "SEND" });
    expect(display.label).toBe("Envoyer");
    expect(display.badgeClasses).toContain("blue");
  });

  it("should_return_appeler_label_when_type_CALL", () => {
    const display = getActionTypeDisplay({ type: "CALL" });
    expect(display.label).toBe("Appeler");
    expect(display.badgeClasses).toContain("green");
  });

  it("should_return_relancer_label_when_type_FOLLOW_UP", () => {
    const display = getActionTypeDisplay({ type: "FOLLOW_UP" });
    expect(display.label).toBe("Relancer");
    expect(display.badgeClasses).toContain("yellow");
  });

  it("should_return_payer_label_when_type_PAY", () => {
    const display = getActionTypeDisplay({ type: "PAY" });
    expect(display.label).toBe("Payer");
    expect(display.badgeClasses).toContain("purple");
  });

  it("should_return_valider_label_when_type_VALIDATE", () => {
    const display = getActionTypeDisplay({ type: "VALIDATE" });
    expect(display.label).toBe("Valider");
    expect(display.badgeClasses).toContain("orange");
  });

  it("should_ignore_customTypeLabel_when_type_is_native", () => {
    // Defensive : si une Action native a malencontreusement un snapshot custom,
    // on doit prendre le label natif (pas le snapshot)
    const display = getActionTypeDisplay({
      type: "SEND",
      customTypeLabel: "Hijack",
      customTypeColor: "violet",
    });
    expect(display.label).toBe("Envoyer");
  });
});

describe("getActionTypeDisplay — type CUSTOM avec snapshots", () => {
  it("should_use_customTypeLabel_when_type_CUSTOM", () => {
    const display = getActionTypeDisplay({
      type: "CUSTOM",
      customTypeLabel: "Review code",
      customTypeColor: "violet",
    });
    expect(display.label).toBe("Review code");
  });

  it("should_apply_color_classes_when_CUSTOM_with_color", () => {
    const display = getActionTypeDisplay({
      type: "CUSTOM",
      customTypeLabel: "Daily stand-up",
      customTypeColor: "blue",
    });
    expect(display.badgeClasses).toContain("blue");
  });

  it("should_handle_all_8_palette_colors_when_CUSTOM", () => {
    const colors = ["slate", "blue", "indigo", "violet", "pink", "rose", "orange", "amber"];
    for (const color of colors) {
      const display = getActionTypeDisplay({
        type: "CUSTOM",
        customTypeLabel: `Test ${color}`,
        customTypeColor: color,
      });
      expect(display.label).toBe(`Test ${color}`);
      // La classe doit contenir la couleur (ex: "bg-violet-100")
      expect(display.badgeClasses).toMatch(new RegExp(`(bg|text)-${color}`));
    }
  });
});

describe("getActionTypeDisplay — fallback défensif CUSTOM sans snapshot", () => {
  it("should_fallback_to_neutral_label_when_CUSTOM_without_label", () => {
    const display = getActionTypeDisplay({
      type: "CUSTOM",
      customTypeLabel: null,
      customTypeColor: null,
    });
    // Label de secours non vide, lisible
    expect(display.label.length).toBeGreaterThan(0);
    expect(display.badgeClasses).toBeTruthy();
  });

  it("should_fallback_to_neutral_color_when_CUSTOM_with_invalid_color", () => {
    const display = getActionTypeDisplay({
      type: "CUSTOM",
      customTypeLabel: "Type avec couleur cassée",
      customTypeColor: "not-in-palette",
    });
    expect(display.label).toBe("Type avec couleur cassée");
    expect(display.badgeClasses).toBeTruthy();
  });
});
