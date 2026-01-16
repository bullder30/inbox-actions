# Gmail Troubleshooting - Inbox Actions

Guide to resolving common issues with Gmail integration.

---

## Error: "Access token expired"

### Symptom

```
Error: Access token expired. Please reconnect your Gmail account.
```

### Cause

The Gmail access token has expired and the system could not automatically refresh it. This can happen if:

1. You connected **before** the OAuth configuration was complete
2. The refresh token was not saved during the initial connection
3. The `gmail.readonly` scope was not present during the initial connection

### Solution

#### Option 1: Disconnect and reconnect Gmail (RECOMMENDED)

1. Go to **Dashboard > Settings**
2. Click **Disconnect** in the Gmail section
3. Confirm the disconnection
4. Click **Connect Gmail**
5. Authorize all requested access (including gmail.readonly)

#### Option 2: Check the database

Verify that the refresh token is present:

```sql
SELECT
  provider,
  refresh_token IS NOT NULL as has_refresh_token,
  expires_at,
  scope
FROM accounts
WHERE provider = 'google';
```

If `has_refresh_token` is `false`, you need to reconnect.

#### Option 3: Revoke and reconnect

1. Go to https://myaccount.google.com/permissions
2. Find "Inbox Actions" in the list
3. Click "Remove access"
4. Return to Inbox Actions
5. Sign in again with Google

---

## Error: "Gmail is not connected"

### Symptom

```json
{
  "error": "Gmail is not connected",
  "code": "GMAIL_NOT_CONNECTED"
}
```

### Cause

No Google account is associated with your user account.

### Solution

1. Go to **Dashboard > Settings**
2. Click **Connect Gmail**
3. Select your Google account
4. Authorize the requested access

---

## Error: "redirect_uri_mismatch"

### Symptom

When connecting with Google, error:

```
Error 400: redirect_uri_mismatch
```

### Cause

The redirect URL configured in Google Cloud Console does not match the one used by the application.

### Solution

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. **APIs & Services > Credentials**
4. Click on your OAuth 2.0 Client ID
5. Verify that the following URLs are in **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://your-domain.com/api/auth/callback/google` (prod)
6. Make sure `NEXTAUTH_URL` in `.env.local` matches

---

## Error: "invalid_grant"

### Symptom

```
Error: invalid_grant
```

### Cause

The refresh token is invalid or has been revoked.

### Solution

1. Disconnect Gmail from **Dashboard > Settings**
2. Reconnect

If the problem persists:

1. Revoke access via https://myaccount.google.com/permissions
2. Reconnect

---

## No refresh token saved

### Symptom

The token expires after 1 hour and the user must reconnect every time.

### Cause

The `access_type: "offline"` parameter was not present during the initial connection.

### Solution

**Configuration verification:**

`auth.config.ts` must contain:

```typescript
Google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      access_type: "offline",
      prompt: "consent",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
      ].join(" "),
    },
  },
})
```

**If the configuration is correct but the problem persists:**

Google only returns the refresh token during the FIRST authorization. To force a new refresh token:

1. Revoke access at https://myaccount.google.com/permissions
2. OR delete the account in the database:
   ```sql
   DELETE FROM accounts WHERE provider = 'google' AND user_id = 'your-user-id';
   ```
3. Reconnect

---

## Error: "insufficientPermissions"

### Symptom

```json
{
  "error": {
    "code": 403,
    "message": "Request had insufficient authentication scopes."
  }
}
```

### Cause

The `gmail.readonly` scope was not granted during connection.

### Solution

1. Check in the database:
   ```sql
   SELECT scope FROM accounts WHERE provider = 'google';
   ```
2. If `gmail.readonly` is not present:
   - Disconnect Gmail
   - Reconnect
   - **IMPORTANT**: Check all boxes on the Google consent screen

---

## Error: "quotaExceeded"

### Symptom

```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric..."
  }
}
```

### Cause

You have exceeded Gmail API quotas (1 billion requests per day, 250 per second).

### Solution

1. Wait a few minutes/hours
2. Reduce `maxResults` during synchronization
3. Check quotas in [Google Cloud Console](https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas)

---

## Slow sync or timeout

### Symptom

Synchronization takes a long time or times out.

### Cause

Too many emails to retrieve at once.

### Solution

Reduce the number of emails per sync:

```typescript
await syncGmail({ maxResults: 50 }); // Instead of 100
```

---

## Warning: Token automatically refreshed

### Symptom

In the logs:

```
Access token expired, refreshing...
Token refreshed successfully
```

### Cause

The token has expired (lifetime: 1 hour) and was automatically refreshed.

### Solution

**No action needed** - This is normal behavior. The system automatically refreshes expired tokens.

If you see this message too often (several times per hour), it may indicate a problem:

1. Check that `expires_at` is correctly stored in the database
2. Check that the system clock is correct

---

## Diagnostic Commands

### Check Gmail status

```bash
curl http://localhost:3000/api/gmail/status \
  -H "Cookie: your-session-cookie"
```

### Check accounts in database

```sql
SELECT
  id,
  provider,
  provider_account_id,
  access_token IS NOT NULL as has_access_token,
  refresh_token IS NOT NULL as has_refresh_token,
  expires_at,
  scope,
  created_at
FROM accounts
WHERE provider = 'google';
```

### Check synced emails

```sql
SELECT
  COUNT(*) as total_emails,
  COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed
FROM email_metadata;
```

### Check last sync

```sql
SELECT
  email,
  last_gmail_sync,
  gmail_history_id
FROM users
WHERE last_gmail_sync IS NOT NULL
ORDER BY last_gmail_sync DESC;
```

---

## Complete Reset

If nothing works, reset completely:

```sql
-- Delete all email metadata
DELETE FROM email_metadata;

-- Delete Google account
DELETE FROM accounts WHERE provider = 'google';

-- Reset Gmail fields on user
UPDATE users SET
  last_gmail_sync = NULL,
  gmail_history_id = NULL;
```

Then reconnect with Google.

---

## Need Help?

If the problem persists after trying these solutions:

1. Check server logs for more details
2. Check [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2)
3. Check [Gmail API documentation](https://developers.google.com/gmail/api/guides)
4. Open an issue on GitHub with:
   - Complete error message
   - Steps to reproduce
   - Configuration (without secrets!)

---

## Verification Checklist

Before reporting a bug, check:

- [ ] Environment variables defined (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] OAuth configuration in auth.config.ts is correct
- [ ] Google Cloud OAuth configured (callback URLs)
- [ ] Google account connected in database
- [ ] Refresh token present in database
- [ ] `gmail.readonly` scope authorized
- [ ] Latest version of code (with automatic refresh)

---

## Prevention

To avoid these problems in the future:

1. Always use `access_type: "offline"` and `prompt: "consent"`
2. Never store tokens in plain text in logs
3. Implement automatic token refresh
4. Handle errors explicitly
5. Test revocation and reconnection regularly
