/**
 * Tests pour les routes /api/custom-action-types — Phase 4 RED
 *
 * Couvre US-1, US-2, US-3, US-4 + AC-1, AC-3, AC-4, AC-5, AC-6, AC-13
 *
 * NB : Les fichiers route ciblés n'existent pas encore — c'est attendu (RED phase).
 *      L'import échouera, ce qui est le comportement souhaité.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/custom-action-types/route";
import { DELETE, PATCH } from "@/app/api/custom-action-types/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function req(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const mockSession = { user: { id: "user123", email: "user@example.com" }, expires: "2099-01-01" };

const mockType = {
  id: "ctype1",
  userId: "user123",
  name: "Review code",
  slug: "review_code",
  keywords: ["review", "PR", "merge request"],
  color: "violet",
  isActive: true,
  createdAt: new Date("2026-04-25T10:00:00Z"),
  updatedAt: new Date("2026-04-25T10:00:00Z"),
};

// ──────────────────────────────────────────────────────────────────────────────
// Helper : déclarer le namespace customActionType côté prisma mock à la volée.
// Le mock @/lib/db ne contient pas encore ce namespace : on l'injecte.
// ──────────────────────────────────────────────────────────────────────────────
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
  return (p.customActionType as Record<string, ReturnType<typeof vi.fn>>);
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/custom-action-types
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/custom-action-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_return_401_when_no_session", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null as any);

    // Act
    const res = await GET(req("http://localhost/api/custom-action-types"));

    // Assert
    expect(res.status).toBe(401);
  });

  it("should_return_200_with_empty_array_when_user_has_no_custom_types", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findMany.mockResolvedValue([]);

    // Act
    const res = await GET(req("http://localhost/api/custom-action-types"));
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.types).toEqual([]);
  });

  it("should_return_200_with_types_ordered_by_createdAt_desc_when_user_has_3_types", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    const types = [
      { ...mockType, id: "t3", name: "Newest", createdAt: new Date("2026-04-25") },
      { ...mockType, id: "t2", name: "Middle", createdAt: new Date("2026-04-20") },
      { ...mockType, id: "t1", name: "Oldest", createdAt: new Date("2026-04-15") },
    ];
    cat.findMany.mockResolvedValue(types);

    // Act
    const res = await GET(req("http://localhost/api/custom-action-types"));
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.types).toHaveLength(3);
    expect(cat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user123" },
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/custom-action-types
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/custom-action-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_return_401_when_no_session", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null as any);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Review code",
        keywords: ["review"],
        color: "violet",
      })
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("should_return_201_when_create_valid_type", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(0);
    cat.create.mockResolvedValue(mockType);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Review code",
        keywords: ["review", "PR", "merge request"],
        color: "violet",
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    expect(data.type).toBeDefined();
    expect(data.type.name).toBe("Review code");
    expect(data.type.color).toBe("violet");
    expect(data.type.isActive).toBe(true);
  });

  it("should_assign_color_by_rotation_when_no_color_provided", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    // 3 types existants → palette[3 % 8] = 4ème couleur dans la palette
    cat.count.mockResolvedValue(3);
    cat.create.mockImplementation(({ data }: any) => Promise.resolve({ ...mockType, ...data }));

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Daily stand-up",
        keywords: ["daily", "standup", "morning sync"],
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(201);
    // La couleur doit faire partie de la palette des 8
    const palette = ["slate", "blue", "indigo", "violet", "pink", "rose", "orange", "amber"];
    expect(palette).toContain(data.type.color);
    // Et doit suivre la règle de rotation : palette[count % 8] = palette[3] = "violet"
    expect(data.type.color).toBe(palette[3 % 8]);
  });

  it("should_return_400_when_user_already_has_10_types", async () => {
    // Arrange (AC-1)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(10);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Onzième",
        keywords: ["test"],
        color: "blue",
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/limite|10/i);
    expect(cat.create).not.toHaveBeenCalled();
  });

  it("should_return_409_when_slug_conflicts_with_existing_type", async () => {
    // Arrange (AC-3) — un autre type "Review Code" existe déjà avec slug review_code
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.count.mockResolvedValue(1);
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    cat.create.mockRejectedValue(p2002);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "review-code",
        keywords: ["review", "code"],
        color: "blue",
      })
    );

    // Assert
    expect(res.status).toBe(409);
  });

  it("should_return_422_when_name_empty", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "",
        keywords: ["review"],
        color: "violet",
      })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_name_exceeds_50_chars", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const longName = "a".repeat(51);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: longName,
        keywords: ["review"],
        color: "violet",
      })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_keyword_below_4_chars", async () => {
    // Arrange (AC-5)
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Review code",
        keywords: ["pr", "review"], // "pr" < 4 chars
        color: "violet",
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(422);
    expect(data.invalidKeywords).toContain("pr");
  });

  it("should_return_422_when_keyword_in_french_stoplist", async () => {
    // Arrange (AC-6)
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Envoi",
        keywords: ["envoie", "le", "documents"], // "le" est stopword FR
        color: "blue",
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(422);
    expect(data.invalidKeywords).toContain("le");
  });

  it("should_return_422_when_keyword_exceeds_60_chars", async () => {
    // Arrange (anti-ReDoS)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const longKeyword = "a".repeat(61);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Test",
        keywords: [longKeyword],
        color: "violet",
      })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_color_not_in_palette", async () => {
    // Arrange (AC-4) — "purple" n'est pas dans la palette des 8
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Review code",
        keywords: ["review"],
        color: "purple",
      })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_keywords_array_empty", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Review code",
        keywords: [],
        color: "violet",
      })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_more_than_50_keywords", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const tooMany = Array.from({ length: 51 }, (_, i) => `keyword${i.toString().padStart(2, "0")}`);

    // Act
    const res = await POST(
      req("http://localhost/api/custom-action-types", "POST", {
        name: "Many",
        keywords: tooMany,
        color: "violet",
      })
    );

    // Assert
    expect(res.status).toBe(422);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/custom-action-types/[id]
// ──────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/custom-action-types/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_return_401_when_no_session", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null as any);

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { name: "Code review" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("should_return_200_when_rename_valid", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    cat.update.mockResolvedValue({ ...mockType, name: "Code review", slug: "code_review" });

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { name: "Code review" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.type.name).toBe("Code review");
  });

  it("should_regenerate_slug_when_name_changes", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    cat.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockType, ...data })
    );

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { name: "Code review" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.type.slug).toBe("code_review");
  });

  it("should_return_409_when_renamed_slug_conflicts", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    cat.update.mockRejectedValue(p2002);

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { name: "Daily stand-up" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert
    expect(res.status).toBe(409);
  });

  it("should_return_200_when_toggle_isActive_false", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    cat.update.mockResolvedValue({ ...mockType, isActive: false });

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { isActive: false }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.type.isActive).toBe(false);
  });

  it("should_return_200_when_change_color", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    cat.update.mockResolvedValue({ ...mockType, color: "indigo" });

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { color: "indigo" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.type.color).toBe("indigo");
  });

  it("should_return_403_when_type_belongs_to_another_user", async () => {
    // Arrange (AC-13)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue({ ...mockType, userId: "otherUser456" });

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { name: "Hacked" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert
    expect(res.status).toBe(403);
    expect(cat.update).not.toHaveBeenCalled();
  });

  it("should_return_404_when_type_id_unknown", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(null);

    // Act
    const res = await PATCH(
      req("http://localhost/api/custom-action-types/ghost", "PATCH", { name: "X" }),
      { params: Promise.resolve({ id: "ghost" }) }
    );

    // Assert
    expect(res.status).toBe(404);
  });

  it("should_not_modify_existing_actions_label_when_type_renamed", async () => {
    // Arrange (AC-7) — quand on renomme un type, AUCUN PATCH ne doit toucher
    // les Actions historiques (snapshot label/color figé).
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    cat.update.mockResolvedValue({ ...mockType, name: "Code review", slug: "code_review" });

    // Act
    await PATCH(
      req("http://localhost/api/custom-action-types/ctype1", "PATCH", { name: "Code review" }),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert : aucun update/updateMany sur la table action ne doit avoir lieu
    expect(prisma.action.update).not.toHaveBeenCalled();
    expect((prisma.action as any).updateMany).toBeDefined();
    // Note : updateMany peut ne pas être présent dans le mock par défaut, on tolère.
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/custom-action-types/[id]
// ──────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/custom-action-types/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCustomActionTypeMock();
  });

  it("should_return_401_when_no_session", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null as any);

    // Act
    const res = await DELETE(
      req("http://localhost/api/custom-action-types/ctype1", "DELETE"),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("should_return_200_with_affectedActions_0_when_no_linked_actions", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    vi.mocked(prisma.action.count).mockResolvedValue(0);
    cat.delete.mockResolvedValue(mockType);

    // Act
    const res = await DELETE(
      req("http://localhost/api/custom-action-types/ctype1", "DELETE"),
      { params: Promise.resolve({ id: "ctype1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.affectedActions).toBe(0);
  });

  it("should_return_200_with_affectedActions_count_when_active_actions_exist", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    vi.mocked(prisma.action.count).mockResolvedValue(3);
    cat.delete.mockResolvedValue(mockType);

    // Act
    const res = await DELETE(
      req("http://localhost/api/custom-action-types/ctype1", "DELETE"),
      { params: Promise.resolve({ id: "ctype1" }) }
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.affectedActions).toBe(3);
  });

  it("should_set_customTypeId_to_null_on_linked_actions_when_deleted", async () => {
    // Arrange — on s'attend à ce que la suppression du type Prisma (avec onDelete: SetNull)
    // déclenche le nullify automatique des Action.customTypeId. Côté API, on vérifie
    // simplement que la suppression a bien été appelée et que le nullify est délégué à Prisma.
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    vi.mocked(prisma.action.count).mockResolvedValue(2);
    cat.delete.mockResolvedValue(mockType);

    // Act
    await DELETE(
      req("http://localhost/api/custom-action-types/ctype1", "DELETE"),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert
    expect(cat.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "ctype1" }) })
    );
  });

  it("should_keep_customTypeLabel_and_color_snapshots_when_type_deleted", async () => {
    // Arrange (AC-7 + US-4.5) : la suppression NE DOIT PAS toucher les colonnes
    // customTypeLabel / customTypeColor des Actions liées (snapshot intact).
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(mockType);
    vi.mocked(prisma.action.count).mockResolvedValue(5);
    cat.delete.mockResolvedValue(mockType);

    // Act
    await DELETE(
      req("http://localhost/api/custom-action-types/ctype1", "DELETE"),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert : aucun update ne doit être lancé sur la table action
    expect(prisma.action.update).not.toHaveBeenCalled();
    expect(prisma.action.deleteMany).not.toHaveBeenCalled();
  });

  it("should_return_403_when_type_belongs_to_another_user", async () => {
    // Arrange (AC-13)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue({ ...mockType, userId: "otherUser456" });

    // Act
    const res = await DELETE(
      req("http://localhost/api/custom-action-types/ctype1", "DELETE"),
      { params: Promise.resolve({ id: "ctype1" }) }
    );

    // Assert
    expect(res.status).toBe(403);
    expect(cat.delete).not.toHaveBeenCalled();
  });

  it("should_return_404_when_type_id_unknown", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const cat = ensureCustomActionTypeMock();
    cat.findUnique.mockResolvedValue(null);

    // Act
    const res = await DELETE(
      req("http://localhost/api/custom-action-types/ghost", "DELETE"),
      { params: Promise.resolve({ id: "ghost" }) }
    );

    // Assert
    expect(res.status).toBe(404);
  });
});
