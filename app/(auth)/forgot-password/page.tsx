"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Metadata } from "next";

import { BackButton } from "@/components/shared/back-button";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icons } from "@/components/shared/icons";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Email invalide"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        toast.error("Une erreur est survenue. Veuillez réessayer.");
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-4">
      <BackButton href="/login" className="absolute left-4 top-4" />
      <div className="w-full max-w-[320px] space-y-4 sm:max-w-[350px] sm:space-y-6">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <InboxActionsIcon size="md" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Inbox Actions
            </h1>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Réinitialisation du mot de passe
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 text-center text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation dans les prochaines minutes.
            </div>
            <p className="text-center">
              <Link
                href="/login"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
              >
                Retour à la connexion
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Saisissez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nom@exemple.com"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Icons.spinner className="mr-2 size-4 animate-spin" />}
              Envoyer le lien
            </Button>
            <p className="text-center">
              <Link
                href="/login"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
              >
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
