# Actions API Usage Examples

Practical guide with concrete examples of using the Actions API in your React components.

---

## API Client Import

```typescript
import {
  getActions,
  createAction,
  updateAction,
  deleteAction,
  markActionAsDone,
  markActionAsIgnored,
  type ActionWithUser,
  type CreateActionInput,
} from "@/lib/api/actions";
```

---

## Basic Examples

### 1. Retrieve All Actions

```typescript
"use client";

import { useEffect, useState } from "react";
import { getActions, type ActionWithUser } from "@/lib/api/actions";

export function ActionsList() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActions() {
      try {
        setLoading(true);
        const data = await getActions();
        setActions(data.actions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchActions();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>My actions ({actions.length})</h2>
      <ul>
        {actions.map((action) => (
          <li key={action.id}>
            {action.title} - {action.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 2. Filter TODO Actions

```typescript
"use client";

import { useEffect, useState } from "react";
import { getActions, type ActionWithUser } from "@/lib/api/actions";

export function TodoActions() {
  const [todoActions, setTodoActions] = useState<ActionWithUser[]>([]);

  useEffect(() => {
    async function fetchTodoActions() {
      try {
        const data = await getActions({ status: "TODO" });
        setTodoActions(data.actions);
      } catch (err) {
        console.error("Error:", err);
      }
    }

    fetchTodoActions();
  }, []);

  return (
    <div>
      <h2>Actions to do</h2>
      {todoActions.map((action) => (
        <div key={action.id}>
          <h3>{action.title}</h3>
          <p>Type: {action.type}</p>
          {action.dueDate && (
            <p>Due date: {new Date(action.dueDate).toLocaleDateString()}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 3. Create a New Action

```typescript
"use client";

import { useState } from "react";
import { createAction } from "@/lib/api/actions";
import { toast } from "sonner";

export function CreateActionForm() {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);

      const newAction = await createAction({
        title,
        type: "SEND",
        sourceSentence: "Manually created action",
        emailFrom: "manual@user.com",
        emailReceivedAt: new Date().toISOString(),
      });

      toast.success(newAction.message);
      setTitle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Action title"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

### 4. Mark an Action as Completed

```typescript
"use client";

import { markActionAsDone } from "@/lib/api/actions";
import { toast } from "sonner";

export function ActionItem({ action }: { action: ActionWithUser }) {
  async function handleMarkDone() {
    try {
      const result = await markActionAsDone(action.id);
      toast.success(result.message);
      // Reload list or update state
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div>
      <h3>{action.title}</h3>
      <p>Status: {action.status}</p>
      {action.status === "TODO" && (
        <button onClick={handleMarkDone}>
          Mark as completed
        </button>
      )}
    </div>
  );
}
```

---

## Advanced Examples

### 1. Complete Component with CRUD

```typescript
"use client";

import { useEffect, useState } from "react";
import {
  getActions,
  createAction,
  updateAction,
  deleteAction,
  markActionAsDone,
  type ActionWithUser,
} from "@/lib/api/actions";
import { toast } from "sonner";

export function ActionsManager() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load actions
  async function loadActions() {
    try {
      setLoading(true);
      const data = await getActions();
      setActions(data.actions);
    } catch (err) {
      toast.error("Loading error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActions();
  }, []);

  // Create
  async function handleCreate(title: string) {
    try {
      await createAction({
        title,
        type: "SEND",
        sourceSentence: "Manual action",
        emailFrom: "user@app.com",
        emailReceivedAt: new Date(),
      });
      toast.success("Action created");
      loadActions(); // Reload
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  // Modify
  async function handleUpdate(id: string, title: string) {
    try {
      await updateAction(id, { title });
      toast.success("Action updated");
      loadActions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  // Delete
  async function handleDelete(id: string) {
    if (!confirm("Delete this action?")) return;

    try {
      await deleteAction(id);
      toast.success("Action deleted");
      loadActions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  // Mark done
  async function handleMarkDone(id: string) {
    try {
      await markActionAsDone(id);
      toast.success("Action completed");
      loadActions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My actions ({actions.length})</h1>

      {actions.map((action) => (
        <div key={action.id} className="action-card">
          <h3>{action.title}</h3>
          <p>Type: {action.type}</p>
          <p>Status: {action.status}</p>

          <div className="actions">
            {action.status === "TODO" && (
              <button onClick={() => handleMarkDone(action.id)}>
                ✓ Complete
              </button>
            )}
            <button onClick={() => handleDelete(action.id)}>
              🗑 Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 2. Dynamic Filters

```typescript
"use client";

import { useState, useEffect } from "react";
import { getActions, type ActionWithUser, type ActionStatus } from "@/lib/api/actions";

export function FilteredActions() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);
  const [statusFilter, setStatusFilter] = useState<ActionStatus | "ALL">("ALL");

  useEffect(() => {
    async function fetchActions() {
      try {
        const params = statusFilter === "ALL" ? {} : { status: statusFilter };
        const data = await getActions(params);
        setActions(data.actions);
      } catch (err) {
        console.error(err);
      }
    }

    fetchActions();
  }, [statusFilter]);

  return (
    <div>
      <div className="filters">
        <button onClick={() => setStatusFilter("ALL")}>
          All ({actions.length})
        </button>
        <button onClick={() => setStatusFilter("TODO")}>
          To do
        </button>
        <button onClick={() => setStatusFilter("DONE")}>
          Completed
        </button>
        <button onClick={() => setStatusFilter("IGNORED")}>
          Ignored
        </button>
      </div>

      <div className="actions-list">
        {actions.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}
```

### 3. Sort by Due Date

```typescript
"use client";

import { useState, useEffect } from "react";
import { getActions, type ActionWithUser } from "@/lib/api/actions";

export function ActionsByDueDate() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);

  useEffect(() => {
    async function fetchActions() {
      try {
        const data = await getActions({ status: "TODO" });

        // Sort by due date
        const sorted = data.actions.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        setActions(sorted);
      } catch (err) {
        console.error(err);
      }
    }

    fetchActions();
  }, []);

  // Group by urgency
  const now = new Date();
  const urgent = actions.filter(a => {
    if (!a.dueDate) return false;
    const diff = new Date(a.dueDate).getTime() - now.getTime();
    return diff > 0 && diff < 24 * 60 * 60 * 1000; // < 24h
  });

  const upcoming = actions.filter(a => {
    if (!a.dueDate) return false;
    const diff = new Date(a.dueDate).getTime() - now.getTime();
    return diff >= 24 * 60 * 60 * 1000; // >= 24h
  });

  const noDueDate = actions.filter(a => !a.dueDate);

  return (
    <div>
      {urgent.length > 0 && (
        <div className="urgent">
          <h2>🔴 Urgent (less than 24h)</h2>
          {urgent.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="upcoming">
          <h2>⏰ Upcoming</h2>
          {upcoming.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}

      {noDueDate.length > 0 && (
        <div className="no-deadline">
          <h2>📋 No deadline</h2>
          {noDueDate.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4. Complete Creation Form

```typescript
"use client";

import { useState } from "react";
import { createAction, type CreateActionInput } from "@/lib/api/actions";
import { toast } from "sonner";

export function CreateActionFormComplete() {
  const [formData, setFormData] = useState<CreateActionInput>({
    title: "",
    type: "SEND",
    sourceSentence: "",
    emailFrom: "",
    emailReceivedAt: new Date(),
    dueDate: null,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      const result = await createAction(formData);
      toast.success(result.message);

      // Reset form
      setFormData({
        title: "",
        type: "SEND",
        sourceSentence: "",
        emailFrom: "",
        emailReceivedAt: new Date(),
        dueDate: null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Title *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Type *</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
        >
          <option value="SEND">Send</option>
          <option value="CALL">Call</option>
          <option value="FOLLOW_UP">Follow up</option>
          <option value="PAY">Pay</option>
          <option value="VALIDATE">Validate</option>
        </select>
      </div>

      <div>
        <label>Source sentence *</label>
        <textarea
          value={formData.sourceSentence}
          onChange={(e) => setFormData({ ...formData, sourceSentence: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Sender email *</label>
        <input
          type="email"
          value={formData.emailFrom}
          onChange={(e) => setFormData({ ...formData, emailFrom: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Due date</label>
        <input
          type="datetime-local"
          value={formData.dueDate ? new Date(formData.dueDate).toISOString().slice(0, 16) : ""}
          onChange={(e) => setFormData({
            ...formData,
            dueDate: e.target.value ? new Date(e.target.value) : null
          })}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create action"}
      </button>
    </form>
  );
}
```

---

## Optimizations and Best Practices

### 1. Using React Query (Recommended)

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActions, markActionAsDone } from "@/lib/api/actions";
import { toast } from "sonner";

export function ActionsWithReactQuery() {
  const queryClient = useQueryClient();

  // Retrieve actions
  const { data, isLoading, error } = useQuery({
    queryKey: ["actions"],
    queryFn: () => getActions(),
  });

  // Mutation to mark done
  const markDoneMutation = useMutation({
    mutationFn: markActionAsDone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      toast.success("Action completed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error");
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.actions.map((action) => (
        <div key={action.id}>
          <h3>{action.title}</h3>
          <button onClick={() => markDoneMutation.mutate(action.id)}>
            Complete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Robust Error Handling

```typescript
async function handleAction(actionFn: () => Promise<any>) {
  try {
    await actionFn();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("Not authenticated")) {
        // Redirect to login
        window.location.href = "/login";
      } else if (err.message.includes("Unauthorized access")) {
        toast.error("You don't have access to this action");
      } else {
        toast.error(err.message);
      }
    } else {
      toast.error("An error occurred");
    }
  }
}
```

### 3. Optimistic Updates

```typescript
const markDoneMutation = useMutation({
  mutationFn: markActionAsDone,
  onMutate: async (actionId) => {
    // Cancel ongoing requests
    await queryClient.cancelQueries({ queryKey: ["actions"] });

    // Snapshot of previous state
    const previousActions = queryClient.getQueryData(["actions"]);

    // Optimistic update
    queryClient.setQueryData(["actions"], (old: any) => ({
      ...old,
      actions: old.actions.map((a: any) =>
        a.id === actionId ? { ...a, status: "DONE" } : a
      ),
    }));

    return { previousActions };
  },
  onError: (err, actionId, context) => {
    // Rollback on error
    queryClient.setQueryData(["actions"], context?.previousActions);
    toast.error("Error");
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["actions"] });
  },
});
```

---

## Summary

| Function                  | Usage                              |
|---------------------------|-------------------------------------|
| `getActions()`            | Retrieve all actions                |
| `getActions({ status })`  | Filter by status                    |
| `createAction(data)`      | Create an action                    |
| `updateAction(id, data)`  | Modify an action                    |
| `deleteAction(id)`        | Delete an action                    |
| `markActionAsDone(id)`    | Mark as completed                   |
| `markActionAsIgnored(id)` | Mark as ignored                     |

**All helpers automatically handle**:
- ✅ HTTP errors
- ✅ JSON parsing
- ✅ TypeScript types
- ✅ Clear error messages
