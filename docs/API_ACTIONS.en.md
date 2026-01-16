# Actions API - Documentation

Complete API for managing actions extracted from emails in Inbox Actions.

---

## Security

### Required Authentication

**All endpoints require authentication via NextAuth.**

- Each request verifies the session with `await auth()`
- If not authenticated: `401 Unauthorized`
- Actions are **isolated by user**: a user can only access THEIR actions

### User Data Protection

**Strict isolation by userId**:
```typescript
// ✅ GOOD - Filter by userId
const actions = await prisma.action.findMany({
  where: { userId: session.user.id }
});

// ❌ BAD - Exposes all actions
const actions = await prisma.action.findMany();
```

**Ownership verification before modification**:
```typescript
// Verify the action belongs to the user
if (action.userId !== session.user.id) {
  return NextResponse.json(
    { error: "Unauthorized access" },
    { status: 403 }
  );
}
```

### HTTP Status Codes

| Code | Meaning                              |
|------|--------------------------------------|
| 200  | Success                              |
| 201  | Resource created successfully        |
| 400  | Invalid request (validation failed)  |
| 401  | Not authenticated                    |
| 403  | Unauthorized access (not your action)|
| 404  | Resource not found                   |
| 500  | Server error                         |

---

## Endpoints

### 1. GET /api/actions

**Retrieves the list of actions for the connected user**

#### Query Parameters (optional)

| Parameter | Type         | Description                                    |
|-----------|--------------|------------------------------------------------|
| `status`  | ActionStatus | Filter by status (TODO, DONE, IGNORED)         |
| `type`    | ActionType   | Filter by type (SEND, CALL, FOLLOW_UP, etc.)   |

#### Successful Response (200)

```json
{
  "actions": [
    {
      "id": "clx1234567890",
      "userId": "user123",
      "title": "Call client ABC",
      "type": "CALL",
      "status": "TODO",
      "dueDate": "2024-01-20T16:00:00.000Z",
      "sourceSentence": "We should call client ABC to follow up.",
      "emailFrom": "sales@company.com",
      "emailReceivedAt": "2024-01-16T14:20:00.000Z",
      "createdAt": "2024-01-16T14:25:00.000Z",
      "updatedAt": "2024-01-16T14:25:00.000Z",
      "user": {
        "id": "user123",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "count": 1
}
```

#### Request Examples

**All actions:**
```bash
curl -X GET http://localhost:3000/api/actions \
  -H "Cookie: next-auth.session-token=..."
```

**TODO actions only:**
```bash
curl -X GET "http://localhost:3000/api/actions?status=TODO" \
  -H "Cookie: next-auth.session-token=..."
```

**CALL type actions:**
```bash
curl -X GET "http://localhost:3000/api/actions?type=CALL" \
  -H "Cookie: next-auth.session-token=..."
```

**Combined filters:**
```bash
curl -X GET "http://localhost:3000/api/actions?status=TODO&type=PAY" \
  -H "Cookie: next-auth.session-token=..."
```

#### With fetch (Frontend)

```typescript
// All actions
const response = await fetch('/api/actions');
const { actions, count } = await response.json();

// TODO actions only
const response = await fetch('/api/actions?status=TODO');
const { actions } = await response.json();
```

---

### 2. POST /api/actions

**Creates a new action**

#### Body (JSON)

| Field             | Type         | Required | Description                              |
|-------------------|--------------|----------|------------------------------------------|
| `title`           | string       | ✅       | Action title                             |
| `type`            | ActionType   | ✅       | SEND, CALL, FOLLOW_UP, PAY, VALIDATE     |
| `sourceSentence`  | string       | ✅       | Sentence extracted from email            |
| `emailFrom`       | string       | ✅       | Sender's email                           |
| `emailReceivedAt` | Date (ISO)   | ✅       | Email received date                      |
| `dueDate`         | Date (ISO)   | ❌       | Due date (optional)                      |
| `status`          | ActionStatus | ❌       | TODO (default), DONE, IGNORED            |

#### Successful Response (201)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Send Q4 report",
    "type": "SEND",
    "status": "TODO",
    "dueDate": "2024-01-25T17:00:00.000Z",
    "sourceSentence": "Could you send me the Q4 report?",
    "emailFrom": "boss@company.com",
    "emailReceivedAt": "2024-01-15T09:30:00.000Z",
    "createdAt": "2024-01-16T10:00:00.000Z",
    "updatedAt": "2024-01-16T10:00:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action created successfully"
}
```

#### Validation Errors (400)

```json
{ "error": "Title is required" }
{ "error": "Invalid action type (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)" }
{ "error": "Source sentence is required" }
{ "error": "Sender email is required" }
{ "error": "Email received date is required" }
{ "error": "Invalid status (TODO, DONE, IGNORED)" }
```

#### Request Example

```bash
curl -X POST http://localhost:3000/api/actions \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "title": "Pay invoice #12345",
    "type": "PAY",
    "sourceSentence": "Please proceed with payment of invoice #12345.",
    "emailFrom": "invoices@supplier.com",
    "emailReceivedAt": "2024-01-17T08:45:00.000Z",
    "dueDate": "2024-01-25T23:59:00.000Z"
  }'
