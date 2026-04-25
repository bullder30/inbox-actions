# ADR-004 : Intégration au pipeline d'extraction (extension non-cassante)

## Status
Accepted

## Context

`extractActionsFromEmail(context, userExclusions)` est consommé par 2 callers :
- `lib/cron/daily-sync-job.ts` (cron 8h)
- `app/api/email/analyze/route.ts` (analyse manuelle)

Il faut ajouter le support des types custom :
- **sans casser la signature** existante (fonction pure, testée par 174 tests)
- **sans dupliquer** la logique anti-ambiguïté (`isConcreteEnough`, conditionnels faibles, marqueurs forts, deadline checks)

## Decision

**Étendre la signature de manière backward-compatible** :

```ts
extractActionsFromEmail(
  context: EmailContext,
  userExclusions: UserExclusionData[] = [],
  customTypes: CustomActionTypeData[] = [],   // NEW, default empty
): ExtractedAction[]
```

Logique interne :

1. Exécuter les **5 patterns natifs** (inchangé)
2. Si `customTypes.length > 0`, exécuter `extractCustomActionsFromEmail(context, customTypes)` qui :
   - Pour chaque `customType`, compile `keywords` en `RegExp(\b(${escapedKeywords.join('|')})\b, 'i')`
   - Applique le **même gating anti-ambiguïté** que les natifs (extraire les helpers en fonctions exportées si encore inline)
   - Construit l'`ExtractedAction` avec : `type: 'CUSTOM'`, `customTypeId: customType.id`, `customTypeLabel: customType.name`, `customTypeColor: customType.color`
3. Merger les deux listes via `deduplicateActions()` existante

Les **callers** (cron + API) doivent charger les `customTypes` du user et les passer :
```ts
const customTypes = await prisma.customActionType.findMany({
  where: { userId, isActive: true },
});
const actions = extractActionsFromEmail(ctx, exclusions, customTypes);
```

## Consequences

### Positive
- **Backward-compatible** : defaults vides = comportement actuel strictement identique. Les 174 tests existants restent verts sans modification.
- **Réutilise toute la couche anti-ambiguïté** → cohérence du comportement entre natif et custom (un email "si tu peux faire le code review" → ignoré pour CUSTOM aussi).
- Fonction extracteur reste **pure** (signature explicite, testable sans mock DB).
- Le dedup garantit qu'un pattern custom collidant avec un natif ne crée pas de doublon.

### Negative
- Les 2 callers doivent être modifiés (~3 lignes chacun pour charger + passer les `customTypes`).

### Risks
- Si un caller futur oublie de passer les `customTypes`, les types custom sont silencieusement ignorés. Mitigation possible : log warning quand l'extracteur trouverait des patterns custom mais n'en a pas reçu — mais probablement YAGNI au MVP.
