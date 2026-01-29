import { GET, POST } from "@/app/api/actions/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
import { POST as POST_DONE } from "@/app/api/actions/[id]/done/route";
import { POST as POST_IGNORE } from "@/app/api/actions/[id]/ignore/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Créer une requête mock
function createMockRequest(
  url: string,
  method: string = "GET",
  body?: any
): NextRequest {
  const request = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
    },
  });
  return request;
}

// Mock data
const mockUser = {
  id: "user123",
  email: "test@example.com",
  name: "Test User",
};

const mockSession = {
  user: mockUser,
  expires: "2024-12-31",
};

const mockAction = {
  id: "action123",
  userId: "user123",
  title: "Test Action",
  type: "SEND",
  status: "TODO",
  sourceSentence: "Test sentence",
  emailFrom: "sender@example.com",
  emailReceivedAt: new Date("2024-01-15T10:00:00Z"),
  dueDate: new Date("2024-01-20T17:00:00Z"),
  createdAt: new Date("2024-01-15T10:05:00Z"),
  updatedAt: new Date("2024-01-15T10:05:00Z"),
  user: mockUser,
};

describe("API Actions - GET /api/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = createMockRequest("http://localhost:3000/api/actions");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Non authentifié");
  });

  it("devrait retourner la liste des actions de l'utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findMany).mockResolvedValue([mockAction] as any);

    const req = createMockRequest("http://localhost:3000/api/actions");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.actions).toHaveLength(1);
    expect(data.count).toBe(1);
    expect(data.actions[0].title).toBe("Test Action");

    // Vérifier que le filtre userId est appliqué
    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user123",
        }),
      })
    );
  });

  it("devrait filtrer par status TODO", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findMany).mockResolvedValue([mockAction] as any);

    const req = createMockRequest("http://localhost:3000/api/actions?status=TODO");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user123",
          status: "TODO",
        }),
      })
    );
  });

  it("devrait filtrer par type CALL", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findMany).mockResolvedValue([] as any);

    const req = createMockRequest("http://localhost:3000/api/actions?type=CALL");
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user123",
          type: "CALL",
        }),
      })
    );
  });

  it("devrait ignorer les filtres invalides", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findMany).mockResolvedValue([] as any);

    const req = createMockRequest("http://localhost:3000/api/actions?status=INVALID");
    const response = await GET(req);

    expect(response.status).toBe(200);
    // Le filtre invalide ne devrait pas être appliqué
    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user123",
        }),
      })
    );
  });
});

describe("API Actions - POST /api/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = createMockRequest("http://localhost:3000/api/actions", "POST", {
      title: "Test",
      type: "SEND",
      sourceSentence: "Test",
      emailFrom: "test@test.com",
      emailReceivedAt: new Date(),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Non authentifié");
  });

  it("devrait créer une action avec les champs requis", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.create).mockResolvedValue(mockAction as any);

    const newAction = {
      title: "Nouvelle action",
      type: "SEND",
      sourceSentence: "Pourrais-tu m'envoyer le rapport ?",
      emailFrom: "boss@company.com",
      emailReceivedAt: "2024-01-15T10:00:00Z",
      dueDate: "2024-01-20T17:00:00Z",
    };

    const req = createMockRequest("http://localhost:3000/api/actions", "POST", newAction);
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.message).toBe("Action créée avec succès");
    expect(data.action).toBeDefined();

    // Vérifier que l'action est créée avec le bon userId
    expect(prisma.action.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user123",
          title: "Nouvelle action",
          type: "SEND",
        }),
      })
    );
  });

  it("devrait retourner 400 si le titre est manquant", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const req = createMockRequest("http://localhost:3000/api/actions", "POST", {
      type: "SEND",
      sourceSentence: "Test",
      emailFrom: "test@test.com",
      emailReceivedAt: new Date(),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Le titre est requis");
  });

  it("devrait retourner 400 si le type est invalide", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const req = createMockRequest("http://localhost:3000/api/actions", "POST", {
      title: "Test",
      type: "INVALID_TYPE",
      sourceSentence: "Test",
      emailFrom: "test@test.com",
      emailReceivedAt: new Date(),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Type d'action invalide");
  });

  it("devrait retourner 400 si sourceSentence est manquant", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const req = createMockRequest("http://localhost:3000/api/actions", "POST", {
      title: "Test",
      type: "SEND",
      emailFrom: "test@test.com",
      emailReceivedAt: new Date(),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("La phrase source est requise");
  });
});

describe("API Actions - POST /api/actions/:id/done", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = createMockRequest("http://localhost:3000/api/actions/action123/done", "POST");
    const response = await POST_DONE(req, { params: Promise.resolve({ id: "action123" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Non authentifié");
  });

  it("devrait marquer l'action comme DONE", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue(mockAction as any);
    vi.mocked(prisma.action.update).mockResolvedValue({
      ...mockAction,
      status: "DONE",
    } as any);

    const req = createMockRequest("http://localhost:3000/api/actions/action123/done", "POST");
    const response = await POST_DONE(req, { params: Promise.resolve({ id: "action123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Action marquée comme terminée");
    expect(data.action.status).toBe("DONE");

    // Vérifier que le statut est bien mis à DONE
    expect(prisma.action.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "action123" },
        data: { status: "DONE" },
      })
    );
  });

  it("devrait retourner 403 si l'action appartient à un autre utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      ...mockAction,
      userId: "otheruser456",
    } as any);

    const req = createMockRequest("http://localhost:3000/api/actions/action123/done", "POST");
    const response = await POST_DONE(req, { params: Promise.resolve({ id: "action123" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Accès non autorisé");
  });
});

describe("API Actions - POST /api/actions/:id/ignore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = createMockRequest("http://localhost:3000/api/actions/action123/ignore", "POST");
    const response = await POST_IGNORE(req, { params: Promise.resolve({ id: "action123" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Non authentifié");
  });

  it("devrait marquer l'action comme IGNORED", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue(mockAction as any);
    vi.mocked(prisma.action.update).mockResolvedValue({
      ...mockAction,
      status: "IGNORED",
    } as any);

    const req = createMockRequest("http://localhost:3000/api/actions/action123/ignore", "POST");
    const response = await POST_IGNORE(req, { params: Promise.resolve({ id: "action123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Action marquée comme ignorée");
    expect(data.action.status).toBe("IGNORED");

    // Vérifier que le statut est bien mis à IGNORED
    expect(prisma.action.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "action123" },
        data: { status: "IGNORED" },
      })
    );
  });
});

