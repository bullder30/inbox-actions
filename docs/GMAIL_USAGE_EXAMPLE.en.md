# Gmail API Usage Examples

Complete guide with code examples for using the Gmail service in Inbox Actions.

---

## Prerequisites

Before using the Gmail API, make sure:

1. ✅ Google Cloud OAuth is configured (see [GMAIL_OAUTH_SETUP.en.md](./GMAIL_OAUTH_SETUP.en.md))
2. ✅ Environment variables are defined
3. ✅ User has logged in with Google

---

## Fetching Emails

### 1. Sync Emails from Gmail

```typescript
// In a Server Component or API Route
import { createGmailService } from "@/lib/gmail/gmail-service";

async function syncUserEmails(userId: string) {
  // Create Gmail service
  const gmailService = await createGmailService(userId);

  if (!gmailService) {
    throw new Error("Gmail not connected");
  }

  // Fetch new emails
  const emails = await gmailService.fetchNewEmails({
    maxResults: 50,
    labelIds: ["INBOX"],
  });

  console.log(`Synced ${emails.length} emails`);

  return emails;
}
```

### 2. Filter Emails by Query

```typescript
// Fetch only unread emails
const unreadEmails = await gmailService.fetchNewEmails({
  query: "is:unread",
  maxResults: 20,
});

// Fetch emails from a specific sender
const emailsFromBoss = await gmailService.fetchNewEmails({
  query: "from:boss@company.com",
});

// Fetch emails with a specific date
const recentEmails = await gmailService.fetchNewEmails({
  query: "after:2026/01/01",
});

// Combine multiple criteria
const urgentEmails = await gmailService.fetchNewEmails({
  query: "is:unread is:important",
});
```

### 3. Fetch a Specific Email

```typescript
const emailMetadata = await gmailService.getEmailById("gmail-message-id-123");

if (emailMetadata) {
  console.log("From:", emailMetadata.from);
  console.log("Subject:", emailMetadata.subject);
  console.log("Snippet:", emailMetadata.snippet);
}
```

---

## Fetching Unprocessed Emails

```typescript
// Fetch all emails that haven't been analyzed yet
const unprocessedEmails = await gmailService.getUnprocessedEmails();

for (const email of unprocessedEmails) {
  // Process the email (e.g., extract actions with AI)
  await processEmail(email);

  // Mark as processed
  await gmailService.markEmailAsProcessed(email.gmailMessageId);
}
```

---

## AI Analysis (Temporary Use Only)

**IMPORTANT:** NEVER store the full body of an email in the database (GDPR).

```typescript
// ✅ CORRECT: Temporary retrieval for AI analysis
async function analyzeEmailForActions(gmailMessageId: string, userId: string) {
  const gmailService = await createGmailService(userId);

  if (!gmailService) {
    throw new Error("Gmail not connected");
  }

  // Fetch body TEMPORARILY (in memory only)
  const emailBody = await gmailService.getEmailBodyForAnalysis(gmailMessageId);

  if (!emailBody) {
    return null;
  }

  // Analyze with AI (OpenAI, Anthropic, etc.)
  const actions = await extractActionsWithAI(emailBody);

  // ⚠️ DO NOT store emailBody in database
  // Store ONLY the extracted actions

  for (const action of actions) {
    await prisma.action.create({
      data: {
        userId,
        title: action.title,
        type: action.type,
        sourceSentence: action.sourceSentence, // Extract only
        emailFrom: action.emailFrom,
        emailReceivedAt: action.emailReceivedAt,
        dueDate: action.dueDate,
      },
    });
  }

  // Mark email as processed
  await gmailService.markEmailAsProcessed(gmailMessageId);

  return actions;
}

// ❌ INCORRECT: Never do this
async function badExample(gmailMessageId: string) {
  const emailBody = await gmailService.getEmailBodyForAnalysis(gmailMessageId);

  // ❌ FORBIDDEN: Storing full body
  await prisma.email.create({
    data: {
      body: emailBody, // ❌ GDPR VIOLATION
    },
  });
}
```

---

## Usage in an API Route

### GET /api/email/sync

```typescript
// app/api/email/sync/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailService = await createGmailService(session.user.id);

  if (!gmailService) {
    return NextResponse.json(
      { error: "Gmail not connected" },
      { status: 400 }
    );
  }

  const emails = await gmailService.fetchNewEmails({
    maxResults: 100,
  });

  return NextResponse.json({
    success: true,
    count: emails.length,
    emails,
  });
}
```

---

## Usage in a Server Component

```typescript
// app/(protected)/emails/page.tsx
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";

export default async function EmailsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <div>Please login</div>;
  }

  const gmailService = await createGmailService(session.user.id);

  if (!gmailService) {
    return (
      <div>
        <h1>Gmail not connected</h1>
        <a href="/api/auth/signin/google">Connect Gmail</a>
      </div>
    );
  }

  const unprocessedEmails = await gmailService.getUnprocessedEmails();

  return (
    <div>
      <h1>Unprocessed Emails ({unprocessedEmails.length})</h1>
      <ul>
        {unprocessedEmails.map((email) => (
          <li key={email.gmailMessageId}>
            <strong>{email.from}</strong>: {email.subject}
            <p>{email.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Complete Workflow

### Scenario: Automatic Email Synchronization

```typescript
// lib/jobs/sync-gmail.ts
import { prisma } from "@/lib/db";
import { createGmailService } from "@/lib/gmail/gmail-service";

/**
 * Gmail sync job for all users
 * To run periodically (e.g., every 5 minutes)
 */
