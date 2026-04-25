/**
 * Tests RED (Phase 4) pour les helpers de construction du body
 * d'une action manuelle créée depuis /missing-action.
 *
 * Couvre :
 * - extractCandidateKeywords (heuristique pré-remplissage règle)
 * - buildManualActionBody (cas natif / custom existant / nouveau ponctuel / nouveau règle)
 *
 * Module de prod attendu : `@/lib/actions/manual-action-form`
 */

import { describe, expect, it } from "vitest";
import {
  buildManualActionBody,
  extractCandidateKeywords,
  NEW_CUSTOM_SENTINEL,
  type ManualActionEmail,
  type ManualActionCustomType,
  type ManualActionFormState,
} from "@/lib/actions/manual-action-form";

const baseEmail: ManualActionEmail = {
  from: "client@example.com",
  receivedAt: "2026-04-25T10:00:00Z",
  gmailMessageId: "gmail-123",
  imapUID: null,
  webUrl: "https://mail.google.com/...",
};

const baseState: ManualActionFormState = {
  title: "Faire le rapport",
  sentence: "Peux-tu envoyer le rapport ?",
  typeSelection: "SEND",
  newCustomName: "",
  newCustomColor: "violet",
  newKeywords: [],
  persistAsRule: false,
};

const existingCustomTypes: ManualActionCustomType[] = [
  { id: "cstm-1", name: "Review code", color: "violet" },
  { id: "cstm-2", name: "Daily stand-up", color: "blue" },
];

