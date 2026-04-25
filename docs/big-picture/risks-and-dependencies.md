# Risks & Dependencies — Actions personnalisées utilisateur

---

## Dependencies

| Feature | Depends on | Type |
|---------|------------|------|
| Epic 2 — CRUD Settings | Table `CustomActionType` (Epic 1) | Technical |
| Epic 3 — Pipeline extraction | `CustomActionType` chargé avant extraction | Technical |
| Epic 3 — Pipeline extraction | `lib/actions/extract-actions-regex.ts` (refactoring signature) | Technical |
| Epic 4 — Missing-action flux | Enum `ActionType` étendue avec valeur `CUSTOM` | Technical |
| Epic 4 — Missing-action flux | Champs `customTypeId`, `customTypeLabel` sur `Action` (Epic 1) | Technical |
| Epic 5 — Affichage ActionCard | Champ `customTypeLabel` disponible dans la réponse API actions | Technical |
| Epic 5 — Affichage filtres | API `GET /api/actions` supporte `type=CUSTOM` dans les filtres | Technical |
| 3.6 — Cache patterns | Mécanisme de cache existant (SWR côté client, pas de cache serveur actuellement) | Technical |
| 3.7 — Détection collisions | Aucun — nouveau code | Technical |
| 5.5 — Digest email | `action-digest-service.ts` et `ActionDigestEmail` template | Technical |

### Dépendances transversales notables

**`extractActionsFromEmail` doit recevoir les CustomActionTypes**

Actuellement la signature est :
```typescript
extractActionsFromEmail(context: EmailContext, userExclusions: UserExclusionData[]): ExtractedAction[]
```

Il faudra ajouter un 3e paramètre `customTypes: CustomActionTypeData[]` et modifier tous les call sites (daily-sync-job, analyze API route, test-trigger). C'est un refactoring de signature qui touche plusieurs fichiers.

**`ExtractedAction` doit porter le type custom**

Le type retourné actuellement est `{ title, type: ActionType, sourceSentence, dueDate }`. Il faudra ajouter `customTypeId?: string` et `customTypeLabel?: string` pour que la couche de persistance puisse écrire les bons champs.

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Collision patterns custom / natifs** : un mot-clé custom "valider" redondant avec le type natif VALIDATE crée des doublons d'actions sur le même email | High | Med | Détecter à la création (Settings) si un mot-clé chevauche les patterns natifs et afficher un avertissement. Appliquer la déduplication existante (`deduplicateActions`) aux types custom. |
| **Faux positifs en cascade** : un mot-clé trop court ou trop générique ("faire", "envoyer") matche tout et génère des centaines d'actions parasites | High | High | Validation à la création : longueur minimale de 4 caractères par mot-clé, blocage des stopwords FR les plus fréquents (liste courte hardcodée). Avertissement si le mot-clé contient moins de 5 caractères. |
| **Migration enum Prisma** : ajouter `CUSTOM` à `ActionType` est une migration DDL qui doit passer en production sans downtime | Med | High | PostgreSQL `ALTER TYPE` est non-transactionnel (attention Neon). Tester sur une branche DB preview. Déployer migration avant le code applicatif (backward compatible : le code avant migration n'écrit jamais `CUSTOM`). |
| **Performance extraction** : charger les CustomActionTypes depuis la DB pour chaque email dans le daily-sync dégrade les perfs si le volume d'utilisateurs augmente | Med | Med | Charger les types custom une seule fois par userId en début de job, pas par email. Ajouter `isActive` pour ne charger que les types actifs. |
| **UX confusion ponctuel / règle** : l'utilisateur ne comprend pas la différence entre "créer une action maintenant" et "créer une règle pour le futur" | Med | Med | Libellés explicites : "Cette fois seulement" vs "Toujours détecter ce type d'action". Icône distincte (éclair vs engrenage). Confirmation post-action avec résumé clair. |
| **Conflit de noms de types** : l'utilisateur crée "VALIDATE" custom qui shadowe le type natif VALIDATE dans les filtres UI | Low | Med | Validation côté API : interdire les noms qui correspondent exactement aux 5 types natifs (case-insensitive). |
| **Regex injection** : si les mots-clés sont utilisés directement dans `new RegExp(keyword)`, un utilisateur malveillant pourrait injecter un pattern ReDoS | Low | High | Ne jamais compiler les mots-clés bruts en regex libres. Utiliser uniquement des recherches de sous-chaîne (`word-boundary` wrapping) : `new RegExp('\\b' + escapeRegex(keyword) + '\\b', 'i')` avec une fonction `escapeRegex` qui échappe les métacaractères. Limiter la longueur max d'un mot-clé à 60 caractères. |
| **Données orphelines** : si un CustomActionType est supprimé, les Actions existantes avec `customTypeId` pointent vers une référence morte | Low | Med | `customTypeLabel` est dénormalisé sur `Action` — l'affichage ne dépend pas de la FK. La FK `customTypeId` devient nullable, pas de cascade delete. Les anciennes actions gardent leur `customTypeLabel` lisible. |
| **Sémantique de suppression d'un type custom** : quand des `Action` existent pour un type supprimé, quelle stratégie adopter ? (voir section dédiée ci-dessous) | High | Med | Stratégie (b) retenue — voir analyse ci-dessous. |
| **Sémantique de modification des mots-clés** : si l'utilisateur change les keywords d'un type, les Actions déjà extraites avec l'ancien pattern doivent-elles être re-scannées ? | Med | Low | Pas de re-scan rétroactif. Les Actions existantes conservent leur `customTypeLabel` figé au moment de l'extraction. Seuls les futurs emails utilisent les nouveaux mots-clés. Expliciter ce comportement dans l'UI (message d'info lors de la modification : "Les actions déjà créées ne seront pas modifiées"). |
| **Limite non enforced côté DB** : la limite de 10 types par user est enforced côté applicatif mais pas en DB | Low | Low | Acceptable pour le MVP. Ajouter une check constraint ou un trigger DB si la limite est critique en production. |
| **Collision de slugs** : deux noms distincts peuvent produire le même slug interne (ex. "Review Code" et "review-code" donnent tous deux `review_code`) ; la contrainte d'unicité sur le nom (case-insensitive) ne couvre pas ce cas si les caractères spéciaux ou tirets sont normalisés différemment | Low | Med | L'unicité est enforced sur le slug en base (contrainte unique sur `[userId, slug]`), pas seulement sur le nom affiché. Si un conflit est détecté à la création, l'API renvoie 409 avec un message explicite ("Un type avec un nom trop similaire existe déjà"). Pas de suffixe numérique automatique — l'utilisateur choisit un nom différent. |

