/**
 * Tests pour l'extension de POST /api/actions/manual — Phase 4 RED
 *
 * Couvre :
 *   - US-6 (création ponctuelle, persistAsRule: false) — Cas C
 *   - US-7 (création de règle, persistAsRule: true) — Cas B
 *   - Cas A : usage d'un type custom existant (customTypeId)
 *   - AC-12 (transaction rollback)
 *
 * NB : Le route `manual` actuel ne supporte pas encore CUSTOM. Ces tests sont en RED
 *      tant que l'extension n'est pas implémentée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/actions/manual/route";
import { prisma } from "@/lib/db";

// Le route `manual` utilise `getCurrentUser` (lib/session) au lieu de `auth` directement.
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/session";

const mockUser = { id: "user123", email: "user@example.com" };

const baseEmailFields = {
  sourceSentence: "Peux-tu reviewer la PR avant demain ?",
  emailFrom: "boss@company.com",
  emailReceivedAt: "2026-04-25T10:00:00Z",
};

const mockExistingCustomType = {
  id: "ctype-existing",
  userId: "user123",
  name: "Review code",
  slug: "review_code",
  keywords: ["review", "PR"],
  color: "violet",
  isActive: true,
  createdAt: new Date("2026-04-20T10:00:00Z"),
  updatedAt: new Date("2026-04-20T10:00:00Z"),
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/actions/manual", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

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
      count: vi.fn(),
    };
  }
  return p.customActionType as Record<string, ReturnType<typeof vi.fn>>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cas A — type custom existant
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/actions/manual — Cas A (customTypeId existant)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_create_action_with_existing_customTypeId_when_type_id_provided", async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockExistingCustomType);
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act1", ...data, status: "TODO" } as any)
    );

    const body = {
      title: "Review PR #42",
      type: "CUSTOM",
      customTypeId: "ctype-existing",
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    expect(data.action.type).toBe("CUSTOM");
    expect(data.action.customTypeId).toBe("ctype-existing");
  });

  it("should_snapshot_label_and_color_from_existing_type_when_action_created", async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockExistingCustomType);
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act1", ...data, status: "TODO" } as any)
    );

    const body = {
      title: "Review PR #42",
      type: "CUSTOM",
      customTypeId: "ctype-existing",
      ...baseEmailFields,
    };

    // Act
    await POST(makeRequest(body));

    // Assert
    expect(prisma.action.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CUSTOM",
          customTypeId: "ctype-existing",
          customTypeLabel: "Review code",
          customTypeColor: "violet",
        }),
      })
    );
  });

  it("should_return_403_when_customTypeId_belongs_to_another_user", async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue({ ...mockExistingCustomType, userId: "otherUser456" });

    const body = {
      title: "Steal action",
      type: "CUSTOM",
      customTypeId: "ctype-existing",
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));

    // Assert
    expect(res.status).toBe(403);
    expect(prisma.action.create).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Cas B — création de règle (persistAsRule: true) → transaction
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/actions/manual — Cas B (persistAsRule: true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_create_type_and_action_in_transaction_when_persistAsRule_true", async () => {
    // Arrange (US-7.1)
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    const newCustomType = {
      ...mockExistingCustomType,
      id: "ctype-new",
      name: "Code review",
      slug: "code_review",
      keywords: ["review", "merge", "approve"],
      color: "violet",
    };
    cat.create.mockResolvedValue(newCustomType);
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act-new", ...data, status: "TODO" } as any)
    );
    // Mock transaction : la fonction route est censée wrapper dans prisma.$transaction
    (prisma.$transaction as any).mockImplementation(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(prisma);
      }
      return Promise.all(arg);
    });

    const body = {
      title: "Code review PR #42",
      type: "CUSTOM",
      customTypeName: "Code review",
      customTypeColor: "violet",
      persistAsRule: true,
      keywords: ["review", "merge", "approve"],
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    expect(data.action).toBeDefined();
    expect(data.action.type).toBe("CUSTOM");
    expect(data.createdCustomType).toBeDefined();
    expect(data.createdCustomType.name).toBe("Code review");
    expect(cat.create).toHaveBeenCalled();
    expect(prisma.action.create).toHaveBeenCalled();
  });

  // Régression CRITICAL-1 (Phase 8 review) : sans validated:true, le scan
  // automatique (filter validated:true) excluait silencieusement les types
  // créés depuis la page /missing-action.
  it("should_persist_validated_true_and_mode_KEYWORDS_when_persistAsRule_true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    cat.create.mockResolvedValue({
      ...mockExistingCustomType,
      id: "ctype-new",
      name: "Devis",
      slug: "devis",
      keywords: ["devis", "proposition", "estimation"],
      color: "amber",
    });
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act-new", ...data, status: "TODO" } as any)
    );
    (prisma.$transaction as any).mockImplementation(async (arg: any) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    });

    const body = {
      title: "Validation devis",
      type: "CUSTOM",
      customTypeName: "Devis",
      customTypeColor: "amber",
      persistAsRule: true,
      keywords: ["devis", "proposition", "estimation"],
      ...baseEmailFields,
    };

    await POST(makeRequest(body));

    expect(cat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: "KEYWORDS",
          validated: true,
        }),
      })
    );
  });

  it("should_rollback_transaction_when_limit_reached", async () => {
    // Arrange (AC-12 + US-7.2) — déjà 10 types existants → 11ème refusé
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(10);
    (prisma.$transaction as any).mockImplementation(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(prisma);
      }
      return Promise.all(arg);
    });

    const body = {
      title: "Onzième",
      type: "CUSTOM",
      customTypeName: "Eleventh type",
      customTypeColor: "blue",
      persistAsRule: true,
      keywords: ["eleven", "extra"],
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));
    const data = await res.json();

    // Assert : 400 avec message spécifique à la limite, et ni type ni Action créés
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/limite|10/i);
    expect(cat.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user123" } })
    );
    expect(cat.create).not.toHaveBeenCalled();
    expect(prisma.action.create).not.toHaveBeenCalled();
  });

  it("should_rollback_when_keyword_invalid", async () => {
    // Arrange (US-7.3) — keyword "le" est dans la stoplist FR
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    (prisma.$transaction as any).mockImplementation(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(prisma);
      }
      return Promise.all(arg);
    });

    const body = {
      title: "Stoplist test",
      type: "CUSTOM",
      customTypeName: "Stoplist test",
      customTypeColor: "blue",
      persistAsRule: true,
      keywords: ["le", "envoi"],
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));

    // Assert
    expect(res.status).toBe(422);
    expect(cat.create).not.toHaveBeenCalled();
    expect(prisma.action.create).not.toHaveBeenCalled();
  });

  it("should_use_provided_keywords_for_new_rule", async () => {
    // Arrange (US-7.4)
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    cat.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "ctype-new", ...data })
    );
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act-new", ...data, status: "TODO" } as any)
    );
    (prisma.$transaction as any).mockImplementation(async (arg: any) => {
      if (typeof arg === "function") {
        return arg(prisma);
      }
      return Promise.all(arg);
    });

    const providedKeywords = ["reviewer", "merge", "approve"];

    const body = {
      title: "Review PR",
      type: "CUSTOM",
      customTypeName: "Code review",
      customTypeColor: "violet",
      persistAsRule: true,
      keywords: providedKeywords,
      ...baseEmailFields,
    };

    // Act
    await POST(makeRequest(body));

    // Assert
    expect(cat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keywords: providedKeywords,
        }),
      })
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Cas C — ponctuel (persistAsRule: false)
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/actions/manual — Cas C (persistAsRule: false)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_create_action_with_null_customTypeId_when_persistAsRule_false", async () => {
    // Arrange (US-6.1)
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act-ponctuel", ...data, status: "TODO" } as any)
    );

    const body = {
      title: "Audit RGPD ponctuel",
      type: "CUSTOM",
      customTypeName: "Audit RGPD ponctuel",
      customTypeColor: "amber",
      persistAsRule: false,
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    expect(data.action.type).toBe("CUSTOM");
    expect(data.action.customTypeId).toBeNull();
  });

  it("should_snapshot_label_and_color_from_form_when_persistAsRule_false", async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act-ponctuel", ...data, status: "TODO" } as any)
    );

    const body = {
      title: "Audit RGPD ponctuel",
      type: "CUSTOM",
      customTypeName: "Audit RGPD ponctuel",
      customTypeColor: "amber",
      persistAsRule: false,
      ...baseEmailFields,
    };

    // Act
    await POST(makeRequest(body));

    // Assert
    expect(prisma.action.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CUSTOM",
          customTypeId: null,
          customTypeLabel: "Audit RGPD ponctuel",
          customTypeColor: "amber",
        }),
      })
    );
  });

  it("should_not_create_CustomActionType_when_persistAsRule_false", async () => {
    // Arrange
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const cat = ensureCustomActionTypeMock();
    (prisma.action.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: "act-ponctuel", ...data, status: "TODO" } as any)
    );

    const body = {
      title: "Audit RGPD ponctuel",
      type: "CUSTOM",
      customTypeName: "Audit RGPD ponctuel",
      customTypeColor: "amber",
      persistAsRule: false,
      keywords: ["audit", "rgpd"], // keywords ignorés en mode ponctuel
      ...baseEmailFields,
    };

    // Act
    const res = await POST(makeRequest(body));

    // Assert : l'Action ponctuelle est bien créée (201) ET aucun type n'est persisté
    expect(res.status).toBe(201);
    expect(prisma.action.create).toHaveBeenCalled();
    expect(cat.create).not.toHaveBeenCalled();
  });
});
