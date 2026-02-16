import "server-only";

import { cache } from "react";
import { auth } from "@/auth";
import { getUserById } from "@/lib/user";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user) {
    return undefined;
  }

  // Vérifier que l'utilisateur existe toujours en base de données
  // Protège contre les tokens JWT orphelins (user supprimé de la DB)
  if (session.user.id) {
    const dbUser = await getUserById(session.user.id);
    if (!dbUser) {
      console.warn(`[Session] Orphan JWT detected: user ${session.user.id} (${session.user.email}) not found in DB`);
      return undefined;
    }
  }

  return session.user;
});