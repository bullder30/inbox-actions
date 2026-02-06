# Scheduled Tasks Configuration (Cron Jobs)

This document explains the automatic scheduled task system for email synchronization and data cleanup.

## Overview

The system uses **node-cron** to execute 3 automatic tasks:

| Job | Frequency | Description | Time (Europe/Paris) |
|-----|-----------|-------------|---------------------|
| **count-new-emails** | Every 10 min | Counts new emails | Continuous |
| **daily-sync** | 1x per day | Syncs and analyzes emails | 8:00 AM |
| **cleanup** | 1x per day | Deletes emails > 3 days | 11:00 PM |

**Features**:
- Automatic startup via `instrumentation.ts`
- Timezone: Europe/Paris
- No catch-up for missed executions
- Detailed logs with prefixes `[CRON SERVICE]`, `[DAILY-SYNC JOB]`, `[CLEANUP JOB]`, `[COUNT-NEW-EMAILS JOB]`

## Configuration

### 1. Environment Variables

Add to your `.env.local`:

```bash
# Cron secret to secure HTTP endpoints (optional in dev, required in prod)
CRON_SECRET=your-random-secret-string-here
```

**Important**: Generate a secure random secret:
```bash
# Generation example
openssl rand -base64 32
```

### 2. Next.js Configuration

The `next.config.js` file enables the instrumentation hook:

```javascript
experimental: {
  serverComponentsExternalPackages: ["@prisma/client"],
  instrumentationHook: true, // <- Enables instrumentation
}
```

### 3. Automatic Startup

At Next.js startup (dev or production), the `instrumentation.ts` file automatically starts crons:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron/cron-service");
    startCronJobs();
  }
}
```

**Expected startup logs**:
```
[INSTRUMENTATION] Starting cron jobs...
[CRON SERVICE] 🚀 Starting cron jobs...
[CRON SERVICE] ✅ Count-new-emails job scheduled (every 10 minutes)
[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 8:00 AM)
[CRON SERVICE] ✅ Cleanup job scheduled (every day at 11:00 PM)
[INSTRUMENTATION] Cron jobs started successfully
```

## Tests

### Manual Test Endpoint

A special endpoint allows manually triggering jobs without waiting for the scheduled time:

```bash
# Test daily-sync
http://localhost:3000/api/cron/test-trigger?job=daily-sync

# Test cleanup
http://localhost:3000/api/cron/test-trigger?job=cleanup
```

Or with curl:
```bash
curl "http://localhost:3000/api/cron/test-trigger?job=daily-sync"
curl "http://localhost:3000/api/cron/test-trigger?job=cleanup"
```

**Expected response**:
```json
{
  "success": true,
  "job": "daily-sync",
  "result": {
    "success": true,
    "stats": {
      "totalUsers": 1,
      "successUsers": 1,
      "failedUsers": 0,
      "totalEmailsSynced": 17,
      "totalActionsExtracted": 5,
      "errors": []
    },
    "duration": 2345
  },
  "message": "Job 'daily-sync' executed successfully"
}
```

### Check Active Crons

The **count-new-emails** job logs appear **every 10 minutes** in your console:

```
[CRON SERVICE] ⏰ Count-new-emails job triggered at 2026-01-13T08:10:00.000Z
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with email configured
[COUNT-NEW-EMAILS JOB] david@example.com: 17 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 17 new emails (180ms)
```

If you don't see these logs, crons are not active.

## Detailed Logs

### Daily-sync job (8:00 AM)

Example logs during daily-sync execution:

```
[CRON SERVICE] ⏰ Daily-sync job triggered
[DAILY-SYNC JOB] 🚀 Starting...
[DAILY-SYNC JOB] Found 1 users with email configured
[DAILY-SYNC JOB] Processing user: david@example.com
[DAILY-SYNC JOB] ✅ Synced 17 emails for david@example.com
[DAILY-SYNC JOB] 📊 david@example.com: 5 actions extracted
[DAILY-SYNC JOB] ✨ Completed in 2345ms
[DAILY-SYNC JOB] Stats: { users: '1/1', synced: 17, actions: 5 }
```

### Cleanup job (11:00 PM)

Example logs during cleanup execution:

```
[CRON SERVICE] ⏰ Cleanup job triggered
[CLEANUP JOB] 🧹 Starting...
[CLEANUP JOB] Processing 1 users
[CLEANUP JOB] User david@example.com: deleted 42 emails older than 3 days
[CLEANUP JOB] ✨ Completed in 156ms
[CLEANUP JOB] Stats: { totalUsers: 1, totalDeleted: 42, retentionDays: 3 }
```

### Count-new-emails job (every 10 min)

Logs only if new emails are detected:

```
[CRON SERVICE] ⏰ Count-new-emails job triggered at 2026-01-13T08:10:00.000Z
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with email configured
[COUNT-NEW-EMAILS JOB] david@example.com: 17 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 17 new emails (180ms)
```

## Technical Details

### 1. Count-new-emails job (10 minutes)

- **Objective**: Display new email counter in UI
- **Frequency**: Every 10 minutes
- **Action**: Count only, does NOT sync emails
- **Performance**: Very fast (~100-200ms)

### 2. Daily-sync job (8:00 AM)

**STEP 1: Email Synchronization**
- Retrieves all users with an email provider configured (IMAP or Microsoft Graph)
- For each user:
  - Creates the appropriate email provider via `createEmailProvider()`
  - Automatically refreshes OAuth token if expired
  - Retrieves new emails (max 100 per run)
  - Checks duplicates via unique constraints
  - Stores only metadata (GDPR compliant)

**STEP 2: Analysis and action extraction**
- Retrieves emails with `EXTRACTED` status (max 50 per run)
- For each email:
  - Temporarily retrieves body (in memory only)
  - Extracts actions via REGEX (deterministic)
  - Creates actions in database
  - Marks email as `ANALYZED`

**STEP 3: Notification**
- Sends email digest to user if actions were extracted
- Non-blocking (notification error doesn't stop job)

### 3. Cleanup job (11:00 PM)

**Simplified deletion strategy**:
- Deletes **all emails** (ANALYZED or EXTRACTED) older than **3 days**
- No distinction by status
- No grace period (unlike old version that kept 7 days minimum)

**Prisma query**:
```typescript
prisma.emailMetadata.deleteMany({
  where: {
    userId: user.id,
    createdAt: { lt: retentionDate } // retentionDate = now - 3 days
  }
})
```

### Error Handling

- **Individual error**: Continues with other users
- **Expired token**: Skips user, logs error
- **Timeout**: Limit of 100 email sync + 50 email analysis per user
- **Fatal error**: Logs and returns error response

## Security

### HTTP Endpoints with Authorization

The `/api/cron/daily-sync` and `/api/cron/cleanup-metadata` endpoints verify the `Authorization` header:

```typescript
const authHeader = req.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Usage**:
```bash
curl -X GET http://localhost:3000/api/cron/daily-sync \
  -H "Authorization: Bearer your-cron-secret-here"
```

