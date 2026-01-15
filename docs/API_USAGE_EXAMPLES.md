# Exemples d'utilisation de l'API Actions

Guide pratique avec des exemples concrets d'utilisation de l'API Actions dans vos composants React.

---

## 🚀 Import du client API

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

## 📋 Exemples de base

### 1. Récupérer toutes les actions

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
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    }

    fetchActions();
  }, []);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div>
      <h2>Mes actions ({actions.length})</h2>
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

### 2. Filtrer les actions TODO

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
        console.error("Erreur:", err);
      }
    }

    fetchTodoActions();
  }, []);

  return (
    <div>
      <h2>Actions à faire</h2>
      {todoActions.map((action) => (
        <div key={action.id}>
          <h3>{action.title}</h3>
          <p>Type: {action.type}</p>
          {action.dueDate && (
            <p>Échéance: {new Date(action.dueDate).toLocaleDateString()}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 3. Créer une nouvelle action

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
        sourceSentence: "Action créée manuellement",
        emailFrom: "manuel@user.com",
        emailReceivedAt: new Date().toISOString(),
      });

      toast.success(newAction.message);
      setTitle("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
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
        placeholder="Titre de l'action"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Création..." : "Créer"}
      </button>
    </form>
  );
}
```

### 4. Marquer une action comme terminée

```typescript
"use client";

import { markActionAsDone } from "@/lib/api/actions";
import { toast } from "sonner";

export function ActionItem({ action }: { action: ActionWithUser }) {
  async function handleMarkDone() {
    try {
      const result = await markActionAsDone(action.id);
      toast.success(result.message);
      // Recharger la liste ou mettre à jour l'état
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div>
      <h3>{action.title}</h3>
      <p>Statut: {action.status}</p>
      {action.status === "TODO" && (
        <button onClick={handleMarkDone}>
          Marquer comme terminé
        </button>
      )}
    </div>
  );
}
```

---

## 🎯 Exemples avancés

### 1. Composant complet avec CRUD

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

  // Charger les actions
  async function loadActions() {
    try {
      setLoading(true);
      const data = await getActions();
      setActions(data.actions);
    } catch (err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActions();
  }, []);

  // Créer
  async function handleCreate(title: string) {
    try {
      await createAction({
        title,
        type: "SEND",
        sourceSentence: "Action manuelle",
        emailFrom: "user@app.com",
        emailReceivedAt: new Date(),
      });
      toast.success("Action créée");
      loadActions(); // Recharger
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  // Modifier
  async function handleUpdate(id: string, title: string) {
    try {
      await updateAction(id, { title });
      toast.success("Action mise à jour");
      loadActions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  // Supprimer
  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette action ?")) return;

    try {
      await deleteAction(id);
      toast.success("Action supprimée");
      loadActions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  // Marquer done
  async function handleMarkDone(id: string) {
    try {
      await markActionAsDone(id);
      toast.success("Action terminée");
      loadActions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      <h1>Mes actions ({actions.length})</h1>

      {actions.map((action) => (
        <div key={action.id} className="action-card">
          <h3>{action.title}</h3>
          <p>Type: {action.type}</p>
          <p>Statut: {action.status}</p>

          <div className="actions">
            {action.status === "TODO" && (
              <button onClick={() => handleMarkDone(action.id)}>
                ✓ Terminer
              </button>
            )}
            <button onClick={() => handleDelete(action.id)}>
              🗑 Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 2. Filtres dynamiques

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
          Toutes ({actions.length})
        </button>
        <button onClick={() => setStatusFilter("TODO")}>
          À faire
        </button>
        <button onClick={() => setStatusFilter("DONE")}>
          Terminées
        </button>
        <button onClick={() => setStatusFilter("IGNORED")}>
          Ignorées
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

### 3. Tri par date d'échéance

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

        // Trier par date d'échéance
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

  // Grouper par urgence
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
          <h2>🔴 Urgent (moins de 24h)</h2>
          {urgent.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="upcoming">
          <h2>⏰ À venir</h2>
          {upcoming.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}

      {noDueDate.length > 0 && (
        <div className="no-deadline">
          <h2>📋 Sans échéance</h2>
          {noDueDate.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4. Formulaire de création complet

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
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label>Titre *</label>
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
          <option value="SEND">Envoyer</option>
          <option value="CALL">Appeler</option>
          <option value="FOLLOW_UP">Relancer</option>
          <option value="PAY">Payer</option>
          <option value="VALIDATE">Valider</option>
        </select>
      </div>

      <div>
        <label>Phrase source *</label>
        <textarea
          value={formData.sourceSentence}
          onChange={(e) => setFormData({ ...formData, sourceSentence: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Email de l'expéditeur *</label>
        <input
          type="email"
          value={formData.emailFrom}
          onChange={(e) => setFormData({ ...formData, emailFrom: e.target.value })}
          required
        />
      </div>

      <div>
        <label>Date d'échéance</label>
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
        {loading ? "Création..." : "Créer l'action"}
      </button>
    </form>
  );
}
```

---

## ⚡ Optimisations et bonnes pratiques

### 1. Utiliser React Query (Recommandé)

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActions, markActionAsDone } from "@/lib/api/actions";
import { toast } from "sonner";

export function ActionsWithReactQuery() {
  const queryClient = useQueryClient();

  // Récupérer les actions
  const { data, isLoading, error } = useQuery({
    queryKey: ["actions"],
    queryFn: () => getActions(),
  });

  // Mutation pour marquer done
  const markDoneMutation = useMutation({
    mutationFn: markActionAsDone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      toast.success("Action terminée");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erreur");
    },
  });

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;

  return (
    <div>
      {data?.actions.map((action) => (
        <div key={action.id}>
          <h3>{action.title}</h3>
          <button onClick={() => markDoneMutation.mutate(action.id)}>
            Terminer
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Gestion d'erreurs robuste

```typescript
async function handleAction(actionFn: () => Promise<any>) {
  try {
    await actionFn();
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("Non authentifié")) {
        // Rediriger vers login
        window.location.href = "/login";
      } else if (err.message.includes("Accès non autorisé")) {
        toast.error("Vous n'avez pas accès à cette action");
      } else {
        toast.error(err.message);
      }
    } else {
      toast.error("Une erreur est survenue");
    }
  }
}
```

### 3. Optimistic Updates

```typescript
const markDoneMutation = useMutation({
  mutationFn: markActionAsDone,
  onMutate: async (actionId) => {
    // Annuler les requêtes en cours
    await queryClient.cancelQueries({ queryKey: ["actions"] });

    // Snapshot de l'état précédent
    const previousActions = queryClient.getQueryData(["actions"]);

    // Mise à jour optimiste
    queryClient.setQueryData(["actions"], (old: any) => ({
      ...old,
      actions: old.actions.map((a: any) =>
        a.id === actionId ? { ...a, status: "DONE" } : a
      ),
    }));

    return { previousActions };
  },
  onError: (err, actionId, context) => {
    // Rollback en cas d'erreur
    queryClient.setQueryData(["actions"], context?.previousActions);
    toast.error("Erreur");
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["actions"] });
  },
});
```

---

## 📚 Résumé

| Fonction                  | Utilisation                          |
|---------------------------|--------------------------------------|
| `getActions()`            | Récupérer toutes les actions         |
| `getActions({ status })`  | Filtrer par statut                   |
| `createAction(data)`      | Créer une action                     |
| `updateAction(id, data)`  | Modifier une action                  |
| `deleteAction(id)`        | Supprimer une action                 |
| `markActionAsDone(id)`    | Marquer comme terminée               |
| `markActionAsIgnored(id)` | Marquer comme ignorée                |

**Tous les helpers gèrent automatiquement** :
- ✅ Les erreurs HTTP
- ✅ Le parsing JSON
- ✅ Les types TypeScript
- ✅ Les messages d'erreur clairs
