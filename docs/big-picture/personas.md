# Personas — Actions personnalisées utilisateur

---

### Persona: Sophie

- **Role**: Avocate associée, cabinet de 4 personnes
- **Goals**: Transformer ses emails clients en tâches claires sans perdre de temps à les retranscrire manuellement. Elle veut que l'outil "comprenne" son vocabulaire juridique : rédiger des conclusions, envoyer des actes, relancer des clients pour signatures.
- **Pain points**:
  - Les 5 types natifs (SEND, CALL, FOLLOW_UP, PAY, VALIDATE) ne correspondent pas à ses actions récurrentes : "Rédiger les conclusions", "Déposer l'assignation", "Vérifier les délais de prescription".
  - Elle se retrouve systématiquement dans `/missing-action` pour recréer manuellement les mêmes types d'actions à répétition.
  - Elle a peur qu'un outil "intelligent" invente des actions ou rate des délais critiques — elle veut voir exactement quelle phrase a déclenché l'action.
- **Key scenarios**:
  1. Elle reçoit un email d'une partie adverse contenant "Merci de déposer vos conclusions avant le 10 mai". Le type natif SEND est déclenché mais le titre "Envoyer conclusions" ne reflète pas le vrai sens (déposer au greffe). Elle crée un type custom "DEPOT_GREFFE" avec pattern "déposer" et ce pattern s'applique désormais à tous ses futurs emails.
  2. Elle ouvre Settings, voit ses 3 types custom définis, les édite ou les supprime si un cabinet change de workflow.

---

### Persona: Thomas

- **Role**: Développeur fullstack freelance
- **Goals**: Gérer ses emails clients et ses emails liés à ses projets open-source sans avoir à ouvrir chaque email. Il veut que les review requests GitHub, les demandes de déploiement, les retours de recette soient capturés automatiquement.
- **Pain points**:
  - Les emails GitHub (notifications de PR, issues, pipelines) sont exclus par défaut (domaine `notifications@github.com` → filtre `notifications?@`). Il voudrait au moins que ses emails clients qui mentionnent "merger", "déployer", "recette" soient capturés.
  - Il trouve les 5 types trop orientés "gestion commerciale" pour son usage technique.
  - Il n'a pas le temps de configurer un système complexe — il veut créer un type en 30 secondes depuis la phrase qui l'a manqué.
- **Key scenarios**:
  1. Un client écrit "Peux-tu merger la PR avant la mise en prod de vendredi ?" — aucun type natif ne matche. Thomas ouvre le dialog missing-action, sélectionne la phrase, crée le type "MERGER" avec le mot-clé "merger", et coche "créer une règle pour le futur". La semaine suivante, les emails similaires sont capturés automatiquement.
  2. Il crée le type "RECETTE" avec les mots-clés "recette", "tester en prod", "valider la release" — ces patterns sont ajoutés au pipeline d'extraction.

---

### Persona: Camille

- **Role**: Chef de projet digital, équipe de 12 personnes
- **Goals**: Avoir une vue consolidée des actions que ses collaborateurs lui demandent par email — briefs, validations de livrables, reporting, arbitrages. Elle sync plusieurs boîtes (Outlook M365 + Gmail perso).
- **Pain points**:
  - Son vocabulaire projet n'est pas capturé : "Peux-tu arbitrer", "Il faut que tu briefe l'équipe", "Le reporting est attendu pour lundi", "Merci de valider le brief créa".
  - VALIDATE capture parfois ses emails (valider le brief), mais FOLLOW_UP ne capture pas "briefe l'équipe" et aucun type natif ne capture "arbitrer".
  - Elle a besoin de retrouver rapidement les actions par type (toutes ses actions "REPORTING" d'un coup), ce qui n'est pas possible avec un seul type VALIDATE générique.
- **Key scenarios**:
  1. Elle définit 4 types custom dans Settings avant de commencer à utiliser l'outil : REPORTING (mots-clés : "reporting", "rapport hebdo", "tableau de bord"), BRIEF (mots-clés : "briefe", "brief", "brief créa"), ARBITRAGE (mots-clés : "arbitrer", "décider"), LIVRABLE (mots-clés : "livrable", "livrer", "rendu final").
  2. Elle filtre la vue Actions par type REPORTING pour préparer son lundi matin.
  3. Un mois plus tard, elle supprime le type LIVRABLE car il génère trop de faux positifs et affine les mots-clés de BRIEF.

---

### Persona: Marc

- **Role**: Utilisateur occasionnel, entrepreneur solo (e-commerce)
- **Goals**: Ne pas rater de commandes fournisseurs, de relances client, de paiements. Il utilise Inbox Actions de façon passive — il ne veut pas configurer grand-chose.
- **Pain points**:
  - Les 5 types natifs lui suffisent à 90%. Son seul angle mort est le type "COMMANDE" (passer une commande fournisseur) qui n'est pas capturé.
  - Il ne veut pas aller dans Settings pour configurer — il veut créer un type depuis l'email qu'il est en train de lire.
- **Key scenarios**:
  1. Il reçoit un email d'un fournisseur : "N'oubliez pas de passer votre commande avant le 30 pour les délais de Noël." Il ouvre missing-action, crée une action ponctuelle de type custom "COMMANDE" sans créer de règle — action one-shot, pas de pattern persisté.
  2. Quelques semaines plus tard, face à un email similaire, il décide cette fois de créer une règle avec le mot-clé "passer votre commande".
