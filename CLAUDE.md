# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Inbox Actions** is a Next.js 14 SaaS application that extracts actionable tasks from Gmail emails using deterministic regex patterns. The application is based on [next-saas-stripe-starter](https://github.com/mickasmt/next-saas-stripe-starter) by [@mickasmt](https://github.com/mickasmt), heavily customized with most marketing/blog/docs features removed to focus on the core action extraction functionality.

**Core Value Proposition:**
- Connect Gmail account (read-only OAuth)
- Automatically extract actionable tasks from emails
- Organize actions by type (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)
- Track due dates and completion status
- Receive email digests with pending actions

**MVP Limitation:** This version (0.1.0) only analyzes emails written in **French**. The regex patterns are designed for French language detection. Multi-language support is planned for future releases.

## Technology Stack

### Framework & Language
- **Next.js 14** (App Router) - React framework with server-side rendering
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript (note: `strict: false` in tsconfig)

### Database & ORM
- **PostgreSQL** (Neon DB) - Managed PostgreSQL database
- **Prisma** - Type-safe ORM with migrations

### Authentication & APIs
- **Auth.js v5** (NextAuth) - Authentication framework
  - Google OAuth provider (active)
  - Resend magic links (commented, to implement)
- **Gmail API** (googleapis) - Email access (read-only)
- **Stripe** - Payment processing
- **Resend** - Transactional emails

### UI & Styling
- **shadcn/ui** - Component library based on Radix UI
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Headless accessible components
- **React Hook Form** + **Zod** - Form management and validation
- **Sonner** - Toast notifications

### Utilities
- **node-cron** - Scheduled jobs (daily sync, cleanup)
- **Zustand** - Client-side state management
- **date-fns** - Date manipulation
- **React Email** - Email templates

### Testing
- **Vitest** - Unit testing framework
- **Testing Library** - React component testing

## Project Structure

```
inbox-actions/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Public authentication routes
│   │   ├── login/               # Login page (Google OAuth)
│   │   └── register/            # Registration page
│   ├── (protected)/             # Protected authenticated routes
│   │   ├── dashboard/          # Main dashboard with stats
│   │   ├── actions/            # Actions list and detail pages
│   │   │   └── [id]/          # Individual action page
│   │   ├── settings/           # User settings (notifications, sync)
│   │   ├── missing-action/     # Fallback for missing actions
│   │   └── actions/            # Server actions (mutations)
│   ├── api/                    # API Routes
│   │   ├── auth/[...nextauth]/ # NextAuth.js endpoints
│   │   ├── actions/           # CRUD for actions
│   │   │   ├── [id]/         # Specific action operations
│   │   │   │   ├── done/    # Mark as done
│   │   │   │   └── ignore/  # Ignore action
│   │   │   └── manual/      # Create manual action
│   │   ├── gmail/            # Gmail integration endpoints (7 endpoints)
│   │   │   ├── sync/        # Sync new emails
│   │   │   ├── analyze/     # Extract actions from emails
│   │   │   ├── status/      # Check Gmail connection status
│   │   │   ├── stats/       # Email statistics
│   │   │   ├── pending-count/    # Count pending emails
│   │   │   ├── pending-stream/   # Real-time updates stream
│   │   │   ├── disconnect/       # Disconnect Gmail
│   │   │   └── ignored-emails/   # Manage ignored emails
│   │   ├── cron/                 # Scheduled tasks
│   │   │   ├── daily-sync/      # Daily sync job (8h00)
│   │   │   ├── cleanup-metadata/ # Cleanup job (23h00)
│   │   │   └── test-trigger/    # Manual trigger for testing
│   │   ├── user/                 # User management
│   │   │   └── preferences/     # User preferences API
│   │   └── webhooks/stripe/      # Stripe webhook handler
│   ├── layout.tsx                # Root layout with providers
│   └── page.tsx                  # Landing page
├── lib/                          # Business logic and utilities
│   ├── gmail/
│   │   └── gmail-service.ts     # Gmail API service (541 lines)
│   ├── actions/
│   │   └── extract-actions-regex.ts  # Regex-based extraction (573 lines)
│   ├── cron/                    # Cron job implementations
│   │   ├── cron-service.ts     # Main cron service (114 lines)
│   │   ├── count-new-emails-job.ts   # Count emails job (106 lines)
│   │   ├── daily-sync-job.ts   # Daily sync job (182 lines)
│   │   └── cleanup-job.ts      # Cleanup job (140 lines)
│   ├── notifications/
│   │   └── action-digest-service.ts  # Email digest service (142 lines)
│   ├── api/                     # API client utilities
│   │   ├── actions.ts          # Actions API client (195 lines)
│   │   └── gmail.ts            # Gmail API client
│   ├── stores/                  # Zustand state stores
│   ├── db.ts                    # Prisma client singleton
│   ├── session.ts               # Session helpers
│   ├── subscription.ts          # Stripe subscription logic
│   └── email.ts                 # Email utilities
├── components/                   # React components
│   ├── actions/                 # Action-related components (7 files)
│   │   ├── action-card.tsx     # Action display card (241 lines)
│   │   ├── action-list.tsx     # List of actions with filters
│   │   ├── action-dialog.tsx   # Create/edit modal
│   │   ├── actions-header.tsx  # Page header
│   │   ├── empty-state.tsx     # Empty state display
│   │   └── action-card-skeleton.tsx  # Loading skeleton
│   ├── dashboard/               # Dashboard components (9 files)
│   │   ├── stats-card.tsx      # Statistics cards
│   │   ├── pending-sync-card.tsx    # Pending emails indicator (FEATURE_EMAIL_COUNT)
│   │   ├── sync-card.tsx       # Manual sync card (default)
│   │   ├── sync-button.tsx     # Manual sync button
│   │   ├── quick-actions.tsx   # Quick actions widget
│   │   ├── gmail-settings-section.tsx    # Gmail config
│   │   └── notification-settings-section.tsx  # Notification toggle
│   ├── gmail/                   # Gmail-related components (3 files)
│   │   ├── gmail-connect-button.tsx  # OAuth connection button
│   │   ├── gmail-status.tsx    # Connection status indicator
│   │   └── gmail-actions.tsx   # Gmail action buttons
│   ├── layout/                  # Layout components
│   │   ├── dashboard-sidebar.tsx    # Navigation sidebar
│   │   └── user-account-nav.tsx     # User menu with avatar
│   ├── ui/                      # shadcn/ui components (40+ files)
│   ├── shared/                  # Shared components
│   └── providers/               # React context providers
├── prisma/                      # Database
│   ├── schema.prisma           # Database schema (168 lines)
│   ├── seed.ts                 # Seed data
│   └── migrations/             # SQL migrations
├── emails/                      # React Email templates
│   └── action-digest-email.tsx # Digest email template
├── docs/                        # Documentation (17+ files)
│   ├── cron-setup.md           # Cron jobs guide (506 lines)
│   ├── GMAIL_INTEGRATION.md    # Gmail integration docs
│   ├── GMAIL_OAUTH_SETUP.md    # OAuth setup guide
│   ├── GMAIL_SECURITY_GDPR.md  # GDPR compliance
│   ├── REGEX_EXTRACTION.md     # Regex patterns docs
│   ├── DATABASE_MODEL.md       # Database schema docs
│   └── API_ACTIONS.md          # API endpoints docs
├── tests/                       # Test files
│   └── setup.ts                # Test configuration
├── scripts/                     # Utility scripts
├── instrumentation.ts           # Next.js instrumentation (cron startup)
├── auth.ts                      # Auth.js main config
├── auth.config.ts               # Auth.js provider config
├── env.mjs                      # Environment validation (Zod)
├── middleware.ts                # Auth middleware
├── next.config.js               # Next.js configuration
└── tailwind.config.ts           # Tailwind configuration
```