describe("extractCandidateKeywords", () => {
  it("should_return_empty_when_sentence_is_empty", () => {
    expect(extractCandidateKeywords("")).toEqual([]);
  });

  it("should_filter_french_stopwords_when_sentence_has_them", () => {
    // "le", "de", "à" sont stopwords (et < 4 chars, donc filtrés deux fois)
    const result = extractCandidateKeywords("Envoyer le rapport à Marie de la part du chef");
    expect(result).not.toContain("le");
    expect(result).not.toContain("de");
    expect(result).not.toContain("la");
    expect(result).toContain("envoyer");
    expect(result).toContain("rapport");
  });

  it("should_filter_words_below_4_chars_when_too_short", () => {
    const result = extractCandidateKeywords("Va voir le chat noir");
    // "va", "voir" (4 OK), "le" (stopword), "chat" (4), "noir" (4)
    expect(result).not.toContain("va");
  });

  it("should_dedup_case_insensitive_when_repeated", () => {
    const result = extractCandidateKeywords("Review review REVIEW PullRequest pullrequest");
    // 'review' apparaît 3 fois mais déduplique en 1 entrée (lowercased)
    const reviewCount = result.filter((w) => w === "review").length;
    expect(reviewCount).toBe(1);
  });

  it("should_keep_max_5_words_when_many_candidates", () => {
    const result = extractCandidateKeywords(
      "envoyer rapport facture client urgent demain matin documents finaliser"
    );
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("should_handle_accented_words_when_french_chars", () => {
    const result = extractCandidateKeywords("rédiger éditer présentation");
    expect(result).toContain("rédiger");
    expect(result).toContain("éditer");
    expect(result).toContain("présentation");
  });

  it("should_handle_punctuation_when_sentence_has_it", () => {
    const result = extractCandidateKeywords("Envoyer, rapport. Vraiment !");
    expect(result).toContain("envoyer");
    expect(result).toContain("rapport");
    expect(result).toContain("vraiment");
  });
});

describe("buildManualActionBody — natif (5 types par défaut)", () => {
  it("should_build_native_body_when_native_type_selected", () => {
    const state = { ...baseState, typeSelection: "SEND" };
    const body = buildManualActionBody(state, baseEmail, []);
    expect(body).toMatchObject({
      title: "Faire le rapport",
      type: "SEND",
      sourceSentence: "Peux-tu envoyer le rapport ?",
      emailFrom: "client@example.com",
      gmailMessageId: "gmail-123",
    });
    expect(body).not.toHaveProperty("customTypeId");
    expect(body).not.toHaveProperty("customTypeName");
    expect(body).not.toHaveProperty("customTypeColor");
    expect(body).not.toHaveProperty("persistAsRule");
  });

  it("should_trim_title_and_sentence_when_padded", () => {
    const state = { ...baseState, title: "  Mon titre  ", sentence: "  ma phrase  " };
    const body = buildManualActionBody(state, baseEmail, []);
    expect(body).toMatchObject({ title: "Mon titre", sourceSentence: "ma phrase" });
  });
});

describe("buildManualActionBody — cas A : type custom existant", () => {
  it("should_build_existing_custom_body_when_customTypeId_provided", () => {
    const state = { ...baseState, typeSelection: "cstm-1" };
    const body = buildManualActionBody(state, baseEmail, existingCustomTypes);
    expect(body).toMatchObject({
      type: "CUSTOM",
      customTypeId: "cstm-1",
    });
    expect(body).not.toHaveProperty("customTypeName");
    expect(body).not.toHaveProperty("persistAsRule");
  });
});

describe("buildManualActionBody — cas C : nouveau type ponctuel (persistAsRule false)", () => {
  it("should_build_new_custom_oneShot_body_when_persistAsRule_false", () => {
    const state = {
      ...baseState,
      typeSelection: NEW_CUSTOM_SENTINEL,
      newCustomName: "Audit RGPD",
      newCustomColor: "amber" as const,
      persistAsRule: false,
    };
    const body = buildManualActionBody(state, baseEmail, []);
    expect(body).toMatchObject({
      type: "CUSTOM",
      customTypeName: "Audit RGPD",
      customTypeColor: "amber",
      persistAsRule: false,
    });
    expect(body).not.toHaveProperty("customTypeId");
    expect(body).not.toHaveProperty("keywords");
  });

  it("should_trim_customTypeName_when_padded", () => {
    const state = {
      ...baseState,
      typeSelection: NEW_CUSTOM_SENTINEL,
      newCustomName: "  Audit  ",
    };
    const body = buildManualActionBody(state, baseEmail, []);
    expect(body).toMatchObject({ customTypeName: "Audit" });
  });
});

describe("buildManualActionBody — cas B : nouvelle règle (persistAsRule true)", () => {
  it("should_build_new_custom_rule_body_when_persistAsRule_true", () => {
    const state = {
      ...baseState,
      typeSelection: NEW_CUSTOM_SENTINEL,
      newCustomName: "Code review",
      newCustomColor: "violet" as const,
      newKeywords: ["review", "PR", "merge request"],
      persistAsRule: true,
    };
    const body = buildManualActionBody(state, baseEmail, []);
    expect(body).toMatchObject({
      type: "CUSTOM",
      customTypeName: "Code review",
      customTypeColor: "violet",
      persistAsRule: true,
      keywords: ["review", "PR", "merge request"],
    });
  });

  it("should_omit_keywords_when_oneShot_mode", () => {
    const state = {
      ...baseState,
      typeSelection: NEW_CUSTOM_SENTINEL,
      newCustomName: "Une fois",
      newKeywords: ["pas", "utilisé", "ici"],
      persistAsRule: false,
    };
    const body = buildManualActionBody(state, baseEmail, []);
    expect(body).not.toHaveProperty("keywords");
  });
});

describe("buildManualActionBody — preservation des champs email", () => {
  it("should_pass_through_imapUID_when_present", () => {
    const email: ManualActionEmail = {
      ...baseEmail,
      gmailMessageId: null,
      imapUID: "98765",
    };
    const body = buildManualActionBody(baseState, email, []);
    expect(body).toMatchObject({ imapUID: "98765" });
  });

  it("should_pass_through_webUrl_when_present", () => {
    const body = buildManualActionBody(baseState, baseEmail, []);
    expect(body).toMatchObject({ emailWebUrl: "https://mail.google.com/..." });
  });
});
