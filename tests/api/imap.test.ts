import { POST as POST_CONNECT } from "@/app/api/imap/connect/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Mock ImapFlow — on ne teste pas la connexion réseau ici
vi.mock("imapflow", () => ({
  ImapFlow: class {
    async connect() { return; }
    async logout() { return; }
  },
}));

// Mock encryption — retourne la valeur en clair pour simplifier les assertions
vi.mock("@/lib/imap/imap-credentials", () => ({
  encryptPassword: vi.fn((p: string) => `encrypted:${p}`),
  decryptPassword: vi.fn((p: string) => p.replace("encrypted:", "")),
}));

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/imap/connect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockSession = { user: { id: "user123", email: "test@example.com" }, expires: "2099-01-01" };

const validBody = {
  imapHost: "imap.gmail.com",
  imapPort: 993,
  imapUsername: "user@gmail.com",
  imapPassword: "app-password",
  imapFolder: "INBOX",
  useTLS: true,
};

const mockCredential = {
  id: "cred1",
  userId: "user123",
  imapHost: "imap.gmail.com",
  imapPort: 993,
  imapUsername: "user@gmail.com",
  imapPassword: "encrypted:app-password",
  imapFolder: "INBOX",
  useTLS: true,
  isConnected: true,
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/imap/connect
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/imap/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const res = await POST_CONNECT(createMockRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("retourne 400 si les champs requis sont manquants", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const res = await POST_CONNECT(createMockRequest({ imapHost: "imap.gmail.com" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("retourne 400 si imapUsername n'est pas un email valide", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const res = await POST_CONNECT(createMockRequest({ ...validBody, imapUsername: "not-an-email" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("retourne 409 si la boîte est déjà utilisée par un autre utilisateur", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.iMAPCredential.findFirst).mockResolvedValue({
      ...mockCredential,
      userId: "otheruser",
    } as any);

    const res = await POST_CONNECT(createMockRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe("Cette boîte mail est déjà utilisée par un autre compte.");

    // Vérifie que le check d'exclusivité est bien scopé (pas le même userId)
    expect(prisma.iMAPCredential.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          imapHost: "imap.gmail.com",
          imapUsername: "user@gmail.com",
          userId: { not: "user123" },
        }),
      })
    );
  });

  it("crée les credentials si la connexion réussit et qu'aucun conflit n'existe", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.iMAPCredential.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.iMAPCredential.upsert).mockResolvedValue(mockCredential as any);

    const res = await POST_CONNECT(createMockRequest(validBody));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.credentialId).toBe("cred1");

    expect(prisma.iMAPCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user123",
          imapHost: "imap.gmail.com",
          imapUsername: "user@gmail.com",
          isConnected: true,
        }),
      })
    );
  });

  it("met à jour les credentials existants lors d'un upsert", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.iMAPCredential.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.iMAPCredential.upsert).mockResolvedValue({
      ...mockCredential,
      imapPort: 993,
    } as any);

    const res = await POST_CONNECT(createMockRequest({ ...validBody, label: "Mon Gmail" }));
    await res.json();

    expect(res.status).toBe(200);
    expect(prisma.iMAPCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          label: "Mon Gmail",
          isConnected: true,
          connectionError: null,
        }),
      })
    );
  });
});
