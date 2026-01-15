# Configuration des Tâches Planifiées (Cron Jobs)

Ce document explique le système de tâches planifiées automatiques pour la synchronisation Gmail et le nettoyage des données.

## 📋 Vue d'ensemble

Le système utilise **node-cron** pour exécuter 3 tâches automatiques :

| Job | Fréquence | Description | Heure (Europe/Paris) |
|-----|-----------|-------------|----------------------|
| **count-new-emails** | Toutes les 10 min | Compte les nouveaux emails Gmail | Continu |
| **daily-sync** | 1x par jour | Synchronise et analyse les emails | 8h00 |
| **cleanup** | 1x par jour | Supprime les emails > 3 jours | 23h00 |

**Caractéristiques** :
- ✅ Démarrage automatique via `instrumentation.ts`
- ✅ Timezone : Europe/Paris
- ✅ Pas de rattrapage des exécutions manquées
- ✅ Logs détaillés avec préfixes `[CRON SERVICE]`, `[DAILY-SYNC JOB]`, `[CLEANUP JOB]`, `[COUNT-NEW-EMAILS JOB]`

## ⚙️ Configuration

### 1. Variables d'environnement

Ajoutez dans votre `.env.local` :

```bash
# Cron secret pour sécuriser les endpoints HTTP (optionnel en dev, requis en prod)
CRON_SECRET=your-random-secret-string-here
```

**Important** : Générez un secret aléatoire sécurisé :
```bash
# Exemple de génération
openssl rand -base64 32
```

### 2. Configuration Next.js

Le fichier `next.config.js` active l'instrumentation hook :

```javascript
experimental: {
  serverComponentsExternalPackages: ["@prisma/client"],
  instrumentationHook: true, // ← Active l'instrumentation
}
```

### 3. Démarrage automatique

Au démarrage de Next.js (dev ou production), le fichier `instrumentation.ts` lance automatiquement les crons :

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron/cron-service");
    startCronJobs();
  }
}
```

**Logs de démarrage attendus** :
```
[INSTRUMENTATION] Starting cron jobs...
[CRON SERVICE] 🚀 Starting cron jobs...
[CRON SERVICE] ✅ Count-new-emails job scheduled (every 10 minutes)
[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 8:00 AM)
[CRON SERVICE] ✅ Cleanup job scheduled (every day at 11:00 PM)
[INSTRUMENTATION] Cron jobs started successfully
```

## 🧪 Tests

### Endpoint de test manuel

Un endpoint spécial permet de déclencher manuellement les jobs sans attendre l'heure planifiée :

```bash
# Tester le daily-sync
http://localhost:3000/api/cron/test-trigger?job=daily-sync

