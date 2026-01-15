import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";

/**
 * GET /api/gmail/sync
 * Synchronise les emails Gmail depuis le dernier scan
 * Stocke uniquement les métadonnées (RGPD compliant)
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

    // Créer le service Gmail
    const gmailService = await createGmailService(session.user.id);

    if (!gmailService) {
      return NextResponse.json(
        {
          error: "Gmail n'est pas connecté ou le token a expiré",
          message: "Veuillez vous (re)connecter avec Google pour activer la synchronisation Gmail",
          code: "GMAIL_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    // Options de synchronisation
    const { searchParams } = new URL(req.url);
    const maxResultsParam = searchParams.get("maxResults");
    const maxResults = maxResultsParam ? parseInt(maxResultsParam) : undefined; // Pas de limite par défaut
    const query = searchParams.get("query") || undefined;

    // Récupérer les nouveaux emails
    const emails = await gmailService.fetchNewEmails({
      maxResults,
      query,
      labelIds: ["INBOX"], // Seulement les emails dans INBOX
    });

    return NextResponse.json({
      success: true,
      count: emails.length,
      emails: emails.map((email) => ({
        id: email.gmailMessageId,
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        receivedAt: email.receivedAt,
        labels: email.labels,
      })),
      message: `${emails.length} nouveau(x) email(s) synchronisé(s)`,
    });
  } catch (error) {
    console.error("Error syncing Gmail:", error);

    // Gérer les erreurs spécifiques
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        return NextResponse.json(
          {
            error: "Token expiré",
            message: "Veuillez vous reconnecter à Gmail",
            code: "TOKEN_EXPIRED",
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Erreur lors de la synchronisation Gmail" },
      { status: 500 }
    );
  }
}
