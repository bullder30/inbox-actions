# Sécurité & RGPD - Intégration Gmail

Documentation complète sur la sécurité et la conformité RGPD pour l'intégration Gmail dans Inbox Actions.

---

## 📜 Conformité RGPD

### 1. Base légale

**Article 6(1)(a) RGPD - Consentement**

L'utilisateur donne son consentement explicite lors de l'authentification OAuth :

```
┌─────────────────────────────────────────┐
│ Inbox Actions souhaite accéder à :      │
│ ☑ Lire vos emails Gmail                 │
│ ☑ Voir votre adresse email              │
│                                         │
│ [Annuler]  [Autoriser] ← Consentement  │
└─────────────────────────────────────────┘
```

✅ **Consentement libre** - L'utilisateur peut refuser
✅ **Consentement spécifique** - Scope précis (gmail.readonly)
✅ **Consentement éclairé** - L'utilisateur voit exactement ce qui est demandé
✅ **Consentement univoque** - Action positive requise (clic sur "Autoriser")

### 2. Minimisation des données (Article 5(1)(c))

**Principe :** Collecter uniquement les données strictement nécessaires.

| Donnée | Stockée ? | Justification |
|--------|-----------|---------------|
| Corps complet de l'email | ❌ NON | Non nécessaire |
| Pièces jointes | ❌ NON | Non nécessaire |
| Métadonnées complètes | ❌ NON | Non nécessaire |
| **Gmail Message ID** | ✅ OUI | Identifier l'email |
| **Gmail Thread ID** | ✅ OUI | Grouper les conversations |
| **Expéditeur (From)** | ✅ OUI | Savoir qui a envoyé |
| **Sujet** | ✅ OUI | Contexte de l'action |
| **Snippet (200 chars max)** | ✅ OUI | Extrait court pour contexte |
| **Date de réception** | ✅ OUI | Chronologie |
| **Labels Gmail** | ✅ OUI | Filtrage (INBOX, etc.) |

**Code implémenté :**

```typescript
// ✅ CONFORME RGPD
const messageData = await gmail.users.messages.get({
  userId: "me",
  id: messageId,
  format: "metadata", // ← Métadonnées UNIQUEMENT
  metadataHeaders: ["From", "Subject", "Date"], // ← Headers minimaux
});

// ❌ NON CONFORME
const messageData = await gmail.users.messages.get({
  userId: "me",
  id: messageId,
  format: "full", // ← Corps complet
});
```

### 3. Limitation de la conservation (Article 5(1)(e))

**Principe :** Ne pas conserver les données plus longtemps que nécessaire.

**Implémenté :**

```typescript
// Modèle EmailMetadata
model EmailMetadata {
  processed Boolean @default(false)
  createdAt DateTime @default(now())
  // ...
}
```

**Stratégie de rétention recommandée :**

1. **Emails non traités** : Conservés jusqu'au traitement
2. **Emails traités** : Conservés 30 jours max
3. **Suppression automatique** : Cron job quotidien

```typescript
// Exemple de nettoyage automatique
async function cleanOldEmails() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await prisma.emailMetadata.deleteMany({
    where: {
      processed: true,
      createdAt: { lt: thirtyDaysAgo },
    },
  });
}
```

### 4. Droit d'accès (Article 15)

**Implémenté :**

L'utilisateur peut consulter toutes ses données :

```typescript
// GET /api/user/data
export async function GET() {
  const session = await auth();

  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      emailMetadata: true,
      actions: true,
    },
  });

  return NextResponse.json(userData);
}
```

### 5. Droit à l'effacement (Article 17)

**Implémenté :**

```typescript
// POST /api/email/disconnect
// Supprime TOUTES les données Gmail de l'utilisateur

await prisma.emailMetadata.deleteMany({
  where: { userId: session.user.id },
});

await prisma.account.delete({
  where: { id: googleAccount.id },
});
```

**Cascade de suppression :**

```prisma
model EmailMetadata {
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Si l'utilisateur supprime son compte → Toutes ses données sont automatiquement supprimées.

### 6. Droit à la portabilité (Article 20)

**Implémenté :**

```typescript
// GET /api/user/export
export async function GET() {
  const session = await auth();

  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      emailMetadata: true,
      actions: true,
    },
  });

  // Export en JSON
  return new Response(JSON.stringify(userData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=my-data.json",
    },
  });
}
```

### 7. Droit de révocation (Article 7(3))

**Implémenté :**

L'utilisateur peut révoquer le consentement à tout moment :

1. **Via l'application** : Bouton "Déconnecter Gmail"
2. **Via Google** : https://myaccount.google.com/permissions

```typescript
// Révocation du token côté Google
const oauth2Client = new google.auth.OAuth2();
oauth2Client.setCredentials({ access_token });
await oauth2Client.revokeCredentials();
```

---

## 🔒 Sécurité

### 1. Stockage sécurisé des tokens

**Problème :** Les tokens OAuth donnent accès aux emails de l'utilisateur.

**Solution :**

```prisma
model Account {
  access_token  String? @db.Text  // ← Stocké en base de données
  refresh_token String? @db.Text  // ← Stocké en base de données
}
```

**Mesures de sécurité :**

1. ✅ **Chiffrement de la base de données** au repos (PostgreSQL encryption)
2. ✅ **Accès restreint** - Tokens accessibles uniquement par userId
3. ✅ **HTTPS uniquement** - Pas de transmission en clair
4. ✅ **Rotation automatique** - Access token renouvelé toutes les heures
5. ✅ **Pas de logs** - Les tokens ne sont JAMAIS loggés

```typescript
// ✅ CORRECT
console.log("User authenticated");

