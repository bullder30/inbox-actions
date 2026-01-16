# Gmail OAuth Configuration - Inbox Actions

Complete guide to configure OAuth 2.0 authentication with Gmail API.

---

## Objective

Allow the application to read users' Gmail emails with their explicit consent, respecting security standards and GDPR.

---

## Prerequisites

- Google Cloud Platform account
- Inbox Actions project created
- Access to Google Cloud Console

---

## Google Cloud Platform Configuration

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project selector at the top
3. Click "New Project"
4. Project name: `inbox-actions`
5. Click "Create"

### Step 2: Enable Gmail API

1. In the menu, go to **APIs & Services > Library**
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select "External" (since the app will be publicly accessible)
3. Click "Create"

**Consent screen configuration:**

| Field | Value |
|-------|-------|
| App name | Inbox Actions |
| User support email | Your email |
| App logo | (Optional) |
| Application home page | https://your-domain.com |
| Privacy policy | https://your-domain.com/privacy |
| Terms of service | https://your-domain.com/terms |
| Authorized domains | your-domain.com |
| Developer contact | Your email |

4. Click "Save and Continue"

**Scopes (Permissions):**

Add the following scopes:
- `https://www.googleapis.com/auth/gmail.readonly` - Read-only email access
- `https://www.googleapis.com/auth/userinfo.email` - User's email
- `https://www.googleapis.com/auth/userinfo.profile` - User's profile

**Important:** ONLY add necessary permissions. The more permissions you request, the more Google will scrutinize your application.

5. Click "Save and Continue"

**Test users:**

In "Testing" mode, add the emails of users authorized to test the application.

6. Click "Save and Continue"
7. Review the summary and click "Back to Dashboard"

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: **Web application**

**Configuration:**

| Field | Value |
|-------|-------|
| Name | Inbox Actions Web Client |
| Authorized JavaScript origins | http://localhost:3000 (dev)<br>https://your-domain.com (prod) |
| Authorized redirect URIs | http://localhost:3000/api/auth/callback/google (dev)<br>https://your-domain.com/api/auth/callback/google (prod) |

4. Click "Create"
5. **Download the JSON** or copy:
   - Client ID
   - Client Secret

### Step 5: Go to Production (optional)

For all users to use the app (not just testers):

1. Go to **OAuth consent screen**
2. Click "Publish App"
3. Google will review your application (can take several days/weeks)
4. You may need to provide:
   - Demo video
   - Link to production app
   - Justification for scope usage
   - Privacy policy
   - Terms of service

**Note:** In "Testing" mode, you can have up to 100 test users.

---

## Application Configuration

### Step 1: Environment Variables

Add to `.env.local`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-very-long-random-secret

