/**
 * Tests pour GET /api/email/ignored-emails avec pagination (limit/offset)
 */

import { GET } from "@/app/api/email/ignored-emails/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/session";

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/email/ignored-emails");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

const mockUser = { id: "user123", email: "test@example.com" };

function makeEmailMetadata(id: string, gmailMessageId = `gmail-${id}`) {
  return {
    id,
    gmailMessageId,
    imapUID: null,
    from: `sender${id}@example.com`,
    subject: `Sujet ${id}`,
    snippet: `Extrait de l'email ${id}`,
    receivedAt: new Date("2026-03-12T10:00:00Z"),
    webUrl: null,
    mailboxId: null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/email/ignored-emails — pagination
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/email/ignored-emails (pagination)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as any);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("retourne une liste vide si aucun email analysé", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.emailMetadata.findMany).mockResolvedValue([]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emails).toHaveLength(0);
    expect(data.total).toBe(0);
    expect(data.hasMore).toBe(false);
  });

  it("retourne la première page avec hasMore=false quand tout tient", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const emails = [makeEmailMetadata("e1"), makeEmailMetadata("e2")];
    vi.mocked(prisma.emailMetadata.findMany).mockResolvedValue(emails as any);
    // Pas d'actions associées → tous les emails sont "ignorés"
    vi.mocked(prisma.action.findMany).mockResolvedValue([]);
    vi.mocked(prisma.iMAPCredential.findMany).mockResolvedValue([]);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([]);

    const res = await GET(createGetRequest({ limit: "20", offset: "0" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emails).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.hasMore).toBe(false);
  });

  it("pagine correctement et retourne hasMore=true", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    // 25 emails ignorés en base
    const allEmails = Array.from({ length: 25 }, (_, i) => makeEmailMetadata(`e${i}`));
    vi.mocked(prisma.emailMetadata.findMany).mockResolvedValue(allEmails as any);
    vi.mocked(prisma.action.findMany).mockResolvedValue([]);
    vi.mocked(prisma.iMAPCredential.findMany).mockResolvedValue([]);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([]);

    const res = await GET(createGetRequest({ limit: "20", offset: "0" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emails).toHaveLength(20);
    expect(data.total).toBe(25);
    expect(data.hasMore).toBe(true);
  });

  it("retourne hasMore=false sur la dernière page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const allEmails = Array.from({ length: 25 }, (_, i) => makeEmailMetadata(`e${i}`));
    vi.mocked(prisma.emailMetadata.findMany).mockResolvedValue(allEmails as any);
    vi.mocked(prisma.action.findMany).mockResolvedValue([]);
    vi.mocked(prisma.iMAPCredential.findMany).mockResolvedValue([]);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([]);

    const res = await GET(createGetRequest({ limit: "20", offset: "20" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.emails).toHaveLength(5);
    expect(data.total).toBe(25);
    expect(data.hasMore).toBe(false);
  });

  it("exclut les emails qui ont déjà une action associée", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    const emails = [
      makeEmailMetadata("e1", "gmail-e1"),
      makeEmailMetadata("e2", "gmail-e2"),
    ];
    vi.mocked(prisma.emailMetadata.findMany).mockResolvedValue(emails as any);
    // L'email e1 a déjà une action
    vi.mocked(prisma.action.findMany).mockResolvedValue([
      { gmailMessageId: "gmail-e1" },
    ] as any);
    vi.mocked(prisma.iMAPCredential.findMany).mockResolvedValue([]);
    vi.mocked(prisma.microsoftGraphMailbox.findMany).mockResolvedValue([]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    // Seul e2 est "ignoré" (e1 a une action)
    expect(data.emails).toHaveLength(1);
    expect(data.emails[0].gmailMessageId).toBe("gmail-e2");
    expect(data.total).toBe(1);
  });
});
