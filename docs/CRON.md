# Système de Cron - Tâches Planifiées

Ce document explique le fonctionnement du système de cron automatique pour toutes les tâches planifiées de l'application.

## Architecture

Le système utilise **node-cron** pour exécuter des tâches planifiées automatiquement, à la fois en développement local et en production.

### Fichiers principaux

- **`lib/cron/count-new-emails-job.ts`** : Job de comptage des nouveaux emails (toutes les 10 minutes)
- **`lib/cron/daily-sync-job.ts`** : Job de synchronisation quotidienne complète (7h00)
- **`lib/cron/cleanup-job.ts`** : Job de nettoyage des métadonnées obsolètes (3h00)
- **`lib/cron/cron-service.ts`** : Service de gestion des crons (démarrage, arrêt)
- **`instrumentation.ts`** : Point d'entrée Next.js pour démarrer les crons au lancement du serveur

## Jobs planifiés

### 1. Count New Emails Job (toutes les 10 minutes)

**Planning** : `*/10 * * * *` (toutes les 10 minutes)

Le job `count-new-emails` **compte uniquement** les nouveaux emails disponibles depuis la dernière synchronisation (manuelle ou automatique).

**Important** : Ce job **NE synchronise PAS** les emails, il ne fait que compter.

**La synchronisation réelle se fait via** :
- Le bouton "Analyser" dans le dashboard (manuel)
- Le daily-sync job (automatique, tous les jours à 7h00)

**Mise à jour temps réel du dashboard** :
- Système **Server-Sent Events (SSE)** combiné avec **Zustand**
- Le serveur push le count vers le client toutes les 30 secondes via SSE
- Store Zustand partagé pour état global
- Pas de polling côté client (plus efficient)
- Voir [REALTIME_UPDATES.md](./REALTIME_UPDATES.md) pour les détails complets

**Objectif** : Maintenir le compteur "En attente" à jour en temps réel sans polling

### 2. Daily-Sync Job (tous les jours à 7h00)

**Planning** : `0 7 * * *` (tous les jours à 7h00)

Le job `daily-sync` est une version plus complète de l'auto-sync :

1. **Synchronisation** : Récupère les nouveaux emails (max 100 par exécution)
2. **Analyse** : Analyse les emails `EXTRACTED` (max 50 par exécution)

**Limites volontaires** : 100 sync / 50 analyze pour un traitement plus agressif quotidien

### 3. Cleanup Job (tous les jours à 3h00)

**Planning** : `0 3 * * *` (tous les jours à 3h00)

Le job `cleanup` nettoie les métadonnées d'emails obsolètes :

**Règles de rétention** :
- Emails **ANALYZED** : suppression après **90 jours**
- Emails **EXTRACTED** (non analysés) : suppression après **30 jours**
- **Sécurité** : Les 7 derniers jours ne sont JAMAIS supprimés

**Objectif** : Limiter la croissance de la base de données tout en gardant les données récentes

## Mise à jour temps réel du dashboard

Le compteur "En attente" dans le dashboard se met à jour automatiquement en temps réel grâce à un système de polling côté client.

### Architecture

1. **Composant client** : `PendingSyncCard` (React avec `useState` et `useEffect`)
2. **API endpoint** : `/api/email/pending-count` (GET)
3. **Polling** : Toutes les 30 secondes (le cron tourne toutes les 10 minutes)

### Fonctionnement

```
[Cron toutes les 10 min] → Met à jour le count des emails
                          ↓
[Composant dashboard] → Polling /api/email/pending-count toutes les 30s
                          ↓
[API] → Appelle emailProvider.countNewEmails()
                          ↓
[Dashboard] → Met à jour l'affichage automatiquement
```

**Avantages** :
- ✅ Mise à jour automatique sans rafraîchir la page
- ✅ Polling léger (30 secondes) pour ne pas surcharger
- ✅ Le count est calculé en temps réel via le provider email
- ✅ Pas besoin de stockage en base de données

## Démarrage automatique

