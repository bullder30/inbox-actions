# Inbox Actions

Transform your Gmail emails into clear, actionable tasks. No magic, no guessing — just simple, transparent rules.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)
![Version](https://img.shields.io/badge/version-0.1.0--MVP-orange)
![Language](https://img.shields.io/badge/emails-French%20only-blue)

> **MVP Notice:** This version only analyzes emails written in **French**. Multi-language support is planned for future releases.

## Overview

**Inbox Actions** is a Next.js application that extracts actionable tasks from your Gmail emails using deterministic regex patterns. It's designed with transparency in mind — you always know what was analyzed, what was ignored, and why.

### Philosophy

> **Better to miss an action than stress you with a false positive.**

If the system is uncertain, it creates nothing. You can always add actions manually with one click.

## Features

- **Google OAuth Integration** — One-click login with Gmail read-only access
- **Deterministic Detection** — Simple, explainable regex rules (no black-box AI)
- **5 Action Types** — SEND, CALL, FOLLOW_UP, PAY, VALIDATE
- **Due Date Extraction** — Automatic detection of deadlines from email content
- **Urgency Indicators** — Visual alerts for overdue (red) and urgent (orange) actions
- **Source Transparency** — Every action shows the exact sentence that triggered it
- **Manual Override** — "Missing an action?" button available everywhere
- **Email Digest** — Daily notification summary via Resend
- **GDPR Compliant** — Email body is never stored, only minimal metadata

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Auth | Auth.js v5 (NextAuth) |
| Email API | Gmail API (read-only) |
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
- Google Cloud Console project with Gmail API enabled

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

# Google OAuth (Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

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

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Gmail API**
4. Configure OAuth consent screen
5. Create OAuth 2.0 credentials (Web application)
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret to `.env.local`

## How It Works

### 1. Email Synchronization

- Daily automatic sync at 8:00 AM (configurable)
- Manual sync available anytime
- Only fetches INBOX emails
- Stores minimal metadata (sender, subject, snippet)

### 2. Action Detection

The system uses regex patterns to detect explicit requests:

| Type | Example Patterns |
|------|------------------|
| SEND | "can you send...", "please forward...", "email me..." |
| CALL | "call me back", "give me a call", "let's talk on the phone" |
| FOLLOW_UP | "follow up on...", "reminder to...", "don't forget to..." |
| PAY | "pay the invoice", "transfer...", "payment due" |
| VALIDATE | "approve...", "confirm...", "validate..." |

### 3. Automatic Exclusions

Emails are automatically ignored if:
- Sender is `no-reply@`, `newsletter@`, `notifications@`
- Subject contains "newsletter", "unsubscribe"
- Body contains unsubscribe footers
- Request is conditional ("if you can", "when you have time")

### 4. Due Date Detection

Extracts deadlines from phrases like:
- "before Friday", "by March 15"
- "tomorrow", "next week"
- "end of day", "this morning"

## Project Structure

```
inbox-actions/
├── app/
│   ├── (auth)/              # Login page
│   ├── (protected)/         # Dashboard, actions, settings
│   ├── api/                 # API routes
│   │   ├── actions/         # CRUD operations
│   │   ├── gmail/           # Gmail sync & analysis
│   │   ├── contact/         # Contact form
│   │   └── cron/            # Scheduled jobs
│   └── contact/             # Contact page
├── components/
│   ├── actions/             # Action cards, lists, dialogs
│   ├── dashboard/           # Stats, sync button
│   ├── layout/              # Sidebar, footer, nav
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── actions/             # Regex extraction logic
│   ├── gmail/               # Gmail API service
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
- **Action** — Extracted tasks with type, status, due date
- **EmailMetadata** — Minimal email info (GDPR compliant)
- **Account** — OAuth tokens (managed by Auth.js)

## Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Daily Sync | 8:00 AM | Fetch and analyze new emails |
| Cleanup | 11:00 PM | Delete all email metadata (MVP: no retention) |

## API Endpoints

### Actions
- `GET /api/actions` — List actions (with filters)
- `POST /api/actions/manual` — Create manual action
- `POST /api/actions/[id]/done` — Mark as done
- `POST /api/actions/[id]/ignore` — Ignore action

### Gmail
- `POST /api/gmail/sync` — Sync new emails
- `POST /api/gmail/analyze` — Extract actions
- `GET /api/gmail/status` — Connection status

## Security & Privacy

- **Read-only Gmail access** — Cannot send, delete, or modify emails
- **No email body storage** — Content is analyzed in memory, then discarded
- **Minimal metadata** — Only sender, subject, and 200-char snippet stored
- **No retention (MVP)** — Email metadata deleted daily, actions preserved
- **User data isolation** — All queries scoped to authenticated user
- **Cascade delete** — Disconnecting Gmail removes all related data

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
