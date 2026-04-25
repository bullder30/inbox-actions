# Vision — Actions personnalisées utilisateur

## Elevator pitch

Inbox Actions détecte aujourd'hui 5 types d'actions prédéfinis dans vos emails en français. La feature "Actions personnalisées" permet à chaque utilisateur de définir ses propres types d'actions — avec leurs propres mots-clés déterministes — pour que le système parle le vocabulaire de son métier plutôt que d'imposer un vocabulaire générique.

La promesse reste identique : si c'est ambigu, on ne crée pas d'action. Les règles custom sont explicites, éditables et compréhensibles par l'utilisateur, comme les 5 types natifs. Pas de ML, pas de boîte noire.

## Alignement avec la philosophie produit

Inbox Actions est construit sur deux engagements publics :

1. **Déterminisme** — "Vous savez toujours pourquoi une action a été détectée ou ignorée." (FAQ landing)
2. **Pas d'IA opaque** — "Si une phrase est ambiguë, aucune action n'est créée." (FAQ landing)

Les actions personnalisées ne doivent pas déroger à ces engagements. Un type custom doit être une liste de patterns regex (ou mots-clés compilés en regex) que l'utilisateur peut lire, tester et supprimer. Le système applique exactement le même pipeline d'extraction que pour les types natifs — aucun chemin de code spécial, aucune heuristique cachée.

## Problème résolu

Les 5 types natifs couvrent les usages génériques (envoyer un fichier, payer une facture, rappeler quelqu'un). Ils ne couvrent pas les vocabulaires métier :

- Un avocat reçoit "Pouvez-vous rédiger les conclusions avant vendredi" → aucune action détectée.
- Un développeur lit "Merci de merger la PR #42 avant le déploiement" → aucune action détectée.
- Un chef de projet voit "Prépare le reporting Q2 pour lundi" → aucune action détectée.

L'utilisateur finit dans `/missing-action` à créer des actions manuelles une par une, sans mécanisme pour capitaliser sur ces corrections récurrentes.

## Proposition de valeur

- L'utilisateur définit ses types une fois dans Settings, et le moteur les applique à tous les emails suivants automatiquement.
- La création depuis `/missing-action` permet de créer un type custom en contexte, directement depuis la phrase qui a manqué.
- Le choix explicite entre "action ponctuelle" et "règle pour le futur" évite toute ambiguïté sur ce que le système va faire à l'avenir.

## Périmètre MVP (1 sprint)

- CRUD de types custom dans Settings
- Intégration au pipeline d'extraction regex existant
- Création depuis missing-action (flux ponctuel + flux "règle")
- Affichage du type custom dans l'ActionCard (badge label texte, sans nécessité d'icône custom en MVP)

## Décisions verrouillées (Phase 1 — tranchées, non réouvertes en Phase 2)

Ces quatre décisions sont closes. La Phase 2 (Architecture) les implémente directement sans les remettre en question.

### D1 — Schéma DB : Option B retenue

L'enum `ActionType` est étendue avec la valeur `CUSTOM`. Une table `CustomActionType` stocke les règles utilisateur. Le modèle `Action` reçoit deux nouveaux champs :
- `customTypeId String?` — FK nullable vers `CustomActionType` (nullifiée à la suppression du type, pas de cascade)
- `customTypeLabel String?` — valeur dénormalisée figée au moment de l'extraction (reste lisible même si le type est supprimé)

### D2 — Format du nom des types custom

Le nom est un texte libre (ex. "Review code", "Dépôt au greffe"). Contraintes : 1–50 caractères, unique par utilisateur (case-insensitive). Un slug interne est généré côté backend pour le matching regex : lowercase, sans accents, espaces remplacés par underscore (ex. "Review Code" → `review_code`). Le slug n'est pas exposé dans l'UI.

### D3 — Limite max de types custom par utilisateur : 10

La limite est enforced côté API (400 avec message explicite si dépassée). Elle n'est pas enforced par une contrainte DB en MVP — acceptable pour ce scope. La limite est configurable via variable d'environnement pour les futures évolutions.

### D4 — Badge couleur : MUST (palette de 8 couleurs prédéfinies)

La couleur du badge est une feature MUST, promue depuis SHOULD. Le formulaire de création/édition dans Settings inclut un color picker limité à 8 couleurs prédéfinies. L'ActionCard utilise cette couleur pour le badge du type custom. Si l'utilisateur ne choisit pas de couleur, une couleur par défaut est assignée automatiquement par rotation sur les 8 couleurs (couleur = `index % 8` au moment de la création).
