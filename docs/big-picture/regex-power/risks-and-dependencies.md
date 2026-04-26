# Risques et Dépendances — Regex Power & Validation Visuelle

---

## Dépendances

| Feature | Depends on | Type | Notes |
|---------|------------|------|-------|
| Epic 1 — champ `regexPattern` | Custom Actions v0.5.0 livré (table `CustomActionType` existante) | Technique | Migration additive uniquement — pas de breaking change si v0.5.0 est en prod |
| Epic 1.5 — gate primaire anti-ReDoS | `safe-regex` (npm) | Technique | Stratégie tranchée (D1) : `safe-regex` en gate primaire (422 à la création), `vm.runInNewContext` timeout 200ms en filet runtime. Les deux couches sont MUST — Phase 2 peut démarrer |
| Epic 1.6 — filet runtime ReDoS | `vm.runInNewContext` Node.js (zéro dépendance externe) | Technique | Overhead ~5-10ms par email scanné — acceptable. Si timeout déclenché : log + skip email + scan continue (pas de crash) |
| Epic 2 — UI zone de test | `mode` + `regexPattern` disponibles dans l'API PATCH/POST | Technique | Epic 1 est un prérequis strict |
| Epic 2.3 — highlight temps réel | Endpoint serveur `/api/custom-action-types/test-regex` | Technique | Le test s'exécute côté serveur (cohérence garantie, sécurité) — pas d'exécution regex brute dans le navigateur. L'endpoint reçoit `{ pattern, text }` et retourne les positions des matches |
| Epic 3 — `RegexEmailPreview` | Endpoint `/api/email/[id]/body` | Technique | **Endpoint absent** (vérifié : `app/api/email/` ne contient pas de route `[id]/body`). À créer en Phase 2. Récupère le corps à la volée via le provider (IMAP ou Graph), sans stockage (RGPD) |
| Epic 4 — templates | Aucune dépendance forte | Technique | Fichier statique `lib/regex-templates.ts`, livrable indépendamment des autres epics |

---

## Registre des risques

### Risques techniques

#### R-01 — ReDoS (priorité absolue, non-négociable)

**Description** : Un utilisateur (malveillant ou simplement inexpérimenté) soumet un pattern regex qui provoque un backtracking catastrophique dans le moteur V8. Exemple : `(a+)+b`, `(.+)+\s`, `(a|a)+`. Sur un email de 10 Ko, ces patterns peuvent bloquer le thread Node.js pendant plusieurs secondes voire le faire crasher.

**Probabilité** : Haute (tout power user qui écrit des regex peut créer ce pattern par accident)

**Impact** : Critique — peut bloquer le serveur pour tous les utilisateurs (Node.js single-threaded), corrompre le cron de scan, provoquer un timeout Vercel/Railway

**Stratégie retenue (D1 — verrouillée) : double couche**

1. **Validation syntaxique** : `new RegExp(pattern)` wrappé en try/catch — premier filtre, catch les patterns invalides avant tout
2. **Gate primaire `safe-regex`** : analyse statique à la sauvegarde. Rejette les structures exponentielles connues (`(a+)+`, nested quantifiers, etc.). `if (!safeRegex(pattern)) return 422 { code: "REDOS_RISK" }`. Aucun pattern dangereux n'atteint la DB
3. **Longueur maximale** : 200 caractères pour le pattern brut
4. **Filet runtime `vm.runInNewContext` timeout 200ms** : appliqué à chaque exécution du pattern sur un email pendant le scan. Si le timeout se déclenche : `[EXTRACTION TIMEOUT] pattern=<slug> email=<id>` loggé + email skip (scan continue sans crash ni exception propagée)
5. **Monitoring** : tous les timeouts runtime loggés pour détecter les faux négatifs de `safe-regex`

**Limitation connue de `safe-regex`** (faux négatifs) : ne détecte pas 100% des cas de ReDoS. C'est précisément pour ça que le filet `vm.runInNewContext` est MUST et non optionnel. Les deux couches sont complémentaires — ni l'une ni l'autre n'est suffisante seule.

**Décision tranchée** : `vm.runInNewContext` retenu (zéro dépendance native, compatible Vercel serverless, overhead ~5-10ms par email). `re2` écarté (compilation native difficile en serverless). La Phase 2 peut démarrer sans question ouverte sur ce point.

---

#### R-02 — Divergence comportement client vs serveur (risque éliminé par D3)

**Description** : La décision D3 impose que le highlight de la zone de test (Epic 2.3) passe par l'endpoint serveur `/api/custom-action-types/test-regex` plutôt qu'une exécution regex brute dans le navigateur. Cela élimine structurellement les divergences V8 client/serveur qui constituaient le risque principal.