## Key Architecture Components

### 1. Email → Action Extraction Pipeline

#### Step 1: Gmail Integration

**File:** `lib/gmail/gmail-service.ts` (541 lines)

**Authentication:**
- OAuth2 with Google using read-only scope: `gmail.readonly`
- Offline access with automatic refresh token handling
- Token refresh via `refreshGoogleToken()` function

**Data Compliance (RGPD):**
- Stores ONLY email metadata in database
- Email body fetched temporarily for analysis (never stored)
- Minimal data: gmailMessageId, threadId, from, subject, snippet, receivedAt, labels

**Synchronization Strategy:**
- First sync: Last 24 hours
- Subsequent syncs: From `lastGmailSync` timestamp
- Pagination support (max 500 emails per request)
- Duplicate prevention via `@@unique([userId, gmailMessageId])`

**Key Methods:**
```typescript
class GmailService {
  // Fetch new emails (metadata only)
  async fetchNewEmails(options?: { maxResults?: number; labelIds?: string[] })

  // Get email body temporarily (not stored)
  async getEmailBodyForAnalysis(gmailMessageId: string): Promise<string>

  // Get emails ready for analysis (status: EXTRACTED)
  async getExtractedEmails(): Promise<EmailMetadata[]>

  // Mark email as analyzed
  async markEmailAsAnalyzed(gmailMessageId: string): Promise<void>

  // Count new emails in Gmail (for UI)
  async countNewEmailsInGmail(): Promise<number>
}
```

**Token Management:**
- Automatic refresh when expired
- Updates Account table with new tokens
- Graceful error handling for expired/revoked access

#### Step 2: Action Extraction (Regex-Based)

**File:** `lib/actions/extract-actions-regex.ts` (573 lines)

**Philosophy:** "If ambiguous → no action" (deterministic, transparent)

**Action Types Detected:**
- **SEND**: Send documents, emails, reports
  - Patterns: "peux-tu envoyer", "merci d'envoyer", "veuillez transmettre"
- **CALL**: Phone calls, video meetings
  - Patterns: "rappelle-moi", "appelle", "contacte"
- **FOLLOW_UP**: Follow-ups, reminders, check-ins
  - Patterns: "relance", "rappel", "n'oublie pas"
- **PAY**: Payments, invoices, transfers
  - Patterns: "payer la facture", "régler", "virement"
- **VALIDATE**: Approvals, confirmations, reviews
  - Patterns: "valider", "approuver", "confirmer"

**Due Date Detection:**
- Absolute dates: "avant le 15 mars", "pour vendredi", "d'ici lundi"
- Relative dates: "demain", "dans 2 jours", "cette semaine"
- Time moments: "ce matin", "fin de journée", "avant midi"
- Timezone: Europe/Paris

**Automatic Exclusions:**
- Sender filters: no-reply@, notifications@, newsletter@, noreply@
- Subject filters: newsletter, désabonnement, confirmation automatique
- Content filters: unsubscribe footers, automated messages

**Conditional Ignoring:**
- Phrases like "si tu peux", "quand tu as le temps", "éventuellement" → no action

**Example Pattern:**
```typescript
// SEND pattern
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// CALL pattern
/(?:rappelle|rappelez)(?:-moi)?(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici|pour)/i
```

**Testing:**
```bash
pnpm test:regex  # Test regex patterns against examples
```

### 2. Automated Cron Jobs System

**Implementation:** Node-cron within Next.js process

**Automatic Startup:**
- Via `instrumentation.ts` (Next.js instrumentation hook)
- Enabled in `next.config.js`: `experimentalInstrumentationHook: true`
- Starts when Next.js server boots (dev or production)

**Configuration File:** `lib/cron/cron-service.ts` (114 lines)

#### Job 1: Count New Emails (Optional)

**File:** `lib/cron/count-new-emails-job.ts` (106 lines)

**⚠️ Feature Flag:** This job is disabled by default. Set `FEATURE_EMAIL_COUNT=true` to enable.

**Frequency:** Every 10 minutes
**Schedule:** `*/10 * * * *` (Europe/Paris)
**Purpose:** Update UI with count of new emails available in Gmail
**Performance:** ~100-200ms per execution

