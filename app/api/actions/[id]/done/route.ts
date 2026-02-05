import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/actions/:id/done
 * Marque une action comme terminée (DONE)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Vérification de l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier que l'action existe ET appartient à l'utilisateur
    const existingAction = await prisma.action.findUnique({
      where: { id },
    });

    if (!existingAction) {
      return NextResponse.json(
        { error: "Action non trouvée" },
        { status: 404 }
      );
    }

    // Sécurité: vérifier que l'action appartient bien à l'utilisateur
    if (existingAction.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Mettre à jour le statut à DONE
    const updatedAction = await prisma.action.update({
      where: { id },
      data: {
        status: "DONE",
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

    // Convertir BigInt en string pour la sérialisation JSON
    return NextResponse.json({
      action: {
        ...updatedAction,
        imapUID: updatedAction.imapUID?.toString() ?? null,
      },
      message: "Action marquée comme terminée",
    });
  } catch (error) {
    console.error("Error marking action as done:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'action" },
      { status: 500 }
    );
  }
}
