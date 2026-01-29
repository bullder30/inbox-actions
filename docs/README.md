# Documentation Inbox Actions

## 📋 Présentation du projet

**Inbox Actions** est une application Next.js 14 qui extrait automatiquement les tâches actionnables de vos emails. L'application analyse le contenu de vos emails et identifie les demandes explicites nécessitant une action de votre part.

### Philosophie

> **"Mieux vaut manquer une action que vous stresser avec un faux positif"**

- **Déterministe** : Règles d'extraction simples et explicables (regex)
- **Transparent** : Chaque action affiche la phrase source exacte
- **Non-intrusif** : Lecture seule, aucune modification de vos emails
- **RGPD compliant** : Seules les métadonnées minimales sont stockées

### Fonctionnalités principales

| Fonctionnalité | Description |
|----------------|-------------|
| **Multi-provider** | Gmail OAuth, Microsoft OAuth, IMAP (tous providers) |
| **Extraction d'actions** | 5 types : SEND, CALL, FOLLOW_UP, PAY, VALIDATE |
| **Détection de deadlines** | Dates absolues, relatives, heures spécifiques |
| **Temps réel** | Mises à jour via SSE (Server-Sent Events) |
| **Sync automatique** | Cron jobs quotidiens + sync manuelle |

---

## 🏗️ Architecture technique

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  Next.js 14 (App Router) + React 18 + Tailwind CSS + shadcn/ui         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Dashboard  │  │  Actions   │  │  Settings  │  │ Auth (Login/Reg)   │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘ │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                              BACKEND                                     │
│  Next.js API Routes + Auth.js v5 + Prisma ORM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Email Provider Factory                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │    │
│  │  │ Gmail API   │  │ IMAP Basic  │  │ IMAP OAuth2 (XOAUTH2)   │  │    │
│  │  │ (OAuth)     │  │ (Password)  │  │ (Microsoft 365)         │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Action Extractor│  │ Cron Service    │  │ Notification Service    │  │
│  │ (Regex-based)   │  │ (node-cron)     │  │ (Resend)                │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                              DATABASE                                    │
│  PostgreSQL + Prisma (User, Account, Action, EmailMetadata, IMAP...)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Stack technique

| Couche | Technologies |
|--------|--------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js API Routes, Auth.js v5, Prisma |
| **Database** | PostgreSQL (Neon DB) |
| **Email** | Gmail API, IMAP (imapflow), OAuth2 XOAUTH2 |
| **Auth** | Google OAuth, Microsoft OAuth, Credentials (bcrypt) |
| **Notifications** | Resend (email digests) |
| **Cron** | node-cron (in-process) |
| **State** | Zustand (client), Server Components (server) |

---

## 📚 Index de la documentation

### 🔐 Authentification

| Document | Description |
|----------|-------------|
| **[AUTH_SETUP.md](./AUTH_SETUP.md)** | **Guide complet d'authentification** |
| | • Email/Mot de passe (credentials) |
| | • Google OAuth (Gmail API automatique) |
| | • Microsoft OAuth (IMAP OAuth2 automatique) |
| | • Variables d'environnement |
| | • Dépannage des erreurs courantes |

### 📬 Intégration Email

| Document | Description |
|----------|-------------|
| **[IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md)** | **Intégration IMAP complète** |
| | • Factory pattern dual-provider |
| | • IMAP OAuth2 (XOAUTH2) pour Microsoft 365 |
| | • Gestion automatique des tokens |
| | • Chiffrement AES-256 des credentials |
| | • Presets pour tous providers |
| [GMAIL_INTEGRATION.md](./GMAIL_INTEGRATION.md) | Architecture Gmail API |
| [GMAIL_OAUTH_SETUP.md](./GMAIL_OAUTH_SETUP.md) | Configuration Google Cloud Console |
| [GMAIL_SECURITY_GDPR.md](./GMAIL_SECURITY_GDPR.md) | Sécurité et conformité RGPD |
| [GMAIL_TROUBLESHOOTING.md](./GMAIL_TROUBLESHOOTING.md) | Résolution de problèmes Gmail |

### 🔍 Extraction d'actions

| Document | Description |
|----------|-------------|
| **[REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md)** | **Système d'extraction regex** |
| | • Patterns par type (SEND, CALL, FOLLOW_UP, PAY, VALIDATE) |
| | • Détection de deadlines (dates, heures) |
| | • Règles d'exclusion (newsletters, no-reply) |
| | • Conditions ignorées ("si tu peux", "éventuellement") |

