# Microsoft Graph API Integration

Cette documentation décrit l'intégration Microsoft Graph API pour l'accès aux emails Microsoft (Outlook.com, Hotmail, Live.com, Microsoft 365).

---

## Vue d'ensemble

Pour les comptes Microsoft, Inbox Actions utilise **Microsoft Graph API** pour accéder aux emails. Cette méthode offre une expérience utilisateur optimale : aucune configuration IMAP n'est nécessaire.

| Méthode | Avantages |
|---------|-----------|
| **Microsoft Graph API** | Aucune configuration utilisateur, delta query efficace, accès natif |

### Pourquoi Graph API ?

| Alternative | Problème |
|-------------|----------|
| App Password | Déprécié pour les comptes personnels Microsoft depuis septembre 2024 |
| IMAP + OAuth | Requiert l'activation manuelle d'IMAP dans Outlook.com |
| **Graph API** | Aucune configuration côté utilisateur |

---

## Architecture

### Factory Pattern

Le système utilise un pattern Factory pour abstraire le provider email :

```
┌─────────────────────────────────────┐
│  createEmailProvider(userId)        │  ← Point d'entrée unique
│  lib/email-provider/factory.ts      │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ MicrosoftGraph│  │ IMAPProvider │
│   Provider    │  │              │
└──────────────┘  └──────────────┘
```

### Interface commune

Le provider implémente `IEmailProvider` :

```typescript
interface IEmailProvider {
  providerType: EmailProvider; // "MICROSOFT_GRAPH"

  fetchNewEmails(options?: FetchOptions): Promise<EmailMetadata[]>;
  getEmailBodyForAnalysis(messageId: string | bigint): Promise<string | null>;
  getExtractedEmails(): Promise<EmailMetadata[]>;
  markEmailAsAnalyzed(messageId: string | bigint): Promise<void>;
  countNewEmails(): Promise<number>;
  disconnect(): Promise<void>;
  getStatus(): Promise<ConnectionStatus>;
}
```

---

## Configuration Azure

### 1. Créer une application Azure AD

