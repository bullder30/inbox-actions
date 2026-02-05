/**
 * GET /api/microsoft-graph/connect
 * Initiates OAuth flow to connect Microsoft email with Mail.Read scope
 * This is separate from login - users can login with any provider and connect Microsoft email
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { env } from "@/env.mjs";
import { cookies } from "next/headers";

// OAuth state cookie name
const STATE_COOKIE = "microsoft_graph_oauth_state";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Microsoft OAuth is configured
    if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET || !env.MICROSOFT_TENANT_ID) {
      return NextResponse.json(
        { error: "Microsoft OAuth is not configured" },
        { status: 400 }
      );
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Build OAuth URL with Mail.Read scope
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/microsoft-graph/callback`;
    const scope = [
      "openid",
      "email",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Mail.Read",
    ].join(" ");

    const authUrl = new URL(
      `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`
    );
    authUrl.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_mode", "query");
    // prompt=consent ensures we get fresh consent for Mail.Read
    authUrl.searchParams.set("prompt", "consent");

    // Store state in cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    return NextResponse.json({
      authUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error("[Graph Connect] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate OAuth",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
