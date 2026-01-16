# Security & GDPR - Gmail Integration

Complete documentation on security and GDPR compliance for Gmail integration in Inbox Actions.

---

## GDPR Compliance

### 1. Legal Basis

**Article 6(1)(a) GDPR - Consent**

The user gives explicit consent during OAuth authentication:

```
┌─────────────────────────────────────────┐
│ Inbox Actions wants to access:          │
│ ☑ Read your Gmail emails                │
│ ☑ See your email address                │
│                                         │
│ [Cancel]  [Allow] ← Consent             │
└─────────────────────────────────────────┘
```

✅ **Freely given consent** - User can refuse
✅ **Specific consent** - Precise scope (gmail.readonly)
✅ **Informed consent** - User sees exactly what's requested
✅ **Unambiguous consent** - Positive action required (click "Allow")

### 2. Data Minimization (Article 5(1)(c))

**Principle:** Collect only strictly necessary data.

| Data | Stored? | Justification |
|------|---------|---------------|
| Full email body | ❌ NO | Not necessary |
| Attachments | ❌ NO | Not necessary |
| Full metadata | ❌ NO | Not necessary |
| **Gmail Message ID** | ✅ YES | Identify the email |
| **Gmail Thread ID** | ✅ YES | Group conversations |
| **Sender (From)** | ✅ YES | Know who sent |
| **Subject** | ✅ YES | Action context |
| **Snippet (200 chars max)** | ✅ YES | Short extract for context |
| **Received date** | ✅ YES | Chronology |
| **Gmail Labels** | ✅ YES | Filtering (INBOX, etc.) |

**Implemented code:**

```typescript
// ✅ GDPR COMPLIANT
const messageData = await gmail.users.messages.get({
  userId: "me",
  id: messageId,
  format: "metadata", // ← Metadata ONLY
  metadataHeaders: ["From", "Subject", "Date"], // ← Minimal headers
});

// ❌ NON COMPLIANT
const messageData = await gmail.users.messages.get({
  userId: "me",
  id: messageId,
  format: "full", // ← Full body
});
```

### 3. Storage Limitation (Article 5(1)(e))

**Principle:** Don't retain data longer than necessary.

**Implemented:**

```typescript
// EmailMetadata model
model EmailMetadata {
  processed Boolean @default(false)
  createdAt DateTime @default(now())
  // ...
}
```

**Recommended retention strategy:**

1. **Unprocessed emails**: Retained until processing
2. **Processed emails**: Retained 30 days max
3. **Automatic deletion**: Daily cron job

```typescript
// Example automatic cleanup
async function cleanOldEmails() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await prisma.emailMetadata.deleteMany({
    where: {
      processed: true,
      createdAt: { lt: thirtyDaysAgo },
    },
  });
}
```

### 4. Right of Access (Article 15)

**Implemented:**

User can view all their data:

```typescript
// GET /api/user/data
export async function GET() {
  const session = await auth();

  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      emailMetadata: true,
      actions: true,
    },
  });

  return NextResponse.json(userData);
}
```

### 5. Right to Erasure (Article 17)

**Implemented:**

```typescript
// POST /api/gmail/disconnect
// Deletes ALL user's Gmail data

await prisma.emailMetadata.deleteMany({
  where: { userId: session.user.id },
});

await prisma.account.delete({
  where: { id: googleAccount.id },
});
```

**Cascade deletion:**

