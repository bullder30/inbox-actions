"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/shared/icons";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères"),
});

const registerSchema = loginSchema
  .extend({
    confirmPassword: z
      .string()
      .min(12, "Le mot de passe doit contenir au moins 12 caractères"),
    termsAccepted: z
      .boolean()
      .refine((v) => v === true, "Vous devez accepter les CGU"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: "login" | "register";
}

// Check which OAuth providers are enabled
const isGoogleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
const isMicrosoftEnabled =
  process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED === "true";
const hasOAuthProviders = isGoogleEnabled || isMicrosoftEnabled;

export function UserAuthForm({
  className,
  mode = "login",
  ...props
}: UserAuthFormProps) {
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = React.useState(false);
  const [isCredentialsLoading, setIsCredentialsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(
    null,
  );
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const isRegister = mode === "register";
  const isOAuthLoading = isGoogleLoading || isMicrosoftLoading;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: { termsAccepted: false },
  });

  const termsAccepted = watch("termsAccepted");

  async function onCredentialsSubmit(data: RegisterFormData) {
    setIsCredentialsLoading(true);

    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            turnstileToken: turnstileToken ?? undefined,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || "Erreur lors de l'inscription");
          return;
        }

        toast.success("Compte créé ! Connexion en cours...");
      }

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Email ou mot de passe incorrect");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
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

      <form onSubmit={handleSubmit(onCredentialsSubmit)} className="grid gap-4">
        {/* Email */}
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

        {/* Password */}
        <div className="grid gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              disabled={isCredentialsLoading}
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
          {!isRegister && (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          )}
        </div>

        {/* Confirm Password (register only) */}
        {isRegister && (
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isCredentialsLoading}
                className="pr-10"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={
                  showConfirmPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        )}

        {/* CGU Checkbox (register only) */}
        {isRegister && (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={termsAccepted ?? false}
                onCheckedChange={(checked) =>
                  setValue("termsAccepted", checked === true, {
                    shouldValidate: true,
                  })
                }
                disabled={isCredentialsLoading}
                className="mt-0.5"
              />
              <label
                htmlFor="terms"
                className="text-xs leading-relaxed text-muted-foreground"
              >
                J&apos;accepte les{" "}
                <Link
                  href="/terms"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  CGU
                </Link>{" "}
                et la{" "}
                <Link
                  href="/privacy"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Politique de confidentialité
                </Link>
              </label>
            </div>
            {errors.termsAccepted && (
              <p className="text-xs text-destructive">
                {errors.termsAccepted.message}
              </p>
            )}
          </div>
        )}

        {/* Turnstile CAPTCHA (register only, shown when site key is configured) */}
        {isRegister && turnstileSiteKey && (
          <Turnstile
            siteKey={turnstileSiteKey}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
            options={{ theme: "auto" }}
          />
        )}

        <Button
          type="submit"
          disabled={
            isCredentialsLoading ||
            isOAuthLoading ||
            (isRegister && !!turnstileSiteKey && !turnstileToken)
          }
        >
          {isCredentialsLoading && (
            <Icons.spinner className="mr-2 size-4 animate-spin" />
          )}
          {isRegister ? "Créer un compte" : "Se connecter"}
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

          <div className="grid gap-2">
            {isGoogleEnabled && (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }))}
                onClick={() => {
                  setIsGoogleLoading(true);
                  signIn("google");
                }}
                disabled={
                  isGoogleLoading || isMicrosoftLoading || isCredentialsLoading
                }
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
                disabled={
                  isGoogleLoading || isMicrosoftLoading || isCredentialsLoading
                }
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
