import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ActionType } from "@prisma/client";

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
        status: "TODO",
      },
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    console.error("Error creating manual action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'action" },
      { status: 500 }
    );
  }
}
