# Mises à jour en temps réel - SSE + Zustand

Documentation du système de mises à jour en temps réel du compteur d'emails en attente.

---

## Vue d'ensemble

Le système utilise **Server-Sent Events (SSE)** combiné avec **Zustand** pour mettre à jour en temps réel le compteur d'emails en attente dans le dashboard, sans polling côté client.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Architecture                             │
└─────────────────────────────────────────────────────────────────┘

Cron Job (toutes les 2 min)
    ↓
Compte nouveaux emails Gmail
    ↓
[Stocké en mémoire temporaire]
    ↓
SSE Endpoint (/api/email/pending-stream)
    ↓ (stream toutes les 30 sec)
Client (EventSource)
    ↓
Zustand Store (état global)
    ↓
UI Components (PendingSyncCard)
```

---

## Composants

### 1. Store Zustand

**Fichier** : `lib/stores/pending-emails-store.ts`

Store global partagé pour le compteur d'emails en attente.

```typescript
import { create } from "zustand";

interface PendingEmailsState {
  count: number;
  lastUpdate: Date | null;
  setCount: (count: number) => void;
  reset: () => void;
}

export const usePendingEmailsStore = create<PendingEmailsState>((set) => ({
  count: 0,
  lastUpdate: null,
  setCount: (count: number) => set({ count, lastUpdate: new Date() }),
  reset: () => set({ count: 0, lastUpdate: null }),
}));
```

**Avantages** :
- ✅ État partagé entre tous les composants
- ✅ Pas de props drilling
- ✅ Mise à jour réactive automatique

---

### 2. SSE Endpoint

**Fichier** : `app/api/email/pending-stream/route.ts`

Endpoint qui stream le count en temps réel via Server-Sent Events.

```typescript
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const sendEvent = (data: { count: number }) => {
        if (isClosed) return;

        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.log("[SSE] Stream already closed");
          isClosed = true;
        }
      };

      const fetchAndSendCount = async () => {
        if (isClosed) return;

        try {
          const gmailService = await createGmailService(userId);
          if (!gmailService) {
            sendEvent({ count: 0 });
            return;
          }

          const count = await gmailService.countNewEmailsInGmail();
          sendEvent({ count });
        } catch (error) {
          console.error("[SSE] Error fetching count:", error);
          sendEvent({ count: 0 });
        }
      };

      // Envoyer immédiatement au démarrage
      await fetchAndSendCount();

      // Puis toutes les 30 secondes
      intervalId = setInterval(fetchAndSendCount, 30 * 1000);
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
        console.log("[SSE] Stream cancelled");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

**Caractéristiques** :
- ✅ Envoie le count immédiatement à la connexion
- ✅ Puis toutes les 30 secondes
- ✅ Gestion propre de la déconnexion
- ✅ Reconnexion automatique par le navigateur

---

### 3. Provider SSE

**Fichier** : `components/providers/pending-emails-provider.tsx`

Composant qui écoute les événements SSE et met à jour le store Zustand.

```typescript
"use client";

import { usePendingEmailsStore } from "@/lib/stores/pending-emails-store";
import { useEffect } from "react";

export function PendingEmailsProvider({
  children
}: {
  children: React.ReactNode
}) {
  const setCount = usePendingEmailsStore((state) => state.setCount);

  useEffect(() => {
    // Créer la connexion EventSource
    const eventSource = new EventSource("/api/email/pending-stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      } catch (error) {
        console.error("[SSE] Error parsing event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[SSE] EventSource error:", error);
      // EventSource se reconnecte automatiquement
    };

    // Cleanup à la déconnexion
    return () => {
      eventSource.close();
    };
  }, [setCount]);

  return <>{children}</>;
}
```

**Fonctionnement** :
- ✅ Mount une fois au démarrage de l'app
- ✅ Écoute les événements SSE
- ✅ Met à jour le store Zustand
- ✅ Cleanup automatique au unmount

---

### 4. Intégration dans le Layout

**Fichier** : `app/layout.tsx`

Le provider SSE est ajouté dans le layout racine pour être actif dans toute l'application.

