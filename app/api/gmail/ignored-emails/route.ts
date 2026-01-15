import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer les emails analysés
    const analyzedEmails = await prisma.emailMetadata.findMany({
      where: {
        userId: user.id,
        status: "ANALYZED",
      },
      orderBy: {
        receivedAt: "desc",
      },
      select: {
        id: true,
        gmailMessageId: true,
        from: true,
        subject: true,
        snippet: true,
        receivedAt: true,
      },
    });

    // Vérifier quels emails ont des actions
    const actions = await prisma.action.findMany({
      where: {
        userId: user.id,
        gmailMessageId: {
          in: analyzedEmails.map((e) => e.gmailMessageId),
        },
      },
      select: {
        gmailMessageId: true,
      },
    });

    const emailsWithActions = new Set(
      actions.map((a) => a.gmailMessageId).filter((id): id is string => id !== null)
    );

    // Filtrer pour ne garder que les emails sans actions (ignorés)
    const ignoredEmails = analyzedEmails
      .filter((email) => !emailsWithActions.has(email.gmailMessageId))
      .map((email) => ({
        ...email,
        hasActions: false,
        reason: "Aucune action détectée",
      }));

    return NextResponse.json({ emails: ignoredEmails });
  } catch (error) {
    console.error("Error fetching ignored emails:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des emails" },
      { status: 500 }
    );
  }
}