```

#### With fetch (Frontend)

```typescript
const newAction = {
  title: "Call client ABC",
  type: "CALL",
  sourceSentence: "We should call client ABC.",
  emailFrom: "sales@company.com",
  emailReceivedAt: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const response = await fetch('/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newAction),
});

const { action, message } = await response.json();
```

---

### 3. PATCH /api/actions/:id

**Modifies an existing action**

#### URL Parameters

| Parameter | Type   | Description              |
|-----------|--------|--------------------------|
| `id`      | string | ID of action to modify   |

#### Body (JSON) - All fields are optional

| Field             | Type         | Description              |
|-------------------|--------------|--------------------------|
| `title`           | string       | New title                |
| `type`            | ActionType   | New type                 |
| `status`          | ActionStatus | New status               |
| `dueDate`         | Date / null  | New date (or null)       |
| `sourceSentence`  | string       | New source sentence      |
| `emailFrom`       | string       | New sender               |

#### Successful Response (200)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "URGENT call client ABC",
    "type": "CALL",
    "status": "TODO",
    "dueDate": "2024-01-18T10:00:00.000Z",
    "sourceSentence": "URGENT: call client ABC.",
    "emailFrom": "sales@company.com",
    "emailReceivedAt": "2024-01-16T14:20:00.000Z",
    "createdAt": "2024-01-16T14:25:00.000Z",
    "updatedAt": "2024-01-17T09:15:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action updated successfully"
}
```

#### Possible Errors

- `401`: Not authenticated
- `403`: This action does not belong to you
- `404`: Action not found
- `400`: Validation failed

#### Request Example

```bash
curl -X PATCH http://localhost:3000/api/actions/clx1234567890 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "title": "URGENT call client ABC",
    "dueDate": "2024-01-18T10:00:00.000Z"
  }'
```

#### With fetch (Frontend)

```typescript
const actionId = "clx1234567890";
const updates = {
  title: "URGENT call client ABC",
  dueDate: new Date("2024-01-18T10:00:00.000Z").toISOString(),
};

const response = await fetch(`/api/actions/${actionId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updates),
});

const { action, message } = await response.json();
```

---

### 4. POST /api/actions/:id/done

**Marks an action as completed (DONE)**

#### URL Parameters

| Parameter | Type   | Description                   |
|-----------|--------|-------------------------------|
| `id`      | string | ID of action to mark as DONE  |

#### Body

No body required.

#### Successful Response (200)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Call client ABC",
    "type": "CALL",
    "status": "DONE",
    "dueDate": "2024-01-20T16:00:00.000Z",
    "sourceSentence": "We should call client ABC.",
    "emailFrom": "sales@company.com",
    "emailReceivedAt": "2024-01-16T14:20:00.000Z",
    "createdAt": "2024-01-16T14:25:00.000Z",
    "updatedAt": "2024-01-18T11:30:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action marked as completed"
}
```

#### Request Example

```bash
curl -X POST http://localhost:3000/api/actions/clx1234567890/done \
  -H "Cookie: next-auth.session-token=..."
```

#### With fetch (Frontend)

```typescript
const actionId = "clx1234567890";

const response = await fetch(`/api/actions/${actionId}/done`, {
  method: 'POST',
});

const { action, message } = await response.json();
console.log(message); // "Action marked as completed"
```

---

### 5. POST /api/actions/:id/ignore

**Marks an action as ignored (IGNORED)**

#### URL Parameters

| Parameter | Type   | Description                      |
|-----------|--------|----------------------------------|
| `id`      | string | ID of action to mark as IGNORED  |

#### Body

No body required.

#### Successful Response (200)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Send signed documents",
    "type": "SEND",
    "status": "IGNORED",
    "dueDate": null,
    "sourceSentence": "Don't forget to send me the signed documents.",
    "emailFrom": "legal@partner.com",
    "emailReceivedAt": "2024-01-12T13:00:00.000Z",
    "createdAt": "2024-01-12T13:05:00.000Z",
    "updatedAt": "2024-01-18T14:00:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action marked as ignored"
}
```

#### Request Example

```bash
curl -X POST http://localhost:3000/api/actions/clx1234567890/ignore \
  -H "Cookie: next-auth.session-token=..."
```

#### With fetch (Frontend)

```typescript
const actionId = "clx1234567890";

const response = await fetch(`/api/actions/${actionId}/ignore`, {
  method: 'POST',
});

const { action, message } = await response.json();
console.log(message); // "Action marked as ignored"
```

---

### 6. DELETE /api/actions/:id

**Deletes an action**

#### URL Parameters

| Parameter | Type   | Description              |
|-----------|--------|--------------------------|
| `id`      | string | ID of action to delete   |

#### Successful Response (200)

```json
{
  "message": "Action deleted successfully"
}
```

#### Request Example

```bash
curl -X DELETE http://localhost:3000/api/actions/clx1234567890 \
  -H "Cookie: next-auth.session-token=..."
