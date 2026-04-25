/**
 * GET /api/email/[id]/body
 *
 * Récupère le corps d'un email pour visualisation live missing-action.
 * Cf. ADR-006 (ownership 404 + RGPD + cache TTL 5min + DOMPurify).
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createAllEmailProviders } from "@/lib/email-provider/factory";
import {
  getCachedBody,
  setCachedBody,
  type CachedMimeType,
} from "@/lib/email-body-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 50_000;
const CACHE_CONTROL = "private, max-age=300, must-revalidate";

type RouteContext = { params: Promise<{ id: string }> };

interface BodyResponse {
  body: string;
  truncated: boolean;
  mimeType: CachedMimeType;
}

interface EmailMeta {
  id: string;
  userId: string;
  emailProvider: string | null;
  mailboxId: string | null;
  gmailMessageId: string | null;
  imapUID: bigint | null;
}

/**
 * Détecte si une chaîne est probablement du HTML (heuristique simple).
 */
function looksLikeHtml(body: string): boolean {
  return /<\w+[\s>/]/.test(body);
}

/**
 * Sanitize un body HTML via DOMPurify avec config restrictive.
 *
 * Import dynamique pour éviter l'évaluation du module pendant le `next build`
 * page-data collection (isomorphic-dompurify charge un CSS au top-level
 * qui n'est pas disponible avant le first request).
 */
async function sanitizeHtml(html: string): Promise<string> {
  const { default: DOMPurify } = await import("isomorphic-dompurify");
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "div",
      "span",
      "a",
      "ul",
      "ol",
      "li",
      "b",
      "strong",
      "i",
      "em",
      "code",
      "pre",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
    ],
    ALLOWED_ATTR: ["href", "title"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Récupère le messageId à passer au provider selon le type de mailbox.
 */
function getProviderMessageId(meta: EmailMeta): string | bigint | null {
  if (meta.gmailMessageId) return meta.gmailMessageId;
  if (meta.imapUID) return meta.imapUID;
  return null;
}

async function fetchBodyFromProviders(
  userId: string,
  meta: EmailMeta
): Promise<{ body: string; mimeType: CachedMimeType } | { error: "TOKEN_EXPIRED" }> {
  const providers = await createAllEmailProviders(userId);

  // Filtrer par mailboxId si présent (sinon, tenter tous)
  const candidates = meta.mailboxId
    ? providers.filter((p) => p.mailboxId === meta.mailboxId)
    : providers;
  const targets = candidates.length > 0 ? candidates : providers;

  const messageId = getProviderMessageId(meta);
  if (messageId === null) {
    return { body: "", mimeType: "text/plain" };
  }

  for (const provider of targets) {
    try {
      const raw = await provider.getEmailBodyForAnalysis(messageId);
      if (raw === null || raw === undefined) continue;

      const mimeType: CachedMimeType = looksLikeHtml(raw) ? "text/html" : "text/plain";
      return { body: raw, mimeType };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "TOKEN_EXPIRED"
      ) {
        return { error: "TOKEN_EXPIRED" };
      }
      // Autres erreurs : on tente le provider suivant
    }
  }

  return { body: "", mimeType: "text/plain" };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id } = await ctx.params;

    // Ownership check (404 si introuvable OU pas owner — anti-enumeration)
    const meta = (await prisma.emailMetadata.findUnique({
      where: { id, userId },
    })) as EmailMeta | null;

    if (!meta) {
      return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    }

    // Cache hit ?
    const cached = getCachedBody(userId, id);
    if (cached) {
      const payload: BodyResponse = {
        body: cached.body,
        truncated: cached.truncated,
        mimeType: cached.mimeType,
      };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": CACHE_CONTROL },
      });
    }

    // Fetch via provider
    const fetched = await fetchBodyFromProviders(userId, meta);
    if ("error" in fetched) {
      return NextResponse.json(
        { error: "Token expiré, reconnectez votre boîte mail" },
        { status: 503 }
      );
    }

    let { body } = fetched;
    const { mimeType } = fetched;
    const truncated = body.length > MAX_BODY_BYTES;
    if (truncated) {
      body = body.slice(0, MAX_BODY_BYTES);
    }

    if (mimeType === "text/html") {
      body = await sanitizeHtml(body);
    }

    setCachedBody(userId, id, { body, mimeType, truncated });

    const payload: BodyResponse = { body, truncated, mimeType };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (error) {
    console.error("[EmailBody] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
