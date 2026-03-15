import { describe, expect, it } from "vitest";
import {
  extractActionsFromEmail,
  type EmailContext,
  type UserExclusionData,
} from "@/lib/actions/extract-actions-regex";

function ctx(overrides: Partial<EmailContext> = {}): EmailContext {
  return {
    from: "collegue@entreprise.com",
    subject: "Demande",
    body: "Peux-tu m'envoyer le rapport ?",
    receivedAt: new Date("2024-01-15T10:00:00Z"),
    ...overrides,
  };
}

// ============================================================================
// shouldExcludeByUserRules — via extractActionsFromEmail
// ============================================================================

describe("Exclusion par expéditeur (SENDER)", () => {
  const exclusions: UserExclusionData[] = [
    { type: "SENDER", value: "spam@example.com" },
  ];

  it("exclut un email dont l'adresse correspond exactement", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "spam@example.com" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("exclut un email au format 'Name <email>'", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "Spammer <spam@example.com>" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("est insensible à la casse", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "SPAM@EXAMPLE.COM" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("ne bloque pas un autre expéditeur du même domaine", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "legit@example.com" }),
      exclusions
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it("n'exclut pas si aucune exclusion fournie", () => {
    const result = extractActionsFromEmail(ctx({ from: "spam@example.com" }), []);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("Exclusion par domaine (DOMAIN)", () => {
  const exclusions: UserExclusionData[] = [
    { type: "DOMAIN", value: "newsletter.com" },
  ];

  it("exclut un email dont le domaine correspond", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "info@newsletter.com" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("exclut un email au format 'Name <email>' avec le bon domaine", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "Newsletter <info@newsletter.com>" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("est insensible à la casse", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "info@NEWSLETTER.COM" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("ne bloque pas un domaine qui se termine différemment", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "info@othernewsletter.com" }),
      exclusions
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it("ne fait pas de correspondance partielle dans le nom local", () => {
    // "newsletter.com" ne doit pas matcher "user@notnewsletter.com"
    const result = extractActionsFromEmail(
      ctx({ from: "user@notnewsletter.com" }),
      exclusions
    );
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("Exclusion par sujet (SUBJECT)", () => {
  const exclusions: UserExclusionData[] = [
    { type: "SUBJECT", value: "offre promotionnelle" },
  ];

  it("exclut un email dont le sujet contient la valeur", () => {
    const result = extractActionsFromEmail(
      ctx({ subject: "Notre offre promotionnelle du mois" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("est insensible à la casse", () => {
    const result = extractActionsFromEmail(
      ctx({ subject: "OFFRE PROMOTIONNELLE EXCLUSIVE" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("ne bloque pas un sujet sans la valeur", () => {
    const result = extractActionsFromEmail(
      ctx({ subject: "Réunion de projet" }),
      exclusions
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it("ne bloque pas quand le sujet est null", () => {
    const result = extractActionsFromEmail(
      ctx({ subject: null }),
      exclusions
    );
    // sujet null ne doit pas crasher
    expect(result).toBeDefined();
  });
});

describe("Exclusions multiples", () => {
  const exclusions: UserExclusionData[] = [
    { type: "SENDER", value: "blocked@a.com" },
    { type: "DOMAIN", value: "spam.fr" },
    { type: "SUBJECT", value: "promotion" },
  ];

  it("bloque si l'expéditeur correspond à la règle SENDER", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "blocked@a.com" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("bloque si le domaine correspond à la règle DOMAIN", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "anyone@spam.fr" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("bloque si le sujet correspond à la règle SUBJECT", () => {
    const result = extractActionsFromEmail(
      ctx({ subject: "Promotion exceptionnelle" }),
      exclusions
    );
    expect(result).toHaveLength(0);
  });

  it("laisse passer un email qui ne correspond à aucune règle", () => {
    const result = extractActionsFromEmail(
      ctx({ from: "boss@company.com", subject: "Réunion demain" }),
      exclusions
    );
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("Priorité : exclusions utilisateur avant exclusions système", () => {
  it("les exclusions utilisateur sont vérifiées avant les patterns système", () => {
    // L'email est d'abord exclu par règle utilisateur, jamais analysé
    const exclusions: UserExclusionData[] = [
      { type: "SENDER", value: "collegue@entreprise.com" },
    ];
    const result = extractActionsFromEmail(ctx(), exclusions);
    expect(result).toHaveLength(0);
  });
});
