# Configuration de l'authentification OAuth

Ce guide vous explique comment configurer l'authentification Google et GitHub pour votre application Inbox Actions.

## Table des matières

- [Google OAuth](#google-oauth)
- [GitHub OAuth](#github-oauth)
- [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
- [Test de l'authentification](#test-de-lauthentification)

---

## Google OAuth

### 1. Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Cliquez sur **"Select a project"** → **"New Project"**
3. Nommez votre projet (ex: "Inbox Actions")
4. Cliquez sur **"Create"**

### 2. Activer Google+ API

1. Dans le menu de navigation, allez dans **"APIs & Services"** → **"Library"**
2. Recherchez **"Google+ API"**
3. Cliquez sur **"Enable"**

### 3. Configurer l'écran de consentement OAuth

1. Allez dans **"APIs & Services"** → **"OAuth consent screen"**
2. Sélectionnez **"External"** (ou "Internal" si vous avez Google Workspace)
3. Cliquez sur **"Create"**
4. Remplissez les informations obligatoires :
   - **App name**: Inbox Actions
   - **User support email**: votre email
   - **Developer contact information**: votre email
5. Cliquez sur **"Save and Continue"**
6. Passez les **Scopes** (cliquez sur "Save and Continue")
7. Ajoutez vos emails de test si nécessaire
8. Cliquez sur **"Save and Continue"** puis **"Back to Dashboard"**

### 4. Créer les credentials OAuth 2.0

1. Allez dans **"APIs & Services"** → **"Credentials"**
2. Cliquez sur **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Sélectionnez **"Web application"**
4. Nommez votre client (ex: "Inbox Actions Web")
5. Ajoutez les **Authorized redirect URIs** :
   ```
   http://localhost:3000/api/auth/callback/google
   https://votre-domaine.com/api/auth/callback/google
   ```
   > Note: Ajoutez l'URL de production quand vous déploierez

6. Cliquez sur **"Create"**
7. Copiez le **Client ID** et le **Client Secret** qui s'affichent

### 5. Ajouter les credentials dans .env.local

Mettez à jour votre fichier `.env.local` :

```env
GOOGLE_CLIENT_ID=votre_client_id_ici
GOOGLE_CLIENT_SECRET=votre_client_secret_ici
```

---

## GitHub OAuth

### 1. Créer une OAuth App sur GitHub

1. Allez sur [GitHub](https://github.com) et connectez-vous
2. Cliquez sur votre avatar (en haut à droite) → **Settings**
3. Dans le menu de gauche, tout en bas, cliquez sur **Developer settings**
4. Cliquez sur **OAuth Apps** → **New OAuth App**

### 2. Configurer l'OAuth App

Remplissez le formulaire :

- **Application name**: Inbox Actions
- **Homepage URL**:
  ```
  http://localhost:3000
  ```
- **Application description**: (optionnel) Gestionnaire d'actions depuis inbox
- **Authorization callback URL**:
  ```
  http://localhost:3000/api/auth/callback/github
  ```

Cliquez sur **"Register application"**

### 3. Générer un Client Secret

1. Sur la page de votre OAuth App, cliquez sur **"Generate a new client secret"**
2. Confirmez avec votre mot de passe si demandé
3. **Copiez immédiatement le client secret** (vous ne pourrez plus le voir après)

### 4. Ajouter les credentials dans .env.local

Mettez à jour votre fichier `.env.local` :

```env
GITHUB_CLIENT_ID=votre_github_client_id_ici
GITHUB_CLIENT_SECRET=votre_github_client_secret_ici
```

### 5. Ajouter le provider GitHub dans auth.config.ts

Ouvrez le fichier `auth.config.ts` et ajoutez le provider GitHub :

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

### 6. Ajouter les variables d'environnement dans env.mjs

Ouvrez le fichier `env.mjs` et ajoutez les variables GitHub :

```javascript
// Dans la section server
GITHUB_CLIENT_ID: z.string(),
GITHUB_CLIENT_SECRET: z.string(),

// Dans la section runtimeEnv
GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
```

---

## Configuration des variables d'environnement

Votre fichier `.env.local` final devrait ressembler à ça :

```env
# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000

# -----------------------------------------------------------------------------
# Authentication (NextAuth.js)
# -----------------------------------------------------------------------------
AUTH_SECRET=t6Oc1oipa076PhcRdRMdnEtmrbwPCcPS7MzsYiw8/wc=

GOOGLE_CLIENT_ID=votre_google_client_id_ici
GOOGLE_CLIENT_SECRET=votre_google_client_secret_ici

GITHUB_CLIENT_ID=votre_github_client_id_ici
GITHUB_CLIENT_SECRET=votre_github_client_secret_ici

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

## Test de l'authentification

### 1. Redémarrer le serveur de développement

```bash
pnpm dev
```

### 2. Tester les différentes méthodes d'authentification

Allez sur http://localhost:3000/login et testez :

#### Email Magic Link (Resend)
1. Entrez votre email
2. Cliquez sur "Sign in with Email"
3. Vérifiez votre boîte mail
4. Cliquez sur le lien magique

#### Google OAuth
1. Cliquez sur "Continue with Google"
2. Sélectionnez votre compte Google
3. Autorisez l'application

#### GitHub OAuth
1. Cliquez sur "Continue with GitHub"
2. Autorisez l'application GitHub

### 3. Vérification en base de données

Après une connexion réussie, vérifiez que l'utilisateur a été créé :

```bash
# Connectez-vous à PostgreSQL
psql -U inbox_admin -d inbox_actions

# Vérifiez les utilisateurs
SELECT * FROM users;

# Vérifiez les comptes OAuth
SELECT * FROM accounts;
```

---

## Dépannage

### Erreur "redirect_uri_mismatch" (Google)

- Vérifiez que l'URL de callback est exactement la même dans Google Cloud Console et dans votre application
- Format exact : `http://localhost:3000/api/auth/callback/google`
- Pas de slash final `/`

### Erreur "The redirect_uri MUST match" (GitHub)

- Même chose pour GitHub : vérifiez l'URL de callback
- Format exact : `http://localhost:3000/api/auth/callback/github`

### L'authentification ne fonctionne pas

1. Vérifiez que toutes les variables d'environnement sont définies
2. Redémarrez le serveur (`pnpm dev`)
3. Vérifiez les logs de la console pour voir les erreurs spécifiques
4. Vérifiez que la base de données est bien démarrée

### Email magic link ne fonctionne pas

- Vérifiez que votre clé API Resend est valide
- Vérifiez que l'email `EMAIL_FROM` est vérifié sur Resend
- Regardez les logs Resend pour voir si l'email a été envoyé

---

## Production

Quand vous déployez en production :

### Google OAuth
1. Ajoutez l'URL de production dans "Authorized redirect URIs" :
   ```
   https://votre-domaine.com/api/auth/callback/google
   ```

### GitHub OAuth
1. Créez une **nouvelle** OAuth App pour la production (recommandé)
2. Ou ajoutez l'URL de production dans l'app existante :
   - Homepage URL: `https://votre-domaine.com`
   - Callback URL: `https://votre-domaine.com/api/auth/callback/github`

### Variables d'environnement
- Utilisez les variables d'environnement de votre plateforme de déploiement (Vercel, Railway, etc.)
- Ne commitez **jamais** le fichier `.env.local` dans Git

---

## Ressources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth Setup](https://next-auth.js.org/providers/google)
- [GitHub OAuth Setup](https://next-auth.js.org/providers/github)
- [Resend Documentation](https://resend.com/docs)
