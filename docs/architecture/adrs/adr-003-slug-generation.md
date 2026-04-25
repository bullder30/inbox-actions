# ADR-003 : Génération du slug + unicité par user

## Status
Accepted — validé Phase 1 (Big Picture, décision D2)

## Context

Le nom d'un type custom est texte libre (1-50 chars). Pour permettre une **clé stable** + recherche/index + URL friendly, on génère un slug côté backend.

Risque identifié : deux noms différents peuvent produire le même slug.
- Ex. `"Review Code"` et `"review-code"` → tous deux normalisés en `review_code`
- Ex. `"Dépôt Greffe"` et `"depot greffe"` → tous deux en `depot_greffe`

Trois stratégies possibles :
- (a) Auto-suffixer : `review_code`, `review_code_2`, `review_code_3`...
- (b) Renvoyer 409 Conflict explicite, l'utilisateur doit choisir un autre nom
- (c) Utiliser un UUID interne et ignorer le slug pour l'unicité (slug juste cosmétique)

## Decision

**Option (b)** : slug déterministe + contrainte SQL `@@unique([userId, slug])` + sur conflit, renvoyer **409 Conflict** avec un message clair ("Un type avec un nom équivalent existe déjà — choisissez un autre nom").

Algorithme de slug (helper `lib/slug.ts`) :
```ts
function nameToSlug(name: string): string {
  return name
    .normalize('NFD')                      // sépare diacritiques
    .replace(/[̀-ͯ]/g, '')       // supprime accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')           // tout non alphanum → underscore
    .replace(/^_+|_+$/g, '');              // trim underscores en bordure
}
```

## Consequences

### Positive
- **Déterministe** : le même nom produit toujours le même slug, indexable et cherchable
- **Cohérent avec la philosophie produit** : pas de comportement implicite (transparence > magie). L'utilisateur sait exactement pourquoi son nom est rejeté.
- Pas de "Type 1", "Type 2", "Type 2_2" qui pollueraient l'UI

### Negative
- UX : l'utilisateur doit comprendre le 409. Mitigation = **message d'erreur clair** dans la réponse API et dans le formulaire UI ("Vous avez déjà un type équivalent : [nom existant]").

### Risks
- Si le nom existant est dans un type `isActive: false` (désactivé), faut-il le considérer pour l'unicité ? Décision : **oui**, on garde l'unicité globale par user (sinon réactiver = collision possible).
