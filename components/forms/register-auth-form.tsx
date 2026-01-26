"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/shared/icons";

interface RegisterAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export function RegisterAuthForm({ className, ...props }: RegisterAuthFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isChecking, setIsChecking] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const authError = searchParams?.get("error");

  async function handleRegister() {
    setError(null);
    setIsLoading(true);

    // Stocker dans sessionStorage qu'on vient de register
    // pour afficher le bon message après OAuth
    if (typeof window !== "undefined") {
      sessionStorage.setItem("auth_flow", "register");
    }

    signIn("google", { callbackUrl: "/dashboard?welcome=1" });
  }

  return (
    <div className={cn("grid gap-4", className)} {...props}>
      {authError && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          {authError === "OAuthAccountNotLinked"
            ? "Un compte existe déjà avec cet email. Connectez-vous avec votre méthode habituelle."
            : authError === "OAuthCallback" || authError === "Callback"
            ? "Session expirée. Veuillez réessayer."
            : "Une erreur est survenue. Veuillez réessayer."}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          {error}
        </div>
      )}
      <button
        type="button"
        className={cn(buttonVariants({ size: "lg" }))}
        onClick={handleRegister}
        disabled={isLoading || isChecking}
      >
        {isLoading || isChecking ? (
          <Icons.spinner className="mr-2 size-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 size-4" />
        )}
        {isChecking ? "Vérification..." : "Créer un compte avec Google"}
      </button>
    </div>
  );
}