# Tester le cleanup
http://localhost:3000/api/cron/test-trigger?job=cleanup
```

Ou avec curl :
```bash
curl "http://localhost:3000/api/cron/test-trigger?job=daily-sync"
curl "http://localhost:3000/api/cron/test-trigger?job=cleanup"
```

**Réponse attendue** :
```json
{
  "success": true,
  "job": "daily-sync",
  "result": {
    "success": true,
    "stats": {
      "totalUsers": 1,
      "successUsers": 1,
      "failedUsers": 0,
      "totalEmailsSynced": 17,
      "totalActionsExtracted": 5,
      "errors": []
    },
    "duration": 2345
  },
  "message": "Job 'daily-sync' executed successfully"
}
```

### Vérifier les crons actifs

Les logs du job **count-new-emails** s'affichent **toutes les 10 minutes** dans votre console :

```
[CRON SERVICE] ⏰ Count-new-emails job triggered at 2026-01-13T08:10:00.000Z
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with Gmail
[COUNT-NEW-EMAILS JOB] david@example.com: 17 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 17 new emails (180ms)
```

Si vous ne voyez pas ces logs, les crons ne sont pas actifs.

## 📊 Logs détaillés

### Daily-sync job (8h00)

Exemple de logs lors de l'exécution du daily-sync :

```
[CRON SERVICE] ⏰ Daily-sync job triggered
[DAILY-SYNC JOB] 🚀 Starting...
[DAILY-SYNC JOB] Found 1 users with Gmail connected
[DAILY-SYNC JOB] Processing user: david@example.com
[DAILY-SYNC JOB] ✅ Synced 17 emails for david@example.com
[DAILY-SYNC JOB] 📊 david@example.com: 5 actions extracted
[DAILY-SYNC JOB] ✨ Completed in 2345ms
[DAILY-SYNC JOB] Stats: { users: '1/1', synced: 17, actions: 5 }
```

### Cleanup job (23h00)

Exemple de logs lors de l'exécution du cleanup :

```
[CRON SERVICE] ⏰ Cleanup job triggered
[CLEANUP JOB] 🧹 Starting...
[CLEANUP JOB] Processing 1 users
[CLEANUP JOB] User david@example.com: deleted 42 emails older than 3 days
[CLEANUP JOB] ✨ Completed in 156ms
[CLEANUP JOB] Stats: { totalUsers: 1, totalDeleted: 42, retentionDays: 3 }
```

### Count-new-emails job (toutes les 10 min)

Logs uniquement si des nouveaux emails sont détectés :

```
[CRON SERVICE] ⏰ Count-new-emails job triggered at 2026-01-13T08:10:00.000Z
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with Gmail
[COUNT-NEW-EMAILS JOB] david@example.com: 17 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 17 new emails (180ms)
```

## 🔍 Fonctionnement technique

### 1. Count-new-emails job (10 minutes)

- **Objectif** : Afficher le compteur de nouveaux emails dans l'UI
- **Fréquence** : Toutes les 10 minutes
- **Action** : Compte uniquement, NE synchronise PAS les emails
- **Performance** : Très rapide (~100-200ms)

### 2. Daily-sync job (8h00)

**ÉTAPE 1 : Synchronisation Gmail**
- Récupère tous les utilisateurs avec compte Google connecté
- Pour chaque utilisateur :
  - Crée un `GmailService`
  - Rafraîchit automatiquement le token si expiré
  - Récupère les nouveaux emails (max 100 par run)
  - Vérifie les doublons via `@@unique([userId, gmailMessageId])`
  - Stocke uniquement les métadonnées (RGPD compliant)

**ÉTAPE 2 : Analyse et extraction d'actions**
- Récupère les emails avec statut `EXTRACTED` (max 50 par run)
- Pour chaque email :
  - Récupère le corps temporairement (en mémoire uniquement)
  - Extrait les actions via REGEX (déterministe)
  - Crée les actions en base de données
  - Marque l'email comme `ANALYZED`

**ÉTAPE 3 : Notification**
- Envoie un email digest à l'utilisateur si des actions ont été extraites
- Non bloquant (erreur de notification n'empêche pas le job)

### 3. Cleanup job (23h00)

**Stratégie de suppression simplifiée** :
- Supprime **tous les emails** (ANALYZED ou EXTRACTED) plus vieux que **3 jours**
- Pas de distinction par statut
- Pas de période de grâce (contrairement à l'ancienne version qui gardait 7 jours minimum)

**Requête Prisma** :
```typescript
prisma.emailMetadata.deleteMany({
  where: {
    userId: user.id,
    createdAt: { lt: retentionDate } // retentionDate = now - 3 jours
  }
})
```

### Gestion des erreurs

- ✅ **Erreur individuelle** : Continue avec les autres utilisateurs
- ✅ **Token expiré** : Skip l'utilisateur, log l'erreur
- ✅ **Timeout** : Limite de 100 emails sync + 50 emails analyse par user
- ✅ **Fatal error** : Log et retourne une réponse d'erreur

## 🛡️ Sécurité

### Endpoints HTTP avec Authorization

Les endpoints `/api/cron/daily-sync` et `/api/cron/cleanup-metadata` vérifient le header `Authorization` :

```typescript
const authHeader = req.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Usage** :
```bash
curl -X GET http://localhost:3000/api/cron/daily-sync \
  -H "Authorization: Bearer your-cron-secret-here"
```

### Endpoint de test (sans auth)

L'endpoint `/api/cron/test-trigger` est **sans authentification** pour faciliter les tests en développement. **À sécuriser en production**.

## ⚠️ Problème de mise en veille du PC

### Le problème

**Les crons ne s'exécutent PAS si le PC est en veille/hibernation** :
- À 8h00 → daily-sync ne s'exécute pas si le PC dort
- À 23h00 → cleanup ne s'exécute pas si le PC dort
- Node.js est gelé quand le PC est en veille

