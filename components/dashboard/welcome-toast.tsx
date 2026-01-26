"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

interface WelcomeToastProps {
  userCreatedAt: Date;
}

export function WelcomeToast({ userCreatedAt }: WelcomeToastProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isWelcome = searchParams?.get("welcome") === "1";

  useEffect(() => {
    if (!isWelcome) return;

    // Vérifier si on vient du flow d'inscription
    const authFlow = typeof window !== "undefined"
      ? sessionStorage.getItem("auth_flow")
      : null;

    // Nettoyer le sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("auth_flow");
    }

    // Vérifier si l'utilisateur a été créé récemment (< 1 minute)
    const createdAt = new Date(userCreatedAt);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const isNewUser = diffMs < 60 * 1000; // Moins d'1 minute

    if (authFlow === "register") {
      if (isNewUser) {
        toast.success("Compte créé avec succès ! Bienvenue sur Inbox Actions.");
      } else {
        toast.info("Vous avez déjà un compte. Vous avez été connecté automatiquement.");
      }
    }

    // Nettoyer l'URL
    router.replace("/dashboard", { scroll: false });
  }, [isWelcome, userCreatedAt, router]);

  return null;
}
