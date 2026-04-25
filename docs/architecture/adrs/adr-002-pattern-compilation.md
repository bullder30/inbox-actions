# ADR-002 : Compilation des patterns custom à la volée (pas de cache)

## Status
Accepted

## Context

L'extracteur `extractActionsFromEmail()` tourne via deux callers :
- **Cron** `daily-sync-job` (8h00 quotidien, traite tous les users actifs)
- **API** `/api/email/analyze` (à la demande via le bouton "Synchroniser")

Pour chaque email analysé, les patterns custom de l'utilisateur doivent être compilés en `RegExp` à partir de la liste de keywords stockée en DB. Deux options :

- **Option A** — Compiler à la volée à chaque extraction
- **Option B** — Cacher les patterns compilés par userId (LRU mémoire ou Next `unstable_cache`)

## Decision

**Compiler à la volée** dans `extractCustomActionsFromEmail()`. Pas de cache pour le MVP.

Justification :
- Limite **10 types/user × ~5-50 keywords** = compilation < 1ms par extraction
- Un cache ajouterait une couche d'**invalidation** à gérer (`revalidateTag` à chaque CRUD CustomActionType) — surface de bugs disproportionnée
- Coût de la compilation : `new RegExp(\\b(${escapedKeywords.join('|')})\\b, 'i')` est natif V8, négligeable

## Consequences

### Positive
- **Code simple** : pas d'invalidation à gérer, pas de stale cache possible
- **Cohérence garantie** : le scan utilise toujours les types les plus récents (l'utilisateur peut modifier ses types et le prochain scan en tient compte immédiatement)
- Aucune dépendance à un store mémoire (compatible serverless / edge si on migre)

### Negative
- Si on dépasse > 50 users actifs en cron parallèle (improbable au MVP), un cache LRU per-user pourrait gagner ~10ms par batch. À mesurer si besoin réel.

### Risks
- **Regex DoS (ReDoS)** : un user mal intentionné pourrait définir un keyword crafté pour faire exploser le moteur regex. Mitigation : limite de longueur stricte par keyword (60 chars max), échappement systématique via une fonction helper, **pas de regex libre** côté user (uniquement des keywords mots simples).
