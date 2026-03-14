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

### Multi-boîtes indépendantes

Depuis la version 0.3.0, chaque compte Microsoft est stocké dans un enregistrement `MicrosoftGraphMailbox` **indépendant** — les tokens OAuth sont stockés directement dans ce modèle, sans lien avec la table `Account` d'Auth.js.

Un utilisateur peut connecter **plusieurs comptes Microsoft** simultanément, comme il peut le faire avec IMAP.

```
┌─────────────────────────────────────┐
│  createAllEmailProviders(userId)    │  ← Itère TOUTES les boîtes
│  lib/email-provider/factory.ts      │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴────────────┐
    │  Pour chaque mailbox  │
    ▼                       ▼
┌──────────────┐       ┌──────────────┐
│ GraphMailbox │       │ IMAPMailbox  │
│    #1        │  ...  │    #N        │
└──────────────┘       └──────────────┘
```

### Interface commune

Le provider implémente `IEmailProvider` :

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
   - **Redirect URI**: Web → `http://localhost:3000/api/microsoft-graph/callback`

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

### 4. Configurer les URIs de redirection

1. Allez dans **"Authentication"**
2. Ajoutez les URIs de redirection :
   ```
   # Pour la connexion email (boîte Microsoft)
   http://localhost:3000/api/microsoft-graph/callback
   https://votre-domaine.com/api/microsoft-graph/callback

   # Pour le login Auth.js (si login Microsoft activé)
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   https://votre-domaine.com/api/auth/callback/microsoft-entra-id
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

NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true
```

---

## Fonctionnement

### Séparation Login / Connexion Email

**Important** : L'authentification (login) est indépendante de la connexion email.

- **Login** : géré par Auth.js (Google, Microsoft, Credentials)
- **Boîte email Microsoft** : configurée séparément dans les Paramètres, via `/api/microsoft-graph/connect`

Un utilisateur connecté avec Google (ou toute autre méthode) peut ajouter un ou plusieurs comptes Microsoft pour la synchronisation email.

### Flux d'ajout d'une boîte Microsoft

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
                               │  Upsert par (userId, microsoftAccountId)
                               ▼
              ┌─────────────────────────────────────────────────┐
              │        MicrosoftGraphMailbox (Prisma)            │
              │  - accessToken                                   │
              │  - refreshToken                                  │
              │  - expiresAt                                     │
              │  - email, label                                  │
              │  - isConnected, connectionError                  │
              │  - deltaLink (sync incrémental)                  │
              └─────────────────────────────────────────────────┘
```

### Protection contre les conflits

- Un même compte Microsoft ne peut pas être configuré par deux utilisateurs différents
- La vérification se fait lors du callback OAuth (`userId != current_user`)
- Retour d'erreur explicite si conflit détecté

### Exclusivité avec IMAP

Les boîtes IMAP et Microsoft coexistent — un utilisateur peut avoir à la fois des boîtes IMAP et des boîtes Microsoft. La synchronisation itère toutes les boîtes actives.

---

## Modèle de données

### MicrosoftGraphMailbox

```prisma
model MicrosoftGraphMailbox {
  id                 String    @id @default(cuid())
  userId             String
  microsoftAccountId String    // OID du compte Microsoft

  label        String?   // Surnom optionnel
  email        String?   // Adresse email Microsoft

  // Tokens OAuth (stockés ici, indépendants d'Account)
  accessToken  String?   @db.Text
  refreshToken String?   @db.Text
  expiresAt    Int?      // Unix timestamp

  // Sync incrémental
  deltaLink    String?   @db.Text
  lastSync     DateTime?

  // Statut
  isActive        Boolean   @default(true)
  isConnected     Boolean   @default(false)
  connectionError String?
  lastErrorAt     DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, microsoftAccountId])  // Un compte par utilisateur
  @@index([userId])
  @@index([isActive])
}
```

### EmailMetadata (champs réutilisés)

```prisma
model EmailMetadata {
  emailProvider  EmailProvider  // MICROSOFT_GRAPH
  mailboxId      String?        // ID du MicrosoftGraphMailbox

  // Champs réutilisés pour Graph
  gmailMessageId String?        // Graph message ID
  gmailThreadId  String?        // Graph conversationId
}
```

---

## API Endpoints

### Statut

```bash
GET /api/microsoft-graph/status

# Réponse
{
  "microsoftOAuthEnabled": true,
  "mailboxes": [
    {
      "id": "cuid...",
      "label": null,
      "email": "user@outlook.com",
      "isConnected": true,
      "connectionError": null,
      "lastSync": "2026-03-10T08:00:00Z"
    }
  ]
}
```

### Initier la connexion OAuth

```bash
GET /api/microsoft-graph/connect