```typescript
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <ThemeProvider>
            <PendingEmailsProvider>
              <ModalProvider>{children}</ModalProvider>
            </PendingEmailsProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

### 5. Composant UI

**Fichier** : `components/dashboard/pending-sync-card.tsx`

Card qui affiche le compteur depuis le store Zustand.

```typescript
export function PendingSyncCard({ lastSyncText }: PendingSyncCardProps) {
  // Utiliser le store Zustand (mis à jour en temps réel via SSE)
  const count = usePendingEmailsStore((state) => state.count);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    try {
      setSyncing(true);

      // Étape 1 : Extraction de TOUS les emails depuis la dernière synchro
      toast.info("Extraction des emails en cours...");
      const syncResult = await syncGmail();

      if (syncResult.count === 0) {
        toast.info("Aucun nouvel email à extraire");
        return;
      }

      toast.success(`${syncResult.count} email(s) extrait(s)`);

      // Étape 2 : Analyse de TOUS les emails extraits
      toast.info("Analyse des emails en cours...");
      const analyzeResult = await analyzeGmail();
      toast.success(
        `${analyzeResult.extractedActions} action(s) créée(s)`
      );

      router.refresh();
    } catch (error) {
      toast.error("Erreur lors de l'analyse");
    } finally {
      setSyncing(false);
    }
  }

  const syncButton = count > 0 ? (
    <Button onClick={handleSync} disabled={syncing}>
      <RefreshCw className={syncing ? "animate-spin" : ""} />
      Analyser
    </Button>
  ) : undefined;

  return (
    <StatsCard
      title="En attente"
      value={count}
      description={
        count > 0
          ? `Nouveaux emails depuis ${lastSyncText}`
          : `Dernière synchro ${lastSyncText}`
      }
      icon={Inbox}
      action={syncButton}
    />
  );
}
```

---

## Cron Job

**Fichier** : `lib/cron/count-new-emails-job.ts`

Job qui compte les nouveaux emails toutes les 2 minutes.

```typescript
export async function runCountNewEmailsJob() {
  console.log("[Cron] Count new emails job started");

  try {
    const users = await prisma.user.findMany({
      where: {
        accounts: {
          some: {
            provider: "google",
            scope: {
              contains: "gmail.readonly",
            },
          },
        },
      },
      select: { id: true, email: true },
    });

    for (const user of users) {
      try {
        const gmailService = await createGmailService(user.id);
        if (!gmailService) continue;

        const newEmailsCount = await gmailService.countNewEmailsInGmail();

        // Log uniquement si nouveaux emails
        if (newEmailsCount > 0) {
          console.log(
            `[Cron] User ${user.email}: ${newEmailsCount} new email(s)`
          );
        }
      } catch (error) {
        console.error(`[Cron] Error for user ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error("[Cron] Count new emails job failed:", error);
  }
}
```

**Fréquence** : Toutes les 2 minutes (`*/2 * * * *`)

---

## Flux complet

### 1. Au démarrage de l'application

```
1. App démarre
2. PendingEmailsProvider monte
3. EventSource se connecte à /api/email/pending-stream
4. SSE envoie immédiatement le count actuel
5. Store Zustand mis à jour
6. UI affiche le count
```

### 2. Toutes les 30 secondes

```
1. SSE envoie le count actuel
2. Store Zustand mis à jour
3. UI se met à jour automatiquement (réactivité)
```

### 3. Toutes les 2 minutes (cron)

```
1. Cron compte les nouveaux emails Gmail
2. Stockage en mémoire (pas de DB)
3. SSE récupère ce count lors du prochain cycle (30s)
4. Client reçoit la mise à jour
```

### 4. Quand l'utilisateur clique sur "Analyser"

```
1. Extraction de tous les emails depuis lastGmailSync
2. Analyse de tous les emails extraits
3. Création des actions
4. router.refresh() pour mettre à jour l'UI
5. Le count SSE se met à jour au prochain cycle
```

---

## Avantages du système

### Performance

- ✅ **Pas de polling** : SSE push au lieu de pull répété
- ✅ **1 connexion HTTP** au lieu de requêtes multiples
- ✅ **Économie de bande passante** : stream vs polling

### Expérience utilisateur

- ✅ **Mises à jour instantanées** : max 30 secondes de latence
- ✅ **Pas de rechargement** : mise à jour réactive
- ✅ **Compteur précis** : toujours à jour

### Scalabilité

- ✅ **Léger côté serveur** : pas de requêtes répétées
- ✅ **Reconnexion automatique** : gestion native du navigateur
- ✅ **État partagé** : Zustand évite les duplications

---

## Debugging

### Voir les événements SSE dans DevTools

1. Ouvrir DevTools
2. Onglet Network
3. Filtrer "EventStream"
4. Voir `/api/email/pending-stream`
5. Observer les messages dans l'onglet "EventStream"

### Logs côté serveur

```bash
[SSE] Stream cancelled, interval cleared
[SSE] Error fetching pending count: ...
```

### Logs côté client

```javascript
console.log("[SSE] Error parsing event data:", error);
console.error("[SSE] EventSource error:", error);
```

---

## Comparaison avec le polling

### Ancien système (Polling)

```typescript
// ❌ Requête HTTP toutes les 30 secondes
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch("/api/email/pending-count");
    const data = await response.json();
    setCount(data.count);
  }, 30 * 1000);

  return () => clearInterval(interval);
}, []);
```

**Inconvénients** :
- ❌ Nouvelle connexion HTTP toutes les 30s
- ❌ Overhead réseau important
- ❌ Latence de 0-30 secondes
- ❌ Plus difficile à scale

### Nouveau système (SSE + Zustand)

```typescript
// ✅ Connexion persistante + store global
const count = usePendingEmailsStore((state) => state.count);
```

**Avantages** :
- ✅ 1 connexion HTTP maintenue
- ✅ Push instantané des mises à jour
- ✅ Latence max 30 secondes
- ✅ Beaucoup plus scalable

---

## Références

- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)

---

Dernière mise à jour : 9 janvier 2026
