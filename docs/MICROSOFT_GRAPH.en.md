# Microsoft Graph API Integration

This documentation describes the Microsoft Graph API integration for accessing Microsoft emails (Outlook.com, Hotmail, Live.com, Microsoft 365).

---

## Overview

For Microsoft accounts, Inbox Actions uses **Microsoft Graph API** to access emails. This method provides the best user experience: no IMAP configuration is required.

| Method | Advantages |
|--------|-----------|
| **Microsoft Graph API** | No user configuration, efficient delta query, native access |

### Why Graph API?

| Alternative | Problem |
|-------------|---------|
| App Password | Deprecated for personal Microsoft accounts since September 2024 |
| IMAP + OAuth | Requires manually enabling IMAP in Outlook.com |
| **Graph API** | No configuration required on the user side |

---

## Architecture

### Independent Multi-Mailboxes

Since version 0.3.0, each Microsoft account is stored in an independent `MicrosoftGraphMailbox` record — OAuth tokens are stored directly in this model, without any link to the Auth.js `Account` table.

A user can connect **multiple Microsoft accounts** simultaneously, just as they can with IMAP.

```
┌─────────────────────────────────────┐
│  createAllEmailProviders(userId)    │  ← Iterates ALL mailboxes
│  lib/email-provider/factory.ts      │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴────────────┐
    │  For each mailbox     │
    ▼                       ▼
┌──────────────┐       ┌──────────────┐
│ GraphMailbox │       │ IMAPMailbox  │
│    #1        │  ...  │    #N        │
└──────────────┘       └──────────────┘
```

### Common Interface

The provider implements `IEmailProvider`:

```typescript
interface IEmailProvider {
  providerType: "IMAP" | "MICROSOFT_GRAPH";

  fetchNewEmails(options?: FetchOptions): Promise<EmailMetadata[]>;
  getEmailBodyForAnalysis(messageId: string | bigint): Promise<string | null>;
  getExtractedEmails(): Promise<EmailMetadata[]>;
  markEmailAsAnalyzed(messageId: string | bigint): Promise<void>;
  disconnect(): Promise<void>;
}
```

---

## Azure Configuration

### 1. Create an Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **"App registrations"**
3. Click **"New registration"**
4. Fill in:
   - **Name**: Inbox Actions
   - **Supported account types**:
     - For personal accounts: "Personal Microsoft accounts only"
     - For organizations: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: Web → `http://localhost:3000/api/microsoft-graph/callback`

### 2. Configure API Permissions

1. Go to **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Choose **"Delegated permissions"**
5. Add these permissions:
   - `openid`
   - `email`
   - `profile`
   - `offline_access` (for refresh token)
   - `Mail.Read` (read access to emails)

### 3. Create a Client Secret

1. Go to **"Certificates & secrets"**
2. Click **"New client secret"**
3. Give it a description and validity period
4. **Copy the value immediately** (not the ID)

### 4. Configure Redirect URIs

1. Go to **"Authentication"**
2. Add redirect URIs:
   ```
   # For email connection (Microsoft mailbox)
   http://localhost:3000/api/microsoft-graph/callback
   https://your-domain.com/api/microsoft-graph/callback

   # For Auth.js login (if Microsoft login enabled)
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   https://your-domain.com/api/auth/callback/microsoft-entra-id
   ```
3. Check "Access tokens" and "ID tokens" under "Implicit grant and hybrid flows"

### 5. Environment Variables

```env
# Microsoft OAuth + Graph API
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your_secret_value
MICROSOFT_TENANT_ID=consumers    # For personal accounts
# or
MICROSOFT_TENANT_ID=common       # For personal + organizational accounts

NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true
```

---

## How It Works

### Login vs Email Connection Separation

**Important**: Authentication (login) is independent from email connection.

- **Login**: managed by Auth.js (Google, Microsoft, Credentials)
- **Microsoft email mailbox**: configured separately in Settings, via `/api/microsoft-graph/connect`

A user signed in with Google (or any other method) can add one or more Microsoft accounts for email synchronization.

### Adding a Microsoft Mailbox Flow

```
┌──────────────┐    ┌─────────────────────┐    ┌────────────────┐
│ Settings     │───►│ /api/microsoft-     │───►│ Microsoft      │
│ Page         │    │ graph/connect       │    │ OAuth          │
└──────────────┘    └─────────────────────┘    │ (Mail.Read)    │
                                               └───────┬────────┘
                                                       │
                    ┌─────────────────────┐            │
                    │ /api/microsoft-     │◄───────────┘
                    │ graph/callback      │
                    └──────────┬──────────┘
                               │  Upsert by (userId, microsoftAccountId)
                               ▼
              ┌─────────────────────────────────────────────────┐
              │        MicrosoftGraphMailbox (Prisma)            │
              │  - accessToken                                   │
              │  - refreshToken                                  │
              │  - expiresAt                                     │
              │  - email, label                                  │
              │  - isConnected, connectionError                  │
              │  - deltaLink (incremental sync)                  │
              └─────────────────────────────────────────────────┘
```

### Conflict Protection

- The same Microsoft account cannot be configured by two different users
- The check is performed during the OAuth callback (`userId != current_user`)
- An explicit error is returned if a conflict is detected

### Coexistence with IMAP

IMAP mailboxes and Microsoft mailboxes coexist — a user can have both IMAP mailboxes and Microsoft mailboxes at the same time. Synchronization iterates over all active mailboxes.

---

## Data Model

### MicrosoftGraphMailbox

