# Documentation Inbox Actions

## Présentation du projet

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
| **Microsoft Graph API** | Accès natif aux emails Outlook/Microsoft 365 (sans configuration) |
| **IMAP universel** | Gmail, Yahoo, iCloud, Fastmail, ProtonMail... |
| **Extraction d'actions** | 5 types : SEND, CALL, FOLLOW_UP, PAY, VALIDATE |
| **Détection de deadlines** | Dates absolues, relatives, heures spécifiques |
| **Temps réel** | Mises à jour via SSE (Server-Sent Events) |
| **Sync automatique** | Cron jobs quotidiens + sync manuelle |

---

## Architecture technique

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
│  │                      Email Providers                             │    │
│  │  ┌───────────────────────────┐  ┌─────────────────────────────┐ │    │
│  │  │ Microsoft Graph API       │  │ IMAP Service (App Password) │ │    │
│  │  │ Outlook.com, Hotmail,     │  │ Gmail, Yahoo, iCloud,       │ │    │
│  │  │ Live.com, Microsoft 365   │  │ Fastmail, ProtonMail...     │ │    │
│  │  └───────────────────────────┘  └─────────────────────────────┘ │    │
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
| **Email (Microsoft)** | Microsoft Graph API (OAuth2) |
| **Email (Autres)** | IMAP (imapflow) avec App Password |
| **Auth** | Google OAuth, Microsoft OAuth, Credentials (bcrypt) |
| **Notifications** | Resend (email digests) |
| **Cron** | node-cron (in-process) |
| **State** | Zustand (client), Server Components (server) |

---

## Index de la documentation

### Authentification et Email

| Document | Description |
|----------|-------------|
| **[AUTH_SETUP.md](./AUTH_SETUP.md)** | **Guide complet d'authentification** |
| | - Email/Mot de passe (credentials) |
| | - Google OAuth (authentification uniquement) |
| | - Microsoft OAuth + Graph API (authentification + emails) |
| | - Variables d'environnement |
| | - Dépannage des erreurs courantes |

### Intégration Email

| Document | Description |
|----------|-------------|
| **[MICROSOFT_GRAPH.md](./MICROSOFT_GRAPH.md)** | **Microsoft Graph API (recommandé pour Outlook)** |
| | - Accès natif aux emails Microsoft |
| | - Aucune configuration utilisateur requise |
| | - Delta query pour sync incrémental |
| **[IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md)** | **Intégration IMAP** |
| | - Configuration avec App Password |
| | - Chiffrement AES-256 des credentials |
| | - Gmail, Yahoo, iCloud, Fastmail, ProtonMail |
| [SECURITY_GDPR.md](./SECURITY_GDPR.md) | Sécurité et conformité RGPD |

### Extraction d'actions

| Document | Description |
|----------|-------------|
| **[REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md)** | **Système d'extraction regex** |
| | - Patterns par type (SEND, CALL, FOLLOW_UP, PAY, VALIDATE) |
| | - Détection de deadlines (dates, heures) |
| | - Règles d'exclusion (newsletters, no-reply) |
| | - Conditions ignorées ("si tu peux", "éventuellement") |

### Base de données

| Document | Description |
|----------|-------------|
| **[DATABASE_MODEL.md](./DATABASE_MODEL.md)** | **Modèle Prisma complet** |
| | - User, Account, Session (Auth.js) |
| | - Action (avec imapUID et gmailMessageId) |
| | - EmailMetadata |
| | - IMAPCredential |
| [EMAIL_STATUS_MIGRATION.md](./EMAIL_STATUS_MIGRATION.md) | Migration EXTRACTED → ANALYZED |

### Automatisation

| Document | Description |
|----------|-------------|
| **[CRON.md](./CRON.md)** | **Tâches planifiées** |
| | - Daily sync (7h00) |
| | - Cleanup metadata (3h00) |
| | - Count new emails (optionnel) |
| [cron-setup.md](./cron-setup.md) | Configuration détaillée node-cron |
| [REALTIME_UPDATES.md](./REALTIME_UPDATES.md) | SSE + Zustand pour temps réel |

### API

| Document | Description |
|----------|-------------|
| [API_ACTIONS.md](./API_ACTIONS.md) | Endpoints CRUD actions |
| [API_USAGE_EXAMPLES.md](./API_USAGE_EXAMPLES.md) | Exemples de requêtes |

### Interface utilisateur

| Document | Description |
|----------|-------------|
| [UX_DESIGN.md](./UX_DESIGN.md) | Design et composants UI |

### Tests

| Document | Description |
|----------|-------------|
| [TESTS.md](./TESTS.md) | Stratégie et configuration tests |

---

## Guide de démarrage

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

# Pour IMAP (chiffrement des mots de passe)
IMAP_MASTER_KEY=<générer avec: openssl rand -hex 32>

