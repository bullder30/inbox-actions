import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { dashboardTag } from "@/lib/cache/dashboard";
import { prisma } from "@/lib/db";
import { getEndOfTodayParis, getStartOfTodayParis } from "@/lib/utils/date-paris";

export const dynamic = "force-dynamic";

/**
 * POST /api/actions/:id/schedule
 * Planifie une action à une date donnée (isScheduled=true si date future, false si aujourd'hui)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
    }
    const { dueDate } = body;

    if (!dueDate) {
      return NextResponse.json({ error: "dueDate requis" }, { status: 400 });
    }

    const parsedDate = new Date(dueDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "dueDate invalide" }, { status: 400 });
    }

    // Sécurité : refuser les dates strictement avant aujourd'hui (borne Paris)
    if (parsedDate < getStartOfTodayParis()) {
      return NextResponse.json({ error: "dueDate ne peut pas être dans le passé" }, { status: 400 });
    }

    const existingAction = await prisma.action.findUnique({ where: { id } });

    if (!existingAction) {
      return NextResponse.json({ error: "Action non trouvée" }, { status: 404 });
    }

    if (existingAction.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (existingAction.status === "DONE" || existingAction.status === "IGNORED") {
      return NextResponse.json(
        { error: "Impossible de planifier une action terminée ou ignorée" },
        { status: 400 }
      );
    }

    // Aujourd'hui → isScheduled: false (visible dans "Aujourd'hui")
    // Date future → isScheduled: true (visible dans "À venir" jusqu'à la date)
    const isScheduledFuture = parsedDate > getEndOfTodayParis();

    const updatedAction = await prisma.action.update({
      where: { id },
      data: {
        status: "TODO",
        isScheduled: isScheduledFuture,
        dueDate: parsedDate,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    revalidateTag(dashboardTag(session.user.id));

    return NextResponse.json({
      action: {
        ...updatedAction,
        imapUID: updatedAction.imapUID?.toString() ?? null,
      },
      message: isScheduledFuture
        ? "Action planifiée"
        : "Échéance définie pour aujourd'hui",
    });
  } catch (error) {
    console.error("Error scheduling action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la planification" },
      { status: 500 }
    );
  }
}
