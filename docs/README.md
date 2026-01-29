# Documentation Inbox Actions

Bienvenue dans la documentation complète d'Inbox Actions.

---

## 📚 Index de la documentation

### 🏗️ Architecture et Modèles

- **[DATABASE_MODEL.md](./DATABASE_MODEL.md)** - Modèle de données Prisma complet
  - Schéma des actions
  - Relations utilisateurs
  - Index de performance
  - Nouveau : champ `gmailMessageId` pour les liens vers Gmail

### 🔍 Extraction et Analyse

- **[REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md)** - Système d'extraction d'actions par regex
  - Patterns détaillés par type d'action (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)
  - **Nouveau** : Heures spécifiques pour les deadlines (12h, 18h, 20h)
  - **Nouveau** : Nettoyage des phrases (tirets, guillemets, listes à puces)
  - Règles d'exclusion et conditionnels
  - Liens vers Gmail depuis les actions

### 📬 Intégration Email (Gmail + IMAP)

- **[IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md)** ⭐ **NOUVEAU** - Intégration IMAP
  - Alternative à Gmail OAuth
  - Compatible tous providers (Gmail, Outlook, Yahoo, iCloud...)
  - Chiffrement AES-256 des credentials
  - Factory pattern dual-provider

- **[GMAIL_INTEGRATION.md](./GMAIL_INTEGRATION.md)** - Intégration Gmail API (OAuth)
  - Architecture du service Gmail
  - Extraction des métadonnées
  - Gestion des tokens OAuth

- **[GMAIL_OAUTH_SETUP.md](./GMAIL_OAUTH_SETUP.md)** - Configuration OAuth 2.0
  - Setup Google Cloud Console
  - Configuration des scopes
  - Gestion des credentials

- **[GMAIL_SECURITY_GDPR.md](./GMAIL_SECURITY_GDPR.md)** - Sécurité et conformité RGPD
  - Stockage minimal des données
  - Compliance RGPD
  - Bonnes pratiques de sécurité

- **[GMAIL_USAGE_EXAMPLE.md](./GMAIL_USAGE_EXAMPLE.md)** - Exemples d'utilisation
  - Cas d'usage réels
  - Code samples

- **[GMAIL_TROUBLESHOOTING.md](./GMAIL_TROUBLESHOOTING.md)** - Résolution de problèmes
  - Erreurs courantes
  - Solutions et diagnostics

### ⚙️ Automatisation

- **[CRON.md](./CRON.md)** - Système de tâches planifiées (node-cron)
  - Count new emails (toutes les 2 min)
  - Daily sync (8h00)
  - Cleanup (23h00)
  - **Nouveau** : Référence au système SSE

- **[REALTIME_UPDATES.md](./REALTIME_UPDATES.md)** ⭐ **NOUVEAU**
  - Architecture SSE + Zustand
  - Mises à jour en temps réel sans polling
  - Flux complet client/serveur
  - Comparaison avec le polling

- **[cron-setup.md](./cron-setup.md)** - Configuration détaillée des crons
  - Setup node-cron
  - Instrumentation Next.js

- **[EMAIL_STATUS_MIGRATION.md](./EMAIL_STATUS_MIGRATION.md)** - Migration du statut des emails
  - EXTRACTED → ANALYZED
  - Scripts de migration

### 🛠️ API et Développement

- **[API_ACTIONS.md](./API_ACTIONS.md)** - API des actions
  - Endpoints CRUD
  - Types et schémas

- **[API_USAGE_EXAMPLES.md](./API_USAGE_EXAMPLES.md)** - Exemples d'utilisation API
  - Requêtes courantes
  - Code samples

### 🎨 Interface Utilisateur

- **[UX_DESIGN.md](./UX_DESIGN.md)** - Design et expérience utilisateur
  - Composants UI
  - **Nouveau** : Bouton "Voir email" pour accès direct à Gmail
  - **Nouveau** : Affichage "Date du mail" et "Traité le"
  - **Nouveau** : Indicateurs visuels d'urgence (rouge/orange)
  - Flux utilisateur

