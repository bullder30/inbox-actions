# Exemples d'utilisation Gmail API

Guide complet avec exemples de code pour utiliser le service Gmail dans Inbox Actions.

---

## 🔧 Configuration préalable

Avant d'utiliser l'API Gmail, assurez-vous que :

1. ✅ Google Cloud OAuth est configuré (voir [GMAIL_OAUTH_SETUP.md](./GMAIL_OAUTH_SETUP.md))
2. ✅ Les variables d'environnement sont définies
3. ✅ L'utilisateur s'est connecté avec Google

---

## 📥 Récupération des emails

### 1. Synchroniser les emails depuis Gmail

```typescript
// Dans un Server Component ou API Route
import { createGmailService } from "@/lib/gmail/gmail-service";

async function syncUserEmails(userId: string) {
  // Créer le service Gmail
  const gmailService = await createGmailService(userId);

  if (!gmailService) {
    throw new Error("Gmail not connected");
  }

  // Récupérer les nouveaux emails
  const emails = await gmailService.fetchNewEmails({
    maxResults: 50,
    labelIds: ["INBOX"],
  });

  console.log(`Synced ${emails.length} emails`);

  return emails;
}
```

### 2. Filtrer les emails par query

```typescript
// Récupérer seulement les emails non lus
const unreadEmails = await gmailService.fetchNewEmails({
  query: "is:unread",
  maxResults: 20,
});

// Récupérer les emails d'un expéditeur spécifique
const emailsFromBoss = await gmailService.fetchNewEmails({
  query: "from:boss@company.com",
});

// Récupérer les emails avec une date spécifique
const recentEmails = await gmailService.fetchNewEmails({
  query: "after:2026/01/01",
});

// Combiner plusieurs critères
const urgentEmails = await gmailService.fetchNewEmails({
  query: "is:unread is:important",
});
```

### 3. Récupérer un email spécifique

```typescript
const emailMetadata = await gmailService.getEmailById("gmail-message-id-123");

if (emailMetadata) {
  console.log("From:", emailMetadata.from);
  console.log("Subject:", emailMetadata.subject);
  console.log("Snippet:", emailMetadata.snippet);
}
```

---

## 🔍 Récupération des emails non traités

```typescript
// Récupérer tous les emails qui n'ont pas encore été analysés
const unprocessedEmails = await gmailService.getUnprocessedEmails();

for (const email of unprocessedEmails) {
  // Traiter l'email (par exemple, extraction d'actions avec IA)
  await processEmail(email);

  // Marquer comme traité
  await gmailService.markEmailAsProcessed(email.gmailMessageId);
}
```

---

## 🤖 Analyse avec IA (usage temporaire uniquement)

**IMPORTANT:** Ne JAMAIS stocker le corps complet d'un email en base de données (RGPD).

```typescript
// ✅ CORRECT: Récupération temporaire pour analyse IA
async function analyzeEmailForActions(gmailMessageId: string, userId: string) {
  const gmailService = await createGmailService(userId);

  if (!gmailService) {
    throw new Error("Gmail not connected");
  }

  // Récupérer le corps TEMPORAIREMENT (en mémoire uniquement)
  const emailBody = await gmailService.getEmailBodyForAnalysis(gmailMessageId);

  if (!emailBody) {
    return null;
  }

  // Analyser avec IA (OpenAI, Anthropic, etc.)
  const actions = await extractActionsWithAI(emailBody);

  // ⚠️ NE PAS stocker emailBody en base de données
  // Stocker SEULEMENT les actions extraites

  for (const action of actions) {
    await prisma.action.create({
      data: {
        userId,
        title: action.title,
        type: action.type,
        sourceSentence: action.sourceSentence, // Extrait uniquement
        emailFrom: action.emailFrom,
        emailReceivedAt: action.emailReceivedAt,
        dueDate: action.dueDate,
      },
    });
  }

  // Marquer l'email comme traité
  await gmailService.markEmailAsProcessed(gmailMessageId);

  return actions;
}

// ❌ INCORRECT: Ne jamais faire ceci
async function badExample(gmailMessageId: string) {
  const emailBody = await gmailService.getEmailBodyForAnalysis(gmailMessageId);

  // ❌ INTERDIT: Stockage du corps complet
  await prisma.email.create({
    data: {
      body: emailBody, // ❌ VIOLATION RGPD
    },
  });
}
```

