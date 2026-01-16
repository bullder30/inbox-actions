# Real-time Updates - SSE + Zustand

Documentation of the real-time update system for the pending email counter.

---

## Overview

The system uses **Server-Sent Events (SSE)** combined with **Zustand** to update the pending email counter in the dashboard in real-time, without client-side polling.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Architecture                             │
└─────────────────────────────────────────────────────────────────┘

Cron Job (every 2 min)
    ↓
Count new Gmail emails
    ↓
[Stored in temporary memory]
    ↓
SSE Endpoint (/api/gmail/pending-stream)
    ↓ (stream every 30 sec)
Client (EventSource)
    ↓
Zustand Store (global state)
    ↓
UI Components (PendingSyncCard)
```

---

## Components

### 1. Zustand Store

**File**: `lib/stores/pending-emails-store.ts`

Shared global store for the pending email counter.

```typescript
import { create } from "zustand";

interface PendingEmailsState {
  count: number;
  lastUpdate: Date | null;
  setCount: (count: number) => void;
  reset: () => void;
}

export const usePendingEmailsStore = create<PendingEmailsState>((set) => ({
  count: 0,
  lastUpdate: null,
  setCount: (count: number) => set({ count, lastUpdate: new Date() }),
  reset: () => set({ count: 0, lastUpdate: null }),
}));
```

**Advantages**:
- Shared state between all components
- No props drilling
- Automatic reactive updates

---

### 2. SSE Endpoint

**File**: `app/api/gmail/pending-stream/route.ts`

Endpoint that streams the count in real-time via Server-Sent Events.

```typescript
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const sendEvent = (data: { count: number }) => {
        if (isClosed) return;

        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.log("[SSE] Stream already closed");
          isClosed = true;
        }
      };

      const fetchAndSendCount = async () => {
        if (isClosed) return;

        try {
          const gmailService = await createGmailService(userId);
          if (!gmailService) {
            sendEvent({ count: 0 });
            return;
          }

          const count = await gmailService.countNewEmailsInGmail();
          sendEvent({ count });
        } catch (error) {
          console.error("[SSE] Error fetching count:", error);
          sendEvent({ count: 0 });
        }
      };

      // Send immediately on startup
      await fetchAndSendCount();

      // Then every 30 seconds
      intervalId = setInterval(fetchAndSendCount, 30 * 1000);
    },
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
        console.log("[SSE] Stream cancelled");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

**Features**:
- Sends count immediately on connection
- Then every 30 seconds
- Clean disconnection handling
- Automatic browser reconnection

---

### 3. SSE Provider

**File**: `components/providers/pending-emails-provider.tsx`

Component that listens to SSE events and updates the Zustand store.

```typescript
"use client";

import { usePendingEmailsStore } from "@/lib/stores/pending-emails-store";
import { useEffect } from "react";

export function PendingEmailsProvider({
  children
}: {
  children: React.ReactNode
}) {
  const setCount = usePendingEmailsStore((state) => state.setCount);

  useEffect(() => {
    // Create EventSource connection
    const eventSource = new EventSource("/api/gmail/pending-stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      } catch (error) {
        console.error("[SSE] Error parsing event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[SSE] EventSource error:", error);
      // EventSource reconnects automatically
    };

    // Cleanup on disconnect
    return () => {
      eventSource.close();
    };
  }, [setCount]);

  return <>{children}</>;
}
```

**How it works**:
- Mounts once at app startup
- Listens to SSE events
- Updates Zustand store
- Automatic cleanup on unmount

---

### 4. Integration in Layout

**File**: `app/layout.tsx`

The SSE provider is added in the root layout to be active throughout the application.