### 🏗️ Base de données

| Document | Description |
|----------|-------------|
| **[DATABASE_MODEL.md](./DATABASE_MODEL.md)** | **Modèle Prisma complet** |
| | • User, Account, Session (Auth.js) |
| | • Action (avec gmailMessageId, imapUID) |
| | • EmailMetadata (dual-provider) |
| | • IMAPCredential (avec OAuth2) |
| [EMAIL_STATUS_MIGRATION.md](./EMAIL_STATUS_MIGRATION.md) | Migration EXTRACTED → ANALYZED |

### ⚙️ Automatisation

| Document | Description |
|----------|-------------|
| **[CRON.md](./CRON.md)** | **Tâches planifiées** |
| | • Daily sync (8h00) |
| | • Cleanup metadata (23h00) |
| | • Count new emails (optionnel) |
| [cron-setup.md](./cron-setup.md) | Configuration détaillée node-cron |
| [REALTIME_UPDATES.md](./REALTIME_UPDATES.md) | SSE + Zustand pour temps réel |

### 🛠️ API

| Document | Description |
|----------|-------------|
| [API_ACTIONS.md](./API_ACTIONS.md) | Endpoints CRUD actions |
| [API_USAGE_EXAMPLES.md](./API_USAGE_EXAMPLES.md) | Exemples de requêtes |

### 🎨 Interface utilisateur

| Document | Description |
|----------|-------------|
| [UX_DESIGN.md](./UX_DESIGN.md) | Design et composants UI |
| [GMAIL_USAGE_EXAMPLE.md](./GMAIL_USAGE_EXAMPLE.md) | Exemples d'utilisation |

### 🧪 Tests

| Document | Description |
|----------|-------------|
| [TESTS.md](./TESTS.md) | Stratégie et configuration tests |

---

## 🚀 Guide de démarrage

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- pnpm (recommandé)

### Installation

```bash
# Cloner le repo
git clone https://github.com/bullder30/inbox-actions.git
cd inbox-actions

# Installer les dépendances
pnpm install

# Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos valeurs

# Générer le client Prisma
npx prisma generate

# Appliquer le schéma
npx prisma db push

# Lancer le serveur
pnpm dev
```

### Configuration minimale

```env
# Obligatoire
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=<générer avec: openssl rand -base64 32>
DATABASE_URL=postgresql://user:pass@localhost:5432/inbox_actions

# Au moins un provider email
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true

# Pour IMAP (chiffrement)
IMAP_MASTER_KEY=<générer avec: openssl rand -hex 32>
```

### Parcours recommandé