**Process:**
1. Fetch all users with Gmail connected
2. For each user: call `countNewEmailsInGmail()`
3. Returns count (not stored, just for UI)

**Logs:**
```
[CRON SERVICE] ⏰ Count-new-emails job triggered at 2026-01-13T08:10:00.000Z
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with Gmail
[COUNT-NEW-EMAILS JOB] user@example.com: 17 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 17 new emails (180ms)
```

#### Job 2: Daily Sync

**File:** `lib/cron/daily-sync-job.ts` (182 lines)

**Frequency:** Once per day at 8:00 AM
**Schedule:** `0 8 * * *` (Europe/Paris)
**Purpose:** Comprehensive email sync + action extraction + notification

**Process:**
1. **Sync Phase:**
   - Fetch all users with Gmail connected AND `syncEnabled: true`
   - For each user:
     - Create GmailService instance
     - Refresh token if expired
     - Sync up to 100 new emails (metadata only)
     - Save to EmailMetadata table (status: EXTRACTED)

2. **Analysis Phase:**
   - Get up to 50 emails with status EXTRACTED
   - For each email:
     - Fetch body temporarily (in memory)
     - Extract actions via regex
     - Save Action entries to database
     - Mark email as ANALYZED

3. **Notification Phase:**
   - Call `sendActionDigest(userId)` if actions extracted
   - Non-blocking (error doesn't stop job)

**Error Handling:**
- Per-user error isolation (one user failure doesn't block others)
- Detailed logging with user email
- Collects error stats in response

**Logs:**
```
[CRON SERVICE] ⏰ Daily-sync job triggered
[DAILY-SYNC JOB] 🚀 Starting...
[DAILY-SYNC JOB] Found 1 users with Gmail connected
[DAILY-SYNC JOB] Processing user: user@example.com
[DAILY-SYNC JOB] ✅ Synced 17 emails for user@example.com
[DAILY-SYNC JOB] 📊 user@example.com: 5 actions extracted
[DAILY-SYNC JOB] ✨ Completed in 2345ms
[DAILY-SYNC JOB] Stats: { users: '1/1', synced: 17, actions: 5 }
```

**HTTP Endpoint:** `/api/cron/daily-sync` (with Bearer token auth)

#### Job 3: Cleanup

**File:** `lib/cron/cleanup-job.ts`

**Frequency:** Once per day at 11:00 PM
**Schedule:** `0 23 * * *` (Europe/Paris)
**Purpose:** Delete ALL email metadata (MVP: retention = 0)

**Strategy (MVP):**
- Deletes ALL email metadata every night
- Actions are preserved, only temporary metadata is deleted
- Keeps database minimal and GDPR-compliant

**Process:**
```typescript
prisma.emailMetadata.deleteMany({})
```

**Logs:**
```
[CRON SERVICE] ⏰ Cleanup job triggered
[CLEANUP JOB] 🧹 Starting...
[CLEANUP JOB] ✨ Completed in 45ms
[CLEANUP JOB] Stats: 42 email metadata deleted
```

**HTTP Endpoint:** `/api/cron/cleanup-metadata` (with Bearer token auth)

**Future (Pro):** Configurable retention (3, 7, 30 days)

#### Testing Crons

**Manual Trigger Endpoint:** `/api/cron/test-trigger`

```bash
# Test daily sync
curl "http://localhost:3000/api/cron/test-trigger?job=daily-sync"

# Test cleanup
curl "http://localhost:3000/api/cron/test-trigger?job=cleanup"
```

**No authentication required** (for dev testing convenience - secure in production!)

#### Important: Sleep Mode Issue

**Problem:** Crons do NOT execute if computer is in sleep/hibernation mode.

**Symptoms:**
```
[NODE-CRON] [WARN] missed execution at Tue Jan 13 2026 08:00:00 GMT+0100!
Possible blocking IO or high CPU user at the same process used by node-cron.
```

**Solutions:**
1. **Disable sleep** (simple but not eco-friendly)
2. **Windows Task Scheduler** with "Wake computer" option (recommended for local dev)
3. **PM2** to keep Next.js always running
4. **Cloud hosting** (Vercel, Railway, etc.) - production solution

See `docs/cron-setup.md` for detailed setup guide.

### 3. Notification System

**File:** `lib/notifications/action-digest-service.ts` (142 lines)

**Email Provider:** Resend
**Template:** `emails/action-digest-email.tsx` (React Email)

**Trigger:** After action extraction (daily-sync job or manual analyze)

**Anti-Spam Protection:**
- Max 1 email per 30 minutes per user
- Only sends if user has TODO actions
- Respects user preference: `User.emailNotifications` (toggle in settings)

**Email Content:**
- Total TODO actions count
- Urgent actions count (due < 24h)
- Overdue actions count
- Link to dashboard
- Unsubscribe link

**Implementation:**
```typescript
export async function sendActionDigest(userId: string): Promise<void> {
  // Check user preferences
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.emailNotifications) return;

  // Check last notification time (30 min cooldown)
  if (user.lastNotificationSent) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (user.lastNotificationSent > thirtyMinutesAgo) return;
  }

  // Get action stats
  const todoCount = await prisma.action.count({
    where: { userId, status: 'TODO' }
  });

  if (todoCount === 0) return;

  // Send email via Resend
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `📧 ${todoCount} actions en attente`,
    react: ActionDigestEmail({ /* props */ })
  });

  // Update last notification timestamp
  await prisma.user.update({
    where: { id: userId },
    data: { lastNotificationSent: new Date() }
  });
}
```

### 4. Database Schema (Prisma)

**File:** `prisma/schema.prisma` (168 lines)

#### User Model
```prisma
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  name          String?
  role          UserRole  @default(USER) // ADMIN | USER

  // Stripe subscription
  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // Gmail synchronization
  lastGmailSync           DateTime?  // Last sync timestamp
  gmailHistoryId          String?    // For incremental sync (future)
  lastEmailExtractionDate DateTime?  // Last extraction timestamp

  // User preferences
  emailNotifications   Boolean   @default(true)   // Email digest toggle
  lastNotificationSent DateTime?                  // Last notification time
  syncEnabled          Boolean   @default(true)   // Include in daily-sync job

  // Relations
  accounts       Account[]
  sessions       Session[]
  actions        Action[]
  emailMetadata  EmailMetadata[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum UserRole {
  ADMIN
  USER
}
```

#### Action Model
```prisma
model Action {
  id               String       @id @default(cuid())
  userId           String

  // Action details
  title            String              // Action description
  type             ActionType          // SEND | CALL | FOLLOW_UP | PAY | VALIDATE
  status           ActionStatus @default(TODO)  // TODO | DONE | IGNORED
  dueDate          DateTime?           // Extracted or manual due date

  // Source tracking
  sourceSentence   String       @db.Text  // Exact sentence from email
  emailFrom        String              // Sender email
  emailReceivedAt  DateTime            // Email received date
  gmailMessageId   String?             // Link to Gmail message

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indexes for filtering
  @@index([userId, status, type, dueDate])
}

enum ActionType {
  SEND      // Send documents, emails, files
  CALL      // Phone calls, video meetings
  FOLLOW_UP // Follow-ups, reminders
  PAY       // Payments, invoices
  VALIDATE  // Approvals, confirmations
}

enum ActionStatus {
  TODO      // Pending action
  DONE      // Completed
  IGNORED   // Dismissed by user
}
```

#### EmailMetadata Model (RGPD Compliant)
```prisma
model EmailMetadata {
  id             String   @id @default(cuid())
  userId         String

  // Gmail identifiers
  gmailMessageId String   // Gmail internal message ID
  gmailThreadId  String   // Gmail thread ID (for grouping)

  // Minimal metadata (RGPD compliant)
  from           String         // Sender email
  subject        String?        // Email subject
  snippet        String   @db.Text  // Short preview (~200 chars max)
  receivedAt     DateTime       // Received date
  labels         String[] @default([])  // Gmail labels (INBOX, etc.)

  // Processing status
  status         EmailStatus @default(EXTRACTED)  // EXTRACTED | ANALYZED

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Prevent duplicates
  @@unique([userId, gmailMessageId])

  // Indexes for queries
  @@index([userId, gmailMessageId, receivedAt, status])
}

enum EmailStatus {
  EXTRACTED  // Synced from Gmail, not yet analyzed
  ANALYZED   // Actions extracted, analysis complete
}
```

#### Account Model (Auth.js)
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // oauth, email, etc.
  provider          String  // google, resend
  providerAccountId String

  // OAuth tokens
  refresh_token String? @db.Text
  access_token  String? @db.Text
  expires_at    Int?
  token_type    String?
  scope         String?
  id_token      String? @db.Text
  session_state String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

**Key Relationships:**
- `User` has many `Action`, `EmailMetadata`, `Account`, `Session`
- `Action` belongs to `User`
- `EmailMetadata` belongs to `User`
- Cascade deletes: When User deleted, all related data removed

### 5. Authentication (Auth.js v5)

**Configuration Files:**
- `auth.config.ts` - Provider configuration
- `auth.ts` - Main Auth.js setup with callbacks
- `middleware.ts` - Route protection

#### Google OAuth Provider

**Scopes:**
- `gmail.readonly` - Read-only Gmail access
- `profile` + `email` - User profile

**Configuration:**
```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      access_type: "offline",      // Get refresh token
      prompt: "consent",            // Force consent screen
      scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly"
    }
  },
  allowDangerousEmailAccountLinking: true  // Link accounts with same email
})
```

#### Custom Callbacks

**signIn Callback:**
```typescript
async signIn({ user, account }) {
  // Auto-link Google account to existing user with same email
  if (account?.provider === "google" && user.email) {
    const existingUser = await db.user.findUnique({
      where: { email: user.email }
    });
    if (existingUser) {
      // Link account to existing user
      await db.account.update({
        where: { provider_providerAccountId: { ... } },
        data: { userId: existingUser.id }
      });
    }
  }
  return true;
}
```

**redirect Callback:**
```typescript
async redirect({ url, baseUrl }) {
  // Always redirect to dashboard after login
  return `${baseUrl}/dashboard`;
}
```

**jwt Callback:**
```typescript
async jwt({ token, user }) {
  // Add user role to JWT
  if (user) {
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    token.role = dbUser?.role;
  }
  return token;
}
```

**session Callback:**
```typescript
async session({ session, token }) {
  // Inject role into session
  session.user.role = token.role;
  return session;
}
```

#### Resend Provider (Commented - To Implement)

**Magic Link Authentication:**
```typescript
ResendProvider({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM,
  sendVerificationRequest: async ({ identifier, url }) => {
    // Send magic link email via Resend
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: identifier,
      subject: "Connexion à Inbox Actions",
      html: `<a href="${url}">Se connecter</a>`
    });
  }
})
```

#### Protected Routes

**Middleware:** `middleware.ts`
```typescript
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard") ||
                          req.nextUrl.pathname.startsWith("/actions") ||
                          req.nextUrl.pathname.startsWith("/settings");

  if (isProtectedRoute && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});
```

### 6. API Endpoints

#### Actions API (`/api/actions/`)

**Base endpoints:**
- `POST /api/actions` - Create action (not implemented, use `/api/actions/manual`)
- `GET /api/actions` - List actions with filters
- `GET /api/actions/[id]` - Get single action
- `PUT /api/actions/[id]` - Update action
- `DELETE /api/actions/[id]` - Delete action

**Specialized endpoints:**
- `POST /api/actions/[id]/done` - Mark action as DONE
- `POST /api/actions/[id]/ignore` - Mark action as IGNORED
- `POST /api/actions/manual` - Create manual action (not from email)

**Example - Mark as Done:**
```typescript
// POST /api/actions/[id]/done
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = await prisma.action.update({
    where: {
      id: params.id,
      userId: session.user.id  // Ensure user owns the action
    },
    data: { status: "DONE" }
  });

  return NextResponse.json(action);
}
```

#### Gmail API (`/api/gmail/`)

**POST /api/gmail/sync**
- Syncs new emails from Gmail (metadata only)
- Returns count of synced emails
- Updates `User.lastGmailSync`

**POST /api/gmail/analyze**
- Extracts actions from EXTRACTED emails
- Uses regex-based extraction
- Marks emails as ANALYZED
- Triggers notification digest
- Returns extraction stats

**GET /api/gmail/status**
- Checks Gmail connection status
- Returns: connected (boolean), email, lastSync

**GET /api/gmail/stats**
- Returns email statistics
- Total synced, analyzed, extracted
- Action counts by type

**GET /api/gmail/pending-count**
- Counts emails with status EXTRACTED (pending analysis)
- Fast, used for UI badge

**GET /api/gmail/pending-stream**
- Server-Sent Events (SSE) stream
- Real-time updates of pending email count
- Updates every 5 seconds
- Used for real-time UI updates without polling

**POST /api/gmail/disconnect**
- Disconnects Gmail account
- Deletes Account record
- Resets `User.lastGmailSync`

**GET /api/gmail/ignored-emails**
- Returns list of ignored email patterns
- For future feature: user-defined ignore rules

#### Cron API (`/api/cron/`)

**GET /api/cron/daily-sync**
- Triggers daily sync job
- **Auth:** Requires `Authorization: Bearer {CRON_SECRET}`
- Can be called by external cron services (Vercel Cron, etc.)

**GET /api/cron/cleanup-metadata**
- Triggers cleanup job
- **Auth:** Requires `Authorization: Bearer {CRON_SECRET}`

**GET /api/cron/test-trigger?job={daily-sync|cleanup}**
- Manual trigger for testing
- **No auth required** (secure in production!)
- Returns detailed execution result

#### User API (`/api/user/`)

**GET /api/user/preferences**
- Returns user preferences
- emailNotifications, syncEnabled, etc.

**PUT /api/user/preferences**
- Updates user preferences
- Request body: `{ emailNotifications?: boolean, syncEnabled?: boolean }`

### 7. UI Components

#### Action Components (`components/actions/`)

**action-card.tsx** (241 lines)
- Display card for single action
- Variants: `default` (full) | `compact` (reduced)
- Features:
  - Action type badge with icon
  - Due date with color coding (red if overdue, orange if urgent)
  - Source email sender
  - DONE and IGNORE buttons
  - Direct Gmail link via `gmailMessageId`
  - Toast notifications on action
- Props: `action`, `variant`

**action-list.tsx**
- List of actions with filters
- Filter by: status (TODO/DONE/IGNORED), type (SEND/CALL/etc.)
- Sort by: due date, received date
- Pagination support

**action-dialog.tsx**
- Modal for creating/editing manual actions
- Form fields: title, type, dueDate
- Validation with react-hook-form + Zod
- Submit via `/api/actions/manual`

**actions-header.tsx**
- Page header with title
- Filter buttons (TODO, DONE, IGNORED)
- "Create Action" button

**empty-state.tsx**
- Displayed when no actions match filters
- Different messages for TODO/DONE/IGNORED states

**action-card-skeleton.tsx**
- Loading skeleton for action cards
- Used during data fetching

#### Dashboard Components (`components/dashboard/`)

**stats-card.tsx**
- Displays statistics (count + label)
- Used for: TODO count, DONE count, IGNORED count
- Props: `title`, `value`, `description`, `icon`, `trend`

**pending-sync-card.tsx**
- Shows count of emails pending analysis
- Only displayed when `FEATURE_EMAIL_COUNT=true`
- Badge indicator when count > 0
- Sync button when emails pending

**sync-card.tsx**
- Manual sync card (default when `FEATURE_EMAIL_COUNT=false`)
- Shows last sync timestamp
- "Lancer une synchronisation" button
- Two-step sync: extract emails → analyze for actions
- Loading states and toast notifications

**sync-button.tsx**
- Manual sync button
- Two-step process:
  1. Sync emails (blue button)
  2. Analyze emails (green button)
- Loading states with spinners
- Toast notifications
- Disabled during operations

**quick-actions.tsx**
- Widget with quick action links
- e.g., "View urgent actions", "Analyze emails", etc.

**gmail-settings-section.tsx**
- Gmail configuration section in settings
- Shows connection status
- Sync button
- Disconnect button
- Last sync timestamp

**notification-settings-section.tsx**
- Toggle for email notifications
- Updates via `/api/user/preferences`
- Optimistic UI update with toast feedback

#### Gmail Components (`components/gmail/`)

**gmail-connect-button.tsx**
- OAuth connection button
- Triggers Auth.js Google OAuth flow
- Styled with Google branding

**gmail-status.tsx**
- Connection status indicator
- Green checkmark if connected
- Red alert if disconnected or token expired
- Shows connected email address

**gmail-actions.tsx**
- Action buttons for Gmail operations
- Sync, Analyze, Disconnect buttons
- Loading states
- Confirmation dialogs (disconnect)

#### Layout Components (`components/layout/`)

**dashboard-sidebar.tsx**
- Navigation sidebar for authenticated app
- Links: Dashboard, Actions, Settings
- Active route highlighting
- User profile section at bottom
- Responsive (collapsible on mobile)

**user-account-nav.tsx**
- User menu dropdown
- Avatar with user initials or photo
- Menu items: Profile, Settings, Logout
- Role badge (ADMIN/USER)

### 8. State Management

#### Server State
- **React Server Components** - Default for data fetching
- **Server Actions** - For mutations (in `app/(protected)/actions/`)
- **API Routes** - For client-side fetching and external calls

#### Client State
- **useState/useReducer** - Local component state
- **Zustand** - Global client state
  - Stores location: `lib/stores/`
  - Example: pending emails count store

#### Form State
- **React Hook Form** - Form management
- **Zod** - Schema validation
- Example:
  ```typescript
  const formSchema = z.object({
    title: z.string().min(1, "Title required"),
    type: z.enum(["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"]),
    dueDate: z.date().optional()
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
  });
  ```

#### Real-Time Updates
- **Server-Sent Events (SSE)** - `/api/gmail/pending-stream`
- Updates UI without polling
- Example usage:
  ```typescript
  useEffect(() => {
    const eventSource = new EventSource('/api/gmail/pending-stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setPendingCount(data.count);
    };
    return () => eventSource.close();
  }, []);
  ```

### 9. Environment Variables

**File:** `env.mjs` (54 lines) - Validates environment with Zod

**Required Server Variables:**
```bash
# Authentication
AUTH_SECRET=                    # NextAuth secret (generate with openssl rand -base64 32)

# Google OAuth
GOOGLE_CLIENT_ID=               # Google Cloud Console
GOOGLE_CLIENT_SECRET=           # Google Cloud Console

# Database
DATABASE_URL=                   # PostgreSQL connection string (Neon)

# Stripe (Payments)
STRIPE_API_KEY=                 # Stripe secret key
STRIPE_WEBHOOK_SECRET=          # Stripe webhook signing secret

# Email (Resend)
RESEND_API_KEY=                 # Resend API key
EMAIL_FROM=                     # Sender email (e.g., "App <noreply@example.com>")

# Cron Security (Optional in dev, required in prod)
CRON_SECRET=                    # Secret for securing cron endpoints

# Feature Flags (Optional)
FEATURE_EMAIL_COUNT=false       # Enable email count job and dashboard KPI (default: false)
```

**Required Client Variables:**
```bash
# App URL
NEXT_PUBLIC_APP_URL=            # App URL (e.g., http://localhost:3000)

# Stripe Price IDs (4 plans)
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID=
NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID=
NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID=
NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID=
```

**Validation:**
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    // ... other validations
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    // ... other validations
  },
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    // ... other mappings
  }
});
```

## Development Workflow

### Setup
```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables (see above)
# Edit .env.local with your keys

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Seed database with test data
pnpm db:seed
```

### Development
```bash
# Start dev server (localhost:3000)
pnpm dev

