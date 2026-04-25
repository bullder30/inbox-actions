import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentUser } from "@/lib/session";
import { dashboardTag } from "@/lib/cache/dashboard";
import { prisma } from "@/lib/db";
import { ActionType } from "@prisma/client";
import { nameToSlug } from "@/lib/slug";
import { FRENCH_STOPLIST } from "@/lib/stoplist-fr";
import { isCustomActionColor } from "@/lib/custom-action-colors";

export const dynamic = "force-dynamic";

const NATIVE_TYPES = ["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"] as const;
const MAX_TYPES_PER_USER = 10;
const MIN_KEYWORD_LENGTH = 4;
const MAX_KEYWORD_LENGTH = 60;

function validateKeywords(rawKeywords: string[]): string[] | null {
  const invalid: string[] = [];
  const deduped = Array.from(
    new Set(rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0))
  );

  for (const keyword of deduped) {
    const lower = keyword.toLowerCase();
    const isAllLowercase = keyword === lower;

    if (keyword.length > MAX_KEYWORD_LENGTH) {
      invalid.push(keyword);
      continue;
    }
    if (keyword.length < MIN_KEYWORD_LENGTH && isAllLowercase) {
      invalid.push(keyword);
      continue;
    }
    if (FRENCH_STOPLIST.has(lower)) {
      invalid.push(keyword);
    }
  }

  return invalid.length > 0 ? invalid : null;
}

function normalizeKeywords(rawKeywords: string[]): string[] {
  return Array.from(
    new Set(rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0))
  );
}

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
      revalidatePath("/dashboard");
      revalidateTag(dashboardTag(user.id));
      return NextResponse.json(
        { action: { ...action, imapUID: action.imapUID?.toString() ?? null } },
        { status: 201 }
      );
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
      revalidatePath("/dashboard");
      revalidateTag(dashboardTag(user.id));
      return NextResponse.json(
        { action: { ...action, imapUID: action.imapUID?.toString() ?? null } },
        { status: 201 }
      );
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
      if (rawKeywords.length === 0 || rawKeywords.length > 50) {
        return NextResponse.json(
          { error: "Liste de keywords invalide (1-50)" },
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

      const existingCount = await prisma.customActionType.count({
        where: { userId },
      });
      if (existingCount >= MAX_TYPES_PER_USER) {
        return NextResponse.json(
          { error: `Vous avez atteint la limite de ${MAX_TYPES_PER_USER} types personnalisés` },
          { status: 400 }
        );
      }

      const slug = nameToSlug(customTypeName);
      const finalKeywords = normalizeKeywords(rawKeywords);

      try {
        const result = await prisma.$transaction(async (tx) => {
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

        revalidatePath("/dashboard");
        revalidateTag(dashboardTag(user.id));
        return NextResponse.json(
          {
            action: {
              ...result.newAction,
              imapUID: result.newAction.imapUID?.toString() ?? null,
            },
            createdCustomType: result.newType,
          },
          { status: 201 }
        );
      } catch (txErr: unknown) {
        if (
          txErr instanceof Error &&
          "code" in txErr &&
          (txErr as { code: string }).code === "P2002"
        ) {
          return NextResponse.json(
            { error: "Un type avec un nom équivalent existe déjà" },
            { status: 409 }
          );
        }
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
    revalidatePath("/dashboard");
    revalidateTag(dashboardTag(user.id));
    return NextResponse.json(
      { action: { ...action, imapUID: action.imapUID?.toString() ?? null } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating manual action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'action" },
      { status: 500 }
    );
  }
}
