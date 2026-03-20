import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ActionStatus, ActionType } from "@prisma/client";
import { getEndOfTodayParis } from "@/lib/utils/date-paris";

export const dynamic = "force-dynamic";

/**
 * GET /api/actions
 * Récupère la liste des actions de l'utilisateur connecté
 * Query params optionnels:
 * - status: TODO | SCHEDULED | DONE | IGNORED
 * - type: SEND | CALL | FOLLOW_UP | PAY | VALIDATE
 * - limit: nombre d'actions par page (défaut: 20, max: 100)
 * - offset: décalage pour la pagination (défaut: 0)
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

    if (status === "SCHEDULED" || status === "TODO") {
      // Frontière jour : tout ce qui est planifié APRÈS aujourd'hui va dans Planifiées
      // Tout ce qui est pour aujourd'hui ou sans date va dans À faire
      const endOfToday = getEndOfTodayParis();

      if (status === "SCHEDULED") {
        // Planifiées : isScheduled=true ET dueDate strictement après aujourd'hui
        where.status = "TODO" as ActionStatus;
        where.isScheduled = true;
        where.dueDate = { gt: endOfToday };
      } else {
        // À faire : sans date, pour aujourd'hui, ou non planifiées manuellement
        where.status = "TODO" as ActionStatus;
        where.OR = [
          { isScheduled: false },
          { isScheduled: true, dueDate: null },
          { isScheduled: true, dueDate: { lte: endOfToday } },
        ];
      }
    } else if (status && ["DONE", "IGNORED"].includes(status)) {
      where.status = status as ActionStatus;
    }

    if (type && ["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"].includes(type)) {
      where.type = type as ActionType;
    }

    // Pagination
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 20 : rawLimit, 100);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset;

    const orderBy = [
      { status: "asc" as const },
      { dueDate: "asc" as const },
      { createdAt: "desc" as const },
    ];

    // Récupération du total + page en parallèle
    const [total, actions] = await Promise.all([
      prisma.action.count({ where }),
      prisma.action.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    // Convertir les BigInt en string pour la sérialisation JSON
    const serializedActions = actions.map((action) => ({
      ...action,
      imapUID: action.imapUID?.toString() ?? null,
    }));

    return NextResponse.json({
      actions: serializedActions,
      total,
      hasMore: offset + limit < total,
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
