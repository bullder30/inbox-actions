import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/actions/[id]/schedule/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Les mocks globaux (@/auth, @/lib/db) sont fournis par tests/setup.ts

function createScheduleRequest(id: string, body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/actions/${id}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const mockUser = { id: "user123", email: "test@example.com" };
const mockSession = { user: mockUser, expires: "2099-01-01" };

const futureDateISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // +7j

const mockAction = {
  id: "action123",
  userId: "user123",
  title: "Test Action",
  type: "SEND",
  status: "TODO",
  dueDate: null,
  sourceSentence: "Merci d'envoyer le rapport.",
  emailFrom: "sender@example.com",
  emailReceivedAt: new Date("2024-01-15T10:00:00Z"),
  imapUID: null,
  emailWebUrl: null,
  mailboxId: null,
  mailboxLabel: null,
  gmailMessageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: mockUser,
};

const params = Promise.resolve({ id: "action123" });

describe("POST /api/actions/:id/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authentification ─────────────────────────────────────────────────────

  it("devrait retourner 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = createScheduleRequest("action123", { dueDate: futureDateISO });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Non authentifié");
  });

  // ── Validation des inputs ────────────────────────────────────────────────

  it("devrait retourner 400 si dueDate manquant", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const req = createScheduleRequest("action123", {});
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("dueDate requis");
  });

  it("devrait retourner 400 si dueDate invalide", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const req = createScheduleRequest("action123", { dueDate: "pas-une-date" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("dueDate invalide");
  });

  it("devrait retourner 400 si body invalide (JSON parse error)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const req = new NextRequest("http://localhost:3000/api/actions/action123/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Corps de requête invalide");
  });

  // ── Autorisation ─────────────────────────────────────────────────────────

  it("devrait retourner 404 si l'action n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue(null);

    const req = createScheduleRequest("action123", { dueDate: futureDateISO });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Action non trouvée");
  });

  it("devrait retourner 403 si l'action appartient à un autre utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      ...mockAction,
      userId: "autre-user",
    } as any);

    const req = createScheduleRequest("action123", { dueDate: futureDateISO });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Accès non autorisé");
  });

  // ── Succès ───────────────────────────────────────────────────────────────

  it("devrait planifier l'action avec isScheduled=true et dueDate future", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue(mockAction as any);
    vi.mocked(prisma.action.update).mockResolvedValue({
      ...mockAction,
      status: "TODO",
      isScheduled: true,
      dueDate: new Date(futureDateISO),
      user: mockUser,
    } as any);

    const req = createScheduleRequest("action123", { dueDate: futureDateISO });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Action planifiée");
    expect(prisma.action.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "action123" },
        data: expect.objectContaining({
          status: "TODO",
          isScheduled: true,
          dueDate: expect.any(Date),
        }),
      })
    );
  });

  it("devrait replanifier une action déjà planifiée (isScheduled=true)", async () => {
    const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue({
      ...mockAction,
      status: "TODO",
      isScheduled: true,
      dueDate: new Date(futureDateISO),
    } as any);
    vi.mocked(prisma.action.update).mockResolvedValue({
      ...mockAction,
      status: "TODO",
      isScheduled: true,
      dueDate: new Date(newDate),
      user: mockUser,
    } as any);

    const req = createScheduleRequest("action123", { dueDate: newDate });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBe("Action planifiée");
  });

  it("ne devrait pas exposer l'imapUID BigInt en JSON", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.findUnique).mockResolvedValue(mockAction as any);
    vi.mocked(prisma.action.update).mockResolvedValue({
      ...mockAction,
      status: "TODO",
      isScheduled: true,
      dueDate: new Date(futureDateISO),
      imapUID: BigInt(12345),
      user: mockUser,
    } as any);

    const req = createScheduleRequest("action123", { dueDate: futureDateISO });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    // imapUID doit être converti en string, pas BigInt
    expect(typeof data.action.imapUID).toBe("string");
    expect(data.action.imapUID).toBe("12345");
  });
});
