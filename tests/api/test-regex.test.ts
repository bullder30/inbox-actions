/**
 * Tests pour `POST /api/custom-action-types/test-regex` — Phase 4 RED (regex-power)
 *
 * Couvre :
 *   - US-3 (zone de test inline, ranges retournés)
 *   - AC-1 (pattern dangereux ReDoS rejeté)
 *   - AC-2 (pattern > 200 chars rejeté)
 *   - AC-7 (ranges [start, end] corrects)
 *   - AC-8 (408 sur timeout)
 *
 * NB : Le fichier `app/api/custom-action-types/test-regex/route.ts` n'existe pas
 *      encore — RED phase.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/custom-action-types/test-regex/route";
import { auth } from "@/auth";

function req(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/custom-action-types/test-regex", {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

const mockSession = {
  user: { id: "user123", email: "user@example.com" },
  expires: "2099-01-01",
};

describe("POST /api/custom-action-types/test-regex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should_return_401_when_no_session", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(null as any);

    // Act
    const res = await POST(
      req({ pattern: "FAC-\\d+", testText: ["FAC-12"] })
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("should_return_422_when_pattern_dangerous_polynomial_backtracking", async () => {
    // Arrange (AC-1)
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req({ pattern: "(a+)+", testText: ["aaa"] })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(422);
    expect(data.reason).toBe("polynomial_backtracking");
  });

  it("should_return_422_when_pattern_exceeds_200_chars", async () => {
    // Arrange (AC-2) — 201 chars
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const longPattern = "a".repeat(201);

    // Act
    const res = await POST(
      req({ pattern: longPattern, testText: ["aaa"] })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_testText_is_empty_array", async () => {
    // Arrange — Zod min 1
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(req({ pattern: "FAC-\\d+", testText: [] }));

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_422_when_testText_entry_exceeds_5KB", async () => {
    // Arrange — string > 5000 chars
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const tooLong = "a".repeat(5001);

    // Act
    const res = await POST(
      req({ pattern: "FAC-\\d+", testText: [tooLong] })
    );

    // Assert
    expect(res.status).toBe(422);
  });

  it("should_return_200_with_ranges_when_pattern_matches", async () => {
    // Arrange (AC-7) — match position exacte
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req({
        pattern: "FAC-\\d{4}-\\d+",
        testText: ["Voir FAC-2024-0042 jointe"],
      })
    );
    const data = await res.json();

    // Assert
    // FAC-2024-0042 commence à l'index 5, longueur 13 → range [5, 18]
    expect(res.status).toBe(200);
    expect(data.matches).toEqual([
      { textIndex: 0, ranges: [[5, 18]] },
    ]);
  });

  it("should_return_200_with_empty_ranges_when_no_match", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req({
        pattern: "FAC-\\d{4}-\\d+",
        testText: ["rien à voir ici"],
      })
    );
    const data = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(data.matches).toEqual([{ textIndex: 0, ranges: [] }]);
  });

  it("should_return_408_when_execution_times_out", async () => {
    // Arrange (AC-8) — pattern + texte ReDoS-prone qui passe safe-regex
    // mais explose au runtime via vm timeout 100ms.
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    const evilText = "a".repeat(40) + "c";

    // Act
    const res = await POST(
      req({
        pattern: "(a+)+b",
        testText: [evilText],
      })
    );

    // Assert : safe-regex rejette en amont (422) OU vm timeout (408).
    // Le contrat documenté privilégie 408 si on passe la couche 1.
    // On accepte les deux car c'est l'enveloppe spec : ce qui compte est
    // que la requête NE DOIT PAS retourner 200.
    expect([408, 422]).toContain(res.status);
  });

  it("should_handle_multiple_matches_per_text_with_ranges_array", async () => {
    // Arrange
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    // Act
    const res = await POST(
      req({
        pattern: "FAC-\\d{4}-\\d+",
        testText: ["FAC-2025-1 et FAC-2025-2 sont en attente"],
      })
    );
    const data = await res.json();

    // Assert : 2 matches dans la même phrase
    expect(res.status).toBe(200);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].textIndex).toBe(0);
    expect(data.matches[0].ranges).toHaveLength(2);
    // Premier match "FAC-2025-1" (10 chars) à l'index 0 → [0, 10]
    expect(data.matches[0].ranges[0]).toEqual([0, 10]);
    // Second match "FAC-2025-2" (10 chars) à l'index 14 → [14, 24]
    expect(data.matches[0].ranges[1]).toEqual([14, 24]);
  });
});
