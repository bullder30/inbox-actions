# Vision — Regex Power & Validation Visuelle (v0.6.0)

## Elevator Pitch

Inbox Actions devient l'outil de référence pour les professionnels qui veulent **contrôler 100% de leurs règles d'extraction**, sans boite noire ni magie algorithmique. Avec le mode "regex avancé" pour les types custom, chaque utilisateur peut exprimer des patterns métier arbitrairement précis — et voir en temps réel quelles phrases d'un email matchent ou non avant même d'activer la règle.

## Positionnement "Pro"

### Avant (v0.5.0)
- L'utilisateur définit des **mots-clés simples** (ex. `["review", "PR"]`)
- Le backend compile `\b(review|PR)\b` automatiquement
- Transparent, mais limité : impossible de distinguer `FAC-2024-001` d'un simple `facture` ou d'exprimer des patterns structurés (numéros de dossier, formats dates, codes internes)

### Après (v0.6.0)
- L'utilisateur peut basculer en **mode regex** et écrire `FAC-\d{4}-\d{3,6}` ou `\b(CRA|note de frais)\s+(?:mensuel|du mois)\b`
- La validation visuelle surligne les matches en temps réel dans une zone de test
- Les utilisateurs non-techniques restent sur le mode keywords par défaut — **aucune régression**

### Philosophie produit — alignement

La regex est l'incarnation parfaite de la promesse "transparence + déterminisme" :
- **Zéro magie** : la règle est lue par un humain, vérifiable, auditée
- **Déterministe** : le même email donne toujours le même résultat, sans aléatoire ni drift de modèle
- **Debuggable** : l'utilisateur voit exactement quelle portion de phrase a déclenché l'action
- **Différenciation vs IA black-box** : Hey, Superhuman, Spark extraient des tâches via LLM — opaque, inconsistant, non-auditable. Inbox Actions est le seul outil où l'utilisateur peut expliquer pourquoi une action a été détectée, avec la preuve textuelle exacte.

### Cible : power users professionnels

| Secteur | Usage regex typique |
|---|---|
| Juridique | `\b(greffe|tribunal|RG n°\s*\d+)\b` |
| Finance / Comptabilité | `FAC-\d{4}-\d+`, `avoir\s+n°` |
| DSI / Équipes tech | `PR\s*#\d+`, `JIRA-\d+`, `deploy\s+prod` |
| Cabinet RH | `\b(CRA|note de frais|bulletin)\b` |

Ces utilisateurs savent ce qu'est une regex, ou peuvent copier-coller depuis des templates métier. Ils ne sont pas servis par les outils grand public.

## Différenciation concurrentielle

| Critère | Inbox Actions (v0.6.0) | Hey / Superhuman | Todoist / Notion |
|---|---|---|---|
| Extraction déterministe | Regex explicite | LLM opaque | Non |
| Règles 100% contrôlées | Oui | Non | Non |
| Visualisation du match | Oui (highlight) | Non | Non |
| Auditabilité RGPD | Oui (pattern transparent) | Difficile | N/A |
| Patterns métier custom | Oui (regex libre) | Non | Non |

## Décisions verrouillées — intégrées à l'ADR-005

### D1 — Stratégie anti-ReDoS : double couche obligatoire

**Gate primaire (création)** : `safe-regex` analysé statiquement sur le pattern au moment de la sauvegarde. Si `safeRegex(pattern) === false`, l'API renvoie `422` immédiatement. Aucun pattern dangereux n'atteint la DB.

**Filet de sécurité runtime (exécution)** : `vm.runInNewContext` avec timeout **200 ms** lors de l'application du pattern au corps d'un email pendant le scan. Si le timeout se déclenche en production : log warning `[EXTRACTION TIMEOUT] pattern=<slug> email=<id>` + skip de cet email (le scan continue sans crash). Les deux couches sont MUST — aucune n'est optionnelle.

### D2 — Mode par défaut : keywords

`keywords` reste le mode par défaut dans les formulaires de création et d'édition (Settings + `/missing-action`). Un toggle discret **"Activer le mode regex avancé"** bascule le formulaire : le champ keywords est masqué, remplacé par un champ unique **"Pattern regex"**. Aucune régression pour les utilisateurs existants ou non-techniques.

### D3 — Visualisation : full scope dans le MVP v0.6.0

Les deux surfaces de visualisation sont dans le périmètre MVP :

- **Settings** : zone de test (textarea de phrases collées manuellement) avec highlight des matches.
- **`/missing-action`** : preview temps réel sur le corps complet de l'email. Nécessite l'endpoint `/api/email/[id]/body` — **cet endpoint n'existe pas** (vérifié dans le code : `app/api/email/` ne contient pas de route `[id]/body`). Il doit être créé en Phase 2.

### D4 — Templates métier : inclus dans le MVP v0.6.0

Catalogue de **10-15 templates** par secteur métier, fichier statique `lib/regex-templates.ts`. Exemples de catégories : comptabilité (`FAC-\d{4}-\d+`, `avoir n°\d+`), juridique (`dossier n°\d+`, `RG n°\s*\d+`), IT (`PR #\d+`, `JIRA-\d+`), RH (`\bCRA\b`, `note de frais`). L'utilisateur sélectionne un template, le pattern est pré-rempli et reste éditable avant sauvegarde.

---

Aucune question ouverte ne subsiste. La Phase 2 (Architecture — data model + API contracts + ADR-005) peut démarrer.
