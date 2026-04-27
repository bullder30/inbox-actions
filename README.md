# Inbox Actions

Transform your emails into clear, actionable tasks. No magic, no guessing — just simple, transparent rules.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)
![Version](https://img.shields.io/badge/version-0.6.0-orange)
![Language](https://img.shields.io/badge/emails-French%20only-blue)

> **MVP Notice:** This version only analyzes emails written in **French**. Multi-language support is planned for future releases.

## Overview

**Inbox Actions** is a Next.js application that extracts actionable tasks from your emails using deterministic regex patterns. It's designed with transparency in mind — you always know what was analyzed, what was ignored, and why.

### Supported Email Providers

| Provider | Method | Features |
|----------|--------|----------|
| **Microsoft** (Outlook, Hotmail, Live, Microsoft 365) | Microsoft Graph API | OAuth, no config needed |
| **Gmail** | IMAP + App Password | Requires App Password |
| **Yahoo** | IMAP + App Password | Requires App Password |
| **iCloud** | IMAP + App Password | Requires App Password |
| **Fastmail** | IMAP + App Password | Requires App Password |
| **ProtonMail** | IMAP via Bridge | Requires ProtonMail Bridge |

### Philosophy

> **Better to miss an action than stress you with a false positive.**

If the system is uncertain, it creates nothing. You can always add actions manually with one click.

## Features

- **Multi-Provider Support** — Microsoft Graph API or IMAP for any email provider
- **Deterministic Detection** — Simple, explainable rules (no black-box AI)
- **5 Native Action Types** — SEND, CALL, FOLLOW_UP, PAY, VALIDATE
- **Custom Action Types** *(v0.5)* — User-defined types with keywords, color picker, snapshot history
- **Regex Power** *(v0.6)* — Advanced mode with user-defined regex patterns + visual validation, anti-ReDoS sandbox (safe-regex + vm timeout 200ms), 12+ business templates (accounting / legal / IT / HR)
- **Live Preview** — Test patterns against real email bodies with inline match highlighting
- **Due Date Extraction** — Automatic detection of deadlines from email content
- **Urgency Indicators** — Visual alerts for overdue (red) and urgent (orange) actions
- **Source Transparency** — Every action shows the exact sentence that triggered it
- **Exclusion Rules** — Block emails by sender, domain, or subject keyword
- **Manual Override** — "Missing an action?" button available everywhere
- **Email Digest** — Daily notification summary via Resend
- **GDPR Compliant** — Email body is never stored, only minimal metadata; preview body cached in-memory 5 min then discarded
- **Secure Credentials** — IMAP passwords + Microsoft Graph OAuth tokens encrypted with AES-256-CBC

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Auth | Auth.js v5 (NextAuth) |
| Email API | Microsoft Graph API (Outlook) |
| Email Protocol | IMAP (Gmail, Yahoo, iCloud...) |
| Transactional Email | Resend |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- PostgreSQL database (Neon recommended)
- Microsoft Entra ID (Azure AD) app for Microsoft Graph (optional)
- Google Cloud Console project for Google OAuth (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/bullder30/inbox-actions.git
cd inbox-actions

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Authentication
AUTH_SECRET=                    # Generate with: openssl rand -base64 32

# Google OAuth (Google Cloud Console) - For Google login
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Microsoft OAuth (Azure Portal) - For Microsoft login & Graph API
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common      # Use "common" for multi-tenant

# IMAP Encryption (required if IMAP providers connected)
IMAP_MASTER_KEY=                # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Microsoft Graph token encryption (required for Microsoft Graph + regex-power v0.6.0)
GRAPH_MASTER_KEY=               # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Database
DATABASE_URL=                   # PostgreSQL connection string

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM="Inbox Actions <noreply@yourdomain.com>"

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
CRON_SECRET=                    # Secure cron endpoints (required in prod)
SUPPORT_EMAIL=                  # Contact form recipient
FEATURE_EMAIL_COUNT=false       # Enable email count job & KPI (default: false)
```

### OAuth Setup

#### Microsoft Entra ID (for Outlook/Microsoft 365)

1. Go to [Azure Portal](https://portal.azure.com/) → Microsoft Entra ID
2. App registrations → New registration
3. Set redirect URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
4. API permissions → Add `Mail.Read` (Microsoft Graph, Delegated)
5. Certificates & secrets → Create a client secret
6. Copy Application (client) ID and secret to `.env.local`

#### Google Cloud (for Google login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

## How It Works

### 1. Email Provider Setup

**Microsoft Graph API** (Outlook, Hotmail, Live, Microsoft 365):
- Sign in with Microsoft OAuth
- Automatic `Mail.Read` permission request
- No manual configuration needed

**IMAP** (Gmail, Yahoo, iCloud, Fastmail, ProtonMail...):
- Configure in Settings → Email Configuration
- Requires an App Password (not your main password)
- Passwords encrypted with AES-256-CBC

> **Note:** Only one email provider can be active at a time. Connecting a new provider automatically disconnects the previous one.

### 2. Email Synchronization

- Daily automatic sync at 8:00 AM (configurable)
- Manual sync available anytime
- Only fetches INBOX emails
- Stores minimal metadata (sender, subject, snippet)

### 3. Action Detection

The system uses regex patterns to detect explicit requests:

| Type | Example Patterns |
|------|------------------|
| SEND | "can you send...", "please forward...", "email me..." |
| CALL | "call me back", "give me a call", "let's talk on the phone" |
| FOLLOW_UP | "follow up on...", "reminder to...", "don't forget to..." |
| PAY | "pay the invoice", "transfer...", "payment due" |
| VALIDATE | "approve...", "confirm...", "validate..." |
| CUSTOM | User-defined types — keywords (e.g. "leave request") or regex (e.g. `FAC-\d{4}-\d+`) |

**Custom types** are configured in **Settings → Custom Action Types** (max 10 / user). Two modes:
- **Keywords** — comma-separated list (default, beginner-friendly)
- **Regex** — full pattern with anti-ReDoS sandbox + visual test zone + business templates

See [docs/features/custom-actions.md](docs/features/custom-actions.md) and [docs/features/regex-power.md](docs/features/regex-power.md).

### 4. Automatic Exclusions

Emails are automatically ignored if:
- Sender is `no-reply@`, `newsletter@`, `notifications@`
- Subject contains "newsletter", "unsubscribe"
- Body contains unsubscribe footers
- Request is conditional ("if you can", "when you have time")

### 5. Due Date Detection

Extracts deadlines from phrases like:
- "before Friday", "by March 15"
- "tomorrow", "next week"
- "end of day", "this morning"

## Project Structure

```
inbox-actions/
├── app/
│   ├── (auth)/              # Login/register pages
│   ├── (protected)/         # Dashboard, actions, settings
│   ├── api/                 # API routes
│   │   ├── actions/         # CRUD operations
│   │   ├── email/           # Email sync & analysis
│   │   ├── imap/            # IMAP configuration
│   │   ├── microsoft-graph/ # Microsoft Graph status & sync
│   │   ├── contact/         # Contact form
│   │   └── cron/            # Scheduled jobs
│   └── contact/             # Contact page
├── components/
│   ├── actions/             # Action cards, lists, dialogs
│   ├── dashboard/           # Stats, sync button
│   ├── imap/                # IMAP configuration form
│   ├── microsoft-graph/     # Microsoft Graph status
│   ├── layout/              # Sidebar, footer, nav
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── actions/             # Regex extraction logic
│   ├── email-provider/      # Provider factory & interface
│   ├── imap/                # IMAP service & credentials
│   ├── microsoft-graph/     # Microsoft Graph service
│   ├── notifications/       # Email digest service
│   └── cron/                # Cron job handlers
├── emails/                  # React Email templates
├── prisma/                  # Database schema
└── docs/                    # Documentation
```

## Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm lint         # Run ESLint
pnpm email        # Start React Email dev server
```

## Database Schema

### Key Models

- **User** — Authentication, preferences, sync status
- **Action** — Extracted tasks with type, status, due date (snapshots `customTypeLabel` / `customTypeColor` for CUSTOM)
- **CustomActionType** *(v0.5+)* — User-defined types (`mode: KEYWORDS | REGEX`, `regexPattern`, `validated`, color, keywords)
- **EmailMetadata** — Minimal email info (GDPR compliant)
- **Account** — OAuth tokens (managed by Auth.js, Microsoft tokens encrypted with `GRAPH_MASTER_KEY`)
- **IMAPCredential** — IMAP configuration (encrypted password)
- **MicrosoftGraphMailbox** — Microsoft Graph mailbox state (delta link, last sync)
- **UserExclusion** — Exclusion rules by sender, domain, or subject

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Daily Sync | 8:00 AM | Fetch and analyze new emails |
| Cleanup | 11:00 PM | Delete all email metadata (MVP: no retention) |

## API Endpoints

### Actions
- `GET /api/actions` — List actions (filters + pagination, returns `{ actions, total, hasMore }`)
- `POST /api/actions/manual` — Create manual action (supports CUSTOM type with snapshots)
- `POST /api/actions/[id]/done` — Mark as done
- `POST /api/actions/[id]/ignore` — Ignore action
- `POST /api/actions/[id]/schedule` — Schedule for later

### Custom Action Types *(v0.5+)*
- `GET /api/custom-action-types` — List user's custom types
- `POST /api/custom-action-types` — Create custom type (mode: KEYWORDS | REGEX)
- `PATCH /api/custom-action-types/[id]` — Update label / keywords / pattern / color / mode
- `DELETE /api/custom-action-types/[id]` — Delete custom type (Actions keep snapshots)
- `POST /api/custom-action-types/test-regex` *(v0.6)* — Test a regex pattern against sample text (returns match ranges)

### Email (Generic)
- `POST /api/email/sync` — Sync new emails (auto-detects provider)
- `POST /api/email/analyze` — Extract actions
- `GET /api/email/status` — Connection status
- `POST /api/email/disconnect` — Disconnect email provider
- `GET /api/email/[id]/body` *(v0.6)* — Fetch sanitized email body for live regex preview (DOMPurify, 50 KB max, in-memory cache 5 min)

### Microsoft Graph
- `GET /api/microsoft-graph/status` — Microsoft Graph status
- `POST /api/microsoft-graph/sync` — Sync via Graph API
- `POST /api/microsoft-graph/activate` — Activate as email provider

### IMAP
- `GET /api/imap/status` — IMAP configuration status
- `POST /api/imap/connect` — Configure IMAP connection

### Exclusions
- `GET /api/exclusions` — List exclusion rules
- `POST /api/exclusions` — Add exclusion rule (SENDER / DOMAIN / SUBJECT)
- `DELETE /api/exclusions/[id]` — Remove exclusion rule

## Security & Privacy

- **Read-only email access** — Cannot send, delete, or modify emails
- **No email body storage** — Content is analyzed in memory, then discarded
- **Minimal metadata** — Only sender, subject, and 200-char snippet stored
- **No retention (MVP)** — Email metadata deleted daily, actions preserved
- **User data isolation** — All queries scoped to authenticated user
- **Cascade delete** — Disconnecting email removes all related data
- **AES-256 encryption** — IMAP passwords encrypted at rest
- **OAuth tokens encrypted** — Microsoft and Google tokens stored securely

## Documentation

See the `docs/` folder for detailed documentation:

- [README.md](docs/README.md) — Documentation overview
- [MICROSOFT_GRAPH.md](docs/MICROSOFT_GRAPH.md) — Microsoft Graph API integration
- [IMAP_INTEGRATION.md](docs/IMAP_INTEGRATION.md) — IMAP configuration guide
- [AUTH_SETUP.md](docs/AUTH_SETUP.md) — Authentication setup

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Credits

This project is based on [next-saas-stripe-starter](https://github.com/mickasmt/next-saas-stripe-starter) by [@mickasmt](https://github.com/mickasmt). Thank you for the excellent foundation!

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) — see the [LICENSE](LICENSE.md) file for details.

## Support

- **Contact Form** — [/contact](/contact)
- **Issues** — [GitHub Issues](https://github.com/bullder30/inbox-actions/issues)

---

Built with transparency in mind. You always know what the system does and why.
