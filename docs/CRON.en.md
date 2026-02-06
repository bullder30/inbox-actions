# Cron System - Scheduled Tasks

This document explains how the automatic cron system works for all scheduled tasks in the application.

## Architecture

The system uses **node-cron** to execute scheduled tasks automatically, both in local development and production.

### Main Files

- **`lib/cron/count-new-emails-job.ts`**: New email counting job (every 2 minutes)
- **`lib/cron/daily-sync-job.ts`**: Complete daily sync job (8:00 AM)
- **`lib/cron/cleanup-job.ts`**: Obsolete metadata cleanup job (9:00 AM)
- **`lib/cron/cron-service.ts`**: Cron management service (start, stop)
- **`instrumentation.ts`**: Next.js entry point to start crons at server launch

## Scheduled Jobs

### 1. Count New Emails Job (every 2 minutes)

**Schedule**: `*/2 * * * *` (every 2 minutes)

The `count-new-emails` job **only counts** new emails available in Gmail since the last sync (manual or automatic).

**Important**: This job does **NOT sync** emails, it only counts.

**Actual synchronization is done via**:
- The "Analyze" button in the dashboard (manual)
- The daily-sync job (automatic, every day at 8:00 AM)

**Real-time dashboard update**:
- **Server-Sent Events (SSE)** system combined with **Zustand**
- Server pushes count to client every 30 seconds via SSE
- Shared Zustand store for global state
- No client-side polling (more efficient)
- See [REALTIME_UPDATES.en.md](./REALTIME_UPDATES.en.md) for full details

**Objective**: Keep the "Pending" counter up to date in real-time without polling

### 2. Daily-Sync Job (every day at 8:00 AM)

**Schedule**: `0 8 * * *` (every day at 8:00 AM)

The `daily-sync` job is a more complete version of auto-sync:

1. **Synchronization**: Retrieves new Gmail emails (max 100 per run)
2. **Analysis**: Analyzes `EXTRACTED` emails (max 50 per run)

**Intentional limits**: 100 sync / 50 analyze for more aggressive daily processing

### 3. Cleanup Job (every day at 9:00 AM)

**Schedule**: `0 9 * * *` (every day at 9:00 AM)

The `cleanup` job cleans up obsolete email metadata:

**Retention rules**:
- **ANALYZED** emails: deletion after **90 days**
- **EXTRACTED** emails (not analyzed): deletion after **30 days**
- **Safety**: Last 7 days are NEVER deleted

**Objective**: Limit database growth while keeping recent data

## Real-time Dashboard Update

The "Pending" counter in the dashboard updates automatically in real-time thanks to a client-side polling system.

### Architecture

1. **Client component**: `PendingSyncCard` (React with `useState` and `useEffect`)
2. **API endpoint**: `/api/email/pending-count` (GET)
3. **Polling**: Every 30 seconds (cron runs every 2 minutes)

### How it works

```
[Cron every 2 min] -> Updates count in Gmail
                       ↓
[Dashboard component] -> Polling /api/email/pending-count every 30s
                       ↓
[API] -> Calls countNewEmailsInGmail()
                       ↓
[Dashboard] -> Updates display automatically
```

**Advantages**:
- Automatic update without page refresh
- Light polling (30 seconds) to avoid overload
- Count calculated in real-time via Gmail API
- No database storage needed

## Automatic Startup

