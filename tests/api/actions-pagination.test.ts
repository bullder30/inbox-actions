/**
 * Tests pour GET /api/actions avec pagination (limit/offset)
 */

import { GET } from "@/app/api/actions/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/actions");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString());
}

const mockSession = { user: { id: "user123", email: "test@example.com" }, expires: "2099-01-01" };

function makeAction(id: string) {
  return {
    id,
    userId: "user123",
    title: `Action ${id}`,
    type: "SEND",
    status: "TODO",
    dueDate: null,
    sourceSentence: "phrase source",
    emailFrom: "sender@example.com",
    emailReceivedAt: new Date("2026-03-13T10:00:00Z"),
    gmailMessageId: null,
    imapUID: null,
    emailWebUrl: null,
    mailboxId: null,
    mailboxLabel: null,
    createdAt: new Date("2026-03-13T10:00:00Z"),
    updatedAt: new Date("2026-03-13T10:00:00Z"),
    user: { id: "user123", email: "test@example.com" },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/actions — pagination
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/actions (pagination)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("retourne la première page avec hasMore=false quand tout tient dans la page", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const actions = [makeAction("a1"), makeAction("a2")];
    vi.mocked(prisma.action.count).mockResolvedValue(2);
    vi.mocked(prisma.action.findMany).mockResolvedValue(actions as any);

    const res = await GET(createGetRequest({ limit: "20", offset: "0" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.actions).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.hasMore).toBe(false);
  });

  it("retourne hasMore=true quand il reste des pages", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const actions = Array.from({ length: 20 }, (_, i) => makeAction(`a${i}`));
    vi.mocked(prisma.action.count).mockResolvedValue(35);
    vi.mocked(prisma.action.findMany).mockResolvedValue(actions as any);

    const res = await GET(createGetRequest({ limit: "20", offset: "0" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.actions).toHaveLength(20);
    expect(data.total).toBe(35);
    expect(data.hasMore).toBe(true);
  });

  it("retourne hasMore=false sur la dernière page", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const actions = Array.from({ length: 15 }, (_, i) => makeAction(`a${i}`));
    vi.mocked(prisma.action.count).mockResolvedValue(35);
    vi.mocked(prisma.action.findMany).mockResolvedValue(actions as any);

    const res = await GET(createGetRequest({ limit: "20", offset: "20" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasMore).toBe(false); // offset(20) + limit(20) = 40 >= total(35)
  });

  it("passe skip et take corrects à Prisma", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.count).mockResolvedValue(100);
    vi.mocked(prisma.action.findMany).mockResolvedValue([]);

    await GET(createGetRequest({ limit: "10", offset: "30" }));

    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30, take: 10 })
    );
  });

  it("applique le filtre status en combinaison avec la pagination", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.count).mockResolvedValue(5);
    vi.mocked(prisma.action.findMany).mockResolvedValue([]);

    await GET(createGetRequest({ status: "DONE", limit: "20", offset: "0" }));

    expect(prisma.action.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "DONE", userId: "user123" }) })
    );
  });

  it("plafonne limit à 100 même si la requête demande plus", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.action.count).mockResolvedValue(0);
    vi.mocked(prisma.action.findMany).mockResolvedValue([]);

    await GET(createGetRequest({ limit: "9999" }));

    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("sérialise imapUID BigInt en string", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const actionWithBigInt = { ...makeAction("a1"), imapUID: BigInt("123456789") };
    vi.mocked(prisma.action.count).mockResolvedValue(1);
    vi.mocked(prisma.action.findMany).mockResolvedValue([actionWithBigInt] as any);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(data.actions[0].imapUID).toBe("123456789");
  });
});
