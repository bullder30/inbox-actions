# Configuration de l'authentification

Ce guide explique comment configurer les différentes méthodes d'authentification pour Inbox Actions.

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Authentification Email/Mot de passe](#authentification-emailmot-de-passe)
- [Google OAuth](#google-oauth)
- [Microsoft OAuth](#microsoft-oauth)
- [Configuration IMAP](#configuration-imap)
- [Variables d'environnement](#variables-denvironnement)
- [Dépannage](#dépannage)

---

## Vue d'ensemble

Inbox Actions propose 3 méthodes d'authentification :

| Méthode | Accès Email | Configuration |
|---------|-------------|---------------|
| **Email/Mot de passe** | IMAP manuel | Simple, universel |
| **Google OAuth** | Gmail API (automatique) | Recommandé pour Gmail |
| **Microsoft OAuth** | IMAP OAuth2 (automatique) | Recommandé pour Microsoft 365 |

### Flux utilisateur

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inscription / Connexion                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Email/MDP    │  │ Google OAuth │  │ Microsoft OAuth      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Config IMAP  │  │ Gmail API    │  │ IMAP OAuth2 auto     │   │
│  │ manuelle     │  │ automatique  │  │ (outlook.office365)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentification Email/Mot de passe

### Configuration

L'authentification par email/mot de passe est toujours disponible. Aucune configuration supplémentaire n'est requise.

### Utilisation

1. Aller sur `/register`
2. Entrer nom, email, mot de passe
3. Le compte est créé avec un mot de passe hashé (bcrypt)

### Lien avec OAuth

Si un utilisateur s'inscrit par email/mot de passe puis se connecte avec Google/Microsoft (même email), les comptes sont automatiquement liés.

---

## Google OAuth

### Prérequis

- Un compte Google Cloud
- Un projet Google Cloud

### 1. Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Cliquez sur **"Select a project"** → **"New Project"**
3. Nommez votre projet (ex: "Inbox Actions")
4. Cliquez sur **"Create"**

### 2. Activer Gmail API

1. Dans le menu, allez dans **"APIs & Services"** → **"Library"**
2. Recherchez **"Gmail API"**
3. Cliquez sur **"Enable"**

### 3. Configurer l'écran de consentement OAuth

1. Allez dans **"APIs & Services"** → **"OAuth consent screen"**
2. Sélectionnez **"External"**
3. Remplissez les informations :
   - **App name**: Inbox Actions
   - **User support email**: votre email
   - **Developer contact**: votre email
4. **Scopes** : Ajoutez :
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
5. Ajoutez des utilisateurs de test si en mode "Testing"

### 4. Créer les credentials OAuth 2.0

1. Allez dans **"APIs & Services"** → **"Credentials"**
2. Cliquez sur **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Sélectionnez **"Web application"**
4. Ajoutez les **Authorized redirect URIs** :
   ```
   http://localhost:3000/api/auth/callback/google
   https://votre-domaine.com/api/auth/callback/google
   ```
5. Copiez le **Client ID** et le **Client Secret**

### 5. Variables d'environnement

```env
# Google OAuth
GOOGLE_CLIENT_ID=votre_client_id
GOOGLE_CLIENT_SECRET=votre_client_secret
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true
```

---

## Microsoft OAuth

### Prérequis

- Un compte Microsoft Azure
- Un tenant Azure AD (personnel ou organisation)

### 1. Créer une application Azure AD

1. Allez sur [Azure Portal](https://portal.azure.com)
2. Recherchez **"App registrations"**
3. Cliquez sur **"New registration"**
4. Remplissez :
   - **Name**: Inbox Actions
   - **Supported account types**: Choisissez selon vos besoins
     - "Accounts in this organizational directory only" (mono-tenant)
     - "Accounts in any organizational directory" (multi-tenant)
     - "Personal Microsoft accounts" (comptes personnels)
   - **Redirect URI**: Web → `http://localhost:3000/api/auth/callback/microsoft-entra-id`
5. Cliquez sur **"Register"**

### 2. Récupérer les identifiants

Sur la page de l'application :

1. **Application (client) ID** → Notez-le (c'est le `MICROSOFT_CLIENT_ID`)
2. **Directory (tenant) ID** → Notez-le (c'est le `MICROSOFT_TENANT_ID`)

### 3. Créer un secret client

1. Allez dans **"Certificates & secrets"**
2. Cliquez sur **"New client secret"**
3. Donnez une description et une durée de validité
4. **Copiez immédiatement la valeur** (pas l'ID) → C'est le `MICROSOFT_CLIENT_SECRET`

### 4. Configurer les permissions API

1. Allez dans **"API permissions"**
2. Cliquez sur **"Add a permission"**
3. Ajoutez ces permissions :

**Microsoft Graph :**
- `openid` (déléguée)
- `email` (déléguée)
- `profile` (déléguée)
- `offline_access` (déléguée) - **Important pour le refresh token**

**Office 365 Exchange Online :**
- `IMAP.AccessAsUser.All` (déléguée) - **Pour l'accès IMAP OAuth2**

4. Cliquez sur **"Grant admin consent"** si vous êtes admin du tenant

### 5. Configurer l'authentification

1. Allez dans **"Authentication"**
2. Vérifiez que l'URI de redirection est présente :
   ```
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   ```
3. Pour la production, ajoutez :
   ```
   https://votre-domaine.com/api/auth/callback/microsoft-entra-id
   ```

### 6. Variables d'environnement

```env
# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=votre_secret_value
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true
```

### Note importante sur le Tenant ID

- **Ne pas utiliser "common"** comme tenant ID - cela cause des erreurs de validation d'issuer
- Utilisez toujours votre **vrai tenant ID** (GUID)
- Le tenant ID se trouve dans Azure Portal → Azure Active Directory → Overview

---

## Configuration IMAP

### Option 1 : IMAP OAuth2 (Microsoft 365)

Après connexion avec Microsoft OAuth, configurez IMAP automatiquement :

```bash
# Via API
POST /api/imap/setup-oauth
{
  "provider": "microsoft-entra-id"
}
```

Cela :
1. Crée automatiquement les credentials IMAP
2. Configure `outlook.office365.com:993`
3. Active l'authentification OAuth2 (XOAUTH2)
4. Les tokens sont automatiquement rafraîchis

### Option 2 : IMAP avec App Password

Pour les comptes personnels ou quand OAuth2 n'est pas disponible :

**Gmail :**
1. Activez la validation en 2 étapes sur votre compte Google
2. Générez un mot de passe d'application : [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Configurez IMAP :
   - Serveur : `imap.gmail.com`
   - Port : `993`
   - TLS : Oui
   - Mot de passe : Le mot de passe d'application généré

**Outlook.com (personnel) :**
1. Activez la validation en 2 étapes
2. Générez un mot de passe d'application : [https://account.live.com/proofs/AppPassword](https://account.live.com/proofs/AppPassword)
3. Configurez IMAP :
   - Serveur : `outlook.office365.com`
   - Port : `993`
   - TLS : Oui
   - Mot de passe : Le mot de passe d'application généré

### Presets IMAP disponibles

| Provider | Serveur | Port | TLS |
|----------|---------|------|-----|
| Gmail | imap.gmail.com | 993 | Oui |
| Outlook/Office 365 | outlook.office365.com | 993 | Oui |
| Yahoo | imap.mail.yahoo.com | 993 | Oui |
| iCloud | imap.mail.me.com | 993 | Oui |
| ProtonMail (Bridge) | 127.0.0.1 | 1143 | Non |
| Fastmail | imap.fastmail.com | 993 | Oui |

---

## Variables d'environnement

### Fichier `.env.local` complet

```env
# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000

# -----------------------------------------------------------------------------
# Authentication (NextAuth.js)
# -----------------------------------------------------------------------------
AUTH_SECRET=votre_secret_genere_aleatoirement

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false

# Microsoft OAuth (optionnel)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=false

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------
DATABASE_URL='postgresql://user:password@localhost:5432/inbox_actions'

# -----------------------------------------------------------------------------
# Email (Resend) - Pour les notifications
# -----------------------------------------------------------------------------
RESEND_API_KEY=
EMAIL_FROM="Inbox Actions <noreply@inbox-actions.com>"

# -----------------------------------------------------------------------------
# IMAP (pour le chiffrement des mots de passe)
# -----------------------------------------------------------------------------
IMAP_MASTER_KEY=votre_cle_256_bits_en_hex
```

### Génération des secrets

```bash
# AUTH_SECRET (32 bytes base64)
openssl rand -base64 32

# IMAP_MASTER_KEY (256 bits hex)
openssl rand -hex 32
```

---

## Dépannage

### Erreur "issuer does not match expectedIssuer" (Microsoft)

**Cause :** Le tenant ID est invalide ou vous utilisez "common".

**Solution :**
1. Utilisez votre vrai tenant ID (GUID), pas "common"
2. Trouvez-le dans Azure Portal → Azure Active Directory → Overview → Tenant ID

### Erreur "redirect_uri_mismatch"

**Cause :** L'URL de callback ne correspond pas.

**Solution :**
1. Vérifiez l'URL exacte dans Azure/Google Console
2. Format : `http://localhost:3000/api/auth/callback/[provider]`
3. Pas de slash final
4. Respectez la casse

### Erreur "AADSTS50011" (Microsoft)

**Cause :** URI de redirection non configurée.

**Solution :**
1. Ajoutez dans Azure Portal → App registrations → Authentication
2. URI : `http://localhost:3000/api/auth/callback/microsoft-entra-id`

### Token IMAP OAuth2 expiré

**Cause :** Le refresh token a échoué.

**Solution :**
1. Vérifiez que le scope `offline_access` est présent
2. Reconnectez-vous avec Microsoft pour obtenir un nouveau token
3. Vérifiez les logs : `[OAuth] Token refresh failed`

### Boutons OAuth non affichés

**Cause :** Variables d'environnement non définies.

**Solution :**
1. Vérifiez que `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` ou `NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true`
2. Redémarrez le serveur après modification des `.env`

---

## Ressources

- [Auth.js (NextAuth v5) Documentation](https://authjs.dev/)
- [Google OAuth Setup](https://authjs.dev/getting-started/providers/google)
- [Microsoft Entra ID Setup](https://authjs.dev/getting-started/providers/microsoft-entra-id)
- [Azure Portal](https://portal.azure.com)
- [Google Cloud Console](https://console.cloud.google.com)
