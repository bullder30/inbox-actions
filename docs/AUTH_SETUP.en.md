# OAuth Authentication Setup

This guide explains how to configure Google and GitHub authentication for your Inbox Actions application.

## Table of Contents

- [Google OAuth](#google-oauth)
- [GitHub OAuth](#github-oauth)
- [Environment Variables Configuration](#environment-variables-configuration)
- [Testing Authentication](#testing-authentication)

---

## Google OAuth

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name your project (e.g., "Inbox Actions")
4. Click **"Create"**

### 2. Enable Google+ API

1. In the navigation menu, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"**
3. Click **"Enable"**

### 3. Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (or "Internal" if you have Google Workspace)
3. Click **"Create"**
4. Fill in the required information:
   - **App name**: Inbox Actions
   - **User support email**: your email
   - **Developer contact information**: your email
5. Click **"Save and Continue"**
6. Skip **Scopes** (click "Save and Continue")
7. Add your test emails if needed
8. Click **"Save and Continue"** then **"Back to Dashboard"**

### 4. Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Select **"Web application"**
4. Name your client (e.g., "Inbox Actions Web")
5. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-domain.com/api/auth/callback/google
   ```
   > Note: Add the production URL when you deploy

6. Click **"Create"**
7. Copy the **Client ID** and **Client Secret** that appear

### 5. Add Credentials to .env.local

Update your `.env.local` file:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

---

## GitHub OAuth

### 1. Create an OAuth App on GitHub

1. Go to [GitHub](https://github.com) and log in
2. Click your avatar (top right) → **Settings**
3. In the left menu, at the bottom, click **Developer settings**
4. Click **OAuth Apps** → **New OAuth App**

### 2. Configure the OAuth App

Fill in the form:

- **Application name**: Inbox Actions
- **Homepage URL**:
  ```
  http://localhost:3000
  ```
- **Application description**: (optional) Action manager from inbox
- **Authorization callback URL**:
  ```
  http://localhost:3000/api/auth/callback/github
  ```

Click **"Register application"**

### 3. Generate a Client Secret

1. On your OAuth App page, click **"Generate a new client secret"**
2. Confirm with your password if prompted
3. **Copy the client secret immediately** (you won't be able to see it again)

### 4. Add Credentials to .env.local

Update your `.env.local` file:

```env
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

### 5. Add GitHub Provider in auth.config.ts

Open the `auth.config.ts` file and add the GitHub provider:

```typescript
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";

import { env } from "@/env.mjs";

export default {
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
    }),
  ],
} satisfies NextAuthConfig;
```

### 6. Add Environment Variables in env.mjs

Open the `env.mjs` file and add the GitHub variables:

```javascript
// In the server section
GITHUB_CLIENT_ID: z.string(),
GITHUB_CLIENT_SECRET: z.string(),

// In the runtimeEnv section
GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
```

---

## Environment Variables Configuration

Your final `.env.local` file should look like this:

```env
# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000

# -----------------------------------------------------------------------------
# Authentication (NextAuth.js)
# -----------------------------------------------------------------------------
AUTH_SECRET=t6Oc1oipa076PhcRdRMdnEtmrbwPCcPS7MzsYiw8/wc=

GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
DATABASE_URL='postgresql://inbox_admin:%23Charlotte2013%23@localhost:15432/inbox_actions'

# -----------------------------------------------------------------------------
# Email (Resend)
# -----------------------------------------------------------------------------
RESEND_API_KEY=re_2ExbL6FN_J7SpLZ2pEiDEr6bgUH4JvB5a
EMAIL_FROM="Inbox Actions <onboarding@resend.dev>"

# -----------------------------------------------------------------------------
# Subscriptions (Stripe)
# -----------------------------------------------------------------------------
STRIPE_API_KEY=sk_test_dummy_stripe_key_12345678901234567890
STRIPE_WEBHOOK_SECRET=whsec_dummy_webhook_secret_1234567890

NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID=price_dummy_pro_monthly
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID=price_dummy_pro_yearly

NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID=price_dummy_business_monthly
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID=price_dummy_business_yearly
```

---

## Testing Authentication

### 1. Restart the Development Server

```bash
pnpm dev
```

### 2. Test Different Authentication Methods

Go to http://localhost:3000/login and test:

#### Email Magic Link (Resend)
1. Enter your email
2. Click "Sign in with Email"
3. Check your inbox
4. Click the magic link

#### Google OAuth
1. Click "Continue with Google"
2. Select your Google account
3. Authorize the application

#### GitHub OAuth
1. Click "Continue with GitHub"
2. Authorize the GitHub application

### 3. Database Verification

After a successful login, verify the user was created:

```bash
# Connect to PostgreSQL
psql -U inbox_admin -d inbox_actions

# Check users
SELECT * FROM users;

# Check OAuth accounts
SELECT * FROM accounts;
```

---

## Troubleshooting

### "redirect_uri_mismatch" Error (Google)

- Verify the callback URL is exactly the same in Google Cloud Console and in your application
- Exact format: `http://localhost:3000/api/auth/callback/google`
- No trailing slash `/`

### "The redirect_uri MUST match" Error (GitHub)

- Same for GitHub: verify the callback URL
- Exact format: `http://localhost:3000/api/auth/callback/github`

### Authentication Not Working

1. Verify all environment variables are defined
2. Restart the server (`pnpm dev`)
3. Check console logs for specific errors
4. Verify the database is running

### Email Magic Link Not Working

- Verify your Resend API key is valid
- Verify the `EMAIL_FROM` email is verified on Resend
- Check Resend logs to see if the email was sent

---

## Production

When deploying to production:

### Google OAuth
1. Add the production URL in "Authorized redirect URIs":
   ```
   https://your-domain.com/api/auth/callback/google
   ```

### GitHub OAuth
1. Create a **new** OAuth App for production (recommended)
2. Or add the production URL in the existing app:
   - Homepage URL: `https://your-domain.com`
   - Callback URL: `https://your-domain.com/api/auth/callback/github`

### Environment Variables
- Use your deployment platform's environment variables (Vercel, Railway, etc.)
- **Never** commit the `.env.local` file to Git

---

## Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Setup](https://next-auth.js.org/providers/google)
- [GitHub OAuth Setup](https://next-auth.js.org/providers/github)
- [Resend Documentation](https://resend.com/docs)
