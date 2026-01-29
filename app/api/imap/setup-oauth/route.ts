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
  try {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body: SetupOAuthRequest = await req.json();
    const { provider } = body;

    if (!provider || !["microsoft-entra-id", "google"].includes(provider)) {
      return NextResponse.json(
        { error: "Provider invalide. Utilisez 'microsoft-entra-id' ou 'google'" },
        { status: 400 }
      );
    }

    // Check if user has OAuth credentials for this provider
    const hasCredentials = await hasOAuthCredentials(session.user.id, provider);
    if (!hasCredentials) {
      return NextResponse.json(
        { error: `Aucun compte ${provider} lié à votre profil` },
        { status: 400 }
      );
    }

    // Verify we can get an access token
    const accessToken = await getOAuthAccessToken(session.user.id, provider);
    if (!accessToken) {
      return NextResponse.json(
        { error: `Impossible de récupérer le token OAuth pour ${provider}` },
        { status: 400 }
      );
    }

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

    if (existingCredential) {
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

      // Update user's email provider
      await prisma.user.update({
        where: { id: session.user.id },
        data: { emailProvider: "IMAP" },
      });

      return NextResponse.json({
        success: true,
        message: "Configuration IMAP OAuth2 mise à jour",
        credentialId: existingCredential.id,
      });
    }

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

    // Update user's email provider
    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailProvider: "IMAP" },
    });

    return NextResponse.json({
      success: true,
      message: "Configuration IMAP OAuth2 créée",
      credentialId: credential.id,
      config: {
        host: preset.host,
        port: preset.port,
        username: session.user.email,
        useOAuth2: true,
        provider: provider,
      },
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