### Test Endpoint (no auth)

The `/api/cron/test-trigger` endpoint has **no authentication** to facilitate development testing. **Secure in production**.

## PC Sleep Mode Issue

### The Problem

**Crons do NOT execute if PC is in sleep/hibernation**:
- At 8:00 AM -> daily-sync doesn't run if PC is sleeping
- At 11:00 PM -> cleanup doesn't run if PC is sleeping
- Node.js is frozen when PC is in sleep mode

**Symptoms**:
```
[NODE-CRON] [WARN] missed execution at Tue Jan 13 2026 08:00:00 GMT+0100!
Possible blocking IO or high CPU user at the same process used by node-cron.
```

### Solutions

#### Option 1: Disable Sleep Mode (Simple)

```powershell
# Windows - Disable sleep
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

**Advantages**: No additional configuration
**Disadvantages**: Power consumption, not eco-friendly

#### Option 2: Windows Task Scheduler (Recommended)

Create Windows tasks that **automatically wake the PC** to execute jobs.

**Steps**:

1. Open **Windows Task Scheduler** (`taskschd.msc`)

2. Create a task for **daily-sync**:
   - Name: `Inbox Actions - Daily Sync`
   - Trigger: Every day at 8:00 AM
   - Action: Program/script
     ```
     powershell.exe
     ```
   - Add arguments:
     ```
     -Command "Invoke-WebRequest 'http://localhost:3000/api/cron/test-trigger?job=daily-sync'"
     ```
   - Check "**Wake the computer to run this task**"

3. Create a task for **cleanup**:
   - Name: `Inbox Actions - Cleanup`
   - Trigger: Every day at 11:00 PM
   - Action: Program/script
     ```
     powershell.exe
     ```
   - Add arguments:
     ```
     -Command "Invoke-WebRequest 'http://localhost:3000/api/cron/test-trigger?job=cleanup'"
     ```
   - Check "**Wake the computer to run this task**"

**Advantages**:
- PC wakes automatically
- Logs visible in Task Scheduler history
- No need for Next.js to run 24/7

**Disadvantages**:
- Manual configuration
- Next.js must be started at boot (PM2 or Windows service)

#### Option 3: PM2 (Always Active Server)

Install PM2 to keep Next.js always active (even after reboot):

```bash
# Install PM2 globally
npm install -g pm2

# Build Next.js
pnpm build

# Start with PM2
pm2 start npm --name "inbox-actions" -- start

# Save configuration
pm2 save