```prisma
model EmailMetadata {
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

If user deletes their account → All their data is automatically deleted.

### 6. Right to Data Portability (Article 20)

**Implemented:**

```typescript
// GET /api/user/export
export async function GET() {
  const session = await auth();

  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      emailMetadata: true,
      actions: true,
    },
  });

  // Export as JSON
  return new Response(JSON.stringify(userData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=my-data.json",
    },
  });
}
```

### 7. Right to Withdraw Consent (Article 7(3))

**Implemented:**

User can revoke consent at any time:

1. **Via the application**: "Disconnect Gmail" button
2. **Via Google**: https://myaccount.google.com/permissions

```typescript
// Token revocation on Google side
const oauth2Client = new google.auth.OAuth2();
oauth2Client.setCredentials({ access_token });
await oauth2Client.revokeCredentials();
```

---

## Security

### 1. Secure Token Storage

**Problem:** OAuth tokens give access to user's emails.

**Solution:**

```prisma
model Account {
  access_token  String? @db.Text  // ← Stored in database
  refresh_token String? @db.Text  // ← Stored in database
}
```

**Security measures:**

1. ✅ **Database encryption** at rest (PostgreSQL encryption)
2. ✅ **Restricted access** - Tokens accessible only by userId
3. ✅ **HTTPS only** - No plaintext transmission
4. ✅ **Automatic rotation** - Access token renewed every hour
5. ✅ **No logs** - Tokens are NEVER logged

```typescript
// ✅ CORRECT
console.log("User authenticated");

// ❌ INCORRECT
console.log("Access token:", accessToken); // ← NEVER
```

### 2. Data Isolation

**Principle:** A user can only access THEIR data.

```typescript
// ✅ SECURE
const emails = await prisma.emailMetadata.findMany({
  where: {
    userId: session.user.id, // ← MANDATORY filter
  },
});

// ❌ VULNERABLE
const emails = await prisma.emailMetadata.findMany(); // ← No filter!
```

**Implemented everywhere:**

```typescript
// lib/gmail/gmail-service.ts
export class GmailService {
  private userId: string;

  async fetchNewEmails() {
    await prisma.emailMetadata.create({
      data: {
        userId: this.userId, // ← Always associated with user
        // ...
      },
    });
  }
}
```

### 3. Input Validation

```typescript
// Parameter validation
const maxResults = parseInt(searchParams.get("maxResults") || "100");

if (maxResults < 1 || maxResults > 500) {
  return NextResponse.json(
    { error: "maxResults must be between 1 and 500" },
    { status: 400 }
  );
}
```

### 4. Rate Limiting

**Problem:** Gmail API abuse (quotas, costs).

**Recommended solution:**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
});

export async function GET() {
  const session = await auth();
  const { success } = await ratelimit.limit(session.user.id);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  // ...
}
```

### 5. Secure Error Handling

```typescript
// ✅ CORRECT - Generic message
catch (error) {
  console.error("Error:", error); // ← Internal log
  return NextResponse.json(
    { error: "An error occurred" }, // ← Generic message
    { status: 500 }
  );
}

// ❌ INCORRECT - Information leak
catch (error) {
  return NextResponse.json(
    { error: error.message }, // ← May contain sensitive info
    { status: 500 }
  );
}
```

### 6. Attack Protection

#### CSRF (Cross-Site Request Forgery)

✅ **Protected by NextAuth** - Automatic CSRF token

#### XSS (Cross-Site Scripting)

```typescript
// ✅ CORRECT - React escapes automatically
<div>{email.subject}</div>

// ❌ INCORRECT
<div dangerouslySetInnerHTML={{ __html: email.subject }} />
```

#### SQL Injection

✅ **Protected by Prisma** - Automatic parameterized queries

```typescript
// ✅ SECURE
await prisma.emailMetadata.findMany({
  where: { userId: userId }, // ← Parameterized
});

// ❌ VULNERABLE (but Prisma doesn't allow this)
await prisma.$executeRaw`SELECT * FROM emails WHERE userId = ${userId}`; // ← Dangerous
```

---

## Monitoring and Audit

### 1. Security Logs

```typescript
// Log important events
async function logSecurityEvent(
  userId: string,
  event: string,
  metadata?: any
) {
  await prisma.securityLog.create({
    data: {
      userId,
      event,
      metadata,
      timestamp: new Date(),
      ipAddress: req.headers.get("x-forwarded-for"),
    },
  });
}

// Examples of events to log
await logSecurityEvent(userId, "GMAIL_CONNECTED");
await logSecurityEvent(userId, "GMAIL_DISCONNECTED");
await logSecurityEvent(userId, "GMAIL_SYNC_STARTED");
await logSecurityEvent(userId, "ACCESS_TOKEN_EXPIRED");
```

### 2. Security Alerts

