import { GET as GET_STATUS } from "@/app/api/microsoft-graph/status/route";
import { POST as POST_DISCONNECT } from "@/app/api/microsoft-graph/disconnect/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env.mjs", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    MICROSOFT_CLIENT_ID: "test-client-id",
    MICROSOFT_CLIENT_SECRET: "test-client-secret",
    MICROSOFT_TENANT_ID: "consumers",
  },
}));

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function createMockRequest(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const mockSession = { user: { id: "user123", email: "test@example.com" }, expires: "2099-01-01" };

const mockMailbox = {
  id: "mailbox1",
  label: null,
  email: "user@outlook.com",
  isConnected: true,
  connectionError: null,
  lastSync: new Date("2026-03-10T08:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/microsoft-graph/status
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/microsoft-graph/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const res = await GET_STATUS(createMockRequest("http://localhost:3000/api/microsoft-graph/status"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("retourne la liste des boîtes actives de l'utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([mockMailbox] as any);

    const res = await GET_STATUS(createMockRequest("http://localhost:3000/api/microsoft-graph/status"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mailboxes).toHaveLength(1);
    expect(data.mailboxes[0].email).toBe("user@outlook.com");
    expect(data.mailboxes[0].isConnected).toBe(true);

    // Vérifie que seules les boîtes actives de l'utilisateur sont retournées
    expect(prisma.microsoftGraphMailbox.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user123", isActive: true },
      })
    );
  });

  it("retourne une liste vide si aucune boîte configurée", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([]);

    const res = await GET_STATUS(createMockRequest("http://localhost:3000/api/microsoft-graph/status"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mailboxes).toHaveLength(0);
  });

  it("retourne plusieurs boîtes si l'utilisateur en a plusieurs", async () => {
    const secondMailbox = { ...mockMailbox, id: "mailbox2", email: "other@hotmail.com" };
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([mockMailbox, secondMailbox] as any);

    const res = await GET_STATUS(createMockRequest("http://localhost:3000/api/microsoft-graph/status"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mailboxes).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/microsoft-graph/disconnect
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/microsoft-graph/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const res = await POST_DISCONNECT(
      createMockRequest("http://localhost:3000/api/microsoft-graph/disconnect", "POST", { mailboxId: "mailbox1" })
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("retourne 400 si mailboxId manquant", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const res = await POST_DISCONNECT(
      createMockRequest("http://localhost:3000/api/microsoft-graph/disconnect", "POST", {})
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("mailboxId is required");
  });

  it("retourne 404 si la boîte n'appartient pas à l'utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.microsoftGraphMailbox.deleteMany).mockResolvedValue({ count: 0 });

    const res = await POST_DISCONNECT(
      createMockRequest("http://localhost:3000/api/microsoft-graph/disconnect", "POST", { mailboxId: "mailbox-other" })
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Mailbox not found");
  });

  it("supprime la boîte et retourne success", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.microsoftGraphMailbox.deleteMany).mockResolvedValue({ count: 1 });

    const res = await POST_DISCONNECT(
      createMockRequest("http://localhost:3000/api/microsoft-graph/disconnect", "POST", { mailboxId: "mailbox1" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Vérifie que la suppression est scopée à l'utilisateur
    expect(prisma.microsoftGraphMailbox.deleteMany).toHaveBeenCalledWith({
      where: { id: "mailbox1", userId: "user123" },
    });
  });
});