```

#### With fetch (Frontend)

```typescript
const actionId = "clx1234567890";

const response = await fetch(`/api/actions/${actionId}`, {
  method: 'DELETE',
});

const { message } = await response.json();
```

---

## Security Details

### 1. NextAuth Authentication

Each endpoint starts with:
```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json(
    { error: "Not authenticated" },
    { status: 401 }
  );
}
```

### 2. User Data Isolation

**GET /api/actions**:
```typescript
const actions = await prisma.action.findMany({
  where: {
    userId: session.user.id, // ✅ Only user's actions
  },
});
```

**POST /api/actions**:
```typescript
const action = await prisma.action.create({
  data: {
    userId: session.user.id, // ✅ Assigned to connected user
    // ... other fields
  },
});
```

### 3. Ownership Verification (Modification/Deletion)

Before any modification, we verify the action belongs to the user:

```typescript
// 1. Retrieve the action
const existingAction = await prisma.action.findUnique({
  where: { id },
});

// 2. Check it exists
if (!existingAction) {
  return NextResponse.json(
    { error: "Action not found" },
    { status: 404 }
  );
}

// 3. Check ownership
if (existingAction.userId !== session.user.id) {
  return NextResponse.json(
    { error: "Unauthorized access" },
    { status: 403 }
  );
}

// 4. OK, we can modify/delete
```

### 4. Data Validation

**Simple validation without Zod**:

```typescript
// Check required fields
if (!title || typeof title !== "string" || title.trim().length === 0) {
  return NextResponse.json(
    { error: "Title is required" },
    { status: 400 }
  );
}

// Check enums
if (!["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"].includes(type)) {
  return NextResponse.json(
    { error: "Invalid action type" },
    { status: 400 }
  );
}
```

### 5. Attack Protection

| Attack                 | Protection                                    |
|------------------------|-----------------------------------------------|
| **Unauthorized access**| `userId` verification on each request         |
| **SQL Injection**      | Prisma ORM (parameterized queries)            |
| **XSS**                | No server-side HTML rendering                 |
| **CSRF**               | Built-in NextAuth CSRF protection             |
| **ID enumeration**     | Ownership verification before each action     |

---

## Complete Usage Examples

### Create an action, mark it as done, then delete it

```typescript
// 1. Create
const createResponse = await fetch('/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: "Call client ABC",
    type: "CALL",
    sourceSentence: "We should call client ABC.",
    emailFrom: "sales@company.com",
    emailReceivedAt: new Date().toISOString(),
  }),
});
const { action } = await createResponse.json();
console.log("Action created:", action.id);

// 2. Mark as DONE
const doneResponse = await fetch(`/api/actions/${action.id}/done`, {
  method: 'POST',
});
const { message } = await doneResponse.json();
console.log(message); // "Action marked as completed"

// 3. Delete
const deleteResponse = await fetch(`/api/actions/${action.id}`, {
  method: 'DELETE',
});
const { message: deleteMessage } = await deleteResponse.json();
console.log(deleteMessage); // "Action deleted successfully"
```

### Retrieve and filter actions

```typescript
// All TODO actions
const todoResponse = await fetch('/api/actions?status=TODO');
const { actions: todoActions } = await todoResponse.json();

// PAY type actions with due date
const payActions = todoActions.filter(
  action => action.type === 'PAY' && action.dueDate
);

console.log(`${payActions.length} payments to make`);
```

---

## Testing with curl

**Create a test user and get their token**:
```bash
# Log in and get the session cookie
# (depends on your NextAuth configuration)
```

**Test all endpoints**:
```bash
# List
curl -X GET http://localhost:3000/api/actions

# Create
curl -X POST http://localhost:3000/api/actions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","type":"SEND","sourceSentence":"Test","emailFrom":"test@test.com","emailReceivedAt":"2024-01-01T00:00:00Z"}'

# Modify
curl -X PATCH http://localhost:3000/api/actions/ACTION_ID \
  -H "Content-Type: application/json" \
  -d '{"title":"New title"}'

# Mark done
curl -X POST http://localhost:3000/api/actions/ACTION_ID/done

# Mark ignored
curl -X POST http://localhost:3000/api/actions/ACTION_ID/ignore

# Delete
curl -X DELETE http://localhost:3000/api/actions/ACTION_ID
```

---

## Endpoints Summary

| Method | Endpoint                      | Description              | Auth |
|--------|-------------------------------|--------------------------|------|
| GET    | `/api/actions`                | List actions             | ✅   |
| POST   | `/api/actions`                | Create action            | ✅   |
| PATCH  | `/api/actions/:id`            | Modify action            | ✅   |
| DELETE | `/api/actions/:id`            | Delete action            | ✅   |
| POST   | `/api/actions/:id/done`       | Mark as completed        | ✅   |
| POST   | `/api/actions/:id/ignore`     | Mark as ignored          | ✅   |