---

## Analyse : sémantique de suppression d'un type custom

Quand l'utilisateur supprime un type custom auquel des `Action` existantes sont attachées, quatre stratégies sont envisageables.

### Options

**(a) Hard delete + cascade (supprimer aussi les Actions liées)**
- Simple à implémenter (relation Prisma avec `onDelete: Cascade`)
- Destruction silencieuse de l'historique : l'utilisateur perd des actions qui avaient peut-être été traitées ou ignorées
- Incompatible avec la philosophie "transparence + traçabilité" du projet
- Non retenu

**(b) Hard delete + nullify `customTypeId`, conserver `customTypeLabel` figé**
- Supprimer le `CustomActionType` en base
- Sur toutes les `Action` associées : passer `customTypeId = null`, laisser `customTypeLabel` intact (la valeur dénormalisée est déjà là)
- L'affichage dans ActionCard reste lisible : le badge affiche encore "DEPOT_GREFFE" même si le type n'existe plus comme règle active
- Le filtre par type dans la liste d'actions ne peut plus filtrer sur ce type (FK morte) — les actions restent visibles sans filtre dédié
- Avantage : historique lisible, pas de perte de données, implémentation simple (une transaction : delete type + UPDATE actions SET customTypeId = null)
- Inconvénient : les anciennes actions ne sont plus filtrables par type custom supprimé

**(c) Soft delete (`deletedAt` non null sur `CustomActionType`)**
- Le type n'est plus proposé pour les nouvelles extractions (`WHERE deletedAt IS NULL`)
- Les Actions existantes gardent leur FK valide, le filtre UI continue de fonctionner
- L'historique est complet et filtrable
- Inconvénient : complexité accrue (tous les `findMany` doivent exclure les soft-deleted), risque d'oubli ; la limite de 10 types doit-elle compter les soft-deleted ? Question de scope non triviale
- Acceptable en v2 si le filtrage des Actions historiques par type supprimé devient un besoin réel

**(d) Bloquer la suppression si des Actions actives (TODO) existent**
- Forcer l'utilisateur à re-catégoriser ses actions TODO avant de supprimer
- Protège contre la perte de données en cours de traitement
- Inconvénient : friction forte, peut bloquer indéfiniment si l'utilisateur a des dizaines d'actions TODO associées
- Acceptable comme avertissement (pas blocage) : proposer de marquer les TODO en IGNORED avant suppression

### Recommandation produit

**Stratégie (b) avec un avertissement de type (d) pour les Actions TODO.**

Concrètement :
1. Avant suppression, l'API vérifie si des `Action` avec `status=TODO` existent pour ce type
2. Si oui : la modale de confirmation affiche "X actions en cours sont associées à ce type. Elles resteront visibles mais ne seront plus filtrables par ce type." — l'utilisateur peut quand même confirmer
3. La suppression nullifie `customTypeId` sur toutes les Actions associées, conserve `customTypeLabel`
4. Les Actions TODO restent visibles et actionnables — elles apparaissent dans la liste globale sans filtre de type

Ce comportement est cohérent avec la philosophie "transparence + déterminisme" : aucune donnée n'est détruite silencieusement, l'utilisateur est informé de l'impact avant confirmation, et l'implémentation reste simple (une transaction, pas de soft delete à gérer).

---

## Notes sur l'ordre de déploiement

Pour minimiser les risques en production :

1. Déployer la migration Prisma (table `CustomActionType`, champs `Action`, enum `CUSTOM`) sans activer la feature côté UI.
2. Déployer le backend (API CRUD, pipeline extraction étendu) — les types custom sont vides pour tous les users, aucun impact.
3. Déployer le frontend (Settings + missing-action) — la feature devient utilisable.
4. Monitorer les faux positifs via les logs de l'extraction sur les 48h suivant le déploiement.
