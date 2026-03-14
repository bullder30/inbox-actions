import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAllEmailProviders } from "@/lib/email-provider/factory";

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

    // Créer tous les providers (multi-boîtes)
    const providers = await createAllEmailProviders(session.user.id);

    if (providers.length === 0) {
      return NextResponse.json({ count: 0, connected: false });
    }

    // Compter les nouveaux emails sur toutes les boîtes
    let count = 0;
    for (const provider of providers) {
      count += await provider.countNewEmails();
    }

    return NextResponse.json({ count, connected: true });
  } catch (error) {
    console.error("Error getting pending count:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du compte" },
      { status: 500 }
    );
  }
}
