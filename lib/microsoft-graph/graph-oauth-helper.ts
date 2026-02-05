/**
 * OAuth helper for Microsoft Graph API
 * Handles token retrieval and refresh for Graph API access
 */

import { prisma } from "@/lib/db";
import { env } from "@/env.mjs";

const MICROSOFT_GRAPH_SCOPE = "https://graph.microsoft.com/Mail.Read";
const MICROSOFT_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

/**
 * Result of token retrieval
 */
export interface TokenResult {
  accessToken: string;
  accountId: string;
  refreshToken: string | null;
}

/**
 * Checks if a user has Microsoft Graph access (Mail.Read scope)
 * @param userId The user ID
 * @returns true if user has Graph API access
 */
export async function hasMicrosoftGraphAccess(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "microsoft-entra-id",
    },
    select: {
      scope: true,
    },
  });

  if (!account?.scope) {
    return false;
  }

  // Check if scope includes Mail.Read
  return account.scope.includes(MICROSOFT_GRAPH_SCOPE);
}

/**
 * Gets Microsoft Graph access token for a user
 * Automatically refreshes if expired
 * @param userId The user ID
 * @returns Token result or null if not available
 */
export async function getMicrosoftGraphToken(userId: string): Promise<TokenResult | null> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "microsoft-entra-id",
      },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
        scope: true,
      },
    });

    if (!account || !account.access_token) {
      console.log("[GraphOAuth] No Microsoft account found for user:", userId);
      return null;
    }

    // Check if scope includes Mail.Read
    if (!account.scope?.includes(MICROSOFT_GRAPH_SCOPE)) {
      console.log("[GraphOAuth] User does not have Mail.Read scope:", userId);
      return null;
    }

    if (!account.refresh_token) {
      console.error("[GraphOAuth] No refresh token available for user:", userId);
      return null;
    }

    let accessToken = account.access_token;

    // Check if token is expired or will expire soon (5 minute margin)
    const now = Math.floor(Date.now() / 1000);
    const expirationMargin = 5 * 60; // 5 minutes
    const shouldRefresh = !account.expires_at || account.expires_at < now + expirationMargin;

    if (shouldRefresh) {
      console.log("[GraphOAuth] Token expired or expiring soon, refreshing...");
      const newToken = await refreshMicrosoftToken(account.refresh_token, account.id);
      if (newToken) {
        accessToken = newToken;
      } else {
        console.error("[GraphOAuth] Failed to refresh token");
        return null;
      }
    }

    return {
      accessToken,
      accountId: account.id,
      refreshToken: account.refresh_token,
    };
  } catch (error) {
    console.error("[GraphOAuth] Error getting token:", error);
    return null;
  }
}

/**
 * Refreshes Microsoft OAuth token
 * @param refreshToken The refresh token
 * @param accountId The account ID in database
 * @returns New access token or null if failed
 */
async function refreshMicrosoftToken(
  refreshToken: string,
  accountId: string
): Promise<string | null> {
  try {
    const clientId = env.MICROSOFT_CLIENT_ID;
    const clientSecret = env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[GraphOAuth] Missing Microsoft OAuth credentials");
      return null;
    }

    const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "openid email profile offline_access " + MICROSOFT_GRAPH_SCOPE,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GraphOAuth] Token refresh failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();

    // Update token in database
    await prisma.account.update({
      where: { id: accountId },
      data: {
        access_token: data.access_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        // Microsoft may return a new refresh token
        ...(data.refresh_token && { refresh_token: data.refresh_token }),
      },
    });

    console.log("[GraphOAuth] Token refreshed successfully");
    return data.access_token;
  } catch (error) {
    console.error("[GraphOAuth] Error refreshing token:", error);
    return null;
  }
}

/**
 * Checks if a user can use Microsoft Graph API
 * Returns detailed status information
 */
export async function getMicrosoftGraphStatus(userId: string): Promise<{
  hasAccount: boolean;
  hasMailReadScope: boolean;
  isTokenValid: boolean;
  email?: string;
}> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "microsoft-entra-id",
    },
    select: {
      scope: true,
      access_token: true,
      expires_at: true,
      user: {
        select: { email: true },
      },
    },
  });

  if (!account) {
    return {
      hasAccount: false,
      hasMailReadScope: false,
      isTokenValid: false,
    };
  }

  const hasMailReadScope = account.scope?.includes(MICROSOFT_GRAPH_SCOPE) ?? false;
  const now = Math.floor(Date.now() / 1000);
  const isTokenValid = !!account.access_token && !!account.expires_at && account.expires_at > now;

  return {
    hasAccount: true,
    hasMailReadScope,
    isTokenValid,
    email: account.user?.email ?? undefined,
  };
}