# Auto-start PM2 at Windows boot
pm2 startup
```

**Advantages**:
- Next.js runs 24/7
- Auto-restart on crash
- Centralized logs (`pm2 logs`)
- Monitoring (`pm2 monit`)

**Disadvantages**:
- PC must stay on (or use Option 2)
- Resource consumption

#### Option 4: Cloud Hosting (Production)

Deploy on a server that never sleeps:
- **Vercel** (with Vercel Cron)
- **Railway**
- **DigitalOcean App Platform**
- **VPS** (AWS, GCP, Azure)

**Advantages**:
- Guaranteed 24/7 availability
- No local server management
- Scalability

**Disadvantages**:
- Monthly cost
- Additional configuration

## Troubleshooting

### Crons Don't Start

**Symptom**: No `[CRON SERVICE]` log at startup

**Checks**:
1. `instrumentationHook: true` in `next.config.js`?
2. The `instrumentation.ts` file exists at root?
3. Compilation error in `instrumentation.ts`?

**Solution**:
```bash
# Restart dev server
pnpm dev

# Check startup logs
```

### Crons Don't Execute at Scheduled Times

**Possible causes**:
1. **PC in sleep mode** -> See "Sleep Mode Issue" section
2. **Incorrect timezone** -> Check `timezone: "Europe/Paris"` in `cron-service.ts`
3. **Next.js not started** -> Crons require Node process to be running

**Solution**:
- Use test endpoint to verify job works
- Implement one of the sleep mode management solutions

### "Email service unavailable"

**Cause**: Expired OAuth token that can't be refreshed, or invalid IMAP configuration

**Solution**:
1. User must reconfigure their email via `/settings`
2. Verify `access_type: "offline"` is configured for OAuth providers
3. Check IMAP credentials if applicable

### "CRON_SECRET not configured"

**Cause**: `CRON_SECRET` variable is not defined

**Solution**:
```bash
# Add to .env.local
CRON_SECRET=your-secret-here

# Restart server
pnpm dev
```

### Timeout / Performance

**Symptom**: Cron takes more than 10 seconds per user

**Solutions**:
- Reduce `maxResults` from 100 to 50 in `daily-sync-job.ts`
- Reduce email analysis limit from 50 to 25
- Optimize Prisma queries with `createMany`
- Check email API connection speed

### "missed execution" Warnings

**Symptom**:
```
[NODE-CRON] [WARN] missed execution at ...! Possible blocking IO
```

**Causes**:
- PC in sleep mode during scheduled time
- Next.js busy recompiling (hot reload)
- Blocking operation (very long email sync)

**Solution**:
- The `recoverMissedExecutions: false` flag is already configured to avoid catch-ups
- Use one of the sleep mode management solutions
- Reduce frequency if needed

## Monitoring

### Important Metrics

**Daily-sync**:
- **Duration**: < 5s per user ideally (can vary based on email count)
- **Success rate**: > 95% of users
- **Emails synced**: Varies by email activity
- **Actions extracted**: ~5-10% of analyzed emails

**Cleanup**:
- **Duration**: < 1s per user generally
- **Total deleted**: Increases if many emails are older than 3 days

**Count-new-emails**:
- **Duration**: < 500ms per user
- **Execution**: Every 10 minutes

### Logs to Monitor

- `[CRON SERVICE] ✅ ... job scheduled` -> Crons activated at startup
- `[DAILY-SYNC JOB] ✨ Completed` -> Daily sync successful
- `[CLEANUP JOB] ✨ Completed` -> Cleanup successful
- `[...-JOB] ❌ Error for user@example.com` -> Individual error (not blocking)
- `[...-JOB] ❌ Fatal error` -> Critical error (job failed)

## Future Improvements

- [ ] Cron monitoring dashboard in admin UI
- [ ] Slack/email notifications on critical failure
- [ ] Automatic retry logic for failed users
- [ ] Microsoft Graph webhooks for real-time notifications
- [ ] Batch creation for actions (performance)
- [ ] Prometheus/Grafana metrics

## File Summary

| File | Description |
|------|-------------|
| `instrumentation.ts` | Entry point: starts crons at boot |
| `lib/cron/cron-service.ts` | Main service: configures and starts 3 jobs |
| `lib/cron/count-new-emails-job.ts` | Counting job (10 min) |
| `lib/cron/daily-sync-job.ts` | Daily sync job (8:00 AM) |
| `lib/cron/cleanup-job.ts` | Cleanup job (11:00 PM) |
| `app/api/cron/test-trigger/route.ts` | Manual test endpoint |
| `app/api/cron/daily-sync/route.ts` | HTTP endpoint for external crons |
| `app/api/cron/cleanup-metadata/route.ts` | HTTP endpoint for external crons |

## Production Checklist

- [ ] `CRON_SECRET` configured in environment variables
- [ ] PM2 or Windows service configured for Next.js
- [ ] Windows Task Scheduler configured (if local PC)
- [ ] OR deployed on 24/7 cloud server
- [ ] Startup logs verified (`[CRON SERVICE] ✅`)
- [ ] Manual test of 2 main jobs (daily-sync, cleanup)
- [ ] Log monitoring configured
- [ ] Timezone correctly configured (`Europe/Paris`)
