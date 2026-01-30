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
  console.log(`[OAuth] Getting access token for provider: ${provider}, userId: ${userId}`);

  try {
    // Get the account for this provider
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider,
      },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
        scope: true,
      },
    });

    if (!account) {
      console.error(`[OAuth] No ${provider} account found for user ${userId}`);
      return null;
    }

    console.log(`[OAuth] Found account: ${account.id}`);
    console.log(`[OAuth] Has access_token: ${!!account.access_token}`);
    console.log(`[OAuth] Has refresh_token: ${!!account.refresh_token}`);
    console.log(`[OAuth] Expires_at: ${account.expires_at}`);
    console.log(`[OAuth] Scopes: ${account.scope}`);

    if (!account.access_token) {
      console.error(`[OAuth] No access_token in ${provider} account for user ${userId}`);
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = account.expires_at || 0;
    const isExpired = expiresAt > 0 && expiresAt - 300 < now;

    console.log(`[OAuth] Now: ${now}, ExpiresAt: ${expiresAt}, IsExpired: ${isExpired}`);

    if (isExpired && account.refresh_token) {
      console.log(`[OAuth] Token expired for ${provider}, refreshing...`);
      const newToken = await refreshOAuthToken(
        userId,
        provider,
        account.refresh_token
      );
      if (newToken) {
        console.log(`[OAuth] Token refreshed successfully, length: ${newToken.length}`);
      } else {
        console.error(`[OAuth] Token refresh returned null`);
      }
      return newToken;
    }

    console.log(`[OAuth] Returning existing token, length: ${account.access_token.length}`);
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
  console.log(`[OAuth] Refreshing token for provider: ${provider}`);

  try {
    let tokenUrl: string;
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (provider === "microsoft-entra-id") {
      const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
      tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      clientId = process.env.MICROSOFT_CLIENT_ID;
      clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      console.log(`[OAuth] Microsoft tenant: ${tenantId}`);
    } else if (provider === "google") {
      tokenUrl = "https://oauth2.googleapis.com/token";
      clientId = process.env.GOOGLE_CLIENT_ID;
      clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    } else {
      console.error(`[OAuth] Unsupported provider: ${provider}`);
      return null;
    }

    if (!clientId || !clientSecret) {
      console.error(`[OAuth] Missing credentials for ${provider}: clientId=${!!clientId}, clientSecret=${!!clientSecret}`);
      return null;
    }

    console.log(`[OAuth] Calling token endpoint: ${tokenUrl}`);
    console.log(`[OAuth] Using clientId: ${clientId.substring(0, 8)}...`);

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

    console.log(`[OAuth] Token endpoint response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.error(`[OAuth] Token refresh failed for ${provider}:`, error);
      return null;
    }

    const data = await response.json();
    console.log(`[OAuth] Token refresh response keys: ${Object.keys(data).join(", ")}`);

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

    console.log(`[OAuth] Token refreshed successfully for ${provider}, new expires_in: ${data.expires_in}`);
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