# Microsoft OAuth (recommandé - auth + email)
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=consumers   # ou votre tenant GUID
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true

# Google OAuth (optionnel - auth uniquement)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Parcours recommandé

| Objectif | Documents à lire |
|----------|------------------|
| **Comprendre l'architecture** | [DATABASE_MODEL.md](./DATABASE_MODEL.md) → [REGEX_EXTRACTION.md](./REGEX_EXTRACTION.md) |
| **Configurer l'auth** | [AUTH_SETUP.md](./AUTH_SETUP.md) |
| **Configurer Microsoft Graph** | [MICROSOFT_GRAPH.md](./MICROSOFT_GRAPH.md) |
| **Configurer IMAP** | [IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md) |
| **Configurer les crons** | [CRON.md](./CRON.md) → [cron-setup.md](./cron-setup.md) |

---

## Points techniques clés

### 1. Authentification à l'application

L'authentification à l'application est séparée de l'accès aux emails :

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inscription / Connexion                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Email/MDP    │  │ Google OAuth │  │ Microsoft OAuth      │   │
│  │              │  │ (auth only)  │  │ (auth + email)       │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         └────────────────┬┴──────────────────────┘               │
│                          │                                       │
│                          ▼                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │                   Accès aux emails                       │  │
│    │  ┌───────────────────────┐  ┌─────────────────────────┐ │  │
│    │  │ Microsoft Graph API   │  │ IMAP (App Password)     │ │  │
│    │  │ (automatique si MS)   │  │ (configuration requise) │ │  │
│    │  └───────────────────────┘  └─────────────────────────┘ │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Détails** : [AUTH_SETUP.md](./AUTH_SETUP.md)

### 2. Accès aux emails

Le système utilise deux méthodes selon le provider :

#### Microsoft (Outlook, Hotmail, Live, Microsoft 365)

```typescript
// Automatique via Microsoft Graph API
const graphService = await createMicrosoftGraphService(userId);
await graphService.fetchNewEmails();
await graphService.getEmailBodyForAnalysis(messageId);
```

**Avantages** : Aucune configuration utilisateur, delta query efficace.

**Détails** : [MICROSOFT_GRAPH.md](./MICROSOFT_GRAPH.md)

#### Autres providers (Gmail, Yahoo, iCloud, Fastmail...)

```typescript
// IMAP avec App Password
const imapService = await createIMAPService(userId);
await imapService.fetchNewEmails();
await imapService.getEmailBodyForAnalysis(uid);
```

**Détails** : [IMAP_INTEGRATION.md](./IMAP_INTEGRATION.md)

### 3. Extraction d'actions (Regex)

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

### 4. Sécurité et chiffrement

| Donnée | Protection |
|--------|------------|
| Mots de passe utilisateur | bcrypt (12 rounds) |
| Mots de passe IMAP | AES-256-CBC + IMAP_MASTER_KEY |
| Tokens OAuth | Stockés en DB (table Account) |
| Sessions | JWT (AUTH_SECRET) |

**Détails** : [SECURITY_GDPR.md](./SECURITY_GDPR.md)

### 5. Temps réel (SSE + Zustand)

```
Server (Cron) ──SSE──► Client (Zustand Store) ──► UI Components
    │                        │
    └── EventSource ────────┘
        /api/email/pending-stream
```

**Détails** : [REALTIME_UPDATES.md](./REALTIME_UPDATES.md)

---

## Variables d'environnement

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

# Google OAuth (optionnel - authentification uniquement)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft OAuth (recommandé - authentification + emails)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=                      # "consumers" ou GUID
NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true

# ═══════════════════════════════════════════════════════════════
# BASE DE DONNÉES
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://user:pass@host:5432/db

# ═══════════════════════════════════════════════════════════════
# IMAP (pour les providers non-Microsoft)
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

## Ressources externes

### Documentation officielle

- [Next.js 14](https://nextjs.org/docs)
- [Auth.js (NextAuth v5)](https://authjs.dev/)
- [Prisma ORM](https://www.prisma.io/docs)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/overview)

### Outils et bibliothèques

- [imapflow](https://imapflow.com/) - Client IMAP
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [shadcn/ui](https://ui.shadcn.com/) - Composants UI
- [Resend](https://resend.com/docs) - Email transactionnel

### Portails de configuration

- [Azure Portal](https://portal.azure.com) - Microsoft OAuth
- [Google Cloud Console](https://console.cloud.google.com) - Google OAuth

---

## Support

Pour toute question :
- Créer une [issue GitHub](https://github.com/bullder30/inbox-actions/issues)

---

## Licence

Ce projet est sous licence **AGPL-3.0**. Voir [LICENSE](../LICENSE.md).

---

**Dernière mise à jour** : 6 février 2026
**Version** : 0.2.0 MVP
