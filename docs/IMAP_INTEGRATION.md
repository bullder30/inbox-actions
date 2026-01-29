# Intégration IMAP

Cette documentation décrit l'intégration IMAP comme alternative à Gmail OAuth.

---

## Vue d'ensemble

Inbox Actions supporte désormais deux méthodes de connexion email :

| Méthode | Avantages | Inconvénients |
|---------|-----------|---------------|
| **Gmail OAuth** | Connexion en 1 clic, pas de mot de passe à gérer | Uniquement Gmail |
| **IMAP** | Compatible tous providers (Gmail, Outlook, Yahoo, iCloud...) | Nécessite un App Password |

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
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│ GmailProvider│  │ IMAPProvider │
│ (OAuth)      │  │ (IMAP)       │
└──────────────┘  └──────────────┘
```

### Interface commune

Les deux providers implémentent `IEmailProvider` :

```typescript
interface IEmailProvider {
  providerType: EmailProvider; // "GMAIL" | "IMAP"

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
| Outlook/Office 365 | outlook.office365.com | 993 | Oui |
| Yahoo | imap.mail.yahoo.com | 993 | Oui |
| iCloud | imap.mail.me.com | 993 | Oui |
| Fastmail | imap.fastmail.com | 993 | Oui |
| ProtonMail | 127.0.0.1 (via Bridge) | 1143 | Non |

### Détection automatique

Le système détecte automatiquement le provider depuis l'adresse email :

```typescript
// lib/imap/types.ts
export function detectProviderFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();

  if (domain === "gmail.com") return "gmail";
  if (domain === "outlook.com" || domain === "hotmail.com") return "outlook";
  if (domain === "yahoo.com") return "yahoo";
  // ...
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

### App Passwords (recommandé)

Pour Gmail et les providers avec 2FA, utilisez un **App Password** :

#### Gmail
1. Aller sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Sélectionner "Mail" et "Autre (nom personnalisé)"
3. Nommer "Inbox Actions"
4. Copier le mot de passe généré (16 caractères)

#### Outlook
1. Aller sur [account.microsoft.com/security](https://account.microsoft.com/security)
2. "Options de sécurité avancées"
3. "Ajouter une nouvelle façon de se connecter"
4. "Mot de passe d'application"

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
  emailProvider EmailProvider @default(GMAIL)
  // GMAIL = utiliser OAuth
  // IMAP = utiliser IMAPCredential
}
```

### EmailMetadata dual-provider

```prisma
model EmailMetadata {
  // Provider
  emailProvider  EmailProvider @default(GMAIL)

  // Gmail identifiers (null si IMAP)
  gmailMessageId String?
  gmailThreadId  String?

  // IMAP identifiers (null si Gmail)
  imapUID        BigInt?
  imapMessageId  String?

  // Métadonnées communes
  from           String
  subject        String?
  snippet        String
  receivedAt     DateTime
  labels         String[]

  @@unique([userId, gmailMessageId])
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
  "imapPassword": "xxxx xxxx xxxx xxxx",  # App Password
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
  "lastSync": "2026-01-29T10:00:00Z"
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

### Endpoints provider-agnostic

Les endpoints suivants fonctionnent pour **Gmail ET IMAP** :

| Endpoint | Description |
|----------|-------------|
| `GET /api/gmail/sync` | Synchroniser les emails |
| `POST /api/gmail/analyze` | Analyser et extraire les actions |
| `GET /api/gmail/status` | Statut de connexion |
| `POST /api/gmail/disconnect` | Déconnecter (Gmail ou IMAP) |
| `GET /api/gmail/pending-count` | Compter les emails en attente |

> **Note** : Le préfixe `/api/gmail/` est conservé pour compatibilité, mais ces endpoints supportent les deux providers via le factory pattern.

---

## Composants UI

### Page Settings

Dans `app/(protected)/settings/page.tsx` :

```tsx
// Sélecteur de provider
<Button onClick={() => setEmailProvider("GMAIL")}>
  <Mail /> Gmail (OAuth)
</Button>
<Button onClick={() => setEmailProvider("IMAP")}>
  <Server /> IMAP
</Button>

// Section IMAP (si sélectionné)
{emailProvider === "IMAP" && (
  imapConfigured ? <IMAPStatus /> : <IMAPConnectForm />
)}
```

### IMAPConnectForm

Formulaire de configuration IMAP avec :
- Détection automatique du provider
- Presets pour les providers courants
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

Le job de synchronisation quotidienne supporte les deux providers :

```typescript
// lib/cron/daily-sync-job.ts
export async function runDailySyncJob() {
  // 1. Récupérer les utilisateurs Gmail
  const usersWithGmail = await prisma.account.findMany({
    where: { provider: "google", user: { emailProvider: "GMAIL" } }
  });

  // 2. Récupérer les utilisateurs IMAP
  const usersWithIMAP = await prisma.iMAPCredential.findMany({
    where: { isConnected: true, user: { emailProvider: "IMAP" } }
  });

  // 3. Pour chaque utilisateur, utiliser le factory
  for (const user of allUsers) {
    const emailProvider = await createEmailProvider(user.id);
    await emailProvider.fetchNewEmails();
    // ...
  }
}
```

---

## Troubleshooting

### Erreur "Authentication failed"

1. Vérifier que l'App Password est correct
2. Pour Gmail : activer l'accès IMAP dans les paramètres Gmail
3. Pour Outlook : désactiver la sécurité par défaut si nécessaire

### Erreur "Connection refused"

1. Vérifier le host et le port
2. Vérifier que TLS est activé (port 993)
3. Vérifier le firewall

### Erreur "IMAP_MASTER_KEY not set"

Générer et configurer la clé de chiffrement :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Ajouter à .env.local
```

---

## Migration Gmail → IMAP

Pour migrer d'un compte Gmail OAuth vers IMAP :

1. Aller dans Paramètres
2. Sélectionner "IMAP"
3. Configurer les credentials IMAP
4. Les anciennes actions sont conservées
5. Les nouveaux emails seront synchronisés via IMAP

> **Note** : Les anciennes actions avec `gmailMessageId` resteront liées à Gmail. Les nouvelles actions auront un `imapUID`.

---

## Ressources

- [RFC 3501 - IMAP](https://tools.ietf.org/html/rfc3501)
- [ImapFlow Documentation](https://imapflow.com/)
- [Gmail IMAP Settings](https://support.google.com/mail/answer/7126229)
- [Outlook IMAP Settings](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353)

---

Dernière mise à jour : 29 janvier 2026
