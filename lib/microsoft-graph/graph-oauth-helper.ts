/**
 * OAuth helper for Microsoft Graph API
 * Reads and refreshes tokens stored directly in MicrosoftGraphMailbox
 */

import { prisma } from "@/lib/db";
import { env } from "@/env.mjs";

const MICROSOFT_TOKEN_ENDPOINT = `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

/**
 * Gets access token for a specific Microsoft Graph mailbox.
 * Automatically refreshes if expired.
 */
export async function getMicrosoftGraphTokenForMailbox(mailboxId: string): Promise<string | null> {
  try {
    const mailbox = await prisma.microsoftGraphMailbox.findUnique({
      where: { id: mailboxId },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
        expiresAt: true,
      },
    });

    if (!mailbox?.accessToken) {
      console.log("[GraphOAuth] No access token found for mailbox:", mailboxId);
      return null;
    }

    if (!mailbox.refreshToken) {
      console.error("[GraphOAuth] No refresh token for mailbox:", mailboxId);
      return null;
    }

    let accessToken = mailbox.accessToken;

    // Refresh if expired or expiring soon (5 minute margin)
    const now = Math.floor(Date.now() / 1000);
    const expirationMargin = 5 * 60;
    const shouldRefresh = !mailbox.expiresAt || mailbox.expiresAt < now + expirationMargin;

    if (shouldRefresh) {
      console.log("[GraphOAuth] Token expired or expiring soon, refreshing mailbox:", mailboxId);
      const newToken = await refreshMailboxToken(mailbox.id, mailbox.refreshToken);
      if (newToken) {
        accessToken = newToken;
      } else {
        console.error("[GraphOAuth] Failed to refresh token for mailbox:", mailboxId);
        // Mark as disconnected
        await prisma.microsoftGraphMailbox.update({
          where: { id: mailboxId },
          data: {
            isConnected: false,
            connectionError: "Token refresh failed — please reconnect",
            lastErrorAt: new Date(),
          },
        });
        return null;
      }
    }

    return accessToken;
  } catch (error) {
    console.error("[GraphOAuth] Error getting token for mailbox:", mailboxId, error);
    return null;
  }
}

/**
 * Refreshes OAuth token for a mailbox and updates the database.
 */
async function refreshMailboxToken(mailboxId: string, refreshToken: string): Promise<string | null> {
  try {
    const clientId = env.MICROSOFT_CLIENT_ID;
    const clientSecret = env.MICROSOFT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[GraphOAuth] Missing Microsoft OAuth credentials");
      return null;
    }

    const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "openid email profile offline_access https://graph.microsoft.com/Mail.Read",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GraphOAuth] Token refresh failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();

    await prisma.microsoftGraphMailbox.update({
      where: { id: mailboxId },
      data: {
        accessToken: data.access_token,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
        ...(data.refresh_token && { refreshToken: data.refresh_token }),
        isConnected: true,
        connectionError: null,
        lastErrorAt: null,
      },
    });

    console.log("[GraphOAuth] Token refreshed successfully for mailbox:", mailboxId);
    return data.access_token;
  } catch (error) {
    console.error("[GraphOAuth] Error refreshing token:", error);
    return null;
  }
}