# Start with Turbo mode (faster rebuilds)
pnpm turbo

# Run email dev server (React Email - localhost:3333)
pnpm email

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Testing
```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Vitest UI
pnpm test:ui

# Test regex extraction patterns
pnpm test:regex
```

### Build & Deploy
```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Build + Start (combined)
pnpm preview
```

### Code Quality
```bash
# Run ESLint
pnpm lint

# Format with Prettier (if configured)
pnpm format
```

### Database
```bash
# Generate Prisma client (auto runs after install)
npx prisma generate

# Push schema changes to DB (dev)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Seed database
pnpm db:seed
```

## Important Development Patterns

### Server Actions vs API Routes

**Server Actions** (`app/(protected)/actions/`)
- Used for: Form submissions, mutations from Server Components
- Located in: `app/(protected)/actions/`
- Syntax: `"use server"` directive
- Example:
  ```typescript
  "use server";

  export async function updateUserName(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name }
    });

    revalidatePath("/dashboard");
  }
  ```

**API Routes** (`app/api/`)
- Used for: Client-side fetching, external webhooks, cron jobs
- Returns JSON responses
- Example:
  ```typescript
  export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actions = await prisma.action.findMany({
      where: { userId: session.user.id }
    });

    return NextResponse.json(actions);
  }
  ```

