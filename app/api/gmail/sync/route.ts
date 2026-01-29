import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEmailProvider } from "@/lib/email-provider/factory";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/sync
 * Synchronise les emails depuis le dernier scan (Gmail ou IMAP)
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

    console.debug("[SYNC] Session userId:", session.user.id, "email:", session.user.email);

    // Créer le provider email (Gmail ou IMAP selon la config utilisateur)
    const emailProvider = await createEmailProvider(session.user.id);

    if (!emailProvider) {
      return NextResponse.json(
        {
          error: "Email non connecté ou le token a expiré",
          message: "Veuillez vous (re)connecter pour activer la synchronisation",
          code: "EMAIL_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    // Options de synchronisation
    const { searchParams } = new URL(req.url);
    const maxResultsParam = searchParams.get("maxResults");
    const maxResults = maxResultsParam ? parseInt(maxResultsParam) : undefined;

    // Récupérer les nouveaux emails
    const emails = await emailProvider.fetchNewEmails({
      maxResults,
      folder: "INBOX",
    });

    return NextResponse.json({
      success: true,
      count: emails.length,
      provider: emailProvider.providerType,
      emails: emails.map((email) => ({
        id: email.gmailMessageId || email.imapUID?.toString(),
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        receivedAt: email.receivedAt,
        labels: email.labels,
      })),
      message: `${emails.length} nouveau(x) email(s) synchronisé(s)`,
    });
  } catch (error) {
    console.error("Error syncing emails:", error);

    // Gérer les erreurs spécifiques
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        return NextResponse.json(
          {
            error: "Token expiré",
            message: "Veuillez vous reconnecter",
            code: "TOKEN_EXPIRED",
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: "Erreur lors de la synchronisation des emails" },
      { status: 500 }
    );
  }
}
