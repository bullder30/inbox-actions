/**
 * GET /api/microsoft-graph/callback
 * OAuth callback for Microsoft Graph email connection.
 * Stores tokens directly in MicrosoftGraphMailbox (independent of Auth.js Account).
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { env } from "@/env.mjs";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

const STATE_COOKIE = "microsoft_graph_oauth_state";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", env.NEXT_PUBLIC_APP_URL));
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      console.error("[Graph Callback] OAuth error:", error, errorDescription);
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "microsoft_oauth_failed");
      redirectUrl.searchParams.set("error_description", errorDescription || error);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state) {
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "missing_params");
      return NextResponse.redirect(redirectUrl);
    }

    // Verify CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE)?.value;

    if (!storedState || storedState !== state) {
      console.error("[Graph Callback] State mismatch");
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "state_mismatch");
      return NextResponse.redirect(redirectUrl);
    }

    cookieStore.delete(STATE_COOKIE);

    // Exchange code for tokens
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/microsoft-graph/callback`;
    const tokenUrl = `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.MICROSOFT_CLIENT_ID!,
        client_secret: env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: ["openid", "email", "profile", "offline_access", "https://graph.microsoft.com/Mail.Read"].join(" "),
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Graph Callback] Token exchange failed:", errorData);
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "token_exchange_failed");
      return NextResponse.redirect(redirectUrl);
    }

    const tokens = await tokenResponse.json();

    // Extract Microsoft account ID and email from id_token
    let microsoftAccountId: string | null = null;
    let userEmail: string | null = null;

    if (tokens.id_token) {
      try {
        const [, payload] = tokens.id_token.split(".");
        const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
        microsoftAccountId = decoded.oid || decoded.sub;
        userEmail = decoded.email || decoded.preferred_username;
      } catch (e) {
        console.error("[Graph Callback] Failed to decode id_token:", e);
      }
    }

    // Fallback: fetch from Graph API if id_token decode failed
    if (!microsoftAccountId) {
      const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meResponse.ok) {
        const meData = await meResponse.json();
        microsoftAccountId = meData.id;
        userEmail = meData.mail || meData.userPrincipalName;
      }
    }

    if (!microsoftAccountId) {
      console.error("[Graph Callback] Could not determine Microsoft account ID");
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "user_id_not_found");
      return NextResponse.redirect(redirectUrl);
    }

    // Vérifier que ce compte Microsoft n'est pas déjà utilisé par un autre utilisateur
    const takenByOther = await prisma.microsoftGraphMailbox.findFirst({
      where: { microsoftAccountId, userId: { not: session.user.id } },
    });
    if (takenByOther) {
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "microsoft_oauth_failed");
      redirectUrl.searchParams.set("error_description", "Ce compte Microsoft est déjà utilisé par un autre compte.");
      return NextResponse.redirect(redirectUrl);
    }

    const expiresAt = tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : null;

    // Upsert MicrosoftGraphMailbox — tokens are stored here, not in Account
    await prisma.microsoftGraphMailbox.upsert({
      where: {
        userId_microsoftAccountId: {
          userId: session.user.id,
          microsoftAccountId,
        },
      },
      create: {
        userId: session.user.id,
        microsoftAccountId,
        email: userEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        tokenScope: tokens.scope,
        isActive: true,
        isConnected: true,
      },
      update: {
        email: userEmail ?? undefined,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt,
        tokenScope: tokens.scope,
        isActive: true,
        isConnected: true,
        connectionError: null,
        lastErrorAt: null,
      },
    });

    console.log(`[Graph Callback] Microsoft Graph mailbox upserted for user ${session.user.id} (microsoftAccountId: ${microsoftAccountId})`);

    const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set("microsoft_connected", "true");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("[Graph Callback] Error:", error);
    const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set("error", "callback_error");
    return NextResponse.redirect(redirectUrl);
  }
}
