import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { dashboardTag } from "@/lib/cache/dashboard";
import { prisma } from "@/lib/db";
import { ActionType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      type,
      sourceSentence,
      emailFrom,
      emailReceivedAt,
      gmailMessageId,
      imapUID: imapUIDStr,
      emailWebUrl,
    } = body;

    // Validation
    if (!title || !type || !sourceSentence || !emailFrom || !emailReceivedAt) {
      return NextResponse.json(
        { error: "Champs manquants" },
        { status: 400 }
      );
    }

    // Vérifier que le type est valide
    if (!["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"].includes(type)) {
      return NextResponse.json(
        { error: "Type d'action invalide" },
        { status: 400 }
      );
    }

    // Convertir imapUID string → BigInt (BigInt n'est pas sérialisable en JSON)
    let imapUID: bigint | null = null;
    if (imapUIDStr) {
      try {
        imapUID = BigInt(imapUIDStr);
      } catch {
        return NextResponse.json({ error: "imapUID invalide" }, { status: 400 });
      }
    }

    // Créer l'action
    const action = await prisma.action.create({
      data: {
        userId: user.id,
        title,
        type: type as ActionType,
        sourceSentence,
        emailFrom,
        emailReceivedAt: new Date(emailReceivedAt),
        gmailMessageId: gmailMessageId || null,
        imapUID,
        emailWebUrl: emailWebUrl || null,
        status: "TODO",
      },
    });

    revalidatePath("/dashboard");
    revalidateTag(dashboardTag(user.id));

    // Convertir BigInt en string pour la sérialisation JSON
    return NextResponse.json({
      action: {
        ...action,
        imapUID: action.imapUID?.toString() ?? null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating manual action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'action" },
      { status: 500 }
    );
  }
}
