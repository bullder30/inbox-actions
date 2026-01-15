import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ActionStatus, ActionType } from "@prisma/client";

/**
 * GET /api/actions
 * Récupère la liste des actions de l'utilisateur connecté
 * Query params optionnels:
 * - status: TODO | DONE | IGNORED
 * - type: SEND | CALL | FOLLOW_UP | PAY | VALIDATE
 */
export async function GET(req: NextRequest) {
  try {
    // Vérification de l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupération des query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    // Construction du filtre
    const where: any = {
      userId: session.user.id, // Sécurité: on ne récupère QUE les actions de l'utilisateur
    };

    if (status && ["TODO", "DONE", "IGNORED"].includes(status)) {
      where.status = status as ActionStatus;
    }

    if (type && ["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"].includes(type)) {
      where.type = type as ActionType;
    }

    // Récupération des actions
    const actions = await prisma.action.findMany({
      where,
      orderBy: [
        { status: "asc" }, // TODO d'abord
        { dueDate: "asc" }, // Puis par date d'échéance
        { createdAt: "desc" }, // Puis les plus récentes
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      actions,
      count: actions.length,
    });
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des actions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/actions
 * Crée une nouvelle action
 * Body:
 * - title: string (requis)
 * - type: ActionType (requis)
 * - sourceSentence: string (requis)
 * - emailFrom: string (requis)
 * - emailReceivedAt: Date (requis)
 * - dueDate?: Date (optionnel)
 * - status?: ActionStatus (optionnel, défaut: TODO)
 */
export async function POST(req: NextRequest) {
  try {
    // Vérification de l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validation simple des champs requis
    const { title, type, sourceSentence, emailFrom, emailReceivedAt, dueDate, status } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Le titre est requis" },
        { status: 400 }
      );
    }

    if (!type || !["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"].includes(type)) {
      return NextResponse.json(
        { error: "Type d'action invalide (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)" },
        { status: 400 }
      );
    }

    if (!sourceSentence || typeof sourceSentence !== "string") {
      return NextResponse.json(
        { error: "La phrase source est requise" },
        { status: 400 }
      );
    }

    if (!emailFrom || typeof emailFrom !== "string") {
      return NextResponse.json(
        { error: "L'email de l'expéditeur est requis" },
        { status: 400 }
      );
    }

    if (!emailReceivedAt) {
      return NextResponse.json(
        { error: "La date de réception de l'email est requise" },
        { status: 400 }
      );
    }

    // Validation du statut si fourni
    if (status && !["TODO", "DONE", "IGNORED"].includes(status)) {
      return NextResponse.json(
        { error: "Statut invalide (TODO, DONE, IGNORED)" },
        { status: 400 }
      );
    }

    // Création de l'action
    const action = await prisma.action.create({
      data: {
        userId: session.user.id, // Sécurité: l'action est liée à l'utilisateur connecté
        title: title.trim(),
        type: type as ActionType,
        status: (status as ActionStatus) || "TODO",
        sourceSentence,
        emailFrom,
        emailReceivedAt: new Date(emailReceivedAt),
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      { action, message: "Action créée avec succès" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'action" },
      { status: 500 }
    );
  }
}
