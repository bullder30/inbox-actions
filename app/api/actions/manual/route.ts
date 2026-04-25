import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentUser } from "@/lib/session";
import { dashboardTag } from "@/lib/cache/dashboard";
import { prisma } from "@/lib/db";
import { ActionType } from "@prisma/client";
import { nameToSlug } from "@/lib/slug";
import { isCustomActionColor } from "@/lib/custom-action-colors";
import {
  MAX_TYPES_PER_USER,
  normalizeKeywords,
  validateKeywords,
} from "@/lib/custom-action-types/validation";
import {
  LIMIT_REACHED_ERROR,
  handleCreateCustomTypeError,
} from "@/lib/custom-action-types/errors";

export const dynamic = "force-dynamic";

const NATIVE_TYPES = ["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"] as const;
const MAX_KEYWORDS_PER_RULE = 50;

type ManualBody = {
  title?: string;
  type?: string;
  sourceSentence?: string;
  emailFrom?: string;
  emailReceivedAt?: string;
  gmailMessageId?: string;
  imapUID?: string;
  emailWebUrl?: string;
  // Custom variants
  customTypeId?: string;
  customTypeName?: string;
  customTypeColor?: string;
  persistAsRule?: boolean;
  keywords?: string[];
};

/**
 * Sérialise une Action Prisma pour la réponse JSON (BigInt imapUID → string).
 */
function serializeAction(action: { imapUID: bigint | null }): Record<string, unknown> {
  return { ...action, imapUID: action.imapUID?.toString() ?? null };
}

/**
 * Invalide le cache dashboard pour l'utilisateur courant après une mutation Action.
 */
function invalidateDashboardCache(userId: string): void {
  revalidatePath("/dashboard");
  revalidateTag(dashboardTag(userId));
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = (await request.json()) as ManualBody;
    const {
      title,
      type,
      sourceSentence,
      emailFrom,
      emailReceivedAt,
      gmailMessageId,
      imapUID: imapUIDStr,
      emailWebUrl,
      customTypeId,
      customTypeName,
      customTypeColor,
      persistAsRule,
      keywords,
    } = body;

    // Champs communs requis
    if (!title || !type || !sourceSentence || !emailFrom || !emailReceivedAt) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    // Vérifier la validité du type
    const isNative = (NATIVE_TYPES as readonly string[]).includes(type);
    const isCustom = type === "CUSTOM";
    if (!isNative && !isCustom) {
      return NextResponse.json({ error: "Type d'action invalide" }, { status: 400 });
    }

    // Convertir imapUID string → BigInt
    let imapUID: bigint | null = null;
    if (imapUIDStr) {
      try {
        imapUID = BigInt(imapUIDStr);
      } catch {
        return NextResponse.json({ error: "imapUID invalide" }, { status: 400 });
      }
    }

    const userId: string = user.id;

    const baseData = {
      userId,
      title,
      sourceSentence,
      emailFrom,
      emailReceivedAt: new Date(emailReceivedAt),
      gmailMessageId: gmailMessageId || null,
      imapUID,
      emailWebUrl: emailWebUrl || null,
      status: "TODO" as const,
    };

    // ─── Cas natif (inchangé) ───────────────────────────────────────────────
    if (isNative) {
      const action = await prisma.action.create({
        data: { ...baseData, type: type as ActionType },
      });
      invalidateDashboardCache(user.id);
      return NextResponse.json({ action: serializeAction(action) }, { status: 201 });
    }

    // ─── Cas CUSTOM ──────────────────────────────────────────────────────────

    // Cas A : customTypeId fourni → utiliser un type existant
    if (customTypeId) {
      const existingType = await prisma.customActionType.findUnique({
        where: { id: customTypeId },
      });
      if (!existingType) {
        return NextResponse.json({ error: "Type custom introuvable" }, { status: 404 });
      }
      if (existingType.userId !== user.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const action = await prisma.action.create({
        data: {
          ...baseData,
          type: "CUSTOM" as ActionType,
          customTypeId: existingType.id,
          customTypeLabel: existingType.name,
          customTypeColor: existingType.color,
        },
      });
      invalidateDashboardCache(user.id);
      return NextResponse.json({ action: serializeAction(action) }, { status: 201 });
    }

    // Cas B / Cas C : customTypeName + customTypeColor obligatoires
    if (!customTypeName || typeof customTypeName !== "string" || !customTypeName.trim()) {
      return NextResponse.json(
        { error: "customTypeName requis pour un type CUSTOM" },
        { status: 422 }
      );
    }
    if (!customTypeColor || !isCustomActionColor(customTypeColor)) {
      return NextResponse.json(
        { error: "customTypeColor invalide" },
        { status: 422 }
      );
    }

    // Cas B : persistAsRule = true → créer le type ET l'action en transaction
    if (persistAsRule === true) {
      const rawKeywords = Array.isArray(keywords) ? keywords : [];
      if (rawKeywords.length === 0 || rawKeywords.length > MAX_KEYWORDS_PER_RULE) {
        return NextResponse.json(
          { error: `Liste de keywords invalide (1-${MAX_KEYWORDS_PER_RULE})` },
          { status: 422 }
        );
      }

      const invalid = validateKeywords(rawKeywords);
      if (invalid) {
        return NextResponse.json(
          { error: "Mots-clés invalides", invalidKeywords: invalid },
          { status: 422 }
        );
      }

      const slug = nameToSlug(customTypeName);
      const finalKeywords = normalizeKeywords(rawKeywords);

      // Atomique : count + create type + create action dans la même transaction.
      // Évite la race condition limite 10 et garantit le rollback si échec.
      try {
        const result = await prisma.$transaction(async (tx) => {
          const existingCount = await tx.customActionType.count({ where: { userId } });
          if (existingCount >= MAX_TYPES_PER_USER) {
            throw new Error(LIMIT_REACHED_ERROR);
          }
          const newType = await tx.customActionType.create({
            data: {
              userId,
              name: customTypeName,
              slug,
              keywords: finalKeywords,
              color: customTypeColor,
            },
          });
          const newAction = await tx.action.create({
            data: {
              ...baseData,
              type: "CUSTOM" as ActionType,
              customTypeId: newType.id,
              customTypeLabel: newType.name,
              customTypeColor: newType.color,
            },
          });
          return { newType, newAction };
        });

        invalidateDashboardCache(user.id);
        return NextResponse.json(
          {
            action: serializeAction(result.newAction),
            createdCustomType: result.newType,
          },
          { status: 201 }
        );
      } catch (txErr: unknown) {
        const mapped = handleCreateCustomTypeError(txErr);
        if (mapped) return mapped;
        throw txErr;
      }
    }

    // Cas C : persistAsRule = false (défaut) → action ponctuelle, pas de type créé
    const action = await prisma.action.create({
      data: {
        ...baseData,
        type: "CUSTOM" as ActionType,
        customTypeId: null,
        customTypeLabel: customTypeName,
        customTypeColor,
      },
    });
    invalidateDashboardCache(user.id);
    return NextResponse.json({ action: serializeAction(action) }, { status: 201 });
  } catch (error) {
    console.error("Error creating manual action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'action" },
      { status: 500 }
    );
  }
}