**When to use which:**
- Server Actions: Form submissions, progressive enhancement
- API Routes: Client-side fetching (fetch/axios), webhooks, cron jobs

### Authentication Checks

**Get current user:**
```typescript
import { auth } from "@/auth";

const session = await auth();
const userId = session?.user?.id;
```

**Require authenticated user:**
```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const session = await auth();
if (!session?.user?.id) {
  redirect("/login");
}
```

**Require admin role:**
```typescript
const session = await auth();
if (session?.user?.role !== "ADMIN") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Database Queries

**Always scope to user:**
```typescript
// GOOD: User can only access their own actions
const actions = await prisma.action.findMany({
  where: { userId: session.user.id }
});

// BAD: Potential data leak
const actions = await prisma.action.findMany();
```

**Use indexes for performance:**
```typescript
// Index on [userId, status, type, dueDate] in schema
const actions = await prisma.action.findMany({
  where: {
    userId: session.user.id,
    status: "TODO",
    type: "SEND"
  },
  orderBy: { dueDate: "asc" }
});
```

### Error Handling

**API Routes:**
```typescript
try {
  const result = await riskyOperation();
  return NextResponse.json(result);
} catch (error) {
  console.error("[API ERROR]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unknown error" },
    { status: 500 }
  );
}
```

**Server Actions:**
```typescript
try {
  await riskyOperation();
  revalidatePath("/dashboard");
} catch (error) {
  console.error("[SERVER ACTION ERROR]", error);
  throw new Error("Failed to perform operation");
}
```

### Toast Notifications

**Using Sonner:**
```typescript
import { toast } from "sonner";

