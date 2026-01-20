import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/pending-count
 * Récupère le nombre de nouveaux emails non synchronisés dans Gmail
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Créer le service Gmail
    const gmailService = await createGmailService(session.user.id);

    if (!gmailService) {
      return NextResponse.json({
        count: 0,
        connected: false,
      });
    }

    // Compter les nouveaux emails
    const count = await gmailService.countNewEmailsInGmail();

    return NextResponse.json({
      count,
      connected: true,
    });
  } catch (error) {
    console.error("Error getting pending count:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du compte" },
      { status: 500 }
    );
  }
}