1. Allez sur [Azure Portal](https://portal.azure.com)
2. Recherchez **"App registrations"**
3. Cliquez sur **"New registration"**
4. Remplissez :
   - **Name**: Inbox Actions
   - **Supported account types**:
     - Pour comptes personnels : "Personal Microsoft accounts only"
     - Pour organisations : "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: Web → `http://localhost:3000/api/auth/callback/microsoft-entra-id`

### 2. Configurer les permissions API

1. Allez dans **"API permissions"**
2. Cliquez sur **"Add a permission"**
3. Sélectionnez **"Microsoft Graph"**
4. Choisissez **"Delegated permissions"**
5. Ajoutez ces permissions :
   - `openid`
   - `email`
   - `profile`
   - `offline_access` (pour le refresh token)
   - `Mail.Read` (accès lecture aux emails)

### 3. Créer un secret client

1. Allez dans **"Certificates & secrets"**
2. Cliquez sur **"New client secret"**
3. Donnez une description et une durée de validité
4. **Copiez immédiatement la valeur** (pas l'ID)

### 4. Configurer l'authentification

1. Allez dans **"Authentication"**
2. Ajoutez les URIs de redirection :
   ```
   # Pour le login Auth.js
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   https://votre-domaine.com/api/auth/callback/microsoft-entra-id

   # Pour la connexion email (séparée du login)
   http://localhost:3000/api/microsoft-graph/callback
   https://votre-domaine.com/api/microsoft-graph/callback
   ```
3. Cochez "Access tokens" et "ID tokens" dans "Implicit grant and hybrid flows"

### 5. Variables d'environnement

```env
# Microsoft OAuth + Graph API
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=votre_secret_value
MICROSOFT_TENANT_ID=consumers    # Pour comptes personnels
# ou
MICROSOFT_TENANT_ID=common       # Pour comptes perso + organisation
# ou
MICROSOFT_TENANT_ID=<guid>       # Pour un tenant spécifique

NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true
```

---

## Fonctionnement

### Séparation Login / Connexion Email

**Important** : L'authentification (login) est séparée de la connexion email.

- **Login Microsoft** : Scopes basiques (`openid`, `email`, `profile`, `offline_access`)
- **Connexion Email** : Demande explicite du scope `Mail.Read` via `/api/microsoft-graph/connect`

Cette séparation permet à un utilisateur connecté avec Google ou credentials d'ajouter un compte Microsoft pour la synchronisation email.

### Flux de connexion email

```
┌──────────────┐    ┌─────────────────┐    ┌────────────────┐
│ Settings     │───►│ /api/microsoft- │───►│ Microsoft      │
│ Page         │    │ graph/connect   │    │ OAuth          │
└──────────────┘    └─────────────────┘    │ (Mail.Read)    │
                                           └───────┬────────┘
                                                   │
                    ┌─────────────────┐            │
                    │ /api/microsoft- │◄───────────┘
                    │ graph/callback  │
                    └────────┬────────┘
                             │
                             ▼
              ┌─────────────────────────────────────────────────┐
              │           Account table (Prisma)                 │
              │  - access_token                                 │
              │  - refresh_token                                │
              │  - expires_at                                   │
              │  - scope: "...Mail.Read..."                     │
              └─────────────────────────────────────────────────┘
```

### Cas d'utilisation

| Connexion App | Connexion Email | Résultat |
|---------------|-----------------|----------|
| Google | Microsoft Graph | ✅ L'utilisateur connecté avec Google peut ajouter un compte Microsoft pour les emails |
| Microsoft | Microsoft Graph | ✅ L'utilisateur doit autoriser Mail.Read séparément dans les paramètres |
| Credentials | Microsoft Graph | ✅ L'utilisateur peut ajouter un compte Microsoft pour les emails |
| Google | IMAP | ✅ Alternative possible avec n'importe quel provider |

### Exclusivité mutuelle des providers

**Important** : Un seul provider email peut être actif à la fois.

- **Connecter Microsoft Graph** → Supprime automatiquement les credentials IMAP
- **Connecter IMAP** → Supprime automatiquement le scope Mail.Read de Microsoft

Cette exclusivité garantit qu'un seul provider est utilisé pour la synchronisation, évitant les conflits et la confusion.

### Sync des emails

Le service Microsoft Graph effectue :

1. **Fetch des nouveaux emails** via `/me/messages`
2. **Delta query** pour sync incrémental via `/me/mailFolders/inbox/messages/delta`
3. **Récupération du body** via `/me/messages/{id}?$select=body`

```typescript
// Utilisation
const graphService = await createMicrosoftGraphService(userId);

// Sync des nouveaux emails
const emails = await graphService.fetchNewEmails({ maxResults: 100 });

// Récupération du corps pour analyse
const body = await graphService.getEmailBodyForAnalysis(messageId);

// Marquer comme analysé
await graphService.markEmailAsAnalyzed(messageId);
```

### Delta Query (sync incrémental)

Pour optimiser les performances, le système utilise les delta queries :

```typescript
// Premier sync : récupère tous les emails récents
GET /me/mailFolders/inbox/messages/delta

// Réponse contient @odata.deltaLink
// Stocké dans user.microsoftDeltaLink

// Syncs suivants : uniquement les changements
GET {user.microsoftDeltaLink}
```

---

## Modèle de données

### Champs User (Prisma)

```prisma
model User {
  // Email provider preference
  emailProvider        EmailProvider?  // MICROSOFT_GRAPH, IMAP, etc.

  // Sync tracking (universel pour tous les providers)
  lastEmailSync        DateTime?       // Dernière synchronisation

  // Microsoft Graph specific
  microsoftDeltaLink   String? @db.Text // Delta link pour sync incrémental
}
```

### EmailMetadata

```prisma
model EmailMetadata {
  // Provider
  emailProvider  EmailProvider  // MICROSOFT_GRAPH

  // Microsoft Graph identifiers
  gmailMessageId String?        // Réutilisé pour Graph message ID
  gmailThreadId  String?        // Réutilisé pour Graph conversationId

  // Métadonnées communes
  from           String
  subject        String?
  snippet        String
  receivedAt     DateTime
}
```

---

## API Endpoints

### Statut Microsoft Graph

```bash
GET /api/microsoft-graph/status

# Réponse (non connecté)
{
  "configured": false,
  "hasMailReadScope": false,
  "hasAccount": false,
  "microsoftOAuthEnabled": true,
  "message": "No Microsoft account linked"
}

# Réponse (connecté avec Mail.Read)
{
  "configured": true,
  "hasMailReadScope": true,
  "hasAccount": true,
  "microsoftOAuthEnabled": true,
  "isConnected": true,
  "email": "user@outlook.com",
  "lastSync": "2026-02-01T10:00:00Z",
  "hasDeltaLink": true,
  "stats": {
    "totalEmails": 150,
    "pendingAnalysis": 5
  }
}
```

### Connexion Email Microsoft (OAuth)

```bash
GET /api/microsoft-graph/connect

# Réponse
{
  "authUrl": "https://login.microsoftonline.com/..."
}

# L'utilisateur est redirigé vers Microsoft pour autoriser Mail.Read
# Callback: /api/microsoft-graph/callback
```

### Activer Microsoft Graph

```bash
POST /api/microsoft-graph/activate

# Réponse
{
  "success": true,
  "message": "Microsoft Graph activé"
}
```

### Synchronisation manuelle

```bash
POST /api/microsoft-graph/sync

# Réponse
{
  "success": true,
  "count": 15,
  "message": "15 emails synchronisés"
}
```

---

## Rate Limiting

Microsoft Graph a des limites de requêtes :

| Limite | Valeur |
|--------|--------|
| Requêtes/10 min/mailbox | 10,000 |
| Requêtes concurrentes | 4 |

Le service gère automatiquement les erreurs 429 avec retry exponential backoff :

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After") || "60";
  await sleep(parseInt(retryAfter) * 1000);
  return graphRequest(endpoint); // Retry
}
```

---

## Troubleshooting

### Erreur "AADSTS70011: invalid_scope"

**Cause** : Le scope Mail.Read n'est pas correctement configuré.

**Solution** :
1. Vérifiez les permissions dans Azure Portal
2. Assurez-vous que `Mail.Read` est ajouté comme permission déléguée
3. Si admin, cliquez "Grant admin consent"

### Erreur "token_refresh_failed"

**Cause** : Le refresh token a expiré ou été révoqué.

**Solution** :
1. L'utilisateur doit se reconnecter via Microsoft OAuth
2. Vérifiez que `offline_access` est dans les scopes

### Erreur "issuer does not match expectedIssuer"

**Cause** : Le tenant ID ne correspond pas au type de compte.

**Solution** :
- Pour comptes personnels : `MICROSOFT_TENANT_ID=consumers`
- Pour comptes organisation : utilisez le GUID du tenant

### Emails non synchronisés

**Vérifications** :
1. Le scope `Mail.Read` est-il présent dans le token ?
2. L'utilisateur a-t-il autorisé l'accès aux emails ?
3. Le deltaLink est-il corrompu ? (Reset avec `/api/microsoft-graph/reset-delta`)

---

## Comparaison avec IMAP

| Critère | Microsoft Graph | IMAP |
|---------|-----------------|------|
| Configuration | Automatique | Manuelle (App Password) |
| Authentification | OAuth2 | Password |
| Sync incrémental | Delta query (natif) | UID comparison |
| Rate limiting | 10k req/10min | Dépend du provider |
| Providers supportés | Microsoft uniquement | Tous |

---

## Ressources

- [Microsoft Graph API - Mail](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Microsoft Graph - Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Auth.js - Microsoft Entra ID](https://authjs.dev/getting-started/providers/microsoft-entra-id)
- [Azure Portal](https://portal.azure.com)

---

**Dernière mise à jour** : 6 février 2026