### 🔐 Authentification

- **[AUTH_SETUP.md](./AUTH_SETUP.md)** - Configuration de l'authentification
  - NextAuth.js setup
  - OAuth Google
  - Gestion des sessions

### 🧪 Tests

- **[TESTS.md](./TESTS.md)** - Tests et qualité
  - Tests unitaires
  - Tests d'intégration
  - Stratégie de test

---

## 🚀 Démarrage rapide

### Pour les développeurs

1. **Architecture** : Commencez par [DATABASE_MODEL.md](./DATABASE_MODEL.md)
2. **Gmail** : Lisez [GMAIL_INTEGRATION.md](./GMAIL_INTEGRATION.md)
3. **Extraction** : Explorez [REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md)
4. **Temps réel** : Découvrez [REALTIME_UPDATES.md](./REALTIME_UPDATES.md)

### Pour la configuration

1. **OAuth** : [GMAIL_OAUTH_SETUP.md](./GMAIL_OAUTH_SETUP.md)
2. **Authentification** : [AUTH_SETUP.md](./AUTH_SETUP.md)
3. **Crons** : [CRON.md](./CRON.md)

### Pour les utilisateurs

1. **Usage** : [GMAIL_USAGE_EXAMPLE.md](./GMAIL_USAGE_EXAMPLE.md)
2. **UX** : [UX_DESIGN.md](./UX_DESIGN.md)
3. **Troubleshooting** : [GMAIL_TROUBLESHOOTING.md](./GMAIL_TROUBLESHOOTING.md)

---

## ✨ Nouvelles fonctionnalités (Janvier 2026)

### Extraction améliorée

- ✅ **Heures spécifiques** pour toutes les deadlines (12h, 18h, 20h)
- ✅ **Nettoyage automatique** des phrases (tirets, guillemets, listes)
- ✅ **Découpage amélioré** par lignes ET ponctuation
- ✅ **Nouveaux patterns** : "avant midi", "ce matin", "cet après-midi", "ce soir"

### Mises à jour en temps réel

- ✅ **SSE (Server-Sent Events)** pour push serveur → client
- ✅ **Zustand** pour gestion d'état global réactive
- ✅ **Plus de polling** côté client
- ✅ **Compteur toujours à jour** (max 30s de latence)

### Lien vers Gmail

- ✅ **Nouveau champ** `gmailMessageId` dans les actions
- ✅ **Bouton "Voir email"** dans l'UI
- ✅ **Accès direct** au mail source dans Gmail
- ✅ **Compatible** avec anciennes actions (optionnel)

### UI améliorée

- ✅ **"Date du mail"** dans les détails d'action
- ✅ **"Traité le"** visible uniquement pour actions terminées
- ✅ **Bouton Gmail** intégré dans la phrase source
- ✅ **Indicateurs visuels d'urgence** : rouge (en retard), orange (< 24h)
- ✅ **Badges colorés** par type d'action (bleu, vert, jaune, violet, orange)
- ✅ **Cohérence** entre liste et détail des actions

---

## 📝 Conventions

### Fichiers de documentation

- Tous les fichiers sont en **Markdown** (`.md`)
- Utilisation de **titres hiérarchiques** (`#`, `##`, `###`)
- **Code blocks** avec langage spécifié (` ```typescript`)
- **Exemples** clairs et commentés
- **Emojis** pour navigation visuelle

### Structure type

```markdown
# Titre Principal

Description courte

---

## Section 1

Contenu...

### Sous-section

Détails...

---

## Ressources

- Liens
- Références
```

---

## 🔗 Liens externes utiles

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Gmail API Reference](https://developers.google.com/gmail/api)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [node-cron](https://www.npmjs.com/package/node-cron)

---

## 📧 Support

Pour toute question ou suggestion concernant la documentation, n'hésitez pas à créer une issue ou à contribuer directement.

---

Dernière mise à jour : 14 janvier 2026
