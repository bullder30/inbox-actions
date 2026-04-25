/**
 * Tests pour l'extension de POST/PATCH `/api/custom-action-types[/{id}]`
 * avec `mode: "REGEX"` — Phase 4 RED (regex-power)
 *
 * Couvre :
 *   - US-2 (création nominale REGEX, validations Zod discriminated union)
 *   - US-7 (PATCH : re-validation conditionnelle, swap mode)
 *   - AC-1, AC-3, AC-4 (safe-regex gate)
 *   - AC-13 (continuité custom-actions : 403 cross-user)
 *
 * NB : Les routes existent déjà mais ne supportent pas encore `mode: "REGEX"`.
 *      Les tests sont en RED tant que l'extension n'est pas livrée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// On mock l'executor pour pouvoir asserter "non-appelé" sur les chemins sans
// changement de pattern. Cet import déclenche aussi un fail RED si le module
// n'existe pas encore.
vi.mock("@/lib/actions/regex-executor", () => ({
  isPatternSafe: vi.fn(() => true),
  safelyExecuteRegex: vi.fn(() => ({ matches: [], timedOut: false })),
}));

import { POST } from "@/app/api/custom-action-types/route";
import { PATCH } from "@/app/api/custom-action-types/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isPatternSafe } from "@/lib/actions/regex-executor";

function req(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const mockSession = {
  user: { id: "user123", email: "user@example.com" },
  expires: "2099-01-01",
};

const mockTypeRegex = {
  id: "ctype-regex1",
  userId: "user123",
  name: "Facture client",
  slug: "facture_client",
  mode: "REGEX",
  keywords: [],
  regexPattern: "FAC-\\d{4}-\\d+",
  validated: true,
  color: "amber",
  isActive: true,
  createdAt: new Date("2026-04-25T10:00:00Z"),
  updatedAt: new Date("2026-04-25T10:00:00Z"),
};

const mockTypeKeywords = {
  id: "ctype-kw1",
  userId: "user123",
  name: "Daily stand-up",
  slug: "daily_stand_up",
  mode: "KEYWORDS",
  keywords: ["stand-up", "daily", "morning sync"],
  regexPattern: null,
  validated: true,
  color: "blue",
  isActive: true,
  createdAt: new Date("2026-04-25T10:00:00Z"),
  updatedAt: new Date("2026-04-25T10:00:00Z"),
};

function ensureCustomActionTypeMock() {
  const p = prisma as unknown as Record<string, unknown>;
  if (!p.customActionType) {
    p.customActionType = {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    };
  }
  return p.customActionType as Record<string, ReturnType<typeof vi.fn>>;
}

// ──────────────────────────────────────────────────────────────────────────────
// POST mode REGEX
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/custom-action-types — mode REGEX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_create_type_with_mode_REGEX_and_validated_true_when_pattern_safe", async () => {
    // Arrange (US-2.1, AC-4) — pattern safe → validated=true persisté
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    cat.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeRegex, ...data })
    );

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Facture client",
        mode: "REGEX",
        regexPattern: "FAC-\\d{4}-\\d+",
        color: "amber",
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    expect(data.type.mode).toBe("REGEX");
    expect(data.type.regexPattern).toBe("FAC-\\d{4}-\\d+");
    expect(data.type.validated).toBe(true);
  });

  it("should_return_422_when_mode_REGEX_with_keywords_provided", async () => {
    // Arrange (US-2.6) — Zod discriminated union doit rejeter les keywords en mode REGEX.
    // On vérifie que prisma.create n'est PAS appelé : aujourd'hui, l'endpoint
    // existant rejette à cause de `.strict()` (mode/regexPattern unknown), mais
    // après l'extension, il devra rejeter SPÉCIFIQUEMENT pour incohérence
    // mode/keywords. Dans tous les cas : create jamais appelé.
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    cat.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeRegex, ...data })
    );

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Bad mix",
        mode: "REGEX",
        regexPattern: "FAC-\\d+",
        keywords: ["facture"],
        color: "amber",
      })
    );
    const data = await res.json();

    // Assert : 422 + message ciblé "keywords interdit en mode REGEX"
    // (spec api-contracts.md ligne 100). L'endpoint actuel répond avec un
    // message générique Zod ("Données invalides"), donc ce match RED tant
    // que la discrimination mode/keywords n'est pas implémentée.
    expect(res.status).toBe(422);
    const errStr = JSON.stringify(data).toLowerCase();
    expect(errStr).toMatch(/keywords.*interdit|keywords.*forbidden|forbidden.*keywords/);
    expect(cat.create).not.toHaveBeenCalled();
  });

  it("should_return_422_when_mode_REGEX_without_regexPattern", async () => {
    // Arrange (US-2.5) — mode REGEX sans regexPattern → Zod reject
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Missing pattern",
        mode: "REGEX",
        color: "amber",
      })
    );
    const data = await res.json();

    // Assert : 422 + erreur mentionnant regexPattern requis
    expect(res.status).toBe(422);
    const errStr = JSON.stringify(data).toLowerCase();
    expect(errStr).toMatch(/regexpattern|pattern.*required|required.*pattern/);
    expect(cat.create).not.toHaveBeenCalled();
  });

  it("should_return_422_when_regexPattern_dangerous", async () => {
    // Arrange (US-2.2, AC-1) — safe-regex rejette
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Dangerous",
        mode: "REGEX",
        regexPattern: "(a+)+",
        color: "amber",
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(422);
    expect(data.reason).toBe("polynomial_backtracking");
    expect(cat.create).not.toHaveBeenCalled();
  });

  it("should_return_422_when_regexPattern_syntax_invalid", async () => {
    // Arrange (US-2.3, AC-3) — RegExp constructor throw → réponse spécifique
    // Aujourd'hui l'endpoint répond 422 pour cause de `.strict()` rejetant `mode`,
    // mais sans le bon `details`. Après extension : 422 avec details syntaxe.
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Broken",
        mode: "REGEX",
        regexPattern: "(unclosed[group",
        color: "amber",
      })
    );
    const data = await res.json();

    // Assert : 422 + message dédié "syntax invalide" (spec US-2.3 ligne 85)
    // L'endpoint actuel répond générique Zod (unknown_keys), donc ce match RED.
    expect(res.status).toBe(422);
    const errStr = JSON.stringify(data).toLowerCase();
    expect(errStr).toMatch(/pattern.*syntax|syntax.*invalid|invalid.*regex.*pattern/);
    expect(cat.create).not.toHaveBeenCalled();
  });

  it("should_persist_validated_true_when_safe_regex_passes", async () => {
    // Arrange (AC-4) — vérifie que prisma.create est bien appelé avec validated: true
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    cat.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeRegex, ...data })
    );

    // Act
    await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Facture client",
        mode: "REGEX",
        regexPattern: "FAC-\\d{4}-\\d+",
        color: "amber",
      })
    );

    // Assert
    expect(cat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: "REGEX",
          regexPattern: "FAC-\\d{4}-\\d+",
          validated: true,
        }),
      })
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH mode REGEX / mode swap
// ──────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/custom-action-types/[id] — mode REGEX & swap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_re_validate_pattern_when_regexPattern_changes", async () => {
    // Arrange (US-7.1, AC-4) — modif pattern → nouvelle safe-regex check
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockTypeRegex);
    cat.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeRegex, ...data })
    );

    // Act
    const res = await PATCH(
      req(
        "http://localhost/api/custom-action-types/ctype-regex1",
        "PATCH",
        { regexPattern: "FAC-2025-\\d+" }
      ),
      { params: Promise.resolve({ id: "ctype-regex1" }) }
    );
    const data = await res.json();

    // Assert : update appelé avec validated: true (re-validé)
    expect(res.status).toBe(200);
    expect(cat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          regexPattern: "FAC-2025-\\d+",
          validated: true,
        }),
      })
    );
    expect(data.type.regexPattern).toBe("FAC-2025-\\d+");
  });

  it("should_skip_re_validation_when_only_name_changes", async () => {
    // Arrange (US-7.4) — un type REGEX existant. Patch qui rename uniquement.
    // L'optimisation : safe-regex NE DOIT PAS être re-jouée si le pattern n'a
    // pas changé. On asserte que `isPatternSafe` n'est jamais appelé.
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockTypeRegex);
    cat.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeRegex, ...data })
    );

    // Act
    const res = await PATCH(
      req(
        "http://localhost/api/custom-action-types/ctype-regex1",
        "PATCH",
        { name: "Facture 2025" }
      ),
      { params: Promise.resolve({ id: "ctype-regex1" }) }
    );

    // Assert : 200 + safe-regex non rejouée + update sans `validated`/`regexPattern`
    expect(res.status).toBe(200);
    expect(isPatternSafe).not.toHaveBeenCalled();
    expect(cat.update).toHaveBeenCalledTimes(1);
    const call = cat.update.mock.calls[0]?.[0] as { data?: Record<string, unknown> } | undefined;
    expect(call?.data).not.toHaveProperty("validated");
    expect(call?.data).not.toHaveProperty("regexPattern");
  });

  it("should_clear_keywords_when_mode_changes_KEYWORDS_to_REGEX", async () => {
    // Arrange (US-7.2)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockTypeKeywords);
    cat.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeKeywords, ...data })
    );

    // Act
    const res = await PATCH(
      req(
        "http://localhost/api/custom-action-types/ctype-kw1",
        "PATCH",
        {
          mode: "REGEX",
          regexPattern: "stand[\\s-]*up",
        }
      ),
      { params: Promise.resolve({ id: "ctype-kw1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.type.mode).toBe("REGEX");
    expect(data.type.regexPattern).toBe("stand[\\s-]*up");
    // Keywords ont été effacés (null ou tableau vide)
    const persisted = data.type.keywords;
    expect(persisted === null || (Array.isArray(persisted) && persisted.length === 0)).toBe(true);
  });

  it("should_clear_regexPattern_when_mode_changes_REGEX_to_KEYWORDS", async () => {
    // Arrange (US-7.3)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockTypeRegex);
    cat.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTypeRegex, ...data })
    );

    // Act
    const res = await PATCH(
      req(
        "http://localhost/api/custom-action-types/ctype-regex1",
        "PATCH",
        {
          mode: "KEYWORDS",
          keywords: ["facture", "invoice"],
        }
      ),
      { params: Promise.resolve({ id: "ctype-regex1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.type.mode).toBe("KEYWORDS");
    expect(data.type.regexPattern).toBeNull();
  });

  it("should_return_403_when_type_belongs_to_another_user", async () => {
    // Arrange (AC-13 — continuité custom-actions)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue({
      ...mockTypeRegex,
      userId: "otherUser",
    });

    // Act
    const res = await PATCH(
      req(
        "http://localhost/api/custom-action-types/ctype-regex1",
        "PATCH",
        { regexPattern: "HACK-\\d+" }
      ),
      { params: Promise.resolve({ id: "ctype-regex1" }) }
    );

    // Assert
    expect(res.status).toBe(403);
    expect(cat.update).not.toHaveBeenCalled();
  });
});
