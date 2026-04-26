# Personas — Regex Power & Validation Visuelle

Ces personas complètent et étendent ceux définis pour la feature custom-actions (Marc, Léa, Camille). Ils sont calibrés sur les besoins spécifiques du mode regex avancé.

---

### Persona : Thomas

- **Role** : Développeur backend, DSI d'une PME de 30 personnes
- **Contexte** : Reçoit des emails de CI/CD (pipelines GitHub Actions, Jira, Sentry), des collègues, des prestataires. Il gère lui-même son outillage et comprend les regex.
- **Goals** :
  - Capturer automatiquement les demandes de déploiement en production (`deploy prod`, `go live`)
  - Détecter les références de tickets Jira (`PROJ-\d+`) dans les demandes de review
  - Ne jamais rater une alerte prestataire contenant un numéro de contrat
- **Pain points** :
  - Le mode keywords ne lui suffit pas : `deploy` capture trop large (newsletters DevOps, documentation)
  - Il veut `\bdeploy\s+prod(uction)?\b` avec word boundary exacte
  - Aucun outil de messagerie ne lui offre une couche de règles déterministes auditables
- **Rapport avec les regex** : Expert. Écrit ses propres patterns de zéro. Veut juste une interface pour les tester directement sur ses emails.
- **Key scenarios** :
  - Crée un type `Déploiement prod` avec regex `\bdeploy(?:er|ment)?\s+(?:en\s+)?prod(?:uction)?\b`
  - Colle 3 phrases issues d'un vrai email dans la zone de test, vérifie les highlights avant de sauvegarder
  - Modifie la regex en direct quand un faux positif remonte

---

### Persona : Sophie

- **Role** : Responsable comptable, cabinet de 8 personnes
- **Contexte** : Reçoit ~50 emails/jour : factures, relances fournisseurs, validations de paiement, notes de frais. N'a aucune connaissance de regex mais est à l'aise avec Excel et des formules.
- **Goals** :
  - Capturer automatiquement toutes les demandes de validation de facture avec leur numéro (`FAC-2024-XXX`)
  - Détecter les relances de paiement de fournisseurs sans les confondre avec les confirmations
  - Partager ses règles avec ses deux collaborateurs (scope multi-user, futur)
- **Pain points** :
  - Le mode keywords `["facture", "payer", "FAC"]` génère trop de faux positifs (emails de confirmation de paiement déjà effectué)
  - Elle ne sait pas écrire `FAC-\d{4}-\d{3,6}` toute seule mais pourrait utiliser un template
  - Chaque faux positif lui fait perdre du temps à cliquer "Ignorer"
- **Rapport avec les regex** : Novice. Ne peut pas créer une regex de zéro, mais peut adapter un template si l'UI montre clairement les parties editables (ex. : `FAC-` est fixe, `\d{4}` = "4 chiffres").
- **Key scenarios** :
  - Choisit le template "Numéro de facture" depuis la librairie
  - L'adapte en changeant le préfixe de `FAC` à `FACT` pour son cabinet
  - Teste sur 5 phrases copiées depuis Outlook, voit que les factures d'avoir sont aussi capturées (faux positif)
  - Affine le pattern avec l'aide du message d'erreur explicite

---

### Persona : Romain

- **Role** : Directeur juridique, cabinet d'avocats d'affaires, 3 associés + 5 collaborateurs
- **Contexte** : Gère des dossiers avec des numéros de RG (Registre Général du tribunal), des délais de dépôt au greffe, des audiences. Chaque cabinet a ses propres codes de référence internes.
- **Goals** :
  - Capturer les demandes urgentes identifiées par des codes dossier (`RG 24/12345`, `dossier n°...`)
  - Standardiser les règles de détection pour tous les collaborateurs (même jeu de types custom partagé)
  - S'assurer qu'aucune échéance judiciaire n'est manquée — zero false negative acceptable, quelques faux positifs tolérables
- **Pain points** :
  - Les règles de détection varient selon les collaborateurs : chacun crée ses types keywords différemment
  - L'absence de partage force chaque avocat à reconfigurer les mêmes types
  - Les patterns sont complexes (`RG\s+\d{2}/\d{4,6}`) et ne peuvent pas être exprimés en mots-clés simples
- **Rapport avec les regex** : Intermédiaire. A vu des regex dans des macros Excel au cabinet. Comprend la logique (`\d` = chiffre) mais n'écrit pas des patterns complexes sans assistance.
- **Key scenarios** :
  - Un collaborateur écrit la regex `RG\s+\d{2}\/\d{4,6}` et la partage (via templates communautaires, futur scope)
  - Romain importe ce template dans son compte et teste sur ses emails du jour
  - La visualisation inline depuis `/missing-action` lui permet de voir que le pattern rate les références sans espace (`RG24/12345`) — il corrige le pattern en ajoutant `\s*`

---

## Tableau comparatif — rapport aux regex

| Persona | Mode attendu | Crée regex seul | Besoin templates | Besoin visualisation |
|---|---|---|---|---|
| Thomas | Regex expert | Oui | Non | Oui (confirm) |
| Sophie | Keywords + templates | Non | Oui (indispensable) | Oui (indispensable) |
| Romain | Regex guidée | Parfois | Oui | Oui |

## Implications de design

- Le **mode keywords doit rester le défaut** et fonctionner comme en v0.5.0 — Thomas, Sophie et Romain en ont chacun l'usage
- La **librairie de templates** est critique pour Sophie et Romain ; optionnelle pour Thomas
- La **zone de test interactive** est indispensable pour les trois — c'est le feature unificateur
- Le **feedback d'erreur regex** (syntaxe invalide, pattern trop risqué) doit être lisible par un non-développeur (pas juste `SyntaxError: Invalid regular expression`)