// Success
toast.success("Action marked as done!");

// Error
toast.error("Failed to sync emails");

// Loading with promise
toast.promise(
  async () => await syncEmails(),
  {
    loading: "Syncing emails...",
    success: "Emails synced successfully!",
    error: "Failed to sync emails"
  }
);
```

### Component Patterns

**Server Component (default):**
```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await auth();
  const actions = await prisma.action.findMany({
    where: { userId: session!.user!.id, status: "TODO" }
  });

  return <div>{/* render actions */}</div>;
}
```

**Client Component (with "use client"):**
```typescript
// components/sync-button.tsx
"use client";

import { useState } from "react";

export function SyncButton() {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    await fetch("/api/gmail/sync", { method: "POST" });
    setLoading(false);
  }

  return <button onClick={handleSync} disabled={loading}>Sync</button>;
}
```

## Testing

### Test Files
- Location: `tests/` directory
- Setup: `tests/setup.ts`
- Framework: Vitest + Testing Library

### Running Tests
```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# UI mode
pnpm test:ui

# Specific file
pnpm test path/to/test.test.ts

# Regex extraction tests (custom script)
pnpm test:regex
```

### Example Test
```typescript
import { describe, it, expect } from "vitest";
import { extractActionsFromEmail } from "@/lib/actions/extract-actions-regex";