# Gmail API
GMAIL_SCOPES=https://www.googleapis.com/auth/gmail.readonly
```

### Step 2: Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Or in Node.js:

```javascript
require('crypto').randomBytes(32).toString('base64')
```

---

## Gmail Scopes Explained

### `gmail.readonly` - Read-only (RECOMMENDED)

**Access:**
- Read emails
- Read labels
- Read history
- List threads

**Does NOT allow:**
- Modify emails
- Delete emails
- Send emails
- Create/modify labels

**GDPR Justification:**
- Data minimization: read-only access only
- Necessity principle: can only read what's necessary
- Risk limitation: no modification possible

### Alternative Scopes (NOT used)

| Scope | Description | Why we DON'T use it |
|-------|-------------|---------------------|
| `gmail.modify` | Read + modify | Too permissive |
| `gmail.send` | Send emails | Not necessary |
| `gmail.labels` | Manage labels | Not necessary |
| `gmail.compose` | Create drafts | Not necessary |

---

## OAuth 2.0 Flow

### 1. User clicks "Connect Gmail"

```
User (Browser) → App Server → Google OAuth
```

### 2. Redirect to Google

```
Google displays:
┌─────────────────────────────────────┐
│ Inbox Actions wants to access:      │
│ ☑ Read your Gmail emails            │
│ ☑ See your email address            │
│                                     │
│ [Cancel]  [Allow] ← Consent         │
└─────────────────────────────────────┘
```

### 3. User accepts

```
Google → Redirect to: /api/auth/callback/google?code=xxx
```

### 4. Exchange code for tokens

```javascript
{
  access_token: "ya29.a0AfH6...",      // Valid 1h
  refresh_token: "1//0gKh...",         // Valid indefinitely
  scope: "gmail.readonly",
  token_type: "Bearer",
  expires_in: 3600
}
```

### 5. Secure storage

Tokens are stored in the database (Account table via NextAuth).

---

## Security

### Securely Stored Tokens

✅ **Database:**
- Tokens encrypted if possible (see NextAuth configuration)
- Access restricted by userId
- Refresh token used to renew access token

❌ **NEVER:**
- In localStorage
- In non-secure cookies
- In source code
- In logs

### Token Rotation

```javascript
// Access token expires after 1h
// Refresh token used automatically by NextAuth
// If refresh fails → Request new authorization
```

### Revocation

User can revoke access at any time:
1. Via https://myaccount.google.com/permissions
2. Via Inbox Actions interface ("Disconnect Gmail" button)

---

## Testing the Configuration

### 1. Verify Credentials

```bash
# Verify variables are defined
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
```

### 2. Test Authentication

1. Start the application: `pnpm dev`
2. Go to http://localhost:3000
3. Click "Sign in with Google"
4. Authorize the application
5. Verify you're redirected to the app

### 3. Verify Tokens

```javascript
// In NextAuth console
const session = await auth();
console.log(session.accessToken); // Should exist
```

---

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause:** The redirect URL doesn't match the one configured in Google Cloud.

**Solution:**
1. Verify `NEXTAUTH_URL` is correct
2. Verify the callback URL is identical in:
   - Google Cloud Console
   - NextAuth configuration

### Error: "access_denied"

**Cause:** User refused authorization OR is not in the testers list.

**Solution:**
1. If in "Testing" mode, add the email in test users
2. Verify the user clicked "Allow"

### Error: "invalid_grant"

**Cause:** The refresh token is invalid or revoked.

**Solution:**
1. Delete tokens from database
2. Ask user to reconnect

### Tokens Not Stored

**Cause:** NextAuth doesn't have access to the refresh token.

**Solution:**
Add `access_type: "offline"` in Google Provider configuration:

```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorization: {
    params: {
      access_type: "offline",
      prompt: "consent",
      scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly"
    }
  }
})
```

---

## Resources

### Official Documentation

- [Gmail API Overview](https://developers.google.com/gmail/api/guides)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail API Scopes](https://developers.google.com/gmail/api/auth/scopes)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)

### Limits and Quotas

| Operation | Daily Quota | Per Second Quota |
|-----------|-------------|------------------|
| API Requests | 1,000,000,000 | 250 |
| Sends | 10,000 | - |

**Note:** For a read-only app, these quotas are more than sufficient.

### GDPR Compliance

- ✅ Explicit consent (OAuth screen)
- ✅ Right of access (user can see their data)
- ✅ Right to erasure (disconnection = token deletion)
- ✅ Data minimization (read-only only)
- ✅ Storage limitation (emails not stored)
- ✅ Security (encrypted tokens, HTTPS only)

---

## Final Checklist

Before going to production:

- [ ] Client ID and Client Secret configured
- [ ] NEXTAUTH_SECRET securely generated (32+ characters)
- [ ] Minimal scopes configured (gmail.readonly only)
- [ ] Consent screen completed
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Authorized domain added
- [ ] Redirect URLs in HTTPS
- [ ] Test users added (Testing mode)
- [ ] Google verification request submitted (if publishing)
- [ ] Revocation handling implemented
- [ ] Security logs configured
- [ ] Automatic token rotation tested

---

## Summary

Gmail OAuth authentication for Inbox Actions:

✅ **Secure** - Tokens stored in database, HTTPS only
✅ **GDPR Compliant** - Explicit consent, data minimization
✅ **Read-only** - `gmail.readonly` scope only
✅ **Transparent** - User sees exactly what's authorized
✅ **Revocable** - User keeps control

The user remains the owner of their data at all times.