---

## 🌐 Utilisation dans une API Route

### GET /api/gmail/sync

```typescript
// app/api/gmail/sync/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailService = await createGmailService(session.user.id);

  if (!gmailService) {
    return NextResponse.json(
      { error: "Gmail not connected" },
      { status: 400 }
    );
  }

  const emails = await gmailService.fetchNewEmails({
    maxResults: 100,
  });

  return NextResponse.json({
    success: true,
    count: emails.length,
    emails,
  });
}
```

---

## 🎯 Utilisation dans un Server Component

```typescript
// app/(protected)/emails/page.tsx
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";

export default async function EmailsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <div>Please login</div>;
  }

  const gmailService = await createGmailService(session.user.id);

  if (!gmailService) {
    return (
      <div>
        <h1>Gmail not connected</h1>
        <a href="/api/auth/signin/google">Connect Gmail</a>
      </div>
    );
  }

  const unprocessedEmails = await gmailService.getUnprocessedEmails();

  return (
    <div>
      <h1>Unprocessed Emails ({unprocessedEmails.length})</h1>
      <ul>
        {unprocessedEmails.map((email) => (
          <li key={email.gmailMessageId}>
            <strong>{email.from}</strong>: {email.subject}
            <p>{email.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 🔄 Workflow complet

### Scénario: Synchronisation automatique des emails

```typescript
// lib/jobs/sync-gmail.ts
import { prisma } from "@/lib/db";
import { createGmailService } from "@/lib/gmail/gmail-service";

/**
 * Job de synchronisation Gmail pour tous les utilisateurs
 * À exécuter périodiquement (ex: toutes les 5 minutes)
 */