```typescript
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <ThemeProvider>
            <PendingEmailsProvider>
              <ModalProvider>{children}</ModalProvider>
            </PendingEmailsProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

### 5. UI Component

**File**: `components/dashboard/pending-sync-card.tsx`

Card that displays the counter from the Zustand store.

```typescript
export function PendingSyncCard({ lastSyncText }: PendingSyncCardProps) {
  // Use Zustand store (updated in real-time via SSE)
  const count = usePendingEmailsStore((state) => state.count);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    try {
      setSyncing(true);

      // Step 1: Extract ALL emails since last sync
      toast.info("Extracting emails...");
      const syncResult = await syncGmail();

      if (syncResult.count === 0) {
        toast.info("No new emails to extract");
        return;
      }

      toast.success(`${syncResult.count} email(s) extracted`);

      // Step 2: Analyze ALL extracted emails
      toast.info("Analyzing emails...");
      const analyzeResult = await analyzeGmail();
      toast.success(
        `${analyzeResult.extractedActions} action(s) created`
      );

      router.refresh();
    } catch (error) {
      toast.error("Error during analysis");
    } finally {
      setSyncing(false);
    }
  }

  const syncButton = count > 0 ? (
    <Button onClick={handleSync} disabled={syncing}>
      <RefreshCw className={syncing ? "animate-spin" : ""} />
      Analyze
    </Button>
  ) : undefined;

  return (
    <StatsCard
      title="Pending"
      value={count}
      description={
        count > 0
          ? `New emails since ${lastSyncText}`
          : `Last sync ${lastSyncText}`
      }
      icon={Inbox}
      action={syncButton}
    />
  );
}
```

---

## Cron Job

**File**: `lib/cron/count-new-emails-job.ts`

Job that counts new emails every 2 minutes.

```typescript
export async function runCountNewEmailsJob() {
  console.log("[Cron] Count new emails job started");

  try {
    const users = await prisma.user.findMany({
      where: {
        accounts: {
          some: {
            provider: "google",
            scope: {
              contains: "gmail.readonly",
            },
          },
        },
      },
      select: { id: true, email: true },
    });

    for (const user of users) {
      try {
        const gmailService = await createGmailService(user.id);
        if (!gmailService) continue;

        const newEmailsCount = await gmailService.countNewEmailsInGmail();

        // Log only if new emails
        if (newEmailsCount > 0) {
          console.log(
            `[Cron] User ${user.email}: ${newEmailsCount} new email(s)`
          );
        }
      } catch (error) {
        console.error(`[Cron] Error for user ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error("[Cron] Count new emails job failed:", error);
  }
}
```

**Frequency**: Every 2 minutes (`*/2 * * * *`)

---

## Complete Flow

### 1. At application startup

```
1. App starts
2. PendingEmailsProvider mounts
3. EventSource connects to /api/gmail/pending-stream
4. SSE immediately sends current count
5. Zustand store updated
6. UI displays count
```

### 2. Every 30 seconds

```
1. SSE sends current count
2. Zustand store updated
3. UI updates automatically (reactivity)
```

### 3. Every 2 minutes (cron)

```
1. Cron counts new Gmail emails
2. Storage in memory (no DB)
3. SSE retrieves this count on next cycle (30s)
4. Client receives update
```

### 4. When user clicks "Analyze"

```
1. Extract all emails since lastGmailSync
2. Analyze all extracted emails
3. Create actions
4. router.refresh() to update UI
5. SSE count updates on next cycle
```

---

## System Advantages

### Performance

- **No polling**: SSE push instead of repeated pull
- **1 HTTP connection** instead of multiple requests
- **Bandwidth savings**: stream vs polling

### User Experience

- **Instant updates**: max 30 seconds latency
- **No reload**: reactive update
- **Accurate counter**: always up to date

### Scalability

- **Light on server**: no repeated requests
- **Automatic reconnection**: native browser handling
- **Shared state**: Zustand avoids duplications

---

## Debugging

### View SSE events in DevTools

1. Open DevTools
2. Network tab
3. Filter "EventStream"
4. See `/api/gmail/pending-stream`
5. Observe messages in "EventStream" tab

### Server-side logs

```bash
[SSE] Stream cancelled, interval cleared
[SSE] Error fetching pending count: ...
```

### Client-side logs

```javascript
console.log("[SSE] Error parsing event data:", error);
console.error("[SSE] EventSource error:", error);
```

---

## Comparison with Polling

### Old System (Polling)

```typescript
// ❌ HTTP request every 30 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch("/api/gmail/pending-count");
    const data = await response.json();
    setCount(data.count);
  }, 30 * 1000);

  return () => clearInterval(interval);
}, []);
```

**Disadvantages**:
- New HTTP connection every 30s
- Significant network overhead
- 0-30 seconds latency
- Harder to scale

### New System (SSE + Zustand)

```typescript
// ✅ Persistent connection + global store
const count = usePendingEmailsStore((state) => state.count);
```

**Advantages**:
- 1 maintained HTTP connection
- Instant push updates
- Max 30 seconds latency
- Much more scalable

---

## References

- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)

---

Last updated: January 9, 2026
