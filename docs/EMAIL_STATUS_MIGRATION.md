# Migration: Email Status System

## Résumé des changements

### Ancien système
- `processed: Boolean` (false = non traité, true = traité)
- Pas de distinction claire entre "synchronisé" et "analysé"
- Pas de date de dernière extraction

### Nouveau système
- `status: EmailStatus` (EXTRACTED | ANALYZED)
  - **EXTRACTED** : Email synchronisé depuis le fournisseur (IMAP ou Microsoft Graph), métadonnées extraites
  - **ANALYZED** : Email analysé pour extraction d'actions
- `lastEmailExtractionDate: DateTime` sur le User
  - Permet de ne pas réextraire les emails déjà traités

## Avantages

1. **Clarté** : Distinction explicite entre sync et analyse
2. **Maintenabilité** : Plus facile de comprendre le statut d'un email
3. **Nettoyage** : Permet de nettoyer les emails selon leur statut
4. **Performance** : Optimisation avec `lastEmailExtractionDate`

## Migration de la base de données

### Étape 1 : Exécuter la migration SQL

```bash
# Se connecter à la base de données
psql -h localhost -p 15432 -U postgres -d inbox_actions

# Exécuter le fichier de migration
\i prisma/migrations/migration_email_status.sql
```

### Étape 2 : Régénérer le client Prisma

```bash
pnpm prisma generate
```

### Étape 3 : Rebuild l'application

```bash
pnpm build
```

## Changements dans le code

### Modèles Prisma

**EmailMetadata**
- ❌ `processed: Boolean` → ✅ `status: EmailStatus`

**User**
- ➕ `lastEmailExtractionDate: DateTime?`

### Services

**IEmailProvider** (interface implémentée par IMAPProvider et MicrosoftGraphProvider)
- ❌ `getUnprocessedEmails()` → ✅ `getExtractedEmails()`
- ❌ `markEmailAsProcessed()` → ✅ `markEmailAsAnalyzed()`

### Routes API

**`/api/email/analyze`**
- Utilise `getExtractedEmails()` pour récupérer les emails à analyser
- Marque les emails comme ANALYZED après traitement

**`/api/email/status`**
- Retourne `extractedCount` et `analyzedCount` au lieu de `unprocessedCount`

**`/api/cron/daily-sync`**
- Utilise le nouveau système de statuts

## Stratégie de nettoyage automatique

### Cron de nettoyage des métadonnées

**Status** : ✅ Implémenté

**Route** : `/api/cron/cleanup-metadata`

**Fréquence** : 1x par nuit (via Vercel Cron)

**Règles de suppression :**
1. Emails **ANALYZED** + plus vieux que **90 jours** → Suppression
2. Emails **EXTRACTED** + plus vieux que **30 jours** (jamais analysés) → Suppression
3. **Sécurité** : Garde TOUJOURS au minimum les **7 derniers jours** de données

**Stratégie de rétention :**
- **ANALYZED** : 90 jours (3 mois d'historique)
- **EXTRACTED** : 30 jours (délai raisonnable avant suppression si non analysé)
- **Minimum** : 7 jours (protection contre suppression accidentelle)

**Exemple d'appel manuel (dev/debug) :**
```bash
curl -X GET http://localhost:3000/api/cron/cleanup-metadata \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Réponse type :**
```json
{
  "success": true,
  "duration": 1523,
  "stats": {
    "totalUsers": 5,
    "analyzedDeleted": 142,
    "extractedDeleted": 38,
    "totalDeleted": 180,
    "errors": []
  },
  "retention": {
    "analyzedDays": 90,
    "extractedDays": 30,
    "minimumDays": 7
  },
  "message": "Cleanup completed: 180 emails deleted"
}
```

**Requêtes SQL équivalentes :**
```sql
-- Supprimer les emails analysés de plus de 90 jours (sauf les 7 derniers jours)
DELETE FROM email_metadata
WHERE status = 'ANALYZED'
  AND created_at < NOW() - INTERVAL '90 days'
  AND created_at <= NOW() - INTERVAL '7 days';

-- Supprimer les emails extraits jamais analysés de plus de 30 jours (sauf les 7 derniers jours)
DELETE FROM email_metadata
WHERE status = 'EXTRACTED'
  AND created_at < NOW() - INTERVAL '30 days'
  AND created_at <= NOW() - INTERVAL '7 days';
```

**Configuration Vercel Cron :**

Configuré dans `vercel.json` :
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-sync",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/cleanup-metadata",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Horaires :
- `daily-sync` : 8h00 du matin (synchronisation emails)
- `cleanup-metadata` : 9h00 du matin (nettoyage après sync)

## Utilisation de lastEmailExtractionDate

Cette date permet d'optimiser la synchronisation :

```typescript
// Dans le service email - fetchNewEmails()
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { lastEmailExtractionDate: true },
});