| Objectif | Documents à lire |
|----------|------------------|
| **Comprendre l'architecture** | [DATABASE_MODEL.md](./DATABASE_MODEL.md) → [REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md) |
| **Configurer l'auth** | [AUTH_SETUP.md](./AUTH_SETUP.md) |
| **Ajouter Gmail** | [GMAIL_OAUTH_SETUP.md](./GMAIL_OAUTH_SETUP.md) |
| **Ajouter Microsoft** | [AUTH_SETUP.md](./AUTH_SETUP.md#microsoft-oauth) → [IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md#imap-oauth2-xoauth2) |
| **Configurer les crons** | [CRON.md](./CRON.md) → [cron-setup.md](./cron-setup.md) |

---

## 🔧 Points techniques clés

### 1. Authentification multi-provider

```
┌─────────────────────────────────────────────────────────────┐
│                 Méthodes d'authentification                  │
├───────────────┬───────────────┬─────────────────────────────┤
│ Credentials   │ Google OAuth  │ Microsoft OAuth             │
│ (email/mdp)   │               │                             │
├───────────────┼───────────────┼─────────────────────────────┤
│ Compte local  │ Gmail API     │ IMAP OAuth2 (XOAUTH2)       │
│ + IMAP manuel │ automatique   │ automatique                 │
└───────────────┴───────────────┴─────────────────────────────┘
```

**Détails** : [AUTH_SETUP.md](./AUTH_SETUP.md)

### 2. Factory Pattern Email

Le système utilise un factory pour abstraire le provider email :

```typescript
const provider = await createEmailProvider(userId);
// Retourne GmailProvider ou IMAPProvider selon User.emailProvider

await provider.fetchNewEmails();
await provider.getEmailBodyForAnalysis(messageId);
```

**Détails** : [IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md)

### 3. IMAP OAuth2 (XOAUTH2)

Pour Microsoft 365 (basic auth désactivé), le système utilise OAuth2 XOAUTH2 :

```
1. Connexion Microsoft OAuth → access_token + refresh_token
2. POST /api/imap/setup-oauth → Création IMAPCredential
3. Sync IMAP → getOAuthAccessToken() → XOAUTH2 auth
4. Token expiré → Refresh automatique
```

**Détails** : [IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md#imap-oauth2-xoauth2)

### 4. Extraction d'actions (Regex)

L'extraction utilise des patterns regex déterministes :

| Type | Exemple de pattern |
|------|-------------------|
| SEND | `peux-tu envoyer`, `merci d'envoyer` |
| CALL | `rappelle-moi`, `appelle` |
| FOLLOW_UP | `relance`, `n'oublie pas` |
| PAY | `payer la facture`, `virement` |
| VALIDATE | `valider`, `approuver` |

**Règles d'exclusion** :
- Newsletters, no-reply, notifications
- Phrases conditionnelles ("si tu peux", "quand tu as le temps")

**Détails** : [REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md)

### 5. Sécurité et chiffrement

| Donnée | Protection |
|--------|------------|
| Mots de passe utilisateur | bcrypt (12 rounds) |
| Mots de passe IMAP | AES-256-CBC + IMAP_MASTER_KEY |
| Tokens OAuth | Stockés en DB (table Account) |
| Sessions | JWT (AUTH_SECRET) |

**Détails** : [GMAIL_SECURITY_GDPR.md](./GMAIL_SECURITY_GDPR.md)

### 6. Temps réel (SSE + Zustand)

```
Server (Cron) ──SSE──► Client (Zustand Store) ──► UI Components
    │                        │
    └── EventSource ────────┘
        /api/email/pending-stream
```

**Détails** : [REALTIME_UPDATES.md](./REALTIME_UPDATES.md)

---

## 📝 Variables d'environnement

### Référence complète

```env
# ═══════════════════════════════════════════════════════════════
# APPLICATION
# ═══════════════════════════════════════════════════════════════
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════════
# AUTHENTIFICATION
# ═══════════════════════════════════════════════════════════════
AUTH_SECRET=                              # openssl rand -base64 32

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false

# Microsoft OAuth (optionnel)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=                      # GUID, pas "common"
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=false

# ═══════════════════════════════════════════════════════════════
# BASE DE DONNÉES
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://user:pass@host:5432/db

# ═══════════════════════════════════════════════════════════════
# IMAP
# ═══════════════════════════════════════════════════════════════
IMAP_MASTER_KEY=                          # openssl rand -hex 32

# ═══════════════════════════════════════════════════════════════
# NOTIFICATIONS (Resend)
# ═══════════════════════════════════════════════════════════════
RESEND_API_KEY=
EMAIL_FROM="Inbox Actions <noreply@domain.com>"

# ═══════════════════════════════════════════════════════════════
# CRON
# ═══════════════════════════════════════════════════════════════
CRON_SECRET=                              # Pour endpoints externes
CRON_PROVIDER=node                        # "node" ou "vercel"
FEATURE_EMAIL_COUNT=false                 # Compteur temps réel

# ═══════════════════════════════════════════════════════════════
# STRIPE (optionnel)
# ═══════════════════════════════════════════════════════════════
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID=
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID=
NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID=
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID=
```

---

## 🔗 Ressources externes

### Documentation officielle

- [Next.js 14](https://nextjs.org/docs)
- [Auth.js (NextAuth v5)](https://authjs.dev/)
- [Prisma ORM](https://www.prisma.io/docs)
- [Gmail API](https://developers.google.com/gmail/api)
- [Microsoft Graph](https://learn.microsoft.com/en-us/graph/)

### Outils et bibliothèques

- [imapflow](https://imapflow.com/) - Client IMAP
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [shadcn/ui](https://ui.shadcn.com/) - Composants UI
- [Resend](https://resend.com/docs) - Email transactionnel

### Portails de configuration

- [Google Cloud Console](https://console.cloud.google.com)
- [Azure Portal](https://portal.azure.com)

---

## 📧 Support

Pour toute question :
- Créer une [issue GitHub](https://github.com/bullder30/inbox-actions/issues)
- Consulter le [troubleshooting](./GMAIL_TROUBLESHOOTING.md)

---

## 📜 Licence

Ce projet est sous licence **AGPL-3.0**. Voir [LICENSE](../LICENSE.md).

---

**Dernière mise à jour** : 29 janvier 2026
**Version** : 0.2.0 MVP