**Symptômes** :
```
[NODE-CRON] [WARN] missed execution at Tue Jan 13 2026 08:00:00 GMT+0100!
Possible blocking IO or high CPU user at the same process used by node-cron.
```

### Solutions

#### Option 1 : Désactiver la mise en veille (Simple)

```powershell
# Windows - Désactiver la mise en veille
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

**Avantages** : Aucune configuration supplémentaire
**Inconvénients** : Consommation électrique, pas écologique

#### Option 2 : Planificateur de tâches Windows (Recommandé)

Créer des tâches Windows qui **réveillent automatiquement le PC** pour exécuter les jobs.

**Étapes** :

1. Ouvrir le **Planificateur de tâches Windows** (`taskschd.msc`)

2. Créer une tâche pour **daily-sync** :
   - Nom : `Inbox Actions - Daily Sync`
   - Déclencheur : Tous les jours à 8h00
   - Action : Programme/script
     ```
     powershell.exe
     ```
   - Ajouter des arguments :
     ```
     -Command "Invoke-WebRequest 'http://localhost:3000/api/cron/test-trigger?job=daily-sync'"
     ```
   - ✅ Cocher "**Réveiller l'ordinateur pour exécuter cette tâche**"

3. Créer une tâche pour **cleanup** :
   - Nom : `Inbox Actions - Cleanup`
   - Déclencheur : Tous les jours à 23h00
   - Action : Programme/script
     ```
     powershell.exe
     ```
   - Ajouter des arguments :
     ```
     -Command "Invoke-WebRequest 'http://localhost:3000/api/cron/test-trigger?job=cleanup'"
     ```
   - ✅ Cocher "**Réveiller l'ordinateur pour exécuter cette tâche**"

**Avantages** :
- Le PC se réveille automatiquement
- Logs visibles dans l'historique du Planificateur
- Pas besoin que Next.js tourne 24/7

**Inconvénients** :
- Configuration manuelle
- Next.js doit être démarré au boot (PM2 ou service Windows)

#### Option 3 : PM2 (Serveur toujours actif)

Installer PM2 pour garder Next.js toujours actif (même après reboot) :

```bash
# Installer PM2 globalement
npm install -g pm2

# Builder Next.js
pnpm build

# Démarrer avec PM2
pm2 start npm --name "inbox-actions" -- start

# Sauvegarder la configuration
pm2 save

# Auto-démarrer PM2 au boot Windows
pm2 startup
```

**Avantages** :
- Next.js tourne 24/7
- Redémarre automatiquement en cas de crash
- Logs centralisés (`pm2 logs`)
- Monitoring (`pm2 monit`)

**Inconvénients** :
- PC doit rester allumé (ou utiliser Option 2)
- Consommation de ressources

#### Option 4 : Hébergement cloud (Production)

Déployer sur un serveur qui ne dort jamais :
- **Vercel** (avec Vercel Cron)
- **Railway**
- **DigitalOcean App Platform**
- **VPS** (AWS, GCP, Azure)

**Avantages** :
- Disponibilité 24/7 garantie
- Pas de gestion de serveur local
- Scalabilité

**Inconvénients** :
- Coût mensuel
- Configuration supplémentaire

## 🐛 Dépannage

### Les crons ne démarrent pas

**Symptôme** : Aucun log `[CRON SERVICE]` au démarrage

**Vérifications** :
1. `instrumentationHook: true` dans `next.config.js` ?
2. Le fichier `instrumentation.ts` existe à la racine ?
3. Erreur de compilation de `instrumentation.ts` ?

**Solution** :
```bash
# Redémarrer le serveur dev
pnpm dev

# Vérifier les logs de démarrage
```

### Les crons ne s'exécutent pas aux heures prévues

**Causes possibles** :
1. **PC en veille** → Voir section "Problème de mise en veille"
2. **Timezone incorrecte** → Vérifier `timezone: "Europe/Paris"` dans `cron-service.ts`
3. **Next.js pas démarré** → Les crons nécessitent que le processus Node tourne

**Solution** :
- Utiliser l'endpoint de test pour vérifier que le job fonctionne
- Implémenter une des solutions de gestion de la mise en veille

### "Gmail service unavailable"

**Cause** : Token Google expiré et impossible à rafraîchir

**Solution** :
1. L'utilisateur doit se reconnecter via `/dashboard/settings/gmail`
2. Vérifier que `access_type: "offline"` est bien configuré dans `auth.config.ts`

### "CRON_SECRET not configured"

**Cause** : La variable `CRON_SECRET` n'est pas définie

**Solution** :
```bash
# Ajouter dans .env.local
CRON_SECRET=your-secret-here