export async function syncAllUsersGmail() {
  // Récupérer tous les utilisateurs avec Gmail connecté
  const users = await prisma.user.findMany({
    where: {
      accounts: {
        some: {
          provider: "google",
        },
      },
    },
    select: {
      id: true,
      email: true,
      lastGmailSync: true,
    },
  });

  console.log(`Syncing Gmail for ${users.length} users`);

  const results = [];

  for (const user of users) {
    try {
      const gmailService = await createGmailService(user.id);

      if (!gmailService) {
        console.warn(`Gmail not available for user ${user.id}`);
        continue;
      }

      // Synchroniser les nouveaux emails
      const emails = await gmailService.fetchNewEmails({
        maxResults: 50,
      });

      results.push({
        userId: user.id,
        success: true,
        emailCount: emails.length,
      });

      console.log(`✓ User ${user.email}: ${emails.length} new emails`);
    } catch (error) {
      console.error(`✗ Error syncing user ${user.id}:`, error);
      results.push({
        userId: user.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
```

### Scénario: Traitement manuel des emails

```typescript
// app/api/gmail/process/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";
import { extractActionsWithAI } from "@/lib/ai/extract-actions";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailService = await createGmailService(session.user.id);

  if (!gmailService) {
    return NextResponse.json(
      { error: "Gmail not connected" },
      { status: 400 }
    );
  }

  // 1. Récupérer les emails non traités
  const unprocessedEmails = await gmailService.getUnprocessedEmails();

  const processedActions = [];

  // 2. Traiter chaque email
  for (const email of unprocessedEmails) {
    // Récupérer le corps pour analyse
    const body = await gmailService.getEmailBodyForAnalysis(
      email.gmailMessageId
    );

    if (!body) continue;

    // Extraire les actions avec IA
    const actions = await extractActionsWithAI({
      body,
      from: email.from,
      subject: email.subject || "",
      receivedAt: email.receivedAt,
    });

    // Stocker les actions en base
    for (const action of actions) {
      await prisma.action.create({
        data: {
          userId: session.user.id,
          title: action.title,
          type: action.type,
          sourceSentence: action.sourceSentence,
          emailFrom: email.from,
          emailReceivedAt: email.receivedAt,
          dueDate: action.dueDate,
        },
      });

      processedActions.push(action);
    }

    // Marquer comme traité
    await gmailService.markEmailAsProcessed(email.gmailMessageId);
  }

  return NextResponse.json({
    success: true,
    processedEmails: unprocessedEmails.length,
    extractedActions: processedActions.length,
  });
}
```

---

## 🔒 Gestion des erreurs

```typescript
async function safeGmailSync(userId: string) {
  try {
    const gmailService = await createGmailService(userId);

    if (!gmailService) {
      return {
        success: false,
        error: "GMAIL_NOT_CONNECTED",
        message: "Please connect Gmail",
      };
    }

    const emails = await gmailService.fetchNewEmails();

    return {
      success: true,
      emailCount: emails.length,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Token expiré
      if (error.message.includes("expired")) {
        return {
          success: false,
          error: "TOKEN_EXPIRED",
          message: "Please reconnect Gmail",
        };
      }

      // Quota dépassé
      if (error.message.includes("quota")) {
        return {
          success: false,
          error: "QUOTA_EXCEEDED",
          message: "Gmail API quota exceeded. Please try again later.",
        };
      }
    }

    // Erreur générique
    return {
      success: false,
      error: "UNKNOWN_ERROR",
      message: "An error occurred while syncing Gmail",
    };
  }
}
```

---

## 📊 Statistiques et monitoring

```typescript
// lib/stats/gmail-stats.ts
import { prisma } from "@/lib/db";

export async function getGmailStats(userId: string) {
  const [totalEmails, unprocessedEmails, lastSync, emailsLast24h] =
    await Promise.all([
      // Total d'emails stockés
      prisma.emailMetadata.count({
        where: { userId },
      }),

      // Emails non traités
      prisma.emailMetadata.count({
        where: {
          userId,
          processed: false,
        },
      }),

      // Dernier sync
      prisma.user.findUnique({
        where: { id: userId },
        select: { lastGmailSync: true },
      }),

      // Emails reçus dans les dernières 24h
      prisma.emailMetadata.count({
        where: {
          userId,
          receivedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    totalEmails,
    unprocessedEmails,
    processedEmails: totalEmails - unprocessedEmails,
    lastSync: lastSync?.lastGmailSync,
    emailsLast24h,
  };
}
```

---

## ✅ Bonnes pratiques

### 1. Ne jamais stocker le corps complet

```typescript
// ✅ CORRECT
const snippet = email.snippet; // Max 200 caractères
const sourceSentence = "Pourrais-tu m'envoyer le rapport ?"; // Extrait

// ❌ INCORRECT
const fullBody = await getEmailBody(); // Ne pas stocker en base
```

### 2. Gérer les tokens expirés

```typescript
const gmailService = await createGmailService(userId);

if (!gmailService) {
  // Rediriger vers reconnexion
  return redirect("/settings/gmail?reconnect=true");
}
```

### 3. Limiter les requêtes

```typescript
// Éviter de faire trop de requêtes simultanées
const emails = await gmailService.fetchNewEmails({
  maxResults: 100, // Pas plus de 100 par appel
});

// Utiliser le rate limiting si nécessaire
await sleep(1000); // 1 seconde entre les requêtes
```

### 4. Nettoyer les anciennes données

```typescript
// Supprimer les métadonnées de plus de 30 jours (optionnel)
await prisma.emailMetadata.deleteMany({
  where: {
    userId,
    receivedAt: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    processed: true, // Seulement les emails déjà traités
  },
});
```

---

## 🎯 Résumé

Le service Gmail permet de :

✅ **Récupérer** les emails Gmail en lecture seule
✅ **Stocker** uniquement les métadonnées minimales (RGPD)
✅ **Analyser** temporairement le corps pour extraction d'actions
✅ **Marquer** les emails comme traités
✅ **Gérer** la déconnexion et suppression des données

**Rappel IMPORTANT:** Ne JAMAIS stocker le corps complet d'un email en base de données.