Les crons démarrent automatiquement grâce au fichier `instrumentation.ts` :

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron/cron-service");
    startCronJobs();
  }
}
```

Cette fonction est appelée par Next.js au démarrage du serveur (dev et production).

**Logs au démarrage** :
```
[INSTRUMENTATION] Starting cron jobs...
[CRON SERVICE] 🚀 Starting cron jobs...
[CRON SERVICE] ✅ Count-new-emails job scheduled (every 10 minutes)
[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 7:00 AM Paris)
[CRON SERVICE] ✅ Cleanup job scheduled (every day at 3:00 AM)
```

## Configuration

### Timezone

Par défaut, le cron utilise la timezone **Europe/Paris**. Pour la modifier :

```typescript
// lib/cron/cron-service.ts
cron.schedule(
  "*/10 * * * *",
  async () => { ... },
  {
    timezone: "America/New_York", // Changez ici
  }
);
```

### Fréquence

Pour modifier la fréquence d'exécution, éditez le pattern cron dans `lib/cron/cron-service.ts` :

```typescript
// Exemples :
"*"*/2 * * * *"   // Toutes les 2 minutes
"*/5 * * * *"   // Toutes les 5 minutes
"*/10 * * * *"  // Toutes les 10 minutes
"0 * * * *"     // Toutes les heures
"0 */2 * * *"   // Toutes les 2 heures
```

## Développement local

### Démarrage

Lorsque vous démarrez le serveur de développement, le cron démarre automatiquement :

```bash
pnpm dev
```

Vous verrez dans les logs :

```
[INSTRUMENTATION] Starting cron jobs...
[CRON SERVICE] 🚀 Starting cron jobs...
[CRON SERVICE] ✅ Count-new-emails job scheduled (every 10 minutes)
[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 7:00 AM Paris)
[CRON SERVICE] ✅ Cleanup job scheduled (every day at 3:00 AM)
```

### Logs

Les jobs affichent des logs détaillés à chaque exécution :

**Count New Emails Job** :
```
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with email configured
[COUNT-NEW-EMAILS JOB] user@example.com: 3 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 3 new emails (234ms)
```

**Note** : Ce job affiche des logs uniquement s'il trouve de nouveaux emails (pour éviter de polluer les logs).

**Daily-Sync Job** :
```
[CRON SERVICE] ⏰ Daily-sync job triggered
[DAILY-SYNC JOB] 🚀 Starting...
[DAILY-SYNC JOB] Found 1 users with email configured
[DAILY-SYNC JOB] Processing user: user@example.com
[DAILY-SYNC JOB] ✅ Synced 15 emails for user@example.com
[DAILY-SYNC JOB] 📊 user@example.com: 5 actions extracted
[DAILY-SYNC JOB] ✨ Completed in 5432ms
[DAILY-SYNC JOB] Stats: { users: '1/1', synced: 15, actions: 5 }
```

**Cleanup Job** :
```
[CRON SERVICE] ⏰ Cleanup job triggered
[CLEANUP JOB] 🧹 Starting...
[CLEANUP JOB] Processing 1 users
[CLEANUP JOB] User user@example.com: deleted 25 emails (20 ANALYZED, 5 EXTRACTED)
[CLEANUP JOB] ✨ Completed in 1234ms
[CLEANUP JOB] Stats: { totalUsers: 1, analyzedDeleted: 20, extractedDeleted: 5, totalDeleted: 25 }
```

## Production

En production, le cron fonctionne exactement de la même manière qu'en développement.

### Déploiement sur Vercel

Le cron démarre automatiquement au démarrage de l'instance Vercel. Aucune configuration supplémentaire n'est nécessaire.

**Important** : Assurez-vous que `instrumentationHook: true` est activé dans `next.config.js` :

```javascript
experimental: {
  serverComponentsExternalPackages: ["@prisma/client"],
  instrumentationHook: true, // ← Important
}
```

## Monitoring

### Vérifier que le cron fonctionne

Les logs du cron apparaissent dans :
- **Développement** : Console du terminal où `pnpm dev` est lancé
- **Production (Vercel)** : Logs de la fonction dans le dashboard Vercel

### Statistiques

Chaque exécution du job affiche des statistiques :
- Nombre d'utilisateurs traités
- Nombre d'emails synchronisés
- Nombre d'emails analysés
- Nombre d'actions extraites
- Durée d'exécution
- Erreurs éventuelles

## Dépannage

### Le cron ne démarre pas

1. Vérifiez que `instrumentationHook: true` est dans `next.config.js`
2. Redémarrez le serveur Next.js complètement
3. Vérifiez les logs au démarrage

### Le cron ne s'exécute pas

1. Vérifiez que le serveur Next.js est bien démarré
2. Attendez 2 minutes pour la première exécution du count-new-emails job
3. Consultez les logs pour d'éventuelles erreurs

### Erreurs d'exécution

Les erreurs sont loggées mais n'arrêtent pas le cron. Consultez les logs pour identifier les problèmes :
- Tokens OAuth expirés
- Problèmes de connexion à la base de données
- Erreurs d'analyse des emails

## Limites

### Limites par exécution

Pour éviter les timeouts, chaque job traite un nombre limité d'éléments par exécution :

**Count New Emails Job** (toutes les 10 minutes) :
- Ne fait que compter, pas de limite nécessaire
- Opération légère et rapide

**Daily-Sync Job** (tous les jours à 7h00) :
- **Synchronisation** : Maximum 100 nouveaux emails par utilisateur
- **Analyse** : Maximum 50 emails EXTRACTED par utilisateur

**Cleanup Job** (tous les jours à 3h00) :
- Pas de limite : traite tous les emails obsolètes selon les règles de rétention

Si vous avez plus d'emails à traiter que les limites, ils seront traités lors de la prochaine exécution.

### Ressources

Les crons s'exécutent dans le même processus que Next.js. En production sur Vercel, cela n'engendre pas de coûts supplémentaires.

## Récapitulatif

| Job | Fréquence | Horaire | Action | Objectif |
|-----|-----------|---------|--------|----------|
| **count-new-emails** | Toutes les 2 min | - | Compte uniquement | Maintenir le compteur "En attente" à jour |
| **daily-sync** | 1x par jour | 7h00 | Sync (100) + Analyze (50) | Synchronisation quotidienne complète |
| **cleanup** | 1x par jour | 3h00 | Supprime emails obsolètes | Nettoyage des données obsolètes |

**Note importante** : La synchronisation réelle des emails se fait uniquement via :
- Le bouton "Analyser" dans le dashboard (manuel)
- Le daily-sync job (automatique, 7h00)
