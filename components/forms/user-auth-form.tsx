"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/shared/icons";
import { toast } from "sonner";

const authSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

type AuthFormData = z.infer<typeof authSchema>;

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: "login" | "register";
}

// Check which OAuth providers are enabled
const isGoogleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
const isMicrosoftEnabled = process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED === "true";
const hasOAuthProviders = isGoogleEnabled || isMicrosoftEnabled;

export function UserAuthForm({ className, mode = "login", ...props }: UserAuthFormProps) {
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = React.useState(false);
  const [isCredentialsLoading, setIsCredentialsLoading] = React.useState(false);
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  async function onCredentialsSubmit(data: AuthFormData) {
    setIsCredentialsLoading(true);

    try {
      if (mode === "register") {
        // Registration flow
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || "Erreur lors de l'inscription");
          return;
        }

        toast.success("Compte créé ! Connexion en cours...");
      }

      // Sign in with credentials
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Email ou mot de passe incorrect");
        return;
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsCredentialsLoading(false);
    }
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
          {error === "OAuthCallback" || error === "Callback"
            ? "Session expirée. Veuillez vous reconnecter."
            : error === "CredentialsSignin"
            ? "Email ou mot de passe incorrect"
            : "Une erreur est survenue. Veuillez réessayer."}
        </div>
      )}

      {/* Credentials Form */}
      <form onSubmit={handleSubmit(onCredentialsSubmit)} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="nom@exemple.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isCredentialsLoading}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            disabled={isCredentialsLoading}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isCredentialsLoading}>
          {isCredentialsLoading && (
            <Icons.spinner className="mr-2 size-4 animate-spin" />
          )}
          {mode === "register" ? "Créer un compte" : "Se connecter"}
        </Button>
      </form>

      {/* OAuth Section - only shown if at least one provider is enabled */}
      {hasOAuthProviders && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou continuer avec
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="grid gap-2">
            {isGoogleEnabled && (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                onClick={() => {
                  setIsGoogleLoading(true);
                  signIn("google");
                }}
                disabled={isGoogleLoading || isMicrosoftLoading}
              >
                {isGoogleLoading ? (
                  <Icons.spinner className="mr-2 size-4 animate-spin" />
                ) : (
                  <Icons.google className="mr-2 size-4" />
                )}
                Google
              </button>
            )}

            {isMicrosoftEnabled && (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                onClick={() => {
                  setIsMicrosoftLoading(true);
                  signIn("microsoft-entra-id");
                }}
                disabled={isGoogleLoading || isMicrosoftLoading}
              >
                {isMicrosoftLoading ? (
                  <Icons.spinner className="mr-2 size-4 animate-spin" />
                ) : (
                  <Icons.microsoft className="mr-2 size-4" />
                )}
                Microsoft
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