# Redémarrer le serveur
pnpm dev
```

### Timeout / Performance

**Symptôme** : Le cron prend plus de 10 secondes par utilisateur

**Solutions** :
- Réduire `maxResults` de 100 à 50 dans `daily-sync-job.ts`
- Réduire la limite des emails à analyser de 50 à 25
- Optimiser les requêtes Prisma avec des `createMany`
- Vérifier la vitesse de la connexion Gmail API

### Warnings "missed execution"

**Symptôme** :
```
[NODE-CRON] [WARN] missed execution at ...! Possible blocking IO
```

**Causes** :
- PC en veille pendant l'heure planifiée
- Next.js occupé à recompiler (hot reload)
- Opération bloquante (sync Gmail très long)

**Solution** :
- Le flag `recoverMissedExecutions: false` est déjà configuré pour éviter les rattrapages
- Utiliser une des solutions de gestion de la mise en veille
- Réduire la fréquence si nécessaire

## 📈 Monitoring

### Métriques importantes

**Daily-sync** :
- **Duration** : < 5s par utilisateur idéalement (peut varier selon le nombre d'emails)
- **Success rate** : > 95% des utilisateurs
- **Emails synced** : Varie selon l'activité Gmail
- **Actions extracted** : ~5-10% des emails analysés

**Cleanup** :
- **Duration** : < 1s par utilisateur généralement
- **Total deleted** : Augmente si beaucoup d'emails ont plus de 3 jours

**Count-new-emails** :
- **Duration** : < 500ms par utilisateur
- **Execution** : Toutes les 10 minutes

### Logs à surveiller

- ✅ `[CRON SERVICE] ✅ ... job scheduled` → Crons activés au démarrage
- ✅ `[DAILY-SYNC JOB] ✨ Completed` → Sync quotidien réussi
- ✅ `[CLEANUP JOB] ✨ Completed` → Nettoyage réussi
- ⚠️ `[...-JOB] ❌ Error for user@example.com` → Erreur individuelle (pas bloquant)
- ❌ `[...-JOB] ❌ Fatal error` → Erreur critique (job échoué)

## 🔄 Améliorations futures

- [ ] Dashboard de monitoring des crons dans l'UI admin
- [ ] Notifications Slack/email en cas d'échec critique
- [ ] Retry logic automatique pour les utilisateurs en erreur
- [ ] Utiliser Gmail History API pour sync incrémental plus performant
- [ ] Webhooks Gmail Push Notifications (temps réel au lieu de polling)
- [ ] Batch creation pour les actions (performance)
- [ ] Métriques Prometheus/Grafana

## 📝 Résumé des fichiers

| Fichier | Description |
|---------|-------------|
| `instrumentation.ts` | Point d'entrée : démarre les crons au boot |
| `lib/cron/cron-service.ts` | Service principal : configure et démarre les 3 jobs |
| `lib/cron/count-new-emails-job.ts` | Job de comptage (10 min) |
| `lib/cron/daily-sync-job.ts` | Job de sync quotidien (8h00) |
| `lib/cron/cleanup-job.ts` | Job de nettoyage (23h00) |
| `app/api/cron/test-trigger/route.ts` | Endpoint de test manuel |
| `app/api/cron/daily-sync/route.ts` | Endpoint HTTP pour external crons |
| `app/api/cron/cleanup-metadata/route.ts` | Endpoint HTTP pour external crons |

## 🎯 Checklist de mise en production

- [ ] `CRON_SECRET` configuré dans les variables d'environnement
- [ ] PM2 ou service Windows configuré pour Next.js
- [ ] Planificateur de tâches Windows configuré (si PC local)
- [ ] OU déploiement sur serveur cloud 24/7
- [ ] Logs de démarrage vérifiés (`[CRON SERVICE] ✅`)
- [ ] Test manuel des 2 jobs principaux (daily-sync, cleanup)
- [ ] Monitoring des logs configuré
- [ ] Timezone correctement configurée (`Europe/Paris`)
