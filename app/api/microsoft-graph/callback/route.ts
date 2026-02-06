/**
 * GET /api/microsoft-graph/callback
 * OAuth callback for Microsoft Graph email connection
 * Exchanges code for tokens and stores them for the user
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { env } from "@/env.mjs";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

// OAuth state cookie name
const STATE_COOKIE = "microsoft_graph_oauth_state";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      // Redirect to login if not authenticated
      return NextResponse.redirect(new URL("/login", env.NEXT_PUBLIC_APP_URL));
    }

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors
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

    // Verify state for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE)?.value;

    if (!storedState || storedState !== state) {
      console.error("[Graph Callback] State mismatch");
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "state_mismatch");
      return NextResponse.redirect(redirectUrl);
    }

    // Clear state cookie
    cookieStore.delete(STATE_COOKIE);

    // Exchange code for tokens
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/microsoft-graph/callback`;
    const tokenUrl = `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.MICROSOFT_CLIENT_ID!,
        client_secret: env.MICROSOFT_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: [
          "openid",
          "email",
          "profile",
          "offline_access",
          "https://graph.microsoft.com/Mail.Read",
        ].join(" "),
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

    // Get user info from the id_token or access_token
    // We need the Microsoft user's ID (oid) to link the account
    let microsoftUserId: string | null = null;
    let userEmail: string | null = null;

    // Decode id_token to get user info (it's a JWT)
    if (tokens.id_token) {
      try {
        const [, payload] = tokens.id_token.split(".");
        const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
        microsoftUserId = decoded.oid || decoded.sub;
        userEmail = decoded.email || decoded.preferred_username;
      } catch (e) {
        console.error("[Graph Callback] Failed to decode id_token:", e);
      }
    }

    // If we couldn't get the ID from token, fetch user profile from Graph API
    if (!microsoftUserId) {
      const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        microsoftUserId = meData.id;
        userEmail = meData.mail || meData.userPrincipalName;
      }
    }

    if (!microsoftUserId) {
      console.error("[Graph Callback] Could not determine Microsoft user ID");
      const redirectUrl = new URL("/settings", env.NEXT_PUBLIC_APP_URL);
      redirectUrl.searchParams.set("error", "user_id_not_found");
      return NextResponse.redirect(redirectUrl);
    }

    // Check if user already has a Microsoft account linked
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "microsoft-entra-id",
      },
    });

    const expiresAt = tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : null;

    if (existingAccount) {
      // Update existing account with new tokens (including Mail.Read scope)
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || existingAccount.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          id_token: tokens.id_token,
          token_type: tokens.token_type,
        },
      });
      console.log("[Graph Callback] Updated existing Microsoft account with Mail.Read scope");
    } else {
      // Create new account link
      await prisma.account.create({
        data: {
          userId: session.user.id,
          type: "oauth",
          provider: "microsoft-entra-id",
          providerAccountId: microsoftUserId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          id_token: tokens.id_token,
          token_type: tokens.token_type,
        },
      });
      console.log("[Graph Callback] Created new Microsoft account link with Mail.Read scope");
    }

    // Automatically set Microsoft Graph as the email provider
    // AND disconnect IMAP (mutual exclusivity)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        emailProvider: "MICROSOFT_GRAPH",
      },
    });

    // Delete IMAP credentials (mutual exclusivity)
    await prisma.iMAPCredential.deleteMany({
      where: { userId: session.user.id },
    });
    console.log("[Graph Callback] IMAP credentials deleted (mutual exclusivity with Microsoft Graph)");

    // Redirect to settings with success
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