describe("Action Extraction", () => {
  it("should extract SEND action", () => {
    const result = extractActionsFromEmail({
      from: "sender@example.com",
      subject: "Test",
      body: "Peux-tu m'envoyer le rapport avant demain ?",
      receivedAt: new Date()
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("SEND");
    expect(result[0].title).toContain("rapport");
  });
});
```

## Security Considerations

### Authentication
- All protected routes check session via middleware
- API routes verify session before database operations
- User can only access their own data (scoped queries)

### Data Privacy (RGPD)
- Email body NEVER stored in database
- Only metadata saved: from, subject, snippet (200 chars max)
- Body fetched temporarily for analysis, then discarded
- User can disconnect Gmail and delete all data (cascade delete)

### OAuth Security
- Read-only Gmail scope (`gmail.readonly`)
- Offline access with refresh tokens
- Tokens stored encrypted in database (Prisma + PostgreSQL)
- Automatic token refresh before expiration

### Input Validation
- All forms validated with Zod schemas
- API routes validate input before processing
- SQL injection prevented by Prisma ORM

### Cron Security
- Endpoints require `Authorization: Bearer {CRON_SECRET}` header
- Secret validated before execution
- Test endpoint should be secured in production

### XSS Prevention
- React escapes output by default
- No `dangerouslySetInnerHTML` usage
- Content Security Policy (CSP) configured

## Common Tasks Guide

### Adding a New Action Type

1. **Update Prisma enum:**
   ```prisma
   enum ActionType {
     SEND
     CALL
     FOLLOW_UP
     PAY
     VALIDATE
     NEW_TYPE  // Add here
   }
   ```

2. **Create migration:**
   ```bash
   npx prisma migrate dev --name add_new_type
   ```

3. **Add regex pattern in `lib/actions/extract-actions-regex.ts`:**
   ```typescript
   if (/pattern for new type/.test(body)) {
     actions.push({
       type: "NEW_TYPE",
       title: "Description",
       sourceSentence: matchedText
     });
   }
   ```

4. **Add icon and color in UI components:**
   - `components/actions/action-card.tsx` - Add icon mapping
   - `components/shared/icons.tsx` - Add icon component
   - Update type colors in Tailwind classes

5. **Update type filter in `action-list.tsx`**

6. **Add tests in `tests/`**

### Adding a New Cron Job

1. **Create job file in `lib/cron/`:**
   ```typescript
   // lib/cron/new-job.ts
   export async function runNewJob() {
     console.log("[NEW JOB] Starting...");
     // Implementation
     console.log("[NEW JOB] Completed");
   }
   ```

2. **Register in `lib/cron/cron-service.ts`:**
   ```typescript
   import { runNewJob } from "./new-job";

   let newJobTask: cron.ScheduledTask | null = null;

   export function startCronJobs() {
     // ... existing jobs

     if (!newJobTask) {
       newJobTask = cron.schedule(
         "0 12 * * *",  // Every day at noon
         async () => {
           console.log("[CRON SERVICE] ⏰ New job triggered");
           try {
             await runNewJob();
           } catch (error) {
             console.error("[CRON SERVICE] Error running new job:", error);
           }
         },
         {
           scheduled: true,
           timezone: "Europe/Paris"
         }
       );
       console.log("[CRON SERVICE] ✅ New job scheduled");
     }
   }
   ```

3. **Create HTTP endpoint in `app/api/cron/new-job/route.ts`:**
   ```typescript
   import { NextRequest, NextResponse } from "next/server";
   import { runNewJob } from "@/lib/cron/new-job";

   export async function GET(req: NextRequest) {
     // Verify CRON_SECRET
     const authHeader = req.headers.get("authorization");
     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const result = await runNewJob();
     return NextResponse.json({ success: true, result });
   }
   ```

4. **Add test trigger in `app/api/cron/test-trigger/route.ts`:**
   ```typescript
   case "new-job":
     console.log("[TEST TRIGGER] 🧪 Manually triggering new job");
     result = await runNewJob();
     break;
   ```

5. **Document in `docs/cron-setup.md`**

### Adding User Preferences

1. **Add field to User model:**
   ```prisma
   model User {
     // ... existing fields
     newPreference Boolean @default(true)
   }
   ```

2. **Create migration:**
   ```bash
   npx prisma migrate dev --name add_new_preference
   ```

3. **Update `/api/user/preferences` endpoints:**
   ```typescript
   // GET - return new preference
   // PUT - validate and update new preference
   ```

4. **Add UI toggle in settings page:**
   ```typescript
   // app/(protected)/settings/page.tsx
   <PreferenceToggle
     label="New Preference"
     description="Description of preference"
     checked={user.newPreference}
     onChange={handleUpdate}
   />
   ```

5. **Use preference in relevant code:**
   ```typescript
   const user = await prisma.user.findUnique({ where: { id } });
   if (!user?.newPreference) return;
   // ... conditional logic
   ```

## Documentation

Comprehensive documentation is available in the `docs/` folder:

- **`cron-setup.md`** (506 lines) - Complete cron jobs setup guide
  - Configuration, testing, troubleshooting
  - Sleep mode solutions (Windows Task Scheduler, PM2, cloud)
  - Detailed logs and monitoring

- **Gmail Integration:**
  - `GMAIL_INTEGRATION.md` - Overview and architecture
  - `GMAIL_OAUTH_SETUP.md` - OAuth configuration guide
  - `GMAIL_SECURITY_GDPR.md` - Privacy and compliance

- **Action Extraction:**
  - `REGEX_EXTRACTION.md` - Regex patterns documentation
  - Examples and testing

- **Database:**
  - `DATABASE_MODEL.md` - Schema documentation
  - Relationships and indexes

- **API:**
  - `API_ACTIONS.md` - Actions API endpoints
  - Request/response examples

- **Testing:**
  - `TESTS.md` - Testing guide
  - Running tests, writing tests

## Migration Notes

This project was heavily refactored from the Next.js SaaS Starter template:

**Removed:**
- Blog system
- Documentation pages (separate from /docs folder)
- Marketing pages (pricing, about, etc.)
- Charts/analytics dashboard
- Admin dashboard

**Added:**
- Gmail integration with OAuth
- Email metadata storage (RGPD compliant)
- Regex-based action extraction
- Cron jobs system (node-cron)
- Notification digest system
- Action management UI
- Real-time updates (SSE)

**Modified:**
- Dashboard simplified (focus on actions)
- Settings page restructured (Gmail, notifications)
- Sidebar navigation reduced (Dashboard, Actions, Settings)
- Authentication focused on Google OAuth

The git status shows many deleted/modified files - this is expected from the refactoring process.

## Troubleshooting

### Crons Not Running

**Symptoms:**
- No logs from cron jobs
- Jobs not executing at scheduled times

**Checks:**
1. Server running? (`pnpm dev` or `pnpm start`)
2. Instrumentation logs present? `[INSTRUMENTATION] Starting cron jobs...`
3. PC in sleep mode during scheduled time?

**Solutions:**
- Restart server to reload crons
- Check `next.config.js` has `instrumentationHook: true`
- Implement sleep mode solution (see `docs/cron-setup.md`)

### Gmail Token Expired

**Symptoms:**
- "Gmail service unavailable" errors
- Actions not extracting despite sync

**Solutions:**
1. User must reconnect via Settings → Gmail
2. Verify `access_type: "offline"` in `auth.config.ts`
3. Check Account table has `refresh_token`

### Database Connection Issues

**Symptoms:**
- Prisma errors
- "Can't reach database server" errors

**Solutions:**
1. Check `DATABASE_URL` in `.env.local`
2. Verify database is accessible
3. Try `npx prisma db push` to sync schema
4. Check Neon dashboard for connection limits

### Build Errors

**Symptoms:**
- TypeScript errors during build
- Missing environment variables

**Solutions:**
1. Run `npx prisma generate` to regenerate client
2. Verify all required env vars in `env.mjs` are set
3. Check `pnpm install` completed successfully
4. Clear `.next` folder and rebuild

### Cron Missed Execution Warnings

**Symptoms:**
```
[NODE-CRON] [WARN] missed execution at ...! Possible blocking IO
```

**Cause:**
- PC was in sleep mode
- Next.js was busy recompiling (hot reload)
- Long-running operation blocked event loop

**Solutions:**
- Implemented `recoverMissedExecutions: false` (already done)
- Use sleep mode solutions (see `docs/cron-setup.md`)
- Reduce job frequency if needed

## Performance Optimization

### Database
- Indexes on frequently queried fields (`userId`, `status`, `type`, `dueDate`)
- Pagination for large result sets
- Unique constraints to prevent duplicates

### Gmail API
- Pagination (max 500 emails per request)
- Metadata-only storage (body fetched on-demand)
- Incremental sync with `lastGmailSync` timestamp

### Cron Jobs
- Per-user error isolation (one failure doesn't block others)
- Limits: 100 emails sync, 50 emails analyze per run
- Non-blocking notifications

### UI
- Server Components by default (less JavaScript)
- Loading skeletons for better perceived performance
- Optimistic UI updates where possible
- Toast notifications for immediate feedback

### Potential Improvements
- Gmail History API for incremental sync (more efficient)
- Batch creation for actions (single query instead of loop)
- Redis cache for Gmail API responses
- Webhooks for Gmail Push Notifications (real-time instead of polling)

## Deployment

### Vercel (Recommended)

1. **Connect Git repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy**

**Cron Jobs:**
- Replace node-cron with Vercel Cron
- Create `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/daily-sync",
        "schedule": "0 8 * * *"
      },
      {
        "path": "/api/cron/cleanup-metadata",
        "schedule": "0 23 * * *"
      }
    ]
  }
  ```
- Endpoints use `CRON_SECRET` for auth

### Other Platforms

**Railway, DigitalOcean, etc.:**
- Standard Next.js deployment
- Node.js 18+ required
- PostgreSQL database required
- Set all environment variables
- node-cron will work out of the box (no sleep mode issues on servers)

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "start"]
```

