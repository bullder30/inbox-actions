import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/actions/:id
 * Récupère les détails d'une action
 */
export async function GET(
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

    // Récupérer l'action avec les informations de l'utilisateur
    const action = await prisma.action.findUnique({
      where: { id },
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

    if (!action) {
      return NextResponse.json(
        { error: "Action non trouvée" },
        { status: 404 }
      );
    }

    // Sécurité: vérifier que l'action appartient bien à l'utilisateur
    if (action.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    return NextResponse.json(action);
  } catch (error) {
    console.error("Error fetching action:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'action" },
      { status: 500 }
    );
  }
}
