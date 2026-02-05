# Intégration IMAP

Cette documentation décrit l'intégration IMAP pour la connexion email dans Inbox Actions (Gmail, Yahoo, iCloud, Fastmail, ProtonMail...).

---

## Vue d'ensemble

Pour les providers non-Microsoft, Inbox Actions utilise **IMAP avec App Password** pour accéder aux emails. Cette méthode est universelle et fonctionne avec tous les fournisseurs email.

| Provider | Méthode recommandée |
|----------|---------------------|
| **Microsoft (Outlook, Hotmail, Live)** | Microsoft Graph API ([voir doc](./MICROSOFT_GRAPH.md)) |
| **Gmail, Yahoo, iCloud, Fastmail, ProtonMail...** | IMAP avec App Password |

### Exclusivité mutuelle

**Important** : Un seul provider email peut être actif à la fois.

- **Connecter IMAP** → Supprime automatiquement le scope Mail.Read de Microsoft Graph
- **Connecter Microsoft Graph** → Supprime automatiquement les credentials IMAP

Cette exclusivité évite les conflits et garantit qu'un seul provider est utilisé pour la synchronisation.

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
  providerType: EmailProvider; // "IMAP"

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

## Configuration IMAP

### Providers supportés

| Provider | Serveur IMAP | Port | TLS |
|----------|--------------|------|-----|
| Gmail | imap.gmail.com | 993 | Oui |
| Yahoo | imap.mail.yahoo.com | 993 | Oui |
| iCloud | imap.mail.me.com | 993 | Oui |
| Fastmail | imap.fastmail.com | 993 | Oui |
| ProtonMail | 127.0.0.1 (via Bridge) | 1143 | Non |

> **Note** : Pour Microsoft (Outlook, Hotmail, Live), utilisez [Microsoft Graph API](./MICROSOFT_GRAPH.md) - pas de configuration IMAP nécessaire.

### Détection automatique

Le système détecte automatiquement le provider depuis l'adresse email :

```typescript
// lib/imap/types.ts
export function detectProviderFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();

  if (domain === "gmail.com") return "gmail";
  if (domain === "yahoo.com") return "yahoo";
  if (domain === "icloud.com" || domain === "me.com") return "icloud";
  // Microsoft → redirige vers Graph API
  if (["outlook.com", "hotmail.com", "live.com"].includes(domain)) {
    return "microsoft"; // Signal pour utiliser Graph API
  }
  return null;
}
```

---

## Sécurité

### Chiffrement des mots de passe

Les mots de passe IMAP sont chiffrés avec **AES-256-CBC** :

```typescript
// lib/imap/imap-credentials.ts
export function encryptPassword(plainPassword: string): string {
  const masterKey = getMasterKey(); // IMAP_MASTER_KEY env var
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", masterKey, iv);
  // ...
}
```

### Variable d'environnement requise

```bash
# Générer une clé maître (64 caractères hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ajouter à .env.local
IMAP_MASTER_KEY=<votre_clé_64_caractères>
```

### Configuration des App Passwords

Un **App Password** est un mot de passe spécial généré par votre fournisseur email. Il permet l'accès IMAP sans utiliser votre mot de passe principal.

#### Gmail

1. Activez la validation en 2 étapes sur votre compte Google
2. Allez sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Sélectionnez "Mail" et "Autre (nom personnalisé)"
4. Nommez-le "Inbox Actions"
5. Copiez le mot de passe généré (16 caractères sans espaces)
6. **Important** : Activez IMAP dans Gmail → Paramètres → Tous les paramètres → Transfert et POP/IMAP

#### Yahoo Mail

