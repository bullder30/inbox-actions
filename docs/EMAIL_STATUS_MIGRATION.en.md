# Migration: Email Status System

## Summary of Changes

### Old System
- `processed: Boolean` (false = not processed, true = processed)
- No clear distinction between "synced" and "analyzed"
- No last extraction date

### New System
- `status: EmailStatus` (EXTRACTED | ANALYZED)
  - **EXTRACTED**: Email synced from provider (IMAP or Microsoft Graph), metadata extracted
  - **ANALYZED**: Email analyzed for action extraction
- `lastEmailExtractionDate: DateTime` on User
  - Prevents re-extracting already processed emails

## Benefits

1. **Clarity**: Explicit distinction between sync and analysis
2. **Maintainability**: Easier to understand email status
3. **Cleanup**: Enables cleaning emails based on their status
4. **Performance**: Optimization with `lastEmailExtractionDate`

## Database Migration

### Step 1: Run the SQL migration

```bash
# Connect to the database
psql -h localhost -p 15432 -U postgres -d inbox_actions

# Run the migration file
\i prisma/migrations/migration_email_status.sql
```

### Step 2: Regenerate the Prisma client

```bash
pnpm prisma generate
```

### Step 3: Rebuild the application

```bash
pnpm build
```

## Code Changes

### Prisma Models

**EmailMetadata**
- `processed: Boolean` removed, `status: EmailStatus` added

**User**
- `lastEmailExtractionDate: DateTime?` added

### Services

**IEmailProvider** (interface implemented by IMAPProvider and MicrosoftGraphProvider)
- `getUnprocessedEmails()` renamed to `getExtractedEmails()`
- `markEmailAsProcessed()` renamed to `markEmailAsAnalyzed()`

### API Routes

**`/api/email/analyze`**
- Uses `getExtractedEmails()` to retrieve emails to analyze
- Marks emails as ANALYZED after processing

**`/api/email/status`**
- Returns `extractedCount` and `analyzedCount` instead of `unprocessedCount`

**`/api/cron/daily-sync`**
- Uses the new status system

## Automatic Cleanup Strategy

### Metadata Cleanup Cron

**Status**: Implemented

**Route**: `/api/cron/cleanup-metadata`

**Frequency**: 1x per night (via Vercel Cron)

**Deletion Rules:**
1. **ANALYZED** emails + older than **90 days** -> Deletion
2. **EXTRACTED** emails + older than **30 days** (never analyzed) -> Deletion
3. **Safety**: ALWAYS keeps at minimum the **last 7 days** of data

**Retention Strategy:**
- **ANALYZED**: 90 days (3 months of history)
- **EXTRACTED**: 30 days (reasonable delay before deletion if not analyzed)
- **Minimum**: 7 days (protection against accidental deletion)

**Manual Call Example (dev/debug):**
```bash
curl -X GET http://localhost:3000/api/cron/cleanup-metadata \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Sample Response:**
```json
{
  "success": true,
  "duration": 1523,
  "stats": {
    "totalUsers": 5,
    "analyzedDeleted": 142,
    "extractedDeleted": 38,
    "totalDeleted": 180,
    "errors": []
  },
  "retention": {
    "analyzedDays": 90,
    "extractedDays": 30,
    "minimumDays": 7
  },
  "message": "Cleanup completed: 180 emails deleted"
}
```

**Equivalent SQL Queries:**
```sql
-- Delete analyzed emails older than 90 days (except last 7 days)
DELETE FROM email_metadata
WHERE status = 'ANALYZED'
  AND created_at < NOW() - INTERVAL '90 days'
  AND created_at <= NOW() - INTERVAL '7 days';

-- Delete extracted emails never analyzed older than 30 days (except last 7 days)
DELETE FROM email_metadata
WHERE status = 'EXTRACTED'
  AND created_at < NOW() - INTERVAL '30 days'
  AND created_at <= NOW() - INTERVAL '7 days';
```

**Vercel Cron Configuration:**

Configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-sync",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/cleanup-metadata",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Schedule:
- `daily-sync`: 8:00 AM (email synchronization)
- `cleanup-metadata`: 9:00 AM (cleanup after sync)

## Using lastEmailExtractionDate

This date allows synchronization optimization:

```typescript
// In email service - fetchNewEmails()
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { lastEmailExtractionDate: true },
});

// Filtered query: only fetch emails received after this date
// (implementation specific to each provider: IMAP or Microsoft Graph)
```

## Email Extraction Strategy

**Implementation Date**: 2026-01-07

### Current Behavior

Email extraction uses an **intelligent incremental strategy**:

```typescript
// In email service - fetchNewEmails()
const user = await prisma.user.findUnique({
  where: { id: this.userId },
  select: { lastEmailSync: true },
});

let afterTimestamp: number;

if (user?.lastEmailSync) {
  // Existing sync: fetch all emails since last sync
  afterTimestamp = Math.floor(user.lastEmailSync.getTime() / 1000);
  console.log(`Fetching emails since last sync: ${user.lastEmailSync.toISOString()}`);
} else {
  // First sync: fetch only the last 24 hours
  const last24Hours = new Date();
  last24Hours.setHours(last24Hours.getHours() - 24);
  afterTimestamp = Math.floor(last24Hours.getTime() / 1000);
  console.log(`First sync: fetching emails from last 24 hours`);
}

// Query with date filter (implementation specific to provider)
```

### Extraction Rules

1. **First synchronization** (`lastEmailSync` is null)
   - Only fetches emails from the **last 24 hours**
   - Avoids massive history retrieval
   - Limits initial load

2. **Subsequent synchronizations** (`lastEmailSync` exists)
   - Fetches **all emails since last sync**
   - Ensures no email is missed
   - Efficient incremental synchronization
   - Microsoft Graph uses delta queries for better performance

### Benefits

1. **Light first sync**: Only 24h of emails instead of entire history
2. **Continuous synchronization**: No missed emails after first sync
3. **Optimal performance**: Minimal load on email APIs
4. **User experience**: Quick setup for new users

### Future Evolution

A feature will allow **fetching emails between 2 dates** for:
- Retrieving specific historical emails
- Analyzing a given period
- Manual catch-up if needed

This feature will be accessible via:
- User interface in email settings
- Optional `dateRange` parameter in `fetchNewEmails()`

## Post-Migration Verification

```sql
-- Check statuses
SELECT status, COUNT(*)
FROM email_metadata
GROUP BY status;

-- Check lastEmailExtractionDate
SELECT
  id,
  email,
  last_email_extraction_date
FROM users
WHERE last_email_extraction_date IS NOT NULL;
```

## Rollback (if necessary)

```sql
-- Add the processed column
ALTER TABLE email_metadata ADD COLUMN processed BOOLEAN DEFAULT false;

-- Migrate the data
UPDATE email_metadata SET processed = true WHERE status = 'ANALYZED';
UPDATE email_metadata SET processed = false WHERE status = 'EXTRACTED';

-- Remove the status column
DROP INDEX email_metadata_status_idx;
ALTER TABLE email_metadata DROP COLUMN status;

-- Remove lastEmailExtractionDate
ALTER TABLE users DROP COLUMN last_email_extraction_date;

-- Remove the enum
DROP TYPE "EmailStatus";

-- Recreate the index
CREATE INDEX email_metadata_processed_idx ON email_metadata(processed);
```
