/**
 * Tests pour POST /api/auth/verify-email
 */

import { POST } from "@/app/api/auth/verify-email/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// $transaction is mocked in setup.ts as: (ops) => Promise.all(ops)

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validToken = "a".repeat(64);
const futureDate = new Date(Date.now() + 60 * 60 * 1000); // +1h
const pastDate = new Date(Date.now() - 60 * 60 * 1000);   // -1h

const mockRecord = {
  identifier: "user@example.com",
  token: validToken,
  expires: futureDate,
};

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 400 si le token est absent", async () => {
    const req = createPostRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("devrait retourner 400 si le token n'existe pas en base", async () => {
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(null);

    const req = createPostRequest({ token: validToken });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalide|utilisé/i);
  });

  it("devrait retourner 400 si le token est expiré et le supprimer", async () => {
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue({
      ...mockRecord,
      expires: pastDate,
    });
    vi.mocked(prisma.verificationToken.delete).mockResolvedValue(mockRecord);

    const req = createPostRequest({ token: validToken });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/expiré/i);
    // Le token expiré doit être supprimé
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: validToken },
    });
  });

  it("devrait vérifier l'email et supprimer le token si le token est valide", async () => {
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(mockRecord);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.verificationToken.delete).mockResolvedValue(mockRecord);

    const req = createPostRequest({ token: validToken });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // emailVerified doit être mis à jour
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: mockRecord.identifier },
        data: expect.objectContaining({ emailVerified: expect.any(Date) }),
      })
    );
    // Le token doit être supprimé
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: validToken },
    });
  });

  it("devrait exécuter user.update et token.delete dans une transaction atomique", async () => {
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(mockRecord);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    vi.mocked(prisma.verificationToken.delete).mockResolvedValue(mockRecord);

    await POST(createPostRequest({ token: validToken }));

    // Les deux opérations sont passées à $transaction
    expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.verificationToken.delete).toHaveBeenCalledTimes(1);
  });
});