**Risque résiduel** : différences de version V8 entre l'environnement de build/deploy et le navigateur de l'utilisateur restent théoriquement possibles, mais le test étant exécuté sur le serveur de production, la cohérence est garantie par construction.

**Probabilité résiduelle** : Très faible

**Impact** : Faible — le résultat du highlight est désormais le même que le résultat d'extraction en production

**Mitigation** : Aucune mitigation active nécessaire. Documentation suffisante : préciser que les features regex supportées sont celles de Node.js V8 (lookbehind, unicode property escapes avec flag `u` système). Conserver l'interdiction des flags dangereux (Epic 1.8).

---

#### R-10 — Endpoint `/api/email/[id]/body` : nouveau à créer, risques spécifiques

**Description** : L'endpoint de récupération du corps complet d'un email depuis `/missing-action` n'existe pas dans le code actuel (`app/api/email/` ne contient aucune route `[id]/body`). Sa création introduit des risques spécifiques :

- **Autorisation** : un utilisateur A ne doit pas pouvoir accéder au corps d'un email appartenant à l'utilisateur B via l'ID — vérification `userId === session.user.id` obligatoire
- **Disponibilité du provider** : si le token IMAP ou Graph est expiré au moment de la preview, la requête échoue — l'UI doit afficher un état d'erreur lisible ("Corps de l'email indisponible — reconnectez votre compte email")
- **Taille du corps** : les emails HTML peuvent être lourds (> 100 Ko avec images inline en base64) — tronquer à 50 Ko pour la preview (suffisant pour la détection de matches)
- **RGPD** : le corps ne doit jamais être persisté en DB ni loggé — réponse directement streamée ou en mémoire uniquement