# Réponse
{
  "authUrl": "https://login.microsoftonline.com/..."
}
# L'utilisateur est redirigé vers Microsoft pour autoriser Mail.Read
# Callback: /api/microsoft-graph/callback
```

### Supprimer une boîte

```bash
POST /api/microsoft-graph/disconnect
Content-Type: application/json

{ "mailboxId": "cuid..." }

# Réponse
{ "success": true, "message": "Microsoft mailbox disconnected" }
```

### Synchronisation manuelle

```bash
POST /api/microsoft-graph/sync

# Réponse
{
  "success": true,
  "synced": 15,
  "message": "15 emails synchronisés"
}
```

---

## Gestion des tokens

### Refresh automatique

Le helper `getMicrosoftGraphTokenForMailbox(mailboxId)` gère le cycle de vie des tokens :

1. Lit le token depuis `MicrosoftGraphMailbox`
2. Si expiré ou expirant dans < 5 minutes → refresh automatique
3. En cas d'échec du refresh → marque `isConnected: false` + `connectionError`
4. L'UI affiche alors un bouton "Reconnecter" pour relancer le flux OAuth

```typescript
const accessToken = await getMicrosoftGraphTokenForMailbox(mailboxId);
if (!accessToken) {
  // Token invalide — l'utilisateur doit se reconnecter
}
```

### Gestion 401 dans les requêtes Graph

Si l'API Microsoft retourne 401, `MicrosoftGraphService` tente un refresh automatique avant de relancer la requête.

---

## Sync incrémental (Delta Query)

Pour optimiser les performances, le système utilise les delta queries Microsoft Graph :

```
Premier sync :
GET /me/mailFolders/inbox/messages?$filter=receivedDateTime ge ...
→ Stocke @odata.deltaLink dans MicrosoftGraphMailbox.deltaLink

Syncs suivants :
GET {deltaLink}
→ Retourne uniquement les changements depuis le dernier sync
→ Met à jour le deltaLink
```

**Important** : Si le `deltaLink` est invalide (token expiré trop longtemps), Graph retourne 410 Gone. Dans ce cas, effacer `deltaLink` en base pour forcer un full sync.

---

## Rate Limiting

| Limite | Valeur |
|--------|--------|
| Requêtes/10 min/mailbox | 10 000 |
| Requêtes concurrentes | 4 |

Le service gère automatiquement les erreurs 429 avec retry et exponential backoff (jusqu'à 3 tentatives).

---

## Troubleshooting

### Erreur "AADSTS70011: invalid_scope"

**Cause** : Le scope `Mail.Read` n'est pas configuré dans Azure Portal.

**Solution** :
1. Vérifiez les permissions dans Azure Portal → API permissions
2. Assurez-vous que `Mail.Read` est ajouté comme permission déléguée
3. Si admin, cliquez "Grant admin consent"

### Erreur "token_refresh_failed"

**Cause** : Le refresh token a expiré ou été révoqué.

**Solution** : L'utilisateur doit se reconnecter via le bouton "Reconnecter" dans les Paramètres.

### Erreur "issuer does not match expectedIssuer"

**Cause** : Le tenant ID ne correspond pas au type de compte.

**Solution** :
- Comptes personnels : `MICROSOFT_TENANT_ID=consumers`
- Comptes organisation : GUID du tenant ou `common`

### Emails non récupérés après reset

Si vous videz `EmailMetadata` et réinitialisez `lastSync`, il faut aussi effacer `deltaLink` en base — sinon Graph ne retourne rien (déjà "vu" via le delta).

```sql
UPDATE microsoft_graph_mailboxes SET delta_link = NULL WHERE id = '...';
```

---

## Comparaison avec IMAP

| Critère | Microsoft Graph | IMAP |
|---------|-----------------|------|
| Configuration | Automatique (OAuth) | Manuelle (App Password) |
| Multi-comptes | ✅ | ✅ |
| Sync incrémental | Delta query (natif) | UID comparison |
| Rate limiting | 10k req/10min | Dépend du provider |
| Providers supportés | Microsoft uniquement | Gmail, Yahoo, iCloud, etc. |
| Tokens | Stockés dans `MicrosoftGraphMailbox` | Password chiffré dans `IMAPCredential` |

---

## Ressources

- [Microsoft Graph API - Mail](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Microsoft Graph - Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Auth.js - Microsoft Entra ID](https://authjs.dev/getting-started/providers/microsoft-entra-id)
- [Azure Portal](https://portal.azure.com)

---

**Dernière mise à jour** : 13 mars 2026
**Version** : 0.3.0
