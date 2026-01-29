import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEmailProvider } from "@/lib/email-provider/factory";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/pending-count
 * Récupère le nombre de nouveaux emails non synchronisés (Gmail ou IMAP)
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

    // Créer le provider email (Gmail ou IMAP selon la config utilisateur)
    const emailProvider = await createEmailProvider(session.user.id);

    if (!emailProvider) {
      return NextResponse.json({
        count: 0,
        connected: false,
      });
    }

    // Compter les nouveaux emails
    const count = await emailProvider.countNewEmails();

    return NextResponse.json({
      count,
      connected: true,
      provider: emailProvider.providerType,
    });
  } catch (error) {
    console.error("Error getting pending count:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du compte" },
      { status: 500 }
    );
  }
}
