/**
 * API Route: Setup IMAP with OAuth2
 * POST /api/imap/setup-oauth
 *
 * Automatically configures IMAP for users who authenticated with OAuth
 * (Microsoft Entra ID or Google)
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasOAuthCredentials, getOAuthAccessToken } from "@/lib/imap/oauth-token";
import { IMAP_PRESETS } from "@/lib/imap/types";
import { encryptPassword } from "@/lib/imap/imap-credentials";

export const dynamic = "force-dynamic";

interface SetupOAuthRequest {
  provider: "microsoft-entra-id" | "google";
}

export async function POST(req: NextRequest) {
  console.log("[IMAP Setup OAuth] POST request received");

  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      console.log("[IMAP Setup OAuth] No session or user");
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    console.log(`[IMAP Setup OAuth] User: ${session.user.email}, ID: ${session.user.id}`);

    const body: SetupOAuthRequest = await req.json();
    const { provider } = body;
    console.log(`[IMAP Setup OAuth] Provider: ${provider}`);

    if (!provider || !["microsoft-entra-id", "google"].includes(provider)) {
      return NextResponse.json(
        { error: "Provider invalide. Utilisez 'microsoft-entra-id' ou 'google'" },
        { status: 400 }
      );
    }

    // Check if user has OAuth credentials for this provider
    console.log(`[IMAP Setup OAuth] Checking for OAuth credentials...`);
    const hasCredentials = await hasOAuthCredentials(session.user.id, provider);
    console.log(`[IMAP Setup OAuth] Has credentials: ${hasCredentials}`);

    if (!hasCredentials) {
      return NextResponse.json(
        { error: `Aucun compte ${provider} lié à votre profil` },
        { status: 400 }
      );
    }

    // Get the account to check scopes
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider },
      select: { scope: true, access_token: true, refresh_token: true, expires_at: true },
    });
    console.log(`[IMAP Setup OAuth] Account scopes: ${account?.scope}`);
    console.log(`[IMAP Setup OAuth] Has access_token: ${!!account?.access_token}`);
    console.log(`[IMAP Setup OAuth] Has refresh_token: ${!!account?.refresh_token}`);
    console.log(`[IMAP Setup OAuth] Token expires_at: ${account?.expires_at}`);

    // Check if IMAP scope is present
    if (provider === "microsoft-entra-id") {
      const hasImapScope = account?.scope?.includes("IMAP.AccessAsUser.All");
      console.log(`[IMAP Setup OAuth] Has IMAP scope: ${hasImapScope}`);
      if (!hasImapScope) {
        console.warn(`[IMAP Setup OAuth] WARNING: IMAP.AccessAsUser.All scope may be missing!`);
      }
    }

    // Verify we can get an access token
    console.log(`[IMAP Setup OAuth] Getting OAuth access token...`);
    const accessToken = await getOAuthAccessToken(session.user.id, provider);
    if (!accessToken) {
      console.error(`[IMAP Setup OAuth] Failed to get access token`);
      return NextResponse.json(
        { error: `Impossible de récupérer le token OAuth pour ${provider}. Vérifiez les scopes IMAP dans Azure.` },
        { status: 400 }
      );
    }
    console.log(`[IMAP Setup OAuth] Got access token, length: ${accessToken.length}`);

    // Get IMAP preset for provider
    const presetKey = provider === "microsoft-entra-id" ? "outlook" : "gmail";
    const preset = IMAP_PRESETS[presetKey];

    if (!preset) {
      return NextResponse.json(
        { error: `Configuration IMAP non disponible pour ${provider}` },
        { status: 400 }
      );
    }

    // Check if IMAP credential already exists
    const existingCredential = await prisma.iMAPCredential.findFirst({
      where: {
        userId: session.user.id,
        imapHost: preset.host,
        imapUsername: session.user.email,
      },
    });

    let credentialId: string;

    if (existingCredential) {
      console.log(`[IMAP Setup OAuth] Updating existing credential: ${existingCredential.id}`);
      // Update existing credential to use OAuth2
      await prisma.iMAPCredential.update({
        where: { id: existingCredential.id },
        data: {
          useOAuth2: true,
          oauthProvider: provider,
          imapPassword: encryptPassword("oauth2"), // Placeholder
          isConnected: false,
          connectionError: null,
        },
      });
      credentialId = existingCredential.id;
    } else {
      console.log(`[IMAP Setup OAuth] Creating new credential`);
      // Create new IMAP credential with OAuth2
      const credential = await prisma.iMAPCredential.create({
        data: {
          userId: session.user.id,
          imapHost: preset.host,
          imapPort: preset.port,
          imapUsername: session.user.email,
          imapPassword: encryptPassword("oauth2"), // Placeholder - not used with OAuth2
          imapFolder: "INBOX",
          useTLS: preset.useTLS,
          useOAuth2: true,
          oauthProvider: provider,
          isConnected: false,
        },
      });
      credentialId = credential.id;
    }

    // Update user's email provider
    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailProvider: "IMAP" },
    });

    // Test the connection
    console.log(`[IMAP Setup OAuth] Testing IMAP connection...`);
    let connectionTest = { success: false, error: "" };
    try {
      const { createIMAPService } = await import("@/lib/imap/imap-service");
      const imapService = await createIMAPService(session.user.id);
      if (imapService) {
        const connected = await imapService.testConnection();
        connectionTest.success = connected;
        if (!connected) {
          connectionTest.error = "Test de connexion échoué";
        }
        console.log(`[IMAP Setup OAuth] Connection test result: ${connected}`);
      } else {
        connectionTest.error = "Impossible de créer le service IMAP";
        console.error(`[IMAP Setup OAuth] Failed to create IMAP service`);
      }
    } catch (testError) {
      connectionTest.error = testError instanceof Error ? testError.message : "Erreur inconnue";
      console.error(`[IMAP Setup OAuth] Connection test error:`, testError);
    }

    return NextResponse.json({
      success: true,
      message: existingCredential
        ? "Configuration IMAP OAuth2 mise à jour"
        : "Configuration IMAP OAuth2 créée",
      credentialId,
      config: {
        host: preset.host,
        port: preset.port,
        username: session.user.email,
        useOAuth2: true,
        provider: provider,
      },
      connectionTest,
    });
  } catch (error) {
    console.error("[IMAP Setup OAuth] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la configuration IMAP OAuth2" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/imap/setup-oauth
 * Check if OAuth IMAP setup is available for the current user
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

    // Check which OAuth providers are available
    const providers: { provider: string; available: boolean; name: string }[] = [];

    // Check Microsoft
    const hasMicrosoft = await hasOAuthCredentials(
      session.user.id,
      "microsoft-entra-id"
    );
    providers.push({
      provider: "microsoft-entra-id",
      available: hasMicrosoft,
      name: "Microsoft 365 / Outlook",
    });

    // Check Google
    const hasGoogle = await hasOAuthCredentials(session.user.id, "google");
    providers.push({
      provider: "google",
      available: hasGoogle,
      name: "Gmail",
    });

    // Check existing IMAP credential
    const existingCredential = await prisma.iMAPCredential.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        useOAuth2: true,
        oauthProvider: true,
        imapHost: true,
      },
    });

    return NextResponse.json({
      providers,
      existingCredential: existingCredential
        ? {
            id: existingCredential.id,
            useOAuth2: existingCredential.useOAuth2,
            oauthProvider: existingCredential.oauthProvider,
            host: existingCredential.imapHost,
          }
        : null,
    });
  } catch (error) {
    console.error("[IMAP Setup OAuth] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification OAuth" },
      { status: 500 }
    );
  }
}