// ❌ INCORRECT
console.log("Access token:", accessToken); // ← JAMAIS
```

### 2. Isolation des données

**Principe :** Un utilisateur ne peut accéder qu'à SES données.

```typescript
// ✅ SÉCURISÉ
const emails = await prisma.emailMetadata.findMany({
  where: {
    userId: session.user.id, // ← Filtre OBLIGATOIRE
  },
});

// ❌ VULNÉRABLE
const emails = await prisma.emailMetadata.findMany(); // ← Pas de filtre !
```

**Implémenté partout :**

```typescript
// lib/gmail/gmail-service.ts
export class GmailService {
  private userId: string;

  async fetchNewEmails() {
    await prisma.emailMetadata.create({
      data: {
        userId: this.userId, // ← Toujours associé à l'utilisateur
        // ...
      },
    });
  }
}
```

### 3. Validation des inputs

```typescript
// Validation des paramètres
const maxResults = parseInt(searchParams.get("maxResults") || "100");

if (maxResults < 1 || maxResults > 500) {
  return NextResponse.json(
    { error: "maxResults must be between 1 and 500" },
    { status: 400 }
  );
}
```

### 4. Rate limiting

**Problème :** Abus de l'API Gmail (quotas, coûts).

**Solution recommandée :**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requêtes par minute
});

export async function GET() {
  const session = await auth();
  const { success } = await ratelimit.limit(session.user.id);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  // ...
}
```

### 5. Gestion des erreurs sécurisée

```typescript
// ✅ CORRECT - Message générique
catch (error) {
  console.error("Error:", error); // ← Log interne
  return NextResponse.json(
    { error: "An error occurred" }, // ← Message générique
    { status: 500 }
  );
}

// ❌ INCORRECT - Fuite d'informations
catch (error) {
  return NextResponse.json(
    { error: error.message }, // ← Peut contenir des infos sensibles
    { status: 500 }
  );
}
```

### 6. Protection contre les attaques

#### CSRF (Cross-Site Request Forgery)

✅ **Protégé par NextAuth** - Token CSRF automatique

#### XSS (Cross-Site Scripting)

```typescript
// ✅ CORRECT - React échappe automatiquement
<div>{email.subject}</div>

// ❌ INCORRECT
<div dangerouslySetInnerHTML={{ __html: email.subject }} />
```

#### SQL Injection

✅ **Protégé par Prisma** - Requêtes paramétrées automatiques

```typescript
// ✅ SÉCURISÉ
await prisma.emailMetadata.findMany({
  where: { userId: userId }, // ← Paramétré
});

// ❌ VULNÉRABLE (mais Prisma ne permet pas cela)
await prisma.$executeRaw`SELECT * FROM emails WHERE userId = ${userId}`; // ← Dangereux
```

---

## 📊 Monitoring et audit

### 1. Logs de sécurité

```typescript
// Logger les événements importants
async function logSecurityEvent(
  userId: string,
  event: string,
  metadata?: any
) {
  await prisma.securityLog.create({
    data: {
      userId,
      event,
      metadata,
      timestamp: new Date(),
      ipAddress: req.headers.get("x-forwarded-for"),
    },
  });
}

// Exemples d'événements à logger
await logSecurityEvent(userId, "GMAIL_CONNECTED");
await logSecurityEvent(userId, "GMAIL_DISCONNECTED");
await logSecurityEvent(userId, "GMAIL_SYNC_STARTED");
await logSecurityEvent(userId, "ACCESS_TOKEN_EXPIRED");
```

### 2. Alertes de sécurité

```typescript
// Alerter en cas d'activité suspecte
async function checkSuspiciousActivity(userId: string) {
  const recentSyncs = await prisma.emailMetadata.count({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000), // Dernière minute
      },
    },
  });

  if (recentSyncs > 1000) {
    // Trop de synchronisations en 1 minute
    await sendSecurityAlert(userId, "SUSPICIOUS_SYNC_ACTIVITY");
  }
}
```

---

## 🛡️ Checklist de sécurité

Avant de passer en production :

### Configuration

