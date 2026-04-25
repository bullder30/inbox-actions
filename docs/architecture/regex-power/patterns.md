# Patterns — Regex Power

Documentation des patterns architecturaux choisis pour la feature regex-power.

| Pattern | Application | Justification |
|---|---|---|
| **Strategy étendu** | `extractCustomActionsFromEmail` switche entre `compileKeywordsRegex` (mode KEYWORDS) et `compileSafeUserRegex` (mode REGEX) | Découple la logique de matching du choix d'algorithme. Permet d'ajouter d'autres modes (LLM, ML) en V2 sans toucher l'orchestrateur ni les callers. |
| **Sandbox / Bulkhead** | `vm.runInNewContext` + timeout 200ms isole l'exécution regex utilisateur du runtime principal | Un pattern crafté ne peut crasher le scan ni leak des données. Un timeout sur 1 email ne tue pas le scan global (skip + log + continue). |
| **Defense in depth** | `safe-regex` (gate création) + `vm timeout` (gate runtime) — deux couches indépendantes | Couvre les faux négatifs de `safe-regex` (heuristique) avec le filet runtime. ADR-005. |
| **Snapshot pattern** (continu de custom-actions) | `Action.customTypeLabel/Color` figés (déjà existant). `mode` et `regexPattern` **ne sont PAS** snapshottés sur Action (info type-level). | Historique reste lisible même si le pattern source change. Le badge affiché dépend du snapshot, pas du pattern actuel. |
| **Server-side validation** (continu) | `safe-regex` + sandbox côté API uniquement, **jamais** côté client | Cohérence (V8 navigateur ≠ Node) + sécurité (pas d'exposition moteur regex client). ADR-007. |
| **Cache TTL** (per-user RAM) | Email body cache 5 min via Map LRU + `Cache-Control: private, max-age=300` | Évite re-fetch IMAP/Graph pendant la session de test (UX réactive sans surcharger les providers). |
| **Constants statiques** | `lib/regex-templates.ts` pour les templates métier (pas en DB) | Versionning Git + simplicité MVP. Pas de besoin runtime de modifier les templates (admin-defined, pas user-defined). En V2 si besoin de marketplace, migrer en DB. |
| **Discriminated Union** (Zod) | Schemas POST/PATCH custom-action-types utilisent `z.discriminatedUnion("mode", [keywordsSchema, regexSchema])` | Validation type-safe + erreurs claires pour chaque mode. |
| **Optimistic UI** (continu) | SWR pattern existant — list mute après PATCH custom-action-type | Cohérence UX avec le reste de l'app. |
| **Debounce + cache UI** | Test-regex API call debounced 300ms côté client + cache mémoire keyé `pattern + textHash` | Réduit le nombre de requêtes serveur sans sacrifier la réactivité visuelle. |
| **Singleton-flight** (optionnel) | Si 2 requêtes concurrent pour le même email body → une seule promesse partagée | Évite les doubles appels IMAP/Graph. Pas critique au MVP, à ajouter si la latence devient un problème. |

## Conventions de nommage

- **Mode** : enum `KEYWORDS | REGEX` (toujours uppercase, comme les autres enum Prisma)
- Pattern field : `regexPattern` (camelCase, explicite vs `pattern` ambigu)
- Helpers : `lib/actions/regex-executor.ts`, `lib/regex-templates.ts`, `lib/email-body-cache.ts`
- Composants : `<RegexTemplatePicker />`, `<MatchHighlighter />`
- Routes : `/api/custom-action-types/test-regex` (kebab-case URL), `/api/email/[id]/body`

## Anti-patterns à éviter

- ❌ Exécuter regex côté client (cohérence + sécurité, voir ADR-007)
- ❌ Stocker les templates en DB (overhead pour MVP — fichier statique suffit)
- ❌ Stocker `mode/regexPattern` snapshots sur `Action` (info type-level, pas instance-level — voir snapshot pattern de custom-actions)
- ❌ Cache email body sur disque ou DB (RGPD strict — RAM only, TTL court)
- ❌ Permettre `regexPattern` > 200 chars (anti-ReDoS + perf)
- ❌ Bypasser `safe-regex` même pour les types « validés » (toujours re-tester sur PATCH)
- ❌ Utiliser `eval()` ou `new Function()` au lieu de `vm.runInNewContext` (sandbox plus faible)
- ❌ Passer du code utilisateur arbitraire à `vm` (uniquement le pattern regex — `vm` n'est pas un sandbox de sécurité complet)
