# User Exclusions

Guide to the exclusion system that lets users filter out specific senders, domains, or subjects from action analysis.

---

## Overview

Exclusions permanently silence certain emails during analysis. They apply **at action extraction time**, not at sync time.

```
Email received → Sync (metadata stored)
                       ↓
                 Analyze (body read temporarily)
                       ↓
          shouldExcludeByUserRules() ?
               ↓ yes          ↓ no
          No action       Regex extraction
          created         → Actions saved
```

---

## Exclusion types

| Type | Scope | Example |
|------|-------|---------|
| `SENDER` | Exact email address | `spam@example.com` |
| `DOMAIN` | All emails from a domain | `newsletter.com` → blocks `*@newsletter.com` |
| `SUBJECT` | Subject containing a value | `promotional offer` |

---

## Data model

```prisma
enum ExclusionType {
  SENDER
  DOMAIN
  SUBJECT
}

model UserExclusion {
  id        String        @id @default(cuid())
  userId    String
  type      ExclusionType
  value     String                          // normalized to lowercase
  label     String?                         // optional human-readable label
  createdAt DateTime      @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, value])           // no duplicates
  @@index([userId])
  @@map("user_exclusions")
}
```

---

## API

### `GET /api/exclusions`

Returns all exclusions for the authenticated user, ordered by creation date descending.

**Response:**
```json
{
  "exclusions": [
    {
      "id": "clx...",
      "type": "SENDER",
      "value": "spam@example.com",
      "label": "spam@example.com",
      "createdAt": "2026-03-15T10:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/exclusions`

Creates a new exclusion. Automatically deletes matching existing actions.

**Body:**
```json
{
  "type": "SENDER" | "DOMAIN" | "SUBJECT",
  "value": "spam@example.com",
  "label": "spam@example.com"   // optional
}
```

**Behavior:**
- `value` is normalized to lowercase
- `SENDER`: deletes actions where `emailFrom = value`
- `DOMAIN`: deletes actions where `emailFrom` ends with `@value`
- `SUBJECT`: no existing action deletion

**Response codes:**
| Code | Case |
|------|------|
| `201` | Exclusion created |
| `400` | Invalid type or missing value |
| `401` | Not authenticated |
| `409` | Exclusion already exists |
| `500` | Server error |

**Response (201):**
```json
{
  "exclusion": { "id": "clx...", "type": "SENDER", ... },
  "deletedActions": 3
}
```

---

### `DELETE /api/exclusions/[id]`

Deletes an exclusion. The exclusion must belong to the authenticated user.

**Response codes:**
| Code | Case |
|------|------|
| `200` | `{ "success": true }` |
| `401` | Not authenticated |
| `404` | Exclusion not found or belongs to another user |
| `500` | Server error |

---

## Exclusion logic

**File:** `lib/actions/extract-actions-regex.ts`

```typescript
export type UserExclusionData = {
  type: "SENDER" | "DOMAIN" | "SUBJECT";
  value: string;
};

function shouldExcludeByUserRules(
  context: EmailContext,
  exclusions: UserExclusionData[]
): boolean {
  // Extract raw address from "Name <email@domain.com>"
  const angleMatch = context.from.match(/<([^>]+)>/);
  const emailLower = (angleMatch ? angleMatch[1] : context.from).trim().toLowerCase();
  const subjectLower = context.subject?.toLowerCase() ?? "";

  for (const exclusion of exclusions) {
    const val = exclusion.value.toLowerCase();
    if (exclusion.type === "SENDER" && emailLower === val) return true;
    if (exclusion.type === "DOMAIN" && emailLower.endsWith(`@${val}`)) return true;
    if (exclusion.type === "SUBJECT" && subjectLower.includes(val)) return true;
  }
  return false;
}
```

**Key points:**
- Supports both `"Name <email@domain.com>"` and `"email@domain.com"` formats — address is extracted before comparison
- Case-insensitive
- Domain matching uses `endsWith(@domain)` to avoid false positives (e.g., `myexample.com` does not match `example.com`)
- User exclusions are checked **before** system exclusions

---

## Integration in jobs

### Daily sync (`lib/cron/daily-sync-job.ts`)

Exclusions are loaded **once per mailbox** (not per email) to minimize DB queries:

```typescript
const userExclusions = await prisma.userExclusion.findMany({
  where: { userId: credential.userId },
  select: { type: true, value: true },
});

const result = await syncAndAnalyzeMailbox(
  provider, userId, mailboxLabel, userExclusions
);
```

### Manual analyze (`app/api/email/analyze/route.ts`)

Exclusions are loaded **once per analysis session**:

```typescript
const userExclusions = await prisma.userExclusion.findMany({
  where: { userId: session.user.id },
  select: { type: true, value: true },
});
```

---

## User interface

### Adding from an action card

The `···` menu on each card (default variant) offers:
- **Exclude this sender** → creates a `SENDER` exclusion with the extracted address
- **Exclude this domain** → creates a `DOMAIN` exclusion with the extracted domain

> **Limitation:** The email subject is not stored on the `Action` model. Subject exclusion is therefore **not available** from action cards.

The toast shows the number of deleted actions and the list refreshes automatically.

### Managing in settings

`/settings` → **Exclusions** section:
- Add form at the top: type selector (Sender / Domain / Subject) + value input + `+` button (or Enter)
- Lists all exclusions with their type (colored badge) and value
- Delete button with confirmation via `AlertDialog`

The settings form allows adding **any exclusion type** manually, including subject keywords.

---

## Tests

```bash
# Unit tests (exclusion logic + API)
pnpm test tests/lib/exclusions.test.ts
pnpm test tests/api/exclusions.test.ts
```

Test coverage:
- Exact SENDER exclusion (simple addresses and `Name <email>` format)
- DOMAIN exclusion (`@domain` matching, no false positives)
- SUBJECT exclusion (contains, case-insensitive, null subject)
- Multiple exclusions
- API GET / POST / DELETE (auth, validation, error codes, `userId` scoping)
- Lowercase normalization for all three types (SENDER, DOMAIN, SUBJECT)
- Validation: empty or whitespace-only value → 400

---

**Last updated:** March 16, 2026
