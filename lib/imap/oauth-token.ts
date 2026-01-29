/**
 * OAuth Token Management for IMAP XOAUTH2
 * Handles token retrieval and refresh for Microsoft and Google OAuth
 */

import { prisma } from "@/lib/db";

interface OAuthToken {
  accessToken: string;
  expiresAt: number | null;
}

/**
 * Get the OAuth access token for a user from a specific provider
 * Refreshes the token if expired
 */
export async function getOAuthAccessToken(
  userId: string,
  provider: string
): Promise<string | null> {
  try {
    // Get the account for this provider
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider,
      },
      select: {
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });

    if (!account || !account.access_token) {
      console.error(`[OAuth] No ${provider} account found for user ${userId}`);
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = account.expires_at || 0;
    const isExpired = expiresAt > 0 && expiresAt - 300 < now;

    if (isExpired && account.refresh_token) {
      console.log(`[OAuth] Token expired for ${provider}, refreshing...`);
      const newToken = await refreshOAuthToken(
        userId,
        provider,
        account.refresh_token
      );
      return newToken;
    }

    return account.access_token;
  } catch (error) {
    console.error(`[OAuth] Error getting access token for ${provider}:`, error);
    return null;
  }
}

/**
 * Refresh an OAuth access token
 */
async function refreshOAuthToken(
  userId: string,
  provider: string,
  refreshToken: string
): Promise<string | null> {
  try {
    let tokenUrl: string;
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (provider === "microsoft-entra-id") {
      const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
      tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      clientId = process.env.MICROSOFT_CLIENT_ID;
      clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    } else if (provider === "google") {
      tokenUrl = "https://oauth2.googleapis.com/token";
      clientId = process.env.GOOGLE_CLIENT_ID;
      clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    } else {
      console.error(`[OAuth] Unsupported provider: ${provider}`);
      return null;
    }

    if (!clientId || !clientSecret) {
      console.error(`[OAuth] Missing credentials for ${provider}`);
      return null;
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[OAuth] Token refresh failed for ${provider}:`, error);
      return null;
    }

    const data = await response.json();

    // Update the token in database
    await prisma.account.updateMany({
      where: {
        userId,
        provider,
      },
      data: {
        access_token: data.access_token,
        expires_at: data.expires_in
          ? Math.floor(Date.now() / 1000) + data.expires_in
          : null,
        // Some providers return a new refresh token
        ...(data.refresh_token && { refresh_token: data.refresh_token }),
      },
    });

    console.log(`[OAuth] Token refreshed successfully for ${provider}`);
    return data.access_token;
  } catch (error) {
    console.error(`[OAuth] Error refreshing token for ${provider}:`, error);
    return null;
  }
}

/**
 * Generate XOAUTH2 token for IMAP authentication
 * Format: base64("user=" + email + "^Aauth=Bearer " + accessToken + "^A^A")
 */
export function generateXOAuth2Token(email: string, accessToken: string): string {
  const authString = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
  return Buffer.from(authString).toString("base64");
}

/**
 * Check if a user has OAuth credentials for a provider
 */
export async function hasOAuthCredentials(
  userId: string,
  provider: string
): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider,
    },
    select: {
      access_token: true,
    },
  });

  return !!account?.access_token;
}
