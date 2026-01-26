"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/shared/icons";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          {error === "OAuthCallback" || error === "Callback"
            ? "Session expirée. Veuillez vous reconnecter."
            : "Une erreur est survenue. Veuillez réessayer."}
        </div>
      )}
      <button
        type="button"
        className={cn(buttonVariants({ size: "lg" }))}
        onClick={() => {
          setIsLoading(true);
          signIn("google");
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <Icons.spinner className="mr-2 size-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 size-4" />
        )}
        Continuer avec Google
      </button>
    </div>
  );
}