// Requête filtrée : ne récupérer que les emails reçus après cette date
// (implémentation spécifique à chaque provider : IMAP ou Microsoft Graph)
```

## Stratégie d'extraction des emails

**Date de mise en place** : 2026-01-07

### Comportement actuel

L'extraction d'emails utilise une **stratégie incrémentale intelligente** :

```typescript
// Dans le service email - fetchNewEmails()
const user = await prisma.user.findUnique({
  where: { id: this.userId },
  select: { lastEmailSync: true },
});

let afterTimestamp: number;

if (user?.lastEmailSync) {
  // Synchro existante : récupérer tous les emails depuis la dernière synchro
  afterTimestamp = Math.floor(user.lastEmailSync.getTime() / 1000);
  console.log(`Fetching emails since last sync: ${user.lastEmailSync.toISOString()}`);
} else {
  // Première synchro : récupérer uniquement les dernières 24h
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);
  afterTimestamp = Math.floor(last24Hours.getTime() / 1000);
  console.log(`First sync: fetching emails from last 24 hours`);
}

// Query avec filtre de date (implémentation spécifique au provider)
```

### Règles d'extraction

1. **Première synchronisation** (`lastEmailSync` est null)
   - Récupère uniquement les emails des **dernières 24 heures**
   - Évite la récupération massive d'historique
   - Limite la charge initiale

2. **Synchronisations suivantes** (`lastEmailSync` existe)
   - Récupère **tous les emails depuis la dernière synchro**
   - Garantit qu'aucun email n'est manqué
   - Synchronisation incrémentale efficace
   - Microsoft Graph utilise les delta queries pour plus de performance

### Avantages

1. **Première synchro légère** : Seulement 24h d'emails au lieu de tout l'historique
2. **Synchronisation continue** : Aucun email manqué après la première synchro
3. **Performance optimale** : Charge minimale sur les APIs email
4. **Expérience utilisateur** : Configuration rapide pour les nouveaux utilisateurs

### Évolution future

Une fonctionnalité permettra de **récupérer les emails entre 2 dates** pour :
- Récupérer des emails historiques spécifiques
- Analyser une période donnée
- Rattrapage manuel si nécessaire

Cette fonctionnalité sera accessible via :
- Interface utilisateur dans les paramètres email
- Paramètre optionnel `dateRange` dans `fetchNewEmails()`

## Vérification post-migration

```sql
-- Vérifier les statuts
SELECT status, COUNT(*)
FROM email_metadata
GROUP BY status;

-- Vérifier lastEmailExtractionDate
SELECT
  id,
  email,
  last_email_extraction_date
FROM users
WHERE last_email_extraction_date IS NOT NULL;
```

## Rollback (si nécessaire)

```sql
-- Ajouter la colonne processed
ALTER TABLE email_metadata ADD COLUMN processed BOOLEAN DEFAULT false;

-- Migrer les données
UPDATE email_metadata SET processed = true WHERE status = 'ANALYZED';
UPDATE email_metadata SET processed = false WHERE status = 'EXTRACTED';

-- Supprimer la colonne status
DROP INDEX email_metadata_status_idx;
ALTER TABLE email_metadata DROP COLUMN status;

-- Supprimer lastEmailExtractionDate
ALTER TABLE users DROP COLUMN last_email_extraction_date;

-- Supprimer l'enum
DROP TYPE "EmailStatus";

-- Recréer l'index
CREATE INDEX email_metadata_processed_idx ON email_metadata(processed);
```
