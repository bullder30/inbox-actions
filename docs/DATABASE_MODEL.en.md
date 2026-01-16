# Prisma Data Model - Inbox Actions

Complete documentation of the data model for the "Inbox -> Actions" system.

---

## Action Model

The `Action` model represents an action extracted from a user's email.

### Prisma Code

```prisma
enum ActionType {
  SEND
  CALL
  FOLLOW_UP
  PAY
  VALIDATE
}

enum ActionStatus {
  TODO
  DONE
  IGNORED
}

model Action {
  id               String       @id @default(cuid())
  userId           String
  title            String
  type             ActionType
  status           ActionStatus @default(TODO)
  dueDate          DateTime?
  sourceSentence   String       @db.Text
  emailFrom        String
  emailReceivedAt  DateTime
  gmailMessageId   String?      @map(name: "gmail_message_id")
  createdAt        DateTime     @default(now()) @map(name: "created_at")
  updatedAt        DateTime     @default(now()) @updatedAt @map(name: "updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([dueDate])
  @@map(name: "actions")
}
```

---

## Field Descriptions

| Field            | Type           | Description                                                              | Required |
| ---------------- | -------------- | ------------------------------------------------------------------------ | -------- |
| `id`             | String (cuid)  | Unique action identifier                                                 | Yes      |
| `userId`         | String         | Owner user identifier                                                    | Yes      |
| `title`          | String         | Short action title (e.g., "Call client ABC")                            | Yes      |
| `type`           | ActionType     | Action type: SEND, CALL, FOLLOW_UP, PAY, VALIDATE                       | Yes      |
| `status`         | ActionStatus   | Status: TODO (default), DONE, IGNORED                                    | Yes      |
| `dueDate`        | DateTime       | Deadline for completing the action (optional)                            | No       |
| `sourceSentence` | Text           | Sentence extracted from email that generated the action                  | Yes      |
| `emailFrom`      | String         | Sender email address                                                     | Yes      |
| `emailReceivedAt`| DateTime       | Email received date/time                                                 | Yes      |
| `gmailMessageId` | String         | Gmail message ID to create direct link to email                          | No       |
| `createdAt`      | DateTime       | Action creation date in the system                                       | Yes      |
| `updatedAt`      | DateTime       | Last modification date (auto-updated)                                    | Yes      |

---

## Relationships with User Model

### Relationship Schema

```
User (1) ──────< (N) Action
```

**A user can have multiple actions** (1:N relationship)

### User Side

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  // ... other fields

  actions  Action[]  // <- Relation to actions

  @@map(name: "users")
}
```

### Action Side

```prisma
model Action {
  id      String @id @default(cuid())
  userId  String
  // ... other fields

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ^ Relation to user with cascade delete

  @@map(name: "actions")
}
```

### Deletion Behavior

- **`onDelete: Cascade`**: If a user is deleted, all their actions are automatically deleted
- This ensures there are never orphan actions in the database

---

## Performance Indexes

The `Action` model has 4 indexes to optimize common queries:

```prisma
@@index([userId])    // Search all actions for a user
@@index([status])    // Filter by status (TODO, DONE, IGNORED)
@@index([type])      // Filter by type (SEND, CALL, etc.)
@@index([dueDate])   // Sort by due date
```

### Optimized Query Examples

```typescript
// Get all TODO actions for a user
const todoActions = await prisma.action.findMany({
  where: {
    userId: "user123",
    status: "TODO"
  }
});

