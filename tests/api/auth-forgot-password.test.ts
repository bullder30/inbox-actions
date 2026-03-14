/**
 * Tests pour POST /api/auth/forgot-password et POST /api/auth/reset-password
 */

import { POST as POST_FORGOT } from "@/app/api/auth/forgot-password/route";
import { POST as POST_RESET } from "@/app/api/auth/reset-password/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// Mock Resend
vi.mock("@/lib/email", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "email-id-123" }, error: null }),
    },
  },
}));

// Mock bcryptjs hash
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed_password"),
  compare: vi.fn(),
}));

import { resend } from "@/lib/email";

function createPostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const futureDate = new Date(Date.now() + 60 * 60 * 1000); // +1h
const pastDate = new Date(Date.now() - 60 * 60 * 1000);   // -1h

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 400 pour un email invalide", async () => {
    const req = createPostRequest("http://localhost:3000/api/auth/forgot-password", {
      email: "not-an-email",
    });
    const res = await POST_FORGOT(req);
    expect(res.status).toBe(400);
  });

  it("devrait retourner 200 même si l'email n'existe pas (anti-énumération)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createPostRequest("http://localhost:3000/api/auth/forgot-password", {
      email: "inconnu@example.com",
    });
    const res = await POST_FORGOT(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // Aucun email envoyé
    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it("devrait retourner 200 sans envoyer d'email si l'utilisateur n'a pas de mot de passe (OAuth uniquement)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: null,
    } as any);

    const req = createPostRequest("http://localhost:3000/api/auth/forgot-password", {
      email: "oauth@example.com",
    });
    const res = await POST_FORGOT(req);
    expect(res.status).toBe(200);
    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it("devrait créer un token et envoyer un email pour un utilisateur credentials valide", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      password: "hashed",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = createPostRequest("http://localhost:3000/api/auth/forgot-password", {
      email: "user@example.com",
    });
    const res = await POST_FORGOT(req);
    expect(res.status).toBe(200);

    // Le token doit être sauvegardé
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user123" },
        data: expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpiry: expect.any(Date),
        }),
      })
    );
    // L'email doit être envoyé
    expect(resend.emails.send).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/reset-password", () => {
  const resetToken = "b".repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devrait retourner 400 si le token est absent", async () => {
    const req = createPostRequest("http://localhost:3000/api/auth/reset-password", {
      password: "newpassword",
    });
    const res = await POST_RESET(req);
    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 si le mot de passe est trop court", async () => {
    const req = createPostRequest("http://localhost:3000/api/auth/reset-password", {
      token: resetToken,
      password: "abc",
    });
    const res = await POST_RESET(req);
    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 si le token n'existe pas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createPostRequest("http://localhost:3000/api/auth/reset-password", {
      token: resetToken,
      password: "newpassword123",
    });
    const res = await POST_RESET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalide|expiré/i);
  });

  it("devrait retourner 400 si le token est expiré", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      passwordResetExpiry: pastDate,
    } as any);

    const req = createPostRequest("http://localhost:3000/api/auth/reset-password", {
      token: resetToken,
      password: "newpassword123",
    });
    const res = await POST_RESET(req);
    expect(res.status).toBe(400);
  });

  it("devrait mettre à jour le mot de passe et effacer le token si valide", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user123",
      passwordResetExpiry: futureDate,
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = createPostRequest("http://localhost:3000/api/auth/reset-password", {
      token: resetToken,
      password: "newpassword123",
    });
    const res = await POST_RESET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user123" },
        data: expect.objectContaining({
          password: "hashed_password",
          passwordResetToken: null,
          passwordResetExpiry: null,
        }),
      })
    );
  });
});