## Future Improvements

### High Priority
- [ ] Gmail History API for efficient incremental sync
- [ ] Batch action creation (performance)
- [ ] Retry logic for failed cron jobs
- [ ] Email notification on critical errors

### Medium Priority
- [ ] User-defined ignore rules (emails, senders, subjects)
- [ ] Bulk action operations (mark multiple as done)
- [ ] Action templates for recurring tasks
- [ ] Calendar integration (Google Calendar, iCal)
- [ ] Mobile app (React Native)

### Low Priority
- [ ] Multi-language support (i18n)
- [ ] Dashboard analytics (charts, graphs)
- [ ] Admin dashboard for monitoring
- [ ] Webhooks for Gmail Push Notifications (real-time)
- [ ] Prometheus/Grafana metrics
- [ ] Integration with task managers (Todoist, Notion, etc.)

## Support & Contributing

### Getting Help
- Check `docs/` folder for detailed guides
- Review this CLAUDE.md file
- Check GitHub issues (if public repo)

### Reporting Issues
Include:
- Environment (dev/production)
- Steps to reproduce
- Error messages/logs
- Expected vs actual behavior

### Code Style
- TypeScript (strict mode recommended, currently false)
- Prettier for formatting
- ESLint for linting
- Follow existing patterns in codebase

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](LICENSE.md) file for details.

## Credits

Based on [next-saas-stripe-starter](https://github.com/mickasmt/next-saas-stripe-starter) by [@mickasmt](https://github.com/mickasmt).

---

**Last Updated:** 2026-01-16
**Version:** 1.0
**License:** AGPL-3.0