// Get actions due in the next 7 days
const upcomingActions = await prisma.action.findMany({
  where: {
    userId: "user123",
    status: "TODO",
    dueDate: {
      gte: new Date(),
      lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { dueDate: 'asc' }
});

// Get all completed "CALL" actions
const completedCalls = await prisma.action.findMany({
  where: {
    userId: "user123",
    type: "CALL",
    status: "DONE"
  }
});
```

---

## Action Types (ActionType)

| Type         | Description                                     | Example                                |
| ------------ | ----------------------------------------------- | -------------------------------------- |
| `SEND`       | Send a document, email, file                    | "Send Q4 report"                       |
| `CALL`       | Make a phone call                               | "Call client ABC"                      |
| `FOLLOW_UP`  | Follow up, chase                                | "Follow up with supplier XYZ"          |
| `PAY`        | Make a payment                                  | "Pay invoice #12345"                   |
| `VALIDATE`   | Validate, approve, give feedback                | "Validate the design"                  |

---

## Action Statuses (ActionStatus)

| Status    | Description                                        | Suggested Color |
| --------- | -------------------------------------------------- | --------------- |
| `TODO`    | Action to do (default status)                      | Blue            |
| `DONE`    | Action completed                                   | Green           |
| `IGNORED` | Action ignored/not relevant                        | Gray            |

---

## Migration and Deployment

### Apply schema to database

```bash
# In development (without shadow database)
npx prisma db push

# In production (with migrations)
npx prisma migrate deploy
```

### Generate Prisma client

```bash
npx prisma generate
```

---

## Seed (test data)

A seed file has been created to initialize the database with test data.

### Run the seed

```bash
pnpm db:seed
```

### Seed Contents

The seed automatically creates:
- 1 test user: `test@inbox-actions.com`
- 6 test actions with different types and statuses:
  - 1 x SEND (TODO)
  - 1 x CALL (TODO)
  - 1 x FOLLOW_UP (DONE)
  - 1 x PAY (TODO)
  - 1 x VALIDATE (TODO)
  - 1 x SEND (IGNORED)

### Seed Code

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: "test@inbox-actions.com" },
    update: {},
    create: {
      email: "test@inbox-actions.com",
      name: "Test User",
      role: "USER",
    },
  });

  // Create test actions
  await prisma.action.create({
    data: {
      userId: testUser.id,
      title: "Send Q4 report",
      type: "SEND",
      status: "TODO",
      sourceSentence: "Could you send me the Q4 report...",
      emailFrom: "boss@company.com",
      emailReceivedAt: new Date("2024-01-15T09:30:00Z"),
      dueDate: new Date("2024-01-19T17:00:00Z"),
    },
  });

  // ... other actions
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

---

## Check Database Data

### Connect to PostgreSQL

```bash
psql -U inbox_admin -d inbox_actions
```

### Useful SQL Queries

```sql
-- View all users
SELECT * FROM users;

-- View all actions
SELECT * FROM actions;

-- Actions grouped by status
SELECT status, COUNT(*) as count
FROM actions
GROUP BY status;

-- Actions grouped by type
SELECT type, COUNT(*) as count
FROM actions
GROUP BY type;

-- Actions with their users
SELECT
  a.title,
  a.type,
  a.status,
  u.name as user_name,
  u.email as user_email
FROM actions a
JOIN users u ON a.user_id = u.id;

-- TODO actions with upcoming due dates
SELECT
  title,
  type,
  due_date,
  email_from
FROM actions
WHERE status = 'TODO'
  AND due_date IS NOT NULL
  AND due_date <= NOW() + INTERVAL '7 days'
ORDER BY due_date ASC;
```

---

## Database Diagram

```
┌─────────────────────┐
│       User          │
├─────────────────────┤
│ id (PK)             │
│ email               │
│ name                │
│ role                │
│ createdAt           │
│ updatedAt           │
└──────────┬──────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────┐
│      Action         │
├─────────────────────┤
│ id (PK)             │
│ userId (FK)         │◄─── References User.id
│ title               │
│ type                │
│ status              │
│ dueDate             │
│ sourceSentence      │
│ emailFrom           │
│ emailReceivedAt     │
│ gmailMessageId      │
│ createdAt           │
│ updatedAt           │
└─────────────────────┘
```

---

## Next Steps

Now that the data model is in place, you can:

1. Create API routes to manipulate actions
2. Create React components to display actions
3. Implement an email parsing system
4. Add filters and searches
5. Create a dashboard with statistics

---

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Relations Guide](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
