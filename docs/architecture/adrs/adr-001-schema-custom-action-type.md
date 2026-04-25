# ADR-001 : Schéma `CustomActionType` + dénormalisation snapshot sur `Action`

## Status
Accepted — validé Phase 1 (Big Picture, décision D1)

## Context

Le modèle existant utilise une enum Prisma `ActionType` à 5 valeurs (`SEND | CALL | FOLLOW_UP | PAY | VALIDATE`). Pour permettre aux utilisateurs de créer leurs propres types selon leur métier, deux options s'offrent à nous :

- **Option A** — Migrer `Action.type` de enum vers `String` libre + table de référence
- **Option B** — Étendre l'enum avec `CUSTOM` + table dédiée `CustomActionType` + FK nullable

L'option A demande un refactor de toute la couche filtrage / badges UI / tests / extractor. L'option B est plus chirurgicale.

Contrainte additionnelle : la suppression d'un type custom doit préserver l'historique (les `Action` déjà extraites avec ce type doivent rester lisibles avec leur label et couleur d'origine, sans dépendance au type encore vivant).

## Decision

**Option B retenue.** Le schéma est étendu comme suit :

1. Ajouter `CUSTOM` à l'enum `ActionType` (1 migration triviale)
2. Créer une table `CustomActionType` (id, userId, name, slug, keywords, color, isActive, timestamps)
3. Ajouter sur `Action` :
   - `customTypeId String?` (FK vers `CustomActionType`, `onDelete: SetNull`)
   - `customTypeLabel String?` — **snapshot dénormalisé** du nom au moment de l'extraction
   - `customTypeColor String?` — **snapshot dénormalisé** de la couleur

Lorsque `Action.type === 'CUSTOM'` :
- Si `customTypeId IS NOT NULL` → le type custom existe encore, on peut filtrer/lister par lui
- Si `customTypeId IS NULL` (type supprimé) → on affiche tout de même `customTypeLabel` + `customTypeColor` (snapshot figé)

## Consequences

### Positive
- **Migration low-risk** : extension d'enum + nouvelle table + colonnes nullables. Aucun breaking change sur les 5 natifs ni sur les filtres existants.
- **Suppression d'un type custom** = `nullify customTypeId` (automatique via `onDelete: SetNull`) + label/color déjà figés → Actions historiques restent lisibles.
- **Renommage / changement de couleur** d'un type custom n'affecte pas les Actions historiques (snapshot figé). Cohérent avec la philosophie produit "transparence + déterminisme : ce qui a été extrait reste figé".

### Negative
- Légère redondance : `customTypeLabel` et `customTypeColor` stockés sur chaque Action de type CUSTOM. Coût négligeable (< 100 chars / row).
- Si un user veut "régénérer" toutes ses Actions historiques avec le nouveau nom/couleur après rename, il faut un re-scan manuel (pas dans MVP).

### Risks
- Migration Postgres pour étendre une enum n'est pas transactionnelle (commitée standalone). À déployer **avant** le code applicatif. Mitigation : `prisma migrate deploy` exécuté par le runner CI/CD avant le `next build` qui consommera la nouvelle valeur.