- [ ] HTTPS activé sur tous les endpoints
- [ ] NEXTAUTH_SECRET généré de manière sécurisée (32+ caractères)
- [ ] Variables d'environnement jamais commitées
- [ ] Base de données avec chiffrement au repos
- [ ] Sauvegardes automatiques de la base de données

### Code

- [ ] Tous les endpoints vérifient l'authentification
- [ ] Isolation des données par userId partout
- [ ] Pas de logs de tokens ou données sensibles
- [ ] Validation des inputs sur tous les endpoints
- [ ] Messages d'erreur génériques (pas de fuite d'info)
- [ ] Rate limiting implémenté

### OAuth

- [ ] Scope minimal (gmail.readonly uniquement)
- [ ] access_type: "offline" pour refresh token
- [ ] prompt: "consent" pour forcer le consentement
- [ ] Callback URLs en HTTPS uniquement
- [ ] Révocation des tokens implémentée

### RGPD

- [ ] Politique de confidentialité publiée
- [ ] Conditions d'utilisation publiées
- [ ] Droit d'accès implémenté (export données)
- [ ] Droit à l'effacement implémenté (suppression)
- [ ] Droit de révocation implémenté (déconnexion)
- [ ] Minimisation des données (pas de corps complet)
- [ ] Limitation de conservation (suppression auto)
- [ ] Consentement explicite (écran OAuth)

### Monitoring

- [ ] Logs de sécurité configurés
- [ ] Alertes en cas d'activité suspecte
- [ ] Monitoring des quotas Gmail API
- [ ] Monitoring des erreurs de tokens

---

## 📝 Politique de confidentialité (exemple)

**Section Gmail à inclure :**

```markdown
## Accès à votre compte Gmail

### Données collectées

Lorsque vous connectez votre compte Gmail, nous collectons :

- ✅ Identifiants de messages Gmail (IDs)
- ✅ Expéditeur de l'email
- ✅ Sujet de l'email
- ✅ Extrait court (snippet, max 200 caractères)
- ✅ Date de réception
- ✅ Labels Gmail (INBOX, etc.)

### Données NON collectées

Nous NE collectons JAMAIS :

- ❌ Corps complet de vos emails
- ❌ Pièces jointes
- ❌ Contacts Gmail
- ❌ Calendrier Gmail

### Utilisation des données

Vos données Gmail sont utilisées UNIQUEMENT pour :

1. Extraire les actions à effectuer depuis vos emails
2. Afficher le contexte de ces actions

### Stockage

- Les métadonnées sont stockées de manière sécurisée
- Les emails traités sont automatiquement supprimés après 30 jours
- Vous pouvez supprimer toutes vos données à tout moment

### Révocation

Vous pouvez révoquer l'accès à votre Gmail à tout moment via :

1. Les paramètres de l'application
2. Votre compte Google : https://myaccount.google.com/permissions

### Sécurité

- Connexion HTTPS obligatoire
- Tokens OAuth stockés de manière sécurisée
- Accès lecture seule uniquement (gmail.readonly)
```

---

## ✅ Justifications RGPD & Sécurité

### Pourquoi NE PAS stocker le corps complet ?

1. **RGPD - Minimisation (Article 5(1)(c))**
   - Le corps complet contient potentiellement des données sensibles
   - Seuls les extraits nécessaires (actions) sont requis
   - Réduction du risque en cas de fuite de données

2. **RGPD - Limitation de conservation (Article 5(1)(e))**
   - Plus on stocke de données, plus longtemps on doit les conserver
   - Les métadonnées minimales peuvent être supprimées rapidement

3. **Sécurité - Réduction de la surface d'attaque**
   - Moins de données stockées = moins de risques
   - Conformité facilitée

4. **Performance**
   - Moins de données = base de données plus rapide
   - Moins de coûts de stockage

### Pourquoi utiliser gmail.readonly ?

1. **RGPD - Minimisation des accès**
   - Accès lecture seule suffisant
   - Impossible de modifier/supprimer les emails de l'utilisateur

2. **Sécurité - Principe du moindre privilège**
   - Limitation des dégâts en cas de compromission
   - Confiance accrue de l'utilisateur

3. **Conformité Google**
   - Processus de vérification plus simple
   - Moins de scrutiny de Google

---

## 🎯 Résumé

L'intégration Gmail dans Inbox Actions est :

✅ **Conforme RGPD**
- Consentement explicite
- Minimisation des données
- Droit d'accès, effacement, portabilité
- Limitation de conservation

✅ **Sécurisée**
- Tokens stockés de manière sécurisée
- Isolation des données
- HTTPS uniquement
- Pas de logs sensibles

✅ **Transparente**
- L'utilisateur voit exactement ce qui est demandé
- Peut révoquer à tout moment
- Contrôle total de ses données

L'utilisateur reste TOUJOURS propriétaire et en contrôle de ses données.
