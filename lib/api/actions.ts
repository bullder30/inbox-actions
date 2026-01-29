/**
 * API Client pour les actions
 * Helpers TypeScript pour consommer l'API Actions côté frontend
 */

import { Action, ActionStatus, ActionType } from "@prisma/client";

// Types pour les réponses API
// Note: imapUID est converti en string dans les API routes (BigInt non supporté en JSON)
// Pour les Server Components qui utilisent Prisma directement, utiliser ActionWithUserPrisma
export type ActionWithUser = Omit<Action, "imapUID"> & {
  imapUID: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

// Type pour les données Prisma brutes (Server Components)
export type ActionWithUserPrisma = Action & {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type GetActionsResponse = {
  actions: ActionWithUser[];
  count: number;
};

export type CreateActionResponse = {
  action: ActionWithUser;
  message: string;
};

export type UpdateActionResponse = {
  action: ActionWithUser;
  message: string;
};

export type DeleteActionResponse = {
  message: string;
};

// Types pour les requêtes
export type CreateActionInput = {
  title: string;
  type: ActionType;
  sourceSentence: string;
  emailFrom: string;
  emailReceivedAt: Date | string;
  dueDate?: Date | string | null;
  status?: ActionStatus;
};

export type UpdateActionInput = Partial<{
  title: string;
  type: ActionType;
  status: ActionStatus;
  dueDate: Date | string | null;
  sourceSentence: string;
  emailFrom: string;
}>;

export type GetActionsParams = {
  status?: ActionStatus;
  type?: ActionType;
};

/**
 * Récupère la liste des actions
 */
export async function getActions(
  params?: GetActionsParams
): Promise<GetActionsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.append("status", params.status);
  }
  if (params?.type) {
    searchParams.append("type", params.type);
  }

  const url = `/api/actions${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la récupération des actions");
  }

  return response.json();
}

/**
 * Crée une nouvelle action
 */
export async function createAction(
  data: CreateActionInput
): Promise<CreateActionResponse> {
  const response = await fetch("/api/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la création de l'action");
  }

  return response.json();
}

/**
 * Met à jour une action
 */
export async function updateAction(
  id: string,
  data: UpdateActionInput
): Promise<UpdateActionResponse> {
  const response = await fetch(`/api/actions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error || "Erreur lors de la mise à jour de l'action"
    );
  }

  return response.json();
}

/**
 * Supprime une action
 */
export async function deleteAction(id: string): Promise<DeleteActionResponse> {
  const response = await fetch(`/api/actions/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error || "Erreur lors de la suppression de l'action"
    );
  }

  return response.json();
}

/**
 * Marque une action comme terminée (DONE)
 */
export async function markActionAsDone(
  id: string
): Promise<UpdateActionResponse> {
  const response = await fetch(`/api/actions/${id}/done`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error || "Erreur lors de la mise à jour de l'action"
    );
  }

  return response.json();
}

/**
 * Marque une action comme ignorée (IGNORED)
 */
export async function markActionAsIgnored(
  id: string
): Promise<UpdateActionResponse> {
  const response = await fetch(`/api/actions/${id}/ignore`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error || "Erreur lors de la mise à jour de l'action"
    );
  }

  return response.json();
}

// Export des types Prisma pour utilisation dans les composants
export type { Action, ActionStatus, ActionType } from "@prisma/client";
