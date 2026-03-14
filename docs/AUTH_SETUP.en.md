# Authentication Setup

This guide explains how to configure the different authentication methods for Inbox Actions.

## Table of Contents

- [Overview](#overview)
- [Email/Password Authentication](#emailpassword-authentication)
- [Email Verification](#email-verification)
- [Password Reset](#password-reset)
- [Terms of Service Acceptance](#terms-of-service-acceptance)
- [Google OAuth](#google-oauth)
- [Microsoft OAuth](#microsoft-oauth)
- [IMAP Configuration](#imap-configuration)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Overview

Inbox Actions separates application authentication from email access:

### Application Authentication

| Method | Description |
|--------|-------------|
| **Email/Password** | Local account with hashed password (bcrypt) |
| **Google OAuth** | Secure sign-in via Google |
| **Microsoft OAuth** | Secure sign-in via Microsoft |

### Email Access

| Method | Description |
|--------|-------------|
| **IMAP + App Password** | Universal IMAP access (Gmail, Outlook, Yahoo, iCloud...) |

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sign Up / Sign In                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Email/Pwd    │  │ Google OAuth │  │ Microsoft OAuth      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         └────────────────┬┴──────────────────────┘               │
│                          │                                       │
│                          ▼                                       │
│               ┌──────────────────────┐                          │
│               │ IMAP Configuration   │                          │
│               │ (App Password)       │                          │
│               └──────────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Email/Password Authentication

### Setup

Email/password authentication is always available. No additional configuration is required.

### Registration

1. Go to `/register`
2. Enter email, password (+ confirmation), accept the Terms of Service
3. Account is created with a hashed password (bcrypt, 12 rounds)
4. A verification email is sent automatically via Resend

### Sign In

1. Go to `/login`
2. Enter email + password
3. Show/hide password toggle available

### Linking with OAuth

If a user registers with email/password and then signs in with Google/Microsoft (same email), the accounts are automatically linked.

---

## Email Verification

Users registered via email/password must verify their email address. OAuth users (Google, Microsoft) are automatically verified.

### Flow

```
Registration → Verification email sent → Banner on dashboard
                                               ↓
                          Click link → /verify-email?token=...
                                               ↓
                                   emailVerified = now()
                                   Redirect → /dashboard
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/send-verification` | POST | Resend verification email (auth required) |
| `/api/auth/verify-email` | POST | Validate token and set `emailVerified` |

### Token

- Stored in the `VerificationToken` model (native Auth.js model)
- Validity: **1 hour**
- Unique SHA-256 token (32 bytes random hex)
- Previous token is deleted on each resend

### Dashboard Banner

If `User.emailVerified = null`, an orange banner is displayed with a "Resend email" button. The banner disappears once verified.

---

## Password Reset

Available only for email/password accounts.

### Flow

```
/login → "Forgot password?" → /forgot-password
              ↓
     Enter email address
              ↓
     Email with secure link (1h)
              ↓
     /reset-password?token=...
              ↓
     New password + confirmation
              ↓
     Redirect → /login
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/forgot-password` | POST | Generate token and send email |
| `/api/auth/reset-password` | POST | Validate token and update password |

### Security

- **Anti-enumeration**: the `forgot-password` route always returns `200` even if the email doesn't exist
- OAuth users (without password) receive `200` without any email sent
- Token stored in `User.passwordResetToken` with expiry in `User.passwordResetExpiry`
- Validity: **1 hour**
- Token and expiry are cleared after use

---

## Terms of Service Acceptance

All users — regardless of authentication method — must accept the Terms of Service before accessing the application.

### Behavior by Provider

| Provider | When acceptance happens |
|----------|-------------------------|
| **Email/Password** | At registration (checkbox in the form) |
| **Google OAuth** | On first access to a protected page after sign-in |
| **Microsoft OAuth** | On first access to a protected page after sign-in |

### OAuth Flow

```
Google/Microsoft sign-in → /dashboard (or any protected page)
                                  ↓
           (protected)/layout.tsx checks termsAcceptedAt
                                  ↓
            termsAcceptedAt = null → redirect /accept-terms
                                  ↓
               User checks the box and clicks "Continue"
                                  ↓
          POST /api/user/accept-terms → termsAcceptedAt = now()
                                  ↓
                         router.push("/dashboard")
```

### API Endpoint

| Endpoint | Method | Auth required | Description |
|----------|--------|---------------|-------------|
| `/api/user/accept-terms` | POST | Yes | Records acceptance (`termsAcceptedAt = now()`) |

### Database Field

```prisma
model User {
  // ...
  termsAcceptedAt DateTime? @map(name: "terms_accepted_at")
}
```

- `null` → Terms not accepted → redirect to `/accept-terms`
- `DateTime` → Terms accepted → access granted

### `/accept-terms` Page

- Public route (outside the `(protected)` group)
- Accessible only after authentication (the API endpoint verifies the session)
- Displays links to `/terms` and `/privacy`

---

## Google OAuth

### Prerequisites

- A Google Cloud account
- A Google Cloud project

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name your project (e.g., "Inbox Actions")
4. Click **"Create"**

### 2. Configure the OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"**
3. Fill in the required information:
   - **App name**: Inbox Actions
   - **User support email**: your email
   - **Developer contact**: your email
4. **Scopes**: Add:
   - `openid`
   - `email`
   - `profile`
5. Add test users if in "Testing" mode

### 3. Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Select **"Web application"**
4. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-domain.com/api/auth/callback/google
   ```
5. Copy the **Client ID** and **Client Secret**

### 4. Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true
```

---

## Microsoft OAuth

### Prerequisites

- A Microsoft Azure account
- An Azure AD tenant (personal or organizational)

### 1. Create an Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **"App registrations"**
3. Click **"New registration"**
4. Fill in:
   - **Name**: Inbox Actions
   - **Supported account types**: Choose based on your needs
     - "Accounts in this organizational directory only" (single-tenant)
     - "Accounts in any organizational directory" (multi-tenant)
     - "Personal Microsoft accounts" (personal accounts)
   - **Redirect URI**: Web → `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Click **"Register"**

### 2. Retrieve Identifiers

On the application page:

1. **Application (client) ID** → Note it (this is `MICROSOFT_CLIENT_ID`)
2. **Directory (tenant) ID** → Note it (this is `MICROSOFT_TENANT_ID`)

### 3. Create a Client Secret

1. Go to **"Certificates & secrets"**
2. Click **"New client secret"**
3. Give it a description and validity period
4. **Copy the value immediately** (not the ID) → This is `MICROSOFT_CLIENT_SECRET`

### 4. Configure API Permissions

1. Go to **"API permissions"**
2. Click **"Add a permission"**
3. Add these **Microsoft Graph** permissions:
   - `openid` (delegated)
   - `email` (delegated)
   - `profile` (delegated)
4. Click **"Grant admin consent"** if you are a tenant admin

### 5. Configure Authentication

1. Go to **"Authentication"**
2. Verify the redirect URI is present:
   ```
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   ```
3. For production, add:
   ```
   https://your-domain.com/api/auth/callback/microsoft-entra-id
   ```

### 6. Environment Variables

```env
# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=your_secret_value
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true
```

### Important Note on Tenant ID

- **Do not use "common"** as tenant ID — it causes issuer validation errors
- Always use your **real tenant ID** (GUID)
- The tenant ID can be found in Azure Portal → Azure Active Directory → Overview

---

## IMAP Configuration

After signing in to the application (via email/password, Google, or Microsoft), configure email access with an **App Password**:

### What is an App Password?

An App Password is a special password generated by your email provider. It allows IMAP access without using your main password.

### Gmail

1. Enable 2-step verification on your Google account
2. Generate an app password: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Select "Mail" and "Other (custom name)"
4. Name it "Inbox Actions"
5. Copy the generated password (16 characters)
6. **Important**: Enable IMAP in Gmail → Settings → Forwarding and POP/IMAP

IMAP configuration:
- Server: `imap.gmail.com`
- Port: `993`
- TLS: Yes

### Outlook.com / Hotmail

1. Enable 2-step verification on your Microsoft account
2. Generate an app password: [https://account.live.com/proofs/AppPassword](https://account.live.com/proofs/AppPassword)
3. Copy the generated password

IMAP configuration:
- Server: `outlook.office365.com`
- Port: `993`
- TLS: Yes

### Yahoo Mail

1. Enable 2-step verification
2. Generate an app password: [https://login.yahoo.com/account/security](https://login.yahoo.com/account/security)
3. Select "Other app"

IMAP configuration:
- Server: `imap.mail.yahoo.com`
- Port: `993`
- TLS: Yes

### iCloud Mail

1. Enable two-factor authentication
2. Generate an app-specific password: [https://appleid.apple.com](https://appleid.apple.com)
3. "Security" → "App-Specific Passwords"

IMAP configuration:
- Server: `imap.mail.me.com`
- Port: `993`
- TLS: Yes

### ProtonMail (via Bridge)

1. Install ProtonMail Bridge
2. Sign in via Bridge
3. Use the password shown in Bridge

IMAP configuration:
- Server: `127.0.0.1`
- Port: `1143`
- TLS: No

### Available IMAP Presets

| Provider | Server | Port | TLS |
|----------|--------|------|-----|
| Gmail | imap.gmail.com | 993 | Yes |
| Outlook/Office 365 | outlook.office365.com | 993 | Yes |
| Yahoo | imap.mail.yahoo.com | 993 | Yes |
| iCloud | imap.mail.me.com | 993 | Yes |
| ProtonMail (Bridge) | 127.0.0.1 | 1143 | No |
| Fastmail | imap.fastmail.com | 993 | Yes |

---

## Environment Variables

### Complete `.env.local` file

```env
# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000

# -----------------------------------------------------------------------------
# Authentication (NextAuth.js)
# -----------------------------------------------------------------------------
AUTH_SECRET=your_randomly_generated_secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false

# Microsoft OAuth (optional)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=false

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
DATABASE_URL='postgresql://user:password@localhost:5432/inbox_actions'

# -----------------------------------------------------------------------------
# Email (Resend) - For notifications
# -----------------------------------------------------------------------------
RESEND_API_KEY=
EMAIL_FROM="Inbox Actions <noreply@inbox-actions.com>"

# -----------------------------------------------------------------------------
# IMAP (for password encryption)
# -----------------------------------------------------------------------------
IMAP_MASTER_KEY=your_256_bit_key_in_hex
```

### Generating Secrets

```bash
# AUTH_SECRET (32 bytes base64)
openssl rand -base64 32

# IMAP_MASTER_KEY (256 bits hex)
openssl rand -hex 32
```

---

## Troubleshooting

### "issuer does not match expectedIssuer" Error (Microsoft)

**Cause:** The tenant ID is invalid or you are using "common".

**Solution:**
1. Use your real tenant ID (GUID), not "common"
2. Find it in Azure Portal → Azure Active Directory → Overview → Tenant ID

### "redirect_uri_mismatch" Error

**Cause:** The callback URL does not match.

**Solution:**
1. Verify the exact URL in Azure/Google Console
2. Format: `http://localhost:3000/api/auth/callback/[provider]`
3. No trailing slash
4. Case-sensitive

### "AADSTS50011" Error (Microsoft)

**Cause:** Redirect URI not configured.

**Solution:**
1. Add it in Azure Portal → App registrations → Authentication
2. URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`

### OAuth Buttons Not Displayed

**Cause:** Environment variables not set.

**Solution:**
1. Verify that `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` or `NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true`
2. Restart the server after modifying `.env` files

### "Authentication failed" Error (IMAP)

**Cause:** Incorrect App Password or IMAP not enabled.

**Solution:**
1. Verify the App Password is correct (no spaces)
2. For Gmail: enable IMAP in Gmail settings
3. Verify that 2-step verification is enabled

---

## Resources

- [Auth.js (NextAuth v5) Documentation](https://authjs.dev/)
- [Google OAuth Setup](https://authjs.dev/getting-started/providers/google)
- [Microsoft Entra ID Setup](https://authjs.dev/getting-started/providers/microsoft-entra-id)
- [Azure Portal](https://portal.azure.com)
- [Google Cloud Console](https://console.cloud.google.com)
