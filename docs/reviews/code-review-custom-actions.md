# Code Review — custom-actions

**Phase 8 — AMC Lifecycle**
**Périmètre :** commits `0f9c6e0..8802f5f` (Phase 5 GREEN + Phase 6 refactor)

## Synthèse

- **Verdict global** : REQUEST CHANGES
- **Issues** : 1 CRITICAL · 3 HIGH · 4 MEDIUM · 5 LOW
- Fondations solides (helpers purs isolés, validation Zod cohérente, transaction Prisma atomique cas B, ownership stricte, escape regex anti-ReDoS).
- **Fonctionnellement incomplet** : AC-8 non implémenté → les types custom ne sont jamais chargés ni passés à l'extracteur dans le pipeline réel.

---

## Issues détaillées

### CRITICAL

**#1 — `lib/cron/daily-sync-job.ts` + `app/api/email/analyze/route.ts` : AC-8 non implémenté**

L'extracteur a la signature étendue `(ctx, exclusions, customTypes)` et `extractCustomActionsFromEmail` est exporté. Mais aucun caller n'a été modifié : cron + analyze appellent toujours `extractActionsFromEmail(ctx, exclusions)` sans le 3ème argument. Conséquences :
- US-5 entier inopérant (US-5.1 à US-5.6)
- `prisma.action.createMany()` ne map ni `customTypeId`, ni `customTypeLabel`, ni `customTypeColor` → snapshot perdu, FK nulle

**Fix recommandé** (pour les 2 callers, juste avant la boucle d'analyse) :
```ts
const customTypes = await prisma.customActionType.findMany({
  where: { userId, isActive: true },
  select: { id: true, name: true, keywords: true, color: true, isActive: true },
});

const extractedActions = extractActionsFromEmail(ctx, userExclusions, customTypes);

// Dans createMany.data.map :
{
  // ... champs existants
  customTypeId: action.customTypeId ?? null,
  customTypeLabel: action.customTypeLabel ?? null,
  customTypeColor: action.customTypeColor ?? null,
}
```

Ajouter un test d'intégration `tests/cron/daily-sync-custom.test.ts`.

---

### HIGH

**#2 — `lib/actions/extract-actions-regex.ts:975` : `\b` ne match pas les mots FR commençant par accent**

`\b` en JavaScript délimite uniquement les frontières `\w` = `[A-Za-z0-9_]`. Un keyword `éditer` précédé d'un espace ne sera jamais matché. Métier visé francophone.

**Fix** dans `compileKeywordsRegex` :
```ts
return new RegExp(
  `(?<![\\p{L}\\p{N}_])(${validKeywords.join("|")})(?![\\p{L}\\p{N}_])`,
  "iu"
);
```

**#3 — `app/api/actions/manual/route.ts:154-158` : Cas C accepte `keywords` sans warning si `persistAsRule: false`**

Risque de confusion silencieuse : un client envoyant `persistAsRule: false` + `keywords: [...]` croit créer une règle alors que rien n'est persisté. Soit retourner un warning dans la réponse, soit rejeter en 422.

**#4 — Race condition limite 10 (`app/api/custom-action-types/route.ts:84-92` + `app/api/actions/manual/route.ts:185-193`)**

Le `count` puis `create` ne sont pas dans la même transaction. Deux requêtes parallèles peuvent créer un 11ème type. La spec edge case 4.4 mentionne explicitement la décision : check + create dans une transaction.

**Fix** :
```ts
const result = await prisma.$transaction(async (tx) => {
  const existingCount = await tx.customActionType.count({ where: { userId } });
  if (existingCount >= MAX_TYPES_PER_USER) throw new Error("LIMIT_REACHED");
  return tx.customActionType.create({ /* ... */ });
});
```

---

### MEDIUM

- **#5** `lib/slug.ts:16` : caractères Unicode invisibles dans la regex `[̀-ͯ]` → préférer `̀-ͯ`
- **#6** `app/api/actions/manual/route.ts:108` : `new Date(emailReceivedAt)` peut produire `Invalid Date` non rejeté
- **#7** `app/api/actions/manual/route.ts:25-40` : type `ManualBody` permissif sans Zod (incohérent avec le reste)
- **#8** `lib/custom-action-types/validation.ts:43-46` : règle "keyword < 4 chars sauf uppercase" non spécifiée, à documenter

### LOW

- **#9** `lib/custom-action-colors.ts:64-66` : `safeIndex` over-engineered (modulo négatif jamais possible)
- **#10** Logs `console.error` orphelins (déjà préexistant dans le codebase)
- **#11** Cas A : commentaire à enrichir pour expliciter que `customTypeName/Color` sont silencieusement ignorés
- **#12** `MAX_KEYWORDS_PER_RULE = 50` duplique `MAX_KEYWORDS` de `lib/custom-action-types/validation.ts`
- **#13** `truncate(customType.name, ...)` no-op (name validé à 50 chars max)

---

## Forces

- Helpers purs bien isolés (testables, réutilisables, sans dépendance Prisma)
- Échappement regex correct (`escapeRegex` + limite 60 chars + dédup)
- Ownership check rigoureux (PATCH/DELETE + cas A)
- Snapshot pattern proprement appliqué (`customTypeLabel/Color` figés)
- Transaction Prisma cas B atomique
- Validation Zod stricte (color, name, keywords)
- Tests behavior-based, naming `should_X_when_Y`
- 32 tests pour `custom-action-types.test.ts`, couverture solide
- OQ-2 et OQ-3 bien respectées

---

## Couverture spec (AC)

| AC | Statut | Test couvrant |
|---|---|---|
| AC-1 | OK | `should_return_400_when_user_already_has_10_types` |
| AC-2 | OK | Suite `nameToSlug` (5 tests) |
| AC-3 | OK | `should_return_409_when_slug_conflicts*` |
| AC-4 | OK | `should_return_422_when_color_not_in_palette` |
| AC-5 | OK | `should_return_422_when_keyword_below_4_chars` + `_exceeds_60_chars` |
| AC-6 | OK | `should_return_422_when_keyword_in_french_stoplist` |
| AC-7 | OK extracteur / **PARTIEL callers** | Test extracteur OK mais caller cron/analyze ne propage pas (CRITICAL #1) |
| **AC-8** | **NOK** | Aucun test d'intégration cron+customTypes |
| AC-9 | OK | 232 tests verts |
| AC-10 | Non vérifié dans review |
| AC-11 | OK | `should_keep_native_action_when_custom_keyword_collides_with_native_pattern` |
| AC-12 | OK | `should_rollback_transaction_when_*` |
| AC-13 | OK | `should_return_403_when_type_belongs_to_another_user` |

---

## Séquencement recommandé pour les fixes

1. **CRITICAL #1** d'abord (sans ça la feature ne sert à rien en prod). Ajouter un test d'intégration cron+customTypes.
2. **HIGH #2** (`\b` Unicode) — risque d'expérience dégradée pour les users francophones.
3. **HIGH #4** (race condition) — facile à corriger en encapsulant dans la transaction existante.
4. **HIGH #3** (warning cas C) — décision UX à valider.
5. **MEDIUM** en finition.
6. **LOW** au gré.

Re-runner `pnpm test` après chaque fix.