export async function syncAllUsersGmail() {
  // Fetch all users with Gmail connected
  const users = await prisma.user.findMany({
    where: {
      accounts: {
        some: {
          provider: "google",
        },
      },
    },
    select: {
      id: true,
      email: true,
      lastGmailSync: true,
    },
  });

  console.log(`Syncing Gmail for ${users.length} users`);

  const results = [];

  for (const user of users) {
    try {
      const gmailService = await createGmailService(user.id);

      if (!gmailService) {
        console.warn(`Gmail not available for user ${user.id}`);
        continue;
      }

      // Sync new emails
      const emails = await gmailService.fetchNewEmails({
        maxResults: 50,
      });

      results.push({
        userId: user.id,
        success: true,
        emailCount: emails.length,
      });

      console.log(`✓ User ${user.email}: ${emails.length} new emails`);
    } catch (error) {
      console.error(`✗ Error syncing user ${user.id}:`, error);
      results.push({
        userId: user.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
```

### Scenario: Manual Email Processing

```typescript
// app/api/email/process/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGmailService } from "@/lib/gmail/gmail-service";
import { extractActionsWithAI } from "@/lib/ai/extract-actions";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gmailService = await createGmailService(session.user.id);

  if (!gmailService) {
    return NextResponse.json(
      { error: "Gmail not connected" },
      { status: 400 }
    );
  }

  // 1. Fetch unprocessed emails
  const unprocessedEmails = await gmailService.getUnprocessedEmails();

  const processedActions = [];

  // 2. Process each email
  for (const email of unprocessedEmails) {
    // Fetch body for analysis
    const body = await gmailService.getEmailBodyForAnalysis(
      email.gmailMessageId
    );

    if (!body) continue;

    // Extract actions with AI
    const actions = await extractActionsWithAI({
      body,
      from: email.from,
      subject: email.subject || "",
      receivedAt: email.receivedAt,
    });

    // Store actions in database
    for (const action of actions) {
      await prisma.action.create({
        data: {
          userId: session.user.id,
          title: action.title,
          type: action.type,
          sourceSentence: action.sourceSentence,
          emailFrom: email.from,
          emailReceivedAt: email.receivedAt,
          dueDate: action.dueDate,
        },
      });

      processedActions.push(action);
    }

    // Mark as processed
    await gmailService.markEmailAsProcessed(email.gmailMessageId);
  }

  return NextResponse.json({
    success: true,
    processedEmails: unprocessedEmails.length,
    extractedActions: processedActions.length,
  });
}
```

---

## Error Handling

```typescript
async function safeGmailSync(userId: string) {
  try {
    const gmailService = await createGmailService(userId);

    if (!gmailService) {
      return {
        success: false,
        error: "GMAIL_NOT_CONNECTED",
        message: "Please connect Gmail",
      };
    }

    const emails = await gmailService.fetchNewEmails();

    return {
      success: true,
      emailCount: emails.length,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Expired token
      if (error.message.includes("expired")) {
        return {
          success: false,
          error: "TOKEN_EXPIRED",
          message: "Please reconnect Gmail",
        };
      }

      // Quota exceeded
      if (error.message.includes("quota")) {
        return {
          success: false,
          error: "QUOTA_EXCEEDED",
          message: "Gmail API quota exceeded. Please try again later.",
        };
      }
    }

    // Generic error
    return {
      success: false,
      error: "UNKNOWN_ERROR",
      message: "An error occurred while syncing Gmail",
    };
  }
}
```

---

## Statistics and Monitoring

```typescript
// lib/stats/gmail-stats.ts
import { prisma } from "@/lib/db";

export async function getGmailStats(userId: string) {
  const [totalEmails, unprocessedEmails, lastSync, emailsLast24h] =
    await Promise.all([
      // Total stored emails
      prisma.emailMetadata.count({
        where: { userId },
      }),

      // Unprocessed emails
      prisma.emailMetadata.count({
        where: {
          userId,
          processed: false,
        },
      }),

      // Last sync
      prisma.user.findUnique({
        where: { id: userId },
        select: { lastGmailSync: true },
      }),

      // Emails received in last 24h
      prisma.emailMetadata.count({
        where: {
          userId,
          receivedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    totalEmails,
    unprocessedEmails,
    processedEmails: totalEmails - unprocessedEmails,
    lastSync: lastSync?.lastGmailSync,
    emailsLast24h,
  };
}
```

---

## Best Practices

### 1. Never Store the Full Body

```typescript
// ✅ CORRECT
const snippet = email.snippet; // Max 200 characters
const sourceSentence = "Could you send me the report?"; // Extract

// ❌ INCORRECT
const fullBody = await getEmailBody(); // Don't store in database
```

### 2. Handle Expired Tokens

```typescript
const gmailService = await createGmailService(userId);

if (!gmailService) {
  // Redirect to reconnection
  return redirect("/settings/gmail?reconnect=true");
}
```

### 3. Limit Requests

```typescript
// Avoid too many simultaneous requests
const emails = await gmailService.fetchNewEmails({
  maxResults: 100, // No more than 100 per call
});

// Use rate limiting if necessary
await sleep(1000); // 1 second between requests
```

### 4. Clean Up Old Data

```typescript
// Delete metadata older than 30 days (optional)
await prisma.emailMetadata.deleteMany({
  where: {
    userId,
    receivedAt: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    processed: true, // Only already processed emails
  },
});
```

---

## Summary

The Gmail service allows you to:

✅ **Fetch** Gmail emails in read-only mode
✅ **Store** only minimal metadata (GDPR)
✅ **Analyze** body temporarily for action extraction
✅ **Mark** emails as processed
✅ **Handle** disconnection and data deletion

**IMPORTANT Reminder:** NEVER store the full body of an email in the database.
