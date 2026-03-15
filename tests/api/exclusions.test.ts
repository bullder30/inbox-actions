import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/exclusions/route";
import { DELETE } from "@/app/api/exclusions/[id]/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function req(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const mockSession = { user: { id: "user123" }, expires: "2099-01-01" };

const mockExclusion = {
  id: "excl1",
  userId: "user123",
  type: "SENDER",
  value: "spam@example.com",
  label: "spam@example.com",
  createdAt: new Date("2024-01-15T10:00:00Z"),
};

// ============================================================================
// GET /api/exclusions
// ============================================================================

describe("GET /api/exclusions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retourne la liste des exclusions de l'utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.findMany).mockResolvedValue([mockExclusion] as any);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.exclusions).toHaveLength(1);
    expect(data.exclusions[0].value).toBe("spam@example.com");
    expect(prisma.userExclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user123" } })
    );
  });

  it("retourne une liste vide si aucune exclusion", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.findMany).mockResolvedValue([]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.exclusions).toHaveLength(0);
  });
});

// ============================================================================
// POST /api/exclusions
// ============================================================================

describe("POST /api/exclusions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const res = await POST(req("http://localhost/api/exclusions", "POST", { type: "SENDER", value: "x@y.com" }));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si le type est invalide", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const res = await POST(req("http://localhost/api/exclusions", "POST", { type: "INVALID", value: "x@y.com" }));
    expect(res.status).toBe(400);
  });

  it("retourne 400 si la valeur est manquante", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const res = await POST(req("http://localhost/api/exclusions", "POST", { type: "SENDER", value: "" }));
    expect(res.status).toBe(400);
  });

  it("crée une exclusion SENDER et retourne 201", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.create).mockResolvedValue(mockExclusion as any);
    vi.mocked(prisma.action.deleteMany).mockResolvedValue({ count: 0 });

    const res = await POST(req("http://localhost/api/exclusions", "POST", {
      type: "SENDER",
      value: "Spam <spam@example.com>",
      label: "spam@example.com",
    }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.exclusion).toBeDefined();
    expect(data.deletedActions).toBe(0);
  });

  it("normalise la valeur en minuscules", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.create).mockResolvedValue(mockExclusion as any);
    vi.mocked(prisma.action.deleteMany).mockResolvedValue({ count: 0 });

    await POST(req("http://localhost/api/exclusions", "POST", {
      type: "SENDER",
      value: "SPAM@EXAMPLE.COM",
    }));

    expect(prisma.userExclusion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: "spam@example.com" }),
      })
    );
  });

  it("supprime les actions existantes lors d'une exclusion SENDER et retourne le count", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.create).mockResolvedValue(mockExclusion as any);
    vi.mocked(prisma.action.deleteMany).mockResolvedValue({ count: 3 });

    const res = await POST(req("http://localhost/api/exclusions", "POST", {
      type: "SENDER",
      value: "spam@example.com",
    }));
    const data = await res.json();

    expect(data.deletedActions).toBe(3);
    expect(prisma.action.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user123",
          OR: [
            { emailFrom: { equals: "spam@example.com", mode: "insensitive" } },
            { emailFrom: { contains: "<spam@example.com>", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("supprime les actions par domaine pour une exclusion DOMAIN", async () => {
    const domainExclusion = { ...mockExclusion, type: "DOMAIN", value: "spam.com" };
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.create).mockResolvedValue(domainExclusion as any);
    vi.mocked(prisma.action.deleteMany).mockResolvedValue({ count: 5 });

    const res = await POST(req("http://localhost/api/exclusions", "POST", {
      type: "DOMAIN",
      value: "spam.com",
    }));
    const data = await res.json();

    expect(data.deletedActions).toBe(5);
    expect(prisma.action.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { emailFrom: { endsWith: "@spam.com", mode: "insensitive" } },
            { emailFrom: { contains: "@spam.com>", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("normalise la valeur en minuscules pour SUBJECT", async () => {
    const subjectExclusion = { ...mockExclusion, type: "SUBJECT", value: "promotion" };
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.create).mockResolvedValue(subjectExclusion as any);

    await POST(req("http://localhost/api/exclusions", "POST", {
      type: "SUBJECT",
      value: "PROMOTION",
    }));

    expect(prisma.userExclusion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: "promotion" }),
      })
    );
  });

  it("retourne 400 si la valeur ne contient que des espaces", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const res = await POST(req("http://localhost/api/exclusions", "POST", { type: "SUBJECT", value: "   " }));
    expect(res.status).toBe(400);
  });

  it("ne supprime pas d'actions pour une exclusion SUBJECT", async () => {
    const subjectExclusion = { ...mockExclusion, type: "SUBJECT", value: "promotion" };
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.create).mockResolvedValue(subjectExclusion as any);

    await POST(req("http://localhost/api/exclusions", "POST", {
      type: "SUBJECT",
      value: "promotion",
    }));

    expect(prisma.action.deleteMany).not.toHaveBeenCalled();
  });

  it("retourne 409 si l'exclusion existe déjà (P2002)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    vi.mocked(prisma.userExclusion.create).mockRejectedValue(p2002);

    const res = await POST(req("http://localhost/api/exclusions", "POST", {
      type: "SENDER",
      value: "spam@example.com",
    }));

    expect(res.status).toBe(409);
  });
});

// ============================================================================
// DELETE /api/exclusions/[id]
// ============================================================================

describe("DELETE /api/exclusions/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const res = await DELETE(req("http://localhost/api/exclusions/excl1", "DELETE"), {
      params: Promise.resolve({ id: "excl1" }),
    });
    expect(res.status).toBe(401);
  });

  it("supprime l'exclusion et retourne 200", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.delete).mockResolvedValue(mockExclusion as any);

    const res = await DELETE(req("http://localhost/api/exclusions/excl1", "DELETE"), {
      params: Promise.resolve({ id: "excl1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.userExclusion.delete).toHaveBeenCalledWith({
      where: { id: "excl1", userId: "user123" },
    });
  });

  it("retourne 404 si l'exclusion n'existe pas (P2025)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const p2025 = Object.assign(new Error("Record not found"), { code: "P2025" });
    vi.mocked(prisma.userExclusion.delete).mockRejectedValue(p2025);

    const res = await DELETE(req("http://localhost/api/exclusions/inexistant", "DELETE"), {
      params: Promise.resolve({ id: "inexistant" }),
    });

    expect(res.status).toBe(404);
  });

  it("scoping sécurité : userId est toujours inclus dans le where", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.userExclusion.delete).mockResolvedValue(mockExclusion as any);

    await DELETE(req("http://localhost/api/exclusions/excl1", "DELETE"), {
      params: Promise.resolve({ id: "excl1" }),
    });

    expect(prisma.userExclusion.delete).toHaveBeenCalledWith({
      where: { id: "excl1", userId: "user123" },
    });
  });
});