1. Activez la vérification en 2 étapes
2. Allez sur [login.yahoo.com/account/security](https://login.yahoo.com/account/security)
3. "Générer un mot de passe d'application"
4. Sélectionnez "Autre application"
5. Copiez le mot de passe généré

#### iCloud Mail

1. Activez l'authentification à deux facteurs
2. Allez sur [appleid.apple.com](https://appleid.apple.com)
3. "Sécurité" → "Mots de passe d'application"
4. Cliquez sur "+" pour générer un nouveau mot de passe
5. Copiez le mot de passe généré

#### Fastmail

1. Allez dans Paramètres → Mots de passe et sécurité
2. "Nouveaux mots de passe d'application"
3. Créez un mot de passe pour "IMAP"
4. Copiez le mot de passe généré

#### ProtonMail

ProtonMail nécessite le **ProtonMail Bridge** pour l'accès IMAP :

1. Téléchargez et installez [ProtonMail Bridge](https://protonmail.com/bridge)
2. Connectez-vous dans Bridge
3. Cliquez sur votre compte pour voir les identifiants IMAP
4. Utilisez le mot de passe affiché dans Bridge
5. **Host** : 127.0.0.1, **Port** : 1143, **TLS** : Non

---

## Modèle de données

### Table IMAPCredential

```prisma
model IMAPCredential {
  id              String   @id @default(cuid())
  userId          String

  // Configuration IMAP
  imapHost        String   // ex: "imap.gmail.com"
  imapPort        Int      @default(993)
  imapUsername    String   // Email ou username
  imapPassword    String   @db.Text // Chiffré AES-256

  // Configuration
  imapFolder      String   @default("INBOX")
  useTLS          Boolean  @default(true)
  authMethod      IMAPAuthMethod @default(PASSWORD)

  // Tracking synchronisation
  lastIMAPSync    DateTime?
  lastUID         BigInt?  // Dernier UID synchronisé

  // Status connexion
  isConnected     Boolean  @default(false)
  connectionError String?
  lastErrorAt     DateTime?

  user User @relation(...)

  @@unique([userId, imapHost, imapUsername])
}
```

### Champ emailProvider (User)

```prisma
model User {
  // ...
  emailProvider EmailProvider? // IMAP, MICROSOFT_GRAPH, etc.
}
```

### EmailMetadata

```prisma
model EmailMetadata {
  // Provider
  emailProvider  EmailProvider

  // IMAP identifiers
  imapUID        BigInt?
  imapMessageId  String?

  // Métadonnées communes
  from           String
  subject        String?
  snippet        String
  receivedAt     DateTime
  labels         String[]

  @@unique([userId, imapUID])
}
```

---

## API Endpoints

### Configuration IMAP

```bash
# Tester et configurer la connexion IMAP
POST /api/imap/connect
Content-Type: application/json

{
  "imapUsername": "user@gmail.com",
  "imapPassword": "xxxx xxxx xxxx xxxx",
  "imapHost": "imap.gmail.com",
  "imapPort": 993,
  "useTLS": true,
  "imapFolder": "INBOX"
}
```

### Statut IMAP

```bash
# Vérifier le statut de la connexion IMAP
GET /api/imap/status

# Réponse
{
  "configured": true,
  "host": "imap.gmail.com",
  "username": "user@gmail.com",
  "folder": "INBOX",
  "isConnected": true,
  "lastSync": "2026-02-01T10:00:00Z"
}
```

### Déconnexion IMAP

```bash
# Supprimer les credentials IMAP
POST /api/imap/disconnect

# Réponse
{
  "success": true,
  "message": "IMAP déconnecté"
}
```

### Synchronisation et analyse

| Endpoint | Description |
|----------|-------------|
| `GET /api/email/sync` | Synchroniser les emails via IMAP |
| `POST /api/email/analyze` | Analyser et extraire les actions |
| `GET /api/email/status` | Statut de connexion |
| `GET /api/email/pending-count` | Compter les emails en attente |

---

## Composants UI

### Page Settings

Dans `app/(protected)/settings/page.tsx`, l'utilisateur peut configurer sa connexion IMAP.

### IMAPConnectForm

Formulaire de configuration IMAP avec :
- Détection automatique du provider depuis l'adresse email
- Presets pour les providers courants
- Redirection vers Microsoft Graph pour les emails Microsoft
- Instructions spécifiques par provider
- Validation des credentials
- Affichage des erreurs

### IMAPStatus

Affiche le statut de la connexion :
- Host et username
- État de connexion (badge coloré)
- Dernière synchronisation
- Erreurs éventuelles
- Boutons Modifier / Supprimer

---

## Cron Jobs

Le job de synchronisation quotidienne :

```typescript
// lib/cron/daily-sync-job.ts
export async function runDailySyncJob() {
  // Récupérer les utilisateurs IMAP connectés
  const usersWithIMAP = await prisma.iMAPCredential.findMany({
    where: { isConnected: true }
  });

  // Pour chaque utilisateur, synchroniser via IMAP
  for (const credential of usersWithIMAP) {
    const imapService = await createIMAPService(credential.userId);
    await imapService.fetchNewEmails();
    // ...
  }
}
```

---

## Troubleshooting

### Erreur "Authentication failed"

1. Vérifiez que l'App Password est correct (sans espaces)
2. Pour Gmail : vérifiez que l'accès IMAP est activé dans les paramètres Gmail
3. Vérifiez que la vérification en 2 étapes est activée sur votre compte
4. Certains fournisseurs bloquent les connexions depuis de nouvelles applications - vérifiez votre boîte mail pour une alerte de sécurité

### Erreur "Connection refused"

1. Vérifiez le host et le port
2. Vérifiez que TLS est activé (port 993)
3. Vérifiez votre firewall / antivirus
4. Pour ProtonMail : vérifiez que Bridge est lancé

### Erreur "IMAP_MASTER_KEY not set"

Générez et configurez la clé de chiffrement :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Ajouter le résultat à .env.local
IMAP_MASTER_KEY=<votre_clé>
```

### Gmail : "IMAP access is not enabled"

1. Allez dans Gmail → Paramètres (roue dentée)
2. "Voir tous les paramètres"
3. Onglet "Transfert et POP/IMAP"
4. Activez "Activer IMAP"
5. Sauvegardez

### Email Microsoft détecté

Si vous entrez une adresse @outlook.com, @hotmail.com ou @live.com, le formulaire IMAP vous redirigera vers Microsoft Graph API qui offre une meilleure expérience utilisateur.

---

## Ressources

- [RFC 3501 - IMAP](https://tools.ietf.org/html/rfc3501)
- [ImapFlow Documentation](https://imapflow.com/)
- [Gmail IMAP Settings](https://support.google.com/mail/answer/7126229)

---

**Dernière mise à jour** : 6 février 2026