```prisma
model MicrosoftGraphMailbox {
  id                 String    @id @default(cuid())
  userId             String
  microsoftAccountId String    // Microsoft account OID

  label        String?   // Optional nickname
  email        String?   // Microsoft email address

  // OAuth tokens (stored here, independent of Account)
  accessToken  String?   @db.Text
  refreshToken String?   @db.Text
  expiresAt    Int?      // Unix timestamp

  // Incremental sync
  deltaLink    String?   @db.Text
  lastSync     DateTime?

  // Status
  isActive        Boolean   @default(true)
  isConnected     Boolean   @default(false)
  connectionError String?
  lastErrorAt     DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, microsoftAccountId])  // One account per user
  @@index([userId])
  @@index([isActive])
}
```

### EmailMetadata (reused fields)

```prisma
model EmailMetadata {
  emailProvider  EmailProvider  // MICROSOFT_GRAPH
  mailboxId      String?        // MicrosoftGraphMailbox ID

  // Fields reused for Graph
  gmailMessageId String?        // Graph message ID
  gmailThreadId  String?        // Graph conversationId
}
```

---

## API Endpoints

### Status

```bash
GET /api/microsoft-graph/status

# Response
{
  "microsoftOAuthEnabled": true,
  "mailboxes": [
    {
      "id": "cuid...",
      "label": null,
      "email": "user@outlook.com",
      "isConnected": true,
      "connectionError": null,
      "lastSync": "2026-03-10T07:00:00Z"
    }
  ]
}
```

### Initiate OAuth Connection

```bash
GET /api/microsoft-graph/connect

# Response
{
  "authUrl": "https://login.microsoftonline.com/..."
}
# User is redirected to Microsoft to authorize Mail.Read
# Callback: /api/microsoft-graph/callback
```

### Remove a Mailbox

```bash
POST /api/microsoft-graph/disconnect
Content-Type: application/json

{ "mailboxId": "cuid..." }

# Response
{ "success": true, "message": "Microsoft mailbox disconnected" }
```

### Manual Sync

```bash
POST /api/microsoft-graph/sync

# Response
{
  "success": true,
  "synced": 15,
  "message": "15 emails synced"
}
```

---

## Token Management

### Automatic Refresh

The `getMicrosoftGraphTokenForMailbox(mailboxId)` helper manages the token lifecycle:

1. Reads the token from `MicrosoftGraphMailbox`
2. If expired or expiring in < 5 minutes → automatic refresh
3. If refresh fails → marks `isConnected: false` + `connectionError`
4. The UI then displays a "Reconnect" button to restart the OAuth flow

```typescript
const accessToken = await getMicrosoftGraphTokenForMailbox(mailboxId);
if (!accessToken) {
  // Invalid token — user must reconnect
}
```

### 401 Handling in Graph Requests

If the Microsoft API returns 401, `MicrosoftGraphService` attempts an automatic refresh before retrying the request.

---

## Incremental Sync (Delta Query)

To optimize performance, the system uses Microsoft Graph delta queries:

```
First sync:
GET /me/mailFolders/inbox/messages?$filter=receivedDateTime ge ...
→ Stores @odata.deltaLink in MicrosoftGraphMailbox.deltaLink

Subsequent syncs:
GET {deltaLink}
→ Returns only changes since the last sync
→ Updates the deltaLink
```

**Important**: If the `deltaLink` is invalid (token expired for too long), Graph returns 410 Gone. In this case, clear `deltaLink` in the database to force a full sync.

---

## Rate Limiting

| Limit | Value |
|-------|-------|
| Requests/10 min/mailbox | 10,000 |
| Concurrent requests | 4 |

The service automatically handles 429 errors with retry and exponential backoff (up to 3 attempts).

---

## Troubleshooting

### "AADSTS70011: invalid_scope" Error

**Cause**: The `Mail.Read` scope is not configured in Azure Portal.

**Solution**:
1. Check permissions in Azure Portal → API permissions
2. Make sure `Mail.Read` is added as a delegated permission
3. If admin, click "Grant admin consent"

### "token_refresh_failed" Error

**Cause**: The refresh token has expired or been revoked.

**Solution**: The user must reconnect via the "Reconnect" button in Settings.

### "issuer does not match expectedIssuer" Error

**Cause**: The tenant ID does not match the account type.

**Solution**:
- Personal accounts: `MICROSOFT_TENANT_ID=consumers`
- Organizational accounts: tenant GUID or `common`

### Emails Not Retrieved After Reset

If you clear `EmailMetadata` and reset `lastSync`, you must also clear `deltaLink` in the database — otherwise Graph returns nothing (already "seen" via the delta).

```sql
UPDATE microsoft_graph_mailboxes SET delta_link = NULL WHERE id = '...';
```

---

## Comparison with IMAP

| Criterion | Microsoft Graph | IMAP |
|-----------|-----------------|------|
| Configuration | Automatic (OAuth) | Manual (App Password) |
| Multi-account | ✅ | ✅ |
| Incremental sync | Delta query (native) | UID comparison |
| Rate limiting | 10k req/10min | Depends on provider |
| Supported providers | Microsoft only | Gmail, Yahoo, iCloud, etc. |
| Tokens | Stored in `MicrosoftGraphMailbox` | Password encrypted in `IMAPCredential` |

---

## Resources

- [Microsoft Graph API - Mail](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Microsoft Graph - Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Auth.js - Microsoft Entra ID](https://authjs.dev/getting-started/providers/microsoft-entra-id)
- [Azure Portal](https://portal.azure.com)

---

**Last updated**: March 13, 2026
**Version**: 0.3.0