Crons start automatically thanks to the `instrumentation.ts` file:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron/cron-service");
    startCronJobs();
  }
}
```

This function is called by Next.js at server startup (dev and production).

**Startup logs**:
```
[INSTRUMENTATION] Starting cron jobs...
[CRON SERVICE] 🚀 Starting cron jobs...
[CRON SERVICE] ✅ Count-new-emails job scheduled (every 2 minutes)
[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 8:00 AM)
[CRON SERVICE] ✅ Cleanup job scheduled (every day at 9:00 AM)
```

## Configuration

### Timezone

By default, cron uses the **Europe/Paris** timezone. To change it:

```typescript
// lib/cron/cron-service.ts
cron.schedule(
  "*/2 * * * *",
  async () => { ... },
  {
    timezone: "America/New_York", // Change here
  }
);
```

### Frequency

To change execution frequency, edit the cron pattern in `lib/cron/cron-service.ts`:

```typescript
// Examples:
"*/2 * * * *"   // Every 2 minutes
"*/5 * * * *"   // Every 5 minutes
"*/10 * * * *"  // Every 10 minutes
"0 * * * *"     // Every hour
"0 */2 * * *"   // Every 2 hours
```

## Local Development

### Startup

When you start the development server, cron starts automatically:

```bash
pnpm dev
```

You will see in the logs:

```
[INSTRUMENTATION] Starting cron jobs...
[CRON SERVICE] 🚀 Starting cron jobs...
[CRON SERVICE] ✅ Count-new-emails job scheduled (every 2 minutes)
[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 8:00 AM)
[CRON SERVICE] ✅ Cleanup job scheduled (every day at 9:00 AM)
```

### Logs

Jobs display detailed logs at each execution:

**Count New Emails Job**:
```
[COUNT-NEW-EMAILS JOB] 🔢 Starting...
[COUNT-NEW-EMAILS JOB] Found 1 users with Gmail
[COUNT-NEW-EMAILS JOB] user@example.com: 3 new emails
[COUNT-NEW-EMAILS JOB] ✨ Found 3 new emails (234ms)
```

**Note**: This job displays logs only if new emails are found (to avoid polluting logs).

**Daily-Sync Job**:
```
[CRON SERVICE] ⏰ Daily-sync job triggered
[DAILY-SYNC JOB] 🚀 Starting...
[DAILY-SYNC JOB] Found 1 users with Gmail connected
[DAILY-SYNC JOB] Processing user: user@example.com
[DAILY-SYNC JOB] ✅ Synced 15 emails for user@example.com
[DAILY-SYNC JOB] 📊 user@example.com: 5 actions extracted
[DAILY-SYNC JOB] ✨ Completed in 5432ms
[DAILY-SYNC JOB] Stats: { users: '1/1', synced: 15, actions: 5 }
```

**Cleanup Job**:
```
[CRON SERVICE] ⏰ Cleanup job triggered
[CLEANUP JOB] 🧹 Starting...
[CLEANUP JOB] Processing 1 users
[CLEANUP JOB] User user@example.com: deleted 25 emails (20 ANALYZED, 5 EXTRACTED)
[CLEANUP JOB] ✨ Completed in 1234ms
[CLEANUP JOB] Stats: { totalUsers: 1, analyzedDeleted: 20, extractedDeleted: 5, totalDeleted: 25 }
```

## Production

In production, cron works exactly the same way as in development.

### Deployment on Vercel

Cron starts automatically at Vercel instance startup. No additional configuration needed.

**Important**: Make sure `instrumentationHook: true` is enabled in `next.config.js`:

```javascript
experimental: {
  serverComponentsExternalPackages: ["@prisma/client"],
  instrumentationHook: true, // <- Important
}
```

## Monitoring

### Check that cron is working

Cron logs appear in:
- **Development**: Terminal console where `pnpm dev` is running
- **Production (Vercel)**: Function logs in Vercel dashboard

### Statistics

Each job execution displays statistics:
- Number of users processed
- Number of emails synced
- Number of emails analyzed
- Number of actions extracted
- Execution duration
- Potential errors

## Troubleshooting

### Cron doesn't start

1. Check that `instrumentationHook: true` is in `next.config.js`
2. Restart the Next.js server completely
3. Check startup logs

### Cron doesn't execute

1. Check that Next.js server is running
2. Wait 2 minutes for first count-new-emails job execution
3. Check logs for errors

### Execution errors

Errors are logged but don't stop cron. Check logs to identify issues:
- Expired Gmail tokens
- Database connection issues
- Email analysis errors

## Limits

### Limits per execution

To avoid timeouts, each job processes a limited number of items per execution:

**Count New Emails Job** (every 2 minutes):
- Only counts, no limit needed
- Light and fast operation

**Daily-Sync Job** (every day at 8:00 AM):
- **Synchronization**: Maximum 100 new emails per user
- **Analysis**: Maximum 50 EXTRACTED emails per user

**Cleanup Job** (every day at 9:00 AM):
- No limit: processes all obsolete emails according to retention rules

If you have more emails to process than the limits, they will be processed on the next run.

### Resources

Crons run in the same process as Next.js. In production on Vercel, this doesn't incur additional costs.

## Summary

| Job | Frequency | Schedule | Action | Objective |
|-----|-----------|----------|--------|-----------|
| **count-new-emails** | Every 2 min | - | Count only | Keep "Pending" counter up to date |
| **daily-sync** | 1x per day | 8:00 AM | Sync (100) + Analyze (50) | Complete daily sync |
| **cleanup** | 1x per day | 9:00 AM | Delete obsolete emails | Clean up obsolete data |

**Important note**: Actual email synchronization only happens via:
- The "Analyze" button in the dashboard (manual)
- The daily-sync job (automatic, 8:00 AM)