```typescript
// Alert on suspicious activity
async function checkSuspiciousActivity(userId: string) {
  const recentSyncs = await prisma.emailMetadata.count({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000), // Last minute
      },
    },
  });

  if (recentSyncs > 1000) {
    // Too many syncs in 1 minute
    await sendSecurityAlert(userId, "SUSPICIOUS_SYNC_ACTIVITY");
  }
}
```

---

## Security Checklist

Before going to production:

### Configuration

- [ ] HTTPS enabled on all endpoints
- [ ] NEXTAUTH_SECRET securely generated (32+ characters)
- [ ] Environment variables never committed
- [ ] Database with encryption at rest
- [ ] Automatic database backups

### Code

- [ ] All endpoints verify authentication
- [ ] Data isolation by userId everywhere
- [ ] No logs of tokens or sensitive data
- [ ] Input validation on all endpoints
- [ ] Generic error messages (no info leaks)
- [ ] Rate limiting implemented

### OAuth

- [ ] Minimal scope (gmail.readonly only)
- [ ] access_type: "offline" for refresh token
- [ ] prompt: "consent" to force consent
- [ ] Callback URLs in HTTPS only
- [ ] Token revocation implemented

### GDPR

- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Right of access implemented (data export)
- [ ] Right to erasure implemented (deletion)
- [ ] Right to withdraw consent implemented (disconnection)
- [ ] Data minimization (no full body)
- [ ] Storage limitation (auto deletion)
- [ ] Explicit consent (OAuth screen)

### Monitoring

- [ ] Security logs configured
- [ ] Alerts on suspicious activity
- [ ] Gmail API quota monitoring
- [ ] Token error monitoring

---

## Privacy Policy (example)

**Gmail section to include:**

```markdown
## Access to Your Gmail Account

### Data Collected

When you connect your Gmail account, we collect:

- ✅ Gmail message identifiers (IDs)
- ✅ Email sender
- ✅ Email subject
- ✅ Short excerpt (snippet, max 200 characters)
- ✅ Received date
- ✅ Gmail labels (INBOX, etc.)

### Data NOT Collected

We NEVER collect:

- ❌ Full body of your emails
- ❌ Attachments
- ❌ Gmail contacts
- ❌ Gmail calendar

### Data Usage

Your Gmail data is used ONLY to:

1. Extract actions to perform from your emails
2. Display the context of these actions

### Storage

- Metadata is stored securely
- Processed emails are automatically deleted after 30 days
- You can delete all your data at any time

### Revocation

You can revoke access to your Gmail at any time via:

1. Application settings
2. Your Google account: https://myaccount.google.com/permissions

### Security

- HTTPS connection required
- OAuth tokens stored securely
- Read-only access only (gmail.readonly)
```

---

## GDPR & Security Justifications

### Why NOT Store the Full Body?

1. **GDPR - Minimization (Article 5(1)(c))**
   - Full body potentially contains sensitive data
   - Only necessary extracts (actions) are required
   - Reduced risk in case of data breach

2. **GDPR - Storage Limitation (Article 5(1)(e))**
   - The more data stored, the longer it must be retained
   - Minimal metadata can be deleted quickly

3. **Security - Attack Surface Reduction**
   - Less data stored = less risk
   - Easier compliance

4. **Performance**
   - Less data = faster database
   - Lower storage costs

### Why Use gmail.readonly?

1. **GDPR - Access Minimization**
   - Read-only access is sufficient
   - Impossible to modify/delete user's emails

2. **Security - Principle of Least Privilege**
   - Damage limitation in case of compromise
   - Increased user trust

3. **Google Compliance**
   - Simpler verification process
   - Less scrutiny from Google

---

## Summary

Gmail integration in Inbox Actions is:

✅ **GDPR Compliant**
- Explicit consent
- Data minimization
- Right of access, erasure, portability
- Storage limitation

✅ **Secure**
- Tokens stored securely
- Data isolation
- HTTPS only
- No sensitive logs

✅ **Transparent**
- User sees exactly what's requested
- Can revoke at any time
- Total control of their data

The user ALWAYS remains the owner and in control of their data.