**Probabilité** : Certaine (l'endpoint doit être créé — risque d'implémentation, pas d'existence)

**Impact** : Moyen — si mal implémenté : fuite de données inter-utilisateurs ou exposition de corps d'emails en logs

**Mitigation** : Ownership check systématique (emailMetadata.userId === session.user.id). Pas de logging du body. Tronquer à 50 Ko. Gérer l'expiration de token proprement (catch + 503 lisible). Test d'intégration couvrant l'accès cross-user (404 attendu).

---

#### R-03 — Performance : regex complexes sur volume d'emails

**Description** : Un utilisateur avec 10 types custom, tous en mode regex avec des patterns lourds, scanne 100 emails au cron de 8h. Si chaque pattern prend 5ms sur un email de 5 Ko, le cron prend 10 × 100 × 5ms = 5 secondes supplémentaires par utilisateur.

**Probabilité** : Faible (10 types regex complexes est un cas extrême, la plupart des users auront 2-3 types)

**Impact** : Faible en MVP (< 100 users actifs)

**Mitigation** : Mesurer le temps d'extraction par user dans le cron (`[CRON] user@example.com extraction took Xms`). Ajouter un seuil d'alerte (> 2s par user → log warning). Implémenter le cache LRU (ADR-002 note "à mesurer si besoin réel") si les métriques le justifient.

---

#### R-04 — Sécurité : injection via pattern regex dans l'extracteur

**Description** : Le pattern stocké en DB est appliqué directement comme `RegExp`. Si un attaquant compromet la DB ou l'API, il peut injecter un pattern qui exfiltre des données via des groupes de capture ou un comportement inattendu.

**Probabilité** : Très faible (nécessite une compromission préalable)

**Impact** : Faible (l'extracteur ne retourne que des strings extraites du corps de l'email, pas de données système)

**Mitigation** : Validation stricte du pattern à la sauvegarde. Pas d'évaluation dynamique de code (`eval`, `Function`). Le pattern est uniquement utilisé comme `new RegExp(pattern, 'iu')`.

---

### Risques UX

#### R-05 — Fracture entre power users et débutants

**Description** : L'ajout du mode regex dans l'UI Settings risque d'intimider les utilisateurs non-techniques qui y voient de la complexité alors qu'ils n'en ont pas besoin.

**Probabilité** : Moyenne

**Impact** : Moyen — augmentation du taux de churn sur les premiers jours post-lancement, feedback négatif "trop compliqué"

**Mitigation** :
- Le mode keywords reste le défaut absolu — le sélecteur "Mode avancé" est discret (lien texte, pas un toggle proéminent)
- Les types existants v0.5.0 ne changent pas visuellement
- La librairie de templates (Epic 4) offre un pont aux utilisateurs intermédiaires sans forcer l'écriture de regex from scratch

---

#### R-06 — Erreurs de regex non compréhensibles pour les non-devs

**Description** : `SyntaxError: Invalid regular expression: /[\w+/: Unterminated character class` n'est pas un message exploitable par Sophie (persona comptable).

**Probabilité** : Haute (dès qu'un non-dev écrit une regex)

**Impact** : Moyen — frustration, abandon du mode regex, support

**Mitigation** : Parser le message d'erreur V8 et le transformer en message lisible. Exemples :
- "Unterminated character class" → "Un crochet `[` est ouvert mais pas fermé — vérifiez vos `[...]`"
- "Nothing to repeat" → "Un quantificateur (`+`, `*`, `?`) est utilisé sans caractère avant lui"
- Proposer un lien vers un guide regex simple en FR

---

#### R-07 — Faux positifs cachés derrière la complexité regex

**Description** : Un pattern trop permissif (`\b\w+\b`) génère des centaines d'actions parasites. L'utilisateur n'a pas de retour sur la permissivité avant d'activer le type.

**Probabilité** : Moyenne (les non-experts tendent vers des patterns larges)

**Impact** : Moyen — pollution de la liste d'actions, perte de confiance dans l'outil

**Mitigation** :
- Warning non-bloquant si le pattern matche > 50% de la phrase de test (Epic 2.5)
- Afficher le nombre de matches dans la zone de test pour sensibiliser
- Ne pas activer automatiquement le type après création depuis `/missing-action` si la zone de test montre > 10 matches sur 1 seule phrase (optionnel, UX à préciser)

---

### Risques produit

#### R-08 — Sur-positionnement tech qui exclut les non-devs

**Description** : La communication sur "Regex Power" peut donner l'image d'un outil pour développeurs uniquement, alors que la valeur principale (extraction automatique fiable) est universelle.

**Probabilité** : Faible si la communication est bien calibrée

**Impact** : Faible à moyen — ralentissement de l'acquisition

**Mitigation** : Nommer la feature "Règles avancées" plutôt que "Regex avancée" dans l'UI et le marketing. Réserver "regex" au vocabulaire technique (tooltips, documentation).

---

#### R-09 — Complexité de support (debug d'un pattern utilisateur)

**Description** : Un utilisateur signale "mon pattern ne detecte pas la bonne chose". Reproduire le bug nécessite de connaître le pattern, l'email, et l'environnement — difficile à debugger en async.

**Probabilité** : Moyenne (dès que la base d'utilisateurs regex grandit)

**Impact** : Moyen — temps support disproportionné

**Mitigation** :
- La visualisation (Epic 2 + Epic 3) réduit drastiquement ces signalements en donnant à l'utilisateur les outils pour débugger lui-même
- Exposer dans le détail d'une Action la `sourceSentence` surlignée avec le pattern qui a matché (information déjà présente en DB)
- Logger côté serveur le pattern utilisé lors de chaque extraction (utile pour reproduire)

---

## Synthèse des risques par criticité

| ID | Risque | Probabilité | Impact | Priorité | Statut |
|---|---|---|---|---|---|
| R-01 | ReDoS | Haute | Critique | BLOQUANT | Stratégie verrouillée (D1) : `safe-regex` gate + `vm` timeout 200ms — Phase 2 peut démarrer |
| R-10 | Endpoint `/api/email/[id]/body` à créer | Certaine | Moyen | MUST Phase 2 | À implémenter — ownership check + RGPD + tronquage 50 Ko |
| R-06 | Messages d'erreur illisibles | Haute | Moyen | MUST — livrer avec le MVP | Epic 2.4 + Epic 1.7 |
| R-05 | Fracture UX power/débutant | Moyenne | Moyen | MUST (design) | Adressé par D2 (keywords par défaut, toggle discret) |
| R-07 | Faux positifs permissivité | Moyenne | Moyen | SHOULD | Epic 2.5 (warning non-bloquant) |
| R-02 | Divergence client/serveur | Très faible | Faible | Éliminé | D3 impose exécution serveur via endpoint dédié |
| R-03 | Performance volume | Faible | Faible | COULD (monitoring) | Monitoring logs cron existant |
| R-08 | Sur-positionnement tech | Faible | Faible | COULD (communication) | Nommer "Règles avancées" dans l'UI |
| R-09 | Complexité support | Moyenne | Moyen | Réduit par Epic 2+3 | Visualisation self-service |
| R-04 | Injection pattern | Très faible | Faible | Mitigé | Validation stricte à la sauvegarde |
